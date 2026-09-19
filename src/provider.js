import https from 'node:https';

export const PROVIDERS = Object.freeze({
  openai: {name:'OpenAI API',url:'https://api.openai.com/v1/chat/completions',tokenField:'max_completion_tokens'},
  deepseek: {name:'DeepSeek API',url:'https://api.deepseek.com/chat/completions',tokenField:'max_tokens'},
  openrouter: {name:'OpenRouter',url:'https://openrouter.ai/api/v1/chat/completions',tokenField:'max_tokens'},
});

export function validateConfig(input) {
  if(!input || typeof input!=='object' || !Object.hasOwn(PROVIDERS,input.provider)) throw new Error('请选择支持的 API 服务。');
  if(typeof input.model!=='string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:/@+-]{0,119}$/.test(input.model)) throw new Error('请填写服务商提供的有效模型 ID。');
  if(!Number.isInteger(input.maxTokens) || input.maxTokens<128 || input.maxTokens>32768) throw new Error('输出上限需为 128–32768 的整数。');
  if(input.temperature!=null && (!Number.isFinite(input.temperature) || input.temperature<0 || input.temperature>2)) throw new Error('温度需留空，或为 0–2。');
  if(input.reasoningEffort!=null && !['low','medium','high'].includes(input.reasoningEffort)) throw new Error('推理参数无效。');
  return {provider:input.provider,model:input.model,maxTokens:input.maxTokens,temperature:input.temperature??null,reasoningEffort:input.reasoningEffort??null};
}

export function requestBody(config,prompt) {
  const provider=PROVIDERS[config.provider];
  const body={model:config.model,messages:[{role:'user',content:prompt}],[provider.tokenField]:config.maxTokens,stream:false};
  if(config.temperature!==null)body.temperature=config.temperature;
  if(config.reasoningEffort!==null)body.reasoning_effort=config.reasoningEffort;
  return body;
}

export function decodeResponse(data) {
  const choice=data?.choices?.[0];
  if(choice?.finish_reason==='length') throw new Error('输出被 token 上限截断，请提高上限后重新建立基线。');
  if(choice?.finish_reason==='content_filter') throw new Error('服务商过滤了输出，此题不计为推理错误。');
  if(typeof choice?.message?.content!=='string' || !choice.message.content.trim()) throw new Error('接口未返回可评分的文本。检查模型、token 上限与接口兼容性。');
  return {text:choice.message.content,returnedModel:typeof data.model==='string'?data.model:null};
}

// Explicit provider allowlist; no arbitrary URL or redirects carrying API keys.
export function complete(config,key,prompt,{signal,timeoutMs=120000}={}) {
  if(typeof key!=='string' || !key.trim() || key.length>4096 || /[\r\n]/.test(key)) throw new Error('API Key 无效。');
  const body=JSON.stringify(requestBody(config,prompt));
  return new Promise((resolve,reject)=>{
    const req=https.request(PROVIDERS[config.provider].url,{method:'POST',signal,headers:{'Content-Type':'application/json','Authorization':`Bearer ${key.trim()}`,'Content-Length':Buffer.byteLength(body)}},res=>{
      let data='';
      res.setEncoding('utf8');
      res.on('data',chunk=>{data+=chunk;if(data.length>1_000_000)req.destroy(new Error('接口响应过大。'));});
      res.on('end',()=>{
        if(res.statusCode!==200){
          const messages={401:'API Key 不正确或无访问权限。',402:'服务商账户余额不足。',403:'服务商拒绝访问，请检查账户和地区限制。',404:'模型或接口不存在。',429:'服务商限流，请稍后重试。',400:'服务商不接受该模型或参数。请检查模型 ID，并尝试留空温度和推理参数。'};
          reject(new Error(messages[res.statusCode] || `服务商返回 HTTP ${res.statusCode}。`));return;
        }
        try{resolve(decodeResponse(JSON.parse(data)));}catch(e){reject(new Error(e instanceof SyntaxError?'接口返回了无效 JSON。':e.message));}
      });
      res.on('error',()=>reject(new Error('接收接口响应时连接中断。')));
    });
    const timer=setTimeout(()=>req.destroy(new Error('单题请求超时。')),timeoutMs);
    req.on('close',()=>clearTimeout(timer));
    req.on('error',e=>reject(new Error(e.name==='AbortError'?'测试已取消。':e.message==='单题请求超时。'||e.message==='接口响应过大。'?e.message:'网络连接失败，请检查网络或本机代理配置。')));
    req.end(body);
  });
}
