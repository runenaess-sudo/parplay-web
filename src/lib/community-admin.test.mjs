import * as jsx from 'react/jsx-runtime';
﻿import assert from 'node:assert/strict';
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


// Exercise the actual admin component handlers, with deterministic hook state.
function moderationUI(status = 'APPROVED', confirmed = true) {
 const states = ['APPROVED',null,'',0,0,[{id,category:'course',title:'Experience',body:'Comment',status,author_name:'Player',author_avatar:null,submitted_at:'2026-11-16T12:00:00Z',moderated_at:null,published_at:null,context_id:null,report_id:null}],false,false,null,null,false];
 let cursor=0;const calls=[],notices=[],events=[],prompts=[];const exports={};
 const code=ts.transpileModule(fs.readFileSync('app/admin/user-messages/UserMessages.tsx','utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const api={communityCategories,communityTabs:['PENDING','APPROVED','DECLINED','REPORTS'],communityPostsTabs:[{value:'APPROVED',label:'Accepted',count:'approved_count'}],communityModeratedEvent:'parplay:community-moderated'};
 vm.runInNewContext(code,{exports,Event,fetch:async(url,options)=>{calls.push({url,...JSON.parse(options.body)});return {ok:true,json:async()=>({success:true})};},window:{confirm:message=>{prompts.push(message);return confirmed;},dispatchEvent:event=>events.push(event.type)},require:name=>{
  if(name==='react')return {useEffect(){},useRef:value=>({current:value}),useState:initial=>{const slot=cursor++;const value=slot<states.length?states[slot]:initial;return [value,next=>{states[slot]=typeof next==='function'?next(states[slot]):next;if(slot===9)notices.push(states[slot]);}];}};
  if(name==='@/lib/community-admin')return api;
  if(name==='next/link')return {default:()=>null};
  if(name==='react/jsx-runtime')return jsx;
  throw Error('Unexpected module '+name);
 }});
 const tree=exports.default({postsOnly:true});
 function find(element,label){if(!element||typeof element!=='object')return null;if(element.props?.['aria-label']===label)return element;for(const child of [element.props?.children].flat(Infinity)){const result=find(child,label);if(result)return result;}return null;}
 return {deleteButton:find(tree,'Delete approved Community post'),calls,states,notices,events,prompts};
}

test('approved post Delete confirms and reuses audited DECLINED moderation, never physical deletion',async()=>{
 const ui=moderationUI();assert.ok(ui.deleteButton);ui.deleteButton.props.onClick();ui.deleteButton.props.onClick();await new Promise(setImmediate);
 assert.equal(ui.prompts.length,1);assert.match(ui.prompts[0],/original round and moderation history/);
 assert.deepEqual(ui.calls,[{url:'/api/admin/user-messages',id,decision:'DECLINED'}]);
 assert.equal(ui.states[5].length,0);assert.ok(ui.notices.some(value=>value?.includes('removed from public Community')));assert.deepEqual(ui.events,['parplay:community-moderated']);
});
test('cancelled Delete does nothing and pending/declined entries do not receive the approved Delete action',async()=>{
 const ui=moderationUI('APPROVED',false);ui.deleteButton.props.onClick();await new Promise(setImmediate);assert.equal(ui.calls.length,0);assert.equal(ui.states[5].length,1);
 assert.equal(moderationUI('PENDING').deleteButton,null);assert.equal(moderationUI('DECLINED').deleteButton,null);
});
test('existing removal keeps public visibility, reaction restrictions, audit and round uniqueness boundaries',()=>{
 const core=fs.readFileSync('../parplay/supabase/migrations/20261221_community_core_v1.sql','utf8');
 const moderation=fs.readFileSync('../parplay/supabase/migrations/20280102_community_course_moderation_v1.sql','utf8');
 const round=fs.readFileSync('../parplay/supabase/migrations/20280101_community_round_experiences_v1.sql','utf8');
 assert.match(core,/where p.status='APPROVED'/);assert.match(core,/where id=p_post_id and status='APPROVED' for update/);
 assert.match(moderation,/if post.status<>'PENDING' then/);assert.match(moderation,/COMMUNITY_MODERATION_CONFLICT/);
 assert.match(moderation,/insert into public.community_moderation_audit/);assert.match(moderation,/else null end/);
 assert.doesNotMatch(moderation,/(?:update|delete from) public.rounds\b|delete from public.community_posts/);
 assert.match(round,/unique\(source_round_id\)/);
});
