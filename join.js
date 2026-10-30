/* Dedicated public queue registration page. Recruitment tickets require staff approval. */
(()=>{'use strict';
const $=id=>document.getElementById(id),C=window.TIPON_CONFIG||{},NEEDED='federation-v4';
let service='recruitment',seq=0,pendingId='',pendingTimer=null;
const url=()=>new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||'';
function valid(u){try{const p=new URL(u);return p.origin==='https://script.google.com'&&p.pathname.endsWith('/exec')}catch{return false}}
function message(text,ok=false){const x=$('message');x.textContent=text;x.className='message'+(ok?' ok':'')}
function clearMessage(){$('message').classList.add('hide')}
function jp(action,params={}){return new Promise((resolve,reject)=>{
 if(!valid(url()))return reject(Error('The queue is not connected yet. Please ask staff to configure the queue in Setup.'));
 const cb='__join'+Date.now()+(++seq),script=document.createElement('script');let settled=false;
 const timeout=setTimeout(()=>finish(Error('Connection timed out. Ask the help desk to check the queue backend.')),16000);
 function finish(e,r){if(settled)return;settled=true;clearTimeout(timeout);delete window[cb];script.remove();e?reject(e):resolve(r)}
 window[cb]=r=>finish(null,r);script.onerror=()=>finish(Error('Cannot connect to the queuing server.'));
 const u=new URL(url());u.searchParams.set('action',action);u.searchParams.set('callback',cb);
 Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,String(v??'')));
 script.src=u.href;document.head.appendChild(script);
})}
function choose(next){service=next;const isRec=next==='recruitment';
 $('chooseRecruitment').classList.toggle('chosen',isRec);$('chooseMember').classList.toggle('chosen',!isRec);
 $('chooseRecruitment').setAttribute('aria-pressed',isRec?'true':'false');$('chooseMember').setAttribute('aria-pressed',!isRec?'true':'false');
 $('recruitmentChecklist').classList.toggle('hide',!isRec);$('transactionField').classList.toggle('hide',!isRec);
 $('concernOptions').classList.toggle('hide',isRec);$('transaction').required=isRec;
 $('position').placeholder=isRec?'e.g. Production Worker':'Additional details (optional)';
 $('position').required=isRec;
 $('submit').textContent=isRec?'CONTINUE TO PRE-SCREENING':'GET MEMBER CONCERNS NUMBER';clearMessage()}
$('chooseRecruitment').onclick=()=>choose('recruitment');$('chooseMember').onclick=()=>choose('member');
function renderReceipt(kind,number,detail){$('entry').classList.add('hide');$('receipt').classList.remove('hide');$('step3').classList.add('on');
 $('receiptCode').textContent=number;
 if(kind==='PENDING'){$('receiptTag').textContent='AWAITING DOCUMENT CHECK';$('receiptTitle').textContent='Proceed to the pre-check station';$('receiptText').textContent='Reference '+number+' is NOT your queue number. Staff will inspect your actual requirements before approving your recruitment queue number. This page will update after approval.';$('checkStatus').classList.remove('hide')}
 else if(kind==='APPROVED'){$('receiptTag').textContent='QUEUE NUMBER CONFIRMED';$('receiptTitle').textContent='You are in the queue';$('receiptText').textContent='Your queue number is '+number+'. Please watch the TV screen until your service window calls your number.';$('checkStatus').classList.add('hide');pendingId='';localStorage.removeItem('tqPendingPrecheck')}
 else{$('receiptTag').textContent='REQUIREMENTS INCOMPLETE';$('receiptTitle').textContent='Please complete your documents';$('receiptText').textContent=detail||'Return when the required documents are available. You can submit a new pre-check request.';$('checkStatus').classList.add('hide');pendingId='';localStorage.removeItem('tqPendingPrecheck')}
}
async function check(){if(!pendingId)return;try{const r=await jp('checkPrecheck',{precheckId:pendingId});if(!r.ok)throw Error(r.error||'Status check failed.');
 if(r.status==='APPROVED'){renderReceipt('APPROVED',r.queueNo);clearMessage()}
 if(r.status==='INCOMPLETE'){renderReceipt('INCOMPLETE',r.reference,r.note);clearMessage()}
 }catch(e){message('Could not check pre-screening status: '+e.message)}}
$('checkStatus').onclick=()=>check();
$('another').onclick=()=>{pendingId='';localStorage.removeItem('tqPendingPrecheck');$('receipt').classList.add('hide');$('entry').classList.remove('hide');$('step3').classList.remove('on');$('queueForm').reset();choose('recruitment')};
$('queueForm').onsubmit=async event=>{event.preventDefault();clearMessage();const button=$('submit');button.disabled=true;button.textContent='SUBMITTING…';
 const firstName=$('firstName').value.trim(),lastName=$('lastName').value.trim();
 const pos=$('position').value.trim();
 try{
  if(!firstName||!lastName)throw Error('Enter your first name and last name.');
  const health=await jp('health');if(!health.ok)throw Error(health.error||'Health check failed.');
  if(health.version!==NEEDED)throw Error('The queue is being updated. Please ask staff to redeploy Apps Script Federation v4.');
  if(service==='member'){
    const p=$('concern').value+(pos?' - '+pos:'');
    const r=await jp('register',{firstName,lastName,position:p.slice(0,80),transaction:'MC'});
    if(!r.ok)throw Error(r.error||'Could not create queue number.');
    renderReceipt('APPROVED',r.ticket.queueNo);
  }else{
    if(!$('hasId').checked||!$('hasDocuments').checked)throw Error('Confirm the required document checklist before continuing.');
    const r=await jp('submitPrecheck',{firstName,lastName,position:pos,transaction:$('transaction').value,hasId:'true',hasDocuments:'true'});
    if(!r.ok)throw Error(r.error||'Could not submit pre-screening.');
    if(r.ticket)renderReceipt('APPROVED',r.ticket.queueNo);
    else{pendingId=r.precheckId;localStorage.setItem('tqPendingPrecheck',pendingId);renderReceipt('PENDING',r.reference);message('Pre-check submitted. Staff will verify your documents before issuing a queue number.',true)}
  }
 }catch(e){message(e.message)}finally{button.disabled=false;button.textContent=service==='member'?'GET MEMBER CONCERNS NUMBER':'CONTINUE TO PRE-SCREENING'}
};
async function populateTransactions(){
 if(!valid(url())){message('The queuing system is not configured yet. Please ask the receptionist for help.');return}
 try{
  const r=await jp('state');if(!r.ok)throw Error(r.error);
  if(r.state?.version!==NEEDED){message('The queue is temporarily awaiting its v4 backend update. Please ask staff for assistance.');return}
  const options=(r.state.transactions||[]).filter(t=>t.code!=='MC');
  if(options.length){$('transaction').innerHTML='';
   for(const t of options){const opt=document.createElement('option');opt.value=t.code;opt.textContent=t.code+' - '+t.name;$('transaction').appendChild(opt)}
  }
 }catch(e){message('Cannot load transactions: '+e.message)}
}
const stored=localStorage.getItem('tqPendingPrecheck');if(stored&&/^[\da-f-]{36}$/i.test(stored)){pendingId=stored;renderReceipt('PENDING','Checking status…');check()}
populateTransactions();pendingTimer=setInterval(()=>{if(pendingId)check()},7000);
})();