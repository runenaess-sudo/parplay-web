/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync('app/create-course/editor/[courseId]/LoadEditorData.tsx','utf8');
const course={id:'fixture-course',name:'Empty draft',latitude:59.1279876,longitude:11.3463802,status:'draft'};
function loader({rows=[],rpcError=null,courseError=null}={}){
 const effects=[],loaded=[],errors=[],rpcCalls=[];
 const db={from:table=>({select(){return this;},eq(key,id){assert.equal(key,'id'===key?'id':'course_id');assert.equal(id,course.id);return this;},async single(){assert.equal(table,'courses');return {data:course,error:courseError};},async order(){assert.equal(table,'holes');return {data:rows,error:null};}}),rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:[],error:rpcError};}};
 const m={exports:{}};new Function('require','module','exports',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(name=>name==='react'?{useEffect:f=>effects.push(f)}:name==='@/state/useCourseEditor'?{useCourseEditor:select=>select({loadAll:data=>loaded.push(data)})}:name==='@/lib/supabase-browser'?{supabaseBrowser:db}:{},m,m.exports);
 m.exports.default({courseId:course.id,onError:message=>errors.push(message)});const cleanup=effects[0]();return {loaded,errors,rpcCalls,cleanup};
}
const tick=()=>new Promise(setImmediate);
test('zero-hole draft loads saved course coordinates without layout or resolver request',async()=>{const h=loader({rpcError:{code:'42501'}});await tick();await tick();assert.equal(h.rpcCalls.length,0);assert.equal(h.loaded.length,1);assert.equal(h.loaded[0].latitude,59.1279876);assert.equal(h.loaded[0].longitude,11.3463802);assert.deepEqual(h.loaded[0].holes,[]);});
test('existing holes still require authoritative resolver; errors are visible and do not silently use legacy geometry',async()=>{const h=loader({rows:[{id:'hole',number:1}],rpcError:{code:'42501'}});await tick();await tick();assert.equal(h.rpcCalls[0].name,'get_resolved_course_holes_v1');assert.equal(h.loaded.length,0);assert.ok(h.errors.at(-1).includes('configurations could not be loaded'));});
test('failed course read is surfaced without loading an unauthorized course',async()=>{const h=loader({courseError:{code:'42501'}});await tick();assert.equal(h.loaded.length,0);assert.ok(h.errors.at(-1).includes('access or connection'));});
test('unmounted loader does not overwrite editor state with a stale course',async()=>{const h=loader();h.cleanup();await tick();await tick();assert.equal(h.loaded.length,0);});
