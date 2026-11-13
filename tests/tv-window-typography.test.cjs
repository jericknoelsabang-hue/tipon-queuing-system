const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const polish=css.slice(css.lastIndexOf('/* TV service-window typography:'));

test('window labels stay at the top while queue details are vertically centered below',()=>{
  assert.match(polish,/#display:fullscreen \.now \.window\{[\s\S]*?display:flex!important;[\s\S]*?flex-direction:column;/);
  assert.match(polish,/#display:fullscreen \.now \.window-label\{[\s\S]*?flex:0 0 clamp\(34px,3\.1vw,44px\);/);
  assert.match(polish,/#display:fullscreen \.now \.window \.queue-no\{[\s\S]*?margin-top:auto!important;/);
  assert.match(polish,/#display:fullscreen \.now \.window small\{[\s\S]*?margin-bottom:auto!important;/);
});

test('queue number stays on one line, scales with card width and is vertically centered',()=>{
  assert.match(polish,/#display:fullscreen \.now \.window \.queue-no\{[\s\S]*?margin-top:auto!important;[\s\S]*?white-space:nowrap;[\s\S]*?font-size:clamp\(32px,22cqw,58px\)!important;/);
  assert.match(polish,/#display:fullscreen \.now \.window strong\{[\s\S]*?display:flex;[\s\S]*?justify-content:center;/);
  assert.match(polish,/#display:fullscreen \.now \.window small\{[\s\S]*?margin-bottom:auto!important;/);
});

test('empty windows center the idle dash and READY FOR NEXT under the fixed heading',()=>{
  assert.match(app,/window-empty/);
  assert.match(polish,/#display:fullscreen \.now \.window-empty \.queue-no\{[\s\S]*?font-size:clamp\(28px,14cqw,42px\)!important;/);
  assert.match(polish,/#display:fullscreen \.now \.window-empty small\{[\s\S]*?margin-bottom:auto!important;/);
});

test('QR frame is enlarged but constrained by the fullscreen panel and viewport height',()=>{
  assert.match(polish,/#display:fullscreen \.qr-panel \.qr-frame\{[\s\S]*?width:min\(100%,40vh,430px\);[\s\S]*?aspect-ratio:1\/1;/);
});

test('NOW SERVING heading and service instruction use larger typography',()=>{
  assert.match(polish,/#display:fullscreen \.now-title h2\{[\s\S]*?font-size:clamp\(34px,3\.1vw,56px\);/);
  assert.match(polish,/#display:fullscreen \.now-title p\{[\s\S]*?font-size:clamp\(16px,1\.4vw,24px\);/);
});

test('the requested queue-stage labels remain intact',()=>{
  assert.match(html,/>AWAITING PRE-CHECK</);
  assert.match(html,/>PRE-CHECK COMPLETED</);
});


test('waiting panels no longer display numbered step badges',()=>{
  assert.doesNotMatch(html,/class="queue-board-step"/);
  assert.match(html,/>AWAITING PRE-CHECK</);
  assert.match(html,/>PRE-CHECK COMPLETED</);
});

test('waiting ticket numbers are centered in larger fixed-height boxes',()=>{
  const waitingPolish=css.slice(css.lastIndexOf('/* Premium waiting boards:'));
  assert.match(waitingPolish,/#display:fullscreen \.queue-board-ticket\{[\s\S]*?display:grid;[\s\S]*?place-items:center;[\s\S]*?min-height:52px;[\s\S]*?font-size:clamp\(22px,1\.85vw,32px\);/);
  assert.match(waitingPolish,/#display:fullscreen \.queue-board-tickets\{[\s\S]*?grid-template-rows:minmax\(52px,auto\);/);
});

test('QR code is enlarged while remaining constrained to its TV panel',()=>{
  const waitingPolish=css.slice(css.lastIndexOf('/* Premium waiting boards:'));
  assert.match(waitingPolish,/#display:fullscreen \.qr-panel \.qr-frame\{[\s\S]*?width:min\(100%,40vh,430px\);[\s\S]*?max-width:100%;[\s\S]*?aspect-ratio:1\/1;/);
});

test('waiting board colors and ticket styles remain distinct between the two stages',()=>{
  const waitingPolish=css.slice(css.lastIndexOf('/* Premium waiting boards:'));
  assert.match(waitingPolish,/\.queue-board-precheck \.queue-board-ticket\{/);
  assert.match(waitingPolish,/\.queue-board-ready \.queue-board-ticket\{/);
});


test('TV waiting boards hide the pagination and all-numbers footer text',()=>{
  assert.match(css,/#display \.waiting-boards \.queue-board-footer\{\s*display:none!important;\s*\}/);
  assert.match(html,/id="precheckQueuePage"/);
  assert.match(html,/id="precheckQueueRotation"/);
  assert.match(html,/id="readyQueuePage"/);
  assert.match(html,/id="readyQueueRotation"/);
});
