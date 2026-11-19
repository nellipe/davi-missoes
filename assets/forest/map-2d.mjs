import { boatProgress } from './boat.mjs';
import { colors, worn } from './wardrobe.mjs';
import { recanto } from './recanto.mjs';

const COLORS = ['#ddc299','#a77655','#cfceae','#a98262','#bfc4a7','#b9ad91','#d2966d','#e3d9ab','#d4c394'];
const esc = (value) => String(value).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

export function floorPath(bounds,{rows,cell},kind) {
  const [xmin,,zmin]=bounds;
  let path='';
  rows.forEach((row,j)=>{
    for(let i=0;i<row.length;){
      if(row[i]!==kind){i++;continue;}
      const start=i;
      while(row[i]===kind)i++;
      const length=(i-start)*cell;
      path+=`M${xmin+start*cell} ${zmin+j*cell}h${length}v${cell}h-${length}z`;
    }
  });
  return path;
}

export function createViewport() {
  let svg;
  let view=[-8,0,16,16];
  return {
    attach(canvas){svg=canvas;},
    center(player){
      const width=svg.clientWidth,height=svg.clientHeight;
      if(!width||!height)return false;
      const w=width<640?14:25,h=w*height/width;
      view=[player.x-w/2,player.z-h*.53,w,h];
      svg.setAttribute('viewBox',view.join(' '));
      return true;
    },
    ndc(x,z){return {x:2*(x-view[0])/view[2]-1,y:1-2*(z-view[1])/view[3],z:0};},
    project(x,z){
      const p=this.ndc(x,z),rect=svg.getBoundingClientRect();
      const visible=Math.abs(p.x)<1&&Math.abs(p.y)<1;
      return {x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2,visible,groundVisible:visible};
    },
    point(x,y){
      const rect=svg.getBoundingClientRect();
      return {x:view[0]+(x-rect.x)*view[2]/rect.width,z:view[1]+(y-rect.y)*view[3]/rect.height};
    },
  };
}

export const actorSymbols=`
  <g id="forest2dPipo"><circle r=".36" fill="#75d5ba" stroke="#24473e" stroke-width=".06"/><circle cy="-.08" r=".17" fill="#f6dda5"/><path data-accessory="buddy" d="M-.34 .12Q0 .28.34 .12l-.02 .14-.13 .01 .09 .20-.14 .04-.08-.22Q-.12 .34-.28 .25Z" fill="#e77a4d"/></g>
  <g id="forest2dDavi"><path data-accessory="cape" d="M-.23-.05h.46L.53 .49Q0 .66-.53 .49Z" fill="#a486ce" stroke="#e6d0ee" stroke-width=".07"/><circle data-clothes r=".46" fill="#255b64" stroke="#f8e1ae" stroke-width=".11"/><circle cy="-.11" r=".28" fill="#efbf89"/><path d="M-.3-.15Q-.26-.5.23-.35L.3-.1Z" fill="#483024"/><path data-accessory="hat" d="M-.25-.29L-.19-.53Q0-.65.2-.53l.05 .24.13 .05Q0-.14-.38-.24Z" fill="#e2ad5f" stroke="#805541" stroke-width=".06"/></g>`;

export function mapActors(svg){
  const davi=svg.querySelector('#forest2dDavi'),pipo=svg.querySelector('#forest2dPipo');
  const clothes=svg.querySelector('[data-clothes]'),accessories=svg.querySelectorAll('[data-accessory]');
  let avatar;
  return (player,buddy,economy,scale)=>{
    davi.setAttribute('transform',`translate(${player.x} ${player.z})`);
    pipo.setAttribute('transform',`translate(${buddy.x} ${buddy.z}) scale(${scale})`);
    if(avatar!==economy.avatar){
      avatar=economy.avatar;
      clothes.setAttribute('fill',(colors[avatar.color]??colors.mint).cloth);
      for(const mark of accessories)mark.setAttribute('visibility',worn(economy,mark.dataset.accessory)?'visible':'hidden');
    }
  };
}

export function createMap() {
  let svg, actors, shelter, beetle, bridge, ownedMarks, boats, controlledSolids;
  let inventory;
  const release={wheel:null,source:null};
  const viewport=createViewport();
  return {
    ...viewport,
    mount(canvas,data,features) {
      svg=canvas;
      viewport.attach(canvas);
      const {trailOffset,connection}=data.map;
      const lines=data.layout.paths.slice(0,-1).map((path,i)=>({...path,color:COLORS[i], offset:trailOffset}));
      lines.push({...connection,color:COLORS[8],offset:0});
      const routes=lines.map(({points,width,color,offset})=>{
        const coords=points.map(([x,z])=>[x+offset,z].join(',')).join(' ');
        return `<polyline points="${coords}" stroke="#477963" stroke-width="${width*2+1.15}"/><polyline points="${coords}" stroke="${color}" stroke-width="${width*2}"/>`;
      }).join('');
      const circles=data.layout.clearings.map(([x,z,r])=>`<circle cx="${x+trailOffset}" cy="${z}" r="${r}" fill="#c7b28b"/>`).join('');
      svg.innerHTML=`
        <rect x="-60" y="-65" width="170" height="140" fill="#416d59"/>
        <path d="M-18 -2 Q-10 0 0 -2 T17.2 -2 M17.2 -14V3.1" fill="none" stroke="#4a9e9b" stroke-width="2.1"/>
        <path d="${floorPath(data.map.bounds,data.collision,'1')}" fill="#8ea975"/>
        <path d="${floorPath(data.map.bounds,data.collision,'3')}" fill="#829472"/>
        <path d="M-4 7 Q3 4 10 6" fill="none" stroke="#d5c196" stroke-width="2.1"/>
        <g stroke-linecap="round" stroke-linejoin="round" fill="none">${routes}</g>
        ${circles}
        <path id="forest2dBridge" d="M0 -5.5V1.4" fill="none" stroke="#9b714f" stroke-width="1.8"/>
        <g aria-hidden="true">${data.collision.solids.map(([name,vertices,owner])=>
          `<polygon points="${vertices.map(p=>p.join(',')).join(' ')}" fill="${/Tronco|oak|trunk/i.test(name)?'#856743':/Ard|Seixo|Pedra|landmark|ledge/i.test(name)?'#89908b':'#ad8159'}" stroke="#455945" stroke-width=".08"${owner?` data-solid-owner="${owner}"`:''}/>`
        ).join('')}</g>
        <g transform="translate(${trailOffset} 0)">
          <path d="M-1.38 10.36v3.31 M18.9 -6.13Q17 -8.4 11.38 -10.04" fill="none" stroke="#5ab8ae" stroke-width=".42"/>
          <path data-boat="wheel" d="M0 -.32Q.40 -.03 0 .28Q-.40 -.03 0 -.32Z" fill="#ffd477" stroke="#76523c" stroke-width=".06"/>
          <path data-boat="source" d="M0 -.32Q.40 -.03 0 .28Q-.40 -.03 0 -.32Z" fill="#ffd477" stroke="#76523c" stroke-width=".06"/>
        </g>
        <g id="forest2dShelter" transform="translate(${trailOffset+recanto.leaf[0]} ${recanto.leaf[1]})">
          ${recanto.basins.map(([x,z])=>`<ellipse cx="${x}" cy="${z}" rx=".5" ry=".27" fill="#78634b"/>`).join('')}
          <path d="M0 .64Q-1 .02 0 -.74Q1 .02 0 .64Z" fill="#72c45a" stroke="#3c7246" stroke-width=".10"/>
          <g id="forest2dWet"><ellipse rx=".35" ry=".18" fill="#5ac9c7"/></g>
          <g id="forest2dBeetle"><ellipse rx=".18" ry=".27" fill="#da9552" stroke="#553345" stroke-width=".10"/><circle cy=".19" r=".11" fill="#553345"/></g>
        </g>
        <g transform="translate(${trailOffset+recanto.log[0]+1.9*Math.sin(recanto.openingYaw)} ${recanto.log[1]+1.9*Math.cos(recanto.openingYaw)})">
          <path d="M-.31 .05L-.39 -.14l.15 .03.02-.23.15 .14.12-.22.10 .19.19-.09-.05 .23.14 .01-.09 .17z" fill="#824c34"/>
          <ellipse cy=".1" rx=".26" ry=".19" fill="#ffd8a0"/><circle cy=".25" r=".055" fill="#34264a"/>
        </g>
        ${features.map(f=>`<g transform="translate(${f.x} ${f.z})" ${['house','portal'].includes(f.id)?`data-owned-mark="${f.id}"`:''}><circle r=".62" fill="#314e45" stroke="#f5e5ae" stroke-width=".07"/><text y=".25" text-anchor="middle" font-size=".78" fill="#ffebbf">${esc(f.icon)}</text></g>`).join('')}
        ${actorSymbols}`;
      actors=mapActors(svg);
      shelter=svg.querySelector('#forest2dWet');
      beetle=svg.querySelector('#forest2dBeetle');
      bridge=svg.querySelector('#forest2dBridge');
      ownedMarks=svg.querySelectorAll('[data-owned-mark]');
      boats=Array.from(svg.querySelectorAll('[data-boat]'));
      controlledSolids=svg.querySelectorAll('[data-solid-owner]');
    },
    interact(id,time) {
      if(Object.hasOwn(release,id))release[id]=time;
    },
    draw(player,buddy,data,time=0,still=false,buddyScale=1) {
      if(!viewport.center(player))return;
      actors(player,buddy,data.economy,buddyScale);
      for(const boat of boats){
        const id=boat.dataset.boat,p=boatProgress(time,release[id],still,id==='wheel'?3.6:4.5);
        const [x,z]=id==='wheel'?[-1.38,10.36+3.31*p]:[18.9-7.52*p,-6.13-3.91*p];
        boat.setAttribute('transform',`translate(${x} ${z})`);
      }
      bridge.style.visibility=data.economy.inventory.includes('bridge')?'visible':'hidden';
      const basin=data.leaf_up?0:1;
      shelter.setAttribute('transform',`translate(${recanto.basins[basin].join(' ')})`);
      beetle.setAttribute('transform',`translate(${recanto.shelters[basin].join(' ')})`);
      for(const mark of ownedMarks)
        mark.setAttribute('opacity',data.economy.inventory.includes(mark.dataset.ownedMark)?1:.65);
      if(inventory!==data.economy.inventory){
        inventory=data.economy.inventory;
        for(const solid of controlledSolids)
          solid.setAttribute('visibility',inventory.includes(solid.dataset.solidOwner)?'visible':'hidden');
      }
    },
  };
}
