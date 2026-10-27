
const tick=String.fromCharCode(96);
export function escapeHTML(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function safeURL(raw){try{const u=new URL(raw);return ['https:','http:','mailto:'].includes(u.protocol)?escapeHTML(u.href):'#';}catch{return '#';}}
export function inlineMarkdown(source){
 const code=[];
 let out=escapeHTML(source).replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,(_,alt,url)=>{const safe=safeURL(url);return safe==='#'?'':('<img src="'+safe+'" alt="'+alt+'" loading="lazy">');}).replace(new RegExp(tick+'([^'+tick+']+)'+tick,'g'),(_,part)=>{const i=code.push('<code>'+part+'</code>')-1;return '\x01'+i+'\x02';});
 out=out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(_,name,url)=>'<a href="'+safeURL(url)+'" rel="noopener noreferrer" target="_blank">'+name+'</a>');
 out=out.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/~~(.+?)~~/g,'<del>$1</del>').replace(/(?<!\*)\*([^*]+)\*(?!\*)/g,'<em>$1</em>');
 return out.replace(/\x01(\d+)\x02/g,(_,index)=>code[Number(index)]||'');
}
export function markdownToHTML(markdown){
 const source=markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'');
 const lines=source.split(/\r?\n/),out=[];let list=null,quote=[],code=null;
 function endList(){if(list){out.push('</'+list+'>');list=null;}}
 function endQuote(){if(quote.length){out.push('<blockquote>'+quote.map(inlineMarkdown).join('<br>')+'</blockquote>');quote=[];}}
 function endCode(){if(code){out.push('<pre><code>'+escapeHTML(code.join('\n'))+'</code></pre>');code=null;}}
 const tableCells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(c=>c.trim());
 const tableDelimiter=line=>/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
 for(let index=0;index<lines.length;index++){
  const line=lines[index];
  const trim=line.trim(),isFence=trim.startsWith(tick.repeat(3));
  if(code){if(isFence)endCode();else code.push(line);continue;}
  if(isFence){endList();endQuote();code=[];continue;}
  if(!trim){endList();endQuote();continue;}
  const quoteMatch=trim.match(/^>\s?(.*)$/);
  if(quoteMatch){endList();quote.push(quoteMatch[1]);continue;}
  endQuote();
  if(trim.includes('|')&&index+1<lines.length&&tableDelimiter(lines[index+1])){
   endList();
   const headers=tableCells(trim),body=[];
   index+=2;
   while(index<lines.length&&lines[index].trim()&&lines[index].includes('|')){
    body.push(tableCells(lines[index]));index++;
   }
   index--;
   out.push('<table><thead><tr>'+headers.map(cell=>'<th>'+inlineMarkdown(cell)+'</th>').join('')+'</tr></thead><tbody>'+body.map(row=>'<tr>'+headers.map((_,i)=>'<td>'+inlineMarkdown(row[i]||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table>');
   continue;
  }
  if(/^([-*_])(?:\s*\1){2,}\s*$/.test(trim)){endList();out.push('<hr>');continue;}
  const heading=trim.match(/^(#{1,6})\s+(.+)$/);
  if(heading){endList();const n=heading[1].length;out.push('<h'+n+'>'+inlineMarkdown(heading[2])+'</h'+n+'>');continue;}
  const ordered=trim.match(/^\d+[.)]\s+(.*)$/);
  const bullet=trim.match(/^[-*+]\s+(.*)$/);
  if(ordered||bullet){
   const newList=ordered?'ol':'ul';
   if(list!==newList){endList();out.push('<'+newList+'>');list=newList;}
   const value=(ordered||bullet)[1];
   const check=value.match(/^\[([ xX])\]\s+(.*)$/);
   out.push('<li>'+(check?(check[1]===' '?'☐ ':'☑ ')+inlineMarkdown(check[2]):inlineMarkdown(value))+'</li>');
   continue;
  }
  endList();out.push('<p>'+inlineMarkdown(trim)+'</p>');
 }
 endList();endQuote();endCode();
 return out.join('\n');
}
