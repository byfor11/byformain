/* byformain — lógica pura del entrenador de gramática inglesa (sin DOM). Usa el banco de grammar-data.js. */
(function (root) {
  'use strict';
  const G = typeof globalThis !== 'undefined' ? globalThis : root;
  const isNode = typeof module !== 'undefined' && module.exports && typeof require === 'function';
  if (!G.BFGrammarData && isNode) require('./grammar-data.js');
  const M = isNode ? require('./mental.js') : G.BFMental;
  const DATA = G.BFGrammarData;

  const LEVELS = [['A2', 'A2'], ['B1', 'B1'], ['B2', 'B2'], ['C1', 'C1']];
  const LEVEL_DESC = { A2: 'Básico', B1: 'Intermedio', B2: 'Intermedio alto', C1: 'Avanzado' };
  const TOPICS = [['mixto', 'Mixto'], ['tiempos', 'Tiempos verbales'], ['perfecto', 'Present perfect vs pasado'], ['condicionales', 'Condicionales'], ['articulos', 'Artículos'], ['preposiciones', 'Preposiciones'],
    ['phrasal', 'Phrasal verbs'], ['modales', 'Verbos modales'], ['comparativos', 'Comparativos'], ['indirecto', 'Estilo indirecto'], ['errores', 'Errores típicos'], ['vocabulario', 'Vocabulario']];
  const topicLabel = (k) => (TOPICS.find((x) => x[0] === k) || TOPICS[0])[1];
  const levelLabel = (l) => l;
  const KINDS = M.KINDS, kindInfo = M.kindInfo, kindLabel = M.kindLabel, fmtSec = M.fmtSec, isBetter = M.isBetter, bestLabel = M.bestLabel;

  /* ---- banco compilado ---- */
  const BANK = [];
  for (const [tk] of TOPICS) {
    if (tk === 'mixto') continue;
    (DATA[tk] || []).forEach((r, i) => {
      const id = tk.slice(0, 3) + '-' + (i + 1);
      if (Array.isArray(r[2])) BANK.push({ id, topic: tk, lvl: r[0], type: 'fill', q: r[1], ans: r[2], exp: r[3] });
      else BANK.push({ id, topic: tk, lvl: r[0], type: 'mc', q: r[1], opts: [r[2], r[3], r[4], r[5]], correct: r[2], exp: r[6] });
    });
  }
  const BY_ID = new Map(BANK.map((x) => [x.id, x]));

  /* ---- comprobación de respuestas ---- */
  function norm(s) {
    s = String(s == null ? '' : s).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[.!?,;:]+$/g, '').replace(/\s+/g, ' ').trim();
    return s.replace(/\bcan't\b/g, 'cannot').replace(/\bcan not\b/g, 'cannot').replace(/\bwon't\b/g, 'will not').replace(/n't\b/g, ' not').replace(/'re\b/g, ' are').replace(/'ve\b/g, ' have').replace(/'m\b/g, ' am').replace(/'ll\b/g, ' will').replace(/\s+/g, ' ');
  }
  /* "p" es lo que devuelve present(); given: índice (mc) o texto (fill) */
  function check(p, given) {
    if (p.type === 'mc') return Number(given) === p.ci;
    const g = norm(given);
    return !!g && p.ans.some((a) => norm(a) === g);
  }
  const answerText = (p) => (p.type === 'mc' ? p.opts[p.ci] : p.ans[0]);
  const filled = (p) => { const a = answerText(p); return p.q.replace('___', a); };

  function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function present(item, rnd) {
    rnd = rnd || Math.random;
    if (item.type === 'fill') return { id: item.id, topic: item.topic, lvl: item.lvl, type: 'fill', q: item.q, ans: item.ans.slice(), exp: item.exp };
    const opts = shuffle(item.opts, rnd);
    return { id: item.id, topic: item.topic, lvl: item.lvl, type: 'mc', q: item.q, opts, ci: opts.indexOf(item.correct), exp: item.exp };
  }

  /* ---- sesión: cola de preguntas del nivel (y tema), priorizando las que no han salido hace poco ---- */
  const LV_IDX = { A2: 0, B1: 1, B2: 2, C1: 3 };
  function pool(level, topic) { return BANK.filter((x) => x.lvl === level && (topic === 'mixto' || x.topic === topic)); }
  function makeSession(cfg, rnd) {
    rnd = rnd || Math.random;
    const level = LV_IDX[cfg.level] != null ? cfg.level : 'B1', topic = cfg.topic || 'mixto', recent = new Set(cfg.recent || []);
    const info = kindInfo(cfg.kind), exact = pool(level, topic);
    const order = (list) => { const f = shuffle(list, rnd); return f.filter((x) => !recent.has(x.id)).concat(f.filter((x) => recent.has(x.id))); };
    const adjacent = () => shuffle(BANK.filter((x) => x.lvl !== level && (topic === 'mixto' || x.topic === topic)).sort((a, b) => Math.abs(LV_IDX[a.lvl] - LV_IDX[level]) - Math.abs(LV_IDX[b.lvl] - LV_IDX[level]) || 0), rnd)
      .sort((a, b) => Math.abs(LV_IDX[a.lvl] - LV_IDX[level]) - Math.abs(LV_IDX[b.lvl] - LV_IDX[level]));
    const need = info.n || 0;
    let queue = order(exact);
    let padded = 0;
    if (need && queue.length < need) { const extra = adjacent().slice(0, need - queue.length); padded = extra.length; queue = queue.concat(extra); }
    let last = null;
    function refill() { queue = order(exact.length >= 8 ? exact : exact.concat(adjacent().slice(0, 12))); if (last && queue.length > 1 && queue[0].id === last) queue.push(queue.shift()); }
    return {
      poolSize: exact.length, padded, total: need || null,
      next() { if (!queue.length) refill(); const it = queue.shift(); last = it.id; return present(it, rnd); },
    };
  }

  /* answers: [{id, topic, q, a (texto dado), c (texto correcto), e (explicación), correct, ms}] */
  function summarize(answers, elapsedMs) {
    const total = answers.length, correct = answers.filter((x) => x.correct).length, sumMs = answers.reduce((s, x) => s + x.ms, 0);
    const byTopic = {};
    for (const x of answers) { const t = byTopic[x.topic] = byTopic[x.topic] || [0, 0]; t[1]++; if (x.correct) t[0]++; }
    return { total, correct, acc: total ? correct / total : 0, avgMs: total ? sumMs / total : 0, totalMs: elapsedMs != null ? elapsedMs : sumMs, byTopic };
  }
  function bestFor(history, topic, level, kind) {
    let best = null;
    for (const r of history) if (r.topic === topic && r.level === level && r.kind === kind && r.total > 0 && isBetter(kind, r, best)) best = r;
    return best;
  }
  /* precisión acumulada por tema a partir del historial: {tema: [aciertos, total]} */
  function topicStats(history) {
    const out = {};
    for (const r of history) for (const k of Object.keys(r.byTopic || {})) { const t = out[k] = out[k] || [0, 0]; t[0] += r.byTopic[k][0]; t[1] += r.byTopic[k][1]; }
    return out;
  }
  /* ids recientes (máx. 250) tras una sesión */
  const pushRecent = (recent, ids) => recent.concat(ids).slice(-250);

  const API = { LEVELS, LEVEL_DESC, TOPICS, KINDS, BANK, BY_ID, topicLabel, levelLabel, kindInfo, kindLabel, fmtSec, norm, check, answerText, filled, present, pool, makeSession, summarize, isBetter, bestFor, bestLabel, topicStats, pushRecent, shuffle };
  if (isNode) module.exports = API; else G.BFGrammar = API;
})(typeof self !== 'undefined' ? self : this);
