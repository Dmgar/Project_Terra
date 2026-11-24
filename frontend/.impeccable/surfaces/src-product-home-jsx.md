---
version: 1
slug: "src-product-home-jsx"
primary_target: "src/product/Home.jsx"
related_targets: ["src/Layout.jsx","src/ui.jsx"]
---

# Superficie: sitio completo de Terra (portada + Recomendar + Planear + Análisis)

Modo: Persuade en la portada; Operate en Recomendar/Planear/Análisis (el 3D acompaña, nunca tapa formularios ni resultados).
Audiencia: todo el mundo (agricultores, jurado UTB, curiosos). Acción principal: describir la parcela y ver la recomendación.
Restricciones: backend y modelos intactos; solo frontend. Contratos /api/* fijos.

## Direction contract

THESIS: El sitio es la finca de Terra vista en 3D: cinco parcelas = las cinco ecorregiones reales (tamaño por share, sembradas con su cultivo dominante desde /api/regions) unidas por un camino de tierra; el tractor recorre ese camino y cada módulo del producto es una parada. Rechaza el héroe de foto + titular + tarjetas.
OWN-WORLD: finca realista a primera hora (render de Blender: HDRI de amanecer, pasto denso por briznas, jacarandas, tierra arada, camino de tierra con rodadas, tractor rojo detallado, granero), etalonaje cálido; UI en verde bosque de Terra (#1f5a2e) y papel cálido; Nunito pesado y apretado en titulares; paneles opacos de papel para trabajar; nada de glass ni degradados decorativos.
STORY: el visitante ve el campo vivo, entiende que sus datos de suelo lo ubican en una de esas parcelas, describe su parcela, el tractor conduce hasta su ecorregión y lee el resultado; luego planea o revisa el análisis.
FIRST VIEWPORT: escena pre-renderizada a pantalla completa; tractor entrando por el camino en el tercio derecho; a la izquierda titular TERRA de gran escala con la frase y dos acciones (Ver qué sembrar / Planear mi siembra); leyenda de las 5 parcelas anclada abajo.
FORM: secuencia de fotogramas pre-renderizada (scene-src/build_farm.py → public/field) pintada en un canvas 2D persistente, con zonas activas de parcela sacadas del track.json del render; recorrido guiado por scroll (portada) y por ruta (páginas internas). Realismo y fluidez sin 3D en el equipo del visitante: "la idea es que todo el ambiente se vea realista e interactivo y ademas este prerenderizado para ser optimo y no lagear las computadoras"; "trata de que el apseto y los arboles sean realistas". seed: none (pinned) — "es para project terra el del analisis de cultivos te mencione un tracktor, mira como esta el front"; "algo como que el tractor 3d se vaya moviendo por los modulos".
SIGNATURE: el tractor conduce entre módulos al navegar y hasta la ecorregión resultante al recomendar; motion grammar: un solo tiempo de recorrido (manivela = scroll), easing expo-out, revelados por líneas.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
