import { judgeArgument } from './api.js';
import { parseRuling } from './parser.js';
import { renderVerdict } from './ruling.js';
import { initShare, copyRulingText } from './share.js';
import { saveRuling, renderHistoryPanel, clearAllRulings } from './history.js';

let currentRuling = null;
let currentArgument = '';

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  initShare();
  bindEvents();
});

function bindEvents() {
  // Form submit
  document.getElementById('judge-form').addEventListener('submit', handleSubmit);

  // Ctrl+Enter shortcut
  document.getElementById('argument-input').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('judge-form').dispatchEvent(new Event('submit'));
    }
  });

  // Example chips
  document.querySelectorAll('.example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('argument-input').value = chip.dataset.text;
      document.getElementById('argument-input').focus();
    });
  });

  // Action buttons
  document.getElementById('btn-copy').addEventListener('click', () => {
    if (currentRuling) copyRulingText(currentRuling);
  });

  document.getElementById('btn-appeal').addEventListener('click', handleAppeal);
  document.getElementById('btn-new').addEventListener('click', showInputView);
  document.getElementById('top-new-case').addEventListener('click', showInputView);

  // History
  document.getElementById('history-link').addEventListener('click', openHistory);
  document.getElementById('top-history').addEventListener('click', openHistory);
  document.getElementById('history-close-btn').addEventListener('click', closeHistory);
  document.getElementById('history-backdrop').addEventListener('click', closeHistory);
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    clearAllRulings();
    renderHistoryPanel(loadHistoryRuling);
  });
}

// === Form Submit ===
async function handleSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('argument-input');
  const text = input.value.trim();

  if (text.length < 10) {
    showError('Please describe the argument in more detail (at least 10 characters).');
    return;
  }

  currentArgument = text;
  hideError();
  setLoading(true);

  try {
    const raw = await judgeArgument(text);
    const ruling = parseRuling(raw);
    currentRuling = ruling;
    saveRuling(ruling);
    showVerdictView(ruling);
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
}

// === Appeal ===
async function handleAppeal() {
  if (!currentArgument) return;

  showToast('Case appealed \u2014 new ruling incoming...');
  document.getElementById('btn-appeal').disabled = true;

  try {
    const raw = await judgeArgument(currentArgument);
    const ruling = parseRuling(raw);
    currentRuling = ruling;
    saveRuling(ruling);
    renderVerdict(ruling);
    showToast('New ruling delivered!');
  } catch (err) {
    showToast('Appeal failed: ' + (err.message || 'Try again.'));
  } finally {
    document.getElementById('btn-appeal').disabled = false;
  }
}

// === View Management ===
function showInputView() {
  document.getElementById('input-view').style.display = 'flex';
  document.getElementById('verdict-view').classList.remove('active');
  document.getElementById('argument-input').focus();
}

function showVerdictView(ruling) {
  const inputView = document.getElementById('input-view');
  const verdictView = document.getElementById('verdict-view');
  const overlay = document.getElementById('verdict-overlay');

  inputView.style.display = 'none';

  // Dramatic entrance
  overlay.classList.add('active');

  setTimeout(() => {
    overlay.classList.remove('active');
    verdictView.classList.add('active');
    renderVerdict(ruling);
    verdictView.scrollTo({ top: 0 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, 1200);
}

// === History ===
function openHistory() {
  renderHistoryPanel(loadHistoryRuling);
  document.getElementById('history-panel').classList.add('active');
  document.getElementById('history-backdrop').classList.add('active');
}

function closeHistory() {
  document.getElementById('history-panel').classList.remove('active');
  document.getElementById('history-backdrop').classList.remove('active');
}

function loadHistoryRuling(ruling) {
  closeHistory();
  currentRuling = ruling;
  currentArgument = '';

  document.getElementById('input-view').style.display = 'none';
  const verdictView = document.getElementById('verdict-view');
  verdictView.classList.add('active');
  renderVerdict(ruling);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// === UI Helpers ===
function setLoading(loading) {
  const btn = document.getElementById('submit-btn');
  const loadingEl = document.getElementById('loading-state');

  btn.disabled = loading;
  btn.querySelector('.btn-text').textContent = loading ? 'Deliberating...' : 'Judge This';

  if (loading) {
    loadingEl.classList.add('active');
  } else {
    loadingEl.classList.remove('active');
  }
}

function showError(msg) {
  const el = document.getElementById('error-message');
  el.textContent = msg;
  el.classList.add('active');
}

function hideError() {
  document.getElementById('error-message').classList.remove('active');
}

// === Toast (exported) ===
export function showToast(message) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3000);
}
