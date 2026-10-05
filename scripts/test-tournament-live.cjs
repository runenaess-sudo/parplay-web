const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file, mocks = {}, globals = {}) {
  file = path.resolve(root, file);
  if (cache.has(file) && !Object.keys(mocks).length && !Object.keys(globals).length) return cache.get(file);
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, AbortController, setTimeout, clearTimeout, ...globals, require: name => {
    if (name in mocks) return mocks[name];
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) });
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
    return require(name);
  } }, { filename: file });
  if (!Object.keys(mocks).length && !Object.keys(globals).length) cache.set(file, exports);
  return exports;
}
const api = load('src/lib/tournament-live.ts');
const id = '11111111-1111-1111-1111-111111111111', round = '22222222-2222-2222-2222-222222222222';
const player = (name, score, props = {}) => ({player_id:name, display_name:name, started:score!==null, scores:[], total_hole_count:2,
  completed_hole_count:score===null?0:1, relative_to_par:score===null?null:score-3, authoritative_total_strokes:null,
  played_total_strokes:score, is_finished:false, has_conflict:false, is_display_complete:false, round_rating:null, rating_state:'unavailable', ...props});
const cls = (code, course = code+' course') => ({id:code, code, name:code, course:{id:code,name:course}, layout:{id:code,name:code+' layout'},
  holes:[{hole_id:'h2',display_order:2,par:3,distance:110},{hole_id:'h1',display_order:1,par:3,distance:100}],
  players:[player('Waiting',null),player('Alice',3),player('Bob',3),player('Leader',2)]});
const data = {version:1,tournament:{id,name:'Test Event'},round:{id:round,round_number:2,status:'ongoing'},classes:[cls('FA1'),cls('FPO'),cls('MPO')]};
assert.equal(api.readContract(data,id,round),data);
assert.throws(()=>api.readContract(data,id,id));
assert.throws(()=>api.readContract({},id,round));
assert.equal(api.orderedClasses(data.classes).map(c=>c.code).join(','),'MPO,FPO,FA1');
assert.equal(api.selectedClass(data.classes,null).code,'MPO');
assert.equal(api.selectedClass(data.classes,'FPO').course.name,'FPO course');
assert.equal(api.selectedClass([...data.classes,cls('MP40')],'FPO').code,'FPO');
assert.equal(api.selectedClass([cls('FA1')],'FPO').code,'FA1');
assert.equal(api.rankedPlayers(data.classes[0].players).map(r=>`${r.player.display_name}:${r.place}`).join(','),'Leader:1,Alice:2,Bob:2,Waiting:null');
assert.equal(api.total(player('authoritative',8,{authoritative_total_strokes:7})),7);
assert.equal([null,-5,0,3].map(api.relative).join(','),'—,-5,E,+3');
assert.equal(api.thru(player('waiting',null)),'—');
assert.equal(api.thru(player('playing',3,{completed_hole_count:7})),'7');
assert.equal(api.thru(player('done',3,{is_finished:true})),'F');
assert.equal(api.rating(player('waiting',null)),'—');
assert.equal(api.rating(player('evolving',3,{round_rating:900.6,rating_state:'evolving'})),'901');
assert.equal(api.rating(player('final',3,{round_rating:900.6,rating_state:'final'})),'901');
assert.equal(api.scoreState({strokes:3,has_conflict:true}),'conflict');
assert.equal(api.scoreState({strokes:3,session_hole_state:'awaiting_scorers'}),'provisional');
assert.equal(api.scoreState({strokes:3,session_hole_state:'matched',score_source:'SELF_CARD'}),'confirmed');
assert.equal(api.publicFailure({code:'42501',message:'private raw details'}).permanent,true);
assert.equal(api.publicFailure(new Error('network private details')).permanent,false);
assert.ok(!api.publicFailure(new Error('network private details')).message.includes('private'));

// Exercise the actual proxy with cookie-less requests, including protected neighbouring routes.
const proxy = load('proxy.ts', {'next/server':{NextResponse:{next:()=> 'next',redirect:()=> 'login'}}}).proxy;
for (const [pathname, expected] of [[`/future/tournaments/${id}/round/${round}`,'next'],[`/future/tournaments/${id}/round/${round}/`,'next'],
  [`/future/tournaments/${id}/admin`,'login'],[`/future/tournaments/${id}/round/${round}/admin`,'login'],[`/future/tournaments/${id}`,'login'],['/future/round/id','next']]) {
  assert.equal(proxy({nextUrl:{pathname,clone:()=>({pathname})},headers:{get:()=>null},cookies:{getAll:()=>[]}}),expected,pathname);
}

// Render the actual table, with hooks supplying a selected class and last-good data.
const React = require('react'), {renderToStaticMarkup} = require('react-dom/server');
function render(selected, failure = null) {
  const states = [data, failure, selected, new Date('2026-10-11T12:00:00Z'), true, 'live'];
  const Component = load('src/components/tournament-live/TournamentLivePage.tsx', {
    react:{...React,useState:()=>[states.shift(),()=>{}],useEffect:()=>{}}, '@/lib/supabase-browser':{supabaseBrowser:{}},
  }).default;
  return renderToStaticMarkup(React.createElement(Component,{tournamentId:id,roundId:round}));
}
const html = render('FPO');
assert.ok(html.includes('FPO course') && html.includes('FPO layout') && !html.includes('MPO course'));
for (const name of ['Waiting','Alice','Bob','Leader']) assert.ok(html.includes(name));
assert.ok(html.indexOf('>Tot</th>')<html.indexOf('>Rating</th>'));
assert.ok(html.indexOf('1<small>Par')<html.indexOf('2<small>Par'));
assert.ok(html.includes('aria-pressed="true"'));
assert.ok(render('FPO',{permanent:false,message:'Retrying'}).includes('Showing last received scores.'));
const css=fs.readFileSync(path.join(root,'src/components/tournament-live/TournamentLivePage.module.css'),'utf8');
assert.match(css,/overflow-x: auto/); assert.match(css,/flex-wrap: nowrap/); assert.match(css,/position: sticky/);
const page=fs.readFileSync(path.join(root,'src/components/tournament-live/TournamentLivePage.tsx'),'utf8');
assert.match(page,/get_public_tournament_live_scorecard_v1/); assert.doesNotMatch(page,/\.from\(|\.functions\./);
assert.match(page,/setClassId\(id => selectedClass\(value.classes, id\)/);
const canonical=path.resolve(root,'../parplay/src/tournaments/classOrder.ts');
if(fs.existsSync(canonical)) assert.equal(fs.readFileSync(path.join(root,'src/lib/event-class-order.ts'),'utf8').split('\n').slice(1).join('\n'),fs.readFileSync(canonical,'utf8'));

(async()=>{
  // Controlled timers verify initial load, settlement-only scheduling, failures and teardown.
  const timers=[]; let resolve, reject, signal, received=0, errors=0;
  const polling=load('src/lib/tournament-live.ts',{}, {setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:()=>{timers.length=0;}});
  const stop=polling.pollTournament(s=>{signal=s;return new Promise((yes,no)=>{resolve=yes;reject=no;});},()=>received++,()=>errors++);
  assert.equal(timers.length,0); // Pending request has no scheduled successor.
  resolve(data); await new Promise(setImmediate);
  assert.equal(received,1); assert.equal(timers[0].ms,4000);
  timers.shift().fn(); assert.equal(timers.length,0);
  reject(new Error('offline')); await new Promise(setImmediate);
  assert.equal(errors,1); assert.equal(timers.length,1);
  timers.shift().fn(); stop(); assert.equal(signal.aborted,true);
  resolve(data); await new Promise(setImmediate);
  assert.equal(received,1); assert.equal(timers.length,0);
  console.log('PASS Tournament public route, class ordering/switching, Results placement/ties, display fields, SSR table, responsive CSS guardrails, polling/error cleanup and canonical ordering parity.');
})().catch(error=>{console.error(error);process.exitCode=1;});
