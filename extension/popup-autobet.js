const AB_CONFIG_KEY = 'roulette_autobet_config';
const AB_STATS_KEY = 'roulette_autobet_stats';
const AB_LOG_KEY = 'roulette_autobet_log';

function loadAutobetUI() {
  chrome.storage.local.get([AB_CONFIG_KEY, AB_STATS_KEY, AB_LOG_KEY], (result) => {
    const config = result[AB_CONFIG_KEY] || {};
    const stats = result[AB_STATS_KEY] || {};
    const log = result[AB_LOG_KEY] || [];

    const el = (id) => document.getElementById(id);
    if (el('ab-apiUrl')) el('ab-apiUrl').value = config.apiUrl || '';
    if (el('ab-betValue')) el('ab-betValue').value = config.betValue || 1;
    if (el('ab-stopLoss')) el('ab-stopLoss').value = config.stopLoss || -50;
    if (el('ab-stopWin')) el('ab-stopWin').value = config.stopWin || 100;
    if (el('ab-minProb')) el('ab-minProb').value = config.minProbability || 85;
    if (el('ab-gale')) {
      el('ab-gale').checked = config.useGale || false;
      const galeOpts = el('gale-options');
      if (galeOpts) galeOpts.style.display = config.useGale ? 'flex' : 'none';
    }
    if (el('ab-maxGale')) el('ab-maxGale').value = config.maxGaleSteps || 3;
    if (el('ab-galeFactor')) el('ab-galeFactor').value = config.galeFactor || 2;

    // Toggle button
    const toggleBtn = el('ab-toggle');
    if (toggleBtn) {
      if (config.enabled) {
        toggleBtn.textContent = '🛑 Desativar Bot';
        toggleBtn.className = 'btn btn-danger';
      } else {
        toggleBtn.textContent = '🤖 Ativar Bot';
        toggleBtn.className = 'btn btn-success';
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
      profitEl.className = `stat-value ${p >= 0 ? 'green' : 'red'}`;
    }

    const stopEl = el('ab-stop-reason');
    if (stopEl) {
      if (stats.stopped) {
        stopEl.textContent = `⚠️ ${stats.stopReason || 'Bot parado'}`;
        stopEl.style.display = 'block';
      } else {
        stopEl.style.display = 'none';
      }
    }

    // Log
    const logContainer = el('ab-log');
    if (logContainer) {
      if (log.length === 0) {
        logContainer.innerHTML = '<div class="empty-state">Nenhuma aposta automática</div>';
      } else {
        const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
        logContainer.innerHTML = log.slice(0, 20).map((item) => {
          const time = new Date(item.time).toLocaleTimeString('pt-BR');
          const color = item.number === 0 ? 'green' : RED.includes(item.number) ? 'red' : 'black';
          return `<div class="log-item">
            <span class="num-ball ${color}">${item.number}</span>
            <span style="color:#888;font-size:10px;">R$${item.betAmount} · ${item.probability}%</span>
            ${item.galeStep > 0 ? `<span style="color:#f59e0b;font-size:9px;font-weight:700;">G${item.galeStep}</span>` : ''}
            <span class="log-time">${time}</span>
          </div>`;
        }).join('');
      }
    }
  });
}

function setupAutobetEvents() {
  const el = (id) => document.getElementById(id);

  const saveBtn = el('ab-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const newConfig = {
        apiUrl: el('ab-apiUrl')?.value?.trim() || '',
        betValue: parseFloat(el('ab-betValue')?.value) || 1,
        stopLoss: parseFloat(el('ab-stopLoss')?.value) || -50,
        stopWin: parseFloat(el('ab-stopWin')?.value) || 100,
        minProbability: parseInt(el('ab-minProb')?.value) || 85,
        useGale: el('ab-gale')?.checked || false,
        maxGaleSteps: parseInt(el('ab-maxGale')?.value) || 3,
        galeFactor: parseFloat(el('ab-galeFactor')?.value) || 2,
      };

      chrome.storage.local.get([AB_CONFIG_KEY], (result) => {
        newConfig.enabled = result[AB_CONFIG_KEY]?.enabled || false;
        chrome.storage.local.set({ [AB_CONFIG_KEY]: newConfig }, () => {
          saveBtn.textContent = '✅ Salvo!';
          setTimeout(() => { saveBtn.textContent = '💾 Salvar Config'; }, 1500);
        });
      });
    });
  }

  const toggleBtn = el('ab-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      chrome.storage.local.get([AB_CONFIG_KEY], (result) => {
        const config = result[AB_CONFIG_KEY] || {};
        if (!config.apiUrl) {
          alert('Configure a URL da API Sniper primeiro!');
          return;
        }
        config.enabled = !config.enabled;
        if (config.enabled) {
          // Reset stop state when re-enabling
          chrome.storage.local.get([AB_STATS_KEY], (sr) => {
            const stats = sr[AB_STATS_KEY] || {};
            if (stats.stopped) {
              stats.stopped = false;
              stats.stopReason = '';
              chrome.storage.local.set({ [AB_STATS_KEY]: stats });
            }
          });
        }
        chrome.storage.local.set({ [AB_CONFIG_KEY]: config }, () => loadAutobetUI());
      });
    });
  }

  const resetBtn = el('ab-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const fresh = {
        totalBets: 0, wins: 0, losses: 0, profit: 0,
        sessionStart: null, currentGaleStep: 0,
        lastBetAmount: 0, consecutiveLosses: 0,
        stopped: false, stopReason: '',
      };
      chrome.storage.local.set({ [AB_STATS_KEY]: fresh, [AB_LOG_KEY]: [] }, () => loadAutobetUI());
    });
  }
}

// Auto-refresh stats
setInterval(() => {
  if (document.getElementById('tab-autobet')?.classList.contains('active')) {
    loadAutobetUI();
  }
}, 3000);

window.loadAutobetUI = loadAutobetUI;
window.setupAutobetEvents = setupAutobetEvents;
