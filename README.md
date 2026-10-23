# Subdivisión de Predios

Herramienta web tipo CAD para subdividir predios en coordenadas UTM (WGS84 UTM 19S).
Es un solo archivo, `index.html` (HTML + CSS + JS, sin frameworks ni compilación):
se abre directo en el navegador.

## Uso rápido

1. Abra `index.html`. La primera vez carga como ejemplo el archivo APV_Obraje.
2. Haga clic en un predio y escriba `SUB` (o use el botón Subdividir).
3. Elija el método: Paralela, Perpendicular o Por punto fijo.
4. Pase el cursor y haga clic sobre un lado; mueva la línea o pulse Tab para escribir el área.
5. Enter aplica el corte. Esc retrocede un paso; dos Esc salen.

Escriba `AYUDA` en la línea de comandos para ver todos los comandos y teclas.

## Importar y exportar

- **Importa** el JSON de EXTRAEPOL (`poligonos` con `v`) y el formato mínimo de abajo.
  Las entidades de la capa `AMD-LINEA…` se omiten.
- **Exporta** solo el formato mínimo (únicamente geometría; áreas y nombres los calcula la app):

```json
{
  "cabecera": {
    "origen": { "archivo": "APV_Obraje.dwg", "fecha": "23/10/2026 11:54" },
    "sistema_coordenadas": "WGS84 UTM 19S",
    "entidades": 1
  },
  "entidades": [
    { "id": "7155", "tipo": "polilinea", "cerrada": true, "capa": "0_Lotes",
      "coords": [[210395.5245, 8486142.7170], [210415.5627, 8486126.4218], [210404.2294, 8486111.4345]] }
  ]
}
```

- **CSV**: coordenadas, distancias y ángulos de los lotes nuevos creados por corte.

## Convenciones

- Vértices en sentido horario. Los importados conservan su vértice 1; los lotes nuevos empiezan en el vértice más al norte.
- Ángulos en sexagesimal al segundo (`90°00'00"`).
- Precisión por defecto: 4 decimales en coordenadas, 2 en distancias y áreas (configurable en Ajustes).
- A1 es la parte del lado de referencia; A2 es el resto. La tecla I los intercambia.

## Estructura del código (dentro de `index.html`)

- `<script id="geo-core">`: núcleo geométrico puro (área, ángulos, intersecciones, corte de
  polígonos cóncavos con una recta, bisección).
- Estado y deshacer/rehacer, lienzo, herramientas (máquinas de estados) e interfaz.
- Los métodos de subdivisión se agregan con `registerMethod({...})`.

## Pruebas

```
node tests.js
```

`tests.js` extrae el núcleo geométrico de `index.html` y lo prueba: rectángulo, trapecio
irregular, U cóncava, cortes con más de dos piezas, área objetivo 0 y total, entre otros.
