// sprites.js — ленивая загрузка спрайт-листов игрока (C-13) и врагов (C-15).
//
// Логика игры НЕ зависит от картинок: Player.render/Enemy.render рисуют
// спрайт, только если лист загружен (playerSheet()/enemySheet() !== null);
// иначе — фигурный рендер C-07 (фолбэк). В среде без Image (node-тесты)
// загрузка не стартует вообще — там всегда работает фолбэк, поэтому старые
// смоуки не требуют моков Image/drawImage.

import { SPRITE_URL } from "./playerframes.js";
import { SPRITE_URL as ENEMY_URL } from "./enemyframes.js";

let sheet = null;    // Image листа игрока; null, пока не загружен (или ошибка)
let started = false; // загрузка запускается один раз
let esheet = null;   // Image листа врагов (C-15)
let estarted = false;

// Запустить загрузку листа игрока (вызывается из boot() main.js).
// Повторы — no-op. Ошибка загрузки не фатальна: остаётся фигурный фолбэк.
export function preloadPlayerSprites() {
  if (started) return;
  started = true;
  if (typeof Image === "undefined") return; // не-браузер (тесты) — фолбэк
  const img = new Image();
  img.onload = () => {
    sheet = img;
  };
  img.onerror = () => {
    sheet = null; // листа нет — игра живёт на фигурном рендере
  };
  img.src = SPRITE_URL;
}

// Лист игрока, если загружен; иначе null.
export function playerSheet() {
  return sheet;
}

// Запустить загрузку листа врагов (C-15, boot() main.js). Повторы — no-op.
export function preloadEnemySprites() {
  if (estarted) return;
  estarted = true;
  if (typeof Image === "undefined") return;
  const img = new Image();
  img.onload = () => {
    esheet = img;
  };
  img.onerror = () => {
    esheet = null; // фолбэк-фигуры врагов (Enemy.renderFigure)
  };
  img.src = ENEMY_URL;
}

// Лист врагов, если загружен; иначе null.
export function enemySheet() {
  return esheet;
}
