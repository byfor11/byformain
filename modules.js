/* byformain — módulos "Entrenar": Ajedrez (contra el ordenador) y Cálculo mental; el inglés está en english.js.
   Se registran desde app.js con BFModules.init(api). Todo local, sin dependencias. */
(function () {
  'use strict';
  const E = window.ChessEngine, M = window.BFMental, B = window.BF;
  let api, h, s;
  const LV = { 1: 'Fácil', 2: 'Medio', 3: 'Difícil' };
  const MODKEY = { ajedrez: 'Ajedrez', calculo: 'Cálculo mental', gramatica: 'Gramática inglesa', speaking: 'Speaking', listening: 'Listening (dictado)' };
  const BTN = { ajedrez: 'Jugar', calculo: 'Entrenar', gramatica: 'Practicar', speaking: 'Practicar', listening: 'Practicar' };
  const S = () => api.S();
  const dateEs = (d) => { const [y, m, dd] = d.split('-').map(Number); return dd + ' ' + B.MESES[m - 1].slice(0, 3) + ' ' + y; };
  let onClose = () => {};

  /* ---------- piezas SVG originales ---------- */
  const PIECES = {
    P: '<circle cx="22.5" cy="11.5" r="5.2"/><path d="M22.5 17C17.5 18.6 16.6 24 18.6 27.4 15.2 29.4 13 33.4 13 37.5H32C32 33.4 29.8 29.4 26.4 27.4 28.4 24 27.5 18.6 22.5 17Z"/>',
    R: '<path d="M12.5 37.5V33.5H32.5V37.5Z"/><path d="M15 33.5V18H30V33.5Z"/><path d="M12.5 18V9H17.7V12.2H20V9H25V12.2H27.3V9H32.5V18Z"/><path d="M15 22.5H30" fill="none"/>',
    B: '<path d="M11.5 37.5V33.5C16 31.6 29 31.6 33.5 33.5V37.5Z"/><path d="M15.5 32C15.5 27.5 19.2 26 19.6 22.4 16.2 20.2 16.8 14.4 22.5 9.2 28.2 14.4 28.8 20.2 25.4 22.4 25.8 26 29.5 27.5 29.5 32Z"/><circle cx="22.5" cy="7.2" r="2.6"/><path d="M19.6 15.8L25.4 21.6" fill="none"/>',
    N: '<path d="M12.5 37.5C12.5 29.5 15.5 25 19.5 21.2 17.4 20.8 15.4 21 13.8 22.6L11.6 19.6C12.6 14.4 16.8 9.6 23.8 8.4L25.4 10.4C32.2 12.4 34.2 21.8 33 37.5Z"/><circle cx="19.6" cy="14.6" r="1.5" style="fill:var(--ps)"/><path d="M12.5 37.5H33" fill="none"/>',
    Q: '<path d="M10 37.5V33.5H35V37.5Z"/><path d="M12 33.5L8.6 15.6 16.4 25 18.2 11.6 22.5 24.6 26.8 11.6 28.6 25 36.4 15.6 33 33.5Z"/><circle cx="8.6" cy="13.2" r="2.2"/><circle cx="18.2" cy="9.6" r="2.2"/><circle cx="26.8" cy="9.6" r="2.2"/><circle cx="36.4" cy="13.2" r="2.2"/>',
    K: '<path d="M11 37.5V33.5H34V37.5Z"/><path d="M12.6 33.5C10.6 26.4 14.8 21.4 22.5 21.4 30.2 21.4 34.4 26.4 32.4 33.5Z"/><path d="M22.5 21.4V8M17.4 12.8H27.6" fill="none" style="stroke-width:3.2;stroke-linecap:round"/>',
  };
  function ensureSprite() {
    if (document.getElementById('bf-sprite')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'bf-sprite'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.cssText = 'position:absolute;width:0;height:0';
    svg.innerHTML = '<defs>' + Object.keys(PIECES).map((k) => '<symbol id="pc-' + k + '" viewBox="0 0 45 45"><g style="fill:var(--pf);stroke:var(--ps);stroke-width:1.6;stroke-linejoin:round">' + PIECES[k] + '</g></symbol>').join('') + '</defs>';
    document.body.append(svg);
  }
  const TYPE_CH = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  const TYPE_ES = { 1: 'peón', 2: 'caballo', 3: 'alfil', 4: 'torre', 5: 'dama', 6: 'rey' };
  function pieceEl(v) {
    const t = Math.abs(v), el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('class', 'pc ' + (v > 0 ? 'w' : 'b')); el.setAttribute('viewBox', '0 0 45 45'); el.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#pc-' + TYPE_CH[t]); el.append(u); return el;
  }

  /* ---------- estructura común ---------- */
  function shell(title, back, backLabel, right) {
    const body = h('div', { class: 'obody' });
    const el = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div', { class: 'obar' }, h('button', { onclick: back }, '‹ ' + backLabel), h('b', null, title), right || h('span', { style: { width: '64px' } })), body);
    return { el, body };
  }
  const seg = (items, cur, on, extra) => h('div', { class: 'seg ' + (extra || '') }, items.map(([k, l]) => h('button', { type: 'button', class: String(cur) === String(k) ? 'on' : '', onclick: () => on(k) }, l)));
  const stat = (v, l) => h('div', { class: 'tile' }, h('b', null, v), h('span', null, l));

  /* =================== AJEDREZ =================== */
  let G = null, cm = null, sel = null, thinking = false, promo = null, fin = null, cview = 'setup', detail = null, detailFrom = 'history', gameToken = 0, cOpts = {};
  const pcNum = () => (cm.color === 'w' ? 1 : -1);
  function saveCurrent() {
    S().chess.current = { color: cm.color, level: cm.level, ms: cm.ms, started: cm.started, moves: G.hist.map((x) => ({ f: x.f, t: x.t, p: x.p })) };
    api.save();
  }
  function touch() { const n = Date.now(); cm.ms += Math.min(n - cm.last, 120000); cm.last = n; }
  function resumeCurrent() {
    const c = S().chess.current; if (!c) return false;
    G = new E.Chess();
    for (const m of c.moves) if (!G.move({ f: m.f, t: m.t, p: m.p })) break;
    cm = { color: c.color, level: c.level, ms: c.ms || 0, last: Date.now(), started: c.started || api.today() };
    fin = null; sel = null; promo = null; thinking = false; return true;
  }
  function openChess(opts) {
    ensureSprite(); cOpts = opts || {}; onClose = cOpts.onClose || (() => { api.closeOverlay(); api.render(); });
    detail = null;
    if (S().chess.current) { resumeCurrent(); cview = 'game'; if (G.turn !== pcNum() && !G.status().over) engineTurn(); }
    else cview = fin && G ? 'game' : 'setup';
    drawChess();
  }
  function startGame(color, level) {
    if (color === 'r') color = Math.random() < 0.5 ? 'w' : 'b';
    S().chess.settings = { color: S().chess.settings.color, level };
    G = new E.Chess(); cm = { color, level, ms: 0, last: Date.now(), started: api.today() }; sel = null; promo = null; fin = null; thinking = false; gameToken++;
    saveCurrent(); cview = 'game'; drawChess(); if (G.turn !== pcNum()) engineTurn();
  }
  function engineTurn() {
    thinking = true; const tk = gameToken; drawChess();
    setTimeout(() => {
      if (tk !== gameToken || !G || fin) return;
      const m = E.pickMove(G, cm.level); thinking = false;
      if (m) { G.move({ f: m.f, t: m.t, p: m.p }); afterMove(); } else drawChess();
    }, 60);
  }
  function afterMove() {
    saveCurrent(); const st = G.status();
    if (st.over) finishGame(st); else if (G.turn !== pcNum()) engineTurn(); else drawChess();
  }
  function tapSquare(sq) {
    if (thinking || fin || promo || !G || G.turn !== pcNum()) return;
    if (sel != null) {
      const mv = G.legalFrom(sel).filter((m) => m.t === sq);
      if (mv.length) {
        if (mv[0].p) { promo = { f: sel, t: sq }; drawChess(); return; }
        playMove(sel, sq, 0); return;
      }
    }
    const v = G.board[sq];
    sel = v * pcNum() > 0 && sel !== sq ? sq : null; drawChess();
  }
  function playMove(f, t, p) { touch(); G.move({ f, t, p }); sel = null; promo = null; afterMove(); }
  function finishGame(st, resigned) {
    touch(); const me = pcNum();
    const winner = resigned ? -me : st.winner, reason = resigned ? 'abandono' : st.reason;
    const result = winner === 0 ? 'draw' : winner === me ? 'win' : 'loss';
    const plies = G.hist.length, date = api.today();
    const rec = { id: B.uid(), date, color: cm.color, level: cm.level, result, reason, plies, ms: cm.ms, san: G.sanList(), logged: false };
    const mins = Math.max(1, Math.round(cm.ms / 60000));
    const txt = result === 'win' ? 'victoria' : result === 'loss' ? 'derrota' : 'tablas';
    const summary = '♟ Ajedrez: ' + txt + ' (' + reason + ') con ' + (cm.color === 'w' ? 'blancas' : 'negras') + ', nivel ' + LV[cm.level].toLowerCase() + ', ' + B.plural(Math.ceil(plies / 2), 'jugada', 'jugadas') + ', ' + mins + ' min.';
    const logs = B.logActivity(S(), 'ajedrez', date, { minutes: cm.ms / 60000, sessions: 1, summary });
    rec.logged = logs.length > 0;
    S().chess.history.unshift(rec); S().chess.history.length = Math.min(S().chess.history.length, 300);
    S().chess.current = null; fin = { rec, logs, st: { reason, winner } }; sel = null; promo = null; thinking = false; api.save(); drawChess();
  }
  function resultText(rec) { return rec.result === 'win' ? 'Victoria' : rec.result === 'loss' ? 'Derrota' : 'Tablas'; }
  function pgnOf(rec) {
    const w = rec.color === 'w' ? 'Jugador' : 'byformain (' + LV[rec.level] + ')', b = rec.color === 'b' ? 'Jugador' : 'byformain (' + LV[rec.level] + ')';
    const res = rec.result === 'draw' ? '1/2-1/2' : (rec.result === 'win') === (rec.color === 'w') ? '1-0' : '0-1';
    return '[Event "byformain"]\n[Date "' + rec.date.replace(/-/g, '.') + '"]\n[White "' + w + '"]\n[Black "' + b + '"]\n[Result "' + res + '"]\n[Termination "' + rec.reason + '"]\n\n' + E.movetextFrom(rec.san) + ' ' + res;
  }

  function boardEl() {
    const flip = cm.color === 'b', st = G.status();
    const targets = sel != null && !thinking ? G.legalFrom(sel) : [], tset = new Set(targets.map((m) => m.t));
    const last = G.hist[G.hist.length - 1], chk = st.check || (st.over && st.reason === 'jaque mate') ? G.ksq(G.turn) : -1;
    const el = h('div', { class: 'board', role: 'grid', 'aria-label': 'Tablero de ajedrez' });
    for (let vr = 0; vr < 8; vr++) for (let vf = 0; vf < 8; vf++) {
      const r = flip ? 7 - vr : vr, f = flip ? 7 - vf : vf, sq = r * 8 + f, v = G.board[sq], dark = (r + f) % 2 === 1;
      const cls = 'sq ' + (dark ? 'd' : 'l') + (sel === sq ? ' sel' : '') + (last && (last.f === sq || last.t === sq) ? ' last' : '') + (chk === sq ? ' chk' : '') + (tset.has(sq) ? ' tgt' + (v ? ' cap' : '') : '');
      el.append(h('button', { class: cls, 'data-sq': E.sqName(sq), 'aria-label': E.sqName(sq) + (v ? ', ' + TYPE_ES[Math.abs(v)] + (v > 0 ? ' blanco' : ' negro') : ', vacía'), onclick: () => tapSquare(sq) },
        v ? pieceEl(v) : null, vf === 0 ? h('i', { class: 'co r' }, 8 - r) : null, vr === 7 ? h('i', { class: 'co f' }, E.FILES[f]) : null));
    }
    return el;
  }
  function drawChess() {
    if (cview === 'setup') return api.openOverlay(chessSetup().el);
    if (cview === 'history') return api.openOverlay(chessHistory().el);
    if (cview === 'detail') return api.openOverlay(chessDetail().el);
    api.openOverlay(chessGame().el);
  }
  function chessSetup() {
    const se = S().chess.settings; const sh = shell('Ajedrez', () => onClose(), 'Cerrar');
    const hist = S().chess.history, w = hist.filter((x) => x.result === 'win').length, l = hist.filter((x) => x.result === 'loss').length, d = hist.length - w - l;
    sh.body.append(
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Tu color'), seg([['w', 'Blancas'], ['b', 'Negras'], ['r', 'Al azar']], se.color, (k) => { se.color = k; api.save(); drawChess(); })),
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Dificultad'), seg([[1, 'Fácil'], [2, 'Medio'], [3, 'Difícil']], se.level, (k) => { se.level = Number(k); api.save(); drawChess(); }),
        h('p', { class: 'hint' }, se.level === 1 ? 'Juega rápido y comete errores: ideal para empezar.' : se.level === 2 ? 'Calcula unas jugadas por delante.' : 'Piensa hasta ~1 segundo por jugada. Exigente.')),
      h('button', { class: 'btn primary block', style: { minHeight: '52px', fontSize: '17px' }, onclick: () => startGame(se.color, se.level) }, 'Empezar partida'),
      h('div', { class: 'sech' }, 'Tus partidas'),
      h('div', { class: 'tiles' }, stat(hist.length, 'jugadas'), stat(w, 'victorias'), stat(d, 'tablas'), stat(l, 'derrotas')),
      h('button', { class: 'btn block', style: { marginTop: '12px' }, disabled: !hist.length, onclick: () => { cview = 'history'; drawChess(); } }, 'Historial de partidas' + (hist.length ? ' (' + hist.length + ')' : '')),
      h('p', { class: 'hint', style: { marginTop: '14px' } }, 'Al terminar cada partida se anota sola en tu objetivo «Ajedrez» (minutos o sesiones, según su meta) y se añade el resultado al comentario del día.'));
    return sh;
  }
  function chessGame() {
    const sh = shell('Ajedrez', () => { cview = 'setup'; onClose(); }, 'Cerrar',
      h('button', { class: 'tb', style: { width: '64px', textAlign: 'right' }, onclick: () => { cview = 'history'; drawChess(); }, 'aria-label': 'Historial' }, 'Historial'));
    const st = G.status(), me = pcNum();
    let msg;
    if (fin) msg = 'Partida terminada';
    else if (thinking) msg = 'Pensando…';
    else msg = (st.check ? '¡Jaque! ' : '') + 'Tu turno (' + (me === 1 ? 'blancas' : 'negras') + ')';
    sh.body.append(h('div', { class: 'cstat' + (fin ? ' over' : thinking ? ' think' : st.check ? ' chk' : '') , role: 'status' }, h('span', null, msg), h('span', { class: 'sub' }, LV[cm.level] + ' · jugada ' + Math.floor(G.hist.length / 2 + 1))));
    const bw = h('div', { class: 'bwrap' }, boardEl());
    if (promo) {
      bw.append(h('div', { class: 'promo' }, h('b', null, 'Coronar a…'), h('div', { class: 'pr' }, [[5, 'Dama'], [4, 'Torre'], [3, 'Alfil'], [2, 'Caballo']].map(([t, n]) =>
        h('button', { class: 'btn', 'aria-label': n, 'data-promo': n, onclick: () => playMove(promo.f, promo.t, t) }, pieceEl(me * t), h('span', null, n)))),
        h('button', { class: 'btn small', onclick: () => { promo = null; sel = null; drawChess(); } }, 'Cancelar')));
    }
    sh.body.append(bw);
    if (fin) {
      const r = fin.rec, logTxt = fin.logs.length ? 'Anotada en «' + fin.logs[0].name + '»: +' + B.targetLabel({ value: fin.logs[0].added, unit: fin.logs[0].unit || '' }) : 'No hay un objetivo de ajedrez programado hoy: no se anotó.';
      sh.body.append(h('div', { class: 'result ' + r.result, role: 'status' }, h('b', null, resultText(r) + (r.result === 'draw' ? ' · ' : ' · ') + r.reason), h('span', null, B.plural(Math.ceil(r.plies / 2), 'jugada', 'jugadas') + ' · ' + B.fmtNum(Math.max(1, Math.round(r.ms / 60000))) + ' min'), h('span', { class: 'ok' }, '✓ ' + logTxt)),
        h('div', { class: 'row2', style: { marginTop: '10px' } }, h('button', { class: 'btn primary', style: { flex: 1 }, onclick: () => { fin = null; G = null; cview = 'setup'; drawChess(); } }, 'Nueva partida'),
          h('button', { class: 'btn', style: { flex: 1 }, onclick: () => { detail = r; detailFrom = 'game'; cview = 'detail'; drawChess(); } }, 'Ver jugadas')));
    } else {
      sh.body.append(h('div', { class: 'row2 ctl' },
        h('button', { class: 'btn', disabled: thinking || G.hist.length < (G.turn === me ? 2 : 1) || (G.turn !== me), onclick: undoMove }, '↶ Deshacer'),
        h('button', { class: 'btn', onclick: async () => { const r = await api.dialog('¿Empezar otra partida?', 'La partida actual se perderá sin registrarse. Si quieres terminarla, usa «Rendirse».', [{ label: 'Nueva partida', value: 'ok', cls: 'primary' }, { label: 'Seguir jugando', value: null }]); if (r === 'ok') { gameToken++; thinking = false; S().chess.current = null; api.save(); G = null; cview = 'setup'; drawChess(); } } }, 'Nueva'),
        h('button', { class: 'btn danger', onclick: async () => { const r = await api.dialog('¿Rendirte?', 'Contará como derrota y se anotará en tu objetivo.', [{ label: 'Rendirme', value: 'ok', cls: 'danger' }, { label: 'Seguir jugando', value: null }]); if (r === 'ok') { gameToken++; finishGame(null, true); } } }, 'Rendirse')));
    }
    const mv = h('div', { class: 'moves', 'aria-label': 'Jugadas' });
    const list = G.sanList();
    if (!list.length) mv.append(h('span', { class: 'sub' }, 'Las jugadas aparecerán aquí.'));
    for (let i = 0; i < list.length; i++) { if (i % 2 === 0) mv.append(h('span', { class: 'mn' }, (i / 2 + 1) + '.')); mv.append(h('span', { class: 'mv' + (i === list.length - 1 ? ' cur' : '') }, list[i])); }
    sh.body.append(mv); setTimeout(() => { mv.scrollTop = mv.scrollHeight; }, 0);
    return sh;
  }
  function undoMove() {
    if (thinking || fin || !G || G.turn !== pcNum() || G.hist.length < 2) return;
    G.undo(); G.undo(); sel = null; promo = null; saveCurrent(); drawChess();
  }
  function chessHistory() {
    const back = () => { cview = fin || S().chess.current ? 'game' : 'setup'; drawChess(); };
    const sh = shell('Historial', back, 'Atrás'); const hist = S().chess.history;
    if (!hist.length) sh.body.append(h('div', { class: 'empty' }, 'Todavía no has terminado ninguna partida.'));
    sh.body.append(h('div', { class: 'list' }, hist.map((r) => h('button', { class: 'item', onclick: () => { detail = r; detailFrom = 'history'; cview = 'detail'; drawChess(); } },
      h('span', { class: 'rb ' + r.result }, r.result === 'win' ? 'V' : r.result === 'loss' ? 'D' : 'T'),
      h('div', { class: 'nm' }, h('b', null, resultText(r) + ' · ' + r.reason), h('span', null, dateEs(r.date) + ' · ' + (r.color === 'w' ? 'Blancas' : 'Negras') + ' · ' + LV[r.level] + ' · ' + B.plural(Math.ceil(r.plies / 2), 'jugada', 'jugadas'))),
      h('span', { class: 'chev' }, '›')))));
    return sh;
  }
  function chessDetail() {
    const r = detail, sh = shell('Partida', () => { cview = detailFrom; drawChess(); }, 'Atrás');
    const pgn = pgnOf(r);
    sh.body.append(h('div', { class: 'summary' }, h('div', { class: 'row' }, h('span', null, resultText(r) + ' · ' + r.reason), h('span', null, dateEs(r.date))),
      h('div', { class: 'sub', style: { marginTop: '4px' } }, (r.color === 'w' ? 'Blancas' : 'Negras') + ' · ' + LV[r.level] + ' · ' + B.plural(Math.ceil(r.plies / 2), 'jugada', 'jugadas'))),
      h('div', { class: 'sech' }, 'Jugadas'), h('pre', { class: 'pgn' }, pgn.split('\n\n')[1]),
      h('button', { class: 'btn block', onclick: async () => { try { await navigator.clipboard.writeText(pgn); api.toast('PGN copiado'); } catch (e) { api.toast('No se pudo copiar'); } } }, 'Copiar PGN'));
    return sh;
  }

  /* =================== CÁLCULO MENTAL =================== */
  let MS = null, mview = 'setup', mres = null, mOpts = {};
  const mset = () => S().mental.settings;
  function openMental(opts) {
    mOpts = opts || {}; onClose = mOpts.onClose || (() => { api.closeOverlay(); api.render(); });
    mview = 'setup'; mres = null; drawMental();
  }
  function drawMental() {
    if (mview === 'setup') return api.openOverlay(mentalSetup().el);
    if (mview === 'history') return api.openOverlay(mentalHistory().el);
    if (mview === 'result') return api.openOverlay(mentalResult().el);
    api.openOverlay(mentalRun().el);
  }
  function mentalSetup() {
    const se = mset(), sh = shell('Cálculo mental', () => onClose(), 'Cerrar'); const hist = S().mental.history;
    const best = M.bestFor(hist, se.mode, se.level, se.kind);
    sh.body.append(
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Tipo de operación'), h('div', { class: 'chips2' }, M.MODES.map(([k, l, ic]) => h('button', { class: se.mode === k ? 'on' : '', 'data-mode': k, onclick: () => { se.mode = k; api.save(); drawMental(); } }, h('b', null, ic), l)))),
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Dificultad'), seg(M.LEVELS, se.level, (k) => { se.level = Number(k); api.save(); drawMental(); })),
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Duración'), h('div', { class: 'chips2 k5' }, M.KINDS.map(([k, l]) => h('button', { class: se.kind === k ? 'on' : '', 'data-kind': k, onclick: () => { se.kind = k; api.save(); drawMental(); } }, l)))),
      h('div', { class: 'sub', style: { margin: '-6px 4px 14px' } }, '🏆 Tu mejor marca: ' + M.bestLabel(se.kind, best)),
      h('button', { class: 'btn primary block', style: { minHeight: '52px', fontSize: '17px' }, onclick: () => startMental() }, 'Empezar'),
      h('button', { class: 'btn block', style: { marginTop: '10px' }, disabled: !hist.length, onclick: () => { mview = 'history'; drawMental(); } }, 'Historial y progreso' + (hist.length ? ' (' + hist.length + ')' : '')),
      h('p', { class: 'hint', style: { marginTop: '14px' } }, 'Al terminar, la sesión se anota sola en tu objetivo «Cálculo mental» (minutos o sesiones, según su meta) con un resumen en el comentario.'));
    return sh;
  }
  const fmtClock = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  function startMental() {
    const se = mset(), info = M.kindInfo(se.kind), now = Date.now();
    MS = { mode: se.mode, level: se.level, kind: se.kind, info, answers: [], q: M.nextQuestion(se.mode, se.level, Math.random), qStart: now, start: now, input: '', locked: false, end: info.t ? now + info.t * 1000 : null, timer: null, key: null, done: false };
    mview = 'run'; drawMental();
  }
  function mentalRun() {
    const sh = shell(M.modeLabel(MS.mode) + ' · ' + M.levelLabel(MS.level), () => exitRun(), 'Salir', h('span', { class: 'score', id: 'mscore', style: { width: '64px', textAlign: 'right', fontWeight: 700 } }, ''));
    const progress = h('div', { class: 'mprog' }), bar = h('div', { class: 'bar', style: { '--c': 'var(--accent)' } }, h('i', { style: { width: '100%' } }));
    const qEl = h('div', { class: 'mq', 'aria-live': 'polite' }), aEl = h('div', { class: 'ma', role: 'status' }), fb = h('div', { class: 'mfb' });
    const pad = h('div', { class: 'pad' });
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];
    for (const k of keys) pad.append(h('button', { class: 'key' + (k === '✓' ? ' go' : k === '⌫' ? ' del' : ''), 'data-k': k, 'aria-label': k === '⌫' ? 'Borrar' : k === '✓' ? 'Comprobar' : k, onclick: () => press(k) }, k));
    sh.body.style.display = 'flex'; sh.body.style.flexDirection = 'column';
    sh.body.append(progress, bar, h('div', { class: 'mmid' }, qEl, aEl, fb), pad);
    function paint() {
      qEl.textContent = MS.q.text + ' ='; aEl.textContent = MS.input || '\u00A0';
      aEl.className = 'ma'; fb.textContent = '';
      const n = MS.answers.length, ok = MS.answers.filter((x) => x.correct).length;
      sh.el.querySelector('#mscore').textContent = '✓ ' + ok;
      progress.textContent = MS.info.n ? 'Pregunta ' + Math.min(n + 1, MS.info.n) + ' de ' + MS.info.n : fmtClock(MS.end - Date.now()) + ' · ' + n + ' respondidas';
    }
    function tick() {
      if (!sh.el.isConnected || MS.done) return stopTimers();
      if (MS.end) { const left = MS.end - Date.now(); bar.firstChild.style.width = Math.max(0, left / (MS.info.t * 1000) * 100) + '%'; progress.textContent = fmtClock(left) + ' · ' + MS.answers.length + ' respondidas'; if (left <= 0) finishRun(true); }
      else bar.firstChild.style.width = (1 - MS.answers.length / MS.info.n) * 100 + '%';
    }
    function press(k) {
      if (MS.locked || MS.done) return;
      if (k === '⌫') MS.input = MS.input.slice(0, -1);
      else if (k === '✓') { if (MS.input) return submit(); }
      else if (MS.input.length < 7) MS.input += k;
      aEl.textContent = MS.input || '\u00A0';
      if (k !== '⌫' && k !== '✓' && MS.input.length === String(MS.q.answer).length) submit();
    }
    function submit() {
      const val = Number(MS.input), ms = Date.now() - MS.qStart, ok = val === MS.q.answer;
      MS.answers.push({ q: MS.q.text, a: val, c: MS.q.answer, correct: ok, ms }); MS.locked = true;
      aEl.className = 'ma ' + (ok ? 'ok' : 'bad'); fb.textContent = ok ? '✓ ¡Correcto!' : '✕ Era ' + MS.q.answer;
      sh.el.querySelector('#mscore').textContent = '✓ ' + MS.answers.filter((x) => x.correct).length;
      const last = MS.info.n && MS.answers.length >= MS.info.n;
      setTimeout(() => {
        if (MS.done) return;
        if (last) return finishRun(false);
        MS.q = M.nextQuestion(MS.mode, MS.level, Math.random, MS.q.text); MS.input = ''; MS.locked = false; MS.qStart = Date.now(); paint(); tick();
      }, ok ? 260 : 950);
    }
    MS.ui = { paint, press }; paint(); tick();
    stopTimers(); MS.timer = setInterval(tick, 250);
    MS.key = (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('⌫'); else if (e.key === 'Enter') press('✓'); };
    document.addEventListener('keydown', MS.key);
    return sh;
  }
  function stopTimers() { if (MS) { clearInterval(MS.timer); if (MS.key) document.removeEventListener('keydown', MS.key); } }
  async function exitRun() {
    if (!MS.answers.length) { MS.done = true; stopTimers(); mview = 'setup'; return drawMental(); }
    const r = await api.dialog('¿Terminar la sesión?', 'Llevas ' + MS.answers.length + ' respuestas.', [{ label: 'Terminar y guardar', value: 'save', cls: 'primary' }, { label: 'Descartar', value: 'drop', cls: 'danger' }, { label: 'Seguir', value: null }]);
    if (r === 'save') finishRun(false); else if (r === 'drop') { MS.done = true; stopTimers(); mview = 'setup'; drawMental(); }
  }
  function finishRun(timeUp) {
    if (MS.done) return; MS.done = true; stopTimers();
    const info = MS.info, now = Date.now(); let elapsed = now - MS.start; if (info.t) elapsed = Math.min(elapsed, info.t * 1000);
    const sm = M.summarize(MS.answers, elapsed);
    if (!sm.total) { mview = 'setup'; return drawMental(); }
    const completed = info.t ? true : sm.total >= info.n;
    const rec = { id: B.uid(), date: api.today(), mode: MS.mode, level: MS.level, kind: MS.kind, total: sm.total, correct: sm.correct, totalMs: Math.round(sm.totalMs), avgMs: Math.round(sm.avgMs),
      errors: MS.answers.filter((x) => !x.correct).slice(0, 12).map((x) => ({ q: x.q, a: String(x.a), c: String(x.c) })), logged: false };
    const hist = S().mental.history, prev = M.bestFor(hist, rec.mode, rec.level, rec.kind);
    const record = !!(completed && prev && M.isBetter(rec.kind, rec, prev));
    const summary = '🧮 Cálculo mental · ' + M.modeLabel(rec.mode) + ' (' + M.levelLabel(rec.level).toLowerCase() + ', ' + M.kindLabel(rec.kind).toLowerCase() + '): ' + rec.correct + '/' + rec.total + ' (' + Math.round(sm.acc * 100) + ' %), ' + M.fmtSec(rec.avgMs) + ' s por respuesta.';
    const logs = B.logActivity(S(), 'calculo', rec.date, { minutes: sm.totalMs / 60000, sessions: 1, summary });
    rec.logged = logs.length > 0; hist.unshift(rec); hist.length = Math.min(hist.length, 500); api.save();
    mres = { rec, sm, logs, record, prev, errors: MS.answers.filter((x) => !x.correct) }; mview = 'result'; drawMental();
  }
  function mentalResult() {
    const r = mres, sh = shell('Resultado', () => onClose(), 'Cerrar');
    sh.body.append(...[
      r.record ? h('div', { class: 'record' }, '🏆 ¡Nueva mejor marca!') : null,
      h('div', { class: 'tiles' }, stat(r.rec.correct + '/' + r.rec.total, 'aciertos'), stat(Math.round(r.sm.acc * 100) + ' %', 'precisión'), stat(M.fmtSec(r.rec.avgMs) + ' s', 'por respuesta'), stat(fmtClock(r.rec.totalMs), 'tiempo')),
      h('div', { class: 'sub', style: { margin: '12px 4px' } }, M.modeLabel(r.rec.mode) + ' · ' + M.levelLabel(r.rec.level) + ' · ' + M.kindLabel(r.rec.kind)),
      h('div', { class: 'result win' }, h('span', { class: 'ok' }, r.logs.length ? '✓ Anotada en «' + r.logs[0].name + '»: +' + B.targetLabel({ value: r.logs[0].added, unit: r.logs[0].unit || '' }) : 'No hay un objetivo de cálculo mental programado hoy: no se anotó.')),
      r.errors.length ? h('div', { class: 'sech' }, 'Para repasar') : null,
      r.errors.length ? h('div', { class: 'list' }, r.errors.slice(0, 12).map((e) => h('div', { class: 'item' }, h('div', { class: 'nm' }, h('b', null, e.q + ' = ' + e.c), h('span', null, 'Respondiste ' + e.a + ' · ' + M.fmtSec(e.ms) + ' s'))))) : null,
      h('div', { class: 'row2', style: { marginTop: '14px' } }, h('button', { class: 'btn primary', style: { flex: 1 }, onclick: () => startMental() }, 'Repetir'), h('button', { class: 'btn', style: { flex: 1 }, onclick: () => { mview = 'setup'; drawMental(); } }, 'Cambiar'))].filter(Boolean));
    return sh;
  }
  function lineChart(vals, o) {
    const W = 340, H = 110, pl = 28, pr = 8, pt = 8, pb = 16; const n = vals.length;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.label });
    const lo = o.min, hi = Math.max(o.max, 1e-9);
    [lo, (lo + hi) / 2, hi].forEach((v) => { const y = pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo)); svg.append(s('line', { x1: pl, x2: W - pr, y1: y, y2: y, stroke: 'currentColor', 'stroke-opacity': '.12' }), s('text', { x: 0, y: y + 3 }, o.fmt(v))); });
    const pts = vals.map((v, i) => [pl + (n === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1)), pt + (H - pt - pb) * (1 - (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo))]);
    svg.append(s('polyline', { points: pts.map((p) => p.join(',')).join(' '), fill: 'none', stroke: o.color, 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    pts.forEach((p) => svg.append(s('circle', { cx: p[0], cy: p[1], r: 3, fill: o.color })));
    return svg;
  }
  function mentalHistory() {
    const sh = shell('Progreso', () => { mview = 'setup'; drawMental(); }, 'Atrás'); const hist = S().mental.history;
    const last = hist.slice(0, 20).reverse();
    if (last.length) {
      sh.body.append(h('div', { class: 'sech' }, 'Precisión (últimas ' + last.length + ' sesiones)'), h('div', { class: 'chart' }, lineChart(last.map((r) => r.total ? r.correct / r.total * 100 : 0), { min: 0, max: 100, color: 'var(--done)', fmt: (v) => Math.round(v) + '', label: 'Precisión por sesión' })),
        h('div', { class: 'sech' }, 'Segundos por respuesta'), h('div', { class: 'chart' }, lineChart(last.map((r) => r.avgMs / 1000), { min: 0, max: Math.max(5, Math.ceil(Math.max(...last.map((r) => r.avgMs / 1000)))), color: 'var(--accent)', fmt: (v) => (Math.round(v * 10) / 10) + '', label: 'Segundos por respuesta' })));
    }
    // mejores marcas por modo
    const rows = [];
    for (const [mk, ml] of M.MODES) for (const [lv] of M.LEVELS) for (const [kk, kl] of M.KINDS) { const b = M.bestFor(hist, mk, lv, kk); if (b) rows.push([ml + ' · ' + M.levelLabel(lv) + ' · ' + kl, M.bestLabel(kk, b)]); }
    sh.body.append(h('div', { class: 'sech' }, 'Mejores marcas'));
    sh.body.append(rows.length ? h('div', { class: 'list' }, rows.map(([a, b]) => h('div', { class: 'item' }, h('div', { class: 'nm' }, h('b', null, b), h('span', null, a))))) : h('div', { class: 'empty' }, 'Aún no hay marcas.'));
    sh.body.append(h('div', { class: 'sech' }, 'Sesiones'), h('div', { class: 'list' }, hist.slice(0, 60).map((r) => h('div', { class: 'item' }, h('div', { class: 'nm' }, h('b', null, r.correct + '/' + r.total + ' · ' + Math.round(r.total ? r.correct / r.total * 100 : 0) + ' % · ' + M.fmtSec(r.avgMs) + ' s'), h('span', null, dateEs(r.date) + ' · ' + M.modeLabel(r.mode) + ' · ' + M.levelLabel(r.level) + ' · ' + M.kindLabel(r.kind)))))));
    return sh;
  }

  /* =================== pestaña ENTRENAR =================== */
  function viewTrain() {
    ensureSprite(); const root = h('div'), ch = S().chess, me = S().mental, t = api.today();
    const hist = ch.history, w = hist.filter((x) => x.result === 'win').length, l = hist.filter((x) => x.result === 'loss').length;
    const todayM = me.history.filter((x) => x.date === t), ci = window.BFEnglish ? window.BFEnglish.cardsInfo() : { gToday: 0, gAll: 0, sToday: 0, sAll: 0, spMins: 0 };
    root.append(h('div', { class: 'head' }, h('h1', null, 'Entrenar'), h('button', { class: 'btn small', style: { width: '44px', padding: 0 }, 'aria-label': 'Ajustes', onclick: api.openSettings }, api.gearIcon())),
      h('p', { class: 'sub', style: { margin: '-6px 4px 14px' } }, 'Practica dentro de la app: lo que hagas se anota solo en tus objetivos.'),
      h('button', { class: 'mcard chess', 'data-open': 'ajedrez', onclick: () => api.openModule('ajedrez') }, h('div', { class: 'mi' }, pieceEl(-5)), h('div', { class: 'mt' }, h('b', null, 'Ajedrez'),
        h('span', null, ch.current ? 'Partida en curso · jugada ' + Math.floor(ch.current.moves.length / 2 + 1) : 'Juega contra el ordenador'), h('span', { class: 'sub' }, hist.length ? hist.length + ' partidas · ' + w + ' V · ' + l + ' D' : 'Aún no has jugado')), h('span', { class: 'chev' }, '›')),
      h('button', { class: 'mcard calc', 'data-open': 'calculo', onclick: () => api.openModule('calculo') }, h('div', { class: 'mi' }, h('b', null, '÷×')), h('div', { class: 'mt' }, h('b', null, 'Cálculo mental'),
        h('span', null, 'Sumas, restas, multiplicaciones y divisiones'), h('span', { class: 'sub' }, todayM.length ? 'Hoy: ' + todayM.length + (todayM.length === 1 ? ' sesión' : ' sesiones') : me.history.length ? me.history.length + ' sesiones en total' : 'Aún no has entrenado')), h('span', { class: 'chev' }, '›')),
      h('button', { class: 'mcard gram', 'data-open': 'gramatica', onclick: () => api.openModule('gramatica') }, h('div', { class: 'mi' }, h('b', null, 'Aa')), h('div', { class: 'mt' }, h('b', null, 'Gramática inglesa'),
        h('span', null, 'Quiz de A2 a C1 con explicaciones'), h('span', { class: 'sub' }, ci.gToday ? 'Hoy: ' + ci.gToday + (ci.gToday === 1 ? ' sesión' : ' sesiones') : ci.gAll ? ci.gAll + ' sesiones en total' : 'Aún no has practicado')), h('span', { class: 'chev' }, '›')),
      h('button', { class: 'mcard speak', 'data-open': 'speaking', onclick: () => api.openModule('speaking') }, h('div', { class: 'mi' }, h('b', null, '🎤')), h('div', { class: 'mt' }, h('b', null, 'Speaking y listening'),
        h('span', null, 'Hablar, shadowing y dictado'), h('span', { class: 'sub' }, ci.sToday ? 'Hoy: ' + ci.spMins + ' min practicados' : ci.sAll ? ci.sAll + ' sesiones en total' : 'Aún no has practicado')), h('span', { class: 'chev' }, '›')));
    return root;
  }
  const gearIcon = () => h('span', { html: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>' });

  window.BFModules = {
    init(a) { api = a; h = a.h; s = a.s; api.gearIcon = gearIcon; if (window.BFEnglish) window.BFEnglish.init(a, { shell, seg, stat, lineChart, fmtClock, dateEs }); },
    open(key, opts) {
      const E2 = window.BFEnglish;
      if (key === 'ajedrez') return openChess(opts); if (key === 'calculo') return openMental(opts);
      if (key === 'gramatica') return E2.openGrammar(opts); if (key === 'speaking') return E2.openSpeaking(opts);
      if (key === 'listening') return E2.openSpeaking(Object.assign({ mode: 'dictado' }, opts));
    },
    btnLabel: (k) => BTN[k] || 'Entrenar',
    gearIcon: () => gearIcon(),
    viewTrain, openChess, openMental,
    label: (k) => MODKEY[k],
  };
})();
