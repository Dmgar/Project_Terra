# Finca pre-renderizada

El fondo de toda la web es un recorrido renderizado en Blender, no 3D en tiempo real: el realismo
(luz rebotada, pasto escaneado, árboles) lo paga el render una vez. Los fotogramas se completan con
intermedios por flujo óptico y se entregan como un vídeo corto que `src/scene/FrameField.jsx`
recorre con el scroll o la ruta y pinta en un `<canvas>` 2D: el visitante solo decodifica vídeo.

## Qué genera

| Archivo | Qué es |
| --- | --- |
| `public/field/field.mp4` | El recorrido: fotogramas del render + intermedios (12 → 48 fps), H.264 con keyframe cada 8 para recorrerlo con el scroll |
| `public/field/track.json` | Por fotograma del render: posición en pantalla del tractor y de las esquinas de cada parcela, `craneStart` (inicio de la vista aérea) y `sourceFps`. La web lo usa para el hover/clic sobre parcelas y para recortar en móvil |
| `public/scene-poster.jpg` | Primer fotograma: póster mientras carga la secuencia |

La portada usa además `public/field/intro/`: los fotogramas reales del render (sin intermedios)
para la entrada fija tipo página de producto, en dos calidades que `src/scene/IntroSequence.jsx`
carga de forma progresiva:

| Carpeta | Qué es |
| --- | --- |
| `public/field/intro/lq/f_XXXX.avif` | Versión ligera (480 px, ~18 KB): llega toda en un par de segundos para que el scroll responda desde el principio |
| `public/field/intro/f_XXXX.avif` | Versión nítida (1152 px, calidad 55 + enfoque leve, ~165 KB): sustituye a la ligera empezando por donde se mira |
| `public/field/stills/*.webp` | Imágenes fijas del mismo render para las cabeceras y el explorador (una por módulo y una por parcela) |

Se generan desde los PNG etalonados con ImageMagick (`magick <png> -resize 480x -quality 38 …avif` y
`magick <png> -unsharp 0x0.8+0.7+0.02 -quality 55 …avif`).

## Cómo regenerarlo

Requisitos: Blender 5.x (Cycles con GPU CUDA/OptiX), ImageMagick 7, ffmpeg (libx264) y los assets descargados:

- Poly Haven (CC0): HDRI `bloem_field_sunrise` (2k); texturas `aerial_grass_rock`, `brown_mud_dry`, `brown_mud_02` (1k: `diff.jpg`, `nor.jpg`, `rough.jpg`); modelos glTF 1k `jacaranda_tree`, `searsia_lucida`, `grass_medium_01`.
- Sketchfab: «Tractor» de le0tard (CC BY 4.0), como `models/tractor_detailed.glb`.
- `regions.json`: copia de `/api/regions` (`id`, `share`, `topCrop`), que fija el ancho y el cultivo de cada parcela.

```bash
blender -b -P scene-src/build_farm.py -- \
  --assets <carpeta de assets> --regions regions.json --out <carpeta de render> \
  --frames 96 --width 1152 --height 648 --samples 16 --grass 120000
scene-src/encode_frames.sh <carpeta de render>
```

- El render es reanudable: si se corta, relanzarlo salta los fotogramas ya escritos. Si se deja a
  medias, `encode_frames.sh` usa la secuencia continua que haya (la versión actual usa 84 de 96: el
  recorrido completo sin la toma aérea final; el cierre de la portada se queda en el último fotograma).
- En una GTX 1650 cuesta ≈65 s por fotograma. Con poca RAM, cierra otras aplicaciones: Blender
  necesita ~1,5 GB.
- `--only N` renderiza un solo fotograma para probar; `TERRA_FRAMES=0,40,95` una lista.

## Cuándo hay que volver a renderizar

> Estado actual: el render se hizo con las ecorregiones anteriores a la unificación del clustering
> en 7D (commit `ef5038e`). Por eso la web ya no afirma qué cultivo hay sembrado en cada parcela ni
> que su ancho sea su peso: muestra esos datos en vivo desde la API. Volver a renderizar con
> `regions.json` actualizado devolvería la correspondencia exacta.


- Si cambian los porcentajes de las ecorregiones en los datos (el ancho de cada parcela los refleja).
- Si cambian `PARCEL_STATIONS` o `REGION_COLORS` en `src/scene/fieldLayout.js`: deben coincidir con
  `build_farm.py`, que tiene su propia copia.
