/** Every user-facing static page and catalog entry must have a real guide. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(relative){const source=fs.readFileSync(path.join(root,relative),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const context={exports:{},require};vm.runInNewContext(js,context,{filename:relative,timeout:5000});return context.exports}
const {guides,docCategories}=load('src/components/publications/docs.ts'),{serviceGroups}=load('src/lib/serviceNavigation.ts');
const issues=[],slugs=new Set(),categories=new Set(docCategories.map(category=>category.id)),covered=new Set(guides.flatMap(guide=>guide.features));
function routes(directory,prefix=''){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{if(entry.isDirectory()&&!entry.name.startsWith('['))return routes(path.join(directory,entry.name),prefix+'/'+entry.name);return entry.isFile()&&entry.name==='page.tsx'?[prefix||'/']:[]})}
// /demo is the contributor sandbox, documented in docs/DEVELOPMENT.md.
const pages=routes(path.join(root,'src/app')).filter(page=>page!=='/demo');
const services=serviceGroups.flatMap(group=>group.services);
for(const href of new Set([...services.map(service=>service.href),...pages,'https://admin.cbgpu.com','https://developers.cbgpu.com','https://print.cbgpu.com','https://laser.cbgpu.com','https://manufacturing.cbgpu.com','https://app.cbgpu.com']))if(!covered.has(href))issues.push('Missing guide for '+href);
for(const guide of guides){if(slugs.has(guide.slug))issues.push('Duplicate slug '+guide.slug);slugs.add(guide.slug);if(!categories.has(guide.category))issues.push('Unknown category '+guide.slug);if(!guide.description||guide.sections.length<3)issues.push('Incomplete guide '+guide.slug);for(const section of guide.sections){if(!section.title||!section.body.trim())issues.push('Empty section '+guide.slug);for(const link of section.links||[]){try{const url=new URL(link.href);if(url.protocol!=='https:'||url.username||url.password)throw Error()}catch{issues.push('Invalid link in '+guide.slug)}}}}
for(const guide of guides)for(const related of guide.related)if(!slugs.has(related))issues.push('Missing related guide '+related);
for(const category of categories)if(!guides.some(guide=>guide.category===category))issues.push('Empty category '+category);
if(issues.length){console.error(issues.join('\n'));process.exit(1)}
console.log(`Docs coverage: ${guides.length} guides cover all ${services.length} catalog services and ${pages.length} static pages.`);
