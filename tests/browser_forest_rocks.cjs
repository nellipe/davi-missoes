const assert=require('node:assert/strict');
const path=require('node:path');
const {session,ready,diag,out,save}=require('./forest_session.cjs');

const width=Number(process.argv[2]||390);
const profile=process.env.FOREST_PROFILE||'low';
const height=width<700?850:820;
const tag=process.env.FOREST_COMPARE_TAG||'atual';
const key=tag+'-'+width+'-'+profile;

function inspectSource(url,source) {
  if(url.endsWith('/bosque.mjs')){
    return source.replace('new T.Mesh(geometry, material);','new T.Mesh(geometry, material); mesh.name ||= "Bosque:"+name;')
      .replace('new T.InstancedMesh(geometry,material,poses.length);','new T.InstancedMesh(geometry,material,poses.length); mesh.name ||= "Bosque:"+name;');
  }
  if(url.endsWith('/regions.mjs')){
    return source.replace('new T.InstancedMesh(source.geometry,paint,positions.length);',
      'new T.InstancedMesh(source.geometry,paint,positions.length); batch.name ||= "Região:"+model;');
  }
  if(url.endsWith('/trail.mjs')){
    return source.replace('new T.InstancedMesh(shapes[shape], material, list.length);',
      'new T.InstancedMesh(shapes[shape], material, list.length); mesh.name ||= "Trilha:"+(shape==="stone"?"Ardosia_centrada":shape);');
  }
  return source+`
    window.forestRockProbe=()=>{
      const visible=[];
      scene.traverseVisible(o=>{
        if(o.isMesh && o.material.opacity>=.3 && !o.material.isShaderMaterial)visible.push(o);
      });
      const ray=new T.Raycaster(), pointer=new T.Vector2(), matrix=new T.Matrix4(), instanceColor=new T.Color();
      const found=new Map();
      for(let y=0;y<13;y++)for(let x=0;x<15;x++){
        pointer.set((x+.5)/15*2-1,1-(y+.5)/13*2);
        ray.setFromCamera(pointer,camera);
        const hit=ray.intersectObjects(visible,false).find(h=>
          !h.object.material.clippingPlanes?.some(p=>p.distanceToPoint(h.point)<0));
        if(!hit?.object.name.match(/^(Bosque|Região|Trilha|Soleira):/))continue;
        const object=hit.object;
        if(object.isInstancedMesh){
          object.getMatrixAt(hit.instanceId,matrix);
          matrix.premultiply(object.matrixWorld);
        }else matrix.copy(object.matrixWorld);
        const pos=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
        matrix.decompose(pos,q,s);
        const key=object.uuid+':'+hit.instanceId;
        if(!found.has(key))found.set(key,{
          name:object.name,geometry:object.geometry.name||object.geometry.type,instance:hit.instanceId??null,
          material:object.material.name||object.material.type,materialColor:object.material.color?.getHexString(),
          instanceColor:object.instanceColor?object.getColorAt(hit.instanceId,instanceColor)??instanceColor.getHexString():null,
          vertexColors:object.material.vertexColors,world:pos.toArray(),scale:s.toArray(),pixels:0
        });
        found.get(key).pixels++;
      }
      return [...found.values()].sort((a,b)=>b.pixels-a.pixels).slice(0,24);
    };
  `;
}
session(key,async({page,write})=>{
  await page.route(/\/(forest\.js|trail\.mjs|regions\.mjs|bosque\.mjs)$/,async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:inspectSource(route.request().url(),await response.text())});
  });
  await page.reload(); await ready(page);
  const action=(name)=>page.locator('[data-action="'+name+'"]').first();
  await action('forest-options').click();
  await page.locator('#forestQuality').selectOption(profile);
  await action('forest-close').click();
  const visits=[];
  for(const [name,x,z] of [['soleira',28,13.35],['bosque',30.68,6.5]]){
    await write('/api/forest/map/move',{x,z},'put');
    await page.reload();await ready(page);
    await page.waitForTimeout(680);
    for(const rotation of [0,1,-1]){
      if(rotation){
        await action('forest-camera').click();
        await page.locator('[data-action=forest-rotate][data-turn="'+rotation+'"]').click();
        await page.waitForTimeout(870);
      }
      const d=await diag(page);
      assert.equal(d.low,profile==='low');
      assert(Math.hypot(d.position[0]-x,d.position[2]-z)<.06);
      await page.screenshot({path:path.join(out,key+'-'+name+'-'+rotation+'.png')});
      const objects=await page.evaluate(()=>forestRockProbe());
      const framing=await page.evaluate(()=>DaviForest.characterFraming());
      if(tag!=='base'){
        for(const [actor,points] of Object.entries(framing))
          assert(points.filter(p=>p.clear&&Math.abs(p.x)<.96&&Math.abs(p.y)<.96).length>=2,name+' '+rotation+' '+actor+' '+JSON.stringify(points));
      }
      visits.push({name,rotation,position:d.position,camera:d.camera,calls:d.calls,triangles:d.triangles,framing,objects});
    }
  }
  let passage;
  if(width===1366&&profile==='high'){
    await write('/api/forest/map/move',{x:15.1,z:5.1},'put');
    await page.reload();await ready(page);
    await page.waitForTimeout(780);
    const d=await diag(page);
    passage={calls:d.calls,triangles:d.triangles,position:d.position,medianMs:d.frameMs.toSorted((a,b)=>a-b)[Math.floor(d.frameMs.length/2)]};
    assert(passage.calls<=302,'Orçamento de chamadas na passagem: '+passage.calls);
  }
  save('inventario-'+key,{profile,width,visits,passage});
}, process.env.FOREST_RECORD==='1',{viewport:{width,height},videoSize:{width,height},videoFps:24})
 .catch(error=>{console.error(error);process.exitCode=1;});
