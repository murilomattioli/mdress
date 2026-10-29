import {googleFamily,googleStack} from './google-fonts.js';
import {validateMeshPoints,meshCSS} from './mesh-background.js';
/** Appearance of exported resume, independent from the application's own theme. */
export const presets=Object.freeze({
 minimal:{accent:'#245f81',background:'#ffffff',text:'#151a20',font:'system',size:10.5},
 swiss:{accent:'#185b63',background:'#ffffff',text:'#151a20',font:'system',size:10.5},
 technical:{accent:'#3d4358',background:'#ffffff',text:'#181b22',font:'mono',size:10},
 oled:{accent:'#a2eaff',background:'#000000',text:'#ffffff',font:'system',size:10.5},
 graphite:{accent:'#ff9b68',background:'#101214',text:'#f4f5f6',font:'system',size:10.5},
 sand:{accent:'#435c44',background:'#f9f2df',text:'#28271f',font:'serif',size:10.5},
 neon:{accent:'#dba6ff',background:'#080911',text:'#f8f3ff',font:'system',size:10.5}
});
/** System font stacks; no network or font bundling required. */
export const fontFamilies=Object.freeze({
 sans:Object.freeze([{id:'system',label:'Sans padrão'},{id:'arial',label:'Arial'},{id:'verdana',label:'Verdana'},{id:'trebuchet',label:'Trebuchet MS'},{id:'tahoma',label:'Tahoma'}]),
 serif:Object.freeze([{id:'serif',label:'Georgia'},{id:'times',label:'Times New Roman'},{id:'palatino',label:'Palatino'},{id:'bookman',label:'Bookman'}]),
 mono:Object.freeze([{id:'mono',label:'Consolas'},{id:'courier',label:'Courier New'},{id:'lucida-mono',label:'Lucida Console'}])
});
export const fonts=Object.freeze({
 system:'Arial,Helvetica,sans-serif',arial:'Arial,Helvetica,sans-serif',verdana:'Verdana,Geneva,sans-serif',
 trebuchet:'"Trebuchet MS",Arial,sans-serif',tahoma:'Tahoma,Geneva,sans-serif',
 serif:'Georgia,serif',times:'"Times New Roman",Times,serif',
 palatino:'"Palatino Linotype","Book Antiqua",Palatino,serif',bookman:'"Bookman Old Style",Georgia,serif',
 mono:'Consolas,monospace',courier:'"Courier New",Courier,monospace',
 'lucida-mono':'"Lucida Console","Lucida Sans Typewriter",monospace'
});
export const resolveFont=id=>fonts[id]||googleStack(id)||fonts.system;
export const fontCategory=id=>Object.entries(fontFamilies).find(([,entries])=>entries.some(item=>item.id===id))?.[0]??'sans';
export const defaults=Object.freeze({theme:'minimal',...presets.minimal,paper:'a4',layout:{marginMm:18,lineHeight:1.5,titleScale:2.4,sectionGapEm:1.4,sectionRule:'line'},backgroundStyle:{kind:'solid',secondary:'#e7edf2',angle:135,radialX:70,radialY:15,radialRadius:80,patternSize:18,opacity:0.12,softness:80,points:[]}});
export const layoutDefaults=Object.freeze({marginMm:18,lineHeight:1.5,titleScale:2.4,sectionGapEm:1.4,sectionRule:'line'});
export const backgroundDefaults=Object.freeze({kind:'solid',secondary:'#e7edf2',angle:135,radialX:70,radialY:15,radialRadius:80,patternSize:18,opacity:0.12,softness:80,points:[]});
const keys=new Set(['theme','accent','background','text','font','size','paper','layout','backgroundStyle','colorOpacity']);
export function validateTheme(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!keys.has(k)))throw Error('Tema inválido');
 const name=raw.theme??'minimal';
 if(!Object.hasOwn(presets,name))throw Error('Preset desconhecido');
 const t={theme:name,...presets[name],paper:'a4',...raw};
 for(const key of ['accent','background','text'])if(typeof t[key]!=='string'||!/^#[\da-f]{6}$/i.test(t[key]))throw Error('Cor inválida: '+key);
 if(!Object.hasOwn(fonts,t.font)&&!googleFamily(t.font))throw Error('Fonte não permitida');
 if(!Number.isFinite(t.size)||t.size<9||t.size>14)throw Error('Tamanho fora do intervalo');
 if(!['a4','letter'].includes(t.paper))throw Error('Papel inválido');
 const opacity=t.colorOpacity??{};
 if(typeof opacity!=='object'||Array.isArray(opacity)||Object.entries(opacity).some(([k,v])=>!['accent','background','text','secondary'].includes(k)||!Number.isFinite(v)||v<0||v>1))throw Error('Opacidade de cor inválida');
 t.colorOpacity={...opacity};
 const layout={...layoutDefaults,...t.layout}; const backgroundStyle={...backgroundDefaults,...t.backgroundStyle};
 if((t.layout && (typeof t.layout!=='object'||Array.isArray(t.layout)||Object.keys(t.layout).some(k=>!(k in layoutDefaults)))) ||
 (t.backgroundStyle && (typeof t.backgroundStyle!=='object'||Array.isArray(t.backgroundStyle)||Object.keys(t.backgroundStyle).some(k=>!(k in backgroundDefaults)))))throw Error('Configuração desconhecida');
 for(const [key,min,max] of [['marginMm',8,35],['lineHeight',1.1,2.2],['titleScale',1.4,3.4],['sectionGapEm',0.4,3]])if(!Number.isFinite(layout[key])||layout[key]<min||layout[key]>max)throw Error('Layout inválido: '+key);
 if(!['line','none','block'].includes(layout.sectionRule))throw Error('Separador inválido');
 if(!['solid','gradient','dots','lines','grid','radial','crosshatch','checker','mesh'].includes(backgroundStyle.kind))throw Error('Fundo inválido');
 if(!/^#[\da-f]{6}$/i.test(backgroundStyle.secondary)||!Number.isFinite(backgroundStyle.angle)||backgroundStyle.angle<0||backgroundStyle.angle>360||!Number.isFinite(backgroundStyle.patternSize)||backgroundStyle.patternSize<8||backgroundStyle.patternSize>64||!Number.isFinite(backgroundStyle.opacity)||backgroundStyle.opacity<0.02||backgroundStyle.opacity>0.6||!Number.isFinite(backgroundStyle.softness)||backgroundStyle.softness<0||backgroundStyle.softness>100)throw Error('Parâmetros de fundo inválidos');
 for(const [key,min,max] of [['radialX',0,100],['radialY',0,100],['radialRadius',10,150]])if(!Number.isFinite(backgroundStyle[key])||backgroundStyle[key]<min||backgroundStyle[key]>max)throw Error('Parâmetros radiais inválidos');
 backgroundStyle.points=validateMeshPoints(backgroundStyle.points,backgroundStyle.kind==='mesh');
 t.layout=layout;t.backgroundStyle=backgroundStyle;
 return t;
}
export function selectPreset(theme,previous=defaults){return validateTheme({theme,paper:validateTheme(previous).paper});}
export function themeCode(t){return 'RST1:'+btoa(Array.from(new TextEncoder().encode(JSON.stringify(validateTheme(t))),x=>String.fromCharCode(x)).join(''));}
export function decodeTheme(code){
 if(typeof code!=='string'||!code.startsWith('RST1:')||code.length>12000)throw Error('Código inválido');
 try{return validateTheme(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code.slice(5)),x=>x.charCodeAt(0)))));}
 catch{throw Error('Código de tema inválido ou corrompido');}
}
export function themeColor(theme,key){const hex=key==='secondary'?theme.backgroundStyle.secondary:theme[key];const alpha=theme.colorOpacity?.[key]??1;return alpha===1?hex:colorAlpha(hex,alpha);}
function colorAlpha(hex,alpha){
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 return 'rgba('+rgb.join(',')+','+alpha+')';
}
export function backgroundCSS(theme){
 const t=validateTheme(theme),b=t.backgroundStyle,c=themeColor(t,'background'),s=themeColor(t,'secondary'),p=b.patternSize,ink=colorAlpha(b.secondary,b.opacity*(t.colorOpacity.secondary??1));
 switch(b.kind){
 case 'mesh':return meshCSS(b.points,b.softness);
 case 'gradient':return 'linear-gradient('+b.angle+'deg,'+c+','+s+')';
 case 'radial':return 'radial-gradient(circle at '+b.radialX+'% '+b.radialY+'%,'+s+' 0%,'+c+' '+b.radialRadius+'%)';
 case 'dots':return 'radial-gradient(circle,'+ink+' 1px,transparent 1.5px)';
 case 'lines':return 'repeating-linear-gradient('+b.angle+'deg,transparent 0px,transparent '+(p-1)+'px,'+ink+' '+(p-1)+'px,'+ink+' '+p+'px)';
 case 'grid':return 'linear-gradient(90deg,'+ink+' 1px,transparent 1px),linear-gradient(0deg,'+ink+' 1px,transparent 1px)';
 case 'crosshatch':return 'repeating-linear-gradient(45deg,transparent 0px,transparent '+(p-1)+'px,'+ink+' '+(p-1)+'px,'+ink+' '+p+'px),repeating-linear-gradient(-45deg,transparent 0px,transparent '+(p-1)+'px,'+ink+' '+(p-1)+'px,'+ink+' '+p+'px)';
 case 'checker':return 'conic-gradient('+ink+' 25%,transparent 0% 50%,'+ink+' 0% 75%,transparent 0%)';
 default:return 'none';
 }
}
export function backgroundSize(theme){
 const b=validateTheme(theme).backgroundStyle;
 if(['dots','grid','checker'].includes(b.kind))return b.patternSize+'px '+b.patternSize+'px';
 return 'auto';
}
