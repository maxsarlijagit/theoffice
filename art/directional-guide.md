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

## 🚶 Dinámica del Walk Cycle (Frame de Contacto)

Para estas 8 direcciones base, se define el **Frame 01 (Contact)**:

1. **Piernas**: Una pierna está extendida hacia adelante (contacto con el suelo) y la otra hacia atrás.
2. **Brazos**: El brazo opuesto a la pierna delantera se mueve hacia adelante para balanceo.
3. **Cabeza**: Ligera inclinación hacia la dirección del movimiento.
4. **Hombros**: Rotación sutil para acompañar el movimiento de los brazos.

---

## 💡 Iluminación Direccional

La fuente de luz es **Top-Left (Arriba-Izquierda)**. Esto afecta a cada dirección de forma única:

- **S / SE / SW**: Pecho y frente de la cara bien iluminados. Sombra cae a la derecha/atrás.
- **E / W**: El lado izquierdo del cuerpo siempre recibe más luz que el derecho.
- **N / NE / NW**: La espalda recibe luz principalmente en el hombro izquierdo.

---

## 📏 Alineación (Anchor Point)

Todos los sprites deben mantener el **Anchor Pixel** en `(16, 31)` (base central de los pies). 

---

## 🛠️ Lógica de Píxeles por Dirección (Referencia Técnica)

Como no fue posible generar la imagen de referencia por límites de cuota, aquí tienes la lógica de píxeles para construir cada frame de **Contacto**:

### 1. S (Abajo)
- **Cabeza**: Círculo de 8px centrado en X=16.
- **Torso**: Rectángulo de 9x10px.
- **Pierna Izq (Adelante)**: Baja hasta Y=31, pie apoyado plano.
- **Pierna Der (Atrás)**: Sube hasta Y=29, punta del pie tocando el suelo.

### 2. SE (Abajo-Derecha)
- **Eje**: Isométrico 2:1.
- **Cabeza**: Rotada 45° (vista 3/4). Oreja izquierda visible.
- **Torso**: Se ve el pecho y el lateral izquierdo.
- **Pies**: Alineados en la diagonal isométrica. Pie derecho adelantado hacia abajo-derecha.

### 3. E (Derecha)
- **Ancho**: Reducido a 8-10px (perfil).
- **Cabeza**: Solo se ve el perfil.
- **Brazo**: El brazo derecho oculta gran parte del torso.
- **Pies**: Uno delante de otro en línea recta vertical (desde esta perspectiva).

### 4. NE (Arriba-Derecha)
- **Espalda**: Visible en 3/4.
- **Cabeza**: Se ve la nuca y la oreja derecha.
- **Luz**: Solo ilumina el borde izquierdo (hombro).

### 5. N (Arriba)
- **Simetría**: Similar a **S** pero sin detalles faciales.
- **Pies**: Los talones están hacia arriba, las puntas hacia el fondo (Y=28/29).

> [!TIP]
> Para las direcciones **NW, W, SW**, simplemente utiliza la versión reflejada (mirror) de **NE, E, SE** y ajusta la iluminación (la luz siempre debe venir de la izquierda, por lo que el mirror requiere un repintado de sombras).

---

> [!WARNING]
> La generación automática de `avatar_zero_8_directions.png` falló debido a límites de cuota de la IA. Se recomienda seguir esta guía técnica para el diseño manual.
