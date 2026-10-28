// main.js — точка входа и единственный игровой цикл (C-04).
// Ровно одна rAF-цепочка на всё время жизни страницы: она создаётся один
// раз в boot() и дальше только перевызывает сама себя. Старт/пауза/
// продолжение — это переключения автомата состояний в Game (C-04), они
// НЕ трогают requestAnimationFrame, поэтому второй цикл создать не могут.
// dt — по времени кадра, с клампом сверху 0.05 с (защита от скачка после
// задержки) и снизу 0. При скрытии вкладки — авто-пауза и очистка нажатых
// клавиш; на продолжении lastTime сбрасывается (хук onResume), скачка dt
// нет. Кнопки старт/пауза/заново/звук подключены в boot() (C-06/C-12):
// ровно один обработчик на кнопку, после клика — blur(), иначе Space
// «съедается» фокусом кнопки (замечание из C-02); доступность кнопок
// синхронизируется с состоянием игры каждый кадр. Музыка (C-12): команды
// плееру (music.js) от наблюдателя переходов состояния syncMusic(); жест
// для AudioContext дают обработчики кнопок (music.unlock()).

import { Game } from "./Game.js";
import { initInput, initTouchControls, clearInput } from "./input.js";
import { MusicPlayer } from "./music.js";
import { preloadPlayerSprites, preloadEnemySprites } from "./sprites.js";

// Экземпляр игры — для отладки из консоли и для смоук-тестов
// (живая привязка модуля: заполняется в boot()).
export let game = null;

function boot() {
  const canvas = document.getElementById("game");

  let lastTime = performance.now();

  game = new Game(canvas, {
    // Продолжение после паузы: отбросить накопленное время, чтобы первый
    // dt был маленьким и герой не «телепортировался» на время паузы.
    onResume: () => {
      lastTime = performance.now();
    },
  });
  initInput();
  preloadPlayerSprites(); // C-13: лист спрайтов грузится лениво; до загрузки
  // игрок рисуется фигурами (логика от картинок не зависит)
  preloadEnemySprites(); // C-15: то же для листа врагов (assets/enemies/)

  // --- Экранные кнопки для телефона (C-08) ---
  // Кнопки в #mobile-controls (◀ влево, ▶ вправо, ▲/▼ глубина — C-14,
  // A прыжок, B удар — C-13). Слушатели
  // вешаются один раз здесь; отсутствующие элементы (страница без touch-UI)
  // пропускаются внутри bindTouchButton. Видимость кнопок решает CSS
  // (pointer: coarse), JS об этом не знает — ввод работает всегда.
  initTouchControls({
    left: document.getElementById("btn-left"),
    right: document.getElementById("btn-right"),
    up: document.getElementById("btn-up"),
    down: document.getElementById("btn-down"),
    jump: document.getElementById("btn-jump"),
    attack: document.getElementById("btn-attack"),
  });

  // --- Кнопки управления (C-06) ---
  // Ровно ОДИН обработчик на кнопку, повешен здесь один раз; рестарт
  // работает через reset()/start() — это операции над данными, а не
  // переподписка, поэтому обработчики и цикл не дублируются никогда.
  // После клика — blur(): иначе кнопка держит фокус и Space «кликает»
  // её вместо прыжка (замечание из C-02).
  const btnStart = document.getElementById("btn-start");
  const btnPause = document.getElementById("btn-pause");
  const btnRestart = document.getElementById("btn-restart");
  const btnSound = document.getElementById("btn-sound");

  // Музыка уровня 1 (C-12): WebAudio-плеер трека из ROM (src/music.js +
  // сгенерированный src/musicdata.js). AudioContext создаётся/будится только
  // в обработчиках кнопок (user gesture): unlock() в Старт/Заново. Переходы
  // состояния, не связанные с кнопками (won/lost в update(), авто-пауза по
  // скрытию вкладки), ловятся наблюдателем prevState в кадре ниже.
  const music = new MusicPlayer();

  function wireButton(btn, action) {
    if (!btn) return; // страница без кнопок (например, тесты) — просто нет UI
    btn.addEventListener("click", () => {
      action();
      btn.blur();
    });
  }
  wireButton(btnStart, () => {
    game.start(); // Старт: ready → running
    music.unlock(); // жест пользователя: AudioContext.resume + старт музыки
  });
  wireButton(btnPause, () => {
    game.togglePause(); // Пауза/Продолжить: running ⇄ paused
    music.unlock(); // жест: разбудить AudioContext (для resume на кнопке)
  });
  // Заново: полный сброс данных и сразу новый старт (выбор C-06: рестарт
  // начинает игру сразу, без промежуточного экрана 'ready'). Музыку
  // перезапускаем явно: reset()+start() в одном обработчике проходят
  // через 'ready' синхронно, и наблюдатель в кадре видит лишь
  // 'running'→'running' — без явного startLevel() тема не перемоталась бы.
  wireButton(btnRestart, () => {
    game.reset();
    game.start();
    music.unlock();
    music.startLevel();
  });
  // Звук вкл/выкл (C-12): состояние переживает перезагрузку (localStorage
  // внутри плеера); при выкл всё глушится немедленно. Вкл на ходу в running —
  // уровень заиграет с начала (плеер сам не знает состояния игры).
  wireButton(btnSound, () => {
    music.setEnabled(!music.enabled);
    if (music.enabled && game.state === "running") music.startLevel();
    syncSoundButton();
  });

  function syncSoundButton() {
    if (!btnSound) return;
    const t = music.enabled ? "Звук: вкл" : "Звук: выкл";
    if (btnSound.textContent !== t) btnSound.textContent = t;
    const p = music.enabled ? "true" : "false";
    if (btnSound.getAttribute("aria-pressed") !== p) {
      btnSound.setAttribute("aria-pressed", p);
    }
  }
  syncSoundButton();

  // Доступность и подпись кнопок — по автомату состояний. Старт — только из
  // 'ready'; Заново — во всех состояниях, кроме 'ready' (там нечего
  // сбрасывать); Пауза/Продолжить — только в 'running'/'paused'. Вызывается
  // в boot() и каждый кадр; присваивания — только при изменении значения.
  function syncButtons() {
    if (!btnStart || !btnPause || !btnRestart) return;
    const s = game.state;
    const startOff = s !== "ready";
    if (btnStart.disabled !== startOff) btnStart.disabled = startOff;
    const restartOff = s === "ready";
    if (btnRestart.disabled !== restartOff) btnRestart.disabled = restartOff;
    const pauseOff = s !== "running" && s !== "paused";
    if (btnPause.disabled !== pauseOff) btnPause.disabled = pauseOff;
    const pauseText = s === "paused" ? "Продолжить" : "Пауза";
    if (btnPause.textContent !== pauseText) btnPause.textContent = pauseText;
  }
  syncButtons(); // начальное состояние (ready) ещё до первого кадра

  // Авто-пауза при скрытии вкладки (C-04): замораживаем игру и сбрасываем
  // нажатые клавиши — иначе клавиша «залипнет», если её keyup произошёл
  // вне вкладки. При возврате остаёмся в 'paused': продолжает сам игрок.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "running") {
      game.pause();
      clearInput();
    }
  });

  // Наблюдатель переходов состояния для музыки (C-12): все переходы
  // автомата игры ловятся здесь раз в кадр (победа/поражение ставятся в
  // update(), пауза — кнопкой или вкладкой). Жест для AudioContext дают
  // обработчики кнопок выше (unlock), поэтому здесь — только команды.
  // C-22: внутри состояния 'running' следим ещё за game.bossActive —
  // начало боя с ABOBO переключает музыку на тему босса (трек 7).
  let prevState = game.state;
  let prevBoss = !!game.bossActive;

  function syncMusic() {
    const s = game.state;
    const boss = !!game.bossActive;
    if (s === prevState) {
      if (s === "running" && boss !== prevBoss) {
        prevBoss = boss;
        if (boss) music.boss(); // начало боя → тема босса (трек 7)
        else music.startLevel(); // бой кончился без смены состояния — тема уровня
      }
      return;
    }
    const prev = prevState;
    prevState = s;
    prevBoss = boss;
    if (s === "running") {
      if (prev === "paused") music.resume();
      else music.startLevel(); // из ready (старт/рестарт)
    } else if (s === "paused") {
      music.suspend();
    } else if (s === "won") {
      music.win(); // фанфары (трек 9), без цикла
    } else if (s === "lost") {
      music.stop(); // тишина
    }
  }

  function frame(now) {
    // dt в секундах; кламп сверху — от скачка после задержки (длинный
    // кадр, троттлинг вкладки), снизу — от отрицательного шага
    // (rAF-таймстамп vs performance.now() сразу после onResume).
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > 0.05) dt = 0.05;
    else if (dt < 0) dt = 0;

    game.update(dt); // двигает мир только в состоянии 'running'
    game.render(); // рисует всегда (на паузе — сцену под плашкой)
    syncButtons(); // доступность кнопок следует за состоянием (C-06)
    syncMusic(); // переходы состояния → музыка (C-12)
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

window.addEventListener("load", boot);
