"""
Report Generator
=================
Renders a MergedSystemReport as a single self-contained HTML file.
This is the "what the merged output could look like" prototype view.
"""
from models import MergedSystemReport

FLAG_COLOR = {"ok": "#3FD0C9", "info": "#6C8A93", "warning": "#E8A33D", "critical": "#E5484D"}


def _fmt(v):
    if isinstance(v, float):
        return f"{v:,.4f}".rstrip("0").rstrip(".") if abs(v) < 10 else f"{v:,.2f}"
    return v


def _line_items_html(items):
    rows = "".join(
        f'<tr><td class="li-label">{label}</td>'
        f'<td class="li-value">{_fmt(value)}</td>'
        f'<td class="li-unit">{unit}</td></tr>'
        for label, value, unit in items
    )
    return f'<table class="li-table">{rows}</table>'


def _stage_card(stage, badge=None, extra_class=""):
    subtotal = f'<div class="stage-subtotal">{stage.subtotal_eur_m3:.3f} EUR/m3</div>' \
        if stage.subtotal_eur_m3 is not None else ""
    badge_html = f'<span class="badge">{badge}</span>' if badge else ""
    return f"""
    <div class="stage-card {extra_class}">
      <div class="stage-head">
        <h3>{stage.name}</h3>
        {badge_html}
      </div>
      <p class="stage-desc">{stage.description}</p>
      {_line_items_html(stage.line_items)}
      {subtotal}
    </div>"""


BOX_COLORS = {
    "grey": ("#8A94A6", "Grey Box", "Prefiltration / fouling prevention value"),
    "blue": ("#3FD0C9", "Blue Box", "Water recycle value"),
    "brown": ("#C08A5C", "Brown Box", "Waste/material recovery value"),
    "red": ("#E5484D", "Red Box", "Emergency & compliance value"),
}


def render(report: MergedSystemReport) -> str:
    d = report.design
    neptune = report.neptune
    bc = report.blue_circle

    flags_html = "".join(
        f'<div class="flag flag-{f["level"]}"><span class="flag-dot"></span>{f["message"]}</div>'
        for f in report.variance_flags
    )

    blue_circle_panel = ""
    if bc:
        box_vals = {
            "grey": bc.grey_box_eur_yr, "blue": bc.blue_box_eur_yr,
            "brown": bc.brown_box_eur_yr, "red": bc.red_box_eur_yr,
        }
        cards = ""
        for key, (color, label, desc) in BOX_COLORS.items():
            est_tag = ' <span class="badge">ESTIMATE</span>' if key == "brown" and bc.brown_box_is_estimate else ""
            cards += f"""
            <div class="box-card" style="border-top: 3px solid {color}">
              <div class="box-label" style="color:{color}">{label}{est_tag}</div>
              <div class="box-value">{box_vals[key]:,.0f}</div>
              <div class="box-unit">EUR / year</div>
              <div class="box-desc">{desc}</div>
            </div>"""
        total_bc = sum(box_vals.values())
        blue_circle_panel = f"""
        <div class="box-grid">{cards}</div>
        <div class="ops-meta">Total Blue Circle value creation: {total_bc:,.0f} EUR/yr &middot;
        Company: {neptune.company_name} &middot; Site: {neptune.site} &middot; Country: {neptune.country} &middot;
        Source: {neptune.source_file}</div>
        """
    else:
        blue_circle_panel = '<div class="ops-empty">No Neptune1 session export loaded for this run.</div>'

    concentrate_cards = "".join(
        _stage_card(opt, extra_class="conc-card") for opt in report.concentrate_management
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Merged RO System Report — {report.project_name}</title>
<style>
  :root {{
    --bg: #0B1418;
    --surface: #121F26;
    --surface-alt: #16262E;
    --line: #24373F;
    --text: #E7EDEE;
    --muted: #8AA0A6;
    --teal: #3FD0C9;
    --amber: #E8A33D;
    --red: #E5484D;
    --mono: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    --sans: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0; background: var(--bg); color: var(--text);
    font-family: var(--sans); line-height: 1.5; padding: 0 0 80px 0;
  }}
  header {{
    padding: 36px 48px 28px 48px; border-bottom: 1px solid var(--line);
    display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px;
  }}
  .eyebrow {{ color: var(--teal); font-family: var(--mono); font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 8px;}}
  h1 {{ margin: 0; font-size: 28px; font-weight: 650; letter-spacing: -0.01em; }}
  .source-badges {{ display: flex; gap: 10px; flex-wrap: wrap; }}
  .source-badge {{
    font-family: var(--mono); font-size: 11px; padding: 6px 10px; border-radius: 3px;
    border: 1px solid var(--line); color: var(--muted); background: var(--surface);
  }}
  .source-badge b {{ color: var(--text); }}

  section {{ padding: 32px 48px; border-bottom: 1px solid var(--line); }}
  .section-title {{
    font-family: var(--mono); font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--muted); margin: 0 0 18px 0;
  }}

  .flags {{ display: flex; flex-direction: column; gap: 8px; }}
  .flag {{
    display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 4px;
    background: var(--surface); font-size: 14px; border: 1px solid var(--line);
  }}
  .flag-dot {{ width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }}
  .flag-ok .flag-dot {{ background: var(--teal); }}
  .flag-info .flag-dot {{ background: var(--muted); }}
  .flag-warning .flag-dot {{ background: var(--amber); }}
  .flag-critical .flag-dot {{ background: var(--red); }}
  .flag-critical {{ border-color: rgba(229,72,77,0.4); }}
  .flag-warning {{ border-color: rgba(232,163,61,0.35); }}

  .ops-grid {{ display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 10px; }}
  .ops-stat {{
    background: var(--surface); border: 1px solid var(--line); border-radius: 4px;
    padding: 14px 18px; min-width: 130px;
  }}
  .ops-stat span {{ display: block; font-family: var(--mono); font-size: 22px; color: var(--teal); }}
  .ops-stat label {{ display: block; font-size: 11px; color: var(--muted); margin-top: 4px; }}
  .ops-meta, .ops-empty {{ font-family: var(--mono); font-size: 12px; color: var(--muted); }}

  .box-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 12px; }}
  .box-card {{ background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 16px 18px; }}
  .box-label {{ font-family: var(--mono); font-size: 12px; font-weight: 600; letter-spacing: 0.04em; margin-bottom: 8px; }}
  .box-value {{ font-family: var(--mono); font-size: 26px; color: var(--text); }}
  .box-unit {{ font-family: var(--mono); font-size: 11px; color: var(--muted); margin-bottom: 6px; }}
  .box-desc {{ font-size: 12px; color: var(--muted); }}

  .flow-rail {{ display: flex; align-items: stretch; gap: 0; overflow-x: auto; padding-bottom: 8px; }}
  .flow-stage {{ flex: 1; min-width: 260px; }}
  .flow-arrow {{
    display: flex; align-items: center; justify-content: center; min-width: 40px; color: var(--muted);
    font-family: var(--mono); font-size: 12px; flex-direction: column;
  }}
  .flow-arrow .arrow-line {{ width: 100%; height: 1px; background: var(--line); position: relative; }}
  .flow-arrow .arrow-line::after {{
    content: ''; position: absolute; right: 0; top: -3px; border: 4px solid transparent;
    border-left-color: var(--line);
  }}
  .flow-arrow .flow-val {{ margin-bottom: 6px; color: var(--teal); }}

  .stage-card {{
    background: var(--surface); border: 1px solid var(--line); border-radius: 6px;
    padding: 18px 20px; height: 100%;
  }}
  .stage-head {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }}
  .stage-card h3 {{ margin: 0; font-size: 15px; }}
  .badge {{
    font-family: var(--mono); font-size: 10px; color: var(--amber); border: 1px solid rgba(232,163,61,0.4);
    padding: 2px 6px; border-radius: 3px;
  }}
  .stage-desc {{ color: var(--muted); font-size: 12.5px; margin: 0 0 12px 0; }}
  .li-table {{ width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 12.5px; }}
  .li-table td {{ padding: 5px 0; border-top: 1px solid var(--line); }}
  .li-label {{ color: var(--muted); width: 62%; }}
  .li-value {{ text-align: right; color: var(--text); }}
  .li-unit {{ text-align: left; color: var(--muted); padding-left: 8px; width: 20%; }}
  .stage-subtotal {{
    margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--line);
    font-family: var(--mono); font-size: 13px; color: var(--teal); text-align: right;
  }}

  .conc-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }}

  .totals-strip {{
    display: flex; gap: 24px; flex-wrap: wrap; background: var(--surface-alt);
    border: 1px solid var(--line); border-radius: 6px; padding: 20px 24px;
  }}
  .totals-strip .stat {{ min-width: 160px; }}
  .totals-strip .stat span {{ display: block; font-family: var(--mono); font-size: 24px; color: var(--teal); }}
  .totals-strip .stat label {{ display: block; font-size: 11px; color: var(--muted); margin-top: 4px; }}

  footer {{ padding: 24px 48px; color: var(--muted); font-family: var(--mono); font-size: 11px; }}
</style>
</head>
<body>

<header>
  <div>
    <div class="eyebrow">Merged system report &middot; prototype output</div>
    <h1>{report.project_name}</h1>
  </div>
  <div class="source-badges">
    <span class="source-badge">DESIGN SOURCE: <b>DuPont WAVE export</b></span>
    <span class="source-badge">NEPTUNE1 SOURCE: <b>{'session export' if neptune else 'not connected'}</b></span>
    <span class="source-badge">COST SOURCE: <b>{report.costs.source_file.split('/')[-1]}</b></span>
  </div>
</header>

<section>
  <div class="section-title">Neptune1 vs WAVE/Excel — stage-level reconciliation</div>
  <div class="flags">{flags_html}</div>
</section>

<section>
  <div class="section-title">Blue Circle — water value creation (Neptune1)</div>
  {blue_circle_panel}
</section>

<section>
  <div class="section-title">Treatment train — pre-treatment &rarr; RO &rarr; post-treatment</div>
  <div class="flow-rail">
    <div class="flow-stage">{_stage_card(report.pretreatment)}</div>
    <div class="flow-arrow"><div class="flow-val">{d.feed_flow_m3d:.0f} m3/d</div><div class="arrow-line"></div></div>
    <div class="flow-stage">{_stage_card(report.ro_treatment, badge=f"{d.recovery_pct:.1f}% recovery")}</div>
    <div class="flow-arrow"><div class="flow-val">{d.permeate_flow_m3d:.0f} m3/d</div><div class="arrow-line"></div></div>
    <div class="flow-stage">{_stage_card(report.posttreatment)}</div>
  </div>
</section>

<section>
  <div class="section-title">Concentrate management — {d.concentrate_flow_m3d:.0f} m3/d reject at {d.concentrate_conductivity_uScm/1000:.1f} mS/cm</div>
  <div class="conc-grid">{concentrate_cards}</div>
</section>

<section>
  <div class="section-title">Total system OPEX</div>
  <div class="totals-strip">
    <div class="stat"><span>{report.total_opex_eur_m3:.3f}</span><label>EUR / m3 permeate (pre+RO+post)</label></div>
    <div class="stat"><span>{report.total_opex_eur_year:,.0f}</span><label>EUR / year at design flow</label></div>
    <div class="stat"><span>{report.costs.capex_total_eur:,.0f}</span><label>EUR CAPEX (client Excel)</label></div>
    <div class="stat"><span>{report.costs.leachate_disposal_eur_m3:.1f}</span><label>EUR / m3 concentrate disposal (client Excel)</label></div>
  </div>
</section>

<footer>
  Generated by ro_merge_system prototype &middot; design data: {d.source_file.split('/')[-1]} &middot;
  cost data: {report.costs.source_file.split('/')[-1]}
</footer>

</body>
</html>"""
    return html
