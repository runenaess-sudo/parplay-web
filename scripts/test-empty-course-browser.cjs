/* eslint-disable @typescript-eslint/no-require-imports */
// Real Chrome + real React/Zustand/editor panel. Transport is explicitly local
// and simulated; this test is NOT evidence of production Supabase permissions.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'parplay-empty-course-'));
const write=(name,value)=>fs.writeFileSync(path.join(tmp,name),value);
const chrome='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
write('loader.cjs',`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=function(source){if(this.resourcePath.endsWith('EditorPanel.tsx'))source=source.replace("import AddAlternateHole from './AddAlternateHole';","const AddAlternateHole=()=>null;");return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;};`);
write('elevation.ts','export async function getElevation(){return null;}');
write('transport.ts',`export const rows:any[]=[];export const features:any[]=[];let sequence=0;export let failSave=false;
export function config(h:any){return {...h,play_config_id:'config-'+h.id,tee_id:'tee-'+h.id,basket_id:'basket-'+h.id,is_default:true,features:features.filter(f=>f.hole_id===h.id)};}
export const supabaseBrowser={auth:{getSession:async()=>({}),getUser:async()=>({data:{user:{id:'fixture-user'}}})},from(table:string){let payload:any,id:string;return {insert(p:any){payload=p;return this;},select(){return this;},eq(k:string,v:string){id=v;return this;},update(p:any){payload=p;return this;},async single(){if(table!=='holes')throw Error('Unexpected table');if(!id){const row={...payload,id:'fixture-hole-'+(++sequence)};rows.push(row);return {data:{...row},error:null};}return {data:rows.find(h=>h.id===id),error:null};}};},async rpc(name:string,p:any){if(name==='resolve_hole_play_config_v1')return {data:config(rows.find(h=>h.id===p.p_hole_id)),error:null};if(name==='get_course_variant_editor_v5')return {data:{configs:rows.map(h=>({...config(h),id:'config-'+h.id,hole_id:h.id})),tees:rows.map(h=>({id:'tee-'+h.id,label:'Main',latitude:h.tee_latitude,longitude:h.tee_longitude,elevation:null,usage:[{hole_id:h.id}]})),baskets:rows.map(h=>({id:'basket-'+h.id,label:'Main',latitude:h.basket_latitude,longitude:h.basket_longitude,elevation:null,usage:[{hole_id:h.id}]}))},error:null};if(name==='save_hole_variant_draft_v5'){if(failSave)return {error:{code:'42501',message:'Fixture denied'}};Object.assign(rows.find(h=>h.id===p.p_hole_id),{tee_latitude:p.p_tee.latitude,tee_longitude:p.p_tee.longitude,basket_latitude:p.p_basket.latitude,basket_longitude:p.p_basket.longitude,par:p.p_config.par,fairway:p.p_config.fairway,distance:p.p_config.distance});return {data:p.p_config.id,error:null};}if(name==='create_play_config_feature_v5'){features.push({...p.p_feature,id:p.p_feature_id,hole_id:p.p_hole_id});return {data:p.p_feature_id,error:null};}throw Error('Unexpected RPC '+name);}};`);
write('entry.tsx',`import React from 'react';import{createRoot}from'react-dom/client';import EditorPanel from ${JSON.stringify(path.join(root,'app/create-course/editor/[courseId]/EditorPanel.tsx'))};import{useCourseEditor}from'@/state/useCourseEditor';import{rows,features,config}from'./transport';
const course={id:'fixture-course',name:'Local test course',latitude:59.1279876,longitude:11.3463802,holes:[]};useCourseEditor.getState().loadAll(course);
createRoot(document.getElementById('root')!).render(<><h1>Local fixture - no production backend</h1><EditorPanel/><EditorPanel toolsOnly/></>);
(window as any).fixture={store:useCourseEditor,rows,features,reload(){useCourseEditor.getState().loadAll({...course,holes:rows.map(h=>({...h,...config(h),hole_features:features.filter(f=>f.hole_id===h.id)}))});}};`);
let browser,server;
(async()=>{
 const webpack=require('next/dist/compiled/webpack/webpack').webpack;
 await new Promise((resolve,reject)=>webpack({mode:'development',devtool:false,entry:path.join(tmp,'entry.tsx'),output:{path:tmp,filename:'bundle.js'},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(tmp,'loader.cjs')}]},resolve:{extensions:['.tsx','.ts','.js'],modules:[path.join(root,'node_modules'),'node_modules'],alias:{'@/lib/supabase-browser':path.join(tmp,'transport.ts'),'@/utils/elevation':path.join(tmp,'elevation.ts'),'@':path.join(root,'src')}}},(error,stats)=>error||stats.hasErrors()?reject(error||Error(stats.toString({all:false,errors:true}))):resolve()));
 server=http.createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(tmp,'bundle.js')));}else res.end('<!doctype html><html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=cp.spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+path.join(tmp,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 const endpoint=await new Promise((resolve,reject)=>{let text='';const timeout=setTimeout(()=>reject(Error('Chrome startup timeout')),15000);browser.stderr.on('data',data=>{text+=data;const match=text.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});browser.on('error',reject);});
 const port=new URL(endpoint).port;const page=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));let id=0;const pending=new Map();ws.addEventListener('message',event=>{const data=JSON.parse(event.data);if(pending.has(data.id)){pending.get(data.id)(data);pending.delete(data.id);}});
 const send=(method,params)=>new Promise(resolve=>{const next=++id;pending.set(next,resolve);ws.send(JSON.stringify({id:next,method,params}));});
 await send('Page.enable',{});await send('Runtime.enable',{});
 const loaded=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Page load timeout')),10000);ws.addEventListener('message',event=>{if(JSON.parse(event.data).method==='Page.loadEventFired'){clearTimeout(timeout);resolve();}});});
 await send('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await loaded;
 const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
 const wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,50));}throw Error('UI timeout');};
 const click=text=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);if(!b||b.disabled)throw Error('Unavailable '+text);b.click();};
 await wait(()=>window.fixture&&[...document.querySelectorAll('button')].some(b=>b.textContent==='Create Hole 1'));
 click('Create Hole 1');await wait(()=>window.fixture.store.getState().selectedHoleId);const f=window.fixture,hole=f.store.getState().selectedHoleId;
 for(const [label,mode] of [['Set Tee','tee'],['Set Basket','basket'],['Set Points','points']]){click(label);await wait(()=>f.store.getState().mode===mode);const s=f.store.getState();if(mode==='tee')s.setTee(hole,11.3463,59.128);else if(mode==='basket')s.setBasket(hole,11.347,59.129);else s.addFairwayPoint(hole,11.3466,59.1285);}
 click('OB AREA');await wait(()=>f.store.getState().featureTool==='OB_AREA');for(const p of [[11.346,59.128],[11.347,59.128],[11.347,59.129]])await f.store.getState().addFeatureCoordinate(...p);await f.store.getState().finishFeatureDrawing();
 click('Save Hole');await wait(()=>f.rows[0].tee_latitude===59.128&&f.rows[0].basket_latitude===59.129);const saved=JSON.parse(JSON.stringify(f.rows[0]));f.reload();await wait(()=>document.body.innerText.includes('Save Hole'));
 if(f.store.getState().course.holes[0].fairway.length!==1||f.features.length!==1)throw Error('Lost points/features');click('Add New Hole');await wait(()=>f.rows.length===2);
 return {saved,holes:f.rows.length,features:f.features.length};})()`});
 if(result.error)throw Error(JSON.stringify(result.error));
 if(result.result.exceptionDetails)throw Error(result.result.exceptionDetails.exception?.description||JSON.stringify(result.result.exceptionDetails));const data=result.result.result.value;
 assert.equal(data.saved.course_id,'fixture-course');assert.equal(data.saved.number,1);assert.equal(data.saved.par,3);assert.equal(data.holes,2);assert.equal(data.features,1);
 console.log('PASS: real Chrome/React empty-course UI -> Create Hole 1 -> modes -> points/features -> Save Hole -> fixture reload -> Hole 2.');
 console.log('LIMITATION: simulated local transport; no Supabase writes or production permission verification.');ws.close();
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>{browser?.kill();server?.close();});
