/**
 * Utils for producing sound effects positioned in 3D.
 * @param {=AudioContext} opt_audioContext
 * @constructor
 */
function SoundFx(opt_audioContext) {
  this.ctx = opt_audioContext || SoundFx.getAudioContext();
  if (this.ctx) {
    if (!(this.ctx.createGain || this.ctx.createGainNode) || !this.ctx.createOscillator) {
      this.ctx = null;
    }
  }
  if (this.ctx) {
    this.masterGain = this.createGain();
    this.masterGain.connect(this.ctx.destination);
  }
}

SoundFx.audioContext = null;

SoundFx.getAudioContext = function() {
  if (SoundFx.audioContext != null) {
    return SoundFx.audioContext;
  } else if (typeof AudioContext !== 'undefined') {
    SoundFx.audioContext = new AudioContext();
  } else if (typeof webkitAudioContext !== 'undefined') {
    SoundFx.audioContext = new webkitAudioContext();
  }
  return SoundFx.audioContext;
};

SoundFx.prototype.createGain = function() {
  if (this.ctx.createGain) {
    return this.ctx.createGain();
  }
  if (this.ctx.createGainNode) {
    return this.ctx.createGainNode();
  }
  return null;
};

SoundFx.prototype.setListenerXYZ = function(x, y, z) {
  if (!this.ctx) return;
  this.ctx.listener.setPosition(x, y, z);
};

SoundFx.prototype.getMasterGain = function() {
  return this.masterGain;
};

/**
 * Make a simple one-shot sound.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} vol
 * @param {number} attack
 * @param {number} sustain
 * @param {number} decay
 * @param {number} freq1
 * @param {number} freq2
 * @param {String} type Wave type string (square, sine, etc)
 * @param {!number} opt_delay optional delay value, before attack
 * @return freshly created oscillator node
 */
SoundFx.prototype.sound = function(x, y, z, vol, attack, sustain, decay, freq1, freq2, type, opt_delay) {
  if (!this.ctx) return;
  if (this.ctx.state != 'running') {
    this.ctx.resume();
  }
  let delay = opt_delay || 0;
  let c = this.ctx;
  let t0 = c.currentTime + delay;
  let t1 = t0 + attack + sustain + decay;
  let gain = this.createGain();
  if (attack) {
    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  }
  gain.gain.setValueAtTime(vol, t0 + attack);
  if (sustain) {
    gain.gain.setValueAtTime(vol, t0 + attack + sustain);
  }
  if (decay) {
    gain.gain.exponentialRampToValueAtTime(0.01, t0 + attack + sustain + decay);
  }

  let osc = this.createOscillator();
  osc.frequency.setValueAtTime(freq1, t0);
  osc.frequency.exponentialRampToValueAtTime(freq2, t0 + attack + sustain + decay);
  osc.type = type;
  osc.start(t0);
  osc.stop(t1);

  let panner = c.createPanner();
  panner.setPosition(x, y, z);

  osc.connect(gain);
  gain.connect(panner);
  panner.connect(this.masterGain);
  return osc;
};

SoundFx.prototype.createOscillator = function() {
  let osc = this.ctx.createOscillator();
  if (!osc.start) osc.start = osc.noteOn;
  if (!osc.stop) osc.start = osc.noteOff;
  return osc;
};

/**
 * Returns gain and panner nodes, connected to each other and to the master gain like
 * gain -> panner -> master.
 * @returns {*} an object with "gain" and "panner" fields, or null
 */
SoundFx.prototype.createGainAndPanner = function() {
  if (!this.ctx) return null;
  let c = this.ctx;
  let r = {};
  r.gain = this.createGain();
  r.panner = c.createPanner();
  r.gain.connect(r.panner);
  r.panner.connect(this.masterGain);
  return r;
};

/**
 * Makes a sound with no attack, decay, or frequency changes.
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} vol
 * @param {number} sustain
 * @param {number} freq
 * @param {String} opt_type Wave type string (square, sine, etc). Default is sine
 */
SoundFx.prototype.note = function(x, y, z, vol, sustain, freq, opt_type) {
  let type = opt_type || 'sine';
  this.sound(x, y, z, vol, 0, sustain, 0, freq, freq, type);
};

SoundFx.prototype.disconnect = function() {
  if (this.masterGain) {
    this.masterGain.gain = 0;
    this.masterGain.disconnect();
    this.masterGain = null;
  }
};

