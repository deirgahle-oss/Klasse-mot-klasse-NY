import {test,expect,chromium} from '@playwright/test';
import {readGameRequest} from '../lib/game-request.mjs';
const gameId='12345678-1234-1234-1234-123456789abc';
function fixture(){return {serverNow:Date.now(),game:{id:gameId,title:'Klasse mot klasse',classes:['Aqua','Capture'],state:{phase:'waiting',index:-1,deadline:null,registrationOpen:true,music:'',version:0},questions:[{id:'question-1',text:'Hvor lang tid tar utfordringen?',author:'arrangør',min:0,max:600,step:1,unit:'tid',customUnit:'',correct:null,image:'',revealed:false}],count:1,share:'fixture-share'},player:{id:'fixture-player',name:'Sigrid',className:'Aqua'},answer:null,players:[],rankings:{people:[],classes:[]},topQuestion:[]};}
async function prepare(page,d,{admin=false,registered=true}={}){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(registered)await page.addInitScript(({gameId})=>localStorage.setItem('kmk:'+gameId,JSON.stringify({playerId:'fixture-player',secret:'fixture-only'})),{gameId});
 const writes=[];
 await page.route('**/api/game',async route=>{const b=route.request().postDataJSON();writes.push(b);let result={ok:true};if(b.op==='state'){d.serverNow=Date.now();result=structuredClone(d);if(!admin&&!b.playerId){result={serverNow:Date.now(),game:{id:gameId,title:d.game.title,classes:d.game.classes,registrationOpen:true,count:1}};}}else if(b.op==='list')result={games:[]};else if(b.op==='create')result={id:gameId};else if(b.op==='join')result={playerId:'fixture-player',secret:'fixture-only'};else if(b.op==='answer'){d.answer={...b,points:null};result={saved:true,locked:b.locked};}else if(b.op==='question'){d.game.questions.push({...b.question,id:'new-question'});}else if(b.op==='draft')d.game.state.draft=b.draft;await route.fulfill({json:result});});
 return {writes,errors};
}
test('elev registrerer seg og beholder identitet ved oppdatering',async({page})=>{const d=fixture();const {errors}=await prepare(page,d,{registered:false});await page.goto('/?game='+gameId);await page.getByLabel('Navnet ditt').fill('Sigrid');await page.getByLabel('Klassen din').selectOption('Aqua');await page.getByRole('button',{name:'Bli med'}).click();await expect(page.getByRole('heading',{name:/Velkommen til/})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:/Velkommen til/})).toBeVisible();expect(errors).toEqual([]);});
test('slider lagres fortløpende, låsing bekreftes og overlever refresh',async({page})=>{const d=fixture();d.game.state.phase='active';d.game.state.index=0;const {writes,errors}=await prepare(page,d);await page.setViewportSize({width:390,height:844});await page.goto('/?game='+gameId);const slider=page.getByRole('slider');await expect(slider).toBeVisible();await slider.fill('312');await expect(page.locator('#answerValue')).toHaveText('5:12');await expect.poll(()=>writes.filter(w=>w.op==='answer').at(-1)?.value).toBe(312);await page.getByRole('button',{name:'Lås svar'}).click();await expect(page.getByText('Takk for ditt svar!')).toBeVisible();await page.reload();await expect(page.getByText('Takk for ditt svar!')).toBeVisible();expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});
test('nedtelling ved oppdatering bruker gjenværende tid og låser skjermen',async({page})=>{const d=fixture();d.game.state={...d.game.state,phase:'countdown',index:0,deadline:Date.now()+3600};await prepare(page,d);await page.goto('/?game='+gameId);await expect(page.locator('#countdown')).toBeVisible();await page.waitForTimeout(1300);await page.reload();await expect.poll(async()=>Number(await page.locator('#countdown').textContent())).toBeLessThanOrEqual(3);await expect(page.getByRole('heading',{name:'Tiden er ute!'})).toBeVisible({timeout:5000});await expect(page.getByRole('slider')).toHaveCount(0);});
test('egen klasseoppgave utelukker svar',async({page})=>{const d=fixture();d.game.state={...d.game.state,phase:'active',index:0};d.game.questions[0].author='Aqua';const {writes}=await prepare(page,d);await page.goto('/?game='+gameId);await expect(page.getByText(/Denne oppgaven er laget av din klasse/)).toBeVisible();await expect(page.getByRole('slider')).toHaveCount(0);expect(writes.some(w=>w.op==='answer')).toBe(false);});
test('storskjerm viser QR-kode og store oppgaver',async({page})=>{const d=fixture();const {errors}=await prepare(page,d,{admin:true});await page.goto('/storskjerm.html?game='+gameId);await expect(page.locator('#screenQR')).toBeVisible();d.game.state={...d.game.state,phase:'active',index:0};await expect(page.getByRole('heading',{name:'Hvor lang tid tar utfordringen?'})).toBeVisible({timeout:5000});await expect(page.getByText(/10:00/)).toBeVisible();expect(errors).toEqual([]);});
test('arrangør redigerer tid som min:sek og sender sekunder til serveren',async({page})=>{const d=fixture();const {writes,errors}=await prepare(page,d,{admin:true});await page.goto('/admin.html?game='+gameId);await page.locator('#editor summary').click();await page.getByLabel('Oppgavetekst',{exact:true}).fill('Hvor lenge varer sangen?');await page.locator('select[name=unit]').selectOption('tid');await page.getByLabel('Maksimum',{exact:true}).fill('5:12');await page.getByLabel('Fasit (valgfritt)').fill('3:10');await page.screenshot({path:'/tmp/kmk-admin.png',fullPage:true});await page.locator('#saveQuestion').click();await expect.poll(()=>writes.find(w=>w.op==='question')?.question.max).toBe(312);expect(writes.find(w=>w.op==='question').question.correct).toBe(190);expect(errors).toEqual([]);});
test('offentlig forside laster uten innlogging',async({page})=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await expect(page.getByRole('heading',{name:'Hvor godt treffer du?'})).toBeVisible();expect(errors).toEqual([]);});
test('tidsutkast beholdes som min:sek etter oppdatering',async({page})=>{const d=fixture();const {writes}=await prepare(page,d,{admin:true});await page.goto('/admin.html?game='+gameId);await page.locator('#editor summary').click();await page.locator('select[name=unit]').selectOption('tid');await page.getByLabel('Maksimum',{exact:true}).fill('5:12');await expect.poll(()=>writes.filter(w=>w.op==='draft').at(-1)?.draft.max).toBe('5:12');await page.reload();await page.locator('#editor summary').click();await expect(page.getByLabel('Maksimum',{exact:true})).toHaveValue('5:12');});

test('arrangør åpner oversikten og tidligere konkurranser uten konto',async({page})=>{
 const requests=[];
 page.on('request',r=>requests.push(r.url()));
 await page.route('**/api/game',route=>route.fulfill({json:{games:[{id:gameId,title:'Tidligere konkurranse',classes:['Aqua'],createdAt:'2026-11-09'}]}}));
 await page.goto('/admin.html');
 await expect(page.getByRole('heading',{name:'Mine konkurranser'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Tidligere konkurranse',exact:true})).toBeVisible();
 await expect(page.getByLabel('Passord',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Logg ut'})).toHaveCount(0);
 expect(requests.some(url=>/identity/.test(url))).toBe(false);
});
test('arrangør kan prøve igjen etter feil i oversikten',async({page})=>{
 let failed=true;
 await page.route('**/api/game',route=>route.fulfill({status:failed?500:200,json:failed?{error:'Prøv igjen senere.'}:{games:[]}}));
 await page.goto('/admin.html');
 await expect(page.getByRole('heading',{name:'Kunne ikke åpne siden'})).toBeVisible();
 await expect(page.locator('.connection')).toHaveClass(/offline/);
 await expect(page.locator('#connection')).not.toHaveText('Tilkoblet');
 failed=false;
 await page.getByRole('button',{name:'Prøv igjen'}).click();
 await expect(page.getByRole('heading',{name:'Mine konkurranser'})).toBeVisible();
});
test('storskjerm uten konkurranse viser vei til arrangørpanelet uten konto',async({page})=>{
 await page.goto('/storskjerm.html');
 await expect(page.getByRole('heading',{name:'Velg en konkurranse'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Gå til arrangørpanelet'})).toHaveAttribute('href','/admin.html');
});
test('elev og arrangør ber om hver sin visning av samme konkurranse',async({page})=>{
 const {writes}=await prepare(page,fixture(),{admin:true});
 await page.goto('/admin.html?game='+gameId);
 await expect.poll(()=>writes.find(w=>w.op==='state')?.view).toBe('admin');
 expect(writes.find(w=>w.op==='state').playerId).toBeUndefined();
 await page.goto('/?game='+gameId);
 await expect.poll(()=>writes.filter(w=>w.op==='state').at(-1)?.view).toBe('student');
 expect(writes.filter(w=>w.op==='state').at(-1).playerId).toBe('fixture-player');
});

test('arrangørpanelet åpner inne i preview fra et annet nettsted',async()=>{
 // Allow local iframe hosts to emulate a hosted preview on this machine.
 const browser=await chromium.launch({args:['--disable-features=LocalNetworkAccessChecks']});
 const page=await browser.newPage();
 try {
 await page.route('http://127.0.0.1:8889/preview-test',route=>route.fulfill({contentType:'text/html',body:'<iframe src="http://localhost:8889/admin.html"></iframe>'}));
 await page.route('**/api/game',async route=>{
  const request=route.request();
  const headers=await request.allHeaders();
  // Playwright intercepts before Fetch Metadata is attached on the network.
  headers['sec-fetch-site']='cross-site';
  try {
   // Model the preview proxy forwarding to a different internal address.
   await readGameRequest(new Request('https://internal-preview.test/api/game',{method:'POST',headers,body:request.postData()}));
   await route.fulfill({json:{games:[]}});
  }catch {
   await route.fulfill({status:403,json:{error:'Forespørselen ble avvist.'}});
  }
 });
 await page.goto('http://127.0.0.1:8889/preview-test');
 await expect(page.frameLocator('iframe').getByRole('heading',{name:'Mine konkurranser'})).toBeVisible();
 }finally{await browser.close();}
});

test('opprett konkurranse går fra oversikt til arrangørpanelet',async({page})=>{
 const {writes,errors}=await prepare(page,fixture(),{admin:true,registered:false});
 await page.goto('/admin.html');
 await page.getByLabel('Konkurransens navn').fill('Ny konkurranse');
 await page.getByRole('button',{name:'Opprett konkurranse'}).click();
 await expect(page).toHaveURL('/admin.html?game='+gameId);
 await expect(page.locator('#controls')).toBeVisible();
 expect(writes.find(w=>w.op==='create')?.title).toBe('Ny konkurranse');
 expect(writes.some(w=>w.op==='state'&&w.id===gameId)).toBe(true);
 expect(errors).toEqual([]);
});

test('elevvisningen har ingen lenke til arrangørpanelet',async({page})=>{
 await prepare(page,fixture());
 for(const url of ['/','/?game='+gameId]){
  await page.goto(url);
  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('a[href*="admin"]')).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Arrangør/})).toHaveCount(0);
 }
});

for(const viewport of [{width:320,height:568},{width:390,height:664},{width:667,height:375}]){
 for(const state of ['join','waiting','active','countdown','revealed','results']){
  test(`elev mobil ${viewport.width}x${viewport.height} ${state} passer uten zoom eller sidescroll`,async({page})=>{
   await page.setViewportSize(viewport);
   const d=fixture();
   if(!['join','waiting'].includes(state)){
    d.game.state={...d.game.state,phase:state,index:0,deadline:state==='countdown'?Date.now()+60000:null};
    d.game.questions[0].image='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="%23b6d0aa"/></svg>';
   }
   if(['revealed','results'].includes(state)){
    d.game.questions[0].revealed=true;d.game.questions[0].correct=312;
    d.answer={value:300,points:96,locked:true};
    d.topQuestion=Array.from({length:3},(_,i)=>({name:'Deltaker '+(i+1),points:100-i}));
    d.rankings={classes:Array.from({length:3},(_,i)=>({name:'Klasse '+(i+1),count:12,points:95-i})),people:Array.from({length:3},(_,i)=>({name:'Deltaker '+(i+1),className:'Aqua',points:95-i}))};
   }
   await prepare(page,d,{registered:state!=='join'});
   await page.goto('/?game='+gameId);
   await expect(page.locator('.stage')).toBeVisible();
   await page.evaluate(()=>document.fonts.ready);
   const dimensions=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewportWidth:innerWidth,viewportHeight:innerHeight}));
   expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewportWidth);
   expect(dimensions.height).toBeLessThanOrEqual(dimensions.viewportHeight);
   if(['active','countdown'].includes(state))await expect(page.getByRole('button',{name:'Lås svar'})).toBeInViewport();
   if(state==='join')expect(await page.getByLabel('Navnet ditt').evaluate(el=>getComputedStyle(el).fontSize)).toBe('16px');
  });
 }
}
