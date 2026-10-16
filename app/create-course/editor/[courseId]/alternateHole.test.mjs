import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const root='app/create-course/editor/[courseId]/';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'alternateHole.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
const {configurationName,sortedPoints,matchingConfiguration}=exports;
const source=fs.readFileSync(root+'AddAlternateHole.tsx','utf8');const ast=ts.createSourceFile('a.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let saveSource;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='save')saveSource=n.getText(ast);ts.forEachChild(n,visit);}visit(ast);
function fixture({failure=false,existing=false}={}){
 const calls=[];const tee={id:'t1',label:'Tee',latitude:60,longitude:10},basket={id:'b18',label:'Basket',latitude:61,longitude:11};
 const configs=[{id:'main',hole_id:'h1',is_default:true,tee_id:'t1',basket_id:'b1',par:3}];if(existing)configs.push({id:'existing',hole_id:'h1',tee_id:'t1',basket_id:'b18',par:3});
 const state={saved:'',error:''};let release;
 const ctx={tee,basket,teeId:tee.id,basketId:basket.id,holeId:'h1',number:1,lock:{current:false},requestId:{current:null},saved:'',read:async()=>({configs}),matchingConfiguration,configurationName,calculateHoleLength:()=>80,crypto:{randomUUID:()=> 'new'},setBusy(){},setError:e=>state.error=e,setSaved:s=>state.saved=s,setData(){},setSubmitted(){},window:{dispatchEvent(){}},Event:class {},db:{rpc:async(name,args)=>{calls.push({name,args});await new Promise(r=>release=r);return failure?{error:{message:'Offline'}}:{data:'new'};}}};
 const save=vm.runInNewContext(ts.transpileModule(saveSource+';save;',{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,ctx);
 return {ctx,calls,state,save,release:()=>release()};
}
test('legacy names are retained; only server suffix produces alphabetic identity',()=>{assert.equal(configurationName({id:'x',label:'Blue'},1),'Alternate - Blue');assert.equal(configurationName({alternate_suffix:'C'},1),'Hole 1C - Alternate');});
test('current-hole points sort first without filtering other course points',()=>{const points=[{id:'other',label:'A',usage:[{hole_id:'h18',number:18}]},{id:'local',label:'Z',usage:[{hole_id:'h1',number:1}]}];assert.equal(sortedPoints(points,'h1')[0].id,'local');assert.equal(points[0].id,'other');});
test('same-hole and cross-hole physical combinations match by IDs, not labels',()=>{for(const basket of ['b1','b18'])assert.ok(matchingConfiguration([{hole_id:'h1',tee_id:'t1',basket_id:basket}],'h1','t1',basket));assert.equal(matchingConfiguration([{hole_id:'h2',tee_id:'t1',basket_id:'b18'}],'h1','t1','b18'),undefined);});
test('repeated Save is locked; shared endpoints use null physical payload and empty fairway',async()=>{const f=fixture();const first=f.save();await new Promise(resolve=>setImmediate(resolve));await f.save();assert.equal(f.calls.length,1);const args=f.calls[0].args;assert.equal(args.p_tee,null);assert.equal(args.p_basket,null);assert.equal(args.p_config.fairway.length,0);assert.equal(args.p_config.basket_id,'b18');assert.equal(args.p_hole_id,'h1');f.release();await first;assert.ok(f.state.saved);});
test('failure preserves request ID for retry and does not claim success',async()=>{const f=fixture({failure:true});const first=f.save();await new Promise(resolve=>setImmediate(resolve));f.release();await first;assert.equal(f.state.saved,'');assert.equal(f.state.error,'Offline');const retry=f.save();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.calls[0].args.p_config.id,f.calls[1].args.p_config.id);f.release();await retry;});
test('existing published or draft combination is not inserted again',async()=>{const f=fixture({existing:true});await f.save();assert.equal(f.calls.length,0);assert.match(f.state.error,/already exists/);});
test('preview and cancel have no editor or layout persistence path',()=>{assert.ok(source.includes('<MapCanvas key={teeId'));assert.ok(source.includes('readOnly course={preview}'));assert.ok(source.includes('dialog.current?.close()'));assert.ok(!source.includes('useCourseEditor'));assert.ok(!source.includes('layout_holes'));assert.ok(!source.includes('saveHole'));});
