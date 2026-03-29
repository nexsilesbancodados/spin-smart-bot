// Roulette Pro Tracker — Content Script v2
// Multi-strategy number capture with deduplication

(function () {
  const DEBOUNCE_MS = 2500;
  let lastSentNumber = null;
  let lastSentTime = 0;
  const capturedNumbers = new Set();
  const recentNumbers = [];

  function sendNumber(num) {
    const now = Date.now();
    if (num === lastSentNumber && (now - lastSentTime) < DEBOUNCE_MS) return;
    
    // Dedup: skip if we sent this exact number in the last 5 captures
    const recentKey = `${num}-${Math.floor(now / 10000)}`;
    if (capturedNumbers.has(recentKey)) return;
    capturedNumbers.add(recentKey);
    
    // Keep set manageable
    if (capturedNumbers.size > 200) {
      const iter = capturedNumbers.values();
      for (let i = 0; i < 100; i++) {
        capturedNumbers.delete(iter.next().value);
      }
    }

    lastSentNumber = num;
    lastSentTime = now;
    recentNumbers.unshift(num);
    if (recentNumbers.length > 50) recentNumbers.length = 50;

    console.log(`[RoulettePro] 🎯 Número capturado: ${num}`);

    // Send to background for webhook delivery
    try {
      chrome.runtime.sendMessage({ type: 'NUMBER_CAPTURED', number: num });
    } catch (e) {
      // Extension context invalidated, try direct
      console.warn('[RoulettePro] Background unavailable, logging locally');
    }

    // Notify autobet module
    if (window._rtCheckResult) {
      window._rtCheckResult(num);
    }

    // Also store locally for popup display
    chrome.storage.local.get(['roulette_sent_log'], (result) => {
      const log = result['roulette_sent_log'] || [];
      log.unshift({ number: num, time: new Date().toISOString() });
      chrome.storage.local.set({ 'roulette_sent_log': log.slice(0, 100) });
    });
  }

  // === Strategy 1: DOM Mutation Observer ===
  function setupDOMObserver() {
    const selectors = [
      '.result-number', '.roulette-result', '.winning-number',
      '.game-result', '.lastResults .number', '.result-history .number',
      '[data-result]', '[data-number]', '.result',
      '.history-number', '.past-number', '.recent-number', '.number-badge',
      // Playtech / Evolution specific
      '.rng-result', '.game-result-number', '.winNumber',
      '.result__number', '.resultNumber', '.historyItem',
      '.roulette-history__item', '.number--result',
      // Generic table cells with numbers
      '.board-result', '.last-result',
    ];

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check added nodes
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          scanElement(node, selectors);
        }
        // Check attribute changes on existing nodes
        if (mutation.type === 'attributes' && mutation.target?.nodeType === 1) {
          scanElement(mutation.target, selectors);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-result', 'data-number', 'data-value', 'class'],
    });

    // Initial scan
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        const num = extractNumber(el);
        if (num !== null) sendNumber(num);
      });
    }

    console.log('[RoulettePro] DOM Observer active');
  }

  function scanElement(el, selectors) {
    for (const sel of selectors) {
      const matches = el.matches?.(sel) ? [el] : (el.querySelectorAll?.(sel) || []);
      for (const match of matches) {
        const num = extractNumber(match);
        if (num !== null) sendNumber(num);
      }
    }
    // Also check the element itself for number-like content
    const directNum = extractNumber(el);
    if (directNum !== null) sendNumber(directNum);
  }

  function extractNumber(el) {
    const dataVal = el.getAttribute?.('data-result') || el.getAttribute?.('data-number') || el.getAttribute?.('data-value');
    const text = dataVal || el.textContent?.trim();
    if (!text) return null;
    const num = parseInt(text, 10);
    if (!isNaN(num) && num >= 0 && num <= 36 && String(num) === text.replace(/\s/g, '')) {
      return num;
    }
    return null;
  }

  // === Strategy 2: Network Interception (Fetch + XHR) ===
  function setupNetworkInterceptor() {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        if (isRouletteEndpoint(url)) {
          const clone = response.clone();
          clone.json().then(extractFromPayload).catch(() => {});
        }
      } catch {
        // Ignore fetch errors
      }
      return response;
    };

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this._rtUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      this.addEventListener('load', function () {
        try {
          if (isRouletteEndpoint(this._rtUrl)) {
            extractFromPayload(JSON.parse(this.responseText));
          }
        } catch {
          // Ignore XHR errors
        }
      });
      return origSend.apply(this, arguments);
    };

    console.log('[RoulettePro] Network interceptor active');
  }

  function isRouletteEndpoint(url) {
    if (!url) return false;
    const kw = ['roulette', 'game/result', 'round', 'spin', 'history', 'gameState', 'lastResults', 'winningNumber'];
    const lower = url.toLowerCase();
    return kw.some(k => lower.includes(k));
  }

  function extractFromPayload(data) {
    if (!data) return;
    // Direct number fields
    const fields = [
      data.number, data.result, data.winningNumber, data.winning_number,
      data.n, data.value, data.lastResult, data.last_result,
      data?.gameResult?.number, data?.game_result?.number,
      data?.data?.number, data?.data?.result, data?.roundResult?.number,
      data?.payload?.number, data?.payload?.result,
    ];
    for (const val of fields) {
      if (typeof val === 'number' && val >= 0 && val <= 36) { sendNumber(val); return; }
      if (typeof val === 'string') { const n = parseInt(val); if (!isNaN(n) && n >= 0 && n <= 36) { sendNumber(n); return; } }
    }
    // Arrays
    const arrays = [data.results, data.history, data.lastResults, data.last_results, data?.data?.results, data?.data?.history];
    for (const arr of arrays) {
      if (Array.isArray(arr) && arr.length > 0) {
        const first = arr[0];
        const num = typeof first === 'number' ? first : (typeof first === 'object' ? (first?.number ?? first?.result ?? first?.n) : parseInt(first));
        if (typeof num === 'number' && num >= 0 && num <= 36) { sendNumber(num); return; }
      }
    }
  }

  // === Strategy 3: WebSocket Interception ===
  function setupWebSocketInterceptor() {
    const OrigWS = window.WebSocket;
    window.WebSocket = function (...args) {
      const ws = new OrigWS(...args);
      ws.addEventListener('message', (event) => {
        try {
          if (typeof event.data === 'string') {
            try {
              extractFromPayload(JSON.parse(event.data));
            } catch {
              const match = event.data.match(/(?:result|number|winning)[:\s=]?\s*(\d{1,2})/i);
              if (match) {
                const num = parseInt(match[1], 10);
                if (num >= 0 && num <= 36) sendNumber(num);
              }
            }
          }
        } catch {
          // Ignore WS errors
        }
      });
      return ws;
    };
    Object.assign(window.WebSocket, {
      CONNECTING: OrigWS.CONNECTING,
      OPEN: OrigWS.OPEN,
      CLOSING: OrigWS.CLOSING,
      CLOSED: OrigWS.CLOSED,
    });
    window.WebSocket.prototype = OrigWS.prototype;
    console.log('[RoulettePro] WebSocket interceptor active');
  }

  // === Strategy 4: Periodic DOM scan (fallback) ===
  function setupPeriodicScan() {
    setInterval(() => {
      const allEls = document.querySelectorAll(
        '.result-number, .winning-number, .roulette-result, [data-result], [data-number], .game-result, .winNumber, .resultNumber, .historyItem'
      );
      if (allEls.length > 0) {
        const el = allEls[0]; // Most recent result is usually first
        const num = extractNumber(el);
        if (num !== null) sendNumber(num);
      }
    }, 2000);
    console.log('[RoulettePro] Periodic scan active (2s)');
  }

  // Init all strategies
  setupWebSocketInterceptor();
  setupNetworkInterceptor();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { setupDOMObserver(); setupPeriodicScan(); });
  } else {
    setupDOMObserver();
    setupPeriodicScan();
  }

  // Expose for autobet module
  window._rtSendNumber = sendNumber;

  // Repassar postMessages do app para o autobet module
  window.addEventListener('message', function(event) {
    var d = event.data;
    if (!d || typeof d !== 'object') return;

    if (d.type === 'SNIPER_BET_SIGNAL') {
      var frames = document.querySelectorAll('iframe');
      frames.forEach(function(f) {
        try { f.contentWindow.postMessage(d, '*'); } catch(e) {}
      });
    }

    if (d.type === 'NUMBER_CAPTURED_FROM_APP') {
      if (window._rtCheckResult) window._rtCheckResult(d.number);
    }
  });

  // Quando o content.js captura número, notificar também o frame pai
  var origSendNumber = window._rtSendNumber;
  window._rtSendNumber = function(num) {
    if (origSendNumber) origSendNumber(num);
    try { window.parent.postMessage({ type: 'NUMBER_FROM_EXTENSION', number: num }, '*'); } catch(e) {}
  };

  console.log('[RoulettePro] 🎰 v3 active on:', window.location.href);
})();
