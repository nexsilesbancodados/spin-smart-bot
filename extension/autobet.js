// Roulette Auto-Bet Module
// Reads sniper signals and places bets with human-like behavior

(function () {
  const CONFIG_KEY = 'roulette_autobet_config';
  const STATS_KEY = 'roulette_autobet_stats';
  const AUTOBET_ACTIVE_KEY = 'roulette_autobet_active';

  let config = {
    enabled: false,
    apiUrl: '', // URL do painel sniper (supabase edge function)
    betValue: 1.0,
    stopLoss: -50,
    stopWin: 100,
    minProbability: 85,
    useGale: false,
    maxGaleSteps: 3,
    galeFactor: 2.0,
  };

  let stats = {
    totalBets: 0,
    wins: 0,
    losses: 0,
    profit: 0,
    sessionStart: null,
    currentGaleStep: 0,
    lastBetAmount: 0,
    consecutiveLosses: 0,
    stopped: false,
    stopReason: '',
  };

  let isPlacingBet = false;
  let pollInterval = null;

  // Load config
  chrome.storage.local.get([CONFIG_KEY, STATS_KEY], (result) => {
    if (result[CONFIG_KEY]) Object.assign(config, result[CONFIG_KEY]);
    if (result[STATS_KEY]) Object.assign(stats, result[STATS_KEY]);
    console.log('[AutoBet] Config loaded, enabled:', config.enabled);
    if (config.enabled && !stats.stopped) startPolling();
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes[CONFIG_KEY]) {
      const newConfig = changes[CONFIG_KEY].newValue || {};
      const wasEnabled = config.enabled;
      Object.assign(config, newConfig);

      if (config.enabled && !wasEnabled) {
        stats.stopped = false;
        stats.stopReason = '';
        saveStats();
        startPolling();
      } else if (!config.enabled && wasEnabled) {
        stopPolling();
      }
    }
    if (changes[AUTOBET_ACTIVE_KEY] && !changes[AUTOBET_ACTIVE_KEY].newValue) {
      stopPolling();
    }
  });

  function saveStats() {
    chrome.storage.local.set({ [STATS_KEY]: stats });
  }

  function saveConfig() {
    chrome.storage.local.set({ [CONFIG_KEY]: config });
  }

  // =============================================
  // HUMAN-LIKE MOUSE/CLICK SIMULATION
  // =============================================

  function randomDelay(min, max) {
    return new Promise((resolve) =>
      setTimeout(resolve, min + Math.random() * (max - min))
    );
  }

  function humanClick(element) {
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
    const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);

    // Simulate mousemove -> mouseover -> mousedown -> mouseup -> click
    const events = ['mousemove', 'mouseover', 'mouseenter', 'mousedown', 'mouseup', 'click'];
    for (const type of events) {
      const evt = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0,
      });
      element.dispatchEvent(evt);
    }
  }

  // =============================================
  // BET PLACEMENT SELECTORS (Onabet/Playtech)
  // =============================================

  const SELECTORS = {
    // Chip/value selectors - common patterns in live casino UIs
    chipButtons: [
      '.chip-button', '.chip', '.bet-chip',
      '[data-chip]', '[data-value]',
      '.stake-button', '.denomination',
    ],
    // Number buttons on the roulette board
    numberButtons: [
      '.bet-spot[data-number]',
      '.number-spot[data-number]',
      '.roulette-number[data-number]',
      '[data-bet-spot]',
      'td[data-number]',
      '.cell[data-number]',
    ],
    // Confirm/place bet
    confirmButtons: [
      '.confirm-bet', '.place-bet', '.bet-confirm',
      'button[data-action="confirm"]',
      '.submit-bet', '.ok-button',
      '#confirmBet', '#placeBet',
    ],
    // Repeat/double bet
    repeatButtons: [
      '.repeat-bet', '.rebet', '.double-bet',
    ],
    // Clear bet
    clearButtons: [
      '.clear-bet', '.undo-bet', '.cancel-bet',
    ],
    // Bet input field (some UIs have a text input)
    betInput: [
      'input[data-bet-amount]', 'input.bet-amount',
      'input.stake-input', '#betAmount',
    ],
  };

  function findElement(selectorList) {
    for (const sel of selectorList) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el; // visible element
    }
    return null;
  }

  function findNumberButton(number) {
    // Try data attributes first
    const dataSelectors = [
      `[data-number="${number}"]`,
      `[data-bet-spot="${number}"]`,
      `[data-value="${number}"]`,
      `td[data-number="${number}"]`,
    ];

    for (const sel of dataSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }

    // Try text content match
    const allCells = document.querySelectorAll('td, .cell, .number-spot, .bet-spot');
    for (const cell of allCells) {
      if (cell.textContent?.trim() === String(number)) {
        return cell;
      }
    }

    return null;
  }

  // =============================================
  // BETTING LOGIC
  // =============================================

  async function placeBet(targetNumber, neighbors, probability) {
    if (isPlacingBet || stats.stopped) return;
    isPlacingBet = true;

    console.log(`[AutoBet] 🎯 Placing bet on ${targetNumber} + neighbors [${neighbors}] (${probability}%)`);

    try {
      // Calculate bet amount (with Gale if active)
      let betAmount = config.betValue;
      if (config.useGale && stats.currentGaleStep > 0) {
        betAmount = config.betValue * Math.pow(config.galeFactor, stats.currentGaleStep);
        console.log(`[AutoBet] Gale step ${stats.currentGaleStep}, bet: R$${betAmount.toFixed(2)}`);
      }

      // Step 1: Small random delay before acting (human behavior)
      await randomDelay(300, 900);

      // Step 2: Click on the target number
      const allNumbers = [targetNumber, ...neighbors];
      for (const num of allNumbers) {
        const btn = findNumberButton(num);
        if (btn) {
          await randomDelay(150, 500);
          humanClick(btn);
          console.log(`[AutoBet] Clicked number ${num}`);
        } else {
          console.warn(`[AutoBet] Number button ${num} not found`);
        }
      }

      // Step 3: Wait a bit before confirming (human delay)
      await randomDelay(500, 1500);

      // Step 4: Try to confirm
      const confirmBtn = findElement(SELECTORS.confirmButtons);
      if (confirmBtn) {
        humanClick(confirmBtn);
        console.log('[AutoBet] ✅ Bet confirmed');
      } else {
        console.warn('[AutoBet] ⚠️ Confirm button not found, bet may auto-submit');
      }

      // Record the bet
      stats.totalBets++;
      stats.lastBetAmount = betAmount * allNumbers.length;
      saveStats();

      // Log to extension storage
      chrome.storage.local.get(['roulette_autobet_log'], (result) => {
        const log = result['roulette_autobet_log'] || [];
        log.unshift({
          time: new Date().toISOString(),
          number: targetNumber,
          neighbors,
          betAmount,
          probability,
          galeStep: stats.currentGaleStep,
        });
        chrome.storage.local.set({ 'roulette_autobet_log': log.slice(0, 100) });
      });

    } catch (err) {
      console.error('[AutoBet] Error placing bet:', err);
    } finally {
      isPlacingBet = false;
    }
  }

  // =============================================
  // RESULT TRACKING (win/loss)
  // =============================================

  function checkResult(resultNumber) {
    if (stats.totalBets === 0) return;

    // Get last bet from log
    chrome.storage.local.get(['roulette_autobet_log'], (result) => {
      const log = result['roulette_autobet_log'] || [];
      if (log.length === 0) return;

      const lastBet = log[0];
      const allNumbers = [lastBet.number, ...(lastBet.neighbors || [])];
      const won = allNumbers.includes(resultNumber);

      if (won) {
        // Straight up pays 35:1
        const payout = lastBet.betAmount * 35;
        const cost = lastBet.betAmount * allNumbers.length;
        stats.profit += payout - cost;
        stats.wins++;
        stats.currentGaleStep = 0;
        stats.consecutiveLosses = 0;
        console.log(`[AutoBet] 🟢 WIN! Number ${resultNumber}. Profit: R$${stats.profit.toFixed(2)}`);
      } else {
        const cost = lastBet.betAmount * allNumbers.length;
        stats.profit -= cost;
        stats.losses++;
        stats.consecutiveLosses++;

        if (config.useGale && stats.currentGaleStep < config.maxGaleSteps) {
          stats.currentGaleStep++;
          console.log(`[AutoBet] 🔴 LOSS. Gale step → ${stats.currentGaleStep}`);
        } else {
          stats.currentGaleStep = 0;
          console.log(`[AutoBet] 🔴 LOSS. Max gale reached, reset.`);
        }
      }

      // Check stop conditions
      if (stats.profit <= config.stopLoss) {
        stats.stopped = true;
        stats.stopReason = `Stop Loss atingido: R$${stats.profit.toFixed(2)}`;
        config.enabled = false;
        saveConfig();
        stopPolling();
        console.log(`[AutoBet] 🛑 STOP LOSS! ${stats.stopReason}`);
      }

      if (stats.profit >= config.stopWin) {
        stats.stopped = true;
        stats.stopReason = `Stop Win atingido: R$${stats.profit.toFixed(2)}`;
        config.enabled = false;
        saveConfig();
        stopPolling();
        console.log(`[AutoBet] 🏆 STOP WIN! ${stats.stopReason}`);
      }

      saveStats();
    });
  }

  // Hook into the existing number detection to track results
  const originalSendNumber = window._rtSendNumber;
  window._rtCheckResult = checkResult;

  // =============================================
  // SNIPER SIGNAL POLLING
  // =============================================

  async function fetchSniperSignal() {
    if (!config.apiUrl || stats.stopped || isPlacingBet) return;

    try {
      const res = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) return;
      const data = await res.json();

      if (data.mode === 'sniper' && data.signal) {
        const prob = data.signal.probability || 0;
        if (prob >= config.minProbability) {
          console.log(`[AutoBet] 🎯 SNIPER SIGNAL: ${data.signal.number} (${prob}%)`);
          await placeBet(data.signal.number, data.signal.neighbors || [], prob);
        }
      }
    } catch (err) {
      console.error('[AutoBet] Polling error:', err);
    }
  }

  function startPolling() {
    if (pollInterval) return;
    stats.sessionStart = stats.sessionStart || new Date().toISOString();
    saveStats();
    pollInterval = setInterval(fetchSniperSignal, 3000);
    console.log('[AutoBet] 🟢 Polling started');
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    console.log('[AutoBet] 🔴 Polling stopped');
  }

  console.log('[AutoBet] 🤖 Auto-bet module loaded');
})();
