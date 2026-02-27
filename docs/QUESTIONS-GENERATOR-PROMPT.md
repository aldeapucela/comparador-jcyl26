# ROLE
Actúa como un Experto en Ciencia Política y Analista de Datos. Tu objetivo es diseñar el núcleo lógico de un comparador electoral para la Junta de Castilla y León 2026.

# CONTEXTO
Te voy a proporcionar varios archivos JSON, cada uno contiene las propuestas de un partido político. Debes analizarlos todos en conjunto para identificar los puntos de mayor conflicto ideológico y programático.

# TAREA 1: SELECCIÓN DE PREGUNTAS (master-questions.json)
Genera un listado de **22 preguntas** (exactamente 2 por cada una de las 11 categorías de la Junta).
1. **Lógica de selección:** Ignora las propuestas donde todos los partidos coinciden. Selecciona solo aquellas donde haya una división clara (unos dicen Sí, otros No, otros proponen modelos opuestos).
2. **Redacción:** Las preguntas deben ser afirmaciones neutrales en tercera persona para ser respondidas en escala Likert (Muy de acuerdo a Muy en desacuerdo).
3. **Campos obligatorios por pregunta:** además de `id`, `categoria` y `pregunta`, añade:
   - `tema`: etiqueta corta para UI (formato recomendado: `Area - Tema`).
   - `contexto`: explicación breve y clara para vecinos (1-2 frases), sin citas literales largas.
4. **Categorías:**
   1. Sanidad Pública | 2. Educación y Futuro | 3. Servicios Sociales | 4. Reto Demográfico | 5. Vivienda | 6. Economía y Fiscalidad | 7. Sector Primario | 8. Medio Ambiente y Energía | 9. Movilidad e Internet | 10. Calidad Democrática | 11. Otros (Igualdad/Cultura).

# TAREA 2: MATRIZ DE SCORING (party-scores.json)
Para cada una de las 22 preguntas elegidas, asigna un valor numérico a **CADA** partido basado estrictamente en sus propuestas:
- **(+2):** El partido lo propone como medida estrella o prioridad absoluta.
- **(+1):** Lo menciona positivamente o de forma genérica.
- **(0):** Menciona el tema, pero su postura es explícitamente ambigua o propone una vía puramente neutral.
- **(-1):** Propone un modelo que dificulta o contradice la medida.
- **(-2):** Rechaza la medida explícitamente o propone exactamente lo opuesto.
- **(null):** ATENCIÓN: Si el partido **no menciona en absoluto el tema** en su programa, el valor DEBE ser la palabra `null` (sin comillas). No asumas ideologías, cíñete al texto.

# FORMATO DE SALIDA (ESTRICTO)
Entrégame dos bloques de código JSON independientes.

**Bloque 1: `master-questions.json`**
[
  {
    "id": "SAN_1",
    "categoria": "Sanidad Pública",
    "pregunta": "La Junta debería ...",
    "tema": "Sanidad - ...",
    "contexto": "Explicación breve en lenguaje claro."
  },
  ...
]

**Bloque 2: `party-scores.json`**
{
  "PARTIDO_A": { "SAN_1": 2, "SAN_2": -1, "EDU_1": null },
  "PARTIDO_B": { "SAN_1": -2, "SAN_2": null, "EDU_1": 1 },
  ...
}

# REGLAS DE ORO
1. No inventes datos. Si no está escrito en el JSON del partido, el score ES `null`. Esto es vital para el rigor científico del test.
2. Las preguntas deben generar contraste. Es preferible una pregunta donde un partido tenga `+2` y tres tengan `null`, a una pregunta donde todos tengan `+1`.
3. Justifica mentalmente cada nota basándote en las "citas_literales" de los archivos proporcionados antes de generar el JSON.
4. `master-questions.json` es la única fuente de verdad para el panel "Saber más": no dejes `tema/contexto` para que se rellenen luego en JavaScript.
