// Set the correct scrolly phase before first paint to prevent a flash on mid-page reload.
(function () {
  if (window.innerWidth <= 900) return;
  function run() {
    var scrolly = document.getElementById("scrolly");
    if (!scrolly) return;
    var inner = scrolly.querySelector(".scrolly-sticky-inner");
    if (!inner) return;
    var tracks = scrolly.querySelectorAll(".scrolly-track");
    if (!tracks.length) return;
    var sectionTop = scrolly.getBoundingClientRect().top + window.scrollY;
    var relScroll = window.scrollY - sectionTop;
    var vh = window.innerHeight;
    var current = tracks[0];
    for (var i = 0; i < tracks.length; i++) {
      if (relScroll >= tracks[i].offsetTop - vh * 0.5) current = tracks[i];
    }
    var phase = current.getAttribute("data-scrolly-phase");
    if (phase) inner.setAttribute("data-phase", phase);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
}());

// Interactive radial “constellation” showing cultural objects/messages
// sent toward space. The visualization has three interaction modes that share
// the same underlying data:
// - Overview (radial): rings are "types", wedges are decades.
// - Ring filter (legend): dims other rings but keeps spatial layout stable.
// - Decade drill-down: transitions stars into a chronological, left-to-right view.


(function () {
'use strict';

const NS = 'http://www.w3.org/2000/svg';
const IS_MOBILE = () => window.innerWidth <= 900;

const CATEGORIES = [
  { key: 'Passive METI Initiatives',                             label: 'Passive METI' },
  { key: 'Space Mission Outreach (Transmissions to Probes)',     label: 'Space mission outreach' },
  { key: 'Cultural Expression and Advertisement Messages',       label: 'Cultural & advertisement messages' },
  { key: 'Outreach Educational and Symbolic Transmissions',      label: 'Educational & symbolic transmissions' },
  { key: 'METI Interstellar Radio Messages',                     label: 'METI interstellar radio messages' },
  { key: 'Space Mission Publicity and Outreach Initiatives',     label: 'Space mission publicity & outreach' },
  { key: 'Human Time Capsules and External Memory Initiatives',  label: 'Time capsules & external memory' },
  { key: 'Send Your Name into Space Initiatives',                label: 'Send your name into space' },
  { key: 'Space Race Pseudo-Colonial Deposits',                  label: 'Space race deposits' },
  { key: 'Short-Range Commercial Transmissions',                 label: 'Short-range commercial transmissions' },
];

const DECADES      = ['1960s','1970s','1980s','1990s','2000s','2010s','2020s'];
const DECADE_COUNT = 7;

const NOTABLES = {
  '1':   'Arecibo Message',
  '15':  'Morse Message',
  '35':  'Doritos Advertisement',
  '117': 'Pioneer Plaques',
  '118': 'Voyager Golden Record',
  '164': 'IKAROS',
  '2': 'Message to Altair',
  '205': 'Family Photograph',
  '142': 'Galileo Plaque and Lego Figurines'
};

const DEFAULT_OPEN_ID = null;

const BASE_R           = 60;
const RING_GAP         = 44;
const GOLD             = '#c4a44a';
const STAR_HI          = 'rgba(255,255,255,0.90)'; // bright stars — foreground
const STAR_MID         = 'rgba(255,255,255,0.58)'; // mid stars
const STAR_LO          = 'rgba(255,255,255,0.28)'; // dim stars — background
const STAR_COLOR       = STAR_HI; // legacy alias used in mobile/filter views
const STAR_DIM         = 'rgba(255,255,255,0.05)'; // dimmed when ring filtered
const FILTER_ID        = 'star-rough';
const SPARKLE_SIZE     = 7;
const SPARKLE_SIZE_SEL = 11;

// Clear contrast hierarchy — each tier meaningfully separated
const C_STRUCT  = 'rgba(218,195,158,0.3)'; // arcs: warm, very recessive
const C_DIVIDER = 'rgba(210,185,145,0.4)'; // decade dividers: warm dashes
const C_DECADE  = 'rgba(218,228,238,0.9)'; // decade labels: prominent
const C_NOTABLE = 'rgba(228,238,248,0.62)'; // notable object inline labels

// View state
//
// - `selectedRing` drives legend filtering (purely visual: dim/brighten).
// - `filterView` switches between the radial overview and decade drill-down.
// - `selectedId` controls the inline “object card” (preview/expanded).
let DATA           = [];
let selectedId     = null;
let inlineCard     = null;
let filterView     = null; // { type: 'ring'|'decade', idx: number }
let selectedRing   = null; // which ring is filtered via legend
/** Mobile list UI: accordion groups by transmission type or by decade. */
let mobileBrowseBy     = 'type'; // 'type' | 'decade'
let mobileOpenGroupKey = null;  // e.g. 't-2' | 'd-4' — keeps <details> open across re-renders

// Indexes (rebuilt whenever DATA is reprocessed)
//
// Why: many interaction handlers run inside `mousemove`/hover loops and used to
// do repeated `DATA.find(...)` linear scans. A simple Map keeps interactions
// responsive without changing any behavior.
let _objById = new Map(); // String(id) -> object

function rebuildIndexes() {
  _objById = new Map(DATA.map(o => [String(o.id), o]));
}

function getObjById(id) {
  return _objById.get(String(id)) || null;
}

/** Hide CTA text but keep its box — layout (filter column) stays fixed vs overview. */
function hideTtsVizHint(el) {
  if (!el) return;
  el.style.visibility = 'hidden';
  el.style.pointerEvents = 'none';
  el.setAttribute('aria-hidden', 'true');
}

function showTtsVizHint(el) {
  if (!el) return;
  el.style.removeProperty('visibility');
  el.style.removeProperty('pointer-events');
  el.removeAttribute('aria-hidden');
}

// ── LEGEND ────────────────────────────────────────────────────────────────

function buildLegend() {
  const panel = document.getElementById('legend-panel');
  if (!panel || panel.querySelector('.leg-row')) return; // already built

  // CATEGORIES are inner→outer in array (index 0 = innermost ring).
  // Legend order: outer→inner top-to-bottom so legend row traces arc order.
  const reversed = [...CATEGORIES].reverse();

  reversed.forEach((cat, i) => {
    const realIdx = CATEGORIES.length - 1 - i; // maps back to ring index

    const row = document.createElement('div');
    row.className = 'leg-row';
    row.dataset.ring = realIdx;

    // Mini arc SVG icon
    const arcSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arcSvg.setAttribute('width', '24');
    arcSvg.setAttribute('height', '16');
    arcSvg.setAttribute('viewBox', '0 0 24 16');
    arcSvg.classList.add('leg-arc');
    const ap = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ap.setAttribute('d', 'M 2,14 A 10,10 0 0,1 22,14');
    ap.setAttribute('fill', 'none');
    ap.setAttribute('stroke', 'rgba(200,215,228,0.42)');
    ap.setAttribute('stroke-width', '1.3');
    ap.setAttribute('stroke-linecap', 'butt');
    arcSvg.appendChild(ap);
    row.appendChild(arcSvg);

    const lbl = document.createElement('span');
    lbl.className = 'leg-label';
    // Use label exactly as defined
    lbl.textContent = cat.label;
    row.appendChild(lbl);

    lbl.addEventListener('mouseenter', () => {
      row.classList.add('leg-hover');
      const svg = document.getElementById('star-svg');
      if (svg) {
        svg.querySelectorAll('[data-dot-ring]').forEach(el => {
          const ringIdx = parseInt(el.dataset.dotRing);
          if (ringIdx === realIdx) {
            // Brighten matching ring
            el.querySelectorAll('.star-sparkle').forEach(s => {
              s.style.fill = 'rgba(255,255,255,0.98)';
            });
          } else {
            // Dim non-matching rings
            el.querySelectorAll('.star-sparkle').forEach(s => {
              s.style.fill = 'rgba(255,255,255,0.15)';
            });
          }
        });
        // Hide notable labels that are NOT in this ring
        svg.querySelectorAll('.notable-default-label').forEach(lbl => {
          const id  = lbl.getAttribute('data-static-id');
          const obj = getObjById(id);
          lbl.style.opacity = (obj && obj._ringIdx === realIdx) ? '1' : '0';
          lbl.style.transition = 'opacity 0.15s ease-out';
        });
      }
    });

    lbl.addEventListener('mouseleave', () => {
      row.classList.remove('leg-hover');
      const svg = document.getElementById('star-svg');
      if (svg) {
        svg.querySelectorAll('[data-dot-ring]').forEach(el => {
          const ringIdx = parseInt(el.dataset.dotRing);
          el.querySelectorAll('.star-sparkle').forEach(s => {
            const objId = s.getAttribute('data-id');
            const obj = getObjById(objId);
            if (obj) {
              const isSelected = String(obj.id) === String(selectedId);
              const fill = isSelected ? GOLD
                : (selectedRing !== null && selectedRing !== ringIdx) ? STAR_DIM
                : STAR_COLOR;
              s.style.fill = fill;
            }
          });
        });
        // Restore notable labels visibility based on selectedRing state
        svg.querySelectorAll('.notable-default-label').forEach(lbl => {
          if (selectedRing !== null) {
            const id  = lbl.getAttribute('data-static-id');
            const obj = getObjById(id);
            lbl.style.opacity = (obj && obj._ringIdx === selectedRing) ? '' : '0';
          } else {
            lbl.style.opacity = '';
          }
          lbl.style.transition = '';
        });
      }
    });

    lbl.addEventListener('click', (e) => {
      e.stopPropagation();
      const was = selectedRing === realIdx;
      // Switch directly to new ring without intermediate deselect render
      selectedRing = was ? null : realIdx;
      updateLegendState();
      // Single render call — no intermediate state
      render();
    });

    panel.appendChild(row);
  });
  
  // Click anywhere outside to deactivate ring filter
  document.addEventListener('click', (e) => {
    if (selectedRing === null) return;
    const dot = e.target.closest('[data-dot-ring]');
    if (dot && parseInt(dot.dataset.dotRing) === selectedRing) return;
    // Let legend row clicks handle their own state
    if (e.target.closest('.leg-row')) return;
    selectedRing = null;
    // Force-clear all legend visual states synchronously
    document.querySelectorAll('.leg-row').forEach(r =>
      r.classList.remove('leg-active', 'leg-dimmed', 'leg-hover')
    );
    render();
  });
}

function updateLegendState() {
  document.querySelectorAll('.leg-row').forEach(row => {
    const ri = parseInt(row.dataset.ring);
    row.classList.remove('leg-active', 'leg-dimmed');
    if (selectedRing !== null) {
      if (ri === selectedRing) row.classList.add('leg-active');
      else row.classList.add('leg-dimmed');
    }
  });
}

function sparklePath(cx, cy, r) {
  const inner = r * 0.38;
  const pts   = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const len   = i % 2 === 0 ? r : inner;
    pts.push(`${(cx + Math.cos(angle) * len).toFixed(2)},${(cy + Math.sin(angle) * len).toFixed(2)}`);
  }
  return `M${pts[0]} L${pts.join(' L')} Z`;
}

// ── UTILITIES ──────────────────────────────────────────────────────────────

function parseYear(obj) {
  if (obj.year) return obj.year;
  for (const f of ['transmitted', 'date']) {
    const m = String(obj[f] || '').match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    if (m) return parseInt(m[1]);
  }
  return null;
}

function yearToDecadeIdx(y) {
  if (!y)        return null;
  if (y >= 2020) return 6;
  if (y >= 2010) return 5;
  if (y >= 2000) return 4;
  if (y >= 1990) return 3;
  if (y >= 1980) return 2;
  if (y >= 1970) return 1;
  if (y >= 1960) return 0;
  return null;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function svgEl(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  if (parent) parent.appendChild(e);
  return e;
}

function ensureFilter(svg) {
  if (svg.querySelector(`#${FILTER_ID}`)) return;
  const defs   = svgEl('defs', {}, svg);
  const filter = svgEl('filter', { id: FILTER_ID, x: '0%', y: '0%', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' }, defs);
  svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '1.5', numOctaves: '4', stitchTiles: 'stitch', result: 'n' }, filter);
  svgEl('feColorMatrix', { in: 'n', type: 'saturate', values: '0', result: 'gn' }, filter);
  svgEl('feBlend', { in: 'SourceGraphic', in2: 'gn', mode: 'soft-light', result: 'b' }, filter);
  svgEl('feComposite', { in: 'b', in2: 'SourceGraphic', operator: 'in' }, filter);
}

// Mobile star rail: one dashed line per row, vertically centered with that row’s stars.
const MOB_STAR_RAIL_W = 11;
const MOB_STAR_RAIL_GAP_X = 9;

function layoutMobStarRail(rail, count) {
  rail.replaceChildren();
  if (count <= 0) return;
  const w = rail.getBoundingClientRect().width;
  const perRow = Math.max(
    1,
    Math.floor((w + MOB_STAR_RAIL_GAP_X) / (MOB_STAR_RAIL_W + MOB_STAR_RAIL_GAP_X)),
  );
  for (let idx = 0; idx < count; ) {
    const row = document.createElement('div');
    row.className = 'mob-star-row';
    const line = document.createElement('div');
    line.className = 'mob-star-rail-line';
    line.setAttribute('aria-hidden', 'true');
    const strip = document.createElement('div');
    strip.className = 'mob-star-strip';
    const end = Math.min(idx + perRow, count);
    for (let i = idx; i < end; i++) {
      const s = document.createElement('span');
      s.className = 'mob-sparkle';
      strip.appendChild(s);
    }
    row.appendChild(line);
    row.appendChild(strip);
    rail.appendChild(row);
    idx = end;
  }
}

/** Warm dashed “rail” + one sparkle per item, matching desktop chart language. */
function appendMobStarRail(hostEl, count) {
  const rail = document.createElement('div');
  rail.className = 'mob-star-rail';
  hostEl.appendChild(rail);
  const run = () => layoutMobStarRail(rail, count);
  const ro = new ResizeObserver(run);
  ro.observe(rail);
  requestAnimationFrame(() => requestAnimationFrame(run));
}

// ── DECADE DRILL-DOWN VIEW ────────────────────────────────────────────────

function showFilterView(type, idx) {
  if (type !== 'decade') return; // only decade drill-down
  if (IS_MOBILE()) return;

  // ── CAPTURE old star positions before we clear the SVG ──────────────────
  // Why: the drill-down view is a different layout. We record the *screen*
  // position of each star in the overview so we can animate it into the new
  // constellation coordinates, which makes the transition feel continuous.
  const svg = document.getElementById('star-svg');
  const svgRect = svg.getBoundingClientRect();
  const viewBox  = svg.getAttribute('viewBox').split(' ').map(Number);
  const scaleX   = svgRect.width  / viewBox[2];
  const scaleY   = svgRect.height / viewBox[3];

  // For each star in this decade, record its current viewport position
  // (in SVG coordinate space so we can use transform offsets)
  const oldPositions = {}; // id → { svgX, svgY }
  DATA.forEach(obj => {
    if (obj._decIdx !== idx) return;
    if (obj._cx == null || obj._cy == null) return;
    // Convert SVG coords to viewport coords
    const vpX = svgRect.left + obj._cx * scaleX;
    const vpY = svgRect.top  + obj._cy * scaleY;
    oldPositions[String(obj.id)] = { vpX, vpY };
  });

  filterView = { type, idx };
  selectedId = null;
  closeInlineCard();
  renderFilterView(oldPositions);  // pass captured positions for animation
}

function renderFilterView(oldPositions) {
  // Orchestrates the decade drill-down:
  // - updates hero title; CTA unchanged; back moves into #decade-toolbar (above chart when shown)
  // - `viz-main--decade-full` is applied only in _doRenderFilterView so the overview SVG is not
  //   reflowed at the wider width before the decade layout replaces it (avoids the “stretch” flash)
  // - fades out the radial view’s non-decade elements
  // - renders a new SVG layout and animates stars from captured old positions
  if (!filterView) return;
  const { idx } = filterView;
  const decadeLabel = DECADES[idx];
  const objects = DATA.filter(o => o._decIdx === idx);

  // ── UPDATE PAGE HEADER ──────────────────────────────────────────────────
  const h1 = document.getElementById('page-title');
  const intro   = document.getElementById('page-intro');
  const vizHint = document.getElementById('viz-hint');

  const decadeTitle = 'Talking to space: ' + decadeLabel;
  if (h1) h1.textContent = decadeTitle;
  const decadeHeading = document.getElementById('decade-heading');
  if (decadeHeading) {
    decadeHeading.textContent = decadeTitle;
    decadeHeading.setAttribute('hidden', '');
  }
  const toolbarTitle = document.getElementById('decade-toolbar-title');
  if (toolbarTitle) toolbarTitle.textContent = decadeLabel;
  if (intro) intro.style.display = 'none';

  const toolbar = document.getElementById('decade-toolbar');
  let backEl = document.getElementById('decade-back-link');
  if (!backEl) {
    backEl = document.createElement('span');
    backEl.id = 'decade-back-link';
    backEl.className = 'back-link visible';
  }
  if (toolbar) toolbar.appendChild(backEl);
  else {
    const backSlot = document.querySelector('.sidebar-back-slot');
    if (backSlot) backSlot.appendChild(backEl);
    else if (intro) intro.after(backEl);
  }
  backEl.textContent = '← all decades';
  backEl.style.display = 'block'; // block so it sits on its own line
  backEl.onclick = () => {
    const svg = document.getElementById('star-svg');
    
    // Fade out current view smoothly
    svg.style.transition = 'opacity 0.18s ease-out';
    svg.style.opacity = '0';
    
    // After fade, clear and render new view
    setTimeout(() => {
      filterView = null;
      selectedId = null;
      closeInlineCard();
      if (h1) h1.textContent = 'Talking to space';
      const decadeHd = document.getElementById('decade-heading');
      if (decadeHd) decadeHd.setAttribute('hidden', '');
      const toolbarR = document.getElementById('decade-toolbar');
      if (toolbarR) toolbarR.setAttribute('hidden', '');
      const toolbarTitleR = document.getElementById('decade-toolbar-title');
      if (toolbarTitleR) toolbarTitleR.textContent = '';
      backEl.style.display = 'none';
      const introR = document.getElementById('page-intro');
      if (introR) introR.style.display = '';
      const mainR = document.querySelector('.viz-main');
      if (mainR) mainR.classList.remove('viz-main--decade-full');
      const legR = document.getElementById('legend-panel');
      if (legR) legR.style.removeProperty('display');
      const slotR = document.querySelector('.sidebar-back-slot');
      if (backEl && slotR) slotR.appendChild(backEl);
      else if (backEl && introR) introR.after(backEl);

      svg.innerHTML = '';
      ensureFilter(svg);
      svg.style.opacity = '1';
      svg.style.transition = 'opacity 0.18s ease-out';
      
      render();
    }, 180);
  };

  // ── CONSTELLATION SVG ───────────────────────────────────────────────────
  const svgEl_ = document.getElementById('star-svg');

  // Fade out non-decade elements briefly before clearing
  if (oldPositions && Object.keys(oldPositions).length > 0) {
    svgEl_.querySelectorAll('[data-dot-dec]').forEach(el => {
      if (el.dataset.dotDec !== String(idx)) {
        el.style.transition = 'opacity 0.2s ease-out'; el.style.opacity = '0';
      }
    });
    svgEl_.querySelectorAll('[data-ring], .decade-label, .type-label-hit').forEach(el => {
      el.style.transition = 'opacity 0.2s ease-out'; el.style.opacity = '0';
    });
  }

  const FADE_DELAY = (oldPositions && Object.keys(oldPositions).length > 0) ? 180 : 0;
  const _sorted = [...objects].sort((a, b) => (a._year || 0) - (b._year || 0));
  setTimeout(() => _doRenderFilterView(idx, objects, _sorted, oldPositions), FADE_DELAY);
}

function _doRenderFilterView(idx, objects, sortedObjects, oldPositions) {
  const mainEl = document.querySelector('.viz-main');
  if (mainEl) mainEl.classList.add('viz-main--decade-full');
  const toolbar = document.getElementById('decade-toolbar');
  if (toolbar) toolbar.removeAttribute('hidden');

  const svg = document.getElementById('star-svg');
  svg.innerHTML = '';
  ensureFilter(svg);

  // Decade view: reset any absolute positioning
  svg.style.position = '';
  svg.style.top = '';
  svg.style.left = '';
  svg.style.right = '';
  svg.style.width = '';
  svg.style.marginLeft = '0';

  const mob = IS_MOBILE();
  const chartElF = document.getElementById('chart-inner');
  const stageEl = document.querySelector('.viz-stage');
  const W = chartElF ? chartElF.offsetWidth : (mob ? window.innerWidth - 40 : window.innerWidth - 520);
  // Toolbar just became visible — flush layout so chart top is measured correctly
  void document.getElementById('decade-toolbar')?.offsetHeight;
  void chartElF?.offsetHeight;
  const vv = window.visualViewport;
  const vh = Math.round(vv && vv.height ? vv.height : window.innerHeight);
  const measureEl = chartElF || stageEl;
  const chartTop = measureEl ? Math.round(measureEl.getBoundingClientRect().top) : 0;
  const BOTTOM_SAFE = 28;
  const spaceBelow = vh - chartTop - BOTTOM_SAFE;
  const minDecadeH = mob ? 220 : 200;
  const maxOneScreen = Math.max(minDecadeH, vh - 32);
  const H = Math.max(minDecadeH, Math.min(spaceBelow, maxOneScreen));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);

  const SR      = SPARKLE_SIZE * (mob ? 2.1 : 1.8);
  const SR_SEL  = SPARKLE_SIZE * (mob ? 2.8 : 2.6);
  const R_MAX   = Math.max(SR, SR_SEL);

  // ── CHRONOLOGICAL LEFT-TO-RIGHT LAYOUT ──────────────────────────────────
  let sorted = sortedObjects;

  const decadeStart = 1960 + idx * 10;
  
  // For 2020s (idx=6), only show years 2020-2026
  if (idx === 6) {
    sorted = sorted.filter(obj => {
      const yr = obj._year || decadeStart;
      return yr >= 2020 && yr <= 2026;
    });
  }

  // Estimate worst-case label half-width (7px/char at 11px mono)
  const AVG_CHAR_W = 7;
  const MAX_LABEL  = sorted.reduce((m, o) => Math.max(m, (o._notable || o._displayTitle || '').length), 0);
  const LABEL_HALF = (MAX_LABEL * AVG_CHAR_W) / 2;

  // Desktop: wide chart (no sidebar) — moderate horizontal inset for labels vs viewport edge
  const PAD_X         = mob ? 14 : 88;
  const AXIS_PAD      = mob ? 18 : 108;
  const AXIS_H        = 36; // height reserved at bottom for timeline axis
  const PAD_BOT_SVG   = AXIS_H + 16;
  const PAD_TOP_SVG   = 18; // small inset from SVG top
  // Reserve space above star centres so mono labels (up to 2 lines) are not clipped
  const LABEL_ABOVE   = 48;
  const minStarCy     = PAD_TOP_SVG + LABEL_ABOVE + R_MAX;
  const maxStarCy     = H - PAD_BOT_SVG - R_MAX;
  const usableW       = W - PAD_X * 2;
  const usableH       = Math.max(100, maxStarCy - minStarCy);

  // Guaranteed minimum separation between star centres
  const MIN_DIST = SR * 5.2 + 16;

  // ── COLUMN ASSIGNMENT ────────────────────────────────────────────────────
  // Group objects into year columns; each column gets a guaranteed X position.
  // Within a column, objects are stacked vertically with MIN_DIST spacing.
  // If a year has too many objects to fit vertically, use a second row to the right.
  const yearMap = {};
  sorted.forEach(obj => {
    const yr = obj._year || decadeStart;
    if (!yearMap[yr]) yearMap[yr] = [];
    yearMap[yr].push(obj);
  });

  const positions = [];

  // For each unique year, compute column X and stack objects vertically (with multi-row support)
  const uniqueYears = Object.keys(yearMap).map(Number).sort((a, b) => a - b);
  uniqueYears.forEach(yr => {
    const t  = Math.max(0, Math.min(1, (yr - decadeStart) / 9));
    // Align stars with axis using AXIS_PAD
    const axisW = W - AXIS_PAD * 2;
    const cx = AXIS_PAD + t * axisW;

    const objs = yearMap[yr];
    const maxPerColumn = Math.floor((usableH - 20) / MIN_DIST);
    const columnCount = Math.ceil(objs.length / maxPerColumn);
    
    // Vertical center of the year group
    function hash(obj, seed) {
      const h = String(obj.id).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, seed);
      return ((h >>> 0) % 1000) / 1000;
    }
    const centerY = minStarCy + hash(objs[0], 31) * usableH * 0.72 + usableH * 0.12;

    objs.forEach((obj, i) => {
      // Which column (row) this object belongs to
      const col = Math.floor(i / maxPerColumn);
      const posInCol = i % maxPerColumn;
      
      // Offset from center for this position within the column
      const colH = Math.min(objs.length, maxPerColumn) * MIN_DIST;
      const offsetY = (posInCol - (Math.min(objs.length, maxPerColumn) - 1) / 2) * MIN_DIST;
      
      // X offset for multi-row: shift right for additional rows
      const offsetX = col * (MIN_DIST * 1.2);
      
      const cx_final = Math.min(cx + offsetX, W - PAD_X - SR);
      const cy = Math.max(minStarCy, Math.min(maxStarCy, centerY + offsetY));
      
      positions.push({ cx: cx_final, cy, obj });
      obj._cx = cx_final;
      obj._cy = cy;
    });
  });

  // ── POST-PASS: nudge any remaining overlaps ──────────────────────────────
  // Run a few rounds of repulsion to resolve cross-column overlaps
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i], b = positions[j];
        const dx = b.cx - a.cx, dy = b.cy - a.cy;
        const d  = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < MIN_DIST) {
          const push = (MIN_DIST - d) / d * 0.5;
          // Push vertically to preserve X chronological order
          const py = dy * push * 0.9;
          const px = dx * push * 0.1;
          a.cy = Math.max(minStarCy, Math.min(maxStarCy, a.cy - py));
          b.cy = Math.max(minStarCy, Math.min(maxStarCy, b.cy + py));
          a.cx = Math.max(PAD_X, Math.min(W - PAD_X, a.cx - px));
          b.cx = Math.max(PAD_X, Math.min(W - PAD_X, b.cx + px));
          a.obj._cx = a.cx; a.obj._cy = a.cy;
          b.obj._cx = b.cx; b.obj._cy = b.cy;
        }
      }
    }
  }

  // ── TIMELINE AXIS ────────────────────────────────────────────────────────
  const axisY = H - AXIS_H + 8;

  // Axis base line
  svgEl('line', {
    x1: AXIS_PAD, y1: axisY,
    x2: W - AXIS_PAD, y2: axisY,
    stroke: 'rgba(210,185,145,0.18)',
    'stroke-width': '1',
  }, svg);

  // Determine the range of years to display on the axis
  let yearAxisStart = decadeStart;
  let yearAxisEnd = decadeStart + 9;
  
  if (idx === 6) {
    // For 2020s, only show 2020-2026
    yearAxisStart = 2020;
    yearAxisEnd = 2026;
  }

  // Year ticks and labels for each year in the display range
  for (let yr = yearAxisStart; yr <= yearAxisEnd; yr++) {
    const t  = (yr - decadeStart) / 9;
    // Use AXIS_PAD for axis positioning instead of PAD_X
    const axisW = W - AXIS_PAD * 2;
    const tx = AXIS_PAD + t * axisW;

    // Dashed vertical line from top of SVG straight to axis
    svgEl('line', {
      x1: tx, y1: PAD_TOP_SVG,
      x2: tx, y2: axisY - 3,
      stroke: 'rgba(210,185,145,0.22)',
      'stroke-width': '1',
      'stroke-dasharray': '4,6',
    }, svg);

    // Tick mark
    svgEl('line', {
      x1: tx, y1: axisY - 3,
      x2: tx, y2: axisY + 3,
      stroke: 'rgba(210,185,145,0.22)',
      'stroke-width': '1',
    }, svg);

    // Year label
    svgEl('text', {
      x: tx, y: axisY + 15,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-family': "'Geist Mono', monospace",
      'font-size': '11', 'font-weight': '400',
      'letter-spacing': '0.04em',
      fill: 'rgba(218,195,158,0.55)',
      style: 'user-select: none;',
    }, svg).textContent = String(yr);
  }

  const objectLabelsG = svgEl('g', { 'pointer-events': 'none' }, svg);

  positions.forEach(({ cx, cy, obj }) => {
    const isSelected = String(obj.id) === String(selectedId);
    const sparkleR   = isSelected ? SR_SEL : SR;
    const fill       = isSelected ? GOLD : STAR_COLOR;

    const dotGrp = svgEl('g', { 'data-filter-star': obj.id }, svg);
    const sparkle = svgEl('path', {
      d: sparklePath(cx, cy, sparkleR),
      fill,
      filter: `url(#${FILTER_ID})`,
      'data-id': obj.id,
      'class': 'star-sparkle',
      style: 'cursor:pointer; transition: fill 0.15s ease-out;',
    }, dotGrp);
    const hit = svgEl('circle', {
      cx, cy, r: Math.max(sparkleR + 12, 22),
      fill: 'transparent', style: 'cursor:pointer;',
    }, dotGrp);

    // Label — wrapping text, max 30ch, up to 2 lines
    const rawLabel = obj._notable || obj._displayTitle;
    const MAX_CH   = 30;
    const LINE_H   = 13; // px between lines
    // Split into up to 2 lines at word boundary
    let line1 = rawLabel, line2 = '';
    if (rawLabel.length > MAX_CH) {
      let split = rawLabel.lastIndexOf(' ', MAX_CH);
      if (split < 1) split = MAX_CH;
      line1 = rawLabel.slice(0, split);
      line2 = rawLabel.slice(split + (rawLabel[split] === ' ' ? 1 : 0));
      if (line2.length > MAX_CH) line2 = line2.slice(0, MAX_CH - 1) + '…';
    }
    const numLines = line2 ? 2 : 1;
    const textTop  = cy - sparkleR - 8 - (numLines - 1) * LINE_H;

    const lbl = svgEl('text', {
      x: cx, y: textTop,
      'text-anchor': 'middle', 'dominant-baseline': 'auto',
      'font-family': "'Geist Mono', monospace",
      'font-size': '11', 'font-weight': '400',
      fill: isSelected ? GOLD : C_NOTABLE,
      'paint-order': 'stroke',
      stroke: 'rgba(14,14,14,0.90)',
      'stroke-width': '1.5',
      'class': 'filter-label',
      'data-filter-id': obj.id,
      style: 'transition: fill 0.15s ease-out, opacity 0.15s ease-out;',
    }, objectLabelsG);

    const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan1.setAttribute('x', cx); tspan1.setAttribute('dy', '0');
    tspan1.textContent = line1;
    lbl.appendChild(tspan1);
    if (line2) {
      const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan2.setAttribute('x', cx); tspan2.setAttribute('dy', String(LINE_H));
      tspan2.textContent = line2;
      lbl.appendChild(tspan2);
    }

    const cleanLabel = obj._notable || obj._displayTitle;
    [sparkle, hit].forEach(t => {
      t.addEventListener('mouseenter', e => {
        // Don't show tooltip if star is dimmed by ring filter
        if (selectedRing !== null && selectedRing !== obj._ringIdx) return;
        if (!inlineCard) showTooltip(e, cleanLabel + (obj._year ? ' (' + obj._year + ')' : ''));
      });
      t.addEventListener('mouseleave', hideTooltip);
      t.addEventListener('mousemove', moveTooltip);
      t.addEventListener('click', () => {
        selectedId = obj.id;
        svg.querySelectorAll('.star-sparkle').forEach(s => {
          const sid = s.getAttribute('data-id');
          s.setAttribute('fill', sid === String(obj.id) ? GOLD : STAR_COLOR);
        });
        svg.querySelectorAll('.filter-label').forEach(l => {
          const lid = l.getAttribute('data-filter-id');
          l.setAttribute('fill', lid === String(obj.id) ? GOLD : 'rgba(240,245,250,0.80)');
          l.style.opacity = lid === String(obj.id) ? '1' : '0';
        });
        hideTooltip();
        showInlineCard(obj);
      });
    });
  });

  // ── HIDE OVERLAPPING LABELS ─────────────────────────────────────────────
  // Check for text label overlaps and hide ones that collide
  // Use a small delay to ensure SVG has finished rendering
  setTimeout(() => {
    const labels = Array.from(svg.querySelectorAll('.filter-label'));
    const hiddenLabelIds = new Set();

    for (let i = 0; i < labels.length; i++) {
      if (hiddenLabelIds.has(labels[i].getAttribute('data-filter-id'))) continue;
      
      const rect1 = labels[i].getBoundingClientRect();
      const x1 = rect1.left, y1 = rect1.top, w1 = rect1.width, h1 = rect1.height;

      for (let j = i + 1; j < labels.length; j++) {
        if (hiddenLabelIds.has(labels[j].getAttribute('data-filter-id'))) continue;
        
        const rect2 = labels[j].getBoundingClientRect();
        const x2 = rect2.left, y2 = rect2.top, w2 = rect2.width, h2 = rect2.height;

        // Check if bounding boxes overlap (with 6px padding)
        const pad = 6;
        if (x1 + w1 + pad > x2 && x2 + w2 + pad > x1 && y1 + h1 + pad > y2 && y2 + h2 + pad > y1) {
          // Overlap detected: hide the second label
          labels[j].style.opacity = '0';
          hiddenLabelIds.add(labels[j].getAttribute('data-filter-id'));
        }
      }
    }
  }, 50);

  svg.appendChild(objectLabelsG);

  // ── ANIMATE STARS FROM OLD POSITIONS ────────────────────────────────────
  // If we have captured old viewport positions, animate each star from where
  // it was in the overview to its new constellation position.
  if (oldPositions && Object.keys(oldPositions).length > 0) {
    const newSvgRect = svg.getBoundingClientRect();
    const newVB      = svg.getAttribute('viewBox').split(' ').map(Number);
    const newScaleX  = newSvgRect.width  / newVB[2];
    const newScaleY  = newSvgRect.height / newVB[3];

    // Fade out everything that's NOT a star (arcs, labels, axis already gone)
    // Animate each star from its old screen position
    svg.querySelectorAll('[data-filter-star]').forEach(grp => {
      const id  = grp.getAttribute('data-filter-star');
      const old = oldPositions[String(id)];
      if (!old) return;

      const obj = getObjById(id);
      if (!obj) return;

      // New SVG position of this star (already set as obj._cx, obj._cy)
      const newVpX = newSvgRect.left + obj._cx * newScaleX;
      const newVpY = newSvgRect.top  + obj._cy * newScaleY;

      // Offset in viewport px: how far the star needs to travel
      const dx = old.vpX - newVpX;  // in viewport px
      const dy = old.vpY - newVpY;

      // Convert back to SVG coordinate offsets
      const dSvgX = dx / newScaleX;
      const dSvgY = dy / newScaleY;

      // Also compute scale factor — star was SPARKLE_SIZE in overview, SR now
      const fromSize = SPARKLE_SIZE / SR;

      // Set initial transform (star starts at old position, small)
      grp.style.transformOrigin = `${obj._cx}px ${obj._cy}px`;
      grp.style.transform = `translate(${dSvgX}px, ${dSvgY}px) scale(${fromSize})`;
      grp.style.opacity = '0.4';
      grp.style.transition = 'none';

      // Also offset its label
      const lblEl = svg.querySelector(`.filter-label[data-filter-id="${id}"]`);
      if (lblEl) {
        lblEl.style.opacity = '0';
        lblEl.style.transition = 'none';
      }

      // Trigger animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          grp.style.transition = 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.4s ease-out';
          grp.style.transform  = 'translate(0, 0) scale(1)';
          grp.style.opacity    = '1';
          if (lblEl) {
            lblEl.style.transition = 'opacity 0.35s ease-out 0.4s';
            lblEl.style.opacity = '1';
          }
        });
      });
    });

    // Stars NOT in this decade don't exist in the filter view — they're already gone.
    // The objectLabelsG labels start invisible, revealed after animation.
    svg.querySelectorAll('.filter-label').forEach(l => {
      if (!l.style.transition) {
        l.style.opacity = '0';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            l.style.transition = 'opacity 0.35s ease-out 0.4s';
            l.style.opacity = '1';
          });
        });
      }
    });
  }

  // Restore visual state if something already selected
  if (selectedId !== null) {
    svg.querySelectorAll('.filter-label').forEach(l => {
      l.style.opacity = l.getAttribute('data-filter-id') === String(selectedId) ? '1' : '0';
    });
  }
}

// ── MAIN RENDER FUNCTION ───────────────────────────────────────────────────

function render() {
  // Central dispatcher. We treat each view as a full re-render so that state
  // changes remain predictable (no partial DOM diffs).
  //
  // - `filterView` switches into decade drill-down (desktop only).
  // - Mobile uses type/decade accordions — no radial or timeline SVG.
  if (IS_MOBILE() && filterView) {
    filterView = null;
    const h1 = document.getElementById('page-title');
    const intro = document.getElementById('page-intro');
    const vizHint = document.getElementById('viz-hint');
    const backEl = document.getElementById('decade-back-link');
    if (h1) h1.textContent = 'Talking to space';
    if (intro) intro.style.display = '';
    if (vizHint) showTtsVizHint(vizHint);
    if (backEl) {
      const slotM = document.querySelector('.sidebar-back-slot');
      if (slotM) slotM.appendChild(backEl);
      else if (intro) intro.after(backEl);
      backEl.style.display = 'none';
      backEl.onclick = null;
    }
    const leg = document.getElementById('legend-panel');
    if (leg) leg.style.removeProperty('display');
    document.querySelector('.viz-main')?.classList.remove('viz-main--decade-full');
    document.getElementById('decade-heading')?.setAttribute('hidden', '');
    document.getElementById('decade-toolbar')?.setAttribute('hidden', '');
    const ttlM = document.getElementById('decade-toolbar-title');
    if (ttlM) ttlM.textContent = '';
  }
  if (filterView) { renderFilterView({}); return; }
  document.querySelector('.viz-main')?.classList.remove('viz-main--decade-full');
  document.getElementById('decade-heading')?.setAttribute('hidden', '');
  document.getElementById('decade-toolbar')?.setAttribute('hidden', '');
  const ttlO = document.getElementById('decade-toolbar-title');
  if (ttlO) ttlO.textContent = '';
  document.getElementById('mob-extras')?.remove();
  if (IS_MOBILE()) { renderMobile(); return; }

  const svg = document.getElementById('star-svg');
  svg.style.display = 'block';
  svg.innerHTML = '';
  ensureFilter(svg);
  
  // Reset positioning for main view (removes absolute positioning from decade view)
  // The drill-down reuses the same <svg> element but changes its sizing rules.
  svg.style.position = 'relative';
  svg.style.top = 'auto';
  svg.style.left = 'auto';
  svg.style.width = 'auto';

  const NAV_H = 57;
  const maxR  = BASE_R + (CATEGORIES.length - 1) * RING_GAP;

  const viewportH = window.innerHeight;
  const stageEl = document.querySelector('.viz-stage');
  const chartInner = document.getElementById('chart-inner');
  let H = 320;
  if (stageEl) {
    H = Math.max(320, Math.round(stageEl.getBoundingClientRect().height));
  } else {
    H = Math.max(320, viewportH - NAV_H - 120);
  }
  let cw = chartInner ? chartInner.getBoundingClientRect().width : 0;
  if (!cw && chartInner) cw = chartInner.offsetWidth;
  const W = Math.max(200, Math.round(cw || window.innerWidth * 0.68));

  const LABEL_ARC_OFFSET = 28;
  const MARGIN_BOTTOM    = 58; // px between arc base and bottom of content
  const SAFE_EDGE        = 18; // keep labels/hit targets inside SVG box
  const LABEL_PAD        = 10; // decade label radius offset (see labelR below)
  // Room above CY for the outer decade label arc (top of semicircle).
  const TOP_PAD          = 28;

  const CX = W / 2;
  const CY = H - MARGIN_BOTTOM;

  // `sMaxR`: max ring radius — scale the whole radial to fill the SVG without
  // clipping decade labels (width + height), so wide viewports aren’t stuck at
  // min(vw,vh)*0.6 while horizontal space is still available.
  const maxByWidth =
    W / 2 - (LABEL_ARC_OFFSET + LABEL_PAD + SAFE_EDGE);
  const maxByHeight =
    CY - TOP_PAD - LABEL_ARC_OFFSET - LABEL_PAD;
  const sMaxR = Math.max(140, Math.min(maxByWidth, maxByHeight));

  const scale = sMaxR / (BASE_R + (CATEGORIES.length - 1) * RING_GAP);
  const sBase = BASE_R * scale;
  const sGap  = RING_GAP * scale;

  const labelArcR = sMaxR + LABEL_ARC_OFFSET;
  // Keep decade labels/hit-rects inside the SVG viewport so they remain clickable.
  const labelR = labelArcR + LABEL_PAD;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width',  W);
  svg.setAttribute('height', H);
  svg.style.position   = 'relative';
  svg.style.left       = 'auto';
  svg.style.right      = 'auto';
  svg.style.top        = 'auto';
  svg.style.marginLeft = '0';

  // ── RING ARCS ─────────────────────────────────────────────────────────
  // We draw semi-circular arcs for each category ring. Individual objects are
  // placed on these rings with small angular jitter so dense decades don’t
  // stack perfectly.
  const ringGroups = [];
  CATEGORIES.forEach((cat, ringIdx) => {
    const r  = sBase + ringIdx * sGap;
    const lx = CX - r;
    const rx = CX + r;
    const d  = `M ${lx},${CY} A ${r},${r} 0 0,1 ${rx},${CY}`;
    const grp = svgEl('g', { 'data-ring': ringIdx }, svg);
    ringGroups.push(grp);
    svgEl('path', {
      d, fill: 'none',
      stroke: C_STRUCT,
      'stroke-width': '1',
      'class': 'ring-arc',
    }, grp);
  });

  // Type labels removed — handled by #legend-panel
  const defs = svg.querySelector('defs') || svgEl('defs', {}, svg);

  // ── DECADE DIVIDERS ────────────────────────────────────────────────────
  // Decades subdivide the half-circle into equal angular wedges. Dividers are
  // structural “grid” and not interactive.
  for (let dec = 1; dec < DECADE_COUNT; dec++) {
    const angle = Math.PI - (dec / DECADE_COUNT) * Math.PI;
    const x1 = CX + Math.cos(angle) * sBase;
    const y1 = CY - Math.sin(angle) * sBase;
    const x2 = CX + Math.cos(angle) * sMaxR;
    const y2 = CY - Math.sin(angle) * sMaxR;
    svgEl('line', {
      x1, y1, x2, y2,
      stroke: C_DIVIDER,
      'stroke-width': '1',
      'stroke-dasharray': '3,7',
    }, svg);
  }

  // ── DECADE LABELS ─────────────────────────────────────────────────────
  // Labels are interactive: hover temporarily highlights the decade by dimming
  // other marks; click enters the decade drill-down view.
  for (let dec = 0; dec < DECADE_COUNT; dec++) {
    const midAngle = Math.PI - ((dec + 0.5) / DECADE_COUNT) * Math.PI;
    const labelR   = labelArcR + 10;

    const dlx = CX + Math.cos(midAngle) * labelR;
    const dly = CY - Math.sin(midAngle) * labelR;

    // Invisible hit rect for reliable click area.
    // SVG text can be hard to hit on some devices; this makes decade selection
    // feel consistent without changing visuals.
    const hitRect = svgEl('rect', {
      x: dlx - 28, y: dly - 10,
      width: 56, height: 20,
      fill: 'transparent',
      style: 'cursor: pointer;',
      'data-decade': dec,
    }, svg);

    const yearLbl = svgEl('text', {
      x: dlx,
      y: dly,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-family': "'Geist Mono', monospace",
      'font-size': '14', 'font-weight': '400', 'letter-spacing': '0.04em',
      fill: C_DECADE,
      style: 'user-select: none; cursor: pointer; transition: fill 0.15s ease-out;',
      'class': 'decade-label',
      'data-decade': dec,
    }, svg);
    yearLbl.textContent = DECADES[dec];

    const arrLbl = svgEl('text', {
      x: dlx, y: dly - 16,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-family': "'Hanken Grotesk', system-ui, sans-serif",
      'font-size': '20', 'font-weight': '700',
      fill: 'rgba(215,190,140,0)',
      style: 'user-select: none; cursor: pointer; transition: fill 0.15s ease-out;',
      'class': 'decade-arrow',
    }, svg);
    arrLbl.textContent = '→';

    const highlightDecade = () => {
      arrLbl.setAttribute('fill', 'rgba(215,190,140,0.80)');
      // Stars: this decade full, others near-invisible
      svg.querySelectorAll('[data-dot-dec]').forEach(el => {
        el.style.opacity = el.dataset.dotDec === String(dec) ? '1' : '0.08';
        el.style.transition = 'opacity 0.15s ease-out';
      });
      // Decade labels: this one bright, others mute
      svg.querySelectorAll('.decade-label').forEach((t, i) => {
        t.setAttribute('fill', i === dec ? 'rgba(245,238,225,0.98)' : 'rgba(190,200,210,0.18)');
      });
      svg.querySelectorAll('.decade-arrow').forEach(t => t.setAttribute('fill', 'rgba(215,190,140,0)'));
      arrLbl.setAttribute('fill', 'rgba(215,190,140,0.80)');
      // Notable inline labels: hide those NOT in this decade, show those in this decade AND matching ring
      svg.querySelectorAll('.notable-default-label').forEach(lbl => {
        const id  = lbl.getAttribute('data-static-id');
        const obj = getObjById(id);
        if (obj && obj._decIdx === dec && (selectedRing === null || selectedRing === obj._ringIdx)) {
          lbl.style.opacity = '1';
        } else {
          lbl.style.opacity = '0';
        }
        lbl.style.transition = 'opacity 0.15s ease-out';
      });
      // Ring arcs: dim all slightly
      ringGroups.forEach(g => { g.style.opacity = '0.22'; g.style.transition = 'opacity 0.15s ease-out'; });
    };
    const unhighlightDecade = () => {
      arrLbl.setAttribute('fill', 'rgba(215,190,140,0)');
      svg.querySelectorAll('[data-dot-dec]').forEach(el => { el.style.opacity = ''; el.style.transition = ''; });
      svg.querySelectorAll('.decade-label').forEach(t => t.setAttribute('fill', C_DECADE));
      svg.querySelectorAll('.decade-arrow').forEach(t => t.setAttribute('fill', 'rgba(215,190,140,0)'));
      // Reset notable labels: if a ring is selected, hide those outside it; otherwise show all
      svg.querySelectorAll('.notable-default-label').forEach(lbl => {
        if (selectedRing !== null) {
          const id  = lbl.getAttribute('data-static-id');
          const obj = getObjById(id);
          lbl.style.opacity = (obj && obj._ringIdx === selectedRing) ? '' : '0';
        } else {
          lbl.style.opacity = '';
        }
        lbl.style.transition = '';
      });
      ringGroups.forEach(g => { g.style.opacity = ''; g.style.transition = ''; });
    };

    yearLbl.addEventListener('mouseenter', highlightDecade);
    yearLbl.addEventListener('mouseleave', unhighlightDecade);
    yearLbl.addEventListener('click', (e) => { e.stopPropagation(); showFilterView('decade', dec); });
    hitRect.addEventListener('mouseenter', highlightDecade);
    hitRect.addEventListener('mouseleave', unhighlightDecade);
    hitRect.addEventListener('click', (e) => { e.stopPropagation(); showFilterView('decade', dec); });
  }

  // ── GROUP DOTS ────────────────────────────────────────────────────────
  const groups = {};
  DATA.forEach(obj => {
    if (obj._ringIdx == null || obj._decIdx == null) return;
    const k = `${obj._ringIdx}-${obj._decIdx}`;
    if (!groups[k]) groups[k] = [];
    groups[k].push(obj);
  });
  // Sort each group by year: oldest → left (higher angle), newest → right (lower angle)
  Object.values(groups).forEach(arr => arr.sort((a, b) => (a._year || 9999) - (b._year || 9999)));

  const objectLabelsG = document.createElementNS(NS, 'g');
  objectLabelsG.setAttribute('pointer-events', 'none');

  // ── SPARKLE DOTS ──────────────────────────────────────────────────────
  DATA.forEach(obj => {
    if (obj._ringIdx == null || obj._decIdx == null) return;

    const r        = sBase + obj._ringIdx * sGap;
    const decStart = Math.PI - (obj._decIdx       / DECADE_COUNT) * Math.PI;
    const decEnd   = Math.PI - ((obj._decIdx + 1) / DECADE_COUNT) * Math.PI;
    const decMid   = (decStart + decEnd) / 2;
    const decSpan  = Math.abs(decEnd - decStart);

    const grp   = groups[`${obj._ringIdx}-${obj._decIdx}`] || [obj];
    const pos   = grp.indexOf(obj);
    const total = grp.length;

    let angle;
    if (total === 1) {
      angle = decMid;
    } else {
      const spread = decSpan * 0.96;
      // Reverse position: oldest objects on right (higher angle), newest on left (lower angle)
      const reversedPos = total - 1 - pos;
      angle = decMid + ((reversedPos / (total - 1)) - 0.5) * spread;
    }

    const cx = CX + Math.cos(angle) * r;
    const cy = CY - Math.sin(angle) * r;
    obj._cx  = cx;
    obj._cy  = cy;

    const isSelected = String(obj.id) === String(selectedId);
    const sparkleR   = isSelected ? SPARKLE_SIZE_SEL : SPARKLE_SIZE;

    // All stars bright by default — notable objects get a persistent label, not opacity difference
    const starBaseFill = isSelected ? GOLD
      : (selectedRing !== null && selectedRing !== obj._ringIdx) ? STAR_DIM
      : STAR_COLOR;
    const baseFill = starBaseFill;

    const dotGrp = svgEl('g', {
      'data-dot-ring': obj._ringIdx,
      'data-dot-dec':  obj._decIdx,
    }, svg);

    const sparkle = svgEl('path', {
      d: sparklePath(cx, cy, sparkleR),
      fill: baseFill,
      filter: `url(#${FILTER_ID})`,
      'data-id': obj.id,
      'class': 'star-sparkle',
      style: 'cursor:pointer; transition: fill 0.12s ease-out;',
    }, dotGrp);

    const hit = svgEl('circle', {
      cx, cy, r: Math.max(sparkleR + 8, 14),
      fill: 'transparent',
      'data-id': obj.id,
      style: 'cursor:pointer;',
    }, dotGrp);

    // Notable objects: white label visible by default.
    // When any star is selected, all default notable labels disappear —
    // only the gold selected-star label shows. If the selected star is notable,
    // the gold label replaces the white one naturally.
    const hasSelection = selectedId !== null;
    const showNotable  = obj._notable && !hasSelection && !inlineCard;
    const showSelected = isSelected && !inlineCard;

    let notableLabel = null;
    if (showNotable) {
      notableLabel = svgEl('text', {
        x: cx, y: cy - sparkleR - 7,
        'text-anchor': 'middle', 'dominant-baseline': 'auto',
        'font-family': "'Geist Mono', monospace",
        'font-size': '10', 'font-weight': '400',
        fill: C_NOTABLE,
        'paint-order': 'stroke',
        stroke: 'rgba(14,14,14,0.90)',
        'stroke-width': '1.5',
        'class': 'notable-default-label',
        'data-static-id': obj.id,
        style: 'pointer-events: auto;',
      }, objectLabelsG);
      notableLabel.textContent = obj._notable;
      // Hide initially if wrong ring is selected
      if (selectedRing !== null && selectedRing !== obj._ringIdx) {
        notableLabel.style.opacity = '0';
      }
    }

    if (showSelected) {
      svgEl('text', {
        x: cx, y: cy - sparkleR - 7,
        'text-anchor': 'middle', 'dominant-baseline': 'auto',
        'font-family': "'Geist Mono', monospace",
        'font-size': '11', 'font-weight': '600',
        fill: GOLD,
        'paint-order': 'stroke',
        stroke: 'rgba(14,14,14,0.92)',
        'stroke-width': '2',
        'stroke-linejoin': 'round',
      }, objectLabelsG).textContent = obj._notable || obj._displayTitle;
    }

    const cleanLabel = obj._notable || obj._displayTitle;

    const onEnter = e => {
      // Don't show tooltip if star is dimmed by ring filter
      if (selectedRing !== null && selectedRing !== obj._ringIdx) return;
      if (!inlineCard) showTooltip(e, `${cleanLabel}${obj._year ? ' (' + obj._year + ')' : ''}`);
      if (selectedId !== null) return;
      // Don't highlight dimmed stars
      if (selectedRing !== null && selectedRing !== obj._ringIdx) return;
      if (!isSelected) {
        const hoverR = SPARKLE_SIZE + 2.5;
        sparkle.setAttribute('d', sparklePath(cx, cy, hoverR));
        sparkle.setAttribute('fill', GOLD);
      }
    };

    const onLeave = () => {
      hideTooltip();
      if (selectedId !== null) return;
      if (!isSelected) {
        sparkle.setAttribute('d', sparklePath(cx, cy, SPARKLE_SIZE));
        sparkle.setAttribute('fill', baseFill);
      }
    };

    [sparkle, hit].forEach(target => {
      target.addEventListener('mouseenter', onEnter);
      target.addEventListener('mouseleave', onLeave);
      target.addEventListener('mousemove',  moveTooltip);
      target.addEventListener('click', (e) => { 
        // Prevent clicking on stars from filtered-out rings
        if (selectedRing !== null && selectedRing !== obj._ringIdx) return;
        e.stopPropagation(); 
        selectObject(obj); 
      });
    });
    
    // Make notable labels clickable and hoverable too
    if (notableLabel) {
      notableLabel.addEventListener('mouseenter', (e) => {
        onEnter(e);
      });
      notableLabel.addEventListener('mousemove', (e) => {
        // Only show pointer cursor if mouse is over actual text content
        const textLength = notableLabel.getComputedTextLength();
        const textX = parseFloat(notableLabel.getAttribute('x'));
        const textAnchor = notableLabel.getAttribute('text-anchor');
        
        // Calculate text bounds based on anchor
        let textLeft, textRight;
        if (textAnchor === 'middle') {
          textLeft = textX - textLength / 2;
          textRight = textX + textLength / 2;
        } else if (textAnchor === 'start') {
          textLeft = textX;
          textRight = textX + textLength;
        } else {
          textLeft = textX - textLength;
          textRight = textX;
        }
        
        const bbox = notableLabel.getBBox();
        const svgRect = notableLabel.ownerSVGElement.getBoundingClientRect();
        const svgViewBox = notableLabel.ownerSVGElement.getAttribute('viewBox').split(' ').map(Number);
        const scaleX = svgRect.width / svgViewBox[2];
        
        const mouseX = (e.clientX - svgRect.left) / scaleX;
        
        if (mouseX >= textLeft && mouseX <= textRight) {
          notableLabel.style.cursor = 'pointer';
        } else {
          notableLabel.style.cursor = 'default';
        }
        moveTooltip(e);
      });
      notableLabel.addEventListener('mouseleave', (e) => {
        notableLabel.style.cursor = 'default';
        onLeave(e);
      });
      notableLabel.addEventListener('click', (e) => { 
        // Prevent clicking on dimmed labels
        if (selectedRing !== null && selectedRing !== obj._ringIdx) return;
        e.stopPropagation(); 
        selectObject(obj); 
      });
    }
  });

  svg.appendChild(objectLabelsG);
  
  // Re-apply ring dim immediately (no setTimeout — prevents glitch frame)
  if (selectedRing !== null) {
    const ringIdx = selectedRing;
    svg.querySelectorAll('[data-dot-ring]').forEach(el => {
      // Stars are already painted with correct fill via baseFill logic above.
      // Just ensure opacity is correct for any that might have inline style overrides.
      el.style.opacity = '';
    });
    // Don't dim decade labels when ring is selected
  }
}

// ── MOBILE RENDERING ───────────────────────────────────────────────────────

function renderMobile() {
  const inner = document.getElementById('chart-inner');
  if (!inner) return;

  const svg = document.getElementById('star-svg');
  svg.style.display = 'none';
  svg.innerHTML = '';
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('viewBox');

  document.getElementById('mob-extras')?.remove();

  const root = document.createElement('div');
  root.id = 'mob-extras';
  root.className = 'mob-root';

  const modeRow = document.createElement('div');
  modeRow.className = 'mob-mode';
  modeRow.setAttribute('role', 'tablist');
  modeRow.setAttribute('aria-label', 'Browse grouped by');

  function mkModeBtn(id, label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mob-mode-btn' + (mobileBrowseBy === id ? ' active' : '');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', mobileBrowseBy === id ? 'true' : 'false');
    b.dataset.browse = id;
    b.textContent = label;
    b.addEventListener('click', () => {
      if (mobileBrowseBy === id) return;
      mobileBrowseBy = id;
      mobileOpenGroupKey = null;
      closeInlineCard();
      selectedId = null;
      const _savedY = window.scrollY;
      render();
      requestAnimationFrame(() => window.scrollTo(0, _savedY));
    });
    return b;
  }
  modeRow.appendChild(mkModeBtn('type', 'by type'));
  modeRow.appendChild(mkModeBtn('decade', 'by decade'));
  root.appendChild(modeRow);

  const acc = document.createElement('div');
  acc.className = 'mob-accordions';

  function appendGroup(key, titleText, list) {
    if (!list.length) return;
    const det = document.createElement('details');
    det.className = 'mob-group';
    det.dataset.groupKey = key;

    const sum = document.createElement('summary');
    const sumInner = document.createElement('div');
    sumInner.className = 'mob-sum-inner';

    const hdr = document.createElement('div');
    hdr.className = 'mob-sum-hdr';
    const titleEl = document.createElement('span');
    titleEl.className = 'mob-sum-title';
    titleEl.textContent = titleText;
    const meta = document.createElement('span');
    meta.className = 'mob-sum-meta';
    meta.textContent = `${list.length} ${list.length === 1 ? 'item' : 'items'}`;
    hdr.appendChild(titleEl);
    hdr.appendChild(meta);
    sumInner.appendChild(hdr);
    appendMobStarRail(sumInner, list.length);
    const chev = document.createElement('span');
    chev.className = 'mob-sum-chev';
    chev.setAttribute('aria-hidden', 'true');
    sumInner.appendChild(chev);
    sum.appendChild(sumInner);
    det.appendChild(sum);

    const wrap = document.createElement('div');
    wrap.className = 'mob-items';
    list.forEach(obj => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'mob-item-btn' + (String(obj.id) === String(selectedId) ? ' mob-item-btn--selected' : '');
      const yr = obj._year != null ? String(obj._year) : '—';
      row.innerHTML = `<span class="mob-item-yr">${esc(yr)}</span><span class="mob-item-name">${esc(obj._displayTitle)}</span>`;
      row.addEventListener('click', e => { e.stopPropagation(); selectObject(obj); });
      wrap.appendChild(row);
    });
    det.appendChild(wrap);

    if (mobileOpenGroupKey === key) det.open = true;
    det.addEventListener('toggle', () => {
      if (det.open) mobileOpenGroupKey = key;
      else if (mobileOpenGroupKey === key) mobileOpenGroupKey = null;
    });
    acc.appendChild(det);
  }

  if (mobileBrowseBy === 'type') {
    const groups = CATEGORIES.map((cat, ringIdx) => ({
      key: `t-${ringIdx}`,
      title: cat.label,
      list: DATA.filter(o => o._ringIdx === ringIdx).sort((a, b) => (b._year || 0) - (a._year || 0)),
    })).filter(g => g.list.length > 0);
    groups.sort((a, b) => a.list.length - b.list.length);
    groups.forEach(g => appendGroup(g.key, g.title, g.list));
  } else {
    for (let di = DECADE_COUNT - 1; di >= 0; di--) {
      const list = DATA.filter(o => o._decIdx === di).sort((a, b) => (b._year || 0) - (a._year || 0));
      if (list.length) appendGroup(`d-${di}`, DECADES[di], list);
    }
  }

  root.appendChild(acc);
  inner.appendChild(root);
}

// ── SELECTION AND INLINE CARD SYSTEM ───────────────────────────────────────

function selectObject(obj) {
  // Selecting a star is a pure state transition:
  // - set `selectedId` so the renderer can highlight it
  // - (re)render to apply highlight styles in SVG
  // - open the inline card as the textual “detail view”
  if (IS_MOBILE()) {
    if (mobileBrowseBy === 'type' && obj._ringIdx != null)
      mobileOpenGroupKey = `t-${obj._ringIdx}`;
    else if (mobileBrowseBy === 'decade' && obj._decIdx != null)
      mobileOpenGroupKey = `d-${obj._decIdx}`;
  }
selectedId = obj.id;
  render();
  if (IS_MOBILE()) showMobileObjectDetail(obj);
  else showInlineCard(obj);
}

/** Mobile: skip preview sheet — open the same full detail layout as desktop “expanded”. */
function showMobileObjectDetail(obj) {
  closeInlineCard();
  hideTooltip();

  const backdrop = document.createElement('div');
  backdrop.id = 'inline-card-backdrop';
  backdrop.className = 'inline-card-backdrop inline-card-backdrop--mob-detail';

  const card = document.createElement('div');
  card.id = 'inline-card';
  card.className = 'inline-card inline-card-expanded';
  inlineCard = card;

  document.body.appendChild(backdrop);
  document.body.appendChild(card);

  showInlineCardExpanded(obj);

  const outsideClickHandler = (e) => {
    const cardEl = document.getElementById('inline-card');
    if (cardEl && !cardEl.contains(e.target)) {
      document.removeEventListener('click', outsideClickHandler, true);
      deselect();
    }
  };
  setTimeout(() => document.addEventListener('click', outsideClickHandler, true), 0);
  card._outsideClickHandler = outsideClickHandler;

  document.querySelectorAll('.inline-label').forEach(lbl => { lbl.style.display = 'none'; });
}

function deselect() {
  // Deselect closes the inline card and removes highlight, but intentionally
  // keeps the ring filter active (users often want to explore within a type).
  selectedId = null;
  closeInlineCard();
  render();
  // Note: selectedRing is intentionally NOT cleared here —
  // the ring filter should persist while the user explores objects within a type.
}

function showInlineCard(obj) {
  // Creates the “preview” inline card positioned near the selected star.
  //
  // Key design choices:
  // - The card is page-absolute so it stays anchored to the star as you scroll.
  // - We create a separate backdrop element mainly to support mobile styling and
  //   to provide a consistent stacking context above the SVG.
  // - Image loading is optimistic: try .jpg, fall back to .png, then hide.
  const cat    = CATEGORIES.find(c => c.key === obj.type);
  const desc   = obj.contents_description_and_carrier_mediums ||
                 obj.contents_description ||
                 obj.transmitted_contents_and_transmission_parameters || '';
  const dateStr = obj.display_date || (obj._year ? String(obj._year) : null);
  const imgId   = obj.id;

  // ── RESET any prior card + tooltip before opening a new one ─────────────
  closeInlineCard();
  hideTooltip();

  const backdrop = document.createElement('div');
  backdrop.id = 'inline-card-backdrop';
  backdrop.className = 'inline-card-backdrop';

  const card = document.createElement('div');
  card.id = 'inline-card';
  card.className = 'inline-card inline-card-preview';
  inlineCard = card;

  // ── PREVIEW CONTENT ─────────────────────────────────────────────────────
  // Preview: no header band — just a corner ✕, date, title, description, small image.
  // We keep the preview short so it doesn’t dominate the viz; the “View full
  // details” button opens the expanded reading panel.
  const truncated = (desc && desc !== '----------')
    ? (desc.length > 320 ? desc.substring(0, 320) + '…' : desc)
    : '';

  let html = `
    <div class="oc-preview-top">
      ${dateStr ? `<div class="oc-year">${esc(dateStr)}</div>` : ''}
      <button class="oc-close" title="Close">✕</button>
    </div>
    <div class="oc-body">
      <div class="oc-title">${esc(obj._displayTitle)}</div>
      ${truncated ? `<div class="oc-desc-text">${esc(truncated)}</div>` : ''}
    </div>
    <div class="oc-image-section" id="oc-img-wrap" style="display:none;">
      <img id="oc-img" src="data_objects/object_images/${imgId}.jpg" class="oc-img" alt="${esc(obj._displayTitle)}" />
    </div>
    <div class="oc-footer">
      <button class="oc-view-more-btn">View full details →</button>
    </div>`;

  card.innerHTML = html;

  // ── POSITIONING ─────────────────────────────────────────────────────────
  // Card is ABSOLUTE (page-relative) so it doesn't follow on scroll.
  // We position using the star’s current SVG coordinates converted to viewport
  // coordinates, then clamp within the visible window.
  card.style.position = 'absolute';

  document.body.appendChild(backdrop);
  document.body.appendChild(card);

  positionInlineCard(obj);

  card.querySelector('.oc-close').addEventListener('click', e => { e.preventDefault(); deselect(); });
  card.querySelector('.oc-view-more-btn').addEventListener('click', () => showInlineCardExpanded(obj));
  card.addEventListener('click', e => e.stopPropagation());

  // ── IMAGE LOADING ───────────────────────────────────────────────────────
  // Handle preview image loading after DOM is ready.
  // We re-position after image loads because card height changes.
  const imgWrap = card.querySelector('#oc-img-wrap');
  const imgEl   = card.querySelector('#oc-img');
  if (imgEl && imgWrap) {
    const showImg = () => { imgWrap.style.display = 'block'; positionInlineCard(obj); };
    const tryPng  = () => {
      if (imgEl.src.indexOf('.jpg') > -1) {
        imgEl.src = imgEl.src.replace('.jpg', '.png');
        imgEl.onerror = () => { imgWrap.style.display = 'none'; };
      } else {
        imgWrap.style.display = 'none';
      }
    };
    imgEl.onload  = showImg;
    imgEl.onerror = tryPng;
    // If already cached, onload may not fire
    if (imgEl.complete && imgEl.naturalWidth > 0) showImg();
  }

  // ── OUTSIDE CLICK TO CLOSE ──────────────────────────────────────────────
  // Use a capture-phase handler so we can intercept clicks early even if the
  // SVG has its own listeners.
  const outsideClickHandler = (e) => {
    const cardEl = document.getElementById('inline-card');
    if (cardEl && !cardEl.contains(e.target)) {
      document.removeEventListener('click', outsideClickHandler, true);
      deselect();
    }
  };
  setTimeout(() => document.addEventListener('click', outsideClickHandler, true), 0);
  card._outsideClickHandler = outsideClickHandler;

  document.querySelectorAll('.inline-label').forEach(lbl => { lbl.style.display = 'none'; });
}

function positionInlineCard(obj) {
  const card = document.getElementById('inline-card');
  if (!card) return;

  if (IS_MOBILE()) {
    card.style.left = '0';
    card.style.right = '0';
    card.style.width = '100%';
    card.style.maxWidth = '100%';
    card.style.top = 'auto';
    card.style.bottom = '0';
    return;
  }

  const svg     = document.getElementById('star-svg');
  const svgRect = svg.getBoundingClientRect();
  const vbAttr  = svg.getAttribute('viewBox');
  if (!vbAttr) return;

  const viewBox = vbAttr.split(' ').map(Number);
  const scaleX  = svgRect.width  / viewBox[2];
  const scaleY  = svgRect.height / viewBox[3];

  // Star position in VIEWPORT coords (not page)
  const vpX = svgRect.left + obj._cx * scaleX;
  const vpY = svgRect.top  + obj._cy * scaleY;

  const cardW = 260;
  const margin = 16;
  const gap    = 14;
  const labelHeight = 18; // approx height of the inline gold label above the star

  // Horizontal: center on star, clamped to viewport
  let posX = vpX - cardW / 2;
  posX = Math.max(margin, Math.min(posX, window.innerWidth - cardW - margin));

  // Vertical: above or below based on star's viewport position
  const viewportMid = window.innerHeight * 0.5;
  let vpCardTop;
  if (vpY < viewportMid) {
    // Star in upper half → card opens BELOW the star
    vpCardTop = vpY + gap + SPARKLE_SIZE_SEL;
  } else {
    // Star in lower half → card opens ABOVE (clear the label above the star too)
    const cardH = card.offsetHeight || 200;
    vpCardTop = vpY - cardH - gap - SPARKLE_SIZE_SEL - labelHeight;
  }

  // Clamp vertically within viewport
  const cardH = card.offsetHeight || 200;
  vpCardTop = Math.max(margin, Math.min(vpCardTop, window.innerHeight - cardH - margin));

  // Convert viewport Y → page Y for absolute positioning
  const pageTop = vpCardTop + window.scrollY;

  card.style.left = posX + 'px';
  card.style.top  = pageTop + 'px';
}

function showInlineCardExpanded(obj) {
  const cat     = CATEGORIES.find(c => c.key === obj.type);
  const desc    = obj.contents_description_and_carrier_mediums ||
                  obj.contents_description ||
                  obj.transmitted_contents_and_transmission_parameters || '';
  const dateStr = obj.display_date || (obj._year ? String(obj._year) : null);
  const imgId   = obj.id;
  const imgNotes = obj.image_notes ? String(obj.image_notes).trim() : '';

  const card = document.getElementById('inline-card');
  card.classList.remove('inline-card-preview');
  card.classList.add('inline-card-expanded');
  card.style.position = 'fixed'; // expanded panel is fixed to viewport (right side)

  // Header: catname + close on SAME ROW
  let html = `
    <div class="oc-header">
      ${cat ? `<div class="oc-catname">${esc(cat.label)}</div>` : '<div></div>'}
      <button class="oc-close" title="Close">✕</button>
    </div>
    <div class="oc-body">
      ${dateStr ? `<div class="oc-year">${esc(dateStr)}</div>` : ''}
      <div class="oc-title">${esc(obj._displayTitle)}</div>`;

  if (obj.organizers && obj.organizers !== '----------') {
    html += `<div class="oc-section">
      <div class="oc-section-label">ORGANIZER</div>
      <div class="oc-organizer">${esc(obj.organizers)}</div>
    </div>`;
  }
  if (obj._spaceShowEpisodes) {
    const eList = obj._spaceShowEpisodes.map(e => `${e.name} (${e.year || '?'})`).join('\n');
    html += `<div class="oc-section">
      <div class="oc-section-label">EPISODES (${obj._spaceShowEpisodes.length})</div>
      <div class="oc-organizer" style="white-space:pre-line;font-size:12px;">${esc(eList)}</div>
    </div>`;
  }
  if (desc && desc !== '----------') {
    html += `<div class="oc-section">
      <div class="oc-section-label">DESCRIPTION</div>
      <p class="oc-desc-text">${esc(desc)}</p>
    </div>`;
  }
  if (obj.targeted_objects && obj.targeted_objects !== '----------') {
    html += `<div class="oc-section">
      <div class="oc-section-label">TARGET</div>
      <div class="oc-organizer">${esc(obj.targeted_objects)}</div>
    </div>`;
  }
  const loc = obj.current_location || obj.location;
  if (loc && loc !== '----------') {
    html += `<div class="oc-section">
      <div class="oc-section-label">CURRENT LOCATION</div>
      <div class="oc-organizer">${esc(loc)}</div>
    </div>`;
  }
  html += `</div>`;

  html += `<div class="oc-image-section-expanded" id="oc-img-wrap-expanded">
    <img id="oc-img-expanded" src="data_objects/object_images/${imgId}.jpg" class="oc-img-expanded"
      alt="${esc(obj._displayTitle)}"
      onerror="if(this.src.indexOf('.jpg')>-1){this.src='data_objects/object_images/${imgId}.png';}else{document.getElementById('oc-img-wrap-expanded').style.display='none';}"
    />
    ${imgNotes ? `<div class="oc-img-notes">${imgNotes.startsWith('http') ? `<a href="${esc(imgNotes)}" target="_blank" rel="noopener">Image source ↗</a>` : esc(imgNotes)}</div>` : ''}
  </div>`;

  html += `<div class="oc-source">Source: Paul E. Quast, "A Profile of Humanity: The Cultural Signature of Earth's Inhabitants Beyond the Atmosphere," in Speaking Beyond Earth: Perspectives on Messaging Across Deep Space and Cosmic Time (McFarland, 2024).</div>`;

  card.innerHTML = html;

  if (IS_MOBILE()) {
    card.style.left = '0';
    card.style.right = '0';
    card.style.top = '';
    card.style.bottom = '0';
    card.style.width = '100%';
    card.style.maxWidth = '100%';
    /* top / max-height come from CSS (below fixed nav) */
  } else {
    const panelW = Math.min(360, window.innerWidth * 0.85);
    card.style.left   = (window.innerWidth - panelW - 24) + 'px';
    card.style.top    = (72 + window.scrollY) + 'px';
    card.style.right  = 'auto';
    card.style.bottom = 'auto';
  }

  card.querySelector('.oc-close').addEventListener('click', e => { e.preventDefault(); deselect(); });
  card.addEventListener('click', e => e.stopPropagation());
}

function closeInlineCard() {
  const card = document.getElementById('inline-card');
  if (card) {
    if (card._outsideClickHandler) document.removeEventListener('click', card._outsideClickHandler, true);
    card.remove();
  }
  const backdrop = document.getElementById('inline-card-backdrop');
  if (backdrop) backdrop.remove();
  inlineCard = null;
}

// ── TOOLTIP ────────────────────────────────────────────────────────────────

function showTooltip(e, text) {
  const t = document.getElementById('tooltip');
  t.textContent = text;
  t.classList.add('visible');
  moveTooltip(e);
}

function moveTooltip(e) {
  const t = document.getElementById('tooltip');
  if (!t.classList.contains('visible')) return;
  
  // Get tooltip dimensions
  const tooltipRect = t.getBoundingClientRect();
  const tooltipW = tooltipRect.width || 260;
  const tooltipH = tooltipRect.height || 80;
  
  // Position horizontally
  let posX = Math.min(e.clientX + 14, window.innerWidth - tooltipW - 10);
  
  // Position vertically - check if below cursor would go off-screen
  let posY = e.clientY - 10;
  if (posY + tooltipH > window.innerHeight - 10) {
    // If tooltip would go off bottom, position above cursor instead
    posY = e.clientY - tooltipH - 10;
  }
  
  t.style.left = posX + 'px';
  t.style.top = posY + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip').classList.remove('visible');
}

// ── DATA PROCESSING ────────────────────────────────────────────────────────

function processData(raw) {
  // Data normalization rules live here so rendering can treat DATA as “ready”.
  // We add derived fields prefixed with `_` and keep the raw fields intact.
  raw.forEach(o => {
    if (String(o.id) === '217') o.type = 'Cultural Expression and Advertisement Messages';
  });

  // The source dataset contains many "The Space Show N" rows. We merge these
  // into one compound object so the visualization reads as a single initiative,
  // while still exposing episode details in the expanded card.
  const spaceShows = raw.filter(o => /^The Space Show\s+\d+$/i.test((o.initiative_name_clean || '').trim()));
  const otherData  = raw.filter(o => !/^The Space Show\s+\d+$/i.test((o.initiative_name_clean || '').trim()));

  let mergedShows = null;
  if (spaceShows.length > 0) {
    const episodes = spaceShows.map(o => ({
      name: o.initiative_name_clean,
      year: (() => {
        const m = String(o.transmitted || '').match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
        return m ? parseInt(m[1]) : null;
      })(),
    })).sort((a, b) => {
      const na = parseInt((a.name.match(/\d+$/) || [0])[0]);
      const nb = parseInt((b.name.match(/\d+$/) || [0])[0]);
      return na - nb;
    });
    const earliestYear = episodes.map(e => e.year).filter(Boolean).sort()[0];
    mergedShows = {
      ...spaceShows[0],
      id: 'space-show-merged',
      initiative_name_clean: 'The Space Show',
      mission_item_title_clean: '',
      transmitted: String(earliestYear || '2005'),
      date: '',
      organizers: 'David M. Livingston / Deep Space Communication Network',
      contents_description_and_carrier_mediums: 'Internet radio talk show about space commerce and exploration, transmitted via high-powered klystron amplifiers and a 5m parabolic dish.',
      _spaceShowEpisodes: episodes,
    };
  }

  const eligible = [...otherData, ...(mergedShows ? [mergedShows] : [])]
    .filter(o =>
      CATEGORIES.some(c => c.key === o.type) &&
      (o.mission_item_title_clean || o.initiative_name_clean || o.space_mission_clean)
    );

  DATA = eligible.map(obj => {
    const year    = parseYear(obj);
    const decIdx  = yearToDecadeIdx(year);
    const ringIdx = CATEGORIES.findIndex(c => c.key === obj.type);
    const title   = obj.mission_item_title_clean ||
                    obj.initiative_name_clean     ||
                    obj.space_mission_clean       ||
                    '(Untitled)';
    return {
      ...obj,
      _year:         year,
      _decIdx:       decIdx !== null ? decIdx : 6,
      _noDec:        decIdx === null,
      _ringIdx:      ringIdx >= 0 ? ringIdx : null,
      _displayTitle: title,
      _notable:      NOTABLES[String(obj.id)] || null,
    };
  });

  rebuildIndexes();
}

// ── INITIALIZATION ─────────────────────────────────────────────────────────

function ensureTtsBackInSlot() {
  const back = document.getElementById('decade-back-link');
  const slot = document.querySelector('.sidebar-back-slot');
  if (back && slot && !slot.contains(back)) slot.appendChild(back);
}

/** Desktop: Scrollama-based sticky intro steps.
 *  Each `.scrolly-track` carries `data-scrolly-phase` which becomes the
 *  `data-phase` on the sticky inner — CSS then fades the matching panel in.
 *  The abundance lines use their own IntersectionObserver (see below) because
 *  they are triggered by sub-track divs, not whole track steps.
 */
function initTtsScrolly() {
  // Scrolly runs on all sizes; CSS handles sticky vs static per breakpoint.
  const root  = document.getElementById('scrolly');
  const inner = root?.querySelector('.scrolly-sticky-inner');
  if (!root || !inner) return;

  // ── ABUNDANCE LINES ──────────────────────────────────────────────────────
  // Each `.abundance-trigger[data-line]` div controls its corresponding
  // line. IntersectionObserver fires per-trigger as it crosses the viewport,
  // giving staggered reveal. Observers are lazily attached when the abundance
  // track enters view and fully reset when the user scrolls back up past it.
  (function initAbundanceLines() {
    const allLines = Array.from(root.querySelectorAll('.scrolly-line'));
    const lines    = allLines.filter(l => !l.classList.contains('scrolly-line--spacer'));
    const triggers = Array.from(root.querySelectorAll('.abundance-trigger[data-line]'));
    if (!lines.length || !triggers.length) return;

    allLines.forEach(l => l.classList.remove('visible'));

    let observersAttached = false;
    const lineObservers = [];

    function attachObservers() {
      if (observersAttached) return;
      observersAttached = true;
      triggers.forEach((trigger, idx) => {
        const line = lines[idx];
        if (!line) return;
        const obs = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              line.classList.add('visible');
            } else if (entry.boundingClientRect.top > window.innerHeight * 0.5) {
              line.classList.remove('visible');
            }
          });
        }, { threshold: 0.1 });
        obs.observe(trigger);
        lineObservers.push(obs);
      });
    }

    function resetAll() {
      allLines.forEach(l => l.classList.remove('visible'));
      lineObservers.forEach(o => o.disconnect());
      lineObservers.length = 0;
      observersAttached = false;
    }

    const abundanceTrack = root.querySelector('.scrolly-track--abundance');
    if (abundanceTrack) {
      new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            attachObservers();
          } else if (entry.boundingClientRect.top > window.innerHeight * 0.5) {
            resetAll();
          }
        });
      }, { threshold: 0 }).observe(abundanceTrack);
    }
  })();

  // ── SCROLLAMA PHASE SWITCHER ──────────────────────────────────────────────
  // Scrollama's IntersectionObserver fires onStepEnter for each track as it
  // crosses the offset point, updating data-phase on the sticky inner.
  // Falls back gracefully if the CDN fails to load the library.
  if (typeof scrollama !== 'function') {
    console.warn('[scrolly] scrollama not available — skipping phase detection');
    return;
  }

  const introImg = root.querySelector('.scrolly-intro-image');

  const scroller = scrollama()
    .setup({ step: '#scrolly .scrolly-track', offset: 0.5 })
    .onStepEnter(({ element }) => {
      const phase = element.dataset.scrollyPhase;
      if (phase) {
        inner.dataset.phase = phase;
        // Fade out the intro image for all phases except the intro panel
        if (introImg) introImg.style.opacity = (phase === 'intro') ? '' : '0';
      }
    });

  // Scrollama must be notified after resize so trigger positions are recalculated
  window.addEventListener('resize', () => scroller.resize(), { passive: true });
}

function init() {
  fetch('data_objects/data_raw/all_transmissions_merged.json')
    .then(r => { if (!r.ok) throw new Error(`Fetch failed: ${r.status}`); return r.json(); })
    .then(raw => {
      processData(raw);
      buildLegend();
      ensureTtsBackInSlot();
      initTtsScrolly();
      render();
      requestAnimationFrame(() => { render(); });
      window.addEventListener('resize', () => { render(); });
      
      // Click anywhere else on SVG to deselect ring
      document.getElementById('star-svg').addEventListener('click', (e) => {
        if (e.target.closest('.type-label-hit')) return; // don't deselect if clicking type label
        if (selectedRing !== null) {
          selectedRing = null;
          updateLegendState();
          render();
        }
      });
      
      if (!IS_MOBILE()) {
        const defaultObj = getObjById(DEFAULT_OPEN_ID);
        if (defaultObj) selectObject(defaultObj);
      }
      updateLegendState();
    })
    .catch(err => {
      console.error('Failed to load data:', err);
      const wrap = document.getElementById('chart-wrap') || document.querySelector('.tts-header');
      if (wrap) wrap.innerHTML = `<p style="padding:40px;font-family:monospace;color:rgba(240,240,240,0.6);">Could not load data. Make sure the page is served via a local server and <code>data_objects/data_raw/all_transmissions_merged.json</code> exists.</p>`;
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();