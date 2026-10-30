/* TIPON Federation Queue — TV display, staff console, setup (v4).
   Bundled QRCode.js renders QR without third-party image services. */
(()=>{'use strict';
const C=window.TIPON_CONFIG||{}, $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REQUIRED='federation-v4',DEFAULT='Please keep your queue number until called.';
let S={windowCount:3,maxWindowCount:20,windows:{},waiting:[],transactions:[],prechecks:[],routes:{},announcement:DEFAULT};
let seq=0,loading=false,qrUrl='',qrObj=null,initialized=false,last={},page='display',filters={},dirty=false;
let armed=localStorage.getItem('tqSound')==='1',audio=null;
function url(){return new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||''}
function valid(u){try{const p=new URL(u);return p.origin==='https://script.google.com'&&p.pathname.endsWith('/exec')}catch{return false}}
function status(t,k=''){const e=$('setupAlert');e.textContent=t;e.className='status '+k}
function view(v){page=v;['display','staff','setup'].forEach(x=>$(x).classList.toggle('hide',x!==v));document.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===v))}
function error(e,go=false){let t=String(e?.message||e||'Unknown error');if(t.includes('Unknown action'))t='Apps Script is outdated (Unknown action). Redeploy Code.gs Federation v4, then click Test Connection.';status(t,'err');if(go)view('setup')}
document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>view(b.dataset.v));
function jp(action,params={}){return new Promise((resolve,reject)=>{
 if(!valid(url()))return reject(Error('Configure a valid Apps Script /exec URL in Setup.'));
 const cb='__tipon'+Date.now()+(++seq),tag=document.createElement('script');let finished=false;
 const tm=setTimeout(()=>finish(Error('Apps Script timed out. Check /exec deployment.')),15000);
 function finish(err,data){if(finished)return;finished=true;clearTimeout(tm);delete window[cb];tag.remove();err?reject(err):resolve(data)}
 window[cb]=data=>finish(null,data);tag.onerror=()=>finish(Error('Cannot connect to Apps Script.'));
 const q=new URL(url());q.searchParams.set('action',action);q.searchParams.set('callback',cb);
 Object.entries(params).forEach(([k,v])=>q.searchParams.set(k,String(v??'')));tag.src=q.href;document.head.appendChild(tag);
})}
function ready(){if(S.version===REQUIRED)return true;error(Error('Backend is outdated. Deploy the latest Federation v4 Code.gs.'),true);return false}
function joinURL(){const u=new URL('join.html',C.pagesUrl||location.href);if(valid(url()))u.searchParams.set('api',url());return u.href}
function qr(){const link=joinURL();$('joinLink').href=link;$('getQueueNav').href=link;if(link===qrUrl)return;
 qrUrl=link;const holder=$('qr');holder.innerHTML='';if(typeof QRCode==='undefined'){holder.textContent='QR unavailable';status('QR generator failed to load. Use Open Get Queue link.','err');return}
 try{qrObj=new QRCode(holder,{text:link,width:216,height:216,colorDark:'#102f45',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}
 catch(e){holder.textContent='Use Get Queue link';status('QR failed: '+e.message,'err')}
}
function win(i){return S.windows?.[String(i)]||null}
function tv(){const count=Number(S.windowCount||3),indexes=Array.from({length:count},(_,i)=>i+1);
 $('wins').innerHTML=indexes.map(i=>{const t=win(i);return '<div class="window"><span class="window-label">WINDOW '+i+'</span>'+(t?'<div class="queue-no">'+esc(t.queueNo)+'</div><strong>'+esc(t.name)+'</strong><small>'+esc(t.transactionName)+'</small>':'<div class="queue-no idle">—</div><small>READY FOR NEXT</small>')+'</div>'}).join('');
 const q=S.waiting||[];$('chips').innerHTML=q.length?q.slice(0,20).map(t=>'<span class="chip">'+esc(t.queueNo)+'</span>').join(''):'<span class="muted">No applicants waiting</span>';
 $('ann').textContent=S.announcement||DEFAULT;
 if(initialized){for(const i of indexes){const t=win(i),key=t?t.ticketId+'|'+t.calledAt:'';if(key&&key!==last[i])announce(t,i);last[i]=key}}
 else{indexes.forEach(i=>{const t=win(i);last[i]=t?t.ticketId+'|'+t.calledAt:''});initialized=true}
}
