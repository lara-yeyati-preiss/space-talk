(function () {
  'use strict';
  
  // Two-level interactive view of “how space is talked about”:
  // - Cluster overview (desktop): one circle per theme/actor sized by overall share,
  //   plus optional co-occurrence lines. Clicking enters drilldown.
  // - Drilldown (desktop): three stacked rows (NEWS / POLITICS / BOOKS) showing
  //   decade-by-decade shares for the selected theme/actor.
  // - Mobile: the same data is presented as a scrollable “cluster list” and a
  //   tap-to-open decade list to avoid dense SVG interactions on small screens.

  
  // ── CONSTANTS ─────────────────────────────────────────────────────────────
  
  const UMBRELLAS = [
    'power_rivalry','applied_space_science','economic_financial',
    'risk_hazard','discovery_science','existential_reflection'
  ];
const ACTORS_BY_SOURCE = {
  nyt: [
    'astronauts_cosmonauts',
    'national_state_us',
    'rival_space_powers',
    'private_sector',
    'scientific_community'
  ],
  politics: [
    'national_state_us',
    'rival_space_powers',
    'international_institutions',
    'private_sector'
  ]
};

function getActorsForSource(src) {
  return DATA?.actors_by_source?.[src] || ACTORS_BY_SOURCE[src] || ACTORS_BY_SOURCE.nyt;
}
  const DECADES  = [1950,1960,1970,1980,1990,2000,2010,2020];
  const MIN_YEAR = 1950, MAX_YEAR = 2023;
  
  /** Curated timeline milestones — max 6 on screen (year + label must match `space_viz_data.json`). */
  const TIMELINE_LANDMARKS_THEME = [
    [1957, 'Sputnik launched'],
    [1969, 'Apollo 11 Moon landing'],
    [1986, 'Challenger disaster'],
    [1998, 'ISS begins'],
    [2008, 'Falcon 1 reaches orbit'],
    [2021, 'JWST launch'],
  ];
  const TIMELINE_LANDMARKS_ACTOR = [
    [1957, 'Sputnik launched'],
    [1969, 'Apollo 11 Moon landing'],
    [1983, 'SDI announced'],
    [1998, 'ISS begins'],
    [2003, "China's first taikonaut"],
    [2011, 'Shuttle ends'],
  ];
  
  /** Which institutional actors each actor-timeline milestone foregrounds (for drilldown filtering). */
  const LANDMARK_ACTOR_TAGS = {
    '1957|Sputnik launched': ['rival_space_powers', 'scientific_community'],
    '1969|Apollo 11 Moon landing': ['national_state_us', 'rival_space_powers', 'scientific_community'],
    '1983|SDI announced': ['national_state_us', 'rival_space_powers'],
    '1998|ISS begins': ['international_institutions', 'national_state_us', 'rival_space_powers'],
    "2003|China's first taikonaut": ['rival_space_powers'],
    '2011|Shuttle ends': ['national_state_us', 'rival_space_powers'],
  };
  
  const MAX_TIMELINE_LANDMARKS = 6;
  
  function landmarkRowsToObjects(rows) {
    const base = DATA?.landmarks;
    if (!base) return [];
    return rows
      .slice(0, MAX_TIMELINE_LANDMARKS)
      .map(([y, lab]) => base.find(b => b.year === y && b.label === lab))
      .filter(Boolean);
  }
  const NS = 'http://www.w3.org/2000/svg';
  
  const LABEL_W     = 240;
  const CHART_PAD        = 230;  // right gutter for rank chart end-labels (wider to fit actor names)
  const DRILL_CHART_PAD  = 20; // right gutter for drilldown: reserves space for last circle radius
  const DRILL_MAX_R = 74;
  const DRILL_ROW_H = 140;
  const PAD_TOP     = 20;
  const AXIS_EXTRA  = 6;
  const DEC_LBL_H   = 24;
  const LM_TICK     = 8;
  const LM_LBL_H    = 16;
  // Rank chart hover annotations (actor-specific decade callouts).
  // Decade is the tick decade (1950..2020) that the callout should point to.
  // Labels are single-line; year in parentheses is part of the label text.
  const TRENDS_ACTOR_CALLOUTS = {
    national_state_us: {
      nyt: [
        { decade: 1950, label: 'NASA established (1958)', placeAbove: false },
        { decade: 1960, label: 'Kennedy\'s Moon speech (1961)' },
        { decade: 1960, label: 'Outer Space Treaty signed (1967)' },
        { decade: 2010, label: 'Space Shuttle program ends (2011)' },
      ],
      politics: [
        { decade: 1950, label: 'NASA established (1958)' },
        { decade: 1960, label: 'Kennedy\'s Moon speech (1961)' },
        { decade: 1960, label: 'Outer Space Treaty signed (1967)' },
        { decade: 2010, label: 'Space Shuttle program ends (2011)' },
      ],
    },
    rival_space_powers: {
      nyt: [
        { decade: 1950, label: 'Sputnik 1 launched (1957)' },
        { decade: 1960, label: 'Yuri Gagarin flight (1961)' },
        { decade: 1970, label: 'Apollo 11 Moon landing (1969)' },
        { decade: 2000, label: 'China\'s first crewed flight (2003)' },
      ],
      politics: [
        { decade: 1950, label: 'Sputnik 1 launched (1957)' },
        { decade: 1960, label: 'Yuri Gagarin flight (1961)' },
        { decade: 1970, label: 'Apollo 11 Moon landing (1969)' },
        { decade: 2000, label: 'China\'s first crewed flight (2003)' },
      ],
    },
    international_institutions: {
      nyt: [
        { decade: 1960, label: 'Outer Space Treaty signed (1967)' },
        { decade: 1990, label: 'ISS assembly begins (1998)' },
        { decade: 2020, label: 'Artemis Accords signed (2020)' },
      ],
      politics: [
        { decade: 1960, label: 'Outer Space Treaty signed (1967)' },
        { decade: 1990, label: 'ISS assembly begins (1998)', placeAbove: false },
        { decade: 2020, label: 'Artemis Accords signed (2020)', placeAbove: true },
      ],
    },
    private_sector: {
      nyt: [
        { decade: 2000, label: 'SpaceX founded (2002)' },
        { decade: 2000, label: 'Falcon 1 reaches orbit (2008)', placeAbove: false },
        { decade: 2010, label: 'Falcon 9 first landing (2015)' },
        { decade: 2020, label: 'Commercial Crew program begins (2020)', placeAbove: true },
      ],
      politics: [
        { decade: 2000, label: 'SpaceX founded (2002)' },
        { decade: 2000, label: 'Falcon 1 reaches orbit (2008)', placeAbove: false },
        { decade: 2010, label: 'Falcon 9 first landing (2015)', placeAbove: false },
        { decade: 2020, label: 'Commercial Crew program begins (2020)', placeAbove: true },
      ],
    },
    astronauts_cosmonauts: {
      nyt: [
        { decade: 1960, label: 'Yuri Gagarin orbits Earth (1961)' },
        { decade: 1960, label: 'John Glenn orbits Earth (1962)' },
        { decade: 1970, label: 'Apollo 11 Moon landing (1969)' },
        { decade: 2020, label: 'Crew Dragon Demo-2 mission (2020)' },
      ],
      politics: [],
    },
    scientific_community: {
      nyt: [
        { decade: 1990, label: 'First exoplanet discovered (1995)' },
        { decade: 2010, label: 'Gravitational waves detected (2015)' },
        { decade: 2020, label: 'James Webb images released (2022)' },
      ],
      politics: [],
    },
  };
  
  /** Set of decades that have at least one callout for the currently hovered actor.
   *  Used by tick rendering to decide which ticks stay highlighted on hover. */
  function getCalloutDecades(actorKey) {
    const entry = TRENDS_ACTOR_CALLOUTS[actorKey];
    const items = entry ? (entry[trendSrc] || entry.nyt || []) : [];
    return new Set(items.map(it => it.decade));
  }
  
  const MAX_CLUSTER_R = 120;
  const MIN_CLUSTER_R = 46;
  
  const SRC_ABBR = { nyt:'NEWS', politics:'POLITICS' };
  
  // ── COLORS ────────────────────────────────────────────────────────────────
  
  const THEME_COLORS = {
    discovery_science:      '#053081',
    applied_space_science:  '#3A3A5E',
    power_rivalry:          '#5E1E1E',
    risk_hazard:            '#615438', 
    economic_financial:     '#3B6B52', 
    existential_reflection: '#633D54',
  };
const ACTOR_COLORS = {
  astronauts_cosmonauts: '#E67E22',
  national_state_us: '#395b7f',
  rival_space_powers: '#9b4c47',
  international_institutions: '#476155',
  private_sector: '#6B5A80',
  scientific_community: '#867d58',
};

const ACTOR_LABELS_MAP = {
  astronauts_cosmonauts: 'Astronauts',
  national_state_us: 'National state',
  rival_space_powers: 'Geopolitical rivals',
  international_institutions: 'International partnerships',
  private_sector: 'Private sector',
  scientific_community: 'Scientific community',
};
  
  /** Matches `buildDefs` linearGradient stops (bubble fill) for mobile drill bars. */
  function drillBarBubbleBackground(kind, key) {
    const hex = kind === 'theme' ? THEME_COLORS[key] : ACTOR_COLORS[key];
    if (!hex) return 'transparent';
    const n = hex.replace('#', '');
    const r = parseInt(n.slice(0, 2), 16);
    const g = parseInt(n.slice(2, 4), 16);
    const b = parseInt(n.slice(4, 6), 16);
    const endA = kind === 'theme' ? 0.7 : 0.72;
    return `linear-gradient(165deg, ${hex} 0%, rgba(${r},${g},${b},${endA}) 100%)`;
  }
  
  // ── LABELS ────────────────────────────────────────────────────────────────
  
  const THEME_LABELS = {
    discovery_science:      'Studying the cosmos',
    applied_space_science:  'Space operations & missions',
    power_rivalry:          'Space race & rivalry',
    risk_hazard:            'Risk & hazards',
    economic_financial:     'Markets & commerce',
    existential_reflection: 'Meaning & identity',
  };

  const ACTOR_DESCS = {
    national_state_us:          'U.S. federal institutions and agencies — NASA, Congress, the White House, the military, and other state bodies — as the domestic institutional center of space activity.',
    rival_space_powers:         'Foreign state programs framed through rivalry, threat, competition, or strategic comparison — especially the Soviet Union/Russia and China.',
    international_institutions: 'Formal and informal global space contexts, including multilateral agencies, treaties, partnerships, foreign space programs, and related international framing.',
    private_sector:             'Commercial companies, contractors, launch startups, satellite operators, and entrepreneurs — from aerospace contractors to SpaceX, Blue Origin, and the new space economy.',
    scientific_community:       'Scientists, universities, observatories, research institutes, and expert communities producing knowledge about space.',
  };
  // ── CLUSTER POSITIONS ─────────────────────────────────────────────────────
  // px: 0=left, 1=right. py: 0=top, 1=bottom.
  
  const THEME_POSITIONS = {
    power_rivalry:          { px: 0.12, py: 0.28 },
    applied_space_science:  { px: 0.5, py: 0.10 },
    discovery_science:      { px: 0.7, py: 0.10 },
    risk_hazard:            { px: 0.10, py: 0.75 },
    existential_reflection: { px: 0.38, py: 0.69 },
    economic_financial:     { px: 0.72, py: 0.76 },
  };
  
  // ── STATE ─────────────────────────────────────────────────────────────────
  
  /** Rank chart: actors only; source selector independent from bubble. */
  let trendSrc = 'nyt';
  /** Bubble / mobile / drill / samples: themes only; separate source. */
  let planetSrc = 'nyt';
  
  let activeTheme = null;
  let DATA        = null;
  let _activeDrillW = null;
  /** Stores the display order locked at drilldown entry time: [activeSrc, otherSrc].
   *  null means not in drilldown. Switching source inside drilldown does NOT change this. */
  let _drillEnteredFromOverview = false;
  let _drillRowOrder = null;  // e.g. ['politics','nyt'] or ['nyt','politics']
  /** When set, the rank chart keeps this actor highlighted (click-to-pin). */
  let _pinnedActor = null;
  /** True while a drilldown chart is being rendered — tells chartW() to use DRILL_CHART_PAD. */
  let _inDrilldown = false;
  let PAD_BOTTOM    = 0;
  /** When set, trends bump chart uses custom margins: { W, leftCol, rightPad }. */
  let trendsLayout  = null;
  // On first load, the trends chart resizes itself over a couple frames (based on
  // viewport and measured header/filter layout). The bubble cluster height depends
  // on its distance to the viewport bottom, so drawing it before the trends chart
  // settles can make the initial layout look “clamped”. We defer the very first
  // cluster draw until after the trends chart’s post-measurement pass.
  let _deferClusterFirstPaint = true;
  function sourceCountLabel(src) {
  const counts = DATA?.total_docs?.[src] || {};
  const sourceMeta = {
    nyt: {
      unit: 'headlines',
      total: counts.theme_total_docs ?? counts.actor_total_docs,
    },
    politics: {
      unit: 'excerpts',
      total: counts.theme_total_docs ?? counts.actor_total_docs,
    },

  };

  const meta = sourceMeta[src];
  if (!meta || meta.total == null) return '';

  return `Total ${meta.unit}: ${Number(meta.total).toLocaleString()}`;
}

function updateSourceCounts() {
  const rankCount = document.getElementById('rank-source-count');
  const planetsCount = document.getElementById('planets-source-count');

  if (rankCount) rankCount.textContent = sourceCountLabel(trendSrc);
  if (planetsCount) planetsCount.textContent = sourceCountLabel(planetSrc);
}
  function syncTrendFilters() {
    const root = document.querySelector('#rank-filters');
    if (!root) return;
    root.querySelectorAll('.filter-source--rank').forEach(b =>
      b.classList.toggle('active', b.dataset.trendsSrc === trendSrc));
    
    const sourceLabels = { nyt: 'New York Times', politics: 'American Presidency Project' };
    const sourceNote = root.querySelector('.filter-source-note');
    if (sourceNote) sourceNote.textContent = 'Source: ' + (sourceLabels[trendSrc] || trendSrc);
    updateSourceCounts();
  }
  
  function syncPlanetFilters() {
    const root = document.querySelector('#bubble-filters');
    if (!root) return;
    root.querySelectorAll('.filter-source--rank').forEach(b =>
      b.classList.toggle('active', b.dataset.trendsSrc === planetSrc));
    
    const sourceLabels = { nyt: 'New York Times', politics: 'American Presidency Project' };
    const sourceNote = root.querySelector('.filter-source-note');
    if (sourceNote) sourceNote.textContent = 'Source: ' + (sourceLabels[planetSrc] || planetSrc);
  updateSourceCounts();
}
  
  function syncTasFilterDOM() {
    syncTrendFilters();
    syncPlanetFilters();
  }
  
  function measureFilterViewGroupSlot() {
    [
      ['#rank-filters', '--rank-filter-slot'],
      ['#bubble-filters', '--bubble-filter-slot'],
    ].forEach(([sel, prop]) => {
      const root = document.querySelector(sel);
      if (!root) return;
      const g = root.querySelector('.filter-source-group');
      if (!g) return;
      g.style.width = 'max-content';
      void g.offsetWidth;
      const w = Math.ceil(g.getBoundingClientRect().width);
      g.style.width = '';
      root.style.setProperty(prop, `${w}px`);
    });
  }
  
  function syncDrilldownBackLinks() {
    const drilling = !!activeTheme;
    const back        = document.getElementById('back-link');
    const ctaOverview  = document.getElementById('cta-overview');
    const ctaDrilldown = document.getElementById('cta-drilldown');

    // Back button: visible on left when drilling, hidden when overview
    if (back) {
      back.style.display  = drilling ? 'inline-flex' : 'none';
      back.setAttribute('aria-hidden', drilling ? 'false' : 'true');
    }
    // Overview CTA: left side in overview, hidden in drilldown (back button takes its place)
    if (ctaOverview)  ctaOverview.style.display  = drilling ? 'none'  : 'block';
    // Drilldown CTA: right side in drilldown only
    if (ctaDrilldown) ctaDrilldown.style.display = drilling ? 'block' : 'none';
  }
  
  // ── SCROLLY INTRO (Scrollama) ─────────────────────────────────────────────
  //
  // Scrollama uses IntersectionObserver under the hood, which is far more
  // reliable than a raw scroll listener: no jitter, correct thresholds, and
  // handles fast-scrolling past multiple steps gracefully.
  //
  // Pattern: one scroller per scrolly section. Each `.scrolly-track`
  // element carries `data-scrolly-phase` which becomes the `data-phase` on
  // the sticky inner — CSS then fades the matching panel in.

  function _makeScrollyScroller(scrollyId, stickyInnerSelector) {
    // Guard: scrollama may not exist if CDN failed; fall back gracefully.
    if (typeof scrollama !== 'function') {
      console.warn('[scrolly] scrollama not loaded — falling back to scroll listener for', scrollyId);
      return _makeScrollyFallback(scrollyId, stickyInnerSelector);
    }

    const stickyInner = document.querySelector(stickyInnerSelector);
    if (!stickyInner) return;

    const scroller = scrollama();
    scroller.setup({
      step: `#${scrollyId} .scrolly-track`,
      // Trigger when the top edge of each track reaches the vertical midpoint
      // of the viewport — keeps transitions feeling "on-beat" with scroll.
      offset: 0.5,
      // Use container scroll if the page ever becomes contained; keep false
      // for standard window scroll.
      container: null,
    })
    .onStepEnter(({ element }) => {
      const phase = element.dataset.scrollyPhase;
      if (phase) stickyInner.setAttribute('data-phase', phase);
    });

    // Scrollama must be notified after any layout changes that alter track positions.
    window.addEventListener('resize', () => scroller.resize(), { passive: true });
  }

  function _makeScrollyFallback(scrollyId, stickyInnerSelector) {
    // Minimal scroll-listener fallback when Scrollama is unavailable.
    const stickyInner = document.querySelector(stickyInnerSelector);
    const scrolly = document.getElementById(scrollyId);
    if (!stickyInner || !scrolly) return;

    const tracks = Array.from(scrolly.querySelectorAll('.scrolly-track'));

    function updatePhase() {
      const scrolled = window.scrollY - scrolly.offsetTop;
      const vh = window.innerHeight;
      let current = tracks[0];
      for (const track of tracks) {
        if (scrolled >= track.offsetTop - vh * 0.5) current = track;
      }
      const phase = current?.dataset.scrollyPhase;
      if (phase) stickyInner.setAttribute('data-phase', phase);
    }

    window.addEventListener('scroll', updatePhase, { passive: true });
    updatePhase();
  }

  function initTasScrolly() {
    if (window.innerWidth <= 900) return; // mobile: panels flow statically
    _makeScrollyScroller('scrolly', '#scrolly .scrolly-sticky-inner');
  }

  // ── PROTAGONISTS LINES ───────────────────────────────────────────────────
  // Handle fade-in/fade-out of protagonists panel lines as you scroll
  function initProtagonistsLines() {
    const root = document.getElementById('scrolly');
    if (!root) return;
    if (window.innerWidth <= 900) return; // mobile: lines visible via CSS

    const allLines = Array.from(root.querySelectorAll('.scrolly-line--protagonists'));
    const triggers = Array.from(root.querySelectorAll('.protagonists-trigger[data-line]'));
    if (!allLines.length || !triggers.length) return;

    allLines.forEach(l => l.classList.remove('visible'));

    // Track the highest line index that has been revealed (so scrolling back up shows both)
    let maxRevealedLine = -1;

    // Each trigger with data-line reveals lines 0..N sequentially.
    // The pause trigger between them provides dwell time before line 1 appears.
    triggers.forEach(trigger => {
      const lineIdx = parseInt(trigger.dataset.line, 10);
      const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Reveal this line and all previous ones
            if (lineIdx > maxRevealedLine) maxRevealedLine = lineIdx;
            allLines.forEach((l, i) => {
              if (i <= maxRevealedLine) l.classList.add('visible');
            });
          } else if (entry.boundingClientRect.top > 0) {
            // Scrolling back up past this trigger: hide this line and those after it,
            // but keep earlier ones visible so scrolling up still shows what was seen.
            if (lineIdx <= maxRevealedLine) maxRevealedLine = lineIdx - 1;
            allLines.forEach((l, i) => {
              if (i > maxRevealedLine) l.classList.remove('visible');
            });
          }
        });
      }, { threshold: 0 });
      obs.observe(trigger);
    });

    // When the entire protagonists track leaves the viewport (scrolled fully past),
    // reset so re-entering plays the sequence fresh. But when scrolling UP back into
    // the section both lines remain visible (maxRevealedLine handles that above).
    const protagonistsTrack = root.querySelector('[data-scrolly-phase="protagonists"]');
    if (protagonistsTrack) {
      const trackObs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          // Section left below viewport (scrolled past) — reset state
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            maxRevealedLine = -1;
            allLines.forEach(l => l.classList.remove('visible'));
          }
        });
      }, { threshold: 0 });
      trackObs.observe(protagonistsTrack);
    }
  }

  function initChartsScrolly() {
    if (window.innerWidth <= 900) return;
    _makeScrollyScroller('tas-charts-scrolly', '#tas-charts-scrolly .scrolly-sticky-inner');
  }
  
  // ── INIT ──────────────────────────────────────────────────────────────────
  
  function init() {
    // ── DATA BOOTSTRAP ─────────────────────────────────────────────────────
    // `boot()` assembles `window.VIZ_DATA` from JSON; `init()` treats it as ready.
    DATA = window.VIZ_DATA;
    if (DATA.themes) {
      // Normalize labels in one place so drawing code can just read `theme.label`.
      for (const [k, label] of Object.entries(THEME_LABELS)) {
        if (DATA.themes[k]) DATA.themes[k].label = label;
      }
    }

  
    // ── UI WIRING ──────────────────────────────────────────────────────────
    // Filters drive view + source selection; caption and tooltip are derived UI.
    setupTrendFilters();
    setupPlanetFilters();
    syncTasFilterDOM();
    updateCaption();
    const back = document.getElementById('back-link');
    if (back) {
      back.addEventListener('click', e => {
        e.stopPropagation();
        exitDrilldown();
      });
    }
  
    // Pre-build drilldown DOM so first render has correct svgW().
    if (!IS_MOBILE()) {
      // Desktop-only UI affordances are inserted dynamically to keep HTML minimal.
      getOrCreateLegend();
    }
  
    // ── RESPONSIVE / GLOBAL EVENT HOOKS ─────────────────────────────────────
    // Resizing invalidates cached cluster positions and may toggle image column.
    window.addEventListener('resize', () => {
      Object.keys(_stablePositions).forEach(k => delete _stablePositions[k]);
      drawTrendsChart._cachedH = null; // clear height cache so chart recomputes for new viewport
      const mob = document.getElementById('mob-cluster');
      if (mob) mob.style.display = 'none';
      const bsvg = document.getElementById('bubble-svg');
      if (bsvg) bsvg.style.display = '';
      render();
      requestAnimationFrame(() => {
        measureFilterViewGroupSlot();
        drawTrendsChart();
      });
    });
    window.addEventListener('scroll', () => {
      hideTip();
    }, { passive: true });
  
    // ── SCROLLY INTRO ──────────────────────────────────────────────────────
    initTasScrolly();
    initChartsScrolly();
    initProtagonistsLines();
  
    // ── FIRST PAINT ─────────────────────────────────────────────────────────
    render();
    requestAnimationFrame(() => {
      measureFilterViewGroupSlot();
      drawTrendsChart();
      requestAnimationFrame(() => {
        measureFilterViewGroupSlot();
        drawTrendsChart();
        if (!IS_MOBILE()) {
          _deferClusterFirstPaint = false;
          Object.keys(_stablePositions).forEach(k => delete _stablePositions[k]);
          render();
        }
      });
    });
  }
  
  function setupTrendFilters() {
    const root = document.querySelector('#rank-filters');
    if (!root) return;
  
    root.querySelectorAll('.filter-source--rank').forEach(btn => {
      btn.addEventListener('click', () => {
        trendSrc = btn.dataset.trendsSrc;
        _pinnedActor = null;
        // Clear height cache so the chart remeasures on source switch
        drawTrendsChart._cachedH = null;
        syncTrendFilters();
        drawTrendsChart();
        updateCaption();
      });
    });
  }
  
  function setupPlanetFilters() {
    const root = document.querySelector('#bubble-filters');
    if (!root) return;
  
    root.querySelectorAll('.filter-source--rank').forEach(btn => {
      btn.addEventListener('click', () => {
        planetSrc = btn.dataset.trendsSrc;
        syncPlanetFilters();
        closeSamplesModal();
        // Only redraw bubble/drilldown — rank chart is fully independent
        renderBubbleOnly();
      });
    });
  }

  /** Redraw only the bubble chart (overview or drilldown), leaving the rank chart untouched. */
  function renderBubbleOnly() {
    syncDrilldownBackLinks();
    updatePlanetsSubtitle();
    updateSectionTitles();
    // Toggle CTA visibility based on view state
    const ctaOverview = document.getElementById('cta-overview');
    const ctaDrilldown = document.getElementById('cta-drilldown');
    if (ctaOverview) ctaOverview.style.display = activeTheme ? 'none' : 'block';
    if (ctaDrilldown) ctaDrilldown.style.display = activeTheme ? 'block' : 'none';
    if (IS_MOBILE()) {
      activeTheme ? drawMobileDrilldown(activeTheme, 'theme') : drawMobileCluster('theme');
      return;
    }
    if (!activeTheme && _deferClusterFirstPaint) return;
    activeTheme ? drawThemeDrilldown(activeTheme) : drawThemeCluster();
  }
  
  // Use the mobile rendering (scrollable/tappable list) primarily on touch devices.
  // This prevents narrow desktop previews from accidentally switching away from the
  // clustered layout that uses authored anchor points (`THEME_POSITIONS`).
  const IS_MOBILE = () =>
    window.innerWidth <= 900 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  
  function render() {
    // Bubble chart: themes only. Overview: activeTheme null; drill: theme key set.
    syncDrilldownBackLinks();
    updateCaption();
    drawTrendsChart();
    
    // Toggle CTA visibility based on view state
    const ctaOverview = document.getElementById('cta-overview');
    const ctaDrilldown = document.getElementById('cta-drilldown');
    if (ctaOverview) ctaOverview.style.display = activeTheme ? 'none' : 'block';
    if (ctaDrilldown) ctaDrilldown.style.display = activeTheme ? 'block' : 'none';
    
    if (IS_MOBILE()) {
      activeTheme ? drawMobileDrilldown(activeTheme, 'theme') : drawMobileCluster('theme');
      return;
    }
    if (!activeTheme && _deferClusterFirstPaint) return;
    activeTheme ? drawThemeDrilldown(activeTheme) : drawThemeCluster();
  }
  
  // ── CAPTION ───────────────────────────────────────────────────────────────
  
  const TAS_RANK_TITLE = 'The main characters';
  const TAS_RANK_SUBTITLE =
    'How attention given to different actors changed across 1950–2024';
  const TAS_TRENDS_ANNOTATIONS = {
    nyt: 'Coverage opens with Soviet rivalry as the dominant frame, before <span style="color:#7aabcf;">national institutional</span> space activities take center stage. The landscape changes in the past decade, as the <span style="color:#8cbf7a;">private sector</span> overtakes all other actors, reframing space through the language of markets, resource extraction, and individual ambition.',
    politics: 'Following the focus on geopolitical rivalry during the peak of the space race in the 1960s, political rhetoric remains anchored in <span style="color:#7aabcf;">U.S. leadership</span> across subsequent decades. In the 2020s, <span style="color:#c9956a;">international partnerships</span> emerge as an increasingly prominent mode of action, reflected in broader emphasis on cooperation in space governance.',
  };
  const TAS_SECTION_TITLE_PLANETS = 'The recurring themes';
  const TAS_PLANETS_OVERVIEW_SUBTITLE =
    'How attention given to different themes changed across 1950–2024';
  
  function updateTrendsSubtitle() {
    const el = document.getElementById('page-subtitle-trends');
    if (el) el.textContent = TAS_RANK_SUBTITLE;
  }

  function updateTrendsAnnotation() {
    const el = document.getElementById('rank-annotation');
    if (!el) return;
    el.innerHTML = TAS_TRENDS_ANNOTATIONS[trendSrc] || '';
  }
  
  function updateSectionTitles() {
    const rankH = document.getElementById('rank-section-title');
    if (rankH) rankH.textContent = TAS_RANK_TITLE;
    const planetsH = document.getElementById('bubble-section-title');
    if (!planetsH) return;
    if (activeTheme && DATA?.themes?.[activeTheme]) {
      const themeLabel = DATA.themes[activeTheme].label || activeTheme;
      // In drilldown, the section title becomes the selected theme.
      planetsH.textContent = themeLabel;
    } else {
      planetsH.textContent = TAS_SECTION_TITLE_PLANETS;
    }
  }
  
  function setCaptionText(el, mainText, subText) {
    if (!el) return;
    el.innerHTML = '';
    const main = document.createElement('span');
    main.textContent = mainText + ' ';
    el.appendChild(main);
  
    if (subText) {
      const sub = document.createElement('div');
      sub.style.cssText = 'font-size:0.88em;color:rgba(240,240,240,0.74);margin-top:5px;font-weight:400;';
      sub.textContent = subText;
      el.appendChild(sub);
    }
  }
  
  function planetSrcShortLabel() {
    return { nyt: 'headlines', politics: 'politics' }[planetSrc] || planetSrc;
  }
  
  function updatePlanetsSubtitle() {
    const captionEl = document.getElementById('page-subtitle-planets');
    if (!captionEl) return;
    if (!activeTheme) {
      setCaptionText(captionEl, TAS_PLANETS_OVERVIEW_SUBTITLE, null);
    } else {
      setCaptionText(
        captionEl,
        `Share of a decade's ${planetSrcShortLabel()} where this theme is prominent`,
        null,
      );
    }
  }
  
  function updateCaption() {
    updateTrendsSubtitle();
    updateTrendsAnnotation();
    updatePlanetsSubtitle();
    updateSectionTitles();
  }
  
  // ── DESCRIPTION BLOCK ─────────────────────────────────────────────────────
  
  
  
  
  
  // ── SVG HELPERS ───────────────────────────────────────────────────────────
  
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }
  function tx(text, attrs, parent) {
    const e = el('text', attrs, parent);
    e.textContent = text;
    return e;
  }
  
  // ── GEOMETRY ──────────────────────────────────────────────────────────────
  
  function svgW() {
    // Use chart-wrap width (not bubble-svg's parent) so the legend column is
    // already excluded — giving the same value on first load as after a resize.
    const cw = document.getElementById('chart-wrap');
    return (cw ? cw.clientWidth : null) || 800;
  }
  function drillSvgW() {
    // Use full legend-chart-wrap width so drilldown matches rank chart width above.
    const legendWrap = document.getElementById('legend-chart-wrap');
    if (legendWrap) return Math.max(400, legendWrap.clientWidth);
    // Fallback: add back the legend column width
    const legendEl = document.getElementById('cluster-legend');
    const legendW = legendEl ? (legendEl.offsetWidth || 200) : 200;
    return svgW() + legendW;
  }
  function chartW() {
    // Use DRILL_CHART_PAD when in drilldown mode so the last decade's circle
    // (which can be up to DRILL_MAX_R wide) doesn't clip against the right edge.
    const rPad = _inDrilldown ? DRILL_CHART_PAD : CHART_PAD;
    if (trendsLayout) {
      return trendsLayout.W - trendsLayout.leftCol - trendsLayout.rightPad - rPad;
    }
    // In drilldown, left origin is LABEL_W to clear row labels.
    const leftCol = _inDrilldown ? LABEL_W : TRENDS_LEFT_COL;
    return svgW() - leftCol - rPad;
  }
  
  function yearToX(y) {
    // In drilldown, left origin is LABEL_W to clear the row labels.
    const left = trendsLayout ? trendsLayout.leftCol : (_inDrilldown ? LABEL_W : TRENDS_LEFT_COL);
    return left + ((y - MIN_YEAR) / (MAX_YEAR - MIN_YEAR)) * chartW();
  }
  function axisPlotLeft() {
    return trendsLayout ? trendsLayout.leftCol : (_inDrilldown ? LABEL_W : TRENDS_LEFT_COL);
  }
  function landmarkClipW(_svgW) {
    if (_svgW != null) return _svgW;
    if (trendsLayout) return trendsLayout.W;
    return svgW();
  }
  function decadeX(d) { return yearToX(d); }
  const MIN_SHARE = 0.008;
  
  function fmtPct(share) {
    const pct = share * 100;
    return pct < 1 ? pct.toFixed(1) + '%' : Math.round(pct) + '%';
  }
  function clusterRadius(share, minShare, maxShare) {
    if (!share || share <= 0) return 0;
    const range = maxShare - minShare;
    if (range <= 0) return MAX_CLUSTER_R;
    return MIN_CLUSTER_R + Math.sqrt((share - minShare) / range) * (MAX_CLUSTER_R - MIN_CLUSTER_R);
  }
  function shareToRRanged(share, minShare, maxShare, maxR) {
    if (!share || share <= MIN_SHARE) return 0;
    // Scale from 0 (not minShare) so that a value of 26% when max is 40%
    // actually looks like ~65% of the max bubble — not near-zero because
    // it happens to be close to the minimum non-zero value.
    if (maxShare <= 0) return maxR;
    return 8 + Math.sqrt(share / maxShare) * (maxR - 8);
  }
  
  // ── DEFS ──────────────────────────────────────────────────────────────────
  
  function buildDefs(svg) {
    const defs = el('defs', {}, svg);
    // Bubble noise filter — strong grain for filled circles
    const f = el('filter', { id: 'noise', x: '0%', y: '0%', width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '1.5', numOctaves: '4', stitchTiles: 'stitch', result: 'n' }, f);
    el('feColorMatrix', { in: 'n', type: 'saturate', values: '0', result: 'gn' }, f);
    el('feBlend', { in: 'SourceGraphic', in2: 'gn', mode: 'soft-light', result: 'b' }, f);
    el('feComposite', { in: 'b', in2: 'SourceGraphic', operator: 'in' }, f);
    // Line noise filter — much lighter grain so thin strokes don't look uneven
    const lf = el('filter', { id: 'line-noise', x: '-5%', y: '-50%', width: '110%', height: '200%', 'color-interpolation-filters': 'sRGB' }, defs);
    el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '3', stitchTiles: 'stitch', result: 'n' }, lf);
    el('feColorMatrix', { in: 'n', type: 'saturate', values: '0', result: 'gn' }, lf);
    const feMerge1 = el('feComponentTransfer', { in: 'gn', result: 'lgn' }, lf);
    el('feFuncA', { type: 'linear', slope: '0.18' }, feMerge1); // very subtle — 18% grain opacity
    el('feBlend', { in: 'SourceGraphic', in2: 'lgn', mode: 'soft-light', result: 'b' }, lf);
    el('feComposite', { in: 'b', in2: 'SourceGraphic', operator: 'in' }, lf);
    for (const [key, hex] of Object.entries(THEME_COLORS)) {
      const g = el('linearGradient', { id: `grad-${key}`, x1: '0.15', y1: '0', x2: '0.5', y2: '1' }, defs);
      el('stop', { offset: '0%', 'stop-color': hex, 'stop-opacity': '1.0' }, g);
      el('stop', { offset: '100%', 'stop-color': hex, 'stop-opacity': '0.70' }, g);
    }
    for (const [key, hex] of Object.entries(ACTOR_COLORS)) {
      const g = el('linearGradient', { id: `agrad-${key}`, x1: '0.15', y1: '0', x2: '0.5', y2: '1' }, defs);
      el('stop', { offset: '0%', 'stop-color': hex, 'stop-opacity': '1.0' }, g);
      el('stop', { offset: '100%', 'stop-color': hex, 'stop-opacity': '0.72' }, g);
    }
  }
  
  // ── LANDMARK FILTERING ────────────────────────────────────────────────────
  
  /**
   * @param {string|null} filterTheme  Theme key when drilling a bubble; null on rank chart / actor drill.
   * @param {{ timelineView?: string, actorDrill?: string }} [opts]
   *        timelineView: 'theme' | 'actor' — which curated rank-chart list to use.
   *        actorDrill: when set, only milestones tagged for that actor (actor bubble drilldown).
   */
  function getLandmarks(filterTheme, opts = {}) {
    const { timelineView, actorDrill } = opts;
  
    if (actorDrill) {
      const rows = TIMELINE_LANDMARKS_ACTOR.filter(([y, lab]) => {
        const tags = LANDMARK_ACTOR_TAGS[`${y}|${lab}`];
        return tags && tags.includes(actorDrill);
      });
      return landmarkRowsToObjects(rows);
    }
  
    if (filterTheme) {
      const out = [];
      for (const [y, lab] of TIMELINE_LANDMARKS_THEME) {
        const lm = landmarkRowsToObjects([[y, lab]])[0];
        if (!lm) continue;
        if (!lm.themes || !lm.themes.length || lm.themes.includes(filterTheme)) out.push(lm);
      }
      return out;
    }
  
    if (timelineView === 'actor') return landmarkRowsToObjects(TIMELINE_LANDMARKS_ACTOR);
    return landmarkRowsToObjects(TIMELINE_LANDMARKS_THEME);
  }
  
  // ── AXIS ──────────────────────────────────────────────────────────────────
  
  /** Timeline reserves one milestone row (no vertical stacking); curation limits overlap. */
  function calculateMaxLandmarkOffset(_landmarks, _svgW) {
    return 0;
  }
  
  /**
   * @param {object} [opts]
   * @param {number} [opts.baselineY]  Y of horizontal time baseline (default: below `rowsH` using PAD_TOP).
   * @param {number} [opts.hLineX1]    Optional override for axis line start X (e.g. join plot corner).
   * @param {number} [opts.hLineX2]    Optional override for axis line end X.
   * @param {string} [opts.timelineView]  'theme' | 'actor' — passed through to `getLandmarks`.
   * @param {string} [opts.actorDrill]    Actor key when drawing actor drilldown axis.
   */
  function drawAxis(svg, rowsH, filterTheme, opts = {}) {
    const skipLandmarks = !!opts.skipLandmarks;
    const disableTooltips = !!opts.disableTooltips;
    const landmarks = skipLandmarks
      ? []
      : getLandmarks(filterTheme, {
          timelineView: opts.timelineView,
          actorDrill: opts.actorDrill,
        });
    const axisY     = opts.baselineY != null ? opts.baselineY : PAD_TOP + rowsH + AXIS_EXTRA;
    const decY      = axisY + DEC_LBL_H;
    const decLabelFill = opts.decLabelFill || '#f0f0f0';
  
    const maxOff = calculateMaxLandmarkOffset(landmarks, _activeDrillW);
  
    const hx1 = opts.hLineX1 != null ? opts.hLineX1 : yearToX(1950);
    const hx2 = opts.hLineX2 != null ? opts.hLineX2 : yearToX(MAX_YEAR);
    el('line', { x1: hx1, y1: axisY, x2: hx2, y2: axisY, stroke: '#f0f0f0', 'stroke-width': '1', opacity: '0.85' }, svg);
  
    DECADES.forEach(dec => {
      const x = decadeX(dec);
      // Draw tick mark above decade label
      el('line', { x1: x, y1: axisY - 3, x2: x, y2: axisY + 3, stroke: '#f0f0f0', 'stroke-width': '0.75', opacity: '0.65' }, svg);
      // Decade label in mono font
      tx(dec + 's', { x: x, y: decY, 'text-anchor': 'middle', style: `font-family:var(--font-mono);font-size:16px;font-weight:500;letter-spacing:0.05em;fill:${decLabelFill};` }, svg);
    });
  
    const lmLbl = decY + 2 + LM_TICK + LM_LBL_H - 2;
    landmarks.forEach(lm => {
      const x = yearToX(lm.year);
      const rPad = _inDrilldown ? DRILL_CHART_PAD : CHART_PAD;
      if (x < axisPlotLeft() || x > landmarkClipW(_activeDrillW) - rPad + 8) return;
      const yOff = 0;
      el('line', { x1: x, y1: axisY, x2: x, y2: decY + 2 + LM_TICK + yOff, stroke: '#f0f0f0', 'stroke-width': '0.5', opacity: '0.45' }, svg);
      const t = tx(lm.label, { x, y: lmLbl + yOff, 'text-anchor': 'middle', style: 'font-family:"Archivo Narrow",sans-serif;font-size:13px;font-style:italic;fill:#f0f0f0;opacity:0.50;' }, svg);
      if (!disableTooltips) {
        t.addEventListener('mouseenter', e => showTip(e, `<span class="tt-title">${lm.label} · ${lm.year}</span><span class="tt-body">${lm.desc}</span>`));
        t.addEventListener('mousemove', moveTip);
        t.addEventListener('mouseleave', hideTip);
      }
    });
  
    PAD_BOTTOM = AXIS_EXTRA + DEC_LBL_H + LM_TICK + LM_LBL_H + maxOff + 6;
  }

  function drawTrendsVertGrid(svg, yTop, yBot) {
    const g = el('g', { class: 'rank-grid' }, svg);
    DECADES.forEach(dec => {
      const x = decadeX(dec);
      el('line', {
        x1: x, y1: yTop, x2: x, y2: yBot,
        stroke: 'rgba(240,240,240,0.20)', 'stroke-width': 1.2, 'stroke-dasharray': '4,4',
      }, g);
    });
  }
  
  /** Left margin: rank axis (#1 … #n, most/least covered) to the left of the time scale. */
  const TRENDS_LEFT_COL = 108;
  /** Right gutter (no rank scale here; end labels use in-plot label band). */
  const TRENDS_RIGHT_PAD = 28;
  /** Gap (px) between a line’s last point and the start of its text label. */
  const TRENDS_LABEL_LINE_GAP = 7;
  // Smaller top inset so the plot gets taller upward without moving the axis.
  const TRENDS_PAD_TOP = 8;
  const TRENDS_ACTOR_COLORS = {
    national_state_us:        '#7aabcf',
    rival_space_powers:       '#c97c5d',
    private_sector:           '#8cbf7a',
    international_institutions: '#c9956a',  // warm terracotta — distinct from green private sector
    astronauts_cosmonauts:    '#d4a45a',
    scientific_community:     '#b09e72',
  };

  const TRENDS_HIGHLIGHT_ACTORS_BY_SOURCE = {
    nyt:      new Set(['national_state_us', 'private_sector']),
    politics: new Set(['national_state_us', 'international_institutions']),
  };
  /** Rank label for axis and tooltips (e.g. #1, #2). */
  function trendsOrdinalRank(r) {
    return `#${r}`;
  }
  
  /** d3.line with curveMonotoneX — discrete ranks along increasing decade x. */
  function trendsBumpLinePath(pts) {
    if (!pts || pts.length < 2) return '';
    const d3n = typeof d3 !== 'undefined' ? d3 : typeof window !== 'undefined' ? window.d3 : null;
    if (!d3n) return '';
    return d3n.line().x(d => d.x).y(d => d.y).curve(d3n.curveMonotoneX)(pts) || '';
  }
  
  /** Rank chart: hover-only dimming.
   *  On hover, ticks on decades that DO have a landmark callout for this actor
   *  stay fully visible — they are the "story points". Only ticks on plain
   *  decades (no callout) are dimmed along with the other series. */
  function setTrendsSeriesHighlight(svg, linesG, hoverKeyOrNull) {
    const calloutDecs = hoverKeyOrNull ? getCalloutDecades(hoverKeyOrNull) : new Set();

    if (linesG) {
      linesG.querySelectorAll('.rank-series').forEach(node => {
        if (!hoverKeyOrNull) {
          node.style.opacity = '';
          node.style.pointerEvents = '';
          node.style.cursor = '';
          node.classList.remove('rank-series--ghost');
          // Restore original dash/weight based on whether highlighted actor
          const sid = node.getAttribute('data-series');
          const wasHighlighted = isTrendsHighlightedActor(sid);
          node.querySelectorAll('.rank-series-line').forEach(path => {
            const sid2 = node.getAttribute('data-series');
            const wasH = isTrendsHighlightedActor(sid2);
            path.setAttribute('stroke-dasharray', 'none');
            path.setAttribute('stroke-width', '2.5');
            path.setAttribute('opacity', wasH ? '0.92' : '0.78');
            path.setAttribute('stroke', wasH
              ? (TRENDS_ACTOR_COLORS[sid2] || 'rgba(240,240,240,0.75)')
              : 'rgba(240,240,240,0.72)');
          });
          node.querySelectorAll('.rank-tick').forEach(tick => { tick.style.opacity = ''; });
          return;
        }
        const sid = node.getAttribute('data-series');
        const on = sid === hoverKeyOrNull;
        if (on) {
          node.style.opacity = '1';
          node.querySelectorAll('.rank-series-line').forEach(path => {
            path.setAttribute('stroke-dasharray', 'none');
            path.setAttribute('stroke-width', '4');
            path.setAttribute('opacity', '1');
          });
          node.querySelectorAll('.rank-tick').forEach(tick => {
            const dec = parseInt(tick.getAttribute('data-decade'), 10);
            tick.style.opacity = (dec && calloutDecs.has(dec)) ? '1' : '0.2';
          });
        } else {
          node.style.opacity = '0.08';
        }
        node.style.pointerEvents = '';
        node.style.cursor = 'default';
        node.classList.remove('rank-series--ghost');
      });
    }
    if (svg) {
      svg.querySelectorAll('.rank-end-label').forEach(node => {
        const id = node.getAttribute('data-series');
        if (!hoverKeyOrNull) {
          node.style.opacity = '';
          node.classList.remove('rank-label--ghost');
          node.style.pointerEvents = '';
          node.style.cursor = '';
          node.querySelector('text')?.style.setProperty('fill', 'rgba(240,240,240,0.72)');
          return;
        }
        const active = id === hoverKeyOrNull;
        node.style.opacity = active ? '1' : '0.08';
        const color = 'rgba(240,240,240,0.72)';
        node.querySelector('text')?.style.setProperty('fill', color);
        node.style.pointerEvents = '';
        node.style.cursor = 'default';
        node.classList.remove('rank-label--ghost');
      });
    }
  }
  
  /** Vertical position for rank `r` (1 = top). */
  function trendsBumpRankY(rank, nRanks, plotTop, plotH) {
    if (nRanks <= 0) return plotTop;
    return plotTop + ((rank - 0.5) / nRanks) * plotH;
  }
  
  // ── RANK CHART ANIMATION CSS ──────────────────────────────────────────────
  // Injected once so it lives alongside the drawing code that sets the CSS vars.
  (function injectTrendsAnimationCSS() {
    if (document.getElementById('rank-anim-style')) return;
    const s = document.createElement('style');
    s.id = 'rank-anim-style';
    s.textContent = `
      @keyframes tas-draw-line {
        from { stroke-dashoffset: var(--path-length, 2000); }
        to   { stroke-dashoffset: 0; }
      }
      @keyframes tas-tick-fade {
        from { opacity: 0; transform: scaleY(0); }
        to   { opacity: 1; transform: scaleY(1); }
      }
      @keyframes tas-label-fade {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .rank-series-line {
        stroke-dasharray: var(--path-length, 2000);
        stroke-dashoffset: var(--path-length, 2000);
        animation: tas-draw-line 1.1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        animation-delay: var(--line-delay, 0s);
      }
      .rank-tick {
        transform-origin: center center;
        transform-box: fill-box;
        opacity: 0;
        animation: tas-tick-fade 0.25s ease forwards;
        animation-delay: var(--tick-delay, 0s);
      }
      .rank-end-label {
        opacity: 0;
        animation: tas-label-fade 0.3s ease forwards;
        animation-delay: var(--label-delay, 0s);
      }
    `;
    document.head.appendChild(s);
  })();

  function isTrendsHighlightedActor(actorKey) {
    return TRENDS_HIGHLIGHT_ACTORS_BY_SOURCE[trendSrc]?.has(actorKey) || false;
  }

  function drawTrendsChart() {
    const svg = document.getElementById('rank-svg');
    const block = document.getElementById('rank-block');
    const stage = document.getElementById('rank-stage');
    if (!svg || !block) return;
    if (!DATA) {
      svg.innerHTML = '';
      return;
    }

    // Ensure drilldown state doesn't bleed into the rank chart layout.
    _inDrilldown = false;
    _activeDrillW = null;
    trendsLayout = null;
  
    const TW = Math.max(300, block.getBoundingClientRect().width || block.clientWidth || 800);

    // Chart height is cached per render — cleared on resize. Ensures stable layout across source switches.
    if (!drawTrendsChart._cachedH) {
      const stageH = stage ? stage.getBoundingClientRect().height : null;
      let measured = (Number.isFinite(stageH) && stageH > 0)
        ? Math.round(stageH)
        : (block.clientHeight || Math.round(block.getBoundingClientRect().height) || 0);
      if (!Number.isFinite(measured) || measured < 200) {
        measured = Math.round(Math.max(420, window.innerHeight * 0.78));
      }
      drawTrendsChart._cachedH = measured;
    }
    const blockH = drawTrendsChart._cachedH;
  
    trendsLayout = { W: TW, leftCol: TRENDS_LEFT_COL, rightPad: TRENDS_RIGHT_PAD };
    _activeDrillW = TW;
  
    const keys = getActorsForSource(trendSrc);
    const labelFor = key => ACTOR_LABELS_MAP[key] || key;
    const nRanks = keys.length;
  
    // Rank chart: actors only; curated actor timeline milestones.
    const maxLmOff = calculateMaxLandmarkOffset(getLandmarks(null, { timelineView: 'actor' }), TW);
    const axisBlock = AXIS_EXTRA + DEC_LBL_H + LM_TICK + LM_LBL_H + maxLmOff + 6;
  
    let plotH = blockH - TRENDS_PAD_TOP - axisBlock - 4;
    plotH = Math.max(120, plotH);
    const rowsH = TRENDS_PAD_TOP + plotH;
    const svgH = rowsH + axisBlock;
  
    svg.innerHTML = '';
    buildDefs(svg);
    svg.setAttribute('viewBox', `0 0 ${TW} ${svgH}`);
    svg.setAttribute('height', svgH);
    svg.style.display = 'block';
    svg.style.width = '100%';
  
    const plotTop = TRENDS_PAD_TOP;
    const plotBot = TRENDS_PAD_TOP + plotH;
    const xPlotLeft = axisPlotLeft();
    const xPlotRight = xPlotLeft + chartW();
  
    drawTrendsVertGrid(svg, plotTop, plotBot);
  
    const rankCaptionStyle = 'font-family:var(--font-mono,monospace);font-size:12px;font-weight:500;letter-spacing:0.05em;fill:rgba(240,240,240,0.58);';
    const rankOrdinalStyle = 'font-family:var(--font-mono,monospace);font-size:16px;font-weight:400;fill:rgba(240,240,240,0.84);';
    const rankMidStyle = 'font-family:var(--font-mono,monospace);font-size:16px;font-weight:400;fill:rgba(240,240,240,0.74);';
    // Neutral (non-highlight) series: a touch dimmer, but still above decade labels.
    const TRENDS_NEUTRAL_STROKE = 'rgba(240,240,240,0.78)';
    for (let r = 1; r <= nRanks; r++) {
      const y = trendsBumpRankY(r, nRanks, plotTop, plotH);
      el('line', {
        x1: xPlotLeft, y1: y, x2: xPlotRight, y2: y,
        stroke: 'rgba(240,240,240,0.12)', 'stroke-width': 1.3, 'stroke-dasharray': '4,4',
      }, svg);
    }
  
    const rankAxisG = el('g', { class: 'rank-axis' }, svg);
    el('line', {
      x1: xPlotLeft,
      y1: plotTop,
      x2: xPlotLeft,
      y2: rowsH + 1,
      stroke: 'rgba(240,240,240,0.42)',
      'stroke-width': 1,
      'stroke-linecap': 'square',
    }, rankAxisG);
    const rankLabelX = xPlotLeft - 10;
    for (let r = 1; r <= nRanks; r++) {
      const y = trendsBumpRankY(r, nRanks, plotTop, plotH);
      el('line', {
        x1: xPlotLeft - 6, y1: y, x2: xPlotLeft, y2: y,
        stroke: 'rgba(240,240,240,0.24)', 'stroke-width': 1,
      }, rankAxisG);
      if (r === 1) {
        tx(trendsOrdinalRank(1), {
          x: rankLabelX, y: y - 5, 'text-anchor': 'end', style: rankOrdinalStyle,
        }, rankAxisG);
        tx('most covered', {
          x: rankLabelX, y: y + 9, 'text-anchor': 'end', style: rankCaptionStyle,
        }, rankAxisG);
      } else if (r === nRanks && nRanks > 1) {
        tx(trendsOrdinalRank(r), {
          x: rankLabelX, y: y - 5, 'text-anchor': 'end', style: rankOrdinalStyle,
        }, rankAxisG);
        tx('least covered', {
          x: rankLabelX, y: y + 9, 'text-anchor': 'end', style: rankCaptionStyle,
        }, rankAxisG);
      } else {
        tx(trendsOrdinalRank(r), {
          x: rankLabelX, y: y + 4, 'text-anchor': 'end', style: rankMidStyle,
        }, rankAxisG);
      }
    }
  
    const ranksByDec = {};
    DECADES.forEach(dec => {
      const m = trendsDecadeRanks(keys, dec, 'actor', trendSrc);
      if (m) ranksByDec[dec] = m;
    });
  
    const linesG = el('g', { class: 'rank-series-wrap' }, svg);
    const annoG = el('g', { class: 'rank-annotations' }, svg);
    const labelRows = [];

    function clearTrendsAnnotations() {
      if (annoG) annoG.innerHTML = '';
    }

    // Cache last-drawn series points so annotations can reference the actual
    // tick position on the actor's line for each decade.
    const seriesPtsByKey = {};

    function renderTrendsActorAnnotations(actorKeyOrNull) {
      clearTrendsAnnotations();
      if (!actorKeyOrNull) return;
      const entry = TRENDS_ACTOR_CALLOUTS[actorKeyOrNull];
      const items = (entry ? (entry[trendSrc] || entry.nyt || []) : []).filter(d => DECADES.includes(d.decade));
      if (!items.length) return;

      const maxItems = 10;
      const pick = items.slice(0, maxItems);
      const tickHalf = 8;
      const gap = 16;  // larger gap so text clears the line
      const lineH = 15; // px between label line 1 and year line

      // Split each label into text + year (everything inside parentheses is the year part)
      function splitLabel(text) {
        const m = text.match(/^(.*?)\s*(\([^)]+\))\s*$/);
        if (m) return { main: m[1].trim(), year: m[2].trim() };
        return { main: text, year: null };
      }

      // First pass: resolve x/y for each item and decide above/below placement.
      // Strategy: prefer above; force below if near top. Then detect collisions
      // between adjacent annotations sharing close x positions and flip one.
      const resolved = pick.map((it, i) => {
        const pts = seriesPtsByKey[actorKeyOrNull] || [];
        const target = pts.find(p => p.dec === it.decade);
        if (!target) return null;
        const { main, year } = splitLabel(String(it.label || '').trim());
        const x = target.x;
        const y = target.y;
        const nearTop = y < plotTop + 50;
        // Respect explicit placeAbove hint from callout data; otherwise prefer above unless near top
        const preferAbove = it.placeAbove != null ? it.placeAbove : !nearTop;
        return { x, y, main, year, preferAbove, placeAbove: preferAbove, i, hasHint: it.placeAbove != null };
      }).filter(Boolean);

      // Collision pass: for pairs of annotations that are x-close, ensure they go opposite sides
      // but only if neither has an explicit placement hint
      for (let a = 0; a < resolved.length; a++) {
        for (let b = a + 1; b < resolved.length; b++) {
          const ra = resolved[a], rb = resolved[b];
          if (ra.hasHint && rb.hasHint) continue; // both pinned — skip
          const xDist = Math.abs(ra.x - rb.x);
          if (xDist < 120) {
            // They're close enough to potentially collide — force one above, one below
            if (!ra.hasHint) ra.placeAbove = true;
            if (!rb.hasHint) rb.placeAbove = false;
          }
        }
      }

      const labelStyle = 'font-family:"Archivo Narrow",sans-serif;font-size:13px;font-style:italic;fill:#f0f0f0;opacity:0.65;';
      const yearStyle  = 'font-family:"Archivo Narrow",sans-serif;font-size:12px;font-style:italic;fill:#f0f0f0;opacity:0.45;';
      const MAX_ANNO_CHARS = 25;
      function wrapAnno(s) {
        if (!s || s.length <= MAX_ANNO_CHARS) return { line1: s, line2: null };
        const cut = s.lastIndexOf(' ', MAX_ANNO_CHARS);
        const breakAt = cut > 6 ? cut : MAX_ANNO_CHARS;
        return { line1: s.slice(0, breakAt).trim(), line2: s.slice(breakAt).trim() };
      }

      resolved.forEach(({ x, y, main: mainRaw, year, placeAbove }) => {
        const { line1: annoLine1, line2: annoLine2 } = wrapAnno(mainRaw);
        const annoLineH = 14;
        const totalAnnoH = annoLine2 ? annoLineH * 2 : annoLineH;
        const totalH = year ? lineH : 0;
        const rawLabelY = placeAbove
          ? y - tickHalf - gap - totalAnnoH - (year ? lineH : 0)
          : y + tickHalf + gap + annoLineH;
        const labelY = Math.max(plotTop + 14, Math.min(plotBot - totalAnnoH - totalH - 4, rawLabelY));
        const anno2Y = labelY + annoLineH;
        const yearY  = (annoLine2 ? anno2Y : labelY) + lineH + 2;
        const longestLine = annoLine2 && annoLine2.length > annoLine1.length ? annoLine2 : annoLine1;
        const approxHalfW = Math.min(100, Math.max(40, Math.round(longestLine.length * 2.8)));
        const textX = Math.max(xPlotLeft + approxHalfW + 4, Math.min(xPlotRight - approxHalfW - 4, x));
        const g = el('g', { class: 'rank-anno', 'pointer-events': 'none' }, annoG);
        const charW = 6.2;
        const maxLineW = Math.max(annoLine1.length, annoLine2 ? annoLine2.length : 0) * charW;
        const padX = 10, padY = 6;
        const backdropH = totalAnnoH + (year ? lineH + 4 : 0) + padY * 2;
        el('rect', {
          x: textX - maxLineW / 2 - padX,
          y: labelY - annoLineH - padY,
          width: maxLineW + padX * 2,
          height: backdropH,
          fill: 'rgba(18,18,18,0.76)',
          rx: 2,
        }, g);
        const t = el('text', { x: textX, y: labelY, 'text-anchor': 'middle', style: labelStyle }, g);
        t.textContent = annoLine1;
        if (annoLine2) {
          const t2 = el('text', { x: textX, y: anno2Y, 'text-anchor': 'middle', style: labelStyle }, g);
          t2.textContent = annoLine2;
        }
        if (year) {
          const ty = el('text', { x: textX, y: yearY, 'text-anchor': 'middle', style: yearStyle }, g);
          ty.textContent = year;
        }
      });
    }

    function setTrendsHoverState(kOrNull) {
      // If something is pinned and we're clearing hover, keep the pin visible
      const effective = kOrNull || _pinnedActor || null;
      setTrendsSeriesHighlight(svg, linesG, effective);
      renderTrendsActorAnnotations(effective);
    }

    function togglePin(k) {
      if (_pinnedActor === k) {
        _pinnedActor = null;
        setTrendsHoverState(null);
      } else {
        _pinnedActor = k;
        setTrendsHoverState(k);
      }
    }

    const drawOrder = [...keys].sort((a, b) => {
      const ah = isTrendsHighlightedActor(a) ? 1 : 0;
const bh = isTrendsHighlightedActor(b) ? 1 : 0;
      return ah - bh; // non-highlighted first, highlighted last (on top)
    });

    let lineIndex = 0;
    drawOrder.forEach(k => {
      const seriesG = el('g', { class: 'rank-series', 'data-series': k }, linesG);
      const pts = [];
      DECADES.forEach(dec => {
        // Politics has no data for the 1950s — skip so the line starts at 1960
        if (dec === 1950 && trendSrc === 'politics') return;
        const m = ranksByDec[dec];
        if (!m || m[k] == null) return;
        const rank = m[k];
        const share = getActorShare(trendSrc, k, dec);
        const y = trendsBumpRankY(rank, nRanks, plotTop, plotH);
        pts.push({ x: decadeX(dec), y, dec, share, rank });
      });
      if (pts.length < 2) return;
  
      let dTrim = trendsBumpLinePath(pts);
      if (!dTrim) {
        dTrim = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ').trim();
      }
  
      const isHighlighted = isTrendsHighlightedActor(k);
      const lineStroke    = isHighlighted
        ? (TRENDS_ACTOR_COLORS[k] || 'rgba(240,240,240,0.75)')
        : 'rgba(240,240,240,0.72)';
      const seriesStrokeW = 2.5;
      const tickStrokeW   = 1.8;
      const seriesOpacity = isHighlighted ? '0.92' : '0.78';
      const strokeDash    = 'none';

      el('path', {
        d: dTrim,
        fill: 'none',
        stroke: 'transparent',
        'stroke-width': 14,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
        'pointer-events': 'stroke',
      }, seriesG);

      const linePathEl = el('path', {
        d: dTrim,
        fill: 'none',
        stroke: lineStroke,
        'stroke-width': seriesStrokeW,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
        'stroke-dasharray': strokeDash,
        'pointer-events': 'none',
        opacity: seriesOpacity,
        class: 'rank-series-line',
      }, seriesG);
      
      // Calculate path length for stroke-dasharray animation.
      // Use requestAnimationFrame to ensure the SVG has laid out the path.
      const delay = lineIndex * 0.12; // Stagger each line by 120ms
      lineIndex++;
      requestAnimationFrame(() => {
        const pathLength = linePathEl.getTotalLength() || 1000;
        linePathEl.style.setProperty('--path-length', pathLength);
        linePathEl.style.setProperty('--line-delay', `${delay}s`);
      });
  
      const tickStroke = lineStroke;
      const tickHalf = 8;
      // Compute timing: ticks appear as the line passes each decade point.
      // Line duration is ~1.1s; ticks fade in briefly after the line passes.
      const lineDuration = 1.1;
      const firstX = pts[0]?.x ?? 0;
      const lastX  = pts[pts.length - 1]?.x ?? firstX;
      const xRange = lastX - firstX || 1;

      pts.forEach(p => {
        // How far along the x-axis is this tick (0 to 1)?
        const frac = (p.x - firstX) / xRange;
        // Tick appears just as the animated line reaches this x-position.
        const tickDelay = (delay + frac * lineDuration + 0.05).toFixed(3);
        const tickEl = el('line', {
          x1: p.x,
          y1: p.y - tickHalf,
          x2: p.x,
          y2: p.y + tickHalf,
          stroke: tickStroke,
          'stroke-width': tickStrokeW,
          'stroke-linecap': 'round',
          class: 'rank-tick',
          'data-decade': p.dec,
          'pointer-events': 'none',
        }, seriesG);
        tickEl.style.setProperty('--tick-delay', `${tickDelay}s`);
        const hit = el('line', {
          x1: p.x,
          y1: p.y - tickHalf - 12,
          x2: p.x,
          y2: p.y + tickHalf + 12,
          stroke: 'transparent',
          'stroke-width': 22,
          'pointer-events': 'stroke',
          class: 'rank-tick-hit',
          'data-decade': p.dec,
        }, seriesG);
        // Rank chart: no tooltips; hover is reserved for annotations + highlighting.
        hit.addEventListener('mouseenter', () => { setTrendsHoverState(k); });
        hit.addEventListener('mouseleave', () => { setTrendsHoverState(null); });
      });
      seriesPtsByKey[k] = pts;
  
      const last = pts[pts.length - 1];
      labelRows.push({
        k,
        y: last.y,
        lab: labelFor(k),
        xEnd: last.x,
      });
  
      seriesG.style.cursor = 'pointer';
      seriesG.addEventListener('mouseover', e => {
        if (seriesG.contains(e.relatedTarget)) return;
        if (!_pinnedActor) setTrendsHoverState(k);
      });
      seriesG.addEventListener('mouseout', e => {
        if (seriesG.contains(e.relatedTarget)) return;
        if (!_pinnedActor) setTrendsHoverState(null);
      });
      seriesG.addEventListener('click', e => {
        e.stopPropagation();
        togglePin(k);
      });
    });
  
    // End labels fade in after all lines have finished drawing.
    // Longest line delay: (drawOrder.length - 1) * 0.12s + 1.1s duration ≈ 1.7s total.
    const labelBaseDelay = (drawOrder.length * 0.12 + 1.1).toFixed(2);

    const labelsG = el('g', { class: 'rank-end-labels' }, svg);
    labelRows.sort((a, b) => a.y - b.y);
    let lastLy = -1e9;
    labelRows.forEach(row => {
      let ly = row.y + 4;
      if (ly - lastLy < 18) ly = lastLy + 18;
      lastLy = ly;
      const lx = row.xEnd + TRENDS_LABEL_LINE_GAP + 8;
      const maxW = Math.max(80, TW - lx - 8);
      const hit = el('g', { class: 'rank-end-label', 'data-series': row.k }, labelsG);
      hit.style.setProperty('--label-delay', `${labelBaseDelay}s`);
      hit.style.cursor = 'default';
      const tw = Math.min(maxW, Math.max(60, row.lab.length * 6.2));
      const th = 18;
      el('rect', {
        x: lx - 2, y: ly - th + 4,
        width: tw + 4, height: th,
        fill: 'transparent', 'pointer-events': 'all',
      }, hit);
      tx(row.lab, {
        x: lx, y: ly,
        'text-anchor': 'start',
        style: 'font-family:"Archivo Narrow",sans-serif;font-size:16px;font-weight:400;fill:rgba(240,240,240,0.72);pointer-events:none;',
      }, hit);
      hit.style.cursor = 'pointer';
      hit.addEventListener('mouseover', e => {
        if (hit.contains(e.relatedTarget)) return;
        if (!_pinnedActor) setTrendsHoverState(row.k);
      });
      hit.addEventListener('mouseout', e => {
        if (hit.contains(e.relatedTarget)) return;
        if (!_pinnedActor) setTrendsHoverState(null);
      });
      hit.addEventListener('click', e => {
        e.stopPropagation();
        togglePin(row.k);
      });
    });

    // Click anywhere outside a line/label clears pin
    const _clearPinOnDoc = (e) => {
      if (_pinnedActor && !e.target.closest('.rank-series') && !e.target.closest('.rank-end-label')) {
        _pinnedActor = null;
        setTrendsHoverState(null);
      }
    };
    document.removeEventListener('click', svg._clearPinHandler);
    svg._clearPinHandler = _clearPinOnDoc;
    document.addEventListener('click', _clearPinOnDoc);
  
    // Axis line runs from the first decade to the last decade plotted,
    // not to xPlotRight — which grows on wide screens beyond decadeX(2020).
    const axisX1 = decadeX(1950);
    const axisX2 = decadeX(2020);
    drawAxis(svg, rowsH, null, {
      baselineY: rowsH,
      hLineX1: axisX1,
      hLineX2: axisX2,
      timelineView: 'actor',
      // Rank chart: remove curated milestone landmarks + disable axis tooltip wiring.
      skipLandmarks: true,
      disableTooltips: true,
      // Match decade label color to bubble chart axis labels.
      decLabelFill: '#f0f0f0',
    });
  
    // For the POLITICS source, we have no data for the 1950s.
    // Render a subtle "insufficient data" label just above the axis, between 1950s and 1960s ticks.
    if (trendSrc === 'politics') {
      const x1950 = decadeX(1950);
      const x1960 = decadeX(1960);
      const labelX = (x1950 + x1960) / 2;
      const labelY = plotBot - 8; // just above the axis baseline
      tx('insufficient data', {
        x: labelX, y: labelY,
        'text-anchor': 'middle',
        style: 'font-family:"Archivo Narrow",sans-serif;font-size:11px;font-style:italic;fill:rgba(240,240,240,0.38);',
      }, svg);
    }

    setTrendsHoverState(null);
  
    trendsLayout = null;
    _activeDrillW = null;
  }
  
  function drawDecadeLines(svg, rowsH, circleExclusions, opts = {}) {
    // In drilldown, we draw a dashed vertical decade line for each decade.
    // But circles live on those decades too, so we “punch gaps” around circles
    // so the line doesn’t visually cut through the data marks.
    const lineTop = Number.isFinite(opts.lineTop) ? opts.lineTop : PAD_TOP;
    const lineBot = Number.isFinite(opts.lineBot) ? opts.lineBot : PAD_TOP + rowsH;
    DECADES.forEach(dec => {
      const x = decadeX(dec);
      const excl = (circleExclusions || [])
        .filter(e => e.dec === dec && e.r > 0)
        .map(e => ({ top: e.cy - e.r - 2, bot: e.cy + e.r + 2 }))
        .sort((a, b) => a.top - b.top);
  
      let cursor = lineTop;
      const drawSeg = (y1, y2) => {
        if (y2 > y1 + 0.5) {
          el('line', { x1: x, y1, x2: x, y2, stroke: '#f0f0f0', 'stroke-width': '0.75', 'stroke-dasharray': '4,4', opacity: '0.85' }, svg);
        }
      };
      for (const gap of excl) {
        drawSeg(cursor, Math.max(cursor, gap.top));
        cursor = Math.max(cursor, gap.bot);
      }
      drawSeg(cursor, lineBot);
    });
  }
  
  // ── SHARE HELPERS ─────────────────────────────────────────────────────────
 function getThemeShare(src, umb, dec) {
  return DATA.bubble_data?.[src]?.[umb]?.[String(dec)] || 0;
}

function getActorShare(src, actor, dec) {
  // Prefer precomputed share from actor_rank_data; fall back to actor_data
  return DATA.actor_rank_data?.[src]?.[actor]?.[String(dec)]?.share
    || DATA.actor_data?.[src]?.[actor]?.[String(dec)]
    || 0;
}

function trendsDecadeRanks(keys, dec, kind, src) {
  if (kind !== 'actor') return null;

  const out = {};

  // Preferred: precomputed ranks from actor_rank_data
  const hasRankData = DATA.actor_rank_data?.[src];

  if (hasRankData) {
    keys.forEach(actor => {
      const item = DATA.actor_rank_data?.[src]?.[actor]?.[String(dec)];
      if (item && Number.isFinite(Number(item.rank))) {
        out[actor] = Number(item.rank);
      }
    });

    if (Object.keys(out).length > 0) return out;
  }

  // Fallback: compute ranks from actor_data shares
  const rows = keys.map(k => ({
    k,
    share: getActorShare(src, k, dec),
  }));

  rows.sort((a, b) =>
    b.share !== a.share ? b.share - a.share : keys.indexOf(a.k) - keys.indexOf(b.k)
  );

  rows.forEach((row, i) => {
    out[row.k] = i + 1;
  });

  return out;
}
  function getThemeOverall(src, umb)     { return DATA.overall_share?.[src]?.[umb] || 0; }
  function getActorOverall(src, actor)   { return DATA.actor_overall_share?.[src]?.[actor] || 0; }
  
function getThemeProminenceShare(src, umb, dec) {
    // Prominence-based share: top_counts_by_decade / decade_doc_counts
    // Used for drilldown bubble sizing — ensures bubble and tooltip are consistent.
    const count    = DATA.top_counts_by_decade?.[src]?.[umb]?.[String(dec)] || 0;
    const decTotal = DATA.decade_doc_counts?.[src]?.[String(dec)] || 1;
    return count / decTotal;
  }
  function getThemeAllMax(umb) {
    // Maximum prominence share across all sources and decades for this theme.
    // Scales drilldown circles consistently so NEWS and POLITICS are comparable.
    let m = 0;
    for (const src of ['nyt','politics']) for (const d of DECADES) m = Math.max(m, getThemeProminenceShare(src, umb, d));
    return m || 1;
  }
  function getThemeAllMin(umb) {
    // Minimum non-zero prominence share (used for radius scaling floor).
    let m = Infinity;
    for (const src of ['nyt','politics']) for (const d of DECADES) { const v = getThemeProminenceShare(src, umb, d); if (v > 0) m = Math.min(m, v); }
    return m === Infinity ? 0 : m;
  }
  function getActorAllMax(actor) {
    // Same as `getThemeAllMax` but for actor drilldowns.
    let m = 0;
    for (const src of ['nyt','politics']) for (const d of DECADES) m = Math.max(m, getActorShare(src, actor, d));
    return m || 1;
  }
  function getActorAllMin(actor) {
    // Same as `getThemeAllMin` but for actor drilldowns.
    let m = Infinity;
    for (const src of ['nyt','politics']) for (const d of DECADES) { const v = getActorShare(src, actor, d); if (v > 0) m = Math.min(m, v); }
    return m === Infinity ? 0 : m;
  }
  
  // ── PLANET LABEL ──────────────────────────────────────────────────────────
  
  function drawPlanetLabel(g, cx, cy, r, label, pct, showPct = false) {
    const words    = label.split(' ');
    const mid      = Math.ceil(words.length / 2);
    const line1    = words.slice(0, mid).join(' ');
    const line2    = words.slice(mid).join(' ');
    const fontSize = r >= 62 ? 18 : r >= 46 ? 16 : 15;
    const pctSize  = r >= 62 ? 13 : 11;
    const lbl      = el('g', { 'pointer-events': 'none' }, g);
    const lineSpacing = fontSize * 1.25;
    const baseStyle = `font-family:"Archivo Narrow",sans-serif;font-size:${fontSize}px;font-weight:500;fill:rgba(255,255,255,0.93);`;
    if (line2) {
      // Two lines: center the block on cy using dominant-baseline:central
      tx(line1, { x: cx, y: cy - lineSpacing / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: baseStyle }, lbl);
      tx(line2, { x: cx, y: cy + lineSpacing / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: baseStyle }, lbl);
      if (showPct) tx(fmtPct(pct), { x: cx, y: cy + lineSpacing + 4, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: `font-family:"Archivo Narrow",sans-serif;font-size:${pctSize}px;fill:rgba(255,255,255,0.55);` }, lbl);
    } else {
      tx(line1, { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: baseStyle }, lbl);
      if (showPct) tx(fmtPct(pct), { x: cx, y: cy + lineSpacing, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: `font-family:"Archivo Narrow",sans-serif;font-size:${pctSize}px;fill:rgba(255,255,255,0.55);` }, lbl);
    }
  }
  
  // ── CLUSTER LAYOUT ────────────────────────────────────────────────────────
  
  const _stablePositions = {};

  // Nudge the whole cluster downward (keeps header area breathable).
  // Tighter vertical padding so the SVG doesn't have unused head/foot room.
  const CLUSTER_PAD_TOP  = 28;
  const CLUSTER_PAD_BOT  = 16;
  const CLUSTER_PAD_SIDE = 60;  // left padding
  const CLUSTER_PAD_RIGHT = 20;  // right padding
  /** < 1 compresses vertical spacing between bubble centers (radii unchanged). */
  const CLUSTER_VERTICAL_SQUASH = 0.955;
  // Keep the overview cluster from being taller than the drilldown chart, so
  // switching between overview and drilldown doesn't change the page bottom.
  const OVERVIEW_SVG_MAX_H =
    PAD_TOP +
    (2 * DRILL_ROW_H + 1 * 16) + // rowsH uses ROW_GAP=16 in drilldown (2 rows now)
    AXIS_EXTRA + DEC_LBL_H + LM_TICK + LM_LBL_H + 6; // maxLmOff is 0 in this project

  function clusterViewportHeight() {
    // Compute the usable height for the bubble SVG inside the scrolly sticky frame.
    //
    // The sticky frame is: window.innerHeight - nav-height - panel top/bottom padding.
    // Inside that frame, the planets header sits above #chart-wrap; the SVG must fit
    // in what remains so the bubbles + axis are always fully visible without scrolling.
    //
    // We read CSS custom property --nav-h (set on :root) and add the panel padding
    // (clamp(8,1.5vh,20) top + clamp(10,2vh,28) bottom ≈ 18–48px depending on vh).
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 57;
    // Panel padding: 1.5vh top + 2vh bottom, clamped. Use live vh.
    const panelPad = Math.min(20, Math.max(8, window.innerHeight * 0.015))
                   + Math.min(28, Math.max(10, window.innerHeight * 0.02));
    const frameH = window.innerHeight - navH - panelPad;
    // Subtract the planets section header (title + subtitle + filters) above chart-wrap.
    const header  = document.querySelector('.bubble-header');
    const headerH = header ? header.getBoundingClientRect().height : 180;
    // Small bottom gutter so the last circle isn't flush with the frame edge.
    const GUTTER = 16;
    const h = Math.max(360, Math.floor(frameH - headerH - GUTTER));
    return h;
  }
  
  function scaledMdsPositions(keys, radii, posObj, W, viewH = clusterViewportHeight()) {
    // “Stable” cluster layout.
    //
    // The overview clusters (themes/actors) should not reshuffle every render.
    // We compute positions once per (keys, width) and cache them, then only clear
    // the cache on resize or when the legend changes the effective chart width.
    //
    // Strategy:
    // - start from authored anchor points in `THEME_POSITIONS` / `ACTOR_POSITIONS`
    //   expressed as relative (px, py) in a usable canvas.
    // - run a few repulsion iterations to enforce minimum spacing (based on MAX_R).
    // - clamp to bounds so nothing clips off-screen.
    const svgH = viewH;
    const cacheKey = keys.join(',') + ':' + W + ':' + viewH + ':' + CLUSTER_VERTICAL_SQUASH;
    if (!_stablePositions[cacheKey]) {
      const MAX_R        = MAX_CLUSTER_R;
      const MAX_LAYOUT_W = 1600;
      const layoutW  = Math.min(W, MAX_LAYOUT_W);
      const offsetX  = (W - layoutW) / 2;
      const usableW  = layoutW - CLUSTER_PAD_SIDE - CLUSTER_PAD_RIGHT;
      const usableHRaw = viewH - CLUSTER_PAD_TOP - CLUSTER_PAD_BOT;
      const usableH = Math.max(220, usableHRaw * CLUSTER_VERTICAL_SQUASH);
  
      const pos = {};
      keys.forEach(k => {
        const { px, py } = posObj[k] || { px: 0.5, py: 0.5 };
        pos[k] = {
          x: offsetX + CLUSTER_PAD_SIDE + px * usableW,
          y: CLUSTER_PAD_TOP + py * usableH,
        };
      });
  
      const MIN_GAP = 24;
      for (let iter = 0; iter < 300; iter++) {
        let moved = false;
        for (let i = 0; i < keys.length; i++) {
          for (let j = i + 1; j < keys.length; j++) {
            const a = keys[i], b = keys[j];
            const dx   = pos[b].x - pos[a].x;
            const dy   = pos[b].y - pos[a].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
            const need = 2 * MAX_R + MIN_GAP;
            if (dist < need) {
              const push = (need - dist) / 2 + 0.5;
              const nx = dx / dist, ny = dy / dist;
              pos[a].x -= nx * push; pos[a].y -= ny * push;
              pos[b].x += nx * push; pos[b].y += ny * push;
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
  
      keys.forEach(k => {
        pos[k].x = Math.max(offsetX + CLUSTER_PAD_SIDE + MAX_R, Math.min(offsetX + layoutW - CLUSTER_PAD_RIGHT - MAX_R, pos[k].x));
        pos[k].y = Math.max(CLUSTER_PAD_TOP + MAX_R, Math.min(svgH - MAX_R - 2, pos[k].y));
      });
  
      _stablePositions[cacheKey] = pos;
    }
  
    return { positions: _stablePositions[cacheKey], svgH };
  }
  
 function drawConstellationLines(svg, keys, positions, coMatrix, lineColor, radii) {
  if (!coMatrix) return;

  let maxCo = 0;
  keys.forEach(a => keys.forEach(b => {
    if (a !== b) maxCo = Math.max(maxCo, coMatrix[a]?.[b] || 0);
  }));
  if (maxCo === 0) return;

  const THRESHOLD = 0.06;
  const MIN_STROKE = 0.3;
  const MAX_STROKE = 7.0;

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i], b = keys[j];
      const raw = coMatrix[a]?.[b] || 0;
      const norm = raw / maxCo;

      if (norm < THRESHOLD) continue;

      const t = (norm - THRESHOLD) / (1 - THRESHOLD);
      const curved = Math.pow(t, 1.25);

      // Only width encodes co-occurrence, not opacity
      const strokeW = MIN_STROKE + curved * (MAX_STROKE - MIN_STROKE);

      const ax = positions[a].x, ay = positions[a].y;
      const bx = positions[b].x, by = positions[b].y;
      const dx = bx - ax, dy = by - ay;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist, ny = dy / dist;
      const ra = (radii && radii[a]) ? radii[a] : MAX_CLUSTER_R;
      const rb = (radii && radii[b]) ? radii[b] : MAX_CLUSTER_R;
      const edgePad = strokeW * 0.5 + 0.35;

      el('line', {
        x1: ax + nx * (ra + edgePad),
        y1: ay + ny * (ra + edgePad),
        x2: bx - nx * (rb + edgePad),
        y2: by - ny * (rb + edgePad),
        stroke: lineColor,
        'stroke-width': strokeW,
        'stroke-dasharray': '4,5',
        'stroke-linecap': 'butt',
        opacity: 0.5,
        class: 'constellation-line',
        'data-end-a': a,
        'data-end-b': b,
        'data-co': raw.toFixed(4),
        'data-co-norm': norm.toFixed(4),
      }, svg);
    }
  }
}
  
  /** Overview hover: dim unrelated co-occurrence lines; highlight + animate lines tied to `hoveredKey`. */
  function setConstellationLineHover(svg, hoveredKey) {
    svg.querySelectorAll('.constellation-line').forEach(l => {
      l.classList.remove('constellation-line--highlight');
      l.style.removeProperty('opacity');
      if (!hoveredKey) return;
      const a = l.getAttribute('data-end-a');
      const b = l.getAttribute('data-end-b');
      const incident = a === hoveredKey || b === hoveredKey;
      if (incident) {
        l.classList.add('constellation-line--highlight');
        const baseOp = parseFloat(l.getAttribute('opacity') || '0.25');
        l.style.opacity = String(Math.min(0.9, baseOp + 0.22));
      } else {
        l.style.opacity = '0.035';
      }
    });
  }
  
  // ── CLUSTER LEGEND ────────────────────────────────────────────────────────
  
  function getOrCreateLegend() {
    let legend = document.getElementById('cluster-legend');
    if (!legend) {
      // Build legend with two rows:
      // - circle area encodes share (with hover highlighting)
      // - line weight encodes co-occurrence (with hover highlighting)
      // Shown only in overview (themes/actors cluster views). CTA text is placed separately in drilldown.
      legend = document.createElement('div');
      legend.id = 'cluster-legend';
      legend.style.cssText = [
        'display:inline-grid',
        'grid-template-columns:48px auto',
        'align-items:center',
        'row-gap:20px',
        'column-gap:12px',
      ].join(';');
  
      // Row 1: concentric circles icon
      const cSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      cSvg.setAttribute('width', '48'); cSvg.setAttribute('height', '48'); cSvg.setAttribute('viewBox', '0 0 48 48');
      cSvg.style.display = 'block';
      [[22,1],[16,1],[9,1]].forEach(([r]) => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', '24'); c.setAttribute('cy', '24'); c.setAttribute('r', r);
        c.setAttribute('fill', 'none'); c.setAttribute('stroke', 'rgba(232,232,232,0.40)'); c.setAttribute('stroke-width', '1');
        cSvg.appendChild(c);
      });
      legend.appendChild(cSvg);
  
      const circleLabel = document.createElement('span');
      circleLabel.id = 'legend-circle-label';
      circleLabel.style.cssText = 'cursor:default;';
      legend.appendChild(circleLabel);
  
      // Row 2: dashed line icon
      const lSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      lSvg.setAttribute('width', '48'); lSvg.setAttribute('height', '48'); lSvg.setAttribute('viewBox', '0 0 48 48');
      lSvg.style.display = 'block';
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '24'); line.setAttribute('y1', '4'); line.setAttribute('x2', '24'); line.setAttribute('y2', '44');
      line.setAttribute('stroke', 'rgba(232,232,232,0.55)'); line.setAttribute('stroke-width', '1.5');
      line.setAttribute('stroke-dasharray', '4,5,4,5,4'); line.setAttribute('stroke-linecap', 'butt');
      lSvg.appendChild(line);
      legend.appendChild(lSvg);
  
      const lineLabel = document.createElement('span');
      lineLabel.id = 'legend-line-label';
      lineLabel.style.cssText = 'cursor:default;';
      legend.appendChild(lineLabel);
  
      // Insert legend as left column beside #chart-wrap
      const chartWrap = document.getElementById('chart-wrap');
      let legendWrap = document.getElementById('legend-chart-wrap');
      if (!legendWrap) {
        legendWrap = document.createElement('div');
        legendWrap.id = 'legend-chart-wrap';
        chartWrap.parentNode.insertBefore(legendWrap, chartWrap);
        legendWrap.appendChild(chartWrap);
      }
      legend.style.cssText += ';flex-shrink:0;width:200px;padding-top:0;align-self:flex-end;padding-bottom:0;transform:translateY(-98px);';
      legendWrap.insertBefore(legend, chartWrap);
  
      // Hover highlight handlers — both icon SVG and text label trigger the effect
      const circleLabel2 = document.getElementById('legend-circle-label');
      const lineLabel2 = document.getElementById('legend-line-label');
      const bubbleSvg = document.getElementById('bubble-svg');

      function onCircleLegendEnter() {
        const bsvg = document.getElementById('bubble-svg');
        if (bsvg) {
          bsvg.querySelectorAll('circle[fill*="url"]').forEach(c => {
            c.style.opacity = '0.7';
          });
          bsvg.querySelectorAll('.constellation-line').forEach(l => {
            l.style.opacity = '0.1';
          });
        }
      }
      function onCircleLegendLeave() {
        const bsvg = document.getElementById('bubble-svg');
        if (bsvg) {
          bsvg.querySelectorAll('circle[fill*="url"]').forEach(c => {
            c.style.opacity = '1';
          });
          bsvg.querySelectorAll('.constellation-line').forEach(l => {
            const rawOp = parseFloat(l.getAttribute('opacity') || '0.5');
            l.style.opacity = rawOp.toString();
          });
        }
      }
      function onLineLegendEnter() {
        const bsvg = document.getElementById('bubble-svg');
        if (bsvg) {
          bsvg.querySelectorAll('.constellation-line').forEach(l => {
            l.style.opacity = '1';
          });
          // Dim entire bubble groups (circles + their text labels)
          bsvg.querySelectorAll('.bubble-circle').forEach(g => {
            g.style.opacity = '0.25';
          });
        }
      }
      function onLineLegendLeave() {
        const bsvg = document.getElementById('bubble-svg');
        if (bsvg) {
          bsvg.querySelectorAll('.constellation-line').forEach(l => {
            const rawOp = parseFloat(l.getAttribute('opacity') || '0.5');
            l.style.opacity = rawOp.toString();
          });
          bsvg.querySelectorAll('.bubble-circle').forEach(g => {
            g.style.opacity = '';
          });
        }
      }

      circleLabel2.addEventListener('mouseenter', onCircleLegendEnter);
      circleLabel2.addEventListener('mouseleave', onCircleLegendLeave);
      cSvg.style.cursor = 'default';
      cSvg.addEventListener('mouseenter', onCircleLegendEnter);
      cSvg.addEventListener('mouseleave', onCircleLegendLeave);

      lineLabel2.addEventListener('mouseenter', onLineLegendEnter);
      lineLabel2.addEventListener('mouseleave', onLineLegendLeave);
      lSvg.style.cursor = 'default';
      lSvg.addEventListener('mouseenter', onLineLegendEnter);
      lSvg.addEventListener('mouseleave', onLineLegendLeave);
  
      // Clear position cache — chart-wrap is now narrower
      Object.keys(_stablePositions).forEach(k => delete _stablePositions[k]);
    }
    return legend;
  }
  
  function updateLegend(src, kind) {
    getOrCreateLegend();
    const kindWord  = kind === 'theme' ? 'theme' : 'actor';
    const kindWords = kind === 'theme' ? 'themes' : 'actors';
    document.getElementById('legend-circle-label').innerHTML = `circle area = <br>percentage by ${kindWord}`;
    document.getElementById('legend-line-label').innerHTML   = `line weight =<br>co-occurrence between ${kindWords}`;
    document.getElementById('cluster-legend').style.display  = 'inline-grid';
  }
  
  function hideLegend() {
    const legend = document.getElementById('cluster-legend');
    if (legend) legend.style.display = 'none';
  }
  
  // ── MOBILE CLUSTER OVERVIEW ───────────────────────────────────────────────
  
  function drawMobileCluster(kind) {
    // Mobile overview replaces the desktop clustered SVG with a scrollable list
    // of large tappable circles. This avoids tiny click targets and hover-only
    // interactions on touch devices.
    hideLegend();
    const bubbleSvg = document.getElementById('bubble-svg');
    bubbleSvg.style.display = 'none';
  
    const wrap = document.getElementById('chart-wrap');
    let container = document.getElementById('mob-cluster');
    if (!container) {
      // Create once and reuse; we fully replace its contents on each render.
      container = document.createElement('div');
      container.id = 'mob-cluster';
      wrap.appendChild(container);
    }
    container.innerHTML = '';
    container.style.display = 'block';
  
    // ── DATA: overall shares determine ordering + radius scaling ─────────────
    const keys = kind === 'theme' ? UMBRELLAS : ACTORS;
    const shares = {};
    keys.forEach(k => {
      shares[k] = kind === 'theme' ? getThemeOverall(planetSrc, k) : getActorOverall(planetSrc, k);
    });
    const maxShare = Math.max(...Object.values(shares)) || 1;
    const minShare = Math.min(...Object.values(shares).filter(v => v > 0)) || 0;
    const sorted   = [...keys].sort((a, b) => shares[b] - shares[a]);
  
    // ── LAYOUT: compute per-item radius based on share, then stack vertically ─
    const vw    = wrap.clientWidth || window.innerWidth - 40;
    const MAX_R = Math.min(vw * 0.44, MAX_CLUSTER_R);
    const MIN_R = MIN_CLUSTER_R * 0.50;
    const MOB_PAD = 12;
  
    const radii = {};
    sorted.forEach(k => {
      let r = clusterRadius(shares[k], minShare, maxShare);
      r = MIN_R + (r - MIN_CLUSTER_R) / (MAX_CLUSTER_R - MIN_CLUSTER_R) * (MAX_R - MIN_R);
      radii[k] = Math.max(MIN_R, Math.min(MAX_R, r));
    });
  
    const totalH = sorted.reduce((acc, k) => acc + radii[k] * 2 + MOB_PAD, MOB_PAD);
    const svgW_  = vw;
    const NS_ = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS_, 'svg');
    svg.setAttribute('width', svgW_); svg.setAttribute('height', totalH);
    svg.setAttribute('viewBox', `0 0 ${svgW_} ${totalH}`);
    svg.style.cssText = 'display:block;overflow:visible;';
    buildDefs(svg);
  
    // ── DRAW: one circle per key, with tap-to-drill interaction ──────────────
    let curY = MOB_PAD;
    sorted.forEach(k => {
      const r     = radii[k];
      const cx    = svgW_ / 2;
      const cy    = curY + r;
      const share = shares[k];
      const label = kind === 'theme' ? (DATA.themes[k]?.label || k) : (ACTOR_LABELS_MAP[k] || k);
      const gradId = kind === 'theme' ? `grad-${k}` : `agrad-${k}`;
  
      const g = document.createElementNS(NS_, 'g');
      g.style.cursor = 'pointer';
  
      const circle = document.createElementNS(NS_, 'circle');
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy); circle.setAttribute('r', r);
      circle.setAttribute('fill', `url(#${gradId})`); circle.setAttribute('filter', 'url(#noise)');
      g.appendChild(circle);
  
      const words  = label.split(' ');
      const mid    = Math.ceil(words.length / 2);
      const line1  = words.slice(0, mid).join(' ');
      const line2  = words.slice(mid).join(' ');
      const fs     = r >= 62 ? 18 : r >= 46 ? 16 : 14;
      const pctSz  = r >= 62 ? 13 : 11;
      const lblG   = document.createElementNS(NS_, 'g');
      lblG.setAttribute('pointer-events', 'none');
  
      const mkTx = (text, x, y, style) => {
        const t = document.createElementNS(NS_, 'text');
        t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('text-anchor', 'middle');
        t.setAttribute('style', style); t.textContent = text;
        lblG.appendChild(t);
      };
      const baseStyle = `font-family:"Archivo Narrow",sans-serif;font-size:${fs}px;font-weight:500;fill:rgba(255,255,255,0.93);`;
      const pctStyle  = `font-family:"Archivo Narrow",sans-serif;font-size:${pctSz}px;fill:rgba(255,255,255,0.55);`;
      if (line2) {
        mkTx(line1, cx, cy - fs/2 - 2, baseStyle);
        mkTx(line2, cx, cy + fs/2 + 4, baseStyle);
      } else {
        mkTx(line1, cx, cy + fs/2 - 4, baseStyle);
      }
      g.appendChild(lblG);
  
      g.addEventListener('click', e => {
        e.stopPropagation();
        enterThemeDrilldown(k);
      });
      g.addEventListener('mouseenter', () => { circle.setAttribute('r', r * 1.04); });
      g.addEventListener('mouseleave', () => { circle.setAttribute('r', r); });
  
      svg.appendChild(g);
      curY += r * 2 + MOB_PAD;
    });
  
    container.appendChild(svg);
  }
  
  // ── MOBILE DRILLDOWN ──────────────────────────────────────────────────────
  
  function drawMobileDrilldown(key, kind) {
    // Mobile drilldown is a two-part UI:
    // - top: source tabs (NEWS/POLITICS/BOOKS) so users can compare quickly
    // - list: decades with proportional bars; tapping opens the samples modal
    hideLegend();
    const bubbleSvg = document.getElementById('bubble-svg');
    bubbleSvg.style.display = 'none';
  
    const wrap = document.getElementById('chart-wrap');
    let container = document.getElementById('mob-cluster');
    if (!container) {
      container = document.createElement('div');
      container.id = 'mob-cluster';
      wrap.appendChild(container);
    }
    container.innerHTML = '';
    container.style.display = 'block';
  
    // ── SOURCE TABS ─────────────────────────────────────────────────────────
    // On mobile we duplicate the source selector as tabs inside the drilldown
    // because the desktop source filter can scroll off-screen.
    const tabs = document.createElement('div');
    tabs.className = 'mob-src-tabs';
    ['nyt','politics'].forEach(src => {
      const tab = document.createElement('button');
      tab.className = 'mob-src-tab' + (src === planetSrc ? ' active' : '');
      tab.textContent = SRC_ABBR[src];
      tab.addEventListener('click', () => {
        planetSrc = src;
        syncPlanetFilters();
        updateCaption();
        drawMobileDrilldown(key, kind);
      });
      tabs.appendChild(tab);
    });
    container.appendChild(tabs);
  
    // ── SCALE ───────────────────────────────────────────────────────────────
    // Bars are normalized within the selected key across all sources/decades so
    // the relative “shape” is consistent when switching tabs.
    const allMax = kind === 'theme' ? getThemeAllMax(key) : getActorAllMax(key);
  
    // ── DECADE LIST ─────────────────────────────────────────────────────────
    const list = document.createElement('div');
    list.className = 'mob-drill-list';
  
    DECADES.forEach(dec => {
      const share  = kind === 'theme' ? getThemeShare(planetSrc, key, dec) : getActorShare(planetSrc, key, dec);
      const noData = dec === 1950 && planetSrc === 'politics';
      const barPct = allMax > 0 ? (share / allMax) * 100 : 0;
  
      const row = document.createElement('button');
      row.className = 'mob-drill-row';
      row.setAttribute('aria-label', `${dec}s — ${fmtPct(share)}`);
      const barBg = drillBarBubbleBackground(kind, key);
      row.innerHTML = `
        <span class="mob-drill-decade">${dec}s</span>
        <span class="mob-drill-bar-wrap">
          <span class="mob-drill-bar-fill mob-drill-bar-fill--bubble" style="width:${noData ? 0 : barPct}%;background:${barBg};"></span>
        </span>
        <span class="mob-drill-pct">${noData ? '—' : fmtPct(share)}</span>`;
  
      if (!noData && share > 0) {
        row.addEventListener('click', e => {
          e.stopPropagation();
          openSamplesModal(key, kind, dec);
        });
      } else {
        row.style.opacity = '0.35'; row.style.cursor = 'default';
      }
      list.appendChild(row);
    });
    container.appendChild(list);
  
    const note = document.createElement('p');
    note.className = 'mob-drill-note';
    note.textContent = 'Tap a decade to see examples';
    container.appendChild(note);
  }
  
  // ── THEME CLUSTER ─────────────────────────────────────────────────────────
  
  function drawThemeCluster() {
    // Desktop overview (themes):
    // - compute overall share per theme for the active source
    // - compute radii using sqrt scaling (area encodes share)
    // - place circles using cached stable positions
    // - optionally draw co-occurrence lines behind circles
    const svg = document.getElementById('bubble-svg');
    svg.innerHTML = '';
    updateLegend(planetSrc, 'theme');  // show legend first so svgW() is correct
    const W = svgW();
    buildDefs(svg);
  
    // ── DATA: overall shares drive radius scaling ────────────────────────────
    const shares   = {};
    UMBRELLAS.forEach(u => shares[u] = getThemeOverall(planetSrc, u));
    const maxShare = Math.max(...Object.values(shares)) || 1;
    const minShare = Math.min(...Object.values(shares).filter(v => v > 0)) || 0;
  
    // ── SCALE: convert share -> radius (area communicates magnitude) ─────────
    const radii = {};
    UMBRELLAS.forEach(u => radii[u] = clusterRadius(shares[u], minShare, maxShare));
  
    // ── LAYOUT: stable cached cluster positions ──────────────────────────────
    const { positions, svgH } = scaledMdsPositions(UMBRELLAS, radii, THEME_POSITIONS, W);
    svg.setAttribute('viewBox', `0 0 ${W} ${svgH}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.removeAttribute('height');
    svg.style.cssText = 'display:block;width:100%;max-height:' + svgH + 'px;overflow:visible;';

    // ── BACKGROUND: co-occurrence structure ──────────────────────────────────
    const coMatrix = DATA.theme_cooccurrence?.[planetSrc];
    drawConstellationLines(svg, UMBRELLAS, positions, coMatrix, '#f0f0f0', radii);
  
    // ── FOREGROUND: interactive circles ──────────────────────────────────────
    const allGroups = [];
    UMBRELLAS.forEach(umb => {
      const theme = DATA.themes[umb];
      const share = shares[umb];
      const r     = radii[umb];
      const { x: cx, y: cy } = positions[umb];
  
      const g = el('g', { class: 'bubble-circle' }, svg);
      g.style.cursor = 'pointer';
      const c = el('circle', { cx, cy, r, fill: `url(#grad-${umb})`, filter: 'url(#noise)' }, g);
      drawPlanetLabel(g, cx, cy, r, theme.label, share);
      allGroups.push(g);
  
      g.addEventListener('mouseenter', () => {
        allGroups.forEach(og => { if (og !== g) og.style.opacity = '0.25'; });
        setConstellationLineHover(svg, umb);
        c.setAttribute('r', r * 1.05);
      });
      g.addEventListener('mouseleave', () => {
        allGroups.forEach(og => { og.style.opacity = ''; });
        setConstellationLineHover(svg, null);
        c.setAttribute('r', r);
      });
      g.addEventListener('click', e => {
        e.stopPropagation();
        enterThemeDrilldown(umb);
      });
    });

  }
  
  // ── THEME DRILLDOWN ───────────────────────────────────────────────────────
  

  function _setDrilldownActive(active) {
    const sec = document.querySelector('.bubble-section');
    if (sec) sec.classList.toggle('drilldown-active', active);
  }
  function drawThemeDrilldown(umb) {
    // Desktop drilldown (themes) renders three “rows” (one per source) and a
    // shared decade axis. Only the active source row is interactive (hover + click).
    _inDrilldown = true;
    _setDrilldownActive(true);
    const svg   = document.getElementById('bubble-svg');
    svg.innerHTML = '';
    const theme = DATA.themes[umb];
    const rowSources = ['nyt','politics'];
  
    // ── SCALE: shared across rows so comparisons are meaningful ──────────────
    const sharedMax = getThemeAllMax(umb);
    const sharedMin = getThemeAllMin(umb);

    // ── HEIGHT: scale rows to fit available frame so back button + decades always visible ───
    _activeDrillW   = drillSvgW();
    const maxLmOff  = calculateMaxLandmarkOffset(getLandmarks(umb, { timelineView: 'theme' }), _activeDrillW);
    const axisFootH = AXIS_EXTRA + DEC_LBL_H + LM_TICK + LM_LBL_H + maxLmOff + 6;
    const _navH_dd  = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 57;
    const _panelPad = Math.min(20, Math.max(8, window.innerHeight * 0.015))
                    + Math.min(28, Math.max(10, window.innerHeight * 0.02));
    const _hdr_dd   = document.querySelector('.bubble-header');
    const _hdrH_dd  = _hdr_dd ? _hdr_dd.getBoundingClientRect().height : 180;
    const availH    = Math.max(280, Math.floor(window.innerHeight - _navH_dd - _panelPad - _hdrH_dd - 16));
    // Row 0 sits near top. Row 1 a fixed gap below. SVG sized to fit both + axis.
    const TOP_MARGIN = 4;
    const BOT_MARGIN = 12;
    const ROW_GAP    = DRILL_MAX_R * 2 + 80;   // gap between circle centers: diameter + 80px breathing room
    const cy0 = TOP_MARGIN + DRILL_MAX_R;
    const cy1 = cy0 + ROW_GAP;
    const svgH = Math.round(cy1 + DRILL_MAX_R + axisFootH + BOT_MARGIN);
    const rowCenters = [cy0, cy1];

    // Dummy drillRowH for drawDecadeLines lineTop/lineBot compatibility
    const drillRowH = cy0;

    // ViewBox width: use full available width for drilldown to fill the container
    const drillViewBoxW = _activeDrillW;
    svg.setAttribute('viewBox', `0 0 ${drillViewBoxW} ${svgH}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.removeAttribute('height');
    svg.style.cssText = 'display:block;width:100%;max-height:' + svgH + 'px;overflow:visible;';
    buildDefs(svg);
  
    const decLinesG = el('g', {}, svg);
  
    // Row ordering logic:
    // - If entered from overview: active source at entry goes first (locked in _drillRowOrder)
    // - Switching source within drilldown does NOT reorder rows
    const displayOrder = _drillRowOrder || ['nyt', 'politics'];
    const circleExclusions = [];
  
    displayOrder.forEach(src => {
      const idx      = displayOrder.indexOf(src);
      const cy       = rowCenters[idx];
      const isActive = src === planetSrc;
  
      el('line', {
        x1: src === 'politics' ? decadeX(1960) : LABEL_W, y1: cy, x2: decadeX(2020), y2: cy,
        stroke: '#f0f0f0', 'stroke-width': '0.5', 'stroke-dasharray': '2,3', opacity: isActive ? '0.30' : '0.18'
      }, svg);
  
      tx(`in ${SRC_ABBR[src]}`, { x: 12, y: cy + 5, 'text-anchor': 'start',
        style: `font-family:"Archivo Narrow",sans-serif;font-size:${isActive ? 22 : 17}px;font-weight:${isActive ? 500 : 400};fill:${isActive ? 'rgba(240,240,240,0.92)' : 'rgba(240,240,240,0.40)'};cursor:default;` }, svg);
  
      DECADES.forEach(dec => {
        if (dec === 1950 && src === 'politics') {
          el('rect', { x: decadeX(1950) - 54, y: cy - 10, width: 108, height: 20, fill: '#1d1d1d' }, svg);
          tx('insufficient data', { x: decadeX(1950), y: cy,
            'text-anchor': 'middle', 'dominant-baseline': 'middle',
            style: `font-family:"Archivo Narrow",sans-serif;font-size:11px;font-style:italic;fill:${isActive ? 'rgba(240,240,240,0.44)' : 'rgba(240,240,240,0.40)'};`,
          }, svg);
          return;
        }
  
const decStr = String(dec);
const count    = DATA.top_counts_by_decade?.[src]?.[umb]?.[decStr] || 0;
const decTotal = DATA.decade_doc_counts?.[src]?.[decStr] || 1;
const share    = count / decTotal;
const maxR     = DRILL_MAX_R;
const r        = shareToRRanged(share, sharedMin, sharedMax, maxR);

// Don't render circles if there are no samples for this decade
let samples = DATA.samples?.[src]?.[umb]?.[String(dec)] || [];
if (r <= 0 || samples.length === 0) return;

circleExclusions.push({ dec, cy, r });

const countStr = count > 0 ? `<br>total count: ${count}` : '';
  
        const c = el('circle', {
          cx: decadeX(dec), cy, r,
          fill: isActive ? `url(#grad-${umb})` : '#555555',
          opacity: isActive ? '1' : '0.46',
          ...(isActive ? { filter: 'url(#noise)' } : {}),
        }, svg);
  
        if (isActive) {
          c.setAttribute('data-active-circle', '1');
          c.style.cursor = 'pointer';
          c.addEventListener('mouseenter', e => {
            svg.querySelectorAll('[data-active-circle]').forEach(o => { if (o !== c) o.style.opacity = '0.45'; });
            c.setAttribute('r', r * 1.06);
            showTip(e, `<span class="tt-title">${dec}s · ${theme.label}</span><span class="tt-body">share of decade: ${fmtPct(share)}${countStr}</span>`);
          });
          c.addEventListener('mousemove', moveTip);
          c.addEventListener('mouseleave', () => {
            svg.querySelectorAll('[data-active-circle]').forEach(o => { o.style.opacity = ''; });
            c.setAttribute('r', r);
            hideTip();
          });
          c.addEventListener('click', e => {
            e.stopPropagation();
            openSamplesModal(umb, 'theme', dec);
          });
        }
  
        if (r >= 14) {
          tx(fmtPct(share), {
            x: decadeX(dec), y: cy + 4, 'text-anchor': 'middle',
            style: isActive
              ? 'font-family:"Archivo Narrow",sans-serif;font-size:16px;font-weight:500;fill:rgba(255,255,255,0.96);pointer-events:none;'
              : 'font-family:"Archivo Narrow",sans-serif;font-size:14px;fill:rgba(240,240,240,0.68);pointer-events:none;'
          }, svg);
        }
      });
    });
  
  // Vertical decade guides should start at the first row’s baseline (so they
  // don’t extend into the header area above the top row).
  drawDecadeLines(decLinesG, svgH - axisFootH, circleExclusions, { lineTop: cy0 - DRILL_MAX_R, lineBot: svgH - axisFootH});
    drawAxis(svg, svgH - axisFootH - PAD_TOP, umb, { timelineView: 'theme', skipLandmarks: true, baselineY: svgH - axisFootH });
  }
  
  // ── ACTOR DRILLDOWN ───────────────────────────────────────────────────────
  
  function drawActorDrilldown(actor) {
    _inDrilldown = true; // tell chartW() to use the wider right gutter
    const svg = document.getElementById('bubble-svg');
    svg.innerHTML = '';
    const rowSources = ['nyt','politics'];
    const label      = ACTOR_LABELS_MAP[actor] || actor;
  
    const sharedMax = getActorAllMax(actor);
    const sharedMin = getActorAllMin(actor);
    // Same adaptive height logic as theme drilldown — scale row height to fit frame.
    _activeDrillW   = drillSvgW();
    const maxLmOff  = calculateMaxLandmarkOffset(getLandmarks(null, { timelineView: 'actor', actorDrill: actor }), _activeDrillW);
    const axisFootH = AXIS_EXTRA + DEC_LBL_H + LM_TICK + LM_LBL_H + maxLmOff + 6;
    const _navH_ad  = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 57;
    const _panelPad = Math.min(20, Math.max(8, window.innerHeight * 0.015))
                    + Math.min(28, Math.max(10, window.innerHeight * 0.02));
    const _hdr_ad   = document.querySelector('.bubble-header');
    const _hdrH_ad  = _hdr_ad ? _hdr_ad.getBoundingClientRect().height : 180;
    const availH    = Math.max(280, Math.floor(window.innerHeight - _navH_ad - _panelPad - _hdrH_ad - 16));
    // Row 0 sits near top. Row 1 a fixed gap below. SVG sized to fit both + axis.
    const TOP_MARGIN = 4;
    const BOT_MARGIN = 12;
    const ROW_GAP    = DRILL_MAX_R * 2 + 80;
    const cy0 = TOP_MARGIN + DRILL_MAX_R;
    const cy1 = cy0 + ROW_GAP;
    const svgH = Math.round(cy1 + DRILL_MAX_R + axisFootH + BOT_MARGIN);
    const rowCenters = [cy0, cy1];

    // Dummy drillRowH for drawDecadeLines lineTop/lineBot compatibility
    const drillRowH = cy0;

    // ViewBox width: use full available width for drilldown to fill the container
    const drillViewBoxW = _activeDrillW;
    svg.setAttribute('viewBox', `0 0 ${drillViewBoxW} ${svgH}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.removeAttribute('height');
    svg.style.cssText = 'display:block;width:100%;max-height:' + svgH + 'px;overflow:visible;';
    buildDefs(svg);
  
    const decLinesG = el('g', {}, svg);
  
    // Keep rows in fixed order (nyt always top, politics always bottom)
    // Don't reorder based on which source is active
    const displayOrder    = ['nyt', 'politics'];
    const circleExclusions = [];
  
    displayOrder.forEach(src => {
      const idx      = displayOrder.indexOf(src);
      const cy       = rowCenters[idx];
      const isActive = src === planetSrc;
  
      el('line', {
        x1: src === 'politics' ? decadeX(1960) : LABEL_W, y1: cy, x2: decadeX(2020), y2: cy,
        stroke: '#f0f0f0', 'stroke-width': '0.5', 'stroke-dasharray': '2,3', opacity: isActive ? '0.30' : '0.18'
      }, svg);
  
      tx(`in ${SRC_ABBR[src]}`, { x: 12, y: cy + 5, 'text-anchor': 'start',
        style: `font-family:"Archivo Narrow",sans-serif;font-size:${isActive ? 22 : 17}px;font-weight:${isActive ? 500 : 400};fill:${isActive ? 'rgba(240,240,240,0.92)' : 'rgba(240,240,240,0.40)'};cursor:default;` }, svg);
  
      DECADES.forEach(dec => {
        if (dec === 1950 && src === 'politics') {
          el('rect', { x: decadeX(1950) - 54, y: cy - 10, width: 108, height: 20, fill: '#1d1d1d' }, svg);
          tx('insufficient data', { x: decadeX(1950), y: cy,
            'text-anchor': 'middle', 'dominant-baseline': 'middle',
            style: `font-family:"Archivo Narrow",sans-serif;font-size:11px;font-style:italic;fill:${isActive ? 'rgba(240,240,240,0.44)' : 'rgba(240,240,240,0.40)'};`,
          }, svg);
          return;
        }
  
const decStr   = String(dec);
        const count    = DATA.top_counts_by_decade?.[src]?.[umb]?.[decStr] || 0;
        const decTotal = DATA.decade_doc_counts?.[src]?.[decStr] || 1;
        const share    = count / decTotal;
        const maxR     = DRILL_MAX_R;
        const r        = shareToRRanged(share, sharedMin, sharedMax, maxR);

        // Don't render circles if there are no samples for this decade
        let samples = DATA.samples?.[src]?.[umb]?.[String(dec)] || [];
        if (r <= 0 || samples.length === 0) return;

        circleExclusions.push({ dec, cy, r });

        const countStr = count > 0 ? `<br>total count: ${count}` : '';
  
        const c = el('circle', {
          cx: decadeX(dec), cy, r,
          fill: isActive ? `url(#agrad-${actor})` : '#555555',
          opacity: isActive ? '1' : '0.46',
          ...(isActive ? { filter: 'url(#noise)' } : {}),
        }, svg);
  
        if (isActive) {
          c.setAttribute('data-active-circle', '1');
          c.style.cursor = 'pointer';
          c.addEventListener('mouseenter', e => {
            svg.querySelectorAll('[data-active-circle]').forEach(o => { if (o !== c) o.style.opacity = '0.45'; });
            c.setAttribute('r', r * 1.06);
            showTip(e, `<span class="tt-title">${dec}s · ${label}</span><span class="tt-body">share of decade: ${fmtPct(share)}${countStr}</span>`);
          });
          c.addEventListener('mousemove', moveTip);
          c.addEventListener('mouseleave', () => {
            svg.querySelectorAll('[data-active-circle]').forEach(o => { o.style.opacity = ''; });
            c.setAttribute('r', r);
            hideTip();
          });
          c.addEventListener('click', e => {
            e.stopPropagation();
            openSamplesModal(actor, 'actor', dec);
          });
        }
  
        if (r >= 14) {
          tx(fmtPct(share), {
            x: decadeX(dec), y: cy + 4, 'text-anchor': 'middle',
            style: isActive
              ? 'font-family:"Archivo Narrow",sans-serif;font-size:16px;font-weight:500;fill:rgba(255,255,255,0.96);pointer-events:none;'
              : 'font-family:"Archivo Narrow",sans-serif;font-size:14px;fill:rgba(240,240,240,0.68);pointer-events:none;'
          }, svg);
        }
      });
    });
  
  // Vertical decade guides should start at the first row’s baseline (so they
  // don’t extend into the header area above the top row).
  drawDecadeLines(decLinesG, svgH - axisFootH, circleExclusions, { lineTop: cy0 - DRILL_MAX_R, lineBot: svgH - axisFootH });
    drawAxis(svg, svgH - axisFootH - PAD_TOP, null, { timelineView: 'actor', actorDrill: actor, skipLandmarks: true, baselineY: svgH - axisFootH });
  }
  
  // ── ENTER / EXIT ──────────────────────────────────────────────────────────
  
  function setPageTitle(text) {
    const h1 = document.querySelector('h1');
    if (h1) h1.textContent = text;
  }
  
  
  function enterThemeDrilldown(umb) {
    activeTheme = umb;
    syncDrilldownBackLinks();
    _drillEnteredFromOverview = true;
    _drillRowOrder = [planetSrc, planetSrc === 'nyt' ? 'politics' : 'nyt'];
    if (IS_MOBILE()) {
      hideLegend();
      drawMobileDrilldown(umb, 'theme');
    } else {
      hideLegend();
      drawThemeDrilldown(umb);
    }
    updateCaption();
  }
  
  function exitDrilldown() {
    _inDrilldown = false;
    _setDrilldownActive(false);
    _drillEnteredFromOverview = false;
    _drillRowOrder = null;
    if (!IS_MOBILE()) {
    }
    closeSamplesModal();
    activeTheme = null;
    // Clear position cache so cluster recomputes at current SVG width
    Object.keys(_stablePositions).forEach(k => delete _stablePositions[k]);
    render();
  }
  
  // ── SAMPLES LIST ──────────────────────────────────────────────────────────
  
  function buildSamplesList(samples, src) {
    const sorted = [...samples].sort((a, b) => (b.score || 0) - (a.score || 0));
    console.log(`buildSamplesList called with src='${src}', total samples: ${sorted.length}`);
    if (sorted[0]) {
      const keys = Object.keys(sorted[0]);
      console.log('First sample object keys:', keys);
      console.log('First sample object:', sorted[0]);
    }
    return sorted.map(s => {
      let yearCell = `<span class="dp-hl-year">${s.year || ''}</span>`;
      let content  = '';
  
      if (src === 'nyt') {
        const headlineText = `<span class="dp-hl-text uppercase">${esc(s.t || '')}</span>`;
        content = s.url
          ? `<a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none;">${headlineText}</a>`
          : headlineText;
  
       } else {
        const excerpt = highlightPoliticsKeywords(esc(s.t || ''));
        // For politics samples: use 'title' field
        const title   = s.title        // If there's a URL, make the title a link; otherwise just show the title text.
        const titleEl = title && s.url
          ? `<div class="dp-hl-title"><a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;text-underline-offset:2px;">${title}</a></div>`
          : '';
        content = `${titleEl}<span class="dp-hl-text">${excerpt}</span>`;
      }
      return `<div class="dp-hl-item">${yearCell}<div style="flex:1;">${content}</div></div>`;
    }).join('');
  }
  
  // ── SAMPLES MODAL ─────────────────────────────────────────────────────────
  
  function openSamplesModal(key, kind, dec) {
    // Build a lightweight modal to show “example documents” for a selected
    // (theme|actor, decade) cell.
    //
    // Notes:
    // - We intentionally cap items (varies by source) to keep the modal scannable.
    // - The modal is created once and re-used to avoid reflow/GC churn.
    // - We lock body scroll while open to keep the backdrop click target stable.
    let samples = kind === 'theme'
      ? (DATA.samples?.[planetSrc]?.[key]?.[String(dec)] || [])
      : (DATA.actor_samples?.[planetSrc]?.[key]?.[String(dec)] || []);
    
    console.log(`openSamplesModal: kind='${kind}', planetSrc='${planetSrc}', key='${key}', dec=${dec}`);
    console.log(`Loading from: DATA.actor_samples['${planetSrc}']['${key}']['${dec}']`);
    console.log(`Raw samples from JSON (first 2):`, samples.slice(0, 2));
    
    samples = [...samples].sort((a, b) => (b.score || 0) - (a.score || 0));
  
    const label = kind === 'theme'
      ? (DATA.themes[key]?.label || key)
      : (ACTOR_LABELS_MAP[key] || key);
  
    let modal = document.getElementById('samples-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'samples-modal';
      document.body.appendChild(modal);
    }
  
    const maxItems = planetSrc === 'politics' ? 5 : 10;
    samples = samples.slice(0, maxItems);
  
    const srcTag = SRC_ABBR[planetSrc] || planetSrc.toUpperCase();
    const srcDb  = { nyt: 'New York Times', politics: 'American Presidency Project' }[planetSrc] || '';
    const hintText = { nyt: 'Click on a headline to see source', politics: 'Click on a document title to see source' }[planetSrc] || '';
  
    const itemsHtml = samples.length === 0
      ? `<div class="sm-empty">No samples available for this decade.</div>`
      : buildSamplesList(samples, planetSrc);
  
    modal.innerHTML = `
      <div class="sm-backdrop"></div>
      <div class="sm-dialog">
        <div class="sm-topbar">
          <span class="sm-theme-tag">SAMPLES: ${esc(srcTag)}<span style="opacity:0.8;margin:0 8px;">|</span>Source: ${esc(srcDb)}</span>
          <button class="sm-close" aria-label="Close">✕ CLOSE</button>
        </div>
        <div class="sm-src-line">${esc(label)} in the ${dec}s</div>
        ${hintText ? `<div class="sm-hint">${hintText}</div>` : ''}
        <div class="sm-items">${itemsHtml}</div>
      </div>`;
  
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    modal.querySelector('.sm-backdrop').addEventListener('click', closeSamplesModal);
    modal.querySelectorAll('.sm-close').forEach(b => b.addEventListener('click', closeSamplesModal));
    document.addEventListener('keydown', handleModalKey);
  }
  
  function closeSamplesModal() {
    // Closing restores document scrolling and removes Escape handler.
    const modal = document.getElementById('samples-modal');
    if (modal) modal.classList.remove('open');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleModalKey);
  }
  
  function handleModalKey(e) { if (e.key === 'Escape') closeSamplesModal(); }
  
  // ── UTILITIES ─────────────────────────────────────────────────────────────
  
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── POLITICS MODAL KEYWORD HIGHLIGHTING ───────────────────────────────────

  const POLITICS_HIGHLIGHT_KEYWORDS = [
    // Frames
    'space race', 'Space Race',
    'space age', 'Space Age',
    'space program', 'space programs', 'Space Program', 'Space Programs',
    'space exploration', 'Space Exploration',
    'space policy', 'Space Policy',
    'space treaty', 'space treaties', 'Space Treaty', 'Space Treaties',
    'space station', 'space stations', 'Space Station', 'Space Stations',
    'space shuttle', 'space shuttles', 'Space Shuttle', 'Space Shuttles',

    // Canonical missions/events
    'Apollo 11', 'APOLLO 11',
    'moon landing', 'Moon landing', 'Moon Landing',

    // Commercial / New Space
    'SpaceX',
    'Blue Origin',
    'space tourism', 'Space Tourism',
    'Starlink',
    'Starship',

    // Scientific imagination
    'dark matter', 'Dark Matter',
    'alien life', 'Alien Life',
    'extraterrestrial', 'extraterrestrials', 'Extraterrestrial', 'Extraterrestrials',
    'life on mars', 'Life on Mars',

    // Militarization
    'weapons in space', 'Weapons in Space',
    'space weapon', 'space weapons', 'Space Weapon', 'Space Weapons',
    'anti-satellite', 'Anti-Satellite',
    'anti satellite', 'Anti Satellite',
  ];

  function escapeRegexLiteral(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const _politicsKeywordRe = (() => {
    const uniq = Array.from(new Set(POLITICS_HIGHLIGHT_KEYWORDS.map(s => String(s)).filter(Boolean)));
    // Prefer longer phrases first so alternation doesn't “steal” a shorter match.
    uniq.sort((a, b) => b.length - a.length);
    if (!uniq.length) return null;
    return new RegExp(`(${uniq.map(escapeRegexLiteral).join('|')})`, 'gi');
  })();

  function highlightPoliticsKeywords(escapedText) {
    if (!escapedText || !_politicsKeywordRe) return escapedText;
    return String(escapedText).replace(_politicsKeywordRe, (m) => `<span class="marker-hl">${m}</span>`);
  }
  
  // ── TOOLTIPS ──────────────────────────────────────────────────────────────
  
  const tipEl = document.getElementById('tooltip');
  let tipOn = false;
  // Tooltips are implemented as a single fixed-position DOM node we re-populate.
  // This avoids creating many tooltip elements and ensures consistent z-order.
  function showTip(e, html) { tipEl.innerHTML = html; tipEl.classList.add('visible'); tipOn = true; moveTip(e); }
  function moveTip(e) { if (!tipOn) return; tipEl.style.left = Math.min(e.clientX + 14, window.innerWidth - 260) + 'px'; tipEl.style.top = (e.clientY - 8) + 'px'; }
  function hideTip() { tipEl.classList.remove('visible'); tipOn = false; }
  
  // ── BOOT ──────────────────────────────────────────────────────────────────
  
  async function boot() {
    const res = await fetch('./data_viz/space_viz_data.json?t=' + Date.now());
    window.VIZ_DATA = await res.json();
    DATA = window.VIZ_DATA;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
  boot();
  })();