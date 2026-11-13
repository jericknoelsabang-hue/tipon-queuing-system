const test=require('node:test');
const assert=require('node:assert/strict');
const {splitWaitingQueues,createBoard}=require('../queue-display.js');

const ticket=(n,extra={})=>({ticketId:'ticket-'+n,queueNo:'NH-'+String(n).padStart(4,'0'),status:'WAITING',...extra});
const tickets=n=>Array.from({length:n},(_,i)=>ticket(i+1));
function board(width=800){
  const numbers={clientWidth:width,_html:'',writes:0,
    set innerHTML(value){this._html=value;this.writes++},get innerHTML(){return this._html}};
  const count={textContent:''},page={textContent:''},rotation={textContent:'',classList:{toggle(){}}};
  return {numbers,count,page,rotation,update:createBoard({numbers,count,page,rotation,emptyText:'Nobody waiting.'}).update,
    visible:()=>[...numbers.innerHTML.matchAll(/role="listitem" class="[^"]+">([^<]+)</g)].map(match=>match[1])};
}

test('a ticket follows registration, pre-check, waiting, assigned call and completion without appearing in both boxes',()=>{
  const t=ticket(1);
  assert.deepEqual(splitWaitingQueues({waiting:[t]}),{precheck:[t],ready:[]});
  assert.deepEqual(splitWaitingQueues({waiting:[t],windows:{1:t}}),{precheck:[],ready:[]});
  const done={...t,prechecked:true};
  assert.deepEqual(splitWaitingQueues({waiting:[],precheckDone:[done],windows:{1:null}}),{precheck:[],ready:[done]});
  assert.deepEqual(splitWaitingQueues({precheckDone:[done],windows:{2:done}}),{precheck:[],ready:[]});
  assert.deepEqual(splitWaitingQueues({precheckDone:[{...done,status:'COMPLETED'}]}),{precheck:[],ready:[]});
});

test('stage two wins over stale duplicates; serving, completed and blank records are omitted',()=>{
  const first=ticket(1),checked=ticket(2,{prechecked:true}),serving=ticket(3),fourth=ticket(4,{prechecked:'YES'});
  const groups=splitWaitingQueues({waiting:[first,first,checked,serving,fourth,null,ticket(5,{queueNo:''}),ticket(6,{status:'COMPLETED'})],precheckDone:[checked,checked],windows:{1:serving}});
  assert.deepEqual(groups,{precheck:[first],ready:[checked,fourth]});
});

test('server queue order and input arrays are preserved',()=>{
  const waiting=[ticket(4),ticket(1),ticket(3)],original=JSON.stringify(waiting);
  assert.deepEqual(splitWaitingQueues({waiting}).precheck,waiting);
  assert.equal(JSON.stringify(waiting),original);
});

test('all 45 tickets appear over twelve one-minute sets, with no more than four visible at once',()=>{
  const view=board(),list=tickets(45),seen=[];
  for(let minute=0;minute<12;minute++){
    view.update(list,minute*60000);
    const visible=view.visible();
    assert.ok(visible.length<=4);
    assert.equal(visible[0],list[minute*4].queueNo);
    assert.match(view.page.textContent,new RegExp('Set '+(minute+1)+' of 12$'));
    seen.push(...visible);
  }
  assert.deepEqual(seen,list.map(t=>t.queueNo));
  view.update(list,720000);
  assert.deepEqual(view.visible(),list.slice(0,4).map(t=>t.queueNo));
});

test('frequent polling and new arrivals do not restart the 60-second timer or redraw unchanged numbers',()=>{
  const view=board();view.update(tickets(21),0);
  const writes=view.numbers.writes;
  for(let time=2500;time<60000;time+=2500)view.update(tickets(21+time/2500),time);
  assert.equal(view.numbers.writes,writes);
  view.update(tickets(46),59999);
  assert.equal(view.rotation.textContent,'Next set in 1s');
  view.update(tickets(46),60000);
  assert.equal(view.visible()[0],'NH-0005');
  assert.equal(view.visible().length,4);
  assert.equal(view.rotation.textContent,'Next set in 60s');
});

test('the two boxes rotate independently when one gains a second page later',()=>{
  const first=board(),second=board();
  first.update(tickets(9),0);second.update(tickets(3),0);
  second.update(tickets(6),30000);
  first.update(tickets(9),60000);second.update(tickets(6),60000);
  assert.equal(first.visible()[0],'NH-0005');assert.equal(second.visible()[0],'NH-0001');
  second.update(tickets(6),90000);assert.equal(second.visible()[0],'NH-0005');
});

test('called tickets disappear immediately and shrinking lists never leave a blank set',()=>{
  const view=board();view.update(tickets(25),0);view.update(tickets(25),120000);
  assert.equal(view.visible()[0],'NH-0009');
  view.update([ticket(24),ticket(25)],120001);
  assert.deepEqual(view.visible(),['NH-0024','NH-0025']);
  assert.equal(view.page.textContent,'Showing 1-2 of 2');
  assert.equal(view.rotation.textContent,'All numbers shown');
  view.update([],120002);assert.equal(view.count.textContent,'0');assert.match(view.numbers.innerHTML,/Nobody waiting/);
  view.update([ticket(30)],120003);assert.deepEqual(view.visible(),['NH-0030']);
});

test('resizing does not change the four-ticket page size and all mobile numbers remain reachable',()=>{
  const view=board(),list=tickets(25);view.update(list,0);view.update(list,60000);
  view.numbers.clientWidth=320;view.update(list,61000);
  assert.equal(view.visible().length,4);assert.equal(view.visible()[0],'NH-0005');
  const seen=new Set();
  for(let n=0;n<7;n++){view.update(list,61000+n*60000);view.visible().forEach(value=>seen.add(value))}
  assert.equal(seen.size,25);
});

test('a suspended tab resumes with a valid set and countdown',()=>{
  const view=board();view.update(tickets(25),0);view.update(tickets(25),180500);
  assert.equal(view.visible()[0],'NH-0013');assert.equal(view.rotation.textContent,'Next set in 60s');
});

test('queue text is escaped and long transaction codes use the smaller type style',()=>{
  const view=board();view.update([ticket(1,{queueNo:'<img onerror="bad">'}),ticket(2,{queueNo:'CUSTOM-0001'})],0);
  assert.doesNotMatch(view.numbers.innerHTML,/<img/);
  assert.match(view.numbers.innerHTML,/&lt;img onerror=&quot;bad&quot;&gt;/);
  assert.match(view.numbers.innerHTML,/queue-board-ticket-long">CUSTOM-0001/);
});
