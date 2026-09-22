# Documentación de Project Terra

Bienvenido al directorio de documentación. Aquí encontrarás un registro detallado de los avances del proyecto y los planes a futuro.

## Estructura de la Documentación

- [CHANGELOG.md](./CHANGELOG.md): Registro de las características implementadas y fases completadas.
- [ROADMAP.md](./ROADMAP.md): Lista de tareas pendientes, próximos pasos y características planificadas para el futuro.

## Acerca de la Arquitectura Actual

Project Terra se compone actualmente de:
- **Frontend (`frontend/`)**: Una aplicación de página única (SPA) construida con React y Vite.
- **Backend (`api/`)**: Una API REST construida con FastAPI (Python) que sirve la lógica de negocio, predicciones del modelo y cálculos del optimizador económico.
- **Modelos y Datos (`notebooks/`, `src/`)**: El flujo de Machine Learning original (EDA, K-Means) que alimenta los artefactos serializados almacenados en `data/models/`.
- **Prototipo Legacy (`app/`)**: Interfaz original en Streamlit, conservada únicamente como referencia histórica.
