const WEBHOOK_KEY='roulette_webhook_url';const LOG_KEY='roulette_sent_log';const PAUSED_KEY='roulette_tracker_paused';
const SNIPER_URL='https://wyhvrblozyblbqogikoz.supabase.co/functions/v1/sniper-predict';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5aHZyYmxvenlibGJxb2dpa296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTA1MzgsImV4cCI6MjA5MDMyNjUzOH0.DGwZhzapdySHGb6mtDvMI_w7KEiSp_-kmvwOHoUR1bM';
const RED=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
function getColor(n){return n===0?'green':RED.includes(n)?'red':'black';}

let sniperSignal=null;let refreshInterval=null;

function renderLog(log){
  const c=document.getElementById('logContainer');
  const cnt=document.getElementById('totalCount');
  if(cnt) cnt.textContent=log.length;
  if(!c) return;
  if(log.length===0){c.innerHTML='<div class="empty-state">Nenhum número capturado</div>';return;}
  c.innerHTML=log.slice(0,40).map(item=>{
    const color=getColor(item.number);
    const time=new Date(item.time).toLocaleTimeString('pt-BR');
    return `<div class="log-item"><span class="num-ball ${color}">${item.number}</span><span class="log-time">${time}</span></div>`;
  }).join('');
}

function updateStatus(url,paused){
  const dot=document.getElementById('statusDot');
  const text=document.getElementById('statusText');
  const pauseBtn=document.getElementById('pauseBtn');
  if(!dot) return;
  dot.className='pulse-dot';
  if(paused){dot.classList.add('paused');text.textContent='⏸️ Pausado';text.style.color='#f59e0b';if(pauseBtn){pauseBtn.textContent='▶️ Retomar';pauseBtn.className='btn btn-success';}}
  else if(url){dot.classList.add('on');text.textContent='🟢 Monitorando...';text.style.color='#00e5ff';if(pauseBtn){pauseBtn.textContent='⏸️ Pausar';pauseBtn.className='btn btn-pink';}}
  else{dot.classList.add('off');text.textContent='⚠️ Configure webhook';text.style.color='#ff4455';}
}

async function fetchSniperSignal(){
  try{
    const r=await fetch(SNIPER_URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':ANON},body:JSON.stringify({sampleSize:100})});
    if(!r.ok) return;
    const data=await r.json();
    sniperSignal=data;
    renderSniperPanel(data);
  }catch(e){console.error('Sniper fetch error:',e);}
}

function renderSniperPanel(data){
  const panel=document.getElementById('sniper-panel');
  if(!panel) return;
  if(!data||!data.signal||!data.strategy){
    panel.innerHTML='<div class="empty-state">Aguardando sinal...</div>';return;
  }
  const num=data.signal.number;
  const prob=data.signal.probability||0;
  const confs=data.signal.confirmations||0;
  const nums=data.strategy.numbers||[];
  const color=getColor(num);
  const isHot=prob>=65||confs>=3;
  const isMed=prob>=50||confs>=2;

  const levelLabel=isHot?'⚡ ENTRAR FORTE':isMed?'✅ ENTRAR':'⚠️ AGUARDAR';
  const levelColor=isHot?'#00ff88':isMed?'#00e5ff':'#f59e0b';
  const fichas=isHot?'8-12 fichas':isMed?'5-7 fichas':'1-3 fichas';

  const cdTags=[];
  if(data.signal.confirmationDetail?.pull) cdTags.push('🧲Puxada');
  if(data.signal.confirmationDetail?.autoRep) cdTags.push(`🔁Rep${data.signal.confirmationDetail.recentCount}x`);
  if(data.signal.confirmationDetail?.matriz) cdTags.push('🔢Matriz');
  if(data.signal.confirmationDetail?.ensemble) cdTags.push('🌟Ens');

  panel.innerHTML=`
<div style="background:#12121e;border:1px solid ${isHot?'#00ff8830':'#00e5ff20'};border-radius:10px;padding:12px;margin-bottom:10px;">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
    <div class="num-ball ${color}" style="width:48px;height:48px;font-size:18px;font-weight:900;flex-shrink:0;">${num}</div>
    <div style="flex:1;">
      <div style="font-size:16px;font-weight:900;color:${levelColor};">${levelLabel}</div>
      <div style="font-size:10px;color:#555;margin-top:2px;">${fichas} · ${nums.length} números</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:22px;font-weight:900;font-family:monospace;color:${levelColor};">${prob}%</div>
      <div style="font-size:9px;color:#555;">${confs} fontes</div>
    </div>
  </div>
  ${cdTags.length>0?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${cdTags.map(t=>`<span style="font-size:8px;padding:2px 6px;background:#ffffff10;border-radius:4px;color:#aaa;">${t}</span>`).join('')}</div>`:''}
  <div style="margin-bottom:8px;">
    <div style="font-size:8px;color:#555;margin-bottom:4px;">Apostar em:</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;">${nums.slice(0,10).map(n=>{const c=getColor(n);const isMain=n===num;return `<span class="num-ball ${c}" style="width:${isMain?'32px':'26px'};height:${isMain?'32px':'26px'};font-size:${isMain?'12px':'10px'};${isMain?'box-shadow:0 0 8px rgba(0,255,136,0.4);':''}">${n}</span>`;}).join('')}</div>
  </div>
  <div style="background:#0d0d15;border-radius:8px;padding:8px;font-size:9px;color:#555;line-height:1.4;">${(data.strategy.justification||'').slice(0,120)}...</div>
</div>
<button id="bet-now-btn" style="width:100%;padding:12px;border:none;border-radius:8px;background:linear-gradient(135deg,${isHot?'#00ff88,#00cc6a':'#00e5ff,#00b4d8'});color:#000;font-size:13px;font-weight:900;cursor:pointer;letter-spacing:0.5px;" onclick="sendBetToPage(${JSON.stringify(nums)},${prob})">
  ${isHot?'⚡ APOSTAR AGORA':'✅ ENVIAR PARA O APP'}
</button>`;
}

async function sendBetToPage(nums,prob){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab) return;
  chrome.tabs.sendMessage(tab.id,{type:'SNIPER_BET_SIGNAL',numbers:nums,probability:prob,betAmount:1});
  const btn=document.getElementById('bet-now-btn');
  if(btn){btn.textContent='✅ Enviado!';btn.style.background='#00ff8850';setTimeout(()=>{if(sniperSignal)renderSniperPanel(sniperSignal);},2000);}
}

// Init
chrome.storage.local.get([WEBHOOK_KEY,LOG_KEY,PAUSED_KEY],result=>{
  const url=result[WEBHOOK_KEY]||'';
  const log=result[LOG_KEY]||[];
  const paused=result[PAUSED_KEY]||false;
  if(document.getElementById('webhookInput')) document.getElementById('webhookInput').value=url;
  renderLog(log);
  updateStatus(url,paused);
});

// Botões
const pauseBtn=document.getElementById('pauseBtn');
if(pauseBtn) pauseBtn.addEventListener('click',()=>{
  chrome.storage.local.get([PAUSED_KEY,WEBHOOK_KEY],result=>{
    const newPaused=!(result[PAUSED_KEY]||false);
    chrome.storage.local.set({[PAUSED_KEY]:newPaused},()=>updateStatus(result[WEBHOOK_KEY]||'',newPaused));
  });
});

const saveBtn=document.getElementById('saveBtn');
if(saveBtn) saveBtn.addEventListener('click',()=>{
  const url=(document.getElementById('webhookInput')||{}).value||'';
  chrome.storage.local.set({[WEBHOOK_KEY]:url},()=>updateStatus(url,false));
});

const clearBtn=document.getElementById('clearBtn');
if(clearBtn) clearBtn.addEventListener('click',()=>{
  chrome.storage.local.set({[LOG_KEY]:[]},()=>renderLog([]));
});

const testBtn=document.getElementById('testBtn');
if(testBtn) testBtn.addEventListener('click',async()=>{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(tab) chrome.tabs.sendMessage(tab.id,{type:'TEST_CAPTURE'});
});

// Listen for live numbers
chrome.storage.onChanged.addListener(changes=>{
  if(changes[LOG_KEY]) renderLog(changes[LOG_KEY].newValue||[]);
});

// Buscar sinal quando aba sniper é aberta
document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    if(tab.dataset.tab==='sniper'){
      fetchSniperSignal();
      if(refreshInterval) clearInterval(refreshInterval);
      refreshInterval=setInterval(fetchSniperSignal,15000);
    } else {
      if(refreshInterval){clearInterval(refreshInterval);refreshInterval=null;}
    }
  });
});
