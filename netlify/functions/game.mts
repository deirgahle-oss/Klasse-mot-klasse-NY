import { getUser, verifyRequestOrigin } from '@netlify/identity';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import { database } from '../../db/index.js';
import { games, players, answers } from '../../db/schema.js';
import { score, phase, rankings, CLASSES } from '../../lib/rules.mjs';
function fail(message:string,status=400):never { throw Object.assign(new Error(message),{status}); }
function hash(s:string) {return createHash('sha256').update(s).digest('hex');}
function clean(s:any,max=120) {return typeof s==='string'?s.trim().slice(0,max):'';}
function initial(music='') {return {phase:'waiting',index:-1,deadline:null,registrationOpen:true,music,version:0};}
function question(b:any,id= randomUUID()) {
 const q={id,text:clean(b.text,2000),author:clean(b.author),min:Number(b.min),max:Number(b.max),step:Number(b.step),unit:clean(b.unit),customUnit:clean(b.customUnit,30),correct:b.correct===''||b.correct==null?null:Number(b.correct),image:clean(b.image,300),revealed:false};
 if(!q.text||![q.min,q.max,q.step].every(Number.isFinite)||q.max<=q.min||q.step<=0||q.step>q.max-q.min) fail('Sjekk oppgavetekst, minimum, maksimum og steg.');
 if(!['tid','cm','meter','liter','antall','egendefinert'].includes(q.unit)) fail('Velg en gyldig enhet.');
 if(q.unit==='tid'&&![q.min,q.max,q.step].every(Number.isInteger)) fail('Tid og steg oppgis i hele sekunder.');
 if(q.unit==='egendefinert'&&!q.customUnit) fail('Skriv inn enhet.');
 if(q.correct!==null&&(!Number.isFinite(q.correct)||q.correct<q.min||q.correct>q.max)) fail('Fasit må være innenfor intervallet.');
 if(q.image&&!/^\/api\/media\/[a-f0-9-]+\.(jpg|png|webp)$/.test(q.image)) fail('Ugyldig bilde.');
 return q;
}
export default async (req:Request) => {
 try {
  if(req.method!=='POST') return new Response('Method not allowed',{status:405});
  verifyRequestOrigin(req);
  const b=await req.json(); const op=b.op; const db=database();
  const user=await getUser();
  const organizer=!!user&&(!!user.invitedAt||user.roles?.includes('admin'));
  const requireOrganizer=()=>{if(!organizer) fail('Logg inn med en invitert arrangørkonto.',401);};
  const reply=(data:any)=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
  if(op==='me') return reply({user:organizer?{email:user!.email}:null,classes:CLASSES});
  if(op==='list') {requireOrganizer();const list=await db.select({id:games.id,title:games.title,classes:games.classes,createdAt:games.createdAt}).from(games).where(eq(games.owner,user!.id));return reply({games:list});}
  if(op==='create'||op==='import') {
   requireOrganizer(); let title=clean(b.title)||'Klasse mot klasse', classes=Array.isArray(b.classes)?[...new Set<string>(b.classes.map(c=>clean(c,60)).filter(Boolean))]:[], questions:any[]=[];
   if(op==='import') {const [source]=await db.select().from(games).where(eq(games.share,clean(b.share,100)));if(!source) fail('Delingslenken finnes ikke.',404);title=source.title;classes=source.classes;questions=source.questions.map(q=>({...q,id:randomUUID(),revealed:false}));}
   if(!classes.length||classes.length>40) fail('Velg minst én klasse (maks 40).');
   const id=randomUUID();await db.insert(games).values({id,owner:user!.id,title,classes,questions,state:initial(),share:randomBytes(24).toString('hex')});return reply({id});
  }
  if(typeof b.id!=='string') fail('Mangler konkurranse.');
  // Lock one competition row for every mutation. Reads use a consistent snapshot.
  const result=await db.transaction(async tx=>{
   const mutation=op!=='state';
   const rows=mutation?await tx.select().from(games).where(eq(games.id,b.id)).for(op==='answer'?'share':'update'):await tx.select().from(games).where(eq(games.id,b.id));
   const g=rows[0]; if(!g) fail('Konkurransen finnes ikke.',404);
   const [{now}]=await tx.select({now:sql<string>`clock_timestamp()`});const nowMs=new Date(now).getTime();
   const s={...g.state,phase:phase(g.state,nowMs)};g.state=s;
   const owner=organizer&&g.owner===user!.id;
   const adminOp=!['state','join','answer'].includes(op);
   if(adminOp&&!owner) fail('Du har ikke tilgang til denne konkurransen.',403);
   let allPlayers=await tx.select().from(players).where(op==='answer'?and(eq(players.gameId,g.id),eq(players.id,String(b.playerId||''))):eq(players.gameId,g.id));
   let p=allPlayers.find(p=>p.id===b.playerId&&p.secretHash===hash(String(b.secret||'')));
   if(op==='join') {
    if(!s.registrationOpen||s.phase==='finished') fail('Påloggingen er stengt.');
    if(allPlayers.length>=200) fail('Konkurransen har nådd 200 deltakere.');
    const name=clean(b.name,80), className=clean(b.className,60);if(!name||!g.classes.includes(className)) fail('Skriv navn og velg klasse.');
    const secret=randomBytes(32).toString('hex'),id=randomUUID();
    await tx.insert(players).values({id,gameId:g.id,secretHash:hash(secret),name,className,eligibleFrom:Math.max(0,s.index+(['active','countdown'].includes(s.phase)?0:1))});
    if(s.rankings){const roster=await tx.select().from(players).where(eq(players.gameId,g.id));const all=await tx.select().from(answers).where(eq(answers.gameId,g.id));s.rankings=rankings(g,roster,all);await tx.update(games).set({state:s}).where(eq(games.id,g.id));}
    return {playerId:id,secret};
   }
   if(op==='state') {
    if(b.screen&&!owner) fail('Storskjermen krever arrangørinnlogging.',401);
    if(b.playerId&&!p&&!owner) fail('Deltakeren finnes ikke lenger. Registrer deg på nytt.',401);
    const authorized=owner||!!p;
    if(!authorized) return {serverNow:nowMs,game:{id:g.id,title:g.title,classes:g.classes,registrationOpen:s.registrationOpen,count:allPlayers.length}};
    const current=g.questions[s.index];
    const allAnswers=p&&current?await tx.select().from(answers).where(and(eq(answers.playerId,p.id),eq(answers.questionId,current.id))):[];
    const ranks=s.rankings||rankings(g,allPlayers,[]);
    const topQuestion=current?.revealed?s.topQuestion||[]:[];
    return {serverNow:nowMs,game:{id:g.id,title:g.title,classes:g.classes,state:owner?s:{phase:s.phase,index:s.index,deadline:s.deadline,registrationOpen:s.registrationOpen,music:s.music,version:s.version},questions:g.questions.map((q,i)=>owner? q: i===s.index?{...q,correct:q.revealed?q.correct:null}:{id:q.id}),...(owner?{share:g.share}:{}),count:allPlayers.length},player:p?{id:p.id,name:p.name,className:p.className}:null,answer:p?allAnswers.find(a=>a.playerId===p.id&&a.questionId===current?.id):null,players:owner?allPlayers.map(({secretHash,...p})=>p):undefined,rankings:['results','finished','revealed'].includes(s.phase)||owner?ranks:undefined,topQuestion};
   }
   const q=g.questions[s.index];
   if(op==='answer') {
    if(!p) fail('Registrer deg på nytt.',401);
    if(!['active','countdown'].includes(s.phase)||!q||q.id!==b.questionId) fail('Tiden er ute! Svaret er låst.',409);
    if(q.author===p.className) fail('Din klasse har laget denne oppgaven.',403);
    const value=Number(b.value),sequence=Number(b.sequence);
    if(!Number.isFinite(value)||value<q.min||value>q.max||!Number.isSafeInteger(sequence)||sequence<0) fail('Ugyldig svar.');
    if(Math.abs((value-q.min)/q.step-Math.round((value-q.min)/q.step))>0.00001) fail('Svaret følger ikke oppgavens steg.');
    const [prev]=await tx.select().from(answers).where(and(eq(answers.playerId,p.id),eq(answers.questionId,q.id)));
    if(prev?.locked) return {saved:true,locked:true};
    if(!prev||sequence>prev.sequence) await tx.insert(answers).values({gameId:g.id,playerId:p.id,questionId:q.id,value,locked:!!b.locked,sequence}).onConflictDoUpdate({target:[answers.playerId,answers.questionId],set:{value,locked:!!b.locked,sequence,updatedAt:new Date(nowMs)},setWhere:sql`${answers.sequence} < ${sequence} and not ${answers.locked}`});
    return {saved:true,locked:!!b.locked};
   }
   if(op==='delete') {await tx.delete(games).where(eq(games.id,g.id));return {ok:true};}
   if(op==='reuse'||op==='restart') {
    await tx.delete(answers).where(eq(answers.gameId,g.id));
    if(op==='reuse') await tx.delete(players).where(eq(players.gameId,g.id));
    else await tx.update(players).set({eligibleFrom:0}).where(eq(players.gameId,g.id));
    g.state={...initial(s.music),version:s.version+1};g.questions=g.questions.map(q=>({...q,revealed:false}));
   } else if(op==='draft') {
    if(s.index>=0) fail('Konkurransen er startet.');
    if(b.draft!==null && (typeof b.draft!=='object'||JSON.stringify(b.draft).length>10000)) fail('Ugyldig utkast.');
    s.draft=b.draft;
   } else if(op==='settings') {
    const title=clean(b.title);if(!title) fail('Konkurransen må ha et navn.');g.title=title;
    if(b.music!==undefined) {if(b.music&&!/^\/api\/media\/[a-f0-9-]+\.mp3$/.test(b.music)) fail('Ugyldig lydfil.');s.music=b.music;}
   } else if(op==='question'||op==='removeQuestion'||op==='move') {
    if(s.index>=0) fail('Restart konkurransen før du endrer oppgavene.');
    if(op==='question') {const updated=question(b.question,b.question.id||randomUUID());if(updated.author!=='arrangør'&&!g.classes.includes(updated.author)) fail('Velg oppgaveklasse.');const i=g.questions.findIndex(q=>q.id===updated.id);if(i<0) g.questions.push(updated);else g.questions[i]=updated;}
    else {const i=g.questions.findIndex(q=>q.id===b.questionId);if(i<0) fail('Fant ikke oppgaven.');if(op==='removeQuestion')g.questions.splice(i,1);else {const j=i+(b.direction===-1?-1:1);if(j>=0&&j<g.questions.length)[g.questions[i],g.questions[j]]=[g.questions[j],g.questions[i]];}}
   } else if(op==='editPlayer'||op==='deletePlayer') {
    const target=allPlayers.find(p=>p.id===b.targetId);if(!target)fail('Fant ikke deltakeren.');
    if(op==='deletePlayer')await tx.delete(players).where(eq(players.id,target.id));
    else {const name=clean(b.name,80),className=clean(b.className,60);if(!name||!g.classes.includes(className))fail('Skriv navn og velg klasse.');await tx.update(players).set({name,className}).where(eq(players.id,target.id));}
   } else if(op==='registration') s.registrationOpen=!s.registrationOpen;
   else if(op==='ready') {if(s.index>=0)fail('Konkurransen er allerede startet.');s.phase='ready';}
   else if(op==='start'||op==='next') {
    if(op==='start'&&s.index!==-1) fail('Konkurransen er allerede startet.');
    if(op==='next'&&(!['revealed','results'].includes(s.phase)||!q?.revealed))fail('Registrer fasit før neste oppgave.');
    if(s.index+1>=g.questions.length)fail('Ingen flere oppgaver. Fullfør konkurransen.');
    s.index++;s.phase='active';s.deadline=null;
   } else if(op==='countdown') {
    if(s.phase==='countdown') return {ok:true};
    if(s.phase!=='active')fail('Åpne en oppgave først.');s.phase='countdown';s.deadline=nowMs+5000;
   } else if(op==='reopen') {
    if(!['countdown','locked'].includes(s.phase)) fail('Svar kan bare gjenåpnes før fasit vises.');s.phase='active';s.deadline=null;
   } else if(op==='reveal') {
    if(s.phase!=='locked'&&!(s.phase==='results'&&q&&!q.revealed&&s.deadline&&nowMs>=s.deadline))fail('Vent til nedtellingen er ferdig.');
    const correct=b.correct===''||b.correct==null?q.correct:Number(b.correct);
    if(correct===null||!Number.isFinite(correct)||correct<q.min||correct>q.max)fail('Legg inn en fasit innenfor intervallet.');
    q.correct=correct;q.revealed=true;s.phase='revealed';
    const currentAnswers=await tx.select().from(answers).where(and(eq(answers.gameId,g.id),eq(answers.questionId,q.id)));
    if(currentAnswers.length) await tx.update(answers).set({points:sql`case ${sql.join(currentAnswers.map(a=>sql`when ${answers.playerId} = ${a.playerId} then ${score(a.value,correct,q.min,q.max)}::double precision`),sql` `)} else 0 end`}).where(and(eq(answers.gameId,g.id),eq(answers.questionId,q.id)));
   } else if(op==='results') {if(!['revealed','locked','results'].includes(s.phase))fail('Lås svarene før resultatvisning.');s.phase='results';}
   else if(op==='finish') {if(['active','countdown'].includes(s.phase)||g.questions.some((q,i)=>i<=s.index&&!q.revealed))fail('Lås svar og registrer fasit før du fullfører.');s.phase='finished';s.registrationOpen=false;}
   else fail('Ukjent handling.');
   if(['reveal','editPlayer','deletePlayer'].includes(op)) {
    const roster=await tx.select().from(players).where(eq(players.gameId,g.id));
    const all=await tx.select().from(answers).where(eq(answers.gameId,g.id));
    s.rankings=rankings(g,roster,all);
    s.topQuestion=q?.revealed?all.filter(a=>a.questionId===q.id&&a.points!==null&&roster.some(p=>p.id===a.playerId&&p.className!==q.author)).map(a=>({name:roster.find(p=>p.id===a.playerId)?.name||'',points:a.points})).sort((a,b)=>b.points-a.points).slice(0,3):[];
   }
   g.state.version++;await tx.update(games).set({title:g.title,questions:g.questions,state:g.state}).where(eq(games.id,g.id));return {ok:true};
  },{isolationLevel:op==='state'?'repeatable read':'read committed'});
  return reply(result);
 } catch(e:any) {return Response.json({error:e.status?e.message:'Kunne ikke kontakte serveren. Prøv igjen.'},{status:e.status||500,headers:{'Cache-Control':'no-store'}});}
};
export const config={path:'/api/game'};
