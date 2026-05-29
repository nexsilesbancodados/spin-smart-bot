// Roleta Vision AI — Background service worker
// Recebe números capturados pelo content script e despacha ao webhook Supabase.
// Não executa apostas. Não toma decisões. Apenas repassa dados.

const WEBHOOK = 'https://wyhvrblozyblbqogikoz.supabase.co/functions/v1/webhook-roulette';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5aHZyYmxvenlibGJxb2dpa296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTA1MzgsImV4cCI6MjA5MDMyNjUzOH0.DGwZhzapdySHGb6mtDvMI_w7KEiSp_-kmvwOHoUR1bM';
const NUMBERS_KEY = 'rv_numbers';
const PAUSED_KEY = 'rv_paused';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([PAUSED_KEY], (r) => {
    if (r[PAUSED_KEY] === undefined) chrome.storage.local.set({ [PAUSED_KEY]: false });
  });
  console.log('[RV-BG] Roleta Vision AI capture v6 installed');
});

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.type === 'NUMBER_CAPTURED') {
    chrome.storage.local.get([PAUSED_KEY], (r) => {
      if (r[PAUSED_KEY]) {
        respond({ ok: false, paused: true });
        return;
      }
      fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON },
        body: JSON.stringify({ number: msg.number, source: 'extension', timestamp: Date.now() }),
      })
        .then((r) => respond({ ok: r.ok }))
        .catch((e) => respond({ ok: false, error: e.message }));

      chrome.storage.local.get([NUMBERS_KEY], (r2) => {
        const arr = r2[NUMBERS_KEY] || [];
        arr.unshift({ number: msg.number, time: new Date().toISOString() });
        chrome.storage.local.set({ [NUMBERS_KEY]: arr.slice(0, 500) });
      });
    });
    return true;
  }

  if (msg.type === 'GET_STATUS') {
    chrome.storage.local.get([NUMBERS_KEY, PAUSED_KEY], (r) => {
      respond({
        numbers: (r[NUMBERS_KEY] || []).slice(0, 20),
        total: (r[NUMBERS_KEY] || []).length,
        paused: !!r[PAUSED_KEY],
      });
    });
    return true;
  }

  if (msg.type === 'SET_PAUSED') {
    chrome.storage.local.set({ [PAUSED_KEY]: !!msg.value }, () => respond({ ok: true }));
    return true;
  }

  if (msg.type === 'CLEAR_LOG') {
    chrome.storage.local.set({ [NUMBERS_KEY]: [] }, () => respond({ ok: true }));
    return true;
  }
});
