# AGENTS

## 1) Arquitectura y stack (resumen)
- Web estática tipo SPA de una sola página.
- Entrada: `index.html`.
- Frontend: JavaScript ES Modules en `js/` + CSS en `css/`.
- Datos en JSON local (`data/`) cargados con `fetch`.
- Sin backend ni framework de build.
- Scripts auxiliares en Python/Bash (`scripts/`) para pipeline de datos.

## 2) Mapa rápido (leer primero)
- `js/main.js`: arranque, estado global, router hash (`#/`, `#/comparar`, `#/afinidad`, `#/s/...`).
- `js/api.js`: carga catálogo de partidos y JSON de `data/partidos/`.
- `js/ui.js`: render principal de vistas y componentes.
- `js/afinidad.js`: cuestionario y cálculo de afinidad.
- `js/stories/`: lógica de historias (`controller.js`, `view.js`, `saved.js`).
- `data/partidos/index.json`: índice de partidos activos.
- `data/partidos/*.json`: propuestas + metadatos por partido.
- `data/master-questions.json` y `data/party-scores.json`: motor del cuestionario.
- `index.html`: estructura, imports JS/CSS y contenedores de vistas.

## 3) Carpetas con lógica principal
- `js/`
- `data/`
- `css/`
- `scripts/`

## 4) Flujo funcional mínimo
- Catálogo: `data/partidos/index.json` -> `loadPartiesCatalog()` en `js/api.js`.
- Datos completos: `fetchAllPartiesData()` -> estado global en `js/main.js`.
- Render: estado/ruta -> funciones de `js/ui.js`.
- Afinidad: `initAfinidad()` carga JSON -> respuestas usuario -> ranking final.

## 5) Carpetas/archivos a ignorar siempre (no leer jamás)
- `.git/`
- `.githooks/`
- `LICENSE`
- `CNAME`
- `.DS_Store`
