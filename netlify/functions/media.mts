import { getStore } from '@netlify/blobs';
import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { randomUUID } from 'node:crypto';
export default async (req:Request) => {
 try {
 const store=getStore({name:'competition-media',consistency:'strong'});
 if(req.method==='POST') {
  verifyRequestOrigin(req);const u=await getUser();if(!u||(!u.invitedAt&&!u.roles?.includes('admin')))return new Response('Logg inn som arrangør.',{status:401});
  const type=req.headers.get('content-type')?.split(';')[0];const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','audio/mpeg':'mp3'})[type||''];
  if(!ext)return new Response('Velg JPG, PNG, WebP eller MP3.',{status:400});
  const data=await req.arrayBuffer();if(data.byteLength>4*1024*1024)return new Response('Filen må være mindre enn 4 MB.',{status:400});
  const key=`${randomUUID()}.${ext}`;await store.set(key,data);return Response.json({url:`/api/media/${key}`});
 }
 if(req.method==='GET') {
  const key=new URL(req.url).pathname.split('/').pop()!;if(!/^[a-f0-9-]+\.(jpg|png|webp|mp3)$/.test(key))return new Response('Not found',{status:404});
  const data=await store.get(key,{type:'arrayBuffer'});if(!data)return new Response('Not found',{status:404});
  const ext=key.split('.').pop()!;return new Response(data,{headers:{'Content-Type':({jpg:'image/jpeg',png:'image/png',webp:'image/webp',mp3:'audio/mpeg'})[ext],'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
 }
 return new Response(null,{status:405});
 }catch{return new Response('Kunne ikke laste filen.',{status:500});}
};
export const config={path:['/api/media','/api/media/:key']};
