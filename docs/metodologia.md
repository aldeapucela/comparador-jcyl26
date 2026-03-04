# Metodología del Comparador Electoral: Castilla y León 2026

## Resumen

**¿Qué es esta herramienta?**
Es una "brújula electoral" diseñada para ayudarte a saber qué partido político se parece más a ti. No se basa en opiniones ni en lo que dicen los políticos en la televisión, sino *exclusivamente* en lo que han dejado escrito en sus **programas electorales oficiales**.

**¿Cómo funciona?**
1. **Tú opinas:** Te haremos 22 preguntas sobre temas que afectan a nuestra tierra (médicos en los pueblos, impuestos, macrogranjas...). 
2. **Nosotros comparamos:** El sistema cruza tus respuestas con las propuestas exactas de cada partido.
3. **Cobertura del programa:** Si un partido no se posiciona en una pregunta, esa pregunta no suma ni resta distancia para ese partido, pero la cobertura sí corrige su afinidad final.
4. **Tu resultado:** Al final, verás un porcentaje (ej: "Eres un 85% afín al Partido X"). 

**¿Es neutral?**
Sí. La herramienta no te dice a quién votar. Además, en cada pregunta puedes pulsar un botón para leer la **frase exacta** del programa del partido y el número de página, para que compruebes que no hay trampa.

---

## Metodología técnica

Este sistema utiliza una variante científica de las aplicaciones **VAA (Voting Advice Applications)**. La lógica huye de la simple asignación de "puntos por acierto" e implementa el cálculo de la **Distancia de Manhattan Inversa**, en un espacio de 22 dimensiones.

### 1. La Escala de Medición (Likert)
Las respuestas, tanto del usuario como de los partidos, se traducen a valores numéricos en un eje de 5 posiciones:
*   **+2:** Muy de acuerdo (Prioridad expresa en el programa)
*   **+1:** De acuerdo
*   **0:** Neutral / Intermedio
*   **-1:** En desacuerdo
*   **-2:** Muy en desacuerdo (Oposición frontal)
*   **N/A (`null`):** Sin postura (El partido ignora el tema en su programa)

### 2. El Algoritmo de afinidad

El motor de cálculo mide cuán lejos está el usuario del partido en cada política pública, aplicando estas reglas:

#### A. Cálculo de la distancia estándar
Si el partido tiene una postura definida, se calcula la diferencia absoluta:
`Distancia = |Voto_Usuario - Voto_Partido|`
*(Ejemplo: Usuario vota +2, Partido tiene -2. Distancia = 4. Es la lejanía máxima).*

#### B. Manejo de silencios (N/A)
Si el partido no tiene postura en una pregunta (`N/A`), esa pregunta se excluye del cálculo de afinidad para ese partido:
*   No suma distancia.
*   Tampoco suma "distancia máxima posible".
*   Se informa aparte con el indicador de **cobertura del programa**.

#### C. Factor de importancia (el multiplicador)
Si el usuario marca una pregunta como "Este tema me importa mucho", la distancia resultante **se multiplica por 2**.

#### D. Normalización (afinidad bruta)
Primero se obtiene una afinidad bruta restando la suma de distancias respecto a la distancia máxima de las preguntas en las que el partido sí tiene postura:

`Afinidad_Bruta % = [ 1 - ( ∑ Distancias / Distancia Máxima Posible ) ] × 100`

#### E. Equilibrio por Representatividad Programática
Para evitar que partidos con muchos silencios programáticos aparezcan artificialmente como mejores matches, se aplica una penalización por completitud basada en estándares VAA:

*   `Cobertura = Preguntas con postura / Total de preguntas contestadas por el usuario`
*   `W (Penalty Weight) = 0.5`
*   `Afinidad_Final = Afinidad_Bruta × (1 - (W × (1 - Cobertura)))`

Así, los `null` **no se tratan como 0 ideológico**: siguen siendo ausencia de dato. El ajuste actúa únicamente como factor corrector proporcional al silencio programático para que el match refleje un compromiso real en todas las áreas competenciales de la Junta.

### 3. Transparencia y trazabilidad de datos
La base de datos se alimenta de extracciones estructuradas en formato JSON directamente desde los PDFs oficiales. Todo el código, la lógica de cálculo y la atribución de `scores` se realiza en el navegador del usuario (Client-side), garantizando un **anonimato total** y permitiendo la auditoría pública (Open Source) del proceso.

---

## Bloque de modelo lógico para partidos provinciales (SYA, VB, UPL, XAV)

### Regla general
Para partidos provinciales o regionalistas se aplica el mismo criterio que al resto:
1. Solo se puntúa lo que está escrito con suficiente explicitud en programa.
2. Si no hay evidencia robusta para el eje exacto de la pregunta, se asigna `N/A`.
3. Se evita "forzar ideología" cuando la propuesta es de gestión territorial y no doctrinal.

### Justificación sintética por pregunta con postura
- `SAN_2`: VB `+2`; UPL, SYA y XAV `+1`.  
  Motivo: hay evidencia de refuerzo del sistema público/proximidad, con mayor intensidad en VB.
- `SOC_1`: SYA, UPL y VB `+1`.  
  Motivo: hay refuerzo explícito de red/cuidados; sin embargo, en VB no se formula una limitación fuerte del lucro que justificase `+2`.
- `RET_1`: SYA, VB, UPL, XAV `+2`.  
  Motivo: eje programático central en medidas contra despoblación y fijación de población.
- `VIV_2`: VB `-2`; UPL `-1`; SYA `0`.  
  Motivo: VB prioriza parque público de alquiler; UPL prioriza rehabilitación rural; en SYA conviven señales pro-compra y pro-rehabilitación.
- `FIS_1`: UPL `+1`; SYA/VB `0`; XAV `N/A`.  
  Motivo: UPL incluye una apuesta fiscal más afirmativa en el eje; en SYA/VB se mantiene enfoque más parcial o territorial.
- `AGR_1`: SYA y VB `+1`; UPL y XAV `N/A`.  
  Motivo: apoyo explícito al sector primario en SYA/VB; en UPL no hay evidencia suficientemente directa en el eje "extensiva vs intensiva".
- `AGR_2`: UPL `+1`; resto `N/A`.  
  Motivo: solo UPL formula con claridad una moratoria/regulación estricta en el ámbito de macroinstalaciones del eje.
- `AMB_1`: VB y UPL `+2`; SYA y XAV `N/A`.  
  Motivo: evidencia explícita de retorno/canon energético territorial en VB y UPL.
- `AMB_2`: VB `+2`; UPL `+1`; SYA y XAV `N/A`.  
  Motivo: límites territoriales claros en VB; enfoque más parcial en UPL.
- `MOV_1`: SYA y VB `+2`; UPL `+1`; XAV `N/A`.
- `MOV_2`: SYA y VB `+2`; UPL y XAV `N/A`.

### Por qué los partidos locales pueden salir con afinidades más moderadas
Estos partidos suelen concentrar su programa en reto demográfico, sector primario, conectividad y sanidad de proximidad.  
Cuando el cuestionario pregunta por otros ejes donde no hay postura explícita suficiente, se registra `N/A`.

Después, el sistema aplica el ajuste de cobertura (`W=0.5`) para que la afinidad final refleje también el grado de desarrollo programático en el conjunto de temas, sin convertir `N/A` en postura ideológica.
