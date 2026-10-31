/* tipón TAWAG public recruitment/member registration; no staff navigation. */
(()=>{'use strict';
const $=id=>document.getElementById(id),C=window.TIPON_CONFIG||{},VERSION='federation-v10',COMPATIBLE=new Set(['federation-v7','federation-v8','federation-v9','federation-v10']);
let service='recruitment',seq=0,memberAvailable=true;
const apiUrl=()=>new URLSearchParams(location.search).get('api')||localStorage.getItem('tqApi')||C.backendUrl||'';
function valid(url){try{const u=new URL(url);return u.origin==='https://script.google.com'&&u.pathname.endsWith('/exec')}catch{return false}}
function message(text,ok=false){const e=$('message');e.textContent=String(text);e.className='message'+(ok?' ok':'')}
function clear(){const e=$('message');e.textContent='';e.classList.add('hide')}
function jp(action,params={}){return new Promise((resolve,reject)=>{
 if(!valid(apiUrl()))return reject(Error('Queuing system connection is not configured. Please ask the reception staff for assistance.'));
 const cb='__tiponJoin'+Date.now()+(++seq),tag=document.createElement('script');let done=false;
 const timer=setTimeout(()=>finish(Error('Connection timed out. Please notify reception staff.')),16000);
 function finish(err,result){if(done)return;done=true;clearTimeout(timer);delete window[cb];tag.remove();err?reject(err):resolve(result)}
 window[cb]=result=>finish(null,result);tag.onerror=()=>finish(Error('Could not connect to the queue server.'));
 const u=new URL(apiUrl());u.searchParams.set('action',action);u.searchParams.set('callback',cb);
 Object.entries(params).forEach(([key,val])=>u.searchParams.set(key,String(val??'')));
 tag.src=u.href;document.head.appendChild(tag);
})}
function choose(next){
 if(next==='member'&&!memberAvailable){message('Member Concern is currently unavailable. Please ask reception staff.');return}
 service=next;const recruitment=service==='recruitment';
 $('chooseRecruitment').classList.toggle('chosen',recruitment);
 $('chooseMember').classList.toggle('chosen',!recruitment);
 $('chooseRecruitment').setAttribute('aria-pressed',String(recruitment));
 $('chooseMember').setAttribute('aria-pressed',String(!recruitment));
 $('transactionField').classList.toggle('hide',!recruitment);
 $('positionField').classList.toggle('hide',!recruitment);
 $('concernOptions').classList.toggle('hide',recruitment);
 $('position').required=recruitment;$('transaction').required=recruitment;$('concern').required=!recruitment;
 $('submit').textContent='GET QUEUE NUMBER';clear();
}
$('chooseRecruitment').onclick=()=>choose('recruitment');
$('chooseMember').onclick=()=>choose('member');
function receipt(ticket){
 $('entry').classList.add('hide');$('receipt').classList.remove('hide');$('receipt').classList.remove('finished');$('step2').classList.add('on');
 $('receiptTag').textContent='QUEUE NUMBER CONFIRMED';
 $('receiptTitle').textContent='Your queue number is ready';
 $('receiptCode').textContent=String(ticket.queueNo||'---');
 $('receiptText').textContent='Please save your queue number and watch the TV Display for your assigned window.';
 $('finishedNotice').classList.add('hide');
 clear();
}
$('another').onclick=()=>{
 $('receipt').classList.add('hide');$('receipt').classList.remove('finished');$('entry').classList.remove('hide');$('step2').classList.remove('on');
 $('finishedNotice').classList.add('hide');$('queueForm').reset();choose($('chooseRecruitment').disabled?'member':'recruitment');
};
$('done').onclick=()=>{
 // Browsers permit window.close() for script-opened pages only. A QR-opened tab may stay open.
 // Try synchronously from the user click, then show an accessible completion fallback.
 try{window.close()}catch{}
 if(window.closed)return;
 $('receipt').classList.add('finished');
 $('receiptTag').textContent='REGISTRATION COMPLETE';
 $('receiptTitle').textContent='Thank you. Your queue number is confirmed.';
 $('receiptText').textContent='Please keep your queue number and wait for it to be called at the TV Display.';
 $('finishedNotice').textContent='Registration finished. You may close this tab. Your queue number remains valid.';
 $('finishedNotice').classList.remove('hide');
};
$('queueForm').onsubmit=async event=>{
 event.preventDefault();clear();
 const button=$('submit');if(button.disabled)return;button.disabled=true;button.textContent='PLEASE WAIT…';
 try{
  const firstName=$('firstName').value.trim(),lastName=$('lastName').value.trim();
  const transaction=service==='recruitment' ? $('transaction').value : 'MC';
  const position=service==='recruitment' ? $('position').value.trim() : $('concern').value.trim();
  if(!firstName||!lastName||!position)throw Error('Please complete all required fields.');
  // One request instead of a health check plus registration. The backend validates and deduplicates applicants.
  const res=await jp('register',{firstName,lastName,position,transaction});
  if(!res.ok)throw Error(res.error||'Unable to generate your queue number.');
  if(!res.ticket||!res.ticket.queueNo)throw Error('The server returned no queue number. Please notify staff.');
  receipt(res.ticket);
 }catch(e){message(e.message)}
 finally{button.disabled=false;button.textContent='GET QUEUE NUMBER'}
};
async function loadTransactions(){
 if(!valid(apiUrl())){message('The queue is not configured. Please notify reception staff.');$('submit').disabled=true;return}
 try{
  let res=await jp('publicConfig');
  // Existing Federation v7 backends can still register while the new Apps Script is being deployed.
  if(!res.ok&&/Unknown action/i.test(String(res.error||'')))res=await jp('state');
  if(!res.ok)throw Error(res.error||'Cannot retrieve transaction types.');
  const version=res.version||res.state?.version;
  if(version&&!COMPATIBLE.has(version))throw Error('The queuing system requires a backend update. Please contact reception.');
  const active=res.transactions||res.state?.transactions||[];
  memberAvailable=active.some(t=>t.code==='MC');
  $('chooseMember').disabled=!memberAvailable;
  $('chooseMember').setAttribute('aria-disabled',String(!memberAvailable));
  const tx=active.filter(t=>t.code!=='MC');
  $('chooseRecruitment').disabled=!tx.length;
  if(tx.length){
    const select=$('transaction'),previous=select.value;select.textContent='';
    for(const item of tx){const o=document.createElement('option');o.value=item.code;o.textContent=item.code+' — '+item.name;select.appendChild(o)}
    if(tx.some(t=>t.code===previous))select.value=previous;
  }else{$('transaction').textContent=''}
  if(!tx.length&&!memberAvailable){$('submit').disabled=true;message('Recruitment and Member Concern registration are currently unavailable. Please ask staff.');return}
  $('submit').disabled=false;
  if(!tx.length&&memberAvailable)choose('member');
  else if(!memberAvailable&&service==='member')choose('recruitment');
  clear();
 }catch(e){message('Could not load available services: '+e.message)}
}
localStorage.removeItem('tqPendingPrecheck'); // clear legacy v4 state: no applicant verification is required
choose('recruitment');void loadTransactions();
})();