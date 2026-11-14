# Revisión visual de Terra

Referencia: `/home/jasen/Descargas/as.avif` (Agrizen).

Alcance: portada y estilos de producto. El CSS se limita a `.section-product` y a los componentes exclusivos de la portada. No se modificaron archivos de análisis, cálculos, endpoints ni backend.

Dirección: verde agrícola profundo, acciones amarillo lima, fotografía existente recortada en arco y titulares sans de mayor peso. La fotografía de la parcela y las ilustraciones propias de cultivos conectan la identidad con la planificación agrícola de Terra.

## Verificación ejecutada

- `npm run build`: exit 0.
- `npm test`: 2 pruebas pasan.
- `git diff --check`: exit 0.
- Contraste texto de acción: 9.04:1; texto secundario sobre fondo claro: 5.84:1.
- Auditoría de portada: 320×568, 375×812, 568×320, 768×1024, 1280×800 y 1920×1080, claro y oscuro.
- Auditoría de recomendación, selector de planificación y huerta, claro y oscuro.
- Dos pasadas de revisión: corrección de advertencia React de imagen, tamaño de enlaces, etiquetas pequeñas y contraste de botones oscuros; consolidación de tipografía.
- Capturas observadas: portada de escritorio clara, portada móvil oscura, recomendación de escritorio oscura, selector de planificación claro.

Los informes JSON adjuntos son la salida sin filtrar de ui-audit. El comando termina con exit 1 por HTTP 500 en `/api/health` y, en planificación, `/api/economics/catalog`: el backend local no está disponible. No se modificó ni se simuló para ocultar estos errores. No se verificaron resultados que necesitan datos del backend.

El navegador interactivo del entorno no está disponible. No se certifican recorridos completos de teclado, zoom 200/400 %, expansión de textos ni RTL. El auditor sí ejecuta su comprobación de foco mediante Tab.

Los estilos preservan los estados y las funciones existentes. Los nuevos controles usan elementos nativos y los estilos respetan la preferencia de movimiento reducido ya presente en Terra.

## Verificación con servidores locales activos

Fecha: 2026-11-13. Frontend: http://localhost:5173. Backend existente: http://127.0.0.1:5000. Se utilizó el entorno Python ya instalado en `Project_Terra/.venv`; no se modificó código del backend.

El MCP de Chrome no está conectado y el host de navegador interactivo no está disponible. Se ejecutó Chrome headless mediante ui-audit, no un recorrido interactivo con MCP.

Resultados:

- Portada: 12 combinaciones de tamaño/tema; exit 0, sin bloqueantes.
- Recomendación: 4 combinaciones; exit 0, sin hallazgos.
- Huerta: 4 combinaciones; exit 0, sin bloqueantes.
- Comercial: 4 combinaciones; exit 0, sin bloqueantes tras ampliar fuentes y enlaces.
- Catálogo y health a través del proxy Vite: HTTP 200.
- POST `/api/optimize`, solicitud de referencia de los tests: HTTP 200; beneficio total 20.500.000 COP y 2 filas de asignación.
- POST `/api/recommend` con objeto vacío: HTTP 422.
- POST `/api/recommend` con valores válidos: el proceso Uvicorn terminó con código 139; el proxy devolvió HTTP 500. Se reinició el servidor y se verificó health HTTP 200. No se corrigió el backend por restricción del alcance.
- Build y 2 pruebas frontend: pasan.

Veredicto funcional: PARCIAL. No se certifica el cálculo de recomendación ni los recorridos completos de interacción. Los informes `live-*.json` adjuntos contienen las auditorías sin filtrar. Los informes anteriores se conservan como evidencia de la ejecución sin backend.
