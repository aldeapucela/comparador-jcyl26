# Metodología del Comparador Electoral: Castilla y León 2026

## 📝 Resumen general

**¿Qué es esta herramienta?**
Es una "brújula electoral" diseñada para ayudarte a saber qué partido político se parece más a ti. No se basa en opiniones de periodistas ni en lo que dicen los políticos en la televisión, sino exclusivamente en lo que han escrito y firmado en sus **programas electorales oficiales**.

**¿Cómo funciona?**
1.  **Tú opinas:** Te haremos 22 preguntas sobre temas que afectan a nuestra tierra (médicos en los pueblos, impuestos, transporte, macrogranjas...). 
2.  **Nosotros comparamos:** El sistema mira lo que tú has respondido y lo compara con lo que cada partido promete en su programa (sus PDFs oficiales).
3.  **Tu resultado:** Al final, verás un porcentaje (por ejemplo: "Eres un 85% afín al Partido X"). Esto significa que, en los temas que has contestado, tus ideas coinciden mucho con las de ese partido.

**¿Es neutral?**
Sí. La herramienta no te dice a quién votar. Solo te muestra datos. Además, en cada pregunta puedes pulsar un botón para leer la frase exacta del programa del partido y en qué página está, para que compruebes que no hay trampa ni cartón.

---

## 🔬 Metodología Técnica (Para la programación)

Este sistema utiliza una variante científica de las aplicaciones **VAA (Voting Aid Applications)**. La lógica se basa en el cálculo de la **Distancia Euclidiana Inversa** en un espacio de 22 dimensiones.

### 1. Estructura de Datos
La aplicación debe consumir dos archivos principales situados en la carpeta `/data`:
*   `master_questions.json`: Contiene las 22 afirmaciones normalizadas.
*   `party_scores.json`: Contiene la matriz de posicionamiento de los partidos.

### 2. El Sistema de Puntuación (Escala Likert)
Las respuestas, tanto del usuario como de los partidos, se traducen a valores numéricos:
*   **Muy de acuerdo:** +2
*   **De acuerdo:** +1
*   **Neutral / No sabe:** 0
*   **En desacuerdo:** -1
*   **Muy en desacuerdo:** -2

### 3. El Algoritmo de Afinidad
Para calcular la coincidencia con cada partido, el motor de la web debe seguir estos pasos:

#### A. Cálculo de la Distancia
Para cada pregunta ($i$), se calcula la diferencia absoluta entre el voto del usuario ($u$) y la posición del partido ($p$):
$$D_i = |V_u - V_p|$$

#### B. Factor de Importancia (Multiplicador)
Si el usuario marca una pregunta como "Muy importante", la distancia de esa pregunta se multiplica por 2, dándole más peso en el resultado final:
$$D_i = |V_u - V_p| \times W_i$$
*(Donde $W_i$ es 2 si es importante, o 1 si es normal)*.

#### C. Normalización y Porcentaje
La afinidad final se obtiene restando la suma de distancias al total máximo posible y convirtiéndolo en base 100:
$$\text{Afinidad} \% = 100 \times \left( 1 - \frac{\sum D_i}{\text{Distancia Máxima Posible}} \right)$$

*Nota: La "Distancia Máxima" es 4 puntos por pregunta (de -2 a +2). Con 22 preguntas, el máximo es 88 (o más si hay multiplicadores).*

### 4. Categorización y Filtros
La base de datos permite dos tipos de análisis adicionales que deben reflejarse en la interfaz:
1.  **Foco Rural:** Propuestas marcadas con `foco_rural: true`. Permiten al usuario ver su afinidad exclusivamente en temas de despoblación y campo.
2.  **Semáforo de Competencia:**
    *   **Directa:** Medidas que la Junta puede ejecutar mañana mismo.
    *   **Shared/Petition:** Medidas que dependen de pactos con Madrid o Bruselas (promesas a largo plazo).

### 5. Transparencia (Verificabilidad)
Es **obligatorio** que el frontend permita al usuario desplegar la `cita_literal` y la `pagina` contenida en los JSON originales de cada partido. Esto blinda la herramienta contra acusaciones de sesgo, ya que el dato es trazable al documento original.

### 6. Escalabilidad
Para añadir un nuevo partido (ej. Vox, UPL, Podemos), no se debe modificar el código de la web. Solo es necesario:
1.  Generar el JSON de propuestas del nuevo partido.
2.  Añadir sus puntuaciones (-2 a +2) al archivo `party_scores.json`.
3.  La web detectará automáticamente el nuevo partido y lo incluirá en la comparativa.