// Roleta Vision AI — Content Script v6
// Captura números da roleta por múltiplas estratégias. Apenas ingestão.
(function () {
  'use strict';
  const DEBOUNCE = 2800;
  let lastNum = null, lastTime = 0;
  const WEBHOOK = 'https://wyhvrblozyblbqogikoz.supabase.co/functions/v1/webhook-roulette';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5aHZyYmxvenlibGJxb2dpa296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTA1MzgsImV4cCI6MjA5MDMyNjUzOH0.DGwZhzapdySHGb6mtDvMI_w7KEiSp_-kmvwOHoUR1bM';

  function send(n) {
    const now = Date.now();
    if (n === lastNum && now - lastTime < DEBOUNCE) return;
    lastNum = n; lastTime = now;
    console.log('[RV-Content] Número capturado:', n);

    // 1. Webhook Supabase
    fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON },
      body: JSON.stringify({ number: n, source: 'extension', timestamp: Date.now() }),
    }).catch(() => {});

    // 2. Background service worker
    try { chrome.runtime.sendMessage({ type: 'NUMBER_CAPTURED', number: n }); } catch {}

    // 3. Notificar autobet.js no mesmo frame
    if (window._rtCheckResult) window._rtCheckResult(n);

    // 4. Notificar frame pai (app React)
    window.postMessage({ type: 'NUMBER_FROM_EXTENSION', number: n }, '*');
    try { window.parent?.postMessage({ type: 'NUMBER_FROM_EXTENSION', number: n }, '*'); } catch {}
    try { window.top?.postMessage({ type: 'NUMBER_FROM_EXTENSION', number: n }, '*'); } catch {}

    // 5. Salvar localmente
    chrome.storage.local.get(['ssb_numbers'], r => {
      const arr = r['ssb_numbers'] || [];
      arr.unshift({ number: n, time: new Date().toISOString() });
      chrome.storage.local.set({ 'ssb_numbers': arr.slice(0, 500) });
    });
  }

  function extract(el) {
    if (!el) return null;
    const v = el.getAttribute?.('data-result') || el.getAttribute?.('data-number') ||
              el.getAttribute?.('data-value') || el.textContent?.trim();
    if (!v) return null;
    const n = parseInt(v.replace(/\s/g, ''), 10);
    return (!isNaN(n) && n >= 0 && n <= 36) ? n : null;
  }

  function scan(el) {
    const SELS = [
      '.result-number','.roulette-result','.winning-number','.game-result',
      '[data-result]','[data-winning-number]','.winNumber','.resultNumber',
      '.rng-result','.game-result-number','.number--result','.historyItem',
      '.roulette-history__item','.last-result','.board-result',
      '[class*="winningNumber"]','[class*="resultNumber"]','[class*="lastResult"]',
      // Playtech específicos
      '[class*="RouletteResult"]','[class*="rouletteResult"]',
      '[class*="WinNumber"]','[class*="winNumber"]',
    ];
    for (const sel of SELS) {
      const matches = el.matches?.(sel) ? [el] : (el.querySelectorAll?.(sel) || []);
      for (const m of matches) { const n = extract(m); if (n !== null) { send(n); return; } }
    }
    const n = extract(el);
    if (n !== null) send(n);
  }

  // DOM Observer
  new MutationObserver(muts => {
    for (const m of muts) {
      for (const node of m.addedNodes) { if (node.nodeType === 1) scan(node); }
      if (m.type === 'attributes' && m.target?.nodeType === 1) scan(m.target);
    }
  }).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['data-result','data-number','data-value','class'],
  });

  // Interceptar Fetch
  const _fetch = window.fetch;
  window.fetch = async (...args) => {
    const res = await _fetch.apply(window, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
      const kw = ['roulette','spin','result','round','game','winning','history'];
      if (kw.some(k => url.toLowerCase().includes(k))) {
        const clone = res.clone();
        clone.json().then(fromPayload).catch(() => {});
      }
    } catch {}
    return res;
  };

  // Interceptar XHR
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, url) { this._url = url; return _open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function() {
    this.addEventListener('load', function() {
      try {
        const kw = ['roulette','spin','result','round','game','winning'];
        if (kw.some(k => (this._url||'').toLowerCase().includes(k))) fromPayload(JSON.parse(this.responseText));
      } catch {}
    });
    return _send.apply(this, arguments);
  };

  // Interceptar WebSocket
  const _WS = window.WebSocket;
  window.WebSocket = function(...a) {
    const ws = new _WS(...a);
    ws.addEventListener('message', evt => {
      try {
        const d = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data;
        fromPayload(d);
      } catch {
        const m = String(evt.data||'').match(/(?:result|number|winning)[:\s=]?\s*(\d{1,2})/i);
        if (m) { const n = parseInt(m[1]); if (n >= 0 && n <= 36) send(n); }
      }
    });
    return ws;
  };
  Object.assign(window.WebSocket, {CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3});
  window.WebSocket.prototype = _WS.prototype;

  function fromPayload(d) {
    if (!d) return;
    const fields = [d.number,d.result,d.winningNumber,d.winning_number,d.n,d.value,
      d.lastResult,d.last_result,d?.gameResult?.number,d?.game_result?.number,
      d?.data?.number,d?.data?.result,d?.roundResult?.number,d?.payload?.number];
    for (const v of fields) {
      if (typeof v === 'number' && v >= 0 && v <= 36) { send(v); return; }
      if (typeof v === 'string') { const n = parseInt(v); if (!isNaN(n) && n >= 0 && n <= 36) { send(n); return; } }
    }
    for (const arr of [d.results,d.history,d.lastResults,d?.data?.results,d?.data?.history]) {
      if (Array.isArray(arr) && arr.length > 0) {
        const first = arr[0];
        const n = typeof first === 'number' ? first : (first?.number ?? first?.result ?? parseInt(first));
        if (typeof n === 'number' && n >= 0 && n <= 36) { send(n); return; }
      }
    }
  }

  // Scan periódico (fallback)
  setInterval(() => {
    const SELS = '.result-number,.winning-number,.roulette-result,[data-result],[data-number],.winNumber,.resultNumber,.historyItem,[class*="winningNumber"],[class*="resultNumber"]';
    const el = document.querySelector(SELS);
    if (el) { const n = extract(el); if (n !== null) send(n); }
  }, 2000);

  window._rtSendNumber = send;
  console.log('[RV-Content] Roleta Vision AI capture ativo:', window.location.href);
})();
