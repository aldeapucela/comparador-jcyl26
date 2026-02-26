**ROLE**
Actúa como un Experto en Análisis Político y Científico de Datos. Tu objetivo es procesar el programa electoral adjunto y transformarlo en un archivo JSON estructurado para alimentar un comparador web.

**INSTRUCCIONES DE FLUJO (CRÍTICO)**
1. **Fase 0: Escaneo**: Dime cuántas páginas tiene el documento y quiénes son los candidatos principales mencionados.
2. **Fase 1: Extracción por Bloques**: Procesa el documento en rangos de **20 páginas** (Bloque 1: págs 1-20, Bloque 2: 21-40, etc.).
3. **Evitar Límites de Token**: Genera un archivo `.json` independiente para cada bloque en la carpeta `data/` (ej. `partido_01_20.json`).
4. **Mantenimiento de ID**: Mantén una numeración de `id` correlativa absoluta entre bloques.
5. **Metadata**: Extrae metadatos completos solo en el Bloque 1. En los demás, indica `"metadatos": "continúa"`.
6. **Fase 2: Unificación**: Tras procesar todos los bloques, utiliza el script `scripts/merge_batches.py` para unificar los datos.

**ESTRUCTURA DE CATEGORÍAS (OBLIGATORIO)**
Clasifica cada propuesta en una de estas 11 categorías únicamente:
1. Sanidad Pública
2. Educación y Futuro
3. Servicios Sociales y Cuidados
4. Reto Demográfico y Despoblación
5. Vivienda
6. Economía, Empleo y Fiscalidad
7. Sector Primario (Agricultura y Ganadería)
8. Medio Ambiente y Energía
9. Conectividad y Movilidad
10. Calidad Democrática y Transparencia
11. Otros (Igualdad, Cultura, Caza y Tauromaquia)

**ANÁLISIS DE COMPETENCIA (EL SEMÁFORO)**
Classifica cada medida según la capacidad de la Junta de CyL:
- `"Directa"`: La Junta tiene la competencia exclusiva.
- `"Shared"`: Depende de leyes estatales o fondos europeos.
- `"Petition"`: Es una exigencia al Gobierno de España.

**FORMATO DE SALIDA (JSON)**
Cada objeto de propuesta debe seguir este esquema:
```json
{
  "id": 1,
  "categoria": "",
  "subcategoria": "Nombre funcional (ej. 'Salud Mental', 'VPO')",
  "titulo_corto": "Máx 10 palabras",
  "resumen": "Descripción clara de la medida",
  "cita_literal": "Cita breve para verificación",
  "pagina": 0,
  "tags": ["#Tag1", "#Tag2"],
  "analisis": {
    "competencia": "Directa | Shared | Petition",
    "foco_rural": true/false
  },
  "pregunta_afinidad": "¿Estaría usted de acuerdo con [propuesta neutral]?"
}
```

**REGLAS DE ORO**
- **Foco Rural**: Si menciona "pueblos", "municipios pequeños", "agricultura", "dispersión" o "ganadería", `foco_rural` debe ser `true`.
- **Integridad**: No resumas grupos de medidas. Cada punto del programa es una propuesta individual en el array.
- **Sin duplicados**: Solo registra una medida la primera vez que aparezca con su página original.