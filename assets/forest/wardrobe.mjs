import * as T from '/vendor/three/three.module.min.js';
import { clone as cloneRig } from '/vendor/three/addons/utils/SkeletonUtils.js';

export const colors={
  mint:{label:'Menta',cloth:'#37b686',sleeve:'#7fdfad'},
  sun:{label:'Sol',cloth:'#ffb72e',sleeve:'#ffe079'},
  sky:{label:'Azul',cloth:'#477de0',sleeve:'#80aefa'},
};
const equipment={ hat:/^Hat(?:_|$)/,cape:/^Cape(?:_|$)/,buddy:/^Buddy_scarf(?:_|$)/ };

export function worn(economy,slot) {
  return economy.inventory.includes(slot)&&economy.avatar[slot]===slot;
}

export function applyOutfit(player,pipo,economy) {
  const dye=colors[economy.avatar.color]??colors.mint;
  player.traverse(o=>{
    if(!o.isMesh)return;
    if(equipment.hat.test(o.name))o.visible=worn(economy,'hat');
    if(equipment.cape.test(o.name))o.visible=worn(economy,'cape');
    if(o.name==='Surface_Tunica')o.material.color.set(dye.cloth);
    if(o.name==='Surface_Manga')o.material.color.set(dye.sleeve);
  });
  pipo.traverse(o=>{
    if(o.isMesh&&equipment.buddy.test(o.name))o.visible=worn(economy,'buddy');
  });
}

export function outfitDiagnostics(player,pipo) {
  function pieces(root,pattern){
    const meshes=[];
    root?.traverse(o=>{if(o.isMesh&&pattern.test(o.name)&&o.visible)meshes.push(o.name);});
    return meshes;
  }
  return {
    shirt:player?.getObjectByName('Surface_Tunica')?.material.color.getHexString()??null,
    sleeves:player?.getObjectByName('Surface_Manga')?.material.color.getHexString()??null,
    hat:pieces(player,equipment.hat),cape:pieces(player,equipment.cape),buddy:pieces(pipo,equipment.buddy),
  };
}

export function drawOutfit(renderer,canvas,player,pipo,back) {
  const scene=new T.Scene();
  scene.background=new T.Color('#deece1');
  scene.add(new T.HemisphereLight('#fff5e1','#9eb7ac',2.05));
  const lamp=new T.DirectionalLight('#fff1d6',1.40);
  lamp.position.set(-2,4,3);
  scene.add(lamp);
  const hero=cloneRig(player.children[0]), buddy=cloneRig(pipo.children[0]);
  hero.position.set(-.47,0,0);
  hero.rotation.y=back?2.73:.22;
  buddy.position.set(.74,0,0);
  buddy.rotation.y=-.25;
  scene.add(hero,buddy);
  const skeletons=new Set();
  scene.traverse(o=>{
    if(o.isSkinnedMesh)skeletons.add(o.skeleton);
    if(/^Blink_/.test(o.name))o.visible=true;
  });
  skeletons.forEach(skeleton=>skeleton.pose());
  const camera=new T.OrthographicCamera(-2,2,1.19,-1.19,.1,20);
  camera.position.set(0,2.05,6);
  camera.lookAt(0,1.14,0);
  const {width,height}=canvas;
  const target=new T.WebGLRenderTarget(width,height,{colorSpace:T.SRGBColorSpace});
  const previous=renderer.getRenderTarget();
  try{
    renderer.setRenderTarget(target);
    renderer.render(scene,camera);
    const pixels=new Uint8Array(width*height*4);
    renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
    const context=canvas.getContext('2d');
    const image=context.createImageData(width,height);
    const row=width*4;
    for(let y=0;y<height;y++)image.data.set(pixels.subarray(y*row,(y+1)*row),(height-1-y)*row);
    context.putImageData(image,0,0);
  }finally{
    renderer.setRenderTarget(previous);
    target.dispose();
    skeletons.forEach(skeleton=>skeleton.dispose());
  }
}

export function portrait(economy) {
  const dye=colors[economy.avatar.color]??colors.mint;
  return `<svg viewBox="0 0 320 154" role="img" aria-label="Prévia de Davi e Pipo">
  <rect width="320" height="154" rx="13" fill="#deece1"/>
  ${worn(economy,'cape')?'<path d="M99 76Q120 63 144 76L164 134Q122 148 82 134Z" fill="#916bb9"/>':''}
  <path d="M102 116h40v21h-40Z" fill="#5d596f"/>
  <path d="M109 84Q122 76 135 84L145 120H98Z" fill="${dye.cloth}"/>
  <ellipse cx="99" cy="96" rx="9" ry="11" fill="${dye.sleeve}"/><ellipse cx="143" cy="96" rx="9" ry="11" fill="${dye.sleeve}"/>
  <circle cx="122" cy="60" r="32" fill="#f1ba8b"/>
  <path d="M90 57Q88 19 124 23Q151 24 154 54Q141 46 135 34Q119 61 90 57Z" fill="#563726"/>
  <circle cx="111" cy="63" r="5" fill="#21464b"/><circle cx="134" cy="63" r="5" fill="#21464b"/>
  <path d="M116 75q6 7 12 0" stroke="#804f46" fill="none" stroke-linecap="round" stroke-width="2"/>
  ${worn(economy,'hat')?'<path d="M96 42l8-26q20-13 39 2l6 23 14 5q-39 11-79 0Z" fill="#daa951"/><path d="M97 40h51l2 5H95Z" fill="#735547"/>':''}
  <ellipse cx="223" cy="115" rx="21" ry="21" fill="#55b7ab"/>
  <path d="M222 82v-13" stroke="#a97647" stroke-width="4"/><circle cx="222" cy="67" r="5" fill="#e5b24a"/>
  <ellipse cx="223" cy="100" rx="28" ry="23" fill="#f6e6bb"/>
  <path d="M198 98h50q-1 21-25 21t-25-21" fill="#173d42"/>
  <circle cx="214" cy="106" r="4" fill="#c3ffe5"/><circle cx="232" cy="106" r="4" fill="#c3ffe5"/>
  ${worn(economy,'buddy')?'<path d="M204 119q20 6 38-1l-1 8 6 12-11 2-5-11q-16 2-27-3Z" fill="#e77a4d"/>':''}
  </svg>`;
}
