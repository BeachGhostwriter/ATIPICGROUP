/* Neptune — rainfall history, multi-year cycles, heavy-rain frequency trend, 5-year projection
   and water-stress test. Lives on the "Country, Region & Water Stress" page.
   Uses globals from neptune-app.js (state, WATER_STRESS, setupCanvas).
   Data: Open-Meteo historical archive (ERA5 reanalysis), daily precipitation, free, CORS-enabled, no key.

   Model in brief
   1. Annual totals over a 35-year record are fitted with a linear trend plus 3-, 5- and 10-year cycles:
        P(t) = β0 + β1·t + Σ_P A_P · cos(2π (t − τ_P) / P)        (least squares, t = years since record start)
   2. Heavy-rain days (≥ the record's 95th percentile of wet-day rainfall) are counted per year and fitted with
      a Poisson trend; the projection applies that frequency growth (never below a climate floor of +6 %/decade,
      in line with IPCC AR6 for daily extremes at ~0.2 °C warming per decade) and an intensity trend.
   3. Each projected year is rebuilt from a randomly chosen analogue year of the record (its own wet/dry spells),
      rescaled to the cycle model's annual total for the scenario, with heavy-rain events injected at the
      projected frequency on historically typical dates. Seeded, so the same site always gives the same picture. */

// Cities per country (name, lat, lon). The first entry is the default.
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
const RAIN_CYCLES_DEFAULT = [3,5,10];   // years; editable on the page
const RAIN_RECORD = 35;             // years of record used to fit cycles and the heavy-rain trend
const RAIN_SHOW = 10;               // years shown by default
const RAIN_X_FLOOR = 6;             // %/decade, minimum heavy-rain frequency growth applied (IPCC AR6-consistent)

const rainCache = {};               // fetched records by site
let rainRaw = null;                 // current record
let rainModel = null;               // last computed analysis
let rainElastManual = false;
let rainReq = 0;

function rainIsDark(){
  const s = getComputedStyle(document.documentElement).getPropertyValue("--surface").trim();
  const m = s.match(/^#?([0-9a-f]{6})$/i); if(!m) return false;
  const n = parseInt(m[1],16); return (((n>>16)&255)*0.299+((n>>8)&255)*0.587+(n&255)*0.114) < 128;
}
function rainVar(name, fb){ return getComputedStyle(document.documentElement).getPropertyValue(name).trim()||fb; }
function scCol(sc){ return rainIsDark()?sc.dark:sc.light; }
function isoDate(d){ return d.toISOString().slice(0,10); }
function fmtMM(v){ return Math.round(v).toLocaleString()+" mm"; }

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
    document.getElementById("rainLat").value = list[+sel.value][1];
    document.getElementById("rainLon").value = list[+sel.value][2];
  }
  loadRainHistory();
}

function rainPlaceName(){
  const sel = document.getElementById("rainCity");
  const list = RAIN_CITIES[state.selected_country] || [];
  return sel && sel.value !== "custom" && list[+sel.value] ? list[+sel.value][0] : "custom site";
}

async function loadRainHistory(){
  const lat = parseFloat(document.getElementById("rainLat").value);
  const lon = parseFloat(document.getElementById("rainLon").value);
  const banner = document.getElementById("rainBanner");
  if(!Number.isFinite(lat) || !Number.isFinite(lon)){ banner.textContent = "Enter a latitude and longitude to load the rainfall history."; return; }
  const end = new Date(Date.now() - 6*864e5);                 // the archive lags real time by ~5 days
  const lastFull = end.getUTCMonth()===11 && end.getUTCDate()===31 ? end.getUTCFullYear() : end.getUTCFullYear()-1;
  const y0L = lastFull - RAIN_RECORD + 1;
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${y0L}`;
  const req = ++rainReq;
  if(!rainCache[key]){
    banner.textContent = `Loading ${RAIN_RECORD} years of daily rainfall (${y0L}–${isoDate(end)}) for ${rainPlaceName()} (${lat.toFixed(2)}, ${lon.toFixed(2)})…`;
    try{
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${y0L}-01-01&end_date=${isoDate(end)}&daily=precipitation_sum&timezone=UTC`;
      const r = await fetch(url); if(!r.ok) throw new Error("HTTP "+r.status);
      const j = await r.json();
      if(!j.daily || !j.daily.time) throw new Error(j.reason || "no data");
      rainCache[key] = {time:j.daily.time, precip:j.daily.precipitation_sum, y0L, lastFull, seed:Math.round((lat+90)*1000)*100003+Math.round((lon+180)*1000)};
    }catch(e){
      if(req!==rainReq) return;
      banner.textContent = "Could not load rainfall history from Open-Meteo ("+e.message+"). Check the connection and try again.";
      rainModel = rainRaw = null; return;
    }
  }
  if(req!==rainReq) return;   // a newer selection superseded this one
  rainRaw = rainCache[key];
  rainModel = buildRainModel(rainRaw);
  const m = rainModel;
  banner.textContent = `${rainPlaceName()}, ${state.selected_country} (${lat.toFixed(2)}, ${lon.toFixed(2)}) — ${m.days.length.toLocaleString()} days of daily rainfall, ${m.y0L}–${m.dataEnd}. Source: Open-Meteo / ERA5.`;
  renderRainAnalysis();
}

function rainRebuild(){ if(rainRaw){ rainModel = buildRainModel(rainRaw); renderRainAnalysis(); } }

// ── Maths helpers ─────────────────────────────────────────────────────────────

// Ordinary least squares via the normal equations (Gauss-Jordan with partial pivoting).
function lsq(X, y){
  const p = X[0].length, A = Array.from({length:p},()=>new Array(p+1).fill(0));
  X.forEach((row,i)=>{ for(let a=0;a<p;a++){ for(let b=0;b<p;b++) A[a][b]+=row[a]*row[b]; A[a][p]+=row[a]*y[i]; } });
  for(let i=0;i<p;i++){
    let mx=i; for(let r=i+1;r<p;r++) if(Math.abs(A[r][i])>Math.abs(A[mx][i])) mx=r;
    [A[i],A[mx]]=[A[mx],A[i]];
    if(Math.abs(A[i][i])<1e-12) continue;
    for(let r=0;r<p;r++){ if(r===i) continue; const f=A[r][i]/A[i][i]; for(let c=i;c<=p;c++) A[r][c]-=f*A[i][c]; }
  }
  return A.map((r,i)=>Math.abs(r[i])<1e-12?0:r[p]/r[i]);
}

function quantile(arr, q){
  const a = arr.filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length) return 0;
  const p = (a.length-1)*q, lo = Math.floor(p); return a[lo] + (a[Math.min(lo+1,a.length-1)]-a[lo])*(p-lo);
}

// Poisson regression log λ = c0 + c1·t, Newton–Raphson
function poissonTrend(t, n){
  const m = n.reduce((s,v)=>s+v,0)/n.length || 0.1;
  let c0 = Math.log(m), c1 = 0;
  for(let it=0; it<30; it++){
    let g0=0,g1=0,h00=0,h01=0,h11=0;
    t.forEach((ti,i)=>{ const l=Math.exp(c0+c1*ti); g0+=n[i]-l; g1+=(n[i]-l)*ti; h00+=l; h01+=l*ti; h11+=l*ti*ti; });
    const det = h00*h11-h01*h01; if(Math.abs(det)<1e-12) break;
    const d0 = ( h11*g0 - h01*g1)/det, d1 = (-h01*g0 + h00*g1)/det;
    c0+=d0; c1+=d1; if(Math.abs(d0)+Math.abs(d1)<1e-9) break;
  }
  return {c0, c1};
}

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function poissonDraw(rng, lam){ const L=Math.exp(-lam); let k=0, p=1; do{ k++; p*=rng(); }while(p>L && k<500); return k-1; }

// ── Model ─────────────────────────────────────────────────────────────────────

function buildRainModel(raw){
  const {time, precip, y0L, lastFull, seed} = raw;
  const yearsAll = []; for(let y=y0L; y<=lastFull; y++) yearsAll.push(y);
  const doyOf = d => Math.min(364, Math.floor((d - Date.UTC(d.getUTCFullYear(),0,1))/864e5));
  const days = time.map((t,i)=>{ const d=new Date(t+"T00:00:00Z"); return {t, d, y:d.getUTCFullYear(), doy:doyOf(d), p:Number.isFinite(precip[i])?precip[i]:0}; });
  const annualAll = yearsAll.map(()=>0);
  days.forEach(o=>{ const i=o.y-y0L; if(i>=0 && i<yearsAll.length) annualAll[i]+=o.p; });
  const years = yearsAll.slice(-RAIN_SHOW), annual = annualAll.slice(-RAIN_SHOW), y0 = years[0];
  const avg = a => a.reduce((s,v)=>s+v,0)/a.length;
  const mean = avg(annual), meanAll = avg(annualAll);
  const sdAll = Math.sqrt(annualAll.reduce((s,v)=>s+(v-meanAll)**2,0)/(annualAll.length-1));

  // 1. Trend + cycles (default 3/5/10 years) on annual totals (t = years since y0L; annual value i sits at t = i)
  const cycIn = (document.getElementById("rainCycles")?.value||"").split(/[,;\s]+/).map(Number).filter(v=>v>=2 && v<=20);
  const RAIN_CYCLES = cycIn.length ? [...new Set(cycIn)].slice(0,5) : RAIN_CYCLES_DEFAULT;
  const basis = t => [1, t].concat(...RAIN_CYCLES.map(P=>[Math.sin(2*Math.PI*t/P), Math.cos(2*Math.PI*t/P)]));
  const beta = lsq(yearsAll.map((y,i)=>basis(i)), annualAll);
  const fit = t => basis(t).reduce((s,v,k)=>s+v*beta[k],0);
  const nP = beta.length, nY = annualAll.length;
  const ssRes = annualAll.reduce((s,v,i)=>s+(v-fit(i))**2,0);
  const ssTot = annualAll.reduce((s,v)=>s+(v-meanAll)**2,0);
  const r2 = ssTot>0 ? 1-ssRes/ssTot : 0;
  const r2adj = 1-(1-r2)*(nY-1)/Math.max(1,nY-nP);
  const sigma = Math.sqrt(ssRes/Math.max(1,nY-nP));
  const cycles = RAIN_CYCLES.map((P,k)=>{
    const a = beta[2+2*k], b = beta[3+2*k], amp = Math.hypot(a,b);
    const tau = ((P*Math.atan2(a,b)/(2*Math.PI))%P+P)%P;          // A·cos(2π(t−τ)/P)
    let next = y0L+tau; while(next <= lastFull+0.5) next += P;
    return {P, amp, tau, next:Math.round(next), last:Math.round(next-P)};
  });
  // Periodogram of the detrended record (2–15 yr): which periods actually carry the variance
  const detr = annualAll.map((v,i)=>v-(beta[0]+beta[1]*i));
  const pgram = [];
  for(let P=2; P<=15.001; P+=0.5){
    const b2 = lsq(detr.map((v,i)=>[Math.sin(2*Math.PI*i/P), Math.cos(2*Math.PI*i/P)]), detr);
    pgram.push({P, amp:Math.hypot(b2[0],b2[1])});
  }
  const topPeriods = pgram.slice().sort((x,y)=>y.amp-x.amp).filter((q,i,arr)=>arr.findIndex(z=>Math.abs(z.P-q.P)<1.25)===i).slice(0,3);

  // Projected trend stays within the record's mean ± 2.5 SD
  const lo = Math.max(0.2*meanAll, meanAll-2.5*sdAll), hi = meanAll+2.5*sdAll;
  const trend = t => Math.min(hi, Math.max(lo, fit(t)));

  // Seasonal shape: mean rainfall by day of year, 31-day circular smoothing, normalised to mean 1
  const raw365 = new Array(365).fill(0), cnt = new Array(365).fill(0);
  days.forEach(o=>{ raw365[o.doy]+=o.p; cnt[o.doy]++; });
  const m365 = raw365.map((v,i)=>cnt[i]?v/cnt[i]:0);
  const seas = m365.map((_,i)=>{ let s=0; for(let k=-15;k<=15;k++) s+=m365[(i+k+365)%365]; return s/31; });
  const sMean = seas.reduce((s,v)=>s+v,0)/365 || 1;
  const season = seas.map(v=>v/sMean);
  const tOf = d => (d - Date.UTC(y0L,0,1))/(365.25*864e5) - 0.5;
  const expDaily = (d, annualFn) => annualFn(tOf(d))/365.25 * season[doyOf(d)];

  // 2. Heavy-rain days: ≥ 95th percentile of wet-day (≥1 mm) rainfall over the record
  const thr = quantile(days.filter(o=>o.p>=1).map(o=>o.p), 0.95);
  const heavy = days.filter(o=>o.p>=thr);
  const xCount = yearsAll.map(y=>heavy.filter(o=>o.y===y).length);
  const pt = poissonTrend(yearsAll.map((y,i)=>i), xCount);
  const xObs = (Math.exp(10*pt.c1)-1)*100;                         // observed %/decade
  const gIn = document.getElementById("rainXGrowth")?.value;
  const xManual = gIn!==undefined && gIn!=="" && Number.isFinite(+gIn);
  const xApplied = xManual ? +gIn : Math.max(xObs, RAIN_X_FLOOR);
  const xSource = xManual ? "set manually" : (xObs >= RAIN_X_FLOOR ? "observed locally" : "climate floor (observed trend is lower)");
  const xInt = +(document.getElementById("rainXInt")?.value ?? 1.4) || 0;  // intensity %/decade
  const xRef = avg(xCount.slice(-RAIN_SHOW)), refT = lastFull - (RAIN_SHOW-1)/2;
  const gOf = {sq:0, min:xApplied, std:xApplied, str:2*Math.max(xApplied, RAIN_X_FLOOR)};
  const lam = (y, g) => xRef*Math.pow(1+g/100, (y-refT)/10);
  const doyPool = heavy.map(o=>o.doy), magPool = heavy.map(o=>o.p);

  // Scenarios for annual rainfall (argument: calendar year)
  const scen = {
    sq:  () => mean,                                                             // last decade's average repeats
    std: y => trend(y-y0L),                                                      // trend + cycles continue
    min: y => Math.max(0, Math.min(trend(y-y0L), mean) - 0.5*sigma),             // mildly dry (≈ P30 year)
    str: y => Math.max(0.15*mean, Math.min(trend(y-y0L), mean) - 1.28*sigma),    // a 1-in-10 dry year, every year
  };

  // 3. Synthetic daily projection: analogue year + cycle-model total + heavy-rain events at projected frequency
  const rng = mulberry32(seed||12345);
  const analog = {};
  yearsAll.forEach(y=>{ const a=new Array(365).fill(0); days.forEach(o=>{ if(o.y===y && o.p<thr) a[o.doy]+=o.p; }); analog[y]={a, sum:a.reduce((s,v)=>s+v,0)}; });
  const dataEndD = days[days.length-1].d, curYear = dataEndD.getUTCFullYear();
  const synth = {}, events = {std:[], str:[]};
  for(let py=curYear; py<=curYear+5; py++){
    const an = analog[yearsAll[Math.floor(rng()*yearsAll.length)]];
    const lamMax = lam(py, gOf.str), nC = poissonDraw(rng, lamMax);
    const cands = Array.from({length:nC},()=>({doy:doyPool[Math.floor(rng()*doyPool.length)]??180,
                     mag:(magPool[Math.floor(rng()*magPool.length)]??thr)*Math.pow(1+xInt/100,(py-refT)/10), u:rng()}));
    synth[py] = {};
    for(const s of Object.keys(scen)){
      const inc = cands.filter(c=>c.u < lam(py,gOf[s])/lamMax);
      const T = scen[s](py), E = inc.reduce((x,c)=>x+c.mag,0), B = Math.max(0.35*T, T-E);
      const arr = an.sum>0 ? an.a.map(v=>v*B/an.sum) : season.map(v=>v*B/365);
      inc.forEach(c=>arr[c.doy]+=c.mag);
      synth[py][s] = arr;
      if(s==="std"||s==="str") inc.forEach(c=>events[s].push({y:py, doy:c.doy, mag:c.mag}));
    }
  }

  // Display window: last 10 years of history + 5 years of projection
  const i0 = days.findIndex(o=>o.y>=y0);
  const hist = days.slice(i0);
  const horizon = 5*365, proj = [];
  for(let k=1;k<=horizon;k++){ const d=new Date(dataEndD.getTime()+k*864e5); proj.push({d, y:d.getUTCFullYear(), doy:doyOf(d)}); }
  const rollW = (vals, W) => { const out=[]; let s=0; vals.forEach((v,i)=>{ s+=v; if(i>=W) s-=vals[i-W]; out.push(i>=W-1?s:null); }); return out; };
  // history: observed vs trend-expected 30-day sums (computed on the full record so the window has no warm-up gap)
  const obs30all = rollW(days.map(o=>o.p), 30), exp30all = rollW(days.map(o=>expDaily(o.d, trend)), 30);
  const obs30 = obs30all.slice(i0), exp30 = exp30all.slice(i0);
  // projection: synthetic series, warmed up with the last observed days
  const tailP = days.slice(-89).map(o=>o.p), tailLong = days.slice(-179).map(o=>o.p);
  const projSeries = s => proj.map(o=>synth[o.y]?.[s]?.[o.doy] ?? 0);
  const p30 = {}, p90 = {};   // p90: 180-day rolling mean expressed per 30 days (smooth scenario lines)
  for(const s of Object.keys(scen)){
    const ser = tailP.concat(projSeries(s));
    p30[s] = rollW(ser,30).slice(89); p90[s] = rollW(tailLong.concat(projSeries(s)),180).slice(179).map(v=>v/6);
  }
  const tailE = days.slice(-29).map(o=>expDaily(o.d, t=>trend(t)));
  const e30 = rollW(tailE.concat(proj.map(o=>expDaily(o.d, t=>trend(t)))),30).slice(29);

  const futYears = []; for(let y=lastFull+1; y<=curYear+5; y++) futYears.push(y);
  const futAnnual = {}; for(const s of Object.keys(scen)) futAnnual[s] = futYears.map(y=>scen[s](y));
  const stressIdx = futYears.map((y,i)=>i).filter(i=>futYears[i]>curYear);
  const futX = {}; for(const s of Object.keys(gOf)) futX[s] = futYears.map(y=>lam(y,gOf[s]));

  return {y0L, yearsAll, annualAll, years, annual, y0, mean, meanAll, sdAll, beta, fit, trend, r2, r2adj, sigma, cycles, topPeriods,
          lo, hi, days, hist, obs30, exp30, heavy, thr, xCount, pt, xObs, xApplied, xSource, xInt, xRef, gOf, lam,
          proj, p30, p90, e30, events, futYears, futAnnual, futX, stressIdx, curYear, lastFull, dataEnd:isoDate(dataEndD)};
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
  document.getElementById("rk1").innerHTML = fmt(m.mean)+"<span class='kpi-unit'> mm/yr</span>";
  document.getElementById("rk2").innerHTML = `${fmt(m.annual[iMin])}<span class='kpi-unit'> (${m.years[iMin]})</span> / ${fmt(m.annual[iMax])}<span class='kpi-unit'> (${m.years[iMax]})</span>`;
  document.getElementById("rk3").innerHTML = m.xRef.toFixed(1)+`<span class='kpi-unit'> /yr · ${m.xObs>=0?"+":"−"}${Math.abs(m.xObs).toFixed(0)}%/decade</span>`;
  document.getElementById("rk4").innerHTML = m.r2.toFixed(2)+`<span class='kpi-unit'> (adj. ${m.r2adj.toFixed(2)})</span>`;

  const sg = v => (v<0?"− ":"+ ")+Math.abs(v).toFixed(1);
  const cyc = m.cycles.map(c=>`${Math.round(c.amp)}·cos(2π(t − ${c.tau.toFixed(1)})/${c.P})`).join(" + ");
  const cycList = m.cycles.map(c=>`<b>${c.P}-year</b> ±${fmt(c.amp)} mm (${Math.round(c.amp/m.sigma*100)}% of σ), last peak ${c.last}, next ${c.next}`).join(" · ");
  document.getElementById("rainFormula").innerHTML =
    `Cycle-trend model (least squares on ${m.yearsAll.length} annual totals, ${m.y0L}–${m.lastFull}): `+
    `<code>P(t) = ${m.beta[0].toFixed(0)} ${sg(m.beta[1])}·t + ${cyc}</code> mm/yr, <code>t</code> = years since ${m.y0L}.`+
    `<br>${cycList}.`+
    `<br>R² = ${m.r2.toFixed(2)} (adjusted ${m.r2adj.toFixed(2)}) · residual σ = ${fmt(m.sigma)} mm · strongest periods found in the record: `+
    m.topPeriods.map(q=>`${q.P} yr (±${fmt(q.amp)} mm)`).join(", ")+"."+
    (m.r2adj<0.2 ? ` <b>The cycles explain little of the year-to-year scatter here, so treat the projected peaks as indicative.</b>` : "")+
    ` Projection kept within the record's mean ± 2.5 SD (${fmt(m.lo)}–${fmt(m.hi)} mm).`;

  document.getElementById("rainXNote").innerHTML =
    `Heavy-rain day = daily rainfall ≥ <code>${m.thr.toFixed(1)} mm</code> (95th percentile of wet days, ${m.y0L}–${m.lastFull}). `+
    `Poisson trend <code>λ(t) = e^(${m.pt.c0.toFixed(2)} ${m.pt.c1<0?"−":"+"} ${Math.abs(m.pt.c1).toFixed(4)}·t)</code> → observed ${m.xObs>=0?"+":"−"}${Math.abs(m.xObs).toFixed(1)}% per decade. `+
    `Applied in the projection: <b>${m.xApplied>=0?"+":""}${m.xApplied.toFixed(1)}%/decade</b> (${m.xSource}), stressed ×2; event intensity ${m.xInt>=0?"+":""}${m.xInt}%/decade. `+
    `Expected heavy-rain days in ${m.curYear+5}: ${m.lam(m.curYear+5,m.gOf.std).toFixed(1)} (standard), ${m.lam(m.curYear+5,m.gOf.str).toFixed(1)} (stressed) vs ${m.xRef.toFixed(1)} over the last decade.`;

  drawRainAnnual(m);
  drawRainHeavy(m);
  drawRainDaily(m);
  renderRainStress(m);
}

function legendHTML(items){
  return items.map(it=>`<span><i class="${it.sw?'sw':''} ${it.dash?'dash':''}" style="${it.sw?'background:'+it.c:'border-color:'+it.c}"></i>${it.l}</span>`).join("");
}

function rainAxes(ctx, W, H, pad, yMax, yLabel, ticks, fmtTick){
  const ink3 = rainVar("--ink-3","#6A8598"), border = rainVar("--border","#CCDAE4");
  ctx.font = "10px system-ui"; ctx.fillStyle = ink3; ctx.strokeStyle = border; ctx.lineWidth = 1;
  const n = ticks||4;
  for(let k=0;k<=n;k++){
    const v = yMax*k/n, y = pad.t + (H-pad.t-pad.b)*(1-k/n);
    ctx.globalAlpha = .6; ctx.beginPath(); ctx.moveTo(pad.l, Math.round(y)+.5); ctx.lineTo(W-pad.r, Math.round(y)+.5); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.textAlign = "right"; ctx.fillText(fmtTick?fmtTick(v):Math.round(v).toLocaleString(), pad.l-6, y+3);
  }
  ctx.textAlign = "left"; ctx.fillText(yLabel, pad.l, pad.t-8);
}

function niceMax(v){ const p = Math.pow(10, Math.floor(Math.log10(v||1))); return Math.ceil(v/p*2)/2*p; }
function rrect(ctx,x,y,w,h){ ctx.beginPath(); if(ctx.roundRect) ctx.roundRect(x,y,w,h,[Math.min(4,w/2),Math.min(4,w/2),0,0]); else ctx.rect(x,y,w,h); ctx.fill(); }
function projZone(ctx, x, pad, W, H){
  const ink3 = rainVar("--ink-3","#6A8598");
  ctx.fillStyle = rainIsDark()?"rgba(255,255,255,.035)":"rgba(13,30,45,.035)";
  ctx.fillRect(x, pad.t, W-pad.r-x, H-pad.t-pad.b);
  ctx.fillStyle = ink3; ctx.font = "10px system-ui"; ctx.textAlign = "left"; ctx.fillText("Projection", x+6, pad.t+12);
}

// Annual histogram + cycle-trend curve, scenario projection, next cycle peaks
function drawRainAnnual(m){
  const c = setupCanvas("rainAnnualCanvas"); if(!c) return;
  const ctx = c.getContext("2d"), W = c.width, H = c.height;
  const pad = {l:56, r:16, t:24, b:30};
  ctx.clearRect(0,0,W,H);
  const full = document.getElementById("rainRange")?.value === "all";
  const hy = full ? m.yearsAll : m.years, ha = full ? m.annualAll : m.annual, off = m.yearsAll.length - hy.length;
  const allYears = hy.concat(m.futYears);
  const yMax = niceMax(Math.max(...ha, ...[].concat(...Object.values(m.futAnnual)), m.hi*0.9)*1.08);
  rainAxes(ctx, W, H, pad, yMax, "Rainfall (mm / year)");
  const cw = (W-pad.l-pad.r)/allYears.length;
  const X = i => pad.l + cw*(i+0.5), Y = v => pad.t + (H-pad.t-pad.b)*(1 - v/yMax);
  const accent = rainVar("--accent","#1D7A8C"), ink = rainVar("--ink","#0D1E2D"), ink3 = rainVar("--ink-3","#6A8598");
  projZone(ctx, pad.l + cw*hy.length, pad, W, H);

  const bw = Math.max(2, Math.min(46, cw-4));
  ctx.fillStyle = accent; ctx.globalAlpha = .85;
  ha.forEach((v,i)=>rrect(ctx, X(i)-bw/2, Y(v), bw, Y(0)-Y(v)));
  ctx.globalAlpha = 1;

  // cycle-trend curve over history (continuous), then the Standard projection continues it
  ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath();
  for(let k=0;k<=(hy.length-1)*12;k++){ const i=k/12; const x=X(i), y=Y(m.fit(off+i)); k?ctx.lineTo(x,y):ctx.moveTo(x,y); }
  ctx.stroke();

  RAIN_SC.forEach(sc=>{
    ctx.strokeStyle = scCol(sc); ctx.lineWidth = 2; ctx.setLineDash(sc.dash||[]);
    ctx.beginPath(); const tl = hy.length-1;
    ctx.moveTo(X(tl), Y(sc.key==="sq"?m.mean:m.fit(off+tl)));
    m.futAnnual[sc.key].forEach((v,i)=>ctx.lineTo(X(hy.length+i), Y(v)));
    ctx.stroke(); ctx.setLineDash([]);
    m.futAnnual[sc.key].forEach((v,i)=>{ ctx.fillStyle = scCol(sc); ctx.beginPath(); ctx.arc(X(hy.length+i), Y(v), 4, 0, 7); ctx.fill(); });
  });

  // next cycle peaks within the projection
  ctx.font = "10px system-ui"; ctx.textAlign = "center"; ctx.fillStyle = ink3;
  const peakAt = {};
  m.cycles.forEach(cy=>{ for(let y=cy.next; y<=m.futYears[m.futYears.length-1]; y+=cy.P){ (peakAt[y]=peakAt[y]||[]).push(cy.P+"y"); } });
  Object.entries(peakAt).forEach(([y,l])=>{ const i=hy.length+m.futYears.indexOf(+y); if(i>=hy.length) ctx.fillText("▲ "+l.join("·"), X(i), pad.t+26); });

  const step = Math.ceil(allYears.length/18);
  allYears.forEach((y,i)=>{ const last=i===allYears.length-1; if(i%step===0 || (last && (i%step)>=step/2)) ctx.fillText(String(y), X(i), H-pad.b+15); });

  document.getElementById("rainAnnualLegend").innerHTML = legendHTML([
    {c:accent, l:"Annual rainfall (observed)", sw:1},
    {c:ink, l:"Cycle-trend model P(t)"},
    ...RAIN_SC.map(sc=>({c:scCol(sc), l:sc.label+" (projected)", dash:!!sc.dash})),
    {c:"transparent", l:"▲ = projected cycle peak ("+m.cycles.map(c=>c.P+"y").join(", ")+")"}]);

  rainHover(c, mx=>{
    const i = Math.floor((mx-pad.l)/cw); if(i<0||i>=allYears.length) return null;
    if(i < hy.length) return {title:String(allYears[i]), rows:[["Observed",fmtMM(ha[i]),accent],["Cycle-trend model",fmtMM(m.fit(off+i)),ink]]};
    const j = i-hy.length;
    return {title:allYears[i]+" (projected)", rows:RAIN_SC.map(sc=>[sc.label, fmtMM(m.futAnnual[sc.key][j]), scCol(sc)])};
  });
}

// Heavy-rain days per year: record, Poisson trend and projected frequency
function drawRainHeavy(m){
  const c = setupCanvas("rainXCanvas"); if(!c) return;
  const ctx = c.getContext("2d"), W = c.width, H = c.height, pad = {l:56, r:16, t:24, b:30};
  ctx.clearRect(0,0,W,H);
  const allYears = m.yearsAll.concat(m.futYears), nH = m.yearsAll.length;
  const yMax = niceMax(Math.max(...m.xCount, ...m.futX.str)*1.15);
  rainAxes(ctx, W, H, pad, yMax, "Heavy-rain days per year", 4, v=>v.toFixed(v<10&&v%1?1:0));
  const cw = (W-pad.l-pad.r)/allYears.length, X = i => pad.l + cw*(i+0.5), Y = v => pad.t + (H-pad.t-pad.b)*(1 - v/yMax);
  const accent = rainVar("--accent","#1D7A8C"), ink = rainVar("--ink","#0D1E2D"), ink3 = rainVar("--ink-3","#6A8598");
  projZone(ctx, pad.l + cw*nH, pad, W, H);
  const bw = Math.max(2, cw-3);
  ctx.fillStyle = accent; ctx.globalAlpha = .8;
  m.xCount.forEach((v,i)=>{ if(v>0) rrect(ctx, X(i)-bw/2, Y(v), bw, Y(0)-Y(v)); });
  ctx.globalAlpha = 1;
  ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.beginPath();
  m.yearsAll.forEach((y,i)=>{ const v=Math.exp(m.pt.c0+m.pt.c1*i); i?ctx.lineTo(X(i),Y(v)):ctx.moveTo(X(i),Y(v)); }); ctx.stroke();
  const lines = [RAIN_SC[0], RAIN_SC[2], RAIN_SC[3]];
  lines.forEach(sc=>{
    ctx.strokeStyle = scCol(sc); ctx.lineWidth = 2; ctx.setLineDash(sc.dash||[]);
    ctx.beginPath(); ctx.moveTo(X(nH-1), Y(m.xRef));
    m.futX[sc.key].forEach((v,i)=>ctx.lineTo(X(nH+i), Y(v))); ctx.stroke(); ctx.setLineDash([]);
    m.futX[sc.key].forEach((v,i)=>{ ctx.fillStyle = scCol(sc); ctx.beginPath(); ctx.arc(X(nH+i), Y(v), 3.5, 0, 7); ctx.fill(); });
  });
  ctx.fillStyle = ink3; ctx.font = "10px system-ui"; ctx.textAlign = "center";
  const step = Math.ceil(allYears.length/18);
  allYears.forEach((y,i)=>{ const last=i===allYears.length-1; if(i%step===0 || (last && (i%step)>=step/2)) ctx.fillText(String(y), X(i), H-pad.b+15); });
  document.getElementById("rainXLegend").innerHTML = legendHTML([
    {c:accent, l:"Heavy-rain days (observed)", sw:1}, {c:ink, l:"Poisson trend"},
    {c:scCol(RAIN_SC[0]), l:"Status quo (last decade's frequency)", dash:1},
    {c:scCol(RAIN_SC[2]), l:"Standard & minimal stress"}, {c:scCol(RAIN_SC[3]), l:"Stressed (×2 growth)"}]);
  rainHover(c, mx=>{
    const i = Math.floor((mx-pad.l)/cw); if(i<0||i>=allYears.length) return null;
    if(i<nH) return {title:String(allYears[i]), rows:[["Heavy-rain days",String(m.xCount[i]),accent],["Trend",Math.exp(m.pt.c0+m.pt.c1*i).toFixed(1),ink]]};
    const j=i-nH; return {title:allYears[i]+" (projected)", rows:lines.map(sc=>[sc.label, m.futX[sc.key][j].toFixed(1)+" days", scCol(sc)])};
  });
}

// 30-day rolling rainfall vs the cycle-trend curve: last 10 years observed, 5 years synthesised
function drawRainDaily(m){
  const c = setupCanvas("rainDailyCanvas"); if(!c) return;
  const ctx = c.getContext("2d"), W = c.width, H = c.height;
  const pad = {l:56, r:16, t:24, b:40};
  ctx.clearRect(0,0,W,H);
  const n0 = m.hist.length, n = n0 + m.proj.length;
  const vmax = Math.max(...m.obs30.filter(v=>v!==null), ...m.p30.std, ...m.p30.str);
  const yMax = niceMax(vmax*1.05);
  rainAxes(ctx, W, H, pad, yMax, "Rainfall, rolling 30 days (mm)");
  const X = i => pad.l + (W-pad.l-pad.r)*i/(n-1), Y = v => pad.t + (H-pad.t-pad.b)*(1 - v/yMax);
  const dark = rainIsDark();
  const wet = dark?"#4FB3C8":"#1D7A8C", dry = dark?"#E0954A":"#C2631F";
  const ink = rainVar("--ink","#0D1E2D"), ink3 = rainVar("--ink-3","#6A8598");
  projZone(ctx, X(n0-1), pad, W, H);

  // above / below the trend: observed history, then the synthesised Standard series
  ctx.lineWidth = Math.max(1, (W-pad.l-pad.r)/n + .3);
  const fillDev = (i, o, e, alpha) => { if(o===null||e===null) return; ctx.strokeStyle = o>=e ? wet : dry; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(X(i), Y(e)); ctx.lineTo(X(i), Y(o)); ctx.stroke(); };
  for(let i=0;i<n0;i++) fillDev(i, m.obs30[i], m.exp30[i], .55);
  for(let k=0;k<m.proj.length;k++) fillDev(n0+k, m.p30.std[k], m.e30[k], .32);
  ctx.globalAlpha = 1;
  // cycle-trend curve through history and projection
  ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.beginPath();
  let first = true;
  for(let i=0;i<n0;i++){ const e=m.exp30[i]; if(e===null) continue; first?ctx.moveTo(X(i),Y(e)):ctx.lineTo(X(i),Y(e)); first=false; }
  m.e30.forEach((e,k)=>ctx.lineTo(X(n0+k),Y(e)));
  ctx.stroke();
  // scenario lines (90-day rolling, per 30 days) over the projection
  RAIN_SC.filter(sc=>sc.key!=="std").forEach(sc=>{
    ctx.strokeStyle = scCol(sc); ctx.lineWidth = 2; ctx.setLineDash(sc.dash||[]);
    ctx.beginPath(); m.p90[sc.key].forEach((v,k)=>{ const x=X(n0+k), y=Y(v); k?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.stroke(); ctx.setLineDash([]);
  });

  // heavy-rain rug: observed (ink), projected standard (blue), extra events in the stressed case (red)
  const rugY = H-pad.b+4;
  const dayIndexHist = new Map(m.hist.map((o,i)=>[o.t,i]));
  ctx.fillStyle = ink;
  m.heavy.forEach(o=>{ const i=dayIndexHist.get(o.t); if(i!==undefined) ctx.fillRect(X(i)-.75, rugY, 1.5, 6); });
  const projIdx = (y,doy) => m.proj.findIndex(o=>o.y===y && o.doy===doy);
  const stdKeys = new Set(m.events.std.map(e=>e.y+":"+e.doy));
  ctx.fillStyle = scCol(RAIN_SC[2]);
  m.events.std.forEach(e=>{ const k=projIdx(e.y,e.doy); if(k>=0) ctx.fillRect(X(n0+k)-.75, rugY, 1.5, 6); });
  ctx.fillStyle = scCol(RAIN_SC[3]);
  m.events.str.forEach(e=>{ if(stdKeys.has(e.y+":"+e.doy)) return; const k=projIdx(e.y,e.doy); if(k>=0) ctx.fillRect(X(n0+k)-.75, rugY+7, 1.5, 5); });

  ctx.fillStyle = ink3; ctx.font = "10px system-ui"; ctx.textAlign = "left";
  ctx.fillText("Observed", pad.l+4, pad.t+12);
  ctx.textAlign = "center";
  const dateAt = i => i<n0 ? m.hist[i].d : m.proj[i-n0].d;
  let lastY = -1;
  for(let i=0;i<n;i++){ const d=dateAt(i); if(d.getUTCMonth()===0 && d.getUTCDate()===1 && d.getUTCFullYear()!==lastY){ lastY=d.getUTCFullYear(); ctx.fillText(String(lastY), X(i), H-pad.b+26); } }

  document.getElementById("rainDailyLegend").innerHTML = legendHTML([
    {c:wet, l:"Above trend (wetter)", sw:1}, {c:dry, l:"Below trend (drier)", sw:1}, {c:ink, l:"Cycle-trend curve (seasonal)"},
    ...RAIN_SC.filter(sc=>sc.key!=="std").map(sc=>({c:scCol(sc), l:sc.label+" (180-day mean, per 30 days)", dash:!!sc.dash})),
    {c:ink, l:"Heavy-rain day: observed", sw:1}, {c:scCol(RAIN_SC[2]), l:"projected (standard)", sw:1}, {c:scCol(RAIN_SC[3]), l:"extra in stressed case", sw:1}]);

  rainHover(c, mx=>{
    const i = Math.round((mx-pad.l)/(W-pad.l-pad.r)*(n-1)); if(i<0||i>=n) return null;
    if(i<n0){ if(m.obs30[i]===null) return null;
      const dv = m.obs30[i]-m.exp30[i];
      return {title:"30 days to "+m.hist[i].t, rows:[["Observed",fmtMM(m.obs30[i]),dv>=0?wet:dry],["Trend",fmtMM(m.exp30[i]),ink],["Deviation",(dv>=0?"+":"−")+fmtMM(Math.abs(dv)),null]]}; }
    const k = i-n0;
    return {title:"30 days to "+isoDate(m.proj[k].d)+" (projected)", rows:[["Standard (synthesised)",fmtMM(m.p30.std[k]),m.p30.std[k]>=m.e30[k]?wet:dry],["Trend",fmtMM(m.e30[k]),ink]]
      .concat(RAIN_SC.filter(sc=>sc.key!=="std").map(sc=>[sc.label+" (180-day mean)", fmtMM(m.p90[sc.key][k]), scCol(sc)]))};
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
    `Scenarios: <b>Status quo</b> = last decade's mean, today's heavy-rain frequency · <b>Standard</b> = cycle-trend model continues (${m.cycles.map(c=>c.P).join("/")}-yr cycles) · `+
    `<b>Minimal stress</b> = min(model, P̄) − 0.5σ · <b>Stressed</b> = min(model, P̄) − 1.28σ (a 1-in-10 dry year every year) with heavy-rain frequency growing twice as fast, σ = ${Math.round(m.sigma)} mm. `+
    `Drier years with more frequent cloudbursts mean longer dry spells between events, so annual totals, not peak events, set the recycling need.`;

  const c = setupCanvas("rainRecycleCanvas");
  if(c){
    const ctx = c.getContext("2d"), W = c.width, H = c.height, pad = {l:56,r:16,t:24,b:30};
    ctx.clearRect(0,0,W,H);
    rainAxes(ctx, W, H, pad, 100, "Recycling rate needed (%)", 5);
    const ny = yrs.length, cw = (W-pad.l-pad.r)/ny;
    const X = i => pad.l + cw*(i+.5), Y = v => pad.t + (H-pad.t-pad.b)*(1 - v/100);
    const ink = rainVar("--ink","#0D1E2D"), ink3 = rainVar("--ink-3","#6A8598"), surf = rainVar("--surface","#fff");
    ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.setLineDash([2,3]);
    ctx.beginPath(); ctx.moveTo(pad.l, Y(target*100)); ctx.lineTo(W-pad.r, Y(target*100)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = ink3; ctx.font = "10px system-ui"; ctx.textAlign = "right";
    ctx.fillText("Neptune target "+Math.round(target*100)+"%", W-pad.r-4, Y(target*100)-5);
    rows.forEach(r=>{
      ctx.strokeStyle = scCol(r.sc); ctx.lineWidth = 2; ctx.setLineDash(r.sc.dash||[]);
      ctx.beginPath(); r.req.forEach((v,i)=>{ i?ctx.lineTo(X(i),Y(v*100)):ctx.moveTo(X(i),Y(v*100)); }); ctx.stroke(); ctx.setLineDash([]);
      r.req.forEach((v,i)=>{ ctx.fillStyle = surf; ctx.beginPath(); ctx.arc(X(i),Y(v*100),6,0,7); ctx.fill(); ctx.fillStyle = scCol(r.sc); ctx.beginPath(); ctx.arc(X(i),Y(v*100),4,0,7); ctx.fill(); });
    });
    ctx.fillStyle = ink3; ctx.textAlign = "center"; yrs.forEach((y,i)=>ctx.fillText(String(y), X(i), H-pad.b+15));
    document.getElementById("rainRecycleLegend").innerHTML = legendHTML(
      rows.map(r=>({c:scCol(r.sc), l:r.sc.label, dash:!!r.sc.dash})).concat([{c:ink, l:"Neptune target", dash:1}]));
    rainHover(c, mx=>{
      const i = Math.floor((mx-pad.l)/cw); if(i<0||i>=ny) return null;
      return {title:String(yrs[i])+" — recycling needed", rows:rows.map(r=>[r.sc.label, Math.round(r.req[i]*100)+"%", scCol(r.sc)]).concat([["Neptune target", Math.round(target*100)+"%", null]])};
    });
  }

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
