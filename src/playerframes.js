// playerframes.js — АВТОГЕНЕРИРУЕМЫЙ манифест спрайтов игрока (C-13; бой — C-20).
// Генератор: tools/sprites_export.py (не править вручную —
// правь данные в генераторе). Источник: метаспрайты ROM
// (разбор B-07, docs/sprites.md), палитра Rash — фрагмент
// $E8B6 №6 (зелёный, уровень 1).
// FRAMES: id — номер кадра ROM; x,y,w,h — рект в листе
// (пиксели ROM); ax,ay — позиция точки-якоря объекта внутри
// кадра (из anchor_dx/anchor_dy заголовков метаспрайтов +
// разброса тайлов, docs/sprites.md §3). Рендер: горизонталь —
// по якорю (origin тела над центром хитбокса), вертикаль —
// низом кадра к линии ступней («ноги к полу»).
// ticks — тики 60 Гц: 1 шаг скрипта анимации = 4 тика (темп
// ВМ $D282 игрока, A=3); боевые анимации собраны из скриптов
// ROM (analysis/sprites/map.json): джеб anim 2/4, добивания
// anim 14 (кулак) / anim 20 (ботинок), таран anim 22 —
// docs/combat.md (C-20).

export const SPRITE_URL = "assets/player/rash.png";

export const FRAMES = {
  f29: { id: 29, x: 0, y: 0, w: 25, h: 32, ax: 10, ay: 20 },
  f1: { id: 1, x: 26, y: 0, w: 24, h: 33, ax: 12, ay: 21 },
  f4: { id: 4, x: 51, y: 0, w: 26, h: 32, ax: 13, ay: 23 },
  f5: { id: 5, x: 78, y: 0, w: 33, h: 30, ax: 14, ay: 24 },
  f8: { id: 8, x: 112, y: 0, w: 21, h: 40, ax: 11, ay: 27 },
  f6: { id: 6, x: 134, y: 0, w: 24, h: 32, ax: 14, ay: 23 },
  f7: { id: 7, x: 159, y: 0, w: 32, h: 33, ax: 15, ay: 26 },
  f3: { id: 3, x: 192, y: 0, w: 22, h: 40, ax: 11, ay: 27 },
  f45: { id: 45, x: 215, y: 0, w: 45, h: 24, ax: 20, ay: 24 },
  f25: { id: 25, x: 261, y: 0, w: 37, h: 32, ax: 11, ay: 19 },
  f27: { id: 27, x: 299, y: 0, w: 33, h: 32, ax: 12, ay: 21 },
  f16: { id: 16, x: 333, y: 0, w: 22, h: 40, ax: 9, ay: 27 },
  f24: { id: 24, x: 356, y: 0, w: 33, h: 40, ax: 13, ay: 28 },
  f28: { id: 28, x: 390, y: 0, w: 50, h: 32, ax: 14, ay: 20 },
  f54: { id: 54, x: 441, y: 0, w: 27, h: 40, ax: 21, ay: 31 },
  f31: { id: 31, x: 469, y: 0, w: 39, h: 32, ax: 19, ay: 20 },
  f30: { id: 30, x: 509, y: 0, w: 41, h: 40, ax: 10, ay: 38 },
  f55: { id: 55, x: 551, y: 0, w: 34, h: 30, ax: 12, ay: 29 },
  f35: { id: 35, x: 586, y: 0, w: 28, h: 40, ax: 10, ay: 29 },
  f37: { id: 37, x: 615, y: 0, w: 26, h: 48, ax: 13, ay: 37 },
  f57: { id: 57, x: 642, y: 0, w: 22, h: 32, ax: 11, ay: 25 },
  f58: { id: 58, x: 665, y: 0, w: 39, h: 21, ax: 20, ay: 22 },
  f91: { id: 91, x: 705, y: 0, w: 40, h: 21, ax: 24, ay: 19 },
  f127: { id: 127, x: 746, y: 0, w: 23, h: 53, ax: 14, ay: 21 },
  f128: { id: 128, x: 770, y: 0, w: 21, h: 53, ax: 12, ay: 21 },
};

export const ANIMS = {
  idle: { loop: true, frames: [{ f: "f29", ticks: 24 }, { f: "f1", ticks: 8 }] },
  run: { loop: true, frames: [{ f: "f4", ticks: 2 }, { f: "f5", ticks: 2 }, { f: "f4", ticks: 2 }, { f: "f8", ticks: 2 }, { f: "f6", ticks: 2 }, { f: "f7", ticks: 2 }, { f: "f6", ticks: 2 }, { f: "f3", ticks: 2 }] },
  jump: { loop: false, frames: [{ f: "f45", ticks: 999 }] },
  land: { loop: false, frames: [{ f: "f45", ticks: 4 }] },
  attackL: { loop: false, frames: [{ f: "f25", ticks: 4 }, { f: "f16", ticks: 4 }, { f: "f25", ticks: 12 }, { f: "f29", ticks: 32 }] },
  attackR: { loop: false, frames: [{ f: "f27", ticks: 4 }, { f: "f16", ticks: 4 }, { f: "f27", ticks: 12 }, { f: "f29", ticks: 32 }] },
  fist: { loop: false, frames: [{ f: "f29", ticks: 12 }, { f: "f24", ticks: 32 }, { f: "f28", ticks: 4 }, { f: "f54", ticks: 4 }, { f: "f28", ticks: 80 }, { f: "f29", ticks: 16 }] },
  boot: { loop: false, frames: [{ f: "f31", ticks: 48 }, { f: "f30", ticks: 4 }, { f: "f55", ticks: 4 }, { f: "f30", ticks: 96 }] },
  ram: { loop: false, frames: [{ f: "f35", ticks: 4 }, { f: "f37", ticks: 4 }, { f: "f35", ticks: 4 }, { f: "f37", ticks: 4 }, { f: "f35", ticks: 4 }, { f: "f37", ticks: 4 }, { f: "f35", ticks: 4 }, { f: "f37", ticks: 4 }, { f: "f35", ticks: 4 }, { f: "f37", ticks: 4 }, { f: "f35", ticks: 4 }, { f: "f37", ticks: 4 }, { f: "f35", ticks: 4 }, { f: "f37", ticks: 4 }, { f: "f35", ticks: 4 }, { f: "f37", ticks: 4 }, { f: "f35", ticks: 4 }, { f: "f37", ticks: 4 }, { f: "f35", ticks: 4 }, { f: "f37", ticks: 4 }, { f: "f35", ticks: 4 }, { f: "f37", ticks: 4 }, { f: "f35", ticks: 28 }] },
  hurt: { loop: false, frames: [{ f: "f37", ticks: 20 }] },
  ko: { loop: false, frames: [{ f: "f57", ticks: 8 }, { f: "f58", ticks: 10 }, { f: "f91", ticks: 999 }] },
  win: { loop: true, frames: [{ f: "f127", ticks: 16 }, { f: "f128", ticks: 16 }] },
};

// Боевая геометрия (docs/combat.md, C-20): dash — рывок
// вперёд по тикам [с_тика, px/с]; active — тики активной фазы
// (окно удара); hitbox — rect перед игроком в активную фазу;
// chainFrom — с этого тика повторное нажатие начинает
// следующий удар (команда E6 скрипта → $04A3|$04; только джеб).
// Урон/стан/отброс — COMBAT в enemyframes.js (ряды $88B8).
export const ATTACK = {
  ticks: 52,
  chainFrom: 20,
  dash: [[4, 45], [20, 0]],
  active: [4, 12],
  hitbox: { dx: 10, dy: 12, w: 26, h: 18 },
};
export const FIST = {
  ticks: 148,
  dash: [[44, 150], [72, 0]],
  active: [44, 60],
  hitbox: { dx: 14, dy: 8, w: 40, h: 26 },
};
export const BOOT = {
  ticks: 152,
  dash: [[44, 150], [72, 0]],
  active: [48, 64],
  hitbox: { dx: 6, dy: 24, w: 34, h: 22 },
};
export const RAM = {
  ticks: 116,
  dash: [],
  active: [4, 88],
  hitbox: { dx: 8, dy: 10, w: 28, h: 22 },
};
