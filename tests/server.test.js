import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createApp} from '../src/server.js';
import {buildSuite,taskPrompt,summarize,validateRun} from '../web/core.js';

async function fixture(completion){
  const server=createApp({completion});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const {token}=await (await fetch(base+'/api/session')).json();
  return {server,base,token,close:()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);})};
}
const input={seed:'integration',key:'test-key-not-a-real-secret',repeats:3,config:{provider:'deepseek',model:'mock-model',maxTokens:4096}};
test('full HTTP run streams 72 isolated requests and a valid report without credentials',async()=>{
  const answers=new Map(buildSuite(input.seed).tasks.map(t=>[taskPrompt(t),t.expected]));let calls=0;
  const app=await fixture(async(config,key,prompt)=>{calls++;assert.equal(key,input.key);assert.equal(config.provider,'deepseek');assert.ok(answers.has(prompt));return {text:JSON.stringify({answer:answers.get(prompt)})};});
  try{
    const response=await fetch(app.base+'/api/run',{method:'POST',headers:{'Content-Type':'application/json','X-Pulse-Token':app.token},body:JSON.stringify(input)});
    assert.equal(response.status,200);const raw=await response.text();assert.equal(raw.includes(input.key),false);
    const events=raw.trim().split('\n').map(JSON.parse);assert.equal(calls,72);assert.equal(events.filter(e=>e.type==='progress').length,72);
    const run=validateRun(events.at(-1).run);assert.equal(summarize(run).score,100);
  }finally{await app.close();}
});
test('rejects cross-origin, missing token, malformed input and traversal; serves static assets',async()=>{
  const app=await fixture(async()=>{throw new Error('should never be called');});
  try{
    assert.equal((await fetch(app.base+'/api/session',{headers:{Origin:'https://evil.example'}})).status,403);
    const hostStatus=await new Promise((resolve,reject)=>{const r=http.get(app.base+'/api/session',{headers:{Host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode);});r.on('error',reject);});
    assert.equal(hostStatus,403);
    for(const token of ['', 'é'.repeat(64)])assert.equal((await fetch(app.base+'/api/run',{method:'POST',headers:{'Content-Type':'application/json','X-Pulse-Token':token},body:'{}'})).status,403);
    assert.equal((await fetch(app.base+'/api/run',{method:'POST',headers:{'Content-Type':'application/json','X-Pulse-Token':app.token},body:'{bad'})).status,400);
    assert.equal((await fetch(app.base+'/package.json')).status,404);
    assert.equal((await fetch(app.base+'/%2e%2e/package.json')).status,404);
    for(const path of ['/','/app.js','/core.js','/style.css','/favicon.svg']){const r=await fetch(app.base+path);assert.equal(r.status,200);assert.ok(r.headers.get('content-security-policy').includes("frame-ancestors 'none'"));}
  }finally{await app.close();}
});
test('fails fast after one provider error and does not save a partial run',async()=>{
  let calls=0;const app=await fixture(async()=>{calls++;throw new Error('mock rate limit');});
  try{const r=await fetch(app.base+'/api/run',{method:'POST',headers:{'Content-Type':'application/json','X-Pulse-Token':app.token},body:JSON.stringify(input)});const events=(await r.text()).trim().split('\n').map(JSON.parse);assert.equal(calls,1);assert.equal(events.at(-1).type,'failed');assert.equal(events.some(e=>e.type==='done'),false);}finally{await app.close();}
});
