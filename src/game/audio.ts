/**
 * Procedural Web Audio engine: ambients, spatial sources, SFX, bard songs.
 * No external sample files — synthesized for a self-contained deploy.
 */

import type { BardSongId, FootSurface, Zone } from "./types";

export type SpatialSourceKind = "torch" | "fountain" | "hearth";

interface SpatialSource {
  id: string;
  kind: SpatialSourceKind;
  x: number;
  y: number;
  z: number;
  panner: PannerNode;
  gain: GainNode;
  stop: () => void;
}

function midiToFreq(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private listenerReady = false;

  private spatial = new Map<string, SpatialSource>();
  private ambientStops: Array<() => void> = [];
  private songStop: (() => void) | null = null;
  private currentZone: Zone | null = null;
  private currentSong: BardSongId = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = false;

  get ready() {
    return !!this.ctx && this.ctx.state === "running";
  }

  async unlock(): Promise<boolean> {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.42;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.7;
      this.sfxBus.connect(this.master);

      this.ambientBus = this.ctx.createGain();
      this.ambientBus.gain.value = 0.55;
      this.ambientBus.connect(this.master);

      this.noiseBuf = this.makeNoiseBuffer(2);
      this.configureListener();
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.listenerReady = true;
    return this.ready;
  }

  dispose() {
    this.stopAllAmbient();
    this.stopSong();
    for (const s of this.spatial.values()) s.stop();
    this.spatial.clear();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.ambientBus = null;
    this.listenerReady = false;
    this.currentZone = null;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
  }

  private configureListener() {
    if (!this.ctx) return;
    const l = this.ctx.listener;
    if (l.positionX) {
      l.positionX.value = 0;
      l.positionY.value = 1.6;
      l.positionZ.value = 0;
      l.forwardX.value = 0;
      l.forwardY.value = 0;
      l.forwardZ.value = -1;
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
  }

  /** Player world pos + facing yaw (three.js camera yaw). */
  updateListener(wx: number, wy: number, wz: number, yaw: number) {
    if (!this.ctx || !this.listenerReady) return;
    const l = this.ctx.listener;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    if (l.positionX) {
      l.positionX.setTargetAtTime(wx, this.ctx.currentTime, 0.02);
      l.positionY.setTargetAtTime(wy, this.ctx.currentTime, 0.02);
      l.positionZ.setTargetAtTime(wz, this.ctx.currentTime, 0.02);
      l.forwardX.setTargetAtTime(fx, this.ctx.currentTime, 0.02);
      l.forwardY.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      l.forwardZ.setTargetAtTime(fz, this.ctx.currentTime, 0.02);
    } else if ("setPosition" in l) {
      const legacy = l as AudioListener & {
        setPosition: (x: number, y: number, z: number) => void;
        setOrientation: (
          fx: number,
          fy: number,
          fz: number,
          ux: number,
          uy: number,
          uz: number,
        ) => void;
      };
      legacy.setPosition(wx, wy, wz);
      legacy.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  private makeNoiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private noiseSource(loop = true): AudioBufferSourceNode {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = loop;
    return src;
  }

  setZone(zone: Zone) {
    if (zone === this.currentZone || !this.ctx) return;
    this.currentZone = zone;
    this.stopAllAmbient();
    if (zone === "wilderness") this.startWildernessAmbient();
    else if (zone === "dungeon" || zone === "crypt") this.startDungeonAmbient();
    else if (zone === "tavern") this.startTavernAmbient();
    else if (zone === "city") this.startCityAmbient();
    else if (zone === "castle") this.startCastleAmbient();
  }

  private startCityAmbient() {
    const ctx = this.ctx!;
    const bus = this.ambientBus!;
    // soft market murmur via filtered noise
    const n = this.noiseSource(true);
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 500;
    f.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.04;
    n.connect(f); f.connect(g); g.connect(bus);
    n.start();
    // distant bell-ish drone
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = 196;
    const og = ctx.createGain();
    og.gain.value = 0.015;
    o.connect(og); og.connect(bus);
    o.start();
    this.ambientStops.push(() => {
      try { n.stop(); o.stop(); } catch { /* */ }
    });
  }

  private startCastleAmbient() {
    const ctx = this.ctx!;
    const bus = this.ambientBus!;
    const n = this.noiseSource(true);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 200;
    const g = ctx.createGain();
    g.gain.value = 0.06;
    n.connect(f); f.connect(g); g.connect(bus);
    n.start();
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = 65;
    const og = ctx.createGain();
    og.gain.value = 0.025;
    o.connect(og); og.connect(bus);
    o.start();
    this.ambientStops.push(() => {
      try { n.stop(); o.stop(); } catch { /* */ }
    });
  }

  private stopAllAmbient() {
    for (const s of this.ambientStops) s();
    this.ambientStops = [];
  }

  private startWildernessAmbient() {
    const ctx = this.ctx!;
    const bus = this.ambientBus!;

    const wind = this.noiseSource(true);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.08;
    wind.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(bus);
    wind.start();

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(windFilter.frequency);
    lfo.start();

    let howlTimer = 0;
    const howlInterval = window.setInterval(() => {
      if (!this.ctx || this.currentZone !== "wilderness") return;
      howlTimer++;
      if (howlTimer % 2 === 0 || Math.random() > 0.45) this.playWolfHowl();
    }, 9000 + Math.random() * 4000);

    const pad = ctx.createOscillator();
    pad.type = "sine";
    pad.frequency.value = 98;
    const pad2 = ctx.createOscillator();
    pad2.type = "triangle";
    pad2.frequency.value = 147;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.02;
    pad.connect(padGain);
    pad2.connect(padGain);
    padGain.connect(bus);
    pad.start();
    pad2.start();

    this.ambientStops.push(() => {
      try {
        wind.stop();
        lfo.stop();
        pad.stop();
        pad2.stop();
      } catch {
        /* already stopped */
      }
      clearInterval(howlInterval);
    });
  }

  private playWolfHowl() {
    if (!this.ctx || !this.ambientBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    o.frequency.setValueAtTime(280, t);
    o.frequency.linearRampToValueAtTime(360, t + 0.8);
    o.frequency.linearRampToValueAtTime(220, t + 2.5);
    o.connect(f);
    f.connect(g);
    g.connect(this.ambientBus);
    o.start(t);
    o.stop(t + 3);
  }

  private startDungeonAmbient() {
    const ctx = this.ctx!;
    const bus = this.ambientBus!;

    const rumble = this.noiseSource(true);
    const rumbleF = ctx.createBiquadFilter();
    rumbleF.type = "lowpass";
    rumbleF.frequency.value = 90;
    const rumbleG = ctx.createGain();
    rumbleG.gain.value = 0.1;
    rumble.connect(rumbleF);
    rumbleF.connect(rumbleG);
    rumbleG.connect(bus);
    rumble.start();

    const drone = ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 48;
    const droneG = ctx.createGain();
    droneG.gain.value = 0.035;
    drone.connect(droneG);
    droneG.connect(bus);
    drone.start();

    const dripInterval = window.setInterval(() => {
      if (!this.ctx || this.currentZone !== "dungeon") return;
      if (Math.random() > 0.35) this.playDrip();
    }, 1400);

    this.ambientStops.push(() => {
      try {
        rumble.stop();
        drone.stop();
      } catch {
        /* */
      }
      clearInterval(dripInterval);
    });
  }

  private playDrip() {
    if (!this.ctx || !this.ambientBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    const g = ctx.createGain();
    const startF = 1200 + Math.random() * 800;
    o.frequency.setValueAtTime(startF, t);
    o.frequency.exponentialRampToValueAtTime(400, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    o.connect(g);
    g.connect(pan);
    pan.connect(this.ambientBus);
    o.start(t);
    o.stop(t + 0.2);
  }

  private startTavernAmbient() {
    const ctx = this.ctx!;
    const bus = this.ambientBus!;

    const room = this.noiseSource(true);
    const roomF = ctx.createBiquadFilter();
    roomF.type = "lowpass";
    roomF.frequency.value = 320;
    const roomG = ctx.createGain();
    roomG.gain.value = 0.04;
    room.connect(roomF);
    roomF.connect(roomG);
    roomG.connect(bus);
    room.start();

    const crack = this.noiseSource(true);
    const crackF = ctx.createBiquadFilter();
    crackF.type = "highpass";
    crackF.frequency.value = 900;
    const crackG = ctx.createGain();
    crackG.gain.value = 0.03;
    crack.connect(crackF);
    crackF.connect(crackG);
    crackG.connect(bus);
    crack.start();

    const o1 = ctx.createOscillator();
    o1.type = "triangle";
    o1.frequency.value = 110;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = 165;
    const pg = ctx.createGain();
    pg.gain.value = 0.025;
    o1.connect(pg);
    o2.connect(pg);
    pg.connect(bus);
    o1.start();
    o2.start();

    this.ambientStops.push(() => {
      try {
        room.stop();
        crack.stop();
        o1.stop();
        o2.stop();
      } catch {
        /* */
      }
    });
  }

  registerSpatial(id: string, kind: SpatialSourceKind, x: number, y: number, z: number) {
    if (!this.ctx || this.spatial.has(id)) return;
    const ctx = this.ctx;
    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = 2.5;
    panner.maxDistance = kind === "torch" ? 22 : 28;
    panner.rolloffFactor = 1.4;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    if (panner.positionX) {
      panner.positionX.value = x;
      panner.positionY.value = y;
      panner.positionZ.value = z;
    } else {
      panner.setPosition(x, y, z);
    }

    const gain = ctx.createGain();
    gain.gain.value = kind === "torch" ? 0.12 : kind === "fountain" ? 0.18 : 0.22;
    gain.connect(panner);
    panner.connect(this.ambientBus!);

    const stop = this.startSpatialLoop(kind, gain);
    this.spatial.set(id, { id, kind, x, y, z, panner, gain, stop });
  }

  private startSpatialLoop(kind: SpatialSourceKind, dest: GainNode): () => void {
    const ctx = this.ctx!;
    if (kind === "torch" || kind === "hearth") {
      const noise = this.noiseSource(true);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = kind === "hearth" ? 400 : 700;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = kind === "hearth" ? 900 : 1400;
      bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.value = 0.55;
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = kind === "hearth" ? 3.5 : 8;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.35;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      noise.connect(hp);
      hp.connect(bp);
      bp.connect(g);
      g.connect(dest);
      noise.start();
      lfo.start();
      const popIv = window.setInterval(() => {
        if (!this.ctx) return;
        this.playCracklePop(dest);
      }, kind === "hearth" ? 180 : 120);
      return () => {
        try {
          noise.stop();
          lfo.stop();
        } catch {
          /* */
        }
        clearInterval(popIv);
      };
    }

    const noise = this.noiseSource(true);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1100;
    bp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.value = 0.7;
    noise.connect(bp);
    bp.connect(g);
    g.connect(dest);
    noise.start();
    const bubbleIv = window.setInterval(() => {
      if (!this.ctx) return;
      this.playBubble(dest);
    }, 280);
    return () => {
      try {
        noise.stop();
      } catch {
        /* */
      }
      clearInterval(bubbleIv);
    };
  }

  private playCracklePop(dest: AudioNode) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 2000 + Math.random() * 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 + Math.random() * 0.2, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04 + Math.random() * 0.04);
    n.connect(f);
    f.connect(g);
    g.connect(dest);
    n.start(t);
    n.stop(t + 0.1);
  }

  private playBubble(dest: AudioNode) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    const f0 = 400 + Math.random() * 500;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.6, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + 0.12);
  }

  playMenuClick() {
    this.blip(880, 0.04, 0.08, "triangle");
  }

  playMenuConfirm() {
    this.blip(523, 0.05, 0.1, "sine");
    this.blip(784, 0.08, 0.12, "sine", 0.05);
  }

  playFootstep(surface: FootSurface) {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();

    if (surface === "stone" || surface === "marble" || surface === "cobble") {
      f.type = "bandpass";
      f.frequency.value = surface === "marble" ? 900 : surface === "cobble" ? 750 : 600;
      f.Q.value = 1.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    } else if (surface === "wood" || surface === "carpet") {
      f.type = "lowpass";
      f.frequency.value = 700;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = 90;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.08, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(og);
      og.connect(this.sfxBus);
      o.start(t);
      o.stop(t + 0.12);
    } else {
      f.type = "lowpass";
      f.frequency.value = surface === "mud" ? 350 : 500;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(surface === "mud" ? 0.2 : 0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    }

    n.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    n.start(t);
    n.stop(t + 0.2);
  }

  playSwordClang() {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.noiseSource(false);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    n.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
    n.start(t);
    n.stop(t + 0.3);
    for (const freq of [880, 1320, 1760]) {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = freq;
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.04, t + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 3000;
      o.connect(filt);
      filt.connect(og);
      og.connect(this.sfxBus);
      o.start(t);
      o.stop(t + 0.4);
    }
  }

  playSpellImpact() {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + 0.45);
    const n = this.noiseSource(false);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3000;
    bp.Q.value = 2;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.15, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(this.sfxBus);
    n.start(t);
    n.stop(t + 0.35);
  }

  playChestOpen() {
    this.blip(200, 0.08, 0.12, "triangle");
    this.blip(400, 0.1, 0.1, "sine", 0.08);
    this.blip(600, 0.12, 0.08, "sine", 0.16);
  }

  playDoor() {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(800, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    n.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    n.start(t);
    n.stop(t + 0.5);
  }

  playWallBump() {
    this.blip(90, 0.06, 0.15, "sine");
  }

  playSongStart(id: Exclude<BardSongId, null>) {
    if (id === "fury") {
      this.blip(392, 0.06, 0.1, "triangle");
      this.blip(494, 0.06, 0.1, "triangle", 0.07);
      this.blip(587, 0.08, 0.12, "triangle", 0.14);
    } else if (id === "watch") {
      this.blip(330, 0.1, 0.1, "sine");
      this.blip(392, 0.12, 0.1, "sine", 0.1);
      this.blip(494, 0.14, 0.1, "sine", 0.2);
    } else {
      this.blip(784, 0.08, 0.08, "sine");
      this.blip(988, 0.08, 0.08, "sine", 0.08);
      this.blip(1175, 0.1, 0.08, "sine", 0.16);
      this.blip(1568, 0.12, 0.06, "sine", 0.24);
    }
  }

  private blip(
    freq: number,
    dur: number,
    vol: number,
    type: OscillatorType,
    delay = 0,
  ) {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  playSong(id: BardSongId) {
    this.stopSong();
    this.currentSong = id;
    if (!id || !this.ctx || !this.musicBus) return;
    this.playSongStart(id);
    if (id === "fury") this.songStop = this.startFurySong();
    else if (id === "watch") this.songStop = this.startWatchSong();
    else if (id === "seeker") this.songStop = this.startSeekerSong();
  }

  stopSong() {
    if (this.songStop) {
      this.songStop();
      this.songStop = null;
    }
    this.currentSong = null;
  }

  private startFurySong(): () => void {
    const ctx = this.ctx!;
    const bus = this.musicBus!;
    const root = 62;
    const scale = [0, 2, 4, 5, 7, 9, 11, 12];
    const bpm = 118;
    const beat = 60 / bpm;
    let step = 0;
    let alive = true;

    const tick = () => {
      if (!alive || !this.ctx) return;
      const deg = scale[step % 8]!;
      const note = root + deg;
      this.pluck(midiToFreq(note), 0.14, 0.09, bus);
      if (step % 2 === 0) this.pluck(midiToFreq(note - 12), 0.18, 0.05, bus);
      if (step % 4 === 0) {
        this.fluteNote(midiToFreq(note + 12), beat * 1.5, 0.05, bus);
      }
      if (step % 2 === 0) this.percHit(step % 4 === 0 ? 80 : 180, 0.06, bus);
      step++;
    };

    tick();
    const iv = window.setInterval(tick, beat * 1000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }

  private startWatchSong(): () => void {
    const ctx = this.ctx!;
    const bus = this.musicBus!;
    const chord = [55, 59, 62, 66];
    const stops: Array<() => void> = [];

    for (const m of chord) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = midiToFreq(m);
      const g = ctx.createGain();
      g.gain.value = 0.03;
      o.connect(g);
      g.connect(bus);
      o.start();
      stops.push(() => {
        try {
          o.stop();
        } catch {
          /* */
        }
      });
    }

    let i = 0;
    const arps = [55, 59, 62, 66, 62, 59];
    const iv = window.setInterval(() => {
      if (!this.ctx) return;
      this.pluck(midiToFreq(arps[i % arps.length]!), 0.35, 0.06, bus);
      i++;
    }, 520);

    return () => {
      for (const s of stops) s();
      clearInterval(iv);
    };
  }

  private startSeekerSong(): () => void {
    const bus = this.musicBus!;
    const notes = [72, 76, 79, 84, 79, 76, 84, 88];
    let i = 0;
    const iv = window.setInterval(() => {
      if (!this.ctx) return;
      const f = midiToFreq(notes[i % notes.length]!);
      this.chime(f, 0.9, 0.07, bus);
      if (i % 3 === 0) this.chime(f * 1.5, 0.7, 0.03, bus);
      i++;
    }, 380);
    return () => clearInterval(iv);
  }

  private pluck(freq: number, dur: number, vol: number, dest: AudioNode) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sawtooth";
    o2.frequency.value = freq * 2.01;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 6, t);
    f.frequency.exponentialRampToValueAtTime(freq * 2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(dest);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.02);
    o2.stop(t + dur + 0.02);
  }

  private fluteNote(freq: number, dur: number, vol: number, dest: AudioNode) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.08);
    g.gain.linearRampToValueAtTime(vol * 0.7, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o2.connect(g);
    g.connect(dest);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.02);
    o2.stop(t + dur + 0.02);
  }

  private chime(freq: number, dur: number, vol: number, dest: AudioNode) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2.76;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    o2.connect(g);
    g.connect(dest);
    o.start(t);
    o2.start(t);
    o.stop(t + dur + 0.02);
    o2.stop(t + dur + 0.02);
  }

  private percHit(freq: number, vol: number, dest: AudioNode) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = this.noiseSource(false);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq * 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    n.connect(f);
    f.connect(g);
    g.connect(dest);
    n.start(t);
    n.stop(t + 0.1);
  }
}

export const gameAudio = new GameAudio();
