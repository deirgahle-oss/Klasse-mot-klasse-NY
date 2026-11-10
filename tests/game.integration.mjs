// Run explicitly against a configured preview/test database. This exercises the
// actual function and database. --write also creates and removes a test competition.
import assert from 'node:assert/strict';
import {createServer} from 'vite';

if(!process.env.NETLIFY_DB_URL)throw Error('Integrasjonstesten krever en konfigurert testdatabase.');
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
let gameId;
let failed=false;
try {
 const {default:handler}=await server.ssrLoadModule('/netlify/functions/game.mts');
 const call=async(op,extra={})=>{
  const response=await handler(new Request('https://internal-preview.test/api/game',{
   method:'POST',headers:{'Content-Type':'application/json',Origin:'https://public-preview.test'},
   body:JSON.stringify({op,id:gameId,view:'admin',...extra}),
  }));
  assert.equal(response.status,200,`API operation ${op} should succeed`);
  return response.json();
 };
 const list=await call('list');
 for(const game of list.games){
  const state=await call('state',{id:game.id});
  assert.equal(state.game.id,game.id);
  assert.ok(Number.isFinite(state.serverNow));
 }
 console.log(`Database integration passed: list and transactional state loading (${list.games.length} competitions).`);
 if(process.argv.includes('--write'))try {
  const created=await call('create',{title:'Automatisk integrasjonstest',classes:['Testklasse']});
  gameId=created.id;
  assert.ok(gameId);
  const state=await call('state');
  assert.equal(state.game.id,gameId);
  assert.equal(state.game.state.phase,'waiting');
  assert.ok(Number.isFinite(state.serverNow));
  await call('question',{question:{text:'Testoppgave',author:'arrangør',min:0,max:100,step:1,unit:'antall',correct:50}});
  const loaded=await call('state');
  assert.equal(loaded.game.questions.length,1);
  const questionId=loaded.game.questions[0].id;
  const player=await call('join',{name:'Testdeltaker',className:'Testklasse',view:'student'});
  await call('start');
  await call('answer',{...player,view:'student',questionId,value:50,sequence:1,locked:true});
  const student=await call('state',{...player,view:'student'});
  assert.equal(student.answer.value,50);
  assert.equal(student.answer.locked,true);
  assert.equal(student.game.questions[0].correct,null);
  assert.equal((await call('state')).game.questions[0].correct,50);
  console.log('Database integration passed: create, load, question, join, start, answer and student redaction.');
 }finally {
  if(gameId){await call('delete');console.log('Integration fixture removed.');}
 }
}catch {
 failed=true;
 // Avoid logging database errors, query parameters or participant credentials.
 console.error('Database integration failed. No database credentials or query parameters were logged.');
}finally {
 await server.close();
}
process.exit(failed?1:0);
