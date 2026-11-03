/* TIPON TAWAG: ticket-bound scan summary and applicant-detail sync through Apps Script POST. */
(()=>{'use strict';
const $=id=>document.getElementById(id),C=window.TIPON_CONFIG||{};
let pending=null,epoch=0;
const endpoint=()=>new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||'';
const valid=url=>{try{const u=new URL(url);return u.origin==='https://script.google.com'&&u.pathname.endsWith('/exec')}catch{return false}};
function post(action,token,payload){
 return new Promise((resolve,reject)=>{
  const url=endpoint();
  if(!valid(url))return reject(Error('Apps Script connection is unavailable.'));
  const requestId='scan_'+Date.now()+'_'+Math.random().toString(36).slice(2,12);
  const frame=document.createElement('iframe');frame.name=requestId;frame.title='Secure recruitment record submission';frame.style.cssText='display:none';
  document.body.appendChild(frame);
  let finished=false,form=null;
  const timer=setTimeout(()=>finish(Error('The recruitment database did not confirm the save.')),22000);
  function finish(error,data){
   if(finished)return;finished=true;clearTimeout(timer);
   window.removeEventListener('message',onMessage);if(form)form.remove();frame.remove();
   error?reject(error):resolve(data);
  }
  function onMessage(e){
   let host='';try{host=new URL(e.origin).hostname}catch{}
   if(host!=='script.google.com'&&host!=='googleusercontent.com'&&!host.endsWith('.googleusercontent.com'))return;
   const d=e.data||{},channel=action==='scanReport'?'tipon-scan-report-v1':'tipon-intake-v1';
   if(d.channel!==channel||d.requestId!==requestId)return;
   if(d.ok)finish(null,d);else finish(Error(d.error||'Recruitment data was not saved.'));
  }
  window.addEventListener('message',onMessage);
  form=document.createElement('form');form.method='POST';form.action=url;form.target=requestId;form.style.display='none';
  const data={action,requestId,payload:JSON.stringify(payload)};
  for(const [key,value] of Object.entries(data)){
   const el=document.createElement('input');el.type='hidden';el.name=key;el.value=value;form.appendChild(el);
  }
  document.body.appendChild(form);form.submit();
 });
}
window.addEventListener('tipon:scan-reviewed',e=>{
 const r=e.detail||{};
 if(!Array.isArray(r.results)||!Number.isFinite(r.photoCount))return;
 pending={results:r.results.map(x=>({id:String(x.id||''),name:String(x.name||''),status:String(x.status||'FOR_RECRUITER_REVIEW')})),
  photoCount:r.photoCount,scannerAvailable:r.scannerAvailable===true,applicantFields:r.applicantFields&&typeof r.applicantFields==='object'?r.applicantFields:{},scannedAt:new Date().toISOString()};
});
function clearSyncStatus(){
 const target=$('scanSyncStatus');if(!target)return;
 target.classList.add('hide');target.textContent='';delete target.dataset.state;
}
window.addEventListener('tipon:scan-reset',()=>{pending=null;epoch++;clearSyncStatus()});
window.addEventListener('tipon:ticket',async e=>{
 const {ticket,intakeToken}=e.detail||{};
 clearSyncStatus();
 if(!ticket?.ticketId||!pending)return;
 const review=pending;pending=null;const ticketEpoch=epoch;
 const display=(kind,message)=>{
  if(epoch!==ticketEpoch)return;
  const el=$('scanSyncStatus');if(!el)return;
  el.dataset.state=kind;el.textContent=message;el.classList.remove('hide');
 };
 if(!intakeToken){display('error','Not saved. Apps Script needs the latest scan and applicant-intake deployment. Please ask the recruiter to verify your documents.');return}
 const fields=review.applicantFields;
 display('pending','Saving document-check results and applicant details…');
 const scanPayload={token:intakeToken,consent:true,photoCount:review.photoCount,scannerAvailable:review.scannerAvailable,
  scannedAt:review.scannedAt,results:review.results};
 const intakePayload={token:intakeToken,consent:true,fields};
 const results=await Promise.allSettled([
  post('scanReport',intakeToken,scanPayload),
  post('applicantIntake',intakeToken,intakePayload)
 ]);
 const scanOk=results[0].status==='fulfilled'&&results[0].value.ok;
 const intakeOk=results[1].status==='fulfilled'&&results[1].value.ok;
 if(scanOk&&intakeOk){
  const ref=results[1].value.reference;
  display('saved','Document pre-screening results and applicant details were saved. Applicant Reference No.: '+ref+'. Bring the original documents for recruiter verification.');
 }else if(scanOk||intakeOk){
  display('error','Part of the record was saved, but the database did not confirm both updates. Ask the recruiter to check REQUIREMENT_SCANS and APPLICANT DATABASE.');
 }else{
  display('error','The recruitment database did not confirm the save. Ask the recruiter to check REQUIREMENT_SCANS and APPLICANT DATABASE and inspect your original documents.');
 }
});
})();