// Player — жаба Rash: ходьба, прыжок, гравитация (C-02; опора — C-03),
// бой по оригиналу (C-20: джеб стоя anim 2/4, авто-добивания кулак/ботинок
// anim 14/20, дэш по двойному тапу и таран anim 22), ось глубины (C-14) и
// рендер настоящими спрайтами из ROM (C-13).
// Физические константы взяты из реверса оригинала (docs/player-physics.md,
// пересчёт из покадровых значений NES при 60 fps, 1 px/кадр = 60 px/с):
//   ходьба: кап 2.0 px/кадр = 120 px/с (Rash), разгон +$0A/кадр ≈ 562 px/с²,
//   трение −4/кадр ≈ 225 px/с², скид при развороте −8/кадр ≈ 450 px/с²;
//   прыжок: v0 = 5.0 px/кадр = 300 px/с (команда F8 анимации),
//   гравитация 0.3125 px/кадр² = 1125 px/с², макс. падение 4.0 px/кадр = 240 px/с.
// Дуга прыжка: апогей ≈ 40 px, полёт ≈ 0.53 с — как в оригинале.
// ГЛУБИНА (C-14, docs/player-physics.md §1/§4, docs/collision.md §3):
// у игрока есть координата depth (D, px ROM; в оригинале $040D:$041C).
// Вверх по экрану = вглубь палубы (меньше D), вниз = к ближней кромке
// (больше D). Кап скорости глубины 1.0 px/кадр = 60 px/с (вдвое медленнее
// бокового хода — кап $40 «глубина» в docs/player-physics.md §4), разгон/
// трение — как по X. Кламп в кромки палубы делает Game (границы зависят
// от X — ломаные depthFar/depthNear уровня); экранный сдвиг от глубины
// применяется к линии пола/платформ в collision.js (depthOffset).
// В прыжке движение по глубине работает (как и по X). Прыжок — только
// Space (кнопка A оригинала); W/↑/↓ отданы глубине (см. input.js).
// ДЭШ (C-20, docs/combat.md §4а): двойной тап ←/→ в окне 14 кадров
// (0.233 с) на земле → рывок 3.0 px/кадр = 180 px/с, пока держат
// направление; конец — отпускание/↑/↓/прыжок/удар/урон (оригинал:
// $04A3|$10, $0566:=$C0, конец через $9D6F с капом до 120 px/с).
// БОЙ (C-20, docs/combat.md): удар (кнопка B оригинала) стоя = джеб
// anim 2/4 (52 тика, удар на тике 4, ряд 0: урон 4/стан 63); повторное
// нажатие с тика 20 (флаг цепочки E6 скрипта) — следующий удар сразу,
// рука чередуется. Выбор приёма при нажатии — Game (attackChooser):
// джеб добил бы цель (HP ≤ 4) → авто-добивание: гигантский кулак (anim 14)
// по стоящей или гигантский ботинок (anim 20) по лежачей/нижней; в дэше
// B = таран (anim 22, ряд 20: урон 16). Во время удара ходовой ввод
// (включая глубину) и прыжок игнорируются ($B855: при $04FD≠0 хвост
// хендлера пропускается); таран держит инерцию дэша с трением.
// Жёсткой «земли» нет (C-03): опора вычисляется столкновениями — Game после
// player.update вызывает resolvePlayerPlatforms (односторонние платформы) и
// resolvePlayerTerrain (высотное поле пола профиля $B46B, C-11; сдвинутое
// на перспективу глубины, C-14). Player лишь сохраняет позицию начала кадра
// (prevX/prevY) для анти-туннелирования и знает стартовую точку для
// рестарта (C-06); падение за нижний край мира (C-05) = поражение, а не
// возврат на старт.
//
// Рендер (C-13): спрайты из ROM (assets/player/rash.png + манифест
// playerframes.js от tools/sprites_export.py). Анимационный автомат:
// idle/run/jump/land + бой C-20 (attackL/attackR/fist/boot/ram)/hurt/ko/win
// с оригинальными таймингами кадров в тиках 60 Гц (1 шаг скрипта анимации
// = 4 тика; боевые — из скриптов ROM, docs/combat.md). Кадр ставится
// якорем метаспрайта над центром хитбокса по X и низом кадра на линию
// ступней по Y («ноги к полу»), зеркалирование по facing через scale(-1,1).
// C-14: на спрайт/фигуру дополнительно множится depthScale (лёгкое
// уменьшение на дальней кромке палубы — перспектива; выставляет Game из
// границ уровня, по умолчанию 1).
// Пока лист не загружен (или среды без Image — тесты) — прежний фигурный
// рендер C-07 (renderFigure): логика игры от картинок не зависит.

import { PAL, fillCircle, polyPath } from "./theme.js";
import { FRAMES, ANIMS, ATTACK, FIST, BOOT, RAM } from "./playerframes.js";
import { COMBAT } from "./enemyframes.js";
import { playerSheet } from "./sprites.js";

export const PHYSICS = {
  WALK_SPEED: 120,   // px/с (максимум горизонтальной скорости)
  DASH_SPEED: 180,   // px/с (дэш: $0566:=$C0 = 3.0 px/кадр, C-20)
  ACCEL: 562,        // px/с² (разгон при удержании направления)
  FRICTION: 225,     // px/с² (трение на земле без ввода)
  TURN_DECEL: 450,   // px/с² (добавка к разгону при развороте)
  JUMP_SPEED: 300,   // px/с (начальная вертикальная скорость)
  GRAVITY: 1125,     // px/с²
  MAX_FALL: 240,     // px/с (предел скорости падения)
  DEPTH_SPEED: 60,   // px/с (кап скорости по глубине — 1 px/кадр, C-14)
};

const TICKS_PER_SEC = 60; // кадр оригинала = 1/60 с (NTSC)
const RUN_MIN_SPEED = 12; // порог «бежит» для выбора анимации (как в C-07)
const DASH_TAP_WINDOW = 14 / 60; // окно двойного тапа: 14 кадров ≈ 0.233 с

// Спецификации ударов по виду действия (action.kind).
const ATTACK_SPECS = { attack: ATTACK, fist: FIST, boot: BOOT, ram: RAM };

// Скорость рывка (px/с) по таблице фаз [[с_тика, px/с], ...] на тике tick.
function dashSpeed(spec, tick) {
  let v = 0;
  for (const [from, speed] of spec) {
    if (tick >= from) v = speed;
    else break;
  }
  return v;
}

// Кадр анимации на тике tick: линейный разбор списка {f, ticks};
// loop-анимации заворачиваются, one-shot прижимаются к последнему кадру.
function frameAt(anim, tick) {
  const frames = anim.frames;
  if (anim.loop) {
    let total = 0;
    for (const st of frames) total += st.ticks;
    tick = ((tick % total) + total) % total;
  }
  let acc = 0;
  for (const st of frames) {
    if (tick < acc + st.ticks) return st.f;
    acc += st.ticks;
  }
  return frames[frames.length - 1].f;
}

export class Player {
  constructor(x, y, worldWidth, depth) {
    this.x = x;
    this.y = y;
    this.startX = x; // стартовая точка — для respawn() при падении за экран
    this.startY = y;
    this.w = 32;            // жаба ~32×48 px (docs/player-physics.md)
    this.h = 48;
    this.vx = 0;
    this.vy = 0;
    // Глубина (C-14): координата D в px ROM (в оригинале $040D:$041C;
    // спаун игрока уровня 1 = 264). Кламп в кромки палубы — в Game.update.
    this.depth = depth === undefined ? 264 : depth;
    this.startDepth = this.depth;
    this.vd = 0;            // скорость по глубине (px/с, кап DEPTH_SPEED)
    this.depthScale = 1;    // перспективный масштаб спрайта (ставит Game)
    this.onGround = true; // дальше пересчитывается resolvePlayerPlatforms
    this.facing = 1;      // 1 = вправо, -1 = влево
    this.prevX = x;           // позиция в начале кадра (анти-туннелирование)
    this.prevY = y;
    this.worldWidth = worldWidth; // правый край мира (2304 px ROM — C-11)
    this.jumpHeld = false;      // прошлое состояние клавиши прыжка (фронт)
    this.animTime = 0;        // ход анимации бега, px пути (фолбэк-рендер C-07)

    // --- Анимационный автомат (C-13) ---
    // Действие (one-shot): null или {kind, tick, variant}; kind = 'attack'
    // (джеб, variant 'L'/'R' — anim 2/4) | 'fist' | 'boot' | 'ram' (C-20) |
    // 'hurt'. 'ko'/'win' — персистентные (снимаются только respawn()).
    this.action = null;
    this.attackHeld = false;   // прошлое состояние клавиши атаки (фронт)
    this.attackAlt = false;    // C-20: чередование руки джеба (в оригинале —
    // бит 1 RNG $2C,X: anim 2/4; в порту — детерминированное чередование)
    this.attackChooser = null; // C-20: хук Game → выбор приёма по цели
    this.animName = "idle";    // текущая анимация (ключ ANIMS)
    this.animClock = 0;        // тики внутри текущей анимации (дробные)
    this.landTicks = 0;        // остаток кадра посадки (визуально)

    // --- Дэш (C-20, docs/combat.md §4а) ---
    this.dashDir = 0;          // 0 — нет дэша; ±1 — направление рывка
    this.tapDir = 0;           // направление первого тапа (для двойного)
    this.tapTimer = 0;         // остаток окна двойного тапа, секунды
    this._prevLeft = false;    // прошлые состояния ←/→ (фронт тапа)
    this._prevRight = false;

    // --- Боевая часть (C-15) ---
    // HP — сегментная шкала оригинала: старт $2F=47 ($051B, спаун-запись
    // $20|$0F — collision.md эррата B-10 п.1); смерть при HP<0 ($87A0 заём).
    // invulnT — i-frames после урона (~1 с, мерцание; в оригинале объект с
    // $0575≠0 исключается из сканера целей $8B5F); powerT — неуязвимость от
    // предмета $2C (оригинал ~5.6 с: $05D1×(80−16)+16 кадров).
    this.hp = COMBAT.playerHp;
    this.invulnT = 0;         // секунды i-frames после урона
    this.powerT = 0;          // секунды неуязвимости от предмета
  }

  // Безопасный возврат на стартовую точку (C-03). С C-05 при падении
  // за экран НЕ вызывается — падение = поражение (Game.update);
  // метод остаётся для полного рестарта по кнопке «Заново» (C-06).
  respawn() {
    this.x = this.startX;
    this.y = this.startY;
    this.prevX = this.x;
    this.prevY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.depth = this.startDepth; // C-14: глубина тоже на стартовую
    this.vd = 0;
    this.depthScale = 1;
    this.onGround = true;
    this.jumpHeld = false;
    this.animTime = 0;
    this.action = null;
    this.attackHeld = false;
    this.attackAlt = false;
    this.animName = "idle";
    this.animClock = 0;
    this.landTicks = 0;
    this.dashDir = 0;   // C-20
    this.tapDir = 0;
    this.tapTimer = 0;
    this._prevLeft = false;
    this._prevRight = false;
    this.hp = COMBAT.playerHp; // C-15
    this.invulnT = 0;
    this.powerT = 0;
  }

  // --- Вход в особые состояния (C-13) ---

  // Урон (C-15): откидывание, ввод гасится; kbx — отброс по X (px/с) от
  // атакующего (таблица $88B8, поле +0). Во время hurt ввод заблокирован,
  // но отброс интегрируется (см. update).
  enterHurt(kbx) {
    if (this.action && (this.action.kind === "ko" || this.action.kind === "win")) {
      return; // KO/победу урон не перебивает
    }
    this.action = { kind: "hurt", tick: 0 };
    this._endDash(); // C-20: урон сбивает дэш (как старт анимации — $D266)
    this.vx = kbx || 0;
    this.vd = 0; // C-14
  }

  // Урон от врага (C-15): dmg — HP-урон (поле +3 записи $88B8), fromX —
  // центр атакующего (направление отброса). Не действует во время i-frames/
  // неуязвимости-предмета ($0575≠0 исключает из сканера целей) и при KO/win.
  // Возвращает 'ko' (HP<0 → нокаут, заём $87A0) | 'hurt' | null.
  takeDamage(dmg, fromX) {
    if (this.action && (this.action.kind === "ko" || this.action.kind === "win")) {
      return null;
    }
    if (this.invulnT > 0 || this.powerT > 0) return null;
    this.hp -= dmg;
    if (this.hp < 0) {
      this.enterKo();
      return "ko";
    }
    this.invulnT = COMBAT.playerIFrames / 60; // ~1 с i-frames
    const dir = this.x + this.w / 2 >= fromX ? 1 : -1;
    this.enterHurt(dir * 120);
    return "hurt";
  }

  // Нокаут (Game ставит при поражении — разлом/падение; C-15 — HP<0 в бою):
  // поза полёта. Позиция не двигается: мир в 'lost' заморожен (Game.update
  // не зовёт нас), кадры крутит updateEndAnim().
  enterKo() {
    this.action = { kind: "ko", tick: 0 };
    this.invulnT = 0; // KO-экран не мерцает
  }

  // Победная поза (Game ставит при 'won'): руки вверх, зациклено.
  enterWin() {
    this.action = { kind: "win", tick: 0 };
  }

  // Тик анимаций KO/победы на экранах результата: Game в 'won'/'lost'
  // не вызывает update() (мир заморожен), но поза должна жить.
  // Трогает ТОЛЬКО счётчик кадров — координаты/физика не меняются.
  updateEndAnim(dt) {
    if (this.action && (this.action.kind === "ko" || this.action.kind === "win")) {
      this.action.tick += dt * TICKS_PER_SEC;
    }
  }

  // Хитбокс активной фазы удара в мировых координатах (для C-15) или null.
  // Rect перед игроком (учитывает facing), данные — из playerframes.js
  // (C-20: ATTACK/FIST/BOOT/RAM по виду действия).
  getAttackHitbox() {
    if (!this.action) return null;
    const spec = ATTACK_SPECS[this.action.kind] || null;
    if (!spec) return null;
    const [a0, a1] = spec.active;
    if (this.action.tick < a0 || this.action.tick >= a1) return null;
    const hb = spec.hitbox;
    const x = this.facing > 0
      ? this.x + hb.dx
      : this.x + this.w - hb.dx - hb.w;
    return { x, y: this.y + hb.dy, w: hb.w, h: hb.h };
  }

  // Текущее имя кадра спрайта (для рендера и тестов).
  currentFrame() {
    if (this.action) {
      // C-20: у джеба два варианта руки (anim 2/4) — action.variant
      const key = this.action.kind === "attack"
        ? (this.action.variant === "R" ? "attackR" : "attackL")
        : this.action.kind;
      return frameAt(ANIMS[key], this.action.tick);
    }
    return frameAt(ANIMS[this.animName], this.animClock);
  }

  // Выбор анимации по состоянию (действия обслуживает action).
  _resolveAnim() {
    if (this.action) return this.action.kind;
    if (!this.onGround) return "jump";
    // C-14: движение по глубине — тоже бег (ходьба вглубь/из глубины)
    if (Math.abs(this.vx) > RUN_MIN_SPEED ||
        Math.abs(this.vd) > RUN_MIN_SPEED) return "run";
    if (this.landTicks > 0) return "land";
    return "idle";
  }

  _advanceAnim(dt) {
    const name = this._resolveAnim();
    if (name !== this.animName) {
      this.animName = name;
      this.animClock = 0;
    } else {
      // C-20: в дэше шаг бега вдвое чаще (оригинал: $03E0 += 4/кадр при
      // $04A3&$10 — таблица $8A55 идёт по 1 тику вместо 2)
      const rate = this.dashDir !== 0 && name === "run" ? 2 : 1;
      this.animClock += dt * TICKS_PER_SEC * rate;
    }
  }

  update(dt, input) {
    input = input || { left: false, right: false, up: false, down: false, jump: false, attack: false };

    // Таймеры боевой части (C-15): i-frames и неуязвимость-предмет тикают
    // во всех состояниях бега
    if (this.invulnT > 0) this.invulnT -= dt;
    if (this.powerT > 0) this.powerT -= dt;

    // Позиция начала кадра — resolvePlayerPlatforms решает по ней,
    // с какой стороны игрок подошёл к платформе
    this.prevX = this.x;
    this.prevY = this.y;

    const ticks = dt * TICKS_PER_SEC;

    // --- Действия: удары/урон (C-13/C-20) ---
    // KO/win сюда не доходят (мир заморожен; их тикает updateEndAnim).
    if (this.action && (this.action.kind === "attack" ||
        this.action.kind === "fist" || this.action.kind === "boot" ||
        this.action.kind === "ram" || this.action.kind === "hurt")) {
      const spec = ATTACK_SPECS[this.action.kind] || null;
      this.action.tick += ticks;

      if (spec) {
        if (this.action.kind === "ram") {
          // Таран (C-20): инерция дэша гасится трением (старт анимации снял
          // флаг дэша $D266, скорость $0566=$C0 осталась и затухает −4/кадр
          // — docs/combat.md §4б); ходовой ввод игнорируется
          const dec = PHYSICS.FRICTION * dt;
          if (this.vx > 0) this.vx = Math.max(0, this.vx - dec);
          else if (this.vx < 0) this.vx = Math.min(0, this.vx + dec);
          this.x += this.vx * dt;
        } else {
          // Рывок вперёд по фазам скрипта (команды E0, docs/combat.md);
          // ходовой ввод и прыжок во время удара игнорируются.
          this.vx = this.facing * dashSpeed(spec.dash, this.action.tick);
          this.x += this.vx * dt;
        }
        // Серия (C-20): у джеба с тика chainFrom (команда E6 скрипта →
        // $04A3|$04 — флаг цепочки) повторное нажатие начинает следующий
        // удар немедленно; выбор приёма — заново (удар, добивающий цель,
        // станет добиванием кулаком/ботинком — правило $B529)
        let chained = false;
        if (this.action.kind === "attack" &&
            this.action.tick >= ATTACK.chainFrom &&
            input.attack && !this.attackHeld && this.onGround) {
          this._startAttackChosen();
          chained = true;
        }
        if (!chained && this.action.tick >= spec.ticks) {
          this.action = null;
        }
      } else {
        // hurt (C-15): ввод заблокирован; отброс по X интегрируется с
        // затуханием (поле +0 записи $88B8 задаёт скорость отброса цели)
        this.x += this.vx * dt;
        const kbDec = 480 * dt;
        if (this.vx > 0) this.vx = Math.max(0, this.vx - kbDec);
        else if (this.vx < 0) this.vx = Math.min(0, this.vx + kbDec);
        if (this.action.tick >= ANIMS.hurt.frames[0].ticks) {
          this.action = null;
          this.vx = 0;
        }
      }

      // Края мира — как при обычном движении
      if (this.x < 0) {
        this.x = 0;
        if (this.vx < 0) this.vx = 0;
      }
      const maxXAct = this.worldWidth - this.w;
      if (this.x > maxXAct) {
        this.x = maxXAct;
        if (this.vx > 0) this.vx = 0;
      }

      this.attackHeld = !!input.attack;
      this.jumpHeld = !!input.jump; // прыжок не «накопится» за время удара
      // C-20: удержания ←/→ трекаем и во время действия — отпущенный за
      // действие тап не даст ложного «второго тапа» после его конца
      this._prevLeft = !!input.left;
      this._prevRight = !!input.right;
      this._wasAir = !this.onGround; // трекинг посадки — как в обычной ветке

      // Гравитация работает и во время действия (рывок с края → падение)
      this.vy += PHYSICS.GRAVITY * dt;
      if (this.vy > PHYSICS.MAX_FALL) this.vy = PHYSICS.MAX_FALL;
      this.y += this.vy * dt;

      this._advanceAnim(dt);
      return;
    }

    if (this.landTicks > 0) this.landTicks -= ticks;

    // Посадка: 4 тика (чисто визуально; переход воздух→опора — onGround
    // выставил collision прошлого кадра). C-19: кадр посадки = f45 (как и
    // весь прыжок) — в оригинале F7 сажает при живом кадре 45, который
    // держится ещё 1 шаг скрипта (4 тика) до конца анимации.
    if (this._wasAir && this.onGround) this.landTicks = ANIMS.land.frames[0].ticks;
    this._wasAir = !this.onGround;

    // --- Дэш (C-20): двойной тап ←/→ в окне 14 кадров (0.233 с) на земле ---
    // Фронты направлений (двойной тап считается по фронтам, как $32,X)
    const leftFront = input.left && !this._prevLeft;
    const rightFront = input.right && !this._prevRight;
    this._prevLeft = !!input.left;
    this._prevRight = !!input.right;
    if (this.tapTimer > 0) this.tapTimer -= dt;
    if (leftFront) this._tapDirection(-1);
    if (rightFront) this._tapDirection(1);

    // --- Горизонталь: разгон/трение, кап скорости ходьбы / дэш 180 px/с ---
    let dir = 0;
    if (input.left && !input.right) dir = -1;
    else if (input.right && !input.left) dir = 1;

    if (this.dashDir !== 0) {
      // Дэш жив, пока держат его направление; отпускание / ↑ / ↓ /
      // противоположное направление — конец (оригинал $B62D-$B63F → $9D6F:
      // фронт любой кнопки A/B/↑/↓ или нет ←/→ в удержании → снять дэш)
      const heldDash = this.dashDir > 0 ? input.right : input.left;
      const opposite = this.dashDir > 0 ? input.left : input.right;
      if (!heldDash || input.up || input.down || opposite) {
        this._endDash();
      } else {
        this.facing = this.dashDir;
        this.vx = PHYSICS.DASH_SPEED * this.dashDir; // $0566 := $C0
      }
    }
    if (this.dashDir === 0) {
      if (dir !== 0) {
        this.facing = dir;
        let a = PHYSICS.ACCEL;
        if (this.vx * dir < 0) a += PHYSICS.TURN_DECEL; // скид при развороте
        this.vx += dir * a * dt;
        if (this.vx > PHYSICS.WALK_SPEED) this.vx = PHYSICS.WALK_SPEED;
        else if (this.vx < -PHYSICS.WALK_SPEED) this.vx = -PHYSICS.WALK_SPEED;
      } else if (this.onGround) {
        // Трение только на земле: в воздухе инерция сохраняется
        const dec = PHYSICS.FRICTION * dt;
        if (this.vx > 0) this.vx = Math.max(0, this.vx - dec);
        else if (this.vx < 0) this.vx = Math.min(0, this.vx + dec);
      }
    }
    this.x += this.vx * dt;

    // Края мира: за левый/правый край не выходить (стены уровня —
    // дополнительно в Game.update)
    if (this.x < 0) {
      this.x = 0;
      if (this.vx < 0) this.vx = 0;
    }
    const maxX = this.worldWidth - this.w;
    if (this.x > maxX) {
      this.x = maxX;
      if (this.vx > 0) this.vx = 0;
    }

    // Ход анимации бега фолбэка (C-07): копим пройденный путь на опоре —
    // фазы ног переключаются по пути, а не по кадрам (не зависит от fps).
    // C-14: шаги по глубине — тоже ходьба (анимация бега и вглубь палубы).
    if (this.onGround) {
      this.animTime += Math.max(Math.abs(this.vx), Math.abs(this.vd)) * dt;
    }

    // --- Глубина (C-14): ↑/W = вглубь палубы (меньше D), ↓/S = наружу ---
    // Разгон/трение/скид разворота — те же, что по X; кап — DEPTH_SPEED
    // (60 px/с = 1 px/кадр, кап $40 глубины в оригинале). В воздухе (прыжок)
    // управление глубиной сохраняется, трения нет — как по X.
    let ddir = 0;
    if (input.up && !input.down) ddir = -1;
    else if (input.down && !input.up) ddir = 1;
    if (ddir !== 0) {
      let a = PHYSICS.ACCEL;
      if (this.vd * ddir < 0) a += PHYSICS.TURN_DECEL; // скид при развороте
      this.vd += ddir * a * dt;
      if (this.vd > PHYSICS.DEPTH_SPEED) this.vd = PHYSICS.DEPTH_SPEED;
      else if (this.vd < -PHYSICS.DEPTH_SPEED) this.vd = -PHYSICS.DEPTH_SPEED;
    } else if (this.onGround) {
      const dec = PHYSICS.FRICTION * dt;
      if (this.vd > 0) this.vd = Math.max(0, this.vd - dec);
      else if (this.vd < 0) this.vd = Math.min(0, this.vd + dec);
    }
    this.depth += this.vd * dt;
    // Кламп depth в кромки палубы — в Game.update (границы зависят от X).

    // --- Прыжок: только с опоры и только по фронту клавиши ---
    // (в оригинале повторного прыжка в воздухе нет — docs/player-physics.md §3;
    // C-14: прыжок = только Space/тач-A, ↑/W отданы глубине — см. input.js)
    if (input.jump && !this.jumpHeld && this.onGround) {
      this.vy = -PHYSICS.JUMP_SPEED;
      this.onGround = false;
      this._endDash(); // C-20: прыжок отменяет дэш (фронт A — $B62D→$9D6F)
    }
    this.jumpHeld = !!input.jump;

    // --- Удар (B): только на земле, по фронту клавиши (C-13/C-20) ---
    // В дэше B = таран (anim 22); иначе приём выбирает Game.attackChooser
    // (джеб / добивание кулаком / ботинком по HP и позе цели — $B529).
    if (input.attack && !this.attackHeld && this.onGround) {
      if (this.dashDir !== 0) this._startRam();
      else this._startAttackChosen();
    }
    this.attackHeld = !!input.attack;

    // --- Вертикаль: гравитация с клампом падения ---
    // Опоры здесь больше нет: вертикаль разрешает resolvePlayerPlatforms
    // (collision.js) по прежнему/новому положению — см. Game.update.
    this.vy += PHYSICS.GRAVITY * dt;
    if (this.vy > PHYSICS.MAX_FALL) this.vy = PHYSICS.MAX_FALL;
    this.y += this.vy * dt;

    this._advanceAnim(dt);
  }

  // Тап ←/→ для двойного тапа дэша (C-20): второй тап того же направления
  // в окне 14 кадров на земле → дэш (оригинал: $03B2 := направление|$38,
  // −4/кадр; совпадение направления — $B653).
  _tapDirection(dir) {
    if (!this.onGround) return; // дэш — только с земли ($B66C: $0476≠0 → нет)
    if (this.tapDir === dir && this.tapTimer > 0) {
      this.dashDir = dir;
      this.tapDir = 0;
      this.tapTimer = 0;
    } else {
      this.tapDir = dir;
      this.tapTimer = DASH_TAP_WINDOW;
    }
  }

  // Конец дэша: скорость капается ходьбой ($9D6F: $0566 ≤ $80 = 120 px/с).
  _endDash() {
    if (this.dashDir === 0) return;
    this.dashDir = 0;
    if (this.vx > PHYSICS.WALK_SPEED) this.vx = PHYSICS.WALK_SPEED;
    else if (this.vx < -PHYSICS.WALK_SPEED) this.vx = -PHYSICS.WALK_SPEED;
  }

  // Таран дэша (C-20, anim 22): старт анимации снимает флаг дэша ($D266),
  // скорость $0566=$C0 (180 px/с) остаётся и гасится трением в ветке действия
  _startRam() {
    const dir = this.dashDir || this.facing;
    this.facing = dir;
    this.dashDir = 0;
    this.tapDir = 0;
    this.tapTimer = 0;
    this.vx = dir * PHYSICS.DASH_SPEED;
    this.vd = 0;
    this.action = { kind: "ram", tick: 0 };
  }

  // Выбор приёма по цели (C-20): Game.attackChooser(player) →
  // 'attack' | 'fist' | 'boot' (правило $B529: джеб добил бы → добивание)
  _startAttackChosen() {
    const kind = this.attackChooser ? this.attackChooser(this) : "attack";
    this._startAttack(kind);
  }

  _startAttack(kind) {
    this._endDash(); // старт анимации снимает дэш ($D266: $04A3 &= $EB)
    this.action = { kind, tick: 0 };
    if (kind === "attack") {
      // чередование руки (в оригинале — бит 1 RNG $2C,X: anim 2/4)
      this.action.variant = this.attackAlt ? "R" : "L";
      this.attackAlt = !this.attackAlt;
    }
    this.vx = 0;
    this.vd = 0; // C-14: во время удара ввод (включая глубину) заблокирован
  }

  // ======================= РЕНДЕР =======================

  render(ctx) {
    // i-frames после урона (C-15): мерцание — пропуск кадров (в оригинале
    // $05B7 — XOR x-позиции по кадру $0C); на экранах KO/win invulnT=0.
    if (this.invulnT > 0 && Math.floor(this.invulnT * 30) % 2 === 0) return;
    // Неуязвимость-предмет (C-15, кадр $2C оригинала): золотой ореол
    if (this.powerT > 0) {
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      const pulse = 0.22 + 0.12 * Math.sin(this.powerT * 10);
      ctx.fillStyle = `rgba(255, 216, 96, ${pulse})`;
      ctx.beginPath();
      const n = 10, rx = 22, ry = 30;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n;
        const px = cx + Math.cos(a) * rx, py = cy + Math.sin(a) * ry;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    const sheet = playerSheet();
    if (sheet && typeof ctx.drawImage === "function") {
      this.renderSprite(ctx, sheet);
      return;
    }
    this.renderFigure(ctx); // фолбэк C-07: фигуры, пока лист не загружен
  }

  // Спрайт из ROM (C-13): кадр листа rash.png. Якорь метаспрайта — над
  // центром хитбокса по X, низ кадра — на линии ступней (y+h). Зеркало
  // по facing через scale(-1,1). Без сглаживания — пиксельная чёткость
  // при проекции ×2.25. C-14: depthScale — лёгкое уменьшение на дальней
  // кромке палубы (перспектива; масштаб вокруг линии ступней — ноги
  // остаются на своей глубине).
  renderSprite(ctx, sheet) {
    const fr = FRAMES[this.currentFrame()];
    const s = this.depthScale || 1;
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h);
    ctx.scale(this.facing * s, s);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, fr.x, fr.y, fr.w, fr.h, -fr.ax, -fr.h, fr.w, fr.h);
    ctx.restore();
  }

  // Фолбэк-рендер фигурами (C-07): без изменений — работает до загрузки
  // листа и в средах без Image (тесты). Лёгкая «мультяшность»: наклон
  // при беге и растяжение в прыжке. Преобразования — вокруг центра низа
  // спрайта, ноги не отрываются от земли.
  renderFigure(ctx) {
    const runRatio = Math.max(-1, Math.min(1, this.vx / PHYSICS.WALK_SPEED));
    const scaleY = (this.onGround ? 1 : 1.08) * (this.depthScale || 1); // C-14
    const scaleX = (this.onGround ? 1 : 0.94) * (this.depthScale || 1);

    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h);
    ctx.rotate(runRatio * 0.07);
    ctx.scale(scaleX * this.facing, scaleY); // facing<0 отражает рисунок влево
    ctx.translate(-this.w / 2, -this.h);

    // --- Жаба Battletoads из фигур (C-07; силуэт — по кадрам play001/011/013,
    // зелень — s6frag №6 / set16, см. theme.js). Локальная рамка 32×48,
    // рисуем ВПРАВО, ноги на y=48. Порядок: дальняя нога → тело → пузо →
    // ближняя нога → голова (глаза-шишки, рот) → рука.
    const running = this.onGround &&
      Math.max(Math.abs(this.vx), Math.abs(this.vd)) > 12; // C-14: и глубина
    const air = !this.onGround;
    // 2 фазы бега по пройденному пути (~каждые 7 px — при 120 px/с ≈ 17 Гц)
    const phase = Math.floor(this.animTime / 7) % 2;

    const B = PAL.toadBody;      // тело
    const L = PAL.toadLight;     // свет (блик)
    const D = PAL.toadDark;      // контур/тень
    const LEG_BACK = "#2b7f39";  // дальняя нога — темнее

    // Кроссовки (белые, по спрайт-листу персонажей; дальняя — приглушена):
    // светлый мыc + тёмная подошва
    const shoe = (x, y, w, c) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, 4);
      ctx.fillStyle = D;
      ctx.fillRect(x, y + 3, w, 1);
    };

    // --- Дальняя нога ---
    ctx.fillStyle = LEG_BACK;
    if (air) {
      polyPath(ctx, [[6, 26], [13, 26], [10, 34], [3, 33]]); // бедро поджато
      ctx.fill();
      polyPath(ctx, [[2, 33], [11, 33], [12, 38], [4, 38]]); // ступня у тела
      ctx.fill();
      shoe(8, 34, 4, PAL.toadShoeDark);
    } else if (running && phase === 0) {
      polyPath(ctx, [[6, 28], [13, 28], [8, 38], [2, 36]]);  // оттянута назад
      ctx.fill();
      polyPath(ctx, [[0, 38], [8, 38], [10, 46], [9, 48], [0, 48]]); // толчковая ступня
      ctx.fill();
      shoe(5, 44, 5, PAL.toadShoeDark);
    } else if (running) {
      polyPath(ctx, [[6, 28], [13, 28], [12, 36], [6, 36]]); // собрана, в переносе
      ctx.fill();
      polyPath(ctx, [[4, 36], [12, 36], [13, 41], [12, 43], [3, 43], [2, 39]]); // приподнята
      ctx.fill();
      shoe(9, 39, 4, PAL.toadShoeDark);
    } else {
      polyPath(ctx, [[6, 28], [14, 28], [13, 40], [5, 40]]); // стойка
      ctx.fill();
      polyPath(ctx, [[2, 40], [13, 40], [15, 46], [15, 48], [1, 48], [0, 44]]); // ступня
      ctx.fill();
      shoe(10, 44, 5, PAL.toadShoeDark);
    }

    // --- Тело (торс, слитный с головой — жабий «клин») ---
    ctx.fillStyle = B;
    polyPath(ctx, [[8, 12], [22, 12], [26, 20], [25, 32], [22, 40], [9, 40], [5, 30], [5, 18]]);
    ctx.fill();
    // Морда: выступ вперёд (нос)
    polyPath(ctx, [[20, 8], [28, 10], [30, 15], [28, 19], [22, 18]]);
    ctx.fill();

    // Блик на спине
    ctx.fillStyle = L;
    polyPath(ctx, [[6, 17], [10, 12], [15, 13], [9, 20]]);
    ctx.fill();

    // Пузо (светлое, $3A из NES)
    ctx.fillStyle = PAL.toadBelly;
    polyPath(ctx, [[14, 22], [24, 22], [23, 38], [13, 38], [11, 28]]);
    ctx.fill();

    // Пятна на спине (тёмно-зелёные, как у жаб)
    ctx.fillStyle = D;
    ctx.fillRect(8, 22, 2, 2);
    ctx.fillRect(11, 27, 2, 2);
    ctx.fillRect(7, 32, 2, 2);

    // --- Ближняя нога ---
    ctx.fillStyle = B;
    if (air) {
      polyPath(ctx, [[18, 26], [26, 26], [29, 33], [22, 34]]);
      ctx.fill();
      polyPath(ctx, [[20, 33], [29, 33], [30, 38], [22, 38]]);
      ctx.fill();
      shoe(24, 34, 6, PAL.toadShoe);
    } else if (running && phase === 1) {
      polyPath(ctx, [[18, 28], [26, 28], [29, 38], [23, 40]]); // шаг вперёд
      ctx.fill();
      polyPath(ctx, [[22, 38], [31, 40], [32, 44], [32, 48], [22, 48]]); // опорная ступня
      ctx.fill();
      shoe(26, 44, 6, PAL.toadShoe);
    } else if (running) {
      polyPath(ctx, [[18, 28], [26, 28], [27, 40], [19, 40]]); // под собой
      ctx.fill();
      polyPath(ctx, [[17, 40], [28, 40], [31, 45], [30, 48], [18, 48], [16, 44]]);
      ctx.fill();
      shoe(24, 44, 7, PAL.toadShoe);
    } else {
      polyPath(ctx, [[18, 28], [26, 28], [27, 40], [19, 40]]); // стойка
      ctx.fill();
      polyPath(ctx, [[17, 40], [28, 40], [31, 45], [30, 48], [18, 48], [16, 44]]); // ступня
      ctx.fill();
      shoe(24, 44, 7, PAL.toadShoe);
    }
    // Тёмная подошва ближней ступни — «читабельность» опоры
    ctx.fillStyle = D;
    if (!air && (!running || phase === 0)) ctx.fillRect(18, 46, 12, 2);
    else if (!air) ctx.fillRect(22, 46, 10, 2);

    // --- Глаза-шишки на макушке (визитная черта жаб) ---
    const eyes = [[14, 6], [22, 5]];
    for (const [ex, ey] of eyes) {
      fillCircle(ctx, ex, ey, 4.4, D, 8);        // тёмный контур шишки
      fillCircle(ctx, ex, ey, 3.6, B, 8);        // зелёная шишка
      fillCircle(ctx, ex + 1.1, ey - 0.4, 2.2, PAL.toadEye, 8);  // белок к морде
      fillCircle(ctx, ex + 1.7, ey - 0.5, 1.0, PAL.toadPupil, 6); // зрачок по facing
    }

    // Рот — широкая жабья линия с усмешкой
    ctx.fillStyle = D;
    ctx.fillRect(21, 16, 8, 2);
    ctx.fillRect(28, 14, 2, 2);
    // Ноздря
    ctx.fillRect(27, 11, 2, 1);

    // --- Рука (ближняя): висит/машет при беге, поджата в прыжке ---
    const armDx = running ? (phase === 0 ? 2 : -2) : 0;
    const armDy = air ? -5 : 0;
    ctx.fillStyle = B;
    polyPath(ctx, [[22 + armDx, 21 + armDy], [26 + armDx, 21 + armDy],
      [27 + armDx, 30 + armDy], [23 + armDx, 31 + armDy]]);
    ctx.fill();
    fillCircle(ctx, 25 + armDx, 31 + armDy, 2.6, B, 8); // кулак
    ctx.fillStyle = D;
    ctx.fillRect(23 + armDx, 32 + armDy, 4, 1);         // ремешок-перчатка

    ctx.restore();
  }
}
