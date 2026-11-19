// Run after changing solid props, terrain, or source GLBs: node tools/forest/build_collision.mjs
import fs from 'node:fs';
import {registerHooks} from 'node:module';

const root=new URL('../../',import.meta.url);
registerHooks({resolve(specifier,context,next){
  return next(specifier.startsWith('/vendor/')?new URL(specifier.slice(1),root).href:specifier,context);
}});
const T=await import(new URL('vendor/three/three.module.min.js',root));
const {GLTFLoader}=await import(new URL('vendor/three/addons/loaders/GLTFLoader.js',root));
const Trail=await import(new URL('assets/forest/trail.mjs',root));
const {createChibiPaint}=await import(new URL('assets/forest/chibi.mjs',root));
const {bankHeight,seamCreek,segmentDistanceSquared}=await import(new URL('assets/forest/navigation.mjs',root));
const file=name=>new URL('assets/forest/'+name,root);
const json=name=>JSON.parse(fs.readFileSync(file(name),'utf8'));
const map=json('forest-layout.json'), trail=json('trail-layout.json'), terrain=json('navigation.json');
const offset=map.trailOffset, [xmin,xmax,zmin,zmax]=map.bounds, left=map.seam-offset;
const layout={
  bounds:[left,xmax-offset,zmin,zmax],
  clearings:[...trail.clearings,...map.clearings],
  paths:[...trail.paths,...map.paths,{
    width:map.connection.width,points:map.connection.points.map(([x,z])=>[x-offset,z]),
  }],
};
const bank=(x,z)=>bankHeight(terrain,map,x,z);
Trail.configure(layout,z=>bank(map.seam,z),map);
const floor=(x,z)=>x<map.seam?bank(x,z):Trail.floor(x-offset,z)-.012;

async function model(name){
  const glb=fs.readFileSync(file(name+'.glb'));
  const length=glb.readUInt32LE(12), document=JSON.parse(glb.subarray(20,20+length));
  // Only geometry is needed. Strip texture references before parsing in Node.
  delete document.images;
  delete document.textures;
  document.materials=[];
  for(const mesh of document.meshes)for(const primitive of mesh.primitives)delete primitive.material;
  const source=Buffer.from(JSON.stringify(document));
  const padded=Buffer.alloc(Math.ceil(source.length/4)*4,32);
  source.copy(padded);
  const header=Buffer.from(glb.subarray(0,20));
  header.writeUInt32LE(padded.length,12);
  const output=Buffer.concat([header,padded,glb.subarray(20+length)]);
  output.writeUInt32LE(output.length,8);
  return (await new GLTFLoader().parseAsync(output.buffer.slice(output.byteOffset,output.byteOffset+output.length),'')).scene;
}

function hull(points){
  const turn=([ax,az],[bx,bz],[cx,cz])=>(bx-ax)*(cz-az)-(bz-az)*(cx-ax);
  function half(sequence){
    const output=[];
    for(const p of sequence){
      while(output.length>=2 && turn(output.at(-2),output.at(-1),p)<=0)output.pop();
      output.push(p);
    }
    return output.slice(0,-1);
  }
  points.sort(([x,z],[a,b])=>x-a||z-b);
  const ring=half(points).concat(half(points.reverse()));
  for(let i=ring.length-1;i>=0&&ring.length>4;i--){
    const [x,z]=ring[i], [a,b]=ring[(i+ring.length-1)%ring.length], [c,d]=ring[(i+1)%ring.length];
    if(segmentDistanceSquared(x,z,a,b,c,d)<.0016)ring.splice(i,1);
  }
  return ring;
}

const solids=[];
const round=n=>Math.round(n*1000)/1000;
function add(name,geometry,matrix,dx=0,baseOnly=false,owner,select){
  const vertices=geometry.getAttribute('position'), point=new T.Vector3(), transformed=[];
  for(let i=0;i<vertices.count;i++){
    point.fromBufferAttribute(vertices,i);
    if(select&&!select(point))continue;
    point.applyMatrix4(matrix);
    transformed.push([point.x+dx,point.y,point.z]);
  }
  const minY=Math.min(...transformed.map(([,y])=>y));
  const points=transformed.filter(([,y])=>!baseOnly||(y>minY+.14&&y<minY+1.49))
    .map(([x,,z])=>[round(x),round(z)]);
  const outline=hull(points);
  if(outline.length<3||!outline.some(([x,z])=>x>=xmin-.5&&x<=xmax+.5&&z>=zmin-.5&&z<=zmax+.5))return;
  solids.push(owner?[name,outline,owner]:[name,outline]);
}
const library=await model('bosque');
Trail.build(new T.Scene(),false,library,createChibiPaint(),
  (name,geometry,matrix,baseOnly)=>{
    if(name==='Bosque:Varal'){
      for(const sign of [-1,1])add(name,geometry,matrix,offset,false,null,p=>p.y<1.65 && p.x*sign>0);
    } else add(name,geometry,matrix,offset,baseOnly);
  });

const clearing=await model('forest'), house=await model('treehouse');
for(const scene of [clearing,house])scene.updateMatrixWorld(true);
clearing.traverse(object=>{
  if(!object.isMesh)return;
  const tree=/^(Oak_bark|Sculpted_trunk)/.test(object.name);
  const parent=object.parent;
  if(tree&&parent.name.startsWith('Forest_depth_oak')&&parent.position.z>10&&Math.abs(parent.position.x)<12)return;
  if(tree&&parent.position.x+.65>=map.seam)return;
  if(tree||/^(Mossy_landmark|Cascade_ledge|Workshop_counter$|Awning_post|Calendar_carved_leg|Calendar_oak_frame|Wardrobe_branch|Portal_carved_stone|Trail_sign|Chest)/.test(object.name))
    add(tree?parent.name:object.name,object.geometry,object.matrixWorld,0,tree);
});
house.traverse(object=>{
  if(!object.isMesh)return;
  if(/^Ancient_trunk/.test(object.name))add(object.name,object.geometry,object.matrixWorld,0,true);
  if(/^Branch_stair/.test(object.name) && object.position.y<1.5)
    add(object.name,object.geometry,object.matrixWorld,0,false,'house');
});

const margin=.23, cell=.25, rows=[];
for(let j=0;j<(zmax-zmin)/cell;j++){
  const z=zmin+(j+.5)*cell;
  let row='';
  for(let i=0;i<(xmax-xmin)/cell;i++){
    const x=xmin+(i+.5)*cell;
    const river=-2-1.1*Math.sin(x*.2), dry=Math.abs(z-river)>=2.7;
    const deck=Math.abs(x)<1.03&&z>-5.7&&z<1.5;
    const nearDeck=Math.abs(x)<1.14&&z>-6.05&&z<1.74;
    const height=floor(x,z);
    const steep=[[-.38,0],[.38,0],[0,-.38],[0,.38]]
      .some(([a,b])=>Math.abs(floor(x+a,z+b)-height)>.52);
    let value=steep?'0':'1';
    if(x<map.seam-.65 && !dry)value=deck?'2':'0';
    else if(x<map.seam-.65 && z<river)value=(!steep||nearDeck)?'3':'0';
    else if(seamCreek(x,z,map.seam)>.35 || (x>map.seam&&x<map.seam+.75&&z<2.4))value='0';
    else if(x<map.seam && nearDeck && steep)value=deck?'2':'0';
    row+=value;
  }
  rows.push(row);
}
const content='{\n  "margin": '+margin+',\n  "cell": '+cell+',\n  "rows": '+JSON.stringify(rows,null,2).replaceAll('\n','\n  ')+
  ',\n  "solids": [\n'+solids.map(solid=>'    '+JSON.stringify(solid)).join(',\n')+'\n  ]\n}\n';
if(process.argv.includes('--check')){
  if(content!==fs.readFileSync(file('obstacles.json'),'utf8').replaceAll('\r\n','\n'))
    throw new Error('obstacles.json precisa ser regenerado.');
} else fs.writeFileSync(file('obstacles.json'),content);
console.log(solids.length+' obstáculos, '+rows[0].length+' × '+rows.length+' células');
