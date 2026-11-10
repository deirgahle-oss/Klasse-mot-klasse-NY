import test from 'node:test';
import assert from 'node:assert/strict';
import {readGameRequest} from '../lib/game-request.mjs';

function request(body,headers={}) {
 return new Request('https://internal-preview.test/api/game',{method:'POST',headers:{'content-type':'application/json',...headers},body});
}
test('preview proxy kan bruke en annen Origin uten innloggingscookies',async()=>{
 const body={op:'list',view:'admin'};
 const result=await readGameRequest(request(JSON.stringify(body),{origin:'https://public-preview.test','sec-fetch-site':'cross-site'}));
 assert.deepEqual(result,body);
});
test('vanlige HTML-skjemaer kan ikke sende konkurransekommandoer',async()=>{
 for(const type of ['text/plain','application/x-www-form-urlencoded','multipart/form-data']) {
  await assert.rejects(readGameRequest(request('{"op":"delete"}',{'content-type':type})),error=>error.status===415);
 }
});
test('ugyldig JSON og ugyldig format gir forståelig klientfeil',async()=>{
 for(const body of ['{','null','[]','"list"']) {
  await assert.rejects(readGameRequest(request(body)),error=>error.status===400);
 }
});
test('JSON med charset godtas',async()=>{
 assert.deepEqual(await readGameRequest(request('{"op":"list"}',{'content-type':'application/json; charset=utf-8'})),{op:'list'});
});
