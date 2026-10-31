/* TIPON TAWAG - optional applicant document pre-screening. No paid API. */
(()=>{'use strict';
const $=id=>document.getElementById(id),C=window.TIPON_CONFIG||{};
const state={requirements:[],photos:new Map(),scans:[],consent:false,decision:null};
const api=()=>new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||'';
let serial=0;
function jsonp(action,params={}){return new Promise((resolve,reject)=>{const u=api();if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(u))return reject(Error('Backend unavailable'));
const cb='__req_'+Date.now()+'_'+(++serial),s=document.createElement('script');let done=false;const t=setTimeout(()=>finish(Error('Server timeout')),18000);
function finish(e,r){if(done)return;done=true;clearTimeout(t);delete window[cb];s.remove();e?reject(e):resolve(r)}
window[cb]=r=>finish(null,r);s.onerror=()=>finish(Error('Unable to reach server'));const x=new URL(u);x.searchParams.set('action',action);x.searchParams.set('callback',cb);for(const [k,v] of Object.entries(params))x.searchParams.set(k,String(v??''));s.src=x.href;document.head.append(s);});}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=x=>String(x||'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function applicable(){const tx=$('transaction').value;return state.requirements.filter(r=>r.transaction==='ALL'||r.transaction===tx);}
async function reload(){try{const r=await jsonp('requirements');if(r.ok)state.requirements=r.requirements||[];else throw Error(r.error);}catch(e){state.requirements=[];$('scanNotice').textContent='Requirements unavailable. Queue registration remains available.'}}
function showDecision(){const recruitment=$('chooseRecruitment').classList.contains('chosen');$('scanDecision').classList.toggle('hide',!recruitment);$('scanBox').classList.toggle('hide',!recruitment||state.decision!=='yes');}
function reset(){state.photos.clear();state.scans=[];state.decision=null;state.consent=false;$('scanYes').checked=false;$('scanNo').checked=true;$('privacyAgree').checked=false;$('scanBox').classList.add('hide');$('scanPreview').innerHTML='';$('scanReport').innerHTML='';$('scanNotice').textContent='';showDecision();}
function slots(){const requirements=applicable();$('scanPreview').innerHTML=requirements.length?requirements.map(r=>'<div class="req-slot"><div><b>'+esc(r.name)+'</b> <small>'+esc(r.required?'Required':'Optional')+'</small></div><label class="btn ghost req-photo-label">Take / Upload Photo<input type="file" accept="image/*" capture="environment" data-requirement="'+esc(r.id)+'" hidden></label><span data-image-status="'+esc(r.id)+'">No image</span></div>').join(''):'<p>No pre-employment requirements have been configured for this transaction. You can proceed to queue.</p>';}
async function analyze(){const list=applicable();const btn=$('scanAnalyze');btn.disabled=true;btn.textContent='ANALYZING...';
try{const results=[];for(const r of list){const f=state.photos.get(r.id);if(!f){results.push({id:r.id,name:r.name,status:'MISSING',photo:false,at:new Date().toISOString()});continue;}
results.push({id:r.id,name:r.name,status:'FOR_RECRUITER_REVIEW',photo:true,at:new Date().toISOString()});}
state.scans=results;
$('scanReport').innerHTML='<h3>Preliminary requirements check</h3><p>Photos are recorded locally for this session. No authenticity or OCR validation has been performed. A recruiter must inspect the original documents.</p>'+results.map(r=>'<p><b>'+esc(r.name)+'</b>: '+(r.photo?'Photo captured — for recruiter review':'Missing')+'</p>').join('')+'<p><b>Proceed to generate your queue number below.</b></p>';
$('scanReport').classList.remove('hide');$('scanNotice').textContent='Photo collection completed. This pilot does not upload images or use a paid AI API.';
}catch(e){$('scanNotice').textContent=e.message;}finally{btn.disabled=false;btn.textContent='CONFIRM & ANALYZE';}}
function init(){const decision=$('scanDecision');if(!decision)return;
$('scanYes').onchange=()=>{state.decision='yes';$('scanBox').classList.remove('hide');slots();};
$('scanNo').onchange=()=>{state.decision='no';$('scanBox').classList.add('hide');state.scans=[];};
$('privacyAgree').onchange=()=>{state.consent=$('privacyAgree').checked;$('scanControls').classList.toggle('hide',!state.consent);};
$('scanPreview').addEventListener('change',e=>{const input=e.target.closest('[data-requirement]');if(!input)return;const file=input.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){alert('Choose an image file.');return}if(file.size>8e6){alert('Image too large. Maximum 8 MB.');return;}state.photos.set(input.dataset.requirement,file);const span=$('scanPreview').querySelector('[data-image-status="'+CSS.escape(input.dataset.requirement)+'"]');if(span)span.textContent='Captured: '+file.name;state.scans=[];$('scanReport').classList.add('hide');});
$('scanAnalyze').onclick=()=>{if(!state.consent){$('scanNotice').textContent='Agree to the privacy notice to continue.';return;}analyze();};
$('transaction').addEventListener('change',()=>{state.photos.clear();state.scans=[];slots();});
document.querySelectorAll('#chooseRecruitment,#chooseMember').forEach(b=>b.addEventListener('click',showDecision));
$('another').addEventListener('click',reset);
$('queueForm').addEventListener('submit',async()=>{if(state.decision!=='yes'||!state.scans.length)return;
const original=$('firstName').value.trim().toUpperCase()+' '+$('lastName').value.trim().toUpperCase();
for(let i=0;i<30;i++){if(!$('receipt').classList.contains('hide'))break;await new Promise(r=>setTimeout(r,100));}
if($('receipt').classList.contains('hide'))return;
const ticketId=''; // Registration response is captured by legacy form; do not guess server identifiers.
$('scanNotice').textContent='Photos were handled in browser memory only. Recruiter review is still required.';
});void reload();showDecision();}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();