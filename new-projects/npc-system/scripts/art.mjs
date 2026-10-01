import {writeFileSync,mkdirSync} from 'node:fs';
const out=new URL('../web/assets/',import.meta.url);mkdirSync(out,{recursive:true});
const S=19,T=9.5,ox=430,oy=165;
const pt=(x,y,z=0)=>[ox+(x-y)*S,oy+(x+y)*T-z*18];
let objects=[];
const poly=(p,c,o='')=>'<polygon points="'+p.map(v=>v.join(',')).join(' ')+'" fill="'+c+'" '+o+'/>';
function box(x,y,z,w,d,h,colors){
 let a=pt(x,y,z+h),b=pt(x+w,y,z+h),c=pt(x+w,y+d,z+h),e=pt(x,y+d,z+h);
 let aa=pt(x,y,z),bb=pt(x+w,y,z),cc=pt(x+w,y+d,z);
 return poly([b,c,cc,bb],colors[2])+poly([e,c,cc,pt(x,y+d,z)],colors[1])+poly([a,b,c,e],colors[0]);
}
const mats={grass:['#879379','#576d5e','#667c68'],rock:['#919788','#5b716f','#71847c'],wood:['#b7a27d','#685e51','#8a775e'],stone:['#b5b8a7','#717e79','#929b8e'],roof:['#8c7561','#4f5653','#6d665a']};
function add(x,y,z,w,d,h,m){objects.push({depth:x+y+w+d,svg:box(x,y,z,w,d,h,typeof m==='string'?mats[m]:m)});}
// Terraced island, hand-composed grid. The shapes are original vector artwork.
for(let y=0;y<17;y++)for(let x=0;x<20;x++){
 const ell=((x-10)/10)**2+((y-8)/8.3)**2;
 if(ell<1 && !(x>14&&y>11)){
  let z=1.2;
  add(x,y,0,1,1,z,'rock');
  const colors=(x+y)%7===0?['#929b7a','#576d5e','#667c68']:mats.grass;
  add(x,y,z,1,1,.25,colors);
 }
}
// Walking path and timber pier.
for(let x=3;x<=16;x++)add(x,10,1.46,1,1,.06,['#b7b29a','#8b8d78','#969983']);
for(let y=4;y<=14;y++)add(12,y,1.47,1,1,.06,['#b7b29a','#8b8d78','#969983']);
for(let x=8;x<19;x++)for(let y=15;y<17;y++)add(x,y,1.05,1,.95,.2,'wood');
for(let x of [8,12,16,18])for(let y of [15,17])add(x,y,0,.22,.22,1.5,'wood');
// Buildings: workshop with weathered block roof, windows and chimney.
add(4,6,1.5,5,4,3,'stone');
for(let k=0;k<3;k++)add(3.7+k*.55,5.7+k*.6,4.5+k*.48,5.6-k*1.1,4.6-k*1.2,.5,'roof');
add(7.4,6.4,5.2,.65,.65,1.3,'stone');
add(4.9,9.97,1.5,1,0.09,1.8,'wood');
add(7,9.97,3,1,.08,.8,['#d0b985','#907b56','#d0b985']);
add(8.97,7.5,3,.08,1,.8,['#d0b985','#d0b985','#d0b985']);
// Signal tower on the eastern ridge.
add(13,4,1.5,3.3,3.3,.5,'stone');
add(13.5,4.5,2,2.3,2.3,5.2,'stone');
for(let z of [3,5])add(13.45,4.45,z,2.4,2.4,.2,['#c3c2ae','#7c8780','#9b9e90']);
add(13.15,4.15,7.2,3,3,.3,'wood');
add(13.5,4.5,7.5,2.3,2.3,1.4,['#c5b580','#867e5a','#a49b6d']);
add(13.05,4.05,8.9,3.2,3.2,.35,'roof');
add(13.4,4.4,9.25,2.5,2.5,.35,'roof');
add(13.8,4.8,9.6,1.7,1.7,.35,'roof');
const light=pt(14.7,6.5,8.25);
// Trees, including distinct trunks and three-tier block foliage.
for(const [x,y,h] of [[2,5,4],[2,8,3.2],[6,2,4.5],[9,1,3.5],[17,6,4.4],[18,9,3.4],[4,13,3.8],[6,14,3],[10,4,3]]){
 add(x+.35,y+.35,1.5,.35,.35,h*.8,'wood');
 const f=['#708574','#3c5c50','#4d6d5c'];
 for(let k=0;k<3;k++){let w=2.3-k*.5;add(x-(w-1)/2,y-(w-1)/2,2.1+k*.85,w,w,.9,f);}
}
// Quayside cargo.
for(const [x,y] of [[9,13],[10,13],[7.9,11],[15,13]]){add(x,y,1.5,.85,.85,.85,'wood');add(x+.06,y+.06,2.35,.72,.72,.05,['#c8b790','#9d8c6c','#ae9c76']);}
// Three voxel citizens and a traveller, authored independently from Minecraft skins.
function person(x,y,color,hair){
 add(x,y,1.5,.26,.36,.85,['#4d5753','#3d4744','#49534f']);
 add(x+.34,y,1.5,.26,.36,.85,['#4d5753','#3d4744','#49534f']);
 add(x-.1,y-.04,2.3,.82,.45,.85,[color,color,color]);
 add(x+.1,y-.02,3.15,.45,.42,.5,['#d9b68e','#b9906d','#c9a57e']);
 add(x+.07,y-.05,3.6,.5,.48,.14,[hair,hair,hair]);
}
person(11,13,'#768f8c','#c9c4ac');person(8,10,'#b69369','#665647');person(13,8,'#a5a895','#685d4e');
person(10,11,'#57706c','#403f38');
objects.sort((a,b)=>a.depth-b.depth);
let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 80 690 460"><defs><radialGradient id="sea"><stop stop-color="#345962"/><stop offset="1" stop-color="#203f4a"/></radialGradient></defs><rect width="860" height="560" fill="#203f4a"/>';
// Fine water ripples with a fixed deterministic rhythm.
for(let i=0;i<95;i++){let x=(i*137+37)%850,y=(i*73+29)%550;svg+='<path d="M'+x+' '+y+'l24 -4 15 1" stroke="#8aa4a2" stroke-width="1" opacity=".14" fill="none"/>';}
svg+='<ellipse cx="437" cy="355" rx="291" ry="117" fill="#122f3a" opacity=".3"/>'+objects.map(o=>o.svg).join('');
svg+='<circle cx="'+light[0]+'" cy="'+light[1]+'" r="10" fill="#edca82" opacity=".5"/><path d="M'+(light[0]-4)+' '+light[1]+'h8v7h-8z" fill="#ffe4a3"/>';
// Small sailboat on open water.
svg+='<g transform="translate(685 420)"><path d="M-35 0L0 16 42 -2 24 14 -2 25 -29 12Z" fill="#9c8a6d"/><path d="M0 -64V12" stroke="#b3a27e" stroke-width="3"/><path d="M-3 -62L-3 3 -32 -7Z" fill="#d8d6bd"/><path d="M4 -50L4 0 30 -9Z" fill="#b6c2b1"/></g>';
svg+='</svg>';writeFileSync(new URL('harbor.svg',out),svg);
for(const [name,coat,hair] of [['mara','#7f9693','#c5c1aa'],['lev','#bc966c','#6b5948'],['nika','#a9ac96','#74644e']]){
 let s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#e3dfd0"/><path d="M12 64V44H22V39H42V44H52V64Z" fill="'+coat+'"/><path d="M22 17H42V40H22Z" fill="#c99d78"/><path d="M18 15H45V22H18ZM18 22H23V31H18Z" fill="'+hair+'"/><path d="M25 27H28V30H25ZM36 27H39V30H36Z" fill="#3b4843"/><path d="M29 34H36V36H29Z" fill="#a47858"/><path d="M29 46H35V64H29Z" fill="#ede6cc"/></svg>';
 writeFileSync(new URL(name+'.svg',out),s);
}
console.log('Created original harbor diorama and three portraits');


