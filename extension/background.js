// SPIN SMART BOT — Background Service Worker v2
const WEBHOOK = 'https://wyhvrblozyblbqogikoz.supabase.co/functions/v1/webhook-roulette';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5aHZyYmxvenlibGJxb2dpa296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTA1MzgsImV4cCI6MjA5MDMyNjUzOH0.DGwZhzapdySHGb6mtDvMI_w7KEiSp_-kmvwOHoUR1bM';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['ssb_installed'], r => {
    if (!r['ssb_installed']) {
      chrome.storage.local.set({
        'ssb_installed': true,
        'ssb_config_v4': {
          enabled: false, betValue: 1, stopLoss: -100, stopWin: 200,
          minProbability: 50, minConfirmations: 2,
          useGale: false, maxGaleSteps: 2, galeFactor: 2, autoBetDelay: 900,
        },
      });
    }
  });
  console.log('[SSB-BG] Instalado v4');
});

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === 'NUMBER_CAPTURED') {
    // Enviar ao Supabase webhook
    fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON },
      body: JSON.stringify({ number: msg.number, source: 'extension', timestamp: Date.now() }),
    })
    .then(r => respond({ ok: r.ok }))
    .catch(e => respond({ ok: false, error: e.message }));

    // Salvar localmente
    chrome.storage.local.get(['ssb_numbers'], r => {
      const arr = r['ssb_numbers'] || [];
      arr.unshift({ number: msg.number, time: new Date().toISOString() });
      chrome.storage.local.set({ 'ssb_numbers': arr.slice(0, 500) });
    });
    return true;
  }

  if (msg.type === 'GET_STATS') {
    chrome.storage.local.get(['ssb_stats_v4','ssb_config_v4','ssb_numbers'], r => {
      respond({ stats: r['ssb_stats_v4']||{}, config: r['ssb_config_v4']||{}, numbers: (r['ssb_numbers']||[]).slice(0,10) });
    });
    return true;
  }

  if (msg.type === 'SET_CONFIG') {
    chrome.storage.local.set({ 'ssb_config_v4': msg.config }, () => respond({ ok: true }));
    return true;
  }

  if (msg.type === 'RESET_STATS') {
    const emptyStats = { totalBets:0,wins:0,losses:0,profit:0,currentGaleStep:0,lastBetNumbers:[],lastBetAmount:0,consecutiveLosses:0,stopped:false,stopReason:'',waitingResult:false,lastBetTs:0 };
    chrome.storage.local.set({ 'ssb_stats_v4': emptyStats }, () => respond({ ok: true }));
    return true;
  }
});
