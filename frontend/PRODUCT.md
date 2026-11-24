# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Todo el mundo que llega a Terra (confirmado por el usuario: "a todo mundo"):

- Agricultores y huerteros en Colombia con una parcela o huerta, que quieren saber qué sembrar y preparar un plan.
- Jurado y profesores del curso Analítica y Minería de Datos (UTB), que evalúan el modelo (UMAP, K-Means, ecorregiones).
- Visitantes curiosos que llegan por el enlace público del despliegue en Vercel.

## Product Purpose

Terra agrupa muestras agrícolas (N, P, K, temperatura, humedad, pH y precipitación) en cinco "ecorregiones funcionales" y, a partir de eso, recomienda cultivos para una parcela concreta y arma un plan de siembra (huerta casera o plan comercial con optimización económica). El éxito es que el visitante describa su parcela y salga con una recomendación y un plan que entiende.

## Positioning

Las ecorregiones no salen de fronteras políticas ni de reglas empíricas: salen del propio dato de suelo y clima (UMAP + K-Means, K=5) y se validan contra el cultivo real reportado. Terra compara la parcela del usuario con 20.000 registros de campo de referencia.

## Operating Context

- SPA React + Vite desplegada en Vercel (Vercel Services: `frontend/` + backend FastAPI en `api/`).
- Rutas: portada, `producto/recomendar`, `producto/plan` (huerta / comercial), `analisis/resumen|modelo|regiones`.
- El planificador de huerta funciona solo en el cliente y genera un PDF propio (WinAnsi, sin librería).
- El backend y los modelos no se tocan en trabajo de frontend (decisión del usuario, 2026-11-23).

## Capabilities and Constraints

- API existente: `/api/health|overview|regions|umap|recommend|optimize`. Contratos fijos.
- `/api/recommend` marca entradas fuera de distribución (`isOutlier`).
- Economía: el catálogo de precios es una referencia offline en COP, no cotizaciones en vivo; la afinidad ambiental solo reordena (penalización hasta 20 %), nunca alimenta precios ni rendimientos.
- Planificador: sol/agua son umbrales mínimos duros; si no hay combinación compatible, se explica y no se genera plan ni PDF; el PDF debe coincidir con la propuesta visible.
- Sin base de datos en el producto actual.

## Brand Commitments

- Nombre: TERRA / Project Terra. Logo en `src/assets/logo-terra.png` y `logo-terra-claro.png`.
- Voz: español cercano y orientado a la acción ("Ver mi recomendación", no "Ejecutar recomendación"). Sin etiquetas numeradas decorativas; numerar solo procesos o regiones reales.
- Pie legal: las estimaciones se basan en datos de referencia y no garantizan cosecha ni ganancia.
- Referencia de ambición (no de estética) dada por el usuario: https://sextante-web-ten.vercel.app (narrativa guiada por scroll y WebGL).
- Requisito del usuario: experiencia 3D en todas las pantallas, con un tractor 3D que recorre los módulos; el modelo sale de bibliotecas de los MCP (Sketchfab / Poly Pizza / Blender).

## Evidence on Hand

- Dataset: Crops NPK Data Set (Kaggle), 20.000 registros, 7 variables + cultivo.
- Fotos reales: `src/assets/tractor-atardecer.webp`, `trigo-amanecer.jpeg`, `surcos-lechuga.jpeg`.
- Equipo: Dariem Antonio García Cardona, Jasen Mihovil Yukopila Escobar, Carlos Miguel Toro Torres. Escuela de Transformación Digital, UTB.
- No hay testimonios, clientes, cifras de uso ni precios reales: no inventarlos.

## Product Principles

1. Lo útil primero: recomendar y planear están a un clic desde cualquier punto.
2. Mostrar el mecanismo, no prometerlo: las ecorregiones y el dato se ven trabajando.
3. Honestidad de datos: referencias, no garantías; fuera de distribución se avisa.
4. El espectáculo no estorba la tarea: en las pantallas de trabajo el 3D acompaña y nunca tapa formularios ni resultados.

## Accessibility & Inclusion

- Respeto a `prefers-reduced-motion`: el recorrido 3D se degrada a una escena estática.
- Debe funcionar en móviles de gama media del campo colombiano: el 3D tiene presupuesto de rendimiento y alternativa sin WebGL.
