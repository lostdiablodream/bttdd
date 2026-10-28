// music.js — WebAudio-плеер музыки NES из musicdata.js (C-12).
//
// Данные извлечены tools/music.py из ROM пользователя (формат —
// docs/music-format.md): 2 pulse-канала (скважности 12.5/25/50/75% через
// PeriodicWave из 8-ступенчатых NES-паттернов), triangle ('triangle',
// октавой ниже по /32, как на APU), noise (буфер белого шума + bandpass
// по NTSC-периоду). Тик = темп/256 кадра NES (60.0988 Гц); каналы
// зацикливаются независимо, как на железе.
//
// Управление: startLevel()/win()/stop()/suspend()/resume() — из main.js по
// автомату состояний игры; unlock() зовётся из обработчиков кнопок
// (user gesture — иначе браузер блокирует AudioContext). Отключение звука:
// setEnabled(false) глушит всё и запоминается в localStorage
// ('btdd-platformer-sound', с try/catch — приватный режим не роняет игру).
//
// Планировщик: lookahead-таймер (25 мс, окно 0.15 с) по часам AudioContext;
// на паузе ctx.suspend() замораживает часы — запланированное не теряется.

import {
  NES_FPS, NES_CPU_HZ, PERIODS, NOISE_PERIODS, TRACK_LEVEL1, TRACK_WIN,
  TRACK_7,
} from "./musicdata.js";

export const SOUND_PREF_KEY = "btdd-platformer-sound";

// NES length-counter (таблица APU, кадры) — для гейта нот по lenhi.
const NES_LEN = [10, 254, 20, 2, 40, 4, 80, 6, 160, 8, 60, 10, 14, 12, 26, 14,
  12, 16, 24, 18, 48, 20, 96, 22, 192, 24, 72, 26, 16, 28, 32, 30];

// Скважности NES pulse (8 ступеней): 12.5 / 25 / 50 / 75%.
const DUTY_STEPS = [
  [1, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 0, 0],
];

const CH_GAIN = { pulse1: 0.16, pulse2: 0.16, triangle: 0.30, noise: 0.10 };
const LOOKAHEAD_MS = 25;
const AHEAD_SEC = 0.15;

function loadSoundPref() {
  try {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(SOUND_PREF_KEY) !== "0"; // по умолчанию вкл
  } catch (e) {
    return true;
  }
}

function saveSoundPref(on) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(SOUND_PREF_KEY, on ? "1" : "0");
    return true;
  } catch (e) {
    return false;
  }
}

// PeriodicWave из NES-паттерна скважности: ДФТ 8 отсчётов, 16 гармоник
// (полоса ограничена — меньше алиасинга на высоких нотах).
function makeDutyWave(ctx, steps) {
  const H = 16;
  const real = new Float32Array(H + 1);
  const imag = new Float32Array(H + 1);
  for (let h = 1; h <= H; h++) {
    let re = 0, im = 0;
    for (let i = 0; i < 8; i++) {
      const a = (2 * Math.PI * h * i) / 8;
      re += steps[i] * Math.cos(a);
      im -= steps[i] * Math.sin(a);
    }
    real[h] = re / 4;
    imag[h] = im / 4;
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

function pulseFreq(idx) {
  const p = PERIODS[idx];
  return p > 0 ? NES_CPU_HZ / (16 * (p + 1)) : 0;
}
function triFreq(idx) {
  const p = PERIODS[idx];
  return p > 0 ? NES_CPU_HZ / (32 * (p + 1)) : 0;
}
function noiseFreq(p) {
  const per = NOISE_PERIODS[p & 15] || 4;
  return Math.max(150, Math.min(10000, NES_CPU_HZ / (per * 93)));
}

export class MusicPlayer {
  constructor() {
    this.enabled = loadSoundPref();
    this.ctx = null;
    this.master = null;
    this.dutyWaves = null;
    this.noiseBuf = null;
    this.playing = false;   // идёт опрос планировщика
    this.track = null;
    this.channels = null;   // предрасчитанные события по каналам
    this.timer = null;
    this.liveNodes = new Set();
    this._wantPlay = null;  // отложенный старт (AudioContext ещё заблокирован)
  }

  // --- жест пользователя (кнопки Старт/Заново): создать/разблокировать ctx ---
  unlock() {
    if (!this.enabled) return;
    this._ensureCtx();
    if (this.ctx && this.ctx.state === "suspended") {
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
    if (this._wantPlay) {
      const w = this._wantPlay;
      this._wantPlay = null;
      this._startTrack(w.track, w.loop);
    }
  }

  setEnabled(on) {
    this.enabled = !!on;
    saveSoundPref(this.enabled);
    if (!this.enabled) {
      this._wantPlay = null;
      this._silence();
    } else {
      this.unlock();
    }
  }

  // --- команды от автомата состояний игры ---
  startLevel() { this._startOrDefer(TRACK_LEVEL1, true); }
  win() { this._startOrDefer(TRACK_WIN, false); }
  // Тема босса (C-22): трек 7 — в оригинале её включает хендлер босса
  // ($D938 → LDA #7 → $8378) при входе в боевую фазу; зациклена.
  boss() { this._startOrDefer(TRACK_7, true); }
  stop() {
    this._wantPlay = null;
    this._silence();
  }

  suspend() {
    if (this.ctx && this.playing && this.ctx.state === "running") {
      const p = this.ctx.suspend();
      if (p && p.catch) p.catch(() => {});
    }
  }

  resume() {
    if (!this.enabled) return;
    if (this.ctx && this.playing && this.ctx.state === "suspended") {
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
  }

  // --- внутреннее ---

  _ensureCtx() {
    if (this.ctx) return;
    const AC = (typeof window !== "undefined") &&
      (window.AudioContext || window.webkitAudioContext);
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.dutyWaves = DUTY_STEPS.map((s) => makeDutyWave(this.ctx, s));
    // 1 с белого шума — зацикленный буфер для noise-канала
    const len = Math.floor(this.ctx.sampleRate);
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  _startOrDefer(track, loop) {
    if (!this.enabled) return;
    this._ensureCtx();
    if (!this.ctx || this.ctx.state !== "running") {
      this._wantPlay = { track, loop }; // сыграет после unlock() по жесту
      return;
    }
    this._startTrack(track, loop);
  }

  _silence() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.playing = false;
    this.track = null;
    this.channels = null;
    for (const n of this.liveNodes) {
      try { n.stop ? n.stop(0) : n.disconnect(); } catch (e) { /* уже тихо */ }
    }
    this.liveNodes.clear();
    // мгновенная тишина, включая уже запланированные ноты (окно 0.15 с)
    if (this.master) {
      try { this.master.disconnect(); } catch (e) { /* не был подключён */ }
    }
  }

  _startTrack(track, loop) {
    this._silence();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") {
      const p = this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
    }
    try { this.master.connect(this.ctx.destination); } catch (e) { /* уже */ }
    this.track = track;
    const t0 = this.ctx.currentTime + 0.06;
    this.channels = track.channels.map((ch) => this._compileChannel(track, ch, loop, t0));
    this.playing = true;
    this.timer = setInterval(() => this._schedule(), LOOKAHEAD_MS);
    this._schedule();
  }

  // События канала → секунды; слияние нот с текущим инструментом/вибрато.
  _compileChannel(track, ch, loop, t0) {
    const tickSec = 256.0 / (track.tempo * NES_FPS);
    const notes = [];
    let duty = 2, vol = 0, lenhi = 0;      // до первого инструмента тишина
    let vib = null;
    let ni = 0, ii = 0, vi = 0, bi = 0;
    const N = ch.notes;
    while (ni * 3 < N.length) {
      const tk = N[ni * 3];
      while (ii * 4 < ch.insts.length && ch.insts[ii * 4] <= tk) {
        duty = ch.insts[ii * 4 + 1];
        vol = ch.insts[ii * 4 + 2];
        lenhi = ch.insts[ii * 4 + 3];
        ii++;
      }
      while (vi * 3 < ch.vols.length && ch.vols[vi * 3] <= tk) {
        vol = ch.vols[vi * 3 + 1];
        vi++;
      }
      while (bi * 3 < ch.vib.length && ch.vib[bi * 3] <= tk) {
        const d = ch.vib[bi * 3 + 1];
        vib = d > 0 ? { depth: d, rate: ch.vib[bi * 3 + 2] } : null;
        bi++;
      }
      const note = N[ni * 3 + 1];
      const dur = N[ni * 3 + 2];
      ni++;
      const level = vol & 15;
      if (!level) continue;
      const entry = {
        t: tk * tickSec,
        dur: dur * tickSec,
        tickSec,
        duty, level,
        constVol: !!(vol & 16),
        halt: !!(vol & 32),
        lenhi, vib,
      };
      if (ch.kind === "noise") {
        entry.noise = note;
      } else {
        const idx = note - 35; // MIDI → индекс таблицы PERIODS
        if (idx < 1 || idx >= PERIODS.length) continue;
        entry.freq = ch.kind === "triangle" ? triFreq(idx) : pulseFreq(idx);
      }
      notes.push(entry);
    }
    const loopSec = ch.loop >= 0 ? ch.loop * tickSec : -1;
    const totalSec = ch.totalTicks * tickSec;
    let loopIdx = notes.length;
    if (loopSec >= 0) {
      loopIdx = notes.findIndex((e) => e.t >= loopSec - 1e-6);
      if (loopIdx < 0) loopIdx = notes.length;
    }
    return {
      kind: ch.kind, notes, idx: 0, t0,
      loopSec, totalSec, loopIdx,
      done: notes.length === 0,
    };
  }

  _schedule() {
    if (!this.playing || !this.ctx) return;
    const horizon = this.ctx.currentTime + AHEAD_SEC;
    let alive = 0;
    for (const c of this.channels) {
      if (c.done) continue;
      alive++;
      while (c.idx < c.notes.length) {
        const ev = c.notes[c.idx];
        const when = c.t0 + ev.t;
        if (when > horizon) break;
        if (when + ev.dur > this.ctx.currentTime - 0.02) {
          this._playNote(c.kind, ev, Math.max(when, this.ctx.currentTime));
        }
        c.idx++;
      }
      if (c.idx >= c.notes.length) {
        if (c.loopSec >= 0 && c.loopIdx < c.notes.length) {
          // независимый цикл канала (как на NES): сдвиг начала отсчёта
          c.t0 += c.totalSec - c.loopSec;
          c.idx = c.loopIdx;
        } else {
          c.done = true;
          alive--;
        }
      }
    }
    if (!alive) this._silence(); // джингл доиграл — планировщик off
  }

  _playNote(kind, ev, when) {
    const ctx = this.ctx;
    const peak = (ev.level / 15) * (CH_GAIN[kind] || 0.15);
    // гейт: короче из (90% длительности, счётчик длины NES по lenhi)
    let gate = ev.dur * 0.9;
    if (!ev.halt && ev.lenhi) {
      const nl = NES_LEN[(ev.lenhi >> 3) & 31];
      if (nl) gate = Math.min(gate, (nl / NES_FPS) * 1.2);
    }
    gate = Math.max(0.02, gate);
    const end = when + gate;

    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, when);
    if (!ev.constVol) {
      // огибающая NES (decay) — грубая аппроксимация
      g.gain.linearRampToValueAtTime(peak * 0.55, when + gate * 0.8);
    }
    g.gain.linearRampToValueAtTime(0.0001, end + 0.008);
    g.connect(this.master);

    let src;
    let filter = null;
    if (kind === "noise") {
      src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = noiseFreq(ev.noise);
      filter.Q.value = 0.9;
      src.connect(filter);
      filter.connect(g);
    } else {
      src = ctx.createOscillator();
      if (kind === "triangle") {
        src.type = "triangle";
      } else {
        src.setPeriodicWave(this.dutyWaves[ev.duty & 3]);
      }
      src.frequency.setValueAtTime(ev.freq, when);
      if (ev.vib) {
        // вибрато: LFO на detune; глубина ~25 центов на единицу depth
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 1 / (2 * ev.vib.rate * ev.tickSec);
        lg.gain.value = Math.min(100, ev.vib.depth * 25);
        lfo.connect(lg);
        lg.connect(src.detune);
        lfo.start(when);
        lfo.stop(end + 0.02);
        lfo.onended = () => { lfo.disconnect(); lg.disconnect(); };
      }
      src.connect(g);
    }
    src.start(when);
    src.stop(end + 0.02);
    this.liveNodes.add(src);
    src.onended = () => {
      this.liveNodes.delete(src);
      src.disconnect();
      g.disconnect();
      if (filter) filter.disconnect();
    };
  }
}
