
const tick=String.fromCharCode(96);
export const markdownCommands=Object.freeze(['bold','italic','strike','inlineCode','link','h1','h2','h3','paragraph','bullet','number','task','quote','fence','rule']);
const markers={bold:['**','**','texto em negrito'],italic:['*','*','texto em itálico'],strike:['~~','~~','texto riscado'],inlineCode:[tick,tick,'código']};
function clamp(value,max){return Math.max(0,Math.min(max,Number.isFinite(value)?value:0));}
function result(text,start,end){return {text,start,end};}
function wrap(text,start,end,open,close,placeholder){
 const selected=text.slice(start,end);
 const pre=text.slice(start-open.length,start),post=text.slice(end,end+close.length);
 if(start>=open.length && pre===open && post===close){
  return result(text.slice(0,start-open.length)+selected+text.slice(end+close.length),start-open.length,end-open.length);
 }
 if(selected.startsWith(open)&&selected.endsWith(close)&&selected.length>open.length+close.length){
  const raw=selected.slice(open.length,-close.length);
  return result(text.slice(0,start)+raw+text.slice(end),start,start+raw.length);
 }
 const raw=selected||placeholder,modified=open+raw+close;
 return result(text.slice(0,start)+modified+text.slice(end),start+open.length,start+open.length+raw.length);
}
function lineChange(text,start,end,mapper){
 const first=text.lastIndexOf('\n',Math.max(-1,start-1))+1;
 const anchor=end>start&&text[end-1]==='\n'?end-1:end;
 const stop=text.indexOf('\n',anchor),last=stop===-1?text.length:stop;
 const lines=text.slice(first,last).split('\n');
 const next=mapper(lines).join('\n');
 return result(text.slice(0,first)+next+text.slice(last),first,first+next.length);
}
function clearPrefix(line){return line.replace(/^(\s*)(?:#{1,6}\s+|-\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|>\s+)/,'$1');}
export function applyMarkdownCommand(value,a,b,command,arg=''){
 if(typeof value!=='string'||!markdownCommands.includes(command))throw Error('Comando Markdown não suportado');
 const start=clamp(Math.min(a,b),value.length),end=clamp(Math.max(a,b),value.length);
 if(Object.hasOwn(markers,command))return wrap(value,start,end,...markers[command]);
 if(command==='link'){
  if(typeof arg!=='string'||!/^(https?:\/\/|mailto:)/i.test(arg))throw Error('Use URL http, https ou mailto');
  try{const parsed=new URL(arg);if(!['https:','http:','mailto:'].includes(parsed.protocol))throw Error('Protocolo inválido');}catch{throw Error('URL inválida');}
  const selected=value.slice(start,end)||'texto do link',link='['+selected+']('+arg.replace(/[()\s]/g,c=>encodeURIComponent(c))+')';
  return result(value.slice(0,start)+link+value.slice(end),start+1,start+1+selected.length);
 }
 if(command==='fence'){
  const selected=value.slice(start,end)||'seu código',block=tick.repeat(3)+'\n'+selected+'\n'+tick.repeat(3);
  return result(value.slice(0,start)+block+value.slice(end),start+4,start+4+selected.length);
 }
 if(command==='rule'){
  const pos=value.indexOf('\n',start),boundary=pos===-1?value.length:pos;
  const prefix=boundary===0?'':'\n',next=prefix+'\n---\n';
  return result(value.slice(0,boundary)+next+value.slice(boundary),boundary+next.length,boundary+next.length);
 }
 if(command==='paragraph'||/^h[123]$/.test(command)){
  const sign=command==='paragraph'?'':'#'.repeat(Number(command[1]))+' ';
  return lineChange(value,start,end,lines=>lines.map(line=>line.trim()?line.replace(/^(\s*)(?:#{1,6}\s+)?/,'$1'+sign):line));
 }
 const target=command==='bullet'?/^(\s*)[-*+]\s+/:command==='number'?/^(\s*)\d+[.)]\s+/:command==='task'?/^(\s*)[-*+]\s+\[[ xX]\]\s+/:/^(\s*)>\s+/;
 return lineChange(value,start,end,lines=>{
  const meaningful=lines.filter(l=>l.trim());
  const toggleOff=meaningful.length>0&&meaningful.every(l=>target.test(l));
  let index=0;
  return lines.map(line=>{
   if(!line.trim())return line;
   const indent=(line.match(/^\s*/)||[''])[0],body=clearPrefix(line).slice(indent.length);
   if(toggleOff)return indent+body;
   const marker=command==='bullet'?'- ':command==='number'?String(++index)+'. ':command==='task'?'- [ ] ':'> ';
   return indent+marker+body;
  });
 });
}
