/* TIPON TAWAG — recruiter requirement editor.
 * No shared management key, no staff-only Apps Script URL.
 * Google OAuth -> Sheets API for shared writes; local browser demo if OAuth isn't configured.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id),C=window.TIPON_CONFIG||{};
const SHEET_ID='1S8qIM1Iw4WxHQovO5T4RaD1bzr_C36fFBX4O3Udjdik';
const RANGE="'REQUIREMENTS_CONFIG'!A1:H1000",DEMO_KEY="tqLocalReqDemoV1";
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let rows=[],transactions=[],editing="",busy=false,accessToken="",tokenClient=null;
let serviceMode='DEMO',authExpires=0,seq=0;
const validScript=u=>{try{const p=new URL(u);return p.origin==='https://script.google.com'&&p.pathname.endsWith('/exec')}catch{return false}};
const backend=()=>new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||'';
const notify=v=>{$('reqStatus').textContent=v};
const reqList=()=>document.querySelectorAll('#reqTxChecklist input[type="checkbox"]');
function selectedCodes(){return [...reqList()].filter(x=>x.checked).map(x=>x.value)}
function selected(){return $('reqTxAll').checked?['ALL']:selectedCodes()}
function setChecked(codes=[]){
 const set=new Set(codes);const all=set.has('ALL');
 for(const el of reqList())el.checked=all||set.has(el.value);
 $('reqTxAll').checked=all||!!transactions.length&&selectedCodes().length===transactions.length;
 updateSummary();
}
function updateSummary(){
 const codes=selected();const names=codes.includes('ALL')?['All Recruitment Transactions']:codes.map(code=>transactions.find(t=>t.code===code)?.name||code);
 $('reqTxSummary').textContent=names.length?names.join(', '):'Select recruitment transactions';
}
function renderTx(){
 const old=selected();
 $('reqTxChecklist').innerHTML=transactions.map(t=>'<label class="req-tx-option"><input type="checkbox" value="'+esc(t.code)+'"> '+esc(t.name)+' ('+esc(t.code)+')</label>').join('');
 setChecked(old);
}
function transactionCodes(r){
 if(Array.isArray(r.transactions))return r.transactions;
 const v=String(r.transaction||'ALL');
 if(v==='ALL')return ['ALL'];
 try{const x=JSON.parse(v);if(Array.isArray(x))return x}catch{}
 return v.split(/[,;|]/).map(x=>x.trim()).filter(Boolean);
}
function render(){
 $('reqRows').innerHTML=rows.length?rows.map(r=>{
  const codes=transactionCodes(r);
  const labels=codes.includes('ALL')?'All Recruitment':codes.map(x=>transactions.find(t=>t.code===x)?.name||x).join(', ');
  return '<tr><td><b>'+esc(r.name)+'</b></td><td>'+esc(labels)+'</td><td>'+esc(r.keywords||'—')+'</td><td>'+
    '<button class="btn sm" data-edit="'+esc(r.id)+'" type="button">Edit</button> '+
    '<button class="btn sm danger" data-remove="'+esc(r.id)+'" type="button">Delete</button></td></tr>'
 }).join(''):'<tr><td colspan="4" class="empty">No requirements added yet.</td></tr>';
 document.querySelectorAll('#reqRows [data-edit]').forEach(btn=>btn.onclick=()=>{
  const row=rows.find(r=>r.id===btn.dataset.edit);if(!row)return;
  editing=row.id;$('reqName').value=row.name;$('reqKeywords').value=row.keywords||'';
  setChecked(transactionCodes(row));$('reqSave').textContent='Save Changes';
  $('reqTxDropdown').open=false;$('reqName').focus();
 });
 document.querySelectorAll('#reqRows [data-remove]').forEach(btn=>btn.onclick=()=>void remove(btn.dataset.remove));
}
function clearEditor(){
 editing='';$('reqName').value='';$('reqKeywords').value='';setChecked([]);
 $('reqSave').textContent='Add Requirement';$('reqTxDropdown').open=false;
}
function localSnapshot(){try{const v=JSON.parse(localStorage.getItem(DEMO_KEY)||'null');return Array.isArray(v)?v:null}catch{return null}}
function saveLocal(list){
 localStorage.setItem(DEMO_KEY,JSON.stringify(list));rows=list;
 render();notify('LOCAL TEST MODE — saved in this browser only, not synchronized to Google Sheets. Sign in with an authorized Google account to save shared requirements.');
}
function jsonp(action){
 return new Promise((resolve,reject)=>{
  const endpoint=backend();if(!validScript(endpoint))return reject(Error('Backend not configured'));
  const cb='__req_cfg_'+(++seq)+'_'+Date.now(),node=document.createElement('script');let done=false;
  const timer=setTimeout(()=>end(Error('Connection timed out')),11000);
  function end(err,x){if(done)return;done=true;delete window[cb];clearTimeout(timer);node.remove();err?reject(err):resolve(x)}
  window[cb]=data=>end(null,data);node.onerror=()=>end(Error('Cannot connect'));
  const u=new URL(endpoint);u.searchParams.set('action',action);u.searchParams.set('callback',cb);
  node.src=u.href;document.head.appendChild(node);
 });
}
async function bootstrap(){
 // Public read is allowed. Never submit recruiter credentials through JSONP.
 let source='STATIC DEMO';
 try{const r=await jsonp('publicConfig');if(!r.ok)throw Error(r.error);
  const active=(r.transactions||r.state?.transactions||[]).filter(t=>t.code!=='MC'&&t.active!==false);
  if(active.length)transactions=active;source='LIVE QUEUE CONFIG';
 }catch{transactions=[{code:'NH',name:'New Hire'},{code:'RH',name:'Rehire'},{code:'TR',name:'Transfer'}]}
 renderTx();
 try{
  const r=await jsonp('requirements');if(!r.ok)throw Error(r.error);
  rows=r.requirements||[];source='LIVE REQUIREMENTS';
 }catch{
  try{const r=await fetch('requirements-fallback.json',{cache:'no-store'});if(!r.ok)throw Error('Unable to load demo configuration');
   const x=await r.json();rows=x.requirements||[];
  }catch{rows=[]}
 }
 const demo=localSnapshot();
 if(demo){rows=demo;source='LOCAL TEST MODE'}
 render();
 notify(source==='LIVE REQUIREMENTS'?'Connected to the published requirements list. To edit the shared Google Sheet, sign in with Google.':
   source==='LOCAL TEST MODE'?'LOCAL TEST MODE — edits are saved only on this device until Google sign-in is configured.':
   'Showing the default test requirements; backend synchronization needs an Apps Script redeploy. You can still test additions locally.');
}
const VOCAB=[
[/\bnbi\b|national bureau/i,['NBI Clearance','National Bureau of Investigation','Multi-Purpose Clearance','NBI']],
[/\bpsa\b|birth certificate|live birth/i,['Philippine Statistics Authority','Certificate of Live Birth','PSA','Civil Registry']],
[/\bsss\b|social security/i,['SSS','Social Security System','SSS Number','E-1']],
[/philhealth|member data record/i,['PhilHealth','Philippine Health Insurance Corporation','Member Data Record','MDR']],
[/pag.?ibig|\bhdmf\b/i,['Pag-IBIG Fund','Home Development Mutual Fund','HDMF','Member Data Form','MDF']],
[/\btin\b|\bbir\b/i,['Taxpayer Identification Number','Bureau of Internal Revenue','BIR','TIN']],
[/medical certificate/i,['Medical Certificate','Physician','License No']],
[/police clearance/i,['Police Clearance','Philippine National Police','PNP']],
[/valid id|identification card/i,['Government-issued ID','Identification Card','Passport','National ID']]
];
function suggest(name){const term=String(name||'').trim();if(!term)return'';
 const words=[term];for(const [re,values] of VOCAB)if(re.test(term))words.push(...values);
 return [...new Set(words)].join(', ');
}
function sheetEndpoint(range){
 return 'https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(SHEET_ID)+'/values/'+encodeURIComponent(range);
}
async function sheets(method,range,body,query=''){
 if(!accessToken||Date.now()>authExpires)throw Error('Google sign-in has expired. Sign in again.');
 const res=await fetch(sheetEndpoint(range)+query,{
  method,headers:{Authorization:'Bearer '+accessToken,...(body?{'Content-Type':'application/json'}:{})},
  body:body?JSON.stringify(body):undefined
 });
 let x={};try{x=await res.json()}catch{}
 if(!res.ok)throw Error(x.error?.message||'Google Sheets returned HTTP '+res.status);
 return x;
}
async function loadShared(){
 const x=await sheets('GET',RANGE);
 const values=x.values||[];
 if(!values.length||values[0][0]!=='Requirement ID')throw Error('The selected Sheet has an unexpected configuration header.');
 rows=values.slice(1).map((r,i)=>({id:r[0],name:r[1],transaction:r[2]||'ALL',transactions:transactionCodes({transaction:r[2]||'ALL'}),keywords:r[5]||'',active:String(r[4]).toUpperCase()!=='FALSE',sheetRow:i+2,createdAt:r[6]||''})).filter(r=>r.id&&r.active);
 serviceMode='GOOGLE';localStorage.removeItem(DEMO_KEY);
 render();notify('Connected to Google Sheets as the signed-in recruiter. Add, Edit, and Delete are now shared with other users.');
}
function loadGsi(){return new Promise((resolve,reject)=>{
 if(window.google?.accounts?.oauth2)return resolve();
 const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;
 script.onload=resolve;script.onerror=()=>reject(Error('Google sign-in could not load'));document.head.appendChild(script);
})}
async function signIn(){
 const id=C.googleOAuthClientId||'';
 if(!id){
  notify('Shared editing requires one-time Google OAuth Client ID configuration by the administrator. You can test locally now, or edit the existing Google Sheet directly. No App Key or separate Apps Script URL is needed.');
  return false;
 }
 try{
  await loadGsi();
  const token=await new Promise((resolve,reject)=>{
   const client=window.google.accounts.oauth2.initTokenClient({
    client_id:id,scope:'https://www.googleapis.com/auth/spreadsheets',
    callback:r=>r.error?reject(Error(r.error)):resolve(r)
   });
   client.requestAccessToken({prompt:'consent'});
  });
  accessToken=token.access_token;authExpires=Date.now()+(Number(token.expires_in||3600)-90)*1000;
  await loadShared();return true;
 }catch(e){notify('Google sign-in failed: '+String(e.message||e));return false}
}
async function requireSheets(){
 if(serviceMode==='GOOGLE'&&accessToken&&Date.now()<authExpires)return true;
 if(!C.googleOAuthClientId)return false;
 return await signIn();
}
function validWrite(){
 const name=$('reqName').value.trim();
 if(name.length<3){notify('Enter a valid requirement name.');$('reqName').focus();return false}
 if(!selected().length){notify('Select one or more Recruitment Transactions from the dropdown.');$('reqTxDropdown').open=true;return false}
 return true;
}
async function save(){
 if(busy||!validWrite())return;busy=true;$('reqSave').disabled=true;
 const id=editing||('REQ-'+(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36))),name=$('reqName').value.trim();
 const chosen=selected(),transaction=chosen.includes('ALL')?'ALL':JSON.stringify(chosen);
 const keywords=($('reqKeywords').value.trim()||name).slice(0,500);
 const old=rows.find(r=>r.id===id);
 const record={id,name,transaction,transactions:chosen,keywords,active:true,createdAt:old?.createdAt||new Date().toISOString(),sheetRow:old?.sheetRow};
 try{
  if(await requireSheets()){
   const data=[id,name,transaction,true,true,keywords,record.createdAt,new Date().toISOString()];
   if(old?.sheetRow){
    const latest=await sheets('GET',"'REQUIREMENTS_CONFIG'!A"+old.sheetRow+":A"+old.sheetRow);
    if(latest.values?.[0]?.[0]!==id)throw Error('Requirements changed in Google Sheets. Reload before editing.');
    await sheets('PUT',"'REQUIREMENTS_CONFIG'!A"+old.sheetRow+":H"+old.sheetRow,{majorDimension:'ROWS',values:[data]},'?valueInputOption=RAW');
   }else await sheets('POST',"'REQUIREMENTS_CONFIG'!A:H",{majorDimension:'ROWS',values:[data]},':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS');
   clearEditor();await loadShared();
  }else{
   const updated=old?rows.map(r=>r.id===id?record:r):[...rows,record];
   saveLocal(updated);clearEditor();
  }
 }catch(e){notify('Unable to save shared requirements: '+String(e.message||e))}
 finally{busy=false;$('reqSave').disabled=false}
}
async function remove(id){
 if(busy)return;const old=rows.find(r=>r.id===id);if(!old)return;
 busy=true;
 try{
  if(await requireSheets()){
   if(!old.sheetRow)throw Error('Reload the current Google Sheet before deleting.');
   const latest=await sheets('GET',"'REQUIREMENTS_CONFIG'!A"+old.sheetRow+":A"+old.sheetRow);
   if(latest.values?.[0]?.[0]!==id)throw Error('The requirement changed in Google Sheets. Reload first.');
   await sheets('PUT',"'REQUIREMENTS_CONFIG'!E"+old.sheetRow,{majorDimension:'ROWS',values:[['FALSE']]},'?valueInputOption=RAW');
   await loadShared();
  }else saveLocal(rows.filter(r=>r.id!==id));
 }catch(e){notify('Unable to delete requirement: '+String(e.message||e))}
 finally{busy=false}
}
function init(){
 $('reqGenerate').onclick=()=>{
  const txt=suggest($('reqName').value);if(!txt)return notify('Enter a requirement name first.');
  $('reqKeywords').value=txt;notify('Suggested standard document terms; review before saving. This is not a live internet search.');
 };
 $('reqTxAll').onchange=e=>{reqList().forEach(x=>x.checked=e.target.checked);updateSummary()};
 $('reqTxChecklist').onchange=()=>{$('reqTxAll').checked=!!transactions.length&&selectedCodes().length===transactions.length;updateSummary()};
 $('reqSave').onclick=()=>void save();
 $('reqCancel').onclick=clearEditor;
 $('reqGoogleLogin').onclick=()=>void signIn();
 document.querySelectorAll('[data-v="setup"]').forEach(el=>el.addEventListener('click',()=>{if(serviceMode!=='GOOGLE')void bootstrap()}));
 void bootstrap();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();