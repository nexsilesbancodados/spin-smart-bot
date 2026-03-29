// Background Service Worker — keeps extension alive and manages alarms
chrome.runtime.onInstalled.addListener(() => {
  console.log('[RoulettePro] Extension installed v2.0');
  
  // Set defaults on first install
  chrome.storage.local.get(['roulette_first_run'], (result) => {
    if (!result['roulette_first_run']) {
      chrome.storage.local.set({
        'roulette_first_run': true,
        'roulette_webhook_url': 'https://wyhvrblozyblbqogikoz.supabase.co/functions/v1/webhook-roulette',
        'roulette_autobet_config': {
          apiUrl: 'https://wyhvrblozyblbqogikoz.supabase.co/functions/v1/sniper-predict',
          betValue: 1,
          stopLoss: -50,
          stopWin: 100,
          minProbability: 85,
          useGale: false,
          maxGaleSteps: 3,
          galeFactor: 2,
          enabled: false,
        },
      });
    }
  });
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'NUMBER_CAPTURED') {
    // Forward to webhook
    chrome.storage.local.get(['roulette_webhook_url', 'roulette_tracker_paused'], (result) => {
      if (result['roulette_tracker_paused']) return;
      const url = result['roulette_webhook_url'];
      if (!url) return;

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: msg.number, source: 'extension', timestamp: Date.now() }),
      })
        .then(res => {
          if (res.ok) {
            // Log success
            chrome.storage.local.get(['roulette_sent_log'], (r) => {
              const log = r['roulette_sent_log'] || [];
              log.unshift({ number: msg.number, time: new Date().toISOString(), status: 'ok' });
              chrome.storage.local.set({ 'roulette_sent_log': log.slice(0, 100) });
            });
          }
          sendResponse({ ok: res.ok });
        })
        .catch(err => {
          console.error('[RoulettePro] Webhook error:', err);
          sendResponse({ ok: false, error: err.message });
        });
    });
    return true; // async sendResponse
  }

  if (msg.type === 'BET_RESULT') {
    // Update autobet stats
    chrome.storage.local.get(['roulette_autobet_stats', 'roulette_autobet_config'], (result) => {
      const stats = result['roulette_autobet_stats'] || { totalBets: 0, wins: 0, losses: 0, profit: 0, currentGaleStep: 0, consecutiveLosses: 0, stopped: false, stopReason: '' };
      const config = result['roulette_autobet_config'] || {};

      if (msg.won) {
        stats.wins++;
        stats.profit += msg.profit;
        stats.currentGaleStep = 0;
        stats.consecutiveLosses = 0;
      } else {
        stats.losses++;
        stats.profit -= msg.cost;
        stats.consecutiveLosses++;
        if (config.useGale && stats.currentGaleStep < (config.maxGaleSteps || 3)) {
          stats.currentGaleStep++;
        } else {
          stats.currentGaleStep = 0;
        }
      }

      if (stats.profit <= (config.stopLoss || -50)) {
        stats.stopped = true;
        stats.stopReason = `Stop Loss: R$${stats.profit.toFixed(2)}`;
        config.enabled = false;
        chrome.storage.local.set({ 'roulette_autobet_config': config });
      }
      if (stats.profit >= (config.stopWin || 100)) {
        stats.stopped = true;
        stats.stopReason = `Stop Win: R$${stats.profit.toFixed(2)}`;
        config.enabled = false;
        chrome.storage.local.set({ 'roulette_autobet_config': config });
      }

      chrome.storage.local.set({ 'roulette_autobet_stats': stats });
      sendResponse({ ok: true, stats });
    });
    return true;
  }
});
