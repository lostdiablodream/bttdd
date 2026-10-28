// level.js — уровень 1 «Tail of the Ratship / Хвост Крысолёта»: ПОРТ
// оригинального уровня Battletoads & Double Dragon (NES) — задача C-11,
// ось глубины (псевдо-3D) — C-14.
// Раньше здесь лежал самодельный «каньон с лесенкой» (C-03/C-05) — заменён
// данными, извлечёнными из ROM генератором tools/level1_to_js.py
// (src/level1data.js). Этот модуль — только компоновка объекта LEVEL1.
//
// Мир 2304×288 в пикселях ROM (X 1:1 с оригиналом; масштаб — только при
// рендере, см. Game.js). Геометрия:
//   - пол — ломаная floorPoints (профиль $B46B режима 3: ступени-высоты со
//     склонами 45°, worldY = 264 − H на основном ряду глубины D=264);
//     пол сплошной, кроме floorGaps;
//   - ГЛУБИНА (C-14): у игрока/предметов есть координата depth (D, px ROM;
//     вверх по экрану = меньше D). Кромки палубы — ломаные depthFar/depthNear
//     по X (байты +3/+4 записей $B46B, логика $B5E9-$B66C слота 5);
//     экранная Y любой точки на глубине D: baseY + (D − depth.row) ×
//     depth.perspective — палуба «уходит» вверх с лёгким сжатием;
//   - floorGaps — единственный провал маршрута (адаптация: в оригинале ям
//     на пути нет, опасность — край палубы по оси глубины; в порту края
//     палубы просто клампят depth, а провал бьёт по X независимо от глубины;
//     место провала обосновано в tools/level1_to_js.py: аварийная
//     маркировка корпуса x≈1188-1228 + сокращение глубины $F6→$D7 у $0523);
//   - platforms — односторонние парящие платформы (приземление только
//     сверху — как платформы оригинала, collision.md §4 «сквозь платформу
//     снизу прыжок проходит»); X — из подвесных шашечных метатайлов карты,
//     верх адаптирован к пол−32 (апогей прыжка 40 px); плита перекрывает
//     всю полосу глубины (верх сдвигается с глубиной по общему правилу);
//   - items — 6 предметов типа $50 на оригинальных якорях X И глубине
//     спауна (поле depth); лежат на палубе на своей глубине;
//   - finish — зона выхода (объект $4F, триггер $07B0, якорь X=2192,
//     глубина 260); стены leftWall/rightWall = $54/$860 — клампы X
//     режима 3 оригинала.

import { LEVEL1DATA } from "./level1data.js";

export const LEVEL1 = {
  name: "Уровень 1 — Хвост Крысолёта (порт NES)",
  width: LEVEL1DATA.world.width,          // 2304 px ROM
  height: LEVEL1DATA.world.height,        // 288 px ROM
  leftWall: LEVEL1DATA.world.leftWall,    // $54 = 84
  rightWall: LEVEL1DATA.world.rightWall,  // $860 = 2144
  playerStart: LEVEL1DATA.playerStart,    // {x:100, y:120, depth:264}
  floorPoints: LEVEL1DATA.floorPoints,    // ломаная [[x, worldY], ...]
  floorGaps: LEVEL1DATA.floorGaps,        // провалы [{x0, x1}]
  depth: LEVEL1DATA.depth,       // {row:264, perspective:0.9, farScale:0.92, pickup:10}
  depthFar: LEVEL1DATA.depthFar,   // дальняя кромка палубы [[x, D], ...] (C-14)
  depthNear: LEVEL1DATA.depthNear, // ближняя кромка палубы [[x, D], ...] (C-14)
  platforms: LEVEL1DATA.platforms,        // односторонние платформы
  items: LEVEL1DATA.items,                // 6 предметов $50 (с depth)
  enemySpawns: LEVEL1DATA.enemySpawns,    // C-15: 23 записи врагов потока $F6BB
  hazards: [],                            // опасных зон-полос нет: опасность
  // уровня 1 — провал в палубе (floorGaps) = падение за край (см. Game.update)
  finish: LEVEL1DATA.finish,              // зона выхода (у правого края, depth 260)
  finishDoor: LEVEL1DATA.finishDoor,      // визуал дверного проёма (x≈2144-2232)
  silhouette: LEVEL1DATA.silhouette,      // силуэт корпуса по колонкам 32 px
  decor: LEVEL1DATA.decor,                // кристаллы/столбы/шашки/лестница
};

// Экранная Y точки палубы на глубине D: базовая линия (пол/верх платформы,
// вычисленные на ряду 264) + перспективный сдвиг (C-14). Общее правило для
// всего: пол, платформы, предметы (у предметов сдвиг запечён в y данных).
export function depthShift(level, depth) {
  return (depth - level.depth.row) * level.depth.perspective;
}
