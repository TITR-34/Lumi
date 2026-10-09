// AI layer. Provider chain: Gemini -> OpenAI-compatible (Groq) -> deterministic fallback.
// The LLM only UNDERSTANDS the guest and WRITES friendly text. Menu facts, prices, totals,
// allergens and availability always come from code (lib/logic.js).
const ALLERGENS=['gluten','dairy','nuts','egg','fish','shellfish','soy','sesame'];
export let lastProvider='none',lastError='';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const short=(e,n=900)=>String(e?.message||e).replace(/\s+/g,' ').slice(0,n);

async function viaGemini(prompt,json,temp){
  const key=(process.env.GEMINI_API_KEY||'').trim();if(!key)throw new Error('GEMINI_API_KEY is not set');
  const errs=[];let err;
  for(const model of (process.env.GEMINI_MODEL||'gemini-flash-latest,gemini-flash-lite-latest,gemini-3.1-flash-lite').split(',').map(s=>s.trim()).filter(Boolean)){
    const cfg={temperature:temp,...(json?{responseMimeType:'application/json'}:{})};
    if(/2\.5/.test(model))cfg.thinkingConfig={thinkingBudget:0}; // no hidden "thinking": faster and cheaper chat
    err=null;
    for(let attempt=0;attempt<2;attempt++){
      try{
        const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',
          headers:{'content-type':'application/json','x-goog-api-key':key},signal:AbortSignal.timeout(12000),
          body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:cfg})});
        if(r.status===429||r.status===503){err=new Error(`gemini ${model} ${r.status}`);await sleep(600);continue}
        if(!r.ok)throw new Error(`gemini ${model} ${r.status}: ${(await r.text()).slice(0,140)}`);
        const d=await r.json(),t=d.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('');
        if(!t)throw new Error(`gemini ${model} empty answer (${d.candidates?.[0]?.finishReason||d.promptFeedback?.blockReason||'?'})`);
        return t;
      }catch(e){err=e;break}
    }
    if(err)errs.push(short(err,170));
  }
  throw new Error(errs.join(' ; ')||'gemini failed');
}
// Any OpenAI-compatible provider (Groq by default; also OpenRouter, Cerebras, ...)
async function viaOpenAI(prompt,json,temp){
  const key=(process.env.LLM_API_KEY||'').trim();if(!key)throw new Error('LLM_API_KEY is not set');
  const r=await fetch((process.env.LLM_BASE_URL||'https://api.groq.com/openai/v1')+'/chat/completions',{method:'POST',
    headers:{'content-type':'application/json',authorization:'Bearer '+key},signal:AbortSignal.timeout(15000),
    body:JSON.stringify({model:process.env.LLM_MODEL||'llama-3.3-70b-versatile',temperature:temp,messages:[{role:'user',content:prompt}],...(json?{response_format:{type:'json_object'}}:{})})});
  if(!r.ok)throw new Error(`llm ${r.status}: ${(await r.text()).slice(0,140)}`);
  const t=(await r.json()).choices?.[0]?.message?.content;if(!t)throw new Error('llm empty answer');return t;
}
export const aiEnabled=()=>!!(process.env.GEMINI_API_KEY||process.env.LLM_API_KEY);
async function gen(prompt,json,temp=0.3){ // never throws a secret; records WHY it failed for /api/health
  const errs=[];
  for(const[n,f]of[['gemini',viaGemini],['openai-compatible',viaOpenAI]]){
    try{const t=await f(prompt,json,temp);lastProvider=n;lastError='';return t}catch(e){errs.push(short(e))}
  }
  lastProvider='fallback';lastError=errs.join(' | ');console.warn('[AI] all providers failed:',lastError);
  throw new Error('all AI providers failed');
}
const parseJSON=t=>{t=String(t).trim().replace(/^```(?:json)?\s*|\s*```$/g,'');try{return JSON.parse(t)}catch{const m=t.match(/\{[\s\S]*\}/);if(!m)throw new Error('no json');return JSON.parse(m[0])}};
export async function probe(){const t0=Date.now(),configured={gemini:!!(process.env.GEMINI_API_KEY||'').trim(),llm:!!(process.env.LLM_API_KEY||'').trim()};try{const o=parseJSON(await gen('Return exactly this JSON: {"ok":true}',true,0));return{ok:o.ok===true,provider:lastProvider,ms:Date.now()-t0,configured}}catch{return{ok:false,provider:lastProvider,ms:Date.now()-t0,configured,error:lastError}}}

// ---------------- language + friendly template texts (used when AI is unavailable) ----------------
export const detectLang=s=>/[а-яё]/i.test(s)?'ru':(/[əıöüşçğ]|\b(salam|manat|nefer|olsun|isteyirem|yemek|porsion|adama|tesekkur|sag ol|mene|bize|aci|başqa|basqa)\b/i.test(s)?'az':'en');
const pick=a=>a[Math.floor(Math.random()*a.length)];
const TX={
 en:{hi:["Hi! 👋 I'm Lumi, your AI waiter. How many of you are there, and what's your budget? Tell me anything you avoid and I'll put a meal together.","Hello! 😊 I'm Lumi. Tell me how many people, your budget or time — I'll suggest something tasty."],
  thanks:["You're welcome! 😊 Anything else I can add or change?","Happy to help! Shout if you want to tweak the order."],
  ask:"Let's narrow it down 🙂 How many people are you, and roughly what budget (or how much time) do you have?",
  rec:(n,more)=>more?`Here ${n>1?'are '+n+' other options':'is another option'} for you 🍽️`:`I found ${n} option${n>1?'s':''} for you 🍽️ Option 1 is the best match — tell me if you'd like something different.`,
  none:{budget:(c,m)=>`That budget is a bit tight 😅 The cheapest valid combination is ${c}${m?.toFixed(2)}.`,time:()=>'Nothing on the menu fits that time limit. Could you allow a few more minutes?',vegetarian:()=>'There are not enough vegetarian mains for that request.',filters:()=>'I could not find dishes matching all those restrictions. Please ask a waiter for help.',exhausted:()=>"That was everything that fits 🙂 Try changing the budget or a preference and I'll search again."},
  allergy:"Allergen info comes from the restaurant's menu data; dishes with unknown allergen data are excluded. Please confirm with staff.",
  total:(c,t)=>`New total: ${c}${t.toFixed(2)}.`,empty:'Your order is empty now.',nofind:'I could not find that in your order.',
  noinfo:'Please ask a waiter — I do not have that information.'},
 az:{hi:["Salam! 👋 Mən Lumi, sizin AI ofisiantınız. Neçə nəfərsiniz və büdcəniz nə qədərdir? Nədənsə qaçırsınızsa deyin, sizə uyğun yemək yığım.","Salam! 😊 Mən Lumiyəm. Neçə nəfər olduğunuzu, büdcə və ya vaxtınızı yazın — dadlı bir şey təklif edim."],
  thanks:["Dəyməz! 😊 Sifarişə nəsə əlavə edək, ya dəyişək?","Həmişə buyurun! İstəsəniz sifarişi dəyişə bilərik."],
  ask:"Bir az dəqiqləşdirək 🙂 Neçə nəfərsiniz və təxminən büdcəniz (və ya vaxtınız) nə qədərdir?",
  rec:(n,more)=>more?`Sizin üçün ${n} başqa variant tapdım 🍽️`:`Sizin üçün ${n} variant tapdım 🍽️ Birinci variant ən yaxşı uyğunluqdur — fərqli bir şey istəsəniz yazın.`,
  none:{budget:(c,m)=>`Büdcə bir az azdır 😅 Ən ucuz uyğun kombinasiya ${c}${m?.toFixed(2)}-dır.`,time:()=>'Menyuda bu vaxta uyğun yemək yoxdur. Bir neçə dəqiqə də əlavə edə bilərsiniz?',vegetarian:()=>'Bu sorğu üçün kifayət qədər vegetarian əsas yemək yoxdur.',filters:()=>'Bütün məhdudiyyətlərə uyğun yemək tapa bilmədim. Zəhmət olmasa ofisiantdan soruşun.',exhausted:()=>'Uyğun olanların hamısını göstərdim 🙂 Büdcəni və ya istəyi dəyişin, yenidən axtarım.'},
  allergy:'Allergen məlumatı restoranın menyu datasından gəlir; allergen məlumatı bilinməyən yeməklər çıxarılıb. Zəhmət olmasa işçi ilə də dəqiqləşdirin.',
  total:(c,t)=>`Yeni cəm: ${c}${t.toFixed(2)}.`,empty:'Sifarişiniz indi boşdur.',nofind:'Bunu sifarişinizdə tapa bilmədim.',
  noinfo:'Zəhmət olmasa ofisiantdan soruşun — bu məlumat məndə yoxdur.'},
 ru:{hi:["Привет! 👋 Я Lumi, ваш AI-официант. Сколько вас и какой бюджет? Скажите, чего избегаете — подберу ужин.","Здравствуйте! 😊 Я Lumi. Напишите, сколько вас, бюджет или время — предложу что-нибудь вкусное."],
  thanks:["Пожалуйста! 😊 Добавим что-нибудь или изменим заказ?","Рада помочь! Если захотите что-то поменять — пишите."],
  ask:"Давайте уточним 🙂 Сколько вас и какой примерно бюджет (или сколько у вас времени)?",
  rec:(n,more)=>more?`Нашла ещё ${n} вариант(а) 🍽️`:`Нашла для вас ${n} вариант(а) 🍽️ Вариант 1 подходит лучше всего — скажите, если хотите что-то другое.`,
  none:{budget:(c,m)=>`Бюджет маловат 😅 Самая дешёвая подходящая комбинация — ${c}${m?.toFixed(2)}.`,time:()=>'В меню нет блюд на такое время. Можно добавить пару минут?',vegetarian:()=>'Для этого запроса недостаточно вегетарианских основных блюд.',filters:()=>'Не нашла блюд, подходящих под все ограничения. Спросите официанта.',exhausted:()=>'Это всё, что подходит 🙂 Измените бюджет или пожелание — поищу снова.'},
  allergy:'Данные об аллергенах берутся из меню ресторана; блюда с неизвестными аллергенами исключены. Пожалуйста, уточните у персонала.',
  total:(c,t)=>`Новая сумма: ${c}${t.toFixed(2)}.`,empty:'Ваш заказ теперь пуст.',nofind:'Не нашла этого в вашем заказе.',
  noinfo:'Пожалуйста, спросите официанта — у меня нет этой информации.'}
};
export const tx=l=>TX[l]||TX.en;
export const noResultText=(reason,lang,cur,min)=>(tx(lang).none[reason]||tx(lang).none.filters)(cur,min);

// ---------------- deterministic understanding (used when every AI provider fails) ----------------
const num=v=>(v==null||v===''||isNaN(+v)||+v<0)?undefined:+v;
const NW={bir:1,iki:2,'üç':3,'dörd':4,one:1,two:2,three:3,four:4,'один':1,'одна':1,'два':2,'две':2,'три':3,'четыре':4};
const toN=w=>/^\d+$/.test(w)?+w:NW[w.toLowerCase()];
const PREF=[[/fish|balıq|balik|рыб/,['fish','bass']],[/chicken|toyuq|кур/,['chicken']],[/lamb|quzu|meat|ət\b|мяс|баран/,['lamb']],[/dessert|desert|şirin|sirin|сладк|десерт/,['dessert']],[/salad|salat|light|yüngül|лёгк|легк/,['salad']],[/soup|şorba|суп/,['soup']]];
export function fallbackExtract(t,prev={}){
  const c={...prev},s=String(t).toLowerCase();let m;
  if(m=s.match(/(\d+(?:[.,]\d+)?)\s*(?:₼|azn|manat|манат|man\b|€|eur|\$|usd)/)||s.match(/[₼€$]\s*(\d+(?:[.,]\d+)?)/)||s.match(/(?:budget|büdcə|budce|бюджет|under|altında)\D{0,8}(\d+(?:[.,]\d+)?)/))c.budget=+m[1].replace(',','.');
  const NWR='\\d+|bir|iki|üç|dörd|one|two|three|four|один|одна|два|две|три|четыре';
  if(m=s.match(new RegExp(`(${NWR})\\s*(?:nəfərlik|nəfər|nefer|people|persons?|guests?|kişi|adam|человек|чел|порци|porsion|portion)`)))c.people=toN(m[1]);
  else if(m=s.match(/adama\s*(\d+)/))c.people=+m[1];
  if(m=s.match(/(\d+)\s*(?:dəq|deq|min|мин)/))c.maxMinutes=+m[1];
  if(/vegetar|vegan|вегетар/.test(s))c.vegetarians=/one of us|biri|один из/.test(s)?1:(c.people||1);
  if(/not spicy|no spic|acı olmas|aci olmas|не остр|without spic/.test(s))c.maxSpice=0;
  const map={nuts:/nut|qoz|fındıq|findiq|fıstıq|орех/,gluten:/gluten|qlüten/,dairy:/dairy|lactose|süd/,egg:/\begg|yumurta/,fish:/\bfish|balıq/,shellfish:/shellfish|krevet/,sesame:/sesame|küncüt/};
  const al=new Set(c.allergies||[]);for(const[k,re]of Object.entries(map))if(re.test(s)&&/allerg|intoleran|can't eat|without|olmas|аллерг/.test(s))al.add(k);
  c.allergies=[...al];
  for(const[re,w]of PREF)if(re.test(s)&&!/allerg|olmas|without|не /.test(s)){c.prefer=[...new Set([...(c.prefer||[]),...w])];break}
  return c;
}
const CATS={drink:/tea|çay|ayran|cola|lemonade|juice|water|coffee|kofe|şərbət/i,dessert:/pakhlava|baklava|ice cream|cake|dessert|şəkərbura|paxlava/i,starter:/salad|soup|starter|qutab|dolma|hummus|salat/i};
const guessCat=n=>Object.keys(CATS).find(k=>CATS[k].test(n))||'main';
export function fallbackUnderstand(msg,menu,prev,order){
  const s=String(msg).toLowerCase(),by=Object.fromEntries(menu.map(i=>[i.id,i])),lang=detectLang(msg);
  const named=menu.filter(i=>i.name.toLowerCase().split(/[^a-zəıöüçşğа-я]+/).filter(w=>w.length>3).some(w=>s.includes(w)));
  if(/remove|delete|çıxar|cixar|\bsil\b|убер|удал/.test(s)){
    const cw={drink:/drink|içki|icki|напит/,dessert:/dessert|desert|десерт/,starter:/starter|salad|закуск/},ops=[];
    for(const id of Object.keys(order||{}))if(by[id]&&(named.some(n=>n.id===id)||Object.entries(cw).some(([c,re])=>re.test(s)&&by[id].cat===c)))ops.push({op:'remove',item_id:id,qty:99});
    if(ops.length)return{intent:'modify_order',ops,lang};
  }
  if(/\badd\b|əlavə|elave|добав/.test(s)&&named.length){const q=Math.max(1,+(s.match(/\d+/)||[1])[0]);return{intent:'modify_order',ops:named.slice(0,2).map(i=>({op:'add',item_id:i.id,qty:q})),lang}}
  if(named.length&&!/\d/.test(s)&&!/not spicy|no spic|acı olmas|не остр/.test(s)&&/what|ingredient|contain|içində|tərkib|nədir|состав|что в|is it|tell me about/.test(s))return{intent:'question',refs:named.slice(0,2).map(i=>i.id),answer:'',lang};
  if(/^\s*(hi|hello|hey|salam|sal[aə]m|привет|здравствуй\w*)\b[\s!.?]*$/.test(s))return{intent:'chitchat',refs:[],answer:pick(tx(lang).hi),lang};
  if(/^\s*(thanks|thank you|təşəkkür|tesekkur|sağ ol|sag ol|çox sağ ol|spasibo|спасибо)\b/.test(s))return{intent:'chitchat',refs:[],answer:pick(tx(lang).thanks),lang};
  const more=/another|other option|something else|different|başqa|basqa|bir də|другой|ещё|еще/.test(s);
  const c=fallbackExtract(msg,prev);
  if(!more&&!/\d|vegetar|vegan|spic|acı|aci|allerg|аллерг|вегетар|fish|balıq|chicken|toyuq|lamb|dessert|desert|salad|soup|meat|ət|рыб|мяс|кур|десерт|салат|суп/.test(s)&&!Object.keys(prev||{}).length)
    return{intent:'chitchat',refs:[],answer:tx(lang).ask,lang};
  return{intent:'recommend',constraints:c,more,lang};
}

// ---------------- AI understanding ----------------
export async function understand(msg,{menu,prev,order,history,cur}){
  const by=Object.fromEntries(menu.map(i=>[i.id,i]));
  const lines=menu.map(i=>`${i.id}|${i.name}|${i.cat}|${cur}${i.price}|${i.veg?'veg':'non-veg'}|spice ${i.spice}|${i.available===false?'UNAVAILABLE|':''}allergens: ${i.allergens==null?'UNKNOWN':i.allergens.join(',')||'none'}|${(i.ingredients||[]).join('/')}`).join('\n');
  const ord=Object.entries(order).map(([id,q])=>`${id} ${by[id]?.name} x${q}`).join('; ')||'(empty)';
  const hist=(history||[]).map(h=>`${h.role}: ${h.text}`).join('\n')||'(none)';
  try{
    const out=parseJSON(await gen(`You are Lumi, the warm, witty AI waiter of a restaurant in Baku. You chat like a friendly human waiter: short, natural, a little humour, at most one emoji. The MENU below is the only truth; never invent dishes, prices or ingredients.
MENU (id|name|type|price|diet|spice|allergens|ingredients):
${lines}
CURRENT ORDER: ${ord}
CURRENT CONSTRAINTS: ${JSON.stringify(prev)}
RECENT CHAT:
${hist}
GUEST MESSAGE: ${JSON.stringify(msg)}
Return JSON only:
{"intent":"recommend|modify_order|question|chitchat","lang":"az|en|ru","constraints":{"budget":number|null,"people":int|null,"vegetarians":int|null,"maxMinutes":int|null,"maxSpice":0-3|null,"allergies":[subset of ${ALLERGENS.join(',')}],"exclude":[ingredient words],"prefer":[words]},"more":boolean,"ops":[{"op":"add|remove","item_id":"...","qty":1}],"refs":[item ids],"answer":"..."}
Rules:
- "constraints" is the COMPLETE set after this message: keep previous ones unless the guest changes or drops them; start fresh if it is clearly a new request. "prefer" = English words from menu names/ingredients or categories (starter|main|drink|dessert) for what the guest feels like (fish, lamb, chicken, dessert, salad...). If the guest gives no number of people, assume 1 only when they say things like "for me / mənə / adama / 1 porsion".
- intent: "add X", "remove the drink", "replace X with Y" => modify_order (ops use ids from MENU). "what is in this dish", "is it spicy" => question. Budget/people/time/diet/taste changes or asking for suggestions => recommend. Greetings, thanks, small talk, "what do you recommend?" without any detail => chitchat.
- "more": true if the guest wants DIFFERENT options than before ("başqa variant", "another one", "что-нибудь другое").
- "answer": for chitchat/question: max 2 short friendly sentences in the guest's language using ONLY menu data; for chitchat gently ask what you need (people, budget, diet). For modify_order: one short friendly confirmation without totals. For recommend: "". Never say a dish is safe for an allergy; if info is missing or UNKNOWN, tell them to ask staff.
- Reply in the guest's language (Azerbaijani, English or Russian) with natural, correct grammar. Examples: "adama 1 porsion olsun" => recommend, people 1. "içkini çıxar" => modify_order remove the drink. "salam" => chitchat greeting.`,true,0.35));
    const intent=['recommend','modify_order','question','chitchat'].includes(out.intent)?out.intent:'recommend';
    let c=prev;
    if(out.constraints&&typeof out.constraints==='object'){const k=out.constraints;c={};
      for(const f of['budget','people','vegetarians','maxMinutes']){const v=num(k[f]);if(v!==undefined&&v>0)c[f]=v}
      if(k.maxSpice!=null&&k.maxSpice>=0&&k.maxSpice<=3)c.maxSpice=+k.maxSpice;
      c.allergies=(Array.isArray(k.allergies)?k.allergies:[]).filter(a=>ALLERGENS.includes(a));
      c.exclude=(Array.isArray(k.exclude)?k.exclude:[]).map(String).slice(0,10);
      c.prefer=(Array.isArray(k.prefer)?k.prefer:[]).map(String).slice(0,6);if(!c.prefer.length)delete c.prefer}
    return{intent,constraints:c,more:out.more===true,lang:['az','en','ru'].includes(out.lang)?out.lang:detectLang(msg),
      ops:(Array.isArray(out.ops)?out.ops:[]).filter(o=>by[o?.item_id]&&['add','remove'].includes(o.op)).slice(0,10),
      refs:(Array.isArray(out.refs)?out.refs:[]).filter(id=>by[id]),answer:String(out.answer||'').slice(0,500),aiFailed:false};
  }catch{return{...fallbackUnderstand(msg,menu,prev,order),aiFailed:true}}
}
// Friendly 2-3 sentence recommendation text. Facts come from the verified solver result only.
export async function explain(msg,options,cur,{lang='en',history=[],more=false}={}){
  const hist=(history||[]).map(h=>`${h.role}: ${h.text}`).join('\n')||'(none)';
  try{return(await gen(`You are Lumi, a warm, witty AI waiter. Reply in the guest's language (${lang==='az'?'Azerbaijani':lang==='ru'?'Russian':'English'}) with natural, correct grammar. Write 2-3 short sentences: say why Option 1 fits what the guest asked (budget, time, diet, taste), mention that Options 2 and 3 are alternatives${more?', and that these are NEW options different from before':''}, and end with a tiny friendly question or offer (e.g. a drink or dessert). Use ONLY these verified facts, invent nothing, make no health or allergy claims, do not list every price again, at most one emoji.
Recent chat:\n${hist}\nGuest: ${JSON.stringify(msg)}\nOptions (cards with prices are shown separately): ${JSON.stringify(options.map((o,i)=>({option:i+1,dishes:o.items.map(x=>x.name),total:o.total,minutes:o.minutes})))}\nCurrency: ${cur}`,false,0.7)).trim()}
  catch{return tx(lang).rec(options.length,more)}
}
// ---------------- menu import (unchanged behaviour) ----------------
export function fallbackStructure(text,name){
  const items=[];
  for(const line of String(text).split('\n')){const p=line.match(/(\d+(?:[.,]\d+)?)\s*[^\d]*$/);if(!p)continue;
    const [nm,...rest]=line.replace(p[0],'').split(/\s[-—–:]\s|,/);const n=nm.trim();if(!n)continue;
    items.push({name:n,cat:guessCat(n),price:+p[1].replace(',','.'),prep:guessCat(n)==='drink'?2:15,veg:false,spice:0,allergens:null,ingredients:rest.join(',').split(',').map(s=>s.trim()).filter(Boolean),desc:rest.join(', ').trim(),available:true});}
  return{name:name||'My Restaurant',tagline:'',items};
}
export async function structure(text,name){
  try{
    const r=parseJSON(await gen(`Convert this restaurant menu text into JSON: {"name":string,"tagline":string,"items":[{"name":string,"cat":"starter|main|drink|dessert","price":number,"prep":int minutes (realistic estimate),"veg":boolean (true only if clearly vegetarian),"spice":0-3,"allergens":array from ${ALLERGENS.join(',')} or null if the text does not allow knowing (do NOT guess),"ingredients":[string],"desc":string}]}. Do not invent dishes. Menu text:\n${text}`,true,0.1));
    if(!Array.isArray(r.items)||!r.items.length)throw 0;
    return{restaurant:{name:name||r.name,tagline:r.tagline||'',items:r.items},aiFailed:false};
  }catch{return{restaurant:fallbackStructure(text,name),aiFailed:true}}
}

// ---------------- chat-style menu builder (Add restaurant) ----------------
const rid=()=>'u'+Math.random().toString(36).slice(2,9);
const L3=(lang,o)=>o[lang]||o.en;
export function normItem(x){
  const n=String(x?.name||'').trim().slice(0,60);if(!n)return null;
  const al=Array.isArray(x.allergens)?x.allergens.map(a=>String(a).toLowerCase()).filter(a=>ALLERGENS.includes(a)):null;
  return{name:n,cat:['starter','main','drink','dessert'].includes(x.cat)?x.cat:guessCat(n),price:Math.max(0,Math.round((+String(x.price).replace(',','.')||0)*100)/100),
    prep:Math.min(120,Math.max(1,Math.round(+x.prep)||(guessCat(n)==='drink'?2:12))),veg:x.veg===true,spice:Math.min(3,Math.max(0,Math.round(+x.spice)||0)),
    allergens:al,ingredients:Array.isArray(x.ingredients)?x.ingredients.map(s=>String(s).slice(0,40)).slice(0,15):[],desc:String(x.desc||'').slice(0,160),available:x.available!==false};
}
export async function menuChat(message,items,name,history=[]){
  const lang=detectLang(message),cur=new Map(items.map(i=>[i.uid,i]));
  const table=items.map(i=>`${i.uid}|${i.name}|${i.cat}|${i.price}|prep ${i.prep}|${i.veg?'veg':'non-veg'}|spice ${i.spice}|allergens: ${i.allergens==null?'UNKNOWN':i.allergens.join(',')||'none'}|${i.available===false?'UNAVAILABLE|':''}${(i.ingredients||[]).join('/')}|${i.desc||''}`).join('\n')||'(empty)';
  const hist=history.slice(-6).map(h=>`${h.role}: ${String(h.text).slice(0,300)}`).join('\n')||'(none)';
  try{
    const out=parseJSON(await gen(`You are Lumi's menu assistant. A restaurant owner describes their menu in a chat (Azerbaijani, English or Russian, often informal, maybe a long paragraph or a list). You maintain a structured menu TABLE.
CURRENT TABLE (uid|name|type|price|prep minutes|diet|spice|allergens|ingredients|description):
${table}
RESTAURANT NAME: ${JSON.stringify(name||'')}
RECENT CHAT:
${hist}
OWNER MESSAGE: ${JSON.stringify(message)}
Return JSON only: {"reply":string,"name":string|null,"tagline":string|null,"items":[{"uid":string|null,"name":string,"cat":"starter|main|drink|dessert","price":number,"prep":int,"veg":boolean,"spice":0-3,"allergens":[subset of ${ALLERGENS.join(',')}]|null,"ingredients":[string],"desc":string,"available":boolean}]}
Rules:
- "items" is the COMPLETE table after this message. Keep every existing row (same uid) unless the owner asks to remove it; apply edits ("change X price to 12", "remove tea", "make plov unavailable") to the right row. New dishes get uid null.
- Extract every dish the owner mentions: name, price, ingredients (from the text), a short desc, a realistic prep estimate, veg only if clearly vegetarian. NEVER invent dishes. If a price is not given use 0 and ask for it in the reply. allergens = null (unknown) unless the owner states them; do NOT guess allergens.
- "name"/"tagline": only if the owner says the restaurant name/slogan, else null.
- "reply": 1-3 short friendly sentences in the owner's language: say what you added/changed, then ask for at most one thing that is missing (e.g. prices, drinks, desserts) or say they can add photos in the table. No lists, no markdown.`,true,0.15));
    if(!Array.isArray(out.items))throw 0;
    const res=[],seen=new Set();
    for(const x of out.items){const n=normItem(x);if(!n)continue;const old=x.uid&&cur.has(x.uid)&&!seen.has(x.uid)?cur.get(x.uid):null;
      const uid=old?old.uid:rid();seen.add(uid);res.push({...n,uid,...(old?.img?{img:old.img}:{})})}
    if(!res.length&&items.length)throw 0; // never wipe the table by accident
    return{reply:String(out.reply||'').slice(0,500)||L3(lang,{en:'Done — check the table.',az:'Hazırdır — cədvələ baxın.',ru:'Готово — проверьте таблицу.'}),
      name:out.name?String(out.name).slice(0,60):null,tagline:out.tagline?String(out.tagline).slice(0,100):null,items:res,aiFailed:false};
  }catch{
    const f=fallbackStructure(message,name).items.filter(i=>i.price>0).map(normItem).filter(Boolean).map(i=>({...i,uid:rid()}));
    return{reply:f.length?L3(lang,{en:`AI is busy, so I used the basic parser: ${f.length} dish(es) added. Please check the table.`,az:`AI məşğuldur, sadə analizatorla ${f.length} yemək əlavə etdim. Cədvəli yoxlayın.`,ru:`AI занят, использовала простой разбор: добавлено блюд — ${f.length}. Проверьте таблицу.`})
      :L3(lang,{en:'AI is busy right now. Try again, or add rows to the table by hand.',az:'AI hazırda məşğuldur. Yenidən yoxlayın və ya cədvələ əl ilə sətir əlavə edin.',ru:'AI сейчас занят. Повторите или добавьте строки в таблицу вручную.'}),
      name:null,tagline:null,items:[...items,...f],aiFailed:true};
  }
}
