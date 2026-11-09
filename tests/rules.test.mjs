import test from 'node:test';
import assert from 'node:assert/strict';
import {score,phase,rankings,format} from '../lib/rules.mjs';
test('prosentavvik gir 100 ved fasit og symmetriske poeng',()=>{
 assert.equal(score(80,80,0,200),100);assert.equal(score(60,80,0,200),75);assert.equal(score(100,80,0,200),75);assert.equal(score(200,80,0,200),0);
});
test('nullfasit bruker oppgavens spenn og negative fasiter virker',()=>{
 assert.equal(score(25,0,0,100),75);assert.equal(score(-75,-100,-200,0),75);assert.equal(score(0,0,-50,50),100);
});
test('poeng avrundes til to desimaler',()=>assert.equal(score(2,3,0,10),66.67));
test('deadline gjelder på grensen og etter refresh uten ny femsekundersperiode',()=>{
 const saved=JSON.stringify({phase:'countdown',deadline:105000,index:2});
 assert.equal(phase(JSON.parse(saved),102000),'countdown');
 assert.equal(phase(JSON.parse(saved),105000),'locked');assert.equal(phase(JSON.parse(saved),120000),'locked');
 assert.equal(JSON.parse(saved).deadline,105000);
});
test('egne klasseoppgaver er nøytrale, ubesvart etter registrering gir null',()=>{
 const g={classes:['A','B'],questions:[{id:'q1',author:'A',revealed:true},{id:'q2',author:'arrangør',revealed:true}]};
 const p=[{id:'a',name:'Alva',className:'A',eligibleFrom:0},{id:'b',name:'Bjørn',className:'B',eligibleFrom:0}];
 const a=[{playerId:'a',questionId:'q2',points:80},{playerId:'b',questionId:'q1',points:100}];
 const r=rankings(g,p,a);assert.equal(r.people.find(p=>p.id==='a').points,80);assert.equal(r.people.find(p=>p.id==='b').points,50);assert.equal(r.people.find(p=>p.id==='a').count,1);
});
test('oppgaver før sen registrering teller ikke og klassesnitt vekter alle elever likt',()=>{
 const g={classes:['A','Tom klasse'],questions:[{id:'1',author:'arrangør',revealed:true},{id:'2',author:'arrangør',revealed:true}]};
 const p=[{id:'a',name:'Alva',className:'A',eligibleFrom:0},{id:'b',name:'Bjørn',className:'A',eligibleFrom:1}];
 const a=[{playerId:'a',questionId:'1',points:80},{playerId:'a',questionId:'2',points:40},{playerId:'b',questionId:'2',points:100}];
 const r=rankings(g,p,a);assert.equal(r.people.find(p=>p.id==='b').points,100);assert.equal(r.classes[0].points,80);assert.equal(r.classes[1].points,0);
});
test('ikke viste fasiter bidrar ikke til rangering',()=>{
 assert.equal(rankings({classes:['A'],questions:[{id:'q',revealed:false,author:'arrangør'}]},[{id:'p',className:'A',name:'Alva',eligibleFrom:0}],[{playerId:'p',questionId:'q',points:100}]).people[0].count,0);
});
test('tid vises som minutter og sekunder',()=>{assert.equal(format(312,'tid'),'5:12');assert.equal(format(5,'tid'),'0:05');assert.equal(format(3600,'tid'),'60:00');});
