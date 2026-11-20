/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-this-alias */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync('app/create-course/editor/[courseId]/MapCanvas.tsx','utf8');
const jsx=(type,props)=>({type,props});
function harness({initialize=true,mode="none",featureTool=null,course={id:'course',longitude:11.3463802,latitude:59.1279876,holes:[]}}={}){
 const events={},effects=[],updates=[],jumps=[],styles=[],edits=[],sources=new Map(),layers=new Map();let instance;
 const container={clientWidth:1200,clientHeight:700,parentElement:{querySelector:()=>null},getBoundingClientRect:()=>({width:1200,height:700,left:0,right:1200,top:0,bottom:700}),addEventListener:(name,fn)=>{events[name]=fn;},removeEventListener:name=>{delete events[name];}};
 class Bounds{constructor(a,b){this.points=[a,b];}extend(p){this.points.push(p);return this;}}
 class MapMock{
 constructor(options){instance=this;this.options=options;this.listeners={};this.images=new Set();this.ready=false;}
 on(name,...args){(this.listeners[name]??=[]).push(args.at(-1));return this;}
 off(){return this;}getContainer(){return container;}getCanvas(){return {style:{}};}isStyleLoaded(){return this.ready;}resize(){}remove(){this.removed=true;}
 queryRenderedFeatures(){return [];}loadImage(src,cb){cb(null,{});}hasImage(id){return this.images.has(id);}addImage(id){this.images.add(id);}
 addSource(id,value){assert.equal(sources.has(id),false,'duplicate source '+id);sources.set(id,{data:value.data,setData(data){this.data=data;}});}getSource(id){return sources.get(id);}
 addLayer(layer){assert.equal(layers.has(layer.id),false,'duplicate layer '+layer.id);layers.set(layer.id,layer);}getLayer(id){return layers.get(id);}
 jumpTo(options){jumps.push(options);}cameraForBounds(){return {center:[11.34,59.12],zoom:17};}
 setStyle(style){styles.push(style);this.ready=false;sources.clear();layers.clear();this.images.clear();}
 }
 let refIndex=0;const react={useRef:value=>({current:refIndex++===0?container:value}),useEffect:f=>effects.push(f),useState:init=>[init,value=>updates.push(value)]};
 const m={exports:{}};new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n==='react'?react:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='mapbox-gl'?{default:{Map:MapMock,LngLatBounds:Bounds}}:{},m,m.exports);
 const oldWindow=global.window,oldObserver=global.ResizeObserver;global.window={addEventListener(){},removeEventListener(){},innerWidth:1200};global.ResizeObserver=class{observe(){}disconnect(){}};
 const tree=m.exports.MapCanvas({initializeCourseViewport:initialize,readOnly:false,course,selectedHoleId:'hole',mode,featureTool,drawingCoordinates:[],onSetTee:(...args)=>edits.push(['tee',...args]),onSetBasket:(...args)=>edits.push(['basket',...args]),onAddFairwayPoint:(...args)=>edits.push(['points',...args]),onAddFeatureCoordinate:(...args)=>edits.push(['feature',...args])});const cleanup=effects.map(f=>f());
 const emit=async(name)=>{for(const fn of instance.listeners[name]??[])await fn({});};
 const walk=(e,type)=>!e||typeof e!=='object'?[]:[...(e.type===type?[e]:[]),...[e.props?.children].flat(Infinity).flatMap(c=>walk(c,type))];
 return {instance,tree,jumps,styles,sources,layers,events,emit,walk,course,edits,close(){cleanup.forEach(fn=>fn?.());global.window=oldWindow;global.ResizeObserver=oldObserver;}};
}
test('real MapCanvas receives Halden coordinates before style readiness and initializes on style load',async()=>{const h=harness();try{assert.deepEqual(h.instance.options.center,[11.3463802,59.1279876]);assert.equal(h.instance.options.style,'mapbox://styles/mapbox/satellite-streets-v12');assert.equal(h.jumps.length,0);h.instance.ready=true;await h.emit('style.load');assert.equal(h.jumps.length,1);assert.deepEqual(h.jumps[0].center,[11.3463802,59.1279876]);assert.ok(h.sources.has('tee-source'));assert.ok(h.layers.has('basket-layer'));}finally{h.close();}});
test('style switch restores editor sources, features and single editing handlers; Go to Course remains available',async()=>{const h=harness();try{const before=JSON.stringify(h.course);h.instance.ready=true;await h.emit('style.load');const count=(h.instance.listeners.click??[]).length;
 for(const value of ['streets','satellite','streets']){h.walk(h.tree,'select')[0].props.onChange({target:{value}});assert.equal(h.jumps.length,1,'style change must not recenter');h.instance.ready=true;await h.emit('style.load');assert.equal(h.instance.listeners.click.length,count);for(const id of ['tee-source','basket-source','fairway-source','hole-feature-area-source'])assert.ok(h.sources.has(id),id);}
 assert.deepEqual(h.styles,['mapbox://styles/mapbox/streets-v12','mapbox://styles/mapbox/satellite-streets-v12','mapbox://styles/mapbox/streets-v12']);
 h.walk(h.tree,'button').find(b=>b.props.children==='Go to Course').props.onClick();assert.deepEqual(h.jumps.at(-1).center,[11.3463802,59.1279876]);assert.equal(JSON.stringify(h.course),before);
 }finally{h.close();}});
test('manual interaction before readiness prevents later automatic repositioning but explicit Go to Course works',async()=>{const h=harness();try{h.events.pointerdown();h.instance.ready=true;await h.emit('style.load');assert.equal(h.jumps.length,0);h.walk(h.tree,'button')[0].props.onClick();assert.equal(h.jumps.length,1);}finally{h.close();}});
test('standalone editor retains its original style and exposes no Create Course controls',async()=>{const h=harness({initialize:false});try{assert.equal(h.instance.options.style,'mapbox://styles/mapbox/satellite-v9');assert.deepEqual(h.instance.options.center,[10.5,60]);assert.equal(h.walk(h.tree,'button').length,0);assert.ok(h.instance.listeners.load);assert.equal(h.instance.listeners['style.load'],undefined);}finally{h.close();}});
test('Step 1 passes only confirmed saved coordinates through wizard to embedded MapCanvas',()=>{const form=fs.readFileSync('src/components/course-wizard/WizardForms.tsx','utf8'),wizard=fs.readFileSync('src/components/course-wizard/CourseWizard.tsx','utf8'),editor=fs.readFileSync('app/create-course/editor/[courseId]/CourseEditor.tsx','utf8');assert.ok(form.includes('created(id, { latitude: validation.latitude, longitude: validation.longitude })'));assert.ok(form.indexOf('}).then(id =>')<form.indexOf('created(id, { latitude:'));assert.ok(wizard.includes('courseLocation={savedLocation ?? initial.basic}'));assert.ok(editor.includes('course={embedded && courseLocation ? { ...course, ...courseLocation } : course}'));});

test('Tee, Basket, Points and Features retain the same click behavior after map switching',async()=>{
 for(const mode of ['tee','basket','points','feature']){
  const h=harness({mode:mode==='feature'?'none':mode,featureTool:mode==='feature'?'OB_AREA':null});
  try{h.instance.ready=true;await h.emit('style.load');h.walk(h.tree,'select')[0].props.onChange({target:{value:'streets'}});h.instance.ready=true;await h.emit('style.load');
   h.instance.listeners.click[0]({lngLat:{lng:11.35,lat:59.13},point:{x:10,y:10}});
   assert.deepEqual(h.edits,[mode==='feature'?['feature',11.35,59.13]:[mode,'hole',11.35,59.13]]);
  }finally{h.close();}
 }
});
