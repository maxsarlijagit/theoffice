📌 Overview



Este documento define las reglas visuales para la creación de sprites para el juego the Office.



El objetivo es garantizar:



Consistencia visual

Legibilidad en baja resolución

Producción escalable



🎥 Cámara y Perspectiva

📐 Tipo de cámara

Isométrica modificada (2:1 pixel ratio)

Ángulo aproximado:

Rotación Y: 45°

Rotación X: \~30°–35°

👁️ Vistas requeridas

3/4 Frente

3/4 Espalda

📊 Ejemplo conceptual

&#x20;      ↖ cámara

&#x20;        \\

&#x20;         \\   (personaje)

&#x20;          🧍

📦 Resolución y Grid

Tamaño base: 32x32 px

Grid: 1px exacto (pixel perfect)

No anti-aliasing automático

Snap siempre activado

📏 Uso del espacio

Personaje típico: 24–28 px de alto

Margen superior: evitar overflow

Base alineada al suelo (consistente entre assets)

🧍 Proporciones del Personaje

Parte	Proporción aproximada

Cabeza	25–30%

Torso	30–35%

Piernas	35–40%

📌 Reglas clave

Silueta clara > detalle interno

Priorizar lectura a distancia

No variar altura entre personajes
Definir un "anchor pixel" (centro inferior)

La base del personaje siempre cae en la misma línea Y

Evitar:
Personajes flotando
Desfase con sombras o tiles
Problemas de colisión visual
tangentes visuales

⚖️ Peso Visual

Distribución de detalle dentro del sprite:

Cabeza → máxima prioridad
Torso → secundaria
Props / armas → acento
Piernas → mínimo detalle
Reglas:
60% del detalle en la mitad superior
Evitar ruido visual en piernas
Priorizar silueta sobre textura
Objetivo:

Garantizar lectura inmediata incluso en movimiento

🎨 Paleta de Color

🎯 Reglas

12–16 colores → por personaje completo (no por sprite individual)
Sprite individual ideal: 8–12 colores

🎯 Distribución recomendada
40% tonos medios (base)
30% sombras
20% highlights
10% acentos
🌈 Saturación y valores
Sombras → menos saturadas, ligeramente más frías
Highlights → más cálidos y levemente más saturados
Evitar:
Negros puros (#000)
Blancos puros (#FFF)
📌 Value separation (clave real)

Entre luz y sombra debe haber:

mínimo 2 steps de valor
ideal: 3 niveles (base → mid shadow → deep shadow)

💡 Iluminación

☀️ Luz principal
Arriba-izquierda (consistente globalmente)
🌗 Luz secundaria (opcional)
SFX o entorno
🧠 Reglas avanzadas
1. Subsurface Scattering (pixel-friendly)
Solo en:
piel
orejas
Aplicación:
1px cálido en bordes iluminados
2. Reflexión (materiales)
Metal:
contraste alto
highlights duros
Tela:
transición suave
Cuero:
midtones dominantes
3. Múltiples luces
Regla:
1 luz dominante
1 secundaria como acento

👉 Nunca dividir el sprite en dos sistemas de luz iguales

Sombra: Las zonas en sombra se orientan hacia abajo-derecha en relación a la luz principal.

🌈 Contraste

Alto contraste en bordes exteriores

Bajo contraste en detalles internos

✨ SFX Visuales (Partículas, Glows, FX)
📌 Regla general

Los efectos NO rompen la legibilidad del sprite base.

🔥 Tipos permitidos
Partículas (polvo, chispas)
Glow suave (magia, UI feedback)
Trails (movimiento)
🎨 Reglas técnicas
Máximo: 2–4 colores adicionales por efecto
Alpha limitado (evitar blur excesivo)
Evitar gradients suaves → usar dithering o steps
💡 Integración con luz
El SFX puede ser una segunda fuente de luz
Override permitido SOLO en:
Highlights
Bordes cercanos al efecto

✏️ Lineart

Base: 1px
PERO usar lineart selectivo adaptativo

Color: no usar negro puro (#000000)

Preferido: tonos oscuros del mismo color base

🎯 Excepciones (muy importante)

En zonas pequeñas:

Reducir contraste en vez de grosor
O directamente eliminar línea interna

👉 “0.5px efectivo” en pixel art =
simularlo con color, no con geometría
📌 Jerarquía
Contorno exterior → más oscuro
Detalles internos → más suaves o sin línea

🧩 Volumen y Sombreado

📐 Técnica

Cel shading

Máximo:

1 Base
1 Mid shadow
1 Core shadow
1 Highlight

👉 Opcional:

Bounce light (muy sutil)
📊 Value jumps recomendados
Base → mid: -15% value
Mid → core: -20–25%
Base → highlight: +15%
📌 Regla clave

Evitar banding → variar clusters de píxeles


🧭 Orientación (3/4)

Frente

Se ven:

Cara parcial

Pecho

Parte frontal de piernas

Espalda

Se ven:

Espalda

Parte trasera de cabeza

Talones

🔄 Consistencia

Mantener volumen idéntico entre vistas

🚶 Animación
Walk cycle (4–6 frames)
NO linear
Usar:
Contact → más tiempo
Passing → más rápido

👉 Distribución ejemplo (6 frames):

1 (contact) → hold
2
3 (passing) → rápido
4
5 (contact) → hold
6
📈 Easing
Micro-ease in/out en extremos
Evitar spacing uniforme

🎞️ Estabilidad de Volumen en Animación

Durante la animación:

La masa del personaje debe mantenerse consistente
Evitar cambios de tamaño frame a frame
Mantener alineación del anchor pixel
Regla:

El personaje no debe "respirar" o cambiar volumen involuntariamente

🧱 Tiles y Entorno

Misma perspectiva que personajes

Altura consistente

Bordes alineados a grid

📁 Naming Convention

char\_<tipo>\_<accion>\_<direccion>\_<frame>.png

Ejemplo:

char\_knight\_walk\_front\_01.png

char\_knight\_walk\_back\_03.png

🧪 Checklist de Calidad



Antes de exportar:



&#x20;Silueta clara a zoom 1x

&#x20;No hay pixels sueltos

&#x20;Consistencia de luz

&#x20;Alineación al grid

&#x20;Colores dentro de paleta

&#x20;Lectura correcta en 3/4

📤 Export

Formato: PNG

Fondo: transparente

Trabajar en:
1x nativo (recomendado)
o 2x solo si se domina reducción
⚙️ Si trabajás en 2x:
Reducir con:
nearest neighbor ONLY
Cleanup manual obligatorio después
🚫 Evitar
Escalados automáticos finales
Downscale sin revisión

Sin compresión con pérdida

⚙️ Pipeline Recomendado
Sketch (bloques básicos)
Silueta limpia
Color base
Sombra
Highlights
Polish (cleanup)

🚫 Errores Comunes
❌ Overdetail en 32x32
❌ Mezclar perspectivas
❌ Luz inconsistente
❌ Anti-aliasing automático
<<<<<<< Updated upstream
❌ Colores “lavados”

=======
❌ Colores “lavados”
>>>>>>> Stashed changes
