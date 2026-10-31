/* TIPON TAWAG — conservative on-device OCR extraction; applicant confirmation required.
 * The full 145-column applicant database is maintained in Google Sheets. Missing
 * document information remains empty and is never invented by this extractor.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id),C=window.TIPON_CONFIG||{};
let discovered={},confirmed=false,scanOccurred=false;
const FIELD_PATTERNS=[
 ['Middle Name',/\b(?:MIDDLE NAME|MIDDLE INITIAL)\s*[:\-]\s*([A-Z][A-Z. '\-]{1,48})/i],
 ['Suffix',/\bSUFFIX\s*[:\-]\s*(JR\.?|SR\.?|III|IV|II)\b/i],
 ['Date of Birth',/\b(?:DATE OF BIRTH|BIRTH DATE|BIRTHDATE|DOB)\s*[:\-]\s*([A-Z0-9\/\- ,]{6,32})/i],
 ['Place of Birth (City/Province)',/\b(?:PLACE OF BIRTH|BIRTHPLACE)\s*[:\-]\s*([A-Z0-9., \-]{4,70})/i],
 ['Nationality',/\b(?:NATIONALITY|CITIZENSHIP)\s*[:\-]\s*([A-Z][A-Z \-]{3,35})/i],
 ['Gender',/\b(?:SEX|GENDER)\s*[:\-]\s*(FEMALE|MALE|F|M)\b/i],
 ['Civil Status',/\b(?:CIVIL STATUS|MARITAL STATUS)\s*[:\-]\s*(SINGLE|MARRIED|WIDOWED|SEPARATED)\b/i],
 ['SSS No.',/\b(?:SSS(?:\s+NO\.?|\s+NUMBER)?|SOCIAL SECURITY(?: SYSTEM)?(?:\s+NO\.?|\s+NUMBER)?)\s*[:#\- ]+\s*(\d{2}[\s-]?\d{7}[\s-]?\d)\b/i],
 ['PhilHealth No.',/\b(?:PHILHEALTH(?:\s+NO\.?|\s+NUMBER)?|PHILHEALTH ID|PIN)\s*[:#\- ]+\s*(\d{2}[\s-]?\d{9}[\s-]?\d)\b/i],
 ['Pag-IBIG No.',/\b(?:PAG[ -]?IBIG(?:\s+NO\.?|\s+MID|\s+NUMBER)?|HDMF(?:\s+MID)?|MID(?:\s+NO\.?)?)\s*[:#\- ]+\s*(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/i],
 ['TIN',/\b(?:TIN(?:\s+NO\.?|\s+NUMBER)?|TAXPAYER IDENTIFICATION(?:\s+NUMBER)?)\s*[:#\- ]+\s*(\d{3}[\s-]?\d{3}[\s-]?\d{3}(?:[\s-]?\d{3,5})?)\b/i],
 ['Email / Gmail Address',/\b(?:EMAIL(?:\s+ADDRESS)?|GMAIL(?:\s+ADDRESS)?)\s*[:\-]\s*([^\s,;<>]+@[^\s,;<>]+\.[A-Z]{2,})/i]
];
const LABELS=FIELD_PATTERNS.map(x=>x[0]);
function clean(v){return String(v||'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,160)}
function extract(texts){
 const out={};
 for(const line of texts.flatMap(raw=>String(raw||'').split(/\r?\n/))){
  const sanitized=clean(line);
  if(sanitized.length>220)continue;
  for(const [key,regexp] of FIELD_PATTERNS){
   if(out[key])continue;
   const m=sanitized.match(regexp);
   if(!m)continue;
   const value=clean(m[1]);
   if(value&&value.length>=1){
    out[key]=value;
   }
  }
 }
 return out;
}
function render(){
 const holder=$('applicantExtracted'),body=$('applicantFields');
 if(!scanOccurred){holder.classList.add('hide');return}
 holder.classList.remove('hide');
 body.innerHTML=LABELS.map((key,i)=>
  '<label for="ocr_field_'+i+'">'+key.replace(/&/g,'&amp;')+
  '<input id="ocr_field_'+i+'" data-db-field="'+key+'" autocomplete="off" maxlength="160" value="'+
  String(discovered[key]||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+
  '" placeholder="Not detected — leave blank"></label>').join('');
 $('applicantFieldsConfirmed').checked=false;confirmed=false;
 $('applicantSyncStatus').textContent='Review each field and confirm. Only your confirmed information can be sent to the recruitment database after a queue number is issued.';
}
function current(){
 const values={};
 for(const el of document.querySelectorAll('#applicantFields [data-db-field]')){
  const value=clean(el.value);if(value)values[el.dataset.dbField]=value;
 }
 return {fields:values,confirmed:confirmed&&scanOccurred,consent:$('privacyAgree')?.checked===true};
}
function reset(){
 discovered={};confirmed=false;scanOccurred=false;
 $('applicantFieldsConfirmed').checked=false;
 $('applicantExtracted').classList.add('hide');
}
function validApi(url){try{const u=new URL(url);return u.origin==='https://script.google.com'&&u.pathname.endsWith('/exec')}catch{return false}}
const endpoint=()=>new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||'';
function submit(token,fields){
 return new Promise((resolve,reject)=>{
  if(!validApi(endpoint()))return reject(Error('Apps Script endpoint not configured.'));
  const requestId='intake_'+Date.now()+'_'+Math.random().toString(36).slice(2,12);
  const frame=document.createElement('iframe');frame.name=requestId;frame.title='Private applicant data submission';frame.style.display='none';
  document.body.appendChild(frame);
  let complete=false;
  function end(err,data){if(complete)return;complete=true;clearTimeout(timer);
   window.removeEventListener('message',onMessage);form.remove();frame.remove();
   err?reject(err):resolve(data);
  }
  function onMessage(ev){
   if(ev.source!==frame.contentWindow)return;
   let host='';try{host=new URL(ev.origin).hostname}catch{}
   if(host!=='script.google.com'&&host!=='googleusercontent.com'&&!host.endsWith('.googleusercontent.com'))return;
   const d=ev.data||{};
   if(d.channel!=='tipon-intake-v1'||d.requestId!==requestId)return;
   if(d.ok)end(null,d);else end(Error(d.error||'Applicant record could not be saved.'));
  }
  window.addEventListener('message',onMessage);
  const timer=setTimeout(()=>end(Error('No applicant database confirmation received from Apps Script.')),25000);
  const form=document.createElement('form');form.action=endpoint();form.method='POST';form.target=requestId;form.style.display='none';
  const fieldsToPost={action:'applicantIntake',requestId,payload:JSON.stringify({token,fields,confirmed:true,consent:true})};
  for(const [key,val] of Object.entries(fieldsToPost)){
   const item=document.createElement('input');item.type='hidden';item.name=key;item.value=val;form.appendChild(item);
  }
  document.body.appendChild(form);form.submit();
 });
}
function init(){
 $('applicantFieldsConfirmed').addEventListener('change',e=>{confirmed=e.target.checked});
 window.addEventListener('tipon:ocr-ready',e=>{
  const texts=Array.isArray(e.detail?.texts)?e.detail.texts:[];
  discovered=extract(texts);scanOccurred=true;render();
 });
 $('another').addEventListener('click',reset);
 $('scanYes').addEventListener('change',reset);
 $('scanNo').addEventListener('change',reset);
 window.addEventListener('tipon:ticket',async e=>{
  const ticket=e.detail?.ticket,token=e.detail?.intakeToken;
  if(!ticket?.ticketId||!scanOccurred)return;
  const data=current();
  const notice=$('receiptText');
  if(!data.confirmed||!data.consent){
   notice.textContent+=' Applicant details were not confirmed for database submission.';
   return;
  }
  if(!token){
   notice.textContent+=' Applicant document details were not saved to Google Sheets because the current Apps Script deployment does not support secure intake yet.';
   return;
  }
  try{
   const result=await submit(token,data.fields);
   notice.textContent+=' Applicant information saved to the recruitment database: '+result.reference+'.';
  }catch(error){
   notice.textContent+=' Applicant database sync needs recruiter follow-up: '+String(error.message||error)+'.';
  }
 });
 window.TIPON_APPLICANT_REVIEW={current,extract};
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();