// Trail-local positions shared by the artwork, camera, 2D view and collision exporter.
export const recanto = {
  log: [-6.04, .08],
  openingYaw: -.64,
  leaf: [-8.44, 2.54],
  action: [-8.95, 2.02],
  focus: [-7.86, 2.16],
  basins: [[-.69, 1.01], [.68, 1.02]],
  shelters: [[.74, 1.34], [-.58, 1.43]],
};

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
