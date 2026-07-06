const STORAGE_KEY = 'aijudge_history';
const MAX_RULINGS = 20;

export function saveRuling(data) {
  const history = getRulings();
  history.unshift(data);
  if (history.length > MAX_RULINGS) history.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function getRulings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function deleteRuling(index) {
  const history = getRulings();
  history.splice(index, 1);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function clearAllRulings() {
  localStorage.removeItem(STORAGE_KEY);
}

function formatShortDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export function renderHistoryPanel(onSelect) {
  const list = document.getElementById('history-list');
  const footer = document.getElementById('history-footer');
  const rulings = getRulings();

  if (!rulings.length) {
    list.innerHTML = '<div class="history-empty">No past rulings yet. Submit your first case!</div>';
    footer.style.display = 'none';
    return;
  }

  footer.style.display = 'block';

  list.innerHTML = rulings.map((r, i) => `
    <div class="history-item" data-index="${i}" style="--i:${i}">
      <button class="history-delete" data-delete="${i}" title="Delete" type="button">&times;</button>
      <div class="history-item-title">${escHtml(r.caseTitle)}</div>
      <div class="history-item-meta">
        <span class="history-item-verdict">${escHtml(r.verdictText || '').substring(0, 60)}</span>
        <span class="history-item-date">${formatShortDate(r.timestamp)}</span>
      </div>
      <div class="history-item-badges">
        <span class="badge badge-severity ${escHtml(r.severityLevel)}" style="font-size:0.62rem;padding:2px 9px;">${escHtml(r.severityLevel)}</span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('.history-delete')) return;
      const idx = parseInt(el.dataset.index, 10);
      onSelect(rulings[idx]);
    });
  });

  list.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.delete, 10);
      deleteRuling(idx);
      renderHistoryPanel(onSelect);
    });
  });
}
