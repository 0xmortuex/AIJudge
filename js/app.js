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
const REEVAL_STATUS_LINES = [
  'The court takes a brief recess…',
  'Re-reading the case file…',
  'Weighing the new testimony…',
  'Revising the ruling…',
];

let currentRuling = null;
let currentArgument = '';
let statusTimer = null;
let addendumMode = 'appeal';

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

  document.getElementById('btn-appeal').addEventListener('click', () => openAddendum('appeal'));
  document.getElementById('btn-new').addEventListener('click', () => switchState('intake'));
  document.getElementById('top-new-case').addEventListener('click', () => switchState('intake'));

  // The "Answer the Court" button lives inside the re-rendered verdict card,
  // so listen on the card itself.
  document.getElementById('verdict-card').addEventListener('click', e => {
    if (e.target.closest('.btn-answer-question')) openAddendum('answer');
  });

  document.getElementById('addendum-close').addEventListener('click', closeAddendum);
  document.getElementById('addendum-cancel').addEventListener('click', closeAddendum);
  document.getElementById('addendum-submit').addEventListener('click', submitAddendum);
  document.getElementById('addendum-overlay').addEventListener('click', e => {
    if (e.target.id === 'addendum-overlay') closeAddendum();
  });
  document.getElementById('addendum-input').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      submitAddendum();
    }
  });

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

// === Addendum modal: appeal details & answering the court ===
function openAddendum(mode) {
  if (!currentArgument) {
    showToast('This ruling has no case file on record to reopen.');
    return;
  }

  addendumMode = mode;
  const title = document.getElementById('addendum-title');
  const hint = document.getElementById('addendum-hint');
  const quote = document.getElementById('addendum-question');
  const input = document.getElementById('addendum-input');
  const submit = document.getElementById('addendum-submit');

  if (mode === 'answer') {
    title.innerHTML = '&#9993;&#65039; Answer the Court';
    hint.textContent = 'The court needs clarification before it can rule with confidence. Your answer will be entered into the record and the case re-evaluated.';
    quote.textContent = currentRuling && currentRuling.clarifyingQuestion ? currentRuling.clarifyingQuestion : '';
    quote.style.display = quote.textContent ? 'block' : 'none';
    input.placeholder = 'Enter your answer to the court’s question…';
    submit.innerHTML = '&#9993;&#65039; Submit Answer';
  } else {
    title.innerHTML = '&#128260; File an Appeal';
    hint.textContent = 'Present anything the court may have missed — additional arguments, context, or the other side’s perspective. Leave it empty to simply request a fresh ruling.';
    quote.style.display = 'none';
    input.placeholder = 'Additional arguments or details for the court… (optional)';
    submit.innerHTML = '&#128260; Submit Appeal';
  }

  input.value = '';
  hideAddendumError();
  document.getElementById('addendum-overlay').classList.add('active');
  input.focus();
}

function closeAddendum() {
  document.getElementById('addendum-overlay').classList.remove('active');
}

async function submitAddendum() {
  const details = document.getElementById('addendum-input').value.trim();

  if (addendumMode === 'answer') {
    if (details.length < 2) {
      showAddendumError('Please enter an answer for the court.');
      return;
    }
    const question = (currentRuling && currentRuling.clarifyingQuestion) || '';
    closeAddendum();
    const composed = currentArgument
      + `\n\n[THE COURT ASKED FOR CLARIFICATION: "${question}"]`
      + `\n[ANSWER FROM THE PARTIES]\n${details}`;
    await runJudgment(composed, { mode: 'answer' });
    return;
  }

  closeAddendum();
  const composed = details
    ? currentArgument + `\n\n[APPEAL FILED — ADDITIONAL ARGUMENTS FOR THE COURT TO CONSIDER]\n${details}`
    : currentArgument;
  await runJudgment(composed, { mode: 'appeal' });
}

async function runJudgment(text, { mode = 'new' } = {}) {
  const isReevaluation = mode === 'appeal' || mode === 'answer';
  switchState('deliberation');
  startStatusCycle(isReevaluation ? REEVAL_STATUS_LINES : STATUS_LINES);

  try {
    const [raw] = await Promise.all([
      judgeArgument(text),
      delay(MIN_DELIBERATION_MS),
    ]);
    const ruling = parseRuling(raw);
    // Keep the full case file with the ruling so appeals and answers still
    // work after a reload or when reopened from history.
    ruling.argument = text;
    currentRuling = ruling;
    currentArgument = text;
    saveRuling(ruling);
    renderVerdict(ruling);
    stopStatusCycle();
    switchState('verdict', { dramatic: true });
    if (mode === 'appeal') showToast('A fresh ruling has been handed down.');
    if (mode === 'answer') showToast('The court has re-evaluated the case with your answer.');
  } catch (err) {
    stopStatusCycle();
    switchState('intake');
    showError(err.message || 'Something went wrong. Please try again.');
    if (isReevaluation) showToast('Re-evaluation failed: ' + (err.message || 'Try again.'));
  }
}

function startStatusCycle(lines = STATUS_LINES) {
  const el = document.getElementById('deliberation-status');
  let i = 0;
  el.textContent = lines[0];
  function tick() {
    i = (i + 1) % lines.length;
    el.textContent = lines[i];
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
  currentArgument = ruling.argument || '';
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

function showAddendumError(msg) {
  const el = document.getElementById('addendum-error');
  el.textContent = msg;
  el.classList.add('active');
}

function hideAddendumError() {
  document.getElementById('addendum-error').classList.remove('active');
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
