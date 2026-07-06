// === Scales of Justice — the signature verdict mechanic ===
// An SVG beam pivots on a fulcrum; the tilt angle is driven purely by
// partyA.strengthOfCase vs partyB.strengthOfCase. The tilt is animated with a
// lightweight spring simulation (Hooke's law + damping) stepped every
// requestAnimationFrame, which naturally overshoots and settles with a wobble
// when underdamped — no easing curve library needed.
//
// SVG convention used below (y grows downward, as in all SVG/CSS coordinates):
// rotate(angle, cx, cy) with positive `angle` is clockwise, which sends the
// RIGHT beam end down and the LEFT end up. Party A's pan hangs from the left
// anchor, Party B's from the right anchor. So to make the stronger party's
// pan dip down we use angle = (strengthB - strengthA) * DEG_PER_POINT:
// if A is stronger, that value is negative -> counter-clockwise -> left (A) end
// moves down. Clamped to +/- MAX_ANGLE so the beam never looks absurd.

const MAX_ANGLE = 16; // degrees
const DEG_PER_POINT = 2.1;

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// Party names are model-provided strings. They are NEVER interpolated into
// this markup string -- only static/trusted content lives here. The actual
// names are assigned afterwards via .textContent (see renderScales), which
// cannot be parsed as markup, so a malicious "name" can't break out of the
// <text> element or inject attributes/elements.
function buildMarkup() {
  return `
    <svg viewBox="0 0 400 250" role="img" aria-label="Scales of justice">
      <!-- static stand -->
      <path class="scale-stand" d="M200 226 L200 92" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path class="scale-stand" d="M164 228 L236 228" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path class="scale-stand" d="M178 210 L222 210" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.6"/>

      <g id="beamGroup">
        <line class="scale-beam" x1="76" y1="92" x2="324" y2="92" stroke-width="4" stroke-linecap="round"/>
        <circle class="scale-fulcrum" cx="200" cy="92" r="9"/>

        <g id="anchorA" transform="translate(76,92)">
          <line class="scale-chain" x1="0" y1="0" x2="0" y2="66" stroke-width="1.5"/>
          <g id="panA">
            <ellipse class="scale-pan" cx="0" cy="66" rx="54" ry="13" stroke-width="2"/>
            <text class="scale-pan-label" id="labelA" x="0" y="38" text-anchor="middle"></text>
            <text class="scale-pan-value" id="valueA" x="0" y="70" text-anchor="middle">0</text>
          </g>
        </g>

        <g id="anchorB" transform="translate(324,92)">
          <line class="scale-chain" x1="0" y1="0" x2="0" y2="66" stroke-width="1.5"/>
          <g id="panB">
            <ellipse class="scale-pan" cx="0" cy="66" rx="54" ry="13" stroke-width="2"/>
            <text class="scale-pan-label" id="labelB" x="0" y="38" text-anchor="middle"></text>
            <text class="scale-pan-value" id="valueB" x="0" y="70" text-anchor="middle">0</text>
          </g>
        </g>
      </g>
    </svg>
  `;
}

// Semi-implicit Euler spring integrator. Underdamped (damping < 2*sqrt(stiffness*mass))
// so it overshoots the target once or twice before settling — the "eased physics
// with a little overshoot/wobble" the design calls for.
function runSpring({ from, to, onUpdate, onDone, stiffness = 130, damping = 11, mass = 1 }) {
  let pos = from;
  let vel = 0;
  let lastT = null;
  let rafId = null;

  function step(now) {
    if (lastT === null) lastT = now;
    let dt = (now - lastT) / 1000;
    dt = Math.min(dt, 0.032); // clamp to avoid spiral-of-death on tab-switch jank
    lastT = now;

    const springForce = -stiffness * (pos - to);
    const dampForce = -damping * vel;
    const accel = (springForce + dampForce) / mass;
    vel += accel * dt;
    pos += vel * dt;

    onUpdate(pos);

    if (Math.abs(vel) < 0.02 && Math.abs(pos - to) < 0.05) {
      onUpdate(to);
      onDone && onDone();
      return;
    }
    rafId = requestAnimationFrame(step);
  }

  rafId = requestAnimationFrame(step);
  return () => { if (rafId) cancelAnimationFrame(rafId); };
}

function runCountUp({ to, duration, onUpdate, onDone }) {
  const startT = performance.now();
  let rafId = null;
  function step(now) {
    const t = Math.min(1, (now - startT) / duration);
    onUpdate(to * easeOutQuart(t));
    if (t < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      onDone && onDone();
    }
  }
  rafId = requestAnimationFrame(step);
  return () => { if (rafId) cancelAnimationFrame(rafId); };
}

/**
 * Renders the scales into `mount` and animates the tilt + pan values.
 * Returns a handle with `.finish()` to jump straight to the final state
 * (used before html2canvas capture, so exports never show a mid-tween frame).
 */
export function renderScales(mount, { aName, bName, aValue, bValue }) {
  mount.innerHTML = buildMarkup();

  const beamGroup = mount.querySelector('#beamGroup');
  const panA = mount.querySelector('#panA');
  const panB = mount.querySelector('#panB');
  const valueAEl = mount.querySelector('#valueA');
  const valueBEl = mount.querySelector('#valueB');
  const anchorA = mount.querySelector('#anchorA');
  const anchorB = mount.querySelector('#anchorB');

  // Safe: .textContent never parses its argument as markup, and setAttribute
  // sets a literal attribute value -- neither can be used to inject HTML/SVG.
  mount.querySelector('#labelA').textContent = aName;
  mount.querySelector('#labelB').textContent = bName;
  mount.querySelector('svg').setAttribute('aria-label', `Scales of justice weighing ${aName} against ${bName}`);

  const diff = bValue - aValue; // see convention note above
  const targetAngle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, diff * DEG_PER_POINT));

  let winner = null;
  if (aValue > bValue) winner = 'a';
  else if (bValue > aValue) winner = 'b';

  const cancels = [];

  function setAngle(angle) {
    beamGroup.setAttribute('transform', `rotate(${angle} 200 92)`);
    // Counter-rotate each pan group (nested inside the rotated beam) so the
    // pans themselves stay visually level, as if hanging freely from chains.
    panA.setAttribute('transform', `rotate(${-angle})`);
    panB.setAttribute('transform', `rotate(${-angle})`);
  }

  function applyWinnerGlow() {
    anchorA.classList.toggle('scale-pan-glow', winner === 'a');
    anchorA.classList.toggle('winner-a', winner === 'a');
    anchorB.classList.toggle('scale-pan-glow', winner === 'b');
    anchorB.classList.toggle('winner-b', winner === 'b');
    valueAEl.classList.toggle('winner-a-text', winner === 'a');
    valueBEl.classList.toggle('winner-b-text', winner === 'b');
  }

  function finish() {
    cancels.forEach(c => c());
    cancels.length = 0;
    setAngle(targetAngle);
    valueAEl.textContent = aValue;
    valueBEl.textContent = bValue;
    applyWinnerGlow();
  }

  if (prefersReducedMotion()) {
    finish();
    return { finish };
  }

  setAngle(0);
  valueAEl.textContent = '0';
  valueBEl.textContent = '0';

  cancels.push(runSpring({
    from: 0,
    to: targetAngle,
    onUpdate: setAngle,
    onDone: applyWinnerGlow,
    stiffness: 120,
    damping: 10.5,
  }));

  cancels.push(runCountUp({
    to: aValue,
    duration: 900,
    onUpdate: v => { valueAEl.textContent = (Math.round(v * 10) / 10).toString(); },
    onDone: () => { valueAEl.textContent = aValue; },
  }));

  cancels.push(runCountUp({
    to: bValue,
    duration: 900,
    onUpdate: v => { valueBEl.textContent = (Math.round(v * 10) / 10).toString(); },
    onDone: () => { valueBEl.textContent = bValue; },
  }));

  return { finish };
}
