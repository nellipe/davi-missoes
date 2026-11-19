import { smoothstep } from './navigation.mjs';

// Trail-local positions shared by the artwork, camera, 2D view and collision exporter.
export const recanto = {
  log: [-6.04, .08],
  openingYaw: -.64,
  leaf: [-7.45, 2.75],
  action: [-6.59, 2.39],
  focus: [-7.16, 2.35],
  basins: [[-.66, .80], [.66, .80]],
  shelters: [[.74, 1.23], [-.43, 1.35]],
};

// Ease the shoulder of the east bank into the meadow, clear of the creek.
export function recantoMeadow(x,z) {
  const [u,v]=recanto.leaf;
  const distance=Math.hypot((x-u-.12)/3.21,(z-v-.08)/2.05);
  return smoothstep(x,-9.66,-9.22)*(1-smoothstep(distance,.60,1));
}

// An animal can take a short step within its clearing when an explorer stands
// in front of it. The two shelter assignments and the player's route stay put.
export function visibleSpot(x,z,camera,hero,buddy,reachable) {
  function cover(u,v){
    const dx=u-camera.x,dz=v-camera.z,depth=Math.hypot(dx,dz)||1;
    let score=0;
    for(const [actor,width] of [[hero,.52],[buddy,.38]]){
      const rx=actor.x-u,rz=actor.z-v;
      const overlap=(rx*dx+rz*dz)/depth;
      if(overlap>-1.85&&overlap<.17)
        score+=Math.max(0,width-Math.abs(rx*dz-rz*dx)/depth);
    }
    return score;
  }
  let score=cover(x,z), best=[x,z];
  if(!score)return best;
  const dx=x-camera.x,dz=z-camera.z,len=Math.hypot(dx,dz)||1;
  for(const lateral of [.64,-.64,.86,-.86]){
    const u=x+dz/len*lateral,v=z-dx/len*lateral;
    if(!reachable(x,z,u,v))continue;
    const next=cover(u,v)+Math.abs(lateral)*.07;
    if(next<score){best=[u,v];score=next;}
  }
  return best;
}
