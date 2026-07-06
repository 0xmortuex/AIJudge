// === Confidence gauge (arc dial) + severity meter (segmented bar) ===

const SEVERITY_ORDER = ['petty', 'minor', 'moderate', 'serious', 'catastrophic'];

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

function runTween({ to, duration, delay = 0, onUpdate, onDone }) {
  const startT = performance.now() + delay;
  let rafId = null;
  function step(now) {
    if (now < startT) { rafId = requestAnimationFrame(step); return; }
    const t = Math.min(1, (now - startT) / duration);
    onUpdate(to * easeOutQuart(t), t);
    if (t < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      onDone && onDone();
    }
  }
  rafId = requestAnimationFrame(step);
  return () => { if (rafId) cancelAnimationFrame(rafId); };
}

// Semicircular arc dial, 1-100, with a count-up number in the center.
export function renderConfidenceGauge(mount, value) {
  const R = 70, CX = 80, CY = 90;
  const ARC_LEN = Math.PI * R; // half-circle circumference

  mount.innerHTML = `
    <svg viewBox="0 0 160 108" role="img" aria-label="Confidence: ${value} percent">
      <path d="M10,${CY} A${R},${R} 0 0 1 150,${CY}" fill="none" stroke="rgba(42,32,19,0.12)" stroke-width="10" stroke-linecap="round"/>
      <path id="gaugeFill" d="M10,${CY} A${R},${R} 0 0 1 150,${CY}" fill="none" stroke="url(#gaugeGrad)" stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${ARC_LEN}" stroke-dashoffset="${ARC_LEN}"/>
      <defs>
        <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#a97c22"/>
          <stop offset="100%" stop-color="#f3dc9a"/>
        </linearGradient>
      </defs>
      <text id="gaugeNum" x="${CX}" y="${CY - 6}" text-anchor="middle" class="gauge-value">0%</text>
    </svg>
  `;

  const fill = mount.querySelector('#gaugeFill');
  const num = mount.querySelector('#gaugeNum');
  let cancel = () => {};

  function apply(v) {
    fill.setAttribute('stroke-dashoffset', String(ARC_LEN * (1 - v / 100)));
    num.textContent = Math.round(v) + '%';
  }

  function finish() { cancel(); apply(value); }

  if (prefersReducedMotion()) {
    finish();
    return { finish };
  }

  apply(0);
  cancel = runTween({
    to: value, duration: 1000, delay: 200,
    onUpdate: apply,
    onDone: () => apply(value),
  });

  return { finish };
}

// Five-segment severity meter (petty -> catastrophic), staggered reveal.
export function renderSeverityMeter(mount, severityLevel) {
  const idx = Math.max(0, SEVERITY_ORDER.indexOf(severityLevel));
  const activeCount = idx + 1;

  mount.innerHTML = `
    <div class="severity-track">
      ${SEVERITY_ORDER.map((_, i) => `<div class="severity-seg" data-level="${i + 1}"></div>`).join('')}
    </div>
    <div class="severity-word">${severityLevel.replace(/_/g, ' ')}</div>
  `;

  const segs = Array.from(mount.querySelectorAll('.severity-seg'));
  let timers = [];

  function fillAll() {
    segs.forEach((seg, i) => seg.classList.toggle('filled', i < activeCount));
  }

  function finish() {
    timers.forEach(clearTimeout);
    timers = [];
    fillAll();
  }

  if (prefersReducedMotion()) {
    finish();
    return { finish };
  }

  segs.forEach((seg, i) => {
    if (i >= activeCount) return;
    const id = setTimeout(() => seg.classList.add('filled'), 120 * i);
    timers.push(id);
  });

  return { finish };
}
