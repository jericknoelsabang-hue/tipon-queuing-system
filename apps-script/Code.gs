const CFG={spreadsheetId:'1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik',queue:'QUEUE',windows:'WINDOWS',tx:'TRANSACTION_TYPES',mpc:'MPC_CONFIG',settings:'SETTINGS',maxWindows:20};
const QH=['Ticket ID','Queue Date','Created At','Queue No','MPC Code','MPC Name','Transaction Code','Transaction','Applicant Name','Position / Purpose','Status','Window','Called At','Completed At','Last Recalled At','First Name','Last Name'];
const WH=['Window','Active Ticket ID','Queue No','MPC Code','MPC Name','Transaction Code','Transaction','Applicant Name','Position / Purpose','Called At','Updated At'];
const TH=['Code','Transaction Name','Active','Sort Order'];
const MH=['MPC Code','MPC Name','Queue Prefix','Logo URL','Active','Sort Order'];
const DEFAULT_ANNOUNCEMENT='Please keep your queue number until called.';
const SH=['Setting','Value','Updated At'];

function setupTiponQueueSystem(){
  const ss=SpreadsheetApp.openById(CFG.spreadsheetId);
  ensure_(ss,CFG.queue,QH);ensure_(ss,CFG.windows,WH);ensure_(ss,CFG.tx,TH);ensure_(ss,CFG.settings,SH);
  const w=ss.getSheetByName(CFG.windows);
  for(let i=1;i<=3;i++)if(!w.getRange(i+1,1).getValue())w.getRange(i+1,1).setValue(i);
  const t=ss.getSheetByName(CFG.tx);
  if(t.getLastRow()<2)t.getRange(2,1,3,4).setValues([['NH','New Hire',true,1],['RH','Rehire',true,2],['TR','Transfer',true,3]]);
  return {ok:true,federationMode:true,version:'federation-v3'};
}
function doGet(e){
  const p=e?.parameter||{},cb=String(p.callback||'callback').replace(/[^A-Za-z0-9_.$]/g,'');
  try{
    let r;switch(String(p.action||'state')){
      case'health':r={ok:true,name:ss_().getName(),windows:windowCount_(),federationMode:true,version:'federation-v3'};break;
      case'state':r={ok:true,state:state_()};break;
      case'register':r=register_(p);break;
      case'call':r=call_(p);break;
      case'recall':r=recall_(p);break;
      case'complete':r=complete_(p);break;
      case'addWindow':r=addWindow_();break;
      case'addTx':r=addTx_(p);break;
      case'setAnnouncement':r=setAnnouncement_(p);break;
      default:throw Error('Unknown action');
    }return out_(cb,r);
  }catch(err){return out_(cb,{ok:false,error:String(err.message||err)})}
}
function register_(p){
  const first=txt_(p.firstName,50),last=txt_(p.lastName,50),pos=txt_(p.position,80),tx=code_(p.transaction,6);
  if(!first||!last||!pos||!tx)throw Error('Complete all required fields.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),t=findTx_(ss,tx);
    if(!t)throw Error('Invalid transaction.');
    const q=ss.getSheetByName(CFG.queue),today=day_(),existing=findActive_(q,today,first,last);
    if(existing)return {ok:true,duplicate:true,ticket:ticket_(existing),message:'Existing active queue number returned.'};
    const n=next_(q,today,tx),num=tx+'-'+String(n).padStart(3,'0'),now=new Date(),id=Utilities.getUuid(),name=first+' '+last;
    // Preserve historical sheet columns. All new tickets are TIPON Federation-wide.
    const row=[id,today,now,num,'TIPON','TIPON Federation',t.code,t.name,name,pos,'WAITING','','','','',first,last];
    q.appendRow(row);
    return {ok:true,duplicate:false,ticket:ticket_(row)};
  }finally{lock.releaseLock()}
}
function call_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),w=ss.getSheetByName(CFG.windows),win=int_(p.window,1,windowCount_()),row=win+1;
    if(w.getRange(row,2).getValue())throw Error('Complete current applicant first.');
    const tf=code_(p.transaction||'ALL',6)||'ALL',q=ss.getSheetByName(CFG.queue),today=day_();
    if(q.getLastRow()<2)throw Error('Queue is empty.');
    const v=q.getRange(2,1,q.getLastRow()-1,QH.length).getValues();let i=-1;
    for(let x=0;x<v.length;x++){
      const r=v[x];
      if(dayCell_(r[1])!==today||String(r[10])!=='WAITING')continue;
      if(tf!=='ALL'&&String(r[6])!==tf)continue;
      i=x;break;
    }
    if(i<0)throw Error('No matching applicant is waiting.');
    const r=v[i],now=new Date();q.getRange(i+2,11,1,3).setValues([['SERVING',win,now]]);
    r[10]='SERVING';r[11]=win;r[12]=now;
    w.getRange(row,1,1,WH.length).setValues([[win,r[0],r[3],r[4],r[5],r[6],r[7],r[8],r[9],now,now]]);
    return {ok:true,ticket:ticket_(r)};
  }finally{lock.releaseLock()}
}
function recall_(p){
  const ss=ss_(),w=ss.getSheetByName(CFG.windows),win=int_(p.window,1,windowCount_()),r=w.getRange(win+1,1,1,WH.length).getValues()[0];
  if(!r[1])throw Error('Window is empty.');const q=ss.getSheetByName(CFG.queue),row=findId_(q,String(r[1]));if(row>1)q.getRange(row,15).setValue(new Date());
  return{ok:true,ticket:windowTicket_(r)}
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
function state_(){
  const ss=ss_(),n=windowCount_(),w=ss.getSheetByName(CFG.windows),windows={};
  w.getRange(2,1,n,WH.length).getValues().forEach(r=>windows[String(r[0])]=r[1]?windowTicket_(r):null);
  const q=ss.getSheetByName(CFG.queue),waiting=[],today=day_();if(q.getLastRow()>1)q.getRange(2,1,q.getLastRow()-1,QH.length).getValues().forEach(r=>{if(dayCell_(r[1])===today&&String(r[10])==='WAITING')waiting.push(ticket_(r))});
  return{windowCount:n,maxWindowCount:CFG.maxWindows,windows,waiting,transactions:txs_(ss),announcement:announcement_(ss),federationMode:true,version:'federation-v3'}
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
function ticket_(r){return{ticketId:String(r[0]||''),createdAt:iso_(r[2]),queueNo:String(r[3]||''),mpcCode:String(r[4]||''),mpcName:String(r[5]||''),transaction:String(r[6]||''),transactionName:String(r[7]||''),name:String(r[8]||''),position:String(r[9]||''),status:String(r[10]||''),window:r[11]||'',calledAt:iso_(r[12])}}
function windowTicket_(r){return{window:Number(r[0]),ticketId:String(r[1]||''),queueNo:String(r[2]||''),mpcCode:String(r[3]||''),mpcName:String(r[4]||''),transaction:String(r[5]||''),transactionName:String(r[6]||''),name:String(r[7]||''),position:String(r[8]||''),calledAt:iso_(r[9])}}
function windowCount_(){const s=ss_().getSheetByName(CFG.windows);let n=0;if(s&&s.getLastRow()>1)s.getRange(2,1,s.getLastRow()-1,1).getValues().forEach(r=>{const x=Number(r[0]);if(Number.isInteger(x)&&x>n)n=x});return Math.max(3,Math.min(CFG.maxWindows,n))}
function ensure_(ss,name,h){let s=ss.getSheetByName(name)||ss.insertSheet(name);s.getRange(1,1,1,h.length).setValues([h]).setFontWeight('bold').setBackground('#e5e7eb');s.setFrozenRows(1);return s}
function ss_(){return SpreadsheetApp.openById(CFG.spreadsheetId)}
function nameKey_(f,l){return norm_(f)+'|'+norm_(l)}function norm_(v){let s=String(v||'').trim().toUpperCase();if(s.normalize)s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');return s.replace(/[^A-Z0-9]/g,'')}
function txt_(v,n){return String(v||'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,n)}function code_(v,n){return String(v||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,n)}
function int_(v,a,b){v=Number(v);if(!Number.isInteger(v)||v<a||v>b)throw Error('Invalid window.');return v}function bool_(v){return typeof v==='boolean'?v:['TRUE','YES','1','ACTIVE'].includes(String(v).toUpperCase())}
function day_(){return Utilities.formatDate(new Date(),'Asia/Manila','yyyy-MM-dd')}function dayCell_(v){return v instanceof Date?Utilities.formatDate(v,'Asia/Manila','yyyy-MM-dd'):String(v||'').slice(0,10)}
function iso_(v){if(!v)return'';return v instanceof Date?v.toISOString():String(v)}function out_(cb,o){return ContentService.createTextOutput(cb+'('+JSON.stringify(o)+');').setMimeType(ContentService.MimeType.JAVASCRIPT)}
