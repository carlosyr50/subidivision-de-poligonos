// Pruebas del núcleo geométrico. Ejecutar con:  node tests.js
// Extrae el bloque <script id="geo-core"> de index.html y lo prueba tal cual.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script id="geo-core">([\s\S]*?)<\/script>/);
if (!m) { console.error('No se encontró <script id="geo-core"> en index.html'); process.exit(1); }
const sandbox = { module: { exports: {} } };
vm.runInNewContext(m[1], sandbox);
const GEO = sandbox.module.exports;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok   ' + name); }
  catch (e) { fail++; console.log('  FALLA ' + name + '\n        ' + e.message); }
}
function eq(a, b, tol, what) {
  if (Math.abs(a - b) > (tol == null ? 1e-9 : tol)) throw new Error((what || 'valor') + ': esperado ' + b + ', obtenido ' + a);
}
function ok(c, what) { if (!c) throw new Error(what || 'condición falsa'); }
const sum = a => a.reduce((s, x) => s + x, 0);
const deg = r => r * 180 / Math.PI;
const sortedAreas = r => r.pieces.map(p => p.area).sort((a, b) => a - b);

// Para simular la subdivisión: A1 = piezas del lado del punto de referencia R.
function a1Of(pts, P, dir, R) {
  const r = GEO.cutPolygonByLine(pts, P, dir);
  const d = GEO.norm(dir), s = Math.sign(GEO.cross(d, GEO.sub(R, P)));
  return { a1: sum(r.pieces.filter(p => p.side === s).map(p => p.area)), r };
}

const rect = [[0, 0], [20, 0], [20, 10], [0, 10]];                // antihorario, 200 m²
const trap = [[0, 0], [30, 0], [24, 14], [5, 12]];                 // trapecio irregular
const U = [[0, 0], [30, 0], [30, 20], [20, 20], [20, 5], [10, 5], [10, 20], [0, 20]]; // 450 m²

console.log('Medidas básicas');
t('rectángulo: área, perímetro y sentido', () => {
  eq(GEO.area(rect), 200); eq(GEO.perimeter(rect), 60);
  ok(!GEO.isClockwise(rect), 'debería ser antihorario');
  const cw = GEO.toClockwise(rect);
  ok(GEO.isClockwise(cw), 'toClockwise debe dar horario');
  ok(cw[0][0] === 0 && cw[0][1] === 0, 'conserva el vértice 1');
  eq(GEO.area(cw), 200);
});
t('rectángulo: ángulos internos de 90°00\'00"', () => {
  for (const pts of [rect, GEO.toClockwise(rect)]) GEO.interiorAngles(pts).forEach(a => eq(deg(a), 90, 1e-9, 'ángulo'));
  ok(GEO.formatDMS(90) === '90°00\'00"', 'formato: ' + GEO.formatDMS(90));
  ok(GEO.formatDMS(89.9999999) === '90°00\'00"', 'redondeo al segundo');
  ok(GEO.formatDMS(45.5042) === '45°30\'15"', GEO.formatDMS(45.5042));
});
t('U cóncava: ángulos internos con 270° y suma (n-2)·180°', () => {
  const a = GEO.interiorAngles(U).map(deg);
  eq(sum(a), (U.length - 2) * 180, 1e-9, 'suma');
  ok(a.filter(x => Math.abs(x - 270) < 1e-9).length === 2, 'dos ángulos de 270°');
  const b = GEO.interiorAngles(GEO.toClockwise(U)).map(deg);
  eq(sum(b), (U.length - 2) * 180, 1e-9, 'suma en horario');
});
t('precisión con coordenadas UTM grandes', () => {
  const o = [210375.07447391, 8486130.69912024];
  const big = rect.map(p => [p[0] + o[0], p[1] + o[1]]);
  eq(GEO.area(big), 200, 1e-8, 'área');
});
t('parseAngle acepta varios formatos', () => {
  eq(GEO.parseAngle('45.5'), 45.5);
  eq(GEO.parseAngle('45°30\'15"'), 45.50416666666667, 1e-12);
  eq(GEO.parseAngle('45 30 15'), 45.50416666666667, 1e-12);
  eq(GEO.parseAngle('45d30m15s'), 45.50416666666667, 1e-12);
  eq(GEO.parseAngle('45-30-15'), 45.50416666666667, 1e-12);
  ok(isNaN(GEO.parseAngle('45 61 00')), 'minutos >= 60 no válidos');
  ok(isNaN(GEO.parseAngle('abc')), 'texto no válido');
});

console.log('Intersección y validación');
t('intersección de segmentos', () => {
  const x = GEO.segIntersect([0, 0], [10, 10], [0, 10], [10, 0]);
  ok(x, 'deben cortarse'); eq(x.pt[0], 5); eq(x.pt[1], 5);
  ok(!GEO.segIntersect([0, 0], [1, 0], [0, 1], [1, 1]), 'paralelos no se cortan');
  ok(!GEO.segIntersect([0, 0], [1, 1], [2, 0], [3, -5]), 'segmentos separados');
});
t('validación: correcto, autointersección, duplicados y colineales', () => {
  ok(GEO.validate(rect, 1e-4).ok, 'rectángulo válido');
  ok(GEO.validate(U, 1e-4).ok, 'U válida');
  const bow = [[0, 0], [10, 10], [10, 0], [0, 10]];
  ok(!GEO.validate(bow, 1e-4).ok && /cruzan/.test(GEO.validate(bow, 1e-4).errors[0]), 'moño inválido');
  ok(!GEO.validate([[0, 0], [10, 0], [10, 0.00001], [10, 10], [0, 10]], 1e-4).ok, 'vértice duplicado');
  ok(!GEO.validate([[0, 0], [5, 0], [10, 0], [10, 10], [0, 10]], 1e-4).ok, 'vértice colineal');
});

console.log('Corte con recta');
t('rectángulo cortado por vertical x=5 → 50 y 150', () => {
  const r = GEO.cutPolygonByLine(rect, [5, 0], [0, 1]);
  ok(r.pieces.length === 2, 'piezas: ' + r.pieces.length);
  const left = r.pieces.find(p => p.side === 1), right = r.pieces.find(p => p.side === -1);
  eq(left.area, 50); eq(right.area, 150);
  ok(r.chords.length === 1, 'una cuerda');
});
t('rectángulo cortado por la diagonal (pasa por vértices)', () => {
  const r = GEO.cutPolygonByLine(rect, [0, 0], [20, 10]);
  ok(r.pieces.length === 2, 'piezas: ' + r.pieces.length);
  r.pieces.forEach(p => { eq(p.area, 100); ok(p.pts.length === 3, 'triángulo'); });
});
t('recta fuera del polígono → una pieza', () => {
  const r = GEO.cutPolygonByLine(rect, [0, 50], [1, 0]);
  ok(r.pieces.length === 1, 'piezas'); eq(r.pieces[0].area, 200);
});
t('trapecio irregular: suma de piezas = total', () => {
  const T = GEO.area(trap);
  for (const y of [1, 5, 11.9, 12, 13]) {
    const r = GEO.cutPolygonByLine(trap, [0, y], [1, 0]);
    eq(sum(r.pieces.map(p => p.area)), T, 1e-9, 'suma en y=' + y);
  }
});
t('U cóncava con corte horizontal y=10 → 3 piezas (250, 100, 100)', () => {
  const r = GEO.cutPolygonByLine(U, [0, 10], [1, 0]);
  ok(r.pieces.length === 3, 'piezas: ' + r.pieces.length);
  const a = sortedAreas(r); eq(a[0], 100); eq(a[1], 100); eq(a[2], 250);
  ok(r.chords.length === 2, 'dos cuerdas');
  ok(r.pieces.filter(p => p.side === 1).length === 2, 'dos piezas arriba');
});
t('U con la recta sobre el fondo de la escotadura (lado colineal) → 150 ×3', () => {
  const r = GEO.cutPolygonByLine(U, [-5, 5], [1, 0]);
  ok(r.pieces.length === 3, 'piezas: ' + r.pieces.length);
  sortedAreas(r).forEach(a => eq(a, 150));
});
t('U con corte vertical → 2 piezas', () => {
  const r = GEO.cutPolygonByLine(U, [15, 0], [0, 1]);
  ok(r.pieces.length === 2, 'piezas: ' + r.pieces.length);
  sortedAreas(r).forEach(a => eq(a, 225));
});
t('recta tangente en un vértice reflejo desde dentro', () => {
  // L con vértice reflejo en (10,10); la recta y=10 pasa por él.
  const L = [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]];
  const r = GEO.cutPolygonByLine(L, [0, 10], [1, 0]);
  ok(r.pieces.length === 2, 'piezas: ' + r.pieces.length);
  eq(sum(r.pieces.map(p => p.area)), 300); ok(sortedAreas(r)[0] === 100, 'pieza superior 100');
});
t('polígono real FE12 (21 vértices) cortado: suma = total', () => {
  const fe12 = JSON.parse(html.match(/"id":"FE12","capa":"[^"]*","v":(\[\[[^\n]*?\]\])/)[1]);
  const T = GEO.area(fe12);
  const c = GEO.labelPoint(fe12);
  for (let k = 0; k < 12; k++) {
    const ang = k * Math.PI / 12, r = GEO.cutPolygonByLine(fe12, c, [Math.cos(ang), Math.sin(ang)]);
    eq(sum(r.pieces.map(p => p.area)), T, 1e-6, 'suma con ángulo ' + k * 15);
    ok(r.pieces.length >= 2, 'al menos dos piezas');
  }
});

console.log('Bisección por área (paralela, perpendicular, punto fijo)');
t('trapecio: paralela a la base con A1 = 150 m² (tolerancia 0.0001)', () => {
  const f = y => a1Of(trap, [0, y], [1, 0], [0, y - 1]).a1;
  const b = GEO.bisect(f, 0, 14, 150, 1e-4);
  ok(b.ok, 'convergió'); eq(f(b.x), 150, 1e-4, 'A1');
});
t('trapecio: perpendicular a la base con A1 = 100 m²', () => {
  const f = x => a1Of(trap, [x, 0], [0, 1], [x - 1, 0]).a1;
  const b = GEO.bisect(f, 0, 30, 100, 1e-4);
  ok(b.ok, 'convergió'); eq(f(b.x), 100, 1e-4, 'A1');
});
t('rectángulo: punto fijo en (8,0), A1 = 60 m² por ángulo', () => {
  // w = dirección hacia el vértice inicial (0,0); la recta gira hacia el interior.
  const Q = [8, 0], w = [-1, 0], rot = -1;
  const f = th => a1Of(rect, Q, GEO.rotate(w, th * rot), GEO.add(Q, w)).a1;
  const b = GEO.bisect(f, 1e-7, Math.PI - 1e-7, 60, 1e-4);
  ok(b.ok, 'convergió'); eq(f(b.x), 60, 1e-4, 'A1');
  ok(b.x > 0 && b.x < Math.PI / 2, 'ángulo agudo');
});
t('área objetivo = 0 → extremo inicial', () => {
  const f = y => a1Of(trap, [0, y], [1, 0], [0, y - 1]).a1;
  const b = GEO.bisect(f, 0, 14, 0, 1e-4);
  ok(b.ok && b.x === 0, 'x = ' + b.x); eq(b.value, 0, 1e-4);
});
t('área objetivo = total → extremo final', () => {
  const T = GEO.area(trap), f = y => a1Of(trap, [0, y], [1, 0], [0, y - 1]).a1;
  const b = GEO.bisect(f, 0, 14, T, 1e-4);
  ok(b.ok && b.x === 14, 'x = ' + b.x); eq(b.value, T, 1e-4);
});
t('área objetivo mayor que el total → no se aplica', () => {
  const T = GEO.area(trap), f = y => a1Of(trap, [0, y], [1, 0], [0, y - 1]).a1;
  const b = GEO.bisect(f, 0, 14, T + 1, 1e-4);
  ok(!b.ok, 'debe fallar'); eq(b.max, T, 1e-9, 'informa el máximo');
});
t('U cóncava: paralela al fondo con A1 = 400 da más de dos piezas', () => {
  const f = y => a1Of(U, [0, y], [1, 0], [0, y - 1]).a1;
  const b = GEO.bisect(f, 0, 20, 400, 1e-4);
  ok(b.ok, 'convergió');
  const { r } = a1Of(U, [0, b.x], [1, 0], [0, b.x - 1]);
  ok(r.pieces.length === 3, 'piezas: ' + r.pieces.length);
});

console.log('Utilidades');
t('rotateToNorth empieza en el vértice más al norte', () => {
  const r = GEO.rotateToNorth([[0, 0], [10, 0], [10, 10], [0, 10]]);
  ok(r[0][0] === 0 && r[0][1] === 10, 'empate en N: menor E → ' + r[0]);
});
t('cleanRing quita colineales y duplicados', () => {
  const r = GEO.cleanRing([[0, 0], [5, 0], [10, 0], [10, 0], [10, 10], [0, 10]], 1e-7);
  ok(r.length === 4, 'vértices: ' + r.length);
});
t('labelPoint cae dentro de la U', () => {
  ok(GEO.pointInPolygon(GEO.labelPoint(U), U), 'dentro');
});

console.log('\n' + pass + ' pruebas correctas, ' + fail + ' con falla.');
process.exit(fail ? 1 : 0);
