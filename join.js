/* Standalone public TIPON Queue registration — no TV or staff navigation. */
(()=>{'use strict';
const $=id=>document.getElementById(id),C=window.TIPON_CONFIG||{},VERSION='federation-v6';
let service='recruitment',seq=0;
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
 $('entry').classList.add('hide');$('receipt').classList.remove('hide');$('step3').classList.add('on');
 $('receiptTag').textContent='QUEUE NUMBER CONFIRMED';
 $('receiptTitle').textContent='Your queue number is ready';
 $('receiptCode').textContent=String(ticket.queueNo||'---');
 $('receiptText').textContent='Please save your queue number and watch the TV Display for your assigned window.';
 clear();
}
$('another').onclick=()=>{
 $('receipt').classList.add('hide');$('entry').classList.remove('hide');$('step3').classList.remove('on');
 $('queueForm').reset();choose('recruitment');
};
$('queueForm').onsubmit=async event=>{
 event.preventDefault();clear();
 const button=$('submit');if(button.disabled)return;button.disabled=true;button.textContent='PLEASE WAIT…';
 try{
  const firstName=$('firstName').value.trim(),lastName=$('lastName').value.trim();
  const transaction=service==='recruitment' ? $('transaction').value : 'MC';
  const position=service==='recruitment' ? $('position').value.trim() : $('concern').value.trim();
  if(!firstName||!lastName||!position)throw Error('Please complete all required fields.');
  const health=await jp('health');if(!health.ok)throw Error(health.error||'Could not reach the queue server.');
  if(health.version!==VERSION)throw Error('The queue server requires an update. Please ask staff to deploy Federation v5.');
  const res=await jp('register',{firstName,lastName,position,transaction});
  if(!res.ok)throw Error(res.error||'Unable to generate your queue number.');
  if(!res.ticket||!res.ticket.queueNo)throw Error('The server returned no queue number. Please notify staff.');
  receipt(res.ticket);
 }catch(e){message(e.message)}
 finally{button.disabled=false;button.textContent='GET QUEUE NUMBER'}
};
async function loadTransactions(){
 if(!valid(apiUrl())){message('The queue is not configured. Please notify reception staff.');return}
 try{
  const res=await jp('state');if(!res.ok)throw Error(res.error);
  if(res.state?.version!==VERSION){message('The queuing system is awaiting its backend update. Please ask staff for assistance.');return}
  const tx=(res.state.transactions||[]).filter(t=>t.code!=='MC');
  if(tx.length){const select=$('transaction'),previous=select.value;select.textContent='';
   for(const item of tx){const o=document.createElement('option');o.value=item.code;o.textContent=item.code+' — '+item.name;select.appendChild(o)}
   if(tx.some(t=>t.code===previous))select.value=previous;
  }
 }catch(e){message('Could not load transactions: '+e.message)}
}
localStorage.removeItem('tqPendingPrecheck'); // clear legacy v4 state: no applicant verification is required
choose('recruitment');loadTransactions();
})();