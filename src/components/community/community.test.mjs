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
        if (name.startsWith('.')) return load(path.resolve(path.dirname(filename), `${name}.tsx`));
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
});
