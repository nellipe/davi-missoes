import { actorSymbols, createViewport, floorPath, mapActors } from '/assets/forest/map-2d.mjs';

export function createMap() {
  const viewport=createViewport();
  let actors, tokens, lastProgress;
  return {
    ...viewport,
    mount(canvas,data,features){
      viewport.attach(canvas);
      const {layout,map,collision}=data;
      const coast=floorPath(map.bounds,collision,'1');
      const paths=layout.paths.map(points=>`<polyline points="${points.map(p=>p.join(',')).join(' ')}"/>`).join('');
      const props=collision.solids.map(([name,polygon])=>`<polygon points="${polygon.map(p=>p.join(',')).join(' ')}" fill="${/palm|fern|planter/.test(name)?'#70a582':layout.edge}"/>`).join('');
      canvas.innerHTML=`<defs><clipPath id="worldLand"><path d="${coast}"/></clipPath><pattern id="worldPattern" width="1.27" height="1.13" patternUnits="userSpaceOnUse"><path d="M.14 .28h.35M.75 .72h.23" stroke="#fff6d9" stroke-width=".044" opacity=".55"/></pattern></defs>
        <rect x="-80" y="-80" width="200" height="170" fill="${layout.waterColor}"/><path d="${coast}" fill="${layout.ground}" stroke="#fff4cc" stroke-width=".19"/>
        <rect x="-80" y="-80" width="200" height="170" fill="url(#worldPattern)"/>
        <g clip-path="url(#worldLand)" fill="none" stroke="${layout.path}" stroke-width="2.35" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
        <g stroke="#526876" stroke-width=".08">${props}</g>
        ${features.map(({id,x,z,icon})=>`<g transform="translate(${x} ${z})" data-world-token="${id}"><circle r=".57" fill="#405963" stroke="#fff2ca" stroke-width=".08"/><text y=".24" text-anchor="middle" font-size=".70" fill="#ffedbf"></text></g>`).join('')}${actorSymbols}`;
      tokens=Array.from(canvas.querySelectorAll('[data-world-token]'));
      tokens.forEach((token,i)=>{token.querySelector('text').textContent=features[i].icon;});
      actors=mapActors(canvas);
    },
    draw(player,buddy,data,time,still,scale=1){
      if(!viewport.center(player))return;
      actors(player,buddy,data.economy,scale);
      if(lastProgress!==data.progress){
        lastProgress=data.progress;
        for(const token of tokens)if(lastProgress.includes(token.dataset.worldToken)){
          token.querySelector('circle').setAttribute('fill','#45785f');
          token.querySelector('text').textContent='✓';
        }
      }
    },
  };
}
