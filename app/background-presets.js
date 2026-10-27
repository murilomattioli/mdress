
/** Built-in curated background recipes. No remote images or executable CSS accepted. */
export const backgroundPresets=Object.freeze([
 {id:'clean',name:'Papel limpo',group:'Sólidos',background:'#ffffff',text:'#18202b',accent:'#235b82',secondary:'#f0f3f7',kind:'solid',opacity:0.12,angle:135,patternSize:18},
 {id:'night',name:'Midnight OLED',group:'Sólidos',background:'#05070c',text:'#f3f7ff',accent:'#77d9f5',secondary:'#5da8c1',kind:'solid',opacity:0.15,angle:135,patternSize:18},
 {id:'pearl',name:'Pearl Fade',group:'Gradientes',background:'#ffffff',text:'#283043',accent:'#4f6e9c',secondary:'#dce9fd',kind:'gradient',opacity:0.2,angle:135,patternSize:18},
 {id:'dusk',name:'Dusk Ink',group:'Gradientes',background:'#131b35',text:'#f9f6ff',accent:'#ffcb9a',secondary:'#39264b',kind:'gradient',opacity:0.3,angle:145,patternSize:18},
 {id:'sage',name:'Soft Sage',group:'Gradientes',background:'#f9faf4',text:'#293b30',accent:'#3e7156',secondary:'#e3eee3',kind:'gradient',opacity:0.2,angle:160,patternSize:18},
 {id:'spotlight',name:'Spotlight',group:'Gradientes',background:'#111624',text:'#f8fbff',accent:'#9fc3ff',secondary:'#536585',kind:'radial',opacity:0.45,angle:120,patternSize:18},
 {id:'dots',name:'Pontos discretos',group:'Padrões',background:'#ffffff',text:'#222b35',accent:'#235b82',secondary:'#406484',kind:'dots',opacity:0.18,angle:135,patternSize:18},
 {id:'blueprint',name:'Blueprint',group:'Padrões',background:'#0b2940',text:'#f1f8ff',accent:'#75d6ff',secondary:'#8ec3dc',kind:'grid',opacity:0.15,angle:90,patternSize:20},
 {id:'stripes',name:'Pinstripe',group:'Padrões',background:'#fff9f1',text:'#392d2a',accent:'#a25a42',secondary:'#9e6a53',kind:'lines',opacity:0.15,angle:90,patternSize:20},
 {id:'cross',name:'Crosshatch',group:'Padrões',background:'#f7f8fb',text:'#252a3a',accent:'#665ca8',secondary:'#6d74a4',kind:'crosshatch',opacity:0.14,angle:45,patternSize:22},

 {id:'mesh-soft',name:'Soft Mesh',group:'Mesh',background:'#fffaf7',text:'#253047',accent:'#515fc4',secondary:'#c8bfea',kind:'mesh',opacity:0.12,angle:130,patternSize:22,softness:88,points:[
  {color:'#a9cfff',x:12,y:8,radius:80,strength:0.88},{color:'#edb8d7',x:86,y:26,radius:75,strength:0.82},{color:'#c4eed2',x:51,y:88,radius:85,strength:0.77}]},
 {id:'mesh-aurora',name:'Aurora Glow',group:'Mesh',background:'#0b1227',text:'#f3f6ff',accent:'#b1a5ff',secondary:'#5269c9',kind:'mesh',opacity:0.2,angle:125,patternSize:22,softness:86,points:[
  {color:'#8b54d7',x:20,y:15,radius:76,strength:0.65},{color:'#217eaa',x:91,y:51,radius:80,strength:0.68},{color:'#366bc2',x:37,y:92,radius:81,strength:0.62}]},
 {id:'mesh-peach',name:'Peach Mist',group:'Mesh',background:'#fff7ec',text:'#352c38',accent:'#a04a6b',secondary:'#f0be9f',kind:'mesh',opacity:0.2,angle:150,patternSize:22,softness:95,points:[
  {color:'#ffd29c',x:9,y:8,radius:84,strength:0.85},{color:'#f7a6aa',x:87,y:40,radius:71,strength:0.75},{color:'#c9b8ff',x:47,y:94,radius:86,strength:0.75}]},
 {id:'mesh-mint',name:'Mint Cloud',group:'Mesh',background:'#f9fff9',text:'#203b37',accent:'#317569',secondary:'#a8e6d7',kind:'mesh',opacity:0.18,angle:120,patternSize:20,softness:92,points:[
  {color:'#9ce9c9',x:12,y:75,radius:90,strength:0.92},{color:'#c2d7ff',x:78,y:7,radius:75,strength:0.7},{color:'#ecf4c5',x:84,y:90,radius:75,strength:0.77}]},
  {id:'checker',name:'Micro checker',group:'Padrões',background:'#ffffff',text:'#292b34',accent:'#435a80',secondary:'#6c7891',kind:'checker',opacity:0.08,angle:90,patternSize:16}
]);
export function getBackgroundPreset(id){return backgroundPresets.find(p=>p.id===id)||null;}
export function applyBackgroundPreset(theme,preset){
 if(!preset)throw Error('Background não encontrado');
 return {...theme,background:preset.background,text:preset.text,accent:preset.accent,backgroundStyle:{kind:preset.kind,secondary:preset.secondary,angle:preset.angle,patternSize:preset.patternSize,opacity:preset.opacity,softness:preset.softness??80,points:preset.points??[]}};
}
