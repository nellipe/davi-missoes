const COLORS = ['#ddc299','#a77655','#cfceae','#a98262','#bfc4a7','#b9ad91','#d2966d','#e3d9ab','#d4c394'];
const esc = (value) => String(value).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

export function createMap() {
  let svg, davi, pipo, shelter, bridge, ownedMarks;
  let view = [-8,0,16,16];
  return {
    mount(canvas,data,features) {
      svg=canvas;
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
        <ellipse cx="0" cy="0" rx="17" ry="11.5" fill="#8ea975"/>
        <path d="M-18 -2 Q-10 0 0 -2 T18 -2" fill="none" stroke="#4a9e9b" stroke-width="5.3"/>
        <path d="M-4 7 Q3 4 10 6" fill="none" stroke="#d5c196" stroke-width="2.1"/>
        <g stroke-linecap="round" stroke-linejoin="round" fill="none">${routes}</g>
        ${circles}
        <path id="forest2dBridge" d="M0 -5.5V1.4" fill="none" stroke="#9b714f" stroke-width="1.8"/>
        <g id="forest2dShelter" transform="translate(${trailOffset-9.71} -.46)">
          <ellipse cx="-1.02" cy="1" rx=".5" ry=".27" fill="#78634b"/><ellipse cx=".2" cy="1.25" rx=".5" ry=".27" fill="#78634b"/>
          <g id="forest2dWet"><ellipse rx=".35" ry=".18" fill="#5ac9c7"/></g>
        </g>
        ${features.map(f=>`<g transform="translate(${f.x} ${f.z})" ${['house','portal'].includes(f.id)?`data-owned-mark="${f.id}"`:''}><circle r=".62" fill="#314e45" stroke="#f5e5ae" stroke-width=".07"/><text y=".25" text-anchor="middle" font-size=".78" fill="#ffebbf">${esc(f.icon)}</text></g>`).join('')}
        <g id="forest2dPipo"><circle r=".36" fill="#75d5ba" stroke="#24473e" stroke-width=".06"/><circle cy="-.08" r=".17" fill="#f6dda5"/></g>
        <g id="forest2dDavi"><circle r=".46" fill="#255b64" stroke="#f8e1ae" stroke-width=".11"/><circle cy="-.11" r=".28" fill="#efbf89"/><path d="M-.3-.15Q-.26-.5.23-.35L.3-.1Z" fill="#483024"/></g>`;
      davi=svg.querySelector('#forest2dDavi');
      pipo=svg.querySelector('#forest2dPipo');
      shelter=svg.querySelector('#forest2dWet');
      bridge=svg.querySelector('#forest2dBridge');
      ownedMarks=svg.querySelectorAll('[data-owned-mark]');
    },
    draw(player,buddy,data) {
      const width=svg.clientWidth, height=svg.clientHeight;
      if(!width||!height)return;
      const w=width<640?14:25, h=w*height/width;
      view=[player.x-w/2,player.z-h*.53,w,h];
      svg.setAttribute('viewBox',view.join(' '));
      davi.setAttribute('transform',`translate(${player.x} ${player.z})`);
      pipo.setAttribute('transform',`translate(${buddy.x} ${buddy.z})`);
      bridge.style.visibility=data.economy.inventory.includes('bridge')?'visible':'hidden';
      shelter.setAttribute('transform',data.leaf_up?'translate(-1.02 1)':'translate(.2 1.25)');
      for(const mark of ownedMarks)
        mark.setAttribute('opacity',data.economy.inventory.includes(mark.dataset.ownedMark)?1:.65);
    },
    ndc(x,z) {
      return {x:2*(x-view[0])/view[2]-1,y:1-2*(z-view[1])/view[3],z:0};
    },
    project(x,z) {
      const p=this.ndc(x,z),rect=svg.getBoundingClientRect();
      const visible=Math.abs(p.x)<1&&Math.abs(p.y)<1;
      return {x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2,visible,groundVisible:visible};
    },
    point(x,y) {
      const rect=svg.getBoundingClientRect();
      return {x:view[0]+(x-rect.x)*view[2]/rect.width,z:view[1]+(y-rect.y)*view[3]/rect.height};
    }
  };
}
