import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function schoolReplacements(config){
 const domain=/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
 for(const key of ['domain','edusetHost'])if(!domain.test(config[key]||''))throw Error('Invalid '+key);
 if(!/^[\p{L}\p{N} ._-]{2,100}$/u.test(config.schoolName||''))throw Error('Invalid schoolName');
 if(!/^[A-Za-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(config.contactEmail||''))throw Error('Invalid contactEmail');
 if(!/^\/[A-Za-z0-9_/-]+$/.test(config.installRoot||'')||config.installRoot.split('/').includes('..'))throw Error('Invalid installRoot');
 return [['/home/cbgpu/CBGPU-live',config.installRoot],['cbgpu.com',config.domain],['cbsh.edu-set.com',config.edusetHost],['충북과학고등학교',config.schoolName],['Chungbuk Science High School',config.schoolName],['충북과학고',config.schoolName],['lmw.hpc@gmail.com',config.contactEmail],['just_grassy@cbgpu.com',config.contactEmail]];
}
export function applyReplacements(text,replacements){const pattern=new RegExp(replacements.map(([from])=>from.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');const values=new Map(replacements);return text.replace(pattern,match=>values.get(match));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const configFile=process.argv.find(v=>v.endsWith('.json'));if(!configFile)throw Error('Usage: node scripts/configure-school.mjs config/school.json [--write]');
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),replacements=schoolReplacements(JSON.parse(fs.readFileSync(configFile,'utf8')));
 const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0');let changed=0;
 for(const f of files){if(!/^(FrontEnd|backend|Daemon|MaterialShare)\//.test(f)||/\/vendor\/|LICENSE|package-lock\.json|pubspec.lock|\/store\/|\.apk$/.test(f)||!(/\.(?:ts|tsx|js|mjs|cjs|py|yaml|yml|html|css|sh|md|txt|dart|json|conf|sql)$/.test(f)))continue;const p=path.join(root,f);const before=fs.readFileSync(p,'utf8'),after=applyReplacements(before,replacements);if(before===after)continue;changed++;console.log((process.argv.includes('--write')?'UPDATE ':'WOULD UPDATE ')+f);if(process.argv.includes('--write'))fs.writeFileSync(p,after);}
 console.log(changed+' files. Review the diff; configure your own Firebase, DNS, certificates, secrets and data before deploying.');
}
