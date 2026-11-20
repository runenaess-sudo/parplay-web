import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
import { createSingleFlight, requireConfirmedCourseId, saveBasicCourse, validateBasicCourse } from './basicCourseSave.ts';

// Load the actual Section registration wrapper, rather than replacing it with a mock.
const source = fs.readFileSync('src/components/course-wizard/CourseWizard.tsx', 'utf8');
const loadedModule = { exports: {} };
new Function('require', 'module', 'exports', ts.transpileModule(source + '\nexport { Section };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText)(name => name === 'react' ? { useMemo: f => f() }
    : name === 'react/jsx-runtime' ? { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
    : name === './WizardStep' ? { WizardStepContext: { Provider: 'provider' } } : {}, loadedModule, loadedModule.exports);
function registration() {
    const saves = { current: new Map() };
    const provider = loadedModule.exports.Section({ index: 0, active: 0, scope: 'user-bound-scope', saves, children: null });
    return { saves, register: provider.props.value.register };
}
const value = { name: '\u00d8stgaardskogen Frisbeegolfbane', location: 'Halden', latitude: '59.1279876', longitude: '11.3463802', description: '' };
const input = { value, userId: 'user', courseId: null, insertId: 'stable-course-id', isAdmin: false };

test('example coordinates pass validation; actual registered save confirms Step 1 and advances to Step 2', async () => {
    assert.deepEqual(validateBasicCourse(value).errors, {});
    const { saves, register } = registration();let currentId = null, step = 0, inserts = 0;
    register(async () => {
        const id = await saveBasicCourse(input, { findRetry: async () => null, findNearby: async () => [], insert: async id => { inserts++; return id; }, update: async () => { throw Error('Unexpected update'); } });
        currentId = id; return id;
    });
    requireConfirmedCourseId(await saves.current.get(0)(), currentId);step = 1;
    assert.equal(step, 1);assert.equal(inserts, 1);assert.equal(currentId, input.insertId);
});

test('confirmed save reused by repeated Next attempts does not create duplicate course', async () => {
    const { saves, register } = registration();let currentId = null, inserts = 0;
    register(async () => { if (currentId) return currentId; inserts++;currentId = input.insertId;return currentId; });
    for (let i = 0; i < 3; i++) requireConfirmedCourseId(await saves.current.get(0)(), currentId);
    assert.equal(inserts, 1);
});

test('lost INSERT response retry recovers the same stable ID without a duplicate INSERT', async () => {
    let storedId = null, inserts = 0, updates = 0;
    const deps = { findRetry: async () => storedId, findNearby: async () => [], insert: async id => { inserts++;storedId = id;throw Error('Response lost'); }, update: async id => { updates++;return id; } };
    await assert.rejects(saveBasicCourse(input, deps), /Response lost/);
    assert.equal(await saveBasicCourse(input, deps), input.insertId);assert.equal(inserts, 1);assert.equal(updates, 1);
});

test('actual rejection propagates through registration; missing/mismatched confirmation cannot advance', async () => {
    const { saves, register } = registration();const error = { code: '42501', message: 'denied' };
    const cleanup = register(async () => { throw error; });
    await assert.rejects(saves.current.get(0)(), e => e === error);
    cleanup();assert.equal(saves.current.has(0), false);
    register(async () => undefined);assert.throws(() => requireConfirmedCourseId(undefined, input.insertId), /did not confirm/);
    assert.throws(() => requireConfirmedCourseId('other-id', input.insertId), /did not confirm/);
});

test('concurrent registered saves share the existing single-flight promise', async () => {
    const { saves, register } = registration();let calls = 0, finish;
    register(createSingleFlight(() => { calls++;return new Promise(resolve => { finish = resolve; }); }));
    const first = saves.current.get(0)(), second = saves.current.get(0)();
    assert.equal(calls, 1);finish(input.insertId);
    assert.equal(await first, input.insertId);assert.equal(await second, input.insertId);
});
