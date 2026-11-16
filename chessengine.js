/* byformain — motor de ajedrez original (sin dependencias).
   Tablero 0..63 (a8=0, h1=63). Piezas: P=1 N=2 B=3 R=4 Q=5 K=6; blancas +, negras −.
   Incluye: generación legal (enroque, al paso, coronación), jaque/mate/ahogado, tablas
   (material insuficiente, 50 jugadas, triple repetición), SAN/PGN y una IA minimax con poda alfa-beta. */
(function (root) {
  'use strict';
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const FILES = 'abcdefgh';
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const sqName = (i) => FILES[i & 7] + (8 - (i >> 3));
  const sqIndex = (s) => (8 - Number(s[1])) * 8 + FILES.indexOf(s[0]);
  const LETTER = { 1: '', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
  const FEN_CH = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };

  /* tablas precalculadas */
  const KNIGHT = [], KINGM = [], ORTH = [], DIAG = [];
  const onb = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
  for (let sq = 0; sq < 64; sq++) {
    const f = sq & 7, r = sq >> 3;
    KNIGHT[sq] = []; KINGM[sq] = []; ORTH[sq] = []; DIAG[sq] = [];
    for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) if (onb(f + df, r + dr)) KNIGHT[sq].push((r + dr) * 8 + f + df);
    for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) if ((df || dr) && onb(f + df, r + dr)) KINGM[sq].push((r + dr) * 8 + f + df);
    for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ray = []; for (let x = f + df, y = r + dr; onb(x, y); x += df, y += dr) ray.push(y * 8 + x); if (ray.length) ORTH[sq].push(ray); }
    for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const ray = []; for (let x = f + df, y = r + dr; onb(x, y); x += df, y += dr) ray.push(y * 8 + x); if (ray.length) DIAG[sq].push(ray); }
  }
  const CMASK = new Array(64).fill(0); CMASK[60] = 3; CMASK[63] = 1; CMASK[56] = 2; CMASK[4] = 12; CMASK[7] = 4; CMASK[0] = 8;
  // flags de jugada
  const F_CAP = 1, F_EP = 2, F_CK = 4, F_CQ = 8, F_DBL = 16;

  class Chess {
    constructor(fen) { this.load(fen || START); }
    load(fen) {
      const [pos, turn, cas, ep, half, full] = fen.trim().split(/\s+/);
      this.board = new Int8Array(64); this.kingSq = [0, 0, 0]; // índice 1 = blancas, 2 = negras (ver ksi)
      let i = 0;
      for (const ch of pos) {
        if (ch === '/') continue;
        if (/\d/.test(ch)) { i += Number(ch); continue; }
        const t = FEN_CH[ch.toLowerCase()], c = ch === ch.toLowerCase() ? -1 : 1;
        this.board[i] = c * t; if (t === K) this.kingSq[c === 1 ? 0 : 1] = i; i++;
      }
      this.turn = turn === 'b' ? -1 : 1;
      this.castle = (cas.includes('K') ? 1 : 0) | (cas.includes('Q') ? 2 : 0) | (cas.includes('k') ? 4 : 0) | (cas.includes('q') ? 8 : 0);
      this.ep = ep && ep !== '-' ? sqIndex(ep) : -1;
      this.half = Number(half) || 0; this.full = Number(full) || 1;
      this.stack = []; this.hist = []; this.keys = [this.key()]; this.startFen = fen;
    }
    fen() {
      let s = '';
      for (let r = 0; r < 8; r++) {
        let e = 0;
        for (let f = 0; f < 8; f++) { const p = this.board[r * 8 + f]; if (!p) { e++; continue; } if (e) { s += e; e = 0; } const ch = 'pnbrqk'[Math.abs(p) - 1]; s += p > 0 ? ch.toUpperCase() : ch; }
        if (e) s += e; if (r < 7) s += '/';
      }
      const c = (this.castle & 1 ? 'K' : '') + (this.castle & 2 ? 'Q' : '') + (this.castle & 4 ? 'k' : '') + (this.castle & 8 ? 'q' : '');
      return s + ' ' + (this.turn === 1 ? 'w' : 'b') + ' ' + (c || '-') + ' ' + (this.ep >= 0 ? sqName(this.ep) : '-') + ' ' + this.half + ' ' + this.full;
    }
    key() { // clave de posición para repeticiones (al paso solo si es capturable)
      let ep = -1;
      if (this.ep >= 0) { const r = this.ep >> 3, f = this.ep & 7, pr = this.turn === 1 ? r + 1 : r - 1; for (const df of [-1, 1]) if (onb(f + df, pr) && this.board[pr * 8 + f + df] === this.turn * P) ep = this.ep; }
      return this.board.join('') + this.turn + this.castle + ep;
    }
    ksq(c) { return this.kingSq[c === 1 ? 0 : 1]; }

    attacked(sq, by) {
      const b = this.board, f = sq & 7, r = sq >> 3;
      const pr = by === 1 ? r + 1 : r - 1;
      if (pr >= 0 && pr < 8) { if (f > 0 && b[pr * 8 + f - 1] === by * P) return true; if (f < 7 && b[pr * 8 + f + 1] === by * P) return true; }
      for (const t of KNIGHT[sq]) if (b[t] === by * N) return true;
      for (const t of KINGM[sq]) if (b[t] === by * K) return true;
      for (const ray of ORTH[sq]) for (const t of ray) { const p = b[t]; if (p) { if (p === by * R || p === by * Q) return true; break; } }
      for (const ray of DIAG[sq]) for (const t of ray) { const p = b[t]; if (p) { if (p === by * B || p === by * Q) return true; break; } }
      return false;
    }
    inCheck(c) { c = c || this.turn; return this.attacked(this.ksq(c), -c); }

    /* pseudo-legales; capOnly => capturas y coronaciones (para la búsqueda de quietud) */
    gen(capOnly) {
      const b = this.board, us = this.turn, out = [];
      const push = (f, t, p, fl) => out.push({ f, t, p: p || 0, fl: fl || 0 });
      for (let sq = 0; sq < 64; sq++) {
        const pc = b[sq]; if (!pc || pc * us < 0) continue;
        const t = pc * us;
        if (t === P) {
          const r = sq >> 3, f = sq & 7, dir = us === 1 ? -1 : 1, nr = r + dir, last = nr === 0 || nr === 7, fwd = sq + 8 * dir;
          if (!b[fwd]) {
            if (last) { for (const p of [Q, R, B, N]) push(sq, fwd, p); }
            else if (!capOnly) { push(sq, fwd); if (r === (us === 1 ? 6 : 1) && !b[fwd + 8 * dir]) push(sq, fwd + 8 * dir, 0, F_DBL); }
          }
          for (const df of [-1, 1]) {
            if (f + df < 0 || f + df > 7) continue;
            const to = fwd + df;
            if (b[to] * us < 0) { if (last) { for (const p of [Q, R, B, N]) push(sq, to, p, F_CAP); } else push(sq, to, 0, F_CAP); }
            else if (to === this.ep) push(sq, to, 0, F_CAP | F_EP);
          }
        } else if (t === N || t === K) {
          for (const to of (t === N ? KNIGHT : KINGM)[sq]) { const q = b[to]; if (q * us > 0) continue; if (q) push(sq, to, 0, F_CAP); else if (!capOnly) push(sq, to); }
          if (t === K && !capOnly) {
            const home = us === 1 ? 60 : 4;
            if (sq === home && !this.attacked(sq, -us)) {
              const ks = us === 1 ? 1 : 4, qs = us === 1 ? 2 : 8;
              if ((this.castle & ks) && !b[sq + 1] && !b[sq + 2] && b[sq + 3] === us * R && !this.attacked(sq + 1, -us) && !this.attacked(sq + 2, -us)) push(sq, sq + 2, 0, F_CK);
              if ((this.castle & qs) && !b[sq - 1] && !b[sq - 2] && !b[sq - 3] && b[sq - 4] === us * R && !this.attacked(sq - 1, -us) && !this.attacked(sq - 2, -us)) push(sq, sq - 2, 0, F_CQ);
            }
          }
        } else {
          const rays = t === R ? ORTH[sq] : t === B ? DIAG[sq] : ORTH[sq].concat(DIAG[sq]);
          for (const ray of rays) for (const to of ray) { const q = b[to]; if (q * us > 0) break; if (q) { push(sq, to, 0, F_CAP); break; } if (!capOnly) push(sq, to); }
        }
      }
      return out;
    }
    make(m) {
      const b = this.board, us = this.turn, pc = b[m.f];
      const u = { m, pc, cap: b[m.t], castle: this.castle, ep: this.ep, half: this.half };
      b[m.t] = m.p ? us * m.p : pc; b[m.f] = 0;
      if (m.fl & F_EP) { const c = m.t + (us === 1 ? 8 : -8); u.cap = b[c]; u.capSq = c; b[c] = 0; }
      if (m.fl & F_CK) { b[m.f + 1] = b[m.f + 3]; b[m.f + 3] = 0; }
      if (m.fl & F_CQ) { b[m.f - 1] = b[m.f - 4]; b[m.f - 4] = 0; }
      if (Math.abs(pc) === K) this.kingSq[us === 1 ? 0 : 1] = m.t;
      this.castle &= ~(CMASK[m.f] | CMASK[m.t]);
      this.ep = m.fl & F_DBL ? (m.f + m.t) >> 1 : -1;
      this.half = (Math.abs(pc) === P || u.cap) ? 0 : this.half + 1;
      if (us === -1) this.full++;
      this.turn = -us; this.stack.push(u);
    }
    unmake() {
      const u = this.stack.pop(), m = u.m, b = this.board; this.turn = -this.turn; const us = this.turn;
      b[m.f] = u.pc; b[m.t] = 0;
      if (m.fl & F_EP) b[u.capSq] = u.cap; else b[m.t] = u.cap;
      if (m.fl & F_CK) { b[m.f + 3] = b[m.f + 1]; b[m.f + 1] = 0; }
      if (m.fl & F_CQ) { b[m.f - 4] = b[m.f - 1]; b[m.f - 1] = 0; }
      if (Math.abs(u.pc) === K) this.kingSq[us === 1 ? 0 : 1] = m.f;
      this.castle = u.castle; this.ep = u.ep; this.half = u.half; if (us === -1) this.full--;
    }
    legal() {
      const us = this.turn, out = [];
      for (const m of this.gen(false)) { this.make(m); if (!this.attacked(this.ksq(us), -us)) out.push(m); this.unmake(); }
      return out;
    }
    legalFrom(sq) { return this.legal().filter((m) => m.f === sq); }
    perft(d) {
      if (d === 0) return 1;
      const us = this.turn; let n = 0;
      for (const m of this.gen(false)) { this.make(m); if (!this.attacked(this.ksq(us), -us)) n += d === 1 ? 1 : this.perft(d - 1); this.unmake(); }
      return n;
    }
    san(m, legal) {
      const pc = Math.abs(this.board[m.f]);
      if (m.fl & F_CK) return 'O-O'; if (m.fl & F_CQ) return 'O-O-O';
      let s = '';
      if (pc === P) { if (m.fl & F_CAP) s += FILES[m.f & 7] + 'x'; s += sqName(m.t); if (m.p) s += '=' + LETTER[m.p]; return s; }
      s = LETTER[pc];
      const same = legal.filter((x) => x.f !== m.f && x.t === m.t && Math.abs(this.board[x.f]) === pc);
      if (same.length) {
        if (!same.some((x) => (x.f & 7) === (m.f & 7))) s += FILES[m.f & 7];
        else if (!same.some((x) => (x.f >> 3) === (m.f >> 3))) s += 8 - (m.f >> 3);
        else s += sqName(m.f);
      }
      if (m.fl & F_CAP) s += 'x';
      return s + sqName(m.t);
    }
    /* jugada pública: acepta {f,t,p} (índices; p = tipo de pieza) o {from,to,promotion:'q'} */
    move(o) {
      const f = o.f != null ? o.f : sqIndex(o.from), t = o.t != null ? o.t : sqIndex(o.to);
      const p = o.p || (o.promotion ? FEN_CH[o.promotion] : 0);
      const legal = this.legal();
      const m = legal.find((x) => x.f === f && x.t === t && x.p === p);
      if (!m) return null;
      let san = this.san(m, legal);
      const wasTurn = this.turn;
      this.make(m); this.keys.push(this.key());
      if (this.inCheck()) san += this.legal().length ? '+' : '#';
      const rec = { f: m.f, t: m.t, p: m.p, fl: m.fl, san, color: wasTurn };
      this.hist.push(rec); return rec;
    }
    undo() { if (!this.hist.length) return null; const r = this.hist.pop(); this.unmake(); this.keys.pop(); return r; }
    insufficient() {
      const minors = []; let bishopsSq = [];
      for (let i = 0; i < 64; i++) { const p = Math.abs(this.board[i]); if (!p || p === K) continue; if (p === P || p === R || p === Q) return false; minors.push(p); if (p === B) bishopsSq.push(((i >> 3) + (i & 7)) & 1); }
      if (minors.length <= 1) return true;
      return minors.every((x) => x === B) && bishopsSq.every((c) => c === bishopsSq[0]);
    }
    /* estado: {over, result:'1-0'|'0-1'|'1/2-1/2'|'*', reason, winner: 1|-1|0|null} */
    status() {
      const n = this.legal().length;
      if (!n) return this.inCheck() ? { over: true, result: this.turn === 1 ? '0-1' : '1-0', reason: 'jaque mate', winner: -this.turn } : { over: true, result: '1/2-1/2', reason: 'rey ahogado', winner: 0 };
      if (this.insufficient()) return { over: true, result: '1/2-1/2', reason: 'material insuficiente', winner: 0 };
      if (this.half >= 100) return { over: true, result: '1/2-1/2', reason: 'regla de 50 jugadas', winner: 0 };
      const k = this.keys[this.keys.length - 1]; let c = 0; for (const x of this.keys) if (x === k) c++;
      if (c >= 3) return { over: true, result: '1/2-1/2', reason: 'triple repetición', winner: 0 };
      return { over: false, result: '*', reason: '', winner: null, check: this.inCheck() };
    }
    sanList() { return this.hist.map((h) => h.san); }
    movetext() { const l = this.sanList(); let s = ''; for (let i = 0; i < l.length; i++) s += (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + l[i] + ' '; return s.trim(); }
  }
  function movetextFrom(san, startFull) { let s = ''; for (let i = 0; i < san.length; i++) s += (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + san[i] + ' '; return s.trim(); }

  /* ---------------- IA ---------------- */
  const VAL = [0, 100, 320, 330, 500, 900, 0];
  const PST = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    4: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  };
  const KEND = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
  const cdist = (sq) => { const f = sq & 7, r = sq >> 3; return Math.max(3 - Math.min(f, 7 - f), 3 - Math.min(r, 7 - r)); };

  function evaluate(g) { // desde el punto de vista del bando que mueve
    const b = g.board; let score = 0, nonPawn = 0, bw = 0, bb = 0, pawns = [0, 0], mat = [0, 0];
    for (let i = 0; i < 64; i++) { const p = b[i]; if (!p) continue; const t = Math.abs(p); if (t !== P && t !== K) nonPawn += VAL[t]; }
    const endg = nonPawn <= 1300;
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p) continue; const t = Math.abs(p), w = p > 0;
      let v = VAL[t] + (t === K ? (endg ? KEND[w ? i : i ^ 56] : PST[6][w ? i : i ^ 56]) : PST[t][w ? i : i ^ 56]);
      if (t === B) { if (w) bw++; else bb++; }
      if (t === P) pawns[w ? 0 : 1]++;
      if (t !== K) mat[w ? 0 : 1] += VAL[t];
      score += w ? v : -v;
    }
    if (bw >= 2) score += 30; if (bb >= 2) score -= 30;
    // remate en finales: arrinconar al rey rival cuando hay ventaja clara
    if (endg) {
      const wk = g.ksq(1), bk = g.ksq(-1), dk = Math.abs((wk & 7) - (bk & 7)) + Math.abs((wk >> 3) - (bk >> 3));
      if (mat[0] - mat[1] >= 300 && pawns[1] === 0) score += 12 * cdist(bk) + 5 * (14 - dk);
      if (mat[1] - mat[0] >= 300 && pawns[0] === 0) score -= 12 * cdist(wk) + 5 * (14 - dk);
    }
    return g.turn === 1 ? score : -score;
  }
  const MATE = 30000;
  function order(g, moves, first) {
    const b = g.board;
    for (const m of moves) {
      let s = 0;
      if (first && m.f === first.f && m.t === first.t && m.p === first.p) s = 1e6;
      else { const victim = (m.fl & F_EP) ? P : Math.abs(b[m.t]); if (victim) s = 10 * VAL[victim] - Math.abs(b[m.f]) + 1000; if (m.p) s += VAL[m.p]; }
      m.s = s;
    }
    moves.sort((a, c) => c.s - a.s);
  }
  class Timeout {}
  function think(g, level, opts) {
    opts = opts || {};
    const rnd = opts.rnd || Math.random;
    const cfg = [null, { depth: 1, ms: 250, qs: false, noise: 60, blunder: 0.22 }, { depth: 2, ms: 600, qs: true, noise: 18, blunder: 0 }, { depth: 6, ms: opts.ms || 1100, qs: true, noise: 4, blunder: 0 }][level] || { depth: 2, ms: 600, qs: true, noise: 10, blunder: 0 };
    const now = opts.now || Date.now; const start = now(); let nodes = 0;
    const check = () => { if ((++nodes & 1023) === 0 && now() - start > cfg.ms) throw new Timeout(); };
    function qsearch(alpha, beta, ply) {
      check();
      const stand = evaluate(g); if (stand >= beta) return beta; if (stand > alpha) alpha = stand;
      if (ply > 5) return stand;
      const us = g.turn, ms = g.gen(true); order(g, ms);
      for (const m of ms) {
        g.make(m);
        if (g.attacked(g.ksq(us), -us)) { g.unmake(); continue; }
        const sc = -qsearch(-beta, -alpha, ply + 1); g.unmake();
        if (sc >= beta) return beta; if (sc > alpha) alpha = sc;
      }
      return alpha;
    }
    function nega(d, alpha, beta, ply) {
      check();
      const us = g.turn, inChk = g.inCheck(us);
      if (inChk) d++;
      if (d <= 0) return cfg.qs ? qsearch(alpha, beta, 0) : evaluate(g);
      if (g.half >= 100) return 0;
      const ms = g.gen(false); order(g, ms); let any = false;
      for (const m of ms) {
        g.make(m);
        if (g.attacked(g.ksq(us), -us)) { g.unmake(); continue; }
        any = true; const sc = -nega(d - 1, -beta, -alpha, ply + 1); g.unmake();
        if (sc >= beta) return beta; if (sc > alpha) alpha = sc;
      }
      if (!any) return inChk ? -MATE + ply : 0;
      return alpha;
    }
    const root = g.legal();
    if (!root.length) return null;
    if (root.length === 1) return root[0];
    if (cfg.blunder && rnd() < cfg.blunder) return root[Math.floor(rnd() * root.length)];
    let best = root[0], bestScore = -Infinity, scored = [];
    for (let d = 1; d <= cfg.depth; d++) {
      const cur = []; let alphaBest = -Infinity, curBest = null;
      try {
        order(g, root, best);
        for (const m of root) {
          g.make(m);
          // sin poda en la raíz para poder aplicar ruido y elegir entre jugadas parecidas
          const sc = -nega(d - 1, -MATE - 1, MATE + 1, 1); g.unmake();
          cur.push({ m, sc }); if (sc > alphaBest) { alphaBest = sc; curBest = m; }
        }
      } catch (e) {
        if (!(e instanceof Timeout)) throw e;
        break;
      }
      best = curBest; bestScore = alphaBest; scored = cur;
      if (Math.abs(bestScore) > MATE - 100) break; // mate encontrado
      if (now() - start > cfg.ms * 0.45) break;
    }
    if (cfg.noise && scored.length && Math.abs(bestScore) < MATE - 100) {
      let pick = null, ps = -Infinity;
      for (const { m, sc } of scored) { const v = sc + (rnd() - 0.5) * 2 * cfg.noise; if (v > ps) { ps = v; pick = m; } }
      if (cfg.blunder === 0 || sc_ok(scored, pick, bestScore)) best = pick;
    }
    return best;
  }
  function sc_ok(scored, pick, bestScore) { const e = scored.find((x) => x.m === pick); return e && e.sc >= bestScore - 150; }
  function pickMove(g, level, opts) { g._base = g.stack.length; try { return think(g, level, opts); } finally { while (g.stack.length > g._base) g.unmake(); } }

  const API = { Chess, START, sqName, sqIndex, pickMove, evaluate, movetextFrom, P, N, B, R, Q, K, FILES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ChessEngine = API;
})(typeof self !== 'undefined' ? self : this);
