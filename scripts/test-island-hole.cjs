/* global __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const types={};vm.runInNewContext(ts.transpileModule(read('src/types/holeFeatures.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:types});
const plain=v=>JSON.parse(JSON.stringify(v));
function editor() {
 let state;const db=[],calls=[];
 const mocks={zustand:{create:init=>{state=init(p=>state={...state,...(typeof p==='function'?p(state):p)},()=>state);return {getState:()=>state};}},
  '@/types/holeFeatures':types,'@/utils/elevation':{},'@/utils/holeLength':{},
  '@/lib/supabase-browser':{supabaseBrowser:{rpc:async(name,args)=>{calls.push([name,plain(args)]);db.push({id:args.p_feature_id,hole_id:args.p_hole_id,...plain(args.p_feature)});return {error:null};},

  }} };
 // The same scoped UPDATE/DELETE transport as the editor, backed by saved rows.
 mocks['@/lib/supabase-browser'].supabaseBrowser.from=table=>{assert.equal(table,'hole_features');let payload,remove=false;const chain={
  update(p){payload=p;return chain;},delete(){remove=true;return chain;},async eq(key,id){assert.equal(key,'id');const index=db.findIndex(f=>f.id===id);if(remove)db.splice(index,1);else Object.assign(db[index],plain(payload));return {error:null};}};return chain;};
 const exports={};vm.runInNewContext(ts.transpileModule(read('src/state/useCourseEditor.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];},crypto:{randomUUID:()=> 'island-id'},console:{log(){},error(){}},Date});
 const store=exports.useCourseEditor;
 const reload=()=>store.getState().loadAll({id:'course',holes:[{id:'hole',play_config_id:'main',hole_features:plain(db)}],canonical_hole_features:plain(db)});reload();
 return {store,db,calls,reload};
}
test('Island Hole is a distinct tool with mobile-independent closed polygon helpers',()=>{
 assert(types.HOLE_FEATURE_TYPES.includes('ISLAND_HOLE'));assert.equal(types.featureTypeLabel('ISLAND_HOLE'),'Island Hole');assert.equal(types.minimumVertexCount('ISLAND_HOLE'),3);
 const polygon=types.geometryFromCoordinates('ISLAND_HOLE',[[1,2],[3,4],[5,6]]);assert.equal(polygon.type,'Polygon');assert.deepEqual(plain(polygon.coordinates),[[[1,2],[3,4],[5,6],[1,2]]]);
 assert.deepEqual(plain(types.editableCoordinates({geometry:polygon})),[[1,2],[3,4],[5,6]]);
 assert.match(read('app/create-course/editor/[courseId]/EditorPanel.tsx'),/HOLE_FEATURE_TYPES.map/);
});
test('create, select, drag a vertex, reload and delete preserve Island identity',async()=>{
 const e=editor();e.store.getState().startFeatureTool('ISLAND_HOLE');await e.store.getState().addFeatureCoordinate(1,2);await e.store.getState().addFeatureCoordinate(3,4);
 await e.store.getState().finishFeatureDrawing();assert.equal(e.calls.length,0);assert.match(e.store.getState().toast,/at least 3/);
 await e.store.getState().addFeatureCoordinate(5,6);await e.store.getState().finishFeatureDrawing();
 assert.equal(e.calls[0][0],'create_play_config_feature_v5');assert.equal(e.calls[0][1].p_feature.feature_type,'ISLAND_HOLE');assert.equal(e.calls[0][1].p_hole_id,'hole');assert.deepEqual(e.calls[0][1].p_config_ids,['main']);
 assert.equal(e.store.getState().selectedFeatureId,'island-id');
 await e.store.getState().moveFeatureVertex('island-id',0,9,8);assert.deepEqual(e.db[0].geometry.coordinates[0],[[9,8],[3,4],[5,6],[9,8]]);
 e.reload();assert.equal(e.store.getState().course.holes[0].hole_features[0].feature_type,'ISLAND_HOLE');assert.deepEqual(plain(e.store.getState().course.holes[0].hole_features[0].geometry),e.db[0].geometry);
 await e.store.getState().deleteFeature('island-id');assert.equal(e.db.length,0);assert.equal(e.store.getState().course.holes[0].hole_features.length,0);
});
function layer(id){const source=read('app/create-course/editor/[courseId]/MapCanvas.tsx');const literal=[...source.matchAll(/map.addLayer\((\{[\s\S]*?\})\);/g)].map(m=>m[1]).find(s=>s.includes('id: "'+id+'"'));assert.ok(literal,id);return plain(vm.runInNewContext('('+literal+')'));}
test('Island has zero fill, orange dashed outline and existing selection/vertex handlers',()=>{
 const fill=layer('island-hole-hit-layer'),outline=layer('island-hole-outline-layer');assert.equal(fill.paint['fill-opacity'],0);assert.equal('fill-pattern' in fill.paint,false);assert.equal(outline.paint['line-color'],'#FFB74D');assert.deepEqual(outline.paint['line-dasharray'],[2,1]);
 for(const l of [fill,outline])assert.deepEqual(l.filter,['==',['get','featureType'],'ISLAND_HOLE']);
 const source=read('app/create-course/editor/[courseId]/MapCanvas.tsx');assert.match(source,/for \(const layer of \["island-hole-hit-layer", "island-hole-outline-layer"/);assert.match(source,/editableCoordinates\(feature\).forEach/);
});
test('OB and Hazard polygon helpers and paint remain unchanged',()=>{
 for(const kind of ['OB_AREA','HAZARD_AREA']){assert.equal(types.minimumVertexCount(kind),3);assert.equal(types.geometryFromCoordinates(kind,[[1,2],[3,4],[5,6]]).type,'Polygon');}
 const fill=layer('hole-feature-area-layer'),outline=layer('hole-feature-area-outline-layer');
 assert.deepEqual(fill.paint,{'fill-pattern':['match',['get','featureType'],'OB_AREA','ob-hatch','hazard-hatch'],'fill-opacity':0.72});
 assert.deepEqual(outline.paint,{'line-color':['match',['get','featureType'],'OB_AREA','#ffffff','#9ca3af'],'line-width':3});
 for(const l of [fill,outline])assert.deepEqual(l.filter,['!=',['get','featureType'],'ISLAND_HOLE']);
});
test('migration preserves installed rules and adds strict, non-null closed Polygon branch without changing RPC',()=>{
 const sql=read('supabase/migrations/20280112_island_hole_feature_v1.sql');assert.match(sql,/pg_get_expr\(conbin,conrelid\)/);assert.match(sql,/into strict type_rule/);assert.match(sql,/into strict geometry_rule/);
 assert.match(sql,/feature_type <> %L and \(%s\)/);assert.match(sql,/geometry->>'type' = 'Polygon'/);assert.match(sql,/jsonb_array_length\(geometry->'coordinates'\) = 1/);assert.match(sql,/jsonb_array_length\(geometry#>'\{coordinates,0\}'\) >= 4/);assert.match(sql,/\)\) is true/);
 assert.doesNotMatch(sql,/create or replace function|disable trigger|session_replication_role|update public.hole_features|delete from public.hole_features/i);
});
