const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const colorOf = (n) => (n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black');

const dot = document.getElementById('statusDot');
const text = document.getElementById('statusText');
const count = document.getElementById('statusCount');
const log = document.getElementById('log');
const toggleBtn = document.getElementById('toggleBtn');
const clearBtn = document.getElementById('clearBtn');

function render({ numbers, total, paused }) {
  if (paused) {
    dot.className = 'dot paused';
    text.textContent = 'Pausado';
    toggleBtn.textContent = 'Retomar';
  } else {
    dot.className = 'dot on';
    text.textContent = 'Monitorando';
    toggleBtn.textContent = 'Pausar';
  }
  count.textContent = `${total} capturados`;

  if (!numbers || numbers.length === 0) {
    log.innerHTML = '<div class="empty">Nenhum número capturado ainda.<br />Abra uma mesa de roleta na aba ativa.</div>';
    return;
  }
  log.innerHTML = numbers
    .map((item) => `<div class="num ${colorOf(item.number)}" title="${new Date(item.time).toLocaleTimeString('pt-BR')}">${item.number}</div>`)
    .join('');
}

function refresh() {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, render);
}

toggleBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (s) => {
    chrome.runtime.sendMessage({ type: 'SET_PAUSED', value: !s.paused }, refresh);
  });
});

clearBtn.addEventListener('click', () => {
  if (!confirm('Limpar todos os giros capturados localmente?')) return;
  chrome.runtime.sendMessage({ type: 'CLEAR_LOG' }, refresh);
});

chrome.storage.onChanged.addListener(refresh);
refresh();
