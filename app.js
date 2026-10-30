/* TIPON Federation Queue — TV display, staff console, setup (v4).
   Bundled QRCode.js renders QR without third-party image services. */
(()=>{'use strict';
const C=window.TIPON_CONFIG||{}, $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REQUIRED='federation-v6',DEFAULT='Please keep your queue number until called.';
let S={windowCount:4,maxWindowCount:20,windows:{},waiting:[],transactions:[],assignments:{},announcement:DEFAULT,completed:[],recruiters:{}};
let seq=0,loading=false,qrUrl='',qrObj=null,initialized=false,last={},page='display',dirty=false,staffSignature='',windowSignature='';
let armed=localStorage.getItem('tqSound')==='1',audio=null,waitPage=0,completedPage=0,editWindow=0,editTxCode='';
function url(){return new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||''}
function valid(u){try{const p=new URL(u);return p.origin==='https://script.google.com'&&p.pathname.endsWith('/exec')}catch{return false}}
function status(t,k=''){const e=$('setupAlert');e.textContent=t;e.className='status '+k}
function view(v){page=v;['display','staff','setup'].forEach(x=>$(x).classList.toggle('hide',x!==v));document.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===v));if(v==='setup'&&S.version===REQUIRED)setupTables()}
function error(e,go=false){let t=String(e?.message||e||'Unknown error');if(t.includes('Unknown action'))t='Apps Script is outdated (Unknown action). Redeploy Code.gs Federation v6, then click Test Connection.';status(t,'err');if(go)view('setup')}
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
function ready(){if(S.version===REQUIRED)return true;error(Error('Backend is outdated. Deploy the latest Federation v6 Code.gs.'),true);return false}
function joinURL(){const u=new URL('join.html',C.pagesUrl||location.href);if(valid(url()))u.searchParams.set('api',url());return u.href}
function qr(){const link=joinURL();$('joinLink').href=link;$('getQueueNav').href=link;if(link===qrUrl)return;
 qrUrl=link;const holder=$('qr');holder.innerHTML='';if(typeof QRCode==='undefined'){holder.textContent='QR unavailable';status('QR generator failed to load. Use Open Get Queue link.','err');return}
 try{qrObj=new QRCode(holder,{text:link,width:300,height:300,colorDark:'#102f45',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}
 catch(e){holder.textContent='Use Get Queue link';status('QR failed: '+e.message,'err')}
}
function win(i){return S.windows?.[String(i)]||null}
function tv(){
  const count=Number(S.windowCount||4),indexes=Array.from({length:count},(_,i)=>i+1);
  const signature=JSON.stringify({windows:S.windows,waiting:S.waiting,count});
  if(signature!==windowSignature){
    windowSignature=signature;
    $('wins').innerHTML=indexes.map(i=>{const t=win(i);
      return '<div class="window"><span class="window-label">WINDOW '+i+'</span>'+
       (t?'<div class="queue-no">'+esc(t.queueNo)+'</div><strong>'+esc(t.name)+'</strong><small>'+esc(t.transactionName)+'</small>':
       '<div class="queue-no idle">—</div><small>READY FOR NEXT</small>')+'</div>'
    }).join('');
    const q=S.waiting||[];
    $('chips').innerHTML=q.length?q.slice(0,20).map(t=>'<span class="chip">'+esc(t.queueNo)+'</span>').join(''):'<span class="muted">No applicants waiting</span>';
  }
  const announcement=String(S.announcement||DEFAULT);
  if($('ann').textContent!==announcement){
    $('ann').textContent=announcement;$('annCopy').textContent=announcement;
    document.querySelector('.announcement-message')?.classList.toggle('marquee',announcement.length>80);
  }
  if(initialized){
    for(const i of indexes){const t=win(i),key=t?t.ticketId+'|'+t.calledAt:'';
      if(key&&key!==last[i])announce(t,i);last[i]=key;
    }
  }else if(S.version===REQUIRED){
    indexes.forEach(i=>{const t=win(i);last[i]=t?t.ticketId+'|'+t.calledAt:''});initialized=true;
  }
}
function announceEditor(){const e=$('announcementInput');if(!dirty&&document.activeElement!==e)e.value=S.announcement||DEFAULT;$('announcementCount').textContent=e.value.length+' / 280 characters'}
function metrics(){
  $('metricWindows').textContent=String(S.windowCount||4);
  $('metricWait').textContent=String((S.waiting||[]).length);
  $('metricServing').textContent=String(Array.from({length:Number(S.windowCount||4)},(_,i)=>win(i+1)).filter(Boolean).length);
}
function staff(){
  const n=Number(S.windowCount||4);
  $('wc').textContent=n+' WINDOWS';$('addWin').disabled=n>=Number(S.maxWindowCount||20);
  const signature=JSON.stringify({n,windows:S.windows,tx:S.transactions,assignments:S.assignments,waiting:S.waiting,recruiters:S.recruiters});
  if(signature===staffSignature)return;
  staffSignature=signature;
  $('staffWins').innerHTML=Array.from({length:n},(_,idx)=>{
    const i=idx+1,t=win(i),selected=S.assignments?.[String(i)]||'ALL',
      txName=(S.transactions||[]).find(x=>x.code===selected)?.name||selected, recruiter=S.recruiters?.[String(i)]||'Unassigned';
    return '<div class="window-card"><div class="split"><h3>Window '+i+'</h3><span class="pill">'+esc(txName==='ALL'?'Any transaction':txName)+'</span></div>'+
      '<div class="current">'+(t?'<b class="current-no">'+esc(t.queueNo)+'</b><strong>'+esc(t.name)+'</strong><small>'+esc(t.transactionName)+'</small>':'<small class="muted">No active applicant</small>')+'</div>'+
      '<p class="recruiter-label"><b>Recruiter:</b> '+esc(recruiter)+'</p>'+
      '<div class="window-actions"><button class="btn primary" data-action="call" data-win="'+i+'" type="button"'+(t?' disabled':'')+'>Call Next</button>'+
      '<button class="btn ghost" data-action="recall" data-win="'+i+'" type="button"'+(!t?' disabled':'')+'>Recall</button>'+
      '<button class="btn danger wide" data-action="complete" data-win="'+i+'" type="button"'+(!t?' disabled':'')+'>Complete</button></div></div>';
  }).join('');
  document.querySelectorAll('[data-action]').forEach(e=>e.onclick=()=>queueAction(e.dataset.action,+e.dataset.win));
}
function dateDisplay(x){
  const raw=String(x.date||x.createdAt||'').slice(0,10);
  const parts=raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  return parts?parts[2]+'/'+parts[3]+'/'+parts[1]:raw||'—';
}
function queueTables(){
  const make=(list,page,key,bodyId)=>{
    const size=10,count=list.length,lastPage=Math.max(0,Math.ceil(count/size)-1),p=Math.min(page,lastPage),rows=list.slice(p*size,p*size+size);
    const label=key==='wait'?'wait':'completed';
    $(bodyId).innerHTML=rows.length?rows.map(x=>'<tr><td>'+esc(dateDisplay(x))+'</td><td><b>'+esc(x.queueNo)+'</b></td><td>'+esc(x.name)+'</td><td>'+esc(x.transactionName)+'</td><td>'+esc(x.position)+'</td><td>'+esc(x.recruiter||'—')+'</td></tr>').join(''):'<tr><td colspan="6" class="empty">No '+(key==='wait'?'waiting':'completed')+' applicants</td></tr>';
    $(label+'Showing').textContent='Showing '+(count?p*size+1:0)+'–'+Math.min((p+1)*size,count)+' of '+count;
    $(label+'Page').textContent='Page '+(p+1)+' of '+(lastPage+1);
    $(label+'Prev').disabled=p===0;$(label+'Next').disabled=p===lastPage;return p;
  };
  waitPage=make(S.waiting||[],waitPage,'wait','wt');
  completedPage=make(S.completed||[],completedPage,'completed','ct');
}
function setupTables(){
  $('setupWc').textContent=S.windowCount+' WINDOWS';
  $('addWin').disabled=S.windowCount>=Number(S.maxWindowCount||20);
  $('setupWins').innerHTML=Array.from({length:Number(S.windowCount||0)},(_,idx)=>{
    const i=idx+1,t=win(i),tx=S.assignments?.[String(i)]||'ALL',label=S.transactions.find(x=>x.code===tx)?.name||'Any transaction',name=S.recruiters?.[String(i)]||'—';
    return '<tr><td><b>Window '+i+'</b></td><td>'+esc(label)+'</td><td>'+esc(name)+'</td><td>'+(t?'Serving '+esc(t.queueNo):'Available')+'</td><td class="actions-cell"><button class="btn sm" data-edit-win="'+i+'">Edit</button><button class="btn sm danger" data-delete-win="'+i+'"'+(t?' disabled':'')+'>Delete</button></td></tr>';
  }).join('');
  $('setupTx').innerHTML=(S.transactions||[]).map(x=>'<tr><td><b>'+esc(x.code)+'</b></td><td>'+esc(x.name)+'</td><td class="actions-cell"><button class="btn sm" data-edit-tx="'+esc(x.code)+'">Edit</button><button class="btn sm danger" data-delete-tx="'+esc(x.code)+'"'+(['NH','RH','TR','MC'].includes(x.code)?' disabled':'')+'>Delete</button></td></tr>').join('');
  document.querySelectorAll('[data-edit-win]').forEach(b=>b.onclick=()=>openWindowEditor(Number(b.dataset.editWin)));
  document.querySelectorAll('[data-delete-win]').forEach(b=>b.onclick=async()=>{
    const i=Number(b.dataset.deleteWin);
    if(confirm('Delete Window '+i+'? Window numbers will be renumbered. Complete active tickets first.'))await operate('deleteWindow',{window:i});
  });
  document.querySelectorAll('[data-edit-tx]').forEach(b=>b.onclick=()=>openTxEditor(b.dataset.editTx));
  document.querySelectorAll('[data-delete-tx]').forEach(b=>b.onclick=async()=>{
    if(confirm('Delete transaction '+b.dataset.deleteTx+'? Only unused transaction types can be removed.'))await operate('deleteTx',{code:b.dataset.deleteTx});
  });
}
function openWindowEditor(i){
  editWindow=i;$('windowEditorTitle').textContent='Edit Window '+i;
  $('editWindowTx').innerHTML='<option value="ALL">Any transaction</option>'+(S.transactions||[]).map(x=>'<option value="'+esc(x.code)+'">'+esc(x.code)+' · '+esc(x.name)+'</option>').join('');
  $('editWindowTx').value=S.assignments[String(i)]||'ALL';
  $('editRecruiter').value=S.recruiters[String(i)]||'';
  $('windowEditor').classList.remove('hide');$('windowEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function openTxEditor(code){
  editTxCode=code;$('txEditorTitle').textContent='Edit '+code;
  $('editTxName').value=S.transactions.find(x=>x.code===code)?.name||'';
  $('txEditor').classList.remove('hide');$('txEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function render(){tv();metrics();staff();queueTables();if(page==='setup')setupTables();announceEditor();qr()}
async function refresh(silent=false){if(loading)return;loading=true;try{
 if(!valid(url())){if(!silent)status('No backend configured. Paste Apps Script /exec URL in Setup.','err');render();return}
 const response=await jp('state');if(!response.ok)throw Error(response.error||'Failed to fetch queue.');S=response.state;render();
 if(S.version!==REQUIRED)status('Backend is outdated. Deploy Federation v6 Apps Script to activate new features.','err');
 else status('Connected to TIPON Federation • '+REQUIRED+' • Synced '+new Date().toLocaleTimeString('en-PH',{timeZone:'Asia/Manila'}),'ok')
 }catch(e){if(!silent||page==='setup')error(e)}finally{loading=false}}
function ding(){try{const A=window.AudioContext||window.webkitAudioContext;audio=audio||new A();audio.resume?.();
 const t=audio.currentTime;[[660,0],[880,.18]].forEach(([f,offset])=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.001,t+offset);g.gain.exponentialRampToValueAtTime(.2,t+offset+.03);g.gain.exponentialRampToValueAtTime(.001,t+offset+.25);o.connect(g);g.connect(audio.destination);o.start(t+offset);o.stop(t+offset+.27)})}catch{}}
function announce(ticket,i){const message='Queue '+ticket.queueNo+', '+ticket.name+', please proceed to Window '+i+'.';$('callNotice').textContent=message;$('callNotice').classList.remove('hide');
 if(!armed)return;ding();if('speechSynthesis' in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(message);u.rate=.92;u.lang='en-PH';setTimeout(()=>speechSynthesis.speak(u),340)}}
async function operate(action,params={},after){if(!ready())return null;
 try{const r=await jp(action,params);if(!r.ok)throw Error(r.error||'Request failed.');if(after)after(r);await refresh(true);return r}
 catch(e){error(e,true);return null}}
async function queueAction(action,i){
  await operate(action,{window:i},result=>{
    if((action==='call'||action==='recall')&&result.ticket){
      announce(result.ticket,i);last[i]=result.ticket.ticketId+'|'+result.ticket.calledAt;
    }
  });
}
async function assignTx(i,transaction){
  if(!ready())return;
  const old=S.assignments?.[String(i)]||'ALL';
  // Preserve the current queue and sessions while only the assignment changes.
  if(old===transaction)return;
  const result=await operate('setWindowTx',{window:i,transaction});
  if(!result){staffSignature='';staff();return}
  S.assignments={...(S.assignments||{}),[String(i)]:transaction};
  staffSignature='';staff();
}
$('announcementInput').oninput=()=>{dirty=true;$('announcementCount').textContent=$('announcementInput').value.length+' / 280 characters'};
async function saveAnnouncement(message){message=String(message||'').trim();if(!message||message.length>280){error(Error('Announcement must contain 1–280 characters.'),true);return}
 await operate('setAnnouncement',{message},r=>{S.announcement=r.announcement;dirty=false;$('announcementInput').value=r.announcement})}
$('announcementSave').onclick=()=>saveAnnouncement($('announcementInput').value);
$('announcementReset').onclick=()=>saveAnnouncement(DEFAULT);
$('addWin').onclick=()=>operate('addWindow');
$('cancelWindow').onclick=()=>{$('windowEditor').classList.add('hide');editWindow=0};
$('saveWindow').onclick=async()=>{
  const r=await operate('saveWindow',{window:editWindow,transaction:$('editWindowTx').value,recruiter:$('editRecruiter').value.trim()});
  if(r){$('windowEditor').classList.add('hide');editWindow=0}
};
$('cancelTx').onclick=()=>{$('txEditor').classList.add('hide');editTxCode=''};
$('saveTx').onclick=async()=>{
  const r=await operate('editTx',{code:editTxCode,name:$('editTxName').value.trim()});
  if(r){$('txEditor').classList.add('hide');editTxCode=''}
};
for(const key of ['wait','completed'])for(const side of ['Prev','Next']){
  $(key+side).onclick=()=>{if(key==='wait')waitPage+=side==='Next'?1:-1;else completedPage+=side==='Next'?1:-1;queueTables()};
}
$('openTV').onclick=()=>{view('display');$('fullscreen').click()};
$('addTx').onclick=async()=>{const r=await operate('addTx',{code:$('newCode').value,name:$('newName').value});if(r){$('newCode').value='';$('newName').value=''}};
$('api').value=url();
$('refresh').onclick=()=>refresh();
$('sound').onclick=()=>{armed=true;localStorage.setItem('tqSound','1');ding();status('Sound enabled on this device. Return to TV Display.','ok')};
$('save').onclick=()=>{const v=$('api').value.trim();if(!valid(v)){error(Error('Enter a valid https://script.google.com/.../exec URL.'));return}localStorage.setItem('tqApi',v);qrUrl='';refresh()};
$('test').onclick=async()=>{try{const r=await jp('health');if(!r.ok)throw Error(r.error);if(r.version!==REQUIRED)throw Error('Backend is '+(r.version||'outdated')+'. Deploy Federation v6 Code.gs.');status('Backend verified • '+r.version+' • '+r.windows+' service windows.','ok');await refresh(true)}catch(e){error(e)}};
$('clear').onclick=()=>{localStorage.removeItem('tqApi');$('api').value='';S.version='';qrUrl='';status('Connection cleared.','err');qr()};
const full=$('fullscreen');
function reflect(){const active=document.fullscreenElement===$('display');full.textContent=active?'Exit Full Screen':'⛶ Full Screen';full.setAttribute('aria-pressed',active?'true':'false')}
full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('display').requestFullscreen();reflect()}catch(e){error(e,true)}};
document.addEventListener('fullscreenchange',reflect);
function clock(){
  const now=new Date();
  const time=now.toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
  const date=now.toLocaleDateString('en-PH',{timeZone:'Asia/Manila',weekday:'long',year:'numeric',month:'long',day:'numeric'}).toUpperCase();
  $('clock').textContent=time;$('fullscreenTime').textContent=time;
  $('headerDay').textContent=date;$('fullscreenDate').textContent=date;
}
clock();setInterval(clock,1000);const requested=new URLSearchParams(location.search).get('view');view(['setup','staff'].includes(requested)?requested:'display');
render();refresh(false);setInterval(()=>refresh(true),3500);
})();
