/* global __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
const root=path.resolve(__dirname,'..');
function load(file,mocks={}) { const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,
 {exports,process:{env:{NODE_ENV:'test',NEXT_PUBLIC_SUPABASE_URL:'https://test.example',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-key'}},require:name=>{assert.ok(name in mocks,name);return mocks[name];},setTimeout,clearTimeout});return exports; }
const server=load('src/lib/supabase-server.ts',{'@supabase/ssr':{},'next/headers':{}});
const client=(user={id:'one'},error=null)=>({auth:{getUser:async()=>({data:{user},error})}});
for(const error of [{name:'AuthSessionMissingError'},{code:'refresh_token_not_found'},{code:'session_not_found'},{code:'bad_jwt'},{name:'AuthApiError',status:401},{name:'AuthApiError',status:403}]) test('known invalid session is rejected: '+JSON.stringify(error),async()=>{
 assert.equal(await server.getVerifiedServerUser(client(null,error)),null);
});
for(const error of [{name:'AuthRetryableFetchError',status:503},{status:429},{status:500},{code:'unexpected_failure'}])test('temporary/unknown verification failure remains an error: '+JSON.stringify(error),async()=>{
 await assert.rejects(()=>server.getVerifiedServerUser(client(null,error)),e=>e.name==='SessionVerificationUnavailableError');
});
test('verified identity is returned; thrown network errors do not become logout',async()=>{
 assert.equal((await server.getVerifiedServerUser(client())).id,'one');
 await assert.rejects(()=>server.getVerifiedServerUser({auth:{getUser:async()=>{throw Error('offline');}}}),e=>e.name==='SessionVerificationUnavailableError');
});
async function proxyRun({url='/create-course/edit',cookie=true,rsc=false,error=null,refresh=false,user={id:'one'}}={}) {
 let calls=0;
 const api=load('proxy.ts',{'next/server':{NextResponse},'@/lib/supabase-server':server,'@supabase/ssr':{createServerClient:(_url,_key,options)=>({auth:{getUser:async()=>{
  calls++;
  if(refresh)options.cookies.setAll([{name:'sb-test-auth-token',value:'rotated',options:{path:'/',sameSite:'lax',maxAge:1234}},{name:'sb-test-auth-token.1',value:'',options:{path:'/',maxAge:0}}],{'Cache-Control':'private, no-store','Pragma':'no-cache'});
  return {data:{user},error};
 }}})}});
 const headers=new Headers();if(cookie)headers.set('cookie','sb-test-auth-token=old');if(rsc)headers.set('rsc','1');
 const request=new NextRequest('https://parplay.test'+url,{headers});const response=await api.proxy(request);return {request,response,calls};
}
test('refresh rotates cookies on request and response, retaining SDK options and cache headers',async()=>{
 const {request,response,calls}=await proxyRun({refresh:true});assert.equal(calls,1);assert.equal(response.status,200);
 assert.equal(request.cookies.get('sb-test-auth-token').value,'rotated');assert.equal(response.cookies.get('sb-test-auth-token').value,'rotated');
 assert.equal(response.cookies.get('sb-test-auth-token').maxAge,1234);assert.equal(response.cookies.get('sb-test-auth-token.1').maxAge,0);
 assert.match(response.headers.get('x-middleware-request-cookie'),/rotated/);assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('server refresh also runs for RSC and public requests with an existing cookie',async()=>{
 for(const options of [{rsc:true},{url:'/courses'},{url:'/login'}]){const h=await proxyRun({...options,refresh:true});assert.equal(h.response.status,200);assert.equal(h.calls,1);assert.equal(h.response.cookies.get('sb-test-auth-token').value,'rotated');}
});
test('missing or invalid protected session redirects; public and existing RSC exceptions remain',async()=>{
 for(const options of [{cookie:false},{user:null,error:{code:'session_not_found'}}]){const h=await proxyRun(options);assert.equal(h.response.status,307);assert.equal(new URL(h.response.headers.get('location')).pathname,'/login');}
 const id='00000000-0000-0000-0000-000000000001';
 for(const url of ['/','/login','/auth/callback','/courses','/courses/example','/verify-email','/course-invite/example','/course-manager-transfer/example','/future/round/example','/future/tournaments/'+id,'/future/tournaments/x/round/y','/future/leagues/x/round/y']){
  const h=await proxyRun({url,cookie:false});assert.equal(h.response.status,200,url);assert.equal(h.calls,0);
 }
 assert.equal((await proxyRun({rsc:true,cookie:false})).response.status,200);
});
test('transient protected failure yields 503, no login redirect or artificial cookie deletion',async()=>{
 const h=await proxyRun({user:null,error:{name:'AuthRetryableFetchError',status:503}});assert.equal(h.response.status,503);assert.equal(h.response.headers.get('location'),null);assert.equal(h.response.cookies.getAll().length,0);assert.equal(h.request.cookies.get('sb-test-auth-token').value,'old');
});
test('successful rotation is retained even when later user verification fails',async()=>{
 for(const error of [{name:'AuthRetryableFetchError',status:503},{code:'session_not_found'}]){const h=await proxyRun({refresh:true,user:null,error});assert.equal(h.response.cookies.get('sb-test-auth-token').value,'rotated');assert.equal(h.response.headers.get('cache-control'),'private, no-store');}
});
test('server adapters persist cookies where writable and WithResponse forwards cookies and SDK headers',async()=>{
 const saved=[],configs=[];const api=load('src/lib/supabase-server.ts',{'next/headers':{cookies:async()=>({getAll:()=>[],set:(...args)=>saved.push(args)})},'@supabase/ssr':{createServerClient:(_url,_key,config)=>{configs.push(config);return {};}}});
 await api.supabaseServer();configs[0].cookies.setAll([{name:'auth',value:'new',options:{maxAge:100}}]);assert.equal(saved[0][1],'new');assert.equal(saved[0][2].maxAge,100);
 const response=NextResponse.next();await api.supabaseServerWithResponse(response);configs[1].cookies.setAll([{name:'auth',value:'newer',options:{maxAge:200}}],{'Cache-Control':'private, no-store'});assert.equal(saved.at(-1)[1],'newer');assert.equal(response.cookies.get('auth').value,'newer');assert.equal(response.headers.get('cache-control'),'private, no-store');
});
test('read-only Server Component adapter does not fail rendering when proxy owns refresh',async()=>{
 let config;const api=load('src/lib/supabase-server.ts',{'next/headers':{cookies:async()=>({getAll:()=>[],set:()=>{throw Error('read only');}})},'@supabase/ssr':{createServerClient:(_url,_key,c)=>{config=c;return {};}}});await api.supabaseServer();assert.doesNotThrow(()=>config.cookies.setAll([{name:'auth',value:'new'}]));
});
function manager(user,error,allowed=true,membership='admin') {
 let reads=0;const db=client(user,error);db.rpc=async()=>{reads++;return {data:allowed,error:null};};
 db.from=()=>{reads++;const query={select(){return query;},eq(){return query;},maybeSingle:async()=>({data:{id:'one',membership},error:null}),then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};return query;};
 const api=load('src/lib/course-manager-auth.ts',{'server-only':{},'@/lib/supabase-server':{...server,supabaseServer:async()=>db}});return {api,reads:()=>reads};
}
test('Course Manager identity failures fail closed and transient failures are not reported as logged out',async()=>{
 for(const method of ['getServerCourseManager','getServerManageableCourses','getServerCourseBuilds','canOpenCourseEditor']){
  const invalid=manager(null,{code:'session_not_found'});assert.equal(await invalid.api[method]('course'),method==='canOpenCourseEditor'?false:null);assert.equal(invalid.reads(),0);
  const outage=manager(null,{status:503});await assert.rejects(()=>outage.api[method]('course'),e=>e.name==='SessionVerificationUnavailableError');assert.equal(outage.reads(),0);
 }
 const admin=manager({id:'one'},null);assert.equal((await admin.api.getServerCourseManager()).profile.membership,'admin');assert.equal(await admin.api.canOpenCourseEditor('course'),true);
 assert.equal(await manager({id:'one'},null,false).api.canOpenCourseEditor('course'),false);
 assert.equal(await manager({id:'one'},null,true,'basic').api.getServerCourseManager(),null);
});

function headerHarness(initial={user:{id:'one',email:'one@example.test'},access_token:'test'},initialError=null) {
 let cursor=0,slots=[],effects=[],callback,session=initial,error=initialError,inAuth=false,listeners=0,tree,profileDelay=null,sessionDelay=null,unmounted=false;
 const events=new Map(),timers=new Set(),pending=[];
 const windowMock={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),setTimeout:fn=>{const timer=setTimeout(()=>{timers.delete(timer);fn();},0);timers.add(timer);return timer;},clearTimeout:timer=>{clearTimeout(timer);timers.delete(timer);}};
 const documentMock={visibilityState:'visible',addEventListener:windowMock.addEventListener,removeEventListener:windowMock.removeEventListener};
 const react={useState:initial=>{const i=cursor++;if(!slots[i])slots[i]={value:initial};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];},useRef:initial=>{const i=cursor++;if(!slots[i])slots[i]={current:initial};return slots[i];},useEffect:(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n]))){effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}}};
 const auth={getSession:async()=>{assert.equal(inAuth,false);const captured=session;if(sessionDelay)await sessionDelay;if(error)return {data:{session:null},error};return {data:{session:captured},error:null};},onAuthStateChange:fn=>{callback=fn;listeners++;return {data:{subscription:{unsubscribe:()=>listeners--}}};},signOut:async()=>{session=null;emit('SIGNED_OUT',null);return {error:null};}};
 function emit(event,value){session=value;inAuth=true;try{assert.equal(callback(event,value),undefined);}finally{inAuth=false;}}
 const jsx=(type,props)=>({type,props});
 const mocks={'@/lib/supabase-browser':{supabaseBrowser:{auth}},'@/lib/access':{getUserAccess:async()=>{assert.equal(inAuth,false);const owner=session?.user.id;if(profileDelay)await profileDelay;return {membership:owner==='one'?'admin':'basic',fullName:owner,limits:{},hasCourseManagerAssignments:false};}},'next/link':{default:'a'},'next/navigation':{usePathname:()=>'/courses',useRouter:()=>({push:()=>{},refresh:()=>{}})},'../Header/MenuItem':{MenuItem:'MenuItem'},react,'react/jsx-runtime':{jsx,jsxs:jsx}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'src/components/Header/Header.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{assert.ok(name in mocks,name);return mocks[name];},window:windowMock,document:documentMock,fetch:async()=>({ok:true,json:async()=>({invitations:[]})})});
 function render(){if(unmounted)return;cursor=0;tree=exports.default();effects.splice(0).forEach(fn=>fn());}
 render();
 function findLogout(node){if(!node||typeof node!=='object')return null;if(Array.isArray(node))return node.map(findLogout).find(Boolean);if(node.type==='button'&&node.props.children==='Logout')return node;return findLogout(node.props?.children);}
 return {emit,render,logout:async()=>{const button=findLogout(tree);assert.ok(button);await button.props.onClick();render();},text:()=>JSON.stringify(tree),listeners:()=>listeners,status:()=>slots[4].value,access:()=>slots[1].value,session:()=>slots[0].value,
  error:v=>error=v,event:name=>events.get(name)?.(),hidden:v=>documentMock.visibilityState=v?'hidden':'visible',
  delayProfile:()=>{let release;profileDelay=new Promise(r=>release=r);return release;},delaySession:()=>{let release;sessionDelay=new Promise(r=>release=r);return release;},
  async settle(){for(let i=0;i<5;i++){await new Promise(r=>setTimeout(r,2));render();}},
  cleanup(){unmounted=true;slots.forEach(s=>s?.cleanup?.());for(const t of timers)clearTimeout(t);pending.length=0;}};
}
test('Header restores persisted session, refreshes outside Auth callback and maintains one listener',async()=>{
 const h=headerHarness();try{assert.match(h.text(),/Restoring session/);await h.settle();assert.equal(h.session().user.id,'one');assert.equal(h.access().membership,'admin');assert.equal(h.listeners(),1);
  h.emit('TOKEN_REFRESHED',{user:{id:'one'},access_token:'refreshed'});h.render();await h.settle();assert.equal(h.session().access_token,'refreshed');assert.equal(h.access().membership,'admin');
 }finally{h.cleanup();}assert.equal(h.listeners(),0);
});
test('Header return from inactive tab and temporary network failure do not log out',async()=>{
 const h=headerHarness();try{await h.settle();h.hidden(true);h.event('visibilitychange');h.error(Error('offline'));h.hidden(false);h.event('visibilitychange');await h.settle();assert.equal(h.session().user.id,'one');h.error(null);h.event('online');await h.settle();assert.equal(h.status(),'ready');assert.equal(h.session().user.id,'one');}finally{h.cleanup();}
});
test('Header cold offline restoration does not expose Login as a completed logout',async()=>{
 const h=headerHarness(null,Error('offline'));try{await h.settle();assert.equal(h.status(),'unavailable');assert.match(h.text(),/Session check unavailable/);assert.doesNotMatch(h.text(),/"href":"\/login"/);}finally{h.cleanup();}
});
test('logout invalidates delayed metadata and session restoration responses',async()=>{
 const h=headerHarness();try{await h.settle();const releaseProfile=h.delayProfile();h.event('course-invitations-changed');const releaseSession=h.delaySession();h.event('focus');h.emit('SIGNED_OUT',null);h.render();releaseProfile();releaseSession();await h.settle();assert.equal(h.session(),null);assert.equal(h.access(),null);assert.match(h.text(),/"href":"\/login"/);}finally{h.cleanup();}
});
test('account switch prevents old access results from showing for new user',async()=>{
 const h=headerHarness();try{await h.settle();const release=h.delayProfile();h.event('course-invitations-changed');h.emit('SIGNED_IN',{user:{id:'two'},access_token:'two'});h.render();release();await h.settle();assert.equal(h.session().user.id,'two');assert.equal(h.access().membership,'basic');assert.equal(h.access().fullName,'two');}finally{h.cleanup();}
});


test('installed SSR SDK refreshes an expired access token and persists rotated session across a new request',async()=>{
 const {createServerClient}=require('@supabase/ssr');
 const now=Math.floor(Date.now()/1000),user={id:'00000000-0000-0000-0000-000000000001',aud:'authenticated',role:'authenticated'};
 const jwt=exp=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp,iat:now-7200,aud:'authenticated'})).toString('base64url')+'.test-signature';
 const fresh=jwt(now+3600),jar=new Map([['sb-test-auth-token',JSON.stringify({access_token:jwt(now-600),refresh_token:'old-refresh',expires_at:now-600,expires_in:3600,token_type:'bearer',user})]]);
 let refreshes=0,users=0;const writes=[];
 const options={cookieEncoding:'raw',cookieOptions:{name:'sb-test-auth-token'},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:(values,headers)=>{writes.push({values,headers});for(const c of values){if(c.options.maxAge===0)jar.delete(c.name);else jar.set(c.name,c.value);}}},global:{fetch:async(url,init)=>{
  if(String(url).includes('/token?grant_type=refresh_token')){refreshes++;assert.equal(JSON.parse(init.body).refresh_token,'old-refresh');return Response.json({access_token:fresh,refresh_token:'rotated-refresh',expires_in:3600,token_type:'bearer',user});}
  if(String(url).endsWith('/user')){users++;assert.equal(new Headers(init.headers).get('authorization'),'Bearer '+fresh);return Response.json(user);}
  throw Error('Unexpected test request');
 }}};
 assert.equal((await server.getVerifiedServerUser(createServerClient('https://test.supabase.co','test-key',options))).id,user.id);
 assert.equal(refreshes,1);assert.ok(writes.length>0);assert.ok(writes.some(w=>w.headers['Cache-Control'].includes('no-store')));
 const saved=JSON.parse(jar.get('sb-test-auth-token'));assert.equal(saved.refresh_token,'rotated-refresh');assert.equal(saved.access_token,fresh);
 assert.equal((await server.getVerifiedServerUser(createServerClient('https://test.supabase.co','test-key',options))).id,user.id);assert.equal(refreshes,1);assert.equal(users,2);
});

test('installed SSR SDK rejects a revoked refresh token and clears its stored session',async()=>{
 const {createServerClient}=require('@supabase/ssr');const now=Math.floor(Date.now()/1000);
 const jar=new Map([['sb-test-auth-token',JSON.stringify({access_token:'expired-token',refresh_token:'revoked',expires_at:now-3600,expires_in:3600,token_type:'bearer',user:{id:'one'}})]]);
 const db=createServerClient('https://test.supabase.co','test-key',{cookieEncoding:'raw',cookieOptions:{name:'sb-test-auth-token'},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>{for(const c of values){if(c.options.maxAge===0)jar.delete(c.name);else jar.set(c.name,c.value);}}},global:{fetch:async()=>Response.json({code:'refresh_token_not_found',msg:'Invalid Refresh Token: Refresh Token Not Found'},{status:400,headers:{'x-supabase-api-version':'2024-01-01'}})}});
 assert.equal(await server.getVerifiedServerUser(db),null);assert.equal(jar.has('sb-test-auth-token'),false);
});


test('normal sign-in and explicit Header logout still work',async()=>{
 const h=headerHarness(null);try{await h.settle();assert.match(h.text(),/"href":"\/login"/);h.emit('SIGNED_IN',{user:{id:'one'},access_token:'new-login'});h.render();await h.settle();assert.equal(h.session().user.id,'one');await h.logout();await h.settle();assert.equal(h.session(),null);assert.equal(h.access(),null);assert.match(h.text(),/"href":"\/login"/);}finally{h.cleanup();}
});
