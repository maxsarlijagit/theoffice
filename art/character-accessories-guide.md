# 🛠️ Character Accessories Technical Guide

Este documento define la estructura técnica para los accesorios y assets personalizables sobre el modelo **Avatar Zero**.

## 🧍 "Avatar Zero" - Base Técnica
El Avatar Zero es el modelo base desnudo (sin pelo, sin ropa) diseñado para recibir capas de assets.

### Dimensiones en Píxeles (Escala 32x32)
Basado en un personaje típico de **27 píxeles** de alto:

| Parte | Altura (px) | Descripción |
| :--- | :--- | :--- |
| **Cabeza** | 8 px | Área para pelo, sombreros y gafas. |
| **Torso** | 9 px | Área para camisas, chaquetas y accesorios de cuello. |
| **Piernas** | 10 px | Área para pantalones y calzado. |
| **Ancho Base**| 10-12 px | Silueta central para evitar colisiones visuales con brazos. |

### 🎨 Paleta de Piel Oficial (Avatar Zero)
Para mantener la consistencia en todos los tonos de piel, se deben usar estos valores de referencia (o sus variantes saturadas):

- **Highlight**: `#FFDBAC` (O luz directa)
- **Base**: `#F1C27D` (Tono medio)
- **Sombra Media**: `#E0AC69` (Pliegues y músculos)
- **Sombra Profunda**: `#8D5524` (Oclusión ambiental y contorno)

> [!TIP]
> El asset base oficial se encuentra en: [avatar-zero-base.png](file:///e:/Formación%20Technical%20Artist/Repo%20Github/theoffice/art/avatar-zero-base.png)

---

## 🎯 Puntos de Anclaje (Anchor Points)
Para que los accesorios se alineen automáticamente en el motor o el generador, deben respetar estos puntos:

- `HEAD_CENTER`: (X: 16, Y: 8) - Centro de la cabeza para pelo y sombreros.
- `EYE_LINE`: (X: 16, Y: 10) - Línea base para gafas y máscaras.
- `NECK_BASE`: (X: 16, Y: 13) - Para collares, corbatas y bufandas.
- `HAND_R / HAND_L`: Extremos del torso para props (tazas, laptops).
- `FEET_BASE`: (X: 16, Y: 31) - Punto de contacto con el suelo.

---

## 🎒 Listado de Accesorios y Proporciones

### 1. Cabeza (Headwear & Hair)
| Ítem | Proporción Sugerida | Notas Técnicas |
| :--- | :--- | :--- |
| **Pelo (Base)** | 10x10 px | Debe cubrir el "cráneo" del Avatar Zero sin flotar. |
| **Gorra / Beanie** | 12x6 px | Sigue la perspectiva 2:1. |
| **Casco** | 14x12 px | Mayor volumen para dar sensación de protección. |
| **Cuernos / Aureolas** | 4x4 px (c/u) | Assets simétricos o asimétricos según diseño. |

### 2. Rostro (Facial Accessories)
| Ítem | Tamaño | Notas Técnicas |
| :--- | :--- | :--- |
| **Gafas** | 8x2 px | Siempre en la `EYE_LINE`. Usar 1px de transparencia si es posible. |
| **Barba** | 8x4 px | Se superpone a la parte inferior de la cabeza y superior del torso. |
| **Máscara Facial** | 6x6 px | Cubre boca y nariz. |

### 3. Torso (Body & Arms)
| Ítem | Capa | Notas Técnicas |
| :--- | :--- | :--- |
| **Camiseta / Camisa** | Base | Ajustada al Torso (9px alto). |
| **Chaqueta / Saco** | Over | +1px de ancho hacia afuera para simular grosor. |
| **Mochila** | Back | Visible principalmente en la vista 3/4 Espalda. |

### 4. Piernas y Pies (Lower Body)
| Ítem | Tamaño | Notas Técnicas |
| :--- | :--- | :--- |
| **Pantalón Largo** | 10px alto | Cubre desde la cintura hasta los tobillos. |
| **Shorts** | 5px alto | Deja ver la piel del Avatar Zero. |
| **Zapatos / Botas** | 4x3 px | Deben respetar el ángulo de pisada isométrico. |

---

## 🥞 Jerarquía de Capas (Z-Index)
Para evitar "clipping" visual, los assets deben renderizarse en este orden (de atrás hacia adelante):

1. **Backpack / Capes** (Detrás del personaje)
2. **Avatar Zero** (Base)
3. **Pants / Bottoms**
4. **Shirts / Inner Tops**
5. **Shoes**
6. **Jackets / Outerwear**
7. **Neck Accessories** (Bufandas, corbatas)
8. **Facial Hair**
9. **Hair** (Pelo)
10. **Headwear** (Sombreros)
11. **Eyewear** (Gafas)
12. **Handheld Props** (Objetos en mano)

---

## 📏 Reglas Estéticas para Accesorios
- **Grosor de Línea**: Siempre 1px. Evitar "double pixels" en esquinas.
- **Paleta**: Usar la paleta de 12-16 colores del proyecto. Los accesorios no deben añadir más de 2-4 colores extra por set.
- **Sombreado**: Los accesorios deben proyectar una pequeña sombra (1px) sobre el Avatar Zero para dar sensación de profundidad.
- **Iluminación**: Fuente de luz constante en la esquina superior-izquierda.

---

## 📚 Librería de Accesorios de Referencia (V1)

Para asegurar la variedad en la oficina, se han definido estos sets iniciales:

### 💼 Set Ejecutivo
- **Cabeza**: Pelo corto peinado (`#4A2C2A`).
- **Rostro**: Gafas de pasta negra.
- **Torso**: Camisa blanca con corbata azul marino.
- **Piernas**: Pantalón de vestir gris carbón.
- **Pies**: Zapatos negros de cuero.

### 🎧 Set IT / Creativo
- **Cabeza**: Gorro (Beanie) rojo o Auriculares de diadema.
- **Torso**: Hoodie (Sudadera con capucha) gris espacial.
- **Piernas**: Jeans azules con ligero dither para textura.
- **Pies**: Sneakers (zapatillas) blancas.

### ☕ Props de Mano (Handhelds)
- **Taza de Café**: 3x3 px, azul o blanca. Anclaje en `HAND_R`.
- **Smartphone**: 2x4 px, negro con 1px de brillo para la pantalla.
- **Laptop**: 6x4 px (cerrada), anclaje en el brazo o mano.

> [!NOTE]
> Puedes ver la hoja de referencia visual aquí: [accessory_variety_sheet.png](file:///C:/Users/Fran/.gemini/antigravity/brain/dbad4522-01c0-4be4-9441-9a9252ab6afc/accessory_variety_sheet_1778012605122.png)
