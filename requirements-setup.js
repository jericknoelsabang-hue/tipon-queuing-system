/* TIPON TAWAG — recruiter-managed requirements (multiple transaction checkboxes).
 * Staff writes use a separate authenticated Apps Script deployment, never public JSONP.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id),C=window.TIPON_CONFIG||{};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const CHANNEL='tipon-requirement-staff-v1';
let requirements=[],transactions=[],editing='',loading=false,seq=0;
let iframe=null,iframeReady=false,iframeUrl='',requests=new Map(),lastError='';
const api=()=>new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||'';
const staffUrl=()=>localStorage.getItem('tqReqStaffApi')||C.staffBackendUrl||'';
function valid(url){try{const u=new URL(url);return u.origin==='https://script.google.com'&&u.pathname.endsWith('/exec')}catch{return false}}
function status(text){lastError=text;$('reqStatus').textContent=text}
function jsonp(action,params={}){return new Promise((resolve,reject)=>{
  if(!valid(api()))return reject(Error('Queue backend not configured.'));
  const cb='__requirements_'+Date.now()+'_'+(++seq),node=document.createElement('script');let done=false;
  const timer=setTimeout(()=>finish(Error('Queue backend timed out')),14000);
  function finish(error,data){if(done)return;done=true;clearTimeout(timer);delete window[cb];node.remove();error?reject(error):resolve(data)}
  window[cb]=r=>finish(null,r);node.onerror=()=>finish(Error('Could not reach the Apps Script backend'));
  const u=new URL(api());u.searchParams.set('action',action);u.searchParams.set('callback',cb);
  for(const [key,value] of Object.entries(params))u.searchParams.set(key,String(value??''));
  node.src=u.href;document.head.appendChild(node);
})}
function bridgeReady(){return iframeReady&&iframe&&iframe.contentWindow}
function createBridge(){
  const u=staffUrl();
  if(!valid(u)){iframeReady=false;return}
  if(iframe&&iframeUrl===u)return;
  iframeReady=false;iframeUrl=u;
  for(const [,request] of requests){clearTimeout(request.timer);request.reject(Error('Staff session changed'))}
  requests.clear();
  if(iframe){iframe.remove();iframe=null}
  iframe=document.createElement('iframe');
  iframe.src=u+(u.includes('?')?'&':'?')+'mode=requirementsStaffBridge';
  iframe.title='Recruiter authenticated Google Apps Script connection';
  iframe.style.cssText='width:1px;height:1px;opacity:0;position:absolute;left:-9999px;border:0;';
  document.body.appendChild(iframe);
}
window.addEventListener('message',event=>{
  if(!iframe||event.source!==iframe.contentWindow)return;
  let host='';try{host=new URL(event.origin).hostname}catch{}
  if(host!=='script.google.com'&&host!=='googleusercontent.com'&&!host.endsWith('.googleusercontent.com'))return;
  const d=event.data||{};
  if(d.channel!==CHANNEL)return;
  if(d.id==='READY'){
    iframeReady=true;
    status('Recruiter connection ready. Checking your Google account permissions…');
    void load();
    return;
  }
  const req=requests.get(d.id);if(!req)return;
  requests.delete(d.id);clearTimeout(req.timer);
  if(d.ok)req.resolve(d.result);else req.reject(Error(String(d.error||'Recruiter request failed')));
});
function rpc(operation,payload={}){
  if(!bridgeReady())return Promise.reject(Error('Secure recruiter connection not ready. Save the staff-only /exec URL above, then sign in with your approved Google account.'));
  return new Promise((resolve,reject)=>{
    const id='req_'+Date.now()+'_'+(++seq);
    const timer=setTimeout(()=>{requests.delete(id);reject(Error('Staff connection timed out. Open / Authorize Recruiter Access and try again.'))},18000);
    requests.set(id,{resolve,reject,timer});
    iframe.contentWindow.postMessage({channel:CHANNEL,id,operation,payload},'*');
  });
}
const CATALOG=[
 [/(\bnbi\b|national bureau|multipurpose clearance)/i,['NBI Clearance','National Bureau of Investigation','Multi-Purpose Clearance','NBI']],
 [/(\bpsa\b|birth certificate|certificate of live birth)/i,['Philippine Statistics Authority','Certificate of Live Birth','PSA','Civil Registry']],
 [/(\bsss\b|social security)/i,['Social Security System','SSS','SS Number','E-1']],
 [/(\bphilhealth\b|\bmdr\b|member data record)/i,['PhilHealth','Philippine Health Insurance Corporation','Member Data Record','MDR']],
 [/(pag.?ibig|\bhdmf\b|member.s data form)/i,['Pag-IBIG Fund','Home Development Mutual Fund','Member’s Data Form','MDF','MID No']],
 [/(\bbir\b|\btin\b|tax identification)/i,['Bureau of Internal Revenue','Taxpayer Identification Number','BIR','TIN']],
 [/(medical|health certificate|fit to work)/i,['Medical Certificate','Fitness to Work','Physician','Medical Examination']],
 [/(drug test)/i,['Drug Test Result','Drug Screening','Laboratory Report']],
 [/(police clearance)/i,['Police Clearance','Philippine National Police','PNP']],
 [/(barangay clearance)/i,['Barangay Clearance','Punong Barangay','Barangay']],
 [/(diploma|transcript)/i,['Diploma','Transcript of Records','School Registrar']],
 [/(valid id|identification card|government.?issued id)/i,['Identification Card','Government-issued ID','Passport','National ID','Driver’s License']]
];
function suggest(name){
 const title=String(name||'').trim();if(!title)return'';
 const terms=[title];
 for(const [re,words] of CATALOG)if(re.test(title))terms.push(...words);
 if(terms.length===1){
   const words=title.match(/[A-Za-z0-9]+/g)||[];
   if(words.length>=3)terms.push(words.map(w=>w.charAt(0).toUpperCase()).join(''));
 }
 return [...new Set(terms.map(s=>s.trim()).filter(Boolean))].join(', ');
}
function selectedTx(){return [...document.querySelectorAll('#reqTxChecklist input[type=checkbox]:checked')].map(e=>e.value)}
function setTxSelected(values){
 const selected=new Set(Array.isArray(values)?values:[]);
 const all=selected.has('ALL');
 for(const box of document.querySelectorAll('#reqTxChecklist input[type=checkbox]'))box.checked=all||selected.has(box.value);
 $('reqTxAll').checked=all||Boolean(transactions.length&&selectedTx().length===transactions.length);
}
function renderTransactions(){
 const current=new Set(selectedTx());
 $('reqTxChecklist').innerHTML=transactions.length?transactions.map(tx=>
  '<label class="req-tx-option"><input type="checkbox" value="'+esc(tx.code)+'"'+(current.has(tx.code)?' checked':'')+'> '+esc(tx.name)+' ('+esc(tx.code)+')</label>').join(''):
  '<span class="small-muted">No active recruitment transactions found.</span>';
 $('reqTxAll').checked=!!transactions.length&&selectedTx().length===transactions.length;
}
function configuredTx(r){
 if(Array.isArray(r.transactions))return r.transactions;
 const str=String(r.transaction||'ALL');
 if(str==='ALL')return ['ALL'];
 try{const a=JSON.parse(str);if(Array.isArray(a))return a}catch{}
 return str.split(/[,;|]/);
}
function namesFor(r){
 const ids=configuredTx(r);if(ids.includes('ALL'))return 'All Recruitment';
 return ids.map(code=>transactions.find(x=>x.code===code)?.name||code).join(', ');
}
function render(){
 $('reqRows').innerHTML=requirements.length?requirements.map(r=>
  '<tr><td><b>'+esc(r.name)+'</b></td><td>'+esc(namesFor(r))+'</td><td>'+esc(r.keywords||'—')+'</td>'+
  '<td class="actions-cell"><button class="btn sm" type="button" data-edit-req="'+esc(r.id)+'">Edit</button> '+
  '<button class="btn sm danger" type="button" data-remove-req="'+esc(r.id)+'">Delete</button></td></tr>').join(''):
  '<tr><td class="empty" colspan="4">No pre-employment requirements yet. An authorized recruiter can add them above.</td></tr>';
 for(const btn of document.querySelectorAll('[data-edit-req]'))btn.onclick=()=>{
   const r=requirements.find(x=>x.id===btn.dataset.editReq);if(!r)return;
   editing=r.id;$('reqName').value=r.name;$('reqKeywords').value=r.keywords||'';
   setTxSelected(configuredTx(r));$('reqSave').textContent='Save Changes';
   $('reqName').scrollIntoView({behavior:'smooth',block:'center'});$('reqName').focus();
 };
 for(const btn of document.querySelectorAll('[data-remove-req]'))btn.onclick=()=>write('remove',{id:btn.dataset.removeReq});
}
function clearEditor(){
 editing='';$('reqName').value='';$('reqKeywords').value='';setTxSelected([]);
 $('reqSave').textContent='Add Requirement';
}
async function readPublic(){
 const cfg=await jsonp('publicConfig');
 if(!cfg.ok)throw Error(cfg.error||'Recruitment transactions could not load.');
 transactions=(cfg.transactions||cfg.state?.transactions||[]).filter(x=>x.code!=='MC'&&x.active!==false);
 renderTransactions();
 const res=await jsonp('requirements');
 if(!res.ok)throw Error(res.error||'Requirements unavailable.');
 requirements=Array.isArray(res.requirements)?res.requirements:[];render();
}
async function load(){
 try{
   if(bridgeReady()){
     const response=await rpc('list');
     if(!response?.ok)throw Error(response?.error||'Recruiter permission denied');
     transactions=response.transactions||[];requirements=response.requirements||[];
     renderTransactions();render();status('Connected as '+response.email+'. Requirements synchronized with Google Sheets.');
   }else{
     await readPublic();status('Requirements loaded. To edit, connect the authorized recruiter deployment above.');
   }
 }catch(e){
   if(/Unknown action/i.test(String(e.message)))status('Apps Script is outdated: deploy the latest Code.gs, then refresh Setup. No changes were saved.');
   else status('Requirements connection: '+String(e.message||e));
 }
}
async function write(op,payload){
 if(loading)return;
 const name=$('reqName').value.trim();
 if(op==='save'&&name.length<3){status('Enter a requirement name (at least 3 characters).');$('reqName').focus();return}
 const txs=selectedTx();
 if(op==='save'&&!txs.length){status('Choose one or more Recruitment Transactions.');return}
 if(!bridgeReady()){status('Save unavailable: connect and authorize the STAFF-ONLY Apps Script deployment. No changes were saved.');return}
 loading=true;$('reqSave').disabled=true;
 try{
   const data=op==='save'?{id:editing,name,transactions:txs,keywords:$('reqKeywords').value.trim()}:payload;
   const res=await rpc(op,data);
   if(!res?.ok)throw Error(res?.error||'Save failed');
   clearEditor();await load();
 }catch(e){status('Could not save requirement: '+String(e.message||e))}
 finally{loading=false;$('reqSave').disabled=false}
}
function init(){
 if(!$('reqSetup'))return;
 $('reqStaffUrl').value=staffUrl();
 $('reqStaffOpen').href=valid(staffUrl())?staffUrl()+'?mode=requirementsStaffBridge':'#';
 $('reqStaffSave').onclick=()=>{
   const value=$('reqStaffUrl').value.trim();
   if(!valid(value)){status('Enter a valid STAFF-ONLY Apps Script /exec URL.');return}
   localStorage.setItem('tqReqStaffApi',value);
   $('reqStaffOpen').href=value+'?mode=requirementsStaffBridge';
   status('Staff connection saved. Authorize your Google account when prompted.');
   createBridge();void load();
 };
 $('reqGenerate').onclick=()=>{
   const value=suggest($('reqName').value);
   if(!value){status('Enter the requirement name first.');return}
   $('reqKeywords').value=value;
   status('Suggested standard document recognition terms. Please verify wording against the issuing authority before saving.');
 };
 $('reqTxAll').onchange=e=>{
   document.querySelectorAll('#reqTxChecklist input[type=checkbox]').forEach(box=>{box.checked=e.target.checked});
 };
 $('reqTxChecklist').addEventListener('change',()=>{
   $('reqTxAll').checked=!!transactions.length&&selectedTx().length===transactions.length;
 });
 $('reqSave').onclick=()=>write('save');
 $('reqCancel').onclick=clearEditor;
 document.querySelectorAll('[data-v="setup"]').forEach(btn=>btn.addEventListener('click',()=>void load()));
 if(valid(staffUrl()))createBridge();
 void load();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();