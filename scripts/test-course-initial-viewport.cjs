/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync('app/create-course/editor/[courseId]/MapCanvas.tsx','utf8');
class Bounds {constructor(a,b){this.points=[a,b];}extend(p){this.points.push(p);return this;}}
const compiled={exports:{}};
new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n==='mapbox-gl'?{default:{LngLatBounds:Bounds}}:{},compiled,compiled.exports);
const {createCourseViewportInitializer,embeddedViewportPadding}=compiled.exports;
const course={latitude:59.1279876,longitude:11.3463802,holes:[]};
function setup(){const calls=[];let bounds;const camera=createCourseViewportInitializer({cameraForBounds:(b)=>{bounds=b;return {center:b.points[0],zoom:18};},jumpTo:options=>calls.push({bounds,options})});return {camera,calls};}
test('new course uses saved coordinates in longitude/latitude order at placement zoom',()=>{const {camera,calls}=setup();const before=JSON.stringify(course);camera.update(course);assert.equal(calls.length,1);assert.deepEqual(calls[0].options.center,[11.3463802,59.1279876]);assert.equal(calls[0].options.zoom,17);assert.equal(JSON.stringify(course),before);});
test('existing valid tee and basket points take precedence over course center',()=>{const {camera,calls}=setup();camera.update({...course,holes:[{tee_longitude:10,tee_latitude:60,basket_longitude:10.01,basket_latitude:60.01},{tee_longitude:NaN,tee_latitude:60}]});assert.equal(calls.length,1);assert.deepEqual(calls[0].bounds.points,[[10,60],[10,60],[10,60],[10.01,60.01]]);assert.equal(calls[0].options.zoom,18);});
test('zero coordinates are valid; partial, non-finite and out-of-range hole points are ignored',()=>{const {camera,calls}=setup();camera.update({...course,holes:[{tee_longitude:0,tee_latitude:0},{tee_longitude:181,tee_latitude:60},{basket_longitude:10,basket_latitude:null}]});assert.deepEqual(calls[0].options.center,[0,0]);});
test('missing or invalid course/holes keep fallback until valid asynchronous data arrives',()=>{const {camera,calls}=setup();for(const data of [null,{}, {latitude:null,longitude:null},{latitude:91,longitude:10},{latitude:60,longitude:Infinity}])camera.update(data);assert.equal(calls.length,0);camera.update(course);assert.equal(calls.length,1);});
test('asynchronous hole positions initialize without requiring a course center',()=>{const {camera,calls}=setup();camera.update({holes:[]});camera.update({holes:[{basket_longitude:10,basket_latitude:60}]});assert.equal(calls.length,1);assert.deepEqual(calls[0].options.center,[10,60]);});
test('updates, edits and returning to a still-mounted Holes step never repeat initialization',()=>{const {camera,calls}=setup();camera.update(course);camera.update({...course,latitude:61});camera.update({...course,holes:[{tee_longitude:12,tee_latitude:62}]});assert.equal(calls.length,1);});
test('manual pan/zoom before asynchronous data prevents later camera override',()=>{const {camera,calls}=setup();camera.update({});camera.interacted();camera.update(course);assert.equal(calls.length,0);});
test('fresh map opening gets its own initializer',()=>{const first=setup(),second=setup();first.camera.update(course);second.camera.update(course);assert.equal(first.calls.length,1);assert.equal(second.calls.length,1);});
test('integration is opt-in for embedded editor and removes manual interaction listeners',()=>{const editor=fs.readFileSync('app/create-course/editor/[courseId]/CourseEditor.tsx','utf8');assert.ok(editor.includes('initializeCourseViewport={embedded}'));assert.ok(source.includes('initializeCourseViewport = false'));assert.ok(source.includes('if (initializeCourseViewport) initialViewportRef.current?.update(course)'));for(const event of ['pointerdown','wheel','keydown']){assert.ok(source.includes('container.addEventListener("'+event+'", interacted'));assert.ok(source.includes('container.removeEventListener("'+event+'", interacted'));}assert.ok(!source.includes('geolocation'));assert.ok(source.includes('if (initializeCourseViewport && !initialSelectionSkipped.current)'));});

test('embedded padding uses actual panel overlap and preserves at least 64px of map',()=>{
 assert.deepEqual(embeddedViewportPadding(1000,600,256,260),{left:272,right:276,top:120,bottom:80});
 const narrow=embeddedViewportPadding(360,300,256,260);assert.ok(narrow.left+narrow.right<=296);assert.equal(narrow.top,120);
 const tiny=embeddedViewportPadding(100,100,0,0);assert.ok(tiny.left+tiny.right<=36);assert.ok(tiny.top+tiny.bottom<=36);
 assert.deepEqual(embeddedViewportPadding(800,600,0,0),{left:20,right:20,top:120,bottom:80});
});
test('initial bounds and course fallback use panel padding without retaining global camera padding',()=>{
 const calls=[];const padding={left:272,right:276,top:120,bottom:80};
 const map={jumpTo:options=>calls.push(options)};
 createCourseViewportInitializer(map,()=>padding).update(course);
 createCourseViewportInitializer(map,()=>padding).update({holes:[{tee_longitude:10,tee_latitude:60}]});
 for(const options of calls){assert.deepEqual(options.padding,padding);assert.equal(options.retainPadding,false);}
});

test('initialization waits for readiness and retries camera calculation failures instead of settling',()=>{
 const calls=[];let ready=false,canFit=false;
 const map={cameraForBounds:()=>canFit?{center:[10,60],zoom:16}:undefined,jumpTo:options=>calls.push(options)};
 const camera=createCourseViewportInitializer(map,()=>20,()=>ready);
 const data={holes:[{tee_longitude:10,tee_latitude:60,basket_longitude:11,basket_latitude:61}]};
 camera.update(data);assert.equal(calls.length,0);ready=true;camera.update(data);assert.equal(calls.length,0);canFit=true;camera.update(data);assert.equal(calls.length,1);camera.update(course);assert.equal(calls.length,1);
});
test('numeric coordinate strings are normalized without accepting empty or invalid values',()=>{const {camera,calls}=setup();camera.update({...course,latitude:'59.1279876',longitude:'11.3463802'});assert.deepEqual(calls[0].options.center,[11.3463802,59.1279876]);});
