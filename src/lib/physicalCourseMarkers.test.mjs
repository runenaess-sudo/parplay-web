import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
function load(file,imports={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText)(n=>imports[n]||{},m,m.exports);return m.exports;}
class Element{constructor(){this.style={};this.children=[];this.events={};}setAttribute(){}append(x){this.children.push(x);}addEventListener(n,f){this.events[n]=f;}}
global.document={createElement:()=>new Element(),createTextNode:t=>t};
class Marker{constructor({element}){this.element=element;}setLngLat(p){this.position=p;return this;}setPopup(){return this;}addTo(){return this;}togglePopup(){this.clicked=true;}}
class Popup{setText(){return this;}}
const {mountPhysicalMarkers}=load('app/create-course/editor/[courseId]/PhysicalPointsMap.tsx',{'mapbox-gl':{default:{Marker,Popup}}});
const {physicalMarkers}=load('src/lib/physicalCourseMarkers.ts');
const point={id:'t',latitude:60,longitude:10};
const config={id:'c',hole_id:'h',tee_id:'t',basket_id:'b',number:1,is_default:true};
test('overlapping shared holes have one numbered tee and one basket',()=>{
 const markers=physicalMarkers({tees:[point,point],baskets:[{...point,id:'b'}],configs:[config,{...config,id:'c2',number:2}]});
 assert.equal(markers.length,2);assert.equal(markers[0].holeNumbers,'1/2');
 const rendered=mountPhysicalMarkers({},markers,false,true);
 for(const marker of rendered){assert.equal(marker.element.style.background,'transparent');assert.equal(marker.element.style.border,'none');assert.deepEqual(marker.position,[10,60]);assert.ok(!marker.element.children.some(c=>typeof c==='string'));marker.element.events.click({stopPropagation(){}});assert.equal(marker.clicked,true);}
 assert.equal(rendered[0].element.children[1].textContent,'1/2');assert.equal(rendered[1].element.children.length,1);
});
test('editor keeps labeled markers',()=>{const [m]=mountPhysicalMarkers({},[{...point,kind:'basket',title:'Basket'}]);assert.ok(m.element.children.includes('BASKET'));assert.equal(m.element.style.width,'40px');});
test('layout input determines numbered markers without retained previous layout',()=>{for(const number of [1,9,1]){const markers=physicalMarkers({tees:[point],baskets:[],configs:[{...config,number}]});assert.equal(markers[0].holeNumbers,String(number));}});

