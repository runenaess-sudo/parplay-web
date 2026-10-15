import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

class AuthError extends Error { constructor(status){super('Denied');this.status=status;} }
function routes({denied=false,rpcError=null}={}) {
 const calls=[],exports={};
 const requireServerAdmin=async()=>{if(denied)throw new AuthError(403);return {supabase:{rpc:async(name,args)=>{calls.push({name,args});return rpcError?{error:{message:rpcError}}:{data:{items:[],total:0,has_more:false}};}}};};
 const code=ts.transpileModule(fs.readFileSync('app/api/admin/foundation-fame/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,URL,require:name=>name==='@/lib/admin-auth'?{AdminAuthError:AuthError,requireServerAdmin}:{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}}});
 return {...exports,calls};
}
function request(state='QUALIFIED',origin='https://parplay.test') {return new Request('https://parplay.test/api/admin/foundation-fame',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({id:'00000000-0000-4000-8000-000000000001',state})});}
test('non-admin reads and decisions are denied before any RPC',async()=>{const r=routes({denied:true});assert.equal((await r.GET(new Request('https://parplay.test/api/admin/foundation-fame'))).status,403);assert.equal((await r.POST(request())).status,403);assert.equal(r.calls.length,0);});
test('all review filters use protected workspace pagination',async()=>{for(const tab of ['PENDING','QUALIFIED','REJECTED','ALL']){const r=routes();assert.equal((await r.GET(new Request('https://parplay.test/api/admin/foundation-fame?tab='+tab+'&offset=20'))).status,200);assert.equal(r.calls[0].name,'get_foundation_admin_workspace_v1');assert.equal(r.calls[0].args.p_tab,tab);assert.equal(r.calls[0].args.p_offset,20);}});
test('approval and both rejection categories use guarded decision RPC',async()=>{for(const state of ['QUALIFIED','INVALID','DUPLICATE']){const r=routes();assert.equal((await r.POST(request(state))).status,200);assert.equal(r.calls[0].name,'decide_foundation_pending_contribution_v1');assert.equal(r.calls[0].args.p_state,state);}});
test('duplicate decisions and unpublished courses are conflicts; failures do not succeed',async()=>{for(const rpcError of ['FOUNDATION_ALREADY_REVIEWED','FOUNDATION_PUBLISHED_CONTRIBUTION_REQUIRED'])assert.equal((await routes({rpcError}).POST(request())).status,409);assert.equal((await routes({rpcError:'offline'}).POST(request())).status,500);});
test('invalid filters, states and cross-origin requests do not call RPCs',async()=>{const r=routes();for(const query of ['tab=INVALID','offset=-1','offset=1.5'])assert.equal((await r.GET(new Request('https://parplay.test/api/admin/foundation-fame?'+query))).status,400);assert.equal((await r.POST(request('DELETE'))).status,400);assert.equal((await r.POST(request('QUALIFIED','https://other.test'))).status,403);assert.equal(r.calls.length,0);});
test('UI requires confirmation and refreshes only after server confirmation',()=>{const s=fs.readFileSync('app/admin/foundation-fame/FoundationFame.tsx','utf8');const action=s.slice(s.indexOf('async function decide'),s.indexOf('    return <main'));assert.ok(action.indexOf('window.confirm')<action.indexOf("method: 'POST'"));assert.ok(action.indexOf('if (!response.ok) throw')<action.indexOf('setRevision'));assert.ok(action.includes('locked.current = true'));assert.ok(!action.includes('setItems('));});
