import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { GraphicsSettings } from "./types";

/** Lightweight SSAO-ish darkening of creases via depth-ish luminance heuristic */
const AOShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    intensity: { value: 0.35 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float intensity;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      // darken mid-lows slightly to fake contact shadow
      float ao = smoothstep(0.05, 0.45, lum);
      c.rgb *= mix(1.0 - intensity * 0.55, 1.0, ao);
      gl_FragColor = c;
    }
  `,
};

/** Cheap depth-of-field: radial blur away from center */
const DofShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    strength: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float strength;
    varying vec2 vUv;
    void main() {
      vec2 center = vec2(0.5, 0.48);
      float dist = distance(vUv, center);
      float blur = smoothstep(0.18, 0.72, dist) * strength;
      vec4 sum = vec4(0.0);
      vec2 dir = normalize(vUv - center + 1e-5) * blur * 0.012;
      sum += texture2D(tDiffuse, vUv - dir * 2.0) * 0.12;
      sum += texture2D(tDiffuse, vUv - dir) * 0.22;
      sum += texture2D(tDiffuse, vUv) * 0.32;
      sum += texture2D(tDiffuse, vUv + dir) * 0.22;
      sum += texture2D(tDiffuse, vUv + dir * 2.0) * 0.12;
      gl_FragColor = sum;
    }
  `,
};

export class PostFxPipeline {
  composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private ao: ShaderPass;
  private dof: ShaderPass;
  private enabled = true;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(size.clone(), 0.45, 0.55, 0.82);
    this.composer.addPass(this.bloom);

    this.ao = new ShaderPass(AOShader);
    this.composer.addPass(this.ao);

    this.dof = new ShaderPass(DofShader);
    this.composer.addPass(this.dof);

    this.composer.addPass(new OutputPass());
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
  }

  applySettings(g: GraphicsSettings) {
    this.bloom.enabled = g.bloom;
    this.bloom.strength = g.bloom ? 0.48 : 0;
    this.ao.enabled = g.ambientOcclusion;
    this.ao.uniforms.intensity.value = g.ambientOcclusion ? 0.38 : 0;
    this.dof.enabled = g.depthOfField;
    this.dof.uniforms.strength.value = g.depthOfField ? 1.0 : 0.0;
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
  }
}
