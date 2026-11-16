/* byformain — módulos de inglés de «Entrenar»: Gramática (quiz) y Speaking (hablar, shadowing, dictado).
   Se inicializa desde modules.js (BFEnglish.init). Todo local: voz y reconocimiento del propio navegador, sin servidores. */
(function () {
  'use strict';
  const Gr = window.BFGrammar, Sp = window.BFSpeaking, B = window.BF;
  let api, h, s, U, onClose = () => {};
  const S = () => api.S();
  const pct = (x) => Math.round(x * 100);
  const noLog = (what) => 'No hay un objetivo de ' + what + ' programado hoy: no se anotó.';
  const logLine = (logs, what) => (logs.length ? '✓ Anotada en «' + logs[0].name + '»: +' + B.targetLabel({ value: logs[0].added, unit: logs[0].unit || '' }) : noLog(what));
  const dec = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

  /* =================== GRAMÁTICA =================== */
  let GM = null, gview = 'setup', gres = null;
  const gset = () => S().grammar.settings;
  function openGrammar(opts) {
    opts = opts || {}; onClose = opts.onClose || (() => { api.closeOverlay(); api.render(); });
    gview = 'setup'; gres = null; drawGrammar();
  }
  function drawGrammar() {
    if (gview === 'setup') return api.openOverlay(grSetup().el);
    if (gview === 'history') return api.openOverlay(grHistory().el);
    if (gview === 'result') return api.openOverlay(grResult().el);
    api.openOverlay(grRun().el);
  }
  function grSetup() {
    const se = gset(), sh = U.shell('Gramática inglesa', () => onClose(), 'Cerrar'), hist = S().grammar.history;
    const best = Gr.bestFor(hist, se.topic, se.level, se.kind), pool = Gr.pool(se.level, se.topic).length, need = Gr.kindInfo(se.kind).n || 0;
    sh.body.append(
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Nivel'), U.seg(Gr.LEVELS, se.level, (k) => { se.level = k; api.save(); drawGrammar(); }), h('p', { class: 'hint' }, Gr.LEVEL_DESC[se.level] + ' · ' + Gr.BANK.filter((x) => x.lvl === se.level).length + ' preguntas de este nivel en el banco')),
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Tema'), h('div', { class: 'chips2 k3 sm' }, Gr.TOPICS.map(([k, l]) => h('button', { class: se.topic === k ? 'on' : '', 'data-topic': k, onclick: () => { se.topic = k; api.save(); drawGrammar(); } }, l)))),
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Duración'), h('div', { class: 'chips2 k5' }, Gr.KINDS.map(([k, l]) => h('button', { class: se.kind === k ? 'on' : '', 'data-kind': k, onclick: () => { se.kind = k; api.save(); drawGrammar(); } }, l)))),
      h('div', { class: 'sub', style: { margin: '-6px 4px 6px' } }, '🏆 Tu mejor marca: ' + Gr.bestLabel(se.kind, best)),
      need && pool < need ? h('div', { class: 'sub', style: { margin: '0 4px 12px' } }, 'Hay ' + pool + ' preguntas de este nivel y tema: se completarán con niveles cercanos.') : h('div', { style: { height: '8px' } }),
      h('button', { class: 'btn primary block', 'data-act': 'start', style: { minHeight: '52px', fontSize: '17px' }, onclick: () => startGrammar() }, 'Empezar'),
      h('button', { class: 'btn block', style: { marginTop: '10px' }, disabled: !hist.length, onclick: () => { gview = 'history'; drawGrammar(); } }, 'Historial y progreso' + (hist.length ? ' (' + hist.length + ')' : '')),
      h('p', { class: 'hint', style: { marginTop: '14px' } }, 'Preguntas de elegir y de completar, con explicación en español tras cada respuesta. Al terminar, la sesión se anota sola si tienes un objetivo vinculado a «Gramática inglesa» (Editar objetivo → Vincular a módulo).'));
    return sh;
  }
  function startGrammar() {
    const se = gset(), info = Gr.kindInfo(se.kind), now = Date.now();
    const src = Gr.makeSession({ level: se.level, topic: se.topic, kind: se.kind, recent: S().grammar.recent });
    GM = { level: se.level, topic: se.topic, kind: se.kind, info, src, answers: [], p: src.next(), qStart: now, start: now, locked: false, end: info.t ? now + info.t * 1000 : null, timer: null, done: false, ui: null };
    gview = 'run'; drawGrammar();
  }
  const stripHint = (q) => q.replace(/\s*\((?:[^()]*)\)/g, '');
  function blankSentence(q, fill, state) {
    if (fill != null) q = stripHint(q);
    const parts = q.split('___');
    if (parts.length < 2) return h('span', null, q);
    const out = [];
    parts.forEach((t, i) => { out.push(t); if (i < parts.length - 1) out.push(h('span', { class: 'blank' + (state ? ' ' + state : '') }, fill != null ? fill : '\u00A0\u00A0\u00A0\u00A0\u00A0')); });
    return h('span', null, out);
  }
  function grRun() {
    const sh = U.shell(Gr.topicLabel(GM.topic) + ' · ' + GM.level, () => grExit(), 'Salir', h('span', { class: 'score', id: 'gscore', style: { width: '64px', textAlign: 'right', fontWeight: 700 } }, ''));
    const progress = h('div', { class: 'mprog' }), bar = h('div', { class: 'bar', style: { '--c': 'var(--accent)' } }, h('i', { style: { width: '100%' } }));
    const card = h('div', { class: 'qcard', 'aria-live': 'polite' }), fb = h('div', { class: 'fbwrap' });
    sh.body.append(progress, bar, card, fb);
    function paint() {
      GM.locked = false; GM.picked = null; const p = GM.p;
      card.replaceChildren(h('div', { class: 'qtag' }, (p.type === 'mc' ? 'Elige la opción correcta' : 'Escribe lo que falta') + ' · ' + Gr.topicLabel(p.topic)), h('div', { class: 'qtext', id: 'qtext' }, blankSentence(p.q, null)));
      fb.replaceChildren();
      if (p.type === 'mc') {
        card.append(h('div', { class: 'opts' }, p.opts.map((o, i) => h('button', { class: 'opt', 'data-i': i, onclick: () => submit(i) }, h('span', { class: 'ol' }, String.fromCharCode(65 + i)), h('span', { class: 'ot' }, o)))));
      } else {
        const inp = h('input', { class: 'inp fillin', type: 'text', id: 'fillin', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false', autocomplete: 'off', enterkeyhint: 'done', 'aria-label': 'Tu respuesta', placeholder: 'Escribe tu respuesta' });
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(inp.value); } });
        card.append(inp, h('button', { class: 'btn primary block', id: 'fillgo', style: { marginTop: '10px', minHeight: '50px' }, onclick: () => submit(inp.value) }, 'Comprobar'));
        if (!/Android|iPhone|iPad/.test(navigator.userAgent)) setTimeout(() => inp.focus(), 30);
      }
      const n = GM.answers.length, ok = GM.answers.filter((x) => x.correct).length;
      sh.el.querySelector('#gscore').textContent = '✓ ' + ok;
      progress.textContent = GM.info.n ? 'Pregunta ' + Math.min(n + 1, GM.info.n) + ' de ' + GM.info.n : fmtLeft() + ' · ' + n + ' respondidas';
      sh.body.scrollTop = 0; GM.qStart = Date.now();
    }
    const fmtLeft = () => U.fmtClock(GM.end - Date.now());
    function tick() {
      if (!sh.el.isConnected || GM.done) return stopG();
      if (GM.end) { const left = GM.end - Date.now(); bar.firstChild.style.width = Math.max(0, left / (GM.info.t * 1000) * 100) + '%'; progress.textContent = fmtLeft() + ' · ' + GM.answers.length + ' respondidas'; if (left <= 0) finishGrammar(true); }
      else bar.firstChild.style.width = (1 - GM.answers.length / GM.info.n) * 100 + '%';
    }
    function submit(given) {
      if (GM.locked || GM.done) return; const p = GM.p;
      if (p.type === 'fill' && !String(given).trim()) return;
      GM.locked = true; const ms = Date.now() - GM.qStart, ok = Gr.check(p, given), c = Gr.answerText(p);
      const a = p.type === 'mc' ? p.opts[Number(given)] : String(given).trim();
      GM.answers.push({ id: p.id, topic: p.topic, q: p.q, a, c, e: p.exp, correct: ok, ms });
      sh.el.querySelector('#gscore').textContent = '✓ ' + GM.answers.filter((x) => x.correct).length;
      const qt = card.querySelector('#qtext'); qt.replaceChildren(blankSentence(p.q, c, ok ? 'ok' : 'bad'));
      if (p.type === 'mc') card.querySelectorAll('.opt').forEach((b, i) => { b.disabled = true; if (i === p.ci) b.classList.add('ok'); else if (i === Number(given)) b.classList.add('bad'); });
      else { const inp = card.querySelector('#fillin'); inp.disabled = true; inp.classList.add(ok ? 'ok' : 'bad'); card.querySelector('#fillgo').hidden = true; }
      const last = GM.info.n && GM.answers.length >= GM.info.n;
      fb.replaceChildren(h('div', { class: 'fbp ' + (ok ? 'ok' : 'bad'), role: 'status' }, h('b', null, ok ? '✓ ¡Correcto!' : '✕ Incorrecto'), ok ? null : h('div', { class: 'ans' }, 'Respuesta: ', h('b', null, c)), h('p', null, p.exp)),
        h('button', { class: 'btn primary block', id: 'gnext', style: { minHeight: '52px', marginTop: '10px', fontSize: '17px' }, onclick: () => { if (last) finishGrammar(false); else { GM.p = GM.src.next(); paint(); tick(); } } }, last ? 'Ver resultado' : 'Siguiente ›'));
      const nb = fb.querySelector('#gnext'); nb.scrollIntoView && nb.scrollIntoView({ block: 'nearest' });
    }
    GM.ui = { paint, submit }; paint(); tick();
    stopG(); GM.timer = setInterval(tick, 250);
    return sh;
  }
  function stopG() { if (GM) clearInterval(GM.timer); }
  async function grExit() {
    if (!GM.answers.length) { GM.done = true; stopG(); gview = 'setup'; return drawGrammar(); }
    const r = await api.dialog('¿Terminar la sesión?', 'Llevas ' + GM.answers.length + ' respuestas.', [{ label: 'Terminar y guardar', value: 'save', cls: 'primary' }, { label: 'Descartar', value: 'drop', cls: 'danger' }, { label: 'Seguir', value: null }]);
    if (r === 'save') finishGrammar(false); else if (r === 'drop') { GM.done = true; stopG(); gview = 'setup'; drawGrammar(); }
  }
  function finishGrammar() {
    if (GM.done) return; GM.done = true; stopG();
    const info = GM.info, now = Date.now(); let elapsed = now - GM.start; if (info.t) elapsed = Math.min(elapsed, info.t * 1000);
    const sm = Gr.summarize(GM.answers, elapsed);
    if (!sm.total) { gview = 'setup'; return drawGrammar(); }
    const completed = info.t ? true : sm.total >= info.n;
    const rec = { id: B.uid(), date: api.today(), level: GM.level, topic: GM.topic, kind: GM.kind, total: sm.total, correct: sm.correct, totalMs: Math.round(sm.totalMs), avgMs: Math.round(sm.avgMs), byTopic: sm.byTopic,
      errors: GM.answers.filter((x) => !x.correct).slice(0, 15).map((x) => ({ q: x.q, a: x.a, c: x.c, e: x.e })), logged: false };
    const hist = S().grammar.history, prev = Gr.bestFor(hist, rec.topic, rec.level, rec.kind);
    const record = !!(completed && prev && Gr.isBetter(rec.kind, rec, prev));
    const summary = '📘 Gramática inglesa · ' + rec.level + ' · ' + Gr.topicLabel(rec.topic) + ' (' + Gr.kindLabel(rec.kind).toLowerCase() + '): ' + rec.correct + '/' + rec.total + ' (' + pct(sm.acc) + ' %), ' + Gr.fmtSec(rec.avgMs) + ' s por respuesta.';
    const logs = B.logActivity(S(), 'gramatica', rec.date, { minutes: sm.totalMs / 60000, sessions: 1, summary });
    rec.logged = logs.length > 0; hist.unshift(rec); hist.length = Math.min(hist.length, 500);
    S().grammar.recent = Gr.pushRecent(S().grammar.recent, GM.answers.map((x) => x.id)); api.save();
    gres = { rec, sm, logs, record, prev, errors: GM.answers.filter((x) => !x.correct) }; gview = 'result'; drawGrammar();
  }
  function reviewItem(e) {
    const filled = String(e.q).includes('___') ? stripHint(String(e.q)).replace('___', e.c) : e.q + ' → ' + e.c;
    return h('div', { class: 'item rv' }, h('div', { class: 'nm' }, h('b', null, filled), h('span', null, 'Tu respuesta: ' + (e.a || '—')), h('span', { class: 'exp' }, e.e)));
  }
  function grResult() {
    const r = gres, sh = U.shell('Resultado', () => onClose(), 'Cerrar');
    sh.body.append(...[
      r.record ? h('div', { class: 'record' }, '🏆 ¡Nueva mejor marca!') : null,
      h('div', { class: 'tiles' }, U.stat(r.rec.correct + '/' + r.rec.total, 'aciertos'), U.stat(pct(r.sm.acc) + ' %', 'precisión'), U.stat(Gr.fmtSec(r.rec.avgMs) + ' s', 'por respuesta'), U.stat(U.fmtClock(r.rec.totalMs), 'tiempo')),
      h('div', { class: 'sub', style: { margin: '12px 4px' } }, r.rec.level + ' · ' + Gr.topicLabel(r.rec.topic) + ' · ' + Gr.kindLabel(r.rec.kind)),
      h('div', { class: 'result win' }, h('span', { class: 'ok' }, logLine(r.logs, 'gramática inglesa'))),
      r.errors.length ? h('div', { class: 'sech' }, 'Para repasar (' + r.errors.length + ')') : h('div', { class: 'record', style: { marginTop: '12px' } }, '✨ Sin fallos'),
      r.errors.length ? h('div', { class: 'list' }, r.errors.slice(0, 15).map(reviewItem)) : null,
      h('div', { class: 'row2', style: { marginTop: '14px' } }, h('button', { class: 'btn primary', 'data-act': 'again', style: { flex: 1 }, onclick: () => startGrammar() }, 'Repetir'), h('button', { class: 'btn', style: { flex: 1 }, onclick: () => { gview = 'setup'; drawGrammar(); } }, 'Cambiar'))].filter(Boolean));
    return sh;
  }
  function grHistory() {
    const sh = U.shell('Progreso', () => { gview = 'setup'; drawGrammar(); }, 'Atrás'), hist = S().grammar.history, last = hist.slice(0, 20).reverse();
    if (last.length) {
      sh.body.append(h('div', { class: 'sech' }, 'Precisión (últimas ' + last.length + ' sesiones)'), h('div', { class: 'chart' }, U.lineChart(last.map((r) => (r.total ? r.correct / r.total * 100 : 0)), { min: 0, max: 100, color: 'var(--done)', fmt: (v) => Math.round(v) + '', label: 'Precisión por sesión' })),
        h('div', { class: 'sech' }, 'Segundos por respuesta'), h('div', { class: 'chart' }, U.lineChart(last.map((r) => r.avgMs / 1000), { min: 0, max: Math.max(5, Math.ceil(Math.max(...last.map((r) => r.avgMs / 1000)))), color: 'var(--accent)', fmt: (v) => (Math.round(v * 10) / 10) + '', label: 'Segundos por respuesta' })));
    }
    const ts = Gr.topicStats(hist), rows = Gr.TOPICS.filter(([k]) => ts[k] && ts[k][1] > 0).map(([k, l]) => [l, ts[k][0], ts[k][1]]).sort((a, b) => a[1] / a[2] - b[1] / b[2]);
    if (rows.length) sh.body.append(h('div', { class: 'sech' }, 'Precisión por tema (de más floja a más fuerte)'), h('div', { class: 'list tstat' }, rows.map(([l, c, t]) => h('div', { class: 'item', 'data-tstat': l }, h('div', { class: 'nm' }, h('b', null, l), h('span', null, c + '/' + t + ' · ' + pct(c / t) + ' %'), h('div', { class: 'bar', style: { '--c': c / t >= 0.8 ? 'var(--done)' : c / t >= 0.5 ? 'var(--partial)' : 'var(--missed)' } }, h('i', { style: { width: pct(c / t) + '%' } })))))));
    const marks = [];
    for (const [tk, tl] of Gr.TOPICS) for (const [lv] of Gr.LEVELS) for (const [kk, kl] of Gr.KINDS) { const b = Gr.bestFor(hist, tk, lv, kk); if (b) marks.push([lv + ' · ' + tl + ' · ' + kl, Gr.bestLabel(kk, b)]); }
    sh.body.append(h('div', { class: 'sech' }, 'Mejores marcas'));
    sh.body.append(marks.length ? h('div', { class: 'list' }, marks.map(([a, b]) => h('div', { class: 'item' }, h('div', { class: 'nm' }, h('b', null, b), h('span', null, a))))) : h('div', { class: 'empty' }, 'Aún no hay marcas.'));
    const errs = []; for (const r of hist) for (const e of r.errors || []) { errs.push(e); if (errs.length >= 20) break; if (errs.length >= 20) break; }
    if (errs.length) sh.body.append(h('div', { class: 'sech' }, 'Fallos recientes para repasar'), h('div', { class: 'list' }, errs.map(reviewItem)));
    sh.body.append(h('div', { class: 'sech' }, 'Sesiones'), h('div', { class: 'list' }, hist.slice(0, 60).map((r) => h('div', { class: 'item' }, h('div', { class: 'nm' }, h('b', null, r.correct + '/' + r.total + ' · ' + pct(r.total ? r.correct / r.total : 0) + ' % · ' + Gr.fmtSec(r.avgMs) + ' s'), h('span', null, U.dateEs(r.date) + ' · ' + r.level + ' · ' + Gr.topicLabel(r.topic) + ' · ' + Gr.kindLabel(r.kind)))))));
    return sh;
  }

  /* =================== SPEAKING / LISTENING =================== */
  const SRctor = () => window.SpeechRecognition || window.webkitSpeechRecognition;
  let recFail = null, voices = [], voicesInit = false;
  const caps = () => ({ tts: !!(window.speechSynthesis && window.SpeechSynthesisUtterance), rec: !!SRctor() && !recFail, recExists: !!SRctor(), media: !!(window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) });
  const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  function initVoices() {
    if (voicesInit || !window.speechSynthesis) return; voicesInit = true;
    const load = () => { try { voices = window.speechSynthesis.getVoices() || []; } catch (_) {} }; load();
    try { window.speechSynthesis.addEventListener('voiceschanged', load); } catch (_) {}
  }
  function pickVoice(lang) {
    const l = lang.toLowerCase();
    const norm = (v) => String(v.lang || '').toLowerCase().replace('_', '-');
    return voices.find((v) => norm(v) === l) || voices.find((v) => norm(v).startsWith('en')) || null;
  }
  function stopSpeak() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (_) {} }
  function speak(text, o) {
    o = o || {};
    return new Promise((res) => {
      if (!caps().tts) return res(false);
      try {
        stopSpeak();
        const u = new window.SpeechSynthesisUtterance(text); u.lang = o.lang || 'en-US'; u.rate = o.rate || 0.95;
        const v = pickVoice(u.lang); if (v) u.voice = v;
        let done = false; const fin = (ok) => { if (!done) { done = true; clearTimeout(t); res(ok); } };
        const t = setTimeout(() => fin(false), 90000);
        u.onend = () => fin(true); u.onerror = () => fin(false);
        window.speechSynthesis.speak(u);
      } catch (_) { res(false); }
    });
  }
  /* botón «escuchar»: pulsar de nuevo para parar */
  function listenBtn(label, getText, getOpts, cls) {
    const b = h('button', { class: 'btn ' + (cls || ''), 'data-listen': label, disabled: !caps().tts, title: caps().tts ? '' : 'Tu dispositivo no tiene voz disponible' }, label);
    let playing = false; const reset = () => { playing = false; b.classList.remove('playing'); b.textContent = label; };
    b.addEventListener('click', async () => {
      if (playing) { stopSpeak(); reset(); return; }
      playing = true; b.classList.add('playing'); b.textContent = '■ Parar';
      await speak(getText(), getOpts ? getOpts() : {}); reset();
    });
    return b;
  }
  const FATAL = ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'];
  const recMsg = (e) => (e === 'not-allowed' || e === 'service-not-allowed' ? 'El micrófono o el reconocimiento de voz no están permitidos (en el iPhone suele fallar en la app instalada: prueba a abrirlo en Safari).' : e === 'audio-capture' ? 'No se detecta ningún micrófono.' : 'El reconocimiento de voz no está disponible ahora.');
  function startRec(o) {
    const Ctor = SRctor(); if (!Ctor || recFail) return null;
    let r; try { r = new Ctor(); } catch (_) { recFail = 'start'; return null; }
    let finalText = '', interim = '', stopped = false, ended = false, err = null; const waiters = [];
    r.lang = o.lang || 'en-US'; r.continuous = !!o.continuous; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) { const t = String((e.results[i][0] && e.results[i][0].transcript) || '').trim(); if (e.results[i].isFinal) finalText += (finalText ? ' ' : '') + t; else interim += (interim ? ' ' : '') + t; }
      if (o.onText) o.onText(finalText, interim);
    };
    r.onerror = (e) => { err = e && e.error; if (FATAL.includes(err)) { recFail = err; if (o.onFatal) o.onFatal(err); } };
    r.onend = () => {
      if (!stopped && o.continuous && !FATAL.includes(err)) { try { err = null; r.start(); return; } catch (_) {} }
      ended = true; waiters.splice(0).forEach((f) => f()); if (o.onEnd) o.onEnd();
    };
    try { r.start(); } catch (_) { recFail = 'start'; return null; }
    const text = () => (finalText + (interim ? ' ' + interim : '')).trim();
    return { text, stop() { return new Promise((res) => { stopped = true; const done = () => res(text()); if (ended) return done(); waiters.push(done); setTimeout(done, 1500); try { r.stop(); } catch (_) { done(); } }); } };
  }
  async function startRecorder() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mt = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find((t) => window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(t));
    const mr = new window.MediaRecorder(stream, mt ? { mimeType: mt } : undefined), chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.start();
    return { stop() { return new Promise((res) => { mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); res(chunks.length ? URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || mt || 'audio/webm' })) : null); }; try { mr.stop(); } catch (_) { res(null); } }); } };
  }
  const urls = [];
  const keepUrl = (u) => { if (u) { urls.push(u); while (urls.length > 8) URL.revokeObjectURL(urls.shift()); } return u; };

  const spset = () => S().speaking.settings;
  let spview = 'setup', TS = null, TR = null, SS = null, SR_ = null;
  function cleanupSpeaking() {
    stopSpeak();
    for (const o of [TS, SS]) if (o) { clearInterval(o.timer); o.done = true; try { o.rec && o.rec.stop(); } catch (_) {} try { o.recorder && o.recorder.then((r) => r.stop()).catch(() => {}); } catch (_) {} }
    TS = null; SS = null;
  }
  function openSpeaking(opts) {
    opts = opts || {}; initVoices();
    onClose = () => { cleanupSpeaking(); (opts.onClose || (() => { api.closeOverlay(); api.render(); }))(); };
    if (opts.mode && Sp.MODES.some((m) => m[0] === opts.mode)) { spset().mode = opts.mode; api.save(); }
    spview = 'setup'; TS = null; SS = null; drawSpeaking();
  }
  function drawSpeaking() {
    if (spview === 'setup') return api.openOverlay(spSetup().el);
    if (spview === 'history') return api.openOverlay(spHistory().el);
    if (spview === 'talk') return api.openOverlay(spTalk().el);
    if (spview === 'talkres') return api.openOverlay(spTalkRes().el);
    if (spview === 'sent') return api.openOverlay(spSent().el);
    api.openOverlay(spSentRes().el);
  }
  function capsBox() {
    const c = caps(), row = (ok, t, d) => h('div', { class: 'cap ' + (ok ? 'ok' : 'no'), 'data-cap': t }, h('b', null, (ok ? '✓ ' : '✕ ') + t), h('span', null, d));
    const recOk = c.rec;
    return h('div', { class: 'caps', id: 'caps' },
      row(c.tts, 'Voz del modelo', c.tts ? 'Se leerá en inglés con la voz de tu dispositivo.' : 'Este dispositivo no ofrece voz en inglés: no podrás escuchar el modelo.'),
      row(recOk, 'Reconocimiento de voz', recOk ? (isIOS() && isStandalone() ? 'Disponible, pero en el iPhone la app instalada puede no permitirlo. Si falla, abre byformain en Safari: seguirás pudiendo autoevaluarte.' : 'Se transcribirá lo que digas.')
        : c.recExists && recFail ? 'Ha fallado: ' + recMsg(recFail) + ' Usarás la autoevaluación (1-5).' : 'No disponible en este navegador/dispositivo. Practicarás con temporizador, escuchando el modelo y autoevaluándote (1-5).'),
      row(c.media, 'Grabar mi voz', c.media ? 'Puedes grabarte y escucharte (no se guarda: solo durante la sesión).' : 'No disponible en este dispositivo.'));
  }
  function spSetup() {
    const se = spset(), sh = U.shell('Speaking', () => onClose(), 'Cerrar'), hist = S().speaking.history, c = caps();
    const isTalk = se.mode === 'hablar', cantDict = se.mode === 'dictado' && !c.tts;
    sh.body.append(...[
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Modo'), U.seg(Sp.MODES, se.mode, (k) => { se.mode = k; api.save(); drawSpeaking(); }),
        h('p', { class: 'hint' }, se.mode === 'hablar' ? 'Responde en voz alta a una pregunta con temporizador; luego escucha una respuesta modelo.' : se.mode === 'shadowing' ? 'Escucha una frase y repítela imitando ritmo y pronunciación; se compara con el original.' : 'Listening: escucha una frase y escríbela. Se anota en tu objetivo de Listening.')),
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Nivel'), U.seg(Sp.LEVELS.map((l) => [l, l]), se.level, (k) => { se.level = k; api.save(); drawSpeaking(); })),
      isTalk ? h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Tipo de pregunta'), h('div', { class: 'chips2 k3 sm' }, Sp.CATS.map(([k, l]) => h('button', { class: se.cat === k ? 'on' : '', 'data-cat': k, onclick: () => { se.cat = k; api.save(); drawSpeaking(); } }, l)))) : null,
      isTalk ? h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Temporizador'), U.seg(Sp.DURS, se.dur, (k) => { se.dur = Number(k); api.save(); drawSpeaking(); })) : h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Frases por sesión'), U.seg([[5, '5 frases'], [10, '10 frases']], se.n, (k) => { se.n = Number(k); api.save(); drawSpeaking(); })),
      h('div', { class: 'field' }, h('div', { class: 'lb' }, 'Acento de la voz'), U.seg([['en-US', 'EE. UU.'], ['en-GB', 'Reino Unido']], se.accent, (k) => { se.accent = k; api.save(); drawSpeaking(); })),
      capsBox(),
      cantDict ? h('div', { class: 'sub', style: { margin: '0 4px 10px' } }, 'El dictado necesita la voz del dispositivo, que no está disponible.') : null,
      h('button', { class: 'btn primary block', 'data-act': 'start', disabled: cantDict, style: { minHeight: '52px', fontSize: '17px' }, onclick: () => (isTalk ? startTalk() : startSent()) }, 'Empezar'),
      h('button', { class: 'btn block', style: { marginTop: '10px' }, disabled: !hist.length, onclick: () => { spview = 'history'; drawSpeaking(); } }, 'Historial y progreso' + (hist.length ? ' (' + hist.length + ')' : '')),
      h('p', { class: 'hint', style: { marginTop: '14px' } }, 'Al terminar, los minutos se anotan solos en tu objetivo «Speaking en inglés» (Hablar y Shadowing) o «Listening en inglés» (Dictado) si están vinculados.')].filter(Boolean));
    return sh;
  }

  /* ---------- HABLAR ---------- */
  function startTalk() {
    const se = spset();
    TS = { level: se.level, cat: se.cat, accent: se.accent, dur: se.dur, prompt: Sp.pickPrompt(se.level, se.cat, TS_recent(), Math.random), state: 'ready', useAudio: !caps().rec && caps().media, text: '', interim: '', timer: null, rec: null, recorder: null, done: false };
    spview = 'talk'; drawSpeaking();
  }
  const talkSeen = []; const TS_recent = () => talkSeen.slice(-12);
  function toggle(label, on, onchange, disabled, id) {
    const b = h('button', { type: 'button', class: 'tog' + (on ? ' on' : ''), id, role: 'switch', 'aria-checked': on ? 'true' : 'false', disabled, onclick: () => { onchange(!on); } }, h('span', { class: 'knob' }), h('span', { class: 'tl' }, label));
    return b;
  }
  function spTalk() {
    const T = TS, c = caps(), sh = U.shell('Hablar · ' + T.level, () => talkExit(), 'Salir');
    const timerEl = h('div', { class: 'bigtimer', id: 'ttimer' }, U.fmtClock(T.dur * 1000)), bar = h('div', { class: 'bar', style: { '--c': 'var(--accent)' } }, h('i', { style: { width: '100%' } }));
    const tbox = h('div', { class: 'tbox', id: 'tbox', 'aria-live': 'polite' });
    const ctl = h('div'), tg = h('div');
    function paintTranscript() {
      if (!caps().rec) tbox.replaceChildren(h('span', { class: 'ph' }, T.state === 'running' ? 'Reconocimiento de voz no disponible' + (recFail ? ' (permiso denegado o bloqueado en este modo)' : ' en este dispositivo') + ': habla en voz alta; al terminar te autoevalúas.' : 'Reconocimiento de voz no disponible: practicarás con temporizador y autoevaluación.'));
      else if (!T.text && !T.interim) tbox.replaceChildren(h('span', { class: 'ph' }, T.state === 'running' ? 'Escuchando… empieza a hablar.' : 'Aquí aparecerá lo que digas.'));
      else tbox.replaceChildren(T.text + (T.text && T.interim ? ' ' : ''), h('span', { class: 'interim' }, T.interim));
    }
    function paintCtl() {
      ctl.replaceChildren(T.state === 'ready'
        ? h('button', { class: 'btn primary block', id: 'tstart', style: { minHeight: '56px', fontSize: '18px' }, onclick: () => talkStart() }, '▶ Empezar a hablar')
        : h('button', { class: 'btn danger block', id: 'tstop', style: { minHeight: '56px', fontSize: '18px' }, onclick: () => talkFinish(false) }, '■ Terminar'));
      tg.replaceChildren(...[T.state === 'ready' ? h('div', { class: 'tgrow' }, toggle('Grabar mi voz para escucharme después', T.useAudio, (v) => { T.useAudio = v; paintCtl(); }, !c.media, 'taudio'), !c.media ? h('p', { class: 'hint' }, 'Grabación de audio no disponible en este dispositivo.') : null) : null].filter(Boolean));
    }
    T.ui = { paintTranscript, timerEl, bar };
    sh.body.append(
      h('div', { class: 'qcard' }, h('div', { class: 'qtag' }, Sp.catLabel(T.prompt.cat) + ' · ' + T.level), h('div', { class: 'qtext sm', id: 'tprompt' }, T.prompt.en), h('p', { class: 'tip' }, '💡 ' + T.prompt.es),
        h('div', { class: 'row2 ctl' }, listenBtn('🔊 Escuchar pregunta', () => T.prompt.en, () => ({ lang: T.accent })), T.state === 'ready' ? h('button', { class: 'btn', id: 'tnew', onclick: () => { talkSeen.push(T.prompt.id); T.prompt = Sp.pickPrompt(T.level, T.cat, TS_recent(), Math.random, T.prompt.id); drawSpeaking(); } }, '↻ Otra pregunta') : null)),
      timerEl, bar, tbox, tg, ctl);
    paintTranscript(); paintCtl();
        return sh;
  }
  function talkStart() {
    const T = TS; if (!T || T.state !== 'ready') return;
    stopSpeak(); T.state = 'running'; T.start = Date.now(); T.end = T.start + T.dur * 1000; T.text = ''; T.interim = '';
    const c = caps();
    if (c.rec) T.rec = startRec({ lang: T.accent, continuous: true, onText: (f, i) => { T.text = f; T.interim = i; T.ui.paintTranscript(); }, onFatal: () => { T.ui.paintTranscript(); const cb = document.getElementById('caps'); if (cb) cb.replaceWith(capsBox()); api.toast('Reconocimiento de voz no disponible: usa la autoevaluación'); } });
    if (T.useAudio && c.media) T.recorder = startRecorder().catch(() => { api.toast('No se pudo grabar el audio'); return null; });
    api.openOverlay(spTalk().el);
    const T0 = TS; T0.timer = setInterval(() => {
      const el = document.getElementById('ttimer'), b = document.querySelector('#overlay .bar > i');
      if (!el || T0.done) return clearInterval(T0.timer);
      const left = T0.end - Date.now(); el.textContent = U.fmtClock(left); if (b) b.style.width = Math.max(0, left / (T0.dur * 1000) * 100) + '%';
      if (left <= 0) talkFinish(true);
    }, 250);
  }
  async function talkExit() {
    const T = TS; if (!T || T.state === 'ready') { cleanupSpeaking(); spview = 'setup'; return drawSpeaking(); }
    const r = await api.dialog('¿Terminar la práctica?', 'Estás hablando ahora mismo.', [{ label: 'Terminar y guardar', value: 'save', cls: 'primary' }, { label: 'Descartar', value: 'drop', cls: 'danger' }, { label: 'Seguir', value: null }]);
    if (r === 'save') talkFinish(false); else if (r === 'drop') { cleanupSpeaking(); spview = 'setup'; drawSpeaking(); }
  }
  async function talkFinish(timeUp) {
    const T = TS; if (!T || T.done) return; T.done = true; clearInterval(T.timer);
    const elapsed = Math.min(Date.now() - T.start, T.dur * 1000);
    const text = T.rec ? await T.rec.stop() : ''; let url = null; if (T.recorder) { const rr = await T.recorder; url = rr ? keepUrl(await rr.stop()) : null; }
    if (elapsed < 10000) { api.toast('Sesión demasiado corta: no se anotó'); TS = null; spview = 'setup'; return drawSpeaking(); }
    const secs = Math.round(elapsed / 1000), words = Sp.wordCount(text), prev = S().speaking.history;
    const rec = { id: B.uid(), date: api.today(), mode: 'hablar', level: T.level, cat: T.cat, secs, items: 1, words, score: null, self: null, accent: T.accent, prompt: T.prompt.en.slice(0, 200), logged: false };
    const summary = '🗣 Speaking · Hablar ' + T.level + ' (' + Sp.catLabel(T.cat).toLowerCase() + '): ' + U.fmtClock(secs * 1000) + ' min' + (words ? ', ' + words + ' palabras' : '') + '.';
    const logs = B.logActivity(S(), 'speaking', rec.date, { minutes: elapsed / 60000, sessions: 1, summary });
    rec.logged = logs.length > 0; prev.unshift(rec); prev.length = Math.min(prev.length, 500); talkSeen.push(T.prompt.id); api.save();
    TR = { rec, logs, text, url, prompt: T.prompt, summary, accent: T.accent, level: T.level, cat: T.cat, dur: T.dur, recOk: !!T.rec && !recFail };
    TS = null; spview = 'talkres'; drawSpeaking();
  }
  function noteSelf(rec, summary, n) {
    for (const g of S().goals) {
      if (g.module !== 'speaking') continue; const l = B.getLog(S(), rec.date, g.id); if (!l || !l.note || !l.note.includes(summary)) continue;
      B.setNote(S(), rec.date, g.id, l.note.replace(summary + ' Autoevaluación ' + (rec.self || '') + '/5.', summary).replace(summary, summary + ' Autoevaluación ' + n + '/5.'));
    }
  }
  function stars(cur, on) { return h('div', { class: 'stars', role: 'radiogroup', 'aria-label': 'Autoevaluación' }, [1, 2, 3, 4, 5].map((n) => h('button', { class: 'star' + (cur === n ? ' on' : ''), 'data-self': n, role: 'radio', 'aria-checked': cur === n ? 'true' : 'false', onclick: () => on(n) }, h('b', null, n), h('span', null, Sp.SELF[n])))); }
  function spTalkRes() {
    const R = TR, sh = U.shell('Resultado', () => onClose(), 'Cerrar'), r = R.rec, wpm = r.words && r.secs ? Math.round(r.words / (r.secs / 60)) : null;
    sh.body.append(...[
      h('div', { class: 'tiles' }, U.stat(U.fmtClock(r.secs * 1000), 'tiempo'), U.stat(r.words || '—', 'palabras'), U.stat(wpm || '—', 'pal./min'), U.stat(r.self ? r.self + '/5' : '—', 'autoeval.')),
      h('div', { class: 'sub', style: { margin: '12px 4px' } }, 'Hablar · ' + R.level + ' · ' + Sp.catLabel(R.cat)),
      h('div', { class: 'result win' }, h('span', { class: 'ok' }, logLine(R.logs, 'speaking'))),
      h('div', { class: 'sech' }, '¿Cómo te ha ido?'), stars(r.self, (n) => { noteSelf(r, R.summary, n); r.self = n; api.save(); drawSpeaking(); }),
      h('p', { class: 'hint' }, R.recOk ? 'Valórate tú mismo: el reconocimiento de voz solo transcribe, no evalúa tu pronunciación.' : 'Sin reconocimiento de voz en este dispositivo: tu autoevaluación es la medida de progreso.'),
      h('div', { class: 'sech' }, 'Lo que se ha entendido'), h('div', { class: 'tbox final', id: 'tfinal' }, R.text ? R.text : h('span', { class: 'ph' }, R.recOk ? 'No se ha captado ninguna frase.' : 'No hay transcripción (reconocimiento de voz no disponible).')),
      R.url ? h('div', { class: 'sech' }, 'Tu grabación') : null, R.url ? h('audio', { class: 'player', controls: true, src: R.url, preload: 'metadata', 'aria-label': 'Tu grabación' }) : null,
      h('div', { class: 'sech' }, 'Respuesta modelo'), h('div', { class: 'qcard' }, h('div', { class: 'qtext sm', style: { fontWeight: 500 } }, R.prompt.model), h('div', { class: 'row2 ctl' }, listenBtn('🔊 Escuchar modelo', () => R.prompt.model, () => ({ lang: R.accent })), listenBtn('🐢 Lento', () => R.prompt.model, () => ({ lang: R.accent, rate: 0.65 })))),
      h('div', { class: 'row2', style: { marginTop: '14px' } }, h('button', { class: 'btn primary', 'data-act': 'again', style: { flex: 1 }, onclick: () => { TR = null; startTalk(); } }, 'Otra pregunta'), h('button', { class: 'btn', style: { flex: 1 }, onclick: () => { spview = 'setup'; drawSpeaking(); } }, 'Cambiar'))].filter(Boolean));
    return sh;
  }

  /* ---------- SHADOWING y DICTADO (frases) ---------- */
  function startSent() {
    const se = spset(), mode = se.mode;
    const items = Sp.pickSentences(se.level, se.n, seenSent.filter((x) => x.m === mode).map((x) => x.id), Math.random);
    SS = { mode, level: se.level, accent: se.accent, items, idx: 0, start: Date.now(), results: [], att: null, rec: null, recorder: null, listening: false, done: false, url: null };
    spview = 'sent'; drawSpeaking();
  }
  const seenSent = [];
  function wordsEl(words) { return h('p', { class: 'wds' }, words.map((x) => h('span', { class: 'wd ' + (x.ok ? 'ok' : 'miss') }, x.w + ' '))); }
  const verdict = (p) => (p >= 90 ? '¡Excelente!' : p >= 70 ? 'Muy bien' : p >= 45 ? 'Mejorable' : 'Sigue practicando');
  function spSent() {
    const X = SS, c = caps(), isSh = X.mode === 'shadowing', sh = U.shell((isSh ? 'Shadowing' : 'Dictado') + ' · ' + X.level, () => sentExit(), 'Salir');
    const it = X.items[X.idx], last = X.idx >= X.items.length - 1;
    const progress = h('div', { class: 'mprog' }, 'Frase ' + (X.idx + 1) + ' de ' + X.items.length), bar = h('div', { class: 'bar', style: { '--c': 'var(--accent)' } }, h('i', { style: { width: (X.idx / X.items.length * 100) + '%' } }));
    const card = h('div', { class: 'qcard' }), out = h('div', { id: 'sout' });
    const listen = h('div', { class: 'row2 ctl' }, listenBtn('🔊 Normal', () => it.text, () => ({ lang: X.accent })), listenBtn('🐢 Lento', () => it.text, () => ({ lang: X.accent, rate: 0.65 })));
    const nextBtn = (enabled) => h('button', { class: 'btn primary block', id: 'snext', disabled: !enabled, style: { minHeight: '52px', marginTop: '10px', fontSize: '17px' }, onclick: () => nextSent() }, last ? 'Ver resultado' : 'Siguiente ›');
    if (isSh) {
      const a = X.att;
      card.append(h('div', { class: 'qtag' }, 'Escucha y repite imitando el ritmo'), h('div', { class: 'qtext sm', id: 'starget' }, a && a.words ? wordsEl(a.words) : it.text), listen);
      if (c.rec) {
        const mic = h('button', { class: 'btn primary block mic' + (X.listening ? ' live' : ''), id: 'smic', style: { minHeight: '56px', fontSize: '18px', marginTop: '10px' }, onclick: () => (X.listening ? stopListen() : startListen(it)) }, X.listening ? '■ Parar' : a ? '🎤 Reintentar' : '🎤 Repetir la frase');
        card.append(mic, h('div', { class: 'tbox', id: 'slive', 'aria-live': 'polite' }, a ? a.text || h('span', { class: 'ph' }, 'No se ha captado nada. Inténtalo de nuevo.') : h('span', { class: 'ph' }, X.listening ? 'Escuchando…' : 'Pulsa el micrófono y di la frase.')));
        if (a) card.append(h('div', { class: 'scorebox' }, h('b', { id: 'spct' }, a.pct + ' %'), h('span', null, verdict(a.pct) + ' · ' + a.ok + ' de ' + a.total + ' palabras'), a.extra && a.extra.length ? h('span', { class: 'sub' }, 'De más: ' + a.extra.slice(0, 8).join(' ')) : null));
      } else {
        card.append(h('p', { class: 'tip' }, 'Reconocimiento de voz no disponible: escucha, repite en voz alta y valórate.'), h('div', { class: 'sech', style: { marginTop: '10px' } }, '¿Cómo lo has dicho?'), stars(a && a.self, (n) => { X.att = { self: n, text: '', pct: null }; sentPaint(); }));
      }
      if (c.media) card.append(recordRow(X));
      out.append(nextBtn(!!a && (a.pct != null || a.self != null)));
    } else {
      const a = X.att, ta = h('textarea', { class: 'inp dict', id: 'sdict', rows: 3, placeholder: 'Escribe lo que oyes…', autocapitalize: 'sentences', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Lo que oyes', disabled: !!a }, '');
      if (a) ta.value = a.text;
      card.append(h('div', { class: 'qtag' }, 'Escribe la frase que oyes'), listen, ta);
      if (!a) card.append(h('button', { class: 'btn primary block', id: 'scheck', style: { minHeight: '50px', marginTop: '10px' }, onclick: () => { const t = ta.value.trim(); if (!t) return; const r = Sp.scoreShadowing(it.text, t); X.att = { pct: r.pct, text: t, words: r.words, ok: r.ok, total: r.total, extra: r.extra }; sentPaint(); } }, 'Comprobar'));
      else card.append(h('div', { class: 'qtext sm', id: 'starget', style: { marginTop: '10px' } }, wordsEl(a.words)), h('div', { class: 'scorebox' }, h('b', { id: 'spct' }, a.pct + ' %'), h('span', null, verdict(a.pct) + ' · ' + a.ok + ' de ' + a.total + ' palabras')));
      out.append(nextBtn(!!a));
    }
    function sentPaint() { drawSpeaking(); }
    sh.body.append(progress, bar, card, out);
    return sh;
  }
  function recordRow(X) {
    const row = h('div', { class: 'row2 ctl recrow' });
    const rec = X.recorder ? h('button', { class: 'btn danger', id: 'rstop', onclick: async () => { const r = await X.recorder; X.recorder = null; const u = keepUrl(r && await r.stop()); X.url = u; drawSpeaking(); } }, '■ Parar grabación')
      : h('button', { class: 'btn', id: 'rstart', disabled: X.listening, onclick: () => { X.url = null; X.recorder = startRecorder().catch(() => { api.toast('No se pudo grabar el audio'); X.recorder = null; drawSpeaking(); return null; }); drawSpeaking(); } }, '🎙 Grabar mi voz');
    row.append(rec); if (X.url && !X.recorder) row.append(h('audio', { class: 'player', controls: true, src: X.url, preload: 'metadata', 'aria-label': 'Tu grabación' }));
    return row;
  }
  function startListen(it) {
    const X = SS; stopSpeak(); X.att = null; X.listening = true;
    X.rec = startRec({ lang: X.accent, continuous: false,
      onText: (f, i) => { const el = document.getElementById('slive'); if (el) el.textContent = (f + ' ' + i).trim() || 'Escuchando…'; },
      onEnd: () => finishListen(it), onFatal: () => { X.listening = false; api.toast('Reconocimiento de voz no disponible: usa la autoevaluación'); drawSpeaking(); } });
    if (!X.rec) { X.listening = false; api.toast('No se pudo iniciar el reconocimiento de voz'); }
    else { X.recTimer = setTimeout(() => stopListen(), 15000); }
    drawSpeaking();
  }
  function stopListen() { const X = SS; if (X && X.rec) X.rec.stop(); }
  function finishListen(it) {
    const X = SS; if (!X || !X.listening) return; clearTimeout(X.recTimer);
    const text = X.rec ? X.rec.text() : ''; X.listening = false; X.rec = null;
    const r = Sp.scoreShadowing(it.text, text);
    X.att = { pct: r.pct, text, words: r.words, ok: r.ok, total: r.total, extra: r.extra }; drawSpeaking();
  }
  function nextSent() {
    const X = SS, it = X.items[X.idx], a = X.att; if (!a) return;
    stopSpeak(); if (X.recorder) { X.recorder.then((r) => r && r.stop()).catch(() => {}); X.recorder = null; } X.url = null;
    X.results.push({ id: it.id, text: it.text, pct: a.pct, self: a.self != null ? a.self : null, words: a.words || null, typed: a.text || '' }); seenSent.push({ m: X.mode, id: it.id }); X.att = null;
    if (X.idx >= X.items.length - 1) return finishSent(); X.idx++; drawSpeaking();
  }
  async function sentExit() {
    const X = SS; if (!X.results.length) { cleanupSpeaking(); spview = 'setup'; return drawSpeaking(); }
    const r = await api.dialog('¿Terminar la sesión?', 'Llevas ' + X.results.length + ' frases.', [{ label: 'Terminar y guardar', value: 'save', cls: 'primary' }, { label: 'Descartar', value: 'drop', cls: 'danger' }, { label: 'Seguir', value: null }]);
    if (r === 'save') finishSent(); else if (r === 'drop') { cleanupSpeaking(); spview = 'setup'; drawSpeaking(); }
  }
  function finishSent() {
    const X = SS; if (!X || X.done) return; X.done = true; stopSpeak();
    const elapsed = Math.min(Date.now() - X.start, 3600000), res = X.results, pcts = res.filter((x) => x.pct != null).map((x) => x.pct), selfs = res.filter((x) => x.self != null).map((x) => x.self);
    const score = pcts.length ? Math.round(Sp.avg(pcts)) : null, self = selfs.length ? Math.round(Sp.avg(selfs)) : null;
    const rec = { id: B.uid(), date: api.today(), mode: X.mode, level: X.level, cat: 'mixto', secs: Math.round(elapsed / 1000), items: res.length, words: res.reduce((s, x) => s + Sp.wordCount(x.text), 0), score, self, accent: X.accent, prompt: '', logged: false };
    const hist = S().speaking.history, prev = Sp.bestScore(hist, X.mode, X.level);
    const record = !!(score != null && res.length >= 3 && prev && score > prev.score);
    const isSh = X.mode === 'shadowing', key = isSh ? 'speaking' : 'listening';
    const summary = (isSh ? '🎤 Speaking · Shadowing ' : '🎧 Listening · Dictado ') + X.level + ': ' + res.length + (res.length === 1 ? ' frase' : ' frases') + (score != null ? ', ' + score + ' % de ' + (isSh ? 'coincidencia' : 'acierto') : ', autoevaluación media ' + self + '/5') + ', ' + U.fmtClock(elapsed) + ' min.';
    const logs = B.logActivity(S(), key, rec.date, { minutes: elapsed / 60000, sessions: 1, summary });
    rec.logged = logs.length > 0; hist.unshift(rec); hist.length = Math.min(hist.length, 500); api.save();
    SR_ = { rec, res, logs, record, prev, mode: X.mode, level: X.level }; SS = null; spview = 'sentres'; drawSpeaking();
  }
  function spSentRes() {
    const R = SR_, r = R.rec, isSh = R.mode === 'shadowing', sh = U.shell('Resultado', () => onClose(), 'Cerrar');
    sh.body.append(...[
      R.record ? h('div', { class: 'record' }, '🏆 ¡Nueva mejor marca!') : null,
      h('div', { class: 'tiles' }, U.stat(r.items, 'frases'), U.stat(r.score != null ? r.score + ' %' : r.self + '/5', r.score != null ? (isSh ? 'coincidencia' : 'acierto') : 'autoeval.'), U.stat(U.fmtClock(r.secs * 1000), 'tiempo'), U.stat(R.res.filter((x) => x.pct != null && x.pct >= 80).length || '0', 'frases ≥ 80 %')),
      h('div', { class: 'sub', style: { margin: '12px 4px' } }, (isSh ? 'Shadowing' : 'Dictado') + ' · ' + R.level),
      h('div', { class: 'result win' }, h('span', { class: 'ok' }, logLine(R.logs, isSh ? 'speaking' : 'listening'))),
      h('div', { class: 'sech' }, 'Frase a frase'),
      h('div', { class: 'list' }, R.res.map((x) => h('div', { class: 'item rv' }, h('div', { class: 'nm' }, x.words ? wordsEl(x.words) : h('b', null, x.text), h('span', null, x.pct != null ? x.pct + ' % · ' + verdict(x.pct) : 'Autoevaluación ' + x.self + '/5'))))),
      h('div', { class: 'row2', style: { marginTop: '14px' } }, h('button', { class: 'btn primary', 'data-act': 'again', style: { flex: 1 }, onclick: () => { SR_ = null; startSent(); } }, 'Repetir'), h('button', { class: 'btn', style: { flex: 1 }, onclick: () => { spview = 'setup'; drawSpeaking(); } }, 'Cambiar'))].filter(Boolean));
    return sh;
  }
  function spHistory() {
    const sh = U.shell('Progreso', () => { spview = 'setup'; drawSpeaking(); }, 'Atrás'), hist = S().speaking.history;
    const totSecs = hist.reduce((a, x) => a + x.secs, 0), thisWeek = hist.filter((x) => x.date >= B.weekStart(api.today())).reduce((a, x) => a + x.secs, 0);
    sh.body.append(h('div', { class: 'tiles t3' }, U.stat(hist.length, 'sesiones'), U.stat(Math.round(totSecs / 60) + ' min', 'en total'), U.stat(Math.round(thisWeek / 60) + ' min', 'esta semana')));
    const sc = hist.filter((x) => x.score != null).slice(0, 20).reverse(), sf = hist.filter((x) => x.mode === 'hablar' && x.self != null).slice(0, 20).reverse();
    if (sc.length) sh.body.append(h('div', { class: 'sech' }, 'Coincidencia en shadowing/dictado (%)'), h('div', { class: 'chart' }, U.lineChart(sc.map((x) => x.score), { min: 0, max: 100, color: 'var(--done)', fmt: (v) => Math.round(v) + '', label: 'Coincidencia por sesión' })));
    if (sf.length) sh.body.append(h('div', { class: 'sech' }, 'Autoevaluación al hablar (1-5)'), h('div', { class: 'chart' }, U.lineChart(sf.map((x) => x.self), { min: 1, max: 5, color: 'var(--accent)', fmt: (v) => Math.round(v) + '', label: 'Autoevaluación por sesión' })));
    const marks = []; for (const m of ['shadowing', 'dictado']) for (const lv of Sp.LEVELS) { const b = Sp.bestScore(hist, m, lv); if (b) marks.push([Sp.modeLabel(m) + ' · ' + lv, b.score + ' %']); }
    sh.body.append(h('div', { class: 'sech' }, 'Mejores marcas'));
    sh.body.append(marks.length ? h('div', { class: 'list' }, marks.map(([a, b]) => h('div', { class: 'item' }, h('div', { class: 'nm' }, h('b', null, b), h('span', null, a))))) : h('div', { class: 'empty' }, 'Aún no hay marcas (se necesitan sesiones de 3+ frases).'));
    sh.body.append(h('div', { class: 'sech' }, 'Sesiones'), h('div', { class: 'list' }, hist.slice(0, 60).map((x) => h('div', { class: 'item' }, h('div', { class: 'nm' }, h('b', null, Sp.modeLabel(x.mode) + ' · ' + x.level + (x.score != null ? ' · ' + x.score + ' %' : x.self != null ? ' · ' + x.self + '/5' : '')),
      h('span', null, U.dateEs(x.date) + ' · ' + U.fmtClock(x.secs * 1000) + ' min' + (x.mode === 'hablar' ? (x.words ? ' · ' + x.words + ' palabras' : '') : ' · ' + x.items + ' frases')))))));
    return sh;
  }

  function cardsInfo() {
    const g = S().grammar, sp = S().speaking, t = api.today();
    return { gToday: g.history.filter((x) => x.date === t).length, gAll: g.history.length, sToday: sp.history.filter((x) => x.date === t).length, sAll: sp.history.length, spMins: Math.round(sp.history.filter((x) => x.date === t).reduce((a, x) => a + x.secs, 0) / 60) };
  }
  window.BFEnglish = {
    init(a, util) { api = a; h = a.h; s = a.s; U = util; initVoices(); },
    openGrammar, openSpeaking, cardsInfo, caps,
    _debug: { get GM() { return GM; }, get SS() { return SS; }, get TS() { return TS; }, resetRecFail() { recFail = null; } },
  };
})();
