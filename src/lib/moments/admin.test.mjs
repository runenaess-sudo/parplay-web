import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';

function load(file, dependencies) {
    const exports={};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,
        {exports, URL, require: name=>{if(name in dependencies)return dependencies[name];throw Error(name);}});
    return exports;
}
const registry=load('src/lib/moments/registry.generated.ts',{});
class AuthError extends Error { constructor(status){super('Denied');this.status=status;} }
function routes({denied=false, conflict=false}={}) {
    const calls=[];
    const api=load('app/api/admin/moments/route.ts',{
        '@/lib/admin-auth':{AdminAuthError:AuthError,requireServerAdmin:async()=>{
            if(denied)throw new AuthError(403);
            return {supabase:{rpc:async(name,args)=>{calls.push({name,args});return conflict?{error:{code:'40001'}}:{data:[]};}}};
        }},
        'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status??200,headers:options.headers})}},
    });
    return {...api,calls};
}
function request(body={type:'weekly_rating_update',enabled:false,revision:0},origin='https://parplay.test') {
    return new Request('https://parplay.test/api/admin/moments',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
}
test('admin-only read and mutation; no RPC before authorization',async()=>{
    const r=routes({denied:true});assert.equal((await r.GET()).status,403);assert.equal((await r.POST(request())).status,403);assert.equal(r.calls.length,0);
});
test('controls use authenticated RPCs and no-store; stale revision conflicts',async()=>{
    const r=routes();assert.equal((await r.GET()).headers['Cache-Control'],'private, no-store');
    assert.equal((await r.POST(request())).status,200);assert.equal(r.calls[1].name,'set_admin_moment_type_v1');
    assert.equal(r.calls[1].args.p_enabled,false);assert.equal(r.calls[1].args.p_expected_revision,0);
    assert.equal((await routes({conflict:true}).POST(request())).status,409);
});
test('invalid bodies and cross-origin mutations fail closed',async()=>{
    const r=routes();assert.equal((await r.POST(request(undefined,'https://other.test'))).status,403);
    for(const body of [{type:'x',enabled:'false',revision:0},{type:'x',enabled:false,revision:-1},{type:'DROP TABLE',enabled:true,revision:0}])assert.equal((await r.POST(request(body))).status,400);
    assert.equal(r.calls.length,0);
});
test('preview registry exactly mirrors app; every type renders the original text and colors',()=>{
    const original=fs.readFileSync('../parplay/src/features/moments/registry.ts','utf8');
    const generated=fs.readFileSync('src/lib/moments/registry.generated.ts','utf8');assert.ok(generated.endsWith(original));
    const {default:Preview,examplePayload}=load('app/admin/moments/MomentPreview.tsx',{
        '@/lib/moments/registry.generated':registry,
        '@/lib/moments/icons.generated.json':JSON.parse(fs.readFileSync('src/lib/moments/icons.generated.json','utf8')),
        './moments.module.css':Object.fromEntries(['card','top','icon','close','title','message','actionSlot','challenge'].map(k=>[k,k])), 'react/jsx-runtime':jsx,
    });
    for(const type of Object.keys(registry.momentRegistry)) {
        const html=renderToStaticMarkup(React.createElement(Preview,{type,challenge:true}));
        const content=registry.renderMoment(type,examplePayload);
        assert.ok(html.includes(content.colors[0]),type);assert.ok(html.includes('linear-gradient'),type);
        assert.ok(html.includes(renderToStaticMarkup(React.createElement('h3',{className:'title'},content.title))),type);
    }
    const negative=renderToStaticMarkup(React.createElement(Preview,{type:'weekly_rating_update',negative:true}));
    assert.ok(negative.includes('−8 Rating Points'));assert.ok(negative.includes('908'));
});
test('admin UI uses confirmed reversible switches, keeps examples separate from delivery',()=>{
    const ui=fs.readFileSync('app/admin/moments/Moments.tsx','utf8');
    assert.ok(ui.indexOf('window.confirm')<ui.indexOf("method: 'POST'"));
    assert.ok(ui.includes('if (!response.ok) throw'));assert.ok(ui.includes('locked.current = true'));
    assert.ok(ui.includes('No automatic trigger'));assert.ok(ui.includes('next online app launch'));
    assert.doesNotMatch(ui,/service_role|\.from\(|setInterval/);
});
