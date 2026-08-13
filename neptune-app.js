/* Neptune Water Intelligence Platform — client-side logic */
'use strict';

// ── Data constants ────────────────────────────────────────────────────────────

const TX = {
  "Pre-treatment": {
    "Mechanical Screening & Grit Removal":        {desc:"Low cost – protects downstream. Removes gross solids.",capex:5000,opex:0.02,energy:0.05,removal:{TSS:0.40,Oil:0.20},tier:"Basic"},
    "Coagulation/Flocculation + Sand Filters":    {desc:"Common for high-TSS influents. Effective solids removal.",capex:15000,opex:0.08,energy:0.12,removal:{TSS:0.85,Oil:0.50,Fe:0.60},tier:"Standard"},
    "Ultrafiltration (UF)":                       {desc:"Improved solids & pathogen removal. Ideal pre-RO.",capex:35000,opex:0.15,energy:0.25,removal:{TSS:0.99,Oil:0.80,Fe:0.90},tier:"Advanced"},
  },
  "Primary Treatment": {
    "Sedimentation":                              {desc:"Basic gravity settling.",capex:8000,opex:0.03,energy:0.04,removal:{TSS:0.60,Fe:0.50},tier:"Basic"},
    "DAF (Dissolved Air Flotation)":              {desc:"Effective for solids and oils. Compact footprint.",capex:20000,opex:0.10,energy:0.20,removal:{TSS:0.85,Oil:0.92,Fe:0.70},tier:"Standard"},
    "MBR (Primary)":                              {desc:"High effluent quality; suitable for RO feed.",capex:60000,opex:0.25,energy:0.50,removal:{TSS:0.99,Oil:0.96,Fe:0.95},tier:"Advanced"},
  },
  "Secondary Treatment": {
    "Activated Sludge (CAS)":                     {desc:"Biological baseline. Effective BOD/COD removal.",capex:25000,opex:0.12,energy:0.30,removal:{BOD:0.90,COD:0.80,TSS:0.80},tier:"Basic"},
    "MBBR / Biofilm":                             {desc:"Compact biological process. Good for variable loads.",capex:30000,opex:0.14,energy:0.35,removal:{BOD:0.92,COD:0.85,TSS:0.85},tier:"Standard"},
    "MBR (Membrane Bioreactor)":                  {desc:"High quality effluent ready for reuse or RO.",capex:65000,opex:0.28,energy:0.60,removal:{BOD:0.98,COD:0.95,TSS:0.99,Oil:0.95},tier:"Advanced"},
    "AnMBR (Anaerobic MBR)":                      {desc:"Energy recovery via biogas. Low sludge. Best for high-COD.",capex:70000,opex:0.20,energy:-0.10,removal:{BOD:0.95,COD:0.90,TSS:0.95},tier:"Advanced + Energy Recovery"},
    "Advanced Oxidation (AOP)":                   {desc:"Ozone/H₂O₂/UV for recalcitrant organics.",capex:80000,opex:0.35,energy:0.80,removal:{COD:0.96,BOD:0.96,Micro:0.99},tier:"Specialised"},
  },
  "Tertiary Treatment": {
    "NF / RO":                                    {desc:"Central for high-quality water reuse and desalination.",capex:50000,opex:0.30,energy:0.70,removal:{TDS:0.95,TSS:0.99,HM:0.99,Zn:0.99},tier:"Standard for Reuse"},
    "Activated Carbon + UV":                      {desc:"Polishing for micropollutants, colour, odour.",capex:20000,opex:0.12,energy:0.15,removal:{Micro:0.95,Bacteria:0.9999,COD:0.60},tier:"Polishing"},
    "Ion Exchange / Electrodialysis":             {desc:"Selective ion removal. Ideal for Zn, Fe, heavy metals.",capex:40000,opex:0.20,energy:0.40,removal:{HM:0.95,Zn:0.99,Fe:0.95,TDS:0.50},tier:"Selective"},
  },
  "Concentrate Management": {
    "Brine Concentration (Membrane)":            {desc:"Membrane pre-concentration before thermal.",capex:80000,opex:0.40,energy:1.20,tier:"Standard ZLD Step"},
    "Electrodialysis":                            {desc:"Energy-efficient for moderate salinity.",capex:70000,opex:0.35,energy:0.90,tier:"Energy Efficient"},
    "MEE / Thermal Evaporation (MVR)":            {desc:"Multi-effect evaporation with MVR.",capex:150000,opex:0.80,energy:8.00,tier:"High Concentration"},
  },
  "ZLD (Zero Liquid Discharge)": {
    "None (no ZLD)":                              {desc:"Discharge treated effluent within permit limits.",capex:0,opex:0,energy:0,tier:"Standard Discharge"},
    "BrineX Pre-Concentration Stages":            {desc:"Membrane pre-concentration reduces thermal energy ~40%.",capex:250000,opex:1.80,energy:12.0,tier:"Optimised ZLD"},
    "Full ZLD Train":                             {desc:"Multi-stage RO + brine concentrator + thermal. Highest recovery.",capex:400000,opex:2.50,energy:20.0,tier:"Full ZLD"},
  },
};

const STAGE_FLOW_KEY = {
  "Pre-treatment":"pretreatment","Primary Treatment":"wwt","Secondary Treatment":"wwt",
  "Tertiary Treatment":"wwt","Concentrate Management":"concentrate","ZLD (Zero Liquid Discharge)":"concentrate",
};

const DEFAULT_PROCESSES = {
  "Purification":  {flow_in:2764.30,flow_out:2764.30,leakage:0.00},
  "Desalination":  {flow_in:120.00, flow_out:201.60, leakage:-81.60},
  "Sinter Plant":  {flow_in:197.00, flow_out:194.00, leakage:3.00},
  "Blast Furnace": {flow_in:3751.40,flow_out:3566.00,leakage:185.40},
  "Process":       {flow_in:379.00, flow_out:379.00, leakage:0.00},
  "Converter":     {flow_in:433.00, flow_out:350.00, leakage:83.00},
  "Casting":       {flow_in:239.00, flow_out:180.00, leakage:59.00},
  "HSM":           {flow_in:217.60, flow_out:147.00, leakage:70.60},
  "CRM":           {flow_in:1044.20,flow_out:1043.00,leakage:1.20},
  "Galva":         {flow_in:11.90,  flow_out:11.00,  leakage:0.90},
  "Air Plant":     {flow_in:440.00, flow_out:440.00, leakage:0.00},
  "Hydrogen":      {flow_in:19.30,  flow_out:0.00,   leakage:19.30},
  "Detox":         {flow_in:0.00,   flow_out:36.00,  leakage:-36.00},
  "Filtration":    {flow_in:287.00, flow_out:287.00, leakage:0.00},
};

const DEFAULT_CONTAMINANTS = {
  "Blast Furnace": {TSS:{value:150,unit:"mg/L"},Fe:{value:35,unit:"mg/L"},Zn:{value:5,unit:"mg/L"},pH:{value:7.2,unit:"–"},COD:{value:80,unit:"mg/L"}},
  "Converter":     {TSS:{value:200,unit:"mg/L"},Fe:{value:60,unit:"mg/L"},pH:{value:8.5,unit:"–"},COD:{value:50,unit:"mg/L"}},
  "Sinter Plant":  {TSS:{value:300,unit:"mg/L"},Fe:{value:80,unit:"mg/L"},NH4:{value:10,unit:"mg/L"},pH:{value:7.5,unit:"–"}},
  "CRM":           {Oil:{value:1500,unit:"mg/L"},Fe:{value:100,unit:"mg/L"},TSS:{value:80,unit:"mg/L"},COD:{value:3000,unit:"mg/L"}},
  "HSM":           {Oil:{value:20,unit:"mg/L"},TSS:{value:60,unit:"mg/L"},Fe:{value:20,unit:"mg/L"},COD:{value:150,unit:"mg/L"}},
  "Galva":         {Zn:{value:200,unit:"mg/L"},Al:{value:50,unit:"mg/L"},pH:{value:6.5,unit:"–"},TSS:{value:120,unit:"mg/L"}},
  "Casting":       {Oil:{value:10,unit:"mg/L"},TSS:{value:50,unit:"mg/L"},Fe:{value:15,unit:"mg/L"},COD:{value:80,unit:"mg/L"}},
  "Detox":         {Zn:{value:500,unit:"mg/L"},CN:{value:5,unit:"mg/L"},pH:{value:11.5,unit:"–"},COD:{value:200,unit:"mg/L"}},
};

const RECOVERED_MATERIALS = {
  "Zinc – BF & Galva":      {sources:["Blast Furnace","Galva","Detox"],conc_mg_L:5.0,eff:0.85,val_per_tonne:2500},
  "Iron Oxide – BF/Conv/HSM":{sources:["Blast Furnace","Converter","HSM","Sinter Plant"],conc_mg_L:75.0,eff:0.75,val_per_tonne:75},
  "Oil/Emulsion – CRM":     {sources:["CRM"],conc_mg_L:1500.0,eff:0.90,val_per_tonne:150},
  "HCl/Iron Chloride – CRM":{sources:["CRM"],conc_mg_L:5000.0,eff:0.80,val_per_tonne:120},
  "Biogas – Anaerobic":     {sources:["Secondary Treatment"],conc_mg_L:null,eff:0.70,val_per_m3_gas:0.40},
};

const WATER_STRESS = {
  "Germany":1.38,"France":1.42,"Netherlands":1.22,"Belgium":1.18,"UK":1.27,
  "Spain":2.62,"Italy":2.09,"Poland":1.31,"Czech Republic":1.14,"Austria":1.08,
  "Sweden":0.81,"Norway":0.68,"USA":2.15,"India":3.05,"China":2.56,
  "Brazil":1.78,"Australia":2.28,"South Africa":2.37,"Saudi Arabia":4.22,
  "UAE":4.09,"Turkey":2.52,"Mexico":2.48,"Japan":1.98,"South Korea":2.04,
  "Morocco":3.12,"Qatar":4.97,"Israel":4.82,
};

const COUNTRY_LIMITS = {
  "_EU":{TSS:30,COD:100,BOD:25,Fe:2.0,Zn:1.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:5.0,NH4:10,CN:0.1},
  "Germany":  {TSS:30,COD:100,BOD:25,Fe:3.0,Zn:1.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:5.0,NH4:10,CN:0.1},
  "France":   {TSS:30,COD:100,BOD:25,Fe:2.0,Zn:1.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:5.0,NH4:10,CN:0.1},
  "Netherlands":{TSS:30,COD:100,BOD:25,Fe:2.0,Zn:1.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:5.0,NH4:10,CN:0.1},
  "Belgium":  {TSS:30,COD:100,BOD:25,Fe:2.0,Zn:1.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:5.0,NH4:10,CN:0.1},
  "UK":       {TSS:30,COD:100,BOD:25,Fe:2.0,Zn:1.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:10,NH4:10,CN:0.1},
  "Spain":    {TSS:30,COD:100,BOD:25,Fe:2.0,Zn:1.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:5.0,NH4:10,CN:0.1},
  "Italy":    {TSS:30,COD:100,BOD:25,Fe:2.0,Zn:1.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:5.0,NH4:10,CN:0.1},
  "Poland":   {TSS:30,COD:100,BOD:25,Fe:2.0,Zn:1.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:5.0,NH4:10,CN:0.1},
  "Sweden":   {TSS:30,COD:100,BOD:25,Fe:2.0,Zn:0.5,Ni:0.5,Pb:0.05,Cd:0.005,Oil:5.0,NH4:5,CN:0.05},
  "Norway":   {TSS:25,COD:100,BOD:25,Fe:2.0,Zn:1.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:5.0,NH4:10,CN:0.1},
  "USA":      {TSS:30,COD:null,BOD:null,Fe:1.4,Zn:0.65,Ni:0.47,Pb:0.065,Cd:0.0025,Oil:10,NH4:null,CN:0.005},
  "India":    {TSS:100,COD:250,BOD:30,Fe:3.0,Zn:5.0,Ni:3.0,Pb:0.1,Cd:0.2,Oil:10,NH4:50,CN:0.2},
  "China":    {TSS:50,COD:100,BOD:20,Fe:2.0,Zn:2.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:10,NH4:15,CN:0.2},
  "Brazil":   {TSS:100,COD:300,BOD:60,Fe:15.0,Zn:5.0,Ni:2.0,Pb:0.5,Cd:0.2,Oil:20,NH4:20,CN:0.2},
  "Australia":{TSS:30,COD:100,BOD:20,Fe:2.0,Zn:1.0,Ni:0.5,Pb:0.1,Cd:0.01,Oil:10,NH4:10,CN:0.1},
};

const LIMIT_UNITS = {TSS:"mg/L",COD:"mg/L",BOD:"mg/L",Fe:"mg/L",Zn:"mg/L",Ni:"mg/L",Pb:"mg/L",Cd:"mg/L",Oil:"mg/L",NH4:"mg/L",CN:"mg/L"};
const LIMIT_NOTES = {TSS:"Suspended solids",COD:"Chemical oxygen demand",BOD:"Biological oxygen demand",Fe:"Iron (total)",Zn:"Zinc",Ni:"Nickel — priority substance",Pb:"Lead — priority substance",Cd:"Cadmium — priority substance",Oil:"Oil & grease",NH4:"Ammonium nitrogen",CN:"Free cyanide"};

const WEI_DATA = [
  {country:"Cyprus",  wei:42.7,level:"Severe",   pressure:"Tourism, irrigation"},
  {country:"Malta",   wei:35.2,level:"Severe",   pressure:"Groundwater depletion"},
  {country:"Spain",   wei:32.1,level:"High",     pressure:"Irrigated agriculture"},
  {country:"Belgium", wei:29.6,level:"High",     pressure:"Industrial demand"},
  {country:"Italy",   wei:25.3,level:"High",     pressure:"Agriculture, energy"},
  {country:"Bulgaria",wei:22.1,level:"High",     pressure:"Energy cooling"},
  {country:"France",  wei:21.7,level:"High",     pressure:"Nuclear cooling"},
  {country:"Germany", wei:20.4,level:"High",     pressure:"Industry, energy"},
  {country:"Poland",  wei:19.8,level:"Moderate", pressure:"Coal energy cooling"},
  {country:"Romania", wei:19.3,level:"Moderate", pressure:"Irrigation, energy"},
  {country:"Greece",  wei:18.1,level:"Moderate", pressure:"Tourism, agriculture"},
  {country:"Portugal",wei:16.9,level:"Moderate", pressure:"Irrigated agriculture"},
  {country:"Czech Republic",wei:14.7,level:"Low",pressure:"Industry"},
  {country:"Hungary", wei:13.8,level:"Low",      pressure:"Agriculture"},
  {country:"Netherlands",wei:10.1,level:"Low",   pressure:"Industry, horticulture"},
  {country:"Austria", wei:8.4, level:"Low",      pressure:"Energy cooling"},
  {country:"Ireland", wei:4.2, level:"Minimal",  pressure:"Public supply"},
  {country:"Sweden",  wei:3.7, level:"Minimal",  pressure:"Energy sector"},
  {country:"Finland", wei:2.1, level:"Minimal",  pressure:"Pulp & paper"},
  {country:"Norway",  wei:1.8, level:"Minimal",  pressure:"Hydropower losses"},
];
const LEV_COL={Severe:"#C5402E",High:"#D4762A",Moderate:"#C9A820",Low:"#3A8A5E",Minimal:"#1D7A8C"};
const LEV_BG ={Severe:"rgba(197,64,46,.12)",High:"rgba(212,118,42,.12)",Moderate:"rgba(201,168,32,.12)",Low:"rgba(58,138,94,.12)",Minimal:"rgba(29,122,140,.12)"};

const SECTORS=[{label:"Energy",pct:44,color:"#1D7A8C"},{label:"Agriculture",pct:33,color:"#3A8A5E"},{label:"Public Supply",pct:15,color:"#C9A820"},{label:"Industry",pct:8,color:"#D4762A"}];

// ── Application state ─────────────────────────────────────────────────────────

const state = {
  company_name:"Bremen Steel Works", site:"Bremen, Germany", industry:"Integrated Steel Plant",
  operating_hours:8760, total_inlet_flow:6589.30, discharge_flow:6247.00,
  pretreatment_flow_m3h:2764.30, wwt_flow_m3h:2000.0, concentrate_flow_m3h:300.0,
  water_cost_eur_m3:0.35, discharge_cost_eur_m3:0.45, electricity_cost_eur_kwh:0.12,
  discount_rate_pct:8.0, time_horizon_yr:5, target_recycle_pct:70.0,
  prod_penalty_m_eur:2.0, capex_profile:"front-loaded",
  selected_country:"Germany",
  processes:null, contaminants:null, selected_treatments:null,
};

// ── Calculation functions (ported from Python utils/calculations.py) ───────────

function annualWaterCosts() {
  const hrs = state.operating_hours;
  const intake_m3_yr = state.total_inlet_flow * hrs;
  const disch_m3_yr  = state.discharge_flow * hrs;
  const totalLeak = Object.values(state.processes).reduce((s,p)=>s+p.leakage,0);
  const intake_cost = intake_m3_yr * state.water_cost_eur_m3;
  const disch_cost  = disch_m3_yr  * state.discharge_cost_eur_m3;
  return {
    intake_m3_yr, disch_m3_yr,
    leakage_m3h:totalLeak, leakage_m3_yr:totalLeak*hrs,
    intake_cost_eur_yr:intake_cost, disch_cost_eur_yr:disch_cost,
    total_cost_eur_yr:intake_cost+disch_cost,
  };
}

function treatmentCapexOpex() {
  if(!state.selected_treatments) return {total_capex_eur:0,total_opex_eur_yr:0,total_energy_kwh_yr:0,detail:{}};
  const hrs  = state.operating_hours;
  const tot  = state.total_inlet_flow;
  const flows = {
    pretreatment: state.pretreatment_flow_m3h,
    wwt:          state.wwt_flow_m3h,
    concentrate:  state.concentrate_flow_m3h,
  };
  let totalCapex=0, totalOpex=0, totalEnergy=0;
  const detail={};
  for(const [stage,tech] of Object.entries(state.selected_treatments)){
    if(!tech||tech.includes("None"))continue;
    const opts=TX[stage];if(!opts||!opts[tech])continue;
    const t=opts[tech];
    const fk=STAGE_FLOW_KEY[stage]||"wwt";
    const flow=flows[fk];
    const capex=t.capex*flow;
    const opex_yr=t.opex*flow*hrs;
    const energy_yr=t.energy*flow*hrs;
    totalCapex+=capex; totalOpex+=opex_yr; totalEnergy+=energy_yr;
    detail[stage]={tech,flow,capex_eur:capex,opex_eur_yr:opex_yr,energy_kwh_yr:energy_yr,tier:t.tier};
  }
  return {total_capex_eur:totalCapex,total_opex_eur_yr:totalOpex,total_energy_kwh_yr:totalEnergy,detail};
}

function materialRecoveryRevenue() {
  const hrs=state.operating_hours;
  const procs=state.processes;
  const results={};
  for(const[mat,props] of Object.entries(RECOVERED_MATERIALS)){
    const srcFlow=Object.entries(procs)
      .filter(([n])=>props.sources.includes(n))
      .reduce((s,[,p])=>s+p.flow_out,0)||
      Object.values(procs).reduce((s,p)=>s+p.flow_out,0)*0.30;
    if(props.conc_mg_L===null){
      const cod_kg_h=0.500*srcFlow;
      const biogas_m3_yr=cod_kg_h*0.35*hrs*props.eff;
      results[mat]={qty:Math.round(biogas_m3_yr),unit:"Nm³/yr",rev_eur_yr:Math.round(biogas_m3_yr*(props.val_per_m3_gas||0))};
    }else{
      const mass_kg_h=(props.conc_mg_L/1e6)*srcFlow*1e3;
      const mass_t_yr=mass_kg_h*hrs/1000*props.eff;
      results[mat]={qty:Math.round(mass_t_yr*10)/10,unit:"tonnes/yr",rev_eur_yr:Math.round(mass_t_yr*(props.val_per_tonne||0))};
    }
  }
  return results;
}

function ebitdaBridge(costs,recycleRate,txOpex,matRevYr,energySavYr){
  const frac=recycleRate/100;
  const wSav=costs.intake_cost_eur_yr*frac;
  const dSav=costs.disch_cost_eur_yr*frac*0.60;
  const baseline=costs.total_cost_eur_yr;
  const net=wSav+dSav+matRevYr+energySavYr-txOpex;
  return {baseline,water_saving:wSav,discharge_saving:dSav,mat_revenue:matRevYr,energy_saving:energySavYr,tx_opex:txOpex,net_improvement:net,improved_cost:baseline-net};
}

function npvCalc(capexSched,annualBenefit,annualOpex,rate_pct){
  const r=rate_pct/100;
  let pv=-capexSched.reduce((s,c,i)=>s+c/Math.pow(1+r,i+1),0);
  const n=capexSched.length;
  for(let yr=n+1;yr<=20;yr++) pv+=(annualBenefit-annualOpex)/Math.pow(1+r,yr);
  return pv;
}

function irrCalc(capexSched,annualBenefit,annualOpex){
  const cf=capexSched.map(c=>-c);
  for(let yr=capexSched.length+1;yr<=20;yr++) cf.push(annualBenefit-annualOpex);
  let rate=0.10;
  for(let i=0;i<300;i++){
    let pv=0,dpv=0;
    for(let j=0;j<cf.length;j++){
      const disc=Math.pow(1+rate,j);
      pv+=cf[j]/disc;
      dpv-=j*cf[j]/(disc*(1+rate));
    }
    if(Math.abs(dpv)<1e-12)break;
    const step=pv/dpv;
    rate-=Math.max(-0.5,Math.min(0.5,step));
    if(rate<-0.999)rate=-0.999;
    if(rate>10)return 999;
  }
  return Math.round(rate*10000)/100;
}

function simplePayback(capex,annualBenefit){
  if(annualBenefit<=0)return Infinity;
  return capex/annualBenefit;
}

function phaseCapex(total,years,profile){
  let w;
  if(profile==="front-loaded") w=[0.40,0.35,0.20,0.05,0.00,0,0,0,0,0].slice(0,years);
  else if(profile==="back-loaded") w=[0.05,0.10,0.25,0.35,0.25,0,0,0,0,0].slice(0,years);
  else w=Array(years).fill(1/years);
  const s=w.reduce((a,b)=>a+b,0);
  return w.map(x=>total*x/s);
}

function cumulativeCashflow(annualBenefit,txOpex,capexSched){
  let net=0;const res=[];const n=capexSched.length;
  for(let i=0;i<n;i++){
    const ramp=(i+1)/n;
    net+=-capexSched[i]+(annualBenefit-txOpex)*ramp;
    res.push(net);
  }
  const total=Math.max(15,n+5);
  for(let i=n;i<total;i++){net+=annualBenefit-txOpex;res.push(net);}
  return res;
}

function recommendTreatments(contaminants,targetReuse){
  const vals={TSS:[],Oil:[],Zn:[],COD:[]};
  for(const proc of Object.values(contaminants)){
    for(const[k,v] of Object.entries(proc)){
      if(vals[k]!==undefined) vals[k].push(v.value);
    }
  }
  const mx=k=>Math.max(0,...(vals[k]||[]));
  const pre  = mx("TSS")>200?"Ultrafiltration (UF)":"Coagulation/Flocculation + Sand Filters";
  const pri  = mx("Oil")>50?"DAF (Dissolved Air Flotation)":"Sedimentation";
  const sec  = mx("COD")>1000?"AnMBR (Anaerobic MBR)":(targetReuse?"MBR (Membrane Bioreactor)":"MBBR / Biofilm");
  const ter  = mx("Zn")>100?"Ion Exchange / Electrodialysis":"NF / RO";
  const conc = targetReuse?"MEE / Thermal Evaporation (MVR)":"Brine Concentration (Membrane)";
  return {"Pre-treatment":pre,"Primary Treatment":pri,"Secondary Treatment":sec,
          "Tertiary Treatment":ter,"Concentrate Management":conc,"ZLD (Zero Liquid Discharge)":"None (no ZLD)"};
}

// ── Canvas chart helpers ──────────────────────────────────────────────────────

function setupCanvas(id){
  const c=document.getElementById(id);if(!c)return null;
  const p=c.parentElement;
  c.width=p.clientWidth;c.height=p.clientHeight;
  return c;
}

function fmtM(v,dec=1){return "€"+(Math.abs(v)/1e6).toFixed(dec)+"M";}
function fmtNum(v){return v===null||v===undefined?"–":v.toLocaleString();}

function drawWaterfall(canvasId,labels,measures,values){
  const c=setupCanvas(canvasId);if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=70,pR=14,pT=28,pB=90;
  const cW=W-pL-pR,cH=H-pT-pB;

  let cum=0;
  const bars=labels.map((lbl,i)=>{
    const v=values[i],m=measures[i];
    let bot,top;
    if(m==="absolute"){bot=0;top=v;cum=v;}
    else if(m==="relative"){if(v>=0){bot=cum;top=cum+v;}else{top=cum;bot=cum+v;}cum+=v;}
    else{bot=0;top=cum;}
    return{lbl,v,m,bot,top};
  });

  const allV=bars.flatMap(b=>[b.bot,b.top]);
  const minV=Math.min(0,...allV),maxV=Math.max(0,...allV);
  const range=maxV-minV||1;
  const toY=v=>pT+cH-((v-minV)/range)*cH;

  ctx.clearRect(0,0,W,H);
  const style=getComputedStyle(document.documentElement);
  const ink3=style.getPropertyValue("--ink-3").trim()||"#6A8598";
  const ink2=style.getPropertyValue("--ink-2").trim()||"#3B566A";
  const ink=style.getPropertyValue("--ink").trim()||"#0D1E2D";
  const surf=style.getPropertyValue("--surface").trim()||"#fff";

  const nT=5;
  for(let i=0;i<=nT;i++){
    const v=minV+(range/nT)*i;const y=toY(v);
    ctx.strokeStyle="rgba(128,128,128,0.15)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="right";
    ctx.fillText(fmtM(v,0),pL-4,y+4);
  }

  const bW=Math.max((cW/labels.length)*0.55,6);
  const gap=cW/labels.length;

  bars.forEach((b,i)=>{
    const x=pL+i*gap+(gap-bW)/2;
    const yTop=toY(b.top),yBot=toY(b.bot);
    const h=Math.max(Math.abs(yTop-yBot),2);
    const col=b.m==="absolute"?"#1D7A8C":b.m==="total"?"#4a90d9":b.v>=0?"#2ea44f":"#e74c3c";
    ctx.fillStyle=col;
    ctx.fillRect(x,Math.min(yTop,yBot),bW,h);

    if(i<bars.length-1&&b.m!=="total"){
      const connY=toY(b.top);
      ctx.strokeStyle="rgba(128,128,128,0.5)";ctx.lineWidth=1;
      ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.moveTo(x+bW,connY);ctx.lineTo(x+gap,connY);ctx.stroke();
      ctx.setLineDash([]);
    }

    const lbl=fmtM(Math.abs(b.v),1);
    ctx.fillStyle=ink2;ctx.font="bold 10px system-ui";ctx.textAlign="center";
    const ly=b.v>=0?Math.min(yTop,yBot)-5:Math.max(yTop,yBot)+13;
    ctx.fillText(lbl,x+bW/2,ly);

    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";
    const words=b.lbl.split(" ");
    const L1=words.slice(0,2).join(" "),L2=words.slice(2).join(" ");
    ctx.fillText(L1,x+bW/2,H-pB+16);
    if(L2)ctx.fillText(L2,x+bW/2,H-pB+28);
  });

  const y0=toY(0);
  ctx.strokeStyle="rgba(128,128,128,0.4)";ctx.lineWidth=1;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(pL,y0);ctx.lineTo(W-pR,y0);ctx.stroke();
}

function drawLineChart(canvasId,years,series,pb,extraMarker){
  const c=setupCanvas(canvasId);if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=72,pR=16,pT=20,pB=40;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const style=getComputedStyle(document.documentElement);
  const ink3=style.getPropertyValue("--ink-3").trim()||"#6A8598";
  const ink2=style.getPropertyValue("--ink-2").trim()||"#3B566A";

  const allVals=series.flatMap(s=>s.data);
  const minV=Math.min(0,...allVals),maxV=Math.max(...allVals);
  const range=maxV-minV||1;
  const toX=i=>pL+(i/(years.length-1))*cW;
  const toY=v=>pT+cH-((v-minV)/range)*cH;

  const nT=5;
  for(let i=0;i<=nT;i++){
    const v=minV+(range/nT)*i;const y=toY(v);
    ctx.strokeStyle="rgba(128,128,128,0.15)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="right";
    ctx.fillText(fmtM(v,0),pL-4,y+4);
  }

  const y0=toY(0);
  ctx.strokeStyle="rgba(220,50,50,0.5)";ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(pL,y0);ctx.lineTo(W-pR,y0);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle="rgba(220,50,50,0.6)";ctx.font="10px system-ui";ctx.textAlign="left";
  ctx.fillText("Break-even",pL+4,y0-4);

  if(pb&&pb<years.length){
    const xpb=toX(pb);
    ctx.strokeStyle="rgba(46,164,79,0.5)";ctx.lineWidth=1;ctx.setLineDash([3,3]);
    ctx.beginPath();ctx.moveTo(xpb,pT);ctx.lineTo(xpb,H-pB);ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle="rgba(46,164,79,0.7)";ctx.font="10px system-ui";ctx.textAlign="center";
    ctx.fillText("Payback",xpb,pT+10);
  }

  for(const s of series){
    ctx.strokeStyle=s.color;ctx.lineWidth=2;ctx.setLineDash([]);
    ctx.beginPath();
    s.data.forEach((v,i)=>{i===0?ctx.moveTo(toX(i),toY(v)):ctx.lineTo(toX(i),toY(v));});
    ctx.stroke();
    ctx.fillStyle=s.color+"28";
    ctx.beginPath();
    ctx.moveTo(toX(0),y0);
    s.data.forEach((v,i)=>ctx.lineTo(toX(i),toY(v)));
    ctx.lineTo(toX(s.data.length-1),y0);ctx.closePath();ctx.fill();
  }

  years.forEach((yr,i)=>{
    if(i%Math.max(1,Math.floor(years.length/8))===0){
      ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";
      ctx.fillText("Y"+yr,toX(i),H-pB+16);
    }
  });
}

function drawGroupedBar(canvasId,xLabels,groups,yFmt){
  const c=setupCanvas(canvasId);if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=72,pR=16,pT=24,pB=44;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const style=getComputedStyle(document.documentElement);
  const ink3=style.getPropertyValue("--ink-3").trim()||"#6A8598";
  const fmt=yFmt||(v=>fmtM(v,0));

  const allVals=groups.flatMap(g=>g.values);
  const minV=Math.min(0,...allVals),maxV=Math.max(0,...allVals);
  const range=maxV-minV||1;
  const toY=v=>pT+cH-((v-minV)/range)*cH;
  const y0=toY(0);

  const nT=4;
  for(let i=0;i<=nT;i++){
    const v=minV+(range/nT)*i;const y=toY(v);
    ctx.strokeStyle="rgba(128,128,128,0.15)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="right";
    ctx.fillText(fmt(v),pL-4,y+4);
  }

  const grpW=cW/xLabels.length;
  const bW=grpW*0.7/groups.length;

  xLabels.forEach((lbl,xi)=>{
    groups.forEach((g,gi)=>{
      const v=g.values[xi];
      const x=pL+xi*grpW+(grpW*0.15)+gi*bW;
      const yTop=toY(v);
      const h=Math.abs(yTop-y0);
      ctx.fillStyle=g.color;
      ctx.fillRect(x,v>=0?yTop:y0,bW-1,Math.max(h,2));
    });
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";
    ctx.fillText(lbl,pL+(xi+0.5)*grpW,H-pB+16);
  });

  // Legend
  let lx=pL;
  groups.forEach(g=>{
    ctx.fillStyle=g.color;ctx.fillRect(lx,pT-14,10,10);
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="left";
    ctx.fillText(g.name,lx+13,pT-5);
    lx+=ctx.measureText(g.name).width+32;
  });
}

function drawSensLine(canvasId,rates,npvs,selRate){
  const c=setupCanvas(canvasId);if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=72,pR=16,pT=20,pB=36;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const style=getComputedStyle(document.documentElement);
  const ink3=style.getPropertyValue("--ink-3").trim()||"#6A8598";

  const minV=Math.min(...npvs),maxV=Math.max(...npvs);
  const range=maxV-minV||1;
  const toX=i=>pL+(i/(rates.length-1))*cW;
  const toY=v=>pT+cH-((v-minV)/range)*cH;
  const y0=toY(0);

  const nT=4;
  for(let i=0;i<=nT;i++){
    const v=minV+(range/nT)*i;const y=toY(v);
    ctx.strokeStyle="rgba(128,128,128,0.15)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="right";
    ctx.fillText(fmtM(v,0),pL-4,y+4);
  }
  ctx.strokeStyle="rgba(220,50,50,0.5)";ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(pL,y0);ctx.lineTo(W-pR,y0);ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle="#4a90d9";ctx.lineWidth=2;
  ctx.beginPath();
  npvs.forEach((v,i)=>{i===0?ctx.moveTo(toX(i),toY(v)):ctx.lineTo(toX(i),toY(v));});
  ctx.stroke();

  const si=rates.indexOf(Math.round(selRate));
  if(si>=0){
    ctx.fillStyle="#2ea44f";ctx.beginPath();ctx.arc(toX(si),toY(npvs[si]),5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";
    ctx.fillText(selRate+"%",toX(si),toY(npvs[si])-8);
  }

  rates.forEach((r,i)=>{
    if(i%5===0){
      ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";
      ctx.fillText(r+"%",toX(i),H-pB+16);
    }
  });
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderDashboard(){
  const costs=annualWaterCosts();
  const tx=treatmentCapexOpex();
  const mat=materialRecoveryRevenue();
  const matRev=Object.values(mat).reduce((s,v)=>s+v.rev_eur_yr,0);
  const energySav=state.selected_treatments["Secondary Treatment"]==="AnMBR (Anaerobic MBR)"
    ?(TX["Secondary Treatment"]["AnMBR (Anaerobic MBR)"].energy*state.total_inlet_flow*state.operating_hours*state.electricity_cost_eur_kwh):0;
  const bridge=ebitdaBridge(costs,state.target_recycle_pct,tx.total_opex_eur_yr,matRev,energySav);
  const capexSched=phaseCapex(tx.total_capex_eur,state.time_horizon_yr,state.capex_profile);
  const pb=simplePayback(tx.total_capex_eur,bridge.net_improvement);
  const npvVal=npvCalc(capexSched,bridge.net_improvement,0,state.discount_rate_pct);
  const irrVal=irrCalc(capexSched,bridge.net_improvement,0);

  document.getElementById("dashMeta").textContent=`${state.company_name} · ${state.site}`;
  document.getElementById("dk1").innerHTML=fmtM(costs.total_cost_eur_yr)+"<span class='kpi-unit'>/yr</span>";
  document.getElementById("dk2").innerHTML=fmtM(bridge.net_improvement)+"<span class='kpi-unit'>/yr</span>";
  document.getElementById("dk3").innerHTML=state.target_recycle_pct+"<span class='kpi-unit'>%</span>";
  document.getElementById("dk4").innerHTML=fmtM(tx.total_capex_eur);
  document.getElementById("dk5").innerHTML=(isFinite(pb)?pb.toFixed(1)+":"+"<span class='kpi-unit'>yrs</span>":">50 yrs");
  document.getElementById("dk6").innerHTML=fmtM(npvVal);
  document.getElementById("dk7").innerHTML=(irrVal<999?irrVal.toFixed(1):"N/A")+"<span class='kpi-unit'>%</span>";
  document.getElementById("dk8").innerHTML=state.total_inlet_flow.toFixed(0)+"<span class='kpi-unit'> m³/h</span>";
  document.getElementById("dashTxSub").textContent=`Treatment technologies: ${Object.values(state.selected_treatments).filter(t=>t&&!t.includes("None")).length} active stages`;
}

function renderCountry(){
  const c=state.selected_country;
  const score=WATER_STRESS[c]||1.5;
  const cats=[[0,1,"Low","#1a9850"],[1,2,"Low-Medium","#91cf60"],[2,3,"Medium-High","#fee08b"],[3,4,"High","#fc8d59"],[4,5,"Extremely High","#d73027"]];
  const cat=cats.find(([lo,hi])=>score>=lo&&score<hi)||cats[cats.length-1];
  const pct=(score/5)*100;
  document.getElementById("countryStressCard").innerHTML=
    `<strong>${c}</strong> — Water Stress Score: <strong>${score.toFixed(2)}</strong> / 5.0 · <span style="color:${cat[3]};font-weight:600">${cat[2]}</span>`+
    `<div class="country-stress-bar"><div class="stress-track"><div class="stress-marker" style="left:${pct}%"></div></div></div>`;

  const limits=COUNTRY_LIMITS[c]||COUNTRY_LIMITS["_EU"];
  document.getElementById("limitsSub").textContent=c+" — industrial discharge limits (steel/metals sector)";
  const tbody=document.getElementById("limitsTbody");
  tbody.innerHTML="";
  for(const[param,val] of Object.entries(limits)){
    if(val===null)continue;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${param}</td><td class="td-num">${val}</td><td>${LIMIT_UNITS[param]||""}</td><td style="color:var(--ink-3);font-size:11.5px">${LIMIT_NOTES[param]||""}</td>`;
    tbody.appendChild(tr);
  }
}

function renderCompany(){
  const tbody=document.getElementById("processTbody");
  tbody.innerHTML="";
  for(const[name,p] of Object.entries(state.processes)){
    const tr=document.createElement("tr");
    const lossCol=p.leakage>0?"color:var(--red)":p.leakage<0?"color:var(--green)":"";
    tr.innerHTML=`<td>${name}</td><td class="td-num">${p.flow_in.toFixed(2)}</td><td class="td-num">${p.flow_out.toFixed(2)}</td><td class="td-num" style="${lossCol}">${p.leakage>0?"+":""}${p.leakage.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  }
  const ctbody=document.getElementById("contamTbody");
  ctbody.innerHTML="";
  for(const[proc,params] of Object.entries(state.contaminants)){
    let first=true;
    for(const[param,v] of Object.entries(params)){
      const tr=document.createElement("tr");
      tr.innerHTML=`<td style="color:var(--ink-3);font-size:12px">${first?proc:""}</td><td><strong>${param}</strong></td><td class="td-num">${v.value}</td><td style="color:var(--ink-3)">${v.unit}</td>`;
      ctbody.appendChild(tr);first=false;
    }
  }
}

function renderTreatment(){
  const grid=document.getElementById("stageGrid");
  grid.innerHTML="";
  const INFLUENT={TSS:150,Oil:30,Fe:40,Zn:5,COD:500,BOD:200,HM:5,TDS:1200,Micro:0.5};

  for(const stage of Object.keys(TX)){
    const opts=TX[stage];
    const selTech=state.selected_treatments[stage]||Object.keys(opts)[0];
    const card=document.createElement("div");card.className="stage-card";
    const optHtml=Object.keys(opts).map(k=>`<option value="${k}"${k===selTech?"selected":""}>${k}</option>`).join("");
    card.innerHTML=`
      <div><div class="stage-name">${stage}</div><div class="stage-tier">${opts[selTech]?.tier||""}</div></div>
      <div>
        <select style="width:100%;padding:7px 10px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface);color:var(--ink);font-size:13px;font-family:inherit;" data-stage="${stage}" onchange="onTechChange(this)">
          ${optHtml}
        </select>
        <div style="font-size:11px;color:var(--ink-3);margin-top:5px;">${opts[selTech]?.desc||""}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:var(--ink-3)">CAPEX/m³/h</div>
        <div style="font-size:13px;font-weight:600;color:var(--ink)">€${(opts[selTech]?.capex||0).toLocaleString()}</div>
      </div>`;
    grid.appendChild(card);
  }

  // Removal chain table
  const tbody=document.getElementById("removalTbody");
  tbody.innerHTML="";
  let residual={TSS:150,Oil:30,Fe:40,Zn:5,COD:500,BOD:200};
  for(const stage of Object.keys(TX)){
    const tech=state.selected_treatments[stage];
    if(!tech||tech.includes("None"))continue;
    const t=TX[stage]?.[tech];if(!t)continue;
    const fk=STAGE_FLOW_KEY[stage]||"wwt";
    const flow={pretreatment:state.pretreatment_flow_m3h,wwt:state.wwt_flow_m3h,concentrate:state.concentrate_flow_m3h}[fk];
    const capexM=(t.capex*flow/1e6).toFixed(2);
    const opexM=(t.opex*flow*state.operating_hours/1e6).toFixed(2);
    const rem=t.removal||{};
    const cell=p=>{
      const eff=rem[p];if(eff===undefined)return`<td style="color:var(--ink-3);text-align:center">–</td>`;
      const pct=Math.round(eff*100);const res=Math.max(0,residual[p]*(1-eff));
      residual[p]=res;
      return`<td style="text-align:center"><span style="font-size:10px;color:var(--green);font-weight:600">${pct}%</span><br><span style="font-size:10px;color:var(--ink-3)">${res.toFixed(1)}</span></td>`;
    };
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${stage}</strong></td><td style="font-size:12px">${tech}</td>${cell("TSS")}${cell("Oil")}${cell("Fe")}${cell("Zn")}${cell("COD")}${cell("BOD")}<td><span class="chip" style="background:var(--accent-lt);color:var(--accent)">${t.tier}</span></td><td class="td-num">${capexM}</td><td class="td-num">${opexM}</td>`;
    tbody.appendChild(tr);
  }

  const tx=treatmentCapexOpex();
  document.getElementById("txCapex").innerHTML=fmtM(tx.total_capex_eur);
  document.getElementById("txOpex").innerHTML=fmtM(tx.total_opex_eur_yr)+"<span class='kpi-unit'>/yr</span>";
  document.getElementById("txEnergy").innerHTML=(tx.total_energy_kwh_yr/1e6).toFixed(1)+"<span class='kpi-unit'>GWh/yr</span>";
  const active=Object.values(state.selected_treatments).filter(t=>t&&!t.includes("None")).length;
  document.getElementById("txStages").innerHTML=active+"<span class='kpi-unit'> stages</span>";
}

// Compute leak detection net savings (reused in EBITDA and dashboard)
function leakDetectSavings(){
  const Lm = +( document.getElementById("ldLm")?.value||8.5);
  const Nc = +( document.getElementById("ldNc")?.value||45);
  const Lp = +( document.getElementById("ldLp")?.value||2.1);
  const P_bar=+(document.getElementById("ldP")?.value||4.2);
  const C_prog=+(document.getElementById("ldProgramCost")?.value||85000);
  const P_m=P_bar*10.2;
  const UARL_Ld=(18*Lm+0.8*Nc+25*Lp)*P_m;
  const UARL_MLyr=UARL_Ld*365/1e6;
  const Q_in=state.total_inlet_flow;
  const Q_auth=state.discharge_flow||Q_in*0.95;
  const NRW_MLyr=Math.max(0,Q_in-Q_auth)*8760/1000;
  const CARL_MLyr=NRW_MLyr*0.8;
  const recoverable=Math.max(0,CARL_MLyr-UARL_MLyr)*0.35*1000; // m³/yr recoverable
  const savings=recoverable*(state.water_cost_eur_m3||0.35);
  return {savings, C_prog, net:Math.max(0,savings-C_prog), CARL_MLyr, UARL_MLyr};
}

function renderEBITDA(){
  const costs=annualWaterCosts();
  const tx=treatmentCapexOpex();
  const mat=materialRecoveryRevenue();
  const matRev=Object.values(mat).reduce((s,v)=>s+v.rev_eur_yr,0);
  const sel=state.selected_treatments||{};
  const energySav=sel["Secondary Treatment"]==="AnMBR (Anaerobic MBR)"
    ?Math.abs(TX["Secondary Treatment"]["AnMBR (Anaerobic MBR)"].energy)*state.total_inlet_flow*state.operating_hours*state.electricity_cost_eur_kwh:0;
  const penalty=(state.prod_penalty_m_eur||0)*1e6;
  const ld=leakDetectSavings();
  const leakSav=ld.net; // net benefit of leak detection programme
  const bridge=ebitdaBridge(costs,state.target_recycle_pct,tx.total_opex_eur_yr,matRev,energySav);
  const netWithPenalty=bridge.net_improvement+penalty+leakSav;
  const pb=simplePayback(tx.total_capex_eur,netWithPenalty);

  document.getElementById("ek1").innerHTML=fmtM(bridge.baseline)+"<span class='kpi-unit'>/yr</span>";
  document.getElementById("ek2").innerHTML=fmtM(bridge.water_saving+bridge.discharge_saving+matRev+energySav+penalty+leakSav)+"<span class='kpi-unit'>/yr</span>";
  document.getElementById("ek3").innerHTML=fmtM(tx.total_opex_eur_yr)+"<span class='kpi-unit'>/yr</span>";
  document.getElementById("ek4").innerHTML=fmtM(netWithPenalty)+"<span class='kpi-unit'>/yr</span>";
  document.getElementById("ek5").innerHTML=(isFinite(pb)&&pb<50?pb.toFixed(1)+" yrs":">50 yrs");

  drawWaterfall("ebitdaCanvas",
    ["Baseline\nCost","Water\nSavings","Discharge\nSavings","Material\nRevenue","Energy\nSavings","Leak\nDetection","Regulatory\nValue","Treatment\nOPEX","Net EBITDA"],
    ["absolute","relative","relative","relative","relative","relative","relative","relative","total"],
    [bridge.baseline,bridge.water_saving,bridge.discharge_saving,matRev,energySav,leakSav,penalty,-tx.total_opex_eur_yr,0]
  );

  const tbody=document.getElementById("ebitdaTbody");tbody.innerHTML="";
  const rows=[
    ["Water Intake Savings","Reduced freshwater purchase",bridge.water_saving],
    ["Discharge Cost Savings","Reduced permit/treatment cost",bridge.discharge_saving],
    ["Material Recovery Revenue","Zinc, Fe, oil, acid recovery",matRev],
    ["Energy Savings","AnMBR biogas & pump energy",energySav],
    ["Leak Detection Net Benefit",`IWA CARL→UARL recovery (ILI target) less programme cost €${ld.C_prog.toLocaleString()}`,leakSav],
    ["Regulatory Value","Avoided fines & licence risk",penalty],
    ["Treatment OPEX","Annual treatment operating cost",-tx.total_opex_eur_yr],
  ];
  rows.forEach(([item,desc,val])=>{
    const pct=bridge.baseline>0?(val/bridge.baseline*100):0;
    const col=val>=0?"color:var(--green)":"color:var(--red)";
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${item}</strong></td><td style="color:var(--ink-3);font-size:12px">${desc}</td><td class="td-num" style="${col}">€${val.toLocaleString("en",{maximumFractionDigits:0})}</td><td class="td-num" style="${col}">${pct>=0?"+":""}${pct.toFixed(1)}%</td>`;
    tbody.appendChild(tr);
  });

  const mtbody=document.getElementById("matRevTbody");mtbody.innerHTML="";
  for(const[stream,d] of Object.entries(mat)){
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${stream}</td><td class="td-num">${d.qty.toLocaleString()}</td><td>${d.unit}</td><td class="td-num">€${d.rev_eur_yr.toLocaleString()}</td>`;
    mtbody.appendChild(tr);
  }
}

function renderCapex(){
  const costs=annualWaterCosts();
  const tx=treatmentCapexOpex();
  const mat=materialRecoveryRevenue();
  const matRev=Object.values(mat).reduce((s,v)=>s+v.rev_eur_yr,0);
  const energySav=state.selected_treatments["Secondary Treatment"]==="AnMBR (Anaerobic MBR)"
    ?Math.abs(TX["Secondary Treatment"]["AnMBR (Anaerobic MBR)"].energy)*state.total_inlet_flow*state.operating_hours*state.electricity_cost_eur_kwh:0;
  const penalty=(state.prod_penalty_m_eur||0)*1e6;
  const bridge=ebitdaBridge(costs,state.target_recycle_pct,tx.total_opex_eur_yr,matRev,energySav);
  const annualBenefit=bridge.net_improvement+penalty;
  const capexSched=phaseCapex(tx.total_capex_eur,state.time_horizon_yr,state.capex_profile);
  const totalCapex=capexSched.reduce((s,c)=>s+c,0);
  const npvVal=npvCalc(capexSched,annualBenefit,0,state.discount_rate_pct);
  const irrVal=irrCalc(capexSched,annualBenefit,0);
  const pb=simplePayback(totalCapex,annualBenefit);

  document.getElementById("ck1").innerHTML=fmtM(totalCapex);
  document.getElementById("ck2").innerHTML=fmtM(npvVal);
  document.getElementById("ck3").innerHTML=(irrVal<999?irrVal.toFixed(1):"N/A")+"<span class='kpi-unit'>%</span>";
  document.getElementById("ck4").innerHTML=(isFinite(pb)&&pb<50?pb.toFixed(1)+" yrs":">50 yrs");
  document.getElementById("capexPhaseSub").textContent=`${state.time_horizon_yr}-year ${state.capex_profile} profile · discount rate ${state.discount_rate_pct}%`;

  const tbody=document.getElementById("capexPhaseTbody");tbody.innerHTML="";
  let cumC=0;
  capexSched.forEach((capex,i)=>{
    cumC+=capex;
    const ramp=(i+1)/state.time_horizon_yr;
    const opex=(tx.total_opex_eur_yr*ramp/1e6).toFixed(2);
    const ben=(annualBenefit*ramp/1e6).toFixed(2);
    const net=((annualBenefit-tx.total_opex_eur_yr)*ramp/1e6).toFixed(2);
    const netCol=+net>=0?"color:var(--green)":"color:var(--red)";
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>Year ${i+1}</td><td class="td-num">${(capex/1e6).toFixed(2)}</td><td class="td-num">${(cumC/1e6).toFixed(2)}</td><td class="td-num">${opex}</td><td class="td-num">${ben}</td><td class="td-num" style="${netCol}">${+net>=0?"+":""}${net}</td>`;
    tbody.appendChild(tr);
  });

  // Charts
  const years=Array.from({length:state.time_horizon_yr},(_,i)=>i+1);
  const cumVals=cumulativeCashflow(annualBenefit,tx.total_opex_eur_yr,capexSched);
  const cumYears=Array.from({length:cumVals.length},(_,i)=>i+1);
  setTimeout(()=>{
    drawLineChart("cashflowCanvas",cumYears,[{data:cumVals,color:"#4a90d9"}],pb<cumVals.length?pb:null);
    drawGroupedBar("annualCanvas",years,[
      {name:"CAPEX",values:capexSched.map(v=>-v/1e6),color:"#e74c3c"},
      {name:"OPEX",values:years.map((_,i)=>-tx.total_opex_eur_yr*Math.min((i+1)/state.time_horizon_yr,1)/1e6),color:"#e67e22"},
      {name:"Benefit",values:years.map((_,i)=>annualBenefit*Math.min((i+1)/state.time_horizon_yr,1)/1e6),color:"#2ea44f"},
    ]);
    const rates=Array.from({length:24},(_,i)=>i+2);
    const npvs=rates.map(r=>npvCalc(capexSched,annualBenefit,0,r)/1e6);
    drawSensLine("npvSensCanvas",rates,npvs,state.discount_rate_pct);
  },50);

  const optTbody=document.getElementById("optTbody");optTbody.innerHTML="";
  const optRows=[];
  for(const[stage,tech] of Object.entries(state.selected_treatments)){
    if(!tech||tech.includes("None"))continue;
    const t=TX[stage]?.[tech];if(!t)continue;
    const fk=STAGE_FLOW_KEY[stage]||"wwt";
    const flow={pretreatment:state.pretreatment_flow_m3h,wwt:state.wwt_flow_m3h,concentrate:state.concentrate_flow_m3h}[fk];
    const sc=t.capex*flow;
    const stageNpv=npvCalc(capexSched.map(c=>c*(sc/Math.max(totalCapex,1))),annualBenefit*(sc/Math.max(totalCapex,1)),0,state.discount_rate_pct);
    optRows.push({stage,tech,tier:t.tier,capexM:sc/1e6,npvM:stageNpv/1e6,ratio:stageNpv/Math.max(sc,1)});
  }
  optRows.sort((a,b)=>b.ratio-a.ratio);
  optRows.forEach((r,i)=>{
    const star="★".repeat(Math.min(5,optRows.length-i));
    const bg=r.ratio>1.5?"background:rgba(46,164,79,.08)":r.ratio>0.5?"background:rgba(201,168,32,.08)":"background:rgba(231,76,60,.08)";
    const tr=document.createElement("tr");
    tr.style.cssText=bg;
    tr.innerHTML=`<td>${r.stage}</td><td style="font-size:12px">${r.tech}</td><td><span class="chip" style="background:var(--accent-lt);color:var(--accent)">${r.tier}</span></td><td class="td-num">${r.capexM.toFixed(2)}</td><td class="td-num">${r.npvM.toFixed(2)}</td><td class="td-num" style="${r.ratio>0?"color:var(--green)":"color:var(--red)"}">${r.ratio.toFixed(2)}x</td><td>${star}</td>`;
    optTbody.appendChild(tr);
  });
}

function renderEEA(){
  if(document.getElementById("weiChart").children.length>0)return;
  const maxWei=50,thresh=(20/maxWei)*100;
  WEI_DATA.forEach(d=>{
    const row=document.createElement("div");row.className="wei-row";
    const barPct=(d.wei/maxWei)*100;const col=LEV_COL[d.level];
    row.innerHTML=`<span class="wei-country">${d.country}</span><div class="wei-bwrap"><div class="wei-thresh" style="left:${thresh}%"></div><div class="wei-bar" style="width:${barPct}%;background:${col}"></div></div><span class="wei-val">${d.wei.toFixed(1)}%</span>`;
    document.getElementById("weiChart").appendChild(row);
  });
  const eeaTbody=document.getElementById("eeaTbody");
  WEI_DATA.forEach(d=>{
    const tr=document.createElement("tr");
    const col=LEV_COL[d.level],bg=LEV_BG[d.level];
    tr.innerHTML=`<td>${d.country}</td><td class="td-num">${d.wei.toFixed(1)}%</td><td><span class="chip" style="color:${col};background:${bg}">${d.level}</span></td><td style="color:var(--ink-2);font-size:11.5px">${d.pressure}</td>`;
    eeaTbody.appendChild(tr);
  });
  const canvas=document.getElementById("sectorCanvas");
  const ctx=canvas.getContext("2d");
  const cx=canvas.width/2,cy=canvas.height/2,r=70,hole=44;
  let start=-Math.PI/2;
  SECTORS.forEach(s=>{const a=(s.pct/100)*2*Math.PI;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,start+a);ctx.closePath();ctx.fillStyle=s.color;ctx.fill();start+=a;});
  ctx.beginPath();ctx.arc(cx,cy,hole,0,2*Math.PI);ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--surface").trim()||"#fff";ctx.fill();
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"#0D1E2D";
  ctx.font="bold 18px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("EU",cx,cy-8);
  ctx.font="10px system-ui";ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";ctx.fillText("by sector",cx,cy+10);
  const slist=document.getElementById("sectorList");
  SECTORS.forEach(s=>{const row=document.createElement("div");row.className="sector-row";row.innerHTML=`<div class="sector-dot" style="background:${s.color}"></div><span>${s.label}</span><span class="sector-pct">${s.pct}%</span>`;slist.appendChild(row);});
}

// ── ASM1 Kinetics renderer ─────────────────────────────────────────────────────

// ASM1 parameter set (Henze et al., 2000)
const ASM1 = {
  Y_H:0.67,  // yield coefficient (g VSS/g COD)
  b_H:0.062, // endogenous respiration (d⁻¹) at 20°C
  mu_max:6.0,// max growth rate heterotrophs (d⁻¹) at 20°C
  K_S:20.0,  // half-saturation COD (mg/L)
  Y_N:0.24,  // yield nitrifiers (g VSS/g NH4-N)
  mu_N:0.75, // max growth rate nitrifiers (d⁻¹) at 20°C
  b_N:0.05,  // endogenous nitrifiers (d⁻¹)
  K_NH:1.0,  // half-saturation NH4 (mg/L)
  i_VSS:1.42,// O2 demand for endogenous respiration factor
  i_N:0.086, // N content of biomass (g N/g VSS)
};

function asmTempCorr(rate, T){
  // Arrhenius theta = 1.07 for most ASM1 rates
  return rate * Math.pow(1.07, T - 20);
}

function renderKinetics(){
  const SRT  = +document.getElementById("asmSRT").value;
  const S0   = +document.getElementById("asmCOD").value;
  const TKN  = +document.getElementById("asmTKN").value;
  const T    = +document.getElementById("asmTemp").value;
  const Q    = state.total_inlet_flow; // m³/h
  const Qd   = Q * 24;                 // m³/d

  const mu_H = asmTempCorr(ASM1.mu_max, T);
  const b_H  = asmTempCorr(ASM1.b_H, T);

  // Effluent substrate (steady-state)
  const Se = ASM1.K_S * (1 + b_H * SRT) / (SRT * (mu_H - b_H) - 1);

  // Net sludge production (kg VSS/d)
  const Px_VSS = ASM1.Y_H * Qd * (S0 - Math.max(Se,0)) / 1000 / (1 + b_H * SRT);
  const Px_TSS = Px_VSS / 0.8; // VSS/TSS = 0.8 assumed

  // Oxygen demand (kg O2/d)
  const OUR = Qd * (S0 - Math.max(Se,0)) / 1000 * (1 - ASM1.i_VSS * ASM1.Y_H / (1 + b_H * SRT));
  // Add nitrification O2 demand (4.57 g O2/g NH4-N oxidized)
  const OUR_N = Qd * TKN / 1000 * 4.57 * 0.8; // assume 80% nitrification

  // Sludge volume in aeration tank (assuming 3500 mg/L MLSS)
  const MLSS = 3500; // mg/L
  const V_tank = (Px_TSS * 1000 * SRT) / (MLSS * 1); // m³ (HRT ≈ 1d assumed)

  document.getElementById("ak1").innerHTML=Math.max(Se,0).toFixed(1)+"<span class='kpi-unit'> mg/L COD</span>";
  document.getElementById("ak2").innerHTML=(Px_TSS*1000/1e6).toFixed(2)+"<span class='kpi-unit'>M kg/d</span>";
  document.getElementById("ak3").innerHTML=((OUR+OUR_N)/1000).toFixed(1)+"<span class='kpi-unit'> t O₂/d</span>";
  document.getElementById("ak4").innerHTML=(V_tank/1000).toFixed(1)+"<span class='kpi-unit'> ML</span>";

  // SRT vs effluent COD curve
  const srtArr = Array.from({length:28},(_,i)=>i+3);
  const seArr  = srtArr.map(s=>{
    const d = s*(mu_H-b_H)-1;
    return d<=0?9999:Math.max(0, ASM1.K_S*(1+b_H*s)/d);
  });
  setTimeout(()=>drawKineticCurve("asmSRTCanvas",srtArr,seArr,SRT,Se),50);

  // Parameter table
  const tbody=document.getElementById("asmParamTbody");tbody.innerHTML="";
  const params=[
    ["Maximum growth rate","μ_max",mu_H.toFixed(3),"d⁻¹","Henze (2000) + T-correction"],
    ["Yield coefficient","Y_H",ASM1.Y_H,"g VSS/g COD","Default ASM1"],
    ["Endogenous decay","b_H",b_H.toFixed(4),"d⁻¹","T-corrected"],
    ["Half-saturation","K_S",ASM1.K_S,"mg COD/L","Default ASM1"],
    ["Sludge age (SRT)","θ_c",SRT,"days","User input"],
    ["Effluent COD","S_e",Math.max(Se,0).toFixed(2),"mg/L","Calculated"],
    ["Net sludge prod.","P_x",(Px_VSS).toFixed(1),"kg VSS/d","Calculated"],
    ["O₂ demand","OUR",(OUR+OUR_N).toFixed(1),"kg O₂/d","Calculated"],
    ["Reactor volume","V",V_tank.toFixed(0),"m³","MLSS=3500 mg/L"],
  ];
  params.forEach(([n,sym,val,unit,src])=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${n}</td><td style="font-family:serif;color:var(--accent)">${sym}</td><td class="td-num"><strong>${val}</strong></td><td style="color:var(--ink-3)">${unit}</td><td style="color:var(--ink-3);font-size:11px">${src}</td>`;
    tbody.appendChild(tr);
  });
}

function drawKineticCurve(canvasId, srtArr, seArr, curSRT, curSe){
  const c=setupCanvas(canvasId);if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=60,pR=20,pT=28,pB=48;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const style=getComputedStyle(document.documentElement);
  const ink3=style.getPropertyValue("--ink-3").trim()||"#6A8598";
  const ink2=style.getPropertyValue("--ink-2").trim()||"#3B566A";
  const ink=style.getPropertyValue("--ink").trim()||"#0D1E2D";

  const visArr=seArr.filter(v=>v<500);
  const minX=srtArr[0],maxX=srtArr[srtArr.length-1];
  const maxY=Math.min(Math.max(...visArr)*1.1,200);
  const toX=srt=>pL+(srt-minX)/(maxX-minX)*cW;
  const toY=se=>pT+cH-Math.min(se/maxY,1)*cH;

  const nT=5;
  for(let i=0;i<=nT;i++){
    const v=maxY/nT*i;const y=toY(v);
    ctx.strokeStyle="rgba(128,128,128,0.15)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="right";
    ctx.fillText(v.toFixed(0),pL-4,y+4);
  }
  for(let s=5;s<=maxX;s+=5){
    const x=toX(s);
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";
    ctx.fillText(s,x,H-pB+16);
  }

  ctx.strokeStyle="#e74c3c";ctx.lineWidth=2;
  ctx.beginPath();
  srtArr.forEach((s,i)=>{
    if(seArr[i]>maxY)return;
    i===0?ctx.moveTo(toX(s),toY(seArr[i])):ctx.lineTo(toX(s),toY(seArr[i]));
  });
  ctx.stroke();

  // EU limit line at 100 mg/L COD
  const limitY=toY(100);
  ctx.strokeStyle="#f39c12";ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(pL,limitY);ctx.lineTo(W-pR,limitY);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle="#f39c12";ctx.font="10px system-ui";ctx.textAlign="left";
  ctx.fillText("EU limit 100 mg/L",pL+4,limitY-4);

  // Current SRT marker
  if(curSe<maxY){
    const cx2=toX(curSRT),cy2=toY(curSe);
    ctx.fillStyle="#2ea44f";ctx.beginPath();ctx.arc(cx2,cy2,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=ink2;ctx.font="bold 10px system-ui";ctx.textAlign="left";
    ctx.fillText(`SRT=${curSRT}d → Se=${curSe.toFixed(1)}mg/L`,cx2+8,cy2);
  }

  ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";
  ctx.fillText("Sludge Retention Time (days)",pL+cW/2,H-pB+30);
  ctx.save();ctx.rotate(-Math.PI/2);ctx.textAlign="center";
  ctx.fillText("Effluent COD (mg/L)",-(pT+cH/2),14);ctx.restore();
}

// ── Carbon footprint renderer ──────────────────────────────────────────────────

function computeCarbon(){
  const gridFactor = +document.getElementById("cfGrid").value||0.295;
  const TKN        = +document.getElementById("cfTKN").value||40;
  const sludgeFact = +document.getElementById("cfSludge").value||0.36;
  const tx=treatmentCapexOpex();
  const Q_m3_yr=state.total_inlet_flow*state.operating_hours;

  // Scope 1 — direct process emissions
  // N2O from aerobic biological treatment (IPCC 2019 default: 0.016 kg N2O-N/kg TN-influent)
  const N_kg_yr = Q_m3_yr * TKN / 1e6 * 1000; // kg TN/yr
  const n2o_kg = N_kg_yr * 0.016;              // kg N2O-N/yr → kg N2O
  const n2o_co2e = n2o_kg * (44/28) * 265;    // GWP100 = 265

  // CH4 from anaerobic/primary treatment (IPCC: 0.0054 kg CH4/kg BOD handled, offset if captured)
  const isAnMBR = state.selected_treatments["Secondary Treatment"]==="AnMBR (Anaerobic MBR)";
  const cod_kg_yr = Q_m3_yr * 500 / 1e6 * 1000; // kg COD/yr (default 500 mg/L)
  const ch4_raw = cod_kg_yr * 0.0054;           // kg CH4/yr
  const ch4_captured = isAnMBR ? 0.7 : 0;       // 70% captured if AnMBR
  const ch4_emitted = ch4_raw * (1 - ch4_captured);
  const ch4_co2e = ch4_emitted * 28;             // GWP100 = 28

  const scope1 = n2o_co2e + ch4_co2e;

  // Scope 2 — electricity
  const energyKwh = tx.total_energy_kwh_yr;
  const scope2 = energyKwh * gridFactor;

  // Scope 3 — chemicals + sludge
  // Sludge: estimate from Y_H and operating data
  const SRT=12,bH=0.062,Y_H=0.67;
  const Qd=state.total_inlet_flow*24;
  const S0=500,Se=Math.max(0,ASM1.K_S*(1+bH*SRT)/(SRT*(asmTempCorr(ASM1.mu_max,20)-bH)-1));
  const Px_VSS_d=Y_H*Qd*(S0-Se)/1000/(1+bH*SRT);
  const sludge_DS_kg_yr=Px_VSS_d*365/0.8; // VSS→TSS
  const scope3_sludge = sludge_DS_kg_yr * sludgeFact;
  // Chemicals (coagulant): approx 5 mg/L dose × flow
  const coagulant_kg_yr=Q_m3_yr*5/1e6*1000;
  const scope3_chem = coagulant_kg_yr * 0.5; // 0.5 kg CO2e/kg FeCl3 (approx)

  const scope3 = scope3_sludge + scope3_chem;
  const total = scope1 + scope2 + scope3;

  return{scope1,scope2,scope3,total,
    n2o_co2e,ch4_co2e,energyKwh,scope2,scope3_sludge,scope3_chem,
    gridFactor,isAnMBR,Q_m3_yr,TKN};
}

function renderCarbon(){
  const cf=computeCarbon();
  const fmt=v=>(v/1000).toFixed(1);
  document.getElementById("cf1").innerHTML=fmt(cf.scope1)+"<span class='kpi-unit'> kt CO₂e</span>";
  document.getElementById("cf2").innerHTML=fmt(cf.scope2)+"<span class='kpi-unit'> kt CO₂e</span>";
  document.getElementById("cf3").innerHTML=fmt(cf.scope3)+"<span class='kpi-unit'> kt CO₂e</span>";
  document.getElementById("cf4").innerHTML=fmt(cf.total)+"<span class='kpi-unit'> kt CO₂e/yr</span>";

  const rows=[
    ["N₂O — aerobic biological treatment","1",cf.n2o_co2e],
    ["CH₄ — anaerobic / fugitive"+(cf.isAnMBR?" (70% captured)":""),"1",cf.ch4_co2e],
    ["Electricity — treatment energy","2",cf.scope2],
    ["Sludge disposal / transport","3",cf.scope3_sludge],
    ["Chemical consumption (coagulants)","3",cf.scope3_chem],
  ];
  const tbody=document.getElementById("cfTbody");tbody.innerHTML="";
  rows.forEach(([name,scope,val])=>{
    const pct=cf.total>0?(val/cf.total*100):0;
    const scopeCol=scope==="1"?"var(--red)":scope==="2"?"var(--s2)":"var(--s3)";
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${name}</td><td><span class="chip" style="background:${scopeCol}22;color:${scopeCol}">Scope ${scope}</span></td><td class="td-num">${(val/1000).toFixed(2)} kt</td><td class="td-num">${pct.toFixed(1)}%</td>`;
    tbody.appendChild(tr);
  });

  setTimeout(()=>{
    drawCarbonDonut("cfDonut",cf);
    // Bar: compare scenarios by scope (values in kt CO2e)
    drawGroupedBar("cfBarCanvas",["Conservative","Standard (current)","Advanced"],[
      {name:"Scope 1",values:[cf.scope1*1.4/1000,cf.scope1/1000,cf.scope1*0.6/1000],color:"#e74c3c"},
      {name:"Scope 2",values:[cf.scope2*1.6/1000,cf.scope2/1000,cf.scope2*0.5/1000],color:"#e67e22"},
      {name:"Scope 3",values:[cf.scope3*1.2/1000,cf.scope3/1000,cf.scope3*0.9/1000],color:"#f1c40f"},
    ],v=>v.toFixed(1)+" kt");
  },50);
}

function drawCarbonDonut(canvasId,cf){
  const c=setupCanvas(canvasId);if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  ctx.clearRect(0,0,W,H);
  const segs=[
    {val:cf.scope1,col:"#e74c3c",lbl:"Scope 1"},
    {val:cf.scope2,col:"#e67e22",lbl:"Scope 2"},
    {val:cf.scope3,col:"#f1c40f",lbl:"Scope 3"},
  ];
  const total=segs.reduce((s,x)=>s+x.val,0)||1;
  const cx=W/2,cy=H*0.45,r=Math.min(cx,cy)*0.75,hole=r*0.55;
  let start=-Math.PI/2;
  segs.forEach(s=>{
    const a=(s.val/total)*2*Math.PI;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,start+a);ctx.closePath();
    ctx.fillStyle=s.col;ctx.fill();
    start+=a;
  });
  const surf=getComputedStyle(document.documentElement).getPropertyValue("--surface").trim()||"#fff";
  const ink=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"#0D1E2D";
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";
  ctx.beginPath();ctx.arc(cx,cy,hole,0,2*Math.PI);ctx.fillStyle=surf;ctx.fill();
  ctx.fillStyle=ink;ctx.font="bold 13px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText((total/1000).toFixed(1)+"kt",cx,cy-8);
  ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.fillText("CO₂e/yr",cx,cy+8);
  let lx=4;
  segs.forEach(s=>{
    ctx.fillStyle=s.col;ctx.fillRect(lx,H-22,12,12);
    ctx.fillStyle=ink3;ctx.font="11px system-ui";ctx.textAlign="left";ctx.textBaseline="middle";
    ctx.fillText(s.lbl,lx+16,H-16);
    lx+=80;
  });
}

// ── Flood & Rainfall renderer ──────────────────────────────────────────────────

let floodData=null,rainData=null;

async function fetchFloodData(){
  const lat=document.getElementById("floodLat").value||53.08;
  const lon=document.getElementById("floodLon").value||8.80;
  document.getElementById("floodBanner").textContent="Fetching live data from Open-Meteo GloFAS API…";
  try{
    const [fr,rr]=await Promise.all([
      fetch(`https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge&forecast_days=92&past_days=92`).then(r=>r.json()),
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,rain_sum&forecast_days=16&past_days=92&timezone=auto`).then(r=>r.json()),
    ]);
    floodData=fr;rainData=rr;
    document.getElementById("floodBanner").textContent=`Live data loaded: ${fr.daily?.time?.length||0} days of river discharge + ${rr.daily?.time?.length||0} days of rainfall data for lat ${lat}, lon ${lon}.`;
    renderFloodCharts();
  }catch(e){
    document.getElementById("floodBanner").textContent="Could not fetch live data. Please check your internet connection. Showing demo data.";
    renderFloodDemo();
  }
}

function renderFloodCharts(){
  if(!floodData||!rainData){fetchFloodData();return;}
  const discharge=floodData.daily?.river_discharge||[];
  const times=floodData.daily?.time||[];
  const precip=rainData.daily?.precipitation_sum||[];
  const ptimes=rainData.daily?.time||[];
  const thresh=+document.getElementById("floodThresh").value||350;

  const maxQ=Math.max(...discharge.filter(Number.isFinite))||0;
  const avgP=(precip.filter(Number.isFinite).reduce((s,v)=>s+v,0)/Math.max(precip.length,1)).toFixed(1);
  const highDays=discharge.filter(v=>v>=thresh).length;

  document.getElementById("fk1").innerHTML=maxQ.toFixed(0)+"<span class='kpi-unit'> m³/s</span>";
  document.getElementById("fk2").innerHTML=avgP+"<span class='kpi-unit'> mm/d</span>";
  document.getElementById("fk3").innerHTML=highDays+"<span class='kpi-unit'> days</span>";
  document.getElementById("fk4").innerHTML=(times.length||0)+"<span class='kpi-unit'> days</span>";

  setTimeout(()=>{
    drawFloodLine("floodCanvas",times,discharge,thresh);
    drawRainBars("rainCanvas",ptimes,precip);
    renderFloodRiskTable(discharge,thresh);
  },50);
}

function renderFloodDemo(){
  // Generate plausible demo data for Bremen / Weser
  const n=180;
  const times=Array.from({length:n},(_,i)=>{const d=new Date();d.setDate(d.getDate()-n+i);return d.toISOString().slice(0,10);});
  const discharge=times.map((_,i)=>150+Math.sin(i/20)*80+Math.random()*60+Math.max(0,Math.sin(i/7)*30));
  const precip=times.map(()=>Math.max(0,Math.random()*12-2));
  const thresh=+document.getElementById("floodThresh").value||350;
  floodData={daily:{time:times,river_discharge:discharge}};
  rainData={daily:{time:times,precipitation_sum:precip}};
  renderFloodCharts();
}

function drawFloodLine(canvasId,times,discharge,thresh){
  const c=setupCanvas(canvasId);if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=60,pR=20,pT=28,pB=40;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";

  const valid=discharge.filter(Number.isFinite);
  const minV=0,maxV=Math.max(thresh*1.2,...valid)||100;
  const toX=i=>pL+(i/(times.length-1||1))*cW;
  const toY=v=>pT+cH-((v-minV)/(maxV-minV))*cH;

  [0,0.25,0.5,0.75,1].forEach((f,i)=>{
    const v=maxV*f;const y=toY(v);
    ctx.strokeStyle="rgba(128,128,128,0.15)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="right";
    ctx.fillText(v.toFixed(0),pL-4,y+4);
  });

  // Threshold
  const ty=toY(thresh);
  ctx.strokeStyle="rgba(220,50,50,0.5)";ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(pL,ty);ctx.lineTo(W-pR,ty);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle="rgba(220,50,50,0.7)";ctx.font="10px system-ui";ctx.textAlign="left";
  ctx.fillText("Design threshold "+thresh+" m³/s",pL+4,ty-4);

  // Area above threshold (red fill)
  ctx.fillStyle="rgba(231,76,60,0.12)";
  ctx.fillRect(pL,pT,cW,ty-pT);

  // Discharge line
  ctx.strokeStyle="#4a90d9";ctx.lineWidth=1.5;ctx.setLineDash([]);
  ctx.beginPath();
  discharge.forEach((v,i)=>{
    if(!Number.isFinite(v))return;
    i===0?ctx.moveTo(toX(i),toY(v)):ctx.lineTo(toX(i),toY(v));
  });
  ctx.stroke();

  // X axis labels
  const step=Math.max(1,Math.floor(times.length/8));
  times.forEach((t,i)=>{
    if(i%step===0){
      ctx.fillStyle=ink3;ctx.font="9px system-ui";ctx.textAlign="center";
      ctx.fillText(t.slice(5),toX(i),H-pB+14);
    }
  });
  ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="left";
  ctx.fillText("River discharge (m³/s) — Weser at Bremen",pL,pT-8);
}

function drawRainBars(canvasId,times,precip){
  const c=setupCanvas(canvasId);if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=60,pR=20,pT=24,pB=40;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";
  const maxV=Math.max(20,...precip.filter(Number.isFinite))||20;
  const toX=i=>pL+(i/(times.length||1))*cW;
  const toY=v=>pT+cH-((v/maxV)*cH);
  const bW=Math.max(1,(cW/times.length)-1);
  precip.forEach((v,i)=>{
    if(!Number.isFinite(v))return;
    ctx.fillStyle=v>10?"#3a9cb4":"#7dc3d6";
    ctx.fillRect(toX(i),toY(v),bW,cH-(toY(v)-pT));
  });
  [0,0.5,1].forEach(f=>{
    const v=maxV*f;const y=toY(v);
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="right";
    ctx.fillText(v.toFixed(0),pL-4,y+4);
  });
  const step=Math.max(1,Math.floor(times.length/8));
  times.forEach((t,i)=>{
    if(i%step===0){ctx.fillStyle=ink3;ctx.font="9px system-ui";ctx.textAlign="center";ctx.fillText(t.slice(5),toX(i)+bW/2,H-pB+14);}
  });
  ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="left";ctx.fillText("Precipitation (mm/d)",pL,pT-6);
}

function renderFloodRiskTable(discharge,thresh){
  const above=discharge.filter(v=>Number.isFinite(v)&&v>=thresh);
  const pct=((above.length/(discharge.length||1))*100).toFixed(1);
  const maxQ=Math.max(...discharge.filter(Number.isFinite),0).toFixed(0);
  const risks=maxQ>thresh*1.5?"Extreme":maxQ>thresh?"High":maxQ>thresh*0.8?"Moderate":"Low";
  const col=risks==="Extreme"?"var(--red)":risks==="High"?"var(--s2)":risks==="Moderate"?"var(--s3)":"var(--green)";
  document.getElementById("floodRiskTable").innerHTML=`
    <div class="tbl-wrap"><table class="dt"><thead><tr><th>Risk Factor</th><th>Assessment</th><th>Value</th></tr></thead>
    <tbody>
      <tr><td>Peak discharge vs design threshold</td><td><span class="chip" style="color:${col};background:${col}22">${risks}</span></td><td class="td-num">${maxQ} / ${thresh} m³/s</td></tr>
      <tr><td>Days above design threshold</td><td>Exceedance frequency</td><td class="td-num">${above.length} days (${pct}%)</td></tr>
      <tr><td>Treatment plant resilience</td><td>Recommended action</td><td style="color:var(--ink-2);font-size:12px">${risks==="Low"?"Normal operation":"Review inflow control & bypass capacity"}</td></tr>
    </tbody></table></div>`;
}

// ── Site Intelligence renderer ─────────────────────────────────────────────────

let leafletMap=null;

const SITE_UNITS=[
  {name:"Purification",fn:"Water supply & recycling",lat:53.0810,lon:8.7830},
  {name:"Blast Furnace",fn:"Primary steelmaking",lat:53.0795,lon:8.7800},
  {name:"Converter",fn:"Basic oxygen steelmaking",lat:53.0785,lon:8.7820},
  {name:"CRM",fn:"Cold rolling mill",lat:53.0780,lon:8.7850},
  {name:"WWT (site)",fn:"Wastewater treatment plant",lat:53.0800,lon:8.7870},
  {name:"Sinter Plant",fn:"Iron ore sintering",lat:53.0820,lon:8.7810},
];

function renderSite(){
  const lat=+document.getElementById("siteLat").value||53.0795;
  const lon=+document.getElementById("siteLon").value||8.7815;
  if(!leafletMap){
    leafletMap=L.map("siteMap").setView([lat,lon],15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:18,
    }).addTo(leafletMap);
    SITE_UNITS.forEach(u=>{
      L.circleMarker([u.lat,u.lon],{radius:8,color:"#1D7A8C",fillColor:"#DDF0F5",fillOpacity:0.9,weight:2})
        .bindPopup(`<strong>${u.name}</strong><br>${u.fn}`)
        .addTo(leafletMap);
    });
    L.circle([lat,lon],{color:"#3b9eff",fillColor:"#3b9eff",fillOpacity:0.08,radius:600}).addTo(leafletMap);
  } else {
    leafletMap.setView([lat,lon],15);
  }
  // Force map to resize after showing
  setTimeout(()=>{if(leafletMap)leafletMap.invalidateSize();},100);

  const tbody=document.getElementById("siteUnitTbody");tbody.innerHTML="";
  Object.entries(state.processes).forEach(([name,p])=>{
    const u=SITE_UNITS.find(x=>x.name===name);
    const status=p.leakage>50?"<span class='chip' style='background:rgba(231,76,60,.1);color:var(--red)'>High Loss</span>":p.leakage>0?"<span class='chip' style='background:rgba(212,118,42,.1);color:var(--s2)'>Normal</span>":"<span class='chip' style='background:rgba(46,164,79,.1);color:var(--green)'>Balanced</span>";
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${name}</strong>${u?` <span style="font-size:10px;color:var(--ink-3)">(mapped)</span>`:""}</td><td style="color:var(--ink-3);font-size:12px">${u?.fn||"Process unit"}</td><td class="td-num">${p.flow_in.toFixed(1)}</td><td class="td-num">${p.flow_out.toFixed(1)}</td><td>${status}</td>`;
    tbody.appendChild(tr);
  });
}

function updateSiteMap(){
  const lat=+document.getElementById("siteLat").value;
  const lon=+document.getElementById("siteLon").value;
  if(leafletMap)leafletMap.setView([lat,lon],15);
}

function updateSiteInfo(){
  state.company_name=document.getElementById("siteCompName").value;
}

// ── Scenario comparison renderer ───────────────────────────────────────────────

const SCENARIOS={
  Conservative:{
    label:"Conservative",color:"#6A8598",recycleRate:20,horizon:5,
    treatments:{"Pre-treatment":"Mechanical Screening & Grit Removal","Primary Treatment":"Sedimentation","Secondary Treatment":"Activated Sludge (CAS)","Tertiary Treatment":"NF / RO","Concentrate Management":"Brine Concentration (Membrane)","ZLD (Zero Liquid Discharge)":"None (no ZLD)"},
  },
  Standard:{
    label:"Standard",color:"#1D7A8C",recycleRate:70,horizon:5,
    treatments:{"Pre-treatment":"Ultrafiltration (UF)","Primary Treatment":"DAF (Dissolved Air Flotation)","Secondary Treatment":"AnMBR (Anaerobic MBR)","Tertiary Treatment":"Ion Exchange / Electrodialysis","Concentrate Management":"MEE / Thermal Evaporation (MVR)","ZLD (Zero Liquid Discharge)":"None (no ZLD)"},
  },
  Advanced:{
    label:"Advanced",color:"#2ea44f",recycleRate:90,horizon:5,
    treatments:{"Pre-treatment":"Ultrafiltration (UF)","Primary Treatment":"MBR (Primary)","Secondary Treatment":"AnMBR (Anaerobic MBR)","Tertiary Treatment":"NF / RO","Concentrate Management":"MEE / Thermal Evaporation (MVR)","ZLD (Zero Liquid Discharge)":"BrineX Pre-Concentration Stages"},
  },
};

function calcScenario(sc){
  const saved={sel:state.selected_treatments,rec:state.target_recycle_pct};
  state.selected_treatments=sc.treatments;
  state.target_recycle_pct=sc.recycleRate;
  const costs=annualWaterCosts();
  const tx=treatmentCapexOpex();
  const mat=materialRecoveryRevenue();
  const matRev=Object.values(mat).reduce((s,v)=>s+v.rev_eur_yr,0);
  const isAnMBR=sc.treatments["Secondary Treatment"]==="AnMBR (Anaerobic MBR)";
  const energySav=isAnMBR?Math.abs(TX["Secondary Treatment"]["AnMBR (Anaerobic MBR)"].energy)*state.total_inlet_flow*state.operating_hours*state.electricity_cost_eur_kwh:0;
  const bridge=ebitdaBridge(costs,sc.recycleRate,tx.total_opex_eur_yr,matRev,energySav);
  const capexSched=phaseCapex(tx.total_capex_eur,sc.horizon,"front-loaded");
  const npvVal=npvCalc(capexSched,bridge.net_improvement,0,state.discount_rate_pct);
  const irrVal=irrCalc(capexSched,bridge.net_improvement,0);
  const pb=simplePayback(tx.total_capex_eur,bridge.net_improvement);
  // Rough carbon
  const energyKwh=tx.total_energy_kwh_yr;
  const carbon_tco2e=(energyKwh*0.295+state.total_inlet_flow*state.operating_hours*40/1e6*1000*0.016*(44/28)*265)/1000;
  state.selected_treatments=saved.sel;state.target_recycle_pct=saved.rec;
  return{capex:tx.total_capex_eur,opex:tx.total_opex_eur_yr,ebitda:bridge.net_improvement,npv:npvVal,irr:irrVal,pb,carbon:carbon_tco2e,recycleRate:sc.recycleRate};
}

function renderCompare(){
  const results=Object.fromEntries(Object.entries(SCENARIOS).map(([k,sc])=>[k,calcScenario(sc)]));
  const keys=Object.keys(SCENARIOS);

  // KPI strip — best scenario for each metric
  const bestEBITDA=keys.reduce((a,b)=>results[a].ebitda>results[b].ebitda?a:b);
  const kpis=document.getElementById("compareKpis");
  kpis.innerHTML=keys.map(k=>{
    const r=results[k];const sc=SCENARIOS[k];
    const isBest=k===bestEBITDA;
    return`<div class="kpi" style="${isBest?"border-color:var(--green);":""}">`+
      `<div class="kpi-stripe" style="background:${sc.color}"></div>`+
      `<div class="kpi-val">${fmtM(r.ebitda)}<span class="kpi-unit">/yr</span></div>`+
      `<div class="kpi-lbl">${sc.label} — EBITDA${isBest?" ★":""}</div></div>`;
  }).join("");

  setTimeout(()=>{
    // Values in raw EUR so fmtM formats them correctly
    drawGroupedBar("compareBarCanvas",["CAPEX","OPEX/yr","EBITDA/yr","NPV"],
      keys.map(k=>({name:SCENARIOS[k].label,values:[results[k].capex,results[k].opex,results[k].ebitda,results[k].npv],color:SCENARIOS[k].color}))
    );
  },50);

  const metrics=[
    ["Annual Water Cost",k=>fmtM(annualWaterCosts().total_cost_eur_yr)],
    ["CAPEX Estimate",k=>fmtM(results[k].capex)],
    ["Annual OPEX",k=>fmtM(results[k].opex)+"/yr"],
    ["Net EBITDA Improvement",k=>fmtM(results[k].ebitda)+"/yr"],
    ["NPV (20yr, 8%)",k=>fmtM(results[k].npv)],
    ["IRR",k=>(results[k].irr<999?results[k].irr.toFixed(1):"N/A")+"%"],
    ["Simple Payback",k=>(isFinite(results[k].pb)&&results[k].pb<50?results[k].pb.toFixed(1)+" yrs":">50 yrs")],
    ["Target Recycling Rate",k=>SCENARIOS[k].recycleRate+"%"],
    ["Carbon Footprint (approx)",k=>(results[k].carbon).toFixed(0)+" kt CO₂e/yr"],
  ];
  const tbody=document.getElementById("compareTbody");tbody.innerHTML="";
  metrics.forEach(([lbl,fn])=>{
    const tr=document.createElement("tr");
    const cons=fn("Conservative"),std=fn("Standard"),adv=fn("Advanced");
    tr.innerHTML=`<td><strong>${lbl}</strong></td><td class="td-num">${cons}</td><td class="td-num" style="color:var(--accent)">${std}</td><td class="td-num" style="color:var(--green)">${adv}</td>`;
    tbody.appendChild(tr);
  });

  const techTbody=document.getElementById("compareTechTbody");techTbody.innerHTML="";
  Object.keys(TX).forEach(stage=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${stage}</strong></td>`+
      keys.map(k=>`<td style="font-size:12px;color:var(--ink-2)">${SCENARIOS[k].treatments[stage]||"–"}</td>`).join("");
    techTbody.appendChild(tr);
  });
}

// ── Results & Trends renderer ─────────────────────────────────────────────────

let savedScenarios=[];

async function saveScenario(){
  const name=document.getElementById("scenarioName").value||`Scenario ${new Date().toLocaleDateString()}`;
  const costs=annualWaterCosts();
  const tx=treatmentCapexOpex();
  const mat=materialRecoveryRevenue();
  const matRev=Object.values(mat).reduce((s,v)=>s+v.rev_eur_yr,0);
  const bridge=ebitdaBridge(costs,state.target_recycle_pct,tx.total_opex_eur_yr,matRev,0);
  const cf=computeCarbon();
  const payload={
    name,
    scenario_data:{treatments:state.selected_treatments,target_recycle_pct:state.target_recycle_pct,water_cost:state.water_cost_eur_m3,discharge_cost:state.discharge_cost_eur_m3},
    results:{ebitda_m:bridge.net_improvement/1e6,capex_m:tx.total_capex_eur/1e6,opex_m:tx.total_opex_eur_yr/1e6,carbon_kt:cf.total/1000,recycling_pct:state.target_recycle_pct},
  };
  try{
    const r=await fetch("/api/neptune/save-scenario",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const d=await r.json();
    const banner=document.getElementById("trendsBanner");
    banner.style.display="block";
    if(d.ok){banner.textContent="Scenario saved successfully.";loadTrends();}
    else banner.textContent="Error saving: "+(d.error||"unknown");
  }catch(e){
    document.getElementById("trendsBanner").style.display="block";
    document.getElementById("trendsBanner").textContent="Could not reach server: "+e.message;
  }
}

async function loadTrends(){
  try{
    const r=await fetch("/api/neptune/scenarios");
    const d=await r.json();
    if(d.scenarios){savedScenarios=d.scenarios;renderTrends();}
  }catch{}
}

function renderTrends(){
  loadTrends();
  if(!savedScenarios.length){
    document.getElementById("tr1").textContent="0";
    document.getElementById("tr2").textContent="–";
    document.getElementById("tr3").textContent="–";
    document.getElementById("tr4").textContent="–";
    document.getElementById("trendsTbody").innerHTML=`<tr><td colspan="7" style="text-align:center;color:var(--ink-3);padding:24px">No saved scenarios yet — configure your settings and click Save Current Scenario</td></tr>`;
    return;
  }

  const ebitdas=savedScenarios.map(s=>s.results?.ebitda_m||0);
  const capexs=savedScenarios.map(s=>s.results?.capex_m||0);
  const carbons=savedScenarios.map(s=>s.results?.carbon_kt||0);
  const best=k=>savedScenarios.reduce((a,b)=>(b.results?.[k]||0)>(a.results?.[k]||0)?b:a,savedScenarios[0]);

  document.getElementById("tr1").textContent=savedScenarios.length;
  document.getElementById("tr2").innerHTML=fmtM((best("ebitda_m").results?.ebitda_m||0)*1e6)+"<span class='kpi-unit'>/yr</span>";
  document.getElementById("tr3").innerHTML=fmtM((savedScenarios.reduce((a,b)=>(b.results?.capex_m||99)<(a.results?.capex_m||99)?b:a,savedScenarios[0]).results?.capex_m||0)*1e6);
  document.getElementById("tr4").innerHTML=(savedScenarios.reduce((a,b)=>(b.results?.carbon_kt||99)<(a.results?.carbon_kt||99)?b:a,savedScenarios[0]).results?.carbon_kt||0).toFixed(1)+"<span class='kpi-unit'> kt</span>";

  const indices=savedScenarios.map((_,i)=>i+1);
  setTimeout(()=>{
    drawScatterLine("trendEBITDACanvas",savedScenarios.map(s=>s.created_at?.slice(0,10)||String(indices[0])),ebitdas,"EBITDA Improvement (€M/yr)","#2ea44f");
    drawScatterLine("trendCAPEXCanvas",savedScenarios.map(s=>s.created_at?.slice(0,10)||String(indices[0])),capexs,"CAPEX Estimate (€M)","#4a90d9");
    drawScatterLine("trendCarbonCanvas",savedScenarios.map(s=>s.created_at?.slice(0,10)||String(indices[0])),carbons,"Carbon Footprint (kt CO₂e)","#e74c3c");
  },50);

  const tbody=document.getElementById("trendsTbody");tbody.innerHTML="";
  savedScenarios.slice().reverse().forEach(s=>{
    const r=s.results||{};
    const t=s.scenario_data?.treatments||{};
    const active=Object.values(t).filter(x=>x&&!x.includes("None")).length;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td style="white-space:nowrap;font-size:12px">${(s.created_at||"").slice(0,10)}</td><td>${s.scenario_name||"—"}</td><td class="td-num">${(r.ebitda_m||0).toFixed(2)}</td><td class="td-num">${(r.capex_m||0).toFixed(2)}</td><td class="td-num">${(r.carbon_kt||0).toFixed(1)}</td><td class="td-num">${(r.recycling_pct||0).toFixed(0)}%</td><td style="font-size:11px;color:var(--ink-3)">${active} stages active</td>`;
    tbody.appendChild(tr);
  });
}

function drawScatterLine(canvasId,labels,vals,yLabel,color){
  const c=setupCanvas(canvasId);if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=64,pR=20,pT=24,pB=44;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";
  const ink2=getComputedStyle(document.documentElement).getPropertyValue("--ink-2").trim()||"#3B566A";

  const minV=Math.min(0,...vals),maxV=Math.max(...vals)||1;
  const range=maxV-minV||1;
  const toX=i=>pL+(i/(Math.max(vals.length-1,1)))*cW;
  const toY=v=>pT+cH-((v-minV)/range)*cH;

  [0,0.25,0.5,0.75,1].forEach(f=>{
    const v=minV+range*f;const y=toY(v);
    ctx.strokeStyle="rgba(128,128,128,0.15)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="right";
    ctx.fillText(v.toFixed(1),pL-4,y+4);
  });

  ctx.strokeStyle=color;ctx.lineWidth=2;
  ctx.beginPath();
  vals.forEach((v,i)=>{i===0?ctx.moveTo(toX(i),toY(v)):ctx.lineTo(toX(i),toY(v));});
  ctx.stroke();

  // Fill area
  ctx.fillStyle=color+"22";
  ctx.beginPath();ctx.moveTo(toX(0),toY(minV));
  vals.forEach((v,i)=>ctx.lineTo(toX(i),toY(v)));
  ctx.lineTo(toX(vals.length-1),toY(minV));ctx.closePath();ctx.fill();

  // Dots
  vals.forEach((v,i)=>{
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(toX(i),toY(v),4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=ink2;ctx.font="bold 10px system-ui";ctx.textAlign="center";
    ctx.fillText(v.toFixed(1),toX(i),toY(v)-8);
  });

  const step=Math.max(1,Math.floor(labels.length/6));
  labels.forEach((l,i)=>{
    if(i%step===0){ctx.fillStyle=ink3;ctx.font="9px system-ui";ctx.textAlign="center";ctx.fillText(l,toX(i),H-pB+14);}
  });
  ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="left";ctx.fillText(yLabel,pL,pT-8);
}

// ── SCADA Data ────────────────────────────────────────────────────────────────
// Real data from analysis.xlsx (May 2025). Apr/Jun are demo with seeded variation.

function _rng(seed){ return ()=>{ seed=(seed*9301+49297)%233280; return seed/233280; }; }

function _genMonth(label, seed, volBase, pwrBase, recBase, condBase, days){
  const r=_rng(seed);
  const vol=[], pwr=[], rec=[], cond=[];
  const mm=label.slice(0,3)==="Apr"?"04":label.slice(0,3)==="Jun"?"06":"05";
  const yr="25";
  let opH = label.slice(0,3)==="Apr" ? 140 : 545;
  for(let d=1;d<=days;d++){
    const ds=`${String(d).padStart(2,"0")}.${mm}.${yr}`;
    const on=r()>0.15; // ~85% days operating
    const v=on?+(volBase*(0.7+r()*0.6)).toFixed(1):0;
    vol.push({d:ds, vol:v, flow:on?+(9.2+r()*1.2).toFixed(1):0});
    const uKwh=on?+(pwrBase*(0.6+r()*0.9)).toFixed(1):+(r()*5).toFixed(1);
    pwr.push({d:ds, unit_kwh:uKwh, domestic_kwh:+(55+r()*10).toFixed(1)});
    if(on){
      rec.push({d:ds, rc180:+(recBase*(0.9+r()*0.2)).toFixed(1), rc280:+(Math.min(90,recBase*1.4*(0.9+r()*0.2))).toFixed(1)});
      opH+=+(8+r()*10).toFixed(1);
      cond.push({d:ds, op_h:+opH.toFixed(1), ni123:+(condBase.ni123*(0.7+r()*0.6)).toFixed(2),
        ni180:+(condBase.ni180*(0.5+r()*1.2)).toFixed(2), ni280:+(condBase.ni280*(0.5+r()*1.2)).toFixed(2)});
    }
  }
  return {label, vol, pwr, rec, cond};
}

const SCADA_DATA = {
  may25: {
    label:"May 2025",
    vol:[
      {d:"02.05.25",vol:null,flow:0},
      {d:"06.05.25",vol:32.6,flow:10.1},{d:"07.05.25",vol:37.5,flow:10.1},
      {d:"08.05.25",vol:72.8,flow:10.1},{d:"09.05.25",vol:38.2,flow:10.0},
      {d:"10.05.25",vol:102.3,flow:10.0},{d:"11.05.25",vol:34.3,flow:9.9},
      {d:"12.05.25",vol:45.3,flow:9.9},{d:"13.05.25",vol:40.4,flow:9.9},
      {d:"14.05.25",vol:47.4,flow:9.9},{d:"15.05.25",vol:87.4,flow:9.9},
      {d:"16.05.25",vol:80.1,flow:9.8},{d:"17.05.25",vol:30.9,flow:9.3},
      {d:"18.05.25",vol:0,flow:0},
      {d:"19.05.25",vol:51.3,flow:9.3},{d:"20.05.25",vol:102.1,flow:9.5},
      {d:"21.05.25",vol:39.6,flow:9.3},{d:"22.05.25",vol:18.9,flow:9.0},
      {d:"23.05.25",vol:131.7,flow:9.4},{d:"24.05.25",vol:69.6,flow:9.1},
      {d:"25.05.25",vol:25.4,flow:8.4},{d:"26.05.25",vol:44.4,flow:9.9},
      {d:"27.05.25",vol:80.3,flow:9.9},{d:"28.05.25",vol:0,flow:0},
    ],
    pwr:[
      {d:"01.05.25",unit_kwh:2.0,domestic_kwh:55.7},{d:"02.05.25",unit_kwh:0.8,domestic_kwh:24.7},
      {d:"06.05.25",unit_kwh:331.4,domestic_kwh:23.7},{d:"07.05.25",unit_kwh:412.1,domestic_kwh:60.6},
      {d:"08.05.25",unit_kwh:827.0,domestic_kwh:62.1},{d:"09.05.25",unit_kwh:531.1,domestic_kwh:61.7},
      {d:"10.05.25",unit_kwh:904.2,domestic_kwh:61.3},{d:"11.05.25",unit_kwh:354.5,domestic_kwh:61.3},
      {d:"12.05.25",unit_kwh:463.9,domestic_kwh:62.1},{d:"13.05.25",unit_kwh:542.8,domestic_kwh:61.3},
      {d:"14.05.25",unit_kwh:481.6,domestic_kwh:59.4},{d:"15.05.25",unit_kwh:749.9,domestic_kwh:60.0},
      {d:"16.05.25",unit_kwh:807.4,domestic_kwh:61.0},{d:"17.05.25",unit_kwh:350.9,domestic_kwh:60.0},
      {d:"18.05.25",unit_kwh:1.3,domestic_kwh:39.7},
      {d:"19.05.25",unit_kwh:534.3,domestic_kwh:60.0},{d:"20.05.25",unit_kwh:1104.9,domestic_kwh:59.6},
      {d:"21.05.25",unit_kwh:642.6,domestic_kwh:58.2},{d:"22.05.25",unit_kwh:249.7,domestic_kwh:38.4},
      {d:"23.05.25",unit_kwh:849.8,domestic_kwh:55.2},{d:"24.05.25",unit_kwh:639.8,domestic_kwh:55.6},
      {d:"25.05.25",unit_kwh:257.6,domestic_kwh:57.8},{d:"26.05.25",unit_kwh:398.4,domestic_kwh:57.8},
      {d:"27.05.25",unit_kwh:707.5,domestic_kwh:60.4},{d:"28.05.25",unit_kwh:1.2,domestic_kwh:37.9},
    ],
    rec:[
      {d:"06.05.25",rc180:56.9,rc280:80.3},{d:"07.05.25",rc180:57.8,rc280:83.2},
      {d:"08.05.25",rc180:58.9,rc280:86.8},{d:"09.05.25",rc180:56.7,rc280:82.9},
      {d:"10.05.25",rc180:60.0,rc280:89.2},{d:"11.05.25",rc180:55.1,rc280:79.4},
      {d:"12.05.25",rc180:60.0,rc280:88.1},{d:"13.05.25",rc180:56.8,rc280:83.2},
      {d:"14.05.25",rc180:60.0,rc280:89.9},{d:"15.05.25",rc180:58.3,rc280:85.9},
      {d:"16.05.25",rc180:56.5,rc280:81.1},{d:"17.05.25",rc180:58.9,rc280:90.0},
      {d:"19.05.25",rc180:60.0,rc280:89.9},{d:"20.05.25",rc180:60.0,rc280:89.9},
      {d:"21.05.25",rc180:53.7,rc280:75.3},{d:"22.05.25",rc180:54.3,rc280:67.0},
      {d:"23.05.25",rc180:60.0,rc280:88.2},{d:"24.05.25",rc180:57.9,rc280:84.6},
      {d:"25.05.25",rc180:60.0,rc280:89.8},{d:"26.05.25",rc180:56.6,rc280:82.5},
      {d:"27.05.25",rc180:59.5,rc280:85.5},
    ],
    cond:[
      {d:"02.05.25",op_h:247.1,ni123:0.01,ni180:56.0,ni280:28.4},
      {d:"06.05.25",op_h:255.5,ni123:16.3,ni180:69.8,ni280:15.0},
      {d:"07.05.25",op_h:265.4,ni123:9.0,ni180:54.1,ni280:43.0},
      {d:"08.05.25",op_h:284.4,ni123:16.9,ni180:58.7,ni280:16.3},
      {d:"09.05.25",op_h:294.5,ni123:10.2,ni180:93.1,ni280:84.8},
      {d:"10.05.25",op_h:318.5,ni123:18.3,ni180:57.5,ni280:6.0},
      {d:"11.05.25",op_h:326.6,ni123:7.2,ni180:24.6,ni280:34.1},
      {d:"12.05.25",op_h:337.9,ni123:9.6,ni180:33.1,ni280:16.8},
      {d:"13.05.25",op_h:348.3,ni123:14.8,ni180:342.4,ni280:329.6},
      {d:"14.05.25",op_h:360.0,ni123:12.2,ni180:534.2,ni280:515.8},
      {d:"15.05.25",op_h:380.5,ni123:17.6,ni180:62.4,ni280:6.3},
      {d:"16.05.25",op_h:400.2,ni123:16.2,ni180:48.2,ni280:13.2},
      {d:"17.05.25",op_h:407.5,ni123:10.3,ni180:27.9,ni280:35.8},
      {d:"18.05.25",op_h:407.5,ni123:0.0,ni180:17.3,ni280:22.6},
      {d:"19.05.25",op_h:420.3,ni123:17.1,ni180:53.1,ni280:6.8},
      {d:"20.05.25",op_h:444.3,ni123:18.7,ni180:42.8,ni280:5.8},
      {d:"21.05.25",op_h:454.9,ni123:13.6,ni180:295.9,ni280:286.5},
      {d:"22.05.25",op_h:460.9,ni123:11.4,ni180:46.1,ni280:23.3},
      {d:"23.05.25",op_h:491.9,ni123:19.1,ni180:95.9,ni280:8.8},
      {d:"24.05.25",op_h:508.8,ni123:16.7,ni180:62.2,ni280:7.1},
      {d:"25.05.25",op_h:515.4,ni123:13.2,ni180:28.2,ni280:16.2},
      {d:"26.05.25",op_h:526.2,ni123:14.7,ni180:44.5,ni280:13.0},
      {d:"27.05.25",op_h:545.1,ni123:17.4,ni180:58.4,ni280:19.2},
      {d:"28.05.25",op_h:545.1,ni123:0.0,ni180:12.9,ni280:39.0},
    ],
  },
  get apr25(){ return _genMonth("April 2025", 1234, 58, 500, 57, {ni123:13,ni180:55,ni280:22}, 30); },
  get jun25(){  return _genMonth("June 2025",  5678, 68, 560, 59, {ni123:15,ni180:62,ni280:18}, 30); },
};

// Process effectiveness data (RO from SCADA, others design targets)
const PROC_EFF = [
  {name:"Intake Screening",  eff:98.5, type:"design",  color:"#6A8598"},
  {name:"Cartridge Filter",  eff:96.2, type:"design",  color:"#6A8598"},
  {name:"UF Membrane",       eff:94.1, type:"design",  color:"#4a90d9"},
  {name:"Softener",          eff:89.7, type:"design",  color:"#e67e22"},
  {name:"RO-180",            eff:null, type:"scada",   color:"#1D7A8C"},  // computed from data
  {name:"RO-280",            eff:null, type:"scada",   color:"#2ea44f"},  // computed from data
  {name:"UV Disinfection",   eff:99.7, type:"design",  color:"#f39c12"},
  {name:"Carbon Post-filter",eff:97.3, type:"design",  color:"#6A8598"},
];

// ── SCADA Render ──────────────────────────────────────────────────────────────

function getSCADAMonth(){
  const sel=document.getElementById("scadaMonth")?.value||"may25";
  const d=SCADA_DATA[sel];
  return d.vol?d:{label:d.label,...d}; // trigger getter
}

function renderSCADA(){
  const m=getSCADAMonth();

  // KPIs
  const totalVol=m.vol.reduce((s,r)=>s+(r.vol||0),0);
  const totalUnit=m.pwr.reduce((s,r)=>s+r.unit_kwh,0);
  const avgRc180=m.rec.length?+(m.rec.reduce((s,r)=>s+r.rc180,0)/m.rec.length).toFixed(1):0;
  const avgRc280=m.rec.length?+(m.rec.reduce((s,r)=>s+r.rc280,0)/m.rec.length).toFixed(1):0;
  const maxOpH=m.cond.length?Math.max(...m.cond.map(r=>r.op_h)):0;
  const opDays=m.vol.filter(r=>(r.vol||0)>0).length;
  document.getElementById("scadaKpis").innerHTML=[
    {c:"var(--blue)",  v:totalVol.toFixed(0),          u:" m³",    l:"Total Volume Treated"},
    {c:"var(--s2)",    v:totalUnit.toFixed(0),          u:" kWh",   l:"Unit Energy (month)"},
    {c:"var(--accent)",v:avgRc180.toFixed(1),           u:"%",      l:"Avg RO-180 Recovery"},
    {c:"var(--green)", v:avgRc280.toFixed(1),           u:"%",      l:"Avg RO-280 Recovery"},
    {c:"var(--s3)",    v:maxOpH.toFixed(0),             u:" h",     l:"RO Operating Hours"},
    {c:"var(--ink-2)", v:opDays,                        u:" days",  l:"Operating Days"},
  ].map(k=>`<div class="kpi"><div class="kpi-stripe" style="background:${k.c}"></div><div class="kpi-val">${k.v}<span class="kpi-unit">${k.u}</span></div><div class="kpi-lbl">${k.l}</div></div>`).join("");

  // update PROC_EFF with live RO recoveries
  PROC_EFF.find(p=>p.name==="RO-180").eff=avgRc180;
  PROC_EFF.find(p=>p.name==="RO-280").eff=avgRc280;

  // Draw all charts
  setTimeout(()=>{
    drawSCADAVolume("scadaVolCanvas", m);
    drawSCADAPower("scadaPwrCanvas", m);
    drawSCADAPowerTrend("scadaPwrTrendCanvas");
    drawSCADARecovery("scadaRecCanvas", m);
    drawSCADAEffectiveness("scadaEffCanvas");
    drawSCADACond123("scadaCond123Canvas", m);
    drawSCADACondSensor("scadaCond180Canvas", m, "ni180", "NI180 Permeate (µS/cm)", "#1D7A8C");
    drawSCADACondSensor("scadaCond280Canvas", m, "ni280", "NI280 Permeate (µS/cm)", "#2ea44f");
    renderSCADATable(m);
  },50);
}

// ── SCADA Chart functions ─────────────────────────────────────────────────────

function scadaSetup(id, h){
  const c=document.getElementById(id); if(!c)return null;
  c.width=c.parentElement.clientWidth||900; c.height=h||260;
  return c;
}

function drawSCADAVolume(id, m){
  const c=scadaSetup(id); if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=60,pR=20,pT=28,pB=52;
  const cW=W-pL-pR, cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";
  const ink2=getComputedStyle(document.documentElement).getPropertyValue("--ink-2").trim()||"#3B566A";
  const data=m.vol.filter(r=>r.vol!==null);
  if(!data.length)return;
  const maxV=Math.max(...data.map(r=>r.vol||0))||1;
  const bW=(cW/data.length)*0.6;
  const toX=i=>pL+(i+0.5)*(cW/data.length);
  const toY=v=>pT+cH-(v/maxV)*cH;

  // Grid
  [0,0.25,0.5,0.75,1].forEach(f=>{
    const v=maxV*f; const y=toY(v);
    ctx.strokeStyle="rgba(128,128,128,0.12)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(W-pR,y); ctx.stroke();
    ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="right";
    ctx.fillText(v.toFixed(0),pL-4,y+4);
  });

  // Volume bars (FQ195)
  data.forEach((r,i)=>{
    const v=r.vol||0;
    ctx.fillStyle=v>80?"#1D7A8C":v>40?"#4a90d9":"#7dc3d6";
    ctx.fillRect(toX(i)-bW/2, toY(v), bW, cH-(toY(v)-pT));
  });

  // Flow rate line (FI123) on secondary axis
  const maxFlow=Math.max(...data.map(r=>r.flow||0),1);
  ctx.strokeStyle="#e67e22"; ctx.lineWidth=2;
  ctx.beginPath();
  data.forEach((r,i)=>{
    if(!r.flow){return;}
    const y=pT+cH-((r.flow/maxFlow)*cH*0.7); // 70% height scale
    i===0?ctx.moveTo(toX(i),y):ctx.lineTo(toX(i),y);
  });
  ctx.stroke();

  // X labels
  const step=Math.max(1,Math.floor(data.length/10));
  data.forEach((r,i)=>{
    if(i%step===0){
      ctx.fillStyle=ink3; ctx.font="9px system-ui"; ctx.textAlign="center";
      ctx.fillText(r.d.slice(0,5),toX(i),H-pB+14);
    }
  });

  // Legend
  ctx.fillStyle="#4a90d9"; ctx.fillRect(pL,H-pB+24,10,8);
  ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="left";
  ctx.fillText("FQ195 Daily Volume (m³/d)",pL+14,H-pB+32);
  ctx.strokeStyle="#e67e22"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(pL+150,H-pB+28); ctx.lineTo(pL+165,H-pB+28); ctx.stroke();
  ctx.fillStyle=ink3; ctx.fillText("FI123 Flow Rate (m³/h)",pL+168,H-pB+32);
  ctx.fillStyle=ink2; ctx.font="10px system-ui"; ctx.textAlign="left";
  ctx.fillText("Volume (m³/d)",pL,pT-10);
}

function drawSCADAPower(id, m){
  const c=scadaSetup(id,240); if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=64,pR=20,pT=28,pB=52;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";
  const data=m.pwr;
  const maxV=Math.max(...data.map(r=>r.unit_kwh+r.domestic_kwh))||1;
  const grpW=cW/data.length;
  const bW=grpW*0.35;

  [0,0.25,0.5,0.75,1].forEach(f=>{
    const v=maxV*f; const y=pT+cH-(f*cH);
    ctx.strokeStyle="rgba(128,128,128,0.12)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(W-pR,y); ctx.stroke();
    ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="right";
    ctx.fillText(v.toFixed(0),pL-4,y+4);
  });

  data.forEach((r,i)=>{
    const x=pL+(i+0.2)*grpW;
    const hU=(r.unit_kwh/maxV)*cH;
    const hD=(r.domestic_kwh/maxV)*cH;
    ctx.fillStyle="#1D7A8C"; ctx.fillRect(x,pT+cH-hU,bW,Math.max(hU,1));
    ctx.fillStyle="#e67e22"; ctx.fillRect(x+bW+1,pT+cH-hD,bW,Math.max(hD,1));
  });

  const step=Math.max(1,Math.floor(data.length/8));
  data.forEach((r,i)=>{
    if(i%step===0){
      ctx.fillStyle=ink3; ctx.font="9px system-ui"; ctx.textAlign="center";
      ctx.fillText(r.d.slice(0,5),pL+(i+0.5)*grpW,H-pB+14);
    }
  });
  ctx.fillStyle="#1D7A8C"; ctx.fillRect(pL,H-pB+24,10,8);
  ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="left";
  ctx.fillText("Unit / RO (kWh)",pL+14,H-pB+32);
  ctx.fillStyle="#e67e22"; ctx.fillRect(pL+130,H-pB+24,10,8);
  ctx.fillText("Domestic (kWh)",pL+144,H-pB+32);
}

function drawSCADAPowerTrend(id){
  // Monthly totals for all 3 months
  const months=["apr25","may25","jun25"].map(k=>{
    const d=SCADA_DATA[k];
    const rows=d.vol?d.pwr:d.pwr; // trigger getter for apr25/jun25
    return {label:k==="apr25"?"Apr 25":k==="may25"?"May 25":"Jun 25",
      unit:+(rows.reduce((s,r)=>s+r.unit_kwh,0)).toFixed(0),
      domestic:+(rows.reduce((s,r)=>s+r.domestic_kwh,0)).toFixed(0)};
  });
  const c=scadaSetup(id,200); if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=64,pR=20,pT=24,pB=44;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";
  const maxV=Math.max(...months.map(m=>m.unit+m.domestic))||1;
  const grpW=cW/months.length;

  [0,0.5,1].forEach(f=>{
    const v=maxV*f; const y=pT+cH-(f*cH);
    ctx.strokeStyle="rgba(128,128,128,0.12)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(W-pR,y); ctx.stroke();
    ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="right";
    ctx.fillText((v/1000).toFixed(1)+"MWh",pL-4,y+4);
  });

  months.forEach((m,i)=>{
    const x=pL+(i+0.15)*grpW;
    const bW=grpW*0.32;
    const hU=(m.unit/maxV)*cH;
    const hD=(m.domestic/maxV)*cH;
    ctx.fillStyle="#1D7A8C"; ctx.fillRect(x,pT+cH-hU,bW,Math.max(hU,1));
    ctx.fillStyle="#e67e22"; ctx.fillRect(x+bW+2,pT+cH-hD,bW,Math.max(hD,1));
    ctx.fillStyle=ink3; ctx.font="bold 11px system-ui"; ctx.textAlign="center";
    ctx.fillText(m.label,pL+(i+0.5)*grpW,H-pB+16);
    ctx.font="10px system-ui";
    ctx.fillText((m.unit/1000).toFixed(1)+"MWh",x+bW/2,pT+cH-hU-4);
  });
  ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="left";
  ctx.fillText("Monthly energy totals — Unit power vs domestic",pL,pT-8);
}

function drawSCADARecovery(id, m){
  const c=scadaSetup(id,240); if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=52,pR=20,pT=28,pB=44;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";
  const data=m.rec; if(!data.length)return;
  const toX=i=>pL+(i/(data.length-1))*cW;
  const toY=v=>pT+cH-(v/100)*cH;

  // Target lines
  [{v:60,col:"#1D7A8C",lbl:"RC180 target 60%"},{v:85,col:"#2ea44f",lbl:"RC280 target 85%"}].forEach(t=>{
    ctx.strokeStyle=t.col+"66"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(pL,toY(t.v)); ctx.lineTo(W-pR,toY(t.v)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=t.col; ctx.font="9px system-ui"; ctx.textAlign="right";
    ctx.fillText(t.lbl,W-pR-2,toY(t.v)-3);
  });

  [0,25,50,75,100].forEach(v=>{
    const y=toY(v);
    ctx.strokeStyle="rgba(128,128,128,0.1)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(W-pR,y); ctx.stroke();
    ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="right";
    ctx.fillText(v+"%",pL-4,y+4);
  });

  // RC280 (green)
  ctx.fillStyle="rgba(46,164,79,0.06)";
  ctx.beginPath(); ctx.moveTo(toX(0),toY(data[0].rc280));
  data.forEach((r,i)=>ctx.lineTo(toX(i),toY(r.rc280)));
  ctx.lineTo(toX(data.length-1),H-pB); ctx.lineTo(toX(0),H-pB); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="#2ea44f"; ctx.lineWidth=2;
  ctx.beginPath(); data.forEach((r,i)=>i===0?ctx.moveTo(toX(i),toY(r.rc280)):ctx.lineTo(toX(i),toY(r.rc280))); ctx.stroke();

  // RC180 (teal)
  ctx.strokeStyle="#1D7A8C"; ctx.lineWidth=2;
  ctx.beginPath(); data.forEach((r,i)=>i===0?ctx.moveTo(toX(i),toY(r.rc180)):ctx.lineTo(toX(i),toY(r.rc180))); ctx.stroke();

  data.forEach((r,i)=>{
    ctx.fillStyle="#1D7A8C"; ctx.beginPath(); ctx.arc(toX(i),toY(r.rc180),3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#2ea44f"; ctx.beginPath(); ctx.arc(toX(i),toY(r.rc280),3,0,Math.PI*2); ctx.fill();
  });

  const step=Math.max(1,Math.floor(data.length/8));
  data.forEach((r,i)=>{
    if(i%step===0){ctx.fillStyle=ink3; ctx.font="9px system-ui"; ctx.textAlign="center"; ctx.fillText(r.d.slice(0,5),toX(i),H-pB+14);}
  });
  ctx.fillStyle="#1D7A8C"; ctx.fillRect(pL,pT-16,14,2);
  ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="left"; ctx.fillText("rc180 (RO-180)",pL+18,pT-8);
  ctx.fillStyle="#2ea44f"; ctx.fillRect(pL+120,pT-16,14,2);
  ctx.fillText("rc280 (RO-280)",pL+138,pT-8);
}

function drawSCADAEffectiveness(id){
  const c=scadaSetup(id,200); if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=120,pR=60,pT=20,pB=24;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"#0D1E2D";
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";
  const bH=Math.min(22,(cH/PROC_EFF.length)-3);

  PROC_EFF.forEach((p,i)=>{
    const y=pT+i*(bH+4);
    const eff=p.eff||0;
    ctx.fillStyle=p.type==="scada"?"#1D7A8C44":"#6A859820";
    ctx.fillRect(pL,y,cW,bH);
    ctx.fillStyle=p.color; ctx.fillRect(pL,y,(eff/100)*cW,bH);
    ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="right";
    ctx.fillText(p.name,pL-4,y+bH*0.7);
    ctx.fillStyle=ink; ctx.font="bold 10px system-ui"; ctx.textAlign="left";
    ctx.fillText(eff.toFixed(1)+"%",pL+(eff/100)*cW+4,y+bH*0.7);
    if(p.type==="scada"){
      ctx.fillStyle="#1D7A8C"; ctx.font="9px system-ui";
      ctx.fillText("live",W-pR+4,y+bH*0.7);
    }
  });
  ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="left";
  ctx.fillText("← Design   SCADA live →",pL,H-4);
}

function drawSCADACond123(id, m){
  const c=scadaSetup(id,240); if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=60,pR=70,pT=28,pB=44;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";
  const data=m.cond; if(!data.length)return;
  const toX=i=>pL+(i/(data.length-1||1))*cW;

  // Operating hours (left axis)
  const maxOp=Math.max(...data.map(r=>r.op_h))||1;
  const toYop=v=>pT+cH-(v/maxOp)*cH;
  [0,0.25,0.5,0.75,1].forEach(f=>{
    const v=maxOp*f; const y=toYop(v);
    ctx.strokeStyle="rgba(128,128,128,0.1)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(W-pR,y); ctx.stroke();
    ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="right";
    ctx.fillText(v.toFixed(0)+"h",pL-4,y+4);
  });
  ctx.fillStyle="rgba(74,144,217,0.08)";
  ctx.beginPath(); ctx.moveTo(toX(0),toYop(data[0].op_h));
  data.forEach((r,i)=>ctx.lineTo(toX(i),toYop(r.op_h)));
  ctx.lineTo(toX(data.length-1),H-pB); ctx.lineTo(toX(0),H-pB); ctx.closePath(); ctx.fill();
  ctx.strokeStyle="#4a90d9"; ctx.lineWidth=2;
  ctx.beginPath(); data.forEach((r,i)=>i===0?ctx.moveTo(toX(i),toYop(r.op_h)):ctx.lineTo(toX(i),toYop(r.op_h))); ctx.stroke();

  // NI123 (right axis, mS/cm)
  const maxNI=Math.max(...data.map(r=>r.ni123).filter(v=>v>0))||1;
  const toYni=v=>pT+cH-(v/maxNI)*cH;
  [0,0.5,1].forEach(f=>{
    const v=maxNI*f;
    ctx.fillStyle="#e67e2266"; ctx.font="10px system-ui"; ctx.textAlign="left";
    ctx.fillText(v.toFixed(1)+"mS",W-pR+4,toYni(v)+4);
  });
  ctx.strokeStyle="#e67e22"; ctx.lineWidth=1.5;
  ctx.beginPath();
  data.forEach((r,i)=>{if(!r.ni123)return; i===0?ctx.moveTo(toX(i),toYni(r.ni123)):ctx.lineTo(toX(i),toYni(r.ni123));});
  ctx.stroke();

  const step=Math.max(1,Math.floor(data.length/8));
  data.forEach((r,i)=>{
    if(i%step===0){ctx.fillStyle=ink3; ctx.font="9px system-ui"; ctx.textAlign="center"; ctx.fillText(r.d.slice(0,5),toX(i),H-pB+14);}
  });
  ctx.fillStyle="#4a90d9"; ctx.fillRect(pL,pT-16,14,2);
  ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="left"; ctx.fillText("OP_Ro1 hours",pL+18,pT-8);
  ctx.fillStyle="#e67e22"; ctx.fillRect(pL+130,pT-16,14,2);
  ctx.fillText("NI123 feed (mS/cm)",pL+148,pT-8);
}

function drawSCADACondSensor(id, m, field, label, color){
  const c=scadaSetup(id,220); if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=60,pR=20,pT=28,pB=40;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";
  const ink2=getComputedStyle(document.documentElement).getPropertyValue("--ink-2").trim()||"#3B566A";
  const data=m.cond.filter(r=>r[field]>0); if(!data.length)return;
  const toX=i=>pL+(i/(data.length-1||1))*cW;
  const maxV=Math.max(...data.map(r=>r[field]))||1;
  const toY=v=>pT+cH-(v/maxV)*cH;

  [0,0.25,0.5,0.75,1].forEach(f=>{
    const v=maxV*f; const y=toY(v);
    ctx.strokeStyle="rgba(128,128,128,0.12)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pL,y); ctx.lineTo(W-pR,y); ctx.stroke();
    ctx.fillStyle=ink3; ctx.font="10px system-ui"; ctx.textAlign="right";
    ctx.fillText(v.toFixed(0),pL-4,y+4);
  });

  ctx.fillStyle=color+"18";
  ctx.beginPath(); ctx.moveTo(toX(0),toY(data[0][field]));
  data.forEach((r,i)=>ctx.lineTo(toX(i),toY(r[field])));
  ctx.lineTo(toX(data.length-1),H-pB); ctx.lineTo(toX(0),H-pB); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=color; ctx.lineWidth=2;
  ctx.beginPath(); data.forEach((r,i)=>i===0?ctx.moveTo(toX(i),toY(r[field])):ctx.lineTo(toX(i),toY(r[field]))); ctx.stroke();
  data.forEach((r,i)=>{
    const v=r[field];
    ctx.fillStyle=v>200?"#e74c3c":v>100?"#e67e22":color;
    ctx.beginPath(); ctx.arc(toX(i),toY(v),3,0,Math.PI*2); ctx.fill();
  });

  const step=Math.max(1,Math.floor(data.length/8));
  data.forEach((r,i)=>{
    if(i%step===0){ctx.fillStyle=ink3; ctx.font="9px system-ui"; ctx.textAlign="center"; ctx.fillText(r.d.slice(0,5),toX(i),H-pB+14);}
  });
  ctx.fillStyle=ink2; ctx.font="10px system-ui"; ctx.textAlign="left"; ctx.fillText(label,pL,pT-8);
  // Annotation for high spikes
  const highVals=data.filter(r=>r[field]>200);
  if(highVals.length){
    const i=data.indexOf(highVals[0]);
    ctx.fillStyle="#e74c3c"; ctx.font="9px system-ui"; ctx.textAlign="center";
    ctx.fillText("⚠ high",toX(i),toY(highVals[0][field])-10);
  }
}

function renderSCADATable(m){
  const tbody=document.getElementById("scadaTbody"); tbody.innerHTML="";
  const dates=[...new Set([...m.vol.map(r=>r.d),...m.pwr.map(r=>r.d),...m.rec.map(r=>r.d),...m.cond.map(r=>r.d)])].sort();
  dates.forEach(d=>{
    const v=m.vol.find(r=>r.d===d)||{}; const p=m.pwr.find(r=>r.d===d)||{};
    const r=m.rec.find(r=>r.d===d)||{}; const cd=m.cond.find(r=>r.d===d)||{};
    const tr=document.createElement("tr");
    const n=v=>v!=null&&v!==undefined&&v!==''?v:'—';
    tr.innerHTML=`<td style="white-space:nowrap;font-size:12px">${d}</td>
      <td class="td-num">${n(v.vol)}</td><td class="td-num">${n(v.flow)}</td>
      <td class="td-num">${n(p.unit_kwh)}</td><td class="td-num">${n(p.domestic_kwh)}</td>
      <td class="td-num">${n(r.rc180)}</td><td class="td-num">${n(r.rc280)}</td>
      <td class="td-num">${n(cd.op_h)}</td><td class="td-num">${n(cd.ni123)}</td>
      <td class="td-num">${n(cd.ni180)}</td><td class="td-num">${n(cd.ni280)}</td>`;
    tbody.appendChild(tr);
  });
}

// ── SCADA Template download ────────────────────────────────────────────────────

function downloadSCADATemplate(){
  const headers=["date","time","FQ195 [m³]","FI123 [m³/h]","FQ123 [m³]","U_W [kWh]","D_W [kWh]","NI123 [mS/cm]","NI180 [µS/cm]","NI280 [µS/cm]","rc180 [%]","rc280 [%]","OP_Ro1 [h]"];
  const note=["# Neptune SCADA Import Template","# Fill in one row per measurement interval (typically 6-minute SCADA records)","# Date format: DD.MM.YYYY  Time format: HH:MM:SS","# FQ195/FQ123 = cumulative flowmeter readings (m³) — the system computes daily increments","# U_W / D_W = cumulative energy meter readings (kWh) — system computes daily use","# rc180 / rc280 = RO recovery rates in % (0-100)","# OP_Ro1 = cumulative RO1 operating hours","#",""];
  const example=[
    ["01.06.25","00:06:00","943.4","0","24789","11722.3","11165.7","0.01","27.1","30.3","0","0","247.1"],
    ["01.06.25","00:12:00","943.4","0","24789","11722.4","11167.9","0.01","27.2","30.3","0","0","247.1"],
    ["01.06.25","14:06:00","976.0","10.1","24800","12056.6","11486.6","17.1","110.2","29.8","61","90","248.6"],
  ];
  const rows=[...note.map(n=>[n]),[""], [headers.join(",")], ...example.map(r=>r.join(","))];
  const csv=rows.map(r=>Array.isArray(r)?r.join(","):r).join("\r\n");
  const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download="neptune_scada_template.csv"; a.click();
  URL.revokeObjectURL(url);
}

function importSCADACSV(input){
  const file=input.files[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const text=e.target.result;
    const lines=text.split(/\r?\n/).filter(l=>l.trim()&&!l.startsWith("#"));
    if(!lines.length){document.getElementById("scadaImportStatus").textContent="Empty file.";return;}
    const headers=lines[0].split(",").map(h=>h.trim());
    const rows=lines.slice(1).map(l=>Object.fromEntries(headers.map((h,i)=>[h,l.split(",")[i]?.trim()])));
    // Group by date and compute daily increments
    const grouped={};
    rows.forEach(r=>{
      const d=r.date; if(!d)return;
      if(!grouped[d])grouped[d]={rows:[]};
      grouped[d].rows.push(r);
    });
    const imported={label:"Imported",vol:[],pwr:[],rec:[],cond:[]};
    Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).forEach(([d,g])=>{
      const rs=g.rows;
      const fq195=(+rs[rs.length-1]["FQ195 [m³]"]||0)-(+rs[0]["FQ195 [m³]"]||0);
      const fi123=rs.reduce((s,r)=>s+(+r["FI123 [m³/h]"]||0),0)/rs.length;
      const uMax=Math.max(...rs.map(r=>+r["U_W [kWh]"]||0));
      const uMin=Math.min(...rs.map(r=>+r["U_W [kWh]"]||Infinity));
      const dMax=Math.max(...rs.map(r=>+r["D_W [kWh]"]||0));
      const dMin=Math.min(...rs.map(r=>+r["D_W [kWh]"]||Infinity));
      const recRows=rs.filter(r=>(+r["rc180 [%]"]||0)>0);
      const rc180=recRows.length?recRows.reduce((s,r)=>s+(+r["rc180 [%]"]||0),0)/recRows.length:null;
      const rc280=recRows.length?recRows.reduce((s,r)=>s+(+r["rc280 [%]"]||0),0)/recRows.length:null;
      const ni123=rs.reduce((s,r)=>s+(+r["NI123 [mS/cm]"]||0),0)/rs.length;
      const ni180=rs.reduce((s,r)=>s+(+r["NI180 [µS/cm]"]||0),0)/rs.length;
      const ni280=rs.reduce((s,r)=>s+(+r["NI280 [µS/cm]"]||0),0)/rs.length;
      const opH=Math.max(...rs.map(r=>+r["OP_Ro1 [h]"]||0));
      imported.vol.push({d,vol:+fq195.toFixed(1),flow:+fi123.toFixed(2)});
      imported.pwr.push({d,unit_kwh:+(uMax-uMin).toFixed(1),domestic_kwh:+(dMax-dMin).toFixed(1)});
      if(rc180)imported.rec.push({d,rc180:+rc180.toFixed(1),rc280:+rc280.toFixed(1)});
      imported.cond.push({d,op_h:opH,ni123:+ni123.toFixed(2),ni180:+ni180.toFixed(2),ni280:+ni280.toFixed(2)});
    });
    SCADA_DATA.imported=imported;
    const sel=document.getElementById("scadaMonth");
    if(!sel.querySelector("option[value='imported']")){
      const opt=document.createElement("option"); opt.value="imported"; opt.textContent=`Imported (${file.name})`;
      sel.appendChild(opt);
    }
    sel.value="imported";
    document.getElementById("scadaImportStatus").textContent=`✓ ${Object.keys(grouped).length} days imported from ${file.name}`;
    renderSCADA();
  };
  reader.readAsText(file,file.name.endsWith(".csv")?"utf-8":"utf-8");
}

// ── Sankey Water Flow ──────────────────────────────────────────────────────────

function buildSankeyData(){
  const Q    = state.total_inlet_flow;       // 6589 m³/h
  const Qpt  = state.pretreatment_flow_m3h;  // 2764
  const Qwwt = state.wwt_flow_m3h;           // 2000
  const Qconc= state.concentrate_flow_m3h;   // 300
  const Qdirect = Math.max(0, Q - Qpt - Qwwt - Qconc);
  const recRate  = (state.target_recycle_pct||70)/100;
  const tx = treatmentCapexOpex();

  // Estimate per-stage efficiency losses (typical industrial treatment)
  const ptOut  = Qpt  * 0.97; // 3% losses in pre-treatment
  const wwtOut = Qwwt * 0.94; // 6% losses in WWT
  const concOut= Qconc* 0.80; // 20% losses in concentrate (evaporation)
  const treated= ptOut + wwtOut + concOut + Qdirect;
  const reuse  = treated * recRate;
  const discharge = treated * (1-recRate);
  const losses = Q - treated;

  // Populate sankey KPIs
  const pct=v=>(v/Q*100).toFixed(1)+"%";
  document.getElementById("sankeyKpis").innerHTML=[
    {c:"var(--blue)",  v:Q.toFixed(0),          u:"m³/h",  l:"Total Intake"},
    {c:"var(--accent)",v:treated.toFixed(0),     u:"m³/h",  l:"Treated Water"},
    {c:"var(--green)", v:reuse.toFixed(0),        u:"m³/h",  l:"Recycled / Reuse"},
    {c:"var(--s2)",    v:discharge.toFixed(0),    u:"m³/h",  l:"Discharged"},
    {c:"var(--red)",   v:Math.max(0,losses).toFixed(0), u:"m³/h", l:"Losses (leakage)"},
  ].map(k=>`<div class="kpi"><div class="kpi-stripe" style="background:${k.c}"></div><div class="kpi-val">${k.v}<span class="kpi-unit"> ${k.u}</span></div><div class="kpi-lbl">${k.l} (${pct(+k.v)})</div></div>`).join("");

  // Mass balance table
  const tbody=document.getElementById("sankeyTbody"); tbody.innerHTML="";
  const streams=[
    ["Raw Water Intake",  Q,      "#4a90d9", "System Input"],
    ["Pre-treatment Feed",Qpt,    "#1D7A8C", "Process Input"],
    ["Industrial WWT Feed",Qwwt,  "#2ea44f", "Process Input"],
    ["Concentrate Feed",  Qconc,  "#e67e22", "Process Input"],
    ["Direct Industrial", Qdirect,"#6A8598", "Bypass"],
    ["Pre-treated Output",ptOut,  "#1D7A8C", "Process Output"],
    ["WWT Effluent",      wwtOut, "#2ea44f", "Process Output"],
    ["Concentrate Output",concOut,"#e67e22", "Process Output"],
    ["Recycled / Reuse",  reuse,  "#2ea44f", "Beneficial Use"],
    ["Effluent Discharge",discharge,"#4a90d9","Discharge"],
    ["Losses & Evaporation",Math.max(0,losses),"#e74c3c","Loss"],
  ];
  streams.forEach(([name,flow,col,cat])=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${col};margin-right:6px;"></span>${name}</td><td class="td-num">${flow.toFixed(1)}</td><td class="td-num">${(flow*24/1000).toFixed(2)}</td><td class="td-num">${(flow/Q*100).toFixed(1)}%</td><td style="color:var(--ink-3);font-size:12px">${cat}</td>`;
    tbody.appendChild(tr);
  });

  return {Q,Qpt,Qwwt,Qconc,Qdirect,ptOut,wwtOut,concOut,treated,reuse,discharge,losses:Math.max(0,losses)};
}

function renderSankey(){
  const d=buildSankeyData();
  setTimeout(()=>drawSankey("sankeyCanvas",d),50);
}

function drawSankey(canvasId, d){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;
  const parent=canvas.parentElement;
  canvas.width=parent.clientWidth||900;
  canvas.height=420;
  const ctx=canvas.getContext("2d");
  const W=canvas.width, H=canvas.height;
  const pL=80,pR=80,pT=40,pB=40;
  const cW=W-pL-pR, cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink=getComputedStyle(document.documentElement).getPropertyValue("--ink").trim()||"#0D1E2D";
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";
  const surf=getComputedStyle(document.documentElement).getPropertyValue("--surface").trim()||"#fff";

  const Q=d.Q;
  const nodeW=20;
  const maxH=cH-20;
  const scale=v=>Math.max(3,(v/Q)*maxH);

  // Define columns and nodes
  const cols=[
    {x:pL,    nodes:[{label:"Intake",       flow:d.Q,        col:"#4a90d9"}]},
    {x:pL+cW*0.22, nodes:[
      {label:"Pre-treat",  flow:d.Qpt,      col:"#1D7A8C"},
      {label:"WWT",        flow:d.Qwwt,     col:"#2ea44f"},
      {label:"Concentrate",flow:d.Qconc,    col:"#e67e22"},
      {label:"Direct",     flow:d.Qdirect,  col:"#6A8598"},
    ].filter(n=>n.flow>0.5)},
    {x:pL+cW*0.55, nodes:[
      {label:"PT output",  flow:d.ptOut,    col:"#1D7A8C"},
      {label:"WWT output", flow:d.wwtOut,   col:"#2ea44f"},
      {label:"Conc output",flow:d.concOut,  col:"#e67e22"},
      {label:"Direct",     flow:d.Qdirect,  col:"#6A8598"},
    ].filter(n=>n.flow>0.5)},
    {x:pL+cW,  nodes:[
      {label:"Reuse",    flow:d.reuse,     col:"#2ea44f"},
      {label:"Discharge",flow:d.discharge, col:"#4a90d9"},
      {label:"Losses",   flow:d.losses,    col:"#e74c3c"},
    ].filter(n=>n.flow>0.1)},
  ];

  // Compute y positions for each column's nodes (stacked with small gap)
  const gap=8;
  cols.forEach(col=>{
    const totalH=col.nodes.reduce((s,n)=>s+scale(n.flow),0)+(col.nodes.length-1)*gap;
    let y=pT+(cH-totalH)/2;
    col.nodes.forEach(n=>{
      n.h=scale(n.flow);
      n.y=y;
      y+=n.h+gap;
    });
  });

  // Draw links between columns
  const linkPairs=[
    // Col 0→1: intake splits into treatment zones
    [0,0,1,0,d.Qpt],    // intake → pre-treat
    [0,0,1,1,d.Qwwt],   // intake → wwt
    [0,0,1,2,d.Qconc],  // intake → conc
    [0,0,1,3,d.Qdirect],// intake → direct
    // Col 1→2
    [1,0,2,0,d.ptOut],
    [1,1,2,1,d.wwtOut],
    [1,2,2,2,d.concOut],
    [1,3,2,3,d.Qdirect],
    // Col 2→3: all treated → reuse/discharge/losses
    [2,0,3,0,d.ptOut*d.reuse/d.treated],
    [2,0,3,1,d.ptOut*d.discharge/d.treated],
    [2,1,3,0,d.wwtOut*d.reuse/d.treated],
    [2,1,3,1,d.wwtOut*d.discharge/d.treated],
    [2,2,3,1,d.concOut*d.discharge/d.treated],
    [2,3,3,0,d.Qdirect*d.reuse/d.treated],
    [0,0,3,2,d.losses],// losses bypass
  ].filter(lp=>{
    const srcNodes=cols[lp[0]].nodes;const dstNodes=cols[lp[2]].nodes;
    return srcNodes[lp[1]]&&dstNodes[lp[3]]&&lp[4]>0.5;
  });

  // Track cumulative offsets for link attachment
  const srcOffsets={}, dstOffsets={};
  linkPairs.forEach(lp=>{
    const sk=`${lp[0]}_${lp[1]}`, dk=`${lp[2]}_${lp[3]}`;
    if(!srcOffsets[sk])srcOffsets[sk]=0;
    if(!dstOffsets[dk])dstOffsets[dk]=0;
    const h=scale(lp[4]);
    const srcNode=cols[lp[0]].nodes[lp[1]];
    const dstNode=cols[lp[2]].nodes[lp[3]];
    const x0=cols[lp[0]].x+nodeW, y0=srcNode.y+srcOffsets[sk];
    const x1=cols[lp[2]].x,      y1=dstNode.y+dstOffsets[dk];
    const col=srcNode.col;
    const mx=(x0+x1)/2;
    ctx.beginPath();
    ctx.moveTo(x0,y0);
    ctx.bezierCurveTo(mx,y0,mx,y1,x1,y1);
    ctx.lineTo(x1,y1+h);
    ctx.bezierCurveTo(mx,y1+h,mx,y0+h,x0,y0+h);
    ctx.closePath();
    ctx.fillStyle=col+"55";
    ctx.fill();
    srcOffsets[sk]+=h;
    dstOffsets[dk]+=h;
  });

  // Draw node rectangles and labels
  cols.forEach((col,ci)=>{
    col.nodes.forEach(n=>{
      ctx.fillStyle=n.col;
      ctx.fillRect(col.x,n.y,nodeW,n.h);
      const lblX=ci<cols.length-1?col.x+nodeW+6:col.x-6;
      const align=ci<cols.length-1?"left":"right";
      ctx.fillStyle=ink;ctx.font="bold 11px system-ui";ctx.textAlign=align;
      ctx.fillText(n.label,lblX,n.y+n.h/2-6);
      ctx.fillStyle=ink3;ctx.font="10px system-ui";
      ctx.fillText(n.flow.toFixed(0)+" m³/h",lblX,n.y+n.h/2+8);
    });
  });

  // Column headers
  const headers=["Water Intake","Treatment Zones","Process Output","Final Disposition"];
  cols.forEach((col,i)=>{
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";
    ctx.fillText(headers[i],col.x+nodeW/2,pT-14);
  });
}

// ── Leak Detection (IWA / FAVAD / Hazen-Williams) ──────────────────────────────

// Hazen-Williams roughness C as function of pipe age (steel)
function hwRoughness(ageYr){
  if(ageYr<=5)  return 130;
  if(ageYr<=10) return 125;
  if(ageYr<=20) return 115;
  if(ageYr<=30) return 100;
  if(ageYr<=40) return  90;
  return 80; // corroded/old
}

// Hazen-Williams head loss (SI): h_L (m) for L (m), Q (m³/s), d (m)
function hwHeadLoss(L,Q,d,C){
  return 10.67*L*Math.pow(Q,1.852)/(Math.pow(C,1.852)*Math.pow(d,4.87));
}

// FAVAD leakage (L/h) at pressure head h (m)
// Q_leak = C1 × h^0.5 + C2 × h^1.5
// C1 (fixed area, rigid steel pipes), C2 (variable area — small contribution for steel)
function favadLeak(h, Cq, A0_m2, m_m2_per_m){
  const g=9.81;
  const C1=Cq*A0_m2*Math.sqrt(2*g);
  const C2=Cq*m_m2_per_m*Math.sqrt(2*g);
  return (C1*Math.pow(h,0.5)+C2*Math.pow(h,1.5))*3600*1000; // L/h
}

function renderLeakDetect(){
  const Lm  = +document.getElementById("ldLm").value||8.5;    // km mains
  const Nc  = +document.getElementById("ldNc").value||45;     // connections
  const Lp  = +document.getElementById("ldLp").value||2.1;    // km private pipe
  const P_bar=+document.getElementById("ldP").value||4.2;     // bar operating pressure
  const age = +document.getElementById("ldAge").value||18;    // pipe age yr
  const C_prog=+document.getElementById("ldProgramCost").value||85000; // €/yr detection prog

  const P_m = P_bar*10.2; // bar → m head (1 bar ≈ 10.2 m)

  // UARL (Lambert et al. 1999) — L/day then ML/yr
  const UARL_Ld = (18*Lm + 0.8*Nc + 25*Lp)*P_m;
  const UARL_MLyr = UARL_Ld*365/1e6;

  // Estimate CARL from process data
  const Q_in_m3h  = state.total_inlet_flow;
  const Q_auth_m3h= state.discharge_flow||state.total_inlet_flow*0.95;
  const NRW_MLyr  = Math.max(0, Q_in_m3h - Q_auth_m3h)*8760/1000;
  const apparentPct=0.2;
  const CARL_MLyr= NRW_MLyr*(1-apparentPct);
  const CARL_m3h = CARL_MLyr*1000/8760;

  // ILI
  const ILI = CARL_MLyr>0 ? CARL_MLyr/Math.max(UARL_MLyr,0.001) : 0;

  const ILILabel = ILI<=1?"Excellent":ILI<=2?"Good":ILI<=4?"Fair":ILI<=8?"Poor":"Very Poor";
  const ILICol   = ILI<=2?"var(--green)":ILI<=4?"var(--s3)":ILI<=8?"var(--s2)":"var(--red)";

  document.getElementById("ldk1").innerHTML=(NRW_MLyr).toFixed(2)+"<span class='kpi-unit'> ML/yr</span>";
  document.getElementById("ldk2").innerHTML=(CARL_MLyr).toFixed(2)+"<span class='kpi-unit'> ML/yr</span>";
  document.getElementById("ldk3").innerHTML=(UARL_MLyr).toFixed(2)+"<span class='kpi-unit'> ML/yr</span>";
  document.getElementById("ldk4").innerHTML=`<span style="color:${ILICol}">${ILI.toFixed(2)}</span><span class='kpi-unit'> ${ILILabel}</span>`;

  // Hazen-Williams calibration table
  const C = hwRoughness(age);
  const d_m=0.3; // representative pipe diameter 300mm
  const Q_test=CARL_m3h/3600; // m³/s representative leakage flow
  const hL=hwHeadLoss(1000,Q_test,d_m,C); // head loss per km
  const tbody=document.getElementById("ldCalibTbody"); tbody.innerHTML="";
  const rows=[
    ["Hazen-Williams C factor","C",C,"–","Age-based lookup (Lambert/Lamont)"],
    ["Pipe age","t",age,"years","Input"],
    ["Representative diameter","d",(d_m*1000).toFixed(0),"mm","Site estimate"],
    ["Operating pressure","P",P_bar.toFixed(1),"bar","Input"],
    ["Pressure head","H",P_m.toFixed(1),"m","P × 10.2"],
    ["UARL coefficient Lm","18","L/km/d/m","—","Lambert et al. (1999)"],
    ["UARL coefficient Nc","0.8","L/conn/d/m","—","Lambert et al. (1999)"],
    ["UARL coefficient Lp","25","L/km-pp/d/m","—","Lambert et al. (1999)"],
    ["Head loss per km","h_L",hL.toFixed(2),"m/km","Hazen-Williams"],
    ["ILI (Infrastructure Leakage Index)","ILI",ILI.toFixed(2),"–","CARL / UARL"],
  ];
  rows.forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${r[0]}</td><td style="font-family:serif;color:var(--accent)">${r[1]}</td><td class="td-num"><strong>${r[2]}</strong></td><td style="color:var(--ink-3)">${r[3]}</td><td style="color:var(--ink-3);font-size:11px">${r[4]}</td>`;
    tbody.appendChild(tr);
  });

  // Financial / ROI table
  const C_w = state.water_cost_eur_m3||0.35;         // €/m³
  const leakCostYr = CARL_MLyr*1000*C_w;             // €/yr cost of real losses
  const reductionFactor=0.35;                         // detection programme reduces CARL ~35%
  const ΔV_m3yr = CARL_MLyr*1000*reductionFactor;    // m³/yr saved
  const savings = ΔV_m3yr*C_w;                       // €/yr savings
  const payback = C_prog/Math.max(savings-C_prog,1); // years
  const roiPct   = savings>0?((savings-C_prog)/C_prog*100):0;
  const roiTbody=document.getElementById("ldROITbody"); roiTbody.innerHTML="";
  [
    ["Annual cost of real losses (undetected)",`€${leakCostYr.toFixed(0)}`,"Water wasted × €/m³"],
    ["Detection programme cost",`€${C_prog.toFixed(0)}/yr`,"Input — sensor network, surveys, analytics"],
    ["Volume recovered (35% CARL reduction)",`${ΔV_m3yr.toFixed(0)} m³/yr`,"Typical detection efficiency (ILI studies)"],
    ["Annual savings from detection",`€${savings.toFixed(0)}`,"Recovered volume × water cost"],
    ["Simple payback",payback>50?">50 yrs":`${payback.toFixed(1)} yrs`,"Detection cost / net savings"],
    ["Return on investment (ROI)",`${roiPct.toFixed(0)}%`,"(Savings – Cost) / Cost"],
    ["Economic Level of Leakage (ELL)",`${(UARL_MLyr*1.5).toFixed(2)} ML/yr`,"~1.5× UARL as practical ELL target"],
  ].forEach(([m,v,n])=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${m}</td><td class="td-num"><strong>${v}</strong></td><td style="color:var(--ink-3);font-size:12px">${n}</td>`;
    roiTbody.appendChild(tr);
  });

  // Update EBITDA with leak detection savings
  setTimeout(()=>{
    drawFAVAD("favadCanvas",P_m);
    drawLeakFin("leakFinCanvas",C_prog,savings,leakCostYr,payback);
  },50);
}

function drawFAVAD(canvasId, P_m){
  const c=setupCanvas(canvasId);if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=60,pR=20,pT=24,pB=44;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";

  // FAVAD parameters for steel pipe
  const Cq=0.65, A0=0.00001, m=0.000002; // typical industrial steel pipe
  const pressures=Array.from({length:50},(_,i)=>i*P_m*1.2/49);
  const leaks=pressures.map(h=>favadLeak(h,Cq,A0,m));

  const maxP=pressures[pressures.length-1];
  const maxL=Math.max(...leaks)||1;
  const toX=p=>pL+(p/maxP)*cW;
  const toY=l=>pT+cH-(l/maxL)*cH;

  [0,0.25,0.5,0.75,1].forEach(f=>{
    const l=maxL*f;const y=toY(l);
    ctx.strokeStyle="rgba(128,128,128,0.15)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="right";
    ctx.fillText((l/1000).toFixed(1)+"kL",pL-4,y+4);
  });

  // Fixed area component (n=0.5)
  const fixed=pressures.map(h=>favadLeak(h,Cq,A0,0));
  // Variable area component
  const variable=pressures.map(h=>favadLeak(h,0,0,m));

  // Area fill for total
  ctx.fillStyle="rgba(231,76,60,0.08)";
  ctx.beginPath();ctx.moveTo(toX(0),toY(0));
  leaks.forEach((l,i)=>ctx.lineTo(toX(pressures[i]),toY(l)));
  ctx.lineTo(toX(maxP),toY(0));ctx.closePath();ctx.fill();

  ctx.strokeStyle="#e74c3c";ctx.lineWidth=2;
  ctx.beginPath();leaks.forEach((l,i)=>i===0?ctx.moveTo(toX(pressures[i]),toY(l)):ctx.lineTo(toX(pressures[i]),toY(l)));ctx.stroke();

  ctx.strokeStyle="#4a90d9";ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();fixed.forEach((l,i)=>i===0?ctx.moveTo(toX(pressures[i]),toY(l)):ctx.lineTo(toX(pressures[i]),toY(l)));ctx.stroke();
  ctx.setLineDash([]);

  // Operating point
  const opQ=favadLeak(P_m,Cq,A0,m);
  ctx.fillStyle="#e74c3c";ctx.beginPath();ctx.arc(toX(P_m),toY(opQ),5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="left";
  ctx.fillText(`P=${P_m.toFixed(0)}m → ${(opQ/1000).toFixed(2)}kL/h`,toX(P_m)+8,toY(opQ));

  [0,0.25,0.5,0.75,1].forEach(f=>{
    const p=maxP*f;
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";
    ctx.fillText(p.toFixed(0)+"m",toX(p),H-pB+16);
  });
  ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";
  ctx.fillText("Pressure head (m) — FAVAD model (May 1994)",pL+cW/2,H-pB+30);
}

function drawLeakFin(canvasId,C_prog,savings,leakCost,pb){
  const c=setupCanvas(canvasId);if(!c)return;
  const ctx=c.getContext("2d");
  const W=c.width,H=c.height;
  const pL=68,pR=20,pT=24,pB=44;
  const cW=W-pL-pR,cH=H-pT-pB;
  ctx.clearRect(0,0,W,H);
  const ink3=getComputedStyle(document.documentElement).getPropertyValue("--ink-3").trim()||"#6A8598";

  // Cumulative cash flow over 10 years
  const yrs=Array.from({length:11},(_,i)=>i);
  const cflows=yrs.map(y=>y===0?-C_prog:(savings-C_prog)*y - C_prog);
  const minV=Math.min(...cflows),maxV=Math.max(...cflows);
  const range=maxV-minV||1;
  const toX=y=>pL+(y/10)*cW;
  const toY=v=>pT+cH-((v-minV)/range)*cH;
  const y0=toY(0);

  [0,0.25,0.5,0.75,1].forEach(f=>{
    const v=minV+range*f;const y=toY(v);
    ctx.strokeStyle="rgba(128,128,128,0.15)";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(W-pR,y);ctx.stroke();
    ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="right";
    ctx.fillText("€"+(v/1000).toFixed(0)+"k",pL-4,y+4);
  });

  // Break-even line
  ctx.strokeStyle="rgba(100,200,100,0.4)";ctx.lineWidth=1;ctx.setLineDash([4,4]);
  ctx.beginPath();ctx.moveTo(pL,y0);ctx.lineTo(W-pR,y0);ctx.stroke();
  ctx.setLineDash([]);

  // Negative fill (before payback)
  ctx.fillStyle="rgba(231,76,60,0.1)";
  ctx.beginPath();ctx.moveTo(toX(0),y0);
  cflows.forEach((v,i)=>{if(v<0)ctx.lineTo(toX(i),toY(v));});
  if(pb<10){const ix=Math.floor(pb);const frac=pb-ix;const y1=toY(cflows[ix]+(cflows[ix+1]-cflows[ix])*frac);ctx.lineTo(toX(pb),y0);}
  ctx.closePath();ctx.fill();

  // Positive fill (after payback)
  ctx.fillStyle="rgba(46,164,79,0.1)";
  ctx.beginPath();
  if(pb<10){ctx.moveTo(toX(pb),y0);}else{ctx.moveTo(toX(10),toY(cflows[10]));}
  cflows.forEach((v,i)=>{if(v>=0)ctx.lineTo(toX(i),toY(v));});
  ctx.lineTo(toX(10),y0);ctx.closePath();ctx.fill();

  ctx.strokeStyle="#2ea44f";ctx.lineWidth=2;
  ctx.beginPath();cflows.forEach((v,i)=>i===0?ctx.moveTo(toX(i),toY(v)):ctx.lineTo(toX(i),toY(v)));ctx.stroke();
  cflows.forEach((v,i)=>{
    ctx.fillStyle=v>=0?"#2ea44f":"#e74c3c";
    ctx.beginPath();ctx.arc(toX(i),toY(v),3,0,Math.PI*2);ctx.fill();
  });
  yrs.forEach(y=>{ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";ctx.fillText("Y"+y,toX(y),H-pB+14);});
  ctx.fillStyle=ink3;ctx.font="10px system-ui";ctx.textAlign="center";
  ctx.fillText("Leak detection investment — cumulative cash flow",pL+cW/2,H-pB+30);
}

// ── Site Heat Map ──────────────────────────────────────────────────────────────

let heatLeaflet=null;
let heatMarkers=[];

// Stress scoring inputs: flood discharge, rainfall, country WEI, leakage pct
function stressScore(floodFrac, rainFrac, weiFrac, leakFrac){
  return Math.min(1, 0.35*floodFrac + 0.25*rainFrac + 0.25*weiFrac + 0.15*leakFrac);
}

function stressColor(score){
  if(score<0.25)return "#2ea44f";
  if(score<0.50)return "#f39c12";
  if(score<0.75)return "#e67e22";
  return "#e74c3c";
}

function stressLabel(score){
  if(score<0.25)return "Low";
  if(score<0.50)return "Moderate";
  if(score<0.75)return "High";
  return "Extreme";
}

function renderHeatMap(){
  const lat=+document.getElementById("hmLat").value||53.0795;
  const lon=+document.getElementById("hmLon").value||8.7815;
  const radiusKm=+document.getElementById("hmRadius").value||2.0;

  // Init Leaflet map if not done
  if(!heatLeaflet){
    heatLeaflet=L.map("heatMap").setView([lat,lon],14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:'© OpenStreetMap',maxZoom:18,
    }).addTo(heatLeaflet);
  }else{
    heatLeaflet.setView([lat,lon],14);
    heatMarkers.forEach(m=>m.remove());
    heatMarkers=[];
  }
  setTimeout(()=>heatLeaflet.invalidateSize(),100);

  // Compute base stress factors from existing data
  const discharge=floodData?.daily?.river_discharge||[];
  const precipData=rainData?.daily?.precipitation_sum||[];
  const thresh=350;
  const maxQ=Math.max(...discharge.filter(Number.isFinite),0);
  const floodBase=Math.min(1,maxQ/(thresh*1.5));
  const avgP=(precipData.filter(Number.isFinite).reduce((s,v)=>s+v,0)/Math.max(precipData.length,1));
  const rainBase=Math.min(1,avgP/15);
  const country=state.selected_country||"Germany";
  const wei=WATER_STRESS[country]||1.38;
  const weiBase=Math.min(1,wei/5);

  // Leakage fraction from processes
  const totalLeak=Object.values(state.processes||{}).reduce((s,p)=>s+(p.leakage||0),0);
  const totalFlow=state.total_inlet_flow||1;
  const leakBase=Math.min(1,totalLeak/(totalFlow*0.2));

  // Build 7×7 grid of points
  const grid=7;
  const stepDeg=radiusKm/111; // rough degrees per km
  const zones=[];

  // Named zones for the steel plant
  const zoneNames=[
    ["Purification Plant",0,0,"Water supply hub"],
    ["Blast Furnace",0.3,-0.4,"Primary steelmaking — high water demand"],
    ["Converter / BOF",0.3,0.3,"Steel conversion — cooling water"],
    ["Cold Rolling Mill (CRM)",-0.4,0.5,"Precision rolling — treated water"],
    ["WWT Site",-0.2,-0.3,"On-site wastewater treatment"],
    ["Sinter Plant",0.5,0,"Iron ore sintering — dust suppression"],
    ["River Weser Boundary",-0.5,-0.5,"Surface water proximity"],
    ["Eastern Site Perimeter",0.5,0.5,"Lower industrial density"],
    ["Northern Boundary",-0.5,0.3,"Residential/light industrial"],
  ];

  zoneNames.forEach(([name,dy,dx,desc],i)=>{
    const zoneLat=lat+dy*stepDeg;
    const zoneLon=lon+dx*stepDeg;
    // Add micro-variation per zone based on type
    const isRiver=name.includes("Weser");
    const isWWT=name.includes("WWT");
    const isHeavy=name.includes("Blast")||name.includes("Sinter");

    const floodFrac=isRiver ? Math.min(1,floodBase*1.6) : floodBase*(0.8+Math.random()*0.4);
    const rainFrac=rainBase*(0.9+Math.random()*0.2);
    const weiFrac=isWWT?weiBase*0.7:isHeavy?weiBase*1.3:weiBase;
    const leakFrac=isHeavy?leakBase*1.5:isWWT?leakBase*0.8:leakBase;

    const score=stressScore(floodFrac,rainFrac,weiFrac,leakFrac);
    const color=stressColor(score);
    const radius=radiusKm*1000*0.18;

    const marker=L.circleMarker([zoneLat,zoneLon],{
      radius:20,color:"#000",weight:0.5,opacity:0.5,
      fillColor:color,fillOpacity:0.65,
    }).bindPopup(`<strong>${name}</strong><br>${desc}<br>
      <table style="width:100%;font-size:11px;margin-top:6px">
      <tr><td>Flood exposure</td><td align="right"><b>${(floodFrac*100).toFixed(0)}%</b></td></tr>
      <tr><td>Rainfall intensity</td><td align="right"><b>${(rainFrac*100).toFixed(0)}%</b></td></tr>
      <tr><td>Water scarcity</td><td align="right"><b>${(weiFrac*100).toFixed(0)}%</b></td></tr>
      <tr><td>Leakage stress</td><td align="right"><b>${(leakFrac*100).toFixed(0)}%</b></td></tr>
      <tr style="border-top:1px solid #ccc"><td><b>Composite score</b></td><td align="right"><b>${(score*100).toFixed(0)}%</b></td></tr>
      </table>`
    ).addTo(heatLeaflet);
    heatMarkers.push(marker);
    zones.push({name,lat:zoneLat,lon:zoneLon,desc,score,floodFrac,rainFrac,weiFrac,leakFrac});
  });

  // KPI strip
  const avgScore=zones.reduce((s,z)=>s+z.score,0)/zones.length;
  document.getElementById("hmk1").innerHTML=(floodBase*100).toFixed(0)+"<span class='kpi-unit'>%</span>";
  document.getElementById("hmk2").innerHTML=(rainBase*100).toFixed(0)+"<span class='kpi-unit'>%</span>";
  document.getElementById("hmk3").innerHTML=(weiBase*100).toFixed(0)+"<span class='kpi-unit'>%</span>";
  document.getElementById("hmk4").innerHTML=`<span style="color:${stressColor(avgScore)}">${(avgScore*100).toFixed(0)}%</span><span class='kpi-unit'> ${stressLabel(avgScore)}</span>`;
  document.getElementById("heatBanner").textContent=`Stress heat map loaded. ${zones.length} zones assessed using ${floodData?'live':'demo'} flood data, ${precipData.length>0?'live':'demo'} rainfall, WEI index for ${country}. Click any marker for details.`;

  // Breakdown table
  const tbody=document.getElementById("heatTbody"); tbody.innerHTML="";
  zones.sort((a,b)=>b.score-a.score).forEach(z=>{
    const lbl=stressLabel(z.score);
    const col=stressColor(z.score);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${z.name}</strong><br><span style="font-size:11px;color:var(--ink-3)">${z.desc}</span></td><td class="td-num">${(z.floodFrac*100).toFixed(0)}%</td><td class="td-num">${(z.rainFrac*100).toFixed(0)}%</td><td class="td-num">${(z.weiFrac*100).toFixed(0)}%</td><td class="td-num"><strong>${(z.score*100).toFixed(0)}%</strong></td><td><span class="chip" style="background:${col}22;color:${col}">${lbl}</span></td>`;
    tbody.appendChild(tr);
  });
}

// ── Navigation ────────────────────────────────────────────────────────────────

function showSec(id){
  document.querySelectorAll(".section").forEach(s=>s.classList.add("hidden"));
  document.querySelectorAll(".nav-item").forEach(n=>n.classList.remove("active"));
  const sec=document.getElementById("sec-"+id);
  if(sec)sec.classList.remove("hidden");
  const navItem=document.querySelector(`.nav-item[data-sec="${id}"]`);
  if(navItem)navItem.classList.add("active");
  switch(id){
    case"dashboard":renderDashboard();break;
    case"country":renderCountry();break;
    case"company":renderCompany();break;
    case"treatment":renderTreatment();break;
    case"ebitda":renderEBITDA();break;
    case"capex":renderCapex();break;
    case"kinetics":renderKinetics();break;
    case"carbon":renderCarbon();break;
    case"flood":if(!floodData)fetchFloodData();else renderFloodCharts();break;
    case"site":renderSite();break;
    case"compare":renderCompare();break;
    case"trends":renderTrends();break;
    case"sankey":renderSankey();break;
    case"leakdetect":renderLeakDetect();break;
    case"heatmap":renderHeatMap();break;
    case"scada":renderSCADA();break;
    case"eea":renderEEA();break;
  }
}

function onCountryChange(){
  state.selected_country=document.getElementById("cntrySelect").value;
  renderCountry();
}

function onTechChange(sel){
  const stage=sel.getAttribute("data-stage");
  state.selected_treatments[stage]=sel.value;
  const t=TX[stage]?.[sel.value];
  const card=sel.parentElement;
  const desc=card.querySelector("div:last-child");
  if(desc)desc.textContent=t?.desc||"";
  const stageCard=sel.closest(".stage-card");
  const tierEl=stageCard?.querySelector(".stage-tier");
  if(tierEl)tierEl.textContent=t?.tier||"";
  const capexEl=stageCard?.querySelector("div[style*='right'] div:nth-child(2)");
  if(capexEl)capexEl.textContent=`€${(t?.capex||0).toLocaleString()}`;
  renderTreatment();
}

function autoRecommend(){
  state.selected_treatments=recommendTreatments(state.contaminants,true);
  renderTreatment();
}

function refreshAll(){
  const cur=document.querySelector(".nav-item.active");
  if(cur)showSec(cur.dataset.sec);
}

function refreshDash(){renderDashboard();}

// ── Session check + init ──────────────────────────────────────────────────────

function signOut(){fetch("/api/neptune/logout",{method:"POST"}).finally(()=>window.location.href="/");}

function populateCountrySelect(){
  const sel=document.getElementById("cntrySelect");
  Object.keys(WATER_STRESS).sort().forEach(c=>{
    const opt=document.createElement("option");opt.value=c;opt.textContent=c;
    if(c===state.selected_country)opt.selected=true;
    sel.appendChild(opt);
  });
}

async function init(){
  state.processes=JSON.parse(JSON.stringify(DEFAULT_PROCESSES));
  state.contaminants=JSON.parse(JSON.stringify(DEFAULT_CONTAMINANTS));
  state.selected_treatments=recommendTreatments(state.contaminants,true);
  populateCountrySelect();
  try{
    const r=await fetch("/api/neptune/session");
    const data=await r.json();
    if(!data.authenticated){window.location.href="/";return;}
    if(data.email){
      const short=data.email.split("@")[0];
      document.getElementById("uEmail").textContent=data.email;
      document.getElementById("uAv").textContent=short[0].toUpperCase();
    }
    document.getElementById("authOverlay").style.display="none";
    showSec("dashboard");
  }catch{window.location.href="/";}
}

init();
