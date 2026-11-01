/* TIPON TAWAG - mobile-first, opt-in camera capture with on-device OCR preview. */
/* Applicant images and OCR text stay in volatile browser memory, never in URLs or public Sheets. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const C=window.TIPON_CONFIG||{};
let seq=0, service='recruitment',decision='no',consent=false;
let photos=[],requirements=[],captureStream=null,reviewReady=false,reviewBusy=false;
let configAvailable=false,worker=null,workerLoading=null;
const api=()=>new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const norm=v=>String(v||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036F]/g,'').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
function jsonp(action,params={}){return new Promise((resolve,reject)=>{
 const raw=api();let u;try{u=new URL(raw);if(u.origin!=='https://script.google.com'||!u.pathname.endsWith('/exec'))throw Error('Bad URL')}catch{return reject(Error('Queue backend URL not configured'))}
 const cb='__tipon_req_'+Date.now()+'_'+(++seq),node=document.createElement('script');let done=false;
 const timer=setTimeout(()=>finish(Error('Backend did not respond')),13000);
 function finish(error,value){if(done)return;done=true;clearTimeout(timer);delete window[cb];node.remove();error?reject(error):resolve(value)}
 window[cb]=data=>finish(null,data);node.onerror=()=>finish(Error('Cannot connect to requirements backend'));
 u.searchParams.set('action',action);u.searchParams.set('callback',cb);
 for(const [k,v] of Object.entries(params))u.searchParams.set(k,String(v??''));
 node.src=u.href;document.head.appendChild(node);
})}
function renderExpected(){
 const active=applicable();
 $('scanExpectedList').innerHTML=active.map(r=>'<span class="scan-expected-chip">'+esc(r.name)+'</span>').join('');
}
function matchesTx(r,tx){
 if(Array.isArray(r.transactions))return r.transactions.includes('ALL')||r.transactions.includes(tx);
 const old=String(r.transaction||'ALL');if(old==='ALL'||old===tx)return true;
 try{const list=JSON.parse(old);return Array.isArray(list)&&list.includes(tx)}catch{}
 return old.split(/[;,|]/).map(s=>s.trim()).includes(tx);
}
function applicable(){const tx=$('transaction').value;return requirements.filter(r=>matchesTx(r,tx))}
function detailsComplete(){
 return service==='recruitment'&&Boolean(
   $('firstName').value.trim()&&$('lastName').value.trim()&&
   $('transaction').value.trim()&&$('position').value.trim());
}
function syncEntryState(){
 const allowed=detailsComplete();
 $('scanYes').disabled=!allowed;
 $('scanYesLabel').classList.toggle('scan-opt-disabled',!allowed);
 $('scanEntryHint').classList.toggle('hide',allowed||service!=='recruitment');
 if(!allowed&&decision==='yes'){
   // A previously consented capture must not be reused for a different applicant.
   reset();
 }
 updateSubmit();
}
function note(text){$('scanNotice').textContent=text}
function updateSubmit(){
 const isRecruitment=service==='recruitment';
 const show=!isRecruitment||decision==='no'||(decision==='yes'&&detailsComplete()&&consent&&reviewReady&&$('applicantFieldsConfirmed')?.checked===true);
 $('submit').classList.toggle('hide',!show);
 if(show)$('submit').textContent='GET QUEUE NUMBER';
 $('scanDecision').classList.toggle('hide',!isRecruitment);
 $('scanBox').classList.toggle('hide',!isRecruitment||decision!=='yes'||!detailsComplete());
 $('scanControls').classList.toggle('hide',!consent);
}
function invalidateReview(){
 reviewReady=false;$('scanReport').classList.add('hide');$('scanProgress').classList.add('hide');
 if($('applicantFieldsConfirmed'))$('applicantFieldsConfirmed').checked=false;
 window.dispatchEvent(new CustomEvent('tipon:scan-reset'));
 updateSubmit();
}
function setService(){
 const next=$('chooseRecruitment').classList.contains('chosen')?'recruitment':'member';
 if(next!==service){
   closeCamera();
   photos.forEach(p=>URL.revokeObjectURL(p.url));photos=[];
   decision='no';consent=false;$('scanNo').checked=true;$('scanYes').checked=false;
   $('privacyAgree').checked=false;invalidateReview();renderGallery();
 }
 service=next;syncEntryState();
}
function clearPhotos(){
 closeCamera();photos.forEach(p=>URL.revokeObjectURL(p.url));photos=[];
 renderGallery();invalidateReview();note('');
}
function reset(){
 clearPhotos();decision='no';consent=false;$('scanNo').checked=true;$('scanYes').checked=false;
 $('privacyAgree').checked=false;window.dispatchEvent(new CustomEvent('tipon:scan-reset'));updateSubmit();
}
function renderGallery(){
 $('scanPhotoCount').textContent=photos.length+' photo'+(photos.length===1?'':'s')+' captured';
 $('scanPhotoSub').textContent=photos.length?'Review the photos below. Remove and retake blurry images.':'Add all document photos before reviewing.';
 $('scanGallery').innerHTML=photos.map((p,i)=>'<div class="scan-photo-card"><img src="'+esc(p.url)+'" alt="Requirement photo '+(i+1)+'"><div class="scan-photo-indicator" data-photo-indicator="'+esc(p.id)+'">READY</div><progress class="scan-photo-progress" data-photo-progress="'+esc(p.id)+'" max="100" value="0" aria-label="Document processing progress"></progress><div class="scan-card-footer"><span>PHOTO '+(i+1)+'</span><button class="scan-remove" type="button" data-remove="'+esc(p.id)+'" aria-label="Remove photo '+(i+1)+'">Remove</button></div></div>').join('');
 $('scanReview').classList.toggle('hide',photos.length===0);
}
function closeCamera(){
 if(captureStream){for(const track of captureStream.getTracks())track.stop();captureStream=null}
 $('scanVideo').pause();$('scanVideo').srcObject=null;$('scanCamera').classList.add('hide');
 document.body.style.overflow='';
}
async function openCamera(){
 if(!detailsComplete()){note('Complete your name, recruitment transaction and position before opening the document camera.');return}
 if(!consent){note('Please check the privacy consent box before opening the camera.');return}
 $('scanCamera').classList.remove('hide');document.body.style.overflow='hidden';
 $('scanCameraStatus').textContent='Opening your camera…';
 $('scanShot').disabled=true;
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
   $('scanCameraStatus').textContent='Live camera is unavailable on this device. Use Phone Camera to capture one photo at a time.';
   return;
 }
 try{
   captureStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});
   $('scanVideo').srcObject=captureStream;await $('scanVideo').play();
   $('scanShot').disabled=false;
   $('scanCameraStatus').textContent='Tap Capture Photo as many times as you need. Then tap Done Taking Photos.';
 }catch(e){
   closeCamera();$('scanCamera').classList.remove('hide');document.body.style.overflow='hidden';
   $('scanCameraStatus').textContent='Camera unavailable or permission denied. Use Phone Camera below to capture photos.';
 }
}
function canvasToBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not save this picture')),'image/jpeg',.87))}
async function normalizeImage(file){
 if(!file||!file.type.startsWith('image/'))throw Error('Please choose a photo of a document.');
 // Keep a readable high-resolution image while avoiding full-sized phone originals.
 try{
   const bitmap=await createImageBitmap(file);
   const max=2050,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
   const canvas=$('scanCanvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
   return await canvasToBlob(canvas);
 }catch(e){return file}
}
async function addPhoto(blob){
 if(!blob||!blob.size)throw Error('Blank picture. Please try again.');
 const src=await normalizeImage(blob);
 const id=(window.crypto&&crypto.randomUUID?crypto.randomUUID():'p'+Date.now().toString(36)+Math.random().toString(36).slice(2));
 photos.push({id,blob:src,url:URL.createObjectURL(src)});
 invalidateReview();renderGallery();
 $('scanCameraStatus').textContent=photos.length+' photo'+(photos.length===1?'':'s')+' captured. Continue capturing or select Done.';
 if(navigator.vibrate)try{navigator.vibrate(35)}catch{}
}
async function shutter(){
 const v=$('scanVideo');if(!v.videoWidth||!v.videoHeight){$('scanCameraStatus').textContent='Camera is not ready. Try again.';return}
 const btn=$('scanShot');btn.disabled=true;
 try{
   const canvas=$('scanCanvas'),max=2050,scale=Math.min(1,max/Math.max(v.videoWidth,v.videoHeight));
   canvas.width=Math.round(v.videoWidth*scale);canvas.height=Math.round(v.videoHeight*scale);
   canvas.getContext('2d').drawImage(v,0,0,canvas.width,canvas.height);
   const blob=await canvasToBlob(canvas);
   // Camera images are already compressed; keep a single copy.
   const id=(window.crypto&&crypto.randomUUID?crypto.randomUUID():'p'+Date.now().toString(36)+Math.random().toString(36).slice(2));
   photos.push({id,blob,url:URL.createObjectURL(blob)});invalidateReview();renderGallery();
   $('scanCameraStatus').textContent=photos.length+' captured. Tap Capture Photo for the next page.';
 }catch(e){$('scanCameraStatus').textContent='Capture failed: '+e.message}
 finally{btn.disabled=false}
}
function loadTesseract(){if(window.Tesseract)return Promise.resolve(window.Tesseract);
 if(workerLoading)return workerLoading;
 workerLoading=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js';
   script.crossOrigin='anonymous';script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(Error('OCR library unavailable'));
   script.onerror=()=>reject(Error('OCR could not download on this connection'));document.head.appendChild(script);
 }).catch(e=>{workerLoading=null;throw e});return workerLoading;
}
function termMatch(text,term){
 const t=norm(term);if(t.length<3)return false;
 return (' '+text+' ').includes(' '+t+' ');
}
function assess(readings,req){
 // Match configured search terms against each captured photo independently.
 // A possible match is NOT proof of document validity or authenticity.
 const terms=[...new Set([String(req.name||''),...String(req.keywords||req.name||'').split(/[,;\n]/)].map(x=>x.trim()).filter(x=>norm(x).length>=3))];
 if(!readings.length)return {status:'FOR_RECRUITER_REVIEW',detail:'No readable text. Retake the document or have a recruiter inspect it.',photo:0};
 let best={hits:[],photo:0};
 for(const entry of readings){
   const normalized=norm(entry.text);
   const found=terms.filter(term=>termMatch(normalized,term)).sort((a,b)=>norm(b).length-norm(a).length);
   // Do not count 'NBI' and 'NBI Clearance' as two independent clues.
   const independent=[];
   for(const term of found){
     if(!independent.some(other=>norm(other).includes(norm(term))))independent.push(term);
   }
   if(independent.length>best.hits.length)best={hits:independent,photo:entry.photo};
 }
 const evidence=best.hits.slice(0,3).join(', ');
 const evidenceText=best.photo?'Photo '+best.photo+' — ':'';
 if(best.hits.length>=2)
   return {status:'POSSIBLE_MATCH',photo:best.photo,detail:evidenceText+'recognition clues: '+evidence+'. Original document still needs recruiter verification.'};
 if(best.hits.length===1)
   return {status:'FOR_RECRUITER_REVIEW',photo:best.photo,detail:evidenceText+'only one recognition clue found ('+evidence+'). Please verify with the recruiter.'};
 return {status:'NOT_DETECTED',photo:0,detail:'No matching recognition terms detected. Retake the document or show the original to a recruiter.'};
}
function photoProgress(index,label,percent){
 const p=photos[index];if(!p)return;
 const indicator=document.querySelector('[data-photo-indicator="'+p.id+'"]');
 const progress=document.querySelector('[data-photo-progress="'+p.id+'"]');
 if(indicator)indicator.textContent=label;
 if(progress)progress.value=percent;
}
function progress(message,index,total){
 $('scanProgress').classList.remove('hide');
 const pct=total?Math.round(100*index/total):0;
 $('scanProgress').innerHTML='<div>'+esc(message)+'</div><progress max="100" value="'+pct+'"></progress><div>'+pct+'% complete</div>';
}
async function review(){
 if(reviewBusy||!photos.length)return;
 reviewBusy=true;reviewReady=false;updateSubmit();
 const btn=$('scanReview');btn.disabled=true;btn.textContent='SCANNING DOCUMENTS…';
 let readings=[],scannerAvailable=true,scannerError='';
 try{
   progress('Preparing on-device text recognition…',0,photos.length);
   const t=await loadTesseract();
   worker=await t.createWorker('eng');
   for(let i=0;i<photos.length;i++){
     progress('Reading document '+(i+1)+' of '+photos.length+'…',i,photos.length);photoProgress(i,'SCANNING',22);
     try{const result=await worker.recognize(photos[i].blob);const text=String(result&&result.data&&result.data.text||'').trim();if(text)readings.push({text,photo:i+1});photoProgress(i,text?'TEXT READ':'NO TEXT',100)}
     catch(e){photoProgress(i,'REVIEW',100);scannerError='Some photos could not be read. Retake blurry pages if needed.'}
     progress('Processed '+(i+1)+' of '+photos.length+' photos.',i+1,photos.length);
   }
 }catch(e){scannerAvailable=false;scannerError=String(e.message||e);photos.forEach((p,i)=>photoProgress(i,'MANUAL REVIEW',0))}
 finally{if(worker){try{await worker.terminate()}catch{}worker=null}}
 const items=applicable();const reviewed=items.map(req=>({name:req.name,...(scannerAvailable?assess(readings,req):{status:'FOR_RECRUITER_REVIEW',detail:'Scanner unavailable; recruiter must check the originals.'})}));
 const pct=items.length?reviewed.filter(x=>x.status==='POSSIBLE_MATCH').length+'/'+items.length:'No configured list';
 $('scanReport').innerHTML='<h3>Document Pre-Screening Result</h3><p><strong>'+photos.length+' photo'+(photos.length===1?'':'s')+' reviewed</strong> · '+esc(pct)+' possible requirement matches.</p>'+
 (items.length?reviewed.map(r=>'<div class="scan-review-line"><b>'+esc(r.name)+'</b> — '+(r.status==='POSSIBLE_MATCH'?'Possible match':r.status==='NOT_DETECTED'?'Not detected':'Recruiter review needed')+'<br><span>'+esc(r.detail)+'</span></div>').join(''):
 '<p>No recruitment requirement list is available from the backend. Document count only; no completeness decision can be made.</p>')+
 '<p><strong>Important:</strong> This is only preliminary on-device OCR. It does not verify authenticity, expiration or applicant eligibility. Keep your documents for the recruiter. No document photo or extracted personal data was uploaded.</p>'+
 (scannerError?'<p><b>Scanner note:</b> '+esc(scannerError)+'</p>':'')+
 '<p>You may now get your queue number.</p>';
 $('scanReport').classList.remove('hide');$('scanProgress').classList.add('hide');
 window.dispatchEvent(new CustomEvent('tipon:ocr-ready',{detail:{texts:readings.map(item=>item.text)}}));
 readings=[]; // Do not retain OCR text beyond this assessment.
 reviewReady=true;reviewBusy=false;btn.disabled=false;btn.textContent='CHECK CAPTURED DOCUMENTS';
 updateSubmit();
}
const DEMO_TERMS={
 'SSS':'SSS, Social Security System, SSS Number, E-1',
 'PAG-IBIG':'Pag-IBIG Fund, Home Development Mutual Fund, HDMF, Member Data Form, MDF',
 'PHILHEALTH':'PhilHealth, Philippine Health Insurance Corporation, Member Data Record, MDR',
 'NBI':'NBI, National Bureau of Investigation, Multi-Purpose Clearance',
 'BIRTH CERTIFICATE':'Birth Certificate, Certificate of Live Birth, PSA, Philippine Statistics Authority',
 'TIN':'TIN, Taxpayer Identification Number, Bureau of Internal Revenue, BIR',
 'NBI CLEARANCE':'NBI Clearance, National Bureau of Investigation, Multi-Purpose Clearance, NBI'
};
async function refreshRequirements(){
 let source='LIVE';
 try{
   const res=await jsonp('requirements');
   if(!res.ok)throw Error(res.error||'Backend configuration unavailable');
   requirements=Array.isArray(res.requirements)?res.requirements:[];
 }catch(e){
   source='PUBLIC TEST SNAPSHOT';
   try{
     const response=await fetch('requirements-fallback.json',{cache:'no-store'});
     if(!response.ok)throw Error('No static requirements');
     const data=await response.json();
     requirements=Array.isArray(data.requirements)?data.requirements:[];
   }catch{requirements=[]}
 }
 // Demo changes are visible only to the recruiter on this same browser.
 try{
   const edited=JSON.parse(localStorage.getItem('tqLocalReqDemoV1')||'null');
   if(Array.isArray(edited)){requirements=edited;source='LOCAL BROWSER DEMO'}
 }catch{}
 requirements=requirements.map(r=>({...r,keywords:(source==='PUBLIC TEST SNAPSHOT'&&r.keywords===r.name&&DEMO_TERMS[String(r.name).toUpperCase()])||r.keywords||r.name}));
 $('scanConfigMessage').textContent=requirements.length?
   (source==='LIVE'?'Required documents for your selected transaction: ':'Document checklist for this transaction (trial): ')+applicable().length+' item(s). Photos are scanned on this device only.':
   'The recruiter has not configured a checklist for this transaction. You can still capture photos for review.';
 renderExpected();
}
function init(){
 if(!$('scanDecision'))return;
 $('scanYes').addEventListener('change',()=>{
   if(!detailsComplete()){
     $('scanYes').checked=false;$('scanNo').checked=true;decision='no';syncEntryState();
     const field=['firstName','lastName','position'].map(id=>$(id)).find(el=>!el.value.trim());
     (field||$('transaction')).focus();
     return;
   }
   decision='yes';consent=$('privacyAgree').checked;reviewReady=false;
   updateSubmit();void refreshRequirements();
 });
 $('scanNo').addEventListener('change',()=>{
   decision='no';clearPhotos();consent=false;$('privacyAgree').checked=false;updateSubmit();
 });
 $('privacyAgree').addEventListener('change',()=>{consent=$('privacyAgree').checked;if(!consent)invalidateReview();updateSubmit()});
 $('scanStart').addEventListener('click',openCamera);
 $('scanShot').addEventListener('click',shutter);
 $('scanFinish').addEventListener('click',closeCamera);
 $('scanClose').addEventListener('click',closeCamera);
 $('scanFallbackButton').addEventListener('click',()=>$('scanFallback').click());
 $('scanFallback').addEventListener('change',async event=>{
   const f=event.target.files&&event.target.files[0];if(!f)return;
   try{await addPhoto(f)}catch(e){$('scanCameraStatus').textContent=e.message}finally{event.target.value=''}
 });
 $('scanGallery').addEventListener('click',e=>{
   const btn=e.target.closest('[data-remove]');if(!btn)return;
   const i=photos.findIndex(p=>p.id===btn.dataset.remove);
   if(i<0)return;URL.revokeObjectURL(photos[i].url);photos.splice(i,1);
   renderGallery();invalidateReview();
 });
 $('scanReview').addEventListener('click',review);
 $('applicantFieldsConfirmed').addEventListener('change',updateSubmit);
 // Any applicant identity, position, or transaction change invalidates a previous scan.
 for(const id of ['firstName','lastName','position']){
   $(id).addEventListener('input',()=>{
     if(decision==='yes'&&(consent||photos.length||reviewReady))reset();
     syncEntryState();
   });
 }
 $('transaction').addEventListener('change',()=>{
   if(decision==='yes')reset();else clearPhotos();
   syncEntryState();void refreshRequirements();
 });
 for(const btn of [$('chooseRecruitment'),$('chooseMember')])btn.addEventListener('click',setService);
 $('another').addEventListener('click',reset);
 $('queueForm').addEventListener('submit',e=>{
   if(service==='recruitment'&&decision==='yes'&&(!detailsComplete()||!reviewReady||!$('applicantFieldsConfirmed').checked)){
     e.preventDefault();e.stopImmediatePropagation();
     note('Capture your documents and run the document check before requesting your queue number.');
     $('scanBox').scrollIntoView({behavior:'smooth',block:'center'});
   }
 },true);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)closeCamera()});
 window.addEventListener('pagehide',()=>{closeCamera();photos.forEach(p=>URL.revokeObjectURL(p.url))});
 renderGallery();syncEntryState();void refreshRequirements();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();