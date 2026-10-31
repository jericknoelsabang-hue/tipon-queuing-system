/* TIPON TAWAG: consent-based applicant data intake, POST only (no photos/OCR text).
   Install alongside Code.gs and deploy a new Apps Script version.
   One-time capability token is bound to a registered queue ticket. */
const DB_TAB='APPLICANT DATABASE';
const DB_INDEX='APPLICANT_INTAKE_INDEX';
const DB_INDEX_HEADERS=['Ticket ID','Applicant Reference No.','Database Row','Updated At'];
const INTAKE_FIELDS=['Middle Name','Suffix','Date of Birth','Place of Birth (City/Province)',
'Nationality','Gender','Civil Status','Present House No. / Street / Subdivision',
'Present Barangay','Present Municipality / City','Present Province','Present Country*',
'Present ZIP Code','Permanent House No. / Street / Subdivision','Permanent Barangay',
'Permanent Municipality / City','Permanent Province','Permanent Country','Permanent ZIP Code',
'Email / Gmail Address','Phone Number','SSS No.','PhilHealth No.','Pag-IBIG No.','TIN'];
function initApplicantDb_(){
 const ss=ss_(),db=ss.getSheetByName(DB_TAB);
 if(!db||db.getRange(1,1).getValue()!=='Timestamp')throw Error('Applicant database header not initialized.');
 const idx=ss.getSheetByName(DB_INDEX)||ss.insertSheet(DB_INDEX);
 if(idx.getLastRow()===0)idx.getRange(1,1,1,4).setValues([DB_INDEX_HEADERS]);
 idx.setFrozenRows(1);return {ok:true};
}
function issueApplicantToken_(ticket){
 if(!ticket||ticket.transaction==='MC'||!ticket.ticketId)return '';
 const token=Utilities.getUuid()+'-'+Utilities.getUuid();
 CacheService.getScriptCache().put('INTAKE_TOKEN_'+token,JSON.stringify({
   ticketId:ticket.ticketId,transaction:ticket.transaction,issued:Date.now()
 }),1800);
 return token;
}
function cleanDb_(v,max=180){
 const t=String(v===undefined||v===null?'':v).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max);
 return /^[=+\-@]/.test(t)?"'"+t:t; // Escape spreadsheet formulas.
}
function saveApplicant_(request){
 if(request.consent!==true||request.confirmed!==true)throw Error('Consent and applicant confirmation required.');
 const token=String(request.token||'');
 if(!/^[0-9a-f-]{65,75}$/i.test(token))throw Error('Invalid intake session.');
 const cache=CacheService.getScriptCache(),saved=cache.get('INTAKE_TOKEN_'+token);
 if(!saved)throw Error('Session expired. Please complete applicant information with the recruiter.');
 const grant=JSON.parse(saved);
 if(Date.now()-grant.issued>1800000)throw Error('Intake session expired.');
 const fields=request.fields||{};
 if(typeof fields!=='object'||Array.isArray(fields)||Object.keys(fields).length>25)throw Error('Invalid applicant data.');
 const allowed=new Set(INTAKE_FIELDS);
 for(const [key,value] of Object.entries(fields)){
   if(!allowed.has(key)||typeof value!=='string'||value.length>220)throw Error('Unrecognized applicant field.');
 }
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
   const ss=ss_(),q=ss.getSheetByName(CFG.queue);
   const qr=findId_(q,grant.ticketId);
   if(qr<2)throw Error('Queue ticket not found.');
   const ticket=q.getRange(qr,1,1,QH.length).getValues()[0];
   if(dayCell_(ticket[1])!==day_()||String(ticket[6])!==grant.transaction||grant.transaction==='MC')
     throw Error('This queue ticket cannot receive applicant documents.');
   const db=ss.getSheetByName(DB_TAB),idx=ss.getSheetByName(DB_INDEX);
   if(!db||!idx)throw Error('Applicant database is not initialized.');
   const headers=db.getRange(1,1,1,db.getLastColumn()).getValues()[0].map(String);
   const names=new Map();headers.forEach((name,i)=>{if(!names.has(name))names.set(name,i)});
   const required=['Timestamp','Applicant Reference No.*','Applicant Type*','Position*',
     'Application Date','Last Name','First Name','General Data Privacy Consent'];
   for(const name of required)if(!names.has(name))throw Error('Database header mismatch: '+name);
   const indexed=idx.getLastRow()>1?idx.getRange(2,1,idx.getLastRow()-1,4).getValues():[];
   const existing=indexed.findIndex(row=>String(row[0])===grant.ticketId);
   let ref,rowNo;
   if(existing>=0){ref=String(indexed[existing][1]);rowNo=Number(indexed[existing][2]);}
   else{
     const yr=day_().slice(0,4),props=PropertiesService.getScriptProperties(),key='TIPON_APP_SEQUENCE_'+yr;
     const next=Number(props.getProperty(key)||0)+1;props.setProperty(key,String(next));
     ref='TIPON-'+yr+'-'+String(next).padStart(6,'0');rowNo=db.getLastRow()+1;
   }
   if(rowNo>db.getMaxRows())db.insertRowsAfter(db.getMaxRows(),100);
   let record=existing>=0?db.getRange(rowNo,1,1,headers.length).getValues()[0]:Array(headers.length).fill('');
   const put=(key,value)=>{const c=names.get(key);if(c!==undefined)record[c]=value};
   const now=new Date();
   put('Timestamp',existing>=0?record[names.get('Timestamp')]||now:now);
   put('Applicant Reference No.*',ref);
   put('Applicant Type*',cleanDb_(ticket[7],60));
   put('Position*',cleanDb_(ticket[9],80));
   put('Application Date',day_());
   put('Last Name',cleanDb_(ticket[16],50));
   put('First Name',cleanDb_(ticket[15],50));
   put('General Data Privacy Consent','YES - '+Utilities.formatDate(now,'Asia/Manila','yyyy-MM-dd HH:mm:ss'));
   for(const [key,value] of Object.entries(fields)){const v=cleanDb_(value);if(v)put(key,v)}
   db.getRange(rowNo,1,1,headers.length).setValues([record]);
   if(existing>=0)idx.getRange(existing+2,4).setValue(now);
   else idx.appendRow([grant.ticketId,ref,rowNo,now]);
   cache.remove('INTAKE_TOKEN_'+token);
   return {ok:true,reference:ref};
 }finally{lock.releaseLock()}
}
function doPost(e){
 let r={ok:false,error:'Unsupported POST operation'},id='';
 try{
   const p=e?.parameter||{};id=String(p.requestId||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,70);
   const raw=String(p.payload||'');
   if(p.action!=='applicantIntake'||raw.length>18000)throw Error('Invalid applicant POST request.');
   r=saveApplicant_(JSON.parse(raw));
 }catch(err){r={ok:false,error:String(err.message||err).slice(0,220)}}
 const body=JSON.stringify({channel:'tipon-intake-v1',requestId:id,ok:!!r.ok,
   reference:r.ok?String(r.reference||''):'',error:r.ok?'':String(r.error||'Save failed')}).replace(/</g,'\\u003c');
 return HtmlService.createHtmlOutput('<!doctype html><html><body><script>window.parent.postMessage('+
   body+',"https://jericknoelsabang-hue.github.io");</script></body></html>')
   .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
