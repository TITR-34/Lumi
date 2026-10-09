// Deterministic business logic. The AI never computes prices, totals or availability.
export const money=n=>Math.round(n*100)/100;
const has=(i,x)=>[i.name,...(i.ingredients||[])].some(s=>String(s).toLowerCase().includes(String(x).toLowerCase()));
export function filterItems(menu,c={}){
  const al=c.allergies||[],ex=c.exclude||[];
  // Conservative allergy rule: unknown allergen data (null) is treated as NOT safe.
  return menu.filter(i=>i.available!==false&&(c.maxSpice==null||i.spice<=c.maxSpice)&&!ex.some(x=>has(i,x))&&(!al.length||(Array.isArray(i.allergens)&&!i.allergens.some(a=>al.includes(a)))));
}
export function solve(menu,c={},opt={}){
  const n=Math.min(Math.max(+c.people||1,1),4),vegN=Math.min(+c.vegetarians||0,n);
  const B=c.budget>0?+c.budget:Infinity,T=c.maxMinutes>0?+c.maxMinutes:Infinity;
  const prefer=(c.prefer||[]).map(x=>String(x).toLowerCase()).filter(Boolean);
  const liked=i=>prefer.some(p=>i.cat===p||has(i,p)||(Array.isArray(i.allergens)&&i.allergens.includes(p)));
  const ok=filterItems(menu,c),mains=ok.filter(i=>i.cat==='main');
  const grp=['starter','drink','dessert'].map(k=>[null,...ok.filter(i=>i.cat===k)]);
  const addons=[];for(const a of grp[0])for(const b of grp[1])for(const d of grp[2])addons.push([a,b,d].filter(Boolean));
  const keyOf=items=>items.map(i=>i.id).sort().join();
  // best add-on set (starter / drink / dessert) for every combination of mains, skipping options already shown
  const run=(budget,maxT,vegRule,skip)=>{
    const out=[];
    const rec=(s,pick)=>{
      if(pick.length===n){
        if(vegRule&&pick.filter(i=>i.veg).length<vegN)return;
        let best=null;
        for(const ex of addons){
          const items=[...pick,...ex],total=money(items.reduce((a,i)=>a+i.price,0)),minutes=Math.max(...items.map(i=>i.prep));
          if(total>budget||minutes>maxT)continue;const key=keyOf(items);if(skip.has(key))continue;
          const score=Math.min(ex.length,isFinite(budget)?3:2)*2+items.filter(liked).length*5-(isFinite(budget)?(budget-total)/budget*3:total/100)-minutes/60;
          if(!best||score>best.score)best={items,total,minutes,key,score};
        }
        if(best)out.push(best);return}
      for(let k=s;k<mains.length;k++)rec(k,[...pick,mains[k]]);
    };rec(0,[]);return out;
  };
  const skip=new Set(opt.skip||[]);
  let pool=run(B,T,true,skip);
  if(pool.length){ // greedy top-3 with diversity: penalise dishes that are already in a chosen option
    const chosen=[];
    while(chosen.length<3&&pool.length){
      const used=new Set(chosen.flatMap(o=>o.items.map(i=>i.id)));let bi=0,bs=-Infinity;
      pool.forEach((p,i)=>{const s=p.score-p.items.filter(x=>used.has(x.id)).length*1.6;if(s>bs){bs=s;bi=i}});
      chosen.push(pool.splice(bi,1)[0]);
    }
    return{options:chosen.map(({score,...x})=>x)};
  }
  if(skip.size&&run(B,T,true,new Set()).length)return{options:[],reason:'exhausted'};
  const rb=run(Infinity,T,true,new Set());
  if(rb.length)return{options:[],reason:'budget',min:Math.min(...rb.map(o=>o.total))};
  return{options:[],reason:run(B,Infinity,true,new Set()).length?'time':run(B,T,false,new Set()).length?'vegetarian':'filters'};
}
export function validateOrder(menu,o={}){
  const errors=[],lines=[],by=Object.fromEntries(menu.map(i=>[i.id,i]));
  if(!String(o.table||'').trim())errors.push('Table is required');
  if(!Array.isArray(o.items)||!o.items.length)errors.push('Order is empty');
  for(const it of Array.isArray(o.items)?o.items:[]){
    const m=by[it?.id];
    if(!m){errors.push(`Unknown item: ${it?.id}`);continue}
    if(m.available===false){errors.push(`${m.name} is unavailable`);continue}
    if(!Number.isInteger(it.qty)||it.qty<1||it.qty>20){errors.push(`Invalid quantity for ${m.name}`);continue}
    lines.push({id:m.id,name:m.name,qty:it.qty,price:m.price,prep:m.prep}); // price always from menu, never from client
  }
  return{ok:!errors.length,errors,lines,total:money(lines.reduce((a,l)=>a+l.price*l.qty,0))};
}
// ETA = slowest dish + kitchen load (2 min per active order, capped at 30)
export const eta=(lines,active)=>Math.max(...lines.map(l=>l.prep),0)+Math.min(active*2,30);
// Apply add/remove operations to an order ({itemId: qty}) using only valid, available menu items.
export function applyOps(menu,order,ops){
  const o={...order},by=Object.fromEntries(menu.map(i=>[i.id,i])),notes=[];
  for(const op of Array.isArray(ops)?ops:[]){
    const m=by[op?.item_id];if(!m){continue}
    const q=Math.min(20,Math.max(1,parseInt(op.qty)||1));
    if(op.op==='add'){if(m.available===false){notes.push(`${m.name} is unavailable`);continue}o[m.id]=Math.min(20,(o[m.id]||0)+q);notes.push(`Added ${m.name}`)}
    if(op.op==='remove'&&o[m.id]){o[m.id]-=q;if(o[m.id]<=0)delete o[m.id];notes.push(`Removed ${m.name}`)}
  }
  return{order:o,notes};
}
export function factsText(menu,refs,cur='₼'){
  return(refs||[]).map(id=>menu.find(i=>i.id===id)).filter(Boolean).slice(0,3).map(i=>`• ${i.name} — ${cur}${i.price.toFixed(2)} · ${i.veg?'vegetarian':'contains meat/fish'} · spice ${i.spice}/3 · ~${i.prep} min · ingredients: ${(i.ingredients||[]).join(', ')||'n/a'} · allergens: ${i.allergens==null?'unknown, ask staff':i.allergens.join(', ')||'none listed'}`).join('\n');
}
