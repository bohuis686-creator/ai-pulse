import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {buildSuite,taskPrompt,grade,makeRun} from '../web/core.js';
import {complete,validateConfig} from './provider.js';

const webRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../web');
const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/core.js':['core.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/favicon.svg':['favicon.svg','image/svg+xml']};
const safeEqual=(a,b)=>typeof a==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));

export function createApp({completion=complete}={}) {
  const token=randomBytes(32).toString('hex'); let active=false;
  const server=http.createServer(async(req,res)=>{
    const port=server.address().port;
    const hosts=[`127.0.0.1:${port}`,`localhost:${port}`];
    const origin=req.headers.origin;
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const json=(status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(obj));};
    if(!hosts.includes(req.headers.host) || (origin && !hosts.some(h=>origin===`http://${h}`)))return json(403,{error:'仅允许本机同源访问。'});
    if(req.method==='GET' && req.url==='/api/session')return json(200,{token});
    if(req.method==='GET' && Object.hasOwn(files,req.url)){
      try{const [name,type]=files[req.url];res.writeHead(200,{'Content-Type':type});res.end(await readFile(resolve(webRoot,name)));}catch{if(!res.headersSent)json(500,{error:'无法读取页面。'});else res.end();}return;
    }
    if(req.method!=='POST' || req.url!=='/api/run')return json(404,{error:'Not found'});
    if(!safeEqual(req.headers['x-pulse-token'],token))return json(403,{error:'会话已过期，请刷新页面。'});
    if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{error:'请求需为 JSON。'});
    if(active)return json(409,{error:'已有测试运行中，请等待完成或取消。'});
    let input;
    try{
      let data='';for await(const chunk of req){data+=chunk;if(data.length>20000)throw new Error('请求过大。');}
      input=JSON.parse(data);
    }catch{return json(400,{error:'请求格式无效或过大。'});}
    let config,suite;
    try{
      config=validateConfig(input.config);suite=buildSuite(input.seed);
      if(!Number.isInteger(input.repeats) || input.repeats<1 || input.repeats>5)throw new Error('重复次数需为 1–5。');
      if(typeof input.key!=='string'||!input.key.trim()||input.key.length>4096||/[\r\n]/.test(input.key))throw new Error('请填写 API Key。');
    }catch(e){return json(400,{error:e.message});}
    // Reserve before the first await; this prevents overlapping paid runs.
    if(active)return json(409,{error:'已有测试运行中。'});
    active=true;
    const controller=new AbortController();
    res.on('close',()=>controller.abort());
    res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8'});
    const send=obj=>{if(!res.destroyed)res.write(JSON.stringify(obj)+'\n');};
    const results=[];
    try{
      for(let repeat=0;repeat<input.repeats;repeat++){
        for(const task of suite.tasks){
          if(controller.signal.aborted)return;
          const start=performance.now();let row;
          try{
            const response=await completion(config,input.key,taskPrompt(task),{signal:controller.signal});
            row={id:task.id,repeat,raw:response.text,latencyMs:Math.round(performance.now()-start),error:null,...grade(task,response.text)};
          }catch(e){row={id:task.id,repeat,raw:'',latencyMs:Math.round(performance.now()-start),error:e.message,passed:false,kind:'error',answer:null};}
          if(controller.signal.aborted)return;
          results.push(row);send({type:'progress',done:results.length,total:suite.tasks.length*input.repeats,row});
          if(row.error){
            // Fail fast: do not spend the remaining calls on an invalid key/config.
            send({type:'failed',error:row.error,completed:results.length});return;
          }
        }
      }
      const run=makeRun(suite,{...config,mode:'api',repeats:input.repeats,tools:'off'},results);
      send({type:'done',run});
    }catch{send({type:'failed',error:'测试被中断，请重试。'});}
    finally{input.key='';active=false;res.end();}
  });
  return server;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT || 8787);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT 必须是有效端口。');
  const app=createApp();
  app.on('error',e=>{console.error(e.code==='EADDRINUSE'?`端口 ${port} 已被占用。可设置 PORT 后重新启动。`:'本地服务启动失败。');process.exitCode=1;});
  app.listen(port,'127.0.0.1',()=>console.log(`AI Pulse → http://127.0.0.1:${port}\n仅本机可访问。按 Ctrl+C 停止。API Key 不写入磁盘。`));
}
