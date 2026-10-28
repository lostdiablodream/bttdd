// input.js — состояние игровых клавиш (C-01; гард ввода — C-02; touch — C-08;
// атака — C-13; ось глубины — C-14).
// Стрелки/A-D — движение влево/вправо, W/S/стрелки вверх/вниз — глубина
// (вглубь/из глубины палубы, C-14), Space — прыжок, J/X — удар (клавиатура);
// экранные кнопки ◀/▶/▲/▼/A/B — то же самое с тача (C-08/C-13/C-14).
// ВАЖНО (C-14): W/ArrowUp БОЛЬШЕ НЕ прыжок — в оригинале ↑/↓ = ходьба по
// глубине, прыжок только на A (docs/player-physics.md §3); псевдо-3D
// важнее алиаса «Space/W» из первичного задания (решение пользователя).
// preventDefault — только для игровых клавиш и только когда событие пришло
// не из элемента ввода: страница не прокручивается во время игры, но
// F12/Ctrl+R и ввод вне игры (поля, кнопки) не ломаются. Слушатели на window
// срабатывают, только когда страница с игрой в фокусе.
//
// Два независимых слоя ввода: клавиатура (keys) и экранные кнопки (touch).
// getInput() возвращает их логическое OR — живой объект state, который
// пересчитывается на каждое событие любого слоя. Отдельные слои нужны,
// чтобы keyup клавиши не «отпускал» удерживаемую тач-кнопку и наоборот
// (клавиатура + палец одновременно — штатная ситуация на гибридах).

const keys = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  attack: false,
};

const touch = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  attack: false,
};

// Объединённое состояние (OR слоёв). Именно этот объект отдаёт getInput() —
// он живой: поля перезаписываются syncCombined() при каждом событии ввода.
const state = {
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  attack: false,
};

function syncCombined() {
  state.left = keys.left || touch.left;
  state.right = keys.right || touch.right;
  state.up = keys.up || touch.up;
  state.down = keys.down || touch.down;
  state.jump = keys.jump || touch.jump;
  state.attack = keys.attack || touch.attack;
}

const KEY_MAP = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "up",    // C-14: вглубь палубы (НЕ прыжок — см. шапку)
  KeyW: "up",
  ArrowDown: "down", // C-14: из глубины, к ближней кромке
  KeyS: "down",
  Space: "jump",   // прыжок = только Space (кнопка A оригинала)
  KeyJ: "attack", // кнопка B оригинала (удар) — C-13
  KeyX: "attack", // альтернативная раскладка
};

// Элемент, чей нативный ввод трогать нельзя (текстовые поля, кнопки и т.п.)
function isNativeInputTarget(el) {
  if (!el || !el.tagName) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.tagName === "BUTTON" ||
    el.isContentEditable === true
  );
}

function onKeyDown(event) {
  const action = KEY_MAP[event.code];
  if (!action) return; // неигровые клавиши (F12, Ctrl+R, ...) — мимо
  if (isNativeInputTarget(event.target)) return; // ввод вне игры не перехватываем
  keys[action] = true;
  syncCombined();
  event.preventDefault(); // страница не прокручивается от стрелок/Space
}

function onKeyUp(event) {
  const action = KEY_MAP[event.code];
  if (!action) return;
  // Состояние отпускания фиксируем всегда (иначе клавиша «залипнет»,
  // если keydown пришёлся на игру, а keyup — на элемент ввода).
  keys[action] = false;
  syncCombined();
}

// Подключить слушатели клавиатуры (вызывается один раз из main.js).
export function initInput() {
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
}

// --- Экранные кнопки (C-08; ▲/▼ глубины — C-14) ---
// Удержание: pointerdown → действие нажато, pointerup/pointercancel/
// pointerleave → отпущено. Мультитач работает сам собой: у каждой кнопки
// своё действие, слои независимы. Прыжок по фронту обеспечивает Player
// (jumpHeld): пока палец держит кнопку, input.jump непрерывно true, и
// повторного прыжка в воздухе нет — ровно как у зажатого Space.
// pointerleave = «палец уехал с кнопки» → отпускаем; pointer capture
// специально НЕ используем, чтобы это правило сохранялось.

const TOUCH_ACTIONS = new Set(["left", "right", "up", "down", "jump", "attack"]);

function prevent(event) {
  if (event && typeof event.preventDefault === "function") event.preventDefault();
}

// Повесить touch-обработчики на одну кнопку. null/неизвестное действие —
// no-op (страница без кнопок, например тесты, — просто без touch-UI).
export function bindTouchButton(el, action) {
  if (!el || !TOUCH_ACTIONS.has(action)) return;
  const press = (event) => {
    prevent(event); // не даём всплыть эмуляции мыши/фокусу
    touch[action] = true;
    syncCombined();
  };
  const release = (event) => {
    prevent(event);
    touch[action] = false;
    syncCombined();
  };
  el.addEventListener("pointerdown", press);
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("pointerleave", release);
  // На touchstart — только preventDefault (без установки состояния: его
  // даёт pointerdown, а двойная установка безвредна, но не нужна). Так
  // гасятся двойной тап-зум и синтетический click на старых браузерах.
  // passive: false — иначе preventDefault проигнорируется.
  el.addEventListener("touchstart", prevent, { passive: false });
  // Долгое удержание на Android не должно открывать контекстное меню.
  el.addEventListener("contextmenu", prevent);
}

// Подключить экранные кнопки разом (вызывается один раз из main.js).
export function initTouchControls(buttons) {
  if (!buttons) return;
  bindTouchButton(buttons.left, "left");
  bindTouchButton(buttons.right, "right");
  bindTouchButton(buttons.up, "up");     // ▲ вглубь — C-14
  bindTouchButton(buttons.down, "down"); // ▼ из глубины — C-14
  bindTouchButton(buttons.jump, "jump");
  bindTouchButton(buttons.attack, "attack"); // кнопка «B» — C-13
}

// Сбросить все нажатия обоих слоёв (пауза/смена вкладки — C-04; чистит
// и залипший палец на тач-кнопке — C-08).
export function clearInput() {
  keys.left = false;
  keys.right = false;
  keys.up = false;
  keys.down = false;
  keys.jump = false;
  keys.attack = false;
  touch.left = false;
  touch.right = false;
  touch.up = false;
  touch.down = false;
  touch.jump = false;
  touch.attack = false;
  syncCombined();
}

// Опрос текущего состояния клавиш (OR клавиатуры и экранных кнопок).
export function getInput() {
  return state;
}
