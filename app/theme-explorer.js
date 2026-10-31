import {BACKGROUND_KIND_COST} from './pdf-weight.js';
import {defaults,validateTheme,fontFamilies,fontCategory} from './resume-themes.js';
import {applyBackgroundPreset,getBackgroundPreset} from './background-presets.js';
/** Curated design recipes for ANY Markdown document. No external fonts or images. */
export const themeRecipes=Object.freeze([
 {id:'editorial-ivory',name:'Editorial Ivory',tag:'Editorial',font:'serif',size:11,accent:'#794e37',text:'#24201e',background:'#fdf9f1',backgroundPreset:'stripes',layout:{marginMm:21,lineHeight:1.55,titleScale:2.6,sectionGapEm:1.6,sectionRule:'line'}},
 {id:'modernist',name:'Modernist',tag:'Minimal',font:'system',size:10.5,accent:'#b12f31',text:'#13171c',background:'#ffffff',backgroundPreset:'clean',layout:{marginMm:19,lineHeight:1.4,titleScale:3.1,sectionGapEm:1.8,sectionRule:'none'}},
 {id:'technical-blue',name:'Technical Blue',tag:'Docs',font:'mono',size:10,accent:'#23628c',text:'#19232c',background:'#f8fbff',backgroundPreset:'dots',layout:{marginMm:17,lineHeight:1.55,titleScale:2.2,sectionGapEm:1.25,sectionRule:'line'}},
 {id:'forest-paper',name:'Forest Paper',tag:'Natural',font:'serif',size:11,accent:'#37624d',text:'#1a3328',background:'#f9faf4',backgroundPreset:'sage',layout:{marginMm:23,lineHeight:1.7,titleScale:2.4,sectionGapEm:1.8,sectionRule:'none'}},
 {id:'noir-copper',name:'Noir Copper',tag:'Dark',font:'system',size:10.5,accent:'#ffbe80',text:'#fff2e4',background:'#13151b',backgroundPreset:'night',layout:{marginMm:20,lineHeight:1.5,titleScale:2.5,sectionGapEm:1.5,sectionRule:'line'}},
 {id:'soft-studio',name:'Soft Studio',tag:'Mesh',font:'system',size:10.5,accent:'#515fc4',text:'#253047',background:'#fffaf7',backgroundPreset:'mesh-soft',layout:{marginMm:20,lineHeight:1.6,titleScale:2.6,sectionGapEm:1.4,sectionRule:'none'}},
 {id:'aurora-night',name:'Aurora Night',tag:'Mesh',font:'system',size:10,accent:'#b1a5ff',text:'#f3f6ff',background:'#0b1227',backgroundPreset:'mesh-aurora',layout:{marginMm:21,lineHeight:1.5,titleScale:2.6,sectionGapEm:1.55,sectionRule:'none'}},
 {id:'peach-note',name:'Peach Note',tag:'Gentle',font:'serif',size:11.5,accent:'#964765',text:'#352c38',background:'#fff7ec',backgroundPreset:'mesh-peach',layout:{marginMm:23,lineHeight:1.6,titleScale:2.7,sectionGapEm:1.8,sectionRule:'none'}},
 {id:'blueprint',name:'Blueprint',tag:'Creative',font:'mono',size:10,accent:'#75d6ff',text:'#f1f8ff',background:'#0b2940',backgroundPreset:'blueprint',layout:{marginMm:18,lineHeight:1.65,titleScale:2.2,sectionGapEm:1.3,sectionRule:'line'}},
 {id:'quiet-linen',name:'Quiet Linen',tag:'Classic',font:'serif',size:11,accent:'#796250',text:'#2a2723',background:'#fff9f1',backgroundPreset:'stripes',layout:{marginMm:24,lineHeight:1.7,titleScale:2.2,sectionGapEm:2,sectionRule:'none'}},
 {id:'clean-contrast',name:'Clear Contrast',tag:'Accessible',font:'system',size:11,accent:'#164f7a',text:'#17191c',background:'#ffffff',backgroundPreset:'clean',layout:{marginMm:19,lineHeight:1.6,titleScale:2.4,sectionGapEm:1.5,sectionRule:'line'}}
]);
export const lockGroups=Object.freeze(['colors','typography','spacing','background','sections']);
export function normalizeThemeLocks(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Travas inválidas');
 return Object.fromEntries(lockGroups.map(key=>[key,raw[key]===true]));
}
export function contrastRatio(foreground,background){
 const luminance=h=>{
  const c=[1,3,5].map(n=>parseInt(h.slice(n,n+2),16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
  return .2126*c[0]+.7152*c[1]+.0722*c[2];
 };
 if(!/^#[a-f0-9]{6}$/i.test(foreground)||!/^#[a-f0-9]{6}$/i.test(background))throw Error('Cor inválida');
 const [hi,lo]=[luminance(foreground),luminance(background)].sort((a,b)=>b-a);
 return (hi+.05)/(lo+.05);
}
export function recipeTheme(recipeOrId,base=defaults,locks={}){
 const item=typeof recipeOrId==='string'?themeRecipes.find(r=>r.id===recipeOrId):recipeOrId;
 if(!item)throw Error('Receita desconhecida');
 const current=validateTheme(base),locked=normalizeThemeLocks(locks);
 const preset=getBackgroundPreset(item.backgroundPreset);
 const bg=applyBackgroundPreset(current,preset);
 const out={...current};
 if(!locked.background){out.background=bg.background;out.backgroundStyle=bg.backgroundStyle;}
 if(!locked.colors){out.accent=item.accent;out.text=item.text;}
 if(!locked.typography){out.font=item.font;out.size=item.size;}
 const layout={...out.layout};
 if(!locked.spacing){
  layout.marginMm=item.layout.marginMm;layout.lineHeight=item.layout.lineHeight;
  layout.sectionGapEm=item.layout.sectionGapEm;
 }
 if(!locked.typography){layout.titleScale=item.layout.titleScale;layout.sectionRule=item.layout.sectionRule;}
 out.layout=layout;
 // Never silently produce white-on-white or dark-on-dark when a neighboring
 // group is locked. Keep the original foreground if no recipe is compatible.
 if(contrastRatio(out.text,out.background)<4.5){
  if(!locked.colors){
   const candidates=['#151a20','#ffffff','#f9fbff','#17191c'];
   out.text=candidates.find(c=>contrastRatio(c,out.background)>=7)??current.text;
  }
  if(contrastRatio(out.text,out.background)<4.5){
   if(!locked.background){out.background=current.background;out.backgroundStyle=current.backgroundStyle;}
   if(contrastRatio(out.text,out.background)<4.5)out.text=current.text;
  }
 }
 return validateTheme(out);
}
export function shuffleTheme(base=defaults,locks={},random=Math.random){
 const r=typeof random==='function'?random():random;
 if(!Number.isFinite(r)||r<0||r>1)throw Error('Semente inválida');
 const locked=normalizeThemeLocks(locks),old=validateTheme(base);
 const options=themeRecipes.map(item=>recipeTheme(item,old,locked));
 const changed=options.filter(next=>JSON.stringify(next)!==JSON.stringify(old));
 if(!changed.length)return old;
 const maxCost=Math.max(...changed.map(o=>BACKGROUND_KIND_COST[o.backgroundStyle.kind]??0));
 const lighter=changed.filter(o=>(BACKGROUND_KIND_COST[o.backgroundStyle.kind]??0)<maxCost);
 const pool=lighter.length?lighter:changed;
 const pick=pool[Math.min(pool.length-1,Math.floor(r*pool.length))];
 // A recipe defines the direction; independent parameter offsets give each draw variation.
 // Use a deterministic fractional mixer for reproducible tests and one entropy sample.
 const mix=x=>{const t=Math.sin((r+0.001)*12345.678+x*78.233)*43758.5453;return t-Math.floor(t);};
 const out={...pick,layout:{...pick.layout}};
 if(!locked.typography){
  const family=fontCategory(pick.font);
  const familyFonts=fontFamilies[family].map(item=>item.id);
  out.font=familyFonts[Math.min(familyFonts.length-1,Math.floor(mix(8)*familyFonts.length))];
  out.size=Math.max(9,Math.min(14,Math.round((pick.size+(mix(1)-.5)*2)*4)/4));
  out.layout.titleScale=Math.round(Math.max(1.4,Math.min(3.4,pick.layout.titleScale+(mix(2)-.5)*.8))*100)/100;
 }
 if(!locked.spacing){
  out.layout.marginMm=Math.round(Math.max(8,Math.min(35,pick.layout.marginMm+(mix(3)-.5)*9))*10)/10;
  out.layout.lineHeight=Math.round(Math.max(1.1,Math.min(2,pick.layout.lineHeight+(mix(4)-.5)*.33))*100)/100;
  out.layout.sectionGapEm=Math.round(Math.max(.7,Math.min(3,pick.layout.sectionGapEm+(mix(5)-.5)*.9))*100)/100;
 }
 if(!locked.background&&pick.backgroundStyle.kind!=='solid'&&pick.backgroundStyle.kind!=='none'){
  out.backgroundStyle={...pick.backgroundStyle,
   angle:Math.round((pick.backgroundStyle.angle+mix(6)*100)%360),
   opacity:Math.round(Math.max(.02,Math.min(.6,pick.backgroundStyle.opacity*(.76+mix(7)*.45)))*100)/100};
 }
 return validateTheme(out);
}
