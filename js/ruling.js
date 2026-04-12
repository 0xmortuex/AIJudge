function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getVerdictBannerText(verdict, partyA, partyB) {
  switch (verdict) {
    case 'party_a': return `VERDICT: IN FAVOR OF ${partyA.toUpperCase()}`;
    case 'party_b': return `VERDICT: IN FAVOR OF ${partyB.toUpperCase()}`;
    case 'both_wrong': return 'VERDICT: BOTH PARTIES AT FAULT';
    case 'both_right': return 'VERDICT: BOTH PARTIES HAVE MERIT';
    case 'its_complicated': return "VERDICT: IT'S COMPLICATED";
    default: return 'VERDICT RENDERED';
  }
}

function renderPoints(points, type) {
  if (!points || !points.length) return '';
  const icon = type === 'valid'
    ? '<span class="point-icon valid">&#10003;</span>'
    : '<span class="point-icon weak">&#10007;</span>';
  return points.map(p => `<div class="point-item">${icon}<span>${esc(p)}</span></div>`).join('');
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function renderVerdict(data) {
  const card = document.getElementById('verdict-card');

  card.innerHTML = `
    <div class="card-header">
      <div class="court-label">&#9878; COURT OF AI JUDGMENT</div>
      <div class="case-number mono">Case No. ${esc(data.caseNumber)}</div>
      <hr class="gold-rule">
      <h2 class="case-title">${esc(data.caseTitle)}</h2>
      <div class="badge-row">
        <span class="badge badge-category">${esc(data.category.replace(/_/g, ' '))}</span>
        <span class="badge badge-severity ${data.severityLevel}">${esc(data.severityLevel)}</span>
      </div>
    </div>

    <div class="verdict-banner ${data.verdict}">
      <div class="verdict-label">${getVerdictBannerText(data.verdict, data.partyA.name, data.partyB.name)}</div>
      <div class="verdict-summary legal-text">${esc(data.verdictText)}</div>
      <div class="confidence-row">
        <span class="confidence-label">Confidence: ${data.confidenceLevel}%</span>
        <div class="confidence-bar"><div class="confidence-fill" data-width="${data.confidenceLevel}"></div></div>
      </div>
    </div>

    <div class="party-breakdown">
      <div class="party-card party-a-card">
        <div class="party-name">${esc(data.partyA.name)}</div>
        <div class="party-position">${esc(data.partyA.position)}</div>
        <div class="strength-row">
          <span class="strength-label">Strength</span>
          <div class="strength-bar"><div class="strength-fill" data-width="${data.partyA.strengthOfCase * 10}"></div></div>
          <span class="strength-value">${data.partyA.strengthOfCase}/10</span>
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
      <div class="party-card party-b-card">
        <div class="party-name">${esc(data.partyB.name)}</div>
        <div class="party-position">${esc(data.partyB.position)}</div>
        <div class="strength-row">
          <span class="strength-label">Strength</span>
          <div class="strength-bar"><div class="strength-fill" data-width="${data.partyB.strengthOfCase * 10}"></div></div>
          <span class="strength-value">${data.partyB.strengthOfCase}/10</span>
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
      <div class="section-header">&#128203; COURT'S REASONING</div>
      <div class="reasoning-text legal-text">${esc(data.reasoning)}</div>
      ${data.keyEvidence ? `
        <div class="key-evidence">
          <div class="key-evidence-label">Key Evidence</div>
          <div class="key-evidence-text">${esc(data.keyEvidence)}</div>
        </div>` : ''}
    </div>

    ${data.precedent ? `
      <div class="ruling-section">
        <div class="section-header">&#128218; LEGAL PRECEDENT</div>
        <div class="precedent-text">${esc(data.precedent)}</div>
      </div>` : ''}

    ${data.roast ? `
      <div class="ruling-section roast-section">
        <div class="section-header">&#128293; THE COURT OBSERVES:</div>
        <div class="roast-text">${esc(data.roast)}</div>
      </div>` : ''}

    ${data.advice ? `
      <div class="ruling-section">
        <div class="section-header">&#128161; COURT'S RECOMMENDATION</div>
        <div class="advice-text">${esc(data.advice)}</div>
      </div>` : ''}

    <div class="card-footer">
      <p>Ruled by AIJudge &mdash; ${formatDate(data.timestamp)}</p>
      <p class="disclaimer">This is an AI-generated ruling for entertainment purposes only.</p>
      <p class="url">https://0xmortuex.github.io/AIJudge/</p>
    </div>
  `;

  // Animate fills after render
  requestAnimationFrame(() => {
    card.querySelectorAll('[data-width]').forEach(el => {
      el.style.width = el.dataset.width + '%';
    });
  });
}
