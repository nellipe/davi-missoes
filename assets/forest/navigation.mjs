// Pure navigation shared by rendering, input and regression tests. No DOM/Three state.
export function walkable(x, z, inventory, obstacles) {
  if (!Number.isFinite(x + z) || (x / 17) ** 2 + (z / 11.5) ** 2 > 1) return false;
  if (Math.abs(x + 9) < 1.35 && z > -6.5 && z < -.3) return false;
  if (obstacles.some(([a,b,r]) => Math.hypot(x-a,z-b) < r+.23)) return false;
  const river = -2-1.1*Math.sin(x*.2), bridge = inventory.includes('bridge');
  if (!bridge && z < river+2.7) return false;
  return Math.abs(z-river) >= 2.7 || (bridge && Math.abs(x)<1.03 && z>-5.7 && z<1.5);
}
export function terrainHeight(grid, x, z) {
  if (!grid) {
    const h=.14*Math.sin(x*.28)+.13*Math.cos(-z*.31)+.07*Math.sin(x*.5-z*.3)+2.1*Math.exp(-(((x+9)/3.2)**2)-((-z-6)/4)**2);
    return h-3*Math.exp(-((Math.abs(-z-(2+1.1*Math.sin(x*.2)))/2.3)**6));
  }
  const {n, bounds, heights}=grid, [xmin,xmax,zmin,zmax]=bounds;
  const u=Math.max(0,Math.min(n-1e-8,(x-xmin)/(xmax-xmin)*n));
  const v=Math.max(0,Math.min(n-1e-8,(z-zmin)/(zmax-zmin)*n));
  const i=Math.floor(u),j=Math.floor(v),a=j*(n+1)+i,fx=u-i,fz=v-j;
  const h00=heights[a],h10=heights[a+1],h01=heights[a+n+1],h11=heights[a+n+2];
  // Same diagonal as the exported triangles; bilinear interpolation would float on slopes.
  return fx >= fz ? h00+(h10-h00)*fx+(h11-h10)*fz : h00+(h11-h01)*fx+(h01-h00)*fz;
}
export function segmentClear(a,b,valid) {
  const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.12));
  for(let i=1;i<=count;i++) if(!valid(a.x+(b.x-a.x)*i/count,a.z+(b.z-a.z)*i/count)) return false;
  return true;
}
export function route(start, goal, valid) {
  if (!valid(goal.x,goal.z)) return [];
  if (segmentClear(start,goal,valid)) return [{...goal}];
  const size=.4, cell=p=>[Math.round(p.x/size),Math.round(p.z/size)], key=(x,z)=>`${x},${z}`;
  const [sx,sz]=cell(start),[gx,gz]=cell(goal),open=[{x:sx,z:sz,g:0,f:0}],cost=new Map([[key(sx,sz),0]]),parents=new Map();
  let found=null;
  for(let count=0;open.length&&count<6500;count++) {
    open.sort((a,b)=>b.f-a.f);const node=open.pop(),nk=key(node.x,node.z);
    if(node.g!==cost.get(nk)) continue;
    if(Math.hypot(node.x-gx,node.z-gz)<1.5&&segmentClear({x:node.x*size,z:node.z*size},goal,valid)){found=node;break;}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const x=node.x+dx,z=node.z+dz,point={x:x*size,z:z*size},g=node.g+Math.hypot(dx,dz),k=key(x,z);
      if(Math.abs(x*size)>17||Math.abs(z*size)>11.5||g>=(cost.get(k)??Infinity)||!segmentClear({x:node.x*size,z:node.z*size},point,valid))continue;
      cost.set(k,g);parents.set(k,node);open.push({x,z,g,f:g+Math.hypot(x-gx,z-gz)});
    }
  }
  if(!found)return [];
  const points=[{...goal}];let n=found;
  while(n&&!(n.x===sx&&n.z===sz)){points.push({x:n.x*size,z:n.z*size});n=parents.get(key(n.x,n.z));}
  points.reverse();const smooth=[];let previous=start;
  for(let i=0;i<points.length;) {let next=i;while(next+1<points.length&&segmentClear(previous,points[next+1],valid))next++;smooth.push(points[next]);previous=points[next];i=next+1;}
  return smooth;
}
export function advance(position, direction, distance, valid) {
  const len=Math.hypot(direction.x,direction.z);if(len<1e-8||distance<=0)return {...position};
  const step=Math.min(distance,len),x=position.x+direction.x/len*step,z=position.z+direction.z/len*step;
  if(segmentClear(position,{x,z},valid))return {x,z};
  // Slide along obstacles without crossing a thin barrier or teleporting.
  if(segmentClear(position,{x,z:position.z},valid))return {x,z:position.z};
  if(segmentClear(position,{x:position.x,z},valid))return {x:position.x,z};
  return {...position};
}
