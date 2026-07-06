import { renderScales } from './scales.js';
import { renderConfidenceGauge, renderSeverityMeter } from './gauge.js';

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function getVerdictBannerText(verdict, partyA, partyB) {
  switch (verdict) {
    case 'party_a': return `THE COURT FINDS IN FAVOR OF ${partyA.toUpperCase()}`;
    case 'party_b': return `THE COURT FINDS IN FAVOR OF ${partyB.toUpperCase()}`;
    case 'both_wrong': return 'THE COURT FINDS BOTH PARTIES AT FAULT';
    case 'both_right': return 'THE COURT FINDS BOTH PARTIES HAVE MERIT';
    case 'its_complicated': return "THE COURT FINDS THE MATTER COMPLICATED";
    default: return 'VERDICT RENDERED';
  }
}

function renderPoints(points, type) {
  if (!points || !points.length) return '';
  const icon = type === 'valid'
    ? '<span class="point-icon valid">&#10003;</span>'
    : '<span class="point-icon weak">&#10007;</span>';
  return points.map((p, i) => `<div class="point-item" style="--i:${i}">${icon}<span>${esc(p)}</span></div>`).join('');
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Handles from the last render, so we can force everything to its final
// visual state on demand (used before the html2canvas certificate capture).
let activeHandles = [];

export function finishRulingAnimations() {
  activeHandles.forEach(h => { try { h.finish(); } catch { /* noop */ } });
}

export function renderVerdict(data) {
  activeHandles = [];

  const card = document.getElementById('verdict-card');
  const winnerA = data.verdict === 'party_a' ? ' winner' : '';
  const winnerB = data.verdict === 'party_b' ? ' winner' : '';

  card.innerHTML = `
    <div class="card-header">
      <div class="court-label">&#9878; Court of AI Judgment</div>
      <div class="case-number mono">Case No. ${esc(data.caseNumber)}</div>
      <hr class="gold-rule">
      <h2 class="case-title">${esc(data.caseTitle)}</h2>
      <div class="badge-row">
        <span class="badge badge-category">${esc(data.category.replace(/_/g, ' '))}</span>
        <span class="badge badge-severity ${esc(data.severityLevel)}">${esc(data.severityLevel)}</span>
      </div>
    </div>

    <div class="verdict-banner ${esc(data.verdict)}">
      <div class="verdict-label">${esc(getVerdictBannerText(data.verdict, data.partyA.name, data.partyB.name))}</div>
      <div class="verdict-summary legal-text">${esc(data.verdictText)}</div>
    </div>

    <div class="scales-section">
      <div class="scales-mount" id="scales-mount"></div>
    </div>

    <div class="metrics-row">
      <div class="gauge-block">
        <div class="gauge-mount" id="gauge-mount"></div>
        <div class="gauge-caption">Confidence</div>
      </div>
      <div class="severity-block">
        <div class="severity-caption">Severity</div>
        <div id="severity-mount"></div>
      </div>
    </div>

    <div class="party-breakdown">
      <div class="party-card party-a-card${winnerA}">
        <div class="party-name">${esc(data.partyA.name)}</div>
        <div class="party-position">${esc(data.partyA.position)}</div>
        <div class="strength-row">
          <span class="strength-label">Strength</span>
          <div class="strength-bar"><div class="strength-fill" data-width="${data.partyA.strengthOfCase * 10}"></div></div>
          <span class="strength-value"><span class="strength-num">0</span>/10</span>
        </div>
        <div class="points-section">
          <div class="points-header">Valid Points</div>
          ${renderPoints(data.partyA.validPoints, 'valid')}
        </div>
        <div class="points-section">
          <div class="points-header">Weaknesses</div>
          ${renderPoints(data.partyA.weaknesses, 'weak')}
        </div>
      </div>
      <div class="party-card party-b-card${winnerB}">
        <div class="party-name">${esc(data.partyB.name)}</div>
        <div class="party-position">${esc(data.partyB.position)}</div>
        <div class="strength-row">
          <span class="strength-label">Strength</span>
          <div class="strength-bar"><div class="strength-fill" data-width="${data.partyB.strengthOfCase * 10}"></div></div>
          <span class="strength-value"><span class="strength-num">0</span>/10</span>
        </div>
        <div class="points-section">
          <div class="points-header">Valid Points</div>
          ${renderPoints(data.partyB.validPoints, 'valid')}
        </div>
        <div class="points-section">
          <div class="points-header">Weaknesses</div>
          ${renderPoints(data.partyB.weaknesses, 'weak')}
        </div>
      </div>
    </div>

    <div class="ruling-section">
      <div class="section-header">The Court's Reasoning</div>
      <div class="reasoning-text legal-text">${esc(data.reasoning)}</div>
      ${data.keyEvidence ? `
        <div class="key-evidence">
          <div class="key-evidence-label">Key Evidence</div>
          <div class="key-evidence-text">${esc(data.keyEvidence)}</div>
        </div>` : ''}
    </div>

    ${data.precedent ? `
      <div class="ruling-section">
        <div class="section-header">Cited Precedent</div>
        <div class="precedent-text">${esc(data.precedent)}</div>
      </div>` : ''}

    ${data.roast ? `
      <div class="ruling-section roast-section">
        <div class="section-header">Note from the Bench</div>
        <div class="roast-text">${esc(data.roast)}</div>
      </div>` : ''}

    ${data.advice ? `
      <div class="ruling-section">
        <div class="section-header">Advice Going Forward</div>
        <div class="advice-text">${esc(data.advice)}</div>
      </div>` : ''}

    <div class="card-footer">
      <p>Ruled by AIJudge &mdash; ${esc(formatDate(data.timestamp))}</p>
      <p class="disclaimer">This is an AI-generated ruling for entertainment purposes only.</p>
      <p class="url">https://0xmortuex.github.io/AIJudge/</p>
    </div>
  `;

  // === Signature mechanic: the scales physically tip toward the stronger party ===
  const scalesMount = card.querySelector('#scales-mount');
  activeHandles.push(renderScales(scalesMount, {
    aName: data.partyA.name,
    bName: data.partyB.name,
    aValue: data.partyA.strengthOfCase,
    bValue: data.partyB.strengthOfCase,
  }));

  // === Confidence gauge + severity meter ===
  const gaugeMount = card.querySelector('#gauge-mount');
  activeHandles.push(renderConfidenceGauge(gaugeMount, data.confidenceLevel));

  const severityMount = card.querySelector('#severity-mount');
  activeHandles.push(renderSeverityMeter(severityMount, data.severityLevel));

  // === Party strength bars: fill via transform:scaleX (GPU-friendly) + count-up ===
  const partyAFill = card.querySelector('.party-a-card .strength-fill');
  const partyANum = card.querySelector('.party-a-card .strength-num');
  activeHandles.push(animateStrength(partyAFill, partyANum, data.partyA.strengthOfCase, 900));

  const partyBFill = card.querySelector('.party-b-card .strength-fill');
  const partyBNum = card.querySelector('.party-b-card .strength-num');
  activeHandles.push(animateStrength(partyBFill, partyBNum, data.partyB.strengthOfCase, 1050));
}

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

function animateStrength(fillEl, numEl, toValue, delay) {
  const pct = toValue * 10;

  function apply(v) {
    fillEl.style.transform = `scaleX(${v / 100})`;
    if (numEl) numEl.textContent = Math.round((v / 10) * 10) / 10;
  }

  if (prefersReducedMotion()) {
    apply(pct);
    return { finish: () => apply(pct) };
  }

  fillEl.style.transform = 'scaleX(0)';
  if (numEl) numEl.textContent = '0';

  const duration = 850;
  const startT = performance.now() + delay;
  let rafId = null;
  let done = false;

  function step(now) {
    if (now < startT) { rafId = requestAnimationFrame(step); return; }
    const t = Math.min(1, (now - startT) / duration);
    apply(pct * easeOutQuart(t));
    if (t < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      done = true;
    }
  }
  rafId = requestAnimationFrame(step);

  return {
    finish() {
      if (rafId) cancelAnimationFrame(rafId);
      if (!done) apply(pct);
    },
  };
}
