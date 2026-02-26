### Prompt: Generador de Matriz de Afinidad y Cuestionario Maestro

**ROLE:**
Actúa como un Experto en Ciencia Política y Analista de Datos. Tu objetivo es diseñar el núcleo lógico de un comparador electoral para la Junta de Castilla y León 2026.

**CONTEXTO:**
Te voy a proporcionar varios archivos JSON, cada uno contiene las propuestas de un partido político. Debes analizarlos todos en conjunto para identificar los puntos de mayor conflicto ideológico y programático.

**TAREA 1: SELECCIÓN DE PREGUNTAS (master_questions.json)**
Genera un listado de **22 preguntas** (exactamente 2 por cada una de las 11 categorías de la Junta).
1. **Lógica de selección:** Ignora las propuestas donde todos los partidos coinciden. Selecciona solo aquellas donde haya una división clara (unos dicen Sí, otros No, otros proponen modelos opuestos).
2. **Redacción:** Las preguntas deben ser afirmaciones neutrales en tercera persona para ser respondidas en escala Likert (Muy de acuerdo a Muy en desacuerdo).
3. **Categorías:**
   1. Sanidad Pública | 2. Educación y Futuro | 3. Servicios Sociales | 4. Reto Demográfico | 5. Vivienda | 6. Economía y Fiscalidad | 7. Sector Primario | 8. Medio Ambiente y Energía | 9. Movilidad e Internet | 10. Calidad Democrática | 11. Otros (Igualdad/Cultura).

**TAREA 2: MATRIZ DE SCORING (party_scores.json)**
Para cada una de las 22 preguntas elegidas, asigna un valor numérico a **CADA** partido basado en sus propuestas:
- **(+2):** El partido lo propone como medida estrella o prioridad absoluta.
- **(+1):** Lo menciona positivamente o de forma genérica.
- **(0):** No menciona el tema o su postura es ambigua/neutral.
- **(-1):** Propone un modelo que dificulta o contradice la medida.
- **(-2):** Rechaza la medida explícitamente o propone lo opuesto.

**FORMATO DE SALIDA (ESTRICTO):**
Entrégame dos bloques de código JSON independientes.

**Bloque 1: `master_questions.json`**
```json
[
  { "id": "AREA_1", "categoria": "...", "pregunta": "..." },
  ...
]
```

**Bloque 2: `party_scores.json`**
```json
{
  "PARTIDO_A": { "AREA_1": 2, "AREA_2": -1, ... },
  "PARTIDO_B": { "AREA_1": -2, "AREA_2": 2, ... },
  ...
}
```

**REGLA DE ORO:**
No inventes datos. Si un partido no menciona un tema, su score debe ser 0. Justifica mentalmente cada nota basándote en las "citas_literales" de los archivos proporcionados.