/* ════════════════════════════════════════════
   AT-IPIC  |  Planetary Performance Wheel (home demo)
   Vanilla JS, no dependencies. Needs the #planetary-wheel section
   markup (planetary-wheel.section.html) and the .pw-* styles.
   Sample data for a fictitious client; replace ACTIONS to reuse.
   ════════════════════════════════════════════ */
(function () {
  'use strict';
  const svg = document.getElementById('pwSvg');
  if (!svg) return;

  /* ── DATA ─────────────────────────────────────────── */
  const BASE_EBITDA = 38000;            // FY2024 EBITDA, €k (illustrative)
  const REALISE = { 'Delivered': 1, 'In progress': 0.5, 'Planned': 0 };
  const MODS = ['01 · Strategic Direction', '02 · 360° Brainstorming', '03 · Establishing Context', '04 · Stabilising Production', '05 · Aligning with Controlling', '06 · Valorisation', '07 · Lighthouse'];
  const BND = {
    ocean:     { name: 'Ocean acidification',  short: 'Ocean acid.',  st: 'Breached',          note: 'Ocean acidification is driven by absolute CO₂. The carbon price on capex steers future investment; shipping contracts are still to be renegotiated.' },
    biosphere: { name: 'Biosphere integrity',  short: 'Biosphere',    st: 'Breached',          note: 'Biodiversity pressure comes from the site itself and from what the client buys. Both actions are small in value but matter for permits and customer audits.' },
    ozone:     { name: 'Ozone depletion',      short: 'Ozone',        st: 'Within safe limit', note: 'One action: phasing out old HCFC chillers. Leakage has dropped by a third and now sits right at the sector median.' },
    aerosol:   { name: 'Aerosol loading',      short: 'Aerosols',     st: 'Within safe limit', note: 'Particulates from furnaces and diesel yard vehicles. The filter upgrade is complete and has moved this boundary inside the sector median.' },
    novel:     { name: 'Novel entities',       short: 'Novel ent.',   st: 'Breached',          note: 'Novel entities covers PFAS, hazardous waste and plastics. Strong progress on PFAS-free products and take-back, offset by more pellet-loss incidents.' },
    bgc:       { name: 'Biogeochemical flows', short: 'N & P flows',  st: 'Breached',          note: 'Nitrogen and phosphorus are the one boundary moving the wrong way this year: both actions are delayed, so the wedges have grown past their FY2024 lines.' },
    water:     { name: 'Freshwater change',    short: 'Freshwater',   st: 'Breached',          note: 'Freshwater is the best-performing boundary: AI-controlled closed-loop cooling cut withdrawal per tonne by almost a fifth in one year.' },
    land:      { name: 'Land-system change',   short: 'Land system',  st: 'Breached',          note: 'Land use is touched through the built footprint and through virgin metal, whose mining drives land conversion upstream. Recycled input is the largest value line on the wheel.' },
    climate:   { name: 'Climate change',       short: 'Climate',      st: 'Breached',          note: 'Energy, purchased power and the supply chain drive this boundary. It carries the largest share of value because carbon cuts here also cut energy and carbon costs.' }
  };
  const WHEEL = ['ocean', 'biosphere', 'ozone', 'aerosol', 'novel', 'bgc', 'water', 'land', 'climate']; // clockwise from top
  const DRV = {
    'Scope 1 & 2 intensity': 'Emissions from the client’s own furnaces and purchased electricity, per € of revenue.',
    'Value chain (Scope 3)': 'Emissions in suppliers and freight, which the client influences through purchasing.',
    'Energy productivity': 'Energy used per tonne of output; every kWh saved is both carbon and cost.',
    'Site ecosystems': 'Land on the client’s own sites managed for nature.',
    'Sourcing footprint': 'Biodiversity impact embedded in bought materials such as packaging.',
    'Land-use efficiency': 'How much built space the business needs per € of revenue.',
    'Upstream land use': 'Land converted upstream to mine virgin metal, reduced by using recycled input.',
    'Withdrawal': 'Fresh water taken from rivers, groundwater and the mains per tonne produced.',
    'Discharge quality': 'Pollution load in water returned to the environment.',
    'Basin risk': 'Exposure of sites located in water-stressed river basins.',
    'Nitrogen': 'Nitrogen oxides from combustion, which return to land and water as fertiliser pollution.',
    'Phosphorus': 'Phosphates from surface treatment discharged to wastewater.',
    'Absolute CO₂ pathway': 'Total CO₂ locked in by today’s investment decisions.',
    'Marine freight': 'Emissions from shipping inputs and products by sea.',
    'Particulates': 'Fine dust released from furnaces and material handling.',
    'Combustion sources': 'Diesel vehicles and burners on site that emit soot and particulates.',
    'Refrigerants': 'Ozone-depleting gases leaking from cooling equipment.',
    'Hazardous chemicals': 'Persistent or toxic substances in products and waste.',
    'Circularity': 'Materials and plastics kept in use, or kept out of the environment.'
  };
  // b, driver, action, module 0–6, KPI, unit, dir (-1 lower is better), [FY23,FY24,FY25], sector, target, materiality, €k run-rate, status, note
  const ACTIONS = [
    ['climate','Scope 1 & 2 intensity','Furnace heat recovery',3,'Scope 1 intensity','tCO₂e/€m',-1,[195,182,161],175,140,5,420,'In progress','Found while stabilising the furnace line: waste heat now preheats the charge. Tracked monthly in the energy and emissions KPI.'],
    ['climate','Scope 1 & 2 intensity','Renewable power PPA',0,'Scope 2 intensity','tCO₂e/€m',-1,[70,64,41],58,10,4,85,'Delivered','A ten-year power purchase agreement set at board level as part of the strategic direction. Its full effect shows in FY2025.'],
    ['climate','Scope 1 & 2 intensity','Net-zero lighthouse line',6,'Output from net-zero-ready line','%',1,[2,5,8],3,25,3,200,'In progress','One production line rebuilt as the showcase for the group. Its share of output grows as it ramps up.'],
    ['climate','Value chain (Scope 3)','Supplier decarbonisation',2,'Spend with SBTi-aligned suppliers','%',1,[19,27,31],28,60,4,60,'In progress','Context mapping showed most emissions sit with suppliers; the top 40 now report against science-based targets.'],
    ['climate','Value chain (Scope 3)','Freight modal shift to rail',1,'Freight emissions','tCO₂e/kt',-1,[50,48,49],46,35,2,140,'In progress','An idea from the 360° workshop to move long-haul freight to rail. It slipped this year while a rail terminal was closed for works.'],
    ['climate','Energy productivity','Compressed-air leak programme',3,'Energy use','kWh/t',-1,[640,612,571],590,520,4,310,'Delivered','Leak tagging and repair rounds built into shift routines. Delivered and kept, which is the point of Stabilising.'],
    ['biosphere','Site ecosystems','Rewild 12 ha of site land',6,'Site area managed for nature','%',1,[6,9,11],8,20,2,15,'In progress','Unused site land turned into meadow and wetland, used to engage employees and the local community.'],
    ['biosphere','Sourcing footprint','Deforestation-free packaging',4,'Certified-fibre packaging','%',1,[52,58,56],70,100,3,20,'In progress','The certified-fibre share is reported monthly through Controlling. It dipped when one supplier lost certification.'],
    ['land','Land-use efficiency','Warehouse consolidation',0,'Built footprint','m²/€m',-1,[420,410,418],380,340,2,260,'Planned','A planned move from three leased warehouses to one brownfield site. The footprint rose temporarily during the overlap.'],
    ['land','Upstream land use','Recycled metal input',5,'Recycled input content','%',1,[33,36,38],38,55,4,520,'In progress','Valorisation priced the scrap premium against virgin metal and carbon cost. Recycled input is now the largest value line.'],
    ['water','Withdrawal','Closed-loop cooling with AI water treatment',3,'Water withdrawn','m³/t',-1,[4.0,3.8,3.1],3.5,2.2,5,190,'In progress','AI-controlled water treatment keeps cooling water in a closed loop, so far less fresh water is needed.'],
    ['water','Withdrawal','Rainwater harvesting',1,'Non-potable use from harvested water','%',1,[6,8,9],7,20,2,25,'Delivered','A shop-floor idea from the 360° workshop: roof water now feeds cleaning and cooling top-up.'],
    ['water','Discharge quality','Real-time effluent monitoring',4,'COD in effluent','mg/L',-1,[95,92,78],85,60,3,45,'Delivered','Online sensors report effluent quality to Controlling in real time, so deviations are fixed within the shift.'],
    ['water','Basin risk','Water-stress mapping and site plans',2,'High-stress sites with a water plan','%',1,[40,55,70],45,100,3,30,'In progress','Establishing Context ranked every site by river-basin stress; each high-stress site now has a water plan.'],
    ['bgc','Nitrogen','Low-NOx burner retrofit',3,'NOx emissions','kg/t',-1,[2.0,1.9,1.95],1.7,1.2,3,35,'In progress','The retrofit is late because of supplier lead times, and emissions rose slightly with higher furnace load.'],
    ['bgc','Phosphorus','Phosphate-free surface treatment',1,'Phosphorus discharged','kg/yr',-1,[1500,1450,1490],1200,600,3,50,'Planned','A 360° workshop idea still in trials. Phosphorus discharge rose with volume, so this wedge grew.'],
    ['ocean','Absolute CO₂ pathway','Internal carbon price on capex',5,'Capex screened at €100/t CO₂','%',1,[20,40,65],35,100,3,80,'Delivered','Every capex request is now valued with a €100 per tonne CO₂ shadow price, steering investment to low-carbon options.'],
    ['ocean','Marine freight','Low-carbon shipping contracts',2,'Maritime freight emissions','tCO₂e/kt',-1,[20,21,22],19,14,2,10,'Planned','Identified in the context review. The contracts renew next year, so the KPI has not moved yet.'],
    ['aerosol','Particulates','Baghouse filter upgrade',3,'PM10 emissions','kg/t',-1,[0.45,0.42,0.30],0.35,0.20,3,40,'Delivered','New filter bags and pressure monitoring cut dust per tonne by 29% in one year.'],
    ['aerosol','Combustion sources','Site fleet electrification',6,'Electrified site fleet','%',1,[30,45,52],40,100,2,55,'In progress','Electric forklifts and yard tractors, rolled out site by site as a visible signal of change.'],
    ['ozone','Refrigerants','HCFC chiller phase-out',4,'Refrigerant leakage (ODP-weighted)','kg CFC-11e',-1,[3.5,3.2,2.1],2.0,0,2,12,'Delivered','Leak checks are logged through Controlling; the oldest chillers were replaced in the first phase.'],
    ['novel','Hazardous chemicals','PFAS substitution in coatings',0,'PFAS-free product lines','%',1,[44,52,63],55,100,5,150,'In progress','A strategic choice to be PFAS-free ahead of EU restrictions, protecting market access.'],
    ['novel','Hazardous chemicals','Hazardous waste reduction',3,'Hazardous waste','kg/t',-1,[6.6,6.4,6.6],5.2,4.0,3,110,'In progress','Waste rose with a one-off tank clean-out; the stabilising routine is being reset.'],
    ['novel','Circularity','Take-back and remanufacturing',5,'Products in take-back scheme','%',1,[7,10,14],10,30,3,280,'In progress','Valorisation showed remanufactured parts earn a higher margin than new ones, so the scheme is being expanded.'],
    ['novel','Circularity','Plastic pellet containment',4,'Pellet-loss incidents','per year',-1,[10,9,11],6,0,2,5,'Planned','Incidents are counted by Controlling. More spills this year show the containment is not yet working.']
  ].map((r, i) => ({ i, b: r[0], drv: r[1], act: r[2], mod: r[3], kpi: r[4], unit: r[5], dir: r[6], v: r[7], sec: r[8], tgt: r[9], w: r[10], val: r[11], st: r[12], note: r[13] }));

  /* ── METRICS ──────────────────────────────────────── */
  const pOf = (a, x = a.v[2]) => { const d = Math.abs(a.sec - a.tgt) || Math.abs(a.tgt) * 0.2 || 1; return Math.max(0.12, 1 + a.dir * (a.tgt - x) / d); };
  const chg = a => Math.max(-0.5, Math.min(0.5, a.dir * (a.v[2] - a.v[1]) / (Math.abs(a.v[1]) || 1)));
  const real = a => a.val * (REALISE[a.st] ?? 0);
  const wavg = (L, f) => { let w = 0, s = 0; L.forEach(a => { w += a.w; s += a.w * f(a); }); return w ? s / w : 0; };
  const sum = (L, f) => L.reduce((t, a) => t + f(a), 0);
  const zone = p => p <= 1 ? 'within target' : p <= 2 ? 'between target and sector median' : 'worse than sector median';
  const ZC = { g0: '#2F8F4E', g1: '#A9D66A', y: '#F2DC4A', r: '#B4472C' };
  const zcol = p => p <= 1 ? ZC.g1 : p <= 2 ? ZC.y : ZC.r;
  const nf = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
  const eur = k => Math.abs(k) >= 1000 ? '€' + (k / 1000).toFixed(2) + 'm' : '€' + Math.round(k) + 'k';
  const pct = s => (s >= 0 ? '+' : '−') + Math.abs(s * 100).toFixed(1) + '%';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const drivers = b => [...new Set(ACTIONS.filter(a => a.b === b).map(a => a.drv))];
  const inSel = (s, a) => s.lvl === 0 || (a.b === s.b && (s.lvl < 2 || a.drv === s.d) && (s.lvl < 3 || a.i === s.i));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  /* ── STATE & ELEMENTS ─────────────────────────────── */
  let S = { lvl: 0 }, lastTrigger = null;
  const $ = id => document.getElementById(id);
  const fig = $('pwFig'), stage = $('pwStage'), dlg = $('pwDialog'), intro = $('pwIntro');
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, at, parent) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); if (parent) parent.appendChild(n); return n; };
  const XY = (r, a) => [+(r * Math.sin(a)).toFixed(2), +(-r * Math.cos(a)).toFixed(2)];
  function arcP(r0, r1, a0, a1) {
    const la = a1 - a0 > Math.PI ? 1 : 0, [x0, y0] = XY(r1, a0), [x1, y1] = XY(r1, a1);
    let d = `M${x0},${y0}A${r1},${r1} 0 ${la} 1 ${x1},${y1}`;
    if (r0 > 0) { const [x2, y2] = XY(r0, a1), [x3, y3] = XY(r0, a0); d += `L${x2},${y2}A${r0},${r0} 0 ${la} 0 ${x3},${y3}Z`; } else d += 'L0,0Z';
    return d;
  }
  const lineP = (r, a0, a1, rev) => { const [x0, y0] = XY(r, rev ? a1 : a0), [x1, y1] = XY(r, rev ? a0 : a1); return `M${x0},${y0}A${r},${r} 0 0 ${rev ? 0 : 1} ${x1},${y1}`; };
  const G = { b: {}, d: {}, a: {} };

  /* ── WHEEL ────────────────────────────────────────── */
  function draw() {
    const W = Math.round(fig.clientWidth);
    if (!W) return;
    svg.setAttribute('viewBox', `${-W / 2} ${-W / 2} ${W} ${W}`);
    svg.textContent = '';
    G.b = {}; G.d = {}; G.a = {};
    const band = Math.max(26, W * 0.075), dband = W >= 440 ? Math.max(17, W * 0.036) : 0;
    const Ro = W / 2 - band - dband - 8, seg = 2 * Math.PI / 9, pad = 0.005;
    const rp = p => Math.min(p, 3) / 3 * Ro, r0 = Ro + dband + 2, r1 = Ro + dband + band;
    const defs = el('defs', {}, svg);
    const gr = el('radialGradient', { id: 'pwSafe', gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: rp(1) }, defs);
    el('stop', { offset: 0, 'stop-color': ZC.g0 }, gr); el('stop', { offset: 1, 'stop-color': ZC.g1 }, gr);
    const fl = el('filter', { id: 'pwBlur', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
    el('feGaussianBlur', { stdDeviation: Math.max(1.6, W / 300) }, fl);
    const fs = Math.min(14, band * 0.4), dfs = Math.min(11.5, dband * 0.6);
    const label = (parent, r, a0, a1, id, full, alt, size, weight) => {
      const m = ((a0 + a1) / 2 + 2 * Math.PI) % (2 * Math.PI), bot = m > Math.PI / 2 && m < 3 * Math.PI / 2, rr = bot ? r + size * 0.35 : r - size * 0.35;
      el('path', { id, d: lineP(rr, a0, a1, bot) }, defs);
      const t = el('text', { class: 'pw-lbl', 'font-size': size, 'font-weight': weight }, parent);
      const tp = el('textPath', { href: '#' + id, startOffset: '50%', 'text-anchor': 'middle' }, t);
      const room = (a1 - a0) * rr - 10, fit = s => { tp.textContent = s; return tp.getComputedTextLength() <= room; };
      if (fit(full) || (alt && fit(alt))) return;
      const src = alt || full;
      for (let n = src.length - 1; n >= 4; n--) if (fit(src.slice(0, n - 1).trimEnd() + '…')) return;
      tp.textContent = '';
    };
    const hit = (node, kind, key, aria) => { node.setAttribute('tabindex', '0'); node.setAttribute('role', 'button'); node.setAttribute('aria-label', aria); node.dataset.kind = kind; node.dataset.key = key; };

    WHEEL.forEach((b, k) => {
      const B = BND[b], b0 = k * seg - seg / 2, b1 = b0 + seg;
      const gb = el('g', { class: 'pw-b' }, svg); G.b[b] = gb;
      el('path', { class: 'pw-slice', d: arcP(0, Ro, b0 + pad, b1 - pad) }, gb);
      [1, 2].forEach(z => el('path', { class: 'pw-gridl', d: lineP(rp(z), b0 + pad, b1 - pad) }, gb));
      const ring = el('path', { class: 'pw-ring', d: arcP(r0, r1, b0 + pad, b1 - pad) }, gb);
      const BA = ACTIONS.filter(a => a.b === b);
      hit(ring, 'b', b, `${B.name}: open layer 1`);
      label(gb, (r0 + r1) / 2, b0 + pad, b1 - pad, 'pwbl' + k, B.name, B.short, fs, 700);
      const tot = sum(BA, a => a.w); let cur = b0;
      drivers(b).forEach((d, j) => {
        const gd = el('g', { class: 'pw-d' }, gb); G.d[b + '|' + d] = gd;
        const DA = BA.filter(a => a.drv === d), da0 = cur;
        DA.forEach(a => {
          const a0 = cur, a1 = cur + a.w / tot * seg; cur = a1;
          const p = pOf(a), pg = pOf(a, a.v[1]);
          const ga = el('g', { class: 'pw-a' }, gd); G.a[a.i] = ga;
          el('path', { d: arcP(0, rp(Math.min(p, 1)), a0 + pad, a1 - pad), fill: 'url(#pwSafe)' }, ga);
          if (p > 1) el('path', { d: arcP(rp(1), rp(Math.min(p, 2)), a0 + pad, a1 - pad), fill: ZC.y }, ga);
          if (p > 2) el('path', { d: arcP(rp(2), rp(p), a0 + pad, a1 - pad), fill: ZC.r }, ga);
          el('path', { class: 'pw-ghost', d: lineP(rp(pg), a0 + pad * 3, a1 - pad * 3) }, ga);
          el('path', { class: 'pw-sel', d: arcP(0, rp(p), a0 + pad, a1 - pad) }, ga);
          const h = el('path', { class: 'pw-hit', d: arcP(0, Ro, a0, a1) }, ga);
          hit(h, 'a', a.i, `${a.act}: open layer 3`);
        });
        if (dband) {
          const tab = el('path', { class: 'pw-tab', d: arcP(Ro + 2, Ro + dband, da0 + pad, cur - pad) }, gd);
          hit(tab, 'd', b + '|' + d, `${d}: open layer 2`);
          label(gd, Ro + 2 + dband / 2, da0 + pad, cur - pad, `pwdl${k}_${j}`, d, '', dfs, 600);
        }
      });
    });
    applySel(false);
  }

  /* ── BRIDGE ───────────────────────────────────────── */
  function bridgeRows() {
    const tot = sum(ACTIONS, real), run = sum(ACTIONS, a => a.val), rows = [];
    rows.push({ k: 'base', label: 'FY2024 EBITDA', total: BASE_EBITDA });
    if (S.lvl === 0) {
      WHEEL.forEach(b => rows.push({ k: 'b:' + b, label: BND[b].name, v: sum(ACTIONS.filter(a => a.b === b), real) }));
    } else {
      const on = ACTIONS.filter(a => inSel(S, a)), other = tot - sum(on, real);
      const otherLabel = S.lvl === 1 ? 'Other 8 boundaries' : S.lvl === 2 ? 'All other drivers' : 'All other actions';
      rows.push({ k: 'other', label: otherLabel, v: other, off: true });
      if (S.lvl === 1) drivers(S.b).forEach(d => rows.push({ k: 'd:' + d, label: d, v: sum(on.filter(a => a.drv === d), real), on: true }));
      else on.forEach(a => rows.push({ k: 'a:' + a.i, label: a.act, v: real(a), on: true, note: a.st === 'Planned' ? 'planned' : '' }));
    }
    rows.push({ k: 'fy25', label: 'FY2025 EBITDA', total: BASE_EBITDA + tot });
    if (S.lvl === 0) rows.push({ k: 'pipe', label: 'Pipeline still ramping up', v: run - tot, pipe: true });
    else {
      const onPipe = sum(ACTIONS.filter(a => inSel(S, a)), a => a.val - real(a));
      rows.push({ k: 'pipe', label: 'Pipeline · this selection', v: onPipe, pipe: true, on: true });
      rows.push({ k: 'pipe2', label: 'Pipeline · everything else', v: run - tot - onPipe, pipe: true, off: true });
    }
    rows.push({ k: 'run', label: 'Run-rate EBITDA', total: BASE_EBITDA + run });
    return rows;
  }
  function renderBridge(animate) {
    const host = $('pwBridge'), rows = bridgeRows();
    const lo = BASE_EBITDA - 600, hi = BASE_EBITDA + sum(ACTIONS, a => a.val) + 150, x = v => (v - lo) / (hi - lo) * 100;
    let acc = BASE_EBITDA; const seen = new Set();
    rows.forEach(r => {
      let a, b;
      if (r.total != null) { a = lo; b = r.total; acc = r.total; } else { a = acc; b = acc + r.v; acc = b; }
      if (r.k === 'run') a = lo;
      let row = host.querySelector(`[data-k="${CSS.escape(r.k)}"]`);
      const fresh = !row;
      if (fresh) {
        row = document.createElement('div');
        row.dataset.k = r.k;
        row.innerHTML = '<span class="pw-br-l"></span><span class="pw-br-t"><i></i></span><span class="pw-br-v"></span>';
      }
      row.className = 'pw-br-row' + (r.total != null ? ' is-total' : '') + (r.pipe ? ' is-pipe' : '') + (r.off ? ' is-off' : '') + (r.on ? ' is-on' : '');
      row.children[0].textContent = r.label;
      row.children[2].textContent = r.total != null ? eur(r.total) : (r.note ? 'planned' : '+' + eur(r.v));
      const bar = row.children[1].firstChild, L = x(Math.min(a, b)) + '%', Wd = `max(3px, ${Math.abs(x(b) - x(a))}%)`;
      if (fresh && animate && !reduce.matches) { bar.style.left = L; bar.style.width = '0'; requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = Wd; })); }
      else { bar.style.left = L; bar.style.width = Wd; }
      host.appendChild(row); seen.add(r.k);
    });
    [...host.children].forEach(c => { if (!seen.has(c.dataset.k)) c.remove(); });
    const on = ACTIONS.filter(a => inSel(S, a)), rr = sum(on, real), rv = sum(on, a => a.val), all = sum(ACTIONS, real);
    $('pwKpis').innerHTML = [
      [eur(rr), S.lvl ? 'Realised in FY2025 by this selection' : 'EBITDA uplift realised in FY2025'],
      [eur(rv), 'Run-rate value once fully delivered'],
      [S.lvl ? Math.round(rr / all * 100) + '%' : on.length, S.lvl ? 'Share of this year’s uplift' : 'Actions tracked on the wheel']
    ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
  }

  /* ── DIALOG ───────────────────────────────────────── */
  const fact = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
  const zdot = p => `<i class="pw-zdot" style="background:${zcol(p)}"></i>`;
  function dialogHTML() {
    const n = ACTIONS.length;
    if (S.lvl === 1) {
      const B = BND[S.b], L = ACTIONS.filter(a => a.b === S.b), ds = drivers(S.b), p = wavg(L, pOf);
      return { tag: 'Layer 1 · Planetary boundary', title: B.name,
        body: `<p>The other eight boundaries are out of focus. ${esc(B.name)} holds ${L.length} of the client’s ${n} actions across ${ds.length} value driver${ds.length > 1 ? 's' : ''}. ${esc(B.note)}</p>
          <p class="pw-how">Each wedge is one action. The further it reaches out from the green core, the further the KPI is from target; the dashed line shows where it stood in FY2024. The EBITDA bridge now splits this boundary out from the rest.</p>
          <dl class="pw-facts">${fact('Global status (PHC 2025)', esc(B.st))}${fact('Client position', zdot(p) + zone(p))}${fact('Change vs FY2024', pct(wavg(L, chg)))}${fact('Realised / run-rate', eur(sum(L, real)) + ' / ' + eur(sum(L, a => a.val)))}</dl>`,
        deeper: ds.map(d => { const DA = L.filter(a => a.drv === d); return { kind: 'd', key: S.b + '|' + d, label: d, p: wavg(DA, pOf), sub: DA.length + ' action' + (DA.length > 1 ? 's' : '') }; }),
        deeperLabel: 'Go one layer deeper: value drivers' };
    }
    if (S.lvl === 2) {
      const L = ACTIONS.filter(a => a.b === S.b && a.drv === S.d), p = wavg(L, pOf), mods = [...new Set(L.map(a => MODS[a.mod].slice(5)))];
      return { tag: 'Layer 2 · Value driver', title: S.d, crumb: BND[S.b].name,
        body: `<p>${esc(DRV[S.d] || '')} Everything outside this driver is now out of focus. ${L.length} action${L.length > 1 ? 's feed' : ' feeds'} it, owned by ${esc(mods.join(' and '))}.</p>
          <p class="pw-how">In the bridge, each action now gets its own step, so you can see which one creates the value and which is still pipeline.</p>
          <dl class="pw-facts">${fact('Driver position', zdot(p) + zone(p))}${fact('Change vs FY2024', pct(wavg(L, chg)))}${fact('Realised / run-rate', eur(sum(L, real)) + ' / ' + eur(sum(L, a => a.val)))}</dl>`,
        deeper: L.map(a => ({ kind: 'a', key: a.i, label: a.act, p: pOf(a), sub: a.st })),
        deeperLabel: 'Go one layer deeper: actions' };
    }
    const a = ACTIONS[S.i], p = pOf(a), c = chg(a), vals = [...a.v, a.sec, a.tgt], mx = Math.max(...vals.map(Math.abs)) || 1;
    const labs = ['FY2023', 'FY2024', 'FY2025', 'Sector median', 'Target'];
    const sib = ACTIONS.filter(x => x.b === a.b && x.drv === a.drv), next = sib[(sib.indexOf(a) + 1) % sib.length];
    return { tag: 'Layer 3 · Action and KPI', title: a.act, crumb: BND[a.b].name + ' › ' + a.drv,
      body: `<p><a class="pw-mod" href="7-modules.html#module-${a.mod + 1}">${esc(MODS[a.mod])}</a> · ${esc(a.st)}</p>
        <p>${esc(a.note)}</p>
        <p class="pw-how">KPI: ${esc(a.kpi)} (${esc(a.unit)}), ${a.dir < 0 ? 'lower' : 'higher'} is better. This wedge sits ${zone(p)}, ${c > 0.0005 ? 'improved' : c < -0.0005 ? 'worse' : 'unchanged'} on FY2024 (${pct(c)}).</p>
        <div class="pw-kpi">${vals.map((v, j) => `<div class="${j === 2 ? 'cur' : ''}"><span>${labs[j]}</span><span class="pw-kbar"><i style="width:${Math.abs(v) / mx * 100}%;${j === 2 ? 'background:' + zcol(p) : ''}"></i></span><span>${nf.format(v)}</span></div>`).join('')}</div>
        <dl class="pw-facts">${fact('Run-rate value', eur(a.val) + ' a year')}${fact('Realised in FY2025', eur(real(a)) + (a.st === 'In progress' ? ' (half-year ramp)' : ''))}</dl>`,
      deeper: sib.length > 1 ? [{ kind: 'a', key: next.i, label: 'Next in this driver: ' + next.act, p: pOf(next), sub: next.st }] : [],
      deeperLabel: sib.length > 1 ? 'Keep exploring' : '' };
  }
  function renderDialog() {
    if (S.lvl === 0) { dlg.hidden = true; intro.hidden = false; return; }
    const D = dialogHTML();
    intro.hidden = true;
    dlg.innerHTML = `<div class="pw-dlg-top"><span class="pw-dlg-tag">${D.tag}</span><button type="button" class="pw-x" data-act="close" aria-label="Close and return to overview">×</button></div>
      ${D.crumb ? `<p class="pw-dlg-crumb">${esc(D.crumb)}</p>` : ''}
      <h3 id="pwDlgTitle" tabindex="-1">${esc(D.title)}</h3>
      <p class="pw-dlg-eye">What you are seeing</p>${D.body}
      ${D.deeper.length ? `<p class="pw-dlg-eye">${D.deeperLabel}</p><div class="pw-deeper">${D.deeper.map(x => `<button type="button" data-kind="${x.kind}" data-key="${esc(x.key)}">${zdot(x.p)}<span>${esc(x.label)}<small>${esc(x.sub)}</small></span><b aria-hidden="true">›</b></button>`).join('')}</div>` : ''}
      <div class="pw-dlg-foot"><button type="button" class="btn btn-outline-dark" data-act="up">${S.lvl === 1 ? '← Overview' : '← Back one layer'}</button></div>`;
    dlg.hidden = false;
    dlg.classList.remove('pw-in'); void dlg.offsetWidth; dlg.classList.add('pw-in');
  }

  /* ── SELECTION ────────────────────────────────────── */
  function setOff(node, off) { node.classList.toggle('is-off', off); if (off) node.setAttribute('filter', 'url(#pwBlur)'); else node.removeAttribute('filter'); }
  function applySel(animate) {
    stage.classList.toggle('is-focus', S.lvl > 0);
    for (const b in G.b) { setOff(G.b[b], S.lvl > 0 && b !== S.b); G.b[b].classList.toggle('is-on', S.lvl > 0 && b === S.b); }
    for (const k in G.d) { const [b, d] = k.split('|'); setOff(G.d[k], S.lvl >= 2 && b === S.b && d !== S.d); }
    for (const i in G.a) { const a = ACTIONS[i]; setOff(G.a[i], S.lvl === 3 && a.b === S.b && a.drv === S.d && a.i !== S.i); G.a[i].classList.toggle('is-on', S.lvl === 3 && a.i === S.i); }
    $('pwReset').hidden = S.lvl === 0;
    $('pwStart').hidden = S.lvl > 0;
    $('pwBridgeSub').textContent = S.lvl === 0 ? 'How the realised value of all actions moves EBITDA from FY2024 to FY2025, and what is still to come.' : 'The selection is broken out step by step; everything else is collapsed and out of focus.';
    renderBridge(animate);
  }
  function select(kind, key, trigger) {
    if (trigger) lastTrigger = trigger;
    if (kind === 'b') S = { lvl: 1, b: key };
    else if (kind === 'd') { const [b, d] = String(key).split('|'); S = { lvl: 2, b, d }; }
    else if (kind === 'a') { const a = ACTIONS[+key]; S = { lvl: 3, b: a.b, d: a.drv, i: a.i }; }
    else S = { lvl: 0 };
    applySel(true); renderDialog();
    if (S.lvl) {
      const t = $('pwDlgTitle'); if (t) t.focus({ preventScroll: true });
      if (matchMedia('(max-width: 900px)').matches) fig.scrollIntoView({ block: 'start', behavior: reduce.matches ? 'auto' : 'smooth' });
    } else if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
  }
  function up() { if (S.lvl === 3) select('d', S.b + '|' + S.d); else if (S.lvl === 2) select('b', S.b); else select(); }

  /* ── EVENTS ───────────────────────────────────────── */
  svg.addEventListener('click', e => { const t = e.target.closest('[data-kind]'); if (t) select(t.dataset.kind, t.dataset.key, t); else if (S.lvl) select(); });
  svg.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; const t = e.target.closest('[data-kind]'); if (t) { e.preventDefault(); select(t.dataset.kind, t.dataset.key, t); } });
  dlg.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.act === 'close') select(); else if (t.dataset.act === 'up') up(); else if (t.dataset.kind) select(t.dataset.kind, t.dataset.key);
  });
  $('pwReset').addEventListener('click', () => select());
  $('pwStart').addEventListener('click', e => select('b', 'water', e.currentTarget));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.lvl) select(); });

  // tooltip
  const tip = $('pwTip');
  svg.addEventListener('pointermove', e => {
    const t = e.target.closest('[data-kind]');
    if (!t || e.pointerType === 'touch') { tip.style.opacity = 0; return; }
    let h = '';
    if (t.dataset.kind === 'a') { const a = ACTIONS[+t.dataset.key]; h = `<b>${esc(a.act)}</b>${esc(a.kpi)}: ${nf.format(a.v[2])} ${esc(a.unit)}<br>${zone(pOf(a))}`; }
    else if (t.dataset.kind === 'd') { const [, d] = t.dataset.key.split('|'); h = `<b>${esc(d)}</b>Value driver · click to open`; }
    else { const B = BND[t.dataset.key]; h = `<b>${esc(B.name)}</b>Global status: ${esc(B.st)} · click to open`; }
    tip.innerHTML = h; tip.style.opacity = 1;
    tip.style.left = Math.min(e.clientX + 14, innerWidth - 260) + 'px'; tip.style.top = (e.clientY + 16) + 'px';
  });
  svg.addEventListener('pointerleave', () => { tip.style.opacity = 0; });

  const ro = new ResizeObserver(() => draw()); ro.observe(fig);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  renderDialog();
})();
