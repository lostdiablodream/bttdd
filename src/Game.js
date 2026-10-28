// Game — сцена: ПОРТ оригинального уровня 1 «Tail of the Ratship» из NES
// Battletoads & Double Dragon (C-11): чёрный космос со звёздами (параллакс),
// аква-корпус корабля по силуэту метатайл-карты, пол по профилю $B46B,
// маджентовые кристаллы и полосатые столбы под палубой, подвесные шашечные
// платформы, 6 предметов на оригинальных позициях спауна, дверной проём
// хвоста корабля у правого края (объект $4F; C-22: проём — декор, уровень
// кончается БОССОМ ABOBO — сброс на арену, бой, победа = KO босса),
// жаба, HUD-плашки и стилизованные экраны результата. Герой рисуется
// настоящими спрайтами из ROM (C-13, assets/player/rash.png; до загрузки
// листа — фигуры C-07), KO/победная поза показаны на экранах результата
// (enterKo/enterWin).
//
// ПСЕВДО-3D (C-14): ось глубины — оригинал beat'em-up, а не плоский
// платформер (docs/player-physics.md §1: screen_y = D − H + $0476 − $8F).
// У героя/предметов есть координата depth (D, px ROM; спаун игрока 264).
// ↑/↓ (W/S) ходят вглубь/из глубины палубы (кап 60 px/с), кромки палубы —
// ломаные depthFar/depthNear по X из записей $B46B (кламп каждый кадр).
// Экранная Y = базовая линия (пол/верх платформы на ряду 264) +
// (D − 264) × 0.9 (лёгкое сжатие-перспектива) — движение вверх по глубине
// смещает вверх по экрану; спрайт на дальней кромке чуть меньше (×0.92).
// Прыжок — только Space (кнопка A оригинала): вертикальная физика C-02 без
// изменений, в прыжке можно двигаться по X и по глубине. Подбор предметов —
// AABB + окно по глубине |ΔD| ≤ 10 (у оригинала ≤6/≤8).
// Палуба рисуется лентой между кромками, под героем — тень-эллипс
// (полигоном — мок ctx не знает ellipse/arc), предметы сортируются по
// глубине относительно героя (дальние — за спиной, ближние — впереди).
//
// Мир 2304×288 в пикселях ROM (X 1:1 с оригиналом). Рендер-масштаб SCALE
// и вертикальное смещение Y_CAM — только проекция: мировые координаты
// (физика, хитбоксы, данные) не масштабируются. Выбор масштаба (C-11,
// требование по референсам): рост жабы 48 px ROM × 2.25 = 108 px на кадре
// 540 = 1/5 высоты — как в оригинале (48/240); палуба (верх обшивки ~y110
// до низа ~y250 мира → экран ~200..520) занимает ~2/3 вьюпорта, HUD сверху,
// космос чёрный. Мир по вертикали (288×2.25 = 648 > 540) чуть обрезан сверху
// (небо) и снизу (концы столбов) — вертикальной камеры нет.
//
// update(dt): движение/прыжок/глубина игрока по вводу (C-02/C-14),
// односторонние платформы (C-11), высотное поле пола с удержанием на
// склонах (C-11) и перспективным сдвигом глубины (C-14), правила игровой
// цели (C-05 + C-11 + C-22): подбор предметов (бонус), разлом палубы /
// падение ниже мира → поражение, KO босса ABOBO в конце уровня → победа.
// Враги (C-15): спаун по потоку $F6BB (роботы $09, куполы $0F, поды $10,
// дроны $0C — src/Enemy.js), бой (C-20, docs/combat.md): джеб стоя
// (anim 2/4, урон 4) серией с чередованием рук, авто-добивание при
// смертельном ударе — гигантский кулак (anim 14) по стоящему / ботинок
// (anim 20) по лежачему телу, дэш (двойной тап ←/→) и таран в дэше
// (anim 22, урон 16, проход сквозь); удары/контакт врагов снимают HP
// игрока (HP-бар 6 ячеек в HUD, i-frames ~1 с с мерцанием, HP<0 → KO →
// 'lost'); еда/неуязвимость-предметы лечат/защищают (game-rules §1.1).
// Камера следует за игроком: мёртвая зона по центру, кламп
// [0, worldWidth − видимая ширина].
// Конечный автомат состояний (C-04/C-05): 'ready' → 'running' ⇄ 'paused',
// из 'running' → 'won'/'lost'; выход из 'won'/'lost' — только полным
// сбросом (кнопка «Заново» и сброс в start() — C-06).

import { Player } from "./Player.js";
import { Enemy } from "./Enemy.js";
import { getInput } from "./input.js";
import {
  collideRects, resolvePlayerPlatforms, resolvePlayerTerrain, groundYAt,
} from "./collision.js";
import { LEVEL1, depthShift } from "./level.js";
import { COMBAT } from "./enemyframes.js";
import { ATTACK } from "./playerframes.js";
import {
  PAL, fillCircle, polyPath, drawPanel, drawSkull,
  drawCrystal, drawStripedPole, drawChecker, drawCaution,
} from "./theme.js";

const WIDTH = 960;
const HEIGHT = 540;

// Проекция мира (C-11): масштаб и смещение (обоснование в шапке).
const SCALE = 2.25;
const Y_CAM = 20; // верх мира: walk-линия старта (y=168) → экран 333
const VIEW_W = WIDTH / SCALE; // 426.7 мировых px видно по горизонтали

// Схема очков (C-05): предмет +1000, бонус за победу +2000.
// В оригинале предметы давали 5000 очков (docs/game-rules.md §1) —
// у нас шкала проще, но дух «предмет = крупное начисление» сохранён.
export const SCORE_PER_ITEM = 1000;
export const WIN_BONUS = 2000;

// Босс ABOBO (C-22): триггер — игрок у линии выхода $07B0=1968 оригинала
// (в ROM триггер по скроллу; у нас — по X игрока, т.к. камера 426 px не
// доскролливает до $07B0); арена боя: от входа в хвост палубы (1860) до
// правой стены ($860=2144); босс сбрасывается с неба у правого края.
export const BOSS_TRIGGER_X = 1968;
export const BOSS_ARENA_LEFT = 1860;
export const BOSS_SPAWN_X = 2060;
const BOSS_WIN_DELAY = 1.6; // секунды от KO босса до экрана победы

// Ключ рекорда в localStorage (C-06). Рекорд обновляется при превышении
// счёта; любые ошибки хранилища (приватный режим, квота, отсутствие
// localStorage) перехватываются — рекорд тогда живёт только в памяти
// до конца сессии, игра не падает.
export const BEST_SCORE_KEY = "btdd-platformer-best";

function loadBestScore() {
  try {
    if (typeof localStorage === "undefined") return 0;
    const n = parseInt(localStorage.getItem(BEST_SCORE_KEY), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (e) {
    return 0; // хранилище недоступно/кидает — стартуем с нулём в памяти
  }
}

function saveBestScore(value) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(BEST_SCORE_KEY, String(value));
    return true;
  } catch (e) {
    return false; // квота/приватный режим — рекорд остаётся в this.best
  }
}

export class Game {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = WIDTH;
    this.height = HEIGHT;

    // Конечный автомат состояний (C-04/C-05). Единственная rAF-цепочка живёт
    // в main.js и крутится всё время жизни страницы; методы состояний
    // её не трогают — поэтому второй цикл создать невозможно.
    this.state = "ready";
    const opts = options || {};
    // Хук main.js: сброс времени прежнего кадра при продолжении,
    // чтобы первый dt после паузы не «прыгнул» на длину паузы.
    this.onResume = typeof opts.onResume === "function" ? opts.onResume : null;

    // Уровень 1 — порт оригинала (src/level.js ← level1data.js ← ROM)
    this.level = LEVEL1;
    this.platforms = LEVEL1.platforms;
    this.floorPoints = LEVEL1.floorPoints;
    this.floorGaps = LEVEL1.floorGaps;

    // Опасная зона (C-11): единственная компактная — «разлом палубы» в
    // провале профиля (floorGaps). В оригинале уровня 1 лавы/шипов нет,
    // опасность — падение за край палубы; профиль по X сплошной, поэтому
    // добавлен один провал (обоснование места — tools/level1_to_js.py).
    // Зона убивает при касании чуть НИЖЕ линии пола (+6 px), чтобы шагающий
    // по краю не цеплял её; падающий в провал погибает в пролёте.
    this.hazards = this.floorGaps.map((g) => {
      const fy = groundYAt(this.floorPoints, [], g.x0 - 1);
      return {
        x: g.x0, y: fy + 6, w: g.x1 - g.x0, h: this.level.height - fy - 6,
        kind: "breach",
      };
    });

    // Игровая цель (C-05 → C-22): предметы — бонус (очки/лечение/
    // неуязвимость), победа — KO босса ABOBO в конце уровня (как в
    // оригинале; флаг-финиш и требование «все предметы» убраны в C-22).
    // Данные уровня не мутируются — факт сбора живёт в this.collected (Set id),
    // поэтому рестарт (C-06, reset()) = очистить Set/счёт и вернуть героя на старт.
    this.items = LEVEL1.items;
    this.score = 0;
    this.collected = new Set(); // id собранных предметов — каждый даёт очко один раз
    this.time = 0;              // часы анимации мира (мерцание; тикают в running)
    this.endReason = null;      // 'pit' | 'fall' | 'ko' — причина поражения

    // Враги (C-15): спаун-очередь по потоку $F6BB (enemySpawns) и активные
    // объекты (Enemy.js). Указатель очереди только вперёд — как курсор
    // потока $D0ED оригинала.
    this.enemies = [];
    this.spawnNext = 0;

    // Босс ABOBO (C-22, docs/game-rules.md доп. C-22): в оригинале уровень
    // кончается боем с боссом (а не флагом): босс-объект появляется в конце
    // палубы, победа = его KO. Триггер — позиция игрока у линии выхода $07B0
    // (в ROM триггер по скроллу $07B0; наш вьюпорт 426 px до такого скролла
    // не доходит — камера упирается в край мира раньше — поэтому триггер по
    // X игрока). bossActive — идёт бой (арена заперта, босс-музыка трек 7);
    // bossDefeated + winT — победный отсчёт после KO (в оригинале $DA≠0
    // блокирует смерти на выходе — game-rules §5.1).
    this.bossSpawned = false;
    this.boss = null;
    this.bossActive = false;
    this.bossDefeated = false;
    this.winT = 0;

    // Камера (C-11): сдвиг мира влево, мировые единицы; кламп при рендере.
    this.cameraX = 0;

    // Рекорд (C-06): загружается один раз при создании игры из localStorage;
    // при недоступности хранилища — просто 0 в памяти. newRecord=true, когда
    // текущая партия превзошла прошлый рекорд (для экрана результата).
    this.best = loadBestScore();
    this.newRecord = false;

    // Жаба стартует на палубе у левого края (якорь X=100 оригинала,
    // глубина основного ряда D=264 — C-14)
    this.player = new Player(LEVEL1.playerStart.x, LEVEL1.playerStart.y,
      LEVEL1.width, LEVEL1.playerStart.depth);
    // C-20: выбор приёма по цели при нажатии удара (правило $B529
    // оригинала: джеб, добивающий цель, заменяется добиванием —
    // кулак по стоящей / ботинок по лежачей) — docs/combat.md §3
    this.player.attackChooser = (p) => this._chooseAttackKind(p);
  }

  // --- Автомат состояний: 'ready' → 'running' ⇄ 'paused' (C-04),
  // 'running' → 'won'/'lost' (C-05). Методы только переключают состояние —
  // игровой цикл один, крутится в main.js независимо от состояния.

  // Старт из состояния ожидания. Повторный start() в running/paused — no-op.
  // Из won/lost (C-06) старт делает полный сброс: партия начинается заново
  // с чистым героем/предметами/счётом (то же, что кнопка «Заново»).
  start() {
    if (this.state === "won" || this.state === "lost") this.reset();
    if (this.state !== "ready") return;
    this.state = "running";
  }

  // Пауза — только из running; повторная — no-op.
  pause() {
    if (this.state !== "running") return;
    this.state = "paused";
  }

  // Продолжение — только из paused; повторное — no-op. Время прежнего
  // кадра сбрасывает main.js через onResume: после долгой паузы первый
  // dt остаётся маленьким, мир не «догоняет» паузу одним скачком.
  resume() {
    if (this.state !== "paused") return;
    this.state = "running";
    if (this.onResume) this.onResume();
  }

  togglePause() {
    if (this.state === "running") this.pause();
    else if (this.state === "paused") this.resume();
  }

  // Полный сброс партии (C-06): герой на старт (respawn), предметы
  // возвращены (collected очищен), счёт обнулён, состояние — 'ready'.
  // Трогает ТОЛЬКО данные: слушателей событий и rAF-цепочек здесь нет
  // и не создаётся (их единственные экземпляры повешены в boot() main.js
  // на всю жизнь страницы), поэтому рестарт не может задвоить обработчики
  // или цикл. Рекорд (this.best) сбросу не подлежит.
  reset() {
    this.player.respawn();
    this.collected.clear();
    this.score = 0;
    this.time = 0;
    this.endReason = null;
    this.newRecord = false;
    this.cameraX = 0;
    this.enemies = [];   // C-15: враги и курсор спаун-потока — с начала
    this.spawnNext = 0;
    this.bossSpawned = false;  // C-22: босс — с начала
    this.boss = null;
    this.bossActive = false;
    this.bossDefeated = false;
    this.winT = 0;
    this.state = "ready";
  }

  // Рекорд (C-06): при превышении обновляем this.best и пытаемся
  // сохранить в localStorage; ошибка хранилища не страшна — рекорд
  // живёт в памяти до конца сессии.
  _recordBest() {
    if (this.score > this.best) {
      this.best = this.score;
      this.newRecord = true;
      saveBestScore(this.best);
    }
  }

  // Камера (C-11): мёртвая зона по центру вида — герой двигает камеру,
  // только выходя за её края; кламп в [0, worldWidth − видимая ширина].
  updateCamera() {
    const target = this.player.x + this.player.w / 2;
    const deadL = this.cameraX + VIEW_W * 0.42;
    const deadR = this.cameraX + VIEW_W * 0.58;
    let cx = this.cameraX;
    if (target < deadL) cx = target - VIEW_W * 0.42;
    else if (target > deadR) cx = target - VIEW_W * 0.58;
    const maxCam = Math.max(0, this.level.width - VIEW_W);
    this.cameraX = Math.max(0, Math.min(maxCam, cx));
  }

  update(dt) {
    // Автомат (C-04/C-05): мир движется только в running. В 'won'/'lost'
    // мир заморожен до нового старта (требование задания); единственное,
    // что продолжает тикать — поза героя (C-13: KO-тumble на экране
    // поражения, победная поза на экране победы): кадры без физики,
    // координаты не трогаются. В 'paused'/'ready' кадр просто рисуется.
    if (this.state === "won" || this.state === "lost") {
      this.player.updateEndAnim(dt);
      return;
    }
    if (this.state !== "running") return;
    this.time += dt;

    const p = this.player;
    const wasGrounded = p.onGround; // опора прошлого кадра (для склонов)

    // Движение и прыжок по текущему состоянию клавиш (C-02)
    p.update(dt, getInput());

    // Стены уровня (C-11): клампы режима 3 оригинала $54/$860 (84/2144) —
    // collision.md §3 шаги 1-2
    if (p.x < this.level.leftWall) {
      p.x = this.level.leftWall;
      if (p.vx < 0) p.vx = 0;
    }
    const wallR = this.level.rightWall - p.w;
    if (p.x > wallR) {
      p.x = wallR;
      if (p.vx > 0) p.vx = 0;
    }
    // C-22: во время боя с боссом — арена заперта (в оригинале на босс-арене
    // останавливается скролл — тип $59 держит $ED, game-rules §3; у нас
    // камера и так у предела мира, поэтому запираем левый край арены):
    // игрок не отступает дальше входа в арену, пока босс жив
    if (this.bossActive && p.x < BOSS_ARENA_LEFT) {
      p.x = BOSS_ARENA_LEFT;
      if (p.vx < 0) p.vx = 0;
    }

    // --- Ось глубины (C-14): кламп в кромки палубы на текущем X ---
    // (в оригинале переход за кромку = срыв в падение, collision.md §3 шаг 6;
    // в порту — мягкий кламп: единственная опасная зона уровня — разлом)
    const cx = p.x + p.w / 2;
    const dFar = groundYAt(this.level.depthFar, null, cx);
    const dNear = groundYAt(this.level.depthNear, null, cx);
    if (p.depth < dFar) {
      p.depth = dFar;
      if (p.vd < 0) p.vd = 0;
    } else if (p.depth > dNear) {
      p.depth = dNear;
      if (p.vd > 0) p.vd = 0;
    }
    // Перспективный сдвиг палубы и масштаб спрайта на текущей глубине:
    // линейно между кромками: far → farScale (0.92), near → 1.0
    const depthOffset = depthShift(this.level, p.depth);
    const dSpan = dNear - dFar;
    const farScale = this.level.depth.farScale;
    p.depthScale = farScale + (1 - farScale) *
      (dSpan > 0 ? (p.depth - dFar) / dSpan : 0.5);

    // Столкновения: односторонние платформы (сверху, C-11) + высотное поле
    // пола с удержанием на склонах (склоны 45° профиля $B46B берутся шагом);
    // обе линии сдвинуты перспективой глубины (C-14)
    resolvePlayerPlatforms(p, this.platforms, p.prevX, p.prevY, depthOffset, wasGrounded);
    resolvePlayerTerrain(p, this.floorPoints, this.floorGaps, p.prevY, wasGrounded, depthOffset);

    // --- Враги (C-15): спаун по потоку, AI, бой ---
    if (this._updateEnemies(dt)) return; // 'lost' при KO игрока (HP<0)

    // --- Босс ABOBO (C-22): конец палубы → сброс босса на арену ---
    if (!this.bossSpawned && p.x + p.w >= BOSS_TRIGGER_X) {
      this._spawnBoss();
    }

    // --- Правила игровой цели (C-05/C-11; C-22: победа = KO босса) ---

    // Победный отсчёт после KO босса (C-22): в оригинале при $DA≠0 смерти
    // блокируются (game-rules §5.1) — на выходе игрок неуязвим: опасности
    // и удары врагов ниже пропускаются, пока идёт отсчёт.
    if (this.bossDefeated) {
      this.winT -= dt;
      if (this.winT <= 0) {
        this.score += WIN_BONUS;   // бонус за победу (ранее — за финиш-флаг)
        this._recordBest();        // бонус за победу тоже может быть рекордом
        p.enterWin(); // C-13: победная поза (руки вверх)
        this.state = "won";
        return;
      }
    } else {
      // Опасная зона: разлом палубы (провал) → поражение в пролёте.
      // C-14: зона привязана к линии палубы на ГЛУБИНЕ героя (hz.y — пол
      // основного ряда +6, сдвиг depthOffset): на ближней кромке ноги героя
      // НИЖЕ основной линии по экрану, и фиксированная зона ловила бы его
      // у кромки без провала; со сдвигом гибнет только реально провалившийся
      // (ноги ниже линии своей глубины). При depth=264 прямоугольник
      // совпадает с до-C-14 поведением.
      for (const hz of this.hazards) {
        const killY = hz.y + depthOffset; // линия смерти на глубине героя
        if (collideRects(p, { x: hz.x, y: killY, w: hz.w, h: this.level.height - killY })) {
          this.endReason = "pit";
          p.enterKo(); // C-13: поза нокаута на экране поражения
          this.state = "lost";
          return;
        }
      }
      // Падение ниже мира → поражение (страховка; разлом перехватывает раньше)
      if (p.y > this.level.height + 64) {
        this.endReason = "fall";
        p.enterKo(); // C-13
        this.state = "lost";
        return;
      }
    }
    // Подбор предметов: AABB с героем + окно по глубине |ΔD| ≤ 10 (C-14;
    // в оригинале лежащий предмет берётся при |ΔD| ≤ 6 — collision.md §8);
    // очко начисляется один раз — собранный предмет уходит в Set и
    // исчезает из рендера
    for (const it of this.items) {
      if (this.collected.has(it.id)) continue;
      if (collideRects(p, it) &&
          Math.abs(p.depth - it.depth) <= this.level.depth.pickup) {
        this.collected.add(it.id);
        this.score += SCORE_PER_ITEM;
        this._recordBest(); // рекорд обновляется сразу при превышении (C-06)
        // Эффекты предметов оригинала (C-15, game-rules §1.1): еда ($2D) —
        // полное HP ($051B := $2F); неуязвимость ($2C) — ~5.6 с ($05D1=5
        // зарядов автоподзарядки $0575). 1UP в порту живёт как очки (системы
        // жизней нет — поражение = конец партии, документировано).
        if (it.kind === "food") p.hp = COMBAT.playerHp;
        else if (it.kind === "invuln") p.powerT = 5.6;
      }
    }

    this.updateCamera();
  }

  // ======================= ВРАГИ (C-15) =======================

  // Спаун-директор: записи enemySpawns срабатывают, когда ПРАВЫЙ край
  // экрана достигает триггер+256 (адаптация: вьюпорт 426 px против 256 у
  // NES — в оригинале объект появляется за правым краем, level-format §6).
  // Курсор только вперёд (поток $D0ED не отступает). Лимит ходоков
  // (робот+купол) — 6: при переполнении поток ждёт (как аллокатор $FF20,
  // 13 слотов на всё; у нас ходоки отдельно от транзитных подов/дронов).
  _spawnEnemies() {
    const list = LEVEL1.enemySpawns;
    while (this.spawnNext < list.length) {
      const sp = list[this.spawnNext];
      if (this.cameraX + VIEW_W < sp.trigger + 256) break;
      if (sp.kind === "robot" || sp.kind === "dome") {
        const walkers = this.enemies.filter(
          (e) => (e.kind === "robot" || e.kind === "dome") && e.alive).length;
        if (walkers >= 6) break; // поток ждёт свободного слота
      }
      this.enemies.push(this._makeEnemy(sp));
      this.spawnNext++;
    }
  }

  _makeEnemy(sp) {
    if (sp.kind === "pod") {
      // Под влетает справа сверху и десантирует робота у якоря (тип $10,
      // хендлер $C11F: слетает с высоты, спаунит дитя типа $09)
      const x = this.cameraX + VIEW_W + 40;
      const gy = groundYAt(this.floorPoints, this.floorGaps, sp.x);
      const y = (Number.isFinite(gy) ? gy : 168) - 170;
      return new Enemy(sp, this.level, { x, y, depth: sp.depth });
    }
    if (sp.kind === "drone") {
      // Дрон влетает справа и стягивается к своему якорю-вентиляции
      // (тип $0C; якорь = спаренная запись $0A: spawn.x−28 — C-17)
      const x = this.cameraX + VIEW_W + 40;
      return new Enemy(sp, this.level, { x, y: 60, depth: sp.depth });
    }
    return new Enemy(sp, this.level); // робот/купол — на якоре записи
  }

  // Босс ABOBO (C-22): спаун в конце палубы (триггер BOSS_TRIGGER_X —
  // линия выхода $07B0 оригинала). Босс сбрасывается с неба у правого
  // края арены (BOSS_SPAWN_X): Enemy в состоянии enter падает до палубы,
  // далее «рык» и бой (ветка abobo в Enemy). Арена запирается (левый край
  // BOSS_ARENA_LEFT), main.js по флагу bossActive включает тему босса
  // (трек 7 — её ставит хендлер босса $D938 в оригинале, $DA0C).
  _spawnBoss() {
    this.bossSpawned = true;
    // Арена босса чистая (как в оригинале: бой идёт на запертом экране) —
    // оставшиеся враги уходят, спаун-поток исчерпывается (последние записи
    // потока — дроны у самого края, за боем босса их нет)
    this.enemies = this.enemies.filter((e) => e.stats && e.stats.boss);
    this.spawnNext = LEVEL1.enemySpawns.length;
    const sp = {
      kind: "abobo", trigger: 0x7B0, x: BOSS_SPAWN_X, depth: 264,
      timer: 0, pal: 0,
    };
    const gy = groundYAt(this.floorPoints, this.floorGaps, BOSS_SPAWN_X);
    const floor = Number.isFinite(gy) ? gy : 120;
    const y = floor - 64 - 200; // высоко над палубой — падение на арену
    const b = new Enemy(sp, this.level, { x: BOSS_SPAWN_X - 15, y, depth: 264 });
    this.enemies.push(b);
    this.boss = b;
    this.bossActive = true;
  }

  // KO босса (вызывается из _updateEnemies при res === "ko"): +очки босса
  // (уже начислены вызывателем), снятие запрета арены, старт победного
  // отсчёта (winT) — на выходе игрок неуязвим ($DA≠0 в оригинале).
  _onBossKO() {
    this.bossActive = false;
    this.bossDefeated = true;
    this.winT = BOSS_WIN_DELAY;
  }

  // C-20 (docs/combat.md §3): выбор приёма при нажатии удара по цели в
  // зоне джеба. Правило оригинала $B529: если джеб (урон 4) добил бы цель
  // (HP ≤ 4) — удар заменяется добиванием: гигантский кулак (anim 14) по
  // стоящей цели, гигантский ботинок (anim 20) по лежачей ($04B2 бит 7)
  // или заметно нижней по глубине (адаптация профиля $D1=4 «цель ниже»).
  // Лежачее KO-тело (kickable) — всегда ботинок. Целей нет — обычный джеб.
  _chooseAttackKind(p) {
    const jabHb = ATTACK.hitbox;
    const hb = {
      x: p.facing > 0 ? p.x + jabHb.dx : p.x + p.w - jabHb.dx - jabHb.w,
      y: p.y + jabHb.dy, w: jabHb.w, h: jabHb.h,
    };
    let best = null, bestD = Infinity, bestLying = false;
    for (const e of this.enemies) {
      const lying = typeof e.kickable === "function" && e.kickable();
      if (!lying && !e.hittable()) continue;
      if (!collideRects(hb, e)) continue;
      if (Math.abs(e.depth - p.depth) > 10) continue;
      const d = Math.abs(e.cx - (p.x + p.w / 2));
      if (d < bestD) { bestD = d; best = e; bestLying = lying; }
    }
    if (!best) return "attack";
    if (bestLying) return "boot";
    if (best.hp <= COMBAT.playerPunch.dmg) {
      return best.depth >= p.depth + 12 ? "boot" : "fist";
    }
    return "attack";
  }

  // Тик врагов + бой. Возвращает true, если игрок KO (→ 'lost').
  _updateEnemies(dt) {
    const p = this.player;
    this._spawnEnemies();

    const ctx = { player: p, dt, cameraX: this.cameraX, viewW: VIEW_W };
    for (const e of this.enemies) e.update(dt, ctx);
    // дети подов (десантированные роботы) входят в игру
    for (const e of this.enemies) {
      if (e.child) {
        this.enemies.push(e.child);
        e.child = null;
      }
    }

    // Удар игрока → враги: окно |ΔX| по AABB хитбокса (C-13) + |ΔD| ≤ 10
    // (в оригинале |ΔD| ≤ 8, collision.md §6). Жонглирование станом
    // разрешено. Приём и урон — по рядам $88B8 (C-20, docs/combat.md §5):
    // джеб (anim 2/4) — ряд 0: 4 HP/стан 63; таран (anim 22) — ряд 20:
    // 16 HP/стан 120, проход сквозь цели (многоцелевое попадание);
    // добивания кулак/ботинок (anim 14/20) — ряды 15/30: $FF = KO с
    // отлётом (+200 за KO — отступление, в оригинале очков за убийства нет).
    // Лежачее KO-тело (kickable) бьётся только ботинком — отлетает без
    // очков (добивание тела; у оригинала anim 20 бьёт нокдаун-цель).
    const hb = p.getAttackHitbox();
    if (hb) {
      const kind = p.action.kind;
      const spec = kind === "ram" ? COMBAT.playerRam
        : kind === "fist" ? COMBAT.playerFist
        : kind === "boot" ? COMBAT.playerBoot : COMBAT.playerPunch;
      for (const e of this.enemies) {
        if (e._hitBy === p.action) continue;
        if (!collideRects(hb, e)) continue;
        if (Math.abs(e.depth - p.depth) > 10) continue;
        if (e.hittable()) {
          const res = e.applyHit(spec.dmg, spec.stunTicks, spec.knockback,
            p.x + p.w / 2);
          e._hitBy = p.action;
          if (res === "ko") {
            // ОТСТУПЛЕНИЕ от оригинала: +200 за KO (в BT&DD очков за
            // убийства нет — game-rules §2; у нас счёт и за врагов)
            this.score += e.stats.score || 200;
            this._recordBest();
            if (e.stats.boss) this._onBossKO(); // C-22: победа = KO босса
          }
        } else if (kind === "boot" && e.kickable && e.kickable()) {
          e.applyBootKick(p.x + p.w / 2); // добивание тела ботинком (C-20)
          e._hitBy = p.action;
        }
      }
    }

    // Удары врагов → игрок (окно активной фазы, |ΔD| ≤ 8 как в оригинале)
    // + контакт дронов (строка $CD: урон 8, стан $A0)
    // C-22: после KO босса (победный отсчёт) игрок неуязвим — в оригинале
    // при выходе ($DA≠0) смерти блокируются (game-rules §5.1)
    if (!this.bossDefeated) for (const e of this.enemies) {
      if (e.state === "attack") {
        const box = e.attackBox();
        if (box && !e._didHit && collideRects(box, p) &&
            Math.abs(e.depth - p.depth) <= e.stats.hitD) {
          e._didHit = true;
          const r = p.takeDamage(e.stats.dmg, e.cx);
          if (r === "ko") return this._playerKO();
        }
      } else if (e.kind === "drone" && e.contactArmed()) {
        // Контакт дрона (урон 8 — решение C-15; в ROM $EB выставляется в
        // обеих фазах $0C/$0B). После попадания дрон уходит на возврат к
        // якорю (C-17) — серии попаданий подряд не бывает.
        if (collideRects(e, p) && Math.abs(e.depth - p.depth) <= 10) {
          const r = p.takeDamage(COMBAT.drone.dmg, e.cx);
          if (r) e._setState("return");
          if (r === "ko") return this._playerKO();
        }
      }
    }

    // Деспаун (KO отлежался/улетел, под/дрон ушли)
    if (this.enemies.some((e) => !e.alive)) {
      this.enemies = this.enemies.filter((e) => e.alive);
    }
    return false;
  }

  _playerKO() {
    this.endReason = "ko";
    this.state = "lost";
    return true; // player.enterKo() уже вызван из takeDamage
  }

  // ======================= РЕНДЕР =======================

  render() {
    const ctx = this.ctx;

    // --- Космос (C-11: уровень 1 — в открытом космосе, фон $0F) ---
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    this.renderStars(ctx);

    // --- Мир с проекцией SCALE и камерой ---
    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.translate(-this.cameraX, -Y_CAM);

    this.renderHull(ctx);      // корпус по силуэту + палуба-лента кромок (C-14)
    this.renderBreaches(ctx);  // разлом палубы (провал) с маркировкой
    this.renderDecor(ctx);     // кристаллы/столбы/шашки/лестница по карте
    this.renderPlatforms(ctx); // парящие односторонние платформы-плиты
    this.renderFinish(ctx);    // дверной проём хвоста корабля (декор, C-22)
    // C-14/C-15: сортировка по глубине — дальние предметы/враги за спиной
    // героя, ближние — перед ним; под героем тень-эллипс на линии пола
    this.renderItems(ctx, (it) => it.depth < this.player.depth);
    this.renderEnemies(ctx, (e) => e.depth < this.player.depth);
    this.renderShadow(ctx);
    this.player.render(ctx);   // жаба (мировые координаты 32×48)
    this.renderEnemies(ctx, (e) => e.depth >= this.player.depth);
    this.renderItems(ctx, (it) => it.depth >= this.player.depth);

    ctx.restore();

    // --- HUD без сдвига (C-05/C-06, плашки C-07) ---
    this.renderHud(ctx);

    // Заголовок и подсказка на canvas
    ctx.textAlign = "center";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillStyle = "rgba(4, 10, 14, 0.9)"; // тень под логотипом
    ctx.fillText("BATTLETOADS & DOUBLE DRAGON", WIDTH / 2 + 2, 50);
    ctx.fillStyle = "#b6eae5";
    ctx.fillText("BATTLETOADS & DOUBLE DRAGON", WIDTH / 2, 48);
    ctx.font = "17px system-ui, sans-serif";
    ctx.fillStyle = "#d8f0ee";
    ctx.fillText("Уровень 1 — Хвост Крысолёта (порт NES-оригинала)", WIDTH / 2, 74);

    ctx.font = "16px system-ui, sans-serif";
    ctx.fillStyle = "rgba(216, 240, 238, 0.85)";
    ctx.fillText("←/→ или A/D — движение,  ↑/↓ или W/S — глубина,  Space — прыжок,  J или X — удар (серия),  →→ — рывок,  в рывке J — таран,  дойди до конца палубы и победи босса ABOBO →", WIDTH / 2, HEIGHT - 12);

    // Приглашение — только в ожидании старта (C-04)
    if (this.state === "ready") {
      ctx.fillStyle = "rgba(182, 234, 229, 0.9)";
      ctx.fillText("Нажми «Старт», чтобы начать", WIDTH / 2, 116);
    }

    // Плашки состояний поверх замороженной сцены (C-04/C-05)
    if (this.state === "paused") this.renderPauseOverlay(ctx);
    else if (this.state === "won") this.renderEndOverlay(ctx, true);
    else if (this.state === "lost") this.renderEndOverlay(ctx, false);
  }

  // Звёздное небо: два слоя с параллаксом (дальний медленнее), мерцание.
  // Экранные координаты (до трансформации мира), обёртка по ширине.
  renderStars(ctx) {
    const layers = [
      { f: 0.15, size: 1.5, color: "rgba(87, 165, 255, 0.55)", n: 34 },  // дальний
      { f: 0.45, size: 2.2, color: "rgba(230, 223, 156, 0.85)", n: 22 }, // ближний
    ];
    for (let l = 0; l < layers.length; l++) {
      const L = layers[l];
      ctx.fillStyle = L.color;
      for (let i = 0; i < L.n; i++) {
        const wx = i * 197 + l * 331;
        const sx = (((wx - this.cameraX * L.f) % 1040) + 1040) % 1040 - 40;
        const sy = (i * 89 + l * 173) % 520 + 4;
        const tw = 0.5 + 0.5 * Math.sin(this.time * 2 + i * 1.7 + l);
        ctx.globalAlpha = 0.45 + 0.55 * tw;
        ctx.fillRect(sx, sy, L.size, L.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  // Мировая Y дальней/ближней кромки палубы в точке x (C-14): линия пола
  // профиля $B46B + перспективный сдвиг соответствующей границы глубины.
  _deckFarY(x) {
    return groundYAt(this.floorPoints, null, x) +
      depthShift(this.level, groundYAt(this.level.depthFar, null, x));
  }
  _deckNearY(x) {
    return groundYAt(this.floorPoints, null, x) +
      depthShift(this.level, groundYAt(this.level.depthNear, null, x));
  }

  // Корпус корабля по силуэту карты метатайлов (level1data.silhouette) +
  // ПАЛУБА-ЛЕНТА между кромками глубины (C-14): верхняя обшивка (светлая
  // аква) от гребня силуэта до дальней кромки, палуба между кромками
  // (средняя аква с перспективными рёбрами от дальней кромки к ближней),
  // передний борт (тёмная аква) ниже ближней кромки; швы, иллюминаторы-
  // вентиляторы на высоком борту (мотив level1.png правой половины).
  renderHull(ctx) {
    const sil = this.level.silhouette;
    const cell = 32;
    for (let c = 0; c < sil.length; c++) {
      const s = sil[c];
      if (!s) continue;
      const x = c * cell;
      const top = s[0];
      const bottom = s[1];
      const fyA = this._deckFarY(x + cell / 2);  // дальняя кромка
      const fyN = this._deckNearY(x + cell / 2); // ближняя кромка
      // Верхняя обшивка (над палубой): светлая аква, чередование панелей
      ctx.fillStyle = c % 2 === 0 ? PAL.hullBody : "#35b8c0";
      ctx.fillRect(x, top, cell, Math.max(0, fyA - top));
      // Гребень корпуса — самая светлая полоса
      ctx.fillStyle = PAL.hullTop;
      ctx.fillRect(x, top, cell, 3);
      // Передний борт ниже ближней кромки: тёмная аква
      if (bottom > fyN) {
        ctx.fillStyle = PAL.hullSide;
        ctx.fillRect(x, fyN, cell, bottom - fyN);
        // нижняя кромка борта — тёмная
        ctx.fillStyle = PAL.hullDark;
        ctx.fillRect(x, bottom - 4, cell, 4);
        // швы панелей борта
        if (c % 2 === 0) {
          ctx.fillRect(x, fyN + 4, 2, bottom - fyN - 8);
        }
      }
    }

    // Палуба — лента между дальней и ближней кромками (C-14): сплошной
    // полигон по ломаным кромок; в разломе лента прерывается.
    let spans = [[0, this.level.width]];
    for (const g of this.floorGaps) {
      const next = [];
      for (const [a, b] of spans) {
        if (b <= g.x0 || a >= g.x1) next.push([a, b]);
        else {
          if (a < g.x0) next.push([a, g.x0]);
          if (b > g.x1) next.push([g.x1, b]);
        }
      }
      spans = next;
    }
    const step = 16; // шаг сэмплирования ломаных кромок (узлы кратны 1-32)
    for (const [a, b] of spans) {
      const pts = [];
      for (let x = a; x < b; x += step) pts.push([x, this._deckFarY(x)]);
      pts.push([b, this._deckFarY(b)]);
      for (let x = b; x > a; x -= step) pts.push([x, this._deckNearY(x)]);
      pts.push([a, this._deckNearY(a)]);
      ctx.fillStyle = "#45b7c4"; // палуба — средняя аква между кромок
      polyPath(ctx, pts);
      ctx.fill();
      // Кромки палубы: дальняя — самая светлая линия (граница с обшивкой),
      // ближняя — светлая линия ходовой поверхности (наследие C-11)
      for (let x = a; x < b; x += step) {
        const x2 = Math.min(x + step, b);
        const fa = this._deckFarY(x), fb = this._deckFarY(x2);
        const na = this._deckNearY(x), nb = this._deckNearY(x2);
        ctx.fillStyle = PAL.hullTop;
        polyPath(ctx, [[x, fa - 1], [x2, fb - 1], [x2, fb + 1], [x, fa + 1]]);
        ctx.fill();
        ctx.fillStyle = "#9adfd8";
        polyPath(ctx, [[x, na - 1.5], [x2, nb - 1.5], [x2, nb + 1.5], [x, na + 1.5]]);
        ctx.fill();
      }
    }
    // Перспективные рёбра на палубе (мотив полосатой обшивки level1.png):
    // короткие полосы от дальней кромки к ближней с наклоном (C-14)
    ctx.fillStyle = "rgba(0, 53, 94, 0.30)";
    for (let x = 24; x < this.level.width; x += 48) {
      let inGap = false;
      for (const g of this.floorGaps) {
        if (x >= g.x0 - 16 && x <= g.x1) { inGap = true; break; }
      }
      if (inGap) continue;
      const fa = this._deckFarY(x);
      const na = this._deckNearY(x);
      polyPath(ctx, [
        [x, fa + 2], [x + 3, fa + 2], [x - 9, na - 2], [x - 12, na - 2],
      ]);
      ctx.fill();
    }
    // Иллюминаторы-вентиляторы на высоком борту (верх ≤ 64 — правая часть
    // корпуса; стилизация круглых люков level1.png, детерминированно)
    for (let c = 2; c < sil.length; c += 5) {
      const s = sil[c];
      if (!s || s[0] > 64) continue;
      const fx = c * cell + 16;
      const fy = s[0] + 34;
      fillCircle(ctx, fx, fy, 10, PAL.hullDark, 10);
      fillCircle(ctx, fx, fy, 8, PAL.hullBody, 10);
      ctx.fillStyle = PAL.hullDark;
      ctx.fillRect(fx - 1.5, fy - 7, 3, 14);
      ctx.fillRect(fx - 7, fy - 1.5, 14, 3);
      polyPath(ctx, [[fx - 5, fy - 5], [fx - 2, fy - 2], [fx + 5, fy + 5], [fx + 2, fy + 2]]);
      ctx.fill();
      polyPath(ctx, [[fx + 5, fy - 5], [fx + 2, fy - 2], [fx - 5, fy + 5], [fx - 2, fy + 2]]);
      ctx.fill();
    }
  }

  // Разлом палубы (единственная опасная зона, C-11): тёмный проём на всю
  // глубину палубы (C-14: от дальней кромки вниз через борт) + жёлто-чёрная
  // аварийная маркировка на кромках (мотив caution-панелей level1.png) +
  // тлеющее свечение внутри. Провал бьёт по X независимо от глубины.
  renderBreaches(ctx) {
    for (const hz of this.hazards) {
      const gy = hz.y - 6; // линия пола основного ряда у кромки
      const x1 = hz.x + hz.w;
      const topL = this._deckFarY(hz.x) - 4;
      const topR = this._deckFarY(x1) - 4;
      // проём вниз через борт (в космос под корпусом)
      ctx.fillStyle = "#000000";
      polyPath(ctx, [
        [hz.x, topL], [x1, topR], [x1, this.level.height], [hz.x, this.level.height],
      ]);
      ctx.fill();
      // тлеющее свечение в глубине разлома
      const glow = 0.10 + 0.05 * Math.sin(this.time * 2.2);
      ctx.fillStyle = `rgba(223, 96, 255, ${glow})`;
      ctx.fillRect(hz.x + 4, gy + 26, hz.w - 8, 30);
      // аварийная маркировка у ближней кромки на обоих краях разлома
      drawCaution(ctx, hz.x - 10, this._deckNearY(hz.x - 5) - 2, 10, 8);
      drawCaution(ctx, x1, this._deckNearY(x1 + 5) - 2, 10, 8);
      // рваные кромки обшивки вдоль всей глубины разлома
      ctx.fillStyle = PAL.hullDark;
      polyPath(ctx, [
        [hz.x, topL], [hz.x + 5, topL + 2],
        [hz.x + 2, this._deckNearY(hz.x)], [hz.x, this._deckNearY(hz.x) + 12],
      ]);
      ctx.fill();
      polyPath(ctx, [
        [x1, topR], [x1 - 5, topR + 2],
        [x1 - 2, this._deckNearY(x1)], [x1, this._deckNearY(x1) + 12],
      ]);
      ctx.fill();
    }
  }

  // Враги (C-15): спрайты из ROM (assets/enemies) с перспективным
  // масштабом по глубине (тот же закон, что у героя); pred — фильтр
  // сортировки по глубине относительно героя.
  renderEnemies(ctx, pred) {
    for (const e of this.enemies) {
      if (pred && !pred(e)) continue;
      const cx = e.x + e.w / 2;
      const dFar = groundYAt(this.level.depthFar, null, cx);
      const dNear = groundYAt(this.level.depthNear, null, cx);
      const span = dNear - dFar;
      const s = this.level.depth.farScale + (1 - this.level.depth.farScale) *
        (span > 0 ? (e.depth - dFar) / span : 0.5);
      e.render(ctx, s);
    }
  }

  // Тень-эллипс под героем на линии пола его глубины (C-14): визуальный
  // якорь глубины и высоты прыжка. Полигоном через lineTo — мок-контекст
  // автотестов не знает ellipse/arc (как fillCircle в theme.js). Над
  // разломом тени нет (пола нет).
  renderShadow(ctx) {
    const p = this.player;
    const cx = p.x + p.w / 2;
    const gy = groundYAt(this.floorPoints, this.floorGaps, cx);
    if (!Number.isFinite(gy)) return;
    const y = gy + depthShift(this.level, p.depth);
    const s = p.depthScale || 1;
    ctx.fillStyle = "rgba(2, 20, 26, 0.38)";
    ctx.beginPath();
    const n = 12;
    const rx = 13 * s;
    const ry = 4.2 * s;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const px = cx + Math.cos(a) * rx;
      const py = y + 1 + Math.sin(a) * ry;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Декор по карте метатайлов (истинные позиции, без коллизий):
  // маджентовые кристаллы и полосатые столбы под палубой, подвесные шашки,
  // лестница спуска, аварийная маркировка.
  renderDecor(ctx) {
    for (const d of this.level.decor) {
      if (d.kind === "crystal") {
        // кристалл-капля, свисающий с верха своей группы
        drawCrystal(ctx, d.x + d.w / 2, d.y, Math.min(d.w, 48), d.h, this.time);
      } else if (d.kind === "pole") {
        drawStripedPole(ctx, d.x + d.w / 2, d.y, d.y + d.h, 12,
          PAL.crystalBody, PAL.crystalLight);
      } else if (d.kind === "checker") {
        drawChecker(ctx, d.x, d.y, d.w, d.h);
      } else if (d.kind === "caution") {
        drawCaution(ctx, d.x, d.y + d.h - 12, d.w, 12);
      } else if (d.kind === "stairs") {
        // лестница спуска с высокого плато (мотив диагональной структуры
        // level1.png x≈800-928): ступени вниз вправо по bbox группы
        const steps = 8;
        for (let k = 0; k < steps; k++) {
          const sx = d.x + (k * d.w) / steps;
          const sy = d.y + (k * d.h) / steps;
          ctx.fillStyle = k % 2 === 0 ? PAL.hullTop : PAL.hullBody;
          ctx.fillRect(sx, sy, d.w / steps + 3, 8);
          ctx.fillStyle = PAL.hullDark;
          ctx.fillRect(sx, sy + 8, d.w / steps + 3, 3);
        }
      }
    }
  }

  // Парящие односторонние платформы (C-11): шашечная плита (мотив подвесных
  // шашек карты) + свечение под низом. C-14: плита перекрывает всю полосу
  // глубины — верхняя грань от дальней кромки, передняя грань до ближней
  // (общее правило перспективного сдвига; коллизия — по верху на глубине
  // героя). Приземление — только сверху.
  renderPlatforms(ctx) {
    for (const p of this.platforms) {
      const cx = p.x + p.w / 2;
      const dyF = depthShift(this.level,
        groundYAt(this.level.depthFar, null, cx));
      const dyN = depthShift(this.level,
        groundYAt(this.level.depthNear, null, cx));
      ctx.fillStyle = "rgba(182, 234, 229, 0.25)"; // свечение-нимб
      ctx.fillRect(p.x - 2, p.y + p.h + dyN, p.w + 4, 3);
      drawChecker(ctx, p.x, p.y + dyF, p.w, p.h + (dyN - dyF));
      ctx.fillStyle = PAL.hullDark; // тёмная кромка низа (передняя грань)
      ctx.fillRect(p.x, p.y + p.h + dyN - 2, p.w, 2);
    }
  }

  // Предметы (C-05, позиции C-11 из спаун-потока $50, глубина C-14):
  // металлический ящик энергии — заклёпки по углам, обечайка, светящееся
  // ядро цветом по подтипу оригинала (1UP/еда/очки/неуязвимость) с
  // мерцанием; собранный не рисуется. y в данных уже на своей глубине.
  // pred — фильтр глубины для сортировки относительно героя (C-14).
  renderItems(ctx, pred) {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (this.collected.has(it.id)) continue;
      if (pred && !pred(it)) continue;
      const pulse = 0.55 + 0.45 * Math.sin(this.time * 5 + i * 2.17);
      const core = PAL.itemCores[it.kind] || PAL.crateCore;
      // Тело ящика (металл $00/$10) — строго по геометрии предмета
      ctx.fillStyle = PAL.crateDark; // обечайка на 1 px шире тела
      ctx.fillRect(it.x - 1, it.y - 1, it.w + 2, it.h + 2);
      ctx.fillStyle = PAL.crateBody;
      ctx.fillRect(it.x, it.y, it.w, it.h);
      ctx.fillStyle = PAL.crateLight; // верхняя кромка-отблеск
      ctx.fillRect(it.x, it.y, it.w, 3);
      ctx.fillStyle = PAL.crateDark; // нижняя тень
      ctx.fillRect(it.x, it.y + it.h - 3, it.w, 3);
      // Заклёпки по углам
      ctx.fillStyle = "#c8c8d0";
      ctx.fillRect(it.x + 2, it.y + 2, 2, 2);
      ctx.fillRect(it.x + it.w - 4, it.y + 2, 2, 2);
      ctx.fillRect(it.x + 2, it.y + it.h - 4, 2, 2);
      ctx.fillRect(it.x + it.w - 4, it.y + it.h - 4, 2, 2);
      // Гнездо ядра
      ctx.fillStyle = "#241c08";
      ctx.fillRect(it.x + 4, it.y + 5, it.w - 8, it.h - 9);
      // Ореол и светящееся ядро с мерцанием
      ctx.globalAlpha = pulse * 0.35;
      ctx.fillStyle = core;
      ctx.fillRect(it.x + 3, it.y + 4, it.w - 6, it.h - 7);
      ctx.globalAlpha = pulse;
      ctx.fillRect(it.x + 5, it.y + 6, it.w - 10, it.h - 11);
      ctx.globalAlpha = 1;
    }
  }

  // Дверной проём в хвостовой части корпуса (объект $4F, якорь X=2192 —
  // тёмный проём на склоне, как в level1.png). C-22: флаг-маяк и логика
  // «выход открыт при 6/6» убраны — уровень кончается боем с боссом ABOBO;
  // проём остаётся декором-маяком конца палубы (всегда приглушён).
  renderFinish(ctx) {
    const d = this.level.finishDoor;
    const gyL = groundYAt(this.floorPoints, null, d.x);
    const gyR = groundYAt(this.floorPoints, null, d.x + d.w);
    // свечение у подножия проёма
    ctx.fillStyle = "rgba(160, 190, 190, 0.14)";
    polyPath(ctx, [[d.x - 8, gyL], [d.x + d.w + 8, gyR], [d.x + d.w + 8, gyR + 4], [d.x - 8, gyL + 4]]);
    ctx.fill();
    // сам проём: тёмный четырёхугольник на склоне
    ctx.fillStyle = "#020608";
    polyPath(ctx, [
      [d.x, gyL], [d.x + d.w, gyR],
      [d.x + d.w, gyR - d.h], [d.x, gyL - d.h],
    ]);
    ctx.fill();
    // аква-окантовка проёма (приглушённая)
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = PAL.hullSide;
    polyPath(ctx, [
      [d.x, gyL], [d.x + 5, gyL - 2], [d.x + 5, gyL - d.h + 2], [d.x, gyL - d.h],
    ]);
    ctx.fill();
    polyPath(ctx, [
      [d.x + d.w, gyR], [d.x + d.w - 5, gyR - 2], [d.x + d.w - 5, gyR - d.h + 2], [d.x + d.w, gyR - d.h],
    ]);
    ctx.fill();
    polyPath(ctx, [
      [d.x, gyL - d.h], [d.x + d.w, gyR - d.h],
      [d.x + d.w, gyR - d.h + 4], [d.x, gyL - d.h + 4],
    ]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // HUD (C-05/C-06, плашки C-07): собрано предметов, очки и рекорд +
  // индикатор позиции в уровне (мир длинный — 2304 px, C-11).
  renderHud(ctx) {
    drawPanel(ctx, 8, 8, 176, 30);
    // мини-иконка ящика энергии слева
    ctx.fillStyle = PAL.crateDark;
    ctx.fillRect(14, 15, 14, 14);
    ctx.fillStyle = PAL.crateLight;
    ctx.fillRect(14, 15, 14, 2);
    ctx.fillStyle = PAL.crateCore;
    ctx.fillRect(18, 20, 6, 5);
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = PAL.hudAmber;
    ctx.fillText(`Предметы: ${this.collected.size}/${this.items.length}`, 36, 30);

    // HP-бар (C-15): 6 ячеек, пороги таблицы $D05D оригинала
    // (01 09 11 19 21 29 = 1/9/17/25/33/41 — game-rules §2); пустые ячейки
    // тёмные. Мерцает при критическом HP (≤ 2 ячейки).
    const hpX = 8, hpY = 44;
    drawPanel(ctx, hpX, hpY, 176, 24);
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = "#d8f0ee";
    ctx.fillText("HP", hpX + 8, hpY + 17);
    const thr = COMBAT.hpBarThresholds;
    const critical = this.player.hp <= thr[1] && this.player.hp > 0;
    const blink = !critical || Math.floor(this.time * 6) % 2 === 0;
    for (let i = 0; i < 6; i++) {
      const full = this.player.hp >= thr[i];
      const cx0 = hpX + 32 + i * 23;
      ctx.fillStyle = "rgba(2, 20, 26, 0.85)";
      ctx.fillRect(cx0, hpY + 6, 19, 12);
      if (full && blink) {
        ctx.fillStyle = this.player.hp > thr[3] ? "#3ec048"
          : this.player.hp > thr[1] ? "#e8c838" : "#e04828";
        ctx.fillRect(cx0 + 1, hpY + 7, 17, 10);
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(cx0 + 1, hpY + 7, 17, 3);
      }
    }
    drawPanel(ctx, WIDTH - 192, 8, 184, 52);
    ctx.textAlign = "right";
    ctx.fillText(`Очки: ${this.score}`, WIDTH - 16, 30);
    ctx.fillText(`Рекорд: ${this.best}`, WIDTH - 16, 54);

    // Индикатор позиции: полоса прогресса уровня (герой — зелёная метка)
    const bx = WIDTH / 2 - 130, bw = 260;
    drawPanel(ctx, bx - 6, 8, bw + 12, 14);
    ctx.fillStyle = "rgba(0, 53, 94, 0.8)";
    ctx.fillRect(bx, 12, bw, 6);
    ctx.fillStyle = PAL.hullTop;
    ctx.fillRect(bx, 12, bw * Math.min(1, (this.player.x + this.player.w) / this.level.width), 6);
    ctx.fillStyle = PAL.toadLight;
    const px = bx + bw * (this.player.x / this.level.width);
    ctx.fillRect(px - 2, 10, 4, 10);

    // HP-бар босса (C-22): плашка внизу экрана, пока босс на арене.
    // В оригинале босс-бара нет (HUD-билдер $CFDD рисует только счёт/HP
    // игрока/жизни — game-rules §2) — это дополнение порта.
    const b = this.boss;
    if (b && (this.bossActive || (b.alive && b.state !== "enter"))) {
      const maxHp = COMBAT.abobo.hp;
      const bwX = WIDTH / 2 - 150, bwW = 300, bwY = HEIGHT - 64;
      drawPanel(ctx, bwX - 6, bwY - 6, bwW + 12, 30);
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "#f0b0a0";
      ctx.fillText("ABOBO", bwX + 4, bwY + 14);
      // полоска HP: тёмная подложка + красная заливка по доле HP
      const barX = bwX + 68, barW = bwW - 76;
      ctx.fillStyle = "rgba(2, 20, 26, 0.85)";
      ctx.fillRect(barX, bwY + 3, barW, 12);
      const frac = Math.max(0, Math.min(1, b.hp / maxHp));
      if (frac > 0) {
        ctx.fillStyle = frac > 0.5 ? "#e04828" : frac > 0.25 ? "#e08828" : "#e8c838";
        ctx.fillRect(barX + 1, bwY + 4, (barW - 2) * frac, 10);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(barX + 1, bwY + 4, (barW - 2) * frac, 3);
      }
    }
  }

  // Полупрозрачная плашка «ПАУЗА» поверх замороженной сцены (C-04);
  // затемнение rgba(10,6,8,0.55) — точное значение из C-04 (на него
  // опирается регрессия smoke-c04).
  renderPauseOverlay(ctx) {
    ctx.fillStyle = "rgba(10, 6, 8, 0.55)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawPanel(ctx, WIDTH / 2 - 190, HEIGHT / 2 - 64, 380, 116, "rgba(4, 12, 16, 0.9)");
    ctx.textAlign = "center";
    ctx.fillStyle = "#d8f0ee";
    ctx.font = "bold 48px system-ui, sans-serif";
    ctx.fillText("ПАУЗА", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillStyle = "rgba(216, 240, 238, 0.85)";
    ctx.fillText("Нажми «Продолжить», чтобы играть дальше", WIDTH / 2, HEIGHT / 2 + 30);
  }

  // Экран результата (C-05/C-06, оформление C-07/C-11): стилизованная
  // панель — победа в зелёной гамме с эмблемой жабы, поражение в красной с
  // черепом; счёт и рекорд сохранены. Сцена под плашкой заморожена: update
  // в 'won'/'lost' не выполняется.
  renderEndOverlay(ctx, won) {
    ctx.fillStyle = won ? "rgba(8, 24, 10, 0.62)" : "rgba(24, 8, 8, 0.62)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Панель результата с цветной кромкой
    const px = WIDTH / 2 - 280, py = HEIGHT / 2 - 130, pw = 560, ph = 250;
    drawPanel(ctx, px, py, pw, ph, won ? "rgba(10, 26, 12, 0.92)" : "rgba(26, 10, 10, 0.92)",
      won ? "#3ec048" : "#a92704");

    // Эмблема: победа — мини-морда жабы; поражение — череп
    if (won) {
      const ex = WIDTH / 2 - 218, ey = py + 34;
      fillCircle(ctx, ex, ey, 16, PAL.toadDark, 12);
      fillCircle(ctx, ex, ey, 13, PAL.toadBody, 12);
      fillCircle(ctx, ex - 5, ey - 8, 4.5, PAL.toadBody, 8);
      fillCircle(ctx, ex + 5, ey - 8, 4.5, PAL.toadBody, 8);
      fillCircle(ctx, ex - 4, ey - 9, 2.2, PAL.toadEye, 8);
      fillCircle(ctx, ex + 6, ey - 9, 2.2, PAL.toadEye, 8);
      fillCircle(ctx, ex - 3.6, ey - 9, 1.0, PAL.toadPupil, 6);
      fillCircle(ctx, ex + 6.4, ey - 9, 1.0, PAL.toadPupil, 6);
      ctx.fillStyle = PAL.toadBelly; // усмешка победителя
      ctx.fillRect(ex - 5, ey + 4, 10, 2);
    } else {
      drawSkull(ctx, WIDTH / 2 - 218, py + 34, 4, "#e8e4d0", "#20060a");
    }

    ctx.textAlign = "center";
    if (won) {
      ctx.fillStyle = "#a0f070";
      ctx.font = "bold 46px system-ui, sans-serif";
      ctx.fillText("ПОБЕДА! Уровень пройден", WIDTH / 2, HEIGHT / 2 - 40);
    } else {
      ctx.fillStyle = "#ff8060";
      ctx.font = "bold 46px system-ui, sans-serif";
      ctx.fillText("ПОРАЖЕНИЕ", WIDTH / 2, HEIGHT / 2 - 40);
      ctx.font = "20px system-ui, sans-serif";
      ctx.fillStyle = "#f0d0c0";
      ctx.fillText(
        this.endReason === "pit" ? "Провалился сквозь разлом палубы"
          : this.endReason === "ko" ? "Нокаут: HP исчерпано в бою с роботами"
          : "Падение в бездну космоса",
        WIDTH / 2, HEIGHT / 2 - 4
      );
    }
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillStyle = "#ffe8a0";
    ctx.fillText(
      `Очки: ${this.score}   ·   Предметы: ${this.collected.size}/${this.items.length}`,
      WIDTH / 2, HEIGHT / 2 + 30
    );
    // Рекорд (C-06): подсвечиваем, если текущая партия его побила
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillStyle = this.newRecord ? "#a0f070" : "rgba(255, 232, 160, 0.85)";
    ctx.fillText(
      `Рекорд: ${this.best}${this.newRecord ? " — новый!" : ""}`,
      WIDTH / 2, HEIGHT / 2 + 60
    );
    ctx.font = "18px system-ui, sans-serif";
    ctx.fillStyle = "rgba(240, 224, 200, 0.9)";
    ctx.fillText("Нажми «Заново», чтобы сыграть ещё раз", WIDTH / 2, HEIGHT / 2 + 90);
  }
}
