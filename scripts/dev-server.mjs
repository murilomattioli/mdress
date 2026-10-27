import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('app');
const portSetting=process.env.PORT ?? '4173';
const port=Number(portSetting);
if(!/^\d+$/.test(portSetting)||!Number.isInteger(port)||port<1||port>65535){
 console.error('mdress: PORT inválida ('+JSON.stringify(portSetting)+'). Use um número entre 1 e 65535.');
 process.exit(1);
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep)){res.writeHead(403).end();return;}const body=await readFile(file);res.writeHead(200,{'content-type':mime[extname(file)]||'application/octet-stream','cache-control':'no-cache'});res.end(body);}catch{res.writeHead(404).end('Not found');}});
server.on('error',error=>{
 if(error.code==='EADDRINUSE'){
  console.error('mdress: a porta '+port+' já está em uso. Abra http://localhost:'+port+' para verificar o servidor existente ou execute em outra porta:');
  console.error('  PowerShell: $env:PORT = 4174; pnpm dev');
 }else{
  console.error('mdress: não foi possível iniciar o servidor na porta '+port+': '+error.message);
 }
 process.exitCode=1;
});
server.listen(port,'127.0.0.1',()=>console.log('mdress: http://localhost:'+port));