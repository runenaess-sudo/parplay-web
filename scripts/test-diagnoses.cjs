const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks={}){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,
 {exports,URL,URLSearchParams,Date,console,require:id=>{if(!(id in mocks))throw Error(id);return mocks[id];}});return exports;
}
const id='10000000-0000-4000-8000-000000000001';
function api(allowed=true){
 const calls=[];let rpcError=null;
 class AdminAuthError extends Error{constructor(){super('Forbidden');this.status=403;}}
 const route=load('app/api/admin/diagnoses/route.ts',{
  '@/lib/admin-auth':{AdminAuthError,requireServerAdmin:async()=>{if(!allowed)throw new AdminAuthError();return{supabase:{rpc:async(name,args)=>{calls.push({name,args});return{data:{pending_count:3,rows:[]},error:rpcError};}}};}},
  'next/server':{NextResponse:{json:(data,options={})=>({data,status:options.status??200,headers:options.headers})}},
 });
 return{calls,route,fail(e){rpcError=e;}};
}
test('non-admin list, detail, count and status update denied before RPC',async()=>{
 const a=api(false);
 for(const query of ['', '?id='+id,'?count=1'])assert.equal((await a.route.GET(new Request('https://app.test/api/admin/diagnoses'+query))).status,403);
 assert.equal((await a.route.POST(new Request('https://app.test/api/admin/diagnoses',{method:'POST'}))).status,403);
 assert.equal(a.calls.length,0);
});
test('count reads only count RPC branch; no payload listing',async()=>{
 const a=api(),res=await a.route.GET(new Request('https://app.test/api/admin/diagnoses?count=1'));
 assert.equal(res.status,200);assert.equal(res.data.pending_count,3);assert.equal(a.calls[0].args.p_count_only,true);
 assert.match(res.headers['Cache-Control'],/no-store/);
});
test('detail and cursor forwarded separately; invalid cursor rejected',async()=>{
 const a=api();await a.route.GET(new Request('https://app.test/api/admin/diagnoses?id='+id));assert.equal(a.calls[0].args.p_id,id);
 const time='2026-10-18T10:00:00.000Z';await a.route.GET(new Request('https://app.test/api/admin/diagnoses?before='+time+'&before_id='+id));
 assert.equal(a.calls[1].args.p_before,time);
 assert.equal((await a.route.GET(new Request('https://app.test/api/admin/diagnoses?before='+time))).status,400);
});
test('review requires same origin, allowed lifecycle and expected status; conflict explicit',async()=>{
 const a=api();
 const req=(origin,status='Resolved')=>new Request('https://app.test/api/admin/diagnoses',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({id,status,expected_status:'Reviewing'})});
 assert.equal((await a.route.POST(req('https://evil.test'))).status,403);
 assert.equal((await a.route.POST(req('https://app.test','Deleted'))).status,400);
 assert.equal((await a.route.POST(req('https://app.test'))).status,200);
 assert.equal(a.calls[0].args.p_expected_status,'Reviewing');assert.equal(a.calls[0].name,'set_admin_diagnose_status_v1');
 a.fail({code:'40001',message:'private failure'});const res=await a.route.POST(req('https://app.test'));
 assert.equal(res.status,409);assert(!JSON.stringify(res).includes('private failure'));
});
test('copy is structured with local/server distinction and strips extra secrets',()=>{
 const {copyDiagnose}=load('src/lib/diagnoses.ts');
 const cells={[id]:{1:{score:3,token:'SECRET'}}};
 const text=copyDiagnose({id,status:'New',created_at:'now',payload:{submitter_id:id,display_name:'Player',round_id:id,mode:'casual',course_id:id,layout_id:id,
  app_version:'1',app_build:'52',platform:'android',os_version:'35',client_captured_at:'client',server_captured_at:'server',scores_differ:true,guest_scores_differ:false,
  local_scores:cells,guest_scores:{},server_scores:{},server_guest_scores:{},operations:[{id,revision:1,status:'failed',Authorization:'SECRET'}],
  error:{code:'22023',reason:'REGULAR_SCORE_HOLE_INVALID',message:'Bearer SECRET'},access_token:'SECRET'}});
 assert(!text.includes('SECRET'));assert.match(text,/locally_recorded/);assert.match(text,/server_confirmed/);assert.match(text,/not confirmations/);assert.match(text,/REGULAR_SCORE_HOLE_INVALID/);
});
test('navigation count has no polling; list and detail fetched separately with bounded pagination',()=>{
 const link=fs.readFileSync('src/components/admin/DiagnosesLink.tsx','utf8');const page=fs.readFileSync('app/admin/diagnoses/Diagnoses.tsx','utf8');
 assert.match(link,/count=1/);assert.doesNotMatch(link,/setInterval/);assert.match(page,/before_id/);assert.match(page,/diagnoses\?id=/);
 assert.match(page,/expected_status: detail.status/);assert.match(page,/Copy for Codex/);
});
