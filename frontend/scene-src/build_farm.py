"""Construye la finca realista de Terra en Blender y renderiza el recorrido del tractor.

Uso (Blender sin interfaz):
    blender -b -P build_farm.py -- --assets <dir> --regions <regions.json> --out <dir>
        [--frames 180] [--width 1600] [--height 900] [--only 60] [--samples 24]

Genera en --out:
    frames/frame_0000.png ...   fotogramas del recorrido
    track.json                  por fotograma: posición en pantalla del tractor y de las esquinas
                                de cada parcela (0..1, origen arriba-izquierda), para que la web
                                ponga zonas activas y resaltados encima del render.
    farm.blend                  la escena, para retocarla a mano si hace falta.

La geometría (camino, parcelas, relieve) replica src/scene/fieldLayout.js: el mismo camino en
coordenadas three.js (x, y arriba, z), convertidas aquí a Blender (x, -z, y).
"""

import argparse
import json
import math
import os
import random
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

# ───────────────────────── Argumentos ─────────────────────────

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument("--assets", required=True)
parser.add_argument("--regions", required=True)
parser.add_argument("--out", required=True)
parser.add_argument("--frames", type=int, default=180)
parser.add_argument("--width", type=int, default=1600)
parser.add_argument("--height", type=int, default=900)
parser.add_argument("--samples", type=int, default=24)
parser.add_argument("--only", type=int, default=None, help="renderiza solo este fotograma (prueba)")
parser.add_argument("--grass", type=int, default=160000, help="matas de pasto en total")
parser.add_argument("--engine", choices=("cycles", "eevee"), default="cycles")
args = parser.parse_args(argv)

ASSETS = args.assets
os.makedirs(os.path.join(args.out, "frames"), exist_ok=True)

# ───────────────────────── Datos compartidos con la web ─────────────────────────

ROAD_POINTS = [(-3, 40), (3, 24), (-5, 8), (5, -8), (-5, -24), (6, -40), (-4, -56), (1, -70)]  # (x, z) three.js
PARCEL_STATIONS = [0.2, 0.36, 0.52, 0.68, 0.84]
REGION_COLORS = ["#d9a62e", "#c8452f", "#2f7d8f", "#7a5aa8", "#3f8a3c"]
ROAD_HALF_WIDTH = 1.7

with open(args.regions) as handle:
    REGIONS = sorted(json.load(handle), key=lambda r: r["id"])[:5]


def to_blender(x, y, z):
    """three.js (y arriba, -z adelante) → Blender (z arriba)."""
    return Vector((x, -z, y))


def terrain_height(x, z):
    """Misma función que terrainHeight() en fieldLayout.js (coordenadas three.js)."""
    distance = math.hypot(x * 0.8, (z + 15) * 0.55)
    rise = min(1.0, max(0.0, (distance - 34) / 40))
    eased = rise * rise * (3 - 2 * rise)
    hills = math.sin(x * 0.045) * 6 + math.cos(z * 0.038 + x * 0.012) * 5 + math.sin((x + z) * 0.09) * 1.6 + 7
    return eased * hills


def hex_rgba(value, alpha=1.0):
    value = value.lstrip("#")
    srgb = [int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*linear, alpha)


# Camino: Catmull-Rom centrípeta muestreada densamente y reparametrizada por longitud de arco,
# igual que getPointAt() de three.js, para que "t" signifique lo mismo en la web y aquí.
def catmull_rom_centripetal(points, samples_per_segment=60):
    pts = [Vector((x, 0, z)) for x, z in points]
    pts = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]

        def knot(t, a, b):
            return t + max((b - a).length, 1e-4) ** 0.5

        t0 = 0.0
        t1 = knot(t0, p0, p1)
        t2 = knot(t1, p1, p2)
        t3 = knot(t2, p2, p3)
        for s in range(samples_per_segment):
            t = t1 + (t2 - t1) * s / samples_per_segment
            a1 = p0 * ((t1 - t) / (t1 - t0)) + p1 * ((t - t0) / (t1 - t0))
            a2 = p1 * ((t2 - t) / (t2 - t1)) + p2 * ((t - t1) / (t2 - t1))
            a3 = p2 * ((t3 - t) / (t3 - t2)) + p3 * ((t - t2) / (t3 - t2))
            b1 = a1 * ((t2 - t) / (t2 - t0)) + a2 * ((t - t0) / (t2 - t0))
            b2 = a2 * ((t3 - t) / (t3 - t1)) + a3 * ((t - t1) / (t3 - t1))
            out.append(b1 * ((t2 - t) / (t2 - t1)) + b2 * ((t - t1) / (t2 - t1)))
    out.append(pts[-2])
    return out


ROAD_SAMPLES = catmull_rom_centripetal(ROAD_POINTS)
_lengths = [0.0]
for a, b in zip(ROAD_SAMPLES, ROAD_SAMPLES[1:]):
    _lengths.append(_lengths[-1] + (b - a).length)
ROAD_LENGTH = _lengths[-1]


def road_at(t):
    """Punto y tangente (three.js) a la fracción t de la longitud del camino."""
    target = max(0.0, min(1.0, t)) * ROAD_LENGTH
    lo, hi = 0, len(_lengths) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if _lengths[mid] < target:
            lo = mid
        else:
            hi = mid
    span = (_lengths[hi] - _lengths[lo]) or 1
    f = (target - _lengths[lo]) / span
    point = ROAD_SAMPLES[lo].lerp(ROAD_SAMPLES[hi], f)
    tangent = (ROAD_SAMPLES[hi] - ROAD_SAMPLES[lo]).normalized()
    return point, tangent


def parcel_layout():
    parcels = []
    for index, region in enumerate(REGIONS):
        point, tangent = road_at(PARCEL_STATIONS[index])
        side = 1 if index % 2 == 0 else -1
        width = 11 + region["share"] * 0.55
        depth = 13
        normal = Vector((tangent.z, 0, -tangent.x)).normalized()
        center = point + normal * side * (ROAD_HALF_WIDTH + 1.6 + width / 2)
        parcels.append(
            dict(
                id=region["id"],
                index=index,
                crop=region["topCrop"],
                width=width,
                depth=depth,
                side=side,
                center=center,
                along=tangent.copy(),
                across=normal * side,
                color=REGION_COLORS[index],
            )
        )
    return parcels


PARCELS = parcel_layout()


def near_road(x, z, margin):
    return any((p.x - x) ** 2 + (p.z - z) ** 2 < margin * margin for p in ROAD_SAMPLES[::4])


def in_parcel(x, z, margin):
    for parcel in PARCELS:
        offset = Vector((x, 0, z)) - parcel["center"]
        if abs(offset.dot(parcel["along"])) < parcel["depth"] / 2 + margin and abs(offset.dot(parcel["across"])) < parcel["width"] / 2 + margin:
            return True
    return False


# ───────────────────────── Escena base ─────────────────────────

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.render.resolution_x = args.width
scene.render.resolution_y = args.height
scene.render.fps = 30
scene.frame_start = 0
scene.frame_end = args.frames - 1
def use_cycles():
    """Cycles en GPU: luz rebotada real, sombras suaves y, sobre todo, instancias baratas (el
    costo es por rayo, no por triángulo), lo que permite pasto escaneado por miles de matas."""
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for backend in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            if any(d.type == backend for d in prefs.devices):
                break
        except TypeError:
            continue
    for device in prefs.devices:
        device.use = device.type != "CPU"
    cycles = scene.cycles
    cycles.device = "GPU"
    cycles.samples = args.samples
    cycles.use_adaptive_sampling = True
    cycles.adaptive_threshold = 0.05
    cycles.use_denoising = True
    try:
        cycles.denoiser = "OPENIMAGEDENOISE"
    except TypeError:
        pass
    cycles.max_bounces = 4
    cycles.diffuse_bounces = 2
    cycles.glossy_bounces = 1
    cycles.transmission_bounces = 2
    cycles.transparent_max_bounces = 10
    cycles.caustics_reflective = False
    cycles.caustics_refractive = False
    # La escena es la misma en todos los fotogramas: se conserva entre renders (BVH incluido).
    scene.render.use_persistent_data = True


if args.engine == "cycles":
    use_cycles()
else:
    for engine in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
eevee = scene.eevee
# Sin raytracing: en una GTX 1650 duplica el tiempo por fotograma y las sombras del sol bastan.
for attr, value in (("taa_render_samples", args.samples), ("use_shadows", True), ("use_raytracing", False), ("shadow_ray_count", 1), ("shadow_step_count", 6)):
    if hasattr(eevee, attr):
        setattr(eevee, attr, value)
scene.view_settings.view_transform = "AgX"
for look in ("AgX - Punchy", "AgX - Medium High Contrast"):
    try:
        scene.view_settings.look = look
        break
    except TypeError:
        continue
scene.render.film_transparent = False
# El HDRI de amanecer es tenue: se compensa la exposición para que el campo no salga apagado.
scene.view_settings.exposure = 0.9 if args.engine == "eevee" else 0.85


def texture_material(name, folder, scale, tint=None, tint_mix=0.0, bump_waves=None):
    """Material PBR desde una carpeta con diff/nor/rough de Poly Haven, con escala en metros."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    coords = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1 / scale, 1 / scale, 1 / scale)
    links.new(coords.outputs["Object"], mapping.inputs["Vector"])

    def image(file, non_color):
        node = nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(os.path.join(ASSETS, "tex", folder, file))
        if non_color:
            node.image.colorspace_settings.name = "Non-Color"
        links.new(mapping.outputs["Vector"], node.inputs["Vector"])
        return node

    color = image("diff.jpg", False)
    color_out = color.outputs["Color"]
    if tint:
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = tint_mix
        links.new(color_out, mix.inputs["A"])
        mix.inputs["B"].default_value = hex_rgba(tint)
        color_out = mix.outputs["Result"]
    links.new(color_out, bsdf.inputs["Base Color"])
    links.new(image("rough.jpg", True).outputs["Color"], bsdf.inputs["Roughness"])
    normal_map = nodes.new("ShaderNodeNormalMap")
    links.new(image("nor.jpg", True).outputs["Color"], normal_map.inputs["Color"])
    if bump_waves:
        # Surcos de arado: una onda que levanta la tierra en hileras.
        wave = nodes.new("ShaderNodeTexWave")
        wave.inputs["Scale"].default_value = bump_waves
        links.new(coords.outputs["Object"], wave.inputs["Vector"])
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.6
        links.new(wave.outputs["Fac"], bump.inputs["Height"])
        links.new(normal_map.outputs["Normal"], bump.inputs["Normal"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    else:
        links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def flat_material(name, color, roughness=0.6, translucent=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Roughness"].default_value = roughness
    if translucent and "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = translucent
    return material


def instance_tinted_material(name, base, variation):
    """Hoja con tono distinto por instancia (Object Info → Random): rompe la uniformidad del pasto."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    info = nodes.new("ShaderNodeObjectInfo")
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hex_rgba(base)
    ramp.color_ramp.elements[1].color = hex_rgba(variation)
    links.new(info.outputs["Random"], ramp.inputs["Fac"])
    # Más claro hacia la punta de la brizna (coordenada generada en z).
    coords = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(coords.outputs["Generated"], sep.inputs["Vector"])
    tip = nodes.new("ShaderNodeMix")
    tip.data_type = "RGBA"
    tip.blend_type = "SCREEN"
    links.new(sep.outputs["Z"], tip.inputs["Factor"])
    links.new(ramp.outputs["Color"], tip.inputs["A"])
    tip.inputs["B"].default_value = (0.1, 0.09, 0.03, 1)
    links.new(tip.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.55
    if "Subsurface Weight" in bsdf.inputs:
        bsdf.inputs["Subsurface Weight"].default_value = 0.25
    material.use_backface_culling = False
    return material


def mesh_object(name, vertices, faces, material=None, collection=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in vertices], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    (collection or scene.collection).objects.link(obj)
    if material:
        mesh.materials.append(material)
    for poly in mesh.polygons:
        poly.use_smooth = True
    return obj


# ───────────────────────── Cielo y sol ─────────────────────────

world = bpy.data.worlds.new("Atardecer")
scene.world = world
world.use_nodes = True
wn, wl = world.node_tree.nodes, world.node_tree.links
background = next(n for n in wn if n.type == "BACKGROUND")
env = wn.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(ASSETS, "hdri", "bloem_field_sunrise_2k.hdr"))
env_mapping = wn.new("ShaderNodeMapping")
env_coords = wn.new("ShaderNodeTexCoord")
wl.new(env_coords.outputs["Generated"], env_mapping.inputs["Vector"])
wl.new(env_mapping.outputs["Vector"], env.inputs["Vector"])
wl.new(env.outputs["Color"], background.inputs["Color"])
background.inputs["Strength"].default_value = 0.8

# Dirección del sol del HDRI: el píxel más brillante. Se gira el cielo para que el sol quede
# bajo y a la derecha del recorrido (luz rasante cálida) y se alinea una lámpara de sol con él.
pixels = env.image.pixels[:]
w, h = env.image.size
best, best_index = -1.0, 0
for i in range(0, w * h, 7):
    lum = pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]
    if lum > best:
        best, best_index = lum, i
sun_u = (best_index % w) / w
sun_v = (best_index // w) / h
sun_elevation = (sun_v - 0.5) * math.pi
desired_azimuth = math.radians(20)  # desde +X hacia +Y en Blender: sol a la derecha y algo de frente
hdri_azimuth = (sun_u - 0.5) * 2 * math.pi
env_mapping.inputs["Rotation"].default_value = (0, 0, desired_azimuth - hdri_azimuth + math.pi)
# Sol rasante pero no tanto: sombras largas sin dejar media finca en penumbra.
sun_elevation = min(max(sun_elevation, math.radians(13)), math.radians(22))

sun_data = bpy.data.lights.new("Sol", "SUN")
sun_data.energy = 5.5
sun_data.color = (1.0, 0.8, 0.58)
sun_data.angle = math.radians(1.6)
sun = bpy.data.objects.new("Sol", sun_data)
scene.collection.objects.link(sun)
sun_direction = Vector((math.cos(sun_elevation) * math.cos(desired_azimuth), math.cos(sun_elevation) * math.sin(desired_azimuth), math.sin(sun_elevation)))
sun.rotation_euler = (-sun_direction).to_track_quat("-Z", "Y").to_euler()

# ───────────────────────── Terreno ─────────────────────────

SIZE, SEG = 360, 180
verts, faces = [], []
for j in range(SEG + 1):
    for i in range(SEG + 1):
        x = -SIZE / 2 + SIZE * i / SEG
        z3 = -SIZE / 2 + SIZE * j / SEG - 15
        verts.append(to_blender(x, terrain_height(x, z3), z3))
for j in range(SEG):
    for i in range(SEG):
        a = j * (SEG + 1) + i
        faces.append((a, a + 1, a + SEG + 2, a + SEG + 1))
ground_material = texture_material("Pasto suelo", "aerial_grass_rock", 6.0, tint="#93a85a", tint_mix=0.35)
terrain = mesh_object("Terreno", verts, faces, ground_material)

# ───────────────────────── Camino ─────────────────────────


def ribbon(name, half_width, offset, lift, material):
    vs, fs = [], []
    samples = 400
    for k in range(samples + 1):
        point, tangent = road_at(k / samples)
        normal = Vector((tangent.z, 0, -tangent.x)).normalized()
        for side in (-1, 1):
            p = point + normal * (offset + side * half_width)
            vs.append(to_blender(p.x, lift, p.z))
        if k < samples:
            a = k * 2
            fs.append((a, a + 1, a + 3, a + 2))
    return mesh_object(name, vs, fs, material)


road_material = texture_material("Tierra camino", "brown_mud_dry", 3.0, tint="#d2a06a", tint_mix=0.55)
ribbon("Camino", ROAD_HALF_WIDTH, 0, 0.03, road_material)
track_material = texture_material("Rodadas", "brown_mud_dry", 2.0, tint="#a27a50", tint_mix=0.75)
ribbon("Rodada izq", 0.2, -0.75, 0.04, track_material)
ribbon("Rodada der", 0.2, 0.75, 0.04, track_material)

# ───────────────────────── Geometry Nodes: instanciar sobre puntos ─────────────────────────


def output_of(node, kind):
    for socket in node.outputs:
        if socket.type == kind and getattr(socket, "enabled", True) and not getattr(socket, "hide", False):
            return socket
    return next(s for s in node.outputs if s.type == kind)


def set_random_range(node, kind, low, high):
    """Fija Min/Max del nodo Random Value buscando los sockets por tipo (su orden cambia entre versiones)."""
    sockets = [s for s in node.inputs if s.type == kind and s.name in ("Min", "Max")]
    sockets[0].default_value = low
    sockets[1].default_value = high


def scatter(name, points, instance_obj, scale_range, tilt=0.0, collection=None):
    """Malla de puntos + modificador GN que pone `instance_obj` en cada punto con giro y escala aleatorios."""
    holder = mesh_object(name, points, [], collection=collection)
    group = bpy.data.node_groups.new(name + " GN", "GeometryNodeTree")
    group.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    group.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    n, l = group.nodes, group.links
    gin, gout = n.new("NodeGroupInput"), n.new("NodeGroupOutput")
    to_points = n.new("GeometryNodeMeshToPoints")
    info = n.new("GeometryNodeObjectInfo")
    info.inputs["Object"].default_value = instance_obj
    on_points = n.new("GeometryNodeInstanceOnPoints")
    rot = n.new("FunctionNodeRandomValue")
    rot.data_type = "FLOAT_VECTOR"
    set_random_range(rot, "VECTOR", (-tilt, -tilt, 0), (tilt, tilt, math.tau))
    rot.inputs["Seed"].default_value = len(name)
    size = n.new("FunctionNodeRandomValue")
    size.data_type = "FLOAT"
    set_random_range(size, "VALUE", scale_range[0], scale_range[1])
    l.new(gin.outputs[0], to_points.inputs["Mesh"])
    l.new(to_points.outputs["Points"], on_points.inputs["Points"])
    l.new(info.outputs["Geometry"], on_points.inputs["Instance"])
    l.new(output_of(rot, "VECTOR"), on_points.inputs["Rotation"])
    l.new(output_of(size, "VALUE"), on_points.inputs["Scale"])
    l.new(on_points.outputs["Instances"], gout.inputs[0])
    modifier = holder.modifiers.new("Instancias", "NODES")
    modifier.node_group = group
    return holder


library = bpy.data.collections.new("Biblioteca (oculta)")
scene.collection.children.link(library)
library.hide_render = True
library.hide_viewport = True

def import_model(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    for o in new:
        for c in o.users_collection:
            c.objects.unlink(o)
        library.objects.link(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    # El importador deja jerarquía y transformaciones: se aplican y se une todo en un objeto.
    for o in meshes:
        o.matrix_world = o.matrix_world.copy()
    if len(meshes) > 1:
        with bpy.context.temp_override(active_object=meshes[0], selected_editable_objects=meshes, selected_objects=meshes):
            bpy.ops.object.join()
    obj = meshes[0]
    obj.parent = None
    return obj



# ───────────────────────── Pasto ─────────────────────────


def grass_clump(name, blades, height, spread, material, seed):
    """Mata de briznas curvas: cada brizna son tres segmentos que se doblan hacia afuera."""
    rnd = random.Random(seed)
    vs, fs = [], []
    for _ in range(blades):
        yaw = rnd.uniform(0, math.tau)
        lean = rnd.uniform(0.15, 0.55)
        h = height * rnd.uniform(0.6, 1.1)
        width = rnd.uniform(0.012, 0.022)
        base = Vector((math.cos(yaw), math.sin(yaw), 0)) * rnd.uniform(0, spread)
        out = Vector((math.cos(yaw), math.sin(yaw), 0))
        side = Vector((-out.y, out.x, 0))
        start = len(vs)
        for k in range(4):
            f = k / 3
            center = base + out * (lean * h * f * f) + Vector((0, 0, h * (f - 0.25 * lean * f * f)))
            wk = width * (1 - f * 0.95)
            vs += [center - side * wk, center + side * wk]
        for k in range(3):
            a = start + k * 2
            fs.append((a, a + 1, a + 3, a + 2))
    obj = mesh_object(name, vs, fs, material, collection=library)
    return obj


grass_material = instance_tinted_material("Pasto", "#3f7a26", "#8fa83f")
dry_grass_material = instance_tinted_material("Pasto seco", "#8d8a3e", "#c2a85a")
clumps = [
    grass_clump("Mata A", 22, 0.42, 0.10, grass_material, 1),
    grass_clump("Mata B", 30, 0.6, 0.14, grass_material, 2),
    grass_clump("Mata seca", 18, 0.5, 0.12, dry_grass_material, 3),
]

# Densidad: alta cerca del camino (lo que ve la cámara de cerca) y menor lejos; nada sobre el
# camino ni dentro de las parcelas. El suelo texturizado cubre lo que el pasto no alcanza.
rnd = random.Random(7)
grass_points = [[], [], []]
attempts = 0
while sum(len(p) for p in grass_points) < args.grass and attempts < args.grass * 6:
    attempts += 1
    x = rnd.uniform(-70, 70)
    z = rnd.uniform(-95, 62)
    distance_to_road = min(math.hypot(p.x - x, p.z - z) for p in ROAD_SAMPLES[::12])
    keep = 1.0 if distance_to_road < 22 else 0.35 if distance_to_road < 45 else 0.12
    if rnd.random() > keep or near_road(x, z, ROAD_HALF_WIDTH + 0.25) or in_parcel(x, z, 0.4):
        continue
    kind = 2 if rnd.random() < 0.18 else (0 if rnd.random() < 0.55 else 1)
    grass_points[kind].append(to_blender(x, terrain_height(x, z), z))
for clump, points in zip(clumps, grass_points):
    scatter("Pasto " + clump.name, points, clump, (0.7, 1.35), tilt=0.12)

if args.engine == "cycles":
    # Matas escaneadas (Poly Haven) en una franja a ambos lados del camino: es donde la cámara
    # mira de cerca y donde las briznas procedurales se notan.
    library.hide_viewport = False
    scanned = import_model(os.path.join(ASSETS, "models", "grass_medium_01", "grass_medium_01.gltf"))
    scanned.location = (0, 0, 0)
    library.hide_viewport = True
    near_points = []
    rnd_near = random.Random(11)
    for _ in range(args.grass // 4):
        t = rnd_near.random()
        point, tangent = road_at(t)
        normal = Vector((tangent.z, 0, -tangent.x)).normalized()
        offset = rnd_near.choice((-1, 1)) * rnd_near.uniform(ROAD_HALF_WIDTH + 0.2, 12)
        p = point + normal * offset + tangent * rnd_near.uniform(-0.6, 0.6)
        if in_parcel(p.x, p.z, 0.3):
            continue
        near_points.append(to_blender(p.x, terrain_height(p.x, p.z), p.z))
    scatter("Pasto escaneado", near_points, scanned, (0.8, 1.4), tilt=0.08)

# ───────────────────────── Árboles ─────────────────────────


# La biblioteca está oculta para render, pero la vista debe incluirla para que el join funcione.
library.hide_viewport = False
jacaranda = import_model(os.path.join(ASSETS, "models", "jacaranda_tree", "jacaranda_tree.gltf"))
jacaranda.location = (0, 0, 0)
library.hide_viewport = True

tree_rnd = random.Random(42)
tree_points = []
for _ in range(1400):
    if len(tree_points) >= 90:
        break
    x = tree_rnd.uniform(-120, 120)
    z = tree_rnd.uniform(-160, 70)
    if near_road(x, z, 7) or in_parcel(x, z, 3.5):
        continue
    # Más árboles en linderos y lomas que en medio del llano de la finca.
    if math.hypot(x * 0.8, (z + 15) * 0.55) < 34 and tree_rnd.random() < 0.9:
        continue
    tree_points.append(to_blender(x, terrain_height(x, z) - 0.1, z))
library.hide_viewport = False
searsia = import_model(os.path.join(ASSETS, "models", "searsia_lucida", "searsia_lucida.gltf"))
searsia.location = (0, 0, 0)
library.hide_viewport = True
scatter("Árboles jacaranda", tree_points[0::2], jacaranda, (0.5, 0.85), tilt=0.04)
scatter("Árboles searsia", tree_points[1::2], searsia, (0.9, 1.5), tilt=0.04)

# ───────────────────────── Parcelas y cultivos ─────────────────────────

CROP_STYLE = {
    "Maize": dict(shape="stalk", height=2.1, color="#5d8a2e", tip="#c9b25a", row=1.0, gap=0.7),
    "Sugarcane": dict(shape="stalk", height=2.8, color="#7fb243", tip="#9fbf5a", row=1.2, gap=0.55),
    "Wheat": dict(shape="tuft", height=0.95, color="#c6a548", tip="#e2c66f", row=0.45, gap=0.35, spikes=True),
    "Rice": dict(shape="tuft", height=0.7, color="#7fb04a", tip="#b7c86a", row=0.4, gap=0.35),
    "Potato": dict(shape="bush", height=0.6, color="#3d6a2a", tip="#5c8a3a", row=0.8, gap=0.55),
    "Tomato": dict(shape="bush", height=0.95, color="#45722c", tip="#6a9a3e", row=1.1, gap=0.75, fruit=True),
}


def crop_mesh(crop, style):
    """Planta de altura 1 m construida con hojas (tira de 3 segmentos curvada), escalada después."""
    rnd = random.Random(hash(crop) & 0xFFFF)
    vs, fs = [], []

    def leaf(base, direction, length, width, rise):
        side = Vector((-direction.y, direction.x, 0)).normalized()
        start = len(vs)
        for k in range(4):
            f = k / 3
            center = base + direction * (length * f) + Vector((0, 0, rise * f - 0.35 * length * f * f))
            wk = width * math.sin(math.pi * min(0.98, f * 0.9 + 0.08))
            vs.extend([center - side * wk, center + side * wk])
        for k in range(3):
            a = start + k * 2
            fs.append((a, a + 1, a + 3, a + 2))

    if style["shape"] == "stalk":
        for k in range(4):
            ang = k * math.pi / 2
            d = Vector((math.cos(ang), math.sin(ang), 0)) * 0.03
            a = len(vs)
            vs.extend([d, -d, Vector((0, 0, 1.0)) + d * 0.3, Vector((0, 0, 1.0)) - d * 0.3])
            fs.append((a, a + 1, a + 3, a + 2))
        for k in range(9):
            yaw = k * 2.4 + rnd.uniform(-0.2, 0.2)
            leaf(Vector((0, 0, 0.18 + k * 0.08)), Vector((math.cos(yaw), math.sin(yaw), 0)), 0.45 - k * 0.025, 0.05, 0.25)
    elif style["shape"] == "tuft":
        for k in range(14):
            yaw = rnd.uniform(0, math.tau)
            leaf(Vector((0, 0, 0)), Vector((math.cos(yaw), math.sin(yaw), 0)) * 0.25, 0.6, 0.012, rnd.uniform(0.75, 1.0))
        if style.get("spikes"):
            for k in range(6):
                yaw = rnd.uniform(0, math.tau)
                c = Vector((math.cos(yaw) * 0.12, math.sin(yaw) * 0.12, rnd.uniform(0.85, 1.0)))
                a = len(vs)
                vs.extend([c + Vector((0.02, 0, 0)), c + Vector((-0.02, 0, 0)), c + Vector((0, 0, 0.16)), c + Vector((0, 0, -0.1))])
                fs.extend([(a, a + 2, a + 1), (a, a + 1, a + 3)])
    else:
        for k in range(26):
            yaw = rnd.uniform(0, math.tau)
            leaf(Vector((0, 0, rnd.uniform(0.05, 0.5))), Vector((math.cos(yaw), math.sin(yaw), rnd.uniform(-0.1, 0.3))).normalized(), 0.35, 0.09, 0.15)
    material = instance_tinted_material("Cultivo " + crop, style["color"], style["tip"])
    return mesh_object("Planta " + crop, vs, fs, material, collection=library)


soil_material = texture_material("Tierra arada", "brown_mud_02", 2.5, tint="#b07a4c", tint_mix=0.45)
fruit_material = flat_material("Tomate", "#c8341f", 0.35)
pole_material = flat_material("Madera", "#5b4430", 0.8)

for parcel in PARCELS:
    style = CROP_STYLE.get(parcel["crop"], CROP_STYLE["Maize"])
    along, across, center = parcel["along"], parcel["across"], parcel["center"]
    hw, hd = parcel["width"] / 2, parcel["depth"] / 2
    corners3 = [center + across * sx * hw + along * sz * hd for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    parcel["corners"] = corners3
    soil = mesh_object(f"Parcela {parcel['id']}", [to_blender(c.x, 0.05, c.z) for c in corners3], [(0, 1, 2, 3)], soil_material)
    # Surcos reales: caballones de tierra a lo largo de cada hilera.
    plant = crop_mesh(parcel["crop"], style)
    points = []
    rnd_c = random.Random(100 + parcel["index"])
    x = -hw + 0.6
    while x <= hw - 0.6:
        z = -hd + 0.5
        while z <= hd - 0.5:
            p = center + across * (x + rnd_c.uniform(-0.05, 0.05)) + along * (z + rnd_c.uniform(-0.1, 0.1))
            points.append(to_blender(p.x, 0.05, p.z))
            z += style["gap"]
        ridge_a = center + across * x + along * -hd
        ridge_b = center + across * x + along * hd
        side = across * 0.22
        mesh_object(
            f"Surco {parcel['id']}",
            [
                to_blender((ridge_a - side).x, 0.05, (ridge_a - side).z),
                to_blender((ridge_a + side).x, 0.05, (ridge_a + side).z),
                to_blender((ridge_b + side).x, 0.05, (ridge_b + side).z),
                to_blender((ridge_b - side).x, 0.05, (ridge_b - side).z),
                to_blender(ridge_a.x, 0.16, ridge_a.z),
                to_blender(ridge_b.x, 0.16, ridge_b.z),
            ],
            [(0, 4, 5, 3), (4, 1, 2, 5)],
            soil_material,
        )
        x += style["row"]
    h = style["height"]
    scatter(f"Cultivo {parcel['id']}", points, plant, (h * 0.85, h * 1.1), tilt=0.06)
    if style.get("fruit"):
        fruit = bpy.data.objects.new("Fruto", bpy.data.meshes.new("Fruto"))
        library.objects.link(fruit)
        import bmesh

        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.045)
        for v in bm.verts:
            v.co += Vector((0.18, 0, 0.45))
        bm.to_mesh(fruit.data)
        bm.free()
        fruit.data.materials.append(fruit_material)
        scatter(f"Tomates {parcel['id']}", points, fruit, (h * 0.8, h * 1.1))
    # Banderín del color de la ecorregión en la esquina lejana: identifica la parcela en el render.
    corner = center + across * (hw - 0.3) + along * (hd + 0.2)
    base = to_blender(corner.x, 0, corner.z)
    pole = mesh_object(f"Poste {parcel['id']}", [base + Vector((dx, dy, dz)) for dz in (0, 2.6) for dx, dy in ((-0.04, -0.04), (0.04, -0.04), (0.04, 0.04), (-0.04, 0.04))], [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], pole_material)
    flag_dir = to_blender(across.x, 0, across.z).normalized() * 0.9
    mesh_object(f"Bandera {parcel['id']}", [base + Vector((0, 0, 2.55)), base + flag_dir + Vector((0, 0, 2.45)), base + flag_dir + Vector((0, 0, 2.0)), base + Vector((0, 0, 1.95))], [(0, 1, 2, 3)], flat_material(f"Bandera {parcel['id']}", parcel["color"], 0.7))

# ───────────────────────── Granero ─────────────────────────

end_point, end_tangent = road_at(1.0)
barn_center = end_point + end_tangent * 7.5
barn_across = Vector((end_tangent.z, 0, -end_tangent.x))


def barn_vertex(across, up, along):
    """Coordenadas en el marco del camino al final del recorrido → Blender."""
    p = barn_center + barn_across * across + end_tangent * along
    return to_blender(p.x, up, p.z)


HW, HL, WALL, RIDGE = 4.2, 5.0, 4.6, 7.4
walls = [barn_vertex(x, y, z) for y in (0, WALL) for x, z in ((-HW, -HL), (HW, -HL), (HW, HL), (-HW, HL))]
mesh_object("Granero muros", walls, [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], texture_material("Madera granero", "brown_mud_dry", 4.0, tint="#a03a24", tint_mix=0.85))
gables = [barn_vertex(-HW, WALL, -HL), barn_vertex(HW, WALL, -HL), barn_vertex(0, RIDGE, -HL), barn_vertex(-HW, WALL, HL), barn_vertex(HW, WALL, HL), barn_vertex(0, RIDGE, HL)]
mesh_object("Granero hastiales", gables, [(0, 1, 2), (3, 5, 4)], bpy.data.materials["Madera granero"])
eave = 0.5
roof = [barn_vertex(-HW - eave, WALL - 0.3, -HL - eave), barn_vertex(0, RIDGE + 0.1, -HL - eave), barn_vertex(HW + eave, WALL - 0.3, -HL - eave),
        barn_vertex(-HW - eave, WALL - 0.3, HL + eave), barn_vertex(0, RIDGE + 0.1, HL + eave), barn_vertex(HW + eave, WALL - 0.3, HL + eave)]
mesh_object("Granero techo", roof, [(0, 1, 4, 3), (1, 2, 5, 4)], flat_material("Techo", "#3f342c", 0.75))

# ───────────────────────── Tractor ─────────────────────────

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, "models", "tractor_detailed.glb"))
tractor_parts = [o for o in bpy.data.objects if o not in before]
tractor = bpy.data.objects.new("Tractor", None)
scene.collection.objects.link(tractor)
roots = [o for o in tractor_parts if o.parent is None]
for o in roots:
    o.parent = tractor
bpy.context.view_layer.update()
mins = Vector((1e9, 1e9, 1e9))
maxs = Vector((-1e9, -1e9, -1e9))
for o in tractor_parts:
    if o.type == "MESH":
        for corner in o.bound_box:
            world = o.matrix_world @ Vector(corner)
            mins = Vector(map(min, mins, world))
            maxs = Vector(map(max, maxs, world))
size = maxs - mins
TRACTOR_LENGTH = 3.6
scale = TRACTOR_LENGTH / max(size.x, size.y)
# Contenedor intermedio: centra el modelo, lo apoya en el suelo y lo orienta hacia +Y local.
pivot = bpy.data.objects.new("Tractor pivote", None)
scene.collection.objects.link(pivot)
for o in roots:
    o.parent = pivot
center = (mins + maxs) / 2
pivot.scale = (scale, scale, scale)
pivot.location = (-center.x * scale, -center.y * scale, -mins.z * scale)
pivot.parent = tractor
TRACTOR_LONG_AXIS_X = size.x > size.y
for o in tractor_parts:
    if o.type == "MESH":
        o.visible_shadow = True

# ───────────────────────── Recorrido y cámara ─────────────────────────

# Cámara alta: mira por encima de cultivos de hasta 2,8 m sin meterlos en primer plano.
FRAMINGS = {"hero": (10, 6.5, 16), "follow": (6.5, 6.8, 13)}
AERIAL = Vector((112, 96, -14))  # three.js
FARM_CENTER = Vector((0, 0, -15))


def smoothstep(a, b, x):
    f = max(0.0, min(1.0, (x - a) / (b - a)))
    return f * f * (3 - 2 * f)


def tractor_t(frame, total):
    """Reparto del recorrido: arranque lento en la entrada, finca a ritmo constante, parada final."""
    u = frame / (total - 1)
    if u < 0.08:
        return 0.02 + 0.08 * smoothstep(0, 0.08, u)
    if u < 0.84:
        return 0.1 + 0.8 * (u - 0.08) / 0.76
    return 0.9 + 0.07 * smoothstep(0.84, 1.0, u)


def camera_pose(frame, total):
    """Posición y punto de mira (three.js). Mismos encuadres que el Rig de la versión en vivo."""
    u = frame / (total - 1)
    t = tractor_t(frame, total)
    point, tangent = road_at(t)
    forward = Vector((tangent.x, 0, tangent.z)).normalized()
    right = Vector((forward.z, 0, -forward.x))
    side, up, back = FRAMINGS["hero"] if u < 0.08 else FRAMINGS["follow"]
    cam = point + right * side - forward * back + Vector((0, up, 0))
    look = point + forward * 4 + Vector((0, 1.1, 0))
    # Cerca de cada parcela la cámara se aparta para mostrarla entera con el tractor al lado.
    for parcel, station in zip(PARCELS, PARCEL_STATIONS):
        weight = 1 - smoothstep(0.0, 0.07, abs(t - station))
        if weight <= 0:
            continue
        focus_look = parcel["center"] - parcel["across"] * (parcel["width"] * 0.3) + Vector((0, 0.6, 0))
        focus_cam = focus_look - parcel["along"] * (parcel["depth"] / 2 + 15) - parcel["across"] * 9 + Vector((0, 11.4, 0))
        cam = cam.lerp(focus_cam, weight)
        look = look.lerp(focus_look, weight)
    # Final: grúa hasta la vista aérea de toda la finca.
    crane = smoothstep(0.86, 1.0, u)
    cam = cam.lerp(AERIAL, crane)
    look = look.lerp(FARM_CENTER, crane)
    return t, cam, look


camera_data = bpy.data.cameras.new("Cámara")
camera_data.lens = 35
camera_data.clip_end = 1200
camera = bpy.data.objects.new("Cámara", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera
look_target = bpy.data.objects.new("Mira", None)
scene.collection.objects.link(look_target)
track = camera.constraints.new("TRACK_TO")
track.target = look_target
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"

frames = range(args.frames) if args.only is None else [args.only]
if args.only is None and os.environ.get("TERRA_FRAMES"):
    # Lista explícita de fotogramas (p. ej. "0,1,2,3") para pruebas de tiempo o re-renders parciales.
    frames = [int(f) for f in os.environ["TERRA_FRAMES"].split(",")]
for frame in range(args.frames):
    t, cam, look = camera_pose(frame, args.frames)
    point, tangent = road_at(t)
    tractor.location = to_blender(point.x, 0.0, point.z)
    heading = math.atan2(-tangent.z, tangent.x)  # ángulo en el plano XY de Blender
    tractor.rotation_euler = (0, 0, heading - (0 if TRACTOR_LONG_AXIS_X else math.pi / 2))
    tractor.keyframe_insert("location", frame=frame)
    tractor.keyframe_insert("rotation_euler", frame=frame)
    camera.location = to_blender(cam.x, cam.y, cam.z)
    look_target.location = to_blender(look.x, look.y, look.z)
    camera.keyframe_insert("location", frame=frame)
    look_target.keyframe_insert("location", frame=frame)

for obj in (tractor, camera, look_target):
    if obj.animation_data and obj.animation_data.action:
        action = obj.animation_data.action
        curves = getattr(action, "fcurves", None)
        if curves is None:
            continue
        for curve in curves:
            for key in curve.keyframe_points:
                key.interpolation = "LINEAR"

# Desplaza el encuadre: el tractor queda a la derecha y la columna izquierda libre para el texto.
camera_data.shift_x = -0.12

# ───────────────────────── Pistas para la web ─────────────────────────


def screen(v3):
    co = world_to_camera_view(scene, camera, to_blender(v3.x, v3.y, v3.z))
    return [round(co.x, 4), round(1 - co.y, 4), round(co.z, 2)]


# craneStart: primer fotograma de la grúa final (u = 0.86 en camera_pose); la web mapea ahí la vista aérea.
track_data = {"frames": args.frames, "width": args.width, "height": args.height, "craneStart": round(0.86 * (args.frames - 1)), "stations": PARCEL_STATIONS, "tractor": [], "t": [], "parcels": []}
for frame in range(args.frames):
    scene.frame_set(frame)
    t, _, _ = camera_pose(frame, args.frames)
    point, _ = road_at(t)
    track_data["t"].append(round(t, 4))
    track_data["tractor"].append(screen(point + Vector((0, 1.2, 0))))
    track_data["parcels"].append([[screen(c) for c in parcel["corners"]] for parcel in PARCELS])
with open(os.path.join(args.out, "track.json"), "w") as handle:
    json.dump(track_data, handle, separators=(",", ":"))

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(args.out, "farm.blend"))

# ───────────────────────── Render ─────────────────────────

scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
for frame in frames:
    target = os.path.join(args.out, "frames", f"frame_{frame:04d}.png")
    # Reanudable: si un render largo se corta, al relanzarlo no repite lo ya hecho.
    if args.only is None and os.path.exists(target) and os.path.getsize(target) > 0:
        continue
    scene.frame_set(frame)
    scene.render.filepath = target
    bpy.ops.render.render(write_still=True)
    print(f"[terra] fotograma {frame} listo", flush=True)
