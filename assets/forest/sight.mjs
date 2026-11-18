import * as T from '/vendor/three/three.module.min.js';

export function createSight() {
  const origin=new T.Vector3();
  const offset=new T.Vector3();
  const heroLine=new T.Vector3(), buddyLine=new T.Vector3();
  let heroDepth, buddyDepth;
  function hits(line,depth,radius,padding){
    const closest=offset.dot(line);
    return closest>-radius && closest<depth-.13 &&
      offset.lengthSq()-closest*closest<(radius+padding)**2;
  }
  return {
    update(camera,hero,buddy) {
      origin.copy(camera);
      heroLine.copy(hero).sub(origin).y+=1.03;
      buddyLine.copy(buddy).sub(origin).y+=.63;
      heroDepth=heroLine.length();
      buddyDepth=buddyLine.length();
      heroLine.divideScalar(heroDepth);
      buddyLine.divideScalar(buddyDepth);
    },
    covers(center,radius,padding=.21) {
      offset.copy(center).sub(origin);
      return hits(heroLine,heroDepth,radius,padding)||hits(buddyLine,buddyDepth,radius,padding);
    },
  };
}
