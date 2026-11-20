/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
function load(p,imports={}){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(n=>imports[n]??require(n),m,m.exports);return m.exports;}
const geo=load('src/utils/fairwayCorridor.ts');
const {publicCourseCorridors}=load('src/lib/publicCourseCorridors.ts',{'@/utils/fairwayCorridor':geo});
test('corridor uses selected physical endpoints and existing bend without modifying stored geometry',()=>{
 const data={tees:[{id:'t',latitude:60,longitude:10}],baskets:[{id:'b',latitude:60.002,longitude:10.002}],configs:[{tee_id:'t',basket_id:'b',fairway:[{lat:60.001,lng:10.0002,width:4}]}]};
 const before=JSON.stringify(data),curved=publicCourseCorridors(data);assert.equal(curved.features.length,1);assert.equal(JSON.stringify(data),before);
 const straight=publicCourseCorridors({...data,configs:[{tee_id:'t',basket_id:'b'}]});assert.equal(straight.features.length,1);assert.notDeepEqual(straight,curved);
 assert.equal(publicCourseCorridors({...data,tees:[]}).features.length,0);
 assert.equal(publicCourseCorridors({...data,tees:[{id:'t',latitude:NaN,longitude:10}]}).features.length,0);
});
function harness(){let context,selection;const effects=[],updates=[];const react={createContext:()=>({Provider:'provider'}),useContext:()=>context,useState:init=>[typeof init==='function'?(selection??init()):init,v=>{selection=v;updates.push(v);}],useEffect:f=>effects.push(f)};
 const jsx=(type,props)=>({type,props});
 const pending=[];const db={rpc:(name,args)=>new Promise(resolve=>pending.push({name,args,resolve}))};
 const api=load('app/(site)/courses/[courseId]/PublicCourseLayouts.tsx',{'react':react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'@/components/CourseConfigurationMap':{default:'map'},'@/lib/supabase-browser':{supabaseBrowser:db}});
 const layouts=[{id:'front',name:'Front - 9'},{id:'standard',name:'Standard Layout',is_default:true},{id:'back',name:'Back - 9'}];
 const provider=()=>{context=api.PublicLayoutProvider({layouts,children:null}).props.value;};provider();
 const walk=(e,type)=>!e||typeof e!=='object'?[]:[...(e.type===type?[e]:[]),...[e.props?.children].flat(Infinity).flatMap(c=>walk(c,type))];
 return {api,provider,layouts,walk,effects,updates,pending};
}
test('default layout and each selected card drive exactly the same map identity',()=>{const h=harness();assert.equal(h.api.PublicCourseMap({courseId:'course'}).props.layoutId,'standard');
 for(const id of ['front','back','standard']){const buttons=h.walk(h.api.PublicCourseLayouts({layouts:h.layouts}),'button');buttons.find(b=>b.props.children&&b.props.onClick&&b.props['aria-pressed']===false);const button=buttons[h.layouts.findIndex(l=>l.id===id)];button.props.onClick();h.provider();assert.equal(h.api.PublicCourseMap({courseId:'course'}).props.layoutId,id);assert.equal(h.walk(h.api.PublicCourseLayouts({layouts:h.layouts}),'button').filter(b=>b.props['aria-pressed']).length,1);}
});
test('rapid layout changes ignore stale hole replies and request only the selected layout',async()=>{const h=harness();const tree=h.api.PublicCourseLayouts({layouts:h.layouts});const overview=h.walk(tree,'section')[0].props.children.at(-1);const Component=overview.type;
 Component({layoutId:'front'});const cleanup=h.effects.pop()();Component({layoutId:'back'});h.effects.pop()();cleanup();
 assert.deepEqual(h.pending.map(p=>p.args),[{p_layout_id:'front'},{p_layout_id:'back'}]);assert.ok(h.pending.every(p=>p.name==='get_public_layout_holes_v1'));
 h.pending[1].resolve({data:[{hole_id:'back-hole',number:10,order_index:1,par:4,distance:120}],error:null});await new Promise(setImmediate);
 h.pending[0].resolve({data:[{hole_id:'front-hole'}],error:null});await new Promise(setImmediate);
 assert.equal(h.updates.length,1);assert.equal(h.updates[0].id,'back');assert.equal(h.updates[0].holes[0].par,4);
});
test('unavailable public reader shows failure instead of substituting another layout',async()=>{const h=harness();const Component=h.walk(h.api.PublicCourseLayouts({layouts:h.layouts}),'section')[0].props.children.at(-1).type;Component({layoutId:'back'});h.effects.pop()();h.pending[0].resolve({data:null,error:{code:'42501'}});await new Promise(setImmediate);assert.deepEqual(h.updates[0],{id:'back',holes:[],error:true});});
test('SQL security contract limits published data and preserves exact selected config and order',()=>{const sql=read('supabase/migrations/20280113_public_layout_holes_v1.sql');assert.match(sql,/stable security definer set search_path=pg_catalog/);assert.equal((sql.match(/l.published is true and c.is_published is true/g)||[]).length,2);assert.match(sql,/lh.play_config_id is null then pc.is_default else pc.id=lh.play_config_id/);assert.match(sql,/order by lh.order_index,h.id/);assert.match(sql,/h.course_id=l.course_id/);assert.match(sql,/pc.course_id=l.course_id/);assert.match(sql,/grant execute[^;]*to anon,authenticated/);assert.doesNotMatch(sql,/alter table|create policy|update public|delete from|insert into/i);assert.match(sql,/LAYOUT_HOLE_DATA_UNAVAILABLE/);});
test('public page filters unpublished layouts and leaves editor map configuration intact',()=>{const page=read('app/(site)/courses/[courseId]/page.tsx');assert.ok(page.includes('.eq("published", true)'));assert.ok(page.indexOf('<PublicCourseLayouts')<page.indexOf('title="Leaderboard"'));const map=read('app/create-course/editor/[courseId]/PhysicalPointsMap.tsx');assert.match(map,/publicView=false/);assert.ok(map.includes('if(!instance||!corridors)return'));assert.match(map,/'fill-opacity':0.12/);});
