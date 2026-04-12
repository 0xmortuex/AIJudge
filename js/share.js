import { showToast } from './app.js';

export function initShare() {
  document.getElementById('btn-share').addEventListener('click', generateShareImage);
  document.getElementById('share-close').addEventListener('click', closeShareOverlay);
  document.getElementById('btn-download-img').addEventListener('click', downloadImage);
  document.getElementById('btn-copy-img').addEventListener('click', copyImage);

  // Close on backdrop click
  document.getElementById('share-overlay').addEventListener('click', e => {
    if (e.target.id === 'share-overlay') closeShareOverlay();
  });
}

let currentBlob = null;
let currentFilename = '';

async function generateShareImage() {
  const card = document.getElementById('verdict-card');
  if (!card) return;

  showToast('Generating ruling image...');

  try {
    // Create a container for rendering
    const container = document.getElementById('share-render-container');
    const clone = card.cloneNode(true);
    clone.style.width = '600px';
    clone.style.background = '#10121a';
    clone.style.border = '2px solid #d4a017';
    clone.style.borderRadius = '12px';
    clone.style.overflow = 'hidden';

    // Reset animations on clone
    clone.querySelectorAll('*').forEach(el => {
      el.style.animation = 'none';
      el.style.opacity = '1';
      el.style.transform = 'none';
    });

    // Set fill widths directly
    clone.querySelectorAll('[data-width]').forEach(el => {
      el.style.width = el.dataset.width + '%';
    });

    container.innerHTML = '';
    container.appendChild(clone);

    const canvas = await html2canvas(clone, {
      backgroundColor: '#10121a',
      scale: 2,
      useCORS: true,
      logging: false,
      width: 600,
    });

    container.innerHTML = '';

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    currentBlob = blob;

    // Extract case number for filename
    const caseNum = card.querySelector('.case-number');
    const num = caseNum ? caseNum.textContent.replace('Case No. ', '').trim() : 'ruling';
    currentFilename = `aijudge-ruling-${num}.png`;

    // Show preview
    const previewImg = document.getElementById('share-preview-img');
    previewImg.src = URL.createObjectURL(blob);
    previewImg.onload = () => URL.revokeObjectURL(previewImg.src);

    document.getElementById('share-overlay').classList.add('active');
  } catch (err) {
    console.error('Share generation failed:', err);
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
    data.roast ? `\nTHE COURT OBSERVES: ${data.roast}` : '',
    data.advice ? `\nRECOMMENDATION: ${data.advice}` : '',
    ``,
    `Ruled by AIJudge - https://0xmortuex.github.io/AIJudge/`,
  ].filter(Boolean).join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('Ruling copied to clipboard!');
  }).catch(() => {
    showToast('Failed to copy. Try again.');
  });
}
