import { actorSymbols, createViewport, drawActivitySigns, floorPath, mapActors } from '/assets/forest/map-2d.mjs';

const foliage=/palm|fern|dune-plants|cycad|horsetail|planter/;
const symbols={
  palm:'<circle r=".69" fill="#80a875"/><path d="M0 .47V0m0 0L-.45-.25M0 0l.44-.25M0 0l-.30.38m.30-.38l.37.34" stroke="#4d805f" stroke-width=".11"/>',
  fern:'<path d="M-.62 .3Q-.28-.27 0 0Q.24-.64.55-.56Q.67-.01 0 .23Q-.40.50-.62 .30Z" fill="#79a265" stroke="#5d8b5d" stroke-width=".06"/>',
  building:'<rect x="-1.05" y="-.60" width="2.1" height="1.2" rx=".17" fill="#a28aa9"/><path d="M-.90 .31H.90M0-.41V.42" fill="none" stroke="#ecd2ad" stroke-width=".13"/><circle r=".27" fill="#ceac99"/>',
  market:'<rect x="-.89" y="-.43" width="1.78" height=".86" rx=".14" fill="#eaad9e"/><path d="M-.56-.38v.76m.55-.76v.76m.55-.76v.76" stroke="#fff0c4" stroke-width=".16"/>',
  strata:'<path d="M-.86 .24L-.63-.47.48-.61.97-.11.50.59-.59.53Z" fill="#c28b64"/><path d="M-.66 .19Q.1-.11.74 .1" fill="none" stroke="#ecc091" stroke-width=".15"/>',
  pool:'<ellipse rx=".74" ry=".47" fill="#9fe6d4" stroke="#eee2ae" stroke-width=".14"/>',
};

function artFor(name){
  if(name.startsWith('workshop')||name==='clock')return symbols.building;
  if(name==='market')return symbols.market;
  if(name==='palm'||name==='cycad')return symbols.palm;
  if(foliage.test(name))return symbols.fern;
  if(name==='tide-pool')return symbols.pool;
  if(/cliff|strata|sandstone/.test(name))return symbols.strata;
  return '';
}

export function createMap() {
  const viewport=createViewport();
  let svg,actors,tokens,lastProgress,ripple,visit;
  return {
    ...viewport,
    mount(canvas,data,features){
      svg=canvas;
      viewport.attach(canvas);
      const {layout,map,collision}=data;
      const coast=floorPath(map.bounds,collision,'1');
      const paths=layout.paths.map(points=>`<polyline points="${points.map(p=>p.join(',')).join(' ')}"/>`).join('');
      const props=collision.solids.map(([name,polygon])=>`<polygon points="${polygon.map(p=>p.join(',')).join(' ')}" fill="${foliage.test(name)?'#70a582':layout.edge}"/>`).join('');
      const scenery=layout.props.map(([name,x,z,angle,size])=>`<g transform="translate(${x} ${z}) rotate(${-angle}) scale(${size})">${artFor(name)}</g>`).join('');
      const city=data.world==='inventores';
      const places=features.filter(f=>!f.activity);
      canvas.innerHTML=`<defs><clipPath id="worldLand"><path d="${coast}"/></clipPath><pattern id="worldPattern" width="1.27" height="1.13" patternUnits="userSpaceOnUse"><path d="M.14 .28h.35M.75 .72h.23" stroke="#fff6d9" stroke-width=".044" opacity=".55"/></pattern></defs>
        <rect x="-80" y="-80" width="200" height="170" fill="${layout.waterColor}"/><path d="${coast}" fill="${layout.ground}"/>
        <rect x="-80" y="-80" width="200" height="170" fill="url(#worldPattern)"/>
        <g clip-path="url(#worldLand)" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <g stroke="${city?'#a38aa0':layout.edge}" stroke-width="${city?2.70:2.39}" opacity=".65">${paths}</g>
          <g stroke="${layout.path}" stroke-width="${city?2.36:2.10}">${paths}</g>
        </g>
        <g stroke="#526876" stroke-width=".08" opacity=".67">${props}</g><g>${scenery}</g>
        <circle data-discovery-ring r=".5" fill="none" stroke="#fff1b6" stroke-width=".14" visibility="hidden"/>
        ${places.map(({id,x,z})=>`<g transform="translate(${x} ${z})" data-world-token="${id}"><circle r=".57" fill="#405963" stroke="#fff2ca" stroke-width=".08"/><text y=".24" text-anchor="middle" font-size=".70" fill="#ffedbf"></text></g>`).join('')}<g data-calendar-signs></g>${actorSymbols}`;
      tokens=Array.from(canvas.querySelectorAll('[data-world-token]'));
      tokens.forEach((token,i)=>{token.querySelector('text').textContent=places[i].icon;});
      drawActivitySigns(svg,features);
      ripple=canvas.querySelector('[data-discovery-ring]');
      actors=mapActors(canvas);
    },
    setActivitySigns(features){drawActivitySigns(svg,features);},
    reveal(place,time){
      visit={time};
      ripple.setAttribute('cx',place.x);
      ripple.setAttribute('cy',place.z);
      ripple.setAttribute('stroke',place.cue??'#fff1b6');
    },
    draw(player,buddy,data,time,still,scale=1){
      if(!viewport.center(player))return;
      actors(player,buddy,data.economy,scale);
      if(lastProgress!==data.progress){
        lastProgress=data.progress;
        for(const token of tokens){
          const done=lastProgress.includes(token.dataset.worldToken);
          const place=data.layout.places.find(p=>p.id===token.dataset.worldToken);
          if(place&&done){
            token.querySelector('circle').setAttribute('fill',place.requires?'#b16f4d':'#45785f');
            token.querySelector('text').textContent=place.requires?'✦':'✓';
          }
        }
      }
      if(visit){
        const age=time-visit.time;
        const active=age<1.46;
        ripple.setAttribute('visibility',active?'visible':'hidden');
        if(active){
          ripple.setAttribute('r',still?'.86':.5+age*1.07);
          ripple.setAttribute('opacity',still?'.85':1-age/1.46);
        }else visit=null;
      }
    },
  };
}
