/* Neptune — rainfall history, trend curve, 5-year extrapolation and water-stress test.
   Lives on the "Country, Region & Water Stress" page. Uses globals from neptune-app.js
   (state, WATER_STRESS, setupCanvas). Data: Open-Meteo historical archive (ERA5), daily
   precipitation, free and CORS-enabled, no key. */

// Cities per country (lat, lon). The first entry is the default.
const RAIN_CITIES = {
  "Australia":[["Sydney",-33.87,151.21],["Melbourne",-37.81,144.96],["Perth",-31.95,115.86],["Brisbane",-27.47,153.03]],
  "Austria":[["Vienna",48.21,16.37],["Linz",48.31,14.29],["Graz",47.07,15.44]],
  "Belgium":[["Brussels",50.85,4.35],["Antwerp",51.22,4.40],["Ghent",51.05,3.72],["Liège",50.63,5.57]],
  "Brazil":[["São Paulo",-23.55,-46.63],["Rio de Janeiro",-22.91,-43.17],["Belo Horizonte",-19.92,-43.94]],
  "China":[["Beijing",39.90,116.41],["Shanghai",31.23,121.47],["Guangzhou",23.13,113.26],["Tianjin",39.34,117.36]],
  "Czech Republic":[["Prague",50.08,14.44],["Ostrava",49.82,18.26],["Brno",49.20,16.61]],
  "France":[["Paris",48.86,2.35],["Lyon",45.76,4.84],["Marseille",43.30,5.37],["Dunkirk",51.03,2.38]],
  "Germany":[["Bremen",53.08,8.80],["Berlin",52.52,13.40],["Duisburg",51.43,6.76],["Munich",48.14,11.58],["Hamburg",53.55,9.99]],
  "India":[["Mumbai",19.08,72.88],["Delhi",28.61,77.21],["Chennai",13.08,80.27],["Jamshedpur",22.80,86.20]],
  "Israel":[["Tel Aviv",32.09,34.78],["Haifa",32.79,34.99],["Beersheba",31.25,34.79]],
  "Italy":[["Milan",45.46,9.19],["Rome",41.90,12.50],["Taranto",40.46,17.24],["Turin",45.07,7.69]],
  "Japan":[["Tokyo",35.68,139.69],["Osaka",34.69,135.50],["Nagoya",35.18,136.91]],
  "Mexico":[["Mexico City",19.43,-99.13],["Monterrey",25.69,-100.32],["Guadalajara",20.66,-103.35]],
  "Morocco":[["Casablanca",33.57,-7.59],["Rabat",34.02,-6.83],["Tangier",35.76,-5.83]],
  "Netherlands":[["Amsterdam",52.37,4.90],["Rotterdam",51.92,4.48],["IJmuiden",52.46,4.61]],
  "Norway":[["Oslo",59.91,10.75],["Bergen",60.39,5.32],["Trondheim",63.43,10.40]],
  "Poland":[["Warsaw",52.23,21.01],["Katowice",50.26,19.02],["Kraków",50.06,19.94],["Gdańsk",54.35,18.65]],
  "Qatar":[["Doha",25.29,51.53],["Mesaieed",24.99,51.55]],
  "Saudi Arabia":[["Riyadh",24.71,46.68],["Jeddah",21.49,39.19],["Jubail",27.01,49.66],["Dammam",26.42,50.09]],
  "South Africa":[["Johannesburg",-26.20,28.05],["Cape Town",-33.92,18.42],["Durban",-29.86,31.02]],
  "South Korea":[["Seoul",37.57,126.98],["Busan",35.18,129.08],["Pohang",36.02,129.34],["Ulsan",35.54,129.31]],
  "Spain":[["Madrid",40.42,-3.70],["Barcelona",41.39,2.17],["Bilbao",43.26,-2.93],["Gijón",43.53,-5.66],["Seville",37.39,-5.98]],
  "Sweden":[["Stockholm",59.33,18.07],["Gothenburg",57.71,11.97],["Luleå",65.58,22.15]],
  "Turkey":[["Istanbul",41.01,28.98],["Ankara",39.93,32.86],["İzmir",38.42,27.14],["İskenderun",36.59,36.17]],
  "UAE":[["Dubai",25.20,55.27],["Abu Dhabi",24.45,54.38],["Sharjah",25.35,55.42]],
  "UK":[["London",51.51,-0.13],["Port Talbot",51.59,-3.78],["Manchester",53.48,-2.24],["Teesside",54.57,-1.23]],
  "USA":[["Pittsburgh",40.44,-80.00],["Chicago",41.88,-87.63],["Houston",29.76,-95.37],["Los Angeles",34.05,-118.24],["Phoenix",33.45,-112.07]],
};

// Scenario colours (validated: light & dark, CVD-separated). Status quo is a neutral reference line.
const RAIN_SC = [
  {key:"sq",  label:"Status quo",     light:"#6A8598", dark:"#8AA5B8", dash:[6,4]},
  {key:"min", label:"Minimal stress", light:"#2E8B57", dark:"#3DA06C"},
  {key:"std", label:"Standard",       light:"#1670B0", dark:"#4A9BE0"},
  {key:"str", label:"Stressed",       light:"#C5402E", dark:"#E8604C"},
];

const rainCache = {};          // "lat,lon" -> {time:[], precip:[]}
let rainModel = null;          // last computed analysis
let rainElastManual = false;
let rainReq = 0;

function rainIsDark(){
  const s = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
  const m = s.match(/^#?([0-9a-f]{6})$/i); if(!m) return false;
  const n = parseInt(m[1],16); return (((n>>16)&255)*0.299+((n>>8)&255)*0.587+(n&255)*0.114) < 128;
}
function rainVar(name, fb){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fb; }
function scCol(sc){ return rainIsDark()?sc.dark:sc.light; }

// ── Page wiring ───────────────────────────────────────────────────────────────

function populateRainCities(){
  const sel = document.getElementById("rainCity"); if(!sel) return;
  const list = RAIN_CITIES[state.selected_country] || [];
  sel.innerHTML = list.map((c,i)=>`<option value="${i}">${c[0]}</option>`).join("") + `<option value="custom">Custom coordinates…</option>`;
  sel.value = list.length ? "0" : "custom";
  onRainCityChange();
}

function onRainCityChange(){
  const sel = document.getElementById("rainCity");
  const list = RAIN_CITIES[state.selected_country] || [];
  if(sel.value !== "custom" && list[+sel.value]){
    const c = list[+sel.value];
    document.getElementById("rainLat").value = c[1];
    document.getElementById("rainLon").value = c[2];
  }
  loadRainHistory();
}

function rainPlaceName(){
  const sel = document.getElementById("rainCity");
  const list = RAIN_CITIES[state.selected_country] || [];
  return sel && sel.value !== "custom" && list[+sel.value] ? list[+sel.value][0] : "custom site";
}

function isoDate(d){ return d.toISOString().slice(0,10); }

async function loadRainHistory(){
  const lat = parseFloat(document.getElementById("rainLat").value);
  const lon = parseFloat(document.getElementById("rainLon").value);
  const banner = document.getElementById("rainBanner");
  if(!Number.isFinite(lat) || !Number.isFinite(lon)){ banner.textContent = "Enter a latitude and longitude to load the rainfall history."; return; }
  const end = new Date(Date.now() - 6*864e5);                 // the archive lags real time by ~5 days
  const lastFull = end.getUTCMonth()===11 && end.getUTCDate()===31 ? end.getUTCFullYear() : end.getUTCFullYear()-1;
  const y0 = lastFull - 9;
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${y0}`;
  const req = ++rainReq;
  if(!rainCache[key]){
    banner.textContent = `Loading daily rainfall ${y0}–${isoDate(end)} for ${rainPlaceName()} (${lat.toFixed(2)}, ${lon.toFixed(2)})…`;
    try{
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${y0}-01-01&end_date=${isoDate(end)}&daily=precipitation_sum&timezone=UTC`;
      const r = await fetch(url); if(!r.ok) throw new Error("HTTP "+r.status);
      const j = await r.json();
      if(!j.daily || !j.daily.time) throw new Error(j.reason || "no data");
      rainCache[key] = {time:j.daily.time, precip:j.daily.precipitation_sum, y0, lastFull};
    }catch(e){
      if(req!==rainReq) return;
      banner.textContent = "Could not load rainfall history from Open-Meteo ("+e.message+"). Check the connection and try again.";
      rainModel = null; return;
    }
  }
  if(req!==rainReq) return;   // a newer selection superseded this one
  rainModel = buildRainModel(rainCache[key]);
  const m = rainModel;
  banner.textContent = `${rainPlaceName()}, ${state.selected_country} (${lat.toFixed(2)}, ${lon.toFixed(2)}) — ${m.days.length.toLocaleString()} days of daily rainfall, ${m.years[0]}–${m.dataEnd}. Source: Open-Meteo / ERA5.`;
  renderRainAnalysis();
}

// ── Model ─────────────────────────────────────────────────────────────────────

// Least-squares polynomial fit, degree 2: y = a + b·t + c·t²
function polyFit2(t, y){
  const n=t.length; let S=[0,0,0,0,0], T=[0,0,0];
  for(let i=0;i<n;i++){ let p=1; for(let k=0;k<5;k++){ S[k]+=p; if(k<3) T[k]+=p*y[i]; p*=t[i]; } }
  const A=[[S[0],S[1],S[2],T[0]],[S[1],S[2],S[3],T[1]],[S[2],S[3],S[4],T[2]]];
  for(let i=0;i<3;i++){                      // Gauss-Jordan
    let mx=i; for(let r=i+1;r<3;r++) if(Math.abs(A[r][i])>Math.abs(A[mx][i])) mx=r;
    [A[i],A[mx]]=[A[mx],A[i]];
    for(let r=0;r<3;r++){ if(r===i) continue; const f=A[r][i]/A[i][i]; for(let c=i;c<4;c++) A[r][c]-=f*A[i][c]; }
  }
  return [A[0][3]/A[0][0], A[1][3]/A[1][1], A[2][3]/A[2][2]];
}

function quantile(arr, q){
  const a = arr.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length) return 0;
  const p = (a.length-1)*q, lo = Math.floor(p); return a[lo] + (a[Math.min(lo+1,a.length-1)]-a[lo])*(p-lo);
}

function buildRainModel(raw){
  const {time, precip, y0, lastFull} = raw;
  const years = []; for(let y=y0; y<=lastFull; y++) years.push(y);
  const annual = years.map(()=>0);
  const days = time.map((t,i)=>({t, d:new Date(t+"T00:00:00Z"), p:Number.isFinite(precip[i])?precip[i]:0}));
  days.forEach(o=>{ const yi=o.d.getUTCFullYear()-y0; if(yi>=0 && yi<years.length) annual[yi]+=o.p; });

  // Trend curve on annual totals. t = years since the first year.
  const ts = years.map((y,i)=>i);
  const [a,b,c] = polyFit2(ts, annual);
  const fit = t => a + b*t + c*t*t;
  const mean = annual.reduce((s,v)=>s+v,0)/annual.length;
  const ssTot = annual.reduce((s,v)=>s+(v-mean)**2,0);
  const resid = annual.map((v,i)=>v-fit(i));
  const ssRes = resid.reduce((s,v)=>s+v*v,0);
  const r2 = ssTot>0 ? 1-ssRes/ssTot : 0;
  const sigma = Math.sqrt(ssRes/Math.max(1,annual.length-3));      // residual std. error (3 fitted parameters)
  const sdObs = Math.sqrt(ssTot/Math.max(1,annual.length-1));
  // Extrapolation: a quadratic runs away quickly. Beyond the last full year the curve continues
  // along its end slope, damped by half each year (P = P_end + s·(1 − 0.5^Δt)/ln 2), and is held
  // within the 10-year mean ± 2 standard deviations of the observed annual totals.
  const tEnd = years.length-1, pEnd = fit(tEnd), sEnd = b + 2*c*tEnd;
  const lo = Math.max(0.2*mean, mean-2*sdObs), hi = mean+2*sdObs;
  const trend = t => Math.min(hi, Math.max(lo, t<=tEnd ? fit(t) : pEnd + sEnd*(1-Math.pow(0.5,t-tEnd))/Math.LN2));

  // Seasonal shape: mean rainfall by day of year, 31-day circular smoothing, normalised to mean 1.
  const doyOf = d => Math.min(364, Math.floor((d - Date.UTC(d.getUTCFullYear(),0,1))/864e5));
  const raw365 = new Array(365).fill(0), cnt = new Array(365).fill(0);
  days.forEach(o=>{ const k=doyOf(o.d); raw365[k]+=o.p; cnt[k]++; });
  const m365 = raw365.map((v,i)=>cnt[i]?v/cnt[i]:0);
  const seas = m365.map((_,i)=>{ let s=0; for(let k=-15;k<=15;k++) s+=m365[(i+k+365)%365]; return s/31; });
  const sMean = seas.reduce((s,v)=>s+v,0)/365 || 1;
  const season = seas.map(v=>v/sMean);

  // continuous time in "years since first year", centred so annual value i sits mid-year
  const tOf = d => (d - Date.UTC(y0,0,1))/(365.25*864e5) - 0.5;
  const expDaily = (d, annualFn) => annualFn(tOf(d))/365.25 * season[doyOf(d)];

  // 30-day rolling: observed vs trend-expected
  const W = 30, obs30 = [], exp30 = [];
  let so=0, se=0; const ed = days.map(o=>expDaily(o.d, trend));
  days.forEach((o,i)=>{ so+=o.p; se+=ed[i]; if(i>=W){ so-=days[i-W].p; se-=ed[i-W]; } obs30.push(i>=W-1?so:null); exp30.push(i>=W-1?se:null); });

  // Spread of the 30-day deviation by calendar month -> P10..P90 band for the projection
  const devByMonth = Array.from({length:12},()=>[]);
  days.forEach((o,i)=>{ if(obs30[i]!==null) devByMonth[o.d.getUTCMonth()].push(obs30[i]-exp30[i]); });
  const q10 = devByMonth.map(a=>quantile(a,0.10)), q90 = devByMonth.map(a=>quantile(a,0.90));

  // Scenarios for annual rainfall over the projection (t = years since first year)
  const scen = {
    sq:  () => mean,                                        // last decade's average repeats
    std: t => trend(t),                                     // trend curve continues
    // stress cases are anchored to the drier of trend and mean, so a wet recent trend cannot hide them
    min: t => Math.max(0, Math.min(trend(t), mean) - 0.5*sigma),           // mildly dry (≈ P30 year)
    str: t => Math.max(0.15*mean, Math.min(trend(t), mean) - 1.28*sigma),  // a 1-in-10 dry year, every year (P10)
  };

  // Projection: daily points for 5 years after the last observed day
  const dataEndD = days[days.length-1].d;
  const proj = [];
  const horizon = 5*365;
  const roll = {sq:[],min:[],std:[],str:[]};
  // seed rolling windows with the trailing expected values so lines start smoothly
  for(let k=1;k<=horizon;k++){
    const d = new Date(dataEndD.getTime()+k*864e5);
    const row = {d};
    for(const s of Object.keys(scen)){
      const v = expDaily(d, scen[s]); roll[s].push(v); if(roll[s].length>W) roll[s].shift();
      // until a full window of projected days exists, top up with the matching scenario's own value
      row[s] = roll[s].reduce((x,y)=>x+y,0) * (W/roll[s].length);
    }
    row.lo = Math.max(0, row.std + q10[d.getUTCMonth()]);
    row.hi = Math.max(0, row.std + q90[d.getUTCMonth()]);
    proj.push(row);
  }

  // projected years: the year in progress (if any) plus the next five full years; the stress test uses the five
  const curYear = dataEndD.getUTCFullYear();
  const futYears = []; for(let y=lastFull+1; y<=curYear+5; y++) futYears.push(y);
  const futAnnual = {}; for(const s of Object.keys(scen)) futAnnual[s] = futYears.map(y=>scen[s](y-y0));
  const stressIdx = futYears.map((y,i)=>i).filter(i=>futYears[i]>curYear);

  return {years, annual, a, b, c, fit, trend, mean, sigma, sdObs, r2, days, obs30, exp30, proj,
          futYears, futAnnual, stressIdx, curYear, y0, lastFull, dataEnd:isoDate(dataEndD), lo, hi};
}

// ── Stress test: recycling needed ─────────────────────────────────────────────

function rainElasticity(){
  const S = WATER_STRESS[state.selected_country] ?? 1.5;   // 0–5 water-stress score
  return 1 + S/2.5;
}
function requiredRecycle(rainRatio, R0, e){
  // F = share of today's freshwater intake still available; R = recycling rate needed to keep demand supplied
  const F = Math.min(1, Math.max(0.05, 1 - e*Math.max(0, 1 - rainRatio)));
  return Math.min(0.98, 1 - (1 - R0)*F);
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderRainAnalysis(){
  const elastEl = document.getElementById("rainElast");
  if(!rainElastManual) elastEl.value = rainElasticity().toFixed(2);
  document.getElementById("rainTarget").value = state.target_recycle_pct;
  const m = rainModel; if(!m) return;

  const fmt = v => Math.round(v).toLocaleString();
  const iMin = m.annual.indexOf(Math.min(...m.annual)), iMax = m.annual.indexOf(Math.max(...m.annual));
  const tLast = m.years.length-1, slope = m.b + 2*m.c*tLast;
  document.getElementById("rk1").innerHTML = fmt(m.mean)+"<span class='kpi-unit'> mm/yr</span>";
  document.getElementById("rk2").innerHTML = `${fmt(m.annual[iMin])}<span class='kpi-unit'> (${m.years[iMin]})</span> / ${fmt(m.annual[iMax])}<span class='kpi-unit'> (${m.years[iMax]})</span>`;
  document.getElementById("rk3").innerHTML = (slope>=0?"+":"")+slope.toFixed(1)+"<span class='kpi-unit'> mm/yr per yr</span>";
  document.getElementById("rk4").innerHTML = m.r2.toFixed(2);

  const sg = v => (v<0?"− ":"+ ")+Math.abs(v).toFixed(v!==0&&Math.abs(v)<1?3:1);
  const curv = m.c>0 ? "curving upward (rainfall recovering / rising)" : "curving downward (rainfall flattening / declining)";
  document.getElementById("rainFormula").innerHTML =
    `Trend curve (quadratic least squares on annual totals): <code>P(t) = ${m.a.toFixed(1)} ${sg(m.b)}·t ${sg(m.c)}·t²</code> mm/yr, `+
    `with <code>t</code> = years since ${m.y0} · R² = ${m.r2.toFixed(2)} · residual σ = ${fmt(m.sigma)} mm · ${curv}. `+
    (m.r2<0.3 ? ` <b>Low R²: year-to-year variability dominates, so read the curve as indicative.</b>` : "")+
    `<br>Beyond ${m.lastFull} the curve continues along its end slope (${slope>=0?"+":"−"}${Math.abs(slope).toFixed(0)} mm/yr), halving each year, `+
    `and stays within the 10-year mean ± 2 SD (${fmt(m.lo)}–${fmt(m.hi)} mm) so it cannot run away.`;

  drawRainAnnual(m);
  drawRainDaily(m);
  renderRainStress(m);
}

function legendHTML(items){
  return items.map(it=>`<span><i class="${it.sw?'sw':''} ${it.dash?'dash':''}" style="${it.sw?'background:'+it.c:'border-color:'+it.c}"></i>${it.l}</span>`).join("");
}

function rainAxes(ctx, W, H, pad, yMax, yLabel, ticks){
  const ink3 = rainVar("--ink-3","#6A8598"), border = rainVar("--border","#CCDAE4");
  ctx.font = "10px system-ui"; ctx.fillStyle = ink3; ctx.strokeStyle = border; ctx.lineWidth = 1;
  const n = ticks||4;
  for(let k=0;k<=n;k++){
    const v = yMax*k/n, y = pad.t + (H-pad.t-pad.b)*(1-k/n);
    ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(pad.l, Math.round(y)+.5); ctx.lineTo(W-pad.r, Math.round(y)+.5); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.textAlign = "right"; ctx.fillText(Math.round(v).toLocaleString(), pad.l-6, y+3);
  }
  ctx.textAlign = "left"; ctx.fillText(yLabel, pad.l, pad.t-8);
}

function niceMax(v){ const p = Math.pow(10, Math.floor(Math.log10(v||1))); return Math.ceil(v/p*2)/2*p; }

// Annual histogram + curve (history) and scenario projection (dashed region)
function drawRainAnnual(m){
  const c = setupCanvas("rainAnnualCanvas"); if(!c) return;
  const ctx = c.getContext("2d"), W = c.width, H = c.height;
  const pad = {l:56, r:16, t:24, b:30};
  ctx.clearRect(0,0,W,H);
  const allYears = m.years.concat(m.futYears);
  const vals = m.annual.concat(...Object.values(m.futAnnual));
  const yMax = niceMax(Math.max(...vals)*1.08);
  rainAxes(ctx, W, H, pad, yMax, "Rainfall (mm / year)");
  const cw = (W-pad.l-pad.r)/allYears.length;
  const X = i => pad.l + cw*(i+0.5), Y = v => pad.t + (H-pad.t-pad.b)*(1 - v/yMax);
  const accent = rainVar("--accent","#1D7A8C"), ink = rainVar("--ink","#0D1E2D"), ink3 = rainVar("--ink-3","#6A8598");

  // projection zone
  const xs = pad.l + cw*m.years.length;
  ctx.fillStyle = rainIsDark()?"rgba(255,255,255,.035)":"rgba(13,30,45,.035)";
  ctx.fillRect(xs, pad.t, W-pad.r-xs, H-pad.t-pad.b);
  ctx.fillStyle = ink3; ctx.font = "10px system-ui"; ctx.textAlign = "left"; ctx.fillText("Projection", xs+6, pad.t+12);

  // bars (4px rounded top, anchored to baseline, 2px gap)
  const bw = Math.min(46, cw-6);
  m.annual.forEach((v,i)=>{
    const x = X(i)-bw/2, y = Y(v), h = Y(0)-y;
    ctx.fillStyle = accent; ctx.globalAlpha = .85;
    ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x, y, bw, h, [4,4,0,0]); else ctx.rect(x,y,bw,h); ctx.fill();
    ctx.globalAlpha = 1;
  });

  // fitted curve: solid over history, dashed extension (clamped) over the projection
  ctx.strokeStyle = ink; ctx.lineWidth = 2;
  ctx.beginPath();
  for(let k=0;k<=(m.years.length-1)*20;k++){ const t=k/20; const x=X(t), y=Y(m.fit(t)); k?ctx.lineTo(x,y):ctx.moveTo(x,y); }
  ctx.stroke();

  // scenario lines over the projection years
  RAIN_SC.forEach(sc=>{
    ctx.strokeStyle = scCol(sc); ctx.lineWidth = 2; ctx.setLineDash(sc.dash||[]);
    ctx.beginPath();
    const tl = m.years.length-1;
    ctx.moveTo(X(tl), Y(sc.key==="sq"?m.mean:m.trend(tl)));
    m.futAnnual[sc.key].forEach((v,i)=>ctx.lineTo(X(m.years.length+i), Y(v)));
    ctx.stroke(); ctx.setLineDash([]);
    m.futAnnual[sc.key].forEach((v,i)=>{ ctx.fillStyle = scCol(sc); ctx.beginPath(); ctx.arc(X(m.years.length+i), Y(v), 4, 0, 7); ctx.fill(); });
  });

  // x labels
  ctx.fillStyle = ink3; ctx.font = "10px system-ui"; ctx.textAlign = "center";
  allYears.forEach((y,i)=>ctx.fillText(String(y), X(i), H-pad.b+15));

  document.getElementById("rainAnnualLegend").innerHTML = legendHTML([
    {c:accent, l:"Annual rainfall (observed)", sw:1},
    {c:ink, l:"Trend curve P(t)"},
    ...RAIN_SC.map(sc=>({c:scCol(sc), l:sc.label+" (projected)", dash:!!sc.dash}))]);

  rainHover(c, (mx)=>{
    const i = Math.floor((mx-pad.l)/cw); if(i<0||i>=allYears.length) return null;
    if(i < m.years.length) return {x:X(i), title:String(allYears[i]), rows:[["Observed",fmtMM(m.annual[i]),accent],["Trend curve",fmtMM(m.fit(i)),ink]]};
    const j = i-m.years.length;
    return {x:X(i), title:allYears[i]+" (projected)", rows:RAIN_SC.map(sc=>[sc.label, fmtMM(m.futAnnual[sc.key][j]), scCol(sc)])};
  });
}
function fmtMM(v){ return Math.round(v).toLocaleString()+" mm"; }

// 30-day rolling rainfall vs the seasonal trend, then 5-year scenario projection
function drawRainDaily(m){
  const c = setupCanvas("rainDailyCanvas"); if(!c) return;
  const ctx = c.getContext("2d"), W = c.width, H = c.height;
  const pad = {l:56, r:16, t:24, b:30};
  ctx.clearRect(0,0,W,H);
  const n0 = m.days.length, n = n0 + m.proj.length;
  const vmax = Math.max(...m.obs30.filter(v=>v!==null), ...m.proj.map(p=>p.hi));
  const yMax = niceMax(vmax*1.05);
  rainAxes(ctx, W, H, pad, yMax, "Rainfall, rolling 30 days (mm)");
  const X = i => pad.l + (W-pad.l-pad.r)*i/(n-1), Y = v => pad.t + (H-pad.t-pad.b)*(1 - v/yMax);
  const dark = rainIsDark();
  const wet = dark?"#4FB3C8":"#1D7A8C", dry = dark?"#E0954A":"#C2631F";
  const ink = rainVar("--ink","#0D1E2D"), ink3 = rainVar("--ink-3","#6A8598");

  // above / below trend: fill between the observed and expected curves, per day
  ctx.lineWidth = Math.max(1, (W-pad.l-pad.r)/n0 + .3);
  for(let i=0;i<n0;i++){
    const o = m.obs30[i], e = m.exp30[i]; if(o===null) continue;
    ctx.strokeStyle = o>=e ? wet : dry; ctx.globalAlpha = .55;
    ctx.beginPath(); ctx.moveTo(X(i), Y(e)); ctx.lineTo(X(i), Y(o)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // trend (expected) line over history
  ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath();
  let first = true; for(let i=0;i<n0;i++){ const e=m.exp30[i]; if(e===null) continue; first?ctx.moveTo(X(i),Y(e)):ctx.lineTo(X(i),Y(e)); first=false; }
  ctx.stroke();

  // projection band (P10–P90 of the observed deviation, around Standard)
  ctx.fillStyle = dark?"rgba(74,155,224,.14)":"rgba(22,112,176,.11)";
  ctx.beginPath();
  m.proj.forEach((p,k)=>{ const x=X(n0+k); k?ctx.lineTo(x,Y(p.hi)):ctx.moveTo(x,Y(p.hi)); });
  for(let k=m.proj.length-1;k>=0;k--) ctx.lineTo(X(n0+k), Y(m.proj[k].lo));
  ctx.closePath(); ctx.fill();

  // scenario lines
  RAIN_SC.forEach(sc=>{
    ctx.strokeStyle = scCol(sc); ctx.lineWidth = 2; ctx.setLineDash(sc.dash||[]);
    ctx.beginPath(); m.proj.forEach((p,k)=>{ const x=X(n0+k), y=Y(p[sc.key]); k?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.stroke(); ctx.setLineDash([]);
  });

  // "today" divider + year ticks
  ctx.strokeStyle = ink3; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(X(n0-1), pad.t); ctx.lineTo(X(n0-1), H-pad.b); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = ink3; ctx.font = "10px system-ui"; ctx.textAlign = "left";
  ctx.fillText("Observed", pad.l+4, pad.t+12); ctx.fillText("Projection (5 yrs)", X(n0-1)+6, pad.t+12);
  ctx.textAlign = "center";
  const allDate = i => i<n0 ? m.days[i].d : m.proj[i-n0].d;
  let lastY = -1;
  for(let i=0;i<n;i+=1){ const d=allDate(i); if(d.getUTCMonth()===0 && d.getUTCDate()===1 && d.getUTCFullYear()!==lastY){ lastY=d.getUTCFullYear(); ctx.fillText(String(lastY), X(i), H-pad.b+15); } }

  document.getElementById("rainDailyLegend").innerHTML = legendHTML([
    {c:wet, l:"Above trend (wetter)", sw:1}, {c:dry, l:"Below trend (drier)", sw:1}, {c:ink, l:"Seasonal trend curve"},
    {c:dark?"rgba(74,155,224,.35)":"rgba(22,112,176,.25)", l:"Standard P10–P90 range", sw:1},
    ...RAIN_SC.map(sc=>({c:scCol(sc), l:sc.label, dash:!!sc.dash}))]);

  rainHover(c, (mx)=>{
    const i = Math.round((mx-pad.l)/(W-pad.l-pad.r)*(n-1)); if(i<0||i>=n) return null;
    if(i<n0){ if(m.obs30[i]===null) return null;
      const dv = m.obs30[i]-m.exp30[i];
      return {x:X(i), title:"30 days to "+m.days[i].t, rows:[["Observed",fmtMM(m.obs30[i]),dv>=0?wet:dry],["Trend",fmtMM(m.exp30[i]),ink],["Deviation",(dv>=0?"+":"−")+fmtMM(Math.abs(dv)),null]]}; }
    const p = m.proj[i-n0];
    return {x:X(i), title:"30 days to "+isoDate(p.d)+" (projected)", rows:RAIN_SC.map(sc=>[sc.label, fmtMM(p[sc.key]), scCol(sc)]).concat([["P10–P90", Math.round(p.lo)+"–"+fmtMM(p.hi), null]])};
  });
}

function renderRainStress(m){
  const R0 = Math.min(95, Math.max(0, +document.getElementById("rainR0").value||0))/100;
  const e = +document.getElementById("rainElast").value || rainElasticity();
  const target = state.target_recycle_pct/100;
  const S = WATER_STRESS[state.selected_country] ?? 1.5;
  const yrs = m.stressIdx.map(i=>m.futYears[i]);
  const rows = RAIN_SC.map(sc=>({sc, rain:m.stressIdx.map(i=>m.futAnnual[sc.key][i])}));
  rows.forEach(r=>r.req = r.rain.map(v=>requiredRecycle(v/m.mean, R0, e)));

  document.getElementById("rainMethod").innerHTML =
    `<strong>Method.</strong> Rain ratio <code>r = P<sub>scenario</sub> / P̄</code> (P̄ = ${Math.round(m.mean).toLocaleString()} mm, 10-yr mean). `+
    `Freshwater still available <code>F = 1 − e · max(0, 1 − r)</code>, with stress elasticity <code>e = 1 + S/2.5 = ${e.toFixed(2)}</code> `+
    `(S = ${S.toFixed(2)}, ${state.selected_country} water-stress score; higher stress → each % less rain cuts allocation harder). `+
    `Recycling needed <code>R = 1 − (1 − R₀) · F</code>, R₀ = current recycling. `+
    `Scenarios: <b>Status quo</b> = last decade's mean repeats · <b>Standard</b> = trend curve continues · `+
    `<b>Minimal stress</b> = min(trend, P̄) − 0.5σ · <b>Stressed</b> = min(trend, P̄) − 1.28σ (a 1-in-10 dry year every year), σ = ${Math.round(m.sigma)} mm.`;

  // chart: required recycling per scenario vs Neptune target
  const c = setupCanvas("rainRecycleCanvas");
  if(c){
    const ctx = c.getContext("2d"), W = c.width, H = c.height, pad = {l:56,r:16,t:24,b:30};
    ctx.clearRect(0,0,W,H);
    const yMax = 100; rainAxes(ctx, W, H, pad, yMax, "Recycling rate needed (%)", 5);
    const ny = yrs.length, cw = (W-pad.l-pad.r)/ny;
    const X = i => pad.l + cw*(i+.5), Y = v => pad.t + (H-pad.t-pad.b)*(1 - v/yMax);
    const ink = rainVar("--ink","#0D1E2D"), ink3 = rainVar("--ink-3","#6A8598");
    // Neptune target reference
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.setLineDash([2,3]);
    ctx.beginPath(); ctx.moveTo(pad.l, Y(target*100)); ctx.lineTo(W-pad.r, Y(target*100)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ink3; ctx.font = "10px system-ui"; ctx.textAlign = "right";
    ctx.fillText("Neptune target "+Math.round(target*100)+"%", W-pad.r-4, Y(target*100)-5);
    rows.forEach(r=>{
      ctx.strokeStyle = scCol(r.sc); ctx.lineWidth = 2; ctx.setLineDash(r.sc.dash||[]);
      ctx.beginPath(); r.req.forEach((v,i)=>{ i?ctx.lineTo(X(i),Y(v*100)):ctx.moveTo(X(i),Y(v*100)); }); ctx.stroke(); ctx.setLineDash([]);
      const surf = rainVar("--surface","#fff");
      r.req.forEach((v,i)=>{ ctx.fillStyle = surf; ctx.beginPath(); ctx.arc(X(i),Y(v*100),6,0,7); ctx.fill(); ctx.fillStyle = scCol(r.sc); ctx.beginPath(); ctx.arc(X(i),Y(v*100),4,0,7); ctx.fill(); });
    });
    ctx.fillStyle = ink3; ctx.textAlign = "center"; yrs.forEach((y,i)=>ctx.fillText(String(y), X(i), H-pad.b+15));
    document.getElementById("rainRecycleLegend").innerHTML = legendHTML(
      rows.map(r=>({c:scCol(r.sc), l:r.sc.label, dash:!!r.sc.dash})).concat([{c:ink, l:"Neptune target", dash:1}]));
    rainHover(c, mx=>{
      const i = Math.floor((mx-pad.l)/cw); if(i<0||i>=ny) return null;
      return {x:X(i), title:String(yrs[i])+" — recycling needed", rows:rows.map(r=>[r.sc.label, Math.round(r.req[i]*100)+"%", scCol(r.sc)]).concat([["Neptune target", Math.round(target*100)+"%", null]])};
    });
  }

  // table
  document.getElementById("rainStressHead").innerHTML =
    `<tr><th>Scenario</th>${yrs.map(y=>`<th style="text-align:right">${y} rain</th>`).join("")}<th style="text-align:right">Peak recycling needed</th><th>vs Neptune target (${Math.round(target*100)}%)</th></tr>`;
  document.getElementById("rainStressTbody").innerHTML = rows.map(r=>{
    const peak = Math.max(...r.req), gap = peak - target;
    const verdict = gap<=0 ? `<span class="chip" style="background:rgba(46,164,79,.12);color:var(--green)">✓ Covered (${Math.round(-gap*100)} pp headroom)</span>`
                           : `<span class="chip" style="background:rgba(231,76,60,.12);color:var(--red)">▲ Gap +${Math.round(gap*100)} pp</span>`;
    return `<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${scCol(r.sc)};margin-right:6px"></span><strong>${r.sc.label}</strong></td>`+
      r.rain.map((v,i)=>`<td class="td-num">${Math.round(v).toLocaleString()} mm<br><span style="font-size:10px;color:var(--ink-3)">${Math.round(r.req[i]*100)}% recycle</span></td>`).join("")+
      `<td class="td-num"><strong>${Math.round(peak*100)}%</strong></td><td>${verdict}</td></tr>`;
  }).join("");
}

// ── Shared hover tooltip for the rainfall canvases ────────────────────────────

let rainTipEl = null;
function rainHover(canvas, pick){
  if(!rainTipEl){ rainTipEl = document.createElement("div"); rainTipEl.className = "rain-tip"; document.body.appendChild(rainTipEl); }
  canvas._pick = pick;
  if(canvas._hoverBound) return; canvas._hoverBound = true;
  canvas.addEventListener("mousemove", ev=>{
    const b = canvas.getBoundingClientRect();
    const hit = canvas._pick((ev.clientX-b.left)*(canvas.width/b.width));
    if(!hit){ rainTipEl.style.display = "none"; return; }
    rainTipEl.innerHTML = `<b>${hit.title}</b>` + hit.rows.map(([k,v,col])=>`<div class="r"><em>${col?`<i style="background:${col}"></i>`:""}${k}</em><span>${v}</span></div>`).join("");
    rainTipEl.style.display = "block";
    const tw = rainTipEl.offsetWidth, x = ev.clientX + 14 + tw > innerWidth ? ev.clientX - tw - 14 : ev.clientX + 14;
    rainTipEl.style.left = x+"px"; rainTipEl.style.top = (ev.clientY + 12)+"px";
  });
  canvas.addEventListener("mouseleave", ()=>{ rainTipEl.style.display = "none"; });
}

window.addEventListener("resize", ()=>{
  const sec = document.getElementById("sec-country");
  if(rainModel && sec && !sec.classList.contains("hidden")) renderRainAnalysis();
});
