import * as T from '/vendor/three/three.module.min.js';

export function createSight() {
  const origin=new T.Vector3();
  const offset=new T.Vector3();
  const heroLine=new T.Vector3(), buddyLine=new T.Vector3();
  const landmarkLines=[];
  let landmarkCount=0;
  let heroDepth, buddyDepth;
  function hits(line,depth,radius,padding){
    const closest=offset.dot(line);
    return closest>-radius && closest<depth-.13 &&
      offset.lengthSq()-closest*closest<(radius+padding)**2;
  }
  return {
    update(camera,hero,buddy,landmarks=[]) {
      origin.copy(camera);
      heroLine.copy(hero).sub(origin).y+=1.03;
      buddyLine.copy(buddy).sub(origin).y+=.63;
      heroDepth=heroLine.length();
      buddyDepth=buddyLine.length();
      heroLine.divideScalar(heroDepth);
      buddyLine.divideScalar(buddyDepth);
      landmarkCount=landmarks.length;
      for(let i=0;i<landmarkCount;i++){
        const line=landmarkLines[i]??={direction:new T.Vector3(),depth:0};
        line.direction.subVectors(landmarks[i],origin);
        line.depth=line.direction.length();
        line.direction.divideScalar(line.depth);
      }
    },
    covers(center,radius,padding=.21,includeLandmarks=false) {
      offset.copy(center).sub(origin);
      if(hits(heroLine,heroDepth,radius,padding)||hits(buddyLine,buddyDepth,radius,padding))return true;
      if(includeLandmarks){
        for(let i=0;i<landmarkCount;i++){
          const {direction,depth}=landmarkLines[i];
          if(hits(direction,depth,radius,padding))return true;
        }
      }
      return false;
    },
  };
}
