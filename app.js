/* TIPON Federation Queue — TV display, staff console, setup (v6).
   Bundled QRCode.js renders QR without third-party image services. */
(()=>{'use strict';
const C=window.TIPON_CONFIG||{}, $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REQUIRED='federation-v9',COMPATIBLE=new Set(['federation-v7','federation-v8','federation-v9']),DEFAULT='Please keep your queue number until called.';
let S={windowCount:0,maxWindowCount:20,windows:{},waiting:[],transactions:[],transactionTypes:[],assignments:{},announcement:DEFAULT,completed:[],recruiters:{}};
let seq=0,loading=false,queuedRefresh=false,hasLoaded=false,writePending=0,writeSerial=0,activeWindowActions=new Set(),tableSignature={wait:'',completed:''},qrUrl='',qrObj=null,initialized=false,last={},page='display',dirty=false,staffSignature='',windowSignature='';
let armed=localStorage.getItem('tqSound')==='1',audio=null,waitPage=0,completedPage=0,editWindow=0,editTxCode='';
function url(){return new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||''}
function valid(u){try{const p=new URL(u);return p.origin==='https://script.google.com'&&p.pathname.endsWith('/exec')}catch{return false}}
function status(t,k=''){
 const e=$('setupAlert');e.textContent=t;e.className='status '+k;
 if(k==='err'&&page==='staff')staffMessage(t,'err');
}
function staffMessage(t,k='ok'){
 const a=$('staffAlert');if(!a)return;
 a.textContent=t;a.className='status staff-alert '+k;
}
function clearStaffMessage(){const a=$('staffAlert');if(a){a.textContent='';a.className='status staff-alert hide'}}

function view(v){const previous=page;page=v;['display','staff','setup'].forEach(x=>$(x).classList.toggle('hide',x!==v));document.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===v));$('fullscreen').classList.toggle('hide',v!=='display');if(v==='setup')setupTables();if(previous!==v&&hasLoaded)void refresh(true)}
function error(e){let t=String(e?.message||e||'Unknown error');
 if(t.includes('Unknown action'))t='Apps Script needs a backend update. Check the Code.gs deployment in Setup.';
 if(t.includes('timed out'))t='The queue server did not confirm in time. Rechecking the latest queue status; do not repeat the action until the result is visible.';
 status(t,'err'); /* Never redirect staff away from the active service window. */
}
document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>view(b.dataset.v));
function jp(action,params={}){return new Promise((resolve,reject)=>{
 if(!valid(url()))return reject(Error('Configure a valid Apps Script /exec URL in Setup.'));
 const cb='__tipon'+Date.now()+(++seq),tag=document.createElement('script');let finished=false;
 const tm=setTimeout(()=>finish(Error('Apps Script timed out.')),action==='state'?19000:27000);
 function finish(err,data){if(finished)return;finished=true;clearTimeout(tm);delete window[cb];tag.remove();err?reject(err):resolve(data)}
 window[cb]=data=>finish(null,data);tag.onerror=()=>finish(Error('Cannot connect to Apps Script.'));
 const q=new URL(url());q.searchParams.set('action',action);q.searchParams.set('callback',cb);
 Object.entries(params).forEach(([k,v])=>q.searchParams.set(k,String(v??'')));tag.src=q.href;document.head.appendChild(tag);
})}
function ready(){if(COMPATIBLE.has(S.version))return true;error(Error('Apps Script is disconnected or outdated. Check the connection in Setup.'));return false}
function joinURL(){const u=new URL('join.html',C.pagesUrl||location.href);if(valid(url()))u.searchParams.set('api',url());return u.href}
function qr(){const link=joinURL();$('getQueueSetup').href=link;if(link===qrUrl)return;
 qrUrl=link;const holder=$('qr');holder.innerHTML='';if(typeof QRCode==='undefined'){holder.textContent='QR unavailable';status('QR generator failed to load. Use Open Get Queue link.','err');return}
 try{qrObj=new QRCode(holder,{text:link,width:360,height:360,colorDark:'#102f45',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}
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
  const ticker=$('ann');
  if(ticker.textContent!==announcement){
    ticker.textContent=announcement;
    ticker.style.animationDuration=Math.max(18,announcement.length*.23)+'s';
    ticker.classList.remove('announcement-ticker');
    void ticker.offsetWidth;
    ticker.classList.add('announcement-ticker');
  }
  if(initialized){
    for(const i of indexes){const t=win(i),key=t?t.ticketId+'|'+t.calledAt:'';
      if(key&&key!==last[i]&&page==='display')announce(t,i);
      last[i]=key;
    }
  }else if(COMPATIBLE.has(S.version)){
    indexes.forEach(i=>{const t=win(i);last[i]=t?t.ticketId+'|'+t.calledAt:''});initialized=true;
  }
}
function announceEditor(){const e=$('announcementInput');if(!dirty&&document.activeElement!==e)e.value=S.announcement||DEFAULT;$('announcementCount').textContent=e.value.length.toLocaleString('en-US')+' / 2,500 characters'}
function metrics(){
  $('metricWindows').textContent=String(S.windowCount||4);
  $('metricWait').textContent=String((S.waiting||[]).length);
  $('metricServing').textContent=String(Array.from({length:Number(S.windowCount||4)},(_,i)=>win(i+1)).filter(Boolean).length);
}
function staff(){
  const n=Number(S.windowCount||0);
  $('wc').textContent=n+' WINDOWS';
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
      '<button class="btn success wide" data-action="complete" data-win="'+i+'" type="button"'+(!t?' disabled':'')+'>Complete</button></div></div>';
  }).join('');
  document.querySelectorAll('[data-action]').forEach(e=>e.onclick=()=>queueAction(e.dataset.action,+e.dataset.win));
}
function dateDisplay(x){
  const raw=String(x.date||x.createdAt||'').slice(0,10);
  const parts=raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return parts?parts[2]+'/'+parts[3]+'/'+parts[1]:raw||'—';
}
function queueTables(){
  if(page!=='staff')return;
  const make=(list,page,key,bodyId)=>{
    const size=10,count=list.length,lastPage=Math.max(0,Math.ceil(count/size)-1),p=Math.max(0,Math.min(page,lastPage)),rows=list.slice(p*size,p*size+size);
    const signature=JSON.stringify({rows:list,page:p,count});
    if(tableSignature[key]===signature)return p;
    tableSignature[key]=signature;
    const label=key==='wait'?'wait':'completed';
    $(bodyId).innerHTML=rows.length?rows.map(x=>'<tr><td>'+esc(dateDisplay(x))+'</td><td><b>'+esc(x.queueNo)+'</b></td><td>'+esc(x.name)+'</td><td>'+esc(x.transactionName)+'</td><td>'+esc(x.position)+'</td><td>'+esc(x.recruiter||'—')+'</td></tr>').join(''):'<tr><td colspan="6" class="empty">No '+(key==='wait'?'waiting':'completed')+' applicants or members</td></tr>';
    $(label+'Showing').textContent='Showing '+(count?p*size+1:0)+'–'+Math.min((p+1)*size,count)+' of '+count;
    $(label+'Page').textContent='Page '+(p+1)+' of '+(lastPage+1);
    $(label+'Prev').disabled=p===0;$(label+'Next').disabled=p===lastPage;return p;
  };
  waitPage=make(S.waiting||[],waitPage,'wait','wt');
  completedPage=make(S.completed||[],completedPage,'completed','ct');
}
function setupTables(){
  const connected=Boolean(S.version), writable=COMPATIBLE.has(S.version);
  const n=connected?Math.max(0,Math.min(Number(S.windowCount)||0,Number(S.maxWindowCount)||20)):0;
  const list=Array.isArray(S.transactionTypes)&&S.transactionTypes.length?S.transactionTypes:Array.isArray(S.transactions)?S.transactions:[];
  const activeTx=Array.isArray(S.transactions)?S.transactions:[];
  const windows=S.windows||{}, assigns=S.assignments||{}, recruiters=S.recruiters||{};
  const canDeleteWindow=i=>!Object.entries(windows).some(([number,ticket])=>Boolean(ticket)&&Number(number)>=i);
  $('setupWc').textContent=connected?n+' WINDOWS':'LOADING';
  $('addWin').disabled=!writable||n>=Number(S.maxWindowCount||20);
  $('addTx').disabled=!writable;
  $('openAddTx').disabled=!writable;
  $('setupListHint').textContent=!valid(url())?'No Apps Script connection configured. Add a valid /exec URL above.':
    !connected?'Connecting to Apps Script… Existing windows and transactions appear when the backend responds.':
    !writable?'Read-only backend '+S.version+'. Deploy the latest Federation v8 Apps Script to enable edits.':
    'Connected to '+S.version+'. Saved windows and transactions are available for management.';
  const trxName=code=>activeTx.find(x=>x.code===code)?.name||list.find(x=>x.code===code)?.name||(code==='ALL'?'Any transaction':code);
  $('setupWins').innerHTML=n?Array.from({length:n},(_,idx)=>{
    const i=idx+1,t=windows[String(i)]||null,tx=assigns[String(i)]||'ALL',name=recruiters[String(i)]||'—';
    return '<tr><td><b>Window '+i+'</b></td><td>'+esc(trxName(tx))+'</td><td>'+esc(name)+'</td><td>'+(t?'Serving '+esc(t.queueNo):'Available')+'</td><td class="actions-cell">'+
      '<button class="btn sm" data-edit-win="'+i+'" type="button"'+(!writable?' disabled':'')+'>Edit</button>'+
      '<button class="btn sm danger" data-delete-win="'+i+'" type="button"'+(!writable||!canDeleteWindow(i)||n<=1?' disabled':'')+' title="'+(!canDeleteWindow(i)?'Complete this or later active windows first':'Delete window immediately')+'">Delete</button></td></tr>';
  }).join(''):'<tr><td colspan="5" class="empty">'+(connected?'No windows available. Add a window in Setup.':'Waiting for saved service windows from Apps Script.')+'</td></tr>';
  $('setupTx').innerHTML=list.length?list.map(x=>{
    const active=x.active!==false;
    return '<tr><td><b>'+esc(x.code)+'</b></td><td>'+esc(x.name)+'</td><td>'+(active?'Active':'Inactive')+'</td><td class="actions-cell">'+
      '<button class="btn sm" type="button" data-edit-tx="'+esc(x.code)+'"'+(!writable?' disabled':'')+'>Edit</button>'+
      '<button class="btn sm '+(active?'danger':'success')+'" type="button" data-change-tx="'+esc(x.code)+'" data-mode="'+(active?'delete':'restore')+'"'+(!writable?' disabled':'')+'>'+(active?'Delete':'Restore')+'</button></td></tr>';
  }).join(''):'<tr><td colspan="4" class="empty">'+(connected?'No transaction types found in the backend.':'Waiting for saved transaction types from Apps Script.')+'</td></tr>';
  document.querySelectorAll('[data-edit-win]').forEach(b=>b.onclick=()=>openWindowEditor(Number(b.dataset.editWin)));
  document.querySelectorAll('[data-delete-win]').forEach(b=>b.onclick=async()=>{
    if(b.disabled)return;
    b.disabled=true;b.textContent='Deleting…';
    const result=await operate('deleteWindow',{window:Number(b.dataset.deleteWin)});
    if(!result)setupTables();
  });
  document.querySelectorAll('[data-edit-tx]').forEach(b=>b.onclick=()=>openTxEditor(b.dataset.editTx));
  document.querySelectorAll('[data-change-tx]').forEach(b=>b.onclick=async()=>{
    const code=b.dataset.changeTx,remove=b.dataset.mode==='delete';
    if(!confirm((remove?'Deactivate':'Restore')+' transaction '+code+'? Queue history is retained.'))return;
    b.disabled=true;
    const result=await operate(remove?'deleteTx':'restoreTx',{code},()=>{
      S.transactionTypes=(S.transactionTypes||[]).map(t=>t.code===code?{...t,active:!remove}:t);
      S.transactions=(S.transactionTypes||[]).filter(t=>t.active);
      if(remove)for(const k of Object.keys(S.assignments||{}))if(S.assignments[k]===code)S.assignments[k]='ALL';
      staffSignature='';render();
    });
    if(!result)setupTables();
  });
}
function openWindowEditor(i){
  editWindow=i;$('windowEditorTitle').textContent='Edit Window '+i;
  $('editWindowTx').innerHTML='<option value="ALL">Any transaction</option>'+(S.transactions||[]).map(x=>'<option value="'+esc(x.code)+'">'+esc(x.code)+' · '+esc(x.name)+'</option>').join('');
  $('editWindowTx').value=S.assignments?.[String(i)]||'ALL';
  $('editRecruiter').value=S.recruiters?.[String(i)]||'';
  $('windowEditor').classList.remove('hide');$('windowEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function openTxEditor(code){
  editTxCode=code;$('txEditorTitle').textContent='Edit '+code;
  $('editTxName').value=(S.transactionTypes||S.transactions||[]).find(x=>x.code===code)?.name||'';
  $('txEditor').classList.remove('hide');$('txEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function render(){tv();metrics();staff();queueTables();if(page==='setup')setupTables();announceEditor();qr()}
async function refresh(silent=false){
 if(writePending>0||loading){queuedRefresh=true;return}
 loading=true;const serial=writeSerial;
 try{
  if(!valid(url())){if(!silent)status('No backend configured. Add an Apps Script /exec URL in Setup.','err');render();return}
  const response=await jp('state',{view:page});
  if(!response.ok)throw Error(response.error||'Failed to fetch queue.');
  if(serial!==writeSerial)return; // Ignore an older poll that started before a successful write.
  S={...S,...response.state,transactions:Array.isArray(response.state?.transactions)?response.state.transactions:[],transactionTypes:response.state?.transactionTypes||response.state?.transactions||[]};
  hasLoaded=true;render();
  if(!COMPATIBLE.has(S.version))status('Backend version is outdated. Check the Apps Script deployment.','err');
  else status('Connected to TIPON • '+S.version+' • Synced '+new Date().toLocaleTimeString('en-PH',{timeZone:'Asia/Manila'}),'ok');
 }catch(e){if(!silent||page==='setup')error(e)}
 finally{
  loading=false;
  if(queuedRefresh&&writePending===0){queuedRefresh=false;void refresh(true)}
 }
}
function ding(){try{const A=window.AudioContext||window.webkitAudioContext;audio=audio||new A();audio.resume?.();
 const t=audio.currentTime;[[660,0],[880,.18]].forEach(([f,offset])=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.001,t+offset);g.gain.exponentialRampToValueAtTime(.2,t+offset+.03);g.gain.exponentialRampToValueAtTime(.001,t+offset+.25);o.connect(g);g.connect(audio.destination);o.start(t+offset);o.stop(t+offset+.27)})}catch{}}
function announce(ticket,i){
 if(!armed)return;
 const line='Queue '+String(ticket.queueNo||'').replace(/-/g,' ') + ', ' + String(ticket.name||'') + ', please proceed to Window '+i+'.';
 const triple=[line,line,line].join(' ... ');
 ding();
 if('speechSynthesis' in window){
  try{
   speechSynthesis.cancel();
   const u=new SpeechSynthesisUtterance(triple);
   u.rate=.9;u.pitch=1;u.lang='en-PH';
   speechSynthesis.speak(u);
  }catch(e){/* If speech synthesis is blocked, the device chime still works. */}
 }
}
async function operate(action,params={},after){
 if(!ready())return null;
 writePending++;writeSerial++;
 try{
  const result=await jp(action,params);
  if(!result.ok)throw Error(result.error||'Request failed.');
  if(after)after(result);
  return result;
 }catch(e){
  error(e);return null;
 }finally{
  writePending--;
  if(writePending===0){queuedRefresh=false;void refresh(true)}
 }
}
async function queueAction(action,i){
 const key=String(i);
 if(activeWindowActions.has(key))return;
 activeWindowActions.add(key);clearStaffMessage();
 const button=document.querySelector('[data-action="'+action+'"][data-win="'+i+'"]');
 if(button){button.disabled=true;button.textContent=action==='complete'?'Completing…':action==='recall'?'Recalling…':'Calling…'}
 // Prime audio from the staff member's click; TV devices still require "Enable / Test Sound".
 if(action==='call'||action==='recall'){
  armed=true;localStorage.setItem('tqSound','1');
  try{const A=window.AudioContext||window.webkitAudioContext;if(A){audio=audio||new A();audio.resume?.()}}catch{}
 }
 const original=win(i);
 try{
  const result=await operate(action,{window:i},reply=>{
   if(action==='call'||action==='recall'){
    const ticket=reply.ticket;
    if(ticket){
     S.windows={...(S.windows||{}),[key]:ticket};
     if(action==='call')S.waiting=(S.waiting||[]).filter(x=>x.ticketId!==ticket.ticketId);
     last[i]=ticket.ticketId+'|'+ticket.calledAt;
     announce(ticket,i);
    }
   }else if(action==='complete'){
    S.windows={...(S.windows||{}),[key]:null};
    last[i]='';
    const finished=reply.ticket||original;
    if(finished)S.completed=[{...finished,status:'COMPLETED',recruiter:finished.recruiter||S.recruiters?.[key]||'',completedAt:new Date().toISOString()},...(S.completed||[])];
   }
   staffSignature='';windowSignature='';render();
  });
  if(result){
   const number=result.ticket?.queueNo||original?.queueNo||'';
   staffMessage(action==='complete'?'Completed '+number+' and saved to the queue.':action==='recall'?'Recalled '+number+' (3 voice announcements).':'Called '+number+' (3 voice announcements).','ok');
  }
 }finally{
  activeWindowActions.delete(key);
  staffSignature='';staff();
 }
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
$('announcementInput').oninput=()=>{dirty=true;$('announcementCount').textContent=$('announcementInput').value.length.toLocaleString('en-US')+' / 2,500 characters'};
function announcementParts(value,maxEncoded=1000){
  const parts=[];let current='',encoded=0;
  for(const char of value){
    const size=encodeURIComponent(char).length;
    if(current&&encoded+size>maxEncoded){parts.push(current);current='';encoded=0}
    current+=char;encoded+=size;
  }
  if(current)parts.push(current);
  return parts;
}
async function saveAnnouncement(value){
  const message=String(value||'').trim();
  if(!message||message.length>2500){error(Error('Announcement must contain 1–2,500 characters.'),true);return}
  if(S.version==='federation-v7'&&message.length>280){error(Error('Deploy Federation v8 Apps Script to save announcements longer than 280 characters.'),true);return}
  if(!ready())return;
  const btn=$('announcementSave');btn.disabled=true;btn.textContent='Saving…';
  try{
    const chunks=S.version!=='federation-v7'?announcementParts(message):[message];
    let result;
    if(chunks.length===1)result=await jp('setAnnouncement',{message});
    else{
      const batch=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,12);
      for(let offset=0;offset<chunks.length;offset+=4){
        const part=chunks.slice(offset,offset+4);
        const responses=await Promise.all(part.map((chunk,i)=>jp('announcementChunk',{batch,index:offset+i,total:chunks.length,chunk})));
        for(const r of responses)if(!r.ok)throw Error(r.error||'Announcement upload failed.');
      }
      result=await jp('setAnnouncement',{batch,total:chunks.length});
    }
    if(!result?.ok)throw Error(result?.error||'Announcement could not be saved.');
    S.announcement=result.announcement;dirty=false;$('announcementInput').value=result.announcement;tv();announceEditor();
    status('Announcement saved and synchronized with Google Sheets.','ok');
    await refresh(true);
  }catch(e){error(e,true)}finally{btn.disabled=false;btn.textContent='Save Announcement'}
}
$('announcementSave').onclick=()=>saveAnnouncement($('announcementInput').value);
$('announcementReset').onclick=()=>saveAnnouncement(DEFAULT);
$('addWin').onclick=()=>operate('addWindow');
$('cancelWindow').onclick=()=>{$('windowEditor').classList.add('hide');editWindow=0};
$('saveWindow').onclick=async()=>{
  const i=editWindow,transaction=$('editWindowTx').value,recruiter=$('editRecruiter').value.trim();
  if(!i)return;
  const save=$('saveWindow');save.disabled=true;save.textContent='Saving…';
  try{
    const result=await operate('saveWindow',{window:i,transaction,recruiter},()=>{
      S.assignments={...(S.assignments||{}),[String(i)]:transaction};
      S.recruiters={...(S.recruiters||{}),[String(i)]:recruiter};
      staffSignature='';render();
    });
    if(result){$('windowEditor').classList.add('hide');editWindow=0;status('Window '+i+' saved to Google Sheets.','ok')}
  }finally{save.disabled=false;save.textContent='Save Changes'}
};
$('cancelTx').onclick=()=>{$('txEditor').classList.add('hide');editTxCode=''};
$('saveTx').onclick=async()=>{
  const code=editTxCode,name=$('editTxName').value.trim();
  if(!code)return;
  const btn=$('saveTx');btn.disabled=true;
  try{
    const result=await operate('editTx',{code,name},()=>{
      S.transactionTypes=(S.transactionTypes||[]).map(x=>x.code===code?{...x,name}:x);
      S.transactions=(S.transactions||[]).map(x=>x.code===code?{...x,name}:x);
      staffSignature='';render();
    });
    if(result){$('txEditor').classList.add('hide');editTxCode='';status('Transaction '+code+' saved to Google Sheets.','ok')}
  }finally{btn.disabled=false}
};
for(const key of ['wait','completed'])for(const side of ['Prev','Next']){
  $(key+side).onclick=()=>{if(key==='wait')waitPage+=side==='Next'?1:-1;else completedPage+=side==='Next'?1:-1;queueTables()};
}
$('openAddTx').onclick=()=>{
 const editor=$('txAddEditor'),isOpening=editor.classList.contains('hide');
 editor.classList.toggle('hide',!isOpening);
 $('openAddTx').setAttribute('aria-expanded',String(isOpening));
 if(isOpening)$('newCode').focus();
};
$('cancelAddTx').onclick=()=>{
 $('txAddEditor').classList.add('hide');
 $('openAddTx').setAttribute('aria-expanded','false');
};
$('addTx').onclick=async()=>{
  const code=$('newCode').value.trim().toUpperCase(),name=$('newName').value.trim();
  if(!/^[A-Z0-9]{2,6}$/.test(code)||!name){error(Error('Enter a 2–6 character transaction code and a transaction name.'));return}
  const b=$('addTx');b.disabled=true;b.textContent='Saving…';
  try{
    const result=await operate('addTx',{code,name},res=>{
      const tx={...res.transaction,active:true,sort:(S.transactionTypes||[]).length+1};
      S.transactionTypes=[...(S.transactionTypes||[]),tx];
      S.transactions=[...(S.transactions||[]),tx];
      render();
    });
    if(result){
      $('newCode').value='';$('newName').value='';
      $('txAddEditor').classList.add('hide');
      $('openAddTx').setAttribute('aria-expanded','false');
      status('Transaction '+code+' saved.','ok');
    }
  }finally{b.disabled=false;b.textContent='Save Transaction Type'}
};
$('api').value=url();
$('refresh').onclick=()=>refresh();
$('sound').onclick=()=>{
 armed=true;localStorage.setItem('tqSound','1');ding();
 if('speechSynthesis' in window){
  try{
   speechSynthesis.cancel();
   const test=new SpeechSynthesisUtterance('TIPON queue announcement system is ready.');
   test.rate=.92;test.lang='en-PH';
   speechSynthesis.speak(test);
  }catch{}
 }
 status('Sound and voice announcements enabled on this device. Queue calls will be spoken three times.','ok');
};
$('save').onclick=()=>{const v=$('api').value.trim();if(!valid(v)){error(Error('Enter a valid https://script.google.com/.../exec URL.'));return}localStorage.setItem('tqApi',v);qrUrl='';refresh()};
$('test').onclick=async()=>{try{const r=await jp('health');if(!r.ok)throw Error(r.error);if(!COMPATIBLE.has(r.version))throw Error('Backend is '+(r.version||'outdated')+'. Deploy the latest Code.gs.');status('Backend verified • '+r.version+' • '+r.windows+' service windows.'+(r.version!==REQUIRED?' Update to v9 for latest performance improvements.':''),'ok');await refresh(true)}catch(e){error(e)}};
$('clear').onclick=()=>{localStorage.removeItem('tqApi');$('api').value='';S.version='';qrUrl='';status('Connection cleared.','err');qr()};
const full=$('fullscreen');
function reflect(){full.setAttribute('aria-pressed',document.fullscreenElement===$('display')?'true':'false')}
full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('display').requestFullscreen()}catch(e){error(e,true)}};
document.addEventListener('fullscreenchange',reflect);
function clock(){
  const now=new Date();
  const time=now.toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
  const date=now.toLocaleDateString('en-PH',{timeZone:'Asia/Manila',weekday:'long',year:'numeric',month:'long',day:'numeric'}).toUpperCase();
  $('clock').textContent=time;$('fullscreenTime').textContent=time;
  $('headerDay').textContent=date;$('fullscreenDate').textContent=date;
}
clock();setInterval(clock,1000);const requested=new URLSearchParams(location.search).get('view');view(['setup','staff'].includes(requested)?requested:'display');
render();refresh(false);setInterval(()=>{if(!document.hidden)void refresh(true)},5500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh(true)});
})();
