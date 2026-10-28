// enemyframes.js — АВТОГЕНЕРИРУЕМЫЙ манифест спрайтов врагов уровня 1 (C-15).
// Генератор: tools/enemies_export.py (не править вручную —
// правь данные в генераторе). Источник: метаспрайты enemies ROM
// (разбор B-07, docs/sprites.md) + ПРАВИЛЬНЫЙ тайлсет уровня 1
// (райтеры слота 1 idx $1C/$42 + слота 4 idx $24 — эррата к
// B-07: потоки 37/39 врагам уровня 1 не соответствуют).
// Палитра: s6pal 12 ($A4D6) уровня 1; цвет экземпляра =
// подпалитра кадра XOR (флаги спауна & 3) — суффикс pN в имени.
// FRAMES: id/pal — кадр ROM и вариация; x,y,w,h — рект в листе
// (пиксели ROM); ax,ay — якорь объекта внутри кадра (из
// заголовков метаспрайтов, docs/sprites.md §3). Рендер: якорь
// над центром хитбокса по X, низ кадра к линии ступней.
// ticks — тики 60 Гц (1 шаг скрипта ВМ врагов = 4 тика,
// вызовы $D282 с A=3); раскадровка — analysis/sprites/anims.txt.

export const SPRITE_URL = "assets/enemies/enemies.png";

export const FRAMES = {
  r16p1: { id: 16, pal: 1, x: 0, y: 0, w: 19, h: 40, ax: 9, ay: 23 },
  r16p2: { id: 16, pal: 2, x: 20, y: 0, w: 19, h: 40, ax: 9, ay: 23 },
  r16p3: { id: 16, pal: 3, x: 40, y: 0, w: 19, h: 40, ax: 9, ay: 23 },
  r17p1: { id: 17, pal: 1, x: 60, y: 0, w: 28, h: 32, ax: 12, ay: 20 },
  r17p2: { id: 17, pal: 2, x: 89, y: 0, w: 28, h: 32, ax: 12, ay: 20 },
  r17p3: { id: 17, pal: 3, x: 118, y: 0, w: 28, h: 32, ax: 12, ay: 20 },
  r18p1: { id: 18, pal: 1, x: 147, y: 0, w: 24, h: 40, ax: 17, ay: 22 },
  r18p2: { id: 18, pal: 2, x: 172, y: 0, w: 24, h: 40, ax: 17, ay: 22 },
  r18p3: { id: 18, pal: 3, x: 197, y: 0, w: 24, h: 40, ax: 17, ay: 22 },
  r19p1: { id: 19, pal: 1, x: 222, y: 0, w: 36, h: 33, ax: 4, ay: 20 },
  r19p2: { id: 19, pal: 2, x: 259, y: 0, w: 36, h: 33, ax: 4, ay: 20 },
  r19p3: { id: 19, pal: 3, x: 296, y: 0, w: 36, h: 33, ax: 4, ay: 20 },
  r20p1: { id: 20, pal: 1, x: 333, y: 0, w: 28, h: 32, ax: 17, ay: 18 },
  r20p2: { id: 20, pal: 2, x: 362, y: 0, w: 28, h: 32, ax: 17, ay: 18 },
  r20p3: { id: 20, pal: 3, x: 391, y: 0, w: 28, h: 32, ax: 17, ay: 18 },
  r21p1: { id: 21, pal: 1, x: 420, y: 0, w: 32, h: 24, ax: 14, ay: 4 },
  r21p2: { id: 21, pal: 2, x: 453, y: 0, w: 32, h: 24, ax: 14, ay: 4 },
  r21p3: { id: 21, pal: 3, x: 486, y: 0, w: 32, h: 24, ax: 14, ay: 4 },
  r22p1: { id: 22, pal: 1, x: 519, y: 0, w: 27, h: 48, ax: 13, ay: 26 },
  r22p2: { id: 22, pal: 2, x: 547, y: 0, w: 27, h: 48, ax: 13, ay: 26 },
  r22p3: { id: 22, pal: 3, x: 575, y: 0, w: 27, h: 48, ax: 13, ay: 26 },
  r24p1: { id: 24, pal: 1, x: 603, y: 0, w: 32, h: 24, ax: 14, ay: 16 },
  r24p2: { id: 24, pal: 2, x: 636, y: 0, w: 32, h: 24, ax: 14, ay: 16 },
  r24p3: { id: 24, pal: 3, x: 669, y: 0, w: 32, h: 24, ax: 14, ay: 16 },
  r25p1: { id: 25, pal: 1, x: 702, y: 0, w: 32, h: 24, ax: 14, ay: 12 },
  r25p2: { id: 25, pal: 2, x: 735, y: 0, w: 32, h: 24, ax: 14, ay: 12 },
  r25p3: { id: 25, pal: 3, x: 768, y: 0, w: 32, h: 24, ax: 14, ay: 12 },
  d26p0: { id: 26, pal: 0, x: 801, y: 0, w: 21, h: 24, ax: 12, ay: 8 },
  d26p2: { id: 26, pal: 2, x: 823, y: 0, w: 21, h: 24, ax: 12, ay: 8 },
  d27p0: { id: 27, pal: 0, x: 845, y: 0, w: 21, h: 24, ax: 11, ay: 8 },
  d27p2: { id: 27, pal: 2, x: 867, y: 0, w: 21, h: 24, ax: 11, ay: 8 },
  d32p0: { id: 32, pal: 0, x: 889, y: 0, w: 22, h: 24, ax: 12, ay: 8 },
  d32p2: { id: 32, pal: 2, x: 912, y: 0, w: 22, h: 24, ax: 12, ay: 8 },
  pod34p2: { id: 34, pal: 2, x: 935, y: 0, w: 47, h: 48, ax: 0, ay: 27 },
  pod34p3: { id: 34, pal: 3, x: 983, y: 0, w: 47, h: 48, ax: 0, ay: 27 },
  dr28p3: { id: 28, pal: 3, x: 1031, y: 0, w: 24, h: 16, ax: 4, ay: 0 },
  dr29p3: { id: 29, pal: 3, x: 1056, y: 0, w: 29, h: 23, ax: 7, ay: 2 },
  dr30p3: { id: 30, pal: 3, x: 1086, y: 0, w: 26, h: 16, ax: 4, ay: 1 },
  dr31p3: { id: 31, pal: 3, x: 1113, y: 0, w: 26, h: 16, ax: 4, ay: 0 },
  ab81p0: { id: 81, pal: 0, x: 1140, y: 0, w: 51, h: 66, ax: 20, ay: 54 },
  ab77p0: { id: 77, pal: 0, x: 1192, y: 0, w: 51, h: 66, ax: 20, ay: 54 },
  ab78p0: { id: 78, pal: 0, x: 1244, y: 0, w: 50, h: 61, ax: 19, ay: 47 },
  ab82p0: { id: 82, pal: 0, x: 1295, y: 0, w: 31, h: 80, ax: 17, ay: 36 },
  ab159p0: { id: 159, pal: 0, x: 1327, y: 0, w: 42, h: 56, ax: 20, ay: 37 },
  ab160p0: { id: 160, pal: 0, x: 1370, y: 0, w: 39, h: 56, ax: 21, ay: 38 },
};

// Анимации: имена кадров — БАЗОВЫЕ (без суффикса pN);
// Enemy подставляет свою палитру: кадр = f + 'p' + pal.
export const ANIMS = {
  robotIdle: { loop: true, frames: [{ f: "r16", ticks: 999 }] },
  robotWalk: { loop: true, frames: [{ f: "r17", ticks: 12 }, { f: "r16", ticks: 12 }] },
  robotSpawn: { loop: false, frames: [{ f: "r22", ticks: 16 }, { f: "r17", ticks: 12 }, { f: "r16", ticks: 12 }] },
  robotAttack: { loop: false, frames: [{ f: "r18", ticks: 24 }, { f: "r19", ticks: 8 }, { f: "r19", ticks: 24 }] },
  robotHurt: { loop: false, frames: [{ f: "r20", ticks: 10 }, { f: "r21", ticks: 10 }, { f: "r20", ticks: 25 }] },
  robotKO: { loop: false, frames: [{ f: "r21", ticks: 8 }, { f: "r24", ticks: 999 }] },
  domeWalk: { loop: true, frames: [{ f: "d26", ticks: 12 }, { f: "d27", ticks: 12 }] },
  domeAttack: { loop: false, frames: [{ f: "d27", ticks: 12 }, { f: "d32", ticks: 16 }, { f: "d26", ticks: 12 }] },
  domeHurt: { loop: false, frames: [{ f: "d26", ticks: 20 }] },
  domeKO: { loop: false, frames: [{ f: "d26", ticks: 999 }] },
  podFly: { loop: true, frames: [{ f: "pod34", ticks: 999 }] },
  droneFly: { loop: true, frames: [{ f: "dr28", ticks: 8 }, { f: "dr29", ticks: 8 }, { f: "dr30", ticks: 8 }, { f: "dr29", ticks: 8 }] },
  droneTelegraph: { loop: true, frames: [{ f: "dr29", ticks: 6 }, { f: "dr30", ticks: 6 }] },
  droneDive: { loop: true, frames: [{ f: "dr31", ticks: 999 }] },
  aboboIdle: { loop: true, frames: [{ f: "ab81", ticks: 999 }] },
  aboboWalk: { loop: true, frames: [{ f: "ab77", ticks: 12 }, { f: "ab78", ticks: 12 }] },
  aboboEnter: { loop: true, frames: [{ f: "ab82", ticks: 999 }] },
  aboboAttack: { loop: false, frames: [{ f: "ab81", ticks: 16 }, { f: "ab78", ticks: 12 }, { f: "ab81", ticks: 20 }] },
  aboboHurt: { loop: false, frames: [{ f: "ab159", ticks: 24 }] },
  aboboKO: { loop: false, frames: [{ f: "ab160", ticks: 999 }] },
};

// Боевая геометрия (docs/collision.md §6-7, таблица $88B8,
// спаун-флаги |$0F → HP $1F=31; адаптации — в комментариях
// генератора tools/enemies_export.py: урон робота по игроку
// 8 вместо 16 (ряд id 115), окно комбо/стан сокращены).
// C-22: босс ABOBO — кадры ab* с оверлеем босс-тайлов
// ($83C1[4] → PPU $0400, 136 тайлов из $946B слота 5;
// в оригинале грузятся при спауне босса), палитра s6pal 12.
export const COMBAT = {
  "robot": {
    "hp": 31,
    "speedX": 85,
    "speedD": 50,
    "attackRangeX": 30,
    "attackRangeD": 10,
    "hitX": 34,
    "hitD": 8,
    "dmg": 8,
    "playerStunTicks": 60,
    "windupTicks": 24,
    "hitFrom": 24,
    "hitTo": 32,
    "totalTicks": 60,
    "cooldownTicks": 45,
    "hurtTicks": 45,
    "knockback": 120,
    "score": 200
  },
  "dome": {
    "hp": 31,
    "speedX": 50,
    "speedD": 32,
    "attackRangeX": 24,
    "attackRangeD": 10,
    "hitX": 26,
    "hitD": 8,
    "dmg": 8,
    "playerStunTicks": 60,
    "windupTicks": 12,
    "hitFrom": 12,
    "hitTo": 28,
    "totalTicks": 40,
    "cooldownTicks": 50,
    "hurtTicks": 30,
    "knockback": 100,
    "score": 200
  },
  "drone": {
    "dmg": 8,
    "speedX": 110,
    "hittable": false,
    "ventOffsetX": 28,
    "ventOffsetD": 4,
    "pocketDistX": 82,
    "enterSpeed": 160,
    "hoverH": 56,
    "patrolSpeed": 60,
    "triggerX": 32,
    "telegraphRise": 44,
    "telegraphTicks": 20,
    "diveTicks": 16,
    "returnSpeed": 120,
    "cooldownTicks": 48
  },
  "pod": {
    "hittable": false
  },
  "abobo": {
    "hp": 155,
    "speedX": 55,
    "speedD": 35,
    "attackRangeX": 48,
    "attackRangeD": 12,
    "hitX": 56,
    "hitD": 10,
    "dmg": 10,
    "playerStunTicks": 60,
    "windupTicks": 16,
    "hitFrom": 16,
    "hitTo": 28,
    "totalTicks": 48,
    "cooldownTicks": 90,
    "hurtTicks": 24,
    "knockback": 40,
    "poise": 4,
    "score": 1000,
    "boss": true
  },
  "playerPunch": {
    "dmg": 4,
    "stunTicks": 63,
    "knockback": 45
  },
  "playerRam": {
    "dmg": 16,
    "stunTicks": 120,
    "knockback": 225
  },
  "playerFist": {
    "dmg": 255,
    "stunTicks": 64,
    "knockback": 260
  },
  "playerBoot": {
    "dmg": 255,
    "stunTicks": 64,
    "knockback": 260
  },
  "playerHp": 47,
  "playerIFrames": 60,
  "hpBarThresholds": [
    1,
    9,
    17,
    25,
    33,
    41
  ]
};
