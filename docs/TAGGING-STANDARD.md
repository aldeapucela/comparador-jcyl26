# Estandar de Etiquetado (Tags)

Este documento fija el criterio de etiquetado para todos los partidos, actuales y futuros.

## Objetivos

- Comparabilidad entre formaciones.
- Recuperacion en buscador (`#/s/...`) con calidad estable.
- Coherencia semantica para analisis y mantenimiento.

## Reglas obligatorias

1. Cada propuesta debe tener entre **2 y 4 tags**.
2. Cada propuesta debe incluir **1 tag macro de categoria**.
3. No usar `#Otros` como tag.
4. No mezclar variantes equivalentes (acentos/sinonimos) para el mismo concepto.
5. Priorizar tags ya existentes en el repositorio antes de crear uno nuevo.

## Tags macro por categoria

- `Sanidad Pública` -> `#SanidadPublica`
- `Educación y Futuro` -> `#Educacion`
- `Servicios Sociales y Cuidados` -> `#ServiciosSociales`
- `Reto Demográfico y Despoblación` -> `#RetoDemografico`
- `Vivienda` -> `#Vivienda`
- `Economía, Empleo y Fiscalidad` -> `#Empleo`
- `Sector Primario (Agricultura y Ganadería)` -> `#SectorPrimario`
- `Medio Ambiente y Energía` -> `#MedioAmbiente`
- `Conectividad y Movilidad` -> `#Movilidad`
- `Calidad Democrática y Transparencia` -> `#Transparencia`
- `Otros` -> `#Derechos` (o `#Cultura` según contenido)

## Canonicalizacion (ejemplos)

- `#Digitalización` -> `#Digitalizacion`
- `#Financiación` -> `#Financiacion`
- `#ViolenciaGénero` -> `#ViolenciaGenero`
- `#Corrupción` -> `#Corrupcion`
- `#Sanidad` -> `#SanidadPublica`
- `#Publi-Privada` -> `#ColaboracionPublicoPrivada`

## Proceso obligatorio

1. Extraer propuestas por bloques con `docs/EXTRACTOR-PROMPT.md`.
2. Unificar JSON con `scripts/merge_batches.py`.
3. Normalizar tags con:

```bash
python3 scripts/normalize_tags.py --write
```

4. Validar calidad:

```bash
python3 scripts/validate_extraction.py data/partidos/<partido>.json --pdf programas/<partido>.pdf
```

## Criterio para nuevos tags

Solo crear un tag nuevo cuando:

- El concepto aparezca en mas de una propuesta, o
- Sea necesario para desambiguar una politica relevante no cubierta por tags existentes.

Si un tag es puntual y no aporta recuperacion, se evita.
