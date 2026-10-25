import {defaults,validateTheme} from './resume-themes.js';
import {normalizeThemeLocks,contrastRatio} from './theme-explorer.js';

/**
 * mdress / Color-only Surprise.
 * Updates color tokens while preserving Markdown, type, paper, spacing,
 * background kind, mesh geometry, angle, pattern size, opacity and softness.
 * Curated palettes are local hex colors: no images, CSS injection or API calls.
 */
export const colorPalettes=Object.freeze([
 {id:'terracotta',name:'Terracota',background:'#fff8f2',text:'#352721',accent:'#a34226',secondary:'#f5dbca',mesh:['#f6d0b9','#ffe3d4','#eacfc5']},
 {id:'sea-glass',name:'Sea Glass',background:'#f3fcfa',text:'#1e3535',accent:'#196d6b',secondary:'#d0ede7',mesh:['#c9eae4','#d5f2e9','#d5e7f0']},
 {id:'iris',name:'Íris',background:'#faf7ff',text:'#302b44',accent:'#674ca5',secondary:'#e5d8fa',mesh:['#e4d5ff','#e7defa','#dbdefb']},
 {id:'citrus',name:'Citrus',background:'#fffcf0',text:'#38351c',accent:'#696600',secondary:'#f3e7ad',mesh:['#f3efbb','#e8eec7','#ffe9bf']},
 {id:'cobalt',name:'Cobalto',background:'#f5f8ff',text:'#1e2b43',accent:'#2959b2',secondary:'#d9e4ff',mesh:['#dbe6ff','#d0eaff','#e8defe']},
 {id:'rose',name:'Rosa Quartzo',background:'#fff7f9',text:'#412b35',accent:'#9a355c',secondary:'#f7d7e4',mesh:['#f8d5e0','#f7e7ee','#efdaea']},
 {id:'olive',name:'Oliva',background:'#fbfcf2',text:'#2b3322',accent:'#506b27',secondary:'#e0e9ce',mesh:['#dceaca','#e7eacb','#f1e5c8']},
 {id:'sky',name:'Céu Azul',background:'#f8fdff',text:'#243340',accent:'#1c6693',secondary:'#cceaf8',mesh:['#d2efff','#d6eaf9','#d9def9']},
 {id:'plum-dark',name:'Ameixa Noturna',background:'#1a1426',text:'#fbf2ff',accent:'#e5b5ff',secondary:'#332841',mesh:['#40304f','#3b2847','#2f3353']},
 {id:'midnight-blue',name:'Azul Profundo',background:'#0c1a30',text:'#eff8ff',accent:'#81d8f4',secondary:'#213951',mesh:['#203b57','#214861','#303a64']},
 {id:'black-gold',name:'Grafite & Ouro',background:'#171a1c',text:'#f8f2e8',accent:'#ffd290',secondary:'#303236',mesh:['#363636','#42372f','#2b3339']},
 {id:'forest-night',name:'Bosque Noturno',background:'#13261f',text:'#ecfff2',accent:'#96e7b4',secondary:'#25443a',mesh:['#28503e','#334b3e','#253b45']},
 {id:'indigo-neon',name:'Índigo Elétrico',background:'#101228',text:'#f4f2ff',accent:'#c3b5ff',secondary:'#303557',mesh:['#343866','#252f5b','#443766']},
 {id:'rust-night',name:'Cobre Noturno',background:'#2c1b1c',text:'#fff6ea',accent:'#ffbda0',secondary:'#523534',mesh:['#60393b','#533d39','#493443']},
 {id:'ink-light',name:'Tinta & Papel',background:'#ffffff',text:'#1a1d20',accent:'#424a55',secondary:'#e4e8ef',mesh:['#e7ebf3','#e7e6ed','#e2ebea']},
 {id:'sand-blue',name:'Areia & Azul',background:'#fbf5e8',text:'#292d2c',accent:'#305c72',secondary:'#e5ddcd',mesh:['#e7ded4','#e1e7dc','#d6e3ec']}
].map(p=>Object.freeze({...p,mesh:Object.freeze(p.mesh)})));

const validRandom=value=>{
 const r=typeof value==='function'?value():value;
 if(typeof r!=='number'||!Number.isFinite(r)||r<0||r>1)throw Error('Semente de cor inválida');
 return r;
};
const sameColors=(a,b)=>a.accent===b.accent&&a.text===b.text&&a.background===b.background&&
 a.backgroundStyle.secondary===b.backgroundStyle.secondary&&
 a.backgroundStyle.points.every((point,i)=>point.color===b.backgroundStyle.points[i]?.color);

/** Pure transformation: does not mutate the current document or theme. */
export function recolorTheme(theme=defaults,palette,locks={}){
 const old=validateTheme(theme);
 if(!palette||!colorPalettes.some(p=>p.id===palette.id))throw Error('Paleta desconhecida');
 const locked=normalizeThemeLocks(locks);
 const next={
  ...old,
  accent:locked.colors?old.accent:palette.accent,
  text:locked.colors?old.text:palette.text,
  background:locked.background?old.background:palette.background,
  backgroundStyle:locked.background?old.backgroundStyle:{
   ...old.backgroundStyle,
   secondary:palette.secondary,
   points:old.backgroundStyle.points.map((point,i)=>({
    ...point,color:palette.mesh[i%palette.mesh.length]
   }))
  }
 };
 // A palette that would compromise legibility isn't available with the
 // current combination of locked foreground/background values.
 if(contrastRatio(next.text,next.background)<4.5)return null;
 if(contrastRatio(next.accent,next.background)<3)return null;
 return validateTheme(next);
}

/** Deterministic/testable selection from compatible changed palettes. */
export function shuffleColors(theme=defaults,locks={},random=Math.random){
 const seed=validRandom(random),base=validateTheme(theme),locked=normalizeThemeLocks(locks);
 if(locked.colors&&locked.background)return base;
 const valid=colorPalettes.map(p=>recolorTheme(base,p,locked)).filter(p=>p!==null&&!sameColors(p,base));
 if(!valid.length)return base;
 return valid[Math.min(valid.length-1,Math.floor(seed*valid.length))];
}

/** Read-only palette preview values, for UI chips and "try another" feedback. */
export function colorPreview(theme){
 const t=validateTheme(theme);
 return Object.freeze({
  text:t.text,accent:t.accent,paper:t.background,
  secondary:t.backgroundStyle.secondary,
  mesh:t.backgroundStyle.kind==='mesh'?Object.freeze(t.backgroundStyle.points.map(p=>p.color)):[]
 });
}
