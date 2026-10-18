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
 for(const query of ['', '?id='+id,'?count=1','?view=new','?view=finished'])assert.equal((await a.route.GET(new Request('https://app.test/api/admin/diagnoses'+query))).status,403);
 assert.equal((await a.route.POST(new Request('https://app.test/api/admin/diagnoses',{method:'POST'}))).status,403);
 assert.equal(a.calls.length,0);
});
test('count reads only count RPC branch; no payload listing',async()=>{
 const a=api(),res=await a.route.GET(new Request('https://app.test/api/admin/diagnoses?count=1'));
 assert.equal(res.status,200);assert.equal(res.data.pending_count,3);assert.equal(a.calls[0].args.p_count_only,true);
 assert.match(res.headers['Cache-Control'],/no-store/);
});
test('status tabs filter server-side with cursor; detail and count retain existing RPC',async()=>{
 const a=api();
 for(const view of ['new','finished']){
  await a.route.GET(new Request('https://app.test/api/admin/diagnoses?view='+view+'&before=2026-10-18T10:00:00Z&before_id='+id));
  const call=a.calls.at(-1);assert.equal(call.name,'get_admin_diagnoses_by_status_v1');
  assert.equal(call.args.p_finished,view==='finished');assert.equal(call.args.p_before_id,id);
 }
 for(const query of ['?view=new&count=1','?view=finished&id='+id]){
  await a.route.GET(new Request('https://app.test/api/admin/diagnoses'+query));
  assert.equal(a.calls.at(-1).name,'get_admin_diagnoses_v1');
 }
 const count=a.calls.length;
 assert.equal((await a.route.GET(new Request('https://app.test/api/admin/diagnoses?view=deleted'))).status,400);
 assert.equal(a.calls.length,count);
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

test('whole outbox export preserves Tournament subjects and strips arbitrary fields without a round',()=>{
 const {copyOutbox,copyDiagnose}=load('src/lib/diagnoses.ts');
 const op={id,stream_id:id,revision:1,mode:'tournament',status:'failed',attempts:3,next_retry_at:100,created_at:10,
  tournament_id:id,round_id:id,session_id:id,card_id:id,scorer_player_id:id,hole_id:id,
  subjects:[{player_id:id,score:4,token:'SECRET'}],Authorization:'SECRET'};
 const queue={operations:[op],total_pending:1,pending_by_mode:{tournament:1,SECRET:5},blocking_operation:op,later_pending_by_mode:{},first_failed_operation_id:id};
 const text=copyDiagnose({id,status:'New',created_at:'now',payload:{mode:'outbox',round_id:null,local_scores:{},guest_scores:{},server_scores:{},server_guest_scores:{},operations:[],outbox:queue,error:{code:null,reason:'SCORECARD_CARD_FINISHED'}}});
 assert(!text.includes('SECRET'));assert.match(text,/no server score comparison/i);
 const clean=copyOutbox(queue);assert.equal(clean.blocking_operation.subjects[0].score,4);assert.equal(clean.operations[0].session_id,id);
});
