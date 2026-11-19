import { insidePolygon, segmentDistanceSquared, smoothstep } from '../forest/navigation.mjs';

const hill=(x,z,a,b,rx,rz)=>Math.exp(-(((x-a)/rx)**2+((z-b)/rz)**2));

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
    const dune=.68*hill(x,z,-3,-4,5.4,4.7)+.42*hill(x,z,7,1,5,2.7)+.44*hill(x,z,38,5,4.3,6)+.31*hill(x,z,15,11,3.8,2.3);
    const canyon=.24+.24*Math.cos(.19*x+.14*z)*Math.cos(.19*z)+1.06*hill(x,z,4,-5,6.8,3.4)
      +.62*hill(x,z,21,-8.5,6.0,4.5)+1.03*hill(x,z,40,-6.4,6.6,6.3)+.51*hill(x,z,-12,10,4.7,4.6);
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
