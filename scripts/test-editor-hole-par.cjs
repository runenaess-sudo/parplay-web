/* global __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
function editor(fail = false) {
 const db = [{ id: 'one', par: 3 }, { id: 'two', par: 5 }];
 const writes = []; let state;
 const mocks = {
  zustand: { create: init => { state = init(patch => { state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }; }, () => state); return { getState: () => state }; } },
  '@/lib/supabase-browser': { supabaseBrowser: {
   from: table => { let payload, id; return { update(p) { payload = p; return this; }, eq(key, value) { assert.equal(key, 'id'); id = value; return this; }, select() { return this; }, async single() {
    if (payload) { writes.push({ table, id, payload }); if (fail) return { error: { message: 'denied' } }; Object.assign(db.find(h => h.id === id), payload); }
    return { data: { ...db.find(h => h.id === id) }, error: null };
   }, then(resolve) { if (payload) { writes.push({ table, id, payload }); Object.assign(db.find(h => h.id === id), payload); } return Promise.resolve({ error: null }).then(resolve); } }; },
  } },
  '@/utils/elevation': { getElevation: async () => null },
  '@/utils/holeLength': { calculateHoleLength: () => 0 },
  '@/types/holeFeatures': {},
 };
 const exports = {};
 vm.runInNewContext(ts.transpileModule(read('src/state/useCourseEditor.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
  { exports, require: name => mocks[name], console: { log() {} }, Date });
 const store = exports.useCourseEditor;
 store.getState().loadAll({ id: 'course', name: 'Course', holes: db.map(h => ({ ...h, holePar: h.par, fairway: [] })) });
 return { store, db, writes };
}
test('selected hole par saves to holes.id and survives reload without changing another hole', async () => {
 const e = editor(); e.store.getState().setHolePar('one', 4);
 assert.equal(e.store.getState().course.holes[1].holePar, 5);
 assert.equal(await e.store.getState().saveHole('one'), true);
 assert.equal(e.db[0].par, 4); assert.equal(e.db[1].par, 5);
 assert.equal(e.writes[0].table, 'holes'); assert.equal(e.writes[0].id, 'one');
 assert.deepEqual(JSON.parse(JSON.stringify(e.writes[0].payload)), { par: 4 });
 assert.equal(e.store.getState().course.holes[0].holePar, 4);
 await e.store.getState().setSelectedHole('two');
 assert.equal(e.store.getState().selectedHoleId, 'two');
 assert.equal(e.store.getState().course.holes[1].holePar, 5);
});
test('failed par update preserves draft and returns existing error state', async () => {
 const e = editor(true); e.store.getState().setHolePar('one', 6);
 assert.equal(await e.store.getState().saveHole('one'), false);
 assert.equal(e.db[0].par, 3); assert.equal(e.store.getState().course.holes[0].holeParDirty, true);
 assert.equal(e.store.getState().toast, 'Error saving hole par');
});
test('only mobile values accepted; alternate preview par is not overwritten', () => {
 const e = editor(); const h = e.store.getState().course.holes[0]; h.play_config_id = 'alternate'; h.defaultPlayConfigId = 'main'; h.par = 7;
 e.store.getState().setHolePar('one', 4);
 assert.equal(e.store.getState().course.holes[0].holePar, 4);
 assert.equal(e.store.getState().course.holes[0].par, 7);
 for (const p of [1, 8, 3.5]) e.store.getState().setHolePar('one', p);
 assert.equal(e.store.getState().course.holes[0].holePar, 4);
});
test('loader keeps authoritative holes.par and help remains beside Hole Info at reduced size', () => {
 assert.match(read('app/create-course/editor/[courseId]/LoadEditorData.tsx'), /holePar: legacyById.get\(hole.id\)\?\.par/);
 const panel = read('app/create-course/editor/[courseId]/EditorPanel.tsx');
 assert.match(panel, /Hole Info<\/h3>\s*<HoleEditorHelp \/>/);
 assert.match(panel, /\[2, 3, 4, 5, 6, 7\].map/);
 const help = read('app/create-course/editor/[courseId]/HoleEditorHelp.tsx');
 assert.match(help, /h-\[27px\] w-\[27px\]/); assert.match(help, /dialog.current\?\.showModal\(\)/);
});
