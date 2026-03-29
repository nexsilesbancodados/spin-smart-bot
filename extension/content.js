// Roulette Tracker - Content Script for Onabet
// Captures roulette numbers via DOM observation and network interception

(function () {
  const WEBHOOK_URL_KEY = 'roulette_webhook_url';
  const LAST_NUMBERS_KEY = 'roulette_last_numbers';
  const SENT_LOG_KEY = 'roulette_sent_log';
  const PAUSED_KEY = 'roulette_tracker_paused';

  let webhookUrl = '';
  let isPaused = false;
  let lastSentNumber = null;
  let lastSentTime = 0;
  const DEBOUNCE_MS = 3000;

  // Load webhook URL from storage
  chrome.storage.local.get([WEBHOOK_URL_KEY, PAUSED_KEY], (result) => {
    webhookUrl = result[WEBHOOK_URL_KEY] || '';
    isPaused = result[PAUSED_KEY] || false;
    console.log('[RouletteTracker] Loaded webhook URL:', webhookUrl ? '✅ Set' : '❌ Not set', isPaused ? '⏸️ Paused' : '▶️ Active');
  });

  // Listen for config updates
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[WEBHOOK_URL_KEY]) {
      webhookUrl = changes[WEBHOOK_URL_KEY].newValue || '';
      console.log('[RouletteTracker] Webhook URL updated');
    }
    if (changes[PAUSED_KEY]) {
      isPaused = changes[PAUSED_KEY].newValue || false;
      console.log('[RouletteTracker]', isPaused ? '⏸️ Paused' : '▶️ Resumed');
    }
  });

  function sendNumber(num) {
    if (isPaused) {
      console.log('[RouletteTracker] ⏸️ Paused, skipping:', num);
      return;
    }
    const now = Date.now();
    if (num === lastSentNumber && (now - lastSentTime) < DEBOUNCE_MS) {
      return; // Debounce duplicate
    }

    if (!webhookUrl) {
      console.log('[RouletteTracker] No webhook URL configured, skipping:', num);
      return;
    }

    lastSentNumber = num;
    lastSentTime = now;

    const payload = { number: num };

    console.log('[RouletteTracker] 🎯 Sending number:', num);

    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (res.ok) {
          console.log('[RouletteTracker] ✅ Sent successfully:', num);
          logSent(num);
        } else {
          console.error('[RouletteTracker] ❌ Failed:', res.status);
        }
      })
      .catch((err) => console.error('[RouletteTracker] ❌ Error:', err));
  }

  function logSent(num) {
    chrome.storage.local.get([SENT_LOG_KEY], (result) => {
      const log = result[SENT_LOG_KEY] || [];
      log.unshift({ number: num, time: new Date().toISOString() });
      chrome.storage.local.set({ [SENT_LOG_KEY]: log.slice(0, 50) });
    });
  }

  // === Strategy 1: DOM Mutation Observer ===
  // Watches for roulette result numbers appearing in the DOM
  function setupDOMObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          scanForRouletteNumber(node);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[RouletteTracker] DOM Observer started');
  }

  function scanForRouletteNumber(el) {
    // Common selectors used by live casino providers for roulette results
    const selectors = [
      // Playtech common selectors
      '.result-number',
      '.roulette-result',
      '.winning-number',
      '.game-result',
      '.lastResults .number',
      '.result-history .number',
      '[data-result]',
      '[data-number]',
      '.result',
      // Generic number containers in casino UIs
      '.history-number',
      '.past-number',
      '.recent-number',
      '.number-badge',
    ];

    for (const sel of selectors) {
      const matches = el.matches?.(sel) ? [el] : el.querySelectorAll?.(sel) || [];
      for (const match of matches) {
        const text = match.textContent?.trim();
        const dataResult = match.getAttribute?.('data-result') || match.getAttribute?.('data-number');
        const value = dataResult || text;

        if (value !== null && value !== undefined) {
          const num = parseInt(value, 10);
          if (!isNaN(num) && num >= 0 && num <= 36) {
            sendNumber(num);
          }
        }
      }
    }
  }

  // === Strategy 2: XHR/Fetch Interception ===
  // Intercepts network responses that may contain roulette results
  function setupNetworkInterceptor() {
    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      try {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        if (isRouletteEndpoint(url)) {
          const clone = response.clone();
          clone.json().then(extractFromPayload).catch(() => {});
        }
      } catch {}

      return response;
    };

    // Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._rtUrl = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      this.addEventListener('load', function () {
        try {
          if (isRouletteEndpoint(this._rtUrl)) {
            const data = JSON.parse(this.responseText);
            extractFromPayload(data);
          }
        } catch {}
      });
      return originalSend.apply(this, arguments);
    };

    console.log('[RouletteTracker] Network interceptor started');
  }

  function isRouletteEndpoint(url) {
    if (!url) return false;
    const keywords = ['roulette', 'game', 'result', 'round', 'spin', 'history', 'state'];
    const lower = url.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  }

  function extractFromPayload(data) {
    if (!data) return;

    // Try common payload shapes
    const candidates = [
      data.number,
      data.result,
      data.winningNumber,
      data.winning_number,
      data.n,
      data.value,
      data.lastResult,
      data.last_result,
      data?.gameResult?.number,
      data?.game_result?.number,
      data?.data?.number,
      data?.data?.result,
      data?.roundResult?.number,
    ];

    for (const val of candidates) {
      if (typeof val === 'number' && val >= 0 && val <= 36) {
        sendNumber(val);
        return;
      }
    }

    // Check for arrays of results (history)
    const arrays = [data.results, data.history, data.lastResults, data.last_results, data?.data?.results];
    for (const arr of arrays) {
      if (Array.isArray(arr) && arr.length > 0) {
        const first = arr[0];
        const num = typeof first === 'number' ? first : first?.number ?? first?.result ?? first?.n;
        if (typeof num === 'number' && num >= 0 && num <= 36) {
          sendNumber(num);
          return;
        }
      }
    }
  }

  // === Strategy 3: WebSocket Interception ===
  function setupWebSocketInterceptor() {
    const OriginalWebSocket = window.WebSocket;

    window.WebSocket = function (...args) {
      const ws = new OriginalWebSocket(...args);

      ws.addEventListener('message', (event) => {
        try {
          let data;
          if (typeof event.data === 'string') {
            // Try JSON parse
            try {
              data = JSON.parse(event.data);
            } catch {
              // Check for patterns like "result:15" or "number=22"
              const match = event.data.match(/(?:result|number|winning)[:\s=]?\s*(\d{1,2})/i);
              if (match) {
                const num = parseInt(match[1], 10);
                if (num >= 0 && num <= 36) sendNumber(num);
              }
              return;
            }
            extractFromPayload(data);
          }
        } catch {}
      });

      return ws;
    };

    // Copy static properties
    window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    window.WebSocket.OPEN = OriginalWebSocket.OPEN;
    window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
    window.WebSocket.prototype = OriginalWebSocket.prototype;

    console.log('[RouletteTracker] WebSocket interceptor started');
  }

  // Initialize all strategies
  setupWebSocketInterceptor();
  setupNetworkInterceptor();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDOMObserver);
  } else {
    setupDOMObserver();
  }

  console.log('[RouletteTracker] 🎰 Extension active on:', window.location.href);
})();
