const WEBHOOK_URL_KEY = 'roulette_webhook_url';
const SENT_LOG_KEY = 'roulette_sent_log';
const PAUSED_KEY = 'roulette_tracker_paused';

// Pre-configured defaults
const DEFAULT_WEBHOOK_URL = 'https://wyhvrblozyblbqogikoz.supabase.co/functions/v1/webhook-roulette';
const DEFAULT_SNIPER_URL = 'https://wyhvrblozyblbqogikoz.supabase.co/functions/v1/sniper-predict';

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
    container.innerHTML = '<div class="empty">Nenhum número capturado ainda</div>';
    return;
  }

  container.innerHTML = log
    .map((item) => {
      const color = getColor(item.number);
      const time = new Date(item.time).toLocaleTimeString('pt-BR');
      return `<div class="log-item">
        <span class="log-num ${color}">${item.number}</span>
        <span class="log-time">${time}</span>
      </div>`;
    })
    .join('');
}

// Load saved state — auto-configure defaults on first run
chrome.storage.local.get([WEBHOOK_URL_KEY, SENT_LOG_KEY, PAUSED_KEY, 'roulette_first_run'], (result) => {
  let url = result[WEBHOOK_URL_KEY] || '';
  const log = result[SENT_LOG_KEY] || [];
  const paused = result[PAUSED_KEY] || false;

  // First run: set defaults
  if (!result['roulette_first_run']) {
    if (!url) {
      url = DEFAULT_WEBHOOK_URL;
      chrome.storage.local.set({ [WEBHOOK_URL_KEY]: url, 'roulette_first_run': true });
    }
    // Also set sniper API default
    chrome.storage.local.get(['roulette_autobet_config'], (r) => {
      const cfg = r['roulette_autobet_config'] || {};
      if (!cfg.apiUrl) {
        cfg.apiUrl = DEFAULT_SNIPER_URL;
        chrome.storage.local.set({ 'roulette_autobet_config': cfg });
      }
    });
  }

  document.getElementById('webhookInput').value = url;
  renderLog(log);

  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const pauseBtn = document.getElementById('pauseBtn');

  if (paused) {
    statusDot.classList.add('inactive');
    statusText.textContent = '⏸️ Pausado';
    statusText.style.color = '#f59e0b';
    pauseBtn.textContent = '▶️ Retomar Captura';
    pauseBtn.className = 'btn btn-primary';
  } else if (url) {
    statusDot.classList.add('active');
    statusText.textContent = 'Monitorando...';
    statusText.style.color = '#00ff88';
    pauseBtn.textContent = '⏸️ Pausar Captura';
    pauseBtn.className = 'btn btn-warning';
  } else {
    statusDot.classList.add('inactive');
    statusText.textContent = 'Configure o webhook';
    statusText.style.color = '#ff4444';
    pauseBtn.textContent = '⏸️ Pausar Captura';
    pauseBtn.className = 'btn btn-warning';
  }
});

// Pause/Resume
document.getElementById('pauseBtn').addEventListener('click', () => {
  chrome.storage.local.get([PAUSED_KEY], (result) => {
    const newPaused = !(result[PAUSED_KEY] || false);
    chrome.storage.local.set({ [PAUSED_KEY]: newPaused }, () => {
      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');
      const pauseBtn = document.getElementById('pauseBtn');
      statusDot.className = 'status-dot';

      if (newPaused) {
        statusDot.classList.add('inactive');
        statusText.textContent = '⏸️ Pausado';
        statusText.style.color = '#f59e0b';
        pauseBtn.textContent = '▶️ Retomar Captura';
        pauseBtn.className = 'btn btn-primary';
      } else {
        statusDot.classList.add('active');
        statusText.textContent = 'Monitorando...';
        statusText.style.color = '#00ff88';
        pauseBtn.textContent = '⏸️ Pausar Captura';
        pauseBtn.className = 'btn btn-warning';
      }
    });
  });
});

// Save webhook
document.getElementById('saveBtn').addEventListener('click', () => {
  const url = document.getElementById('webhookInput').value.trim();
  chrome.storage.local.set({ [WEBHOOK_URL_KEY]: url }, () => {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    statusDot.className = 'status-dot';

    if (url) {
      statusDot.classList.add('active');
      statusText.textContent = 'Monitorando...';
      statusText.style.color = '#00ff88';
    } else {
      statusDot.classList.add('inactive');
      statusText.textContent = 'Configure o webhook';
      statusText.style.color = '#ff4444';
    }

    document.getElementById('saveBtn').textContent = '✅ Salvo!';
    setTimeout(() => {
      document.getElementById('saveBtn').textContent = 'Salvar';
    }, 1500);
  });
});

// Clear log
document.getElementById('clearBtn').addEventListener('click', () => {
  chrome.storage.local.set({ [SENT_LOG_KEY]: [] }, () => {
    renderLog([]);
  });
});

// Test button
document.getElementById('testBtn').addEventListener('click', () => {
  const url = document.getElementById('webhookInput').value.trim();
  if (!url) {
    alert('Configure o webhook URL primeiro!');
    return;
  }

  const testNum = Math.floor(Math.random() * 37);
  const btn = document.getElementById('testBtn');
  btn.textContent = `Enviando ${testNum}...`;
  btn.disabled = true;

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: testNum }),
  })
    .then((res) => {
      if (res.ok) {
        btn.textContent = `✅ Enviou ${testNum}!`;
        // Add to local log
        chrome.storage.local.get([SENT_LOG_KEY], (result) => {
          const log = result[SENT_LOG_KEY] || [];
          log.unshift({ number: testNum, time: new Date().toISOString() });
          chrome.storage.local.set({ [SENT_LOG_KEY]: log.slice(0, 50) }, () => {
            renderLog(log.slice(0, 50));
          });
        });
      } else {
        btn.textContent = `❌ Erro ${res.status}`;
      }
    })
    .catch((err) => {
      btn.textContent = '❌ Falha na conexão';
    })
    .finally(() => {
      setTimeout(() => {
        btn.textContent = '🧪 Enviar Número Teste';
        btn.disabled = false;
      }, 2000);
    });
});

// Auto-refresh log every 3 seconds
setInterval(() => {
  chrome.storage.local.get([SENT_LOG_KEY], (result) => {
    renderLog(result[SENT_LOG_KEY] || []);
  });
}, 3000);
