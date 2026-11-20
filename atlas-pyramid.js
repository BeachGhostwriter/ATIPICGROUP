/* ATLAS Pyramid (home page): scales the fixed-size diagram stage to its frame
   and lets visitors tap a box to trace everything it feeds and is fed by. */
(function () {
  const frame = document.getElementById('pyrFrame');
  const stage = document.getElementById('pyrStage');
  if (!frame || !stage) return;

  const STAGE_W = 1760;
  function fit() { stage.style.setProperty('--pyr-k', frame.clientWidth / STAGE_W); }
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(frame);
  window.addEventListener('resize', fit);
  fit();

  const names = {
    G: 'Performance Enhancement',
    O1: 'Clear, future-led direction', O2: 'Stable, productive operations',
    O3: 'Risk-balanced investment', O4: 'EBITDA realised and kept',
    P1: 'Process 01 · Piloting', P2: 'Process 02 · Strategic Planning & Alignment',
    P3: 'Process 03 · Consolidation & Review', P4: 'Process 04 · Action Valuation & Execution',
    P5: 'Process 05 · Insight',
    M1: 'Module 01 · Strategic Direction', M2: 'Module 02 · 360° Brainstorming',
    M3: 'Module 03 · Establishing Context', M4: 'Module 04 · Stabilising Production',
    M5: 'Module 05 · Aligning with Controlling', M6: 'Module 06 · Valorisation',
    M7: 'Module 07 · Lighthouse',
    TOP: 'Tool · One Pager', TVP: 'Tool · Value Plan', TLK: 'Tool · Leakage Template',
    TCO: 'Tool · CORE©', TRA: 'Tool · RADAR©', TFO: 'Tool · FORGE©', THE: 'Tool · HELGA portfolio management'
  };

  const nodes = Array.from(stage.querySelectorAll('.pyr-node'));
  const lines = Array.from(stage.querySelectorAll('.pyr-ln[data-from]'));
  const edges = lines.map(l => [l.dataset.from, l.dataset.to]);
  const caption = document.getElementById('pyrCaption');
  let sel = null;

  function reach(start, forward) {
    const seen = { [start]: true };
    const stack = [start];
    while (stack.length) {
      const n = stack.pop();
      edges.forEach(([a, b]) => {
        const from = forward ? a : b, to = forward ? b : a;
        if (from === n && !seen[to]) { seen[to] = true; stack.push(to); }
      });
    }
    return seen;
  }

  function render() {
    const up = sel ? reach(sel, true) : {};
    const down = sel ? reach(sel, false) : {};
    stage.classList.toggle('is-tracing', !!sel);
    nodes.forEach(b => {
      const id = b.dataset.node;
      b.classList.toggle('is-off', !!sel && !up[id] && !down[id]);
      b.classList.toggle('is-sel', id === sel);
      b.setAttribute('aria-pressed', id === sel ? 'true' : 'false');
    });
    lines.forEach(l => {
      const a = l.dataset.from, b = l.dataset.to;
      const on = !sel || (down[a] && down[b]) || (up[a] && up[b]);
      l.classList.toggle('is-off', !on);
    });
    if (caption) caption.textContent = sel ? 'Tracing: ' + names[sel] : '';
  }

  nodes.forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.node;
    sel = sel === id ? null : id;
    render();
  }));
  const reset = document.getElementById('pyrReset');
  if (reset) reset.addEventListener('click', () => { sel = null; render(); });
  render();
})();
