/* global __dirname, setImmediate */
/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test runner and transpiled component adapters. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function panel() {
 const data = { tees: [], baskets: [], configs: [], features: [
  { id: 'legacy', feature_type: 'OB_AREA', description: 'Legacy Main', explicit: false },
  { id: 'main-only', feature_type: 'DROPZONE', description: 'Main only', explicit: true },
  { id: 'alt-only', feature_type: 'INFO', description: 'Blue only', explicit: true },
 ] };
 for (let i = 1; i <= 18; i++) {
  for (const kind of ['tees','baskets']) data[kind].push({ id: `${kind}-${i}`, label: `${kind}-${i}`, latitude: 60.1647537347664, longitude: 9.37937554000285,
   elevation: 10, usage: [{ hole_id: `hole-${i}`, number: i }] });
  data.configs.push({ id: `config-${i}`, hole_id: `hole-${i}`, tee_id: `tees-${i}`, basket_id: `baskets-${i}`, par: 3, distance: 83, is_default: true });
 }
 data.configs.push({ ...data.configs[0], id: 'blue', tee_id: 'tees-2', is_default: false });
 data.baskets[0].usage.push({ hole_id: 'hole-2', number: 2 });
 let store = { selectedHoleId: 'hole-1', course: { id: 'course', holes: [{ id: 'hole-1', play_config_id: 'config-1', par: 3, distance: 83,
  basket_latitude: 60.2, basket_longitude: 9.3, basket_elevation: 10, hole_features: data.features.slice(0, 2) }] } };
 const useCourseEditor = fn => fn(store);
 useCourseEditor.getState = () => store;
 useCourseEditor.setState = fn => { store = { ...store, ...fn(store) }; };
 const calls = []; const warnings = []; let confirm = true; let removalBlocked = false; let cursor = 0; const slots = []; const effects = [];
 const state = init => { const i = cursor++; if (!(i in slots)) slots[i] = init; return [slots[i], value => { slots[i] = value; }]; };
 const react = { useState: state, useRef: value => state({ current: value })[0], useEffect: fn => { const i = cursor++; if (!slots[i]) { slots[i] = true; effects.push(fn); } } };
 const mocks = { react, 'react/jsx-runtime': require('react/jsx-runtime'), '@/state/useCourseEditor': { useCourseEditor },
  '@/utils/holeLength': { calculateHoleLength: () => 100 }, '@/lib/supabase-browser': { supabaseBrowser: { rpc: async (name, payload) => {
   calls.push({ name, payload });
   if (name === 'remove_hole_variation_v5' && removalBlocked) return { error: { message: 'VARIATION_USED_BY_LAYOUT' } };
   if (name === 'get_course_variant_editor_v5') return { data };
   if (name === 'resolve_hole_play_config_v1') return { data: { play_config_id: payload.p_preview_config_id, features: payload.p_preview_config_id === 'blue' ? [data.features[2]] : data.features.slice(0,2) } };
   return { error: null };
  } } } };
 const exports = {};
 vm.runInNewContext(ts.transpileModule(read('app/create-course/editor/[courseId]/PlayOptionsPanel.tsx'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
  { exports, require: name => { assert.ok(name in mocks, name); return mocks[name]; }, crypto: { randomUUID: () => 'new-id' }, window: { prompt: () => 'Center', confirm: message => { warnings.push(message); return confirm; } } });
 let tree;
 function render() { cursor = 0; tree = exports.default(); effects.splice(0).forEach(fn => fn()); }
 function all(predicate, node = tree) { if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(n => all(predicate, n));
  return [...(predicate(node) ? [node] : []), ...all(predicate, node.props?.children ?? null)]; }
 const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : text(node.props.children);
 render();
 return { data, calls, warnings, render, all, text, store: () => store, reject: () => { confirm = false; }, blockRemoval: () => { removalBlocked = true; },
  html: () => renderToStaticMarkup(tree),
  click(label, index = 0) { const button = all(n => n.type === 'button' && text(n) === label)[index]; assert.ok(button, label); assert.ok(!button.props.disabled); button.props.onClick(); render(); },
  async settle() { for (let i = 0; i < 3; i++) { await new Promise(setImmediate); render(); } },
 };
}

test('18-hole course normal panel renders only active objects, no coordinates, separate par summary', async () => {
 const p = panel(); await p.settle();
 const cards = p.all(n => n.type === 'summary' && n.props['aria-label']?.startsWith('Manage ')).map(n => n.props['aria-label']);
 assert.equal(cards.length, 2); assert.ok(cards[0].includes('tees-1')); assert.ok(cards[1].includes('baskets-1'));
 const html = p.html(); assert.doesNotMatch(html, /60\.1647537347664|9\.37937554000285|baskets-18|tees-18|Par 3Par/);
 assert.match(html, /83 m · Par 3<\/p>/); assert.match(html, /<summary[^>]*>Edit par<\/summary>/);
 const options = p.all(n => n.props['aria-label'] === 'Select Variation')[0]; assert.equal(p.all(n => n.type === 'option', options).length, 2);
 assert.equal(p.all(n => n.props['aria-label'] === 'Existing basket').length, 0);
});

test('existing basket selector exposes course-wide usage; selection/Cancel do not persist', async () => {
 const p = panel(); await p.settle(); p.click('Add Hole Variation'); p.click('Use existing basket');
 const selector = p.all(n => n.props['aria-label'] === 'Existing basket')[0];
 assert.equal(p.all(n => n.type === 'option', selector).length, 19); assert.match(p.text(selector), /baskets-18 · Used by holes 18/);
 selector.props.onChange({ target: { value: 'baskets-18' } }); p.render();
 assert.equal(p.calls.filter(c => c.name.startsWith('save_')).length, 0);
 p.click('Cancel'); assert.equal(p.all(n => n.props['aria-label'] === 'Existing basket').length, 0);
 assert.equal(p.calls.filter(c => c.name.startsWith('save_')).length, 0);
});

test('USE BASKET creates one option referencing original basket UUID, without cloning geometry', async () => {
 const p = panel(); await p.settle(); p.click('Add Hole Variation'); p.click('Use existing basket');
 p.all(n => n.props['aria-label'] === 'Existing basket')[0].props.onChange({ target: { value: 'baskets-18' } }); p.render(); p.click('USE BASKET'); await p.settle();
 const saves = p.calls.filter(c => c.name === 'save_hole_variant_draft_v5'); assert.equal(saves.length, 1);
 assert.equal(saves[0].payload.p_config.basket_id, 'baskets-18'); assert.equal(saves[0].payload.p_config.tee_id, 'tees-1');
 assert.equal(saves[0].payload.p_basket, null); assert.equal(saves[0].payload.p_tee, null);
});

test('selected shared basket move still warns, Cancel does not write', async () => {
 const p = panel(); await p.settle(); p.reject(); p.click('Move on map', 1);
 assert.match(p.warnings[0], /Used by holes 1, 2/); assert.match(p.warnings[0], /Played rounds remain unchanged/);
 assert.equal(p.calls.filter(c => c.name.startsWith('save_')).length, 0);
});

test('switching play option uses resolved applicability; sharing targets active config', async () => {
 const p = panel(); await p.settle();
 p.all(n => n.props['aria-label'] === 'Select Variation')[0].props.onChange({ target: { value: 'blue' } }); await p.settle();
 assert.deepEqual(p.store().course.holes[0].hole_features.map(f => f.id), ['alt-only']);
 p.click('+ DROPZONE Main only'); await p.settle();
 const link = p.calls.find(c => c.name === 'set_play_config_feature_link_v5');
 assert.equal(link.payload.p_config_id, 'blue'); assert.equal(link.payload.p_feature_id, 'main-only'); assert.equal(link.payload.p_linked, true);
 assert.equal(p.all(n => n.type === 'h3' && p.text(n) === 'REUSE FEATURES').length, 0);
});

test('layout save retains explicit option choices; feature list stays scoped to resolved hole', () => {
 const layout = read('app/club-manager/courses/[courseId]/layouts/new/AddLayoutForm.tsx');
 assert.match(layout, /save_course_layout_options_v5/); assert.match(layout, /p_config_ids/);
 const editor = read('app/create-course/editor/[courseId]/EditorPanel.tsx');
 assert.match(editor, /hole\?\.hole_features/); assert.match(editor, /Current features/);
});

test('one Add Hole Variation entry; no permanent duplicate creation actions or technical counts', async () => {
 const p = panel(); await p.settle();
 assert.equal(p.all(n => n.type === 'button' && p.text(n) === 'Add Hole Variation').length, 1);
 for (const text of ['+ Add tee','+ Add basket','Use existing basket']) assert.equal(p.all(n => n.type === 'button' && p.text(n) === text).length, 0);
 assert.doesNotMatch(p.html(), /Current option|play options|hole variations<\/option>|raw UUID/i);
 assert.match(p.html(), /Select Variation/); assert.match(p.html(), /HOLE VARIATIONS/);
 p.click('Add Hole Variation'); assert.equal(p.all(n => n.type === 'button' && p.text(n) === 'Use existing basket').length, 1);
});

test('shared rename confirms global name effect and uses the original physical UUID', async () => {
 const p = panel(); await p.settle(); p.click('Rename', 1); await p.settle();
 assert.match(p.warnings[0], /Rename shared basket/); assert.match(p.warnings[0], /Used by holes 1, 2/); assert.match(p.warnings[0], /everywhere/);
 const save = p.calls.find(c => c.name === 'save_course_physical_object_v5');
 assert.equal(save.payload.p_id, 'baskets-1'); assert.equal(save.payload.p_label, 'Center');
 const cancelled = panel(); await cancelled.settle(); cancelled.reject(); cancelled.click('Rename', 1); await cancelled.settle();
 assert.equal(cancelled.calls.filter(c => c.name.startsWith('save_')).length, 0);
});

test('Edit Variation changes the relationship without modifying or cloning physical objects', async () => {
 const p = panel(); await p.settle();
 p.all(n => n.props['aria-label'] === 'Select Variation')[0].props.onChange({ target: { value: 'blue' } }); await p.settle();
 p.click('Edit tee, basket, par and distance');
 p.all(n => n.props['aria-label'] === 'Variation basket')[0].props.onChange({ target: { value: 'baskets-6' } }); p.render();
 p.click('Save'); await p.settle();
 const save = p.calls.find(c => c.name === 'save_hole_variant_draft_v5');
 assert.equal(save.payload.p_config.id, 'blue'); assert.equal(save.payload.p_config.basket_id, 'baskets-6');
 assert.equal(save.payload.p_tee, null); assert.equal(save.payload.p_basket, null);
});

test('Remove Variation protects Main, preserves shared objects and explains referenced layouts', async () => {
 const p = panel(); await p.settle(); assert.equal(p.all(n => n.type === 'button' && p.text(n) === 'Remove Variation').length, 0);
 p.all(n => n.props['aria-label'] === 'Select Variation')[0].props.onChange({ target: { value: 'blue' } }); await p.settle();
 p.click('Remove Variation'); await p.settle();
 assert.equal(p.calls.filter(c => c.name === 'remove_hole_variation_v5').length, 1);
 assert.equal(p.calls.filter(c => c.name.startsWith('save_course_physical')).length, 0);
 assert.equal(p.data.baskets.length, 18);
 const blocked = panel(); await blocked.settle(); blocked.blockRemoval();
 blocked.all(n => n.props['aria-label'] === 'Select Variation')[0].props.onChange({ target: { value: 'blue' } }); await blocked.settle();
 blocked.click('Remove Variation'); await blocked.settle(); assert.match(blocked.html(), /used by a layout/);
 assert.equal(blocked.store().course.holes[0].play_config_id, 'blue');
});

test('timezone UI is absent and omitted values preserve automatic/backend timezone assignment', () => {
 for (const file of ['app/create-course/new/page.tsx','app/club-manager/courses/[courseId]/details/CourseDetailsForm.tsx']) {
  assert.doesNotMatch(read(file), /Local timezone|setTimezone|get_iana_timezones_v1/);
 }
 assert.match(read('app/api/course-details/[courseId]/route.ts'), /Object.hasOwn\(body, 'timezone'\)/);
 const page = read('app/create-course/editor/[courseId]/page.tsx');
 assert.match(page, /lg:left-64 lg:right-\[260px\]/); assert.match(page, /lg:top-0/); assert.doesNotMatch(page, /Hide tools/);
});
