import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSuite,grade,manualRun,makeRun,summarize,compareRuns,validateRun,markdownReport,manualPrompt,taskPrompt} from '../web/core.js';
import {validateConfig,requestBody,decodeResponse} from '../src/provider.js';

function sample({seed='test',repeats=3,pass=true,simulated=false,model='fixture'}={}){
  const suite=buildSuite(seed),results=[];
  for(let repeat=0;repeat<repeats;repeat++)for(const t of suite.tasks){const raw=JSON.stringify({answer:pass?t.expected:'wrong'});results.push({id:t.id,repeat,raw,latencyMs:50,error:null,...grade(t,raw)});}
  return makeRun(suite,{mode:'api',provider:'openai',model,repeats,maxTokens:4096,temperature:null,reasoningEffort:null,tools:'off'},results,simulated);
}
test('suite is deterministic, balanced, and varies between seeds',()=>{
  assert.deepEqual(buildSuite('alpha'),buildSuite('alpha'));
  assert.notDeepEqual(buildSuite('alpha'),buildSuite('beta'));
  const tasks=buildSuite('alpha').tasks;assert.equal(new Set(tasks.map(t=>t.id)).size,24);
  const counts=Object.groupBy ? Object.groupBy(tasks,t=>t.category) : tasks.reduce((a,t)=>{(a[t.category]??=[]).push(t);return a;},{});
  assert.equal(Object.keys(counts).length,6);for(const rows of Object.values(counts))assert.equal(rows.length,4);
});
test('answer keys agree with independent calculations across 100 seeds',()=>{
  for(let i=0;i<100;i++){
    const tasks=buildSuite(String(i)).tasks;
    const [a,b,c]=tasks[0].prompt.match(/\d+/g).map(Number);assert.equal(tasks[0].expected,a*b-c);
    const [p,q]=tasks[1].prompt.match(/\d+/g).map(Number);assert.ok(Math.abs(tasks[1].expected-p*(1+q/100)*(1-q/100))<1e-8);
    const [base,exponent,divisor]=tasks[2].prompt.match(/\d+/g).map(BigInt);assert.equal(tasks[2].expected,Number(base**exponent%divisor));
    const [first,step,count]=tasks[3].prompt.match(/\d+/g).map(Number);assert.equal(tasks[3].expected,Array.from({length:count},(_,j)=>first+j*step).reduce((a,b)=>a+b,0));
    const task=tasks.find(t=>t.id==='context-1'),target=task.prompt.match(/返回记录(\d+)/)[1];assert.equal(task.expected,task.prompt.match(new RegExp(`记录${target}: 编码 (K\\d+)`))[1]);
  }
});
test('semantic grading rejects substring tricks, wrong types, extra keys and permutations',()=>{
  const t={expected:42};
  assert.equal(grade(t,'{"answer":42}').passed,true);
  for(const raw of ['42','{"answer":"42"}','The answer is 42','{"answer":142}','{"answer":42,"extra":true}'])assert.equal(grade(t,raw).passed,false);
  assert.equal(grade(t,'```json\n{"answer":42}\n```').passed,true);
  assert.equal(grade({expected:false},'{"answer":0}').passed,false);
  assert.equal(grade({expected:null},'{"answer":null}').passed,true);
  assert.equal(grade({expected:[1,2]},'{"answer":[2,1]}').passed,false);
  assert.equal(grade({expected:1/3},'{"answer":0.3333333333}').passed,true);
});
test('manual mode records missing answers as failures, rejects malformed JSON',()=>{
  const suite=buildSuite('a'),answers=Object.fromEntries(suite.tasks.map(t=>[t.id,t.expected]));
  assert.equal(summarize(manualRun(suite,JSON.stringify(answers),'UI')).score,100);
  delete answers['arithmetic-1'];assert.equal(summarize(manualRun(suite,JSON.stringify(answers),'UI')).passed,23);
  assert.throws(()=>manualRun(suite,'not json','UI'));
  assert.throws(()=>manualRun(suite,'[]','UI'));
  assert.equal(manualPrompt(suite).includes('[context-4]'),true);
  assert.equal(taskPrompt(suite.tasks[0]).includes('answer'),true);
});
test('comparison refuses incompatible settings, demos, errors and insufficient repetitions',()=>{
  const base=sample(),low=sample({pass:false});
  const c=compareRuns(base,low);assert.equal(c.status,'decline');assert.equal(c.delta,-100);assert.deepEqual(c.interval,[-100,-100]);
  assert.equal(compareRuns(base,sample()).status,'no-signal');
  for(const run of [sample({seed:'b'}),sample({repeats:1}),sample({model:'other'}),sample({simulated:true})])assert.equal(compareRuns(base,run).status,'incompatible');
  const error=sample();error.results[0].error='timeout';assert.equal(compareRuns(base,error).status,'incomplete');
  assert.equal(compareRuns(sample({repeats:1}),sample({repeats:1,pass:false})).status,'exploratory');
  assert.equal(compareRuns(sample({simulated:true}),sample({simulated:true,pass:false})).status,'demo');
  assert.equal(compareRuns(base,base).status,'same');
});
test('report import recomputes scores and strips extra fields',()=>{
  const fake=sample({pass:false});fake.config.apiKey='test-secret';fake.secret='test-secret';fake.results.forEach(r=>{r.passed=true;r.rawSecret='test-secret';});
  const clean=validateRun(fake);assert.equal(summarize(clean).score,0);assert.equal(JSON.stringify(clean).includes('test-secret'),false);
  assert.equal(markdownReport(sample({simulated:true})).includes('演示数据'),true);
  const duplicate=sample();duplicate.results[1]=duplicate.results[0];assert.throws(()=>validateRun(duplicate));
  const missing=sample();missing.results.pop();assert.throws(()=>validateRun(missing));
  const wrong=sample();wrong.suiteVersion='future';assert.throws(()=>validateRun(wrong));
});
test('API payloads use correct token fields and omit optional parameters by default',()=>{
  for(const provider of ['openai','deepseek','openrouter']){
    const config=validateConfig({provider,model:'example-id',maxTokens:4096});const payload=requestBody(config,'hi');
    assert.equal(payload[provider==='openai'?'max_completion_tokens':'max_tokens'],4096);
    assert.equal('temperature' in payload,false);assert.equal('reasoning_effort' in payload,false);
    assert.deepEqual(payload.messages,[{role:'user',content:'hi'}]);
  }
  assert.throws(()=>validateConfig({provider:'__proto__',model:'x',maxTokens:4096}));
  assert.throws(()=>validateConfig({provider:'openai',model:'x',maxTokens:0}));
  assert.throws(()=>validateConfig({provider:'deepseek',model:'x',maxTokens:4096,temperature:NaN}));
});
test('truncation and empty reasoning-only responses never become a low capability score',()=>{
  assert.throws(()=>decodeResponse({choices:[{finish_reason:'length',message:{content:'{"answer":'}}]}));
  assert.throws(()=>decodeResponse({choices:[{finish_reason:'stop',message:{content:'',reasoning_content:'hidden'}}]}));
  assert.throws(()=>decodeResponse({choices:[{finish_reason:'content_filter',message:{content:'x'}}]}));
  assert.equal(decodeResponse({choices:[{finish_reason:'stop',message:{content:'{"answer":3}'}}]}).text,'{"answer":3}');
});
