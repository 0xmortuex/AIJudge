import { judgeArgument } from './api.js';
import { parseRuling } from './parser.js';
import { renderVerdict } from './ruling.js';
import { initShare, copyRulingText } from './share.js';
import { saveRuling, renderHistoryPanel, clearAllRulings } from './history.js';

const MIN_DELIBERATION_MS = 1300;
const STATUS_LINES = [
  'Reviewing the arguments…',
  'Weighing the evidence…',
  'Consulting precedent…',
  'Preparing the ruling…',
];

let currentRuling = null;
let currentArgument = '';
let statusTimer = null;

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  initShare();
  bindEvents();
});

function bindEvents() {
  document.getElementById('judge-form').addEventListener('submit', handleSubmit);
  document.getElementById('submit-btn').addEventListener('pointerdown', spawnRipple);

  document.getElementById('argument-input').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('judge-form').dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });

  document.querySelectorAll('.example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const input = document.getElementById('argument-input');
      input.value = chip.dataset.text;
      input.focus();
    });
  });

  document.getElementById('btn-copy').addEventListener('click', () => {
    if (currentRuling) copyRulingText(currentRuling);
  });

  document.getElementById('btn-appeal').addEventListener('click', handleAppeal);
  document.getElementById('btn-new').addEventListener('click', () => switchState('intake'));
  document.getElementById('top-new-case').addEventListener('click', () => switchState('intake'));

  document.getElementById('history-link').addEventListener('click', openHistory);
  document.getElementById('top-history').addEventListener('click', openHistory);
  document.getElementById('history-close-btn').addEventListener('click', closeHistory);
  document.getElementById('history-backdrop').addEventListener('click', closeHistory);
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    clearAllRulings();
    renderHistoryPanel(loadHistoryRuling);
  });
}

// === Form submit ===
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
  await runJudgment(text);
}

async function handleAppeal() {
  if (!currentArgument) return;
  await runJudgment(currentArgument, { isAppeal: true });
}

async function runJudgment(text, { isAppeal = false } = {}) {
  switchState('deliberation');
  startStatusCycle();

  try {
    const [raw] = await Promise.all([
      judgeArgument(text),
      delay(MIN_DELIBERATION_MS),
    ]);
    const ruling = parseRuling(raw);
    currentRuling = ruling;
    saveRuling(ruling);
    renderVerdict(ruling);
    stopStatusCycle();
    switchState('verdict', { dramatic: true });
    if (isAppeal) showToast('A fresh ruling has been handed down.');
  } catch (err) {
    stopStatusCycle();
    switchState('intake');
    showError(err.message || 'Something went wrong. Please try again.');
    if (isAppeal) showToast('Appeal failed: ' + (err.message || 'Try again.'));
  }
}

function startStatusCycle() {
  const el = document.getElementById('deliberation-status');
  let i = 0;
  el.textContent = STATUS_LINES[0];
  function tick() {
    i = (i + 1) % STATUS_LINES.length;
    el.textContent = STATUS_LINES[i];
    statusTimer = setTimeout(tick, 1500);
  }
  statusTimer = setTimeout(tick, 1500);
}

function stopStatusCycle() {
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = null;
}

// === State machine: intake / deliberation / verdict ===
function getStateEl(name) {
  return document.getElementById(`state-${name}`);
}

function switchState(name, { dramatic = false } = {}) {
  const stage = document.getElementById('stage');
  const current = document.querySelector('.state.active');
  const next = getStateEl(name);
  if (!next || current === next) return;

  function finalize() {
    if (current) {
      current.classList.remove('active', 'entering', 'exiting');
      current.style.display = 'none';
    }
    next.style.display = 'flex';
    next.classList.add('active');
    stage.dataset.state = name;

    if (!prefersReducedMotion()) {
      next.classList.add('entering');
      const handler = ev => {
        if (ev.target !== next || ev.animationName !== 'stateFadeIn') return;
        next.classList.remove('entering');
        next.removeEventListener('animationend', handler);
      };
      next.addEventListener('animationend', handler);
    }

    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    if (name === 'intake') {
      const input = document.getElementById('argument-input');
      if (input) input.focus();
    }
  }

  if (dramatic) {
    playGavelOverlay(finalize);
    return;
  }

  if (current && !prefersReducedMotion()) {
    current.classList.add('exiting');
    const handler = ev => {
      if (ev.target !== current || ev.animationName !== 'stateFadeOut') return;
      current.removeEventListener('animationend', handler);
      finalize();
    };
    current.addEventListener('animationend', handler);
  } else {
    finalize();
  }
}

function playGavelOverlay(cb) {
  const overlay = document.getElementById('gavel-overlay');
  if (prefersReducedMotion()) {
    cb();
    return;
  }
  overlay.classList.add('active');
  // Swap the underlying state while the overlay is fully opaque (roughly its
  // midpoint), so the verdict is already revealed the instant the flash clears.
  setTimeout(cb, 470);
  const handler = ev => {
    if (ev.target !== overlay || ev.animationName !== 'overlayFade') return;
    overlay.classList.remove('active');
    overlay.removeEventListener('animationend', handler);
  };
  overlay.addEventListener('animationend', handler);
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
  renderVerdict(ruling);
  switchState('verdict');
}

// === Ripple micro-interaction ===
function spawnRipple(e) {
  if (prefersReducedMotion()) return;

  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.4;
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

  btn.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

// === UI helpers ===
function showError(msg) {
  const el = document.getElementById('error-message');
  el.textContent = msg;
  el.classList.add('active');
}

function hideError() {
  document.getElementById('error-message').classList.remove('active');
}

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
