export const CLASSES = ['Aqua','Capture','FriX','Global Active','Global eXtreme','Musikal&Reise','Musikk&Reise','Reise&Bistand','Sport&Outdoor','Stipendiatene','Ansatt'];
export function score(value, correct, min, max) {
 const divisor = Math.abs(correct) || max-min;
 return Math.round(Math.max(0,100*(1-Math.abs(value-correct)/divisor))*100)/100;
}
export function phase(state, now=Date.now()) {
 return state.phase==='countdown' && now>=state.deadline ? 'locked' : state.phase;
}
export function format(value, unit) {
 if(value===null || value===undefined) return '—';
 if(unit==='tid') return `${Math.floor(value/60)}:${String(Math.round(value%60)).padStart(2,'0')}`;
 return new Intl.NumberFormat('nb-NO',{maximumFractionDigits:2}).format(value);
}
export function rankings(game, players, answers) {
 const complete=game.questions.map((q,i)=>({...q,i})).filter(q=>q.revealed);
 const answerIndex=new Map(answers.map(a=>[`${a.playerId}:${a.questionId}`,a.points??0]));
 const people=players.map(p=>{
  const eligible=complete.filter(q=>q.i>=p.eligibleFrom && q.author!==p.className);
  const total=eligible.reduce((sum,q)=>sum+(answerIndex.get(`${p.id}:${q.id}`)??0),0);
  return {id:p.id,name:p.name,className:p.className,points:eligible.length?total/eligible.length:0,count:eligible.length};
 }).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'nb'));
 const classes=game.classes.map(name=>{
  const members=people.filter(p=>p.className===name);
  return {name,points:members.length?members.reduce((s,p)=>s+p.points,0)/members.length:0,count:members.length};
 }).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name,'nb'));
 return {people,classes};
}
