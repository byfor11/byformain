/* byformain — interfaz. JS plano, sin dependencias. Datos en localStorage. */
(function () {
  'use strict';
  const B = window.BF;
  const KEY = 'byformain:v1';
  const today = () => B.todayStr();

  /* ---------- utilidades DOM ---------- */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const k in props || {}) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') { for (const s in v) s.startsWith('--') ? el.style.setProperty(s, v[s]) : (el.style[s] = v[s]); }
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
    return el;
  }
  const svgNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, ...kids) { const el = document.createElementNS(svgNS, tag); for (const k in attrs || {}) el.setAttribute(k, attrs[k]); kids.flat().forEach((c) => c && el.append(c.nodeType ? c : document.createTextNode(c))); return el; }
  const $ = (q) => document.querySelector(q);
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  /* ---------- estado y persistencia ---------- */
  let S;
  let storageOK = true;
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { storageOK = false; }
    if (raw) {
      try { return B.validate(JSON.parse(raw)); }
      catch (e) { try { localStorage.setItem('byformain:corrupt', raw); } catch (_) {} setTimeout(() => toast('Datos dañados: guardé una copia y empiezo de cero'), 500); }
    }
    return B.newState(today());
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { if (storageOK) { storageOK = false; toast('No se pudo guardar en este dispositivo'); } } }

  /* ---------- UI ---------- */
  const UI = { tab: 'hoy', calMode: 'month', calMonth: B.monthStart(today()), calWeek: today(), hoyDate: today(), ovDate: null, statsRange: 'week', statsAnchor: today(), reorder: false, lastToday: today() };
  const TABS = [
    ['hoy', 'Hoy', '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 9.5"/>'],
    ['cal', 'Calendario', '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'],
    ['train', 'Entrenar', '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'],
    ['evo', 'Evolución', '<path d="M4 19V5M4 19h16"/><path d="M8 15l3-4 3 2 5-6"/>'],
    ['obj', 'Objetivos', '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1" /><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="17.5" r="1"/>'],
  ];
  function renderTabs() {
    $('#tabs').replaceChildren(...TABS.map(([k, label, svg]) => h('button', { class: UI.tab === k ? 'on' : '', 'aria-label': label, 'aria-current': UI.tab === k ? 'page' : null, onclick: () => { UI.tab = k; UI.reorder = false; render(); } },
      h('span', { html: '<svg viewBox="0 0 24 24" aria-hidden="true">' + svg + '</svg>' }), label)));
  }
  function render() {
    const scr = $('#screen'); const top = scr.scrollTop; const same = scr.dataset.tab === UI.tab;
    renderTabs();
    const view = { hoy: viewHoy, cal: viewCal, train: () => window.BFModules.viewTrain(), evo: viewEvo, obj: viewObj, set: viewSet }[UI.tab]();
    scr.replaceChildren(view); scr.dataset.tab = UI.tab; scr.scrollTop = same ? top : 0;
  }
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); }
  function dialog(title, text, buttons) {
    return new Promise((res) => {
      const d = $('#dialog');
      const close = (v) => { d.hidden = true; d.replaceChildren(); res(v); };
      d.replaceChildren(h('div', { class: 'dlg', role: 'dialog' }, h('h3', null, title), h('p', null, text),
        ...buttons.map((b) => h('button', { class: 'btn ' + (b.cls || ''), onclick: () => close(b.value) }, b.label))));
      d.onclick = (e) => { if (e.target === d) close(null); };
      d.hidden = false;
    });
  }
  function openOverlay(el) { const o = $('#overlay'); o.replaceChildren(el); o.hidden = false; }
  function closeOverlay() { const o = $('#overlay'); o.hidden = true; o.replaceChildren(); UI.ovDate = null; }

  function openSettings() { if (UI.tab !== 'set') UI.prevTab = UI.tab; UI.tab = 'set'; render(); }
  function openModule(key) {
    const from = UI.ovDate;
    const onClose = () => { closeOverlay(); if (from) openDay(from); else render(); };
    window.BFModules[key === 'ajedrez' ? 'openChess' : 'openMental']({ onClose });
  }

  /* ---------- estados ---------- */
  const STATUS = [['pending', '○', 'Pendiente'], ['partial', '◐', 'Parcial'], ['done', '✓', 'Hecho'], ['missed', '✕', 'No hecho']];
  const STATUS_LABEL = { done: 'Completado', partial: 'Parcial', pending: 'Pendiente', missed: 'No realizado', none: 'Sin registro' };
  const goalSub = (e) => B.scheduleLabel(e.version.schedule) + (B.targetLabel(e.version.target) ? ' · ' + B.targetLabel(e.version.target) : '');

  /* ---------- Vista DÍA ---------- */
  function dayTitle(date) {
    const t = today(), d = B.diffDays(date, t);
    return d === 0 ? 'Hoy' : d === -1 ? 'Ayer' : d === 1 ? 'Mañana' : cap(B.DIAS[B.weekday(date)]);
  }
  function longDate(date) { const [y, m, d] = date.split('-').map(Number); return B.DIAS[B.weekday(date)] + ', ' + d + ' de ' + B.MESES[m - 1] + ' de ' + y; }

  function buildDay(date, ctx) {
    const root = h('div');
    const list = h('div'), summary = h('div');
    function entries() { return B.entriesFor(S, date, today(), true); }
    function updateSummary() {
      const es = entries(); const done = es.filter((e) => e.status === 'done').length;
      const sc = es.length ? Math.round(es.reduce((a, e) => a + (e.status === 'done' ? 1 : e.status === 'partial' ? 0.5 : 0), 0) / es.length * 100) : 0;
      summary.replaceChildren(es.length ? h('div', { class: 'summary' }, h('div', { class: 'row' }, h('span', null, done + ' de ' + es.length + ' completados'), h('span', null, sc + '%')),
        h('div', { class: 'bar', style: { '--c': 'var(--done)' } }, h('i', { style: { width: sc + '%' } }))) : '');
    }
    function card(goal) {
      const getE = () => entries().find((x) => x.goal.id === goal.id);
      let e = getE();
      const badge = h('span', { class: 'badge' }), sub = h('span');
      const segBtns = STATUS.map(([k, ic, label]) => h('button', {
        class: 's-' + k, 'aria-label': label, onclick: () => {
          const l = B.getLog(S, date, goal.id);
          const cur = l && l.status;
          B.setStatus(S, date, goal.id, cur === k && k !== 'pending' ? 'pending' : k); save(); update(); updateSummary();
        },
      }, h('span', { class: 'ic' }, ic), label));
      const seg = h('div', { class: 'st', role: 'group', 'aria-label': 'Estado de ' + goal.name }, segBtns);
      const amtInput = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'Cantidad de ' + goal.name, placeholder: '0' });
      const tval = e.version.target.value;
      const unitL = e.version.target.unit; const step = unitL === 'minutos' ? 5 : tval >= 100 ? 10 : 1;
      const cur = () => { const l = B.getLog(S, date, goal.id); return l && l.amount != null ? l.amount : 0; };
      const commit = (v) => { B.setAmount(S, date, goal.id, v); save(); update(); updateSummary(); };
      amtInput.addEventListener('change', () => commit(amtInput.value.replace(',', '.').trim()));
      amtInput.addEventListener('focus', () => amtInput.select());
      const amountRow = tval > 0 ? h('div', { class: 'amount' },
        h('button', { class: 'step', 'aria-label': 'Menos', onclick: () => commit(Math.max(0, cur() - step)) }, '−'), amtInput,
        h('button', { class: 'step', 'aria-label': 'Más', onclick: () => commit(cur() + step) }, '+'),
        h('span', { class: 'of' }, '/ ' + B.targetLabel(e.version.target))) : null;
      const noteWrap = h('div');
      function drawNote(open) {
        const l = B.getLog(S, date, goal.id); const has = l && l.note;
        if (open || has) {
          const ta = h('textarea', { class: 'note', placeholder: 'Comentario o resultado…', rows: 2, 'aria-label': 'Comentario de ' + goal.name });
          ta.value = has ? l.note : '';
          ta.addEventListener('input', () => { B.setNote(S, date, goal.id, ta.value); save(); });
          noteWrap.replaceChildren(ta); if (open && !has) ta.focus();
        } else noteWrap.replaceChildren(h('button', { class: 'notebtn', onclick: () => drawNote(true) }, '＋ Añadir comentario'));
      }
      const autoNote = h('div', { class: 'sub', style: { marginTop: '8px', fontSize: '12.5px' } });
      const el = h('section', { class: 'card', style: { '--c': goal.color } },
        h('div', { class: 'top' }, h('div', { class: 'nm' }, h('b', null, goal.name), sub),
          goal.module && date === today() ? h('button', { class: 'btn small primary', 'data-module': goal.module, onclick: () => openModule(goal.module) }, goal.module === 'ajedrez' ? 'Jugar' : 'Entrenar') : null, badge), seg, amountRow, autoNote, noteWrap);
      function update() {
        e = getE(); if (!e) return;
        el.querySelector('.badge').className = 'badge s-' + e.status;
        const l = e.log;
        segBtns.forEach((b, i) => { const k = STATUS[i][0]; b.classList.toggle('on', k === e.status || (k === 'pending' && e.status === 'none')); });
        sub.replaceChildren(goalSub(e));
        if (e.weekly) {
          const c = e.weekly.count, t = e.weekly.times;
          sub.append(' · ', h('b', { style: { color: c >= t ? 'var(--done)' : 'inherit' } }, 'semana ' + c + '/' + t), h('span', { class: 'pips', style: { '--c': goal.color } }, Array.from({ length: t }, (_, i) => h('i', { class: i < c ? 'f' : '' }))));
        }
        if (amountRow && document.activeElement !== amtInput) amtInput.value = l && l.amount != null ? B.fmtNum(l.amount) : '';
        autoNote.textContent = !(l && l.status !== 'pending') && e.status === 'missed' ? (e.weekly ? 'Semana cerrada sin llegar a la cuota' : 'Sin registrar: cuenta como no realizado') : '';
      }
      update(); drawNote(false);
      return el;
    }
    function draw() {
      const es = entries();
      const t = today(), isToday = date === t;
      const backRow = ctx.back ? h('button', { class: 'back', onclick: ctx.back }, '‹ Calendario') : null;
      const sq = { width: '44px', padding: 0, fontSize: '22px' };
      const head = h('div', { class: 'dayhead' },
        h('div', { class: 'tt' }, h('h1', null, dayTitle(date)), h('div', { class: 'sub' }, longDate(date))),
        !isToday ? h('button', { class: 'btn small', onclick: () => ctx.setDate(t) }, 'Hoy') : null,
        h('button', { class: 'btn small', style: sq, 'aria-label': 'Día anterior', onclick: () => ctx.setDate(B.addDays(date, -1)) }, '‹'),
        h('button', { class: 'btn small', style: sq, 'aria-label': 'Día siguiente', onclick: () => ctx.setDate(B.addDays(date, 1)) }, '›'));
      list.replaceChildren(...es.map((e) => card(e.goal)));
      if (!es.length) list.replaceChildren(h('div', { class: 'empty' }, 'No hay objetivos programados para este día.', h('div', { style: { marginTop: '14px' } }, h('button', { class: 'btn', onclick: () => { closeOverlay(); UI.tab = 'obj'; render(); } }, 'Gestionar objetivos'))));
      updateSummary();
      root.replaceChildren(...[backRow, head, banner(), summary,
        date < t ? h('p', { class: 'note-banner' }, 'Día pasado: puedes editar tus registros. Lo que quede sin marcar cuenta como no realizado.') : null, list].filter(Boolean));
    }
    draw();
    return root;
  }
  function banner() {
    if (UI.tab !== 'hoy') return null;
    const last = S.meta.lastExport, t = today(), created = S.meta.created || t;
    const age = last ? B.diffDays(t, last) : B.diffDays(t, created);
    if (age < (last ? 21 : 7) || !Object.keys(S.logs).length) return null;
    return h('div', { class: 'warn' }, 'Tus datos solo están en este iPhone. ' + (last ? 'Hace ' + age + ' días de tu última copia.' : 'Aún no has hecho copia de seguridad.') + ' ',
      h('button', { style: { color: 'var(--accent)', fontWeight: 700 }, onclick: openSettings }, 'Hacer copia'));
  }
  function viewHoy() { return buildDay(UI.hoyDate, { setDate: (d) => { UI.hoyDate = d; render(); } }); }
  function openDay(date) {
    UI.ovDate = date;
    const draw = () => {
      const wrap = h('div', { class: 'obody', style: { paddingTop: 'calc(var(--sat) + 8px)' } }, buildDay(UI.ovDate, { back: () => { closeOverlay(); render(); }, setDate: (d) => { UI.ovDate = d; draw(); } }));
      const o = $('#overlay'); o.replaceChildren(wrap); o.hidden = false; o.style.animation = 'none';
    };
    draw(); $('#overlay').style.animation = '';
  }

  /* ---------- Vista CALENDARIO ---------- */
  function swipe(el, onLeft, onRight) {
    let x0, y0;
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) (dx < 0 ? onLeft : onRight)();
    }, { passive: true });
  }
  function viewCal() {
    const t = today();
    const month = UI.calMode === 'month';
    const go = (n) => { if (month) UI.calMonth = B.addMonths(UI.calMonth, n); else UI.calWeek = B.addDays(UI.calWeek, 7 * n); render(); };
    let title;
    if (month) { const [y, m] = UI.calMonth.split('-').map(Number); title = B.MESES[m - 1] + ' ' + y; }
    else { const a = B.weekStart(UI.calWeek), b = B.weekEnd(UI.calWeek); const [, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number); title = d1 + (m1 !== m2 ? ' ' + B.MESES[m1 - 1].slice(0, 3) : '') + ' – ' + d2 + ' ' + B.MESES[m2 - 1].slice(0, 3) + ' ' + y2; }
    const root = h('div');
    root.append(
      h('div', { class: 'head' }, h('h1', null, 'Calendario'), h('button', { class: 'btn small', onclick: () => { UI.calMonth = B.monthStart(t); UI.calWeek = t; render(); } }, 'Hoy')),
      h('div', { class: 'seg', role: 'tablist' }, h('button', { class: month ? 'on' : '', onclick: () => { UI.calMode = 'month'; UI.calMonth = B.monthStart(UI.calWeek); render(); } }, 'Mes'),
        h('button', { class: month ? '' : 'on', onclick: () => { UI.calMode = 'week'; const inM = UI.calMonth.slice(0, 7) === t.slice(0, 7); UI.calWeek = inM ? t : UI.calMonth; render(); } }, 'Semana')),
      h('div', { class: 'nav' }, h('button', { class: 'arrow', 'aria-label': 'Anterior', onclick: () => go(-1) }, '‹'), h('div', { class: 't' }, title), h('button', { class: 'arrow', 'aria-label': 'Siguiente', onclick: () => go(1) }, '›')));
    if (month) {
      root.append(h('div', { class: 'dow' }, B.DIAS_CORTO.map((d) => h('div', null, d))));
      const grid = h('div', { class: 'mgrid' });
      for (const d of B.monthGrid(UI.calMonth)) {
        const es = B.entriesFor(S, d, t, false);
        const sc = B.dayScore(S, d, t);
        const all = es.length && es.every((e) => e.status === 'done');
        const shown = es.slice(0, 9);
        grid.append(h('button', { class: 'cell' + (d.slice(0, 7) !== UI.calMonth.slice(0, 7) ? ' out' : '') + (d === t ? ' today' : '') + (all ? ' allgood' : ''), 'aria-label': longDate(d) + (sc != null ? ', ' + Math.round(sc * 100) + '%' : ''), onclick: () => openDay(d) },
          h('span', { class: 'n' }, Number(d.slice(8))), h('span', { class: 'dots' }, shown.map((e) => h('i', { class: 'dot s-' + e.status })))));
      }
      root.append(grid);
    } else {
      for (const d of B.weekDates(UI.calWeek)) {
        const es = B.entriesFor(S, d, t, false), done = es.filter((e) => e.status === 'done').length;
        root.append(h('button', { class: 'wrow' + (d === t ? ' today' : ''), onclick: () => openDay(d) },
          h('div', { class: 'd' }, h('small', null, B.DIAS[B.weekday(d)].slice(0, 3)), h('b', null, Number(d.slice(8)))),
          h('div', { class: 'mid' }, es.length ? h('div', { class: 'chips' }, es.map((e) => h('span', { class: 'chip s-' + e.status, style: { '--c': e.goal.color } }, e.goal.name))) : h('span', { class: 'sub' }, d > t ? 'Toca para ver lo programado' : 'Sin registros')),
          es.length ? h('div', { class: 'cnt' }, done + '/' + es.length) : null));
      }
    }
    root.append(h('div', { class: 'legend' }, [['done', 'Completado'], ['partial', 'Parcial'], ['pending', 'Pendiente'], ['missed', 'No realizado']].map(([k, l]) => h('span', { class: 's-' + k }, h('i'), l))));
    swipe(root, () => go(1), () => go(-1));
    return root;
  }

  /* ---------- Vista EVOLUCIÓN ---------- */
  function viewEvo() {
    const t = today(), week = UI.statsRange === 'week';
    const a = UI.statsAnchor;
    const from = week ? B.weekStart(a) : B.monthStart(a), to = week ? B.weekEnd(a) : B.monthEnd(a);
    const go = (n) => { UI.statsAnchor = week ? B.addDays(a, 7 * n) : B.addMonths(B.monthStart(a), n); render(); };
    let title; if (week) { const [, m1, d1] = from.split('-').map(Number), [, m2, d2] = to.split('-').map(Number); title = d1 + ' ' + B.MESES[m1 - 1].slice(0, 3) + ' – ' + d2 + ' ' + B.MESES[m2 - 1].slice(0, 3); } else { const [y, m] = a.split('-').map(Number); title = B.MESES[m - 1] + ' ' + y; }
    const goals = S.goals.filter((g) => { for (let d = from; d <= to; d = B.addDays(d, 1)) if (B.isActive(g, d)) return true; return false; });
    const stats = goals.map((g) => ({ g, r: B.rangeStats(S, g, from, to, t), st: B.streaks(S, g, t) }));
    const tot = stats.reduce((x, y) => ({ e: x.e + y.r.expected, g: x.g + y.r.got }), { e: 0, g: 0 });
    const overall = tot.e ? Math.round(tot.g / tot.e * 100) : null;
    const root = h('div');
    root.append(h('div', { class: 'head' }, h('h1', null, 'Evolución')),
      h('div', { class: 'seg' }, h('button', { class: week ? 'on' : '', onclick: () => { UI.statsRange = 'week'; UI.statsAnchor = t; render(); } }, 'Semana'), h('button', { class: week ? '' : 'on', onclick: () => { UI.statsRange = 'month'; UI.statsAnchor = t; render(); } }, 'Mes')),
      h('div', { class: 'nav' }, h('button', { class: 'arrow', 'aria-label': 'Anterior', onclick: () => go(-1) }, '‹'), h('div', { class: 't' }, title), h('button', { class: 'arrow', 'aria-label': 'Siguiente', onclick: () => go(1) }, '›')),
      h('div', { class: 'summary' }, h('div', { class: 'big' }, h('b', null, overall == null ? '—' : overall + '%'), h('span', { class: 'sub' }, 'cumplimiento global')),
        h('div', { class: 'bar', style: { '--c': 'var(--done)' } }, h('i', { style: { width: (overall || 0) + '%' } }))));
    // gráfico de barras por día
    const days = []; for (let d = from; d <= to; d = B.addDays(d, 1)) days.push(d);
    const W = 340, H = 130, pl = 24, pb = 18, pt = 8, bw = (W - pl) / days.length;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Cumplimiento por día' });
    [0, 0.5, 1].forEach((v) => { const y = pt + (H - pt - pb) * (1 - v); svg.append(s('line', { x1: pl, x2: W, y1: y, y2: y, stroke: 'currentColor', 'stroke-opacity': '.12' }), s('text', { x: 0, y: y + 3 }, Math.round(v * 100) + '')); });
    days.forEach((d, i) => {
      const sc = B.dayScore(S, d, t), full = H - pt - pb, x = pl + i * bw + bw * 0.15, w = bw * 0.7;
      const ht = sc == null ? 2 : Math.max(2, sc * full);
      const col = sc == null ? 'var(--pending)' : sc >= 0.8 ? 'var(--done)' : sc >= 0.4 ? 'var(--partial)' : 'var(--missed)';
      svg.append(s('rect', { x, y: pt + full - ht, width: w, height: ht, rx: Math.min(4, w / 2), fill: col, opacity: d === t ? 1 : 0.9 }));
      const lab = week ? B.DIAS_CORTO[i] : (i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : '');
      if (lab) svg.append(s('text', { x: x + w / 2, y: H - 4, 'text-anchor': 'middle', style: d === t ? 'font-weight:800' : '' }, lab));
    });
    root.append(h('div', { class: 'chart' }, svg));
    // por objetivo
    root.append(h('div', { class: 'sech' }, 'Por objetivo'));
    if (!stats.length) root.append(h('div', { class: 'empty' }, 'No hay objetivos activos en este periodo.'));
    for (const { g, r, st } of stats) {
      const pct = r.pct == null ? null : Math.round(r.pct * 100);
      // sparkline: últimas 8 semanas
      const sp = s('svg', { viewBox: '0 0 88 30', width: 88, height: 30, role: 'img', 'aria-label': 'Últimas 8 semanas' });
      for (let i = 0; i < 8; i++) {
        const ws = B.addDays(B.weekStart(t), -7 * (7 - i)); const rr = B.rangeStats(S, g, ws, B.weekEnd(ws), t);
        const hh = rr.pct == null ? 2 : Math.max(2, rr.pct * 28);
        sp.append(s('rect', { x: i * 11, y: 30 - hh, width: 8, height: hh, rx: 2, fill: g.color, opacity: rr.pct == null ? 0.25 : 1 }));
      }
      root.append(h('div', { class: 'gstat', style: { '--c': g.color } },
        h('div', { class: 'r1' }, h('b', null, g.name), h('span', { class: 'pct' }, pct == null ? '—' : pct + '%')),
        h('div', { class: 'bar' }, h('i', { style: { width: (pct || 0) + '%' } })),
        h('div', { class: 'r2' }, h('div', null, h('div', null, '🔥 Racha: ' + (st.unit === 'días' ? B.plural(st.current, 'día', 'días') : B.plural(st.current, 'semana', 'semanas'))), h('div', null, 'Mejor: ' + (st.unit === 'días' ? B.plural(st.best, 'día', 'días') : B.plural(st.best, 'semana', 'semanas'))), h('div', null, r.expected ? r.done + ' de ' + r.expected + (B.versionAt(g, t).schedule.type === 'weekly' ? (r.expected === 1 ? ' sesión' : ' sesiones') : (r.expected === 1 ? ' día' : ' días')) + ' completados' : 'Sin datos')), sp)));
    }
    swipe(root, () => go(1), () => go(-1));
    return root;
  }

  /* ---------- Vista OBJETIVOS ---------- */
  function viewObj() {
    const t = today(), root = h('div');
    const active = S.goals.filter((g) => !B.isArchived(g)), arch = S.goals.filter((g) => B.isArchived(g));
    root.append(h('div', { class: 'head' }, h('h1', null, 'Objetivos'), h('div', { class: 'btns' },
      S.goals.length > 1 ? h('button', { class: 'btn small', onclick: () => { UI.reorder = !UI.reorder; render(); } }, UI.reorder ? 'Listo' : 'Ordenar') : null,
      h('button', { class: 'btn small', style: { width: '44px', padding: 0 }, 'aria-label': 'Ajustes', onclick: openSettings }, window.BFGear()),
      h('button', { class: 'btn small primary', onclick: () => openEditor(null) }, '＋ Nuevo'))));
    const row = (g) => {
      const v = B.versionAt(g, t); const i = S.goals.indexOf(g);
      const info = h('div', { class: 'nm' }, h('b', null, g.name), h('span', null, B.scheduleLabel(v.schedule) + (B.targetLabel(v.target) ? ' · ' + B.targetLabel(v.target) : '') + (g.module ? ' · ' + window.BFModules.label(g.module) : '')));
      if (UI.reorder) return h('div', { class: 'item', style: { '--c': g.color } }, h('span', { class: 'sw' }), info, h('div', { class: 'mv' },
        h('button', { 'aria-label': 'Subir', disabled: i === 0, onclick: () => { B.moveGoal(S, g.id, -1); save(); render(); } }, '▲'),
        h('button', { 'aria-label': 'Bajar', disabled: i === S.goals.length - 1, onclick: () => { B.moveGoal(S, g.id, 1); save(); render(); } }, '▼')));
      return h('button', { class: 'item', style: { '--c': g.color }, onclick: () => openEditor(g.id) }, h('span', { class: 'sw' }), info, h('span', { class: 'chev' }, '›'));
    };
    if (!S.goals.length) root.append(h('div', { class: 'empty' }, 'Aún no tienes objetivos. Crea el primero con «＋ Nuevo».'));
    if (active.length) root.append(h('div', { class: 'list' }, active.map(row)));
    if (UI.reorder) root.append(h('p', { class: 'hint' }, 'Usa las flechas para cambiar el orden. Se refleja en todas las pantallas.'));
    if (arch.length) root.append(h('div', { class: 'sech' }, 'Archivados'), h('div', { class: 'list' }, arch.map(row)));
    return root;
  }

  /* ---------- Editor de objetivo ---------- */
  const PALETTE = ['#e5484d', '#ff8a3d', '#d6a100', '#12a150', '#00a3b8', '#3b82f6', '#7c5cff', '#8e6bd8', '#ec5fa5', '#6b7080', '#8d6e4b', '#0f766e'];
  const UNITS = ['minutos', 'repeticiones', 'sesiones', 'páginas'];
  function openEditor(id) {
    const t = today();
    const g = id ? S.goals.find((x) => x.id === id) : null;
    const v = g ? B.versionAt(g, t) : { schedule: { type: 'daily' }, target: { value: 30, unit: 'minutos' } };
    const f = {
      name: g ? g.name : '', color: g ? g.color : PALETTE[5 + (S.goals.length % 6)], type: v.schedule.type, days: v.schedule.days ? v.schedule.days.slice() : [0, 1, 2, 3, 4],
      times: v.schedule.times || 3, value: v.target.value ? String(v.target.value).replace('.', ',') : '', unit: v.target.unit || 'minutos', start: g ? g.start : t, module: g ? g.module : null,
    };
    let custom = !UNITS.includes(f.unit) && f.unit !== '';
    const body = h('div', { class: 'obody' });
    const nameI = h('input', { class: 'inp', type: 'text', placeholder: 'Ej.: Meditación', maxlength: 60, autocapitalize: 'sentences', 'aria-label': 'Nombre' });
    nameI.value = f.name; nameI.addEventListener('input', () => (f.name = nameI.value));
    const colorBox = h('div', { class: 'swatches' }), schedBox = h('div'), targetBox = h('div');
    function drawColor() {
      const ci = h('input', { type: 'color', value: f.color, 'aria-label': 'Color personalizado' }); ci.addEventListener('input', () => { f.color = ci.value; drawColor(); });
      colorBox.replaceChildren(...PALETTE.map((c) => h('button', { type: 'button', class: f.color.toLowerCase() === c ? 'on' : '', style: { '--c': c }, 'aria-label': 'Color ' + c, onclick: () => { f.color = c; drawColor(); } })),
        h('label', { class: PALETTE.includes(f.color.toLowerCase()) ? '' : 'on', 'aria-label': 'Otro color' }, ci));
    }
    function drawSched() {
      const types = [['daily', 'Cada día'], ['days', 'Días concretos'], ['weekly', 'Veces/semana']];
      const kids = [h('div', { class: 'seg' }, types.map(([k, l]) => h('button', { type: 'button', class: f.type === k ? 'on' : '', onclick: () => { f.type = k; drawSched(); } }, l)))];
      if (f.type === 'days') kids.push(h('div', { class: 'dayschips' }, B.DIAS_CORTO.map((d, i) => h('button', { type: 'button', class: f.days.includes(i) ? 'on' : '', 'aria-label': B.DIAS[i], 'aria-pressed': f.days.includes(i), onclick: () => { f.days = f.days.includes(i) ? f.days.filter((x) => x !== i) : f.days.concat(i); drawSched(); } }, d))));
      if (f.type === 'weekly') kids.push(h('div', { class: 'stepper' }, h('button', { type: 'button', 'aria-label': 'Menos', onclick: () => { f.times = Math.max(1, f.times - 1); drawSched(); } }, '−'), h('b', null, f.times + (f.times === 1 ? ' vez' : ' veces') + ' por semana'), h('button', { type: 'button', 'aria-label': 'Más', onclick: () => { f.times = Math.min(7, f.times + 1); drawSched(); } }, '+')),
        h('p', { class: 'hint' }, 'Aparece todos los días; tú eliges cuándo hacerlo. Se pone en rojo si la semana acaba sin llegar a la cuota.'));
      schedBox.replaceChildren(...kids);
    }
    function drawTarget() {
      const vi = h('input', { class: 'inp', inputmode: 'decimal', placeholder: 'Cantidad', style: { width: '36%' }, 'aria-label': 'Meta' }); vi.value = f.value; vi.addEventListener('input', () => (f.value = vi.value));
      const sel = h('select', { class: 'inp', style: { flex: 1 }, 'aria-label': 'Unidad' }, UNITS.map((u) => h('option', { value: u }, u)), h('option', { value: '__c' }, 'Otra…'));
      sel.value = custom ? '__c' : f.unit; sel.addEventListener('change', () => { if (sel.value === '__c') { custom = true; f.unit = ''; } else { custom = false; f.unit = sel.value; } drawTarget(); if (custom) setTimeout(() => $('#unitC') && $('#unitC').focus(), 30); });
      const kids = [h('div', { class: 'row2' }, vi, sel)];
      if (custom) { const ci = h('input', { id: 'unitC', class: 'inp', style: { marginTop: '8px' }, placeholder: 'Unidad (ej.: vasos, km, g)', maxlength: 24, 'aria-label': 'Unidad personalizada' }); ci.value = f.unit; ci.addEventListener('input', () => (f.unit = ci.value)); kids.push(ci); }
      kids.push(h('p', { class: 'hint' }, 'Déjala vacía si solo quieres marcar hecho / no hecho.'));
      targetBox.replaceChildren(...kids);
    }
    const startI = h('input', { class: 'inp', type: 'date', value: f.start, 'aria-label': 'Fecha de inicio' }); startI.addEventListener('change', () => { if (startI.value) f.start = startI.value; });
    const modBox = h('div');
    function drawMod() { modBox.replaceChildren(h('div', { class: 'seg' }, [[null, 'Ninguno'], ['ajedrez', 'Ajedrez'], ['calculo', 'Cálculo mental']].map(([k, l]) => h('button', { type: 'button', 'data-mod': k || 'none', class: f.module === k ? 'on' : '', onclick: () => { f.module = k; drawMod(); } }, l)))); }
    drawColor(); drawSched(); drawTarget(); drawMod();
    body.append(
      h('div', { class: 'field' }, h('label', null, 'Nombre'), nameI),
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Color'), colorBox),
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Frecuencia'), schedBox),
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Meta'), targetBox),
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Vincular a módulo'), modBox, h('p', { class: 'hint' }, 'Si vinculas el objetivo, las partidas o sesiones que hagas en «Entrenar» se anotan solas aquí, aunque lo renombres.')),
      h('div', { class: 'field' }, h('label', null, 'Empieza el'), startI, h('p', { class: 'hint' }, 'Los días anteriores a esta fecha no cuentan como no realizados.')));
    if (g) {
      body.append(h('p', { class: 'hint', style: { marginBottom: '14px' } }, 'Los cambios de frecuencia o meta se aplican desde hoy; el historial anterior no se modifica.'),
        h('button', { class: 'btn block', style: { marginBottom: '8px' }, onclick: async () => { if (B.isArchived(g)) { B.unarchiveGoal(g, t); toast('Objetivo reactivado'); } else { B.archiveGoal(g, t); toast('Objetivo archivado'); } save(); closeOverlay(); render(); } }, B.isArchived(g) ? 'Reactivar objetivo' : 'Archivar (conserva el historial)'),
        h('button', { class: 'btn block danger', onclick: async () => {
          const r = await dialog('¿Eliminar «' + g.name + '»?', 'Se borrarán también todos sus registros. Si solo quieres dejar de usarlo, archívalo y se conserva el historial.', [{ label: 'Eliminar para siempre', value: 'del', cls: 'danger' }, { label: 'Archivar en su lugar', value: 'arch' }, { label: 'Cancelar', value: null }]);
          if (r === 'del') { B.deleteGoal(S, g.id); save(); closeOverlay(); render(); toast('Objetivo eliminado'); }
          if (r === 'arch') { B.archiveGoal(g, t); save(); closeOverlay(); render(); toast('Objetivo archivado'); }
        } }, 'Eliminar objetivo'));
    }
    const doSave = () => {
      const name = f.name.trim();
      if (!name) { toast('Ponle un nombre al objetivo'); nameI.focus(); return; }
      if (f.type === 'days' && !f.days.length) { toast('Elige al menos un día'); return; }
      const val = f.value === '' ? 0 : Number(String(f.value).replace(',', '.'));
      if (isNaN(val) || val < 0) { toast('La meta no es un número válido'); return; }
      if (val > 0 && !f.unit.trim()) { toast('Indica la unidad de la meta'); return; }
      const o = { name, color: f.color, module: f.module, start: f.start, schedule: { type: f.type, days: f.days, times: f.times }, target: { value: val, unit: val > 0 ? f.unit.trim() : '' } };
      if (g) B.updateGoal(S, g.id, o, today()); else S.goals.push(B.makeGoal(o, today()));
      save(); closeOverlay(); render(); toast(g ? 'Cambios guardados' : 'Objetivo creado');
    };
    const bar = h('div', { class: 'obar' }, h('button', { onclick: closeOverlay }, 'Cancelar'), h('b', null, g ? 'Editar objetivo' : 'Nuevo objetivo'), h('button', { onclick: doSave }, 'Guardar'));
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } }, bar, body);
    openOverlay(wrap); if (!g) setTimeout(() => nameI.focus(), 250);
  }

  /* ---------- Ajustes / copia de seguridad ---------- */
  async function exportData() {
    S.meta.lastExport = today(); save();
    const json = JSON.stringify(S, null, 2), name = 'byformain-copia-' + today() + '.json';
    try {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Copia de byformain' }); toast('Copia lista'); render(); return; }
    } catch (e) { if (e && e.name === 'AbortError') { return; } }
    const a = h('a', { href: URL.createObjectURL(new Blob([json], { type: 'application/json' })), download: name }); document.body.append(a); a.click(); a.remove();
    toast('Copia descargada'); render();
  }
  async function importFile(file) {
    let obj, st;
    try { obj = JSON.parse(await file.text()); st = B.validate(obj); } catch (e) { toast('Ese archivo no es una copia válida'); return; }
    const r = await dialog('¿Restaurar esta copia?', st.goals.length + ' objetivos y ' + Object.keys(st.logs).length + ' días con registros. Reemplazará los datos actuales (guardo una copia interna por si acaso).', [{ label: 'Restaurar', value: 'ok', cls: 'primary' }, { label: 'Cancelar', value: null }]);
    if (r !== 'ok') return;
    try { localStorage.setItem('byformain:prev', JSON.stringify(S)); } catch (_) {}
    S = st; save(); toast('Copia restaurada'); render();
  }
  function viewSet() {
    const root = h('div', { class: 'settings' });
    const last = S.meta.lastExport;
    const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    const fileI = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    fileI.addEventListener('change', () => { if (fileI.files[0]) importFile(fileI.files[0]); fileI.value = ''; });
    root.append(h('button', { class: 'back', onclick: () => { UI.tab = UI.prevTab || 'hoy'; render(); } }, '‹ Atrás'), h('div', { class: 'head' }, h('h1', null, 'Ajustes')),
      h('div', { class: 'sech' }, 'Copia de seguridad'),
      h('p', null, 'Tus datos viven solo en este iPhone, sin servidor. Si borras la app o los datos de Safari, se pierden: haz copias de vez en cuando.'),
      h('p', null, last ? 'Última copia: ' + longDate(last) : 'Todavía no has hecho ninguna copia.'),
      h('button', { class: 'btn primary block', onclick: exportData }, 'Exportar copia (JSON)'),
      h('button', { class: 'btn block', onclick: () => fileI.click() }, 'Importar copia'), fileI,
      h('button', { class: 'btn block', onclick: async () => { try { await navigator.clipboard.writeText(JSON.stringify(S)); toast('Copiado al portapapeles'); } catch (e) { toast('No se pudo copiar'); } } }, 'Copiar datos al portapapeles'),
      h('div', { class: 'sech' }, 'Datos'),
      h('button', { class: 'btn block danger', onclick: async () => {
        const r = await dialog('¿Borrar todo?', 'Se eliminarán todos los objetivos y registros y se volverán a poner los ejemplos. Exporta una copia antes si quieres conservarlos.', [{ label: 'Borrar y restaurar ejemplos', value: 'ok', cls: 'danger' }, { label: 'Cancelar', value: null }]);
        if (r === 'ok') { try { localStorage.setItem('byformain:prev', JSON.stringify(S)); } catch (_) {} S = B.newState(today()); save(); UI.hoyDate = today(); toast('Datos restablecidos'); render(); }
      } }, 'Borrar todo y restaurar ejemplos'),
      !standalone ? h('div', { class: 'sech' }, 'Instalar en el iPhone') : null,
      !standalone ? h('p', null, 'En Safari: botón Compartir (cuadrado con flecha) → «Añadir a pantalla de inicio». Se abrirá como una app, también sin conexión.') : null,
      h('p', { style: { textAlign: 'center', marginTop: '24px' } }, 'byformain · v1.1'));
    return root;
  }

  /* ---------- arranque ---------- */
  function tick() {
    const t = today();
    if (t !== UI.lastToday) {
      if (UI.hoyDate === UI.lastToday) UI.hoyDate = t;
      if (UI.calWeek === UI.lastToday) UI.calWeek = t;
      if (UI.calMonth === B.monthStart(UI.lastToday)) UI.calMonth = B.monthStart(t);
      UI.lastToday = t; if ($('#overlay').hidden) render();
    }
  }
  function init() {
    S = load(); save();
    window.BFModules.init({ h, s, S: () => S, save, toast, dialog, today, openOverlay, closeOverlay, render, openSettings, openModule });
    window.BFGear = () => window.BFModules.gearIcon();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    render();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    setInterval(tick, 30000);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
    window.__bf = { get S() { return S; }, UI, render, openDay, openEditor, openModule }; // para pruebas
  }
  init();
})();
