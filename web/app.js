import {buildSuite,manualPrompt,manualRun,makeRun,grade,summarize,compareRuns,comparableKey,validateRun,markdownReport,CATEGORIES} from './core.js';

const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
const STORE='ai-pulse-v1';
let history=[],baselineId=null,current=null,busy=false,controller=null,token=null;
const status=(message,error=false)=>{$('status').textContent=message;$('status').className=error?'error':'';};
const suite=()=>buildSuite($('seed').value.trim());
const baseline=()=>history.find(r=>r.id===baselineId);
const comparison=()=>current && baseline()?compareRuns(baseline(),current):null;
const scoreLabel=run=>{const n=summarize(run).score;return n===null?'—':n.toFixed(1);};
const dateLabel=value=>new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

function persist(){
  try{localStorage.setItem(STORE,JSON.stringify({history,baselineId}));}
  catch{status('浏览器存储已满或不可用。当前结果仍可查看，请立即导出 JSON。',true);}
}
try{
  const saved=JSON.parse(localStorage.getItem(STORE)||'null');
  if(saved){history=saved.history.slice(0,10).map(validateRun);baselineId=saved.baselineId;current=history[0]||null;}
}catch{status('旧记录格式不兼容或已损坏，本次不会载入。可重新测试。',true);}

function addRun(run){
  current=validateRun(run);
  history=[current,...history.filter(r=>r.id!==current.id)].slice(0,10);
  if(!history.some(r=>r.id===baselineId))baselineId=null;
  persist();render();
}

function render(){
  $('empty').hidden=Boolean(current);$('result').hidden=!current;
  if(current){
    const stats=summarize(current),c=comparison();
    $('score').textContent=scoreLabel(current);
    $('result-tag').textContent=current.simulated?'演示数据 · 非真实模型评测':'有效回答正确率';
    $('result-model').textContent=current.config.model;
    $('completed').textContent=`${stats.passed} / ${stats.scored} 正确 · ${stats.errors} 项接口错误`;
    $('latency').textContent=stats.medianMs===null?'手动粘贴 · 未测量延迟':`响应耗时中位数 ${(stats.medianMs/1000).toFixed(2)} 秒`;
    $('result-time').textContent=dateLabel(current.createdAt);
    let message=current.simulated?'演示数据仅供体验界面，不代表任何真实模型的表现。':'尚无可对照基线。先保存本次记录，之后使用同样设置复测。';
    if(c){message=(typeof c.delta==='number'?`较基线 ${c.delta>=0?'+':''}${c.delta.toFixed(1)} 个百分点。\n`:'')+c.message;if(c.interval)message+=`\n配对题目 bootstrap 95% 区间：[${c.interval.map(x=>x.toFixed(1)).join(', ')}] 个百分点（探索性指标）。`;}
    if(stats.formatErrors)message+=`\n有 ${stats.formatErrors} 项回答格式不符合要求，已计为未通过，可展开逐题核对。`;
    $('comparison').textContent=message;$('comparison').className='notice'+(c?.status==='decline'?' decline':'');
    $('set-baseline').textContent=current.id===baselineId?'当前对比基线 ✓':'设为对比基线';
    $('set-baseline').disabled=Boolean(current.simulated||stats.errors||current.id===baselineId);
    $('dimensions').replaceChildren(...stats.categories.map(c=>{
      const box=node('div'),label=node('div',null,'dimension-label');label.append(node('span',c.name),node('span',`${c.passed}/${c.total}`));
      const track=node('div',null,'track'),bar=node('progress');bar.max=100;bar.value=c.score??0;bar.setAttribute('aria-label',`${c.name} ${c.score?.toFixed(1)??'无'} 分`);track.append(bar);box.append(label,track);return box;
    }));
    const tasks=buildSuite(current.seed).tasks;
    $('answer-count').textContent=`(${current.results.length})`;
    $('answer-list').replaceChildren(...current.results.map(r=>{
      const task=tasks.find(t=>t.id===r.id),details=node('details',null,'answer-item');
      const state=r.error?'接口错误':r.passed?'通过':'未通过';
      details.append(node('summary',`${state} · ${CATEGORIES[task.category]} / ${task.id.split('-')[1]} · 第 ${r.repeat+1} 轮`,r.passed?'pass':'fail'),node('pre',task.prompt),node('p',`标准答案：${JSON.stringify(task.expected)}`),node('p',`提取答案：${JSON.stringify(r.answer)}`),node('p',task.explanation),node('pre',r.error||r.raw));return details;
    }));
  }
  $('history-count').textContent=String(history.length);$('clear').hidden=!history.length;
  $('history').replaceChildren(...history.map(run=>{
    const button=node('button',null,'history-row'+(run.id===current?.id?' selected':''));button.type='button';
    const info=node('div');info.append(node('b',`${run.simulated?'[演示] ':''}${run.config.model}${run.id===baselineId?' · 基线':''}`),node('small',`${dateLabel(run.createdAt)} · ${run.config.mode==='api'?'API':'聊天'} · ${run.config.repeats} 轮 · ${run.seed}`));button.append(info,node('span',scoreLabel(run),'history-score'));button.addEventListener('click',()=>{if(busy)return;current=run;render();});return button;
  }));
  renderTrend();
}

function renderTrend(){
  $('trend').replaceChildren();if(!current)return;
  const runs=history.filter(r=>comparableKey(r)===comparableKey(current)&&summarize(r).errors===0).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  if(runs.length<2)return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 520 115');svg.setAttribute('role','img');svg.setAttribute('aria-label','同条件历史得分趋势，纵轴 0 到 100 分');
  const draw=(name,attrs)=>{const e=document.createElementNS(svg.namespaceURI,name);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));svg.append(e);return e;};
  for(const s of [0,50,100]){const y=95-s*.75;draw('line',{x1:34,x2:502,y1:y,y2:y,stroke:'#dde3d3'});draw('text',{x:0,y:y+4,fill:'#78836d','font-size':10}).textContent=String(s);}
  const points=runs.map((r,i)=>[34+i*468/(runs.length-1),95-summarize(r).score*.75]);
  draw('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#709444','stroke-width':2});
  points.forEach((p,i)=>{draw('circle',{cx:p[0],cy:p[1],r:4,fill:'#31593d'});const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=`${dateLabel(runs[i].createdAt)}：${scoreLabel(runs[i])}`;svg.lastChild.append(title);});
  $('trend').append(node('p','同条件记录 · 0–100 分 · 从早到晚'),svg);
}

function setMode(mode){
  if(busy)return;
  $('manual-fields').hidden=mode!=='manual';$('api-fields').hidden=mode!=='api';
  $('manual-tab').setAttribute('aria-pressed',String(mode==='manual'));$('api-tab').setAttribute('aria-pressed',String(mode==='api'));
  $('mode-hint').textContent=mode==='manual'?'无需 API Key。复制题目到新对话，再粘贴 AI 的回答。':'每题独立调用接口，自动评分并记录响应耗时。';status('');
}
$('manual-tab').addEventListener('click',()=>setMode('manual'));$('api-tab').addEventListener('click',()=>setMode('api'));
function refreshPrompt(){try{$('prompt').value=manualPrompt(suite());}catch(e){status(e.message,true);}}
$('seed').addEventListener('input',()=>{$('answer').value='';refreshPrompt();});
$('new-seed').addEventListener('click',()=>{if(busy)return;$('seed').value='pulse-'+crypto.getRandomValues(new Uint32Array(1))[0].toString(16);$('answer').value='';refreshPrompt();status('已生成新题组。旧种子的基线不能直接用于这一组。');});
$('show-prompt').addEventListener('click',()=>{$('prompt-details').open=!$('prompt-details').open;refreshPrompt();});
$('copy-prompt').addEventListener('click',async()=>{
  try{const prompt=manualPrompt(suite());await navigator.clipboard.writeText(prompt);status('题目已复制。请粘贴到所测模型的新对话。');}
  catch{$('prompt-details').open=true;refreshPrompt();$('prompt').select();status('浏览器未授权复制，请在展开的文本框中手动复制。');}
});
$('grade').addEventListener('click',()=>{
  try{if(!$('manual-model').value.trim())throw new Error('请填写模型与设置备注，方便以后准确对比。');const run=manualRun(suite(),$('answer').value,$('manual-model').value);status('评分完成，已记录本次结果。');addRun(run);}catch(e){status('无法评分：'+e.message,true);}
});
$('repeats').addEventListener('change',()=>{$('call-budget').textContent=`本次最多 ${24*Number($('repeats').value)} 次独立请求，可能产生服务商 API 费用。`;});

function busyState(value){busy=value;for(const el of document.querySelectorAll('.test-panel input,.test-panel select,.test-panel textarea,.test-panel button')){el.disabled=value;} $('cancel').disabled=false;$('cancel').hidden=!value;$('run-api').hidden=value;for(const id of ['demo','clear','import'])$(id).disabled=value;}
$('cancel').addEventListener('click',()=>controller?.abort());
$('run-api').addEventListener('click',async()=>{
  if(busy)return;
  const config={provider:$('provider').value,model:$('api-model').value.trim(),maxTokens:Number($('max-tokens').value),temperature:$('temperature').value===''?null:Number($('temperature').value),reasoningEffort:$('reasoning').value||null};
  if(!config.model || !$('api-key').value.trim()){status('请填写模型 ID 和 API Key。',true);return;}
  let seed;try{seed=suite().seed;}catch(e){status(e.message,true);return;}
  busyState(true);controller=new AbortController();$('progress-wrap').hidden=false;$('progress').value=0;$('progress').max=24*Number($('repeats').value);$('progress-label').textContent='正在连接…';status('测试进行中。可随时停止后续请求，已发出的请求可能仍计费。');
  try{
    const session=await fetch('/api/session',{signal:controller.signal});if(!session.ok)throw new Error('本地会话无法连接，请重新启动服务。');token=(await session.json()).token;
    const response=await fetch('/api/run',{method:'POST',headers:{'Content-Type':'application/json','X-Pulse-Token':token},body:JSON.stringify({config,key:$('api-key').value,seed,repeats:Number($('repeats').value)}),signal:controller.signal});
    if(!response.ok)throw new Error((await response.json()).error || '请求失败。');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',finished=false;
    for(;;){
      const {value,done}=await reader.read();buffer+=decoder.decode(value||new Uint8Array(),{stream:!done});
      const lines=buffer.split('\n');buffer=lines.pop();
      for(const line of lines){if(!line.trim())continue;const event=JSON.parse(line);
        if(event.type==='progress'){$('progress').value=event.done;$('progress-label').textContent=`已完成 ${event.done} / ${event.total} · ${event.row.id} · ${event.row.error?'接口错误':event.row.passed?'通过':'未通过'}`;}
        if(event.type==='failed')throw new Error(event.error+' 本轮不保存为完整评测。');
        if(event.type==='done'){finished=true;status('自动测试完成。API Key 已从输入框清除。');addRun(event.run);}
      }
      if(done)break;
    }
    if(!finished)throw new Error('连接提前结束，本轮不保存为完整评测。');
  }catch(e){controller.abort();status(e.name==='AbortError'?'测试已停止。未完成的轮次不会作为完整报告保存。':e.message,true);}
  finally{$('api-key').value='';busyState(false);controller=null;}
});

$('set-baseline').addEventListener('click',()=>{if(!current||current.simulated||summarize(current).errors)return;baselineId=current.id;persist();render();status('已设为基线。复测时请保留相同种子、模型和参数。');});
function download(content,name,type){const a=node('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
$('export-json').addEventListener('click',()=>{if(current)download(JSON.stringify(current,null,2),`ai-pulse-${current.id}.json`,'application/json');});
$('export-md').addEventListener('click',()=>{if(current)download(markdownReport(current,comparison()),`ai-pulse-${current.id}.md`,'text/markdown');});
$('import').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>5_000_000)throw new Error('报告不能超过 5 MB。');const run=validateRun(JSON.parse(await file.text()));status('已导入报告，并根据原始回答重新评分。');addRun(run);}catch(error){status('导入失败：'+error.message,true);}finally{e.target.value='';}
});
$('clear').addEventListener('click',()=>{if(busy||!confirm('清空此浏览器中的全部历史和基线？请先导出需要保留的报告。'))return;history=[];baselineId=null;current=null;persist();render();});
$('demo').addEventListener('click',()=>{
  const sample=buildSuite('demo-only');
  const results=sample.tasks.map((task,i)=>{const raw=JSON.stringify({answer:i%7===0?'demo-mistake':task.expected});return {id:task.id,repeat:0,raw,latencyMs:700+i*31,error:null,...grade(task,raw)};});
  addRun(makeRun(sample,{mode:'api',provider:'openai',model:'Demo · 合成示例',repeats:1,maxTokens:4096,temperature:null,reasoningEffort:null,tools:'off'},results,true));status('这是合成演示数据，没有调用任何模型，也不产生费用。');
});
refreshPrompt();render();
