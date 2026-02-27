# Comparador Electoral: Castilla y León 2026

Este proyecto tiene como objetivo transformar los programas electorales (PDF) de los partidos políticos en datos estructurados (JSON) para alimentar un comparador web de afinidad política.

## 🚀 Metodología de Procesamiento

Para mantener la integridad de los datos y evitar límites de memoria o tokens en los modelos de lenguaje (LLM), el proceso se divide en pasos claros:

### 1. Extracción de Datos (PDF ➔ JSON)

Utiliza un LLM avanzado con el prompt ubicado en `docs/EXTRACTOR-PROMPT.md`.

*   **Paso A**: Carga el PDF del partido en la interfaz del LLM.
*   **Paso B**: Ejecuta el prompt de extracción. El documento se procesa en bloques de **20 páginas** para asegurar que no se omita ninguna medida.
*   **Paso C**: Guarda cada bloque como un archivo JSON independiente en la carpeta `data/` (ej. `pp_01_20.json`, `pp_21_40.json`, etc.).

### 2. Unificación de Bloques

Una vez extraídos todos los bloques de un partido, utiliza el script automático para unificarlo en un solo archivo:

```bash
python3 scripts/merge_batches.py --dir ./data --out nombre_partido.json --pattern "prefijo_partido_*.json"
```

### 3. Generación del Cuestionario y Matriz de Puntos

Con todos los archivos JSON de los partidos listos en `data/`, utiliza el prompt avanzado en `docs/QUESTIONS-GENERATOR-PROMPT.md`.

Este prompt analizará todos los programas en conjunto para:
*   Identificar las **22 preguntas clave** (2 por cada competencia de la Junta) donde los partidos tienen posturas enfrentadas.
*   Generar el archivo `master-questions.json`.
*   Generar la matriz `party-scores.json` con las puntuaciones de cada partido (-2 a +2).

---

## 🛠️ Desarrollo de la Web

*(Este espacio está reservado para las instrucciones técnicas sobre el frontend y la integración de los datos en la aplicación web del comparador)*

### Versionado automático de CSS/JS en cada commit

Para evitar caché de navegador tras despliegues, el repositorio incluye:

* `scripts/bump_asset_version.sh`: actualiza en `index.html` los assets locales con `?v=YYYYMMDDHHMMSS`.
* `.githooks/pre-commit`: ejecuta ese script antes de cada commit y deja `index.html` staged automáticamente.

Activación (una sola vez por clon):

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit scripts/bump_asset_version.sh
```

---

## 📜 Licencias

*   **Código**: Publicado bajo la licencia **GNU Affero General Public License v3.0 (AGPL-3.0)**. Ver el archivo [LICENSE](LICENSE) para más detalles.
*   **Datos y Contenido**: Los archivos generados en la carpeta `/data` y la documentación se publican bajo la licencia **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.

---

## 📁 Estructura del Proyecto

*   `/data`: Archivos JSON con las propuestas extraídas y matrices de puntuación.
*   `/docs`: Prompts avanzados y documentación metodológica.
*   `/programas`: Los archivos PDF originales de los partidos políticos.
*   `/scripts`: Herramientas de automatización para el procesamiento de datos.
