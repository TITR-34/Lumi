import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {solve,validateOrder,eta,applyOps,factsText} from './lib/logic.js';import {understand,structure,explain,lastProvider,lastError,aiEnabled,probe,detectLang,tx,noResultText} from './lib/ai.js';import {DEMO,demoText} from './lib/demo.js';import {menuChat} from './lib/ai.js';import {supaEnabled,supaUpload,okImg} from './lib/storage.js';
const D=path.dirname(fileURLToPath(import.meta.url)),DB=process.env.DB_FILE||path.join(D,'data.json');
// .env loader (works on any Node >=18, reads .env next to server.js regardless of the cwd)
try{for(const l of fs.readFileSync(path.join(D,'.env'),'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){const m=l.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/);
  if(m&&!l.trim().startsWith('#')&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2')}}catch{}
let db={restaurants:{},orders:[]};try{db=JSON.parse(fs.readFileSync(DB))}catch{}
db.restaurants.demo=DEMO;
const save=()=>{try{fs.writeFileSync(DB,JSON.stringify(db))}catch{}};
const M={calls:0,errors:0,aiFallbacks:0,chats:0,lat:[]};
const ACTIVE=['New','Accepted','Preparing','Ready'],NEXT=['New','Accepted','Preparing','Ready','Delivered'];
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript'};
const send=(res,code,o)=>{res.writeHead(code,{'content-type':'application/json'});res.end(JSON.stringify(o))};
const LIM=p=>p==='/api/upload'?4e6:p==='/api/restaurants'?8e6:3e5;
const body=(req,lim)=>new Promise(r=>{let b='',big=false;req.on('data',d=>{if(big)return;b+=d;if(b.length>lim){big=true;b=''}});req.on('end',()=>{try{r(big?{__big:1}:JSON.parse(b||'{}'))}catch{r({})}})});
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,24)||'restaurant';
const pct=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]:0;
const clean=(it,i)=>({id:'i'+(i+1),name:String(it.name||'Item').slice(0,60),cat:['starter','main','drink','dessert'].includes(it.cat)?it.cat:'main',
  price:Math.max(0,+it.price||0),prep:Math.min(120,Math.max(1,Math.round(+it.prep)||10)),veg:!!it.veg,spice:Math.min(3,Math.max(0,+it.spice||0)),
  allergens:Array.isArray(it.allergens)?it.allergens.map(String):null,...(okImg(it.img)?{img:it.img}:{}),ingredients:Array.isArray(it.ingredients)?it.ingredients.map(String).slice(0,15):[],
  desc:String(it.desc||'').slice(0,160),available:it.available!==false,...(it.kw?{kw:String(it.kw).slice(0,40)}:{})});
async function api(m,p,b){
  const s=p.split('/').filter(Boolean).slice(1);
  if(p==='/api/health')return{ai:aiEnabled(),lastProvider,lastError,storage:supaEnabled()?'supabase':'inline-fallback'};
  if(p==='/api/ai-test')return await probe();
  if(p==='/api/demo-text')return{text:demoText};
  if(p==='/api/metrics')return{calls:M.calls,errors:M.errors,aiFallbacks:M.aiFallbacks,chats:M.chats,p50ms:pct(M.lat,.5),p95ms:pct(M.lat,.95),orders:db.orders.length,lastProvider};
  if(m==='POST'&&p==='/api/import'){const r=await structure(String(b.text||'').slice(0,8000),String(b.name||'').slice(0,60));if(r.aiFailed)M.aiFallbacks++;return r}
  if(b.__big)return{code:413,error:'Request too large (use smaller images)'};
  if(m==='POST'&&p==='/api/menu-chat'){
    const msg=String(b.message||'').trim().slice(0,5000);if(!msg)return{code:400,error:'Empty message'};
    const items=(Array.isArray(b.items)?b.items.slice(0,80):[]).map(x=>({...x,uid:String(x.uid||'').slice(0,20),img:okImg(x.img)?x.img:undefined}));
    const history=Array.isArray(b.history)?b.history.slice(-6).map(h=>({role:h.role==='user'?'owner':'lumi',text:String(h.text||'').slice(0,300)})):[];
    const r=await menuChat(msg,items.map(x=>({...x,uid:x.uid||'u'+Math.random().toString(36).slice(2,8)})),String(b.name||'').slice(0,60),history);if(r.aiFailed)M.aiFallbacks++;return r}
  if(m==='POST'&&p==='/api/upload'){
    const mm=String(b.data||'').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);if(!mm)return{code:400,error:'Please upload a JPG, PNG or WebP image'};
    const buf=Buffer.from(mm[2],'base64');if(buf.length>2e6)return{code:400,error:'Image is too large (max 2 MB)'};
    if(supaEnabled()){try{return{url:await supaUpload(buf,mm[1]),storage:'supabase'}}catch(e){console.warn('[upload]',String(e.message).slice(0,200))}}
    return buf.length<=2e5?{url:b.data,storage:'inline'}:{code:502,error:'Image storage is unavailable right now'}}
  if(m==='POST'&&p==='/api/restaurants'){
    if(!String(b.name||'').trim()||!Array.isArray(b.items)||!b.items.length)return{code:400,error:'Name and at least one item required'};
    const id=slug(b.name)+'-'+Math.random().toString(36).slice(2,6);
    db.restaurants[id]={id,name:String(b.name).slice(0,60),tagline:String(b.tagline||'').slice(0,100),currency:'₼',menu:b.items.slice(0,80).map(clean)};save();return{id}}
  if(m==='GET'&&s[0]==='restaurants'&&s[1]){const r=db.restaurants[s[1]];return r||{code:404,error:'Restaurant not found'}}
  if(m==='POST'&&p==='/api/chat'){
    const r=db.restaurants[b.rid];if(!r)return{code:404,error:'Restaurant not found'};
    const msg=String(b.message||'').trim().slice(0,500);if(!msg)return{code:400,error:'Empty message'};
    M.chats++;const cur=r.currency,prev=b.constraints&&typeof b.constraints==='object'?b.constraints:{};
    const order={};for(const[id,q]of Object.entries(b.order||{}))if(r.menu.some(i=>i.id===id)&&Number.isInteger(q)&&q>0&&q<=20)order[id]=q;
    const history=Array.isArray(b.history)?b.history.slice(-6).map(h=>({role:h.role==='user'?'guest':'lumi',text:String(h.text||'').slice(0,300)})):[];
    const shown=Array.isArray(b.shown)?b.shown.slice(-60).map(x=>String(x).slice(0,80)):[];
    const u=await understand(msg,{menu:r.menu,prev,order,history,cur});if(u.aiFailed)M.aiFallbacks++;
    const lang=u.lang||detectLang(msg),T=tx(lang),c=u.constraints||prev;let text='',options=[],newOrder;
    if(u.intent==='modify_order'){
      const x=applyOps(r.menu,order,u.ops);newOrder=x.order;
      const tot=validateOrder(r.menu,{table:'x',items:Object.entries(newOrder).map(([id,qty])=>({id,qty}))}).total;
      text=(u.answer||x.notes.join('. ')||T.nofind)+' '+(Object.keys(newOrder).length?T.total(cur,tot):T.empty);
    }else if(u.intent==='question'||u.intent==='chitchat'){
      const f=factsText(r.menu,u.refs,cur);text=(u.answer||'')+(f?(u.answer?'\n\n':'')+f:'');
      if(!text)text=T.noinfo;
    }else{
      const canon=o=>JSON.stringify(Object.keys(o||{}).sort().map(k=>[k,o[k]])),same=canon(c)===canon(prev),more=u.more||(same&&shown.length>0);
      const sol=solve(r.menu,c,{skip:more?shown:[]});options=sol.options;
      text=sol.options.length?await explain(msg,sol.options,cur,{lang,history,more}):noResultText(sol.reason,lang,cur,sol.min);
      if(c.allergies?.length)text+=' '+T.allergy;
    }
    return{constraints:c,options,text,order:newOrder,intent:u.intent,aiFailed:u.aiFailed,lang};}
  if(m==='POST'&&p==='/api/orders'){
    const r=db.restaurants[b.rid];if(!r)return{code:404,error:'Restaurant not found'};
    const v=validateOrder(r.menu,b);if(!v.ok)return{code:400,error:v.errors.join('; ')};
    const active=db.orders.filter(o=>o.rid===r.id&&ACTIVE.includes(o.status)).length;
    const o={id:'o'+Date.now().toString(36)+Math.random().toString(36).slice(2,4),rid:r.id,table:String(b.table).slice(0,10),note:String(b.note||'').slice(0,200),
      lines:v.lines,total:v.total,status:'New',created:Date.now(),etaMin:eta(v.lines,active)};
    db.orders.push(o);save();return o}
  if(s[0]==='orders'&&s[1]){const o=db.orders.find(x=>x.id===s[1]);if(!o)return{code:404,error:'Order not found'};
    if(m==='PATCH'){if(!NEXT.includes(b.status))return{code:400,error:'Bad status'};o.status=b.status;save()}return o}
  if(m==='GET'&&s[0]==='kitchen'&&s[1])return{orders:db.orders.filter(o=>o.rid===s[1]&&(o.status!=='Delivered'||Date.now()-o.created<36e5)).slice(-60)};
  return{code:404,error:'Not found'};
}
http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://x'),p=u.pathname,t0=Date.now();
  try{
    if(p.startsWith('/api/')){M.calls++;const out=await api(req.method,p,req.method==='GET'?{}:await body(req,LIM(p)));M.lat.push(Date.now()-t0);if(M.lat.length>500)M.lat.shift();
      if(out.code>=400)M.errors++;return send(res,out.code||200,out.code?{error:out.error}:out)}
    const f=p.startsWith('/r/')?'r.html':p.startsWith('/k/')?'k.html':p==='/'?'index.html':p==='/demo'?'demo.html':path.basename(p);
    const buf=fs.readFileSync(path.join(D,'public',f));res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream'});res.end(buf);
  }catch(e){if(e.code==='ENOENT'){res.writeHead(404);return res.end('Not found')}M.errors++;send(res,500,{error:'Server error'})}
}).listen(process.env.PORT||3000,()=>console.log('Lumi on :'+(process.env.PORT||3000)+' | AI '+(aiEnabled()?'enabled (gemini:'+!!process.env.GEMINI_API_KEY+', llm:'+!!process.env.LLM_API_KEY+')':'DISABLED - no key found in .env (fallback mode)')));
