import * as THREE from "three";

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function noise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, octaves = 4): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    v += a * noise(x * f, y * f);
    a *= 0.5;
    f *= 2;
  }
  return v;
}

function makeTexture(
  size: number,
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  paint(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeDataTexture(
  size: number,
  paint: (data: Uint8ClampedArray, size: number) => void,
  colorSpace: THREE.ColorSpace = THREE.NoColorSpace,
): THREE.DataTexture {
  const data = new Uint8ClampedArray(size * size * 4);
  paint(data, size);
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = colorSpace;
  tex.needsUpdate = true;
  tex.anisotropy = 8;
  return tex;
}

export interface MaterialKit {
  stone: THREE.MeshStandardMaterial;
  moss: THREE.MeshStandardMaterial;
  marble: THREE.MeshStandardMaterial;
  grass: THREE.MeshStandardMaterial;
  path: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  torchMetal: THREE.MeshStandardMaterial;
  flame: THREE.MeshBasicMaterial;
  door: THREE.MeshStandardMaterial;
  chest: THREE.MeshStandardMaterial;
  enemy: THREE.MeshStandardMaterial;
  cobble: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  carpet: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  rune: THREE.MeshStandardMaterial;
  ruins: THREE.MeshStandardMaterial;
  teleporter: THREE.MeshStandardMaterial;
  skeleton: THREE.MeshStandardMaterial;
  banner: THREE.MeshStandardMaterial;
  dust: THREE.PointsMaterial;
  dispose: () => void;
}

export function createMaterials(): MaterialKit {
  const size = 256;

  const stoneAlbedo = makeTexture(size, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = fbm(x / 40, y / 40, 5);
        const crack = Math.abs(noise(x / 8, y / 8) - 0.5) * 0.4;
        const g = 55 + n * 50 - crack * 40;
        const i = (y * s + x) * 4;
        img.data[i] = g + 8;
        img.data[i + 1] = g + 4;
        img.data[i + 2] = g - 6;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    // mortar lines
    ctx.strokeStyle = "rgba(30,28,26,0.45)";
    ctx.lineWidth = 2;
    for (let row = 0; row < 8; row++) {
      const y = (row / 8) * s + 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(s, y);
      ctx.stroke();
      const offset = row % 2 === 0 ? 0 : s / 4;
      for (let col = 0; col < 4; col++) {
        const x = offset + (col / 4) * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + s / 8);
        ctx.stroke();
      }
    }
  });
  stoneAlbedo.repeat.set(1, 1);

  const mossAlbedo = makeTexture(size, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = fbm(x / 30, y / 30, 5);
        const moss = fbm(x / 18 + 20, y / 18, 4);
        const i = (y * s + x) * 4;
        if (moss > 0.45) {
          img.data[i] = 40 + moss * 30;
          img.data[i + 1] = 70 + moss * 50;
          img.data[i + 2] = 35 + n * 20;
        } else {
          const g = 50 + n * 40;
          img.data[i] = g;
          img.data[i + 1] = g - 5;
          img.data[i + 2] = g - 15;
        }
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const marbleAlbedo = makeTexture(size, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const vein = Math.abs(Math.sin(x * 0.04 + fbm(x / 50, y / 50, 3) * 8));
        const base = 210 + fbm(x / 60, y / 60, 3) * 30;
        const dark = vein > 0.92 ? 40 : 0;
        const i = (y * s + x) * 4;
        img.data[i] = base - dark * 2;
        img.data[i + 1] = base - dark * 2.2;
        img.data[i + 2] = base - dark * 1.5;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const grassAlbedo = makeTexture(size, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = fbm(x / 24, y / 24, 4);
        const blade = noise(x * 0.8, y * 0.15);
        const i = (y * s + x) * 4;
        img.data[i] = 35 + n * 40 + blade * 15;
        img.data[i + 1] = 70 + n * 55 + blade * 20;
        img.data[i + 2] = 30 + n * 25;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const pathAlbedo = makeTexture(size, (ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = fbm(x / 20, y / 20, 4);
        const i = (y * s + x) * 4;
        const g = 90 + n * 45;
        img.data[i] = g + 15;
        img.data[i + 1] = g + 5;
        img.data[i + 2] = g - 20;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const roughStone = makeDataTexture(size, (data, s) => {
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const r = 140 + fbm(x / 30, y / 30, 3) * 80;
        const i = (y * s + x) * 4;
        data[i] = r;
        data[i + 1] = r;
        data[i + 2] = r;
        data[i + 3] = 255;
      }
    }
  });

  const roughMarble = makeDataTexture(size, (data, s) => {
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const r = 40 + fbm(x / 40, y / 40, 2) * 30;
        const i = (y * s + x) * 4;
        data[i] = r;
        data[i + 1] = r;
        data[i + 2] = r;
        data[i + 3] = 255;
      }
    }
  });

  const normalStone = makeDataTexture(size, (data, s) => {
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const hL = fbm((x - 1) / 20, y / 20, 3);
        const hR = fbm((x + 1) / 20, y / 20, 3);
        const hD = fbm(x / 20, (y - 1) / 20, 3);
        const hU = fbm(x / 20, (y + 1) / 20, 3);
        const dx = (hL - hR) * 2;
        const dy = (hD - hU) * 2;
        const len = Math.hypot(dx, dy, 1) || 1;
        const i = (y * s + x) * 4;
        data[i] = ((dx / len) * 0.5 + 0.5) * 255;
        data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
        data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        data[i + 3] = 255;
      }
    }
  });

  const stone = new THREE.MeshStandardMaterial({
    map: stoneAlbedo,
    roughnessMap: roughStone,
    normalMap: normalStone,
    roughness: 0.92,
    metalness: 0.05,
    color: 0xc8c4be,
  });

  const moss = new THREE.MeshStandardMaterial({
    map: mossAlbedo,
    roughnessMap: roughStone,
    normalMap: normalStone,
    roughness: 0.95,
    metalness: 0.02,
    color: 0xb8c8a8,
  });

  const marble = new THREE.MeshStandardMaterial({
    map: marbleAlbedo,
    roughnessMap: roughMarble,
    roughness: 0.25,
    metalness: 0.08,
    color: 0xffffff,
  });

  const grass = new THREE.MeshStandardMaterial({
    map: grassAlbedo,
    roughness: 0.9,
    metalness: 0,
    color: 0xa8c090,
  });

  const path = new THREE.MeshStandardMaterial({
    map: pathAlbedo,
    roughness: 0.88,
    metalness: 0.02,
    color: 0xd0c0a0,
  });

  const wood = new THREE.MeshStandardMaterial({
    color: 0x4a3422,
    roughness: 0.85,
    metalness: 0.05,
  });

  const ceiling = new THREE.MeshStandardMaterial({
    color: 0x2a2826,
    roughness: 0.95,
    metalness: 0.02,
  });

  const torchMetal = new THREE.MeshStandardMaterial({
    color: 0x6a6558,
    roughness: 0.45,
    metalness: 0.7,
  });

  const flame = new THREE.MeshBasicMaterial({
    color: 0xffaa44,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const door = new THREE.MeshStandardMaterial({
    color: 0x5a4030,
    roughness: 0.7,
    metalness: 0.15,
  });

  const chest = new THREE.MeshStandardMaterial({
    color: 0x8a6a28,
    roughness: 0.5,
    metalness: 0.35,
  });

  const enemy = new THREE.MeshStandardMaterial({
    color: 0x6a3a3a,
    roughness: 0.7,
    metalness: 0.1,
    emissive: 0x220808,
    emissiveIntensity: 0.35,
  });


  const materials: THREE.Material[] = [
    stone, moss, marble, grass, path, wood, ceiling, torchMetal, flame, door, chest, enemy,
  ];

  const cobbleMap = makeTexture(128, (ctx, s) => {
    ctx.fillStyle = "#4a4540";
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 16) {
      for (let x = 0; x < s; x += 16) {
        const ox = (Math.floor(y / 16) % 2) * 8;
        const n = fbm(x * 0.1, y * 0.1, 2);
        ctx.fillStyle = `rgb(${70 + n * 40},${65 + n * 30},${55 + n * 25})`;
        ctx.fillRect(x + ox + 1, y + 1, 14, 14);
        ctx.strokeStyle = "#2a2824";
        ctx.strokeRect(x + ox + 1, y + 1, 14, 14);
      }
    }
  });
  const cobble = new THREE.MeshStandardMaterial({ map: cobbleMap, roughness: 0.92, metalness: 0.02, color: 0xb0a898 });
  materials.push(cobble);

  const timberMap = makeTexture(128, (ctx, s) => {
    ctx.fillStyle = "#3a2818";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      const x = (i * 17) % s;
      ctx.strokeStyle = `rgba(${80 + (i % 20)},${50 + (i % 15)},${30},0.5)`;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 4, s);
      ctx.stroke();
    }
    for (let y = 20; y < s; y += 40) {
      for (let x = 10; x < s; x += 36) {
        ctx.fillStyle = "rgba(200,190,170,0.25)";
        ctx.fillRect(x, y, 28, 28);
      }
    }
  });
  const timber = new THREE.MeshStandardMaterial({ map: timberMap, roughness: 0.88, metalness: 0.0, color: 0xc4a882 });
  materials.push(timber);

  const carpetMap = makeTexture(64, (ctx, s) => {
    ctx.fillStyle = "#4a1820";
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#6a2030" : "#5a1828";
      ctx.fillRect(i * 8, 0, 8, s);
    }
    ctx.strokeStyle = "#8a6a30";
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, s - 12, s - 12);
  });
  const carpet = new THREE.MeshStandardMaterial({ map: carpetMap, roughness: 0.95, metalness: 0, color: 0x9a4050 });
  materials.push(carpet);

  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.55, metalness: 0.75 });
  materials.push(iron);

  const water = new THREE.MeshStandardMaterial({
    color: 0x2a5a7a, roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.72,
  });
  materials.push(water);

  const runeMap = makeTexture(64, (ctx, s) => {
    ctx.fillStyle = "#1a1c18";
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "#3a8a4a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s / 2, 10);
    ctx.lineTo(s / 2, s - 10);
    ctx.moveTo(10, s / 2);
    ctx.lineTo(s - 10, s / 2);
    ctx.stroke();
    ctx.fillStyle = "#4aca5a";
    ctx.fillRect(s / 2 - 2, s / 2 - 2, 4, 4);
  });
  const rune = new THREE.MeshStandardMaterial({
    map: runeMap, roughness: 0.7, metalness: 0.15, emissive: 0x1a4a20, emissiveIntensity: 0.55, color: 0x8aaa80,
  });
  materials.push(rune);

  const ruins = new THREE.MeshStandardMaterial({ color: 0x6a6560, roughness: 0.95, metalness: 0.05 });
  materials.push(ruins);

  const teleporter = new THREE.MeshStandardMaterial({
    color: 0x4080ff, roughness: 0.25, metalness: 0.4, emissive: 0x2060ff, emissiveIntensity: 0.85, transparent: true, opacity: 0.85,
  });
  materials.push(teleporter);

  const skeleton = new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.85, metalness: 0.05 });
  materials.push(skeleton);

  const banner = new THREE.MeshStandardMaterial({ color: 0x6a2030, roughness: 0.9, metalness: 0.05 });
  materials.push(banner);

  const dust = new THREE.PointsMaterial({
    color: 0xc8c0a0, size: 0.06, transparent: true, opacity: 0.45, depthWrite: false,
  });
  materials.push(dust);

  const textures = [stoneAlbedo, mossAlbedo, marbleAlbedo, grassAlbedo, pathAlbedo, roughStone, roughMarble, normalStone, cobbleMap, timberMap, carpetMap, runeMap];


  return {
    stone,
    moss,
    marble,
    grass,
    path,
    wood,
    ceiling,
    torchMetal,
    flame,
    door,
    chest,
    enemy,
    cobble,
    timber,
    carpet,
    iron,
    water,
    rune,
    ruins,
    teleporter,
    skeleton,
    banner,
    dust,
    dispose() {
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
