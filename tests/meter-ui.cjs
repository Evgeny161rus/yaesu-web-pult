// Runs the production meter/rendering code with a recording canvas and CAT values.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('web/app.js', 'utf8');
const nodes = new Map(), buttons = [], frames = [];
let draws = 0;
const ctx = new Proxy({}, {get: (_, key) => key === 'fill' ? () => draws++ : () => {}, set: () => true});
const element = () => ({textContent:'',style:{},dataset:{},attrs:{},clientWidth:420,clientHeight:188,
  setAttribute(k,v){this.attrs[k]=v}, addEventListener(k,f){this[k]=f},getContext(){return ctx},
  getBoundingClientRect(){return {width:this.clientWidth, height:this.clientHeight}},
  querySelector(){return element()}});
const get = id => {if(!nodes.has(id)) nodes.set(id,element());return nodes.get(id)};
for(const mode of ['po','swr']) {const b=element(); b.dataset.meterTx=mode; buttons.push(b)}
const context = vm.createContext({$, $$:()=>buttons, window:{matchMedia:()=>({matches:true}),addEventListener(){}},
  requestAnimationFrame:f=>{frames.push(f);return frames.length},cancelAnimationFrame(){},setTimeout(){},
  store:{set(k,v){this.saved={...v}}},S:{connected:true,smeter:95,pwr_head:2,tx:false,po:150,swr:89,alc:80},
  C:{authed:true},opts:{meterMode:'analog',meterTx:'po'},Event:class{}});
function $(id){return get(id)}
function extract(start,end){return source.slice(source.indexOf(start),source.indexOf(end))}
vm.runInContext(extract('const clamp =','\n// ------------------------------------------------------------------ справочники')+
  extract('const S_CAL =','const MENU_GROUPS_FALLBACK')+
  extract('function setBar(', '// ------------------------------------------------------------------ частота: цифры'),context);
function render(){vm.runInContext('renderMeters()',context);while(frames.length) frames.shift()(16)}
render();assert.equal(get('#meterValue').textContent,'S7');assert.equal(get('#meterAnalog').dataset.active,'s');
context.S.tx=true; render();assert.equal(get('#meterValue').textContent,'≈54 W');assert.equal(get('#meterAnalog').dataset.active,'po');
buttons[1].click();render();assert.equal(get('#meterValue').textContent,'2.0');assert.equal(context.store.saved.meterTx,'swr');
context.S.tx=false;render();assert.equal(get('#meterValue').textContent,'S7');
context.S.tx=true;render();assert.equal(get('#meterAnalog').dataset.active,'swr');
buttons[0].click();context.S.pwr_head=1;render();assert.equal(get('#meterValue').textContent,'≈5.4 W');
context.S.po=undefined;render();assert.equal(get('#meterValue').textContent,'—');
context.S.tx=false;context.C.authed=false;render();assert.equal(get('#meterValue').textContent,'—');
assert.ok(draws>0,'Actual canvas drawing executes');
// Canvas backing store must follow the size on screen (CSS zoom / large monitors),
// otherwise the gauge is a stretched low-res bitmap.
const meter = get('#meterGauge');
assert.equal(meter.width, 420, 'backing store matches layout size at scale 1');
assert.equal(meter.height, 188, 'backing store height matches layout size');
meter.getBoundingClientRect = () => ({width: 840, height: 376});
render();
assert.equal(meter.width, 840, 'backing store follows CSS zoom / screen scale');
assert.equal(meter.height, 376, 'backing store height follows CSS zoom / screen scale');
console.log('Meter: RX, PO, SWR, persistence, RX/TX return, QRP and missing telemetry passed');
