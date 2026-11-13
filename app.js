/* TIPON Federation Queue — TV display, staff console, setup (v6).
   Bundled QRCode.js renders QR without third-party image services. */
(()=>{'use strict';
const C=window.TIPON_CONFIG||{}, $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REQUIRED='federation-v13',COMPATIBLE=new Set(['federation-v7','federation-v8','federation-v9','federation-v10','federation-v11','federation-v12','federation-v13']),DEFAULT='Please keep your queue number until called.',DEFAULT_GUIDE='Hello, mga ka-miyembro! Sa mga bagong dating na wala pang queuing number, i-scan ang QR code na nakikita sa screen. Piliin ang inyong service. Para sa Recruitment, ilagay ang First Name, Last Name, Recruitment Transaction at Position. Pagkatapos, pindutin ang Get Queue Number. Para sa Member Concern, ilagay ang First Name, Last Name at Type of Concern, pagkatapos ay pindutin ang Get Queue Number. Kapag may queue number na, please keep your queue number until called.';
let S={windowCount:0,maxWindowCount:20,windows:{},waiting:[],precheckDone:[],transactions:[],transactionTypes:[],assignments:{},announcement:DEFAULT,queueGuide:DEFAULT_GUIDE,queueGuideCue:'',completed:[],recruiters:{}};
let connectionHealthy=false;
 let seq=0,loading=false,queuedRefresh=false,hasLoaded=false,writePending=0,writeSerial=0,pollTimer=null,refreshFailures=0,activeWindowActions=new Set(),tableSignature={wait:'',precheckDone:'',completed:''},qrUrl='',qrObj=null,initialized=false,last={},page='display',dirty=false,staffSignature='',windowSignature='';
let lastGuideCue=null,guideDirty=false;let armed=localStorage.getItem('tqSound')==='1',audio=null,waitPage=0,precheckDonePage=0,completedPage=0,editWindow=0,editTxCode='',editWindowTxs=[],activeStaffWindow=Number(new URLSearchParams(location.search).get('window'))||0;
let remarksTimer=null,remarksSaveQueue=Promise.resolve(),remarksDraft={ticketId:'',value:''},remarksSaved={ticketId:'',value:''},remarksQueued={ticketId:'',value:''};
const queueBoards={};
for(const [stage,prefix,emptyText] of [
  ['precheck','precheckQueue','No queues waiting for pre-checking.'],
  ['ready','readyQueue','No pre-checked queues waiting.']
])queueBoards[stage]=window.TiponQueueDisplay.createBoard({
  numbers:$(prefix+'Numbers'),count:$(prefix+'Count'),page:$(prefix+'Page'),rotation:$(prefix+'Rotation'),emptyText
});

let localTvChannel=null,lastLocalTvSeen=0;
try{
 if(typeof BroadcastChannel!=='undefined'){
  localTvChannel=new BroadcastChannel('tipon-tawag-queue-voice');
  localTvChannel.onmessage=event=>{
   const msg=event.data||{};
   if(msg.type==='tv-present'){lastLocalTvSeen=Date.now();return}
   if(msg.type==='tv-probe'&&page==='display'){
     localTvChannel.postMessage({type:'tv-present'});return;
   }
   if(msg.type==='play-instructions'&&page==='display'&&armed&&
      Number.isFinite(Number(msg.sentAt))&&Date.now()-Number(msg.sentAt)<30000){
     speakQueueInstructions(String(msg.text||DEFAULT_GUIDE));
   }
  };
  // Presence only: no personal queue data, images, or document fields cross tabs.
  setInterval(()=>{
   if(page==='display')localTvChannel.postMessage({type:'tv-present'});
  },6000);
  localTvChannel.postMessage({type:'tv-probe'});
 }
}catch{localTvChannel=null}

function url(){return new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||''}
function valid(u){try{const p=new URL(u);return p.origin==='https://script.google.com'&&p.pathname.endsWith('/exec')}catch{return false}}
function normalizeAssignment(value){
 if(value===undefined||value===null||value==='')return 'ALL';
 let entries=value;
 if(typeof entries==='string'){
  const raw=entries.trim();
  if(!raw||raw.toUpperCase()==='ALL')return 'ALL';
  if(raw[0]==='['){try{entries=JSON.parse(raw)}catch{entries=raw.split(/[;,|]/)}}
  else entries=raw.split(/[;,|]/);
 }
 if(!Array.isArray(entries))entries=[entries];
 const codes=[...new Set(entries.map(x=>String(x||'').trim().toUpperCase()).filter(Boolean))];
 if(!codes.length||codes.includes('ALL'))return 'ALL';
 return codes.length===1?codes[0]:codes;
}
function assignmentList(value){const normalized=normalizeAssignment(value);return normalized==='ALL'?'ALL':Array.isArray(normalized)?normalized:[normalized]}
function assignmentIncludes(value,code){const list=assignmentList(value);return list==='ALL'||list.includes(String(code||'').toUpperCase())}
function assignmentLabel(value){
 const list=assignmentList(value);
 return list==='ALL'?'Any transaction':list.map(code=>(S.transactions||[]).find(x=>x.code===code)?.name||code).join(', ');
}
function isPrecheckingCode(code){
 const tx=(S.transactions||[]).find(x=>x.code===code);
 return code==='PC'||/pre[\s-]*checking/i.test(tx?.name||'');
}
function isPrecheckingWindow(i){
 const list=assignmentList(S.assignments?.[String(i)]||'ALL');
 return list!=='ALL'&&list.some(isPrecheckingCode);
}
function transferDestinations(source,ticket){
 const allowed=['MC','NH','RH','TR'],original=String(ticket?.transaction||'').toUpperCase(),targets=[];
 for(let i=1;i<=Number(S.windowCount||0);i++){
  if(i===source||isPrecheckingWindow(i))continue;
  const assigned=assignmentList(S.assignments?.[String(i)]||'ALL');
  const matches=allowed.includes(original)&&(assigned==='ALL'||assigned.includes(original));
  const transaction=matches?(S.transactions||[]).find(tx=>tx.code===original)||null:null;
  targets.push({window:i,transaction,available:!win(i),matches});
 }
 return targets;
}
function status(t,k=''){
 const e=$('setupAlert');e.textContent=t;e.className='status '+k;
 if(k==='err'&&page==='staff')staffMessage(t,'err');
}
function staffMessage(t,k='ok'){
 const a=$('staffAlert');if(!a)return;
 a.textContent=t;a.className='status staff-alert '+k;
}
function clearStaffMessage(){const a=$('staffAlert');if(a){a.textContent='';a.className='status staff-alert hide'}}

function view(v){
  if(!['display','staff','setup'].includes(v))v='display';
  const previous=page;
  page=v;
  // URL and session state both preserve the active tab after F5/Ctrl+R.
  try{
    sessionStorage.setItem('tqLastView',v);
    const locationUrl=new URL(window.location.href);
    if(v==='display')locationUrl.searchParams.delete('view');
    else locationUrl.searchParams.set('view',v);
    history.replaceState(history.state,'',locationUrl.pathname+locationUrl.search+locationUrl.hash);
  }catch(e){/* Browser storage may be disabled; current tab still works. */}
  ['display','staff','setup'].forEach(x=>$(x).classList.toggle('hide',x!==v));
  document.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  $('fullscreen').classList.toggle('hide',v!=='display');
  if(v==='display')renderWaitingBoards();
  if(v==='setup')setupTables();
  if(previous!==v&&hasLoaded)void refresh(true);
}
function error(e){let t=String(e?.message||e||'Unknown error');
 if(t.includes('Unknown action'))t='Apps Script needs a backend update. Check the Code.gs deployment in Setup.';
 if(t.includes('timed out'))t='The queue server did not confirm in time. Rechecking the latest queue status; do not repeat the action until the result is visible.';
 status(t,'err'); /* Never redirect staff away from the active service window. */
}
document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>view(b.dataset.v));
function jp(action,params={},endpoint=url()){return new Promise((resolve,reject)=>{
 if(!valid(endpoint))return reject(Error('Configure a valid Apps Script /exec URL in Setup.'));
 const cb='__tipon'+Date.now()+(++seq),tag=document.createElement('script');let finished=false;
 const tm=setTimeout(()=>finish(Error('Apps Script timed out.')),action==='state'?19000:27000);
 function finish(err,data){if(finished)return;finished=true;clearTimeout(tm);delete window[cb];tag.remove();err?reject(err):resolve(data)}
 window[cb]=data=>finish(null,data);tag.onerror=()=>finish(Error('Cannot connect to Apps Script. Check the /exec deployment access, authorization and URL in Setup.'));
 const q=new URL(endpoint);q.searchParams.set('action',action);q.searchParams.set('callback',cb);
 Object.entries(params).forEach(([k,v])=>q.searchParams.set(k,String(v??'')));tag.src=q.href;document.head.appendChild(tag);
})}
function ready(){if(connectionHealthy&&COMPATIBLE.has(S.version))return true;error(Error('Apps Script is disconnected or outdated. Restore connectivity before changing queues.'));return false}
function joinURL(){
 const u=new URL('join.html',C.pagesUrl||location.href);
 // Prefer the short, stable public QR URL. Preserve an explicitly changed
 // backend URL only when it differs from the published site configuration.
 // The QR renderer below falls back to Q/M for long URLs that overflow at H.
 const configured=url();
 if(valid(configured)&&configured!==String(C.backendUrl||''))u.searchParams.set('api',configured);
 return u.href;
}
function qr(){
 const link=joinURL(),holder=$('qr'),setupLink=$('getQueueSetup');
 setupLink.href=link;
 if(link===qrUrl&&holder.querySelector('canvas,img,svg,table'))return;
 qrUrl='';
 holder.replaceChildren();
 if(typeof QRCode==='undefined'){
   const a=document.createElement('a');a.href=link;a.textContent='Open Get Queue Page';holder.appendChild(a);
   status('QR generator was not loaded. Reload this page to restore the QR code.','err');
   return;
 }
 let lastError=null;
 const errorCorrection=[
   QRCode.CorrectLevel.H,
   QRCode.CorrectLevel.Q,
   QRCode.CorrectLevel.M
 ];
 for(const correctionLevel of errorCorrection){
   try{
     holder.replaceChildren();
     qrObj=new QRCode(holder,{
       text:link,width:640,height:640,colorDark:'#102f45',colorLight:'#ffffff',
       correctLevel:correctionLevel
     });
     if(!holder.querySelector('canvas,img,svg,table'))
       throw Error('QR renderer produced no image');
     qrUrl=link;
     return;
   }catch(err){lastError=err;holder.replaceChildren()}
 }
 const fallback=document.createElement('a');
 fallback.href=link;fallback.textContent='Open Get Queue Page';holder.appendChild(fallback);
 status('QR generation failed: '+String(lastError?.message||'Unknown error'),'err');
}
function win(i){return S.windows?.[String(i)]||null}
function renderWaitingBoards(){
  if(page!=='display')return;
  const groups=window.TiponQueueDisplay.splitWaitingQueues(S),now=Date.now();
  queueBoards.precheck.update(groups.precheck,now);
  queueBoards.ready.update(groups.ready,now);
  const windows=Array.from({length:Number(S.windowCount||0)},(_,i)=>i+1).filter(isPrecheckingWindow);
  const label=windows.length>1?'Windows '+windows.join(' / '):'Window '+(windows[0]||1);
  const hint='New arrivals - Please wait to be called at '+label+'.';
  if($('precheckQueueHint').textContent!==hint)$('precheckQueueHint').textContent=hint;
}
function tv(){
  const count=Number(S.windowCount||0),indexes=Array.from({length:count},(_,i)=>i+1);
  const signature=JSON.stringify({windows:S.windows,count});
  if(signature!==windowSignature){
    windowSignature=signature;
    $('wins').innerHTML=indexes.map(i=>{const t=win(i);
      return '<div class="window"><span class="window-label">WINDOW '+i+'</span>'+
       (t?'<div class="queue-no">'+esc(t.queueNo)+'</div><strong>'+esc(t.name)+'</strong><small>'+esc(t.transactionName)+'</small>':
       '<div class="queue-no idle">—</div><small>READY FOR NEXT</small>')+'</div>'
    }).join('');
  }
  renderWaitingBoards();
  const announcement=String(S.announcement||DEFAULT);
  const ticker=$('ann');
  if(ticker.textContent!==announcement){
    ticker.textContent=announcement;
    ticker.style.animationDuration=Math.max(18,announcement.length*.23)+'s';
    ticker.classList.remove('announcement-ticker');
    void ticker.offsetWidth;
    ticker.classList.add('announcement-ticker');
  }
  const cue=String(S.queueGuideCue||'');
  if(lastGuideCue===null)lastGuideCue=cue;
  else if(cue&&cue!==lastGuideCue&&page==='display'){
    lastGuideCue=cue;
    const commandTime=Number(cue.split('-')[0]);
    if(armed&&Number.isFinite(commandTime)&&Date.now()-commandTime<120000)
      speakQueueInstructions(String(S.queueGuide||DEFAULT_GUIDE));
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
function currentQueueGuide(){
 if(S.queueGuideSupported===true)return String(S.queueGuide||DEFAULT_GUIDE);
 try{return String(localStorage.getItem('tqQueueGuideLocalDraft')||S.queueGuide||DEFAULT_GUIDE)}
 catch{return String(S.queueGuide||DEFAULT_GUIDE)}
}
function guideEditor(){
 if(!guideDirty&&document.activeElement!==$('guideText'))$('guideText').value=currentQueueGuide();
}
function metrics(){
  $('metricWindows').textContent=connectionHealthy?String(S.windowCount||0):'—';
  $('metricWait').textContent=connectionHealthy?String((S.waiting||[]).length):'—';
  $('metricServing').textContent=connectionHealthy?String(Array.from({length:Number(S.windowCount||0)},(_,i)=>win(i+1)).filter(Boolean).length):'—';
}
function updateStaffWindowRoute(value){
 try{
  const next=new URL(window.location.href);
  if(value)next.searchParams.set('window',String(value));else next.searchParams.delete('window');
  history.replaceState(history.state,'',next.pathname+next.search+next.hash);
 }catch{}
}
function openStaffWindow(i){
 activeStaffWindow=Number(i)||0;updateStaffWindowRoute(activeStaffWindow);
 $('windowEditor').classList.add('hide');$('editWindowTxMenu').classList.add('hide');editWindow=0;
 waitPage=0;precheckDonePage=0;completedPage=0;tableSignature={wait:'',precheckDone:'',completed:''};staffSignature='';
 staff();queueTables();window.scrollTo({top:0,behavior:'smooth'});
}
function staff(){
  const n=Number(S.windowCount||0);
  if(hasLoaded&&activeStaffWindow>n){activeStaffWindow=0;updateStaffWindowRoute(0)}
  const isOpen=activeStaffWindow>0;
  const signature=JSON.stringify({isOpen,activeStaffWindow,n,max:S.maxWindowCount,version:S.version,windows:S.windows,tx:S.transactions,assignments:S.assignments,waiting:S.waiting,recruiters:S.recruiters,connectionHealthy,actions:[...activeWindowActions]});
  $('wc').textContent=n+' WINDOWS';
  $('addWin').disabled=!COMPATIBLE.has(S.version)||n>=Number(S.maxWindowCount||20);
  $('staffMetrics').classList.toggle('hide',isOpen);
  $('staffListHeader').classList.toggle('hide',isOpen);
  $('windowConsoleHeader').classList.toggle('hide',!isOpen);
  $('queuePrecheckDoneCard').classList.remove('hide');
  $('queueWaitingCard').classList.remove('hide');
  $('queueCompletedCard').classList.remove('hide');
  $('staffPageHint').textContent=isOpen?'Window '+activeStaffWindow+' console. Queue history is shared across all service windows.':'Select Open to manage a service window. All queues are listed below.';
  $('waitingQueueDescription').textContent='Applicants and members waiting across all service windows.';
  $('precheckDoneDescription').textContent='Applicants and members checked at Pre Checking who are waiting for an available service window.';
  $('completedQueueDescription').textContent='Completed transactions across all service windows, newest first.';
  if(isOpen){$('windowConsoleTitle').textContent='Window '+activeStaffWindow+' Console';}
  if(signature===staffSignature)return;
  staffSignature=signature;
  if(!isOpen){
    const windows=S.windows||{},recruiters=S.recruiters||{};
    const canDeleteWindow=i=>!Object.entries(windows).some(([number,ticket])=>Boolean(ticket)&&Number(number)>=i);
    const rows=Array.from({length:n},(_,idx)=>{
      const i=idx+1,t=windows[String(i)]||null,assigned=assignmentLabel(S.assignments?.[String(i)]||'ALL'),recruiter=recruiters[String(i)]||'—',canDelete=canDeleteWindow(i);
      return '<tr><td><b>Window '+i+'</b></td><td>'+esc(assigned)+'</td><td>'+esc(recruiter)+'</td><td>'+(t?'Serving '+esc(t.queueNo):'Available')+'</td><td class="actions-cell staff-window-actions">'+
        '<button class="btn sm primary" data-open-window="'+i+'" type="button">Open</button>'+
        '<button class="btn sm" data-edit-win="'+i+'" type="button"'+(!COMPATIBLE.has(S.version)?' disabled':'')+'>Edit</button>'+
        '<button class="btn sm danger" data-delete-win="'+i+'" type="button"'+(!COMPATIBLE.has(S.version)||!canDelete||n<=1?' disabled':'')+' title="'+(!canDelete?'Complete this or later active windows first':'Delete window immediately')+'">Delete</button></td></tr>';
    }).join('');
    $('staffWins').innerHTML='<div class="table-wrap"><table><thead><tr><th>Window</th><th>Assigned transaction</th><th>Recruiter</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+(
      rows||'<tr><td colspan="5" class="empty">'+(connectionHealthy?'No windows available. Add a window in Staff Console.':'Waiting for saved service windows from Apps Script.')+'</td></tr>'
    )+'</tbody></table></div>';
    document.querySelectorAll('[data-open-window]').forEach(button=>button.onclick=()=>openStaffWindow(button.dataset.openWindow));
    document.querySelectorAll('[data-edit-win]').forEach(button=>button.onclick=()=>openWindowEditor(Number(button.dataset.editWin)));
    document.querySelectorAll('[data-delete-win]').forEach(button=>button.onclick=async()=>{
      if(button.disabled)return;
      button.disabled=true;button.textContent='Deleting…';
      const result=await operate('deleteWindow',{window:Number(button.dataset.deleteWin)});
      if(!result){staffSignature='';staff()}
    });
    return;
  }
  const i=activeStaffWindow,t=win(i),selected=S.assignments?.[String(i)]||'ALL',
    txName=assignmentLabel(selected),recruiter=S.recruiters?.[String(i)]||'Unassigned',prechecking=isPrecheckingWindow(i),hasPrechecking=Object.keys(S.assignments||{}).some(window=>isPrecheckingWindow(Number(window)));
  const canCallNext=prechecking
    ? (S.waiting||[]).some(ticket=>['MC','NH','RH','TR'].includes(String(ticket.transaction||'').toUpperCase()))
    : hasPrechecking
      ? (S.precheckDone||[]).some(ticket=>assignmentIncludes(selected,ticket.transaction))
      : (S.waiting||[]).some(ticket=>assignmentIncludes(selected,ticket.transaction));
  const callNextDisabled=Boolean(t)||!connectionHealthy||!canCallNext||activeWindowActions.has(String(i));
  const callNextTitle=!canCallNext?(prechecking?'No unchecked queue is waiting.':hasPrechecking?'No matching Done Pre-check queue is waiting.':'No matching queue is waiting.'):'';
  const activeTicketId=String(t?.ticketId||'');
  if(remarksDraft.ticketId!==activeTicketId){
    remarksDraft={ticketId:activeTicketId,value:String(t?.remarks||'')};
    remarksSaved={ticketId:activeTicketId,value:String(t?.remarks||'')};
    remarksQueued={ticketId:'',value:''};
  }else if(t&&!remarksQueued.ticketId&&!remarksTimer&&remarksDraft.value===String(t.remarks||'')){
    remarksSaved={ticketId:activeTicketId,value:String(t.remarks||'')};
  }
  const remarksValue=t&&remarksDraft.ticketId===activeTicketId?remarksDraft.value:String(t?.remarks||'');
  const remarksStatus=remarksValue===String(t?.remarks||'')?'Saved':'Unsaved';
  const destinations=prechecking?transferDestinations(i,t):[];
  const transferButtons=destinations.map(destination=>{
    const transaction=destination.transaction,sourceBusy=activeWindowActions.has(String(i)),targetBusy=activeWindowActions.has(String(destination.window));
    const ready=Boolean(t&&destination.available&&transaction),disabled=!ready||!connectionHealthy||S.version!==REQUIRED||sourceBusy||targetBusy;
    const title=!t?'Call a queue in Pre Checking first.':!transaction?'This window is not assigned to the transaction for this queue number.':!destination.available?'This window is currently serving a ticket.':'Transfer the checked ticket to this window.';
    return '<button class="btn '+(ready?'success window-available':'primary window-busy')+' precheck-window-button" data-transfer-from="'+i+'" data-transfer-target="'+destination.window+'" data-transfer-code="'+esc(transaction?.code||'')+'" type="button"'+(disabled?' disabled':'')+' title="'+esc(title)+'"><b>Window '+destination.window+'</b></button>';
  }).join('');
  const transferHint=!t?'Call a queue to enable the destination window buttons.':S.version!==REQUIRED?'Deploy Federation v13 Apps Script to enable transfers.':destinations.some(x=>x.available&&x.transaction)?'Choose an idle window button to transfer the checked ticket.':'No available window is assigned to this queue transaction. Use Done Pre-check to wait.';
  const transferPanel=prechecking?'<div class="precheck-transfer"><b class="transfer-title">Transfer to window</b><div class="precheck-window-buttons">'+(transferButtons||'<small class="transfer-hint">Add a service window to create a destination button.</small>')+'</div><small class="transfer-hint">'+esc(transferHint)+'</small></div>':'';
  const hasAvailableDestination=destinations.some(destination=>destination.available&&destination.transaction);
  const donePrecheckDisabled=!t||hasAvailableDestination||!connectionHealthy||S.version!==REQUIRED||activeWindowActions.has(String(i));
  const donePrecheckTitle=!t?'Call a queue in Pre Checking first.':hasAvailableDestination?'A destination window is available. Transfer the ticket directly.':!connectionHealthy?'Connect to Apps Script to update the queue.':S.version!==REQUIRED?'Deploy Federation v13 Apps Script.':'Save this checked ticket to Done Pre-check until a matching window becomes available.';
  $('staffWins').innerHTML='<div class="window-grid"><div class="window-card"><div class="split"><h3>Window '+i+'</h3><span class="pill">'+esc(txName)+'</span></div>'+
    '<div class="current">'+(t?'<b class="current-no">'+esc(t.queueNo)+'</b><strong>'+esc(t.name)+'</strong><small>'+esc(t.transactionName)+'</small>':'<small class="muted">No active applicant or member</small>')+'</div>'+
    '<p class="recruiter-label"><b>Recruiter:</b> '+esc(recruiter)+'</p>'+
    '<div class="window-actions '+(prechecking?'prechecking':'standard')+'"><button class="btn primary" data-action="call" data-win="'+i+'" type="button"'+(callNextDisabled?' disabled':'')+(callNextTitle?' title="'+esc(callNextTitle)+'"':'')+'>Call Next</button>'+
    '<button class="btn ghost" data-action="recall" data-win="'+i+'" type="button"'+(!t||!connectionHealthy?' disabled':'')+'>Recall</button>'+
    (prechecking?'<button class="btn success" data-action="donePrecheck" data-win="'+i+'" type="button"'+(donePrecheckDisabled?' disabled':'')+' title="'+esc(donePrecheckTitle)+'">Done Pre-check</button>':'<button class="btn success" data-action="complete" data-win="'+i+'" type="button"'+(!t||!connectionHealthy?' disabled':'')+'>Complete</button>')+'</div>'+
    (prechecking?'':'<label class="field window-remarks" for="windowRemarks"><span class="remarks-head"><b>Remarks</b><small id="remarksStatus">'+esc(remarksStatus)+'</small></span><textarea id="windowRemarks" maxlength="500" rows="3" placeholder="Add remarks for this applicant or member."'+(!t||!connectionHealthy?' disabled':'')+'>'+esc(remarksValue)+'</textarea></label>')+transferPanel+'</div></div>';
  document.querySelectorAll('[data-action]').forEach(button=>button.onclick=()=>queueAction(button.dataset.action,+button.dataset.win));
  const remarksInput=$('windowRemarks');
  if(remarksInput){
    remarksInput.oninput=()=>{
      const value=remarksInput.value.slice(0,500),ticketId=String(t?.ticketId||'');
      remarksDraft={ticketId,value};
      const status=$('remarksStatus');if(status)status.textContent='Unsaved';
      if(remarksTimer)clearTimeout(remarksTimer);
      if(ticketId)remarksTimer=setTimeout(()=>{remarksTimer=null;void queueRemarksSave(i,ticketId,value)},650);
    };
    remarksInput.onblur=()=>{
      if(remarksTimer)clearTimeout(remarksTimer);
      remarksTimer=null;
      const ticketId=String(t?.ticketId||'');
      if(ticketId)void queueRemarksSave(i,ticketId,remarksInput.value);
    };
  }
  document.querySelectorAll('[data-transfer-target]').forEach(button=>button.onclick=()=>{
    const source=Number(button.dataset.transferFrom),target=Number(button.dataset.transferTarget),transaction=button.dataset.transferCode;
    if(source&&target&&transaction)void transferTicket(source,target,transaction);
  });
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
    const label=key==='wait'?'wait':key==='done'?'precheckDone':'completed';
    const cells=rows.map(x=>{
      const base='<td>'+esc(dateDisplay(x))+'</td><td><b>'+esc(x.queueNo)+'</b></td><td>'+esc(x.name)+'</td><td>'+esc(x.transactionName)+'</td><td>'+esc(x.position)+'</td>';
      const extra=key==='done'?'<td>'+esc(x.precheckedBy||'—')+'</td>':
        key==='completed'?'<td>'+esc(x.precheckedBy||'—')+'</td><td>'+esc(x.recruiter||'—')+'</td><td class="completed-remarks">'+esc(x.remarks||'—')+'</td>':'';
      return '<tr>'+base+extra+'</tr>';
    }).join('');
    const columns=key==='completed'?8:key==='done'?6:5;
    const emptyText=key==='wait'?'waiting':key==='done'?'done Pre-check':'completed';
    $(bodyId).innerHTML=rows.length?cells:'<tr><td colspan="'+columns+'" class="empty">No '+emptyText+' applicants or members.</td></tr>';
    $(label+'Showing').textContent='Showing '+(count?p*size+1:0)+'–'+Math.min((p+1)*size,count)+' of '+count;
    $(label+'Page').textContent='Page '+(p+1)+' of '+(lastPage+1);
    $(label+'Prev').disabled=p===0;$(label+'Next').disabled=p===lastPage;return p;
  };
  waitPage=make(S.waiting||[],waitPage,'wait','wt');
  precheckDonePage=make(S.precheckDone||[],precheckDonePage,'done','precheckDoneBody');
  completedPage=make(S.completed||[],completedPage,'completed','ct');
}
function setupTables(){
  const connected=Boolean(S.version),writable=COMPATIBLE.has(S.version);
  const list=(Array.isArray(S.transactionTypes)&&S.transactionTypes.length?S.transactionTypes:Array.isArray(S.transactions)?S.transactions:[]).filter(x=>x.active!==false);
  $('addTx').disabled=!writable;
  $('openAddTx').disabled=!writable;
  $('setupTx').innerHTML=list.length?list.map(x=>{
    return '<tr><td><b>'+esc(x.code)+'</b></td><td>'+esc(x.name)+'</td><td>Active</td><td class="actions-cell">'+
      '<button class="btn sm" type="button" data-edit-tx="'+esc(x.code)+'"'+(!writable?' disabled':'')+'>Edit</button>'+
      '<button class="btn sm danger" type="button" data-delete-tx="'+esc(x.code)+'"'+(!writable?' disabled':'')+'>Delete</button></td></tr>';
  }).join(''):'<tr><td colspan="4" class="empty">'+(connected?'No active transaction types. Add one above.':'Waiting for saved transaction types from Apps Script.')+'</td></tr>';
  document.querySelectorAll('[data-edit-tx]').forEach(b=>b.onclick=()=>openTxEditor(b.dataset.editTx));
  document.querySelectorAll('[data-delete-tx]').forEach(b=>b.onclick=async()=>{
    if(b.disabled)return;
    const code=b.dataset.deleteTx;
    b.disabled=true;b.textContent='Deleting…';
    // Backend uses a history-safe soft delete; the inactive row disappears from Setup.
    const result=await operate('deleteTx',{code},()=>{
      S.transactionTypes=(S.transactionTypes||[]).filter(t=>t.code!==code);
      S.transactions=(S.transactions||[]).filter(t=>t.code!==code);
      for(const k of Object.keys(S.assignments||{}))if(S.assignments[k]===code)S.assignments[k]='ALL';
      if(editTxCode===code){$('txEditor').classList.add('hide');editTxCode=''}
      staffSignature='';render();
    });
    if(!result)setupTables();
    else status('Transaction '+code+' removed from active services. Previous queue records remain preserved.','ok');
  });
}
function updateWindowAssignmentDropdown(){
  const menu=$('editWindowTxMenu');
  if(!menu)return;
  menu.querySelectorAll('[data-window-tx]').forEach(input=>input.checked=editWindowTxs.includes(input.value));
  const label=editWindowTxs.includes('ALL')?'Any transaction':editWindowTxs.length?editWindowTxs.map(code=>(S.transactions||[]).find(x=>x.code===code)?.name||code).join(', '):'Select transactions';
  $('editWindowTxLabel').textContent=label;
}
function toggleWindowAssignment(code){
  if(code==='ALL')editWindowTxs=editWindowTxs.includes('ALL')?[]:['ALL'];
  else{
    const selected=editWindowTxs.includes(code);
    editWindowTxs=editWindowTxs.filter(x=>x!=='ALL');
    editWindowTxs=selected?editWindowTxs.filter(x=>x!==code):[...editWindowTxs,code];
  }
  updateWindowAssignmentDropdown();
}
function openWindowEditor(i){
  editWindow=i;$('windowEditorTitle').textContent='Edit Window '+i;
  const selected=assignmentList(S.assignments?.[String(i)]||'ALL');
  editWindowTxs=selected==='ALL'?['ALL']:selected.slice();
  $('editWindowTxMenu').innerHTML='<label class="assignment-option"><input type="checkbox" data-window-tx="ALL" value="ALL"> Any transaction</label>'+
    (S.transactions||[]).map(x=>'<label class="assignment-option"><input type="checkbox" data-window-tx="'+esc(x.code)+'" value="'+esc(x.code)+'"> '+esc(x.code+' · '+x.name)+'</label>').join('');
  $('editWindowTxMenu').querySelectorAll('[data-window-tx]').forEach(input=>input.onchange=()=>toggleWindowAssignment(input.value));
  updateWindowAssignmentDropdown();
  $('editRecruiter').value=S.recruiters?.[String(i)]||'';
  $('editWindowTxMenu').classList.add('hide');$('editWindowTxToggle').setAttribute('aria-expanded','false');
  $('windowEditor').classList.remove('hide');$('windowEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function openTxEditor(code){
  editTxCode=code;$('txEditorTitle').textContent='Edit '+code;
  $('editTxName').value=(S.transactionTypes||S.transactions||[]).find(x=>x.code===code)?.name||'';
  $('txEditor').classList.remove('hide');$('txEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
function render(){tv();metrics();staff();queueTables();if(page==='setup')setupTables();announceEditor();guideEditor();qr()}
/* 
 * Near-real-time updates via serialized, adaptive polling.
 * GitHub Pages + Google Apps Script cannot push updates to other devices,
 * so we poll active TV/staff screens frequently without overlapping calls.
 */
function nextPollDelay(){
  const base=page==='setup'?6500:document.fullscreenElement===$('display')?2000:2500;
  return Math.min(24000,base*Math.pow(2,Math.min(refreshFailures,3)));
}
function schedulePoll(delay=nextPollDelay()){
  if(pollTimer!==null)clearTimeout(pollTimer);
  pollTimer=null;
  if(document.hidden)return;
  pollTimer=setTimeout(()=>{pollTimer=null;void refresh(true)},delay);
}
function pollOnResume(){
  if(document.hidden)return;
  if(loading||writePending>0){queuedRefresh=true;return}
  if(pollTimer!==null){clearTimeout(pollTimer);pollTimer=null}
  void refresh(true);
}
async function refresh(silent=false){
  if(writePending>0||loading){queuedRefresh=true;return}
  if(pollTimer!==null){clearTimeout(pollTimer);pollTimer=null}
  loading=true;
  const serial=writeSerial,requestedView=page;let requestedUrl=url();
  try{
    if(!valid(requestedUrl)){
      if(!silent)status('No backend configured. Add an Apps Script /exec URL in Setup.','err');
      render();
      return;
    }
    let response;
    try{response=await jp('state',{view:requestedView},requestedUrl)}
    catch(originalError){
      const fallback=String(C.backendUrl||'');
      if(!valid(fallback)||fallback===requestedUrl)throw originalError;
      response=await jp('state',{view:requestedView},fallback);
      if(!response.ok)throw Error(response.error||'Official queue backend did not respond.');
      localStorage.removeItem('tqApi');
      try{const u=new URL(window.location.href);u.searchParams.delete('api');history.replaceState(null,'',u.pathname+u.search+u.hash)}catch{}
      requestedUrl=fallback;
    }
    if(!response.ok)throw Error(response.error||'Failed to fetch queue.');
    if(serial!==writeSerial||requestedView!==page||requestedUrl!==url()){
      queuedRefresh=true;return; // Drop an obsolete result from before an edit or navigation.
    }
    refreshFailures=0;connectionHealthy=true;
    S={...S,...response.state,
       transactions:Array.isArray(response.state?.transactions)?response.state.transactions:[],
       transactionTypes:response.state?.transactionTypes||response.state?.transactions||[],
       precheckDone:Array.isArray(response.state?.precheckDone)?response.state.precheckDone:[],
       queueGuideSupported:response.state?.queueGuideSupported===true,
       };
    hasLoaded=true;
    render();
    if(!COMPATIBLE.has(S.version))
      status('Backend version is outdated. Check the Apps Script deployment.','err');
    else if(S.version!==REQUIRED)
      status('Connected to '+S.version+'. Deploy Federation v13 Code.gs for multi-select assignments and Pre Checking transfers.','err');
    else status('Connected to tipón TAWAG • '+S.version+' • Synced '+new Date().toLocaleTimeString('en-PH',{timeZone:'Asia/Manila'}),'ok');
  }catch(e){
    connectionHealthy=false;
    refreshFailures=Math.min(refreshFailures+1,4);
    staffSignature='';if(page==='staff'){metrics();staff();}
    if(!silent||page==='setup'||page==='staff')error(e);
  }finally{
    loading=false;
    if(writePending>0){queuedRefresh=true;return}
    const urgent=queuedRefresh;
    queuedRefresh=false;
    schedulePoll(urgent?150:nextPollDelay());
  }
}
function ding(){try{const A=window.AudioContext||window.webkitAudioContext;audio=audio||new A();audio.resume?.();
 const t=audio.currentTime;[[660,0],[880,.18]].forEach(([f,offset])=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.001,t+offset);g.gain.exponentialRampToValueAtTime(.2,t+offset+.03);g.gain.exponentialRampToValueAtTime(.001,t+offset+.25);o.connect(g);g.connect(audio.destination);o.start(t+offset);o.stop(t+offset+.27)})}catch{}}
function speakQueueInstructions(message){
 if(!armed||!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined')return false;
 try{
   speechSynthesis.cancel();
   ding();
   const content=String(message||DEFAULT_GUIDE).trim();
   if(!content)return false;
   // Short utterances avoid browsers dropping long Taglish announcements.
   const segments=content.match(/[^.!?]+[.!?]?/g)||[content];
   const voices=speechSynthesis.getVoices?speechSynthesis.getVoices():[];
   const filipino=voices.find(v=>/^(fil|tl)(-|_)/i.test(v.lang));
   const fallback=voices.find(v=>/^en[-_]PH/i.test(v.lang));
   for(const sentence of segments){
     const text=sentence.trim();if(!text)continue;
     const u=new SpeechSynthesisUtterance(text);
     u.lang=filipino?.lang||fallback?.lang||'fil-PH';
     if(filipino||fallback)u.voice=filipino||fallback;
     u.rate=.91;u.pitch=1;
     speechSynthesis.speak(u);
   }
   return true;
 }catch(e){return false}
}
function announce(ticket,i){
 if(!armed)return;
 const number=String(ticket.queueNo||'').trim().replace(/-/g,' ').replace(/([0-9])/g,'$1 ');
 const line=number.trim()+', '+String(ticket.name||'')+', please proceed to Window '+i+'.';
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
  if(after){
    try{after(result)}catch(uiError){
      // A frontend rendering error must not be presented as a failed backend write.
      console.warn('Local UI update will be retried on refresh',uiError);
    }
  }
  return result;
 }catch(e){
  error(e);return null;
 }finally{
  writePending--;
  if(writePending===0){queuedRefresh=false;void refresh(true)}
 }
}
function queueRemarksSave(i,ticketId,value){
 const clean=String(value??'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,500);
 if(!ticketId)return Promise.resolve(false);
 if(remarksDraft.ticketId===ticketId)remarksDraft.value=clean;
 if(remarksSaved.ticketId===ticketId&&remarksSaved.value===clean)return Promise.resolve(true);
 if(remarksQueued.ticketId===ticketId&&remarksQueued.value===clean)return remarksSaveQueue;
 remarksQueued={ticketId,value:clean};
 remarksSaveQueue=remarksSaveQueue.catch(()=>false).then(async()=>{
  if(remarksSaved.ticketId===ticketId&&remarksSaved.value===clean)return true;
  const result=await operate('saveRemarks',{window:i,ticketId,remarks:clean},()=>{
   const active=win(i);
   if(active&&active.ticketId===ticketId)S.windows={...(S.windows||{}),[String(i)]:{...active,remarks:clean}};
   staffSignature='';windowSignature='';render();
  });
  if(result){
   remarksSaved={ticketId,value:clean};
   if(remarksQueued.ticketId===ticketId&&remarksQueued.value===clean)remarksQueued={ticketId:'',value:''};
   const status=$('remarksStatus');if(status&&remarksDraft.ticketId===ticketId&&remarksDraft.value===clean)status.textContent='Saved';
   return true;
  }
  if(remarksQueued.ticketId===ticketId&&remarksQueued.value===clean)remarksQueued={ticketId:'',value:''};
  const status=$('remarksStatus');if(status)status.textContent='Not saved';
  return false;
 });
 return remarksSaveQueue;
}
async function queueAction(action,i){
 if(action==='complete'&&isPrecheckingWindow(i)){staffMessage('Pre Checking tickets must be transferred to an available service window.','err');return}
 if(action==='donePrecheck'&&!isPrecheckingWindow(i)){staffMessage('Done Pre-check is only available in a Pre Checking window.','err');return}
 const key=String(i);
 if(activeWindowActions.has(key))return;
 activeWindowActions.add(key);clearStaffMessage();
 const button=document.querySelector('[data-action="'+action+'"][data-win="'+i+'"]');
 if(button)button.disabled=true;
 if(button)button.textContent=action==='complete'?'Completing…':action==='donePrecheck'?'Saving…':action==='recall'?'Recalling…':'Calling…';
 // Prime audio from the staff member's click; TV devices still require "Enable / Test Sound".
 if(action==='call'||action==='recall'){
  armed=true;localStorage.setItem('tqSound','1');
  try{const A=window.AudioContext||window.webkitAudioContext;if(A){audio=audio||new A();audio.resume?.()}}catch{}
 }
 let original=win(i);
 try{
  if(action==='recall'&&original?.ticketId){
   if(remarksTimer)clearTimeout(remarksTimer);remarksTimer=null;
   await remarksSaveQueue.catch(()=>false);
  }
  if(action==='complete'&&original?.ticketId){
   if(remarksTimer)clearTimeout(remarksTimer);remarksTimer=null;
   const remarks=$('windowRemarks')?.value??original.remarks??'';
   const saved=await queueRemarksSave(i,original.ticketId,remarks);
   if(!saved)return;
   original=win(i)||original;
  }
  const args=action==='complete'||action==='donePrecheck'?{window:i,ticketId:original?.ticketId||''}:{window:i};
  const result=await operate(action,args,reply=>{
   if(action==='call'||action==='recall'){
    const ticket=reply.ticket;
    if(ticket){
     S.windows={...(S.windows||{}),[key]:ticket};
     if(action==='call'){
      S.waiting=(S.waiting||[]).filter(x=>x.ticketId!==ticket.ticketId);
      S.precheckDone=(S.precheckDone||[]).filter(x=>x.ticketId!==ticket.ticketId);
     }
     if(action==='recall'){
      if(remarksTimer)clearTimeout(remarksTimer);remarksTimer=null;
      remarksDraft={ticketId:ticket.ticketId,value:''};
      remarksSaved={ticketId:ticket.ticketId,value:''};
      remarksQueued={ticketId:'',value:''};
     }
     last[i]=ticket.ticketId+'|'+ticket.calledAt;
     announce(ticket,i);
    }
   }else if(action==='donePrecheck'){
    S.windows={...(S.windows||{}),[key]:null};
    last[i]='';
    const done=reply.ticket;
    if(done)S.precheckDone=[done,...(S.precheckDone||[]).filter(x=>x.ticketId!==done.ticketId)];
   }else if(action==='complete'){
    S.windows={...(S.windows||{}),[key]:null};
    last[i]='';
    const finished=reply.ticket||original;
    if(finished&&!(S.completed||[]).some(x=>x.ticketId===finished.ticketId))
      S.completed=[{...finished,status:'COMPLETED',recruiter:finished.recruiter||S.recruiters?.[key]||'',completedAt:finished.completedAt||new Date().toISOString()},...(S.completed||[])];
   }
   staffSignature='';windowSignature='';render();
  });
  if(result){
   const number=result.ticket?.queueNo||original?.queueNo||'';
   const message=action==='complete'?'Completed '+number+' and saved to the queue.':
    action==='donePrecheck'?'Finished Pre-check for '+number+'. Added it to Done Pre-check until a window is available.':
    action==='recall'?'Recalled '+number+' (3 voice announcements).':'Called '+number+' (3 voice announcements).';
   staffMessage(message,'ok');
  }
 }finally{
  activeWindowActions.delete(key);
  staffSignature='';staff();
 }
}
async function transferTicket(source,target,transaction){
 if(!ready())return;
 if(S.version!==REQUIRED){staffMessage('Deploy Federation v13 Apps Script to enable Pre Checking transfers.','err');return}
 if(!source||!target||source===target)return;
 const keys=[String(source),String(target)];
 if(keys.some(key=>activeWindowActions.has(key)))return;
 keys.forEach(key=>activeWindowActions.add(key));
 staffSignature='';staff();
 try{
  const result=await operate('transfer',{window:source,targetWindow:target,transaction},reply=>{
   const ticket=reply.ticket;
   if(!ticket)return;
   S.windows={...(S.windows||{}),[String(source)]:null,[String(target)]:ticket};
   last[source]='';last[target]='';
   staffSignature='';windowSignature='';render();
  });
  if(result)staffMessage('Transferred '+(result.ticket?.queueNo||'the ticket')+' to Window '+target+'.','ok');
 }finally{
  keys.forEach(key=>activeWindowActions.delete(key));
  staffSignature='';staff();
 }
}
async function assignTx(i,transaction){
  if(!ready())return;
  const old=S.assignments?.[String(i)]||'ALL';
  // Preserve the current queue and sessions while only the assignment changes.
  if(old===transaction)return;
  const payload=Array.isArray(transaction)?{window:i,transactions:transaction}:{window:i,transaction};
 const result=await operate('setWindowTx',payload);
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
$('guideEdit').onclick=()=>{
 const showing=$('guideEditor').classList.contains('hide');
 $('guideEditor').classList.toggle('hide',!showing);
 if(showing){guideDirty=false;$('guideText').value=currentQueueGuide();$('guideText').focus()}
};
$('guideCancel').onclick=()=>{guideDirty=false;$('guideEditor').classList.add('hide');guideEditor()};
$('guideText').oninput=()=>{guideDirty=true};
$('guideSave').onclick=async()=>{
 const value=$('guideText').value.trim();
 if(!value||value.length>1300){
   $('guideStatus').textContent='Enter 1–1,300 characters for the instructions.';return;
 }
 const btn=$('guideSave');btn.disabled=true;
 try{
   if(!connectionHealthy||S.queueGuideSupported!==true){
     try{localStorage.setItem('tqQueueGuideLocalDraft',value)}
     catch{throw Error('Browser storage is disabled. The instructions could not be saved locally.')}
     S.queueGuide=value;guideDirty=false;
     $('guideEditor').classList.add('hide');
     $('guideStatus').textContent='Saved on this device only. To synchronize instructions across TV devices, deploy the updated Apps Script Code.gs.';
     return;
   }
   const result=await jp('setQueueGuide',{message:value});
   if(!result.ok)throw Error(result.error||'Unable to save instructions.');
   S.queueGuide=result.queueGuide;guideDirty=false;
   try{localStorage.removeItem('tqQueueGuideLocalDraft')}catch{}
   $('guideEditor').classList.add('hide');
   $('guideStatus').textContent='Queue instructions saved to the shared Google Sheet for TV playback.';
   await refresh(true);
 }catch(e){
   $('guideStatus').textContent='Unable to synchronize instructions. '+String(e.message||e);
 }finally{btn.disabled=false}
};
$('guidePlay').onclick=async()=>{
 const btn=$('guidePlay');
 if(btn.disabled)return;
 const preview=()=>{
   if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined')return false;
   armed=true;
   try{localStorage.setItem('tqSound','1')}catch{}
   return speakQueueInstructions(currentQueueGuide());
 };
 if(!connectionHealthy||S.queueGuideSupported!==true){
   if(localTvChannel&&Date.now()-lastLocalTvSeen<16000){
     localTvChannel.postMessage({type:'play-instructions',text:currentQueueGuide(),sentAt:Date.now()});
     $('guideStatus').textContent='Sent to an open TV Display tab on this browser. Enable/Test Sound must have been clicked on that TV tab. For a TV on a different device, deploy the updated Apps Script.';
     return;
   }
   const played=preview(); // Starts inside the click so browser voice is allowed.
   $('guideStatus').textContent=played?
     'Instructions are playing on THIS device. Playback on a separate TV requires the updated Apps Script deployment and enabled TV sound.':
     'Cannot play audio on this device. Enable browser speech/audio and deploy the updated Apps Script for remote TV playback.';
   return;
 }
 btn.disabled=true;btn.textContent='Sending to TV…';
 try{
   const result=await jp('playQueueGuide');
   if(!result.ok)throw Error(result.error||'TV playback could not be requested.');
   $('guideStatus').textContent='Instruction broadcast sent to the TV. The TV browser must be open with sound enabled for speech to play.';
   await refresh(true);
 }catch(e){
   const played=preview();
   $('guideStatus').textContent=played?
     'Remote TV playback failed; playing the instructions on THIS device instead. Check the latest Apps Script deployment and the TV audio settings.':
     'Remote TV playback failed and this browser cannot provide audio. Check the Apps Script deployment.';
 }finally{
   btn.disabled=false;btn.textContent='Play Queue Instructions on TV';
 }
};
$('announcementSave').onclick=()=>saveAnnouncement($('announcementInput').value);
$('announcementReset').onclick=()=>saveAnnouncement(DEFAULT);
$('addWin').onclick=()=>operate('addWindow');
$('cancelWindow').onclick=()=>{$('windowEditor').classList.add('hide');$('editWindowTxMenu').classList.add('hide');$('editWindowTxToggle').setAttribute('aria-expanded','false');editWindow=0};
$('editWindowTxToggle').onclick=()=>{const menu=$('editWindowTxMenu'),open=menu.classList.contains('hide');menu.classList.toggle('hide');$('editWindowTxToggle').setAttribute('aria-expanded',String(open))};
document.addEventListener('click',event=>{if(!event.target.closest('#editWindowTx')){$('editWindowTxMenu').classList.add('hide');$('editWindowTxToggle').setAttribute('aria-expanded','false')}});
$('saveWindow').onclick=async()=>{
  const i=editWindow,selected=editWindowTxs.slice(),recruiter=$('editRecruiter').value.trim();
  if(!i)return;
  if(!selected.length){status('Select at least one assigned transaction.','err');return}
  if(selected.length>1&&S.version!==REQUIRED){status('Deploy Federation v13 Apps Script before saving multiple assigned transactions.','err');return}
  const assignment=selected.includes('ALL')?'ALL':selected.length===1?selected[0]:selected;
  const payload={window:i,recruiter};
  if(assignment==='ALL')payload.transaction='ALL';
  else if(Array.isArray(assignment))payload.transactions=assignment;
  else payload.transaction=assignment;
  const save=$('saveWindow');save.disabled=true;save.textContent='Saving…';
  try{
    const result=await operate('saveWindow',payload,()=>{
      S.assignments={...(S.assignments||{}),[String(i)]:assignment};
      S.recruiters={...(S.recruiters||{}),[String(i)]:recruiter};
      staffSignature='';render();
    });
    if(result){$('windowEditor').classList.add('hide');$('editWindowTxMenu').classList.add('hide');$('editWindowTxToggle').setAttribute('aria-expanded','false');editWindow=0;if(page==='staff')staffMessage('Window '+i+' saved to Google Sheets.','ok');else status('Window '+i+' saved to Google Sheets.','ok')}
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
for(const key of ['wait','precheckDone','completed'])for(const side of ['Prev','Next']){
  $(key+side).onclick=()=>{
   const delta=side==='Next'?1:-1;
   if(key==='wait')waitPage+=delta;else if(key==='precheckDone')precheckDonePage+=delta;else completedPage+=delta;
   queueTables();
  };
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
$('reconnect').onclick=()=>{
  const official=String(C.backendUrl||'');
  if(!valid(official)){error(Error('Default Apps Script URL is missing. Ask the project owner to restore config.js.'));return}
  localStorage.removeItem('tqApi');
  try{
    const active=new URL(window.location.href);
    active.searchParams.delete('api');
    history.replaceState(null,'',active.pathname+active.search+active.hash);
  }catch(e){}
  $('api').value=official;qrUrl='';S.version='';connectionHealthy=false;
  status('Rechecking the official Apps Script deployment. If the connection still fails, redeploy Code.gs in Google Apps Script.','');
  void refresh(false);
};
$('test').onclick=async()=>{try{const r=await jp('health');if(!r.ok)throw Error(r.error);if(!COMPATIBLE.has(r.version))throw Error('Backend is '+(r.version||'outdated')+'. Deploy the latest Code.gs.');status('Backend verified • '+r.version+' • '+r.windows+' service windows.'+(r.version!==REQUIRED?' Update to v13 for transaction-matched Pre Checking transfers.':''),'ok');await refresh(true)}catch(e){error(e)}};
$('clear').onclick=()=>{localStorage.removeItem('tqApi');$('api').value='';S.version='';qrUrl='';status('Connection cleared.','err');qr()};
$('backToWindows').onclick=()=>openStaffWindow(0);
const full=$('fullscreen');
function reflect(){full.setAttribute('aria-pressed',document.fullscreenElement===$('display')?'true':'false')}
full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('display').requestFullscreen()}catch(e){error(e,true)}};
document.addEventListener('fullscreenchange',()=>{
  reflect();
  renderWaitingBoards();
  // Switching into TV mode refreshes the screen and enters the faster polling cadence.
  schedulePoll(250);
});
function clock(){
  const now=new Date();
  const time=now.toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
  const date=now.toLocaleDateString('en-PH',{timeZone:'Asia/Manila',weekday:'long',year:'numeric',month:'long',day:'numeric'}).toUpperCase();
  $('clock').textContent=time;$('fullscreenTime').textContent=time;
  $('headerDay').textContent=date;$('fullscreenDate').textContent=date;
}
clock();setInterval(clock,1000);
setInterval(()=>{if(page==='display'&&!document.hidden)renderWaitingBoards()},1000);
window.addEventListener('resize',renderWaitingBoards);
let storedView='display';
try{storedView=sessionStorage.getItem('tqLastView')||'display'}catch(e){}
const requested=new URLSearchParams(location.search).get('view');
view(['display','staff','setup'].includes(requested)?requested:
     ['display','staff','setup'].includes(storedView)?storedView:'display');
render();
void refresh(false);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(pollTimer!==null)clearTimeout(pollTimer);
    pollTimer=null;
  }else{
    refreshFailures=0;
    pollOnResume();
  }
});
window.addEventListener('focus',pollOnResume);
window.addEventListener('online',()=>{refreshFailures=0;pollOnResume()});
})();
