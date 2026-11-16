import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(file) {
    const filename = path.resolve(file);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const loaded = { exports: {} };
    vm.runInNewContext(code, { module: loaded, exports: loaded.exports, require: (name) => {
        if (name === '@/lib/supabase-browser') return { supabaseBrowser: {} };
        if (name === 'next/navigation') return { useRouter: () => ({ push() {} }) };
        if (name === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
        if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
        if (name.startsWith('.')) { const base = path.resolve(path.dirname(filename), name); return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.tsx'); }
        return require(name);
    } }, { filename });
    return loaded.exports;
}
test('public Community renders category controls, loading states and canonical sections without admin gating', () => {
    const { default: Community } = load('src/components/community/Community.tsx');
    const html = renderToStaticMarkup(React.createElement(Community));
    for (const text of ['Community', 'Share your experience', 'Play-TV', 'Most helpful', 'Top 10 course builders', 'Latest 10 built courses', 'Loading experiences']) assert.ok(html.includes(text), text);
    assert.ok(html.includes('aria-pressed="true"'));
    assert.ok(html.includes('href="/courses"'));
});
test('shared submission modal renders required bounded fields and context without publication controls', () => {
    const { default: Share } = load('src/components/community/ShareExperience.tsx');
    const html = renderToStaticMarkup(React.createElement(Share, { onClose() {}, category: 'course', contextType: 'course', contextId: 'fixture', contextName: 'Furumo' }));
    assert.ok(html.includes('<dialog'));
    assert.ok(html.includes('maxLength="500"'));
    assert.ok(html.includes('maxLength="100"'));
    assert.ok(html.includes('Furumo'));
    assert.ok(html.includes('Send for review'));
    assert.ok(html.includes('reviewed before publication'));
    assert.ok(!html.includes('APPROVED'));
    assert.ok(html.includes('<select disabled=""'));
});

test('specific Course view suppresses geography and general Courses defaults to nearby', () => {
    const { default: CourseFeed } = load('src/components/community/CourseFeed.tsx');
    const specific = renderToStaticMarkup(React.createElement(CourseFeed, { courseId: '12345678-1234-1234-1234-123456789abc', courseName: 'Eggedal', preview: true }));
    assert.ok(specific.includes('Player experiences'));
    assert.ok(specific.includes('Eggedal'));
    assert.ok(!specific.includes('Nearby'));
    assert.ok(specific.includes('Share your experience'));
    const general = renderToStaticMarkup(React.createElement(CourseFeed));
    assert.match(general, /aria-pressed="true"[^>]*>Nearby/);
    assert.ok(general.includes('Country'));
    assert.ok(general.includes('Most helpful'));
});

test('photo retrieval preserves binary image data with authorization instead of SDK text parsing', async () => {
 const {loadExperiencePhoto}=load('src/components/community/experiencePhoto.ts');
 const bytes=new Uint8Array([255,216,255,128,0,255,217]);
 const blob=await loadExperiencePhoto({baseUrl:'https://example.test',postId:'post',accessToken:'token',apiKey:'key'},async(url,options)=>{
  assert.ok(url.endsWith('community-experience-photo?post_id=post'));
  assert.equal(options.headers.Authorization,'Bearer token');assert.equal(options.cache,'no-store');
  return new Response(bytes,{headers:{'Content-Type':'image/jpeg'}});
 });
 assert.ok(blob instanceof Blob);assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),bytes);
 for(const status of [401,403,404,503]) await assert.rejects(loadExperiencePhoto({baseUrl:'https://example.test',postId:'post',apiKey:'key'},async()=>new Response('',{status})),new RegExp(String(status)));
});
test('round details without a top-level source ID still render compact statistics chips', () => {
 const Card=load('src/components/community/ExperienceCard.tsx').default;
 const post={id:'post',title:'Round',body:'Comment',round_details:{total_score:61,relative_to_par:3,round_rating:876,xp_earned:15}};
 const html=renderToStaticMarkup(React.createElement(Card,{post}));
 for(const value of ['Score','+3 (61)','Rating','876','XP','+15','inline-flex w-fit'])assert.ok(html.includes(value),value);
 assert.ok(!html.includes('grid-cols-3'));
 const ordinary=renderToStaticMarkup(React.createElement(Card,{post:{id:'ordinary',title:'Tip',body:'Text'}}));
 assert.ok(!ordinary.includes('>Score<'));
});
