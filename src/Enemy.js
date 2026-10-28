// Enemy — враги уровня 1 «Хвост Крысолёта» (C-15): робот-бипед (тип $09),
// купол-робот (тип $0F), hover-pod-носитель (тип $10, десантирует робота),
// летучий дрон-серп (тип $0C; спаренный невидимый тип $0A слит с дроном).
//
// Данные: спаун-записи — level1data.js enemySpawns (поток $F6BB слота 3,
// генератор tools/level1_to_js.py); кадры/анимации/боевая геометрия —
// enemyframes.js (tools/enemies_export.py; идентификация кадров — шапка
// генератора и CHANGELOG C-15).
//
// Спаун по потоку (Game.updateEnemies): запись срабатывает, когда ПРАВЫЙ
// край экрана достигает триггер+256 — адаптация к вьюпорту 426 px (у NES
// 256 px): в оригинале объект появляется за правым краем экрана при скролле
// ≥ триггера (level-format §6). При переполнении лимита активных врагов
// поток ждёт (как аллокатор $FF20 оригинала).
//
// AI (минимальный оригинальный, по хендлерам $A5EE/$BCF5/$C11F/$FB13):
//   - робот: подход к игроку по X и глубине (speedX/speedD), в радиусе
//     (|ΔX|≤30, |ΔD|≤10) — удар с замахом (кадры 18→19, активное окно
//     24-32 тика), откат и кулдаун; разворот к игроку;
//   - купол: медленный подход, раскрытие купола (27→32) с коротким ударом;
//   - под: прилетает справа сверху, зависает над палубой у якоря, сбрасывает
//     робота (палитра дитя = pal пода XOR 1 — $C168/$C16D оригинала),
//     улетает; не бьётся и не ранит (класс 0 в $9BE0);
//   - дрон (C-17, модель из ROM $FB13/$FB49): привязан к окну вентиляции
//     (спаренная невидимая запись $0A потока, всегда на X−28/D−4 от записи
//     дрона); влёт справа к «карману» зависания (57-108 px левее вента),
//     патруль-зависание у якоря (~60 px/с, класс $60 таблицы $9056); когда
//     игрок входит в радиус 32 px от вента по X ($FD44→$8D5B) — телеграф:
//     подъём-«свечка» 20 тиков без горизонтального движения (счётчик $0566
//     $2C→$40), точка пике фиксируется В МОМЕНТ захвата; пике 16 тиков по
//     прямому зафиксированному вектору ($BFDB + 2×$BF6D), БЕЗ подруливания
//     — игрок может отойти; затем возврат к якорю и cooldown. Бьёт
//     контактом (урон 8); не бьётся ударами (класс 0 $9BE0). Посадка с
//     превращением в подбираемое оружие $0D НЕ портирована (нет системы
//     оружия) — вместо неё возврат/повторные атаки (документированное
//     упрощение C-15 дополнено).
//
// Получение урона (удар игрока, docs/collision.md §7; числа — C-20,
// docs/combat.md §5): hurt (стан по ряду $88B8 удара + отброс) —
// жонглирование станом разрешено (сканер $8B5F исключает только $0575≠0,
// т.е. KO/i-frame); KO при HP<0 ($87A0: заём) — отлёт с дугой, лёжа
// (кадры 24/25 робота — $A71E[13/14]), мерцание, деспаун (~1.7 с; у
// оригинала труп лежит ~64 кадра, $0575 $C0→$80). Добивания игрока
// (кулак/ботинок, урон $FF) — мгновенный KO с большим отлётом; лежачее
// тело (состояние «лёжа», kickable) добивается ботинком повторно —
// отлетает без очков (applyBootKick). Очки +200 за KO — ОТСТУПЛЕНИЕ от
// оригинала (там начислений за убийства нет, game-rules §2); помечено
// в COMBAT.score.
//
// Дроп из трупов: в уровне 1 его НЕТ — дроп дают трупы типов 8/$56 и
// носители 5/$34 (game-rules §1.3), которых в потоке уровня 1 нет; труп
// робота типа $09 просто деспаунится ($A3F8 → $EE43 + продвижение потока).
//
// Разлом палубы: шагающий враг не заходит в провал (стоп у края — в
// оригинале провала в палубе уровня 1 нет, край палубы по глубине
// удерживает так же); отброшенный в KO враг в провал падает и гибнет
// (в оригинале враги срываются в ямы без задержки — collision.md §5).
//
// БОСС ABOBO (C-22, docs/game-rules.md доп. C-22): спавнится Game в конце
// уровня (триггер выхода $07B0 оригинала → у нас по позиции игрока).
// Отдельная ветка AI (_aboboAI): вход — сброс с неба на арену (кадр 82),
// «рык» (стойка 81), затем подход к игроку (медленнее робота) и удар
// (замах 81 → выпад 78, окно урона 16-28 тиков, дальность/урон выше
// робота). БРОНЯ БОССА: урон копится каждым ударом, но стан-шатание
// (кадр 159) только каждый poise-й удар — босс не жонглируется джебами
// и не отлетает; добивания кулаком/ботинком ($FF) работают как KO на
// HP<0 (авто-добивание игрока срабатывает при HP ≤ 4 — $B529). Во входе
// (enter/roar) не бьётся (в ROM тип $13 имеет класс $9BE0 = $00 — босс
// вне обычного сканера целей на части фаз). KO — оседание на месте с
// мерцанием (не улетает), далее Game выигрывает уровень.
//
// Рендер: спрайты из ROM (assets/enemies/enemies.png) с якорем метаспрайта
// над центром хитбокса и низом к линии ступней (как Player C-13), зеркало
// по facing, перспективный масштаб depthScale (Game); до загрузки листа и
// в тестах — фолбэк-фигуры (логика от картинок не зависит).

import { ANIMS, COMBAT, FRAMES } from "./enemyframes.js";
import { enemySheet } from "./sprites.js";
import { groundYAt } from "./collision.js";
import { depthShift } from "./level.js";
import { polyPath } from "./theme.js";

const TICKS_PER_SEC = 60;
const GRAVITY = 1125;   // px/с² — как у игрока (docs/player-physics.md)
const MAX_FALL = 300;

// Цвета фолбэк-фигур по подпалитрам уровня 1 (s6pal 12):
// 0 = зелень, 1 = красно-оранжевая, 2 = жёлто-белая, 3 = синяя
const PAL_COLORS = ["#3aa24a", "#d05028", "#d8b828", "#3868e8"];
const PAL_DARK = ["#1c5c26", "#782410", "#786810", "#1a34a0"];

// Габариты хитбоксов по видам (px ROM; спрайт шире хитбокса)
const BODY = {
  robot: { w: 20, h: 40 },
  dome: { w: 18, h: 24 },
  drone: { w: 22, h: 14 },
  pod: { w: 44, h: 22 },
  abobo: { w: 30, h: 64 }, // C-22: босс — крупнее ходоков (спрайт 51×66)
};

// Кадр анимации на тике (как у Player C-13): loop заворачивается,
// one-shot прижимается к последнему кадру.
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

export class Enemy {
  // spawn — запись enemySpawns {kind, trigger, x, depth, timer, pal};
  // opts.x/opts.y/opts.depth — переопределение позиции (под/дрон спавнятся
  // за правым краем экрана; дитя пода — на позиции пода).
  constructor(spawn, level, opts) {
    this.kind = spawn.kind;
    this.level = level;
    this.pal = spawn.pal & 3;
    this.w = BODY[this.kind].w;
    this.h = BODY[this.kind].h;
    this.depth = 264;
    this.vx = 0;
    this.vy = 0;
    this.facing = -1;         // враги идут слева направо редко — влево к игроку
    this.state = "idle";
    this.stateTick = 0;       // тики внутри состояния
    this.cooldown = 0;        // тиков до следующего разрешённого удара
    this._didHit = false;     // удар уже засчитан в этом свинге
    this._hitBy = null;       // ссылка на action игрока, засчитавший удар
    this.blinkT = 0;          // мерцание трупа
    this.walkT = 0;           // фаза шага (для фолбэка)
    this.sineT = 0;           // фаза синуса дрона/пода
    this.timer = spawn.timer; // байт +9 оригинала (фазы жизни пода/дрона)
    this.dropped = false;     // под уже сбросил дитя
    this.child = null;        // дитя пода (робот) — забирает Game
    this.stats = COMBAT[this.kind] || {};
    this.hp = this.stats.hp || 1;
    this._anchorX = spawn.x;    // якорь X записи спауна (цель пода)
    this._koLanded = false;     // KO: приземлился (лёжа)
    if (this.kind === "abobo") {
      // Босс (C-22): броня-пойз (шатание каждый poise-й удар), вспышка
      // урона; вход — сброс с неба (Game задаёт высокий opts.y)
      this.poiseLeft = this.stats.poise || 4;
      this.hurtFlashT = 0;      // тики вспышки при попадании (без стана)
    }
    if (this.kind === "drone") {
      const D = COMBAT.drone;
      // Якорь-вентиляция (спаренная запись $0A): всегда X−28/D−4 от записи
      // дрона $0C (ROM: пары $F7FA/$F805, $F847/$F852, $F85D/$F868).
      this.ventX = spawn.x - D.ventOffsetX;
      this.ventDepth = spawn.depth - D.ventOffsetD;
      this.pocketX = this.ventX - D.pocketDistX; // центр кармана зависания
      this.alt = 40;              // высота над палубой (влёт начинается низко)
      this.diveCd = 0;            // cooldown до следующего захвата (тики)
      this._capX = 0;             // зафиксированная точка пике (на момент
      this._capD = 0;             // захвата — вектор не меняется в полёте)
      this._diveX = 0;            // позиция на старте пике
      this._diveD = 0;
      this._diveAlt = 0;
    }

    const o = opts || {};
    this.x = o.x !== undefined ? o.x : spawn.x - this.w / 2;
    if (o.y !== undefined) {
      this.y = o.y;
    } else {
      this.y = this._floorLine() - this.h; // стоит на палубе
    }
    this.depth = this._clampDepth(o.depth !== undefined ? o.depth : spawn.depth);

    // Начальные состояния по виду
    if (this.kind === "abobo") this.state = "enter"; // босс падает с неба
    else if (this.kind === "pod") this.state = "enter";
    else if (this.kind === "drone") this.state = "enter"; // влёт к якорю
    else if (o.drop) { this.state = "fall"; this.vy = 0; } // десант с пода
  }

  // --- Геометрия палубы ---
  _clampDepth(d) {
    const cx = this.x + this.w / 2;
    const far = groundYAt(this.level.depthFar, null, cx);
    const near = groundYAt(this.level.depthNear, null, cx);
    return Math.max(far, Math.min(near, d));
  }
  _floorLine() {
    const cx = this.x + this.w / 2;
    const gy = groundYAt(this.level.floorPoints, this.level.floorGaps, cx);
    if (!Number.isFinite(gy)) return Infinity; // провал-разлом
    return gy + depthShift(this.level, this.depth);
  }

  get cx() { return this.x + this.w / 2; }
  get alive() { return this.state !== "gone"; }
  // Бьётся ударами игрока (в оригинале — бит 0 класса $9BE0): под/дрон — нет.
  // Босс (C-22) — только в боевых состояниях: во входе (сброс/рык) он
  // неуязвим (в ROM тип $13 имеет класс $00 — вне обычного сканера целей).
  hittable() {
    if (!this.stats || this.stats.hittable === false) return false;
    if (this.stats.boss) {
      return this.state === "idle" || this.state === "walk" ||
        this.state === "attack" || this.state === "hurt";
    }
    return this.state !== "ko" && this.state !== "gone";
  }

  // --- Удар игрока по врагу (C-15, docs/collision.md §7; числа — C-20,
  // docs/combat.md §5: ряды $88B8 джеб 0 / таран 20 / добивания 15/30) ---
  // dmg/knockback/stunTicks — из COMBAT.playerPunch/playerRam/playerFist/
  // playerBoot; fromX — центр игрока. Возвращает 'ko' | 'hurt' | null.
  applyHit(dmg, stunTicks, knockback, fromX) {
    if (!this.hittable()) return null;
    this.hp -= dmg;
    const dir = this.cx >= fromX ? 1 : -1; // отброс от игрока
    this.facing = -dir;                    // разворот лицом к атакующему
    if (this.stats.boss) return this._applyHitBoss(dmg, dir);
    if (this.hp < 0) {
      // KO при заёме (HP<0, $87A0): отлёт с дугой; добивание (урон $FF) —
      // большой отлёт (мл. ниббл +1 рядов 15/30 = подброс цели +7/+8)
      this.state = "ko";
      this.stateTick = 0;
      this.vx = dir * (dmg >= 127 ? 260 : 150);
      this.vy = dmg >= 127 ? -300 : -190;
      return "ko";
    }
    this.state = "hurt";
    this.stateTick = 0;
    this._hurtLen = stunTicks || this.stats.hurtTicks; // C-20: стан по ряду
    this.vx = dir * knockback;
    this.cooldown = 0;
    return "hurt";
  }

  // Удар по боссу (C-22): урон копится всегда; KO при HP<0 — БЕЗ отлёта
  // (босс оседает на месте, _aboboKO). Броня: стан-шатание (hurt) только
  // каждый poise-й удар — босс не жонглируется джебами; остальные удары —
  // только вспышка (hurtFlashT) без прерывания действия.
  _applyHitBoss(dmg, dir) {
    this.hurtFlashT = 10;
    if (this.hp < 0) {
      this._setState("ko");
      this.vx = dir * 40; // лёгкий занос назад при оседании
      return "ko";
    }
    this.poiseLeft -= 1;
    if (this.poiseLeft <= 0) {
      this.poiseLeft = this.stats.poise || 4;
      this._setState("hurt");
      this._hurtLen = this.stats.hurtTicks;
      this.vx = dir * this.stats.knockback;
      return "hurt";
    }
    return "armor"; // урон прошёл, действие не прервано
  }

  // C-20: «лёжа» — KO-тело на палубе до деспауна (после падения отлёта,
  // до мерцания-исчезновения). Цель добивания ботинком (anim 20): в
  // оригинале аним 20 выбирается по цели с $04B2 бит 7 (нокдаун) и HP<4
  // ($B566); у нас нокдауна-живого нет — роль играет KO-тело (адаптация,
  // docs/combat.md §3б).
  kickable() {
    if (this.kind !== "robot" && this.kind !== "dome") return false;
    return this.state === "ko" && this._koLanded;
  }

  // Добивание ботинком по лежачему телу (C-20): тело отлетает большой
  // дугой (ряд 30: отброс $FF, подброс +8) и быстро догнивает (мерцание).
  // Очков не даёт (KO уже засчитан при убийстве). Возвращает 'kick'.
  applyBootKick(fromX) {
    if (!this.kickable()) return null;
    const dir = this.cx >= fromX ? 1 : -1;
    this.vx = dir * 260;
    this.vy = -300;
    this._koLanded = false;
    this.blinkT = 70; // после приземления — сразу мерцание и деспаун
    return "kick";
  }

  // Активный ударный прямоугольник врага (в окне удара) или null.
  attackBox() {
    if (this.state !== "attack") return null;
    const s = this.stats;
    if (this.stateTick < s.hitFrom || this.stateTick >= s.hitTo) return null;
    const hw = this.kind === "abobo" ? 30 : this.kind === "robot" ? 18 : 16;
    const hh = this.h - 8;
    return {
      x: this.facing > 0 ? this.x + this.w - 2 : this.x - hw + 2,
      y: this.y + 4, w: hw, h: hh,
    };
  }

  // Главный тик. ctx = {player, dt, cameraX, viewW}. Возвращает true, пока жив.
  update(dt, ctx) {
    const ticks = dt * TICKS_PER_SEC;
    this.stateTick += ticks;
    if (this.cooldown > 0) this.cooldown -= ticks;
    if (this.hurtFlashT > 0) this.hurtFlashT -= ticks; // C-22 (босс)
    this.sineT += dt;

    // Босс (C-22) — отдельный автомат (вход/бой/KO без отлёта)
    if (this.kind === "abobo") return this._aboboAI(dt, ctx);

    const p = ctx.player;
    const dx = p.x + p.w / 2 - this.cx;
    const dd = p.depth - this.depth;

    switch (this.state) {
      case "fall": { // десант с пода: падение до палубы, кадр r22 (руки вверх)
        this.vy += GRAVITY * dt;
        if (this.vy > MAX_FALL) this.vy = MAX_FALL;
        this.y += this.vy * dt;
        const fl = this._floorLine();
        if (this.y + this.h >= fl) {
          this.y = fl - this.h;
          this.vy = 0;
          this._setState("rise");
        }
        break;
      }
      case "rise": // подъём после десанта (anim 52: 22→17→16)
        if (this.stateTick >= 40) this._setState("idle");
        break;
      case "idle":
      case "walk": this._walkersAI(dt, dx, dd, ticks); break;
      case "attack":
        if (this.stateTick >= this.stats.totalTicks) {
          this.cooldown = this.stats.cooldownTicks;
          this._setState("idle");
        }
        break;
      case "hurt": {
        // стан: отброс с затуханием; жонглирование разрешено (удар по
        // стану снова зовёт applyHit — как в оригинале). Длительность —
        // по ряду $88B8 удара (C-20: _hurtLen; джеб 63, таран 120)
        this.x += this.vx * dt;
        const dec = 480 * dt;
        if (this.vx > 0) this.vx = Math.max(0, this.vx - dec);
        else if (this.vx < 0) this.vx = Math.min(0, this.vx + dec);
        const hurtLen = this._hurtLen || this.stats.hurtTicks;
        if (this.stateTick >= hurtLen) this._setState("idle");
        break;
      }
      case "ko": return this._updateKO(dt, ticks);
      case "enter":
        if (this.kind === "drone") { this._droneAI(dt, ctx); break; }
        return this._podEnter(dt, ctx);
      case "hover":
        if (this.kind === "drone") { this._droneAI(dt, ctx); break; }
        return this._podHover(dt, ticks, ctx);
      case "leave": return this._podLeave(dt, ctx);
      case "telegraph": case "dive": case "return":
        this._droneAI(dt, ctx); break;
      default: break;
    }

    // Общая геометрия ходящих/раненых (не летящих) состояний
    if (this.kind === "robot" || this.kind === "dome") {
      if (this.state !== "fall" && this.state !== "ko") {
        this._clampToDeck();
        this.y = this._floorLine() - this.h; // ноги на палубе
      }
    }
    return this.alive;
  }

  _setState(s) {
    this.state = s;
    this.stateTick = 0;
    this._didHit = false;
  }

  // AI ходоков (робот/купол): подход по X и глубине, удар в радиусе.
  _walkersAI(dt, dx, dd, ticks) {
    const s = this.stats;
    const adx = Math.abs(dx);
    const add = Math.abs(dd);
    this.walkT += ticks;
    // разворот к игроку
    if (adx > 2) this.facing = dx > 0 ? 1 : -1;

    if (adx <= s.attackRangeX && add <= s.attackRangeD && this.cooldown <= 0) {
      this._setState("attack");
      return;
    }
    // Подход: X к дистанции удара, глубина к ряду игрока (±4)
    let mx = 0;
    if (adx > s.attackRangeX - 4) mx = Math.sign(dx);
    const nextCx = this.cx + mx * s.speedX * dt;
    // разлом = стена для шагающих (см. шапку)
    if (Number.isFinite(
      groundYAt(this.level.floorPoints, this.level.floorGaps, nextCx))) {
      this.x += mx * s.speedX * dt;
    }
    if (add > 4) {
      this.depth += Math.sign(dd) * s.speedD * dt;
    }
    if (this.state === "idle" && (mx !== 0 || add > 4)) this.state = "walk";
    else if (this.state === "walk" && mx === 0 && add <= 4) this.state = "idle";
  }

  // --- Босс ABOBO (C-22): вход-сброс с неба → рык → подход → удар ---
  // Автомат: enter (падение на арену, кадр 82) → roar (стойка 81, ~0.8 с —
  // неуязвим, как фаза типа $13 вне сканера целей) → idle/walk (подход,
  // медленнее робота) ⇄ attack (замах 16т → выпад с уроном 16-28т → откат
  // 20т, кулдаун) → hurt (шатание 24т, только каждый poise-й удар) →
  // ko (оседание на месте с мерцанием, без отлёта → Game выигрывает).
  _aboboAI(dt, ctx) {
    const s = this.stats;
    const ticks = dt * TICKS_PER_SEC;
    const p = ctx.player;
    const dx = p.x + p.w / 2 - this.cx;
    const dd = p.depth - this.depth;

    switch (this.state) {
      case "enter": {
        // Сброс с неба: гравитация до палубы (босс прибывает сверху)
        this.vy += GRAVITY * dt;
        if (this.vy > MAX_FALL) this.vy = MAX_FALL;
        this.y += this.vy * dt;
        const fl = this._floorLine();
        const floor = Number.isFinite(fl) ? fl : this._deckY();
        if (this.y + this.h >= floor) {
          this.y = floor - this.h;
          this.vy = 0;
          this._setState("roar");
        }
        return true;
      }
      case "roar": // «рык» после приземления — стойка, неуязвим
        if (this.stateTick >= 48) this._setState("idle");
        break;
      case "idle":
      case "walk": {
        // подход к игроку по X и глубине (как ходоки, но медленнее)
        const adx = Math.abs(dx);
        const add = Math.abs(dd);
        this.walkT += ticks;
        if (adx > 2) this.facing = dx > 0 ? 1 : -1;
        if (adx <= s.attackRangeX && add <= s.attackRangeD &&
            this.cooldown <= 0) {
          this._setState("attack");
          break;
        }
        let mx = 0;
        if (adx > s.attackRangeX - 6) mx = Math.sign(dx);
        this.x += mx * s.speedX * dt;
        if (add > 4) this.depth += Math.sign(dd) * s.speedD * dt;
        if (this.state === "idle" && (mx !== 0 || add > 4)) this.state = "walk";
        else if (this.state === "walk" && mx === 0 && add <= 4) {
          this.state = "idle";
        }
        break;
      }
      case "attack":
        if (this.stateTick >= s.totalTicks) {
          this.cooldown = s.cooldownTicks;
          this._setState("idle");
        }
        break;
      case "hurt": {
        // шатание (только каждый poise-й удар): короткий занос с затуханием
        this.x += this.vx * dt;
        const dec = 300 * dt;
        if (this.vx > 0) this.vx = Math.max(0, this.vx - dec);
        else if (this.vx < 0) this.vx = Math.min(0, this.vx + dec);
        if (this.stateTick >= (this._hurtLen || s.hurtTicks)) {
          this._setState("idle");
        }
        break;
      }
      case "ko": return this._aboboKO(dt, ticks);
      default: break;
    }
    // Геометрия на палубе (кроме падения входа и KO-оседания)
    this._clampToDeck();
    if (this.state !== "enter" && this.state !== "ko") {
      this.y = this._floorLine() - this.h;
    }
    return this.alive;
  }

  // KO босса (C-22): без отлёта — шаткая остановка с заносом, оседание
  // чуть вниз (колени подкашиваются), с ~70 тика мерцание, деспаун.
  // Победу уровня отсчитывает Game (winT с момента KO).
  _aboboKO(dt, ticks) {
    const fl = this._floorLine();
    const floor = Number.isFinite(fl) ? fl : this._deckY();
    this.x += this.vx * dt;
    const dec = 200 * dt;
    if (this.vx > 0) this.vx = Math.max(0, this.vx - dec);
    else if (this.vx < 0) this.vx = Math.min(0, this.vx + dec);
    // оседание: низ опускается на 10 px ниже линии пола (согнутый кадр 160)
    const sink = Math.min(10, this.stateTick * 0.4);
    this.y = floor - this.h + sink;
    this.blinkT += ticks;
    if (this.blinkT > 110) return this._despawn();
    return true;
  }

  _clampToDeck() {
    // Стены уровня и кромки палубы — как у игрока (Game.update)
    const lw = this.level.leftWall, rw = this.level.rightWall - this.w;
    if (this.x < lw) this.x = lw;
    if (this.x > rw) this.x = rw;
    this.depth = this._clampDepth(this.depth);
  }

  _updateKO(dt, ticks) {
    // Отлёт с дугой → лёжа на палубе → мерцание → деспаун.
    // В провал-разлом падает и гибнет (в оригинале враги срываются в ямы —
    // collision.md §5, «враги (X≥2) срываются без задержки»).
    this.vy += GRAVITY * dt;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const fl = this._floorLine();
    if (!Number.isFinite(fl)) {
      if (this.y > this.level.height + 48) return this._despawn(); // улетел в разлом
      return true;
    }
    if (this.y + this.h >= fl) {
      this.y = fl - this.h;
      this.vy = 0;
      this.vx = 0;
      this._koLanded = true;
      this.blinkT += ticks;
      // ~70 тиков лежит (оригинал ~64: $0575 $C0→$80), затем ~30 тиков
      // мерцания и деспаун (+ продвижение спаун-потока у оригинала — у нас
      // поток и так по триггерам)
      if (this.blinkT > 100) return this._despawn();
    }
    return true;
  }

  _despawn() {
    this.state = "gone";
    return false;
  }

  // --- Под-носитель (тип $10) ---
  _podEnter(dt, ctx) {
    // Прилет справа к якорю: цель — точка над палубой у якоря X
    const targetX = this._anchorX;
    const groundY = groundYAt(this.level.floorPoints, this.level.floorGaps,
      Math.max(0, Math.min(this.level.width - 1, targetX)));
    const hoverY = (Number.isFinite(groundY) ? groundY : 168) +
      depthShift(this.level, this.depth) - 78;
    const dx = targetX - this.cx;
    const dy = hoverY - this.y;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      this._setState("hover");
      return true;
    }
    const sp = 150;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
    this.y += Math.sign(dy) * Math.min(Math.abs(dy), sp * dt);
    if (this.x > ctx.cameraX + ctx.viewW + 80 && dx > 0) return this._despawn();
    return true;
  }

  _podHover(dt, ticks, ctx) {
    // Зависание с лёгкой качкой; сброс робота на 20-м тике
    this.y += Math.sin(this.sineT * 4) * 6 * dt;
    if (!this.dropped && this.stateTick >= 20) {
      this.dropped = true;
      const childPal = this.pal ^ 1; // дитя: палитра пода XOR 1 ($C168)
      this.child = new Enemy({
        kind: "robot", trigger: 0, x: this.cx, depth: this.depth,
        timer: 0, pal: childPal,
      }, this.level, { x: this.cx - BODY.robot.w / 2, y: this.y + this.h - 30,
        depth: this.depth, drop: true });
      this.child.facing = -1;
    }
    // время жизни — байт +9 спауна ($70-$90 ≈ 1.9-2.4 с)
    if (this.stateTick >= Math.max(60, this.timer)) this._setState("leave");
    return true;
  }

  _podLeave(dt, ctx) {
    this.x += 170 * dt;
    this.y -= 60 * dt;
    if (this.x > ctx.cameraX + ctx.viewW + 90 || this.y < -80) {
      return this._despawn();
    }
    return true;
  }

  // --- Дрон-серп (тип $0C→$0B): якорь-вентиляция, телеграф-захват с
  // задержкой, пике по зафиксированной траектории без подруливания,
  // возврат/cooldown (C-17; модель из ROM $FB13/$FB49 — см. шапку и
  // эррату C-17 в docs/game-rules.md) ---
  _droneAI(dt, ctx) {
    const D = this.stats; // COMBAT.drone
    const p = ctx.player;
    const pCX = p.x + p.w / 2;
    if (this.diveCd > 0) this.diveCd -= dt * TICKS_PER_SEC;

    switch (this.state) {
      case "enter": {
        // Влёт справа к карману зависания (в ROM: 64 тика по 0.5 px/т
        // влево от спауна у самого вента; наш спаун дальше за краем
        // экрана — скорость выше, точка назначения та же).
        const dxp = this.pocketX + 20 - this.cx;
        this.x += Math.sign(dxp) * Math.min(Math.abs(dxp), D.enterSpeed * dt);
        this.alt += (D.hoverH - this.alt) * Math.min(1, 1.5 * dt);
        const ddp = this.ventDepth - this.depth;
        this.depth += Math.sign(ddp) * Math.min(Math.abs(ddp), 40 * dt);
        if (Math.abs(dxp) < 8) this._setState("hover");
        break;
      }
      case "hover": {
        // Патруль-зависание у якоря: стягивание в карман (класс $60
        // таблицы $9056 ≈ 1 px/т) + лёгкая качка высоты. ЗАХВАТ: игрок в
        // радиусе triggerX от ВЕНТА по X ($FD44→$8D5B, A=$20), дрон в
        // кармане, cooldown истёк. Точка пике фиксируется здесь.
        const dxp = this.pocketX - this.cx;
        const ddp = this.ventDepth - this.depth;
        if (Math.abs(dxp) > 2) {
          this.x += Math.sign(dxp) *
            Math.min(Math.abs(dxp), D.patrolSpeed * dt);
        }
        if (Math.abs(ddp) > 2) {
          this.depth += Math.sign(ddp) *
            Math.min(Math.abs(ddp), D.patrolSpeed * 0.6 * dt);
        }
        this.alt += (D.hoverH + Math.sin(this.sineT * 3) * 4 - this.alt) *
          Math.min(1, 3 * dt);
        if (this.diveCd <= 0 && Math.abs(this.cx - this.pocketX) <= 30 &&
            Math.abs(pCX - this.ventX) <= D.triggerX) {
          this._capX = pCX;      // точка захвата — больше не меняется
          this._capD = p.depth;
          this._setState("telegraph");
        }
        break;
      }
      case "telegraph": {
        // Подъём-«свечка» без горизонтального движения (ROM: счётчик $0566
        // $2C→$40 ≈ 20 тиков, вертикаль 6 px/т с затуханием −0.375 px/т²)
        // — окно, пока дрон раскручивает серп: время отойти.
        this.alt += (D.hoverH + D.telegraphRise - this.alt) *
          Math.min(1, 5 * dt);
        if (this.stateTick >= D.telegraphTicks) {
          this._diveX = this.cx;
          this._diveD = this.depth;
          this._diveAlt = this.alt;
          this._setState("dive");
        }
        break;
      }
      case "dive": {
        // Пике по ПРЯМОЙ к зафиксированной точке (вектор $BFDB, ~16
        // тиков, без подруливания): отошёл после захвата — дрон мимо.
        const k = Math.min(1, this.stateTick / D.diveTicks);
        this.x = this._diveX + (this._capX - this._diveX) * k - this.w / 2;
        this.depth = this._clampDepth(
          this._diveD + (this._capD - this._diveD) * k);
        this.alt = this._diveAlt * (1 - k);
        if (this.stateTick >= D.diveTicks) this._setState("return");
        break;
      }
      case "return": {
        // Возврат к якорю (ROM: $0566:=0 → патруль; посадка с превращением
        // в оружие $0D не портирована — нет системы оружия). По прибытии —
        // cooldown до следующего захвата.
        const dxp = this.pocketX - this.cx;
        const ddp = this.ventDepth - this.depth;
        const dap = D.hoverH - this.alt;
        const step = D.returnSpeed * dt;
        this.x += Math.sign(dxp) * Math.min(Math.abs(dxp), step);
        this.depth += Math.sign(ddp) * Math.min(Math.abs(ddp), step * 0.6);
        this.alt += Math.sign(dap) * Math.min(Math.abs(dap), step * 0.8);
        if (Math.abs(dxp) < 6 && Math.abs(ddp) < 4 && Math.abs(dap) < 6) {
          this.diveCd = D.cooldownTicks;
          this._setState("hover");
        }
        break;
      }
      default: break;
    }
    // Экранная Y: низ дрона на высоте alt над линией палубы под ним
    this.y = this._deckY() - this.h - this.alt;
    this.facing = this.cx >= pCX ? -1 : 1;
    if (this.x + this.w < ctx.cameraX - 60) this._despawn();
  }

  // Контактный урон дрона активен во всех боевых состояниях (в ROM $EB
  // выставляется каждый кадр обеих фаз $0C/$0B; урон 8 сохранён из C-15).
  contactArmed() {
    return this.kind === "drone" && this.alive &&
      this.state !== "gone" && this.state !== "ko";
  }

  _deckY() {
    const gy = groundYAt(this.level.floorPoints, this.level.floorGaps,
      Math.max(0, Math.min(this.level.width - 1, this.cx)));
    return (Number.isFinite(gy) ? gy : 168) + depthShift(this.level, this.depth);
  }

  // Текущее имя кадра (базовое, без палитры) — для рендера и тестов.
  currentFrame() {
    switch (this.kind) {
      case "robot":
        if (this.state === "fall") return "r22";
        if (this.state === "rise") return frameAt(ANIMS.robotSpawn, this.stateTick);
        if (this.state === "attack") return frameAt(ANIMS.robotAttack, this.stateTick);
        if (this.state === "hurt") return frameAt(ANIMS.robotHurt, this.stateTick);
        // KO: в полёте — пошатывание (r21), на палубе — лёжа плашмя (r24)
        if (this.state === "ko") return this._koLanded ? "r24" : "r21";
        return this.state === "walk"
          ? frameAt(ANIMS.robotWalk, this.stateTick)
          : frameAt(ANIMS.robotIdle, this.stateTick);
      case "dome":
        if (this.state === "attack") return frameAt(ANIMS.domeAttack, this.stateTick);
        if (this.state === "hurt") return frameAt(ANIMS.domeHurt, this.stateTick);
        if (this.state === "ko") return frameAt(ANIMS.domeKO, this.stateTick);
        return frameAt(ANIMS.domeWalk, this.stateTick + this.walkT);
      case "pod":
        return "pod34";
      case "drone":
        if (this.state === "dive") return frameAt(ANIMS.droneDive, this.stateTick);
        if (this.state === "telegraph") {
          return frameAt(ANIMS.droneTelegraph, this.stateTick);
        }
        return frameAt(ANIMS.droneFly, this.stateTick);
      case "abobo":
        // C-22: вход — сброс (82); рык/стойка — 81; шаг — 77/78; удар —
        // замах 81 → выпад 78 → откат 81; урон-шатание — 159; KO — 160
        if (this.state === "enter") return frameAt(ANIMS.aboboEnter, this.stateTick);
        if (this.state === "attack") return frameAt(ANIMS.aboboAttack, this.stateTick);
        if (this.state === "hurt") return frameAt(ANIMS.aboboHurt, this.stateTick);
        if (this.state === "ko") return frameAt(ANIMS.aboboKO, this.stateTick);
        return this.state === "walk"
          ? frameAt(ANIMS.aboboWalk, this.stateTick)
          : frameAt(ANIMS.aboboIdle, this.stateTick);
      default:
        return "r16";
    }
  }

  // ======================= РЕНДЕР =======================

  render(ctx, depthScale) {
    // Мерцание трупа перед деспауном (после 70 тиков лёжа)
    if (this.state === "ko" && this.blinkT > 70 &&
        Math.floor(this.blinkT / 4) % 2 === 0) {
      return; // кадр пропущен — классическое мерцание NES
    }
    const sheet = enemySheet();
    if (sheet && typeof ctx.drawImage === "function") {
      this._renderSprite(ctx, sheet, depthScale);
    } else {
      this._renderFigure(ctx);
    }
    // C-22: вспышка урона босса (броня без стана — обратная связь попадания)
    if (this.hurtFlashT > 0 && this.stats && this.stats.boss) {
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(this.x - 4, this.y - 2, this.w + 8, this.h + 4);
      ctx.restore();
    }
  }

  _renderSprite(ctx, sheet, depthScale) {
    const fr = FRAMES[this.currentFrame() + "p" + this.pal];
    if (!fr) return;
    const s = depthScale || 1;
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h);
    ctx.scale(this.facing * s, s);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, fr.x, fr.y, fr.w, fr.h, -fr.ax, -fr.h, fr.w, fr.h);
    ctx.restore();
  }

  // Фолбэк-фигуры (тесты/до загрузки листа): минимальный читаемый силуэт
  // в цвете подпалитры. Только fillRect/polyPath (мок-ctx смоуков).
  _renderFigure(ctx) {
    if (this.kind === "abobo") {
      // Босс (C-22): крупный громила — кожа + синий костюм (s6pal 12)
      const x = this.x, y = this.y, w = this.w, h = this.h;
      const skin = "#d87020", suit = "#3868e8", dark = "#181040";
      ctx.fillStyle = dark;
      ctx.fillRect(x - 2, y - 1, w + 4, h + 2);
      ctx.fillStyle = suit; // ноги/торс — костюм
      ctx.fillRect(x + 3, y + h * 0.45, w - 6, h * 0.55);
      ctx.fillStyle = skin; // голова/плечи/руки — кожа
      ctx.fillRect(x + 4, y, w - 8, h * 0.5);
      ctx.fillRect(x - 3, y + 6, 6, h * 0.4);
      ctx.fillRect(x + w - 3, y + 6, 6, h * 0.4);
      if (this.state === "attack" && this.stateTick >= (this.stats.hitFrom || 16)) {
        ctx.fillStyle = skin; // вытянутый кулак в сторону facing
        ctx.fillRect(this.facing > 0 ? x + w : x - 12, y + 14, 12, 10);
      }
      if (this.state === "hurt" || this.state === "ko") {
        ctx.fillStyle = "rgba(255,255,255,0.35)"; // шатание — побледнение
        ctx.fillRect(x, y, w, h);
      }
      return;
    }
    const c = PAL_COLORS[this.pal];
    const d = PAL_DARK[this.pal];
    const x = this.x, y = this.y, w = this.w, h = this.h;
    ctx.fillStyle = d;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
    if (this.kind === "robot") {
      // голова-купол и ноги
      ctx.fillStyle = d;
      ctx.fillRect(x + 3, y + 3, w - 6, 8);
      ctx.fillStyle = c;
      ctx.fillRect(x + 2, y + h - 8, 5, 8);
      ctx.fillRect(x + w - 7, y + h - 8, 5, 8);
      // кулак при ударе
      if (this.state === "attack" && this.stateTick >= (this.stats.hitFrom || 24)) {
        ctx.fillRect(this.facing > 0 ? x + w : x - 6, y + 12, 6, 6);
      }
    } else if (this.kind === "dome") {
      ctx.fillStyle = d;
      polyPath(ctx, [[x, y + 12], [x + w / 2, y], [x + w, y + 12], [x + w, y + h], [x, y + h]]);
      ctx.fill();
      if (this.state === "attack") {
        ctx.fillStyle = "#f0f0f0";
        ctx.fillRect(x + 3, y + 4, w - 6, 5);
      }
    } else if (this.kind === "drone") {
      ctx.fillStyle = d;
      polyPath(ctx, [[x, y + h], [x + w / 2, y], [x + w, y + h], [x + w / 2, y + h - 4]]);
      ctx.fill();
    } else { // pod
      ctx.fillStyle = d;
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
    }
  }
}
