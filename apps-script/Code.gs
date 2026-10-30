const CFG={spreadsheetId:'1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik',queue:'QUEUE',windows:'WINDOWS',tx:'TRANSACTION_TYPES',mpc:'MPC_CONFIG',settings:'SETTINGS',precheck:'PRECHECK',maxWindows:20};
const QH=['Ticket ID','Queue Date','Created At','Queue No','MPC Code','MPC Name','Transaction Code','Transaction','Applicant Name','Position / Purpose','Status','Window','Called At','Completed At','Last Recalled At','First Name','Last Name','Recruiter'];
const WH=['Window','Active Ticket ID','Queue No','MPC Code','MPC Name','Transaction Code','Transaction','Applicant Name','Position / Purpose','Called At','Updated At'];
const TH=['Code','Transaction Name','Active','Sort Order'];
const MH=['MPC Code','MPC Name','Queue Prefix','Logo URL','Active','Sort Order'];
const DEFAULT_ANNOUNCEMENT='Please keep your queue number until called.';
const SH=['Setting','Value','Updated At'];
const PH=['Precheck ID','Date','Precheck Reference','First Name','Last Name','Transaction Code','Position / Purpose','Applicant','Self-Checklist','Status','Submitted At','Reviewed At','Staff Note','Queue No'];

function setupTiponQueueSystem(){
  const ss=SpreadsheetApp.openById(CFG.spreadsheetId);
  ensure_(ss,CFG.queue,QH);ensure_(ss,CFG.windows,WH);ensure_(ss,CFG.tx,TH);ensure_(ss,CFG.settings,SH);ensure_(ss,CFG.precheck,PH);
  const w=ss.getSheetByName(CFG.windows);
  for(let i=1;i<=4;i++)if(!w.getRange(i+1,1).getValue())w.getRange(i+1,1).setValue(i);
  const t=ss.getSheetByName(CFG.tx);
  if(t.getLastRow()<2)t.getRange(2,1,3,4).setValues([['NH','New Hire',true,1],['RH','Rehire',true,2],['TR','Transfer',true,3]]);
  const q=ss.getSheetByName(CFG.queue);if(q.getLastColumn()<QH.length)q.getRange(1,QH.length).setValue('Recruiter');
  const all=txs_(ss);
  if(!all.some(t=>t.code==='MC'))ss.getSheetByName(CFG.tx).appendRow(['MC','Member Concerns',true,all.length+1]);
  return {ok:true,federationMode:true,version:'federation-v6'};
}
function doGet(e){
  const p=e?.parameter||{},cb=String(p.callback||'callback').replace(/[^A-Za-z0-9_.$]/g,'');
  try{
    let r;switch(String(p.action||'state')){
      case'health':r={ok:true,name:ss_().getName(),windows:windowCount_(),federationMode:true,version:'federation-v6'};break;
      case'state':r={ok:true,state:state_()};break;
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
      case'addTx':r=addTx_(p);break;
      case'setAnnouncement':r=setAnnouncement_(p);break;
      default:throw Error('Unknown action');
    }return out_(cb,r);
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
function issueTicket_(ss,tx,first,last,pos){
  const q=ss.getSheetByName(CFG.queue),today=day_(),existing=findActive_(q,today,first,last);
  if(existing)return {ok:true,duplicate:true,ticket:ticket_(existing),message:'Existing active queue number returned.'};
  const n=next_(q,today,tx.code),num=tx.code+'-'+String(n).padStart(3,'0'),now=new Date(),id=Utilities.getUuid(),name=first+' '+last;
  const row=[id,today,now,num,'TIPON','TIPON Federation',tx.code,tx.name,name,pos,'WAITING','','','','',first,last,''];
  q.appendRow(row);return {ok:true,duplicate:false,ticket:ticket_(row)};
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
    const v=q.getRange(2,1,q.getLastRow()-1,QH.length).getValues();let i=-1;
    for(let x=0;x<v.length;x++){
      const r=v[x];
      if(dayCell_(r[1])!==today||String(r[10])!=='WAITING')continue;
      if(assigned!=='ALL'&&String(r[6])!==assigned)continue;
      i=x;break;
    }
    if(i<0)throw Error('No matching applicant is waiting.');
    const r=v[i],now=new Date(),recruiter=txt_(settingValue_(ss,'WINDOW_RECRUITER_'+win),80);q.getRange(i+2,11,1,3).setValues([['SERVING',win,now]]);q.getRange(i+2,18).setValue(recruiter);r[17]=recruiter;
    r[10]='SERVING';r[11]=win;r[12]=now;
    w.getRange(row,1,1,WH.length).setValues([[win,r[0],r[3],r[4],r[5],r[6],r[7],r[8],r[9],now,now]]);
    return {ok:true,ticket:ticket_(r)};
  }finally{lock.releaseLock()}
}
function recall_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),w=ss.getSheetByName(CFG.windows),win=int_(p.window,1,windowCount_()),r=w.getRange(win+1,1,1,WH.length).getValues()[0];
    if(!r[1])throw Error('Window is empty.');
    const q=ss.getSheetByName(CFG.queue),row=findId_(q,String(r[1])),now=new Date();
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
    if(!r[1])throw Error('Window is empty.');const q=ss.getSheetByName(CFG.queue),row=findId_(q,String(r[1]));if(row<2)throw Error('Ticket not found.');
    q.getRange(row,11).setValue('COMPLETED');q.getRange(row,14).setValue(new Date());w.getRange(win+1,2,1,WH.length-1).clearContent();return{ok:true}
  }finally{lock.releaseLock()}
}
function addWindow_(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const ss=ss_(),w=ss.getSheetByName(CFG.windows),n=windowCount_();if(n>=CFG.maxWindows)throw Error('Maximum windows reached.');w.getRange(n+2,1).setValue(n+1);return{ok:true,window:n+1}}finally{lock.releaseLock()}
}
function addTx_(p){
  const c=code_(p.code,6),n=txt_(p.name,60);if(!/^[A-Z0-9]{2,6}$/.test(c)||!n)throw Error('Enter a 2-6 character code and name.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const ss=ss_(),list=txs_(ss);if(list.some(x=>x.code===c))throw Error('Code already exists.');ss.getSheetByName(CFG.tx).appendRow([c,n,true,list.length+1]);return{ok:true,transaction:{code:c,name:n}}}finally{lock.releaseLock()}
}
function saveWindow_(p){
  const n=windowCount_(),win=int_(p.window,1,n),tx=code_(p.transaction,6),recruiter=txt_(p.recruiter,80);
  if(tx!=='ALL'&&!findTx_(ss_(),tx))throw Error('Invalid transaction.');
  if(!recruiter)throw Error('Recruiter name is required.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const ss=ss_();saveSetting_(ss,'WINDOW_TX_'+win,tx);saveSetting_(ss,'WINDOW_RECRUITER_'+win,recruiter);return{ok:true,window:win,transaction:tx,recruiter}}
  finally{lock.releaseLock()}
}
function saveSetting_(ss,key,val){
  const sh=ss.getSheetByName(CFG.settings)||ensure_(ss,CFG.settings,SH);
  const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getValues():[];
  const i=rows.findIndex(r=>String(r[0])===key),row=i<0?sh.getLastRow()+1:i+2;
  sh.getRange(row,1,1,3).setValues([[key,val,new Date()]]);
}
function deleteWindow_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),sh=ss.getSheetByName(CFG.windows),n=windowCount_(),win=int_(p.window,1,n);
    if(n<=1)throw Error('At least one window is required.');
    // Keep window numbers contiguous. Do not renumber active tickets in any window.
    const active=sh.getRange(2,2,n,1).getValues().some(r=>Boolean(r[0]));
    if(active)throw Error('Complete all active window tickets before removing a window.');
    const settings=ss.getSheetByName(CFG.settings);
    const previous=Array.from({length:n},(_,i)=>({tx:windowTx_(ss,i+1),name:settingValue_(ss,'WINDOW_RECRUITER_'+(i+1))}));
    sh.deleteRow(win+1);
    for(let i=1;i<n;i++)sh.getRange(i+1,1).setValue(i);
    for(let i=1;i<=n;i++){
      const v=i<win?previous[i-1]:i<n?previous[i]:null;
      saveSetting_(ss,'WINDOW_TX_'+i,v?v.tx:'ALL');
      saveSetting_(ss,'WINDOW_RECRUITER_'+i,v?v.name:'');
    }
    return{ok:true,windowCount:n-1};
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
  if(['NH','RH','TR','MC'].includes(code))throw Error('Core transaction types cannot be removed.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const ss=ss_(),q=ss.getSheetByName(CFG.queue);
    if(q.getLastRow()>1&&q.getRange(2,7,q.getLastRow()-1,1).getValues().some(r=>String(r[0])===code))throw Error('Transaction has queue history; deletion is disabled.');
    for(let i=1;i<=windowCount_();i++)if(windowTx_(ss,i)===code)throw Error('Transaction is assigned to a window.');
    const sh=ss.getSheetByName(CFG.tx),rows=sh.getDataRange().getValues(),i=rows.findIndex((r,k)=>k>0&&String(r[0])===code);
    if(i<1)throw Error('Transaction not found.');sh.deleteRow(i+1);return{ok:true};
  }finally{lock.releaseLock()}
}
function state_(){
  const ss=ss_(),n=windowCount_(),w=ss.getSheetByName(CFG.windows),windows={};
  w.getRange(2,1,n,WH.length).getValues().forEach(r=>windows[String(r[0])]=r[1]?windowTicket_(r):null);
  const q=ss.getSheetByName(CFG.queue),waiting=[],completed=[],today=day_();if(q.getLastRow()>1)q.getRange(2,1,q.getLastRow()-1,QH.length).getValues().forEach(r=>{const t=ticket_(r);if(dayCell_(r[1])===today&&String(r[10])==='WAITING')waiting.push(t);if(String(r[10])==='COMPLETED')completed.push(t)});completed.reverse();
  return{windowCount:n,maxWindowCount:CFG.maxWindows,windows,waiting,completed,transactions:txs_(ss),assignments:Object.fromEntries(Array.from({length:n},(_,i)=>[String(i+1),windowTx_(ss,i+1)])),recruiters:Object.fromEntries(Array.from({length:n},(_,i)=>[String(i+1),settingValue_(ss,'WINDOW_RECRUITER_'+(i+1))])),announcement:announcement_(ss),federationMode:true,version:'federation-v6'}
}

function announcement_(ss){
  const sheet=ss.getSheetByName(CFG.settings);
  if(!sheet||sheet.getLastRow()<2)return DEFAULT_ANNOUNCEMENT;
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues();
  const value=rows.find(row=>String(row[0]).trim()==='ANNOUNCEMENT');
  return value&&String(value[1]||'').trim() ? String(value[1]).trim() : DEFAULT_ANNOUNCEMENT;
}
function setAnnouncement_(p){
  const message=txt_(p.message,280);
  if(!message)throw Error('Please enter an announcement.');
  if(String(p.message||'').length>280)throw Error('Announcement must not exceed 280 characters.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_();
    const sheet=ss.getSheetByName(CFG.settings)||ensure_(ss,CFG.settings,SH);
    let row=0;
    if(sheet.getLastRow()>1){
      const keys=sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
      for(let i=0;i<keys.length;i++)if(String(keys[i][0]).trim()==='ANNOUNCEMENT'){row=i+2;break;}
    }
    if(!row)row=sheet.getLastRow()+1;
    sheet.getRange(row,1,1,3).setValues([['ANNOUNCEMENT',message,new Date()]]);
    return{ok:true,announcement:message};
  }finally{lock.releaseLock()}
}
function txs_(ss){const s=ss.getSheetByName(CFG.tx);if(!s||s.getLastRow()<2)return[];return s.getRange(2,1,s.getLastRow()-1,4).getValues().map(r=>({code:String(r[0]),name:String(r[1]),active:bool_(r[2]),sort:Number(r[3]||999)})).filter(x=>x.code&&x.name&&x.active).sort((a,b)=>a.sort-b.sort)}
function findTx_(ss,c){return txs_(ss).find(x=>x.code===c)}
function findActive_(q,today,f,l){if(q.getLastRow()<2)return null;const key=nameKey_(f,l),v=q.getRange(2,1,q.getLastRow()-1,QH.length).getValues();for(const r of v){if(dayCell_(r[1])!==today||!['WAITING','SERVING'].includes(String(r[10])))continue;if(nameKey_(r[15]||String(r[8]).split(' ')[0],r[16]||String(r[8]).split(' ').slice(-1)[0])===key)return r}return null}
function next_(q,today,tx){let m=0;if(q.getLastRow()<2)return 1;q.getRange(2,1,q.getLastRow()-1,QH.length).getValues().forEach(r=>{if(dayCell_(r[1])===today&&String(r[6])===tx){const x=String(r[3]).match(/-(\d+)$/);if(x)m=Math.max(m,Number(x[1]))}});return m+1}
function findId_(s,id){if(s.getLastRow()<2)return-1;const x=s.getRange(2,1,s.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();return x?x.getRow():-1}
function ticket_(r){return{ticketId:String(r[0]||''),createdAt:iso_(r[2]),queueNo:String(r[3]||''),mpcCode:String(r[4]||''),mpcName:String(r[5]||''),transaction:String(r[6]||''),transactionName:String(r[7]||''),name:String(r[8]||''),position:String(r[9]||''),status:String(r[10]||''),window:r[11]||'',calledAt:iso_(r[12]),date:dayCell_(r[1]),recruiter:String(r[17]||''),completedAt:iso_(r[13])}}
function windowTicket_(r){return{window:Number(r[0]),ticketId:String(r[1]||''),queueNo:String(r[2]||''),mpcCode:String(r[3]||''),mpcName:String(r[4]||''),transaction:String(r[5]||''),transactionName:String(r[6]||''),name:String(r[7]||''),position:String(r[8]||''),calledAt:iso_(r[9])}}
function windowCount_(){const s=ss_().getSheetByName(CFG.windows);let n=0;if(s&&s.getLastRow()>1)s.getRange(2,1,s.getLastRow()-1,1).getValues().forEach(r=>{const x=Number(r[0]);if(Number.isInteger(x)&&x>n)n=x});return Math.max(1,Math.min(CFG.maxWindows,n||4))}
function ensure_(ss,name,h){let s=ss.getSheetByName(name)||ss.insertSheet(name);s.getRange(1,1,1,h.length).setValues([h]).setFontWeight('bold').setBackground('#e5e7eb');s.setFrozenRows(1);return s}
function ss_(){return SpreadsheetApp.openById(CFG.spreadsheetId)}
function nameKey_(f,l){return norm_(f)+'|'+norm_(l)}function norm_(v){let s=String(v||'').trim().toUpperCase();if(s.normalize)s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');return s.replace(/[^A-Z0-9]/g,'')}
function txt_(v,n){return String(v||'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,n)}function code_(v,n){return String(v||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,n)}
function int_(v,a,b){v=Number(v);if(!Number.isInteger(v)||v<a||v>b)throw Error('Invalid window.');return v}function bool_(v){return typeof v==='boolean'?v:['TRUE','YES','1','ACTIVE'].includes(String(v).toUpperCase())}
function day_(){return Utilities.formatDate(new Date(),'Asia/Manila','yyyy-MM-dd')}function dayCell_(v){return v instanceof Date?Utilities.formatDate(v,'Asia/Manila','yyyy-MM-dd'):String(v||'').slice(0,10)}
function iso_(v){if(!v)return'';return v instanceof Date?v.toISOString():String(v)}function out_(cb,o){return ContentService.createTextOutput(cb+'('+JSON.stringify(o)+');').setMimeType(ContentService.MimeType.JAVASCRIPT)}
