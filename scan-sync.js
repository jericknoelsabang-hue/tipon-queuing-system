/* TIPON TAWAG: transmit only preliminary OCR checklist outcomes, never images or OCR text.
 * Requires the updated Apps Script doPost(action=scanReport) deployment. */
(()=>{'use strict';
const $=id=>document.getElementById(id),C=window.TIPON_CONFIG||{};
let pending=null,epoch=0;
const endpoint=()=>new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||'';
const valid=url=>{try{const u=new URL(url);return u.origin==='https://script.google.com'&&u.pathname.endsWith('/exec')}catch{return false}};
function postScan(token,review){
 return new Promise((resolve,reject)=>{
  const url=endpoint();
  if(!valid(url))return reject(Error('Apps Script connection is unavailable.'));
  const requestId='scan_'+Date.now()+'_'+Math.random().toString(36).slice(2,12);
  const frame=document.createElement('iframe');frame.name=requestId;
  frame.title='Secure document scan summary submission';frame.style.cssText='display:none';
  document.body.appendChild(frame);
  let finished=false,form=null;
  const timer=setTimeout(()=>finish(Error('The scan database did not confirm the save.')),22000);
  function finish(error,data){
   if(finished)return;finished=true;clearTimeout(timer);
   window.removeEventListener('message',onMessage);if(form)form.remove();frame.remove();
   error?reject(error):resolve(data);
  }
  function onMessage(e){
   // Apps Script may sandbox the HTML response in a nested Google iframe.
   // Verify trusted Google origin and unpredictable request ID below.
   let host='';try{host=new URL(e.origin).hostname}catch{}
   if(host!=='script.google.com'&&host!=='googleusercontent.com'&&!host.endsWith('.googleusercontent.com'))return;
   const d=e.data||{};
   if(d.channel!=='tipon-scan-report-v1'||d.requestId!==requestId)return;
   if(d.ok)finish(null,d);else finish(Error(d.error||'Scan results were not saved.'));
  }
  window.addEventListener('message',onMessage);
  form=document.createElement('form');form.method='POST';form.action=url;form.target=requestId;form.style.display='none';
  const data={action:'scanReport',requestId,payload:JSON.stringify({token,consent:true,
    photoCount:review.photoCount,scannerAvailable:review.scannerAvailable,
    scannedAt:review.scannedAt,results:review.results})};
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
  photoCount:r.photoCount,scannerAvailable:r.scannerAvailable===true,scannedAt:new Date().toISOString()};
});
window.addEventListener('tipon:scan-reset',()=>{pending=null;epoch++});
window.addEventListener('tipon:ticket',async e=>{
 const {ticket,intakeToken}=e.detail||{};
 if(!ticket?.ticketId||!pending)return;
 const review=pending;pending=null;
 const ticketEpoch=epoch;
 const display=(kind,message)=>{
   if(epoch!==ticketEpoch)return;
   const el=$('scanSyncStatus');if(!el)return;
   el.dataset.state=kind;
   el.textContent=message;
   el.classList.remove('hide');
 };
 if(!intakeToken){
   display('error',
     'Not saved to Google Sheets. The Apps Script deployment does not yet support document-check synchronization. Please ask the recruiter to verify the originals.');
   return;
 }
 display('pending','Saving your preliminary document-check results to the recruitment database…');
 try{
   const res=await postScan(intakeToken,review);
   if(res.ok)display('saved',
     'Document-check results saved to Google Sheets for recruiter review. Bring the original documents.');
   else display('error',
     'The recruitment database did not confirm the save. Please show your documents to the recruiter.');
 }catch(error){
   display('error',
     'Document-check results were not saved to Google Sheets. The recruiter must check your original documents.');
 }
});
})();