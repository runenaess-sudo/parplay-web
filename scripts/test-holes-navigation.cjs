/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync('src/components/course-wizard/CourseWizard.tsx','utf8');
const ast=ts.createSourceFile('wizard.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let navigate;
function find(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='navigate')navigate=node;ts.forEachChild(node,find);}find(ast);assert.ok(navigate);
const code=ts.transpileModule(navigate.getText(ast)+'\nexports.navigate=navigate;',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness(saveHole){
 const calls={active:1,refresh:0,errors:[],busy:[],locked:false,resize:0};
 const draft={id:'hole',tee_latitude:59,tee_longitude:11,fairway:[{lat:59.001,lng:11.001}]};
 const state={course:{id:'course',holes:[draft]},selectedHoleId:'hole',saveHole};
 const env={navigationLock:{acquire:()=>{if(calls.locked)return false;calls.locked=true;return true;},release:()=>{calls.locked=false;}},setBusy:v=>calls.busy.push(v),setError:v=>calls.errors.push(v),saves:{current:new Map()},active:1,currentId:{current:'course'},courseId:'course',useCourseEditor:{getState:()=>state},refresh:async()=>{calls.refresh++;},setVisited:()=>{},setActive:v=>{calls.active=v;},requestAnimationFrame:cb=>cb(),window:{dispatchEvent:()=>{calls.resize++;}},Event:class{},requireConfirmedCourseId:()=>{throw Error('Unexpected Step 1');}};
 const output={};new Function(...Object.keys(env),'exports',code)(...Object.values(env),output);
 return {calls,state,draft,next:output.navigate};
}
test('false save result stops navigation, preserves draft, shows existing message and releases lock',async()=>{const h=harness(async()=>false);const snapshot=JSON.stringify(h.state.course);await h.next(2);assert.equal(h.calls.active,1);assert.equal(h.calls.refresh,0);assert.equal(h.calls.resize,0);assert.equal(h.calls.locked,false);assert.deepEqual(h.calls.busy,[true,false]);assert.equal(h.calls.errors.at(-1),'Some changes could not be saved to the server. Your draft is still available in its step.');assert.equal(JSON.stringify(h.state.course),snapshot);});
test('thrown save failure stops Previous and Next navigation',async()=>{for(const destination of [0,2,8]){const h=harness(async()=>{throw Error('Network unavailable');});await h.next(destination);assert.equal(h.calls.active,1);assert.equal(h.calls.refresh,0);assert.equal(h.calls.locked,false);}});
test('navigation waits for confirmed save and then advances',async()=>{let finish;const h=harness(()=>new Promise(resolve=>{finish=resolve;}));const pending=h.next(2);await new Promise(setImmediate);assert.equal(h.calls.active,1);assert.equal(h.calls.refresh,0);finish(true);await pending;assert.equal(h.calls.active,2);assert.equal(h.calls.refresh,1);assert.equal(h.calls.locked,false);});
test('failed save can be retried without losing local state',async()=>{let attempts=0;const h=harness(async()=>++attempts>1);await h.next(2);assert.equal(h.calls.active,1);await h.next(2);assert.equal(h.calls.active,2);assert.equal(attempts,2);assert.equal(h.state.course.holes[0],h.draft);});
