import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {demoEnvironment as createEnvironment} from '../demo/environment.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const built=process.argv.includes('--built'),build=process.argv.includes('--build');
for(const f of fs.readdirSync(path.join(root,'FrontEnd/cbgpu')))if((f==='.env'||f.startsWith('.env.'))&&f!=='.env.example')throw Error('Use a clean demo checkout without '+f+'; the demo must not load real environment files.');
const demoEnvironment=createEnvironment();
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const c of children)c.kill('SIGTERM');setTimeout(()=>process.exit(code),200).unref()}
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>stop());
if(!build){const api=spawn(process.execPath,['demo/server.cjs'],{cwd:root,env:demoEnvironment,stdio:'inherit'});children.push(api);api.on('exit',code=>stop(code||0));console.log('Local demo: http://localhost:3100 — student@example.invalid / demo-only. No real services.');}
const next=spawn(process.execPath,['node_modules/next/dist/bin/next',build?'build':built?'start':'dev',...(build?[]:['--hostname',process.argv.includes('--container')?'0.0.0.0':'127.0.0.1','--port','3100'])],{cwd:path.join(root,'FrontEnd/cbgpu'),env:demoEnvironment,stdio:'inherit'});children.push(next);next.on('exit',code=>stop(code||0));
