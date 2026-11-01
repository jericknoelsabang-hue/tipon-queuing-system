/* TIPON TAWAG: preliminary document-check statuses only, no images, no OCR text.
 * Install alongside Code.gs + IntakeDatabase.gs. Re-deploy Apps Script to activate. */
function saveScanReport_(request){
 if(request.consent!==true)throw Error('Document checking requires applicant consent.');
 const token=String(request.token||'');
 if(!/^[0-9a-f-]{65,75}$/i.test(token))throw Error('Invalid scan submission token.');
 const cache=CacheService.getScriptCache(),raw=cache.get('INTAKE_TOKEN_'+token);
 if(!raw)throw Error('Scan session expired. The recruiter must review the documents.');
 const grant=JSON.parse(raw);
 if(Date.now()-grant.issued>30*60*1000||grant.transaction==='MC')throw Error('Scan session expired or ineligible.');
 const items=Array.isArray(request.results)?request.results:[];
 if(items.length>100)throw Error('Too many requirement results.');
 const count=Number(request.photoCount);
 if(!Number.isInteger(count)||count<1||count>100000)throw Error('Invalid photo count.');
 const available=request.scannerAvailable===true;
 const statuses=new Set(['POSSIBLE_MATCH','FOR_RECRUITER_REVIEW','NOT_DETECTED','SCANNER_UNAVAILABLE']);
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
   const ss=ss_(),q=ss.getSheetByName(CFG.queue),row=findId_(q,grant.ticketId);
   if(row<2)throw Error('Queue ticket was not found.');
   const ticket=q.getRange(row,1,1,QH.length).getValues()[0];
   if(dayCell_(ticket[1])!==day_()||String(ticket[6])!==grant.transaction)
     throw Error('Queue ticket does not match the scan.');
   const official=requirementsConfig_().requirements.filter(r=>
     r.transactions.includes('ALL')||r.transactions.includes(grant.transaction));
   const idMap=new Map(official.map(r=>[String(r.id),r]));
   const nameMap=new Map(official.map(r=>[norm_(r.name),r]));
   const given=new Map();
   for(const submitted of items){
     if(!submitted||typeof submitted!=='object')throw Error('Invalid scan status record.');
     const req=idMap.get(String(submitted.id||''))||
       nameMap.get(norm_(String(submitted.name||'').slice(0,100)));
     if(!req)throw Error('Unknown requirement. Refresh the applicant checklist.');
     const status=String(submitted.status||'').toUpperCase();
     if(!statuses.has(status)||given.has(req.id))throw Error('Duplicate or invalid scan status.');
     given.set(req.id,available?status:'SCANNER_UNAVAILABLE');
   }
   const sh=ss.getSheetByName('REQUIREMENT_SCANS');
   if(!sh)throw Error('Requirement scans tab is missing.');
   const oldRows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,13).getValues():[];
   const previous=new Map();
   oldRows.forEach((r,i)=>{
     if(String(r[1])===grant.ticketId)previous.set(String(r[4]),{row:i+2,record:r});
   });
   const additions=[],now=new Date();
   for(const req of official){
     const past=previous.get(String(req.id));
     if(past&&String(past.record[11])==='VERIFIED')continue;
     const status=given.get(req.id)||(available?'NOT_DETECTED':'SCANNER_UNAVAILABLE');
     const newRow=[past?String(past.record[0]):Utilities.getUuid(),
       grant.ticketId,String(ticket[3]),grant.transaction,
       req.id,req.name,status,'YES',available?'BROWSER_OCR':'MANUAL_REVIEW',
       txt_(request.scannedAt,40),now,'PENDING',
       count+' photo(s) captured; preliminary document check only. Recruiter must inspect originals.'];
     if(past)sh.getRange(past.row,1,1,13).setValues([newRow]);
     else additions.push(newRow);
   }
   if(additions.length){
     const from=sh.getLastRow()+1;
     if(from+additions.length-1>sh.getMaxRows())
       sh.insertRowsAfter(sh.getMaxRows(),Math.max(100,additions.length));
     sh.getRange(from,1,additions.length,13).setValues(additions);
   }
   cache.remove('INTAKE_TOKEN_'+token);
   return {ok:true,saved:official.length,queueNo:String(ticket[3])};
 }finally{lock.releaseLock()}
}
