import { showToast } from './app.js';
import { finishRulingAnimations } from './ruling.js';

export function initShare() {
  document.getElementById('btn-share').addEventListener('click', generateShareImage);
  document.getElementById('share-close').addEventListener('click', closeShareOverlay);
  document.getElementById('btn-download-img').addEventListener('click', downloadImage);
  document.getElementById('btn-copy-img').addEventListener('click', copyImage);

  document.getElementById('share-overlay').addEventListener('click', e => {
    if (e.target.id === 'share-overlay') closeShareOverlay();
  });
}

let currentBlob = null;
let currentFilename = '';

// Bakes every animated element in `clone` down to its final visual state so
// the exported PNG shows fully-filled scales/bars/gauges, never an empty or
// mid-tween frame. SVG elements are skipped by the blanket reset because an
// inline `style.transform` on an SVG node overrides its `transform`
// *attribute* (the scales' rotate(...) and gauge's arc live there) --
// wiping it would flatten the scales back to level and blank the gauge arc.
function bakeInFinalState(clone) {
  clone.querySelectorAll('*').forEach(el => {
    if (el.closest('svg')) return;
    el.style.animation = 'none';
    el.style.opacity = '1';
    el.style.transform = 'none';
  });

  // Party strength bars: driven by transform:scaleX via data-width.
  clone.querySelectorAll('[data-width]').forEach(el => {
    el.style.transformOrigin = 'left center';
    el.style.transform = `scaleX(${el.dataset.width / 100})`;
  });

  // Severity segments: driven by the .filled class + a CSS transition, which
  // the blanket reset above just overrode with an inline `transform: none`.
  clone.querySelectorAll('.severity-seg').forEach(el => {
    el.style.transformOrigin = 'left center';
    el.style.transform = el.classList.contains('filled') ? 'scaleX(1)' : 'scaleX(0)';
  });
}

async function generateShareImage() {
  const card = document.getElementById('verdict-card');
  if (!card) return;

  // Force the scales/gauge/bars to their settled final values before we
  // snapshot -- if the user shares immediately after the reveal, animations
  // may still be mid-flight.
  finishRulingAnimations();

  const previewImg = document.getElementById('share-preview-img');
  const loadingEl = document.getElementById('share-loading');
  previewImg.style.display = 'none';
  loadingEl.style.display = 'block';
  loadingEl.textContent = 'Preparing certificate…';
  document.getElementById('share-overlay').classList.add('active');

  try {
    const container = document.getElementById('share-render-container');
    const clone = card.cloneNode(true);
    clone.removeAttribute('id');
    clone.classList.add('certificate');

    const brand = document.createElement('div');
    brand.className = 'cert-brand';
    brand.textContent = 'Certificate of Ruling — AIJudge';
    clone.insertBefore(brand, clone.firstChild);

    bakeInFinalState(clone);

    container.innerHTML = '';
    container.appendChild(clone);

    const canvas = await html2canvas(clone, {
      backgroundColor: '#f3ecd9',
      scale: 2,
      useCORS: true,
      logging: false,
      width: clone.offsetWidth,
    });

    container.innerHTML = '';

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    currentBlob = blob;

    const caseNum = card.querySelector('.case-number');
    const num = caseNum ? caseNum.textContent.replace('Case No. ', '').trim() : 'ruling';
    currentFilename = `aijudge-ruling-${num}.png`;

    previewImg.src = URL.createObjectURL(blob);
    previewImg.onload = () => URL.revokeObjectURL(previewImg.src);
    previewImg.style.display = 'block';
    loadingEl.style.display = 'none';
  } catch (err) {
    console.error('Share generation failed:', err);
    loadingEl.textContent = 'Failed to generate the certificate. Try again.';
    showToast('Failed to generate image. Try again.');
  }
}

function downloadImage() {
  if (!currentBlob) return;

  const url = URL.createObjectURL(currentBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = currentFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Ruling saved as image!');
}

async function copyImage() {
  if (!currentBlob) return;

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': currentBlob })
    ]);
    showToast('Ruling copied to clipboard!');
  } catch {
    showToast('Copy not supported in this browser. Use download instead.');
  }
}

function closeShareOverlay() {
  document.getElementById('share-overlay').classList.remove('active');
}

export function copyRulingText(data) {
  const text = [
    `COURT OF AI JUDGMENT`,
    `Case No. ${data.caseNumber}`,
    `${data.caseTitle}`,
    ``,
    `VERDICT: ${data.verdictText}`,
    ``,
    `${data.partyA.name}: ${data.partyA.position} (Strength: ${data.partyA.strengthOfCase}/10)`,
    `${data.partyB.name}: ${data.partyB.position} (Strength: ${data.partyB.strengthOfCase}/10)`,
    ``,
    `REASONING: ${data.reasoning}`,
    data.roast ? `\nNOTE FROM THE BENCH: ${data.roast}` : '',
    data.advice ? `\nADVICE GOING FORWARD: ${data.advice}` : '',
    ``,
    `Ruled by AIJudge - https://0xmortuex.github.io/AIJudge/`,
  ].filter(Boolean).join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('Ruling copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy. Try again.');
  });
}
