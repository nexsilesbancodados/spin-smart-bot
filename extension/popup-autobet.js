// Auto-bet UI logic for popup
const CONFIG_KEY = 'roulette_autobet_config';
const STATS_KEY = 'roulette_autobet_stats';
const LOG_KEY = 'roulette_autobet_log';

function loadAutobetUI() {
  chrome.storage.local.get([CONFIG_KEY, STATS_KEY, LOG_KEY], (result) => {
    const config = result[CONFIG_KEY] || {};
    const stats = result[STATS_KEY] || {};
    const log = result[LOG_KEY] || [];

    // Fill config fields
    const el = (id) => document.getElementById(id);
    if (el('ab-apiUrl')) el('ab-apiUrl').value = config.apiUrl || 'https://wyhvrblozyblbqogikoz.supabase.co/functions/v1/sniper-predict';
    if (el('ab-betValue')) el('ab-betValue').value = config.betValue || 1;
    if (el('ab-stopLoss')) el('ab-stopLoss').value = config.stopLoss || -50;
    if (el('ab-stopWin')) el('ab-stopWin').value = config.stopWin || 100;
    if (el('ab-minProb')) el('ab-minProb').value = config.minProbability || 85;
    if (el('ab-gale')) el('ab-gale').checked = config.useGale || false;
    if (el('ab-maxGale')) el('ab-maxGale').value = config.maxGaleSteps || 3;
    if (el('ab-galeFactor')) el('ab-galeFactor').value = config.galeFactor || 2;

    // Toggle button state
    const toggleBtn = el('ab-toggle');
    if (toggleBtn) {
      if (config.enabled) {
        toggleBtn.textContent = '🛑 Desativar Bot';
        toggleBtn.className = 'btn btn-danger';
      } else {
        toggleBtn.textContent = '🤖 Ativar Bot';
        toggleBtn.className = 'btn btn-primary';
      }
    }

    // Stats
    if (el('ab-stat-bets')) el('ab-stat-bets').textContent = stats.totalBets || 0;
    if (el('ab-stat-wins')) el('ab-stat-wins').textContent = stats.wins || 0;
    if (el('ab-stat-losses')) el('ab-stat-losses').textContent = stats.losses || 0;

    const profitEl = el('ab-stat-profit');
    if (profitEl) {
      const p = stats.profit || 0;
      profitEl.textContent = `R$ ${p.toFixed(2)}`;
      profitEl.style.color = p >= 0 ? '#00ff88' : '#ff4444';
    }

    const stopEl = el('ab-stop-reason');
    if (stopEl) {
      if (stats.stopped) {
        stopEl.textContent = stats.stopReason || 'Bot parado';
        stopEl.style.display = 'block';
      } else {
        stopEl.style.display = 'none';
      }
    }

    // Bet log
    const logContainer = el('ab-log');
    if (logContainer) {
      if (log.length === 0) {
        logContainer.innerHTML = '<div class="empty">Nenhuma aposta automática</div>';
      } else {
        logContainer.innerHTML = log.slice(0, 20).map((item) => {
          const time = new Date(item.time).toLocaleTimeString('pt-BR');
          return `<div class="log-item">
            <span style="color:#fbbf24;font-weight:bold;">${item.number}</span>
            <span style="color:#666;font-size:10px;">[${(item.neighbors||[]).join(',')}]</span>
            <span style="color:#888;font-size:10px;">R$${item.betAmount} ${item.probability}%</span>
            <span class="log-time">${time}</span>
          </div>`;
        }).join('');
      }
    }
  });
}

function setupAutobetEvents() {
  const el = (id) => document.getElementById(id);

  // Save config
  const saveBtn = el('ab-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const config = {
        apiUrl: el('ab-apiUrl')?.value?.trim() || '',
        betValue: parseFloat(el('ab-betValue')?.value) || 1,
        stopLoss: parseFloat(el('ab-stopLoss')?.value) || -50,
        stopWin: parseFloat(el('ab-stopWin')?.value) || 100,
        minProbability: parseInt(el('ab-minProb')?.value) || 85,
        useGale: el('ab-gale')?.checked || false,
        maxGaleSteps: parseInt(el('ab-maxGale')?.value) || 3,
        galeFactor: parseFloat(el('ab-galeFactor')?.value) || 2,
        enabled: false, // Don't auto-enable on save
      };

      // Preserve enabled state
      chrome.storage.local.get([CONFIG_KEY], (result) => {
        config.enabled = result[CONFIG_KEY]?.enabled || false;
        chrome.storage.local.set({ [CONFIG_KEY]: config }, () => {
          saveBtn.textContent = '✅ Salvo!';
          setTimeout(() => { saveBtn.textContent = 'Salvar Config'; }, 1500);
        });
      });
    });
  }

  // Toggle bot
  const toggleBtn = el('ab-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      chrome.storage.local.get([CONFIG_KEY], (result) => {
        const config = result[CONFIG_KEY] || {};
        if (!config.apiUrl) {
          alert('Configure a URL da API Sniper primeiro!');
          return;
        }
        config.enabled = !config.enabled;
        chrome.storage.local.set({ [CONFIG_KEY]: config }, () => {
          loadAutobetUI();
        });
      });
    });
  }

  // Reset stats
  const resetBtn = el('ab-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const fresh = {
        totalBets: 0, wins: 0, losses: 0, profit: 0,
        sessionStart: null, currentGaleStep: 0,
        lastBetAmount: 0, consecutiveLosses: 0,
        stopped: false, stopReason: '',
      };
      chrome.storage.local.set({ [STATS_KEY]: fresh, [LOG_KEY]: [] }, () => {
        loadAutobetUI();
      });
    });
  }
}

// Export for popup.html
window.loadAutobetUI = loadAutobetUI;
window.setupAutobetEvents = setupAutobetEvents;
