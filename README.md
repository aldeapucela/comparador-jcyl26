# Comparador Electoral: Castilla y Leon 2026

Aplicacion web estatica para explorar y comparar propuestas de programas electorales de Castilla y Leon 2026, incluyendo un modo de comparacion por tematicas y un cuestionario de afinidad.

## 1. La Web

### 1.1 Que hace

La web ofrece tres vistas principales:

- Exploracion por partido: navegar medidas por categorias.
- Comparacion por tematica: ver una misma categoria entre varios partidos.
- Cuestionario de afinidad: responder preguntas y obtener similitud por partido.

Datos consumidos por la web:

- `data/partidos/*.json`: propuestas por partido.
- `data/master-questions.json`: preguntas del cuestionario con `id`, `categoria`, `pregunta`, `tema` y `contexto`.
- `data/party-scores.json`: matriz de puntuaciones para afinidad.

### 1.2 Estructura tecnica (resumen)

- `index.html`: unica pagina de la SPA.
- `js/main.js`: enrutado hash y estado general.
- `js/api.js`: carga de datos JSON.
- `js/ui.js`: renderizado de interfaz.
- `js/afinidad.js`: logica del cuestionario.
- `js/analytics.js`: integracion Matomo.
- `css/style.css`: estilos propios.

### 1.3 Ejecutar en local

Como la app usa `fetch` para cargar JSON, hay que levantar un servidor HTTP local.

```bash
cd /ruta/al/proyecto
python3 -m http.server 8000
```

Abrir en navegador: `http://localhost:8000`

### 1.4 Despliegue

La web es 100% estatica y se puede desplegar en GitHub Pages, Netlify, Cloudflare Pages, Vercel (modo estatico) o cualquier servidor de ficheros.

Requisitos minimos:

- Publicar el contenido del repositorio manteniendo rutas relativas.
- Servir `index.html` en raiz.
- Mantener disponible `CNAME` si se usa dominio personalizado (`elecciones26.aldeapucela.org`).

Checklist recomendado antes de desplegar:

1. Verificar que se cargan `data/partidos/*.json`, `data/master-questions.json` y `data/party-scores.json`.
2. Probar navegacion por hash (`#/`, `#/comparar`, `#/afinidad`, `#/psoe`, etc.).
3. Confirmar que Matomo sigue apuntando al `siteId` correcto en `js/analytics.js`.

### 1.5 Versionado automatico de CSS/JS en cada commit

Para evitar cache de navegador tras despliegues, el repositorio incluye:

- `scripts/bump_asset_version.sh`: actualiza en `index.html` los assets locales con `?v=YYYYMMDDHHMMSS`.
- `.githooks/pre-commit`: ejecuta ese script antes de cada commit y deja `index.html` staged automaticamente.

Activacion (una sola vez):

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit scripts/bump_asset_version.sh
```

## 2. Metodologia de datos (regenerarlos desde cero)

Objetivo: transformar programas electorales PDF en JSON estructurado y generar los ficheros de afinidad.

### 2.1 Extraccion de datos (PDF -> JSON por bloques)

Usa un LLM con el prompt de `docs/EXTRACTOR-PROMPT.md`.

Pasos:

1. Cargar el PDF del partido.
2. Ejecutar el prompt de extraccion.
3. Procesar en bloques de 20 paginas para no perder medidas.
4. El LLM debe redactar `titulo_corto`, `resumen` y `pregunta_afinidad` en lenguaje natural (no copiar/pegar mecanico del PDF).
5. Guardar cada bloque como JSON en `data/` (ejemplo: `pp_01_20.json`, `pp_21_40.json`).

### 2.2 Unificacion de bloques por partido

Cuando tengas todos los bloques de un partido, unificalos con:

```bash
python3 scripts/merge_batches.py --dir ./data --out nombre_partido.json --pattern "prefijo_partido_*.json"
```

### 2.3 Validacion de calidad de extraccion (obligatorio)

Antes de dar por cerrada la extraccion de un partido, valida el JSON final:

```bash
python3 scripts/validate_extraction.py data/partidos/nombre_partido.json --pdf programas/nombre_partido.pdf
```

Si quieres fallar tambien con warnings:

```bash
python3 scripts/validate_extraction.py data/partidos/nombre_partido.json --pdf programas/nombre_partido.pdf --fail-on-warning
```

Para exigir mayor re-redaccion (menos literalidad), puedes endurecer el umbral:

```bash
python3 scripts/validate_extraction.py data/partidos/nombre_partido.json --pdf programas/nombre_partido.pdf --literal-threshold 0.85 --fail-on-warning
```

Chequeo global rapido de cobertura por partido:

```bash
python3 scripts/audit_extraction_quality.py
```

### 2.4 Normalizacion de tags (obligatorio)

Despues de extraer/unificar cada partido, normaliza las etiquetas para mantener comparabilidad entre formaciones:

```bash
python3 scripts/normalize_tags.py --write
```

Reglas y taxonomia: `docs/TAGGING-STANDARD.md`.

### 2.5 Generacion del cuestionario y matriz de puntos

Con los JSON de partidos listos, usa `docs/QUESTIONS-GENERATOR-PROMPT.md` para generar:

- `data/master-questions.json`
- `data/party-scores.json`

Salida esperada:

- 22 preguntas clave (2 por cada competencia de la Junta) con contraste entre partidos.
- Cada pregunta debe incluir tambien `tema` y `contexto` (texto para el panel "Saber mas").
- Puntuaciones por partido en rango -2 a +2 para el calculo de afinidad.

Regla de implementacion (obligatoria):

- El frontend no debe hardcodear contextos de preguntas en JavaScript.
- `js/afinidad.js` debe leer `tema/contexto` directamente desde `data/master-questions.json`.
- Si falta `tema` o `contexto`, solo se acepta fallback temporal (`categoria`/`pregunta`) para compatibilidad.

## 3. Estructura del proyecto

- `/data`: JSON de propuestas, preguntas y matriz de puntuaciones.
- `/docs`: prompts y documentacion metodologica.
- `/programas`: PDFs originales.
- `/scripts`: utilidades de procesamiento.
- `/js` y `/css`: frontend de la aplicacion.

## 4. Licencias

- Codigo: **GNU Affero General Public License v3.0 (AGPL-3.0)**. Ver [LICENSE](LICENSE).
- Datos y contenido: **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.
