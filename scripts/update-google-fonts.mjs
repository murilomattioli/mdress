import {writeFile} from 'node:fs/promises';
// Build-time metadata snapshot; this endpoint is not a runtime dependency.
const source='https://fonts.google.com/metadata/fonts';
const response=await fetch(source,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('Catalog HTTP '+response.status);
const text=await response.text(),data=JSON.parse(text.slice(text.indexOf('{')));
const families=data.familyMetadataList.map(x=>({family:x.family,category:x.category,variants:Object.keys(x.fonts)}));
if(families.length<1000||families.some(x=>!x.family||!x.variants.length))throw Error('Unexpected catalog format');
await writeFile(new URL('../app/google-fonts-catalog.json',import.meta.url),JSON.stringify({updated:new Date().toISOString().slice(0,10),source,families}));
console.log(families.length+' font families saved');
