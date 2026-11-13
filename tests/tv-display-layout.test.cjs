const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const fullscreen=css.slice(css.lastIndexOf('/* Executive TV layout:'));

test('fullscreen display is constrained to the viewport with no page-level overflow',()=>{
  assert.match(fullscreen,/#display:fullscreen\s*\{[\s\S]*?height:100vh;[\s\S]*?height:100dvh;[\s\S]*?overflow:hidden;/);
  assert.match(fullscreen,/#display:fullscreen \.tv\s*\{[\s\S]*?min-height:0!important;[\s\S]*?grid-template-rows:minmax\(0,1fr\) auto auto;[\s\S]*?overflow:hidden;/);
});

test('all configured service windows fit on one desktop row instead of wrapping under the waiting boards',()=>{
  assert.match(fullscreen,/#display:fullscreen \.now \.windows\s*\{[\s\S]*?grid-template-columns:repeat\(var\(--window-count,5\),minmax\(0,1fr\)\);/);
  assert.match(app,/\$\('wins'\)\.style\.setProperty\('--window-count',String\(Math\.max\(1,Math\.min\(count,5\)\)\)\);/);
});

test('TV content has separate grid rows for serving windows, waiting stages and announcement',()=>{
  assert.match(fullscreen,/#display:fullscreen \.tv\s*\{[\s\S]*?grid-template-rows:minmax\(0,1fr\) auto auto;/);
  assert.match(fullscreen,/#display:fullscreen \.waiting-boards\s*\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
  assert.match(fullscreen,/#display:fullscreen \.announcement\s*\{[\s\S]*?height:clamp\(58px,6\.5vh,76px\);/);
});

test('approved queue-stage wording is present and fixed Window 1 wording is absent',()=>{
  assert.match(html,/>AWAITING PRE-CHECK</);
  assert.match(html,/>PRE-CHECK COMPLETED</);
  assert.match(html,/Showing|precheckQueuePage/);
  assert.doesNotMatch(html,/Window 1/);
  assert.doesNotMatch(app,/Window 1/);
});

test('tablet and mobile fullscreen layouts can scroll rather than overlap content',()=>{
  assert.match(fullscreen,/@media\(max-width:850px\)\s*\{[\s\S]*?#display:fullscreen\s*\{[\s\S]*?overflow:auto;/);
  assert.match(fullscreen,/#display:fullscreen \.now \.windows\s*\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
});
