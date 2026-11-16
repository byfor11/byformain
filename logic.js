/* byformain — lógica pura (sin DOM). Fechas como "YYYY-MM-DD" locales.
   Las operaciones de calendario usan días enteros UTC => inmune a cambios de hora (DST). */
(function (root) {
  'use strict';
  const DAY = 864e5;
  const pad = (n) => String(n).padStart(2, '0');

  /* ---------- Fechas ---------- */
  function toDays(s) { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); }
  function fromDays(n) { const D = new Date(n * DAY); return D.getUTCFullYear() + '-' + pad(D.getUTCMonth() + 1) + '-' + pad(D.getUTCDate()); }
  function todayStr(now) { now = now || new Date(); return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()); }
  function addDays(s, n) { return fromDays(toDays(s) + n); }
  function diffDays(a, b) { return toDays(a) - toDays(b); }
  function weekday(s) { return (((toDays(s) + 3) % 7) + 7) % 7; } // lunes=0 … domingo=6
  function weekStart(s) { return addDays(s, -weekday(s)); }
  function weekEnd(s) { return addDays(s, 6 - weekday(s)); }
  function weekDates(s) { const w = weekStart(s); return Array.from({ length: 7 }, (_, i) => addDays(w, i)); }
  function monthStart(s) { return s.slice(0, 7) + '-01'; }
  function addMonths(s, n) { const [y, m] = s.split('-').map(Number); const t = y * 12 + (m - 1) + n; return Math.floor(t / 12) + '-' + pad((t % 12) + 1) + '-01'; }
  function daysInMonth(s) { const [y, m] = s.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function monthEnd(s) { return s.slice(0, 7) + '-' + pad(daysInMonth(s)); }
  function monthGrid(s) { // semanas completas (lun-dom) que cubren el mes
    const first = monthStart(s), last = monthEnd(s);
    const start = weekStart(first), end = weekEnd(last);
    const n = diffDays(end, start) + 1;
    return Array.from({ length: n }, (_, i) => addDays(start, i));
  }
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const DIAS_CORTO = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

  /* ---------- Objetivos ---------- */
  let _uid = 0;
  function uid() { return 'g' + Date.now().toString(36) + (_uid++).toString(36) + Math.random().toString(36).slice(2, 5); }

  function makeGoal(o, today) {
    const start = o.start || today;
    return {
      id: o.id || uid(), name: String(o.name || '').trim(), color: o.color || '#5e8bff',
      module: normModule(o.module), start, inactive: [],
      versions: [{ from: start, schedule: normSchedule(o.schedule), target: normTarget(o.target) }],
    };
  }
  const MODULES = ['ajedrez', 'calculo'];
  function normModule(m) { return MODULES.includes(m) ? m : null; }
  function normSchedule(s) {
    s = s || { type: 'daily' };
    if (s.type === 'days') {
      const days = Array.from(new Set((s.days || []).map(Number).filter((n) => n >= 0 && n <= 6))).sort();
      return { type: 'days', days: days.length ? days : [0] };
    }
    if (s.type === 'weekly') return { type: 'weekly', times: Math.min(7, Math.max(1, parseInt(s.times, 10) || 1)) };
    return { type: 'daily' };
  }
  function normTarget(t) {
    t = t || {};
    const v = t.value === '' || t.value == null ? 0 : Number(t.value);
    return { value: isFinite(v) && v > 0 ? v : 0, unit: String(t.unit || '').trim() };
  }
  function versionAt(g, date) {
    let v = g.versions[0];
    for (const x of g.versions) if (x.from <= date) v = x;
    return v;
  }
  function isActive(g, date) {
    if (date < g.start) return false;
    return !(g.inactive || []).some((i) => date >= i.from && (i.to == null || date < i.to));
  }
  function isArchived(g) { const l = (g.inactive || [])[g.inactive.length - 1]; return !!l && l.to == null; }
  function archiveGoal(g, today) { if (!isArchived(g)) g.inactive.push({ from: today, to: null }); }
  function unarchiveGoal(g, today) { const l = g.inactive[g.inactive.length - 1]; if (l && l.to == null) l.to = today; }

  /* Editar sin corromper el pasado: los cambios de horario/meta se guardan como nueva versión desde hoy. */
  function updateGoal(state, id, o, today) {
    const g = state.goals.find((x) => x.id === id); if (!g) return null;
    if (o.name != null) g.name = String(o.name).trim();
    if (o.color) g.color = o.color;
    if (o.module !== undefined) g.module = normModule(o.module);
    if (o.start && o.start !== g.start) g.start = o.start;
    const cur = versionAt(g, today);
    const sched = normSchedule(o.schedule || cur.schedule), target = normTarget(o.target || cur.target);
    if (JSON.stringify(sched) !== JSON.stringify(cur.schedule) || JSON.stringify(target) !== JSON.stringify(cur.target)) {
      const same = g.versions.find((v) => v.from === today);
      if (same) { same.schedule = sched; same.target = target; }
      else {
        // si hoy queda antes del inicio del objetivo, la versión rige desde el inicio
        g.versions.push({ from: today < g.start ? g.start : today, schedule: sched, target });
        g.versions.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
      }
    }
    return g;
  }
  function deleteGoal(state, id) {
    state.goals = state.goals.filter((g) => g.id !== id);
    for (const d of Object.keys(state.logs)) {
      delete state.logs[d][id];
      if (!Object.keys(state.logs[d]).length) delete state.logs[d];
    }
  }
  function moveGoal(state, id, dir) {
    const i = state.goals.findIndex((g) => g.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= state.goals.length) return false;
    const [g] = state.goals.splice(i, 1); state.goals.splice(j, 0, g); return true;
  }

  /* ---------- Registros ---------- */
  function getLog(state, date, id) { const d = state.logs[date]; return (d && d[id]) || null; }
  function ensureLog(state, date, id) {
    if (!state.logs[date]) state.logs[date] = {};
    if (!state.logs[date][id]) state.logs[date][id] = { status: 'pending', amount: null, note: '', auto: true };
    return state.logs[date][id];
  }
  function cleanupLog(state, date, id) {
    const l = getLog(state, date, id);
    if (l && l.status === 'pending' && l.amount == null && !l.note) {
      delete state.logs[date][id];
      if (!Object.keys(state.logs[date]).length) delete state.logs[date];
    }
  }
  function autoStatus(amount, target) {
    if (amount == null || !(amount > 0)) return 'pending';
    if (target > 0) return amount >= target ? 'done' : 'partial';
    return 'done';
  }
  function setAmount(state, date, id, amount) {
    const g = state.goals.find((x) => x.id === id); const l = ensureLog(state, date, id);
    amount = amount === '' || amount == null || isNaN(Number(amount)) ? null : Math.max(0, Number(amount));
    l.amount = amount;
    if (l.auto !== false) l.status = autoStatus(amount, versionAt(g, date).target.value);
    cleanupLog(state, date, id); return getLog(state, date, id);
  }
  function setStatus(state, date, id, status) {
    const g = state.goals.find((x) => x.id === id); const l = ensureLog(state, date, id);
    l.status = status; l.auto = status === 'pending'; // manual => ya no se recalcula con la cantidad
    const t = versionAt(g, date).target.value;
    if (status === 'done' && l.amount == null && t > 0) l.amount = t;
    if (status === 'pending') l.amount = null;
    cleanupLog(state, date, id); return getLog(state, date, id);
  }
  function setNote(state, date, id, note) {
    const l = ensureLog(state, date, id); l.note = String(note || '').slice(0, 2000);
    cleanupLog(state, date, id);
  }

  /* Registro automático desde los módulos (ajedrez / cálculo mental):
     suma minutos o sesiones según la unidad de la meta y añade un resumen al comentario. Devuelve lo aplicado. */
  function logActivity(state, key, date, a) {
    const out = [];
    for (const g of state.goals) {
      if (g.module !== key || !isScheduled(g, date)) continue;
      const t = versionAt(g, date).target, unit = String(t.unit || '').toLowerCase();
      const inc = /^min/.test(unit) ? Math.max(1, Math.round(a.minutes || 0)) : (a.sessions != null ? a.sessions : 1);
      const cur = getLog(state, date, g.id);
      setAmount(state, date, g.id, ((cur && cur.amount) || 0) + inc);
      if (a.summary) { const l = getLog(state, date, g.id); setNote(state, date, g.id, (l && l.note ? l.note + '\n' : '') + a.summary); }
      out.push({ id: g.id, name: g.name, added: inc, unit: t.unit || '', status: getLog(state, date, g.id).status });
    }
    return out;
  }

  /* ---------- Estados ---------- */
  function weeklyCount(state, g, date) {
    let c = 0;
    for (const d of weekDates(date)) { const l = getLog(state, d, g.id); if (l && l.status === 'done') c++; }
    return c;
  }
  /* status: done | partial | missed | pending | none
     Regla roja: lo programado y no hecho pasa a "missed" cuando el día ya ha terminado (date < today).
     Objetivos N veces/semana: se ponen en rojo en el domingo (cierre de semana) si no se alcanzó la cuota. */
  function statusOf(state, g, date, today) {
    const v = versionAt(g, date), l = getLog(state, date, g.id);
    if (l && l.status !== 'pending') return l.status;
    if (v.schedule.type === 'weekly') {
      if (date < today) return (date === weekEnd(date) && weeklyCount(state, g, date) < v.schedule.times) ? 'missed' : 'none';
      return 'pending';
    }
    return date < today ? 'missed' : 'pending';
  }
  function isScheduled(g, date) {
    if (!isActive(g, date)) return false;
    const s = versionAt(g, date).schedule;
    if (s.type === 'daily') return true;
    if (s.type === 'days') return s.days.includes(weekday(date));
    return true; // weekly: aparece todos los días
  }
  /* Entradas de un día. forView=true => incluye objetivos semanales aún sin registro (vista de día). */
  function entriesFor(state, date, today, forView) {
    const out = [];
    for (const g of state.goals) {
      if (!isScheduled(g, date)) continue;
      const v = versionAt(g, date), st = statusOf(state, g, date, today);
      const weekly = v.schedule.type === 'weekly' ? { count: weeklyCount(state, g, date), times: v.schedule.times } : null;
      if (!forView && weekly && (st === 'none' || st === 'pending')) continue;
      out.push({ goal: g, version: v, status: st, log: getLog(state, date, g.id), weekly });
    }
    return out;
  }
  function score(entries) {
    if (!entries.length) return null;
    let s = 0; for (const e of entries) s += e.status === 'done' ? 1 : e.status === 'partial' ? 0.5 : 0;
    return s / entries.length;
  }
  function dayScore(state, date, today) {
    if (date > today) return null;
    const es = entriesFor(state, date, today, false).filter((e) => !(date === today && e.status === 'pending'));
    return score(es);
  }

  /* ---------- Estadísticas ---------- */
  function rangeStats(state, g, from, to, today) {
    let expected = 0, got = 0, done = 0;
    const end = to < today ? to : today;
    const v0 = versionAt(g, end);
    if (v0.schedule.type === 'weekly') {
      for (let w = weekStart(from); w <= weekEnd(to) && w <= today; w = addDays(w, 7)) {
        const we = weekEnd(w);
        if (we < g.start || !(isActive(g, we) || isActive(g, w))) continue;
        const v = versionAt(g, we);
        if (v.schedule.type !== 'weekly') continue;
        const c = weeklyCount(state, g, w);
        expected += v.schedule.times; got += Math.min(c, v.schedule.times); done += Math.min(c, v.schedule.times);
      }
    } else {
      for (let d = from; d <= end; d = addDays(d, 1)) {
        if (!isScheduled(g, d) || versionAt(g, d).schedule.type === 'weekly') continue;
        const st = statusOf(state, g, d, today);
        if (d === today && st === 'pending') continue;
        expected++; if (st === 'done') { got++; done++; } else if (st === 'partial') got += 0.5;
      }
    }
    return { expected, got, done, pct: expected ? got / expected : null };
  }
  function streaks(state, g, today) {
    let cur = 0, best = 0;
    const weekly = versionAt(g, today).schedule.type === 'weekly';
    if (weekly) {
      for (let w = weekStart(g.start); w <= today; w = addDays(w, 7)) {
        const we = weekEnd(w), v = versionAt(g, we);
        if (v.schedule.type !== 'weekly' || !(isActive(g, we) || isActive(g, w))) continue;
        if (weeklyCount(state, g, w) >= v.schedule.times) { cur++; best = Math.max(best, cur); }
        else if (we >= today) { /* semana en curso: no rompe */ } else cur = 0;
      }
      return { current: cur, best, unit: 'semanas' };
    }
    for (let d = g.start; d <= today; d = addDays(d, 1)) {
      if (!isScheduled(g, d) || versionAt(g, d).schedule.type === 'weekly') continue;
      const st = statusOf(state, g, d, today);
      if (st === 'done') { cur++; best = Math.max(best, cur); }
      else if (d === today && st === 'pending') { /* hoy aún puede completarse */ } else cur = 0;
    }
    return { current: cur, best, unit: 'días' };
  }

  /* ---------- Estado / validación ---------- */
  const SEEDS = [
    { name: 'Ajedrez', module: 'ajedrez', color: '#8e6bd8', schedule: { type: 'daily' }, target: { value: 30, unit: 'minutos' } },
    { name: 'Cálculo mental', module: 'calculo', color: '#00a3b8', schedule: { type: 'daily' }, target: { value: 10, unit: 'minutos' } },
    { name: 'Estiramientos y flexiones', color: '#ff8a3d', schedule: { type: 'daily' }, target: { value: 20, unit: 'repeticiones' } },
    { name: 'Gimnasio', color: '#e5484d', schedule: { type: 'days', days: [0, 2, 4] }, target: { value: 1, unit: 'sesiones' } },
    { name: 'Creatina', color: '#d6a100', schedule: { type: 'daily' }, target: { value: 1, unit: 'toma' } },
    { name: 'Lectura', color: '#3b82f6', schedule: { type: 'daily' }, target: { value: 20, unit: 'páginas' } },
    { name: 'Estudio', color: '#12a150', schedule: { type: 'days', days: [0, 1, 2, 3, 4] }, target: { value: 60, unit: 'minutos' } },
    { name: 'Listening en inglés', color: '#ec5fa5', schedule: { type: 'weekly', times: 4 }, target: { value: 20, unit: 'minutos' } },
    { name: 'Speaking en inglés', color: '#7c5cff', schedule: { type: 'weekly', times: 3 }, target: { value: 15, unit: 'minutos' } },
  ];
  function newModules() { return { chess: { current: null, history: [], settings: { color: 'w', level: 2 } }, mental: { history: [], settings: { mode: 'mixto', level: 1, kind: 'n10' } } }; }
  function newState(today) { return Object.assign({ app: 'byformain', v: 1, goals: SEEDS.map((s) => makeGoal(s, today)), logs: {}, meta: { created: today, lastExport: null } }, newModules()); }
  const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const STAT = ['pending', 'partial', 'done', 'missed'];
  function inferModule(name) { const n = String(name || '').trim().toLowerCase(); return n === 'ajedrez' ? 'ajedrez' : n === 'cálculo mental' || n === 'calculo mental' ? 'calculo' : null; }
  const num = (x, d, lo, hi) => { x = Number(x); return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d; };
  const str = (x, n) => String(x == null ? '' : x).slice(0, n);
  function cleanModules(obj) {
    const out = newModules(), c = obj && obj.chess, m = obj && obj.mental;
    if (c && typeof c === 'object') {
      const se = c.settings || {};
      out.chess.settings = { color: ['w', 'b', 'r'].includes(se.color) ? se.color : 'w', level: [1, 2, 3].includes(Number(se.level)) ? Number(se.level) : 2 };
      if (c.current && typeof c.current === 'object' && Array.isArray(c.current.moves)) {
        const mv = c.current.moves.slice(0, 600).filter((x) => x && Number.isInteger(x.f) && Number.isInteger(x.t) && x.f >= 0 && x.f < 64 && x.t >= 0 && x.t < 64).map((x) => ({ f: x.f, t: x.t, p: [0, 2, 3, 4, 5].includes(x.p) ? x.p : 0 }));
        out.chess.current = { color: c.current.color === 'b' ? 'b' : 'w', level: [1, 2, 3].includes(Number(c.current.level)) ? Number(c.current.level) : 2, ms: num(c.current.ms, 0, 0, 1e9), moves: mv, started: isDate(c.current.started) ? c.current.started : null };
      }
      if (Array.isArray(c.history)) out.chess.history = c.history.slice(0, 300).filter((x) => x && isDate(x.date)).map((x) => ({
        id: str(x.id, 30), date: x.date, color: x.color === 'b' ? 'b' : 'w', level: [1, 2, 3].includes(Number(x.level)) ? Number(x.level) : 2,
        result: ['win', 'loss', 'draw'].includes(x.result) ? x.result : 'draw', reason: str(x.reason, 40), plies: num(x.plies, 0, 0, 2000), ms: num(x.ms, 0, 0, 1e9),
        san: Array.isArray(x.san) ? x.san.slice(0, 600).map((y) => str(y, 12)) : [], logged: !!x.logged }));
    }
    if (m && typeof m === 'object') {
      const se = m.settings || {};
      out.mental.settings = { mode: ['sumas', 'restas', 'multiplicaciones', 'divisiones', 'mixto'].includes(se.mode) ? se.mode : 'mixto', level: [1, 2, 3].includes(Number(se.level)) ? Number(se.level) : 1, kind: ['n10', 'n20', 'n30', 't2', 't5'].includes(se.kind) ? se.kind : 'n10' };
      if (Array.isArray(m.history)) out.mental.history = m.history.slice(0, 500).filter((x) => x && isDate(x.date)).map((x) => ({
        id: str(x.id, 30), date: x.date, mode: ['sumas', 'restas', 'multiplicaciones', 'divisiones', 'mixto'].includes(x.mode) ? x.mode : 'mixto', level: [1, 2, 3].includes(Number(x.level)) ? Number(x.level) : 1,
        kind: ['n10', 'n20', 'n30', 't2', 't5'].includes(x.kind) ? x.kind : 'n10', total: num(x.total, 0, 0, 5000), correct: num(x.correct, 0, 0, 5000), totalMs: num(x.totalMs, 0, 0, 1e9), avgMs: num(x.avgMs, 0, 0, 1e9),
        errors: Array.isArray(x.errors) ? x.errors.slice(0, 12).map((e) => ({ q: str(e && e.q, 30), a: str(e && e.a, 12), c: str(e && e.c, 12) })) : [], logged: !!x.logged }));
    }
    return out;
  }
  function validate(obj) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.goals) || typeof obj.logs !== 'object' || !obj.logs) throw new Error('Archivo no válido');
    const st = { app: 'byformain', v: 1, goals: [], logs: {}, meta: { created: (obj.meta && obj.meta.created) || null, lastExport: (obj.meta && obj.meta.lastExport) || null } };
    const ids = new Set();
    for (const g of obj.goals) {
      if (!g || typeof g.id !== 'string' || ids.has(g.id) || !isDate(g.start) || !Array.isArray(g.versions) || !g.versions.length) throw new Error('Objetivo no válido');
      ids.add(g.id);
      const versions = g.versions.filter((v) => v && isDate(v.from)).map((v) => ({ from: v.from, schedule: normSchedule(v.schedule), target: normTarget(v.target) }))
        .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
      if (!versions.length) throw new Error('Objetivo sin versiones');
      st.goals.push({
        id: g.id, module: g.module === undefined ? inferModule(g.name) : normModule(g.module), name: String(g.name || 'Sin nombre').slice(0, 80), color: /^#[0-9a-fA-F]{6}$/.test(g.color) ? g.color : '#5e8bff', start: g.start,
        inactive: (g.inactive || []).filter((i) => i && isDate(i.from)).map((i) => ({ from: i.from, to: isDate(i.to) ? i.to : null })), versions,
      });
    }
    for (const d of Object.keys(obj.logs)) {
      if (!isDate(d) || !obj.logs[d] || typeof obj.logs[d] !== 'object') continue;
      for (const id of Object.keys(obj.logs[d])) {
        const l = obj.logs[d][id]; if (!ids.has(id) || !l || !STAT.includes(l.status)) continue;
        (st.logs[d] = st.logs[d] || {})[id] = { status: l.status, amount: l.amount == null || isNaN(Number(l.amount)) ? null : Number(l.amount), note: String(l.note || '').slice(0, 2000), auto: l.auto !== false };
      }
    }
    Object.assign(st, cleanModules(obj));
    return st;
  }
  function scheduleLabel(s) {
    if (s.type === 'daily') return 'Cada día';
    if (s.type === 'weekly') return s.times + (s.times === 1 ? ' vez' : ' veces') + ' por semana';
    const d = s.days;
    if (d.length === 7) return 'Cada día';
    if (d.length === 5 && d.join() === '0,1,2,3,4') return 'Lun a vie';
    return d.map((i) => DIAS_CORTO[i]).join(' ');
  }
  const SING = { minutos: 'minuto', repeticiones: 'repetición', sesiones: 'sesión', páginas: 'página' };
  function targetLabel(t) { return t.value > 0 ? fmtNum(t.value) + ' ' + (t.value === 1 && SING[t.unit] ? SING[t.unit] : t.unit) : ''; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function fmtNum(n) { return n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','); }

  const API = { DAY, MESES, DIAS, DIAS_CORTO, toDays, fromDays, todayStr, addDays, diffDays, weekday, weekStart, weekEnd, weekDates, monthStart, monthEnd, addMonths, daysInMonth, monthGrid,
    uid, makeGoal, normSchedule, normTarget, versionAt, isActive, isArchived, archiveGoal, unarchiveGoal, updateGoal, deleteGoal, moveGoal,
    getLog, setAmount, setStatus, setNote, autoStatus, weeklyCount, statusOf, isScheduled, entriesFor, score, dayScore, rangeStats, streaks,
    SEEDS, newState, newModules, normModule, MODULES, logActivity, validate, scheduleLabel, targetLabel, fmtNum, plural };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.BF = API;
})(typeof self !== 'undefined' ? self : this);
