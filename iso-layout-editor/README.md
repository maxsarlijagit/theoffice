# 🏗️ The Office - Isometric Layout Editor

Esta herramienta es un editor de escenarios modular diseñado para generar la grilla base del proyecto "The Office". Permite pintar suelos y paredes en perspectiva isométrica (2:1) y exportar los datos técnicos para su integración en Phaser 3 y el Servidor.

## 🚀 Cómo empezar

Desde la raíz del proyecto principal, simplemente ejecuta:

```bash
npm run editor
```

Esto levantará el editor en tu navegador (usualmente en `http://localhost:5174`).

## 🛠️ Funcionalidades

- **Paint Floor:** Pinta baldosas de suelo con nombres de área y colores personalizados.
- **Paint Wall:** Coloca paredes en los bordes de la grilla (`top`, `right`, `bottom`, `left`).
- **Fill Tool:** Rellena áreas conectadas respetando las paredes existentes.
- **Auto-Generator:** Generador de layouts aleatorios (habitaciones y pasillos) basado en una semilla (Seed).
- **Export/Import:** Guarda y carga tus diseños en formato `.json`.

## 📦 Integración Técnica

El archivo exportado (`grid.json`) contiene toda la información necesaria para el equipo:

1.  **Tiles Array:** Coordenadas `x, y` y nombre de área para el suelo.
2.  **Walls Array:** Coordenadas y el borde (`edge`) específico donde se encuentra la pared.
3.  **Grid Config:** Tamaño de celda (default 32) y dimensiones del mapa.

### 📍 Destino de los Mapas
Los mapas finales de la oficina deben guardarse en:
`theoffice/public/assets/data/map_v1.json`

---
*Desarrollado por Kalil Fiat para el Pivot Isométrico de The Office.*
