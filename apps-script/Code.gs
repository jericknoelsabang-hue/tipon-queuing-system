const CFG={spreadsheetId:'1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik',queue:'QUEUE',windows:'WINDOWS',tx:'TRANSACTION_TYPES',settings:'SETTINGS',maxWindows:20};
const QH=['Ticket ID','Queue Date','Queue Taken At','Queue No','Transaction Code','Transaction','Applicant Name','Position / Purpose','Status','Current Window','Pre-check Called At','Pre-check Done At','Transferred At','Assigned Transaction Called At','Last Recalled At','Window Completed At','Prechecked','Pre Check By','Recruiter','Remarks'];
const WH=['Window','Active Ticket ID','Queue No','Transaction Code','Transaction','Applicant Name','Position / Purpose','Called At','Updated At','Queue Row'];
const EH=['Event ID','Ticket ID','Event At','Queue Date','Queue No','Applicant Name','Transaction Code','Transaction','Position / Purpose','Event','From Window','To Window','Recruiter','Remarks'];
const TH=['Code','Transaction Name','Active','Sort Order'];
const DEFAULT_ANNOUNCEMENT='Please keep your queue number until called.';
const DEFAULT_QUEUE_GUIDE='Hello, mga ka-miyembro! Sa mga bagong dating na wala pang queuing number, i-scan ang QR code na nakikita sa screen. Piliin ang inyong service. Para sa Recruitment, ilagay ang First Name, Last Name, Recruitment Transaction, at Position, pagkatapos ay pindutin ang Get Queue Number. Para sa Member Concern, ilagay ang First Name, Last Name, at Type of Concern, pagkatapos ay pindutin ang Get Queue Number. Kapag mayroon na kayong queue number, please keep your queue number until called.';
const SH=['Setting','Value','Updated At'];
function setupTiponQueueSystem(){
  const ss=SpreadsheetApp.openById(CFG.spreadsheetId);
  migrateQueueSchema_(ss);
  ensure_(ss,CFG.queue,QH);ensure_(ss,CFG.windows,WH);ensure_(ss,CFG.tx,TH);ensure_(ss,CFG.settings,SH);ensure_(ss,'QUEUE_HISTORY',EH);
  const w=ss.getSheetByName(CFG.windows);
  if(w.getLastRow()<2)for(let i=1;i<=4;i++)w.getRange(i+1,1).setValue(i);
  const t=ss.getSheetByName(CFG.tx);
  if(t.getLastRow()<2)t.getRange(2,1,3,4).setValues([['NH','New Hire',true,1],['RH','Rehire',true,2],['TR','Transfer',true,3]]);
  const all=allTxs_(ss);
  if(!all.some(t=>t.code==='MC'))ss.getSheetByName(CFG.tx).appendRow(['MC','Member Concerns',true,all.length+1]);
  backfillHistory_(ss);
  styleQueueSheets_(ss);
  return {ok:true,federationMode:true,queueHistory:true,version:'federation-v13'};
}function headerIndex_(headers,name){return headers.findIndex(v=>String(v||'').trim().toLowerCase()===String(name).trim().toLowerCase())}
function migrateQueueSchema_(ss){
  const q=ss.getSheetByName(CFG.queue)||ss.insertSheet(CFG.queue),w=ss.getSheetByName(CFG.windows)||ss.insertSheet(CFG.windows);
  const historyWasMissing=!ss.getSheetByName('QUEUE_HISTORY');
  const history=ss.getSheetByName('QUEUE_HISTORY')||ss.insertSheet('QUEUE_HISTORY');
  const qLastCol=Math.max(1,q.getLastColumn()),qHeaders=q.getRange(1,1,1,qLastCol).getValues()[0].map(String);
  const qIsCurrent=QH.every((h,i)=>qHeaders[i]===h);
  if(!qIsCurrent){
    const lastRow=q.getLastRow(),oldRows=lastRow>1?q.getRange(2,1,lastRow-1,qLastCol).getValues():[];
    const at=name=>headerIndex_(qHeaders,name),get=(r,name)=>{const i=at(name);return i<0?'':r[i]};
    const preWindowByQueueRow=new Map();
    const count=Math.max(0,w.getLastRow()-1);
    if(count){
      const wh=w.getRange(1,1,1,Math.max(w.getLastColumn(),WH.length)).getValues()[0].map(String);
      const wi=headerIndex_(wh,'Window'),wiTicket=headerIndex_(wh,'Active Ticket ID');
      if(wi>=0&&wiTicket>=0)w.getRange(2,1,count,Math.max(w.getLastColumn(),WH.length)).getValues().forEach((r,i)=>{const ticket=String(r[wiTicket]||'');if(ticket)preWindowByQueueRow.set(ticket,Number(r[wi])||'')});
    }
    const mapped=oldRows.map((r)=>{
      const ticketId=String(get(r,'Ticket ID')||''),created=get(r,'Created At')||get(r,'Queue Taken At'),
        fullName=String(get(r,'Applicant Name')||[get(r,'First Name'),get(r,'Last Name')].filter(Boolean).join(' ')).trim(),
        status=String(get(r,'Status')||'WAITING'),storedWindow=Number(get(r,'Window'))||preWindowByQueueRow.get(ticketId)||'',
        transactionCode=String(get(r,'Transaction Code')||get(r,'Service Transaction Code')||''),
        transaction=String(get(r,'Transaction')||get(r,'Service Transaction')||''),
        prechecked=String(get(r,'Prechecked')||'').toUpperCase()==='YES',
        called=get(r,'Called At'),complete=get(r,'Completed At')||get(r,'Window Completed At'),
        recall=get(r,'Last Recalled At'),preBy=get(r,'Pre Check By'),recruiter=get(r,'Recruiter'),remarks=get(r,'Remarks');
      let pcCalled=get(r,'Pre-check Called At')||'',assignedCalled=get(r,'Assigned Transaction Called At')||'';
      if(called){
        if(storedWindow&&isPrecheckingWindow_(ss,storedWindow))pcCalled=pcCalled||called;
        else if(prechecked&&String(status)==='WAITING'&&!storedWindow)pcCalled=pcCalled||called;
        else assignedCalled=assignedCalled||called;
      }
      return[String(get(r,'Ticket ID')||Utilities.getUuid()),get(r,'Queue Date')||dayCell_(created),created,
        get(r,'Queue No'),transactionCode,transaction,fullName,get(r,'Position / Purpose'),status,storedWindow,
        pcCalled,get(r,'Pre-check Done At')||'',get(r,'Transferred At')||'',assignedCalled,recall,complete,
        prechecked?'YES':'',preBy,recruiter,remarks];
    });
    if(q.getMaxColumns()<QH.length)q.insertColumnsAfter(q.getMaxColumns(),QH.length-q.getMaxColumns());
    if(mapped.length)q.getRange(2,1,mapped.length,QH.length).setValues(mapped);
    q.getRange(1,1,1,QH.length).setValues([QH]);
    if(q.getMaxColumns()>QH.length)q.deleteColumns(QH.length+1,q.getMaxColumns()-QH.length);
  }
  const wLastCol=Math.max(1,w.getLastColumn()),wHeaders=w.getRange(1,1,1,wLastCol).getValues()[0].map(String),wIsCurrent=WH.every((h,i)=>wHeaders[i]===h);
  if(!wIsCurrent){
    const lastRow=w.getLastRow(),oldRows=lastRow>1?w.getRange(2,1,lastRow-1,wLastCol).getValues():[],at=name=>headerIndex_(wHeaders,name);
    const mapped=oldRows.map(r=>WH.map(name=>{const i=at(name);return i<0?'':r[i]}));
    if(w.getMaxColumns()<WH.length)w.insertColumnsAfter(w.getMaxColumns(),WH.length-w.getMaxColumns());
    if(mapped.length)w.getRange(2,1,mapped.length,WH.length).setValues(mapped);
    w.getRange(1,1,1,WH.length).setValues([WH]);
    if(w.getMaxColumns()>WH.length)w.deleteColumns(WH.length+1,w.getMaxColumns()-WH.length);
  }
  if(q.getMaxColumns()>QH.length)q.deleteColumns(QH.length+1,q.getMaxColumns()-QH.length);
  if(w.getMaxColumns()>WH.length)w.deleteColumns(WH.length+1,w.getMaxColumns()-WH.length);
  if(history.getMaxColumns()<EH.length)history.insertColumnsAfter(history.getMaxColumns(),EH.length-history.getMaxColumns());
  if(history.getLastRow()<1||headerIndex_(history.getRange(1,1,1,EH.length).getValues()[0],'Event ID')<0){
    history.getRange(1,1,1,EH.length).setValues([EH]);
  }
  if(historyWasMissing||!qIsCurrent)backfillHistory_(ss);
}
function historyRow_(ticket,event,at,fromWindow,toWindow,recruiter,remarks){
  return[Utilities.getUuid(),String(ticket[0]||''),at||'',dayCell_(ticket[1]),String(ticket[3]||''),
    String(ticket[6]||''),String(ticket[4]||''),String(ticket[5]||''),String(ticket[7]||''),event,
    fromWindow||'',toWindow||'',recruiter||'',remarks||''];
}
function logEvent_(ss,ticket,event,at,fromWindow,toWindow,recruiter,remarks){
  const sh=ss.getSheetByName('QUEUE_HISTORY')||ensure_(ss,'QUEUE_HISTORY',EH);
  sh.appendRow(historyRow_(ticket,event,at,fromWindow,toWindow,recruiter,remarks));
}
function backfillHistory_(ss){
  const sh=ss.getSheetByName('QUEUE_HISTORY')||ensure_(ss,'QUEUE_HISTORY',EH),q=ss.getSheetByName(CFG.queue);
  if(q.getLastRow()<2)return;
  const existing=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,EH.length).getValues():[];
  const keys=new Set(existing.map(r=>[String(r[1]),String(r[9]),r[2] instanceof Date?r[2].getTime():String(r[2])].join('|')));
  const rows=q.getRange(2,1,q.getLastRow()-1,QH.length).getValues(),events=[];
  const add=(r,name,at,remarks)=>{const key=[String(r[0]),name,at instanceof Date?at.getTime():String(at||'')].join('|');if(keys.has(key))return;keys.add(key);events.push(historyRow_(r,name,at,'','',String(r[18]||''),remarks||''))};
  rows.forEach(r=>{
    if(!r[0])return;
    add(r,'QUEUE RECEIVED',r[2],'');
    const prechecked=String(r[16]||'').toUpperCase()==='YES';
    const preCall=r[10],done=r[11],transfer=r[12],assigned=r[13],recalled=r[14],completed=r[15];
    if(prechecked){
      add(r,'PRE-CHECK CALLED',preCall,preCall?'':'Legacy ticket passed Pre Checking; original call time was not stored.');
      add(r,'PRE-CHECK DONE',done,done?'':'Legacy ticket is marked prechecked; exact completion time was not stored.');
    }else if(preCall)add(r,'PRE-CHECK CALLED',preCall,'');
    if(transfer)add(r,'PRE-CHECK TRANSFERRED',transfer,'');
    if(assigned)add(r,'ASSIGNED TRANSACTION CALLED',assigned,'');
    if(recalled)add(r,prechecked?'ASSIGNED TRANSACTION RECALLED':'WINDOW RECALLED',recalled,'Only the last legacy recall time was available.');
    if(completed)add(r,'WINDOW COMPLETED',completed,'');
  });
  if(events.length){
    const rank={'QUEUE RECEIVED':0,'PRE-CHECK CALLED':1,'PRE-CHECK DONE':2,'PRE-CHECK TRANSFERRED':3,'ASSIGNED TRANSACTION CALLED':4,'ASSIGNED TRANSACTION RECALLED':5,'WINDOW RECALLED':5,'WINDOW COMPLETED':6};
    events.sort((a,b)=>{
      const av=a[2] instanceof Date?a[2].getTime():Number.MAX_SAFE_INTEGER,bv=b[2] instanceof Date?b[2].getTime():Number.MAX_SAFE_INTEGER;
      return av-bv||(rank[a[9]]||0)-(rank[b[9]]||0);
    });
    sh.getRange(sh.getLastRow()+1,1,events.length,EH.length).setValues(events);
  }
}
function styleQueueSheets_(ss){
  const q=ss.getSheetByName(CFG.queue),w=ss.getSheetByName(CFG.windows),h=ss.getSheetByName('QUEUE_HISTORY');
  [q,w,h].forEach(sh=>{if(sh.getFilter())sh.getFilter().remove();sh.setFrozenRows(1);sh.setRowHeight(1,38)});
  const qRows=Math.max(2,q.getLastRow()),qRange=q.getRange(1,1,qRows,QH.length);
  qRange.setVerticalAlignment('middle');
  q.getRange(1,1,1,QH.length).setBackground('#075477').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
  q.getRange(2,2,Math.max(1,qRows-1),1).setNumberFormat('yyyy-mm-dd');
  [3,11,12,13,14,15,16].forEach(col=>q.getRange(2,col,Math.max(1,qRows-1),1).setNumberFormat('yyyy-mm-dd hh:mm:ss'));
  q.setColumnWidths(1,QH.length,150);
  [[1,210],[2,115],[3,180],[4,110],[5,130],[6,170],[7,220],[8,210],[9,115],[10,125],[11,175],[12,175],[13,175],[14,195],[15,175],[16,175],[17,110],[18,180],[19,180],[20,300]].forEach(([col,width])=>q.setColumnWidth(col,width));
  const oldRules=q.getConditionalFormatRules();
  const rules=oldRules.filter(rule=>!rule.getRanges().some(range=>range.getSheet().getSheetId()===q.getSheetId()));
  [ ['WAITING','#e6f5ff','#075b8a'],['SERVING','#fff3d9','#86572b'],['COMPLETED','#e5f7eb','#167147'] ].forEach(([value,bg,fg])=>{
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(value).setBackground(bg).setFontColor(fg).setBold(true).setRanges([q.getRange(2,9,Math.max(1,q.getMaxRows()-1),1)]).build());
  });
  q.setConditionalFormatRules(rules);
  q.getRange(1,1,qRows,QH.length).createFilter();
  const wRows=Math.max(2,w.getLastRow());w.getRange(1,1,wRows,WH.length).setVerticalAlignment('middle');
  w.getRange(1,1,1,WH.length).setBackground('#075477').setFontColor('#ffffff').setFontWeight('bold');
  w.setColumnWidths(1,WH.length,160);[ [1,110],[2,245],[3,125],[4,140],[5,180],[6,230],[7,210],[8,175],[9,175],[10,105] ].forEach(([col,width])=>w.setColumnWidth(col,width));
  w.getRange(1,1,wRows,WH.length).createFilter();
  const hRows=Math.max(2,h.getLastRow());h.getRange(1,1,hRows,EH.length).setVerticalAlignment('middle');
  h.getRange(1,1,1,EH.length).setBackground('#075477').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
  h.setColumnWidths(1,EH.length,165);[[1,230],[2,245],[3,180],[4,115],[5,110],[6,220],[7,135],[8,180],[9,210],[10,260],[11,125],[12,125],[13,180],[14,300]].forEach(([col,width])=>h.setColumnWidth(col,width));
  if(h.getLastRow()>1)h.getRange(2,3,h.getLastRow()-1,1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  h.getRange(1,1,hRows,EH.length).createFilter();
}
function doGet(e){
  const p=e?.parameter||{},cb=String(p.callback||'callback').replace(/[^A-Za-z0-9_.$]/g,''),action=String(p.action||'state');
  try{
    let r;switch(action){
      case'health':r={ok:true,name:ss_().getName(),windows:windowCount_(),federationMode:true,queueHistory:true,version:'federation-v13',queueGuideSupported:true};break;
      case'state':r={ok:true,state:state_(p)};break;
      case'publicConfig':r=publicConfig_();break;
      case'register':r=register_(p);break;case'setWindowTx':r=setWindowTx_(p);break;case'call':r=call_(p);break;case'transfer':r=transfer_(p);break;
      case'recall':r=recall_(p);break;case'complete':r=complete_(p);break;case'donePrecheck':r=donePrecheck_(p);break;case'saveRemarks':r=saveRemarks_(p);break;
      case'addWindow':r=addWindow_();break;case'deleteWindow':r=deleteWindow_(p);break;case'saveWindow':r=saveWindow_(p);break;
      case'editTx':r=editTx_(p);break;case'deleteTx':r=deleteTx_(p);break;case'restoreTx':r=restoreTx_(p);break;case'addTx':r=addTx_(p);break;
      case'setAnnouncement':r=setAnnouncement_(p);break;case'setQueueGuide':r=setQueueGuide_(p);break;case'playQueueGuide':r=playQueueGuide_();break;case'announcementChunk':r=announcementChunk_(p);break;
      default:throw Error('Unknown action');
    }
    if(r&&r.ok&&!['state','health','publicConfig','announcementChunk'].includes(action))try{CacheService.getScriptCache().removeAll(['TIPON_STATE_display','TIPON_STATE_staff','TIPON_STATE_setup'])}catch(e){}
    return out_(cb,r);
  }catch(err){return out_(cb,{ok:false,error:String(err.message||err)})}
}function register_(p){
  const first=txt_(p.firstName,50),last=txt_(p.lastName,50),position=txt_(p.position,80),txCode=code_(p.transaction,6);
  if(!first||!last||!position||!txCode)throw Error('Complete all required fields.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),tx=findTx_(ss,txCode);
    if(!tx)throw Error('Invalid or inactive transaction.');
    if(isPrecheckingAssignment_(ss,tx.code))throw Error('Pre Checking is an internal service window and cannot be selected for registration.');
    const answer=issueTicket_(ss,tx,first,last,position);
    return answer;
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
  const {rows}=todayQueueRows_(q,today),desired=norm_(first+' '+last),wantedCode=code_(tx.code,6);
  let max=0,existing=null;
  for(let i=rows.length-1;i>=0;i--){
    const row=rows[i];
    if(dayCell_(row[1])!==today||code_(row[4],6)!==wantedCode)continue;
    const suffix=String(row[3]).match(/-(\d+)$/);
    if(suffix)max=Math.max(max,Number(suffix[1]));
    if(!existing&&norm_(row[6])===desired)existing=row;
  }
  if(existing)return{ok:true,duplicate:true,ticket:ticket_(existing),
    message:'This applicant/member already has a queue number for this transaction today.'};
  const num=wantedCode+'-'+String(max+1).padStart(4,'0'),now=new Date(),id=Utilities.getUuid(),name=first+' '+last;
  const row=[id,today,now,num,wantedCode,tx.name,name,pos,'WAITING','','','','','','','','','','',''];
  q.appendRow(row);
  logEvent_(ss,row,'QUEUE RECEIVED',now,'','', '', '');
  return{ok:true,duplicate:false,ticket:ticket_(row)};
}function settingValue_(ss,key){
  const sh=ss.getSheetByName(CFG.settings);if(!sh||sh.getLastRow()<2)return '';
  const row=sh.getRange(2,1,sh.getLastRow()-1,2).getValues().find(r=>String(r[0])===key);
  return row?String(row[1]||''):'';
}
function normalizeWindowAssignment_(value){
  if(value===undefined||value===null||value==='')return 'ALL';
  let entries=value;
  if(typeof entries==='string'){
    const raw=entries.trim();
    if(!raw||raw.toUpperCase()==='ALL')return 'ALL';
    if(raw[0]==='['){try{entries=JSON.parse(raw)}catch(e){entries=raw.split(/[;,|]/)}}
    else entries=raw.split(/[;,|]/);
  }
  if(!Array.isArray(entries))entries=[entries];
  const codes=[...new Set(entries.map(v=>code_(v,6)).filter(Boolean))];
  if(!codes.length||codes.includes('ALL'))return 'ALL';
  return codes.length===1?codes[0]:codes;
}
function windowAssignmentCodes_(assignment){
  if(assignment==='ALL'||assignment===undefined||assignment===null)return [];
  const values=Array.isArray(assignment)?assignment:[assignment];
  return [...new Set(values.map(v=>code_(v,6)).filter(v=>v&&v!=='ALL'))];
}
function assignmentAllows_(assignment,transaction){
  return assignment==='ALL'||windowAssignmentCodes_(assignment).includes(code_(transaction,6));
}
function assignmentStorage_(assignment){
  if(assignment==='ALL')return 'ALL';
  const codes=windowAssignmentCodes_(assignment);
  if(!codes.length)throw Error('Choose at least one assigned transaction.');
  return codes.length===1?codes[0]:JSON.stringify(codes);
}
function requestedWindowAssignment_(p){
  const raw=p&&p.transactions!==undefined?p.transactions:p?.transaction;
  if(Array.isArray(raw)&&!raw.length)throw Error('Choose at least one assigned transaction.');
  return normalizeWindowAssignment_(raw===undefined?'ALL':raw);
}
function validateWindowAssignment_(ss,assignment){
  if(assignment==='ALL')return 'ALL';
  const codes=windowAssignmentCodes_(assignment);
  if(!codes.length)throw Error('Choose at least one assigned transaction.');
  if(codes.some(code=>!findTx_(ss,code)))throw Error('Invalid or inactive transaction assignment.');
  return codes.length===1?codes[0]:codes;
}
function isPrecheckingAssignment_(ss,assignment){
  return windowAssignmentCodes_(assignment).some(code=>code==='PC'||/pre\s*-?\s*checking/i.test(findTx_(ss,code)?.name||''));
}
function isPrecheckingWindow_(ss,window){return isPrecheckingAssignment_(ss,windowTx_(ss,window))}
function hasPrecheckingWindow_(ss){
  const count=windowCount_(),sheet=ss.getSheetByName(CFG.settings),
    rows=sheet&&sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues():[],
    values=new Map(rows.map(row=>[String(row[0]).trim(),String(row[1]||'')]));
  for(let i=1;i<=count;i++){
    const stored=values.get('WINDOW_TX_'+i);
    if(stored&&isPrecheckingAssignment_(ss,normalizeWindowAssignment_(stored)))return true;
  }
  return false;
}
function windowTx_(ss,window){
  const stored=settingValue_(ss,'WINDOW_TX_'+window);
  if(stored){
    const selected=normalizeWindowAssignment_(stored);
    if(selected==='ALL')return 'ALL';
    const valid=windowAssignmentCodes_(selected).filter(code=>Boolean(findTx_(ss,code)));
    if(valid.length)return valid.length===1?valid[0]:valid;
  }
  const defaults={1:'NH',2:'RH',3:'TR',4:'MC'};
  const preferred=defaults[window]||'ALL';
  return preferred==='ALL'||findTx_(ss,preferred)?preferred:'ALL';
}
function setWindowTx_(p){
  const window=int_(p.window,1,windowCount_()),ss=ss_(),assignment=validateWindowAssignment_(ss,requestedWindowAssignment_(p));
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const sheet=ss.getSheetByName(CFG.settings)||ensure_(ss,CFG.settings,SH);
    const key='WINDOW_TX_'+window,rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues():[];
    const idx=rows.findIndex(r=>String(r[0]).trim()===key),row=idx>=0?idx+2:sheet.getLastRow()+1;
    sheet.getRange(row,1,1,3).setValues([[key,assignmentStorage_(assignment),new Date()]]);
    return{ok:true,window,transaction:assignment};
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
    const ss=ss_(),w=ss.getSheetByName(CFG.windows),win=int_(p.window,1,windowCount_()),windowRow=win+1;
    if(w.getRange(windowRow,2).getValue())throw Error('Complete or transfer the current applicant/member transaction first.');
    const assignment=windowTx_(ss,win),prechecking=isPrecheckingWindow_(ss,win),hasPrechecking=hasPrecheckingWindow_(ss);
    const q=ss.getSheetByName(CFG.queue),today=day_();
    if(q.getLastRow()<2)throw Error('Queue is empty.');
    const selection=todayQueueRows_(q,today),values=selection.rows;
    let i=-1;
    for(let x=0;x<values.length;x++){
      const r=values[x],transaction=code_(r[4],6),prechecked=String(r[16]||'').toUpperCase()==='YES';
      if(dayCell_(r[1])!==today||String(r[8])!=='WAITING')continue;
      if(prechecking){
        if(!['MC','NH','RH','TR'].includes(transaction)||prechecked)continue;
      }else{
        if(!assignmentAllows_(assignment,transaction))continue;
        if(hasPrechecking&&!prechecked)continue;
      }
      i=x;break;
    }
    if(i<0)throw Error(prechecking?'No unchecked New Hire, Rehire, Transfer, or Member Concern queue is waiting.':'No matching applicant or member is waiting.');
    const r=values[i],actualRow=selection.startRow+i,now=new Date(),recruiter=txt_(settingValue_(ss,'WINDOW_RECRUITER_'+win),80);
    q.getRange(actualRow,9,1,2).setValues([['SERVING',win]]);
    if(prechecking)q.getRange(actualRow,11).setValue(now);
    else q.getRange(actualRow,14).setValue(now);
    q.getRange(actualRow,19).setValue(recruiter);r[8]='SERVING';r[9]=win;r[18]=recruiter;
    if(prechecking&&!String(r[17]||'').trim()){q.getRange(actualRow,18).setValue(recruiter);r[17]=recruiter}
    if(prechecking)r[10]=now;else r[13]=now;
    w.getRange(windowRow,1,1,WH.length).setValues([[win,r[0],r[3],r[4],r[5],r[6],r[7],now,now,actualRow]]);
    logEvent_(ss,r,prechecking?'PRE-CHECK CALLED':'ASSIGNED TRANSACTION CALLED',now,'',win,recruiter,'');
    return{ok:true,ticket:ticket_(r)};
  }finally{lock.releaseLock()}
}function recall_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),w=ss.getSheetByName(CFG.windows),win=int_(p.window,1,windowCount_()),r=w.getRange(win+1,1,1,WH.length).getValues()[0];
    if(!r[1])throw Error('Window is empty.');
    const q=ss.getSheetByName(CFG.queue),row=queueRowForWindow_(q,r),now=new Date();
    if(row>1){
      const ticketRow=q.getRange(row,1,1,QH.length).getValues()[0],oldRemarks=String(ticketRow[19]||'');
      q.getRange(row,15).setValue(now);q.getRange(row,20).clearContent();ticketRow[14]=now;ticketRow[19]='';
      const isPC=isPrecheckingWindow_(ss,win);
      logEvent_(ss,ticketRow,isPC?'PRE-CHECK RECALLED':'ASSIGNED TRANSACTION RECALLED',now,win,win,txt_(ticketRow[18],80),oldRemarks);
    }
    w.getRange(win+1,8,1,2).setValues([[now,now]]);r[7]=now;
    return{ok:true,ticket:windowTicket_(r)}
  }finally{lock.releaseLock()}
}function donePrecheck_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),win=int_(p.window,1,windowCount_()),w=ss.getSheetByName(CFG.windows),
      sourceRow=win+1,sourceData=w.getRange(sourceRow,1,1,WH.length).getValues()[0],
      expected=txt_(p.ticketId,100),active=String(sourceData[1]||'');
    if(!isPrecheckingWindow_(ss,win))throw Error('Done Pre-check is only available in a Pre Checking window.');
    if(!active||(expected&&active!==expected))throw Error('The Pre Checking ticket changed. Refresh and try again.');
    const q=ss.getSheetByName(CFG.queue),queueRow=queueRowForWindow_(q,sourceData);
    if(queueRow<2)throw Error('The Pre Checking ticket could not be found in the queue.');
    const row=q.getRange(queueRow,1,1,QH.length).getValues()[0],transaction=code_(row[4],6);
    if(String(row[8])!=='SERVING'||Number(row[9])!==win)throw Error('The Pre Checking ticket changed. Refresh and try again.');
    if(String(row[16]||'').toUpperCase()==='YES')throw Error('This ticket has already passed Pre Checking.');
    if(!['MC','NH','RH','TR'].includes(transaction))throw Error('Only New Hire, Rehire, Transfer, or Member Concern tickets can be marked done.');
    const available=Array.from({length:windowCount_()},(_,i)=>i+1).some(target=>{
      if(target===win||isPrecheckingWindow_(ss,target))return false;
      const targetData=w.getRange(target+1,1,1,WH.length).getValues()[0];
      if(targetData[1])return false;
      return assignmentAllows_(windowTx_(ss,target),transaction);
    });
    if(available)throw Error('A destination window is available. Transfer the ticket directly.');
    const now=new Date(),precheckedBy=txt_(row[17]||settingValue_(ss,'WINDOW_RECRUITER_'+win),80);
    q.getRange(queueRow,9,1,2).setValues([['WAITING','']]);
    q.getRange(queueRow,12).setValue(now);q.getRange(queueRow,17).setValue('YES');q.getRange(queueRow,18).setValue(precheckedBy);
    row[8]='WAITING';row[9]='';row[11]=now;row[16]='YES';row[17]=precheckedBy;
    logEvent_(ss,row,'PRE-CHECK DONE',now,win,'',precheckedBy,'');
    w.getRange(sourceRow,2,1,WH.length-1).clearContent();
    return{ok:true,window:win,donePrecheck:true,ticket:ticket_(row)};
  }finally{lock.releaseLock()}
}function complete_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),w=ss.getSheetByName(CFG.windows),win=int_(p.window,1,windowCount_()),r=w.getRange(win+1,1,1,WH.length).getValues()[0];
    if(isPrecheckingWindow_(ss,win))throw Error('Pre Checking tickets must be transferred to an available service window.');
    const expected=txt_(p.ticketId,100),active=String(r[1]||'');
    if(!active||(expected&&active!==expected)){
      if(expected){
        const queue=ss.getSheetByName(CFG.queue),found=findId_(queue,expected);
        if(found>1){
          const existing=queue.getRange(found,1,1,QH.length).getValues()[0];
          if(String(existing[8])==='COMPLETED')return{ok:true,alreadyCompleted:true,window:win,ticket:ticket_(existing)};
        }
      }
      throw Error(active?'Service window changed. Refresh the Staff Console before completing.':'Window is empty or already completed.');
    }
    const q=ss.getSheetByName(CFG.queue),row=queueRowForWindow_(q,r);
    if(row<2)throw Error('Ticket not found.');
    const completedAt=new Date();
    q.getRange(row,9).setValue('COMPLETED');q.getRange(row,16).setValue(completedAt);
    const completedRow=q.getRange(row,1,1,QH.length).getValues()[0];completedRow[8]='COMPLETED';completedRow[15]=completedAt;
    logEvent_(ss,completedRow,'WINDOW COMPLETED',completedAt,win,win,txt_(completedRow[18],80),String(completedRow[19]||''));
    w.getRange(win+1,2,1,WH.length-1).clearContent();
    return{ok:true,window:win,ticket:{...ticket_(completedRow),completedAt:iso_(completedAt)}}
  }finally{lock.releaseLock()}
}function saveRemarks_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const win=int_(p.window,1,windowCount_()),ticketId=txt_(p.ticketId,100),remarks=txt_(p.remarks,500);
    if(!ticketId)throw Error('Ticket ID is required to save remarks.');
    const w=ss_().getSheetByName(CFG.windows),windowRow=w.getRange(win+1,1,1,WH.length).getValues()[0];
    if(String(windowRow[1]||'')!==ticketId)throw Error('The active queue changed. Refresh before saving remarks.');
    const q=ss_().getSheetByName(CFG.queue),row=queueRowForWindow_(q,windowRow);
    if(row<2)throw Error('The active queue ticket was not found.');
    const ticketRow=q.getRange(row,1,1,QH.length).getValues()[0];
    if(String(ticketRow[0]||'')!==ticketId||String(ticketRow[8])!=='SERVING'||Number(ticketRow[9])!==win)throw Error('The active queue changed. Refresh before saving remarks.');
    q.getRange(row,20).setValue(remarks);ticketRow[19]=remarks;
    return{ok:true,window:win,ticket:ticket_(ticketRow)};
  }finally{lock.releaseLock()}
}function transfer_(p){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    const ss=ss_(),w=ss.getSheetByName(CFG.windows),count=windowCount_(),
      source=int_(p.window,1,count),target=int_(p.targetWindow,1,count),code=code_(p.transaction,6);
    if(source===target)throw Error('Choose another service window.');
    if(!isPrecheckingWindow_(ss,source))throw Error('Only a Pre Checking window can transfer a ticket.');
    if(!['MC','NH','RH','TR'].includes(code))throw Error('Choose Member Concern, New Hire, Rehire, or Transfer.');
    const tx=findTx_(ss,code);if(!tx)throw Error('The selected transaction is not active.');
    if(isPrecheckingWindow_(ss,target))throw Error('Choose a destination service window, not another Pre Checking window.');
    if(!assignmentAllows_(windowTx_(ss,target),code))throw Error('The destination window is not assigned to '+tx.name+'.');
    const sourceRow=source+1,targetRow=target+1,
      sourceData=w.getRange(sourceRow,1,1,WH.length).getValues()[0],
      targetData=w.getRange(targetRow,1,1,WH.length).getValues()[0];
    if(!sourceData[1])throw Error('The Pre Checking window is empty.');
    if(targetData[1])throw Error('The destination window is serving another applicant or member.');
    const q=ss_().getSheetByName(CFG.queue),queueRow=queueRowForWindow_(q,sourceData);
    if(queueRow<2)throw Error('The Pre Checking ticket could not be found in the queue.');
    const row=q.getRange(queueRow,1,1,QH.length).getValues()[0];
    if(String(row[8])!=='SERVING'||Number(row[9])!==source)throw Error('The Pre Checking ticket changed. Refresh and try again.');
    const queueTransaction=code_(row[4],6);
    if(!['MC','NH','RH','TR'].includes(queueTransaction))throw Error('Only New Hire, Rehire, Transfer, or Member Concern tickets can leave Pre Checking.');
    if(code!==queueTransaction)throw Error('The destination window must match the transaction for this queue number.');
    const now=new Date(),recruiter=txt_(settingValue_(ss,'WINDOW_RECRUITER_'+target),80),precheckedBy=txt_(row[17]||settingValue_(ss,'WINDOW_RECRUITER_'+source),80);
    q.getRange(queueRow,9,1,2).setValues([['SERVING',target]]);
    q.getRange(queueRow,12,1,3).setValues([[now,now,now]]);
    q.getRange(queueRow,17,1,3).setValues([['YES',precheckedBy,recruiter]]);
    row[8]='SERVING';row[9]=target;row[11]=now;row[12]=now;row[13]=now;row[16]='YES';row[17]=precheckedBy;row[18]=recruiter;
    w.getRange(targetRow,1,1,WH.length).setValues([[target,row[0],row[3],row[4],row[5],row[6],row[7],now,now,queueRow]]);
    w.getRange(sourceRow,2,1,WH.length-1).clearContent();
    logEvent_(ss,row,'PRE-CHECK DONE',now,source,target,precheckedBy,'');
    logEvent_(ss,row,'PRE-CHECK TRANSFERRED',now,source,target,precheckedBy,'');
    logEvent_(ss,row,'ASSIGNED TRANSACTION CALLED',now,source,target,recruiter,'');
    return{ok:true,window:source,targetWindow:target,ticket:ticket_(row)};
  }finally{lock.releaseLock()}
}function addWindow_(){
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const ss=ss_(),w=ss.getSheetByName(CFG.windows),n=windowCount_();if(n>=CFG.maxWindows)throw Error('Maximum windows reached.');w.getRange(n+2,1).setValue(n+1);return{ok:true,window:n+1}}finally{lock.releaseLock()}
}
function addTx_(p){
  const c=code_(p.code,6),n=txt_(p.name,60);if(!/^[A-Z0-9]{2,6}$/.test(c)||!n)throw Error('Enter a 2-6 character code and name.');
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{const ss=ss_(),list=allTxs_(ss);if(list.some(x=>x.code===c))throw Error('Code already exists, including inactive records. Restore it in Setup if needed.');ss.getSheetByName(CFG.tx).appendRow([c,n,true,list.length+1]);return{ok:true,transaction:{code:c,name:n}}}finally{lock.releaseLock()}
}
function saveWindow_(p){
  const n=windowCount_(),win=int_(p.window,1,n),ss=ss_(),assignment=validateWindowAssignment_(ss,requestedWindowAssignment_(p)),recruiter=txt_(p.recruiter,80);
  const lock=LockService.getScriptLock();lock.waitLock(30000);
  try{
    writeSettings_(ss,{['WINDOW_TX_'+win]:assignmentStorage_(assignment),['WINDOW_RECRUITER_'+win]:recruiter});
    return{ok:true,window:win,transaction:assignment,recruiter};
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
    for(let i=1;i<=windowCount_();i++){
       const assignment=windowTx_(ss,i);
       if(assignment!=='ALL'&&assignmentAllows_(assignment,code)){
         const remaining=windowAssignmentCodes_(assignment).filter(item=>item!==code);
         changes['WINDOW_TX_'+i]=remaining.length?assignmentStorage_(remaining):'ALL';
       }
     }
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
  const ss=ss_(),transactions=txs_(ss).filter(t=>!isPrecheckingAssignment_(ss,t.code));
  return{ok:true,version:'federation-v13',transactions};
}function state_(p){
  const view=['display','staff','setup'].includes(String(p?.view||''))?String(p.view):'staff';
  const cacheKey='TIPON_STATE_'+view;
  let cache=null;
  try{cache=CacheService.getScriptCache();const saved=cache.get(cacheKey);if(saved)return JSON.parse(saved)}catch(e){}
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
    const stored=String(settingMap.get('WINDOW_TX_'+i)||'').trim(),fallback=availableCodes.has(defaultTx[i])?defaultTx[i]:'ALL';
    if(!stored)assignments[String(i)]=fallback;
    else{
      const selected=normalizeWindowAssignment_(stored);
      if(selected==='ALL')assignments[String(i)]='ALL';
      else{const valid=windowAssignmentCodes_(selected).filter(code=>availableCodes.has(code));assignments[String(i)]=valid.length===1?valid[0]:valid.length?valid:fallback}
    }
    recruiters[String(i)]=settingMap.get('WINDOW_RECRUITER_'+i)||'';
  }
  const q=ss.getSheetByName(CFG.queue),waiting=[],precheckDone=[],completed=[],today=day_(),includeCompleted=!(p&&p.view)||String(p.view)==='staff';
  const rowCount=Math.max(0,q.getLastRow()-1);let queueRows=[];
  if(rowCount>0){
    if(!includeCompleted&&rowCount>800){
      const dateCells=q.getRange(2,2,rowCount,1).getValues(),firstToday=dateCells.findIndex(r=>dayCell_(r[0])===today);
      if(firstToday>=0)queueRows=q.getRange(firstToday+2,1,rowCount-firstToday,QH.length).getValues();
    }else queueRows=q.getRange(2,1,rowCount,QH.length).getValues();
  }
  const queueRowsById=new Map(queueRows.map(row=>[String(row[0]||''),row]));
  Object.keys(windows).forEach(key=>{const item=windows[key],queueRow=item&&queueRowsById.get(item.ticketId);if(item)item.remarks=String(queueRow?.[19]||'')});
  queueRows.forEach(row=>{
    if(dayCell_(row[1])===today&&String(row[8])==='WAITING'){const ticket=ticket_(row);if(String(row[16]||'').toUpperCase()==='YES')precheckDone.push(ticket);else waiting.push(ticket)}
    if(includeCompleted&&String(row[8])==='COMPLETED')completed.push(ticket_(row));
  });
  if(includeCompleted)completed.reverse();
  const result={windowCount:n,maxWindowCount:CFG.maxWindows,windows,waiting,precheckDone,completed,
    transactions:activeTx,transactionTypes:txList,assignments,recruiters,
    announcement:settingMap.get('ANNOUNCEMENT')?.trim()||DEFAULT_ANNOUNCEMENT,
    queueGuide:settingMap.get('QUEUE_GUIDE')?.trim()||DEFAULT_QUEUE_GUIDE,
    queueGuideCue:settingMap.get('QUEUE_GUIDE_CUE')?.trim()||'',queueGuideSupported:true,
    federationMode:true,queueHistory:true,version:'federation-v13'};
  try{const json=JSON.stringify(result);if(cache&&json.length<28000)cache.put(cacheKey,json,2)}catch(e){}
  return result;
}function announcement_(ss){
  const sheet=ss.getSheetByName(CFG.settings);
  if(!sheet||sheet.getLastRow()<2)return DEFAULT_ANNOUNCEMENT;
  const rows=sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues();
  const value=rows.find(row=>String(row[0]).trim()==='ANNOUNCEMENT');
  return value&&String(value[1]||'').trim() ? String(value[1]).trim() : DEFAULT_ANNOUNCEMENT;
}
function setQueueGuide_(p){
 const raw=String(p.message||'').trim();
 if(!raw||raw.length>1300)throw Error('Queue guidance must contain 1 to 1,300 characters.');
 const guide=txt_(raw,1300);
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
   const sh=ss_().getSheetByName(CFG.settings);
   const keys=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getValues():[];
   const position=keys.findIndex(r=>String(r[0])==='QUEUE_GUIDE');
   const row=position>=0?position+2:sh.getLastRow()+1;
   sh.getRange(row,1,1,3).setValues([['QUEUE_GUIDE',guide,new Date()]]);
   return {ok:true,queueGuide:guide};
 }finally{lock.releaseLock()}
}
function playQueueGuide_(){
 // Rate limit broadcasts even if an unauthenticated legacy queue endpoint is called.
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
   const settings=ss_().getSheetByName(CFG.settings);
   const props=PropertiesService.getScriptProperties(),now=Date.now();
   const last=Number(props.getProperty('QUEUE_GUIDE_LAST_PLAY')||0);
   if(now-last<25000)throw Error('Please allow at least 25 seconds between queue instructions.');
   props.setProperty('QUEUE_GUIDE_LAST_PLAY',String(now));
   const cue=String(now)+'-'+Utilities.getUuid();
   const values=settings.getLastRow()>1?settings.getRange(2,1,settings.getLastRow()-1,1).getValues():[];
   const index=values.findIndex(r=>String(r[0])==='QUEUE_GUIDE_CUE');
   settings.getRange(index>=0?index+2:settings.getLastRow()+1,1,1,3)
      .setValues([['QUEUE_GUIDE_CUE',cue,new Date()]]);
   return {ok:true,queueGuideCue:cue};
 }finally{lock.releaseLock()}
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
function findActive_(q,today,f,l){
  if(q.getLastRow()<2)return null;
  const key=norm_(f+' '+l),v=q.getRange(2,1,q.getLastRow()-1,QH.length).getValues();
  for(const r of v)if(dayCell_(r[1])===today&&['WAITING','SERVING'].includes(String(r[8]))&&norm_(r[6])===key)return r;
  return null;
}function next_(q,today,tx){
  let m=0;if(q.getLastRow()<2)return 1;
  q.getRange(2,1,q.getLastRow()-1,QH.length).getValues().forEach(r=>{if(dayCell_(r[1])===today&&String(r[4])===tx){const x=String(r[3]).match(/-(\d+)$/);if(x)m=Math.max(m,Number(x[1]))}});
  return m+1;
}function findId_(s,id){if(s.getLastRow()<2)return-1;const x=s.getRange(2,1,s.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();return x?x.getRow():-1}
function ticket_(r){
  const precheckedCall=iso_(r[10]),assignedCall=iso_(r[13]);
  return{ticketId:String(r[0]||''),createdAt:iso_(r[2]),queueNo:String(r[3]||''),mpcCode:'',mpcName:'',
    transaction:String(r[4]||''),transactionName:String(r[5]||''),name:String(r[6]||''),position:String(r[7]||''),
    status:String(r[8]||''),window:r[9]||'',calledAt:assignedCall||precheckedCall,date:dayCell_(r[1]),
    recruiter:String(r[18]||''),completedAt:iso_(r[15]),prechecked:String(r[16]||'').toUpperCase()==='YES',
    precheckedBy:String(r[17]||''),remarks:String(r[19]||''),preCheckCalledAt:precheckedCall,
    preCheckDoneAt:iso_(r[11]),transferredAt:iso_(r[12]),assignedTransactionCalledAt:assignedCall,
    lastRecalledAt:iso_(r[14]),windowCompletedAt:iso_(r[15])}
}function windowTicket_(r){
  return{window:Number(r[0]),ticketId:String(r[1]||''),queueNo:String(r[2]||''),mpcCode:'',mpcName:'',
    transaction:String(r[3]||''),transactionName:String(r[4]||''),name:String(r[5]||''),position:String(r[6]||''),calledAt:iso_(r[7])}
}function queueRowForWindow_(q,windowRow){
  const stored=Number(windowRow[9]);
  if(Number.isInteger(stored)&&stored>=2&&stored<=q.getLastRow()){
    if(String(q.getRange(stored,1).getValue())===String(windowRow[1]))return stored;
  }
  return findId_(q,String(windowRow[1]));
}function windowCount_(){const s=ss_().getSheetByName(CFG.windows);let n=0;if(s&&s.getLastRow()>1)s.getRange(2,1,s.getLastRow()-1,1).getValues().forEach(r=>{const x=Number(r[0]);if(Number.isInteger(x)&&x>n)n=x});return Math.max(1,Math.min(CFG.maxWindows,n||4))}
function ensure_(ss,name,h){
  const sheet=ss.getSheetByName(name)||ss.insertSheet(name);
  const oldLastColumn=Math.max(sheet.getLastColumn(),h.length);
  if(sheet.getMaxColumns()<h.length)sheet.insertColumnsAfter(sheet.getMaxColumns(),h.length-sheet.getMaxColumns());
  sheet.getRange(1,1,1,h.length).setValues([h]).setFontWeight('bold').setBackground('#075477').setFontColor('#ffffff').setVerticalAlignment('middle').setWrap(true);
  sheet.setFrozenRows(1);
  return sheet;
}function ss_(){return _tiponSpreadsheet||(_tiponSpreadsheet=SpreadsheetApp.openById(CFG.spreadsheetId))}
let _tiponSpreadsheet=null;
function ss_(){return _tiponSpreadsheet||(_tiponSpreadsheet=SpreadsheetApp.openById(CFG.spreadsheetId))}
function nameKey_(f,l){return norm_(f)+'|'+norm_(l)}function norm_(v){let s=String(v||'').trim().toUpperCase();if(s.normalize)s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');return s.replace(/[^A-Z0-9]/g,'')}
function txt_(v,n){return String(v||'').replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim().slice(0,n)}function code_(v,n){return String(v||'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,n)}
function int_(v,a,b){v=Number(v);if(!Number.isInteger(v)||v<a||v>b)throw Error('Invalid window.');return v}function bool_(v){return typeof v==='boolean'?v:['TRUE','YES','1','ACTIVE'].includes(String(v).toUpperCase())}
function day_(){return Utilities.formatDate(new Date(),'Asia/Manila','yyyy-MM-dd')}function dayCell_(v){return v instanceof Date?Utilities.formatDate(v,'Asia/Manila','yyyy-MM-dd'):String(v||'').slice(0,10)}
function iso_(v){if(!v)return'';return v instanceof Date?v.toISOString():String(v)}function out_(cb,o){return ContentService.createTextOutput(cb+'('+JSON.stringify(o)+');').setMimeType(ContentService.MimeType.JAVASCRIPT)}
