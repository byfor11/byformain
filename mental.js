/* byformain — lógica pura del entrenador de cálculo mental (sin DOM). */
(function (root) {
  'use strict';
  const MODES = [['sumas', 'Sumas', '+'], ['restas', 'Restas', '−'], ['multiplicaciones', 'Multiplicaciones', '×'], ['divisiones', 'Divisiones', '÷'], ['mixto', 'Mixto', '±']];
  const LEVELS = [[1, 'Fácil'], [2, 'Medio'], [3, 'Difícil']];
  const KINDS = [['n10', '10 preguntas', { n: 10 }], ['n20', '20 preguntas', { n: 20 }], ['n30', '30 preguntas', { n: 30 }], ['t2', '2 minutos', { t: 120 }], ['t5', '5 minutos', { t: 300 }]];
  const kindInfo = (k) => (KINDS.find((x) => x[0] === k) || KINDS[0])[2];
  const kindLabel = (k) => (KINDS.find((x) => x[0] === k) || KINDS[0])[1];
  const modeLabel = (m) => (MODES.find((x) => x[0] === m) || MODES[4])[1];
  const levelLabel = (l) => (LEVELS.find((x) => x[0] === l) || LEVELS[0])[1];
  const ri = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));

  function genQuestion(mode, level, rnd) {
    rnd = rnd || Math.random; level = [1, 2, 3].includes(level) ? level : 1;
    if (mode === 'mixto') mode = ['sumas', 'restas', 'multiplicaciones', 'divisiones'][ri(rnd, 0, 3)];
    let a, b, c;
    switch (mode) {
      case 'sumas':
        if (level === 1) { a = ri(rnd, 2, 20); b = ri(rnd, 2, 20); }
        else if (level === 2) { a = ri(rnd, 11, 99); b = ri(rnd, 11, 99); }
        else if (rnd() < 0.5) { a = ri(rnd, 101, 999); b = ri(rnd, 101, 999); }
        else { a = ri(rnd, 11, 99); b = ri(rnd, 11, 99); c = ri(rnd, 11, 99); }
        return { mode, text: c != null ? `${a} + ${b} + ${c}` : `${a} + ${b}`, answer: a + b + (c || 0) };
      case 'restas':
        if (level === 1) { a = ri(rnd, 5, 30); b = ri(rnd, 1, a - 1); }
        else if (level === 2) { a = ri(rnd, 30, 150); b = ri(rnd, 11, a - 1); }
        else { a = ri(rnd, 300, 1000); b = ri(rnd, 101, a - 1); }
        return { mode, text: `${a} − ${b}`, answer: a - b };
      case 'multiplicaciones':
        if (level === 1) { a = ri(rnd, 2, 9); b = ri(rnd, 2, 9); }
        else if (level === 2) { a = ri(rnd, 11, 99); b = ri(rnd, 2, 9); }
        else { a = ri(rnd, 12, 60); b = ri(rnd, 11, 25); }
        return { mode, text: `${a} × ${b}`, answer: a * b };
      default: { // divisiones exactas
        let d, q;
        if (level === 1) { d = ri(rnd, 2, 9); q = ri(rnd, 2, 9); }
        else if (level === 2) { d = ri(rnd, 3, 12); q = ri(rnd, 5, 30); }
        else { d = ri(rnd, 6, 25); q = ri(rnd, 11, 60); }
        return { mode: 'divisiones', text: `${d * q} ÷ ${d}`, answer: q };
      }
    }
  }
  function nextQuestion(mode, level, rnd, prevText) {
    for (let i = 0; i < 8; i++) { const q = genQuestion(mode, level, rnd); if (q.text !== prevText) return q; }
    return genQuestion(mode, level, rnd);
  }
  /* answers: [{q, a (número o null), correct, ms}] */
  function summarize(answers, elapsedMs) {
    const total = answers.length, correct = answers.filter((x) => x.correct).length;
    const sumMs = answers.reduce((s, x) => s + x.ms, 0);
    return { total, correct, acc: total ? correct / total : 0, avgMs: total ? sumMs / total : 0, totalMs: elapsedMs != null ? elapsedMs : sumMs };
  }
  /* ¿a mejor que b? Por tiempo: más aciertos (luego mayor precisión). Por preguntas: mayor precisión, luego menos tiempo. */
  function isBetter(kind, a, b) {
    if (!b) return true;
    if (kindInfo(kind).t) return a.correct > b.correct || (a.correct === b.correct && a.acc > b.acc);
    return a.acc > b.acc || (a.acc === b.acc && a.totalMs < b.totalMs);
  }
  function bestFor(history, mode, level, kind) {
    let best = null;
    for (const r of history) if (r.mode === mode && r.level === level && r.kind === kind && r.total > 0 && isBetter(kind, r, best)) best = r;
    return best;
  }
  function bestLabel(kind, r) {
    if (!r) return 'Sin marca todavía';
    const secs = Math.round(r.totalMs / 1000), t = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    return kindInfo(kind).t ? r.correct + ' aciertos (' + Math.round(r.acc * 100) + ' %)' : r.correct + '/' + r.total + ' en ' + t;
  }
  const fmtSec = (ms) => (Math.round(ms / 100) / 10).toFixed(1).replace('.', ',');
  const API = { MODES, LEVELS, KINDS, kindInfo, kindLabel, modeLabel, levelLabel, genQuestion, nextQuestion, summarize, isBetter, bestFor, bestLabel, fmtSec };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BFMental = API;
})(typeof self !== 'undefined' ? self : this);
