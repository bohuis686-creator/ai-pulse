import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,copyFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const windows=process.platform==='win32';
const launcher=fileURLToPath(new URL('../Start-Windows.cmd',import.meta.url));
const helper=fileURLToPath(new URL('../src/start-windows.js',import.meta.url));

function run(command,cwd,env=process.env){
  const result=spawnSync(join(process.env.SystemRoot,'System32','cmd.exe'),['/d','/s','/c',command],{cwd,env,encoding:'utf8',timeout:20000,windowsHide:true,windowsVerbatimArguments:true});
  assert.ifError(result.error);
  return result;
}

test('Windows launcher finds PATH Node from an unrelated working directory',{skip:!windows},()=>{
  const result=run(`""${launcher}" --check"`,tmpdir());
  assert.equal(result.status,0,result.stdout+result.stderr);
});

test('Windows launcher accepts portable Node with Chinese, spaces and ampersands, without PATH',{skip:!windows},()=>{
  const root=mkdtempSync(join(tmpdir(),'AI Pulse 中文 & '));
  try{
    const project=join(root,'project folder'),portable=join(root,'portable node');
    mkdirSync(join(project,'src'),{recursive:true});mkdirSync(portable);
    copyFileSync(launcher,join(project,'Start-Windows.cmd'));copyFileSync(helper,join(project,'src','start-windows.js'));
    const node=join(portable,'node.exe');copyFileSync(process.execPath,node);
    const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>key.toLowerCase()!=='path'));
    env.PATH='';
    const result=run(`""${join(project,'Start-Windows.cmd')}" "${node}" --check"`,resolve(tmpdir()),env);
    assert.equal(result.status,0,result.stdout+result.stderr);
  }finally{rmSync(root,{recursive:true,force:true});}
});

test('Windows launcher reports a missing explicit Node path without hanging on pause',{skip:!windows},()=>{
  const result=run(`""${launcher}" "${join(tmpdir(),'pulse-nonexistent-node.exe')}" --check"`,tmpdir());
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stdout,/could not start/);
});
