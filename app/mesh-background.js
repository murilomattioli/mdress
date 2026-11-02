/** Printable static multi-point mesh. Only typed stops; never URLs or arbitrary CSS. */
export const meshSeed=Object.freeze([
 {color:'#9db9ff',x:10,y:12,radius:78,strength:0.8},
 {color:'#f7aeca',x:88,y:22,radius:78,strength:0.75},
 {color:'#bdebd6',x:52,y:87,radius:78,strength:0.8}
]);
const hex=/^#[0-9a-f]{6}$/i;
const within=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export function validateMeshPoints(points,required=false){
 if(!Array.isArray(points)||points.length>6||(required&&points.length<2))throw Error('Mesh exige entre 2 e 6 pontos');
 return points.map(point=>{
  if(!point||typeof point!=='object'||Array.isArray(point)||Object.keys(point).some(k=>!['color','x','y','radius','strength','opacity'].includes(k)))throw Error('Ponto mesh inválido');
  if(typeof point.color!=='string'||!hex.test(point.color)||!within(point.x,0,100)||!within(point.y,0,100)||!within(point.radius,15,120)||!within(point.strength,0.05,1))throw Error('Propriedades do ponto mesh inválidas');
  if(point.opacity!==undefined&&!within(point.opacity,0,1))throw Error('Opacidade mesh inválida');
  return {...point};
 });
}
export function meshCSS(points,softness=80){
 const arr=validateMeshPoints(points,true);
 if(!within(softness,0,100))throw Error('Suavidade inválida');
 const inner=Math.round((1-softness/100)*35);
 return arr.map(({color,x,y,radius,strength,opacity=1})=>{
  strength*=opacity;
  const r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),b=parseInt(color.slice(5,7),16);
  return 'radial-gradient(ellipse '+radius+'% '+radius+'% at '+x+'% '+y+'%,rgba('+r+','+g+','+b+','+strength+') '+inner+'%,rgba('+r+','+g+','+b+',0) 100%)';
 }).reverse().join(',');
}
