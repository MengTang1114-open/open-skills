// Flowchart animation runtime.
// Every visual state is a pure function of time t (seconds): render(t).
// Preview mode drives t from requestAnimationFrame; record mode lets the
// recorder call window.__render(t) frame by frame, so output is deterministic.
// No CSS transitions/animations are used anywhere for that reason.
(function () {
  'use strict';
  const SPEC = window.SPEC;
  const STAGE = document.getElementById('stage');
  const STYLE = STAGE.dataset.style;
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s) => document.querySelector(s);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const lerp = (a, b, p) => a + (b - a) * p;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const pad2 = (n) => String(n).padStart(2, '0');
  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const htmlEl = (tag, cls, parent, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };

  // Per-style behaviour that CSS alone can't express.
  //   captions: paragraphs | log | card | panel (an app screen listing the step's nodes)    token: square | glow | none
  //   flow: what runs along finished links (false | dash | particles)
  //   camera: extra zoom while following the active step (0 = static)
  //   mascot: a pixel bot that walks along the link being drawn
  const PROFILE = Object.assign({ radius: 0, camera: 0, nodeMaxW: 300, flow: false, token: 'square', captions: 'card' }, {
    paper:    { captions: 'paragraphs', token: 'square' },
    terminal: { captions: 'log', token: 'square', flow: 'dash', typeTitle: true, marks: ['[ ]', '[~]', '[x]'] },
    neon:     { token: 'glow', flow: 'particles', camera: 0.07, nodeMaxW: 290 },
    product:  { captions: 'panel', token: 'square', flow: false, nodeMaxW: 260, inset: 30 },
    poster:   { token: 'none', flow: 'dash', mascot: true },
  }[STYLE] || {});
  const PALETTE = {
    neon: ['#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#22d3ee', '#a3e635'],
    product: ['#22d3ee', '#a78bfa', '#fbbf24', '#34d399', '#f472b6', '#60a5fa', '#fb923c', '#a3e635'],
  }[STYLE] || ['#888'];

  // ---------- normalise spec ----------
  const nodes = SPEC.nodes.map((n, i) => Object.assign({ i }, n));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges = (SPEC.edges || []).filter((e) => byId[e.from] && byId[e.to]).map((e, i) => Object.assign({ i }, e));

  let steps = (SPEC.steps || []).map((s) => Object.assign({}, s, { nodes: (s.nodes || []).filter((id) => byId[id]) }))
    .filter((s) => s.nodes.length);
  if (!steps.length) steps = topoOrder().map((n) => ({ nodes: [n.id], caption: n.desc || n.label }));
  const covered = new Set(steps.flatMap((s) => s.nodes));
  nodes.filter((n) => !covered.has(n.id)).forEach((n) => steps.push({ nodes: [n.id], caption: n.desc || n.label }));

  // With BGM, build.py injects SPEC.beat = {period, first_beat}: step boundaries and
  // node activations snap to the beat grid so things land on the music.
  const BEAT = SPEC.beat && SPEC.beat.period > 0 ? SPEC.beat : null;
  const DEF_STEP = 2.6;
  let INTRO = 1.6, OUTRO = 2.6;
  if (BEAT) {
    INTRO = BEAT.first_beat + Math.max(0, Math.ceil((INTRO - BEAT.first_beat) / BEAT.period)) * BEAT.period;
    OUTRO = Math.round(OUTRO / BEAT.period) * BEAT.period;
  }
  let clock = INTRO;
  steps.forEach((s, k) => {
    s.k = k; s.dur = +s.sec || DEF_STEP;
    if (BEAT) s.dur = Math.max(4, Math.round(s.dur / BEAT.period)) * BEAT.period;
    s.t0 = clock; clock += s.dur; s.t1 = clock;
    s.title = s.title || byId[s.nodes[0]].label;
  });
  const STEPS_END = clock, TOTAL = clock + OUTRO;
  nodes.forEach((n) => { n.step = steps.find((s) => s.nodes.includes(n.id)); });
  nodes.forEach((n) => {
    const s = n.step;
    n.ta = s.t0 + (BEAT ? 2 * BEAT.period : 0.32 * s.dur);   // becomes active (on a beat when synced)
    n.td = s.t0 + 0.92 * s.dur;                                // becomes done
  });
  edges.forEach((e) => {
    const fs = byId[e.from].step, ts = byId[e.to].step;
    if (ts.k >= fs.k) { e.t0 = ts.t0; e.t1 = byId[e.to].ta; }
    else { e.t0 = fs.t0 + 0.55 * fs.dur; e.t1 = fs.t1; e.loop = true; }   // loop-back edge
  });
  // 0..1 envelope that spikes on every beat and decays quickly
  const beatEnv = (t) => {
    if (!BEAT || t < BEAT.first_beat) return 0;
    return Math.exp((-((t - BEAT.first_beat) % BEAT.period) / BEAT.period) * 6);
  };

  function topoOrder() {
    const indeg = new Map(nodes.map((n) => [n.id, 0]));
    edges.forEach((e) => indeg.set(e.to, indeg.get(e.to) + 1));
    const out = [], seen = new Set();
    const queue = nodes.filter((n) => !indeg.get(n.id));
    if (!queue.length) queue.push(nodes[0]);
    while (out.length < nodes.length) {
      const n = queue.shift() || nodes.find((x) => !seen.has(x.id));
      if (seen.has(n.id)) continue;
      seen.add(n.id); out.push(n);
      edges.filter((e) => e.from === n.id).forEach((e) => {
        indeg.set(e.to, indeg.get(e.to) - 1);
        if (indeg.get(e.to) <= 0 && !seen.has(e.to)) queue.push(byId[e.to]);
      });
    }
    return out;
  }

  // ---------- static text ----------
  const fill = (sel, v) => { const e = $(sel); if (!e) return; if (v) e.textContent = v; else e.style.display = 'none'; };
  fill('#kicker', SPEC.kicker);
  fill('#title', SPEC.title);
  fill('#subtitle', SPEC.subtitle);
  fill('#summary', SPEC.summary || SPEC.subtitle);
  fill('#footer', SPEC.footer);
  const TITLE = $('#title'), TITLE_TEXT = SPEC.title || '';
  const SUMMARY = $('#summary'), SUMMARY_TEXT = SPEC.summary || SPEC.subtitle || '';

  // ---------- build diagram ----------
  const DIA = $('#diagram');
  const FULLW = DIA.clientWidth, FULLH = DIA.clientHeight;
  // with a moving camera, lay out inside a safe area so zoom + pan never crops a node
  // safe area: room for the camera to zoom without cropping, or a fixed inset when the diagram sits in a framed card
  const PADX = Math.max(Math.round(FULLW * PROFILE.camera * 0.75), PROFILE.inset || 0);
  const PADY = Math.max(Math.round(FULLH * PROFILE.camera * 0.75), PROFILE.inset || 0);
  const DW = FULLW - 2 * PADX, DH = FULLH - 2 * PADY;
  const CAM = htmlEl('div', 'cam', DIA);
  if (PROFILE.camera) DIA.style.overflow = 'hidden';
  const svg = svgEl('svg', { width: FULLW, height: FULLH, viewBox: `0 0 ${FULLW} ${FULLH}`, class: 'edges' });
  CAM.appendChild(svg);
  const defs = svgEl('defs', {}, svg);
  ['base', 'live'].forEach((kind) => {
    const m = svgEl('marker', { id: 'arrow-' + kind, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
    svgEl('path', { d: 'M0,1 L9,5 L0,9 z', class: 'arrow-' + kind }, m);
  });
  const gEdges = svgEl('g', {}, svg), gTokens = svgEl('g', {}, svg);

  nodes.forEach((n, i) => {
    const el = htmlEl('div', 'node', CAM);
    el.style.setProperty('--c', n.color || PALETTE[i % PALETTE.length]);
    const head = htmlEl('div', 'n-head', el);
    htmlEl('span', 'n-icon', head, (n.icon || n.label || '?').trim().slice(0, 1).toUpperCase());
    htmlEl('span', 'n-tag', head, `${pad2(n.step.k + 1)}${n.tag ? ' · ' + n.tag : ''}`);
    htmlEl('div', 'n-label', el, n.label);
    if (n.desc) htmlEl('div', 'n-desc', el, n.desc);
    const bar = htmlEl('div', 'n-bar', el); n.barEl = htmlEl('i', '', bar);
    n.statusEl = htmlEl('div', 'n-status', el, 'waiting');
    n.rippleEl = htmlEl('div', 'n-ripple', el);
    n.el = el;
  });

  const layoutName = SPEC.layout && SPEC.layout !== 'auto' ? SPEC.layout : pickLayout();
  STAGE.dataset.layout = layoutName;
  (layoutName === 'hub' ? layoutHub : layoutFlow)();
  nodes.forEach((n) => {
    n.x += PADX; n.y += PADY;
    n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px';
    n.cx = n.x + n.w / 2; n.cy = n.y + n.h / 2;
  });
  edges.forEach((e) => { e.pts = e.pts.map(([x, y]) => [x + PADX, y + PADY]); });

  function neighbours() {
    const nb = new Map(nodes.map((n) => [n.id, new Set()]));
    edges.forEach((e) => { if (e.from !== e.to) { nb.get(e.from).add(e.to); nb.get(e.to).add(e.from); } });
    return nb;
  }
  function pickLayout() {
    // hub only when one node touches most other nodes and most edges
    const nb = neighbours();
    const hub = nodes.reduce((a, b) => (nb.get(b.id).size > nb.get(a.id).size ? b : a));
    const touching = edges.filter((e) => e.from === hub.id || e.to === hub.id).length;
    return nodes.length >= 5 && nb.get(hub.id).size >= Math.max(4, 0.6 * (nodes.length - 1)) && touching >= 0.7 * edges.length ? 'hub' : 'flow';
  }

  function placeBox(n, x, y, w) {
    n.x = x; n.y = y; n.w = w; n.h = n.el.offsetHeight;
    n.el.style.left = x + 'px'; n.el.style.top = y + 'px';
  }
  function fitScale(measure) {
    // shrink node text (via --ns) until measure() reports it fits
    for (const s of [1, 0.92, 0.84, 0.76, 0.68, 0.6]) {
      STAGE.style.setProperty('--ns', s);
      if (measure()) return s;
    }
    STAGE.classList.add('no-desc');
    measure();
    return 0.6;
  }

  // Layered top-to-bottom layout: ranks by longest path; loops and long links use side lanes.
  function layoutFlow() {
    const order = steps.flatMap((s) => s.nodes).map((id) => byId[id]);
    const stepIdx = new Map(order.map((n, i) => [n.id, i]));
    // an edge pointing to an earlier step of the narrative is a loop-back
    edges.forEach((e) => { e.back = byId[e.to].step.k < byId[e.from].step.k; });
    const fwd = edges.filter((e) => !e.back && e.from !== e.to);
    const rank = new Map(nodes.map((n) => [n.id, 0]));
    for (let iter = 0; iter < nodes.length; iter++) {
      let changed = false;
      fwd.forEach((e) => { if (rank.get(e.to) < rank.get(e.from) + 1) { rank.set(e.to, rank.get(e.from) + 1); changed = true; } });
      if (!changed) break;
    }
    const R = Math.max(...rank.values()) + 1;
    const rows = Array.from({ length: R }, () => []);
    order.forEach((n) => { n.rank = rank.get(n.id); rows[n.rank].push(n); });
    const pos = new Map();
    rows.forEach((row, r) => {
      if (r > 0) {
        row.forEach((n) => {
          const ps = fwd.filter((e) => e.to === n.id && pos.has(e.from)).map((e) => pos.get(e.from));
          n.bary = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : stepIdx.get(n.id);
        });
        row.sort((a, b) => a.bary - b.bary || stepIdx.get(a.id) - stepIdx.get(b.id));
      }
      row.forEach((n, i) => pos.set(n.id, (i + 0.5) / row.length));
    });
    edges.forEach((e) => { e.span = rank.get(e.to) - rank.get(e.from); });
    const backs = edges.filter((e) => e.back).length, longs = edges.filter((e) => !e.back && e.span > 1).length;
    const laneL = backs ? 30 + 14 * backs : 0, laneR = longs ? 30 + 14 * longs : 0;
    const m = Math.max(...rows.map((r) => r.length));
    const gx = m > 3 ? 16 : 26;
    const avail = DW - laneL - laneR;
    const maxW = m <= 2 ? PROFILE.nodeMaxW * 1.35 : PROFILE.nodeMaxW;
    const nw = Math.min(maxW, (avail - (m - 1) * gx) / m);
    let rowH, gap;
    fitScale(() => {
      nodes.forEach((n) => { n.el.style.width = nw + 'px'; });
      rowH = rows.map((row) => Math.max(...row.map((n) => n.el.offsetHeight)));
      gap = R > 1 ? (DH - rowH.reduce((a, b) => a + b, 0)) / (R - 1) : 0;
      return gap >= 40;
    });
    gap = Math.min(gap, 140);
    const used = rowH.reduce((a, b) => a + b, 0) + gap * (R - 1);
    let y = (DH - used) / 2;
    const cx0 = laneL + avail / 2;
    rows.forEach((row, r) => {
      const total = row.length * nw + (row.length - 1) * gx;
      let x = cx0 - total / 2;
      row.forEach((n) => { placeBox(n, x, y + (rowH[r] - n.el.offsetHeight) / 2, nw); x += nw + gx; });
      y += rowH[r] + gap;
    });

    const ports = (list, key, other) => {
      list.sort((a, b) => byId[a[other]].x - byId[b[other]].x);
      list.forEach((e, j) => { e[key] = (j - (list.length - 1) / 2) * Math.min(26, (nw * 0.5) / list.length); });
    };
    nodes.forEach((n) => {
      ports(edges.filter((e) => e.from === n.id && e.span === 1 && !e.back), 'po', 'to');
      ports(edges.filter((e) => e.to === n.id && e.span === 1 && !e.back), 'pi', 'from');
    });
    const right = Math.max(...nodes.map((n) => n.x + n.w)), left = Math.min(...nodes.map((n) => n.x));
    let rl = 0, ll = 0;
    edges.forEach((e) => {
      const a = byId[e.from], b = byId[e.to];
      if (e.from === e.to) {
        const x = a.x + a.w, y0 = a.y + a.h / 2;
        e.pts = [[x, y0 - 12], [x + 26, y0 - 12], [x + 26, y0 + 12], [x, y0 + 12]];
      } else if (e.back || e.span !== 1) {
        // side lane: left for loop-backs, right for long forward links. Leave/enter by the
        // lane-facing side when nothing sits in between, otherwise via the bottom/top.
        const useLeft = e.back;
        const lx = useLeft ? left - 22 - 14 * ll : right + 22 + 14 * rl;
        const channel = 10 + 6 * (useLeft ? ll++ : rl++);
        const outer = (n) => { const row = rows[n.rank]; return useLeft ? row[0] === n : row[row.length - 1] === n; };
        const sideX = (n) => (useLeft ? n.x : n.x + n.w);
        const pts = [];
        if (outer(a)) pts.push([sideX(a), a.y + a.h / 2], [lx, a.y + a.h / 2]);
        else {
          const sx = a.x + a.w / 2 + (useLeft ? -1 : 1) * a.w * 0.3, sy = a.y + a.h + channel;
          pts.push([sx, a.y + a.h], [sx, sy], [lx, sy]);
        }
        if (outer(b)) pts.push([lx, b.y + b.h / 2], [sideX(b), b.y + b.h / 2]);
        else {
          const tx = b.x + b.w / 2 + (useLeft ? -1 : 1) * b.w * 0.3, ty = b.y - channel;
          pts.push([lx, ty], [tx, ty], [tx, b.y]);
        }
        e.pts = pts;
      } else {
        const sx = a.x + a.w / 2 + (e.po || 0), sy = a.y + a.h;
        const tx = b.x + b.w / 2 + (e.pi || 0), ty = b.y;
        const my = sy + (ty - sy) / 2;
        e.pts = Math.abs(sx - tx) < 2 ? [[sx, sy], [sx, ty]] : [[sx, sy], [sx, my], [tx, my], [tx, ty]];
      }
    });
  }

  // Hub as a bracket diagram: hub in the middle, spokes in a left and a right column,
  // joined by right-angle bus lines (no diagonals, no curves).
  function layoutHub() {
    const nb = neighbours();
    const hub = nodes.reduce((a, b) => (nb.get(b.id).size > nb.get(a.id).size ? b : a));
    hub.el.classList.add('is-hub');
    const ring = steps.flatMap((s) => s.nodes).map((id) => byId[id]).filter((n) => n !== hub);
    const L = ring.slice(0, Math.ceil(ring.length / 2)), Rt = ring.slice(L.length);
    const margin = 26, busGap = 46;
    const hubW = Math.min(DW * 0.28, 330);
    const colW = Math.min(PROFILE.nodeMaxW, (DW - hubW - 2 * margin - 4 * busGap) / 2);
    const lx = margin, rx = DW - margin - colW, hx = DW / 2 - hubW / 2;
    let gaps;
    fitScale(() => {
      ring.forEach((n) => { n.el.style.width = colW + 'px'; });
      hub.el.style.width = hubW + 'px';
      gaps = [L, Rt].map((col) => (DH - col.reduce((a, n) => a + n.el.offsetHeight, 0)) / (col.length + 1));
      return Math.min(...gaps) >= 22;
    });
    [[L, lx, gaps[0]], [Rt, rx, gaps[1]]].forEach(([col, x, gap]) => {
      const g = Math.min(gap, 70);
      const total = col.reduce((a, n) => a + n.el.offsetHeight, 0) + g * (col.length - 1);
      let y = (DH - total) / 2;
      col.forEach((n) => { placeBox(n, x, y, colW); y += n.h + g; });
    });
    placeBox(hub, hx, DH / 2 - hub.el.offsetHeight / 2, hubW);
    const busL = (lx + colW + hx) / 2, busR = (hx + hubW + rx) / 2;
    const side = (n) => (L.includes(n) ? 'L' : 'R');
    edges.forEach((e) => {
      const a = byId[e.from], b = byId[e.to];
      const spoke = a === hub ? b : b === hub ? a : null;
      let pts;
      if (spoke) {
        const isL = side(spoke) === 'L', bus = isL ? busL : busR;
        const hp = [isL ? hub.x : hub.x + hub.w, hub.y + hub.h / 2];
        const sp = [isL ? spoke.x + spoke.w : spoke.x, spoke.y + spoke.h / 2];
        pts = [hp, [bus, hp[1]], [bus, sp[1]], sp];
        if (a !== hub) pts.reverse();
      } else if (side(a) === side(b)) {
        const isL = side(a) === 'L', ox = isL ? a.x - 16 : a.x + a.w + 16;
        const ax = isL ? a.x : a.x + a.w;
        pts = [[ax, a.y + a.h / 2], [ox, a.y + a.h / 2], [ox, b.y + b.h / 2], [ax, b.y + b.h / 2]];
      } else {
        const top = Math.min(...nodes.map((n) => n.y)) - 18;
        pts = [[a.x + a.w / 2, a.y], [a.x + a.w / 2, top], [b.x + b.w / 2, top], [b.x + b.w / 2, b.y]];
      }
      e.pts = pts;
    });
  }

  function orthoPath(pts, r) {
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
      const r1 = Math.min(r, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2);
      if (r1 < 0.5) { d += ` L${x},${y}`; continue; }
      const a = [x - Math.sign(x - px) * r1, y - Math.sign(y - py) * r1];
      const b = [x + Math.sign(nx - x) * r1, y + Math.sign(ny - y) * r1];
      d += ` L${a[0]},${a[1]} Q${x},${y} ${b[0]},${b[1]}`;
    }
    const last = pts[pts.length - 1];
    return d + ` L${last[0]},${last[1]}`;
  }

  edges.forEach((e) => {
    e.d = orthoPath(e.pts, PROFILE.radius);
    const g = svgEl('g', { class: 'edge' + (e.loop ? ' is-loop' : '') }, gEdges);
    e.base = svgEl('path', { d: e.d, class: 'edge-base' }, g);
    e.draw = svgEl('path', { d: e.d, class: 'edge-draw' }, g);
    if (PROFILE.flow === 'dash') e.flow = svgEl('path', { d: e.d, class: 'edge-flow' }, g);
    e.len = e.draw.getTotalLength();
    e.draw.style.strokeDasharray = `${e.len} ${e.len}`;
    if (e.label) {
      // put the label on the longest segment, beside the line
      let best = 0, at = null;
      for (let i = 1; i < e.pts.length; i++) {
        const [x0, y0] = e.pts[i - 1], [x1, y1] = e.pts[i], L0 = Math.hypot(x1 - x0, y1 - y0);
        if (L0 > best) { best = L0; at = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, vertical: Math.abs(x1 - x0) < 1 }; }
      }
      e.lab = svgEl('text', at.vertical
        ? { x: at.x - 8, y: at.y, class: 'edge-label', 'text-anchor': 'end', 'dominant-baseline': 'middle' }
        : { x: at.x, y: at.y - 9, class: 'edge-label', 'text-anchor': 'middle' }, g);
      e.lab.textContent = e.label;
    }
    e.tokens = [];
    if (PROFILE.token !== 'none') {
      const count = PROFILE.flow === 'particles' ? 3 : 1;
      for (let j = 0; j < count; j++) {
        e.tokens.push(PROFILE.token === 'glow'
          ? svgEl('circle', { r: j ? 3.2 : 5, class: 'token' }, gTokens)
          : svgEl('rect', { width: 10, height: 10, class: 'token' }, gTokens));
      }
    }
  });

  // Pixel bot that walks along whichever link is being drawn (poster style).
  let MASCOT = null;
  if (PROFILE.mascot) {
    MASCOT = svgEl('g', { class: 'mascot' }, gTokens);
    const px = [[2, 0, 10, 2], [0, 2, 14, 7], [2, 9, 2, 3], [6, 9, 2, 3], [10, 9, 2, 3], [-2, 4, 2, 3], [14, 4, 2, 3]];
    px.forEach(([x, y, w, h]) => svgEl('rect', { x: x * 2 - 14, y: y * 2 - 24, width: w * 2, height: h * 2, class: 'm-body' }, MASCOT));
    [[3, 4], [9, 4]].forEach(([x, y]) => svgEl('rect', { x: x * 2 - 14, y: y * 2 - 24, width: 4, height: 4, class: 'm-eye' }, MASCOT));
  }

  // ---------- side panels: captions, tasks, stats ----------
  const CAP = $('#captions');
  if (CAP) {
    if (PROFILE.captions === 'paragraphs') {
      steps.forEach((s) => {
        const p = htmlEl('p', 'cap', CAP);
        htmlEl('b', 'cap-h', p, `${s.k + 1}. ${s.title}`);
        s.hl = htmlEl('span', 'hl', p, ' ' + (s.caption || ''));
        s.capEl = p;
      });
      let fs = parseFloat(getComputedStyle(CAP).fontSize);
      while ((CAP.scrollHeight > CAP.clientHeight + 1 || CAP.scrollWidth > CAP.clientWidth + 1) && fs > 13) {
        fs -= 0.5; CAP.style.fontSize = fs + 'px';
      }
    } else if (PROFILE.captions === 'log') {
      steps.forEach((s) => {
        const line = htmlEl('div', 'log', CAP);
        htmlEl('span', 'log-t', line, `+${s.t0.toFixed(1).padStart(4, '0')}s`);
        htmlEl('span', 'log-who', line, (byId[s.nodes[0]].tag || 'step').toLowerCase());
        s.typeEl = htmlEl('span', 'log-msg', line, '');
        s.full = s.caption || s.title;
        s.capEl = line;
      });
    } else if (PROFILE.captions === 'panel') {
      steps.forEach((s) => {
        const card = htmlEl('div', 'card panel', CAP);
        const head = htmlEl('div', 'pn-head', card);
        const lead = byId[s.nodes[0]];
        const ic = htmlEl('span', 'n-icon', head, (lead.icon || lead.label || '?').trim().slice(0, 1).toUpperCase());
        ic.style.setProperty('--c', lead.el.style.getPropertyValue('--c'));
        htmlEl('span', 'pn-title', head, s.title);
        htmlEl('span', 'pn-no', head, `${pad2(s.k + 1)} / ${pad2(steps.length)}`);
        htmlEl('div', 'card-t', card, s.caption || '');
        s.rows = s.nodes.map((id) => {
          const n = byId[id], row = htmlEl('div', 'pn-row', card);
          row.style.setProperty('--c', n.el.style.getPropertyValue('--c'));
          htmlEl('span', 'n-icon', row, (n.icon || n.label || '?').trim().slice(0, 1).toUpperCase());
          const txt = htmlEl('span', 'pn-txt', row);
          htmlEl('b', '', txt, n.label);
          if (n.desc) htmlEl('i', '', txt, n.desc);
          const st = htmlEl('span', 'pn-st', row, 'queued');
          return { n, row, st };
        });
        s.capEl = card;
      });
    } else {
      steps.forEach((s) => {
        const card = htmlEl('div', 'card', CAP);
        htmlEl('div', 'card-k', card, `STEP ${pad2(s.k + 1)} / ${pad2(steps.length)} · ${s.title}`);
        htmlEl('div', 'card-t', card, s.caption || '');
        s.capEl = card;
      });
    }
  }
  const TASKS = $('#tasks');
  if (TASKS) steps.forEach((s) => {
    const row = htmlEl('div', 'task', TASKS);
    s.markEl = htmlEl('span', 'tk-m', row, '');
    htmlEl('span', 'tk-t', row, s.title);
    s.taskEl = row;
  });
  const STATS = $('#stats');
  const stats = (SPEC.stats && SPEC.stats.length ? SPEC.stats : [
    { label: 'steps', value: steps.length }, { label: 'nodes', value: nodes.length }, { label: 'links', value: edges.length },
  ]).slice(0, 4);
  if (STATS) stats.forEach((s) => {
    const box = htmlEl('div', 'stat', STATS);
    s.numEl = htmlEl('b', '', box, '0');
    htmlEl('span', '', box, s.label);
    s.dec = (String(s.value).split('.')[1] || '').length;
  });
  const PROG = $('#progress i'), STEPNO = $('#stepno'), CURSOR = $('.cursor');

  // camera focus per step: centroid of the step's nodes
  steps.forEach((s) => {
    const ns = s.nodes.map((id) => byId[id]);
    s.fx = ns.reduce((a, n) => a + n.cx, 0) / ns.length;
    s.fy = ns.reduce((a, n) => a + n.cy, 0) / ns.length;
  });
  function camera(t) {
    if (!PROFILE.camera) return;
    const zIn = ease(seg(t, INTRO - 0.4, INTRO + 0.8)), zOut = ease(seg(t, STEPS_END, STEPS_END + 1.2));
    const z = 1 + PROFILE.camera * zIn * (1 - zOut);
    let fx = FULLW / 2, fy = FULLH / 2;
    const k = steps.findIndex((s) => t < s.t1);
    const cur = steps[k < 0 ? steps.length - 1 : k];
    const prev = steps[Math.max(0, cur.k - 1)];
    const p = ease(seg(t, cur.t0, cur.t0 + 0.8));
    fx = lerp(prev.fx, cur.fx, p); fy = lerp(prev.fy, cur.fy, p);
    // move halfway toward the focus, and never past the diagram's own edges
    let vx = lerp(FULLW / 2, fx, 0.6), vy = lerp(FULLH / 2, fy, 0.6);
    const hw = FULLW / (2 * z), hh = FULLH / (2 * z);
    vx = clamp(vx, hw, FULLW - hw); vy = clamp(vy, hh, FULLH - hh);
    CAM.style.transform = `translate(${FULLW / 2}px, ${FULLH / 2}px) scale(${z}) translate(${-vx}px, ${-vy}px)`;
  }

  // ---------- render(t) ----------
  function render(t) {
    const pAll = ease(seg(t, INTRO, STEPS_END));
    const cur = steps.find((s) => t >= s.t0 && t < s.t1) || (t >= STEPS_END ? steps[steps.length - 1] : null);
    STAGE.style.setProperty('--intro', ease(seg(t, 0, 1.1)).toFixed(3));
    STAGE.style.setProperty('--beat', beatEnv(t).toFixed(3));
    STAGE.style.setProperty('--pall', pAll.toFixed(3));
    STAGE.style.setProperty('--outro', ease(seg(t, STEPS_END, STEPS_END + 0.8)).toFixed(3));
    STAGE.classList.toggle('is-finished', t >= STEPS_END);
    if (PROFILE.typeTitle && TITLE) TITLE.textContent = TITLE_TEXT.slice(0, Math.round(seg(t, 0.15, 1.2) * TITLE_TEXT.length));
    if (SUMMARY && STYLE === 'product') SUMMARY.textContent = SUMMARY_TEXT.slice(0, Math.round(seg(t, 0.5, 2.0) * SUMMARY_TEXT.length));
    camera(t);

    nodes.forEach((n, i) => {
      const appear = ease(seg(t, 0.3 + (i / nodes.length) * 0.9, 0.75 + (i / nodes.length) * 0.9));
      const active = t >= n.ta && t < n.td, done = t >= n.td;
      const p = seg(t, n.ta, n.td);
      const pulse = active ? 0.5 + 0.5 * Math.sin((t - n.ta) * 6) : 0;
      const pop = ease(seg(t, n.ta, n.ta + 0.18)) - ease(seg(t, n.ta + 0.18, n.ta + 0.55));
      n.el.style.opacity = appear;
      n.el.style.transform = `translateY(${(1 - appear) * 14}px) scale(${1 + pop * 0.05})`;
      n.el.classList.toggle('is-active', active);
      n.el.classList.toggle('is-done', done);
      n.el.style.setProperty('--p', done ? 1 : p.toFixed(3));
      n.el.style.setProperty('--pulse', pulse.toFixed(3));
      n.barEl.style.width = (done ? 100 : p * 100).toFixed(1) + '%';
      n.statusEl.textContent = done ? 'done' : active ? 'running' : 'waiting';
      const q = seg(t, n.ta, n.ta + 0.7);
      n.rippleEl.style.opacity = q > 0 && q < 1 ? (1 - q).toFixed(3) : 0;
      n.rippleEl.style.transform = `scale(${1 + 0.18 * ease(q)})`;
    });

    let walker = null;
    edges.forEach((e) => {
      const p = ease(seg(t, e.t0, e.t1));
      const appear = seg(t, 0.8, 1.4);
      e.base.style.opacity = appear;
      e.draw.style.strokeDashoffset = (e.len * (1 - p)).toFixed(1);
      e.draw.style.opacity = p > 0 ? 1 : 0;
      e.draw.setAttribute('marker-end', p > 0.97 ? 'url(#arrow-live)' : '');
      e.base.setAttribute('marker-end', p > 0.97 ? '' : 'url(#arrow-base)');
      if (e.lab) e.lab.style.opacity = Math.max(appear * 0.55, seg(t, e.t0 + 0.2, e.t1));
      if (e.flow) {
        e.flow.style.opacity = p >= 1 ? 1 : 0;
        e.flow.style.strokeDashoffset = (-(t * 38) % 1000).toFixed(1);
      }
      if (p > 0 && p < 1 && !walker) walker = e.draw.getPointAtLength(p * e.len);
      e.tokens.forEach((tok, j) => {
        let q = null;
        if (p > 0 && p < 1) q = clamp(p - j * 0.06);
        else if (p >= 1 && PROFILE.flow === 'particles') q = ((t - e.t1) * 0.45 + j / e.tokens.length) % 1;
        if (q == null) { tok.style.opacity = 0; return; }
        const pt = e.draw.getPointAtLength(q * e.len);
        tok.style.opacity = p >= 1 ? 0.75 : 1 - j * 0.3;
        if (tok.tagName === 'circle') { tok.setAttribute('cx', pt.x); tok.setAttribute('cy', pt.y); }
        else { tok.setAttribute('x', pt.x - 5); tok.setAttribute('y', pt.y - 5); }
      });
    });
    if (MASCOT) {
      let x, y;
      if (walker) { x = walker.x; y = walker.y; }
      else {
        const n = byId[(cur || steps[0]).nodes[0]];
        x = n.x + n.w - 26; y = n.y + 2;
      }
      const bob = Math.abs(Math.sin(t * 9)) * 3;
      MASCOT.setAttribute('transform', `translate(${x.toFixed(1)}, ${(y - bob).toFixed(1)})`);
      MASCOT.style.opacity = seg(t, 0.8, 1.3);
    }

    steps.forEach((s) => {
      const on = cur === s, past = t >= s.t1;
      if (s.taskEl) {
        s.taskEl.classList.toggle('is-on', on);
        s.taskEl.classList.toggle('is-past', past && !on);
        const marks = PROFILE.marks || ['○', '◐', '●'];
        s.markEl.textContent = past || (on && t >= STEPS_END) ? marks[2] : on ? marks[1] : marks[0];
      }
      if (!s.capEl) return;
      s.capEl.classList.toggle('is-on', on);
      s.capEl.classList.toggle('is-past', past && !on);
      if (s.hl) s.hl.style.backgroundSize = `${(seg(t, s.t0, s.t0 + Math.min(1.4, s.dur * 0.6)) * 100).toFixed(1)}% 100%`;
      if (s.typeEl) {
        const n = Math.round(seg(t, s.t0, s.t0 + Math.min(1.6, s.dur * 0.6)) * s.full.length);
        s.typeEl.textContent = s.full.slice(0, n);
        s.capEl.style.display = t >= s.t0 ? '' : 'none';
      }
      if (s.rows) s.rows.forEach(({ n, row, st }, j) => {
        const show = ease(seg(t, s.t0 + 0.15 + j * 0.12, s.t0 + 0.45 + j * 0.12));
        row.style.opacity = show.toFixed(3);
        row.style.transform = `translateX(${((1 - show) * 18).toFixed(1)}px)`;
        const done = t >= n.td, active = t >= n.ta && !done;
        row.classList.toggle('is-active', active); row.classList.toggle('is-done', done);
        st.textContent = done ? '✓ done' : active ? 'running' : 'queued';
        row.style.setProperty('--p', (done ? 1 : seg(t, n.ta, n.td)).toFixed(3));
      });
      if (PROFILE.captions === 'card' || PROFILE.captions === 'panel') {
        const fin = seg(t, s.t0, s.t0 + 0.35), fout = s.k === steps.length - 1 ? 0 : seg(t, s.t1 - 0.3, s.t1);
        s.capEl.style.opacity = (fin * (1 - fout)).toFixed(3);
        s.capEl.style.transform = `translateY(${((1 - fin) * 16).toFixed(1)}px)`;
      }
    });

    stats.forEach((s) => {
      if (!s.numEl) return;
      const v = (+s.value || 0) * pAll;
      s.numEl.textContent = (s.dec ? v.toFixed(s.dec) : Math.round(v).toLocaleString('en-US')) + (s.unit || '');
    });
    if (PROG) PROG.style.width = (seg(t, INTRO, STEPS_END) * 100).toFixed(2) + '%';
    if (STEPNO) STEPNO.textContent = `${pad2(cur ? cur.k + 1 : 0)} / ${pad2(steps.length)}`;
    if (CURSOR) CURSOR.style.opacity = Math.floor(t * 2) % 2 ? 0 : 1;
  }

  window.__duration = TOTAL;
  window.__render = render;
  window.__layout = layoutName;

  // ---------- preview driver ----------
  const params = new URLSearchParams(location.search);
  if (params.has('record')) { render(0); window.__ready = true; return; }
  const fit = () => {
    const s = Math.min(innerWidth / STAGE.offsetWidth, innerHeight / STAGE.offsetHeight, 1);
    STAGE.style.transform = `scale(${s})`; STAGE.style.transformOrigin = 'top left';
  };
  fit(); addEventListener('resize', fit);
  if (params.has('t')) { render(+params.get('t')); window.__ready = true; return; }
  let start = performance.now(), paused = false, pausedAt = 0;
  document.addEventListener('click', () => {
    paused = !paused;
    if (paused) pausedAt = performance.now(); else start += performance.now() - pausedAt;
  });
  const loop = (now) => {
    if (!paused) render(((now - start) / 1000) % (TOTAL + 0.6));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.__ready = true;
})();
