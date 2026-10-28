// collision.js — столкновения.
// collideRects — базовая AABB-проверка пересечения двух прямоугольников (C-01).
// resolvePlayerPlatforms — разрешение столкновений игрока с платформами
// уровня по сторонам с приоритетом по прежнему положению (C-03); платформы
// с oneWay (порт уровня 1, C-11) — односторонние: только приземление сверху
// (как в оригинале — collision.md §4: «сквозь платформу снизу прыжок
// проходит, сверху — приземление»).
// groundYAt / resolvePlayerTerrain — высотное поле пола по ломаной
// floorPoints с провалами floorGaps (C-11, профиль $B46B): удержание на
// склонах 45° (шаг вверх ≤ STEP_UP и прилипание на спуске ≤ SNAP_DOWN за
// кадр), провал (пол Infinity) — падение.
// C-14 (ось глубины): depthOffset — перспективный сдвиг экранной Y палубы
// на глубине игрока ((D−264)×0.9, считает Game по depthFar/depthNear);
// пол и платформы сдвигаются на него (общее правило «всё на глубине D
// выше/ниже на depthOffset»). Вызовы без depthOffset (старые тесты)
// работают как раньше. Дополнительно у односторонних платформ — клауза
// следования за верхом при ходьбе по глубине (wasGrounded): верх плиты
// сдвигается на ≤1 px/кадр, и стоящий герой не должен проваливаться.

// a, b — объекты {x, y, w, h}. Возвращает true, если прямоугольники пересекаются.
export function collideRects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// Разрешение столкновений игрока с платформами (C-03).
// player — {x, y, w, h, vx, vy, onGround}; platforms — [{x, y, w, h}];
// prevX/prevY — позиция игрока в начале кадра (Player.update сохраняет их
// в player.prevX/prevY до интеграции).
//
// Приоритет сторон — по тому, где игрок БЫЛ относительно платформы:
//   был не ниже верха (prevBottom <= top) и за кадр пересёк верх вниз
//     → приземление: y = top - h, vy = 0, onGround = true;
//   был не выше низа (prevTop >= bottom) и пересёк низ вверх
//     → удар головой: y = bottom, vy = 0;
//   конечный AABB пересекается, пришёл строго слева/справа (по prevX)
//     → выталкивание по X, vx = 0;
//   угловой остаток (prev уже внутри по X) → выталкивание по оси
//     минимального проникновения.
//
// Анти-туннелирование: пересечение плоскостей top/bottom проверяется по
// траектории кадра (prev ↔ cur), а не только по конечному AABB — падение
// на большом dt (шаг ≤ 0.05 с, vy ≤ 240 px/с → ≤ 12 px/кадр) всё равно
// ловится приземлением, даже если конечная позиция глубоко внутри платформы.
// Движение вверх не может дать ложное приземление: при vy < 0 условия
// prevBottom <= top и curBottom >= top несовместимы.
// onGround пересчитывается каждый кадр: true, если было приземление
// (стояние на опоре — это приземление каждый кадр: гравитация втаскивает
// ноги под верх платформы на долю пикселя, разрешение возвращает обратно).
// depthOffset (C-14) — перспективный сдвиг палубы на глубине игрока;
// wasGrounded (C-14) — опора прошлого кадра: включает клаузу следования за
// верхом плиты при его сдвиге глубиной (окно как у склона пола).
export function resolvePlayerPlatforms(player, platforms, prevX, prevY, depthOffset, wasGrounded) {
  const w = player.w;
  const h = player.h;
  const dy = depthOffset || 0;
  let onGround = false;

  for (const p of platforms) {
    const pTop = p.y + dy;
    const pBottom = p.y + p.h + dy;
    const pLeft = p.x;
    const pRight = p.x + p.w;
    const prevBottom = prevY + h;
    const prevTop = prevY;
    const curBottom = player.y + h;
    const curTop = player.y;
    const overlapX = player.x < pRight && player.x + w > pLeft;

    // Односторонняя платформа (C-11): только приземление сверху по
    // траектории; снизу и с боков проходит свободно.
    if (p.oneWay) {
      const landed = overlapX && prevBottom <= pTop && curBottom >= pTop;
      // Следование за верхом плиты при её сдвиге глубиной (C-14): герой
      // стоял на ней кадр назад (низ был у верха ±1 px) и остаётся в окне —
      // иначе шаг вглубь (верх уходит вверх на ≤1 px/кадр) «выбивал» бы
      // опору. prevBottom ≤ pTop+1 исключает «засасывание» снизу (вакуум):
      // идущий по полу под плитой имеет низ заметно ниже верха (32 px).
      const follow = overlapX && (wasGrounded || player.onGround) &&
        player.vy >= 0 && prevBottom <= pTop + 1 && prevBottom >= pTop - SNAP_DOWN &&
        curBottom > pTop - SNAP_DOWN && curBottom - pTop <= STEP_UP;
      if (landed || follow) {
        player.y = pTop - h;
        if (player.vy > 0) player.vy = 0;
        onGround = true;
      }
      continue;
    }

    // Сверху: ноги были не ниже верха и пересекли его за кадр (траектория)
    if (overlapX && prevBottom <= pTop && curBottom >= pTop) {
      player.y = pTop - h;
      if (player.vy > 0) player.vy = 0;
      onGround = true;
      continue;
    }
    // Снизу: голова была не выше низа и пересекла его за кадр (траектория)
    if (overlapX && prevTop >= pBottom && curTop <= pBottom) {
      player.y = pBottom;
      if (player.vy < 0) player.vy = 0;
      continue;
    }
    // Сбоку — только при реальном пересечении конечного AABB
    if (!collideRects(player, p)) continue;
    if (prevX + w <= pLeft) {
      player.x = pLeft - w; // пришёл слева
      if (player.vx > 0) player.vx = 0;
    } else if (prevX >= pRight) {
      player.x = pRight; // пришёл справа
      if (player.vx < 0) player.vx = 0;
    } else {
      // Угловой случай: по prevX уже внутри — вытолкнуть по минимальному
      // проникновению (редкий путь; основные стороны закрыты выше).
      const pushLeft = player.x + w - pLeft;
      const pushRight = pRight - player.x;
      const pushUp = player.y + h - pTop;
      const pushDown = pBottom - player.y;
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushUp) {
        player.y = pTop - h;
        if (player.vy > 0) player.vy = 0;
        onGround = true;
      } else if (min === pushDown) {
        player.y = pBottom;
        if (player.vy < 0) player.vy = 0;
      } else if (min === pushLeft) {
        player.x = pLeft - w;
        if (player.vx > 0) player.vx = 0;
      } else {
        player.x = pRight;
        if (player.vx < 0) player.vx = 0;
      }
    }
  }

  player.onGround = onGround;
  return player;
}

// --- Высотное поле пола (C-11: профиль $B46B уровня 1) ---

// Максимальный подхват вверх за кадр при ходьбе по склону (px): склоны
// профиля 45° при скорости 120 px/с дают ≤2 px/кадр — запас втрое.
const STEP_UP = 6;
// Прилипание к полу на спуске (px): без него герой «сыплется» микро-
// прыжками вниз по склону 45° (пол уходит вниз на ~2 px/кадр).
const SNAP_DOWN = 10;

// Высота поверхности пола (worldY) в точке x по ломаной points
// [[x, y], ...]; в провалах gaps [{x0, x1}] пола нет — Infinity.
export function groundYAt(points, gaps, x) {
  if (gaps) {
    for (const g of gaps) {
      if (x >= g.x0 && x < g.x1) return Infinity;
    }
  }
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      if (x1 === x0) return y1;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

// Разрешение столкновений игрока с высотным полом. Сэмпл — две точки ступней
// (x+2 и x+w−2): стоит, пока хоть одна ступня над полом (по аналогии с
// краями платформ); пол берётся по более ВЫСОКОМУ из двух (min Y).
// wasGrounded — опора прошлого кадра (или приземление на платформу в этом
// кадре): включает следование склону (шаг вверх/прилипание вниз).
// depthOffset (C-14) — перспективный сдвиг линии пола на глубине игрока:
// линия на глубине D = профиль(X) + depthOffset; то же окно склона
// поглощает и сдвиг линии при ходьбе по глубине (≤1 px/кадр).
// Возвращает true, если игрок стоит на полу после разрешения.
export function resolvePlayerTerrain(player, points, gaps, prevY, wasGrounded, depthOffset) {
  const w = player.w;
  const h = player.h;
  const dy = depthOffset || 0;
  const gyL = groundYAt(points, gaps, player.x + 2);
  const gyR = groundYAt(points, gaps, player.x + w - 2);
  const floorY = Math.min(gyL, gyR) + dy;
  if (!Number.isFinite(floorY)) return false; // обе ступни над провалом

  const prevBottom = prevY + h;
  const curBottom = player.y + h;

  // Приземление сверху — по траектории кадра (анти-туннель, как у платформ).
  const fellOnto = player.vy >= 0 && prevBottom <= floorY && curBottom >= floorY;
  // Следование склону при ходьбе: ноги остаются в окне [floorY−SNAP_DOWN,
  // floorY+STEP_UP] — подхват вверх на подъёме, прилипание на спуске.
  const slopeFollow =
    (wasGrounded || player.onGround) && player.vy >= 0 &&
    curBottom > floorY - SNAP_DOWN && curBottom - floorY <= STEP_UP;

  if (fellOnto || slopeFollow) {
    player.y = floorY - h;
    if (player.vy > 0) player.vy = 0;
    player.onGround = true;
    return true;
  }
  return false;
}

