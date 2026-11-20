// Pure navigation shared by rendering, input and regression tests. No DOM/Three state.
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

export function smoothstep(x, a, b) {
  const t = Math.max(0, Math.min(1, (x-a)/(b-a)));
  return t*t*(3-2*t);
}

// The head of the creek turns along the seam, keeping its far bank gated by the bridge.
export function seamCreek(x, z, seam) {
  return (1-smoothstep(Math.abs(x-seam),.40,1.45)) * (1-smoothstep(z,2.1,4.35));
}

export function terrainRim(x,z,[xmin,xmax,zmin,zmax]) {
  const edge=Math.min(x-xmin,xmax-x,z-zmin,zmax-z);
  return 1-smoothstep(edge,-1.65,.15);
}

export function bankHeight(grid,map,x,z) {
  const ground=terrainHeight(grid,x,z);
  const blend=smoothstep(x,map.seam-2.6,map.seam)*smoothstep(z,-4,-2)*(1-smoothstep(z,2,3.45));
  return ground+(.07*Math.sin(z*.64)-ground)*blend
    -2.5*seamCreek(x,z,map.seam)-2.6*terrainRim(x,z,map.bounds);
}

export function segmentDistanceSquared(x,z,a,b,c,d) {
  const dx=c-a,dz=d-b,length=dx*dx+dz*dz;
  const t=length?Math.max(0,Math.min(1,((x-a)*dx+(z-b)*dz)/length)):0;
  return (x-a-t*dx)**2+(z-b-t*dz)**2;
}

export function insidePolygon(x,z,vertices,margin=0) {
  let inside=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++){
    const [a,b]=vertices[j],[c,d]=vertices[i];
    if(margin && segmentDistanceSquared(x,z,a,b,c,d)<margin*margin)return true;
    if((b>z)!==(d>z) && x<(c-a)*(z-b)/(d-b)+a)inside=!inside;
  }
  return inside;
}

function crosses(a,b,x,z,u,v) {
  const p=(b.x-a.x)*(z-a.z)-(b.z-a.z)*(x-a.x);
  const q=(b.x-a.x)*(v-a.z)-(b.z-a.z)*(u-a.x);
  const r=(u-x)*(a.z-z)-(v-z)*(a.x-x);
  const s=(u-x)*(b.z-z)-(v-z)*(b.x-x);
  return ((p<0&&q>0)||(p>0&&q<0))&&((r<0&&s>0)||(r>0&&s<0));
}

export function createNavigation(map,collision,inventory) {
  const {margin,cell,rows,solids}=collision;
  const [xmin,xmax,zmin,zmax]=map.bounds;
  const buckets=new Map(), bucketSize=2;
  const bucket=(x,z)=>Math.floor(x/bucketSize)+','+Math.floor(z/bucketSize);
  for(const [,vertices,owner] of solids){
    if(owner&&!inventory.includes(owner))continue;
    const xs=vertices.map(point=>point[0]), zs=vertices.map(point=>point[1]);
    const solid={vertices,x0:Math.min(...xs)-margin,x1:Math.max(...xs)+margin,
      z0:Math.min(...zs)-margin,z1:Math.max(...zs)+margin};
    for(let i=Math.floor(solid.x0/bucketSize);i<=Math.floor(solid.x1/bucketSize);i++){
      for(let j=Math.floor(solid.z0/bucketSize);j<=Math.floor(solid.z1/bucketSize);j++){
        const key=i+','+j;
        if(!buckets.has(key))buckets.set(key,[]);
        buckets.get(key).push(solid);
      }
    }
  }
  const bridge=inventory.includes('bridge');
  const groundAt=(i,j)=>{
    const ground=rows[j]?.[i];
    return ground==='1' || (bridge&&(ground==='2'||ground==='3'));
  };
  const valid=(x,z)=>{
    if(!Number.isFinite(x)||!Number.isFinite(z)||x<xmin+margin||x>=xmax-margin||z<zmin+margin||z>=zmax-margin)
      return false;
    if(!groundAt(Math.floor((x-xmin)/cell),Math.floor((z-zmin)/cell)))return false;
    return !(buckets.get(bucket(x,z))??[]).some(({vertices,x0,x1,z0,z1})=>
      x>=x0&&x<=x1&&z>=z0&&z<=z1&&insidePolygon(x,z,vertices,margin));
  };
  valid.segmentClear=(a,b)=>{
    if(!valid(b.x,b.z))return false;
    // Visit every grid cell crossed by the segment, even a clipped corner.
    const dx=b.x-a.x,dz=b.z-a.z,sx=Math.sign(dx),sz=Math.sign(dz);
    let i=Math.floor((a.x-xmin)/cell),j=Math.floor((a.z-zmin)/cell);
    let tx=dx?(xmin+(i+(sx>0?1:0))*cell-a.x)/dx:Infinity;
    let tz=dz?(zmin+(j+(sz>0?1:0))*cell-a.z)/dz:Infinity;
    while(Math.min(tx,tz)<1-1e-9){
      if(tx<tz){i+=sx;tx+=cell/Math.abs(dx);}
      else {j+=sz;tz+=cell/Math.abs(dz);}
      if(!groundAt(i,j))return false;
    }
    const x0=Math.min(a.x,b.x),x1=Math.max(a.x,b.x),z0=Math.min(a.z,b.z),z1=Math.max(a.z,b.z);
    const tested=new Set(), radius=margin*margin;
    for(let u=Math.floor(x0/bucketSize);u<=Math.floor(x1/bucketSize);u++){
      for(let v=Math.floor(z0/bucketSize);v<=Math.floor(z1/bucketSize);v++){
        for(const solid of buckets.get(u+','+v)??[]){
          if(tested.has(solid)||solid.x0>x1||solid.x1<x0||solid.z0>z1||solid.z1<z0)continue;
          tested.add(solid);
          const {vertices}=solid;
          for(let k=0,l=vertices.length-1;k<vertices.length;l=k++){
            const [x,z]=vertices[l],[u,v]=vertices[k];
            if(segmentDistanceSquared(x,z,a.x,a.z,b.x,b.z)<radius||
              segmentDistanceSquared(a.x,a.z,x,z,u,v)<radius||crosses(a,b,x,z,u,v))return false;
          }
        }
      }
    }
    return true;
  };
  return valid;
}
export function segmentClear(a,b,valid) {
  if(valid.segmentClear)return valid.segmentClear(a,b);
  const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.10));
  for(let i=1;i<=count;i++) if(!valid(a.x+(b.x-a.x)*i/count,a.z+(b.z-a.z)*i/count)) return false;
  return true;
}
function push(heap,node) {
  let i=heap.length;
  while(i>0){
    const parent=(i-1)>>1;
    if(heap[parent].f<=node.f)break;
    heap[i]=heap[parent];
    i=parent;
  }
  heap[i]=node;
}
function pop(heap) {
  const first=heap[0],tail=heap.pop();
  if(!heap.length)return first;
  let i=0;
  while(2*i+1<heap.length){
    let child=2*i+1;
    if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;
    if(heap[child].f>=tail.f)break;
    heap[i]=heap[child];
    i=child;
  }
  heap[i]=tail;
  return first;
}
export const ROUTE_DIRECTIONS=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
export const ROUTE_STEP=.38;
export function route(start, goal, valid, bounds=[17,11.5], budget=14000) {
  if (!valid(start.x,start.z)||!valid(goal.x,goal.z)) return [];
  if (segmentClear(start,goal,valid)) return [{...goal}];
  const [xmin,xmax,zmin,zmax]=bounds.length===4?bounds:[-bounds[0],bounds[0],-bounds[1],bounds[1]];
  const size=ROUTE_STEP, cell=p=>[Math.round(p.x/size),Math.round(p.z/size)], key=(x,z)=>x*1024+z;
  const [sx,sz]=cell(start),[gx,gz]=cell(goal),open=[],cost=new Map();
  for(const [dx,dz] of [[0,0],...ROUTE_DIRECTIONS]){
    const x=sx+dx,z=sz+dz,point={x:x*size,z:z*size};
    if(!segmentClear(start,point,valid))continue;
    const g=Math.hypot(point.x-start.x,point.z-start.z)/size;
    cost.set(key(x,z),g);push(open,{x,z,g,f:g+Math.hypot(x-gx,z-gz),parent:null});
  }
  let found=null;
  for(let count=0;open.length&&count<budget;count++) {
    const node=pop(open),nk=key(node.x,node.z);
    if(node.g!==cost.get(nk)) continue;
    const current={x:node.x*size,z:node.z*size};
    if(Math.hypot(node.x-gx,node.z-gz)<1.8&&segmentClear(current,goal,valid)){found=node;break;}
    for(const [dx,dz] of ROUTE_DIRECTIONS) {
      const x=node.x+dx,z=node.z+dz,point={x:x*size,z:z*size},g=node.g+Math.hypot(dx,dz),k=key(x,z);
      if(point.x<xmin||point.x>xmax||point.z<zmin||point.z>zmax||g>=(cost.get(k)??Infinity)||!segmentClear(current,point,valid))continue;
      cost.set(k,g);push(open,{x,z,g,f:g+Math.hypot(x-gx,z-gz),parent:node});
    }
  }
  if(!found)return [];
  const points=[{...goal}];let n=found;
  while(n){points.push({x:n.x*size,z:n.z*size});n=n.parent;}
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
