import * as T from '/vendor/three/three.module.min.js';

export const ink = '#34264a';
export const gem = '#ffc93c';

export function createChibiPaint() {
  const ramp = new T.DataTexture(new Uint8Array([118, 186, 255]), 3, 1, T.RedFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter;
  ramp.needsUpdate = true;
  const viewport = new T.Vector2(1, 1);
  const outlines = new Map();

  function toon(color, options = {}) {
    return new T.MeshToonMaterial({ color, gradientMap: ramp, ...options });
  }

  function outline(mesh, width = 1.6, color = ink) {
    const key = width + ':' + color;
    if (!outlines.has(key)) {
      outlines.set(key, new T.ShaderMaterial({
        fog: true,
        side: T.BackSide,
        uniforms: {
          ...T.UniformsUtils.clone(T.UniformsLib.fog),
          paint: { value: new T.Color(color) },
          viewport: { value: viewport },
          width: { value: width },
        },
        vertexShader: `
          uniform vec2 viewport;
          uniform float width;
          #include <skinning_pars_vertex>
          #include <fog_pars_vertex>
          void main() {
            #include <beginnormal_vertex>
            #include <skinbase_vertex>
            #include <skinnormal_vertex>
            #include <begin_vertex>
            #include <skinning_vertex>
            vec4 local = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              mat3 axes = mat3(instanceMatrix);
              objectNormal = axes * (objectNormal / max(vec3(1e-6), vec3(
                dot(axes[0], axes[0]), dot(axes[1], axes[1]), dot(axes[2], axes[2]))));
              local = instanceMatrix * local;
            #endif
            vec2 direction = (normalMatrix * objectNormal).xy;
            vec4 mvPosition = modelViewMatrix * local;
            gl_Position = projectionMatrix * mvPosition;
            float taper = clamp(8.0 / max(1.0, -mvPosition.z), .38, 1.0);
            gl_Position.xy += direction / max(.001, length(direction))
              * (2.0 * width * taper / viewport) * gl_Position.w;
            #include <fog_vertex>
          }`,
        fragmentShader: `
          uniform vec3 paint;
          #include <fog_pars_fragment>
          void main() {
            gl_FragColor = vec4(paint, 1.0);
            #include <fog_fragment>
            #include <colorspace_fragment>
          }`,
      }));
    }
    const material = outlines.get(key);
    let rim;
    if (mesh.isSkinnedMesh) {
      rim = new T.SkinnedMesh(mesh.geometry, material);
      rim.bind(mesh.skeleton, mesh.bindMatrix);
      rim.frustumCulled = false;
    } else if (mesh.isInstancedMesh) {
      rim = new T.InstancedMesh(mesh.geometry, material, mesh.count);
      rim.instanceMatrix = mesh.instanceMatrix;
    } else {
      rim = new T.Mesh(mesh.geometry, material);
    }
    rim.raycast = () => {};
    mesh.add(rim);
    return rim;
  }

  function person(root) {
    const sources = [];
    root.traverse(mesh => { if (mesh.isMesh) sources.push(mesh); });
    const materials = new Set();
    for (const mesh of sources) {
      const { color, name } = mesh.material;
      const luminous = /Chibi (eye|white|iris|pupil|screen|cheek)$/.test(name);
      const surface = luminous ? new T.MeshBasicMaterial({ color }) : toon(color);
      surface.name = name;
      mesh.material = surface;
      materials.add(surface);
      if (/^Surface_(Chibi (skin|hair|pack|shoe|shorts|shell|fin|sprout)|Tunica|Manga)$/.test(mesh.name)) {
        outline(mesh, /skin|hair|shell/.test(mesh.name) ? 2 : 1.2);
      }
    }
    return materials;
  }

  return {
    toon, outline, person,
    resize(w, h) { viewport.set(w, h); },
    dispose() {
      ramp.dispose();
      for (const material of outlines.values()) material.dispose();
    },
  };
}
