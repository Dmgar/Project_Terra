#!/usr/bin/env bash
# Convierte el render de build_farm.py en lo que sirve la web:
#   public/field/field.mp4     el recorrido como vídeo: fotogramas del render + intermedios por
#                              flujo óptico (12 → 48 fps), H.264 con keyframe cada 8 para poder
#                              recorrerlo con el scroll sin tirones
#   public/field/track.json    posiciones en pantalla por fotograma del render (+ sourceFps)
#   public/scene-poster.jpg    primer fotograma, póster mientras carga el vídeo
# Uso: scene-src/encode_frames.sh <carpeta --out del render>
set -euo pipefail
RENDER="${1:?carpeta del render}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HERE/public/field"
SOURCE_FPS=12
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUT"

# Etalonaje: el HDRI de amanecer deja el render algo lavado; contraste en S, más saturación y un
# punto cálido lo acercan a la hora dorada sin tener que volver a renderizar.
GRADE=(-sigmoidal-contrast 3.5x45% -modulate 100,122,100 -channel R -evaluate multiply 1.035 -channel B -evaluate multiply 0.95 +channel)

# Solo la secuencia continua desde el fotograma 0: si el render se cortó, se usa lo que hay.
count=0
while [ -f "$RENDER/frames/frame_$(printf %04d $count).png" ]; do
  magick "$RENDER/frames/frame_$(printf %04d $count).png" "${GRADE[@]}" "$WORK/frame_$(printf %04d $count).png"
  count=$((count + 1))
done
[ "$count" -gt 1 ] || { echo "No hay fotogramas en $RENDER/frames" >&2; exit 1; }

ffmpeg -hide_banner -loglevel error -y -framerate "$SOURCE_FPS" -i "$WORK/frame_%04d.png" \
  -vf "minterpolate=fps=48:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p" \
  -c:v libx264 -preset slow -crf 25 -g 8 -keyint_min 8 -sc_threshold 0 -movflags +faststart -an \
  "$OUT/field.mp4"

python3 - "$RENDER/track.json" "$OUT/track.json" "$count" "$SOURCE_FPS" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
count, fps = int(sys.argv[3]), int(sys.argv[4])
for key in ("t", "tractor", "parcels"):
    data[key] = data[key][:count]
data["frames"] = count
data["craneStart"] = min(data.get("craneStart", round(0.86 * (count - 1))), count)
data["sourceFps"] = fps
json.dump(data, open(sys.argv[2], "w"), separators=(",", ":"))
PY

magick "$WORK/frame_0000.png" -resize "1280x>" -quality 72 "$HERE/public/scene-poster.jpg"
echo "$count fotogramas del render"
du -sh "$OUT/field.mp4" "$OUT/track.json" "$HERE/public/scene-poster.jpg"
