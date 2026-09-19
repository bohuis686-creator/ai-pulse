import {spawn} from 'node:child_process';
import {createApp} from './server.js';

const port=Number(process.env.PORT || 8787);
if(!Number.isInteger(port)||port<1||port>65535){
  console.error('PORT must be an integer between 1 and 65535.');
  process.exitCode=1;
}else{
  const app=createApp();
  app.on('error',error=>{
    console.error(error.code==='EADDRINUSE'
      ? `Port ${port} is already in use. Close the earlier server or set PORT to another port.`
      : 'Could not start the local server.');
    process.exitCode=1;
  });
  app.listen(port,'127.0.0.1',()=>{
    const url=`http://127.0.0.1:${port}`;
    console.log(`AI Pulse: ${url}\nKeep this window open. Press Ctrl+C to stop.`);
    // PORT is validated above. No user-controlled command text is passed through.
    if(process.platform==='win32'){
      const browser=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{stdio:'ignore',windowsHide:true});
      browser.on('error',()=>console.log('Open the address above in your browser.'));
      browser.unref();
    }
  });
}
