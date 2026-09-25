---
name: PDF de huerta y caracteres
description: Decisión sobre diseño, tamaño y codificación de la descarga de huerta.
---

El PDF de la huerta debe tener identidad visual coherente con TERRA y texto español legible, sin convertir los acentos a ASCII. Se eligió una generación ligera en el cliente con fuentes PDF estándar y codificación WinAnsi, en vez de cargar una biblioteca grande solo para esta descarga.

**Why:** El primer PDF era texto plano, no reflejaba la marca y corrompía el formato monetario por escribir caracteres Unicode con offsets y glifos incompatibles. WinAnsi cubre los acentos españoles, pero no todos los símbolos Unicode.

**How to apply:** Si se cambia el contenido de la descarga, comprobar el PDF renderizado y su texto extraído con casos que incluyan tildes, ñ, m² y montos COP; para símbolos fuera de WinAnsi, usar un equivalente compatible o considerar una fuente embebida con soporte Unicode completo.