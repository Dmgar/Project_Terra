# Roadmap - Project Terra

Este archivo detalla las características planificadas, ideas de mejora y los próximos pasos del proyecto para escalar el producto y su análisis.

## Próximos Pasos (To-Do)

### Backend & Modelos
- [ ] **Despliegue a Producción:** Configurar CI/CD y desplegar la API de FastAPI en un entorno cloud (ej. Render, Railway, AWS).
- [ ] **Mejora del Modelo de Clustering:** Explorar la inclusión de nuevas variables (como `Soil_Type`, `Variety`, altitud o datos satelitales) para mejorar el coeficiente de Silueta y la coherencia agronómica.
- [ ] **Integración en Tiempo Real:** Conectar con APIs climáticas (ej. OpenWeather) o sistemas de mercado para que los datos de la planeación económica se actualicen dinámicamente.
- [ ] **Pruebas Automatizadas:** Aumentar la cobertura de testing (`pytest`) para los endpoints en la carpeta `tests/`.

### Frontend
- [ ] **Despliegue del Cliente:** Publicar el frontend web en Vercel, Netlify o GitHub Pages.
- [ ] **Autenticación y Sesiones:** Permitir a los usuarios (agricultores/inversores) crear una cuenta, guardar sus parcelas, y almacenar el historial de su planeación económica.
- [ ] **Soporte Multilingüe (i18n):** Traducir y habilitar el cambio de idioma (Español / Inglés) para abarcar un público más amplio.
- [ ] **Exportación de Reportes:** Agregar funcionalidad para descargar los resultados económicos y de clustering en formato PDF o Excel.
