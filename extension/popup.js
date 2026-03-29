const WEBHOOK_URL_KEY = 'roulette_webhook_url';
const SENT_LOG_KEY = 'roulette_sent_log';
const PAUSED_KEY = 'roulette_tracker_paused';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
function getColor(n) {
  if (n === 0) return 'green';
  return RED_NUMBERS.includes(n) ? 'red' : 'black';
}

function renderLog(log) {
  const container = document.getElementById('logContainer');
  const countEl = document.getElementById('totalCount');
  countEl.textContent = log.length;

  if (log.length === 0) {
    container.innerHTML = '<div class="empty-state">Nenhum número capturado ainda</div>';
    return;
  }

  container.innerHTML = log.slice(0, 50).map((item) => {
    const color = getColor(item.number);
    const time = new Date(item.time).toLocaleTimeString('pt-BR');
    const status = item.status === 'ok' ? '<span class="log-status ok">✓</span>' : item.status === 'err' ? '<span class="log-status err">✗</span>' : '';
    return `<div class="log-item">
      <span class="num-ball ${color}">${item.number}</span>
      ${status}
      <span class="log-time">${time}</span>
    </div>`;
  }).join('');
}

function updateStatus(url, paused) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const pauseBtn = document.getElementById('pauseBtn');
  
  dot.className = 'pulse-dot';
  
  if (paused) {
    dot.classList.add('paused');
    text.textContent = '⏸️ Pausado';
    text.style.color = '#f59e0b';
    pauseBtn.textContent = '▶️ Retomar';
    pauseBtn.className = 'btn btn-success';
  } else if (url) {
    dot.classList.add('on');
    text.textContent = '🟢 Monitorando...';
    text.style.color = '#00e5ff';
    pauseBtn.textContent = '⏸️ Pausar';
    pauseBtn.className = 'btn btn-pink';
  } else {
    dot.classList.add('off');
    text.textContent = '⚠️ Configure o webhook';
    text.style.color = '#ff4455';
    pauseBtn.textContent = '⏸️ Pausar';
    pauseBtn.className = 'btn btn-pink';
  }
}

// Init
chrome.storage.local.get([WEBHOOK_URL_KEY, SENT_LOG_KEY, PAUSED_KEY], (result) => {
  const url = result[WEBHOOK_URL_KEY] || '';
  const log = result[SENT_LOG_KEY] || [];
  const paused = result[PAUSED_KEY] || false;

  document.getElementById('webhookInput').value = url;
  renderLog(log);
  updateStatus(url, paused);
});

// Pause/Resume
document.getElementById('pauseBtn').addEventListener('click', () => {
  chrome.storage.local.get([PAUSED_KEY, WEBHOOK_URL_KEY], (result) => {
    const newPaused = !(result[PAUSED_KEY] || false);
    chrome.storage.local.set({ [PAUSED_KEY]: newPaused }, () => {
      updateStatus(result[WEBHOOK_URL_KEY] || '', newPaused);
    });
  });
});

// Save
document.getElementById('saveBtn').addEventListener('click', () => {
  const url = document.getElementById('webhookInput').value.trim();
  chrome.storage.local.set({ [WEBHOOK_URL_KEY]: url }, () => {
    updateStatus(url, false);
    const btn = document.getElementById('saveBtn');
    btn.textContent = '✅ Salvo!';
    setTimeout(() => { btn.textContent = '💾 Salvar'; }, 1500);
  });
});

// Clear
document.getElementById('clearBtn').addEventListener('click', () => {
  chrome.storage.local.set({ [SENT_LOG_KEY]: [] }, () => renderLog([]));
});

// Test
document.getElementById('testBtn').addEventListener('click', () => {
  const url = document.getElementById('webhookInput').value.trim();
  if (!url) { alert('Configure o webhook URL primeiro!'); return; }

  const testNum = Math.floor(Math.random() * 37);
  const btn = document.getElementById('testBtn');
  btn.textContent = `⏳ ${testNum}...`;
  btn.disabled = true;

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: testNum, source: 'test', timestamp: Date.now() }),
  })
    .then((res) => {
      btn.textContent = res.ok ? `✅ ${testNum}!` : `❌ ${res.status}`;
      if (res.ok) {
        chrome.storage.local.get([SENT_LOG_KEY], (result) => {
          const log = result[SENT_LOG_KEY] || [];
          log.unshift({ number: testNum, time: new Date().toISOString(), status: 'ok' });
          chrome.storage.local.set({ [SENT_LOG_KEY]: log.slice(0, 100) }, () => renderLog(log.slice(0, 100)));
        });
      }
    })
    .catch(() => { btn.textContent = '❌ Falha'; })
    .finally(() => {
      setTimeout(() => { btn.textContent = '🧪 Teste'; btn.disabled = false; }, 2000);
    });
});

// Auto-refresh
setInterval(() => {
  chrome.storage.local.get([SENT_LOG_KEY], (r) => renderLog(r[SENT_LOG_KEY] || []));
}, 3000);
