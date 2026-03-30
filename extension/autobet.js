// SPIN SMART BOT — AutoBet v4 SUPREMO
// Detecta fase do jogo, aposta automaticamente, resolve resultado
(function () {
  'use strict';
  const CONFIG_KEY = 'ssb_config_v4', STATS_KEY = 'ssb_stats_v4', LOG_KEY = 'ssb_log_v4';
  const SNIPER_URL = 'https://wyhvrblozyblbqogikoz.supabase.co/functions/v1/sniper-predict';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5aHZyYmxvenlibGJxb2dpa296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTA1MzgsImV4cCI6MjA5MDMyNjUzOH0.DGwZhzapdySHGb6mtDvMI_w7KEiSp_-kmvwOHoUR1bM';
  let cfg={enabled:false,betValue:1,stopLoss:-100,stopWin:200,minProbability:50,minConfirmations:2,useGale:false,maxGaleSteps:2,galeFactor:2,autoBetDelay:900};
  let stats={totalBets:0,wins:0,losses:0,profit:0,currentGaleStep:0,lastBetNumbers:[],lastBetAmount:0,consecutiveLosses:0,stopped:false,stopReason:'',waitingResult:false,lastBetTs:0};
  let pendingSignal=null,isPlacingBet=false,bettingOpen=false,pollInterval=null,phaseInterval=null;

  chrome.storage.local.get([CONFIG_KEY,STATS_KEY],res=>{
    if(res[CONFIG_KEY]) Object.assign(cfg,res[CONFIG_KEY]);
    if(res[STATS_KEY])  Object.assign(stats,res[STATS_KEY]);
    if(cfg.enabled&&!stats.stopped) init();
  });
  chrome.storage.onChanged.addListener(changes=>{
    if(!changes[CONFIG_KEY]) return;
    const nc=changes[CONFIG_KEY].newValue||{};
    const was=cfg.enabled; Object.assign(cfg,nc);
    if(cfg.enabled&&!was&&!stats.stopped) init();
    else if(!cfg.enabled&&was) cleanup();
  });

  function save(){ chrome.storage.local.set({[STATS_KEY]:stats,[CONFIG_KEY]:cfg}); }
  function addLog(e){ chrome.storage.local.get([LOG_KEY],r=>{const l=r[LOG_KEY]||[];l.unshift({...e,ts:Date.now()});chrome.storage.local.set({[LOG_KEY]:l.slice(0,300)});}); }
  function ms(b,p){return Math.round(b+(Math.random()*2-1)*b*(p||0.3));}
  function delay(t){return new Promise(r=>setTimeout(r,t));}

  function detectPhase(){
    const txt=(document.body?.innerText||'').toLowerCase();
    const CLOSED=['no more bets','rien ne va plus','sem mais apostas','betting closed','nenhuma aposta'];
    const OPEN=['place your bets','faça suas apostas','placez vos mises','betting open','apostas abertas','make your bets'];
    for(const s of CLOSED) if(txt.includes(s)) return 'closed';
    for(const s of OPEN) if(txt.includes(s)) return 'open';
    const cSels=['[class*="noMoreBets"]','[class*="no-more-bets"]','[class*="bettingClosed"]'];
    const oSels=['[class*="placeYourBets"]','[class*="bettingOpen"]','[class*="place-bets"]'];
    for(const s of cSels) if(document.querySelector(s)) return 'closed';
    for(const s of oSels) if(document.querySelector(s)) return 'open';
    return 'unknown';
  }

  function findNumBtn(n){
    const sels=[`[data-number="${n}"]`,`[data-id="${n}"]`,`[data-bet-type="straight"][data-value="${n}"]`,`[data-position="${n}"]`,`[data-cell="${n}"]`,`.bet-spot[data-number="${n}"]`,`[aria-label="${n}"]`,`[aria-label="Number ${n}"]`,`td[data-number="${n}"]`];
    for(const s of sels){try{const el=document.querySelector(s);if(el&&el.getBoundingClientRect().width>0)return el;}catch{}}
    for(const el of document.querySelectorAll('td,[class*="number"],[class*="spot"],[class*="cell"]')){
      if(el.textContent?.trim()===String(n)&&el.getBoundingClientRect().width>2)return el;
    }
    return null;
  }
  function findChipBtn(v){
    const sels=[`[data-value="${v}"]`,`[data-chip-value="${v}"]`,`[data-denomination="${v}"]`];
    for(const s of sels){const el=document.querySelector(s);if(el&&el.getBoundingClientRect().width>0)return el;}
    let best=null,diff=Infinity;
    for(const c of document.querySelectorAll('[data-value],[data-chip-value],[class*="chip"]')){
      const cv=parseFloat(c.getAttribute('data-value')||c.getAttribute('data-chip-value')||c.textContent||'NaN');
      if(!isNaN(cv)&&Math.abs(cv-v)<diff){diff=Math.abs(cv-v);best=c;}
    }
    return best;
  }
  function findConfirmBtn(){
    const sels=['[data-action="confirm"]','[data-action="place"]','.confirm-bet','[class*="confirmBet"]','[class*="placeBet"]','button[aria-label*="confirm" i]','button[aria-label*="place" i]','button[aria-label*="confirmar" i]'];
    for(const s of sels){const el=document.querySelector(s);if(el&&el.getBoundingClientRect().width>0)return el;}
    return null;
  }

  async function click(el){
    if(!el) return false;
    const r=el.getBoundingClientRect();
    if(!r.width) return false;
    const x=r.left+r.width*(0.3+Math.random()*0.4),y=r.top+r.height*(0.3+Math.random()*0.4);
    const opts={bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0};
    for(const t of['mouseover','mouseenter','mousemove','mousedown','mouseup','click']) el.dispatchEvent(new MouseEvent(t,opts));
    el.click?.();
    return true;
  }

  async function bet(numbers,betAmount,probability){
    if(isPlacingBet||stats.stopped||!cfg.enabled) return false;
    isPlacingBet=true;
    let placed=0;
    try{
      const phase=detectPhase();
      if(phase==='closed'){
        pendingSignal={numbers,betAmount,probability};
        notify('pending',numbers,betAmount,probability);
        return false;
      }
      await delay(ms(cfg.autoBetDelay));
      const input=document.querySelector('input[type="number"],[class*="betInput"],[class*="stakeInput"]');
      if(input){
        const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;
        s?.call(input,String(betAmount));
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
        await delay(200);
      } else {
        const chip=findChipBtn(betAmount);
        if(chip){await click(chip);await delay(ms(350));}
      }
      for(const n of numbers){
        const btn=findNumBtn(n);
        if(btn){await delay(ms(200,0.5));await click(btn);placed++;}
        else console.warn('[SSB] Nº'+n+' não encontrado');
      }
      if(placed===0){notify('error',numbers,betAmount,probability,'Seletores não encontrados');return false;}
      await delay(ms(500,0.3));
      const cb=findConfirmBtn();
      if(cb) await click(cb);
      stats.totalBets++;stats.lastBetNumbers=numbers;stats.lastBetAmount=betAmount;
      stats.waitingResult=true;stats.lastBetTs=Date.now();
      save();addLog({type:'bet',numbers,betAmount,probability,placed});
      notify('bet_placed',numbers,betAmount,probability);
      console.log('[SSB] 🎯 '+placed+'/'+numbers.length+' apostados R$'+betAmount+' '+probability+'%');
      return true;
    }catch(err){
      console.error('[SSB]',err);notify('error',numbers,betAmount,probability,String(err));return false;
    }finally{isPlacingBet=false;}
  }

  function resolve(n){
    if(!stats.waitingResult||!stats.lastBetNumbers.length) return;
    if(Date.now()-stats.lastBetTs<2000) return;
    stats.waitingResult=false;
    const won=stats.lastBetNumbers.includes(n),N=stats.lastBetNumbers.length,amt=stats.lastBetAmount;
    if(won){
      const lucro=amt*35-amt*(N-1);stats.profit+=lucro;stats.wins++;stats.currentGaleStep=0;stats.consecutiveLosses=0;
      notify('win',stats.lastBetNumbers,amt,0,'',n,lucro);
      console.log('[SSB] 🟢 ACERTO! '+n+' +R$'+lucro.toFixed(2));
    }else{
      const custo=amt*N;stats.profit-=custo;stats.losses++;stats.consecutiveLosses++;
      if(cfg.useGale&&stats.currentGaleStep<cfg.maxGaleSteps) stats.currentGaleStep++;
      else stats.currentGaleStep=0;
      notify('loss',stats.lastBetNumbers,amt,0,'',n,-custo);
      console.log('[SSB] 🔴 ERRO! '+n+' -R$'+custo.toFixed(2));
    }
    if(stats.profit<=cfg.stopLoss){stats.stopped=true;stats.stopReason='Stop Loss: R$'+stats.profit.toFixed(2);cfg.enabled=false;save();cleanup();notify('stopped',[],0,0,stats.stopReason);}
    if(stats.profit>=cfg.stopWin){stats.stopped=true;stats.stopReason='Stop Win: R$'+stats.profit.toFixed(2);cfg.enabled=false;save();cleanup();notify('stopped',[],0,0,stats.stopReason);}
    save();
  }

  function notify(status,numbers,betAmount,probability,error,resultNumber,profit){
    const msg={type:'AUTOBET_STATUS',status,numbers,betAmount,probability,error:error||null,resultNumber:resultNumber??null,profit:profit??null,stats:{...stats}};
    window.postMessage(msg,'*');
    try{window.parent?.postMessage(msg,'*');}catch{}
  }

  async function pollSniper(){
    if(!cfg.enabled||stats.stopped||isPlacingBet) return;
    try{
      const res=await fetch(SNIPER_URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':ANON_KEY},body:JSON.stringify({sampleSize:100})});
      if(!res.ok) return;
      const data=await res.json();
      if((data.mode==='sniper'||data.mode==='alert')&&data.signal){
        const prob=data.signal.probability||0,confs=data.signal.confirmations||0,nums=data.strategy?.numbers||[];
        if(prob>=cfg.minProbability&&confs>=cfg.minConfirmations&&nums.length>0) await bet(nums,cfg.betValue,prob);
      }
    }catch{}
  }

  window.addEventListener('message',async evt=>{
    const d=evt.data;
    if(!d||typeof d!=='object') return;
    if(d.type==='SNIPER_BET_SIGNAL'){
      if(!cfg.enabled||stats.stopped) return;
      const phase=detectPhase();
      if(phase==='closed'){pendingSignal={numbers:d.numbers,betAmount:d.betAmount||cfg.betValue,probability:d.probability||0};}
      else{await delay(ms(cfg.autoBetDelay,0.3));await bet(d.numbers,d.betAmount||cfg.betValue,d.probability||0);}
    }
    if(d.type==='NUMBER_CAPTURED'||d.type==='ROULETTE_NUMBER'){
      const n=d.number;
      if(typeof n==='number'&&n>=0&&n<=36){resolve(n);try{window.parent?.postMessage({type:'NUMBER_FROM_EXTENSION',number:n},'*');}catch{}}
    }
  });

  function init(){
    if(!cfg.enabled) return;
    if(!phaseInterval){
      phaseInterval=setInterval(async()=>{
        const phase=detectPhase(),wasOpen=bettingOpen;
        bettingOpen=phase==='open';
        if(!wasOpen&&bettingOpen&&pendingSignal&&!isPlacingBet&&cfg.enabled&&!stats.stopped){
          const sig=pendingSignal;pendingSignal=null;
          await delay(ms(700,0.3));await bet(sig.numbers,sig.betAmount,sig.probability);
        }
        const msg={type:'BETTING_PHASE',phase,bettingOpen};
        window.postMessage(msg,'*');try{window.parent?.postMessage(msg,'*');}catch{}
      },1000);
    }
    if(!pollInterval) pollInterval=setInterval(pollSniper,10000);
    notify('ready',[],0,0);
    console.log('[SSB] 🤖 v4 SUPREMO ativo');
  }
  function cleanup(){
    if(pollInterval){clearInterval(pollInterval);pollInterval=null;}
    if(phaseInterval){clearInterval(phaseInterval);phaseInterval=null;}
    pendingSignal=null;console.log('[SSB] ⛔ Desativado');
  }

  window._ssb={bet,resolve,enable:()=>{cfg.enabled=true;save();init();},disable:()=>{cfg.enabled=false;save();cleanup();},getStats:()=>({...stats}),getConfig:()=>({...cfg}),getPhase:detectPhase};
  const _orig=window._rtCheckResult;
  window._rtCheckResult=n=>{resolve(n);if(_orig)_orig(n);window.postMessage({type:'NUMBER_FROM_EXTENSION',number:n},'*');try{window.parent?.postMessage({type:'NUMBER_FROM_EXTENSION',number:n},'*');}catch{}};
  if(cfg.enabled&&!stats.stopped) init();
})();
