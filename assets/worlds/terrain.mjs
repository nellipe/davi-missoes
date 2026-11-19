import { insidePolygon, segmentDistanceSquared, smoothstep } from '/assets/forest/navigation.mjs';

export function landscape(data) {
  const {layout:{paths,water},map:{bounds:[xmin,xmax,zmin,zmax]},world}=data;
  const coast = (x,z) => {
    let distance=Math.min(x-xmin,xmax-x,z-zmin,zmax-z);
    for(const polygon of water){
      let nearest=Infinity;
      for(let i=0;i<polygon.length;i++){
        const [a,b]=polygon[i], [c,d]=polygon[(i+1)%polygon.length];
        nearest=Math.min(nearest,segmentDistanceSquared(x,z,a,b,c,d));
      }
      distance=Math.min(distance,Math.sqrt(nearest)*(insidePolygon(x,z,polygon)?-1:1));
    }
    return distance;
  };
  const path = (x,z) => {
    let distance=Infinity;
    for(const points of paths)for(let i=1;i<points.length;i++){
      const [a,b]=points[i-1], [c,d]=points[i];
      distance=Math.min(distance,segmentDistanceSquared(x,z,a,b,c,d));
    }
    return Math.sqrt(distance);
  };
  const height = (x,z,d=coast(x,z)) => {
    const ripples=Math.sin(.37*x+.26*z)*.06+Math.sin(.21*x-.54*z)*.042;
    const dune=Math.sin(.16*x)*Math.cos(.18*z)*.12;
    const canyon=.34*Math.cos(.19*x+.14*z)*Math.cos(.19*z)+.16;
    const relief=world==='inventores'?ripples*.26:world==='praia'?ripples+dune:ripples+canyon;
    return relief-.89*(1-smoothstep(d,-1.4,.51));
  };
  return {coast,path,height};
}

export function regionAt(layout,x,z) {
  let distance=Infinity, name=layout.regions[0][0];
  for(const [label,a,b] of layout.regions){
    const next=(x-a)**2+(z-b)**2;
    if(next<distance){distance=next;name=label;}
  }
  return name;
}
