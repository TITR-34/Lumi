// Supabase Storage (REST, no SDK). Used only for dish photos. Key stays on the server.
import crypto from 'node:crypto';
const cfg=()=>({url:(process.env.SUPABASE_URL||'').trim().replace(/\/+$/,''),key:(process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_KEY||'').trim(),bucket:(process.env.SUPABASE_BUCKET||'dish-images').trim()});
export const supaEnabled=()=>{const c=cfg();return !!(c.url&&c.key)};
const EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
export async function supaUpload(buf,mime){
  const c=cfg();if(!c.url||!c.key)throw new Error('Supabase not configured');
  const name=`${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}.${EXT[mime]||'jpg'}`;
  const headers={apikey:c.key,'content-type':mime,'cache-control':'31536000'};
  if(c.key.startsWith('eyJ'))headers.authorization='Bearer '+c.key; // legacy JWT service_role key; new sb_secret_ keys use apikey only
  const r=await fetch(`${c.url}/storage/v1/object/${c.bucket}/${name}`,{method:'POST',headers,body:buf,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error(`supabase ${r.status}: ${(await r.text()).slice(0,160)}`);
  return `${c.url}/storage/v1/object/public/${c.bucket}/${name}`;
}
// image field accepted in a menu item: https URL or a small inline data URL (fallback when Supabase is not configured)
export const okImg=s=>typeof s==='string'&&s.length<300000&&(/^https:\/\/[^\s"'<>]+$/.test(s)||/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s));
