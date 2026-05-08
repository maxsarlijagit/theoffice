# 🧭 Avatar Zero: Directional Guide (8-Way Walk)

Este documento define la construcción técnica de las 8 direcciones para el Avatar Zero, asegurando que la perspectiva isométrica 2:1 y la iluminación sean consistentes en todo el ciclo de caminata.

## 📐 Especificaciones de Vista

Cada sprite de 32x32 píxeles representa una de las 8 direcciones cardinales e intercardinales.

| ID | Dirección | Descripción Visual | Elementos Clave |
| :--- | :--- | :--- | :--- |
| **S** | **Abajo** (South) | Frente total al jugador. | Cara completa visible, pies alineados horizontalmente. |
| **SE** | **Abajo-Derecha** | 3/4 Frente derecha. | Hombro izquierdo retraído, pie derecho adelantado. |
| **E** | **Derecha** (East) | Perfil derecho. | Silueta más delgada, brazo derecho visible ocultando torso. |
| **NE** | **Arriba-Derecha** | 3/4 Espalda derecha. | Talón derecho visible, nuca y espalda visibles. |
| **N** | **Arriba** (North) | Espalda total. | Solo espalda y nuca visibles, pies apuntando "hacia adentro". |
| **NW** | **Arriba-Izquierda** | 3/4 Espalda izquierda. | Simétrico a NE pero invertido en perspectiva. |
| **W** | **Izquierda** (West) | Perfil izquierdo. | Simétrico a E pero invertido. |
| **SW** | **Abajo-Izquierda** | 3/4 Frente izquierda. | Simétrico a SE pero invertido. |

---

## 🏃 Walk Cycle Animation Logic (4-Frame System)

To maintain consistency and fluidity, the Avatar Zero uses a **4-Frame Walk Cycle** that balances simplicity with natural movement:

| Frame | Pose | Logic | Visual Effect |
| :--- | :--- | :--- | :--- |
| **01** | **Contact L** | Left leg forward (max), Right back. Arms opposite. | Main stride start. |
| **02** | **Passing 1** | Legs neutral/crossing. Torso drops 1px. | The "dip" in the walk. |
| **03** | **Contact R** | Right leg forward (max), Left back. Arms opposite. | Middle of stride. |
| **04** | **Passing 2** | Legs neutral/crossing. Torso drops 1px. | Second dip. |

### 🛠️ Key Technical Rules for Animation:
1. **Vertical Bounce**: The character drops **1 pixel** on the "Passing" frames (02 & 04).
2. **Arm Swing**: Arms should always move in the opposite direction of the legs to maintain balance.
3. **Head Tilt**: A subtle 1px tilt toward the leading leg on "Contact" frames adds personality.
4. **Lighting**: Keep the Top-Left light source fixed regardless of the character's orientation.

---

## 🛠️ Sprite Synthesizer Tool

Para generar y exportar estos sprites con precisión técnica, utiliza el sintetizador local:
👉 [walk_cycle_synthesizer.html](file:///e:/Formación%20Technical%20Artist/Repo%20Github/theoffice/art/walk_cycle_synthesizer.html)

> [!TIP]
> Al exportar desde el sintetizador, obtendrás una hoja de sprites de **128x256 px** (4 frames horizontales x 8 direcciones verticales), lista para ser procesada o usada directamente en el motor.
