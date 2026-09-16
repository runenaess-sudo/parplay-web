import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parseCommunityQuery, communityCategories } from './community-admin.ts';

test('canonical categories and bounded query parameters', () => {
 assert.equal(Object.keys(communityCategories).length,9);
 assert.deepEqual(parseCommunityQuery(new URLSearchParams('tab=DECLINED&category=course&offset=20')), {p_tab:'DECLINED',p_category:'course',p_limit:20,p_offset:20});
 for(const input of ['tab=bogus','category=toString','offset=-1','offset=10001','offset=1.5']) assert.throws(()=>parseCommunityQuery(new URLSearchParams(input)));
});
class AuthError extends Error { constructor(status){super('Denied');this.status=status;} }
function routes({denied=false,rpcError=false}={}) {
 const calls=[];const exports={};
 const requireServerAdmin=async()=>{if(denied)throw new AuthError(403);return {supabase:{rpc:async(name,args)=>{calls.push({name,args});return rpcError?{error:Error('failed')}:{data:{items:[],has_more:false}};}}};};
 const code=ts.transpileModule(fs.readFileSync('app/api/admin/user-messages/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,URL,require:name=>name==='@/lib/admin-auth'?{AdminAuthError:AuthError,requireServerAdmin}:name==='@/lib/community-admin'?{parseCommunityQuery}:{NextResponse:{json:(body,options={})=>({body,status:options.status??200})}}});
 return {...exports,calls};
}
const id='00000000-0000-4000-8000-000000000001';
function request(decision='APPROVED',origin='https://parplay.test') {return new Request('https://parplay.test/api/admin/user-messages',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({id,decision})});}
test('non-admin cannot load or moderate and no RPC is called',async()=>{const r=routes({denied:true});assert.equal((await r.GET(new Request('https://parplay.test/api/admin/user-messages'))).status,403);assert.equal((await r.POST(request())).status,403);assert.equal(r.calls.length,0);});
test('admin queue is bounded and passes category to secure RPC',async()=>{const r=routes();assert.equal((await r.GET(new Request('https://parplay.test/api/admin/user-messages?tab=REPORTS&offset=20'))).status,200);assert.equal(r.calls[0].name,'get_community_workspace_v1');assert.equal(r.calls[0].args.p_limit,20);});
test('approve and decline use only moderation RPC; backend failure never succeeds',async()=>{for(const decision of ['APPROVED','DECLINED']){const r=routes();assert.equal((await r.POST(request(decision))).status,200);assert.equal(r.calls[0].name,'moderate_community_post_v1');assert.equal(r.calls[0].args.p_decision,decision);}assert.equal((await routes({rpcError:true}).POST(request())).status,500);});
test('invalid actions and cross-origin writes are rejected',async()=>{const r=routes();assert.equal((await r.POST(request('DELETE'))).status,400);assert.equal((await r.POST(request('APPROVED','https://elsewhere.test'))).status,403);assert.equal(r.calls.length,0);});
