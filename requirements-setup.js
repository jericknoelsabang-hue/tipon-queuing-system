/* TIPON requirement configuration - recruiter-authorized, no defaults */
(()=>{'use strict';
const $=id=>document.getElementById(id),C=window.TIPON_CONFIG||{},esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let requirements=[],editing='',seq=0,loading=false;
const api=()=>new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||'';
function jp(action,p={}){return new Promise((resolve,reject)=>{if(!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(api()))return reject(Error('Configure the Apps Script connection first.'));
const cb='__reqSetup'+Date.now()+(++seq),s=document.createElement('script');let finished=false;const timer=setTimeout(()=>done(Error('Backend timeout')),17000);
function done(e,r){if(finished)return;finished=true;clearTimeout(timer);delete window[cb];s.remove();e?reject(e):resolve(r)}
window[cb]=r=>done(null,r);s.onerror=()=>done(Error('Cannot connect'));const u=new URL(api());u.searchParams.set('action',action);u.searchParams.set('callback',cb);Object.entries(p).forEach(([k,v])=>u.searchParams.set(k,String(v??'')));s.src=u.href;document.head.appendChild(s);});}
function status(s){$('reqStatus').textContent=s}
function suggest(name){const label=String(name||'').trim();if(!label)return'';
const words=label.split(/\s+/).filter(w=>w.length>=2&&!['THE','AND','FOR','WITH','FROM','YOUR'].includes(w.toUpperCase()));
return [...new Set([label,...words])].join(', ');}
async function loadTransactions(){
 try{
  const r=await jp('publicConfig');if(!r.ok)throw Error(r.error||'Unable to load transactions.');
  const current=$('reqTx').value;
  const txs=(r.transactions||r.state?.transactions||[]).filter(t=>t.code!=='MC'&&t.active!==false);
  const select=$('reqTx');select.textContent='';
  const all=document.createElement('option');all.value='ALL';all.textContent='All Recruitment Transactions';select.appendChild(all);
  for(const tx of txs){const o=document.createElement('option');o.value=tx.code;o.textContent=tx.name+' ('+tx.code+')';select.appendChild(o);}
  if([...select.options].some(o=>o.value===current))select.value=current;
 }catch(e){status('Cannot refresh recruitment transaction options: '+e.message);}
}
function render(){const body=$('reqRows');body.innerHTML=requirements.length?requirements.map(r=>'<tr><td><b>'+esc(r.name)+'</b></td><td>'+esc(r.transaction==='ALL'?'All recruitment':r.transaction)+'</td><td>'+esc(r.required?'Required':'Optional')+'</td><td>'+esc(r.keywords)+'</td><td><button class="btn sm" data-edit="'+esc(r.id)+'">Edit</button> <button class="btn sm danger" data-remove="'+esc(r.id)+'">Delete</button></td></tr>').join(''):'<tr><td colspan="5" class="empty">No requirements yet. Add your first requirement above.</td></tr>';
body.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const r=requirements.find(x=>x.id===b.dataset.edit);if(!r)return;editing=r.id;$('reqName').value=r.name;$('reqTx').value=r.transaction;$('reqRequired').checked=r.required;$('reqKeywords').value=r.keywords;$('reqSave').textContent='Save Changes';$('reqName').focus()});
body.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this requirement from active configurations?'))return;await write('removeRequirement',{id:b.dataset.remove});});}
async function load(){try{const r=await jp('requirements');if(!r.ok)throw Error(r.error);requirements=r.requirements||[];render();status('Requirements synchronized with Google Sheets.')}catch(e){status(e.message);}}
async function write(action,args){if(loading)return;loading=true;$('reqSave').disabled=true;try{const r=await jp(action,{...args,adminKey:$('reqAdminKey').value});if(!r.ok)throw Error(r.error);editing='';$('reqName').value='';$('reqKeywords').value='';$('reqRequired').checked=true;$('reqSave').textContent='Add Requirement';await load()}catch(e){status(e.message)}finally{loading=false;$('reqSave').disabled=false;}}
function init(){if(!$('reqSetup'))return;document.querySelectorAll('[data-v="setup"]').forEach(b=>b.addEventListener('click',()=>{void load();void loadTransactions()}));
$('reqGenerate').onclick=()=>{$('reqKeywords').value=suggest($('reqName').value);status('Suggested search terms created locally. Review and edit them before saving. Keywords alone cannot verify documents.')};
$('reqSave').onclick=()=>write('upsertRequirement',{id:editing,name:$('reqName').value,transaction:$('reqTx').value,required:$('reqRequired').checked,keywords:$('reqKeywords').value});
$('reqCancel').onclick=()=>{editing='';$('reqName').value='';$('reqKeywords').value='';$('reqSave').textContent='Add Requirement';};
void loadTransactions();void load();}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();