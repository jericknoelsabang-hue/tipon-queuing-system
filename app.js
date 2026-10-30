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
 else if(S.version===REQUIRED){indexes.forEach(i=>{const t=win(i);last[i]=t?t.ticketId+'|'+t.calledAt:''});initialized=true}
}
function announceEditor(){const e=$('announcementInput');if(!dirty&&document.activeElement!==e)e.value=S.announcement||DEFAULT;$('announcementCount').textContent=e.value.length+' / 280 characters'}
function pending(){const list=S.prechecks||[];$('metricPre').textContent=list.length;$('metricWait').textContent=(S.waiting||[]).length;
 $('metricServing').textContent=Array.from({length:Number(S.windowCount||3)},(_,i)=>win(i+1)).filter(Boolean).length;
 $('precheckList').innerHTML=list.length?'<table><thead><tr><th>Reference</th><th>Name / Purpose</th><th>Transaction</th><th>Document check</th></tr></thead><tbody>'+
 list.map(x=>'<tr><td><b>'+esc(x.reference)+'</b></td><td>'+esc(x.name)+'<br><small>'+esc(x.position)+'</small></td><td>'+esc(x.transaction)+'</td><td><div class="buttons"><button class="btn success sm" type="button" data-check="approve" data-id="'+esc(x.precheckId)+'">Approve</button><button class="btn danger sm" type="button" data-check="reject" data-id="'+esc(x.precheckId)+'">Incomplete</button></div></td></tr>').join('')+'</tbody></table>':
 '<p class="empty">No pending pre-screening requests. Applicant records will appear here for verification.</p>';
 document.querySelectorAll('[data-check]').forEach(e=>e.onclick=()=>review(e.dataset.check==='approve',e.dataset.id))
}
function staff(){const n=Number(S.windowCount||3);$('wc').textContent=n+' WINDOWS';$('addWin').disabled=n>=Number(S.maxWindowCount||20);
 $('staffWins').innerHTML=Array.from({length:n},(_,idx)=>{const i=idx+1,t=win(i),mode=S.routes?.[String(i)]||(i===3?'MC':'RECRUITMENT'),chosen=filters[i]||'ALL',options=(S.transactions||[]).filter(x=>mode==='MC'?x.code==='MC':mode==='RECRUITMENT'?x.code!=='MC':true);
 return '<div class="window-card"><div class="split"><h3>Window '+i+'</h3><span class="pill '+(mode==='MC'?'warm':'')+'">'+(mode==='MC'?'Member Concerns':mode==='RECRUITMENT'?'Recruitment':'All Services')+'</span></div>'+
 '<div class="current">'+(t?'<b class="current-no">'+esc(t.queueNo)+'</b><strong>'+esc(t.name)+'</strong><small>'+esc(t.transactionName)+'</small>':'<small class="muted">No active applicant</small>')+'</div>'+
 '<label class="field">Assigned service<select data-route="'+i+'"><option value="RECRUITMENT"'+(mode==='RECRUITMENT'?' selected':'')+'>Recruitment</option><option value="MC"'+(mode==='MC'?' selected':'')+'>Member Concerns</option><option value="ALL"'+(mode==='ALL'?' selected':'')+'>All Services</option></select></label>'+
 '<label class="field">Transaction filter<select data-filter="'+i+'"><option value="ALL">Any transaction</option>'+options.map(x=>'<option value="'+esc(x.code)+'"'+(chosen===x.code?' selected':'')+'>'+esc(x.code)+' · '+esc(x.name)+'</option>').join('')+'</select></label>'+
 '<div class="window-actions"><button class="btn primary" data-action="call" data-win="'+i+'" type="button"'+(t?' disabled':'')+'>Call Next</button><button class="btn ghost" data-action="recall" data-win="'+i+'" type="button"'+(!t?' disabled':'')+'>Recall</button><button class="btn danger wide" data-action="complete" data-win="'+i+'" type="button"'+(!t?' disabled':'')+'>Complete</button></div></div>'
 }).join('');
 document.querySelectorAll('[data-route]').forEach(e=>e.onchange=()=>route(+e.dataset.route,e.value));
 document.querySelectorAll('[data-filter]').forEach(e=>e.onchange=()=>{filters[+e.dataset.filter]=e.value});
 document.querySelectorAll('[data-action]').forEach(e=>e.onclick=()=>queueAction(e.dataset.action,+e.dataset.win));
 const q=S.waiting||[];$('wt').innerHTML=q.length?q.map(x=>'<tr><td><b>'+esc(x.queueNo)+'</b></td><td>'+esc(x.name)+'</td><td>'+esc(x.transactionName)+'</td><td>'+esc(x.position)+'</td></tr>').join(''):'<tr><td colspan="4" class="empty">No waiting applicants</td></tr>';
}
function render(){tv();pending();staff();announceEditor();qr()}
async function refresh(silent=false){if(loading)return;loading=true;try{
 if(!valid(url())){if(!silent)status('No backend configured. Paste Apps Script /exec URL in Setup.','err');render();return}
 const response=await jp('state');if(!response.ok)throw Error(response.error||'Failed to fetch queue.');S=response.state;render();
 if(S.version!==REQUIRED)status('Backend is outdated. Deploy Federation v4 Apps Script to activate new features.','err');
 else status('Connected to TIPON Federation • '+REQUIRED+' • Synced '+new Date().toLocaleTimeString('en-PH',{timeZone:'Asia/Manila'}),'ok')
 }catch(e){if(!silent||page==='setup')error(e)}finally{loading=false}}
function ding(){try{const A=window.AudioContext||window.webkitAudioContext;audio=audio||new A();audio.resume?.();
 const t=audio.currentTime;[[660,0],[880,.18]].forEach(([f,offset])=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.001,t+offset);g.gain.exponentialRampToValueAtTime(.2,t+offset+.03);g.gain.exponentialRampToValueAtTime(.001,t+offset+.25);o.connect(g);g.connect(audio.destination);o.start(t+offset);o.stop(t+offset+.27)})}catch{}}
function announce(ticket,i){const message='Queue '+ticket.queueNo+', '+ticket.name+', please proceed to Window '+i+'.';$('callNotice').textContent=message;$('callNotice').classList.remove('hide');
 if(!armed)return;ding();if('speechSynthesis' in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(message);u.rate=.92;u.lang='en-PH';setTimeout(()=>speechSynthesis.speak(u),340)}}
async function operate(action,params={},after){if(!ready())return null;
 try{const r=await jp(action,params);if(!r.ok)throw Error(r.error||'Request failed.');if(after)after(r);await refresh(true);return r}
 catch(e){error(e,true);return null}}
async function review(approve,id){let note='';if(approve){if(!confirm('Have you physically checked this applicant’s documents? Approve and issue the queue number?'))return}
 else{const txt=prompt('List missing documents (visible to applicant):','Please complete the required documents.');if(txt===null)return;note=txt}
 await operate(approve?'approvePrecheck':'rejectPrecheck',{precheckId:id,note})}
async function queueAction(action,i){const filter=document.querySelector('[data-filter="'+i+'"]');const transaction=filter?.value||'ALL';
 await operate(action,{window:i,transaction},r=>{if((action==='call'||action==='recall')&&r.ticket){announce(r.ticket,i);last[i]=r.ticket.ticketId+'|'+r.ticket.calledAt}})}
async function route(i,mode){filters[i]='ALL';await operate('setWindowRoute',{window:i,route:mode})}
$('announcementInput').oninput=()=>{dirty=true;$('announcementCount').textContent=$('announcementInput').value.length+' / 280 characters'};
async function saveAnnouncement(message){message=String(message||'').trim();if(!message||message.length>280){error(Error('Announcement must contain 1–280 characters.'),true);return}
 await operate('setAnnouncement',{message},r=>{S.announcement=r.announcement;dirty=false;$('announcementInput').value=r.announcement})}
$('announcementSave').onclick=()=>saveAnnouncement($('announcementInput').value);
$('announcementReset').onclick=()=>saveAnnouncement(DEFAULT);
$('addWin').onclick=()=>operate('addWindow');
$('addTx').onclick=async()=>{const r=await operate('addTx',{code:$('newCode').value,name:$('newName').value});if(r){$('newCode').value='';$('newName').value=''}};
$('api').value=url();
$('refresh').onclick=()=>refresh();
$('sound').onclick=()=>{armed=true;localStorage.setItem('tqSound','1');ding();status('Sound enabled on this device. Return to TV Display.','ok')};
$('save').onclick=()=>{const v=$('api').value.trim();if(!valid(v)){error(Error('Enter a valid https://script.google.com/.../exec URL.'));return}localStorage.setItem('tqApi',v);qrUrl='';refresh()};
$('test').onclick=async()=>{try{const r=await jp('health');if(!r.ok)throw Error(r.error);if(r.version!==REQUIRED)throw Error('Backend is '+(r.version||'outdated')+'. Deploy Federation v4 Code.gs.');status('Backend verified • '+r.version+' • '+r.windows+' service windows.','ok');await refresh(true)}catch(e){error(e)}};
$('clear').onclick=()=>{localStorage.removeItem('tqApi');$('api').value='';S.version='';qrUrl='';status('Connection cleared.','err');qr()};
const full=$('fullscreen');
function reflect(){const active=document.fullscreenElement===$('display');full.textContent=active?'Exit Full Screen':'⛶ Full Screen';full.setAttribute('aria-pressed',active?'true':'false')}
full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('display').requestFullscreen();reflect()}catch(e){error(e,true)}};
document.addEventListener('fullscreenchange',reflect);
const img=$('brandPhoto');img.onerror=()=>{$('brandImage').classList.add('failed')};if(img.complete&&!img.naturalWidth)$('brandImage').classList.add('failed');
function clock(){$('clock').textContent=new Date().toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit'})}
clock();setInterval(clock,1000);const requested=new URLSearchParams(location.search).get('view');view(['setup','staff'].includes(requested)?requested:'display');
render();refresh(false);setInterval(()=>refresh(true),3500);
})();
