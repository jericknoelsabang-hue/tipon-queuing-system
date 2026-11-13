const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const polish=css.slice(css.lastIndexOf('/* TV service-window typography:'));

test('all service-window headings use one fixed first grid row',()=>{
  assert.match(polish,/#display:fullscreen \.now \.window\{[\s\S]*?grid-template-rows:clamp\(34px,3\.1vw,44px\) auto auto auto;/);
  assert.match(polish,/#display:fullscreen \.now \.window-label\{[\s\S]*?grid-row:1;[\s\S]*?min-height:clamp\(34px,3\.1vw,44px\);/);
});

test('queue numbers stay on one line and scale with the actual card width',()=>{
  assert.match(polish,/#display:fullscreen \.now \.window \.queue-no\{[\s\S]*?white-space:nowrap;[\s\S]*?overflow:hidden;[\s\S]*?font-size:clamp\(25px,21cqw,54px\)!important;/);
  assert.match(polish,/#display:fullscreen \.now \.window strong\{[\s\S]*?grid-row:3;/);
  assert.match(polish,/#display:fullscreen \.now \.window small\{[\s\S]*?grid-row:4;/);
});

test('empty windows keep READY FOR NEXT below the idle dash',()=>{
  assert.match(app,/window-empty/);
  assert.match(polish,/#display:fullscreen \.now \.window-empty small\{[\s\S]*?grid-row:3 \/ span 2;/);
});

test('QR frame is enlarged but constrained by the fullscreen panel and viewport height',()=>{
  assert.match(polish,/#display:fullscreen \.qr-panel \.qr-frame\{[\s\S]*?width:min\(100%,34vh,390px\);[\s\S]*?aspect-ratio:1\/1;/);
});

test('NOW SERVING heading and service instruction use larger typography',()=>{
  assert.match(polish,/#display:fullscreen \.now-title h2\{[\s\S]*?font-size:clamp\(34px,3\.1vw,56px\);/);
  assert.match(polish,/#display:fullscreen \.now-title p\{[\s\S]*?font-size:clamp\(16px,1\.4vw,24px\);/);
});

test('the requested queue-stage labels remain intact',()=>{
  assert.match(html,/>AWAITING PRE-CHECK</);
  assert.match(html,/>PRE-CHECK COMPLETED</);
});
