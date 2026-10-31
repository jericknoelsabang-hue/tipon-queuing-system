const CFG={spreadsheetId:'1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik',queue:'QUEUE',windows:'WINDOWS',tx:'TRANSACTION_TYPES',mpc:'MPC_CONFIG',settings:'SETTINGS',precheck:'PRECHECK',maxWindows:20};
const QH=['Ticket ID','Queue Date','Created At','Queue No','MPC Code','MPC Name','Transaction Code','Transaction','Applicant Name','Position / Purpose','Status','Window','Called At','Completed At','Last Recalled At','First Name','Last Name','Recruiter'];
const WH=['Window','Active Ticket ID','Queue No','MPC Code','MPC Name','Transaction Code','Transaction','Applicant Name','Position / Purpose','Called At','Updated At','Queue Row'];
const TH=['Code','Transaction Name','Active','Sort Order'];
const MH=['MPC Code','MPC Name','Queue Prefix','Logo URL','Active','Sort Order'];
const DEFAULT_ANNOUNCEMENT='Please keep your queue number until called.';
const SH=['Setting','Value','Updated At'];
const PH=['Precheck ID','Date','Precheck Reference','First Name','Last Name','Transaction Code','Position / Purpose','Applicant','Self-Checklist','Status','Submitted At','Reviewed At','Staff Note','Queue No'];

function setupTiponQueueSystem(){
  const ss=SpreadsheetApp.openById(CFG.spreadsheetId);
  ensure_(ss,CFG.queue,QH);ensure_(ss,CFG.windows,WH);ensure_(ss,CFG.tx,TH);ensure_(ss,CFG.settings,SH);ensure_(ss,CFG.precheck,PH);
  const w=ss.getSheetByName(CFG.windows);
  if(w.getLastRow()<2)for(let i=1;i<=4;i++)w.getRange(i+1,1).setValue(i);
  const t=ss.getSheetByName(CFG.tx);
  if(t.getLastRow()<2)t.getRange(2,1,3,4).setValues([['NH','New Hire',true,1],['RH','Rehire',true,2],['TR','Transfer',true,3]]);
  const q=ss.getSheetByName(CFG.queue);if(q.getLastColumn()<QH.length)q.getRange(1,QH.length).setValue('Recruiter');
  const all=allTxs_(ss);
  if(!all.some(t=>t.code==='MC'))ss.getSheetByName(CFG.tx).appendRow(['MC','Member Concerns',true,all.length+1]);
  // A disabled transaction remains disabled after setup.
  return {ok:true,federationMode:true,version:'federation-v10'};
}
function doGet(e){
  const p=e?.parameter||{},cb=String(p.callback||'callback').replace(/[^A-Za-z0-9_.$]/g,'');
  const action=String(p.action||'state');
  try{
    let r;switch(action){
      case'health':r={ok:true,name:ss_().getName(),windows:windowCount_(),federationMode:true,version:'federation-v10'};break;
      case'state':r={ok:true,state:state_(p)};break;
      case'publicConfig':r=publicConfig_();break;
      case'register':r=register_(p);break;
      case'setWindowTx':r=setWindowTx_(p);break;
      case'call':r=call_(p);break;
      case'recall':r=recall_(p);break;
      case'complete':r=complete_(p);break;
      case'addWindow':r=addWindow_();break;
      case'deleteWindow':r=deleteWindow_(p);break;
      case'saveWindow':r=saveWindow_(p);break;
      case'editTx':r=editTx_(p);break;
      case'deleteTx':r=deleteTx_(p);break;
      case'restoreTx':r=restoreTx_(p);break;
      case'addTx':r=addTx_(p);break;
      case'setAnnouncement':r=setAnnouncement_(p);break;
      case'announcementChunk':r=announcementChunk_(p);break;
      default:throw Error('Unknown action');
    }
    if(r&&r.ok&&!['state','health','publicConfig','announcementChunk'].includes(action)){
      try{CacheService.getScriptCache().removeAll(['TIPON_STATE_display','TIPON_STATE_staff','TIPON_STATE_setup'])}catch(e){}
    }
    return out_(cb,r);
  }catch(err){return out_(cb,{ok:false,error:String(err.message||err)})}
}
function register_(p){
  const first=txt_(p.firstName,50),last=txt_(p.lastName,50),position=txt_(p.position,80),txCode=code_(p.transaction,6);
  if(!first||!last||!position||!txCode)throw Error('Complete all required fields.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),tx=findTx_(ss,txCode);
    if(!tx)throw Error('Invalid or inactive transaction.');
    return issueTicket_(ss,tx,first,last,position);
  }finally{lock.releaseLock()}
}
function todayQueueRows_(q,today){
  const count=Math.max(0,q.getLastRow()-1);
  if(!count)return{rows:[],startRow:2};
  let first=0;
  if(count>800){
    // Read the narrow date column before loading today onward; preserves correct row offsets.
    const dates=q.getRange(2,2,count,1).getValues();
    first=dates.findIndex(r=>dayCell_(r[0])===today);
    if(first<0)return{rows:[],startRow:count+2};
  }
  return{rows:q.getRange(first+2,1,count-first,QH.length).getValues(),startRow:first+2};
}
function issueTicket_(ss,tx,first,last,pos){
  const q=ss.getSheetByName(CFG.queue),today=day_();
  // Name+transaction is unique per Philippine date, including completed tickets.
  // A different transaction receives its own queue number; tomorrow starts a new series.
  const {rows}=todayQueueRows_(q,today);
  const desired=nameKey_(first,last),wantedCode=code_(tx.code,6);
  let max=0,existing=null;
  for(let i=rows.length-1;i>=0;i--){
    const row=rows[i];
    if(dayCell_(row[1])!==today||code_(row[6],6)!==wantedCode)continue;
    const suffix=String(row[3]).match(/-(\d+)$/);
    if(suffix)max=Math.max(max,Number(suffix[1]));
    const given=String(row[15]||'').trim(),family=String(row[16]||'').trim();
    const fullName=String(row[8]||'').trim();
    const person=given&&family?nameKey_(given,family):norm_(fullName);
    if(!existing&&(person===desired||person===norm_(first+' '+last)))existing=row;
  }
  if(existing)return{ok:true,duplicate:true,ticket:ticket_(existing),
    message:'This applicant/member already has a queue number for this transaction today.'};
  const num=wantedCode+'-'+String(max+1).padStart(4,'0');
  const now=new Date(),id=Utilities.getUuid(),name=first+' '+last;
  const row=[id,today,now,num,'TIPON','TIPON Federation',wantedCode,tx.name,name,pos,'WAITING','','','','',first,last,''];
  q.appendRow(row);
  return{ok:true,duplicate:false,ticket:ticket_(row)};
}
function submitPrecheck_(p){
  const first=txt_(p.firstName,50),last=txt_(p.lastName,50),position=txt_(p.position,80),tx=code_(p.transaction,6);
  if(!first||!last||!position||!tx||tx==='MC')throw Error('Complete recruitment applicant details.');
  if(String(p.hasId)!=='true'||String(p.hasDocuments)!=='true')throw Error('Complete the document checklist before requesting pre-screening.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),t=findTx_(ss,tx);if(!t)throw Error('Invalid recruitment transaction.');
    const today=day_(),q=ss.getSheetByName(CFG.queue),active=findActive_(q,today,first,last);
    if(active)return{ok:true,status:'APPROVED',duplicate:true,ticket:ticket_(active)};
    const sheet=ss.getSheetByName(CFG.precheck),rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,PH.length).getValues():[];
    const pending=rows.find(r=>dayCell_(r[1])===today&&String(r[9])==='PENDING'&&nameKey_(r[3],r[4])===nameKey_(first,last));
    if(pending)return{ok:true,status:'PENDING',duplicate:true,precheckId:String(pending[0]),reference:String(pending[2])};
    const n=rows.filter(r=>dayCell_(r[1])===today).length+1,precheckId=Utilities.getUuid(),reference='PC-'+String(n).padStart(3,'0'),now=new Date();
    sheet.appendRow([precheckId,today,reference,first,last,tx,position,first+' '+last,'ID and required documents self-confirmed','PENDING',now,'','','']);
    return{ok:true,status:'PENDING',precheckId,reference,duplicate:false};
  }finally{lock.releaseLock()}
}
function checkPrecheck_(p){
  const id=txt_(p.precheckId,100);if(!id)throw Error('Missing pre-screening reference.');
  const sheet=ss_().getSheetByName(CFG.precheck);
  if(!sheet)throw Error('Pre-screening is not initialized.');
  const row=findId_(sheet,id);if(row<2)throw Error('Pre-screening reference not found.');
  const r=sheet.getRange(row,1,1,PH.length).getValues()[0];
  return{ok:true,status:String(r[9]),reference:String(r[2]),queueNo:String(r[13]||''),note:String(r[12]||'')};
}
function reviewPrecheck_(p,approved){
  const id=txt_(p.precheckId,100),note=txt_(p.note,160);
  if(!id)throw Error('Select a pre-screening request.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),sheet=ss.getSheetByName(CFG.precheck),row=findId_(sheet,id);
    if(row<2)throw Error('Pre-screening request not found.');
    const r=sheet.getRange(row,1,1,PH.length).getValues()[0];
    if(String(r[9])!=='PENDING')throw Error('This pre-screening request was already reviewed.');
    if(approved){
      const tx=findTx_(ss,String(r[5]));if(!tx)throw Error('Transaction is no longer available.');
      const res=issueTicket_(ss,tx,String(r[3]),String(r[4]),String(r[6]));
      sheet.getRange(row,10,1,5).setValues([['APPROVED',r[10],new Date(),note,res.ticket.queueNo]]);
      return{ok:true,status:'APPROVED',ticket:res.ticket};
    }
    sheet.getRange(row,10,1,5).setValues([['INCOMPLETE',r[10],new Date(),note||'Please complete your requirements.','']]);
    return{ok:true,status:'INCOMPLETE'};
  }finally{lock.releaseLock()}
}
function pendingPrechecks_(ss){
  const sh=ss.getSheetByName(CFG.precheck);if(!sh||sh.getLastRow()<2)return[];
  const today=day_();return sh.getRange(2,1,sh.getLastRow()-1,PH.length).getValues()
    .filter(r=>dayCell_(r[1])===today&&String(r[9])==='PENDING')
    .map(r=>({precheckId:String(r[0]),reference:String(r[2]),name:String(r[7]),transaction:String(r[5]),position:String(r[6]),submittedAt:iso_(r[10])})).slice(0,100);
}
function settingValue_(ss,key){
  const sh=ss.getSheetByName(CFG.settings);if(!sh||sh.getLastRow()<2)return '';
  const row=sh.getRange(2,1,sh.getLastRow()-1,2).getValues().find(r=>String(r[0])===key);
  return row?String(row[1]||''):'';
}
function windowTx_(ss,window){
  const stored=code_(settingValue_(ss,'WINDOW_TX_'+window),6);
  if(stored==='ALL')return 'ALL';
  if(stored&&findTx_(ss,stored))return stored;
  const defaults={1:'NH',2:'RH',3:'TR',4:'MC'};
  const preferred=defaults[window]||'ALL';
  return preferred==='ALL'||findTx_(ss,preferred)?preferred:'ALL';
}
function setWindowTx_(p){
  const window=int_(p.window,1,windowCount_()),tx=code_(p.transaction,6);
  if(tx!=='ALL'&&!findTx_(ss_(),tx))throw Error('Invalid transaction assignment.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),sheet=ss.getSheetByName(CFG.settings)||ensure_(ss,CFG.settings,SH);
    const key='WINDOW_TX_'+window,rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues():[];
    const idx=rows.findIndex(r=>String(r[0]).trim()===key),row=idx>=0?idx+2:sheet.getLastRow()+1;
    sheet.getRange(row,1,1,3).setValues([[key,tx,new Date()]]);
    return{ok:true,window,transaction:tx};
  }finally{lock.releaseLock()}
}
function windowRoute_(ss,window){
  const mode=settingValue_(ss,'WINDOW_ROUTE_'+window);
  return ['ALL','MC','RECRUITMENT'].includes(mode)?mode:window===3?'MC':'RECRUITMENT';
}
function setWindowRoute_(p){
  const window=int_(p.window,1,windowCount_()),route=String(p.route||'').toUpperCase();
  if(!['ALL','MC','RECRUITMENT'].includes(route))throw Error('Invalid service route.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),sh=ss.getSheetByName(CFG.settings)||ensure_(ss,CFG.settings,SH),key='WINDOW_ROUTE_'+window;
    const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getValues():[];
    const ix=rows.findIndex(r=>String(r[0])===key),row=ix>=0?ix+2:sh.getLastRow()+1;
    sh.getRange(row,1,1,3).setValues([[key,route,new Date()]]);
    return{ok:true,window,route};
  }finally{lock.releaseLock()}
}
function call_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),w=ss.getSheetByName(CFG.windows),win=int_(p.window,1,windowCount_()),row=win+1;
    if(w.getRange(row,2).getValue())throw Error('Complete current applicant first.');
    const assigned=windowTx_(ss,win),q=ss.getSheetByName(CFG.queue),today=day_();
    if(q.getLastRow()<2)throw Error('Queue is empty.');
    const selection=todayQueueRows_(q,today),v=selection.rows;
    let i=-1;
    for(let x=0;x<v.length;x++){
      const r=v[x];
      if(dayCell_(r[1])!==today||String(r[10])!=='WAITING')continue;
      if(assigned!=='ALL'&&String(r[6])!==assigned)continue;
      i=x;break;
    }
    if(i<0)throw Error('No matching applicant is waiting.');
    const r=v[i],actualRow=selection.startRow+i,now=new Date(),recruiter=txt_(settingValue_(ss,'WINDOW_RECRUITER_'+win),80);q.getRange(actualRow,11,1,3).setValues([['SERVING',win,now]]);q.getRange(actualRow,18).setValue(recruiter);r[17]=recruiter;
    r[10]='SERVING';r[11]=win;r[12]=now;
    w.getRange(row,1,1,WH.length).setValues([[win,r[0],r[3],r[4],r[5],r[6],r[7],r[8],r[9],now,now,actualRow]]);
    return {ok:true,ticket:ticket_(r)};
  }finally{lock.releaseLock()}
}
function recall_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),w=ss.getSheetByName(CFG.windows),win=int_(p.window,1,windowCount_()),r=w.getRange(win+1,1,1,WH.length).getValues()[0];
    if(!r[1])throw Error('Window is empty.');
    const q=ss.getSheetByName(CFG.queue),row=queueRowForWindow_(q,r),now=new Date();
    if(row>1)q.getRange(row,15).setValue(now);
    // Refresh the announcement marker while preserving original QUEUE.Called At.
    w.getRange(win+1,10,1,2).setValues([[now,now]]);r[9]=now;
    return{ok:true,ticket:windowTicket_(r)}
  }finally{lock.releaseLock()}
}
function complete_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),w=ss.getSheetByName(CFG.windows),win=int_(p.window,1,windowCount_()),r=w.getRange(win+1,1,1,WH.length).getValues()[0];
    if(!r[1])throw Error('Window is empty.');const q=ss.getSheetByName(CFG.queue),row=queueRowForWindow_(q,r);if(row<2)throw Error('Ticket not found.');
    const completedAt=new Date();
    // One contiguous Sheets write replaces two separate status/timestamp writes.
    const statusBlock=q.getRange(row,11,1,4),previous=statusBlock.getValues()[0];
    statusBlock.setValues([['COMPLETED',previous[1],previous[2],completedAt]]);
    w.getRange(win+1,2,1,WH.length-1).clearContent();
    return{ok:true,window:win,ticket:{
      ...windowTicket_(r),status:'COMPLETED',
      completedAt:iso_(completedAt)
    }}
  }finally{lock.releaseLock()}
}
function addWindow_(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const ss=ss_(),w=ss.getSheetByName(CFG.windows),n=windowCount_();if(n>=CFG.maxWindows)throw Error('Maximum windows reached.');w.getRange(n+2,1).setValue(n+1);return{ok:true,window:n+1}}finally{lock.releaseLock()}
}
function addTx_(p){
  const c=code_(p.code,6),n=txt_(p.name,60);if(!/^[A-Z0-9]{2,6}$/.test(c)||!n)throw Error('Enter a 2-6 character code and name.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const ss=ss_(),list=allTxs_(ss);if(list.some(x=>x.code===c))throw Error('Code already exists, including inactive records. Restore it in Setup if needed.');ss.getSheetByName(CFG.tx).appendRow([c,n,true,list.length+1]);return{ok:true,transaction:{code:c,name:n}}}finally{lock.releaseLock()}
}
function saveWindow_(p){
  const n=windowCount_(),win=int_(p.window,1,n),tx=code_(p.transaction||'ALL',6),recruiter=txt_(p.recruiter,80);
  if(tx!=='ALL'&&!findTx_(ss_(),tx))throw Error('Invalid or inactive transaction.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_();
    writeSettings_(ss,{['WINDOW_TX_'+win]:tx,['WINDOW_RECRUITER_'+win]:recruiter});
    return{ok:true,window:win,transaction:tx,recruiter};
  }finally{lock.releaseLock()}
}
function writeSettings_(ss,changes){
  const sh=ss.getSheetByName(CFG.settings)||ensure_(ss,CFG.settings,SH);
  const count=Math.max(0,sh.getLastRow()-1);
  const rows=count?sh.getRange(2,1,count,3).getValues():[];
  const index=new Map(rows.map((r,i)=>[String(r[0]),i]));
  const now=new Date();
  for(const key of Object.keys(changes)){
    const value=String(changes[key]??''),at=index.get(key);
    if(at===undefined){index.set(key,rows.length);rows.push([key,value,now])}
    else rows[at]=[key,value,now];
  }
  if(rows.length)sh.getRange(2,1,rows.length,3).setValues(rows);
}
function saveSetting_(ss,key,value){writeSettings_(ss,{[key]:value})}
function deleteWindow_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),sh=ss.getSheetByName(CFG.windows),n=windowCount_(),win=int_(p.window,1,n);
    if(n<=1)throw Error('At least one service window must remain.');
    const occupied=sh.getRange(2,2,n,1).getValues();
    if(occupied.some((r,i)=>i+1>=win&&r[0]))
      throw Error('Complete active tickets in this or later windows before deleting.');
    const oldAssignments=Array.from({length:n},(_,i)=>({tx:windowTx_(ss,i+1),name:settingValue_(ss,'WINDOW_RECRUITER_'+(i+1))}));
    sh.deleteRow(win+1);
    sh.getRange(2,1,n-1,1).setValues(Array.from({length:n-1},(_,i)=>[i+1]));
    const changes={};
    for(let i=1;i<=n;i++){
      const previous=i<win?oldAssignments[i-1]:i<n?oldAssignments[i]:null;
      changes['WINDOW_TX_'+i]=previous?previous.tx:'ALL';
      changes['WINDOW_RECRUITER_'+i]=previous?previous.name:'';
    }
    writeSettings_(ss,changes);
    return{ok:true,windowCount:n-1,removed:win};
  }finally{lock.releaseLock()}
}
function editTx_(p){
  const code=code_(p.code,6),name=txt_(p.name,60);
  if(!code||!name)throw Error('Transaction code and name required.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const sh=ss_().getSheetByName(CFG.tx),rows=sh.getDataRange().getValues();const i=rows.findIndex((r,k)=>k>0&&String(r[0])===code);
  if(i<1)throw Error('Transaction not found.');
  sh.getRange(i+1,2).setValue(name);return{ok:true,transaction:{code,name}};
  }finally{lock.releaseLock()}
}
function deleteTx_(p){
  const code=code_(p.code,6);
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),sh=ss.getSheetByName(CFG.tx),rows=sh.getDataRange().getValues();
    const idx=rows.findIndex((r,i)=>i>0&&String(r[0])===code);
    if(idx<1)throw Error('Transaction not found.');
    if(!bool_(rows[idx][2]))return{ok:true,code,active:false};
    // Soft-delete preserves existing waiting, serving, completed and historical records.
    const changes={};
    for(let i=1;i<=windowCount_();i++)if(windowTx_(ss,i)===code)changes['WINDOW_TX_'+i]='ALL';
    if(Object.keys(changes).length)writeSettings_(ss,changes);
    sh.getRange(idx+1,3).setValue(false);
    return{ok:true,code,active:false,reassignedWindows:Object.keys(changes).length};
  }finally{lock.releaseLock()}
}
function restoreTx_(p){
  const code=code_(p.code,6);
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sh=ss_().getSheetByName(CFG.tx),rows=sh.getDataRange().getValues();
    const idx=rows.findIndex((r,i)=>i>0&&String(r[0])===code);
    if(idx<1)throw Error('Transaction not found.');
    sh.getRange(idx+1,3).setValue(true);
    return{ok:true,code,active:true};
  }finally{lock.releaseLock()}
}
function publicConfig_(){
  const ss=ss_();
  const transactions=txs_(ss);
  return{ok:true,version:'federation-v10',transactions};
}
function state_(p){
  const view=['display','staff','setup'].includes(String(p?.view||''))?String(p.view):'staff';
  const cacheKey='TIPON_STATE_'+view;
  let cache=null;
  try{
    cache=CacheService.getScriptCache();
    const saved=cache.get(cacheKey);
    if(saved)return JSON.parse(saved);
  }catch(e){/* Cache misses must not block operations. */}
  const ss=ss_(),w=ss.getSheetByName(CFG.windows),count=Math.max(0,w.getLastRow()-1);
  const windowData=count?w.getRange(2,1,count,WH.length).getValues():[];
  const n=Math.max(1,Math.min(CFG.maxWindows,windowData.reduce((max,r)=>Math.max(max,Number(r[0])||0),0)||4));
  const windows={};
  for(let i=1;i<=n;i++){const row=windowData.find(r=>Number(r[0])===i);windows[String(i)]=row&&row[1]?windowTicket_(row):null}
  const txList=allTxs_(ss),activeTx=txList.filter(x=>x.active),availableCodes=new Set(activeTx.map(x=>x.code));
  const settings=ss.getSheetByName(CFG.settings);
  const settingsData=settings&&settings.getLastRow()>1?settings.getRange(2,1,settings.getLastRow()-1,2).getValues():[];
  const settingMap=new Map(settingsData.map(r=>[String(r[0]).trim(),String(r[1]??'')]));
  const defaultTx={1:'NH',2:'RH',3:'TR',4:'MC'},assignments={},recruiters={};
  for(let i=1;i<=n;i++){
    const stored=code_(settingMap.get('WINDOW_TX_'+i)||'',6);
    assignments[String(i)]=stored==='ALL'?'ALL':availableCodes.has(stored)?stored:
      availableCodes.has(defaultTx[i])?defaultTx[i]:'ALL';
    recruiters[String(i)]=settingMap.get('WINDOW_RECRUITER_'+i)||'';
  }
  const q=ss.getSheetByName(CFG.queue),waiting=[],completed=[],today=day_();
  const includeCompleted=!(p&&p.view)||String(p.view)==='staff';
  const rowCount=Math.max(0,q.getLastRow()-1);
  let queueRows=[];
  if(rowCount>0){
    if(!includeCompleted&&rowCount>800){
      // TV/Setup need today's waiting tickets, not every historic completed record.
      // Reading one date column first avoids transferring 18 columns of old records.
      // Find the earliest row for today even when dates are not perfectly grouped.
      const dateCells=q.getRange(2,2,rowCount,1).getValues();
      const firstToday=dateCells.findIndex(r=>dayCell_(r[0])===today);
      if(firstToday>=0)queueRows=q.getRange(firstToday+2,1,rowCount-firstToday,QH.length).getValues();
    }else{
      // Keep the original full-history behavior for the Staff Completed Queue.
      queueRows=q.getRange(2,1,rowCount,QH.length).getValues();
    }
  }
  queueRows.forEach(row=>{
    if(dayCell_(row[1])===today&&String(row[10])==='WAITING')waiting.push(ticket_(row));
    if(includeCompleted&&String(row[10])==='COMPLETED')completed.push(ticket_(row));
  });
  if(includeCompleted)completed.reverse();
  const result={windowCount:n,maxWindowCount:CFG.maxWindows,windows,waiting,completed,
    transactions:activeTx,transactionTypes:txList,assignments,recruiters,
    announcement:settingMap.get('ANNOUNCEMENT')?.trim()||DEFAULT_ANNOUNCEMENT,
    federationMode:true,version:'federation-v10'};
  try{
    const json=JSON.stringify(result);
    if(cache&&json.length<28000)cache.put(cacheKey,json,2);
  }catch(e){/* A large queue or a transient cache error falls back to direct Sheets reads. */}
  return result;
}
function announcement_(ss){
  const sheet=ss.getSheetByName(CFG.settings);
  if(!sheet||sheet.getLastRow()<2)return DEFAULT_ANNOUNCEMENT;
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues();
  const value=rows.find(row=>String(row[0]).trim()==='ANNOUNCEMENT');
  return value&&String(value[1]||'').trim() ? String(value[1]).trim() : DEFAULT_ANNOUNCEMENT;
}
function announcementChunk_(p){
  const batch=String(p.batch||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,64);
  const total=int_(p.total,1,40),index=int_(p.index,0,total-1);
  const chunk=String(p.chunk||'');
  if(!batch||!chunk||chunk.length>1600)throw Error('Invalid announcement upload chunk.');
  CacheService.getScriptCache().put('ANNOUNCEMENT_'+batch+'_'+index,chunk,300);
  return{ok:true,index,total};
}
function setAnnouncement_(p){
  let raw=String(p.message||'');
  let cache=null,keys=[];
  if(p.batch){
    const batch=String(p.batch||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,64);
    const total=int_(p.total,1,40);
    if(!batch)throw Error('Invalid announcement upload reference.');
    cache=CacheService.getScriptCache();
    keys=Array.from({length:total},(_,i)=>'ANNOUNCEMENT_'+batch+'_'+i);
    const fragments=cache.getAll(keys);
    if(keys.some(key=>fragments[key]===undefined))throw Error('Announcement upload incomplete. Retry Save Announcement.');
    raw=keys.map(key=>fragments[key]).join('');
  }
  if(raw.length<1||raw.length>2500)throw Error('Announcement must contain 1–2,500 characters.');
  const message=txt_(raw,2500);
  if(!message)throw Error('Please enter an announcement.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_();
    const sheet=ss.getSheetByName(CFG.settings)||ensure_(ss,CFG.settings,SH);
    let row=0;
    if(sheet.getLastRow()>1){
      const keys=sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
      for(let i=0;i<keys.length;i++)if(String(keys[i][0]).trim()==='ANNOUNCEMENT'){row=i+2;break}
    }
    if(!row)row=sheet.getLastRow()+1;
    sheet.getRange(row,1,1,3).setValues([['ANNOUNCEMENT',message,new Date()]]);
    if(cache&&keys.length)cache.removeAll(keys);
    return{ok:true,announcement:message};
  }finally{lock.releaseLock()}
}
function allTxs_(ss){const s=ss.getSheetByName(CFG.tx);if(!s||s.getLastRow()<2)return[];return s.getRange(2,1,s.getLastRow()-1,4).getValues().map(r=>({code:String(r[0]),name:String(r[1]),active:bool_(r[2]),sort:Number(r[3]||999)})).filter(x=>x.code&&x.name).sort((a,b)=>a.sort-b.sort)}
function txs_(ss){return allTxs_(ss).filter(x=>x.active)}
function findTx_(ss,c){return txs_(ss).find(x=>x.code===c)}
function findActive_(q,today,f,l){if(q.getLastRow()<2)return null;const key=nameKey_(f,l),v=q.getRange(2,1,q.getLastRow()-1,QH.length).getValues();for(const r of v){if(dayCell_(r[1])!==today||!['WAITING','SERVING'].includes(String(r[10])))continue;if(nameKey_(r[15]||String(r[8]).split(' ')[0],r[16]||String(r[8]).split(' ').slice(-1)[0])===key)return r}return null}
function next_(q,today,tx){let m=0;if(q.getLastRow()<2)return 1;q.getRange(2,1,q.getLastRow()-1,QH.length).getValues().forEach(r=>{if(dayCell_(r[1])===today&&String(r[6])===tx){const x=String(r[3]).match(/-(\d+)$/);if(x)m=Math.max(m,Number(x[1]))}});return m+1}
function findId_(s,id){if(s.getLastRow()<2)return-1;const x=s.getRange(2,1,s.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();return x?x.getRow():-1}
function ticket_(r){return{ticketId:String(r[0]||''),createdAt:iso_(r[2]),queueNo:String(r[3]||''),mpcCode:String(r[4]||''),mpcName:String(r[5]||''),transaction:String(r[6]||''),transactionName:String(r[7]||''),name:String(r[8]||''),position:String(r[9]||''),status:String(r[10]||''),window:r[11]||'',calledAt:iso_(r[12]),date:dayCell_(r[1]),recruiter:String(r[17]||''),completedAt:iso_(r[13])}}
function windowTicket_(r){return{window:Number(r[0]),ticketId:String(r[1]||''),queueNo:String(r[2]||''),mpcCode:String(r[3]||''),mpcName:String(r[4]||''),transaction:String(r[5]||''),transactionName:String(r[6]||''),name:String(r[7]||''),position:String(r[8]||''),calledAt:iso_(r[9])}}
function queueRowForWindow_(q,windowRow){
 const stored=Number(windowRow[11]);
 if(Number.isInteger(stored)&&stored>=2&&stored<=q.getLastRow()){
   if(String(q.getRange(stored,1).getValue())===String(windowRow[1]))return stored;
 }
 return findId_(q,String(windowRow[1]));
}
function windowCount_(){const s=ss_().getSheetByName(CFG.windows);let n=0;if(s&&s.getLastRow()>1)s.getRange(2,1,s.getLastRow()-1,1).getValues().forEach(r=>{const x=Number(r[0]);if(Number.isInteger(x)&&x>n)n=x});return Math.max(1,Math.min(CFG.maxWindows,n||4))}
function ensure_(ss,name,h){
  const sheet=ss.getSheetByName(name)||ss.insertSheet(name);
  sheet.getRange(1,1,1,h.length).setValues([h]).setFontWeight('bold')
    .setBackground('#075477').setFontColor('#ffffff')
    .setVerticalAlignment('middle').setWrap(true);
  sheet.setFrozenRows(1);
  return sheet;
}
let _tiponSpreadsheet=null;
function ss_(){return _tiponSpreadsheet||(_tiponSpreadsheet=SpreadsheetApp.openById(CFG.spreadsheetId))}
function nameKey_(f,l){return norm_(f)+'|'+norm_(l)}function norm_(v){let s=String(v||'').trim().toUpperCase();if(s.normalize)s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');return s.replace(/[^A-Z0-9]/g,'')}
function txt_(v,n){return String(v||'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,n)}function code_(v,n){return String(v||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,n)}
function int_(v,a,b){v=Number(v);if(!Number.isInteger(v)||v<a||v>b)throw Error('Invalid window.');return v}function bool_(v){return typeof v==='boolean'?v:['TRUE','YES','1','ACTIVE'].includes(String(v).toUpperCase())}
function day_(){return Utilities.formatDate(new Date(),'Asia/Manila','yyyy-MM-dd')}function dayCell_(v){return v instanceof Date?Utilities.formatDate(v,'Asia/Manila','yyyy-MM-dd'):String(v||'').slice(0,10)}
function iso_(v){if(!v)return'';return v instanceof Date?v.toISOString():String(v)}function out_(cb,o){return ContentService.createTextOutput(cb+'('+JSON.stringify(o)+');').setMimeType(ContentService.MimeType.JAVASCRIPT)}
