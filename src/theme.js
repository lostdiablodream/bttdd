// theme.js — оформление в теме BT&DD (C-07; палитра уровня 1 исправлена
// в C-11 на АКВА по настоящей записи состояния $A19A): цвета из извлечённых
// палитр оригинала и низкоуровневые рисовалки фигурами Canvas (без картинок).
//
// Источники цветов (реверс, docs/palettes.md + tools/nespal.py, мастер-
// палитра 2C02; скобки — NES-индексы):
//   - фоновая палитра уровня 1 = s6pal 01 ($A446 слот 6, palX=$02 записи
//     $A19A[$A0EC[4]]): `0F 1C 2C 3C | 0F 04 14 24 | 0F 0C 1C 28 | 0F 0C 26 20`
//     — аква-обшивка корпуса ($1C/$2C/$3C), маджента кристаллов и столбов
//     ($04/$14/$24), сине-жёлтая маркировка ($0C/$1C/$28), сине-белые
//     шашки ($0C/$26/$20); эррата про $A426 — docs/level-format.md;
//   - спрайтовая палитра уровня 1 = s6pal 12 ($A4D6, palY=$18): зелень жаб
//     `0F 0F 0A 1A | ...`; тело жабы — как в C-07 (фрагмент $E8B6 №6);
//   - кроссовки жаб — белые (по спрайт-листу персонажей).
//
// ВАЖНО: рендер игры прогоняется автотестами на мок-контексте, в котором
// есть ТОЛЬКО: fillRect, fillText, beginPath/moveTo/lineTo/closePath/fill,
// save/restore/translate/rotate/scale, createLinearGradient и свойства
// fillStyle/strokeStyle/font/textAlign/globalAlpha. Поэтому здесь нельзя
// использовать arc/ellipse/stroke*/quadraticCurveTo и т.п. — «круги»
// рисуются полигоном через lineTo (заодно даёт NES-пиксельный дух).

// NES-цвета (индекс мастер-палитры → RGB из tools/nespal.py)
export const NES = {
  BLACK: "#000000",       // $0F
  DARK_RED: "#650500",    // $06
  DARK_BROWN: "#491e00",  // $07
  BROWN: "#894600",       // $17
  ORANGE: "#de9020",      // $27
  RED: "#a92704",         // $16
  LIGHT_RED: "#f8746d",   // $26
  DARK_BLUE: "#001c95",   // $01
  BLUE: "#0c4edb",        // $11
  LIGHT_BLUE: "#57a5ff",  // $21
  DARK_GREEN: "#004f00",  // $0A
  GREEN: "#008900",       // $1A
  BRIGHT_GREEN: "#56d522",// $2A
  PALE_GREEN: "#c2efa8",  // $3A
  OLIVE: "#b3ae00",       // $28
  CREAM: "#e6df9c",       // $38
  GRAY: "#626262",        // $00
  LIGHT_GRAY: "#ababab",  // $10
  WHITE: "#ffffff",       // $20
  // Аква-гамма уровня 1 (s6pal 01, $A446)
  AQUA_DARK: "#006d90",   // $1C
  AQUA: "#3ec1c8",        // $2C
  AQUA_PALE: "#b6eae5",   // $3C
  HULL_NAVY: "#00355e",   // $0C
  MAGENTA_DARK: "#61006b",// $04
  MAGENTA: "#9b0bb9",     // $14
  MAGENTA_LIGHT: "#df60ff",// $24
  CAUTION: "#b3ae00",     // $28
};

// Рабочая палитра сцены (база — цвета NES выше).
export const PAL = {
  // Жаба: тело (между NES $1A и обложечным зелёным), свет/тень, пузо ($3A),
  // кроссовки — белые (спрайт-лист персонажей)
  toadBody: "#3aa24a",
  toadLight: "#56d522",
  toadDark: "#0d4a1a",
  toadBelly: "#c2efa8",
  toadEye: "#f4f8e8",
  toadPupil: "#142014",
  toadShoe: "#f0f4e8",
  toadShoeDark: "#b8c4b0",
  // Корпус корабля: аква-обшивка ($1C/$2C/$3C), тёмные борта ($0C)
  hullTop: NES.AQUA_PALE,   // верхняя палуба (светлая, $3C)
  hullBody: NES.AQUA,       // обшивка ($2C)
  hullSide: NES.AQUA_DARK,  // борт ($1C)
  hullDark: NES.HULL_NAVY,  // тень/швы ($0C)
  // Маджента кристаллов и столбов ($04/$14/$24)
  crystalDark: NES.MAGENTA_DARK,
  crystalBody: NES.MAGENTA,
  crystalLight: NES.MAGENTA_LIGHT,
  // Маркировка (жёлто-чёрная, $28) и шашки (розово-белые, $26/$20)
  caution: NES.CAUTION,
  checkerA: NES.LIGHT_RED,
  checkerB: NES.WHITE,
  // Ящик энергии: металл ($00/$10) + ядро (цвет — по подтипу предмета)
  crateBody: "#4a4a52",
  crateLight: "#9a9aa8",
  crateDark: "#1c1c24",
  crateCore: "#ffe040",
  // Ядра по подтипу оригинала (байт +9 спауна, docs/game-rules.md):
  // 1UP — зелёный, еда — красный, очки — золото, неуязвимость — аква
  itemCores: {
    "1up": "#56d522",
    food: "#f8746d",
    points: "#ffe040",
    invuln: "#57a5ff",
  },
  // Текст/HUD
  hudAmber: "#ffe8a0",
  hudPanel: "rgba(4, 10, 14, 0.72)",
  hudBorder: "#2c7c8c",
};

// Ломаная по массиву точек [[x,y],...] (контур для fill()).
export function polyPath(ctx, pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i][0], pts[i][1]);
    else ctx.lineTo(pts[i][0], pts[i][1]);
  }
  ctx.closePath();
}

// Полигон-«круг»: кольцевая аппроксимация через lineTo (мок-безопасно,
// arc() в моках автотестов отсутствует). seg=8 даёт рубленый NES-вид.
export function circlePath(ctx, cx, cy, r, seg) {
  const n = seg || 10;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function fillCircle(ctx, cx, cy, r, color, seg) {
  ctx.fillStyle = color;
  circlePath(ctx, cx, cy, r, seg);
  ctx.fill();
}

// Плашка панели: тёмная подложка + двойная кромка (внешняя яркая,
// внутренняя тёмная) — как таблички HUD в оригинале.
export function drawPanel(ctx, x, y, w, h, bg, border) {
  ctx.fillStyle = bg || PAL.hudPanel;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border || PAL.hudBorder;
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x + w - 2, y, 2, h);
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(x + 3, y + 3, w - 6, 1);
  ctx.fillRect(x + 3, y + h - 4, w - 6, 1);
}

// Пиксельный череп (эмблема Dark Queen / поражение): s — размер «пикселя».
// Силуэт 7×6 пикселей + тёмные глазницы/носовая щель, зубы снизу.
export function drawSkull(ctx, cx, cy, s, bone, dark) {
  const u = s;
  const b = bone || "#e8e4d0";
  const d = dark || "#18060a";
  ctx.fillStyle = b;
  // Черепная коробка (ступенчатый силуэт)
  ctx.fillRect(cx - 2.5 * u, cy - 3 * u, 5 * u, u);       // макушка
  ctx.fillRect(cx - 3 * u, cy - 2 * u, 6 * u, 3 * u);     // бока
  ctx.fillRect(cx - 2 * u, cy + 1 * u, 4 * u, u);         // скулы
  // Челюсть: три зуба
  ctx.fillRect(cx - 1.5 * u, cy + 2 * u, u, u);
  ctx.fillRect(cx - 0.5 * u, cy + 2 * u, u, u);
  ctx.fillRect(cx + 0.5 * u, cy + 2 * u, u, u);
  // Глазницы и нос
  ctx.fillStyle = d;
  ctx.fillRect(cx - 2 * u, cy - 1.5 * u, 1.5 * u, 1.5 * u);
  ctx.fillRect(cx + 0.5 * u, cy - 1.5 * u, 1.5 * u, 1.5 * u);
  ctx.fillRect(cx - 0.5 * u, cy + 0.2 * u, u, u);
}

// Маджентовый кристалл, свисающий с корпуса (мотив level1.png: гранёный
// ромб-капля $04/$14/$24). Верхняя грань на y0, остриё вниз на h.
export function drawCrystal(ctx, cx, y0, w, h, time) {
  const glint = 0.55 + 0.45 * Math.sin(time * 2.4 + cx * 0.05); // мерцание грани
  // Тело кристалла: двускатный верх + длинное остриё (ступенчатый силуэт)
  ctx.fillStyle = PAL.crystalDark;
  polyPath(ctx, [
    [cx - w / 2, y0], [cx + w / 2, y0], [cx + w * 0.38, y0 + h * 0.3],
    [cx + w * 0.14, y0 + h], [cx - w * 0.14, y0 + h], [cx - w * 0.38, y0 + h * 0.3],
  ]);
  ctx.fill();
  // Основная грань
  ctx.fillStyle = PAL.crystalBody;
  polyPath(ctx, [
    [cx - w * 0.38, y0 + 2], [cx + w * 0.1, y0 + 2], [cx + w * 0.26, y0 + h * 0.3],
    [cx + w * 0.08, y0 + h - 2], [cx - w * 0.08, y0 + h - 2], [cx - w * 0.26, y0 + h * 0.3],
  ]);
  ctx.fill();
  // Светлая грань-отблеск (мерцает)
  ctx.globalAlpha = glint;
  ctx.fillStyle = PAL.crystalLight;
  polyPath(ctx, [
    [cx + w * 0.1, y0 + 2], [cx + w * 0.38, y0 + 2], [cx + w * 0.26, y0 + h * 0.3],
    [cx + w * 0.08, y0 + h - 2],
  ]);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// Полосатый столб, свисающий с корпуса (мотив level1.png: сегментированные
// колонны — маджентовые и сине-белые): чередующиеся кольца двух цветов.
export function drawStripedPole(ctx, cx, y0, y1, w, cA, cB) {
  if (y1 - y0 < 6) return;
  const x = cx - w / 2;
  const seg = 7; // высота сегмента-кольца
  let flip = false;
  for (let y = y0; y < y1; y += seg) {
    ctx.fillStyle = flip ? cA : cB;
    ctx.fillRect(x, y, w, Math.min(seg, y1 - y));
    flip = !flip;
  }
  // световая кромка слева
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.fillRect(x, y0, 2, y1 - y0);
  // «капитель» у корпуса
  ctx.fillStyle = cA;
  ctx.fillRect(x - 2, y0, w + 4, 4);
}

// Подвесная шашечная платформа/деталь (розово-белые квадраты $26/$20,
// мотив level1.png рядов 6-7).
export function drawChecker(ctx, x, y, w, h) {
  const s = 8; // сторона шашки
  for (let ry = 0; ry < h; ry += s) {
    for (let rx = 0; rx < w; rx += s) {
      ctx.fillStyle = ((rx / s + ry / s) % 2 === 0) ? PAL.checkerA : PAL.checkerB;
      ctx.fillRect(x + rx, y + ry, Math.min(s, w - rx), Math.min(s, h - ry));
    }
  }
  // тёмная окантовка
  ctx.fillStyle = "rgba(0, 20, 30, 0.55)";
  ctx.fillRect(x, y + h - 2, w, 2);
}

// Жёлто-чёрная аварийная маркировка ($28/чёрный, диагональные полосы).
export function drawCaution(ctx, x, y, w, h) {
  ctx.fillStyle = "#14100a";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.caution;
  const step = 12;
  for (let d = -h; d < w; d += step) {
    // диагональная полоса параллелограммом (наклон 1:1)
    polyPath(ctx, [
      [x + d, y + h], [x + d + 6, y + h], [x + d + 6 + h, y], [x + d + h, y],
    ]);
    ctx.fill();
  }
}
