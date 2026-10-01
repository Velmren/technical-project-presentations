// Interface sound and ambience, synthesised with the Web Audio API (no files).
// Nothing plays until the player turns sound on in Settings; the audio
// context is created inside that click, so browsers never block it.

export function createAudio() {
  let ctx = null, master = null, bed = null;
  let prefs = {sound: false, volume: 0.6, uiSounds: true, ambience: true};
  let scene = 'bay';

  function ensure() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    master.gain.setTargetAtTime(prefs.volume, ctx.currentTime, 0.05);
  }

  function tone({freq, to = freq, dur = 0.08, type = 'sine', gain = 0.12, delay = 0}) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.2; }
    return buffer;
  }

  function whoosh({dur = 0.5, from = 400, to = 1600, gain = 0.1, delay = 0}) {
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    src.buffer = noiseBuffer(dur + 0.1);
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.3);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(amp).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  const cues = {
    click: () => tone({freq: 1200, to: 900, dur: 0.035, type: 'triangle', gain: 0.05}),
    select: () => { tone({freq: 660, dur: 0.05, gain: 0.06}); tone({freq: 990, dur: 0.07, gain: 0.05, delay: 0.05}); },
    confirm: () => [523, 659, 784].forEach((f, i) => tone({freq: f, dur: 0.14, gain: 0.07, delay: i * 0.06})),
    deny: () => tone({freq: 190, to: 120, dur: 0.2, type: 'sawtooth', gain: 0.04}),
    couple: () => { tone({freq: 140, to: 320, dur: 0.9, type: 'sawtooth', gain: 0.03}); whoosh({dur: 0.6, from: 300, to: 900, gain: 0.05}); tone({freq: 90, to: 60, dur: 0.18, type: 'square', gain: 0.08, delay: 0.92}); },
    move: () => whoosh({dur: 0.7, from: 250, to: 1200, gain: 0.06}),
    reward: () => { [659, 784, 988, 1319].forEach((f, i) => tone({freq: f, dur: 0.22, gain: 0.06, delay: i * 0.08})); whoosh({dur: 0.9, from: 2000, to: 6000, gain: 0.02, delay: 0.1}); },
    message: () => { tone({freq: 880, dur: 0.09, gain: 0.05}); tone({freq: 1320, dur: 0.12, gain: 0.05, delay: 0.1}); },
  };

  // Ambience: a low drive hum in the bay, thinner and airier on the map.
  function startBed() {
    stopBed();
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    const hum = ctx.createOscillator(), humGain = ctx.createGain();
    src.buffer = noiseBuffer(4);
    src.loop = true;
    filter.type = scene === 'map' ? 'highpass' : 'lowpass';
    filter.frequency.value = scene === 'map' ? 1800 : 260;
    amp.gain.value = scene === 'map' ? 0.015 : 0.05;
    hum.frequency.value = scene === 'map' ? 40 : 55;
    humGain.gain.value = scene === 'map' ? 0.004 : 0.012;
    src.connect(filter).connect(amp).connect(master);
    hum.connect(humGain).connect(master);
    src.start();
    hum.start();
    bed = {src, hum};
  }
  function stopBed() {
    if (!bed) return;
    try { bed.src.stop(); bed.hum.stop(); } catch {}
    bed = null;
  }

  return {
    setPrefs(next) {
      prefs = {...prefs, ...next};
      if (!prefs.sound) { stopBed(); if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.05); return; }
      ensure();
      if (prefs.ambience && !bed) startBed();
      if (!prefs.ambience) stopBed();
    },
    setScene(next) {
      if (next === scene) return;
      scene = next;
      if (prefs.sound && prefs.ambience && ctx) startBed();
    },
    play(name) {
      if (!prefs.sound || !prefs.uiSounds || !ctx) return;
      ensure();
      cues[name]?.();
    },
  };
}
