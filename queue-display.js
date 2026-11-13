/* Waiting-stage lists and four-ticket paging for the public TV display. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.TiponQueueDisplay=factory();
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  const ROTATION_MS=60000;
  const PAGE_SIZE=4;
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const ticketKey=ticket=>String(ticket?.ticketId||ticket?.queueNo||'');
  const isPrechecked=ticket=>ticket?.prechecked===true||String(ticket?.prechecked||'').toUpperCase()==='YES';

  function splitWaitingQueues(state={}){
    const waiting=Array.isArray(state.waiting)?state.waiting:[];
    const done=Array.isArray(state.precheckDone)?state.precheckDone:[];
    const serving=new Set(Object.values(state.windows||{}).filter(Boolean).map(ticketKey));
    function uniqueWaiting(tickets){
      const seen=new Set();
      return tickets.filter(ticket=>{
        const key=ticketKey(ticket);
        if(!key||!String(ticket?.queueNo||'').trim()||seen.has(key)||serving.has(key))return false;
        if(ticket.status&&String(ticket.status).toUpperCase()!=='WAITING')return false;
        seen.add(key);return true;
      });
    }
    // Preserve the server's queue order; a checked ticket belongs only in stage two.
    const ready=uniqueWaiting([...done,...waiting.filter(isPrechecked)]);
    const readyIds=new Set(ready.map(ticketKey));
    return {precheck:uniqueWaiting(waiting).filter(ticket=>!isPrechecked(ticket)&&!readyIds.has(ticketKey(ticket))),ready};
  }

  function createBoard({numbers,count,page,rotation,emptyText}){
    let pageIndex=0,nextRotationAt=0,lastSignature='';
    function setText(element,value){if(element.textContent!==value)element.textContent=value}
    return {
      update(tickets,now=Date.now()){
        const list=Array.isArray(tickets)?tickets:[];
        const total=list.length,pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
        pageIndex=Math.min(pageIndex,pages-1);
        if(pages===1){pageIndex=0;nextRotationAt=0}
        else if(!nextRotationAt)nextRotationAt=now+ROTATION_MS;
        else if(now>=nextRotationAt){
          const steps=Math.floor((now-nextRotationAt)/ROTATION_MS)+1;
          pageIndex=(pageIndex+steps)%pages;
          nextRotationAt+=steps*ROTATION_MS;
        }
        const start=pageIndex*PAGE_SIZE,visible=list.slice(start,start+PAGE_SIZE);
        const signature=JSON.stringify({pageIndex,numbers:visible.map(ticket=>ticket?.queueNo)});
        if(signature!==lastSignature){
          numbers.innerHTML=visible.length?visible.map(ticket=>{
            const value=String(ticket.queueNo),long=value.length>9?' queue-board-ticket-long':'';
            return '<span role="listitem" class="queue-board-ticket'+long+'">'+escapeHtml(value)+'</span>';
          }).join(''):'<p class="queue-board-empty">'+escapeHtml(emptyText)+'</p>';
          lastSignature=signature;
        }
        setText(count,String(total));
        setText(page,total?'Showing '+(start+1)+'-'+Math.min(start+PAGE_SIZE,total)+' of '+total+(pages>1?' | Set '+(pageIndex+1)+' of '+pages:''):'No queues waiting');
        setText(rotation,pages>1?'Next set in '+Math.ceil((nextRotationAt-now)/1000)+'s':'All numbers shown');
        rotation.classList.toggle('is-rotating',pages>1);
      }
    };
  }
  return {splitWaitingQueues,createBoard};
});
