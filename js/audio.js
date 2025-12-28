export class RetroAudio {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
    }
    
    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = 0.3 * volume;
        }
    }

    playShoot() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playHit() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.2, now);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        
        noise.start(now);
        
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        oscGain.gain.setValueAtTime(0.3, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playDash() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playEnemyDeath(isBoss = false) {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        
        const duration = isBoss ? 0.5 : 0.2;
        const startFreq = isBoss ? 400 : 600;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + duration);
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3000, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + duration);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + duration);
        
        if (isBoss) {
            this.playExplosion();
        }
    }

    playExplosion() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        
        const bufferSize = this.ctx.sampleRate * 0.4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start(now);
        
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.5);
        oscGain.gain.setValueAtTime(0.5, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    playGemPickup() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        
        const notes = [523, 659, 784];
        
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'square';
            osc.frequency.value = freq * (0.95 + Math.random() * 0.1);
            
            const startTime = now + i * 0.05;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start(startTime);
            osc.stop(startTime + 0.1);
        });
    }

    playLevelUp() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        
        const chord = [261, 329, 392, 523];
        
        chord.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
            gain.gain.setValueAtTime(0.15, now + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 2000;
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start(now);
            osc.stop(now + 0.8);
        });
        
        const sweep = this.ctx.createOscillator();
        const sweepGain = this.ctx.createGain();
        sweep.type = 'sine';
        sweep.frequency.setValueAtTime(200, now);
        sweep.frequency.exponentialRampToValueAtTime(2000, now + 0.3);
        sweepGain.gain.setValueAtTime(0.1, now);
        sweepGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        sweep.connect(sweepGain);
        sweepGain.connect(this.masterGain);
        sweep.start(now);
        sweep.stop(now + 0.3);
    }

    playHurt() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.setValueAtTime(150, now + 0.05);
        osc.frequency.setValueAtTime(100, now + 0.1);
        
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        const distortion = this.ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i / 128) - 1;
            curve[i] = Math.tanh(x * 3);
        }
        distortion.curve = curve;
        
        osc.connect(distortion);
        distortion.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(now);
        osc.stop(now + 0.2);
    }

    playBossWarning() {
        if (!this.initialized) return;
        const now = this.ctx.currentTime;
        
        for (let i = 0; i < 3; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'square';
            const startTime = now + i * 0.3;
            osc.frequency.setValueAtTime(100, startTime);
            osc.frequency.exponentialRampToValueAtTime(200, startTime + 0.15);
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start(startTime);
            osc.stop(startTime + 0.25);
        }
    }
}

export class DynamicMusic {
    constructor(audioContext, masterGain) {
        this.ctx = audioContext;
        this.masterGain = masterGain;
        this.isPlaying = false;
        this.intensity = 0;
        this.targetIntensity = 0;
        this.bossActive = false;
        this.lowHealth = false;
        
        this.musicGain = null;
        this.layers = {};
        this.bpm = 120;
        this.beatDuration = 60 / this.bpm;
        this.currentBeat = 0;
        this.lastBeatTime = 0;
        
        this.bassPattern = [0, 0, 5, 5, 3, 3, 7, 7];
        this.bassIndex = 0;
        
        this.arpPattern = [0, 4, 7, 12, 7, 4, 0, -5];
        this.arpIndex = 0;
    }
    
    start() {
        if (this.isPlaying || !this.ctx) return;
        this.isPlaying = true;
        
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.15;
        this.musicGain.connect(this.masterGain);
        
        this.lastBeatTime = this.ctx.currentTime;
        this.scheduleBeat();
    }
    
    stop() {
        this.isPlaying = false;
    }
    
    setIntensity(value) {
        this.targetIntensity = Math.max(0, Math.min(1, value));
    }
    
    setBossActive(active) {
        this.bossActive = active;
    }
    
    setLowHealth(low) {
        this.lowHealth = low;
    }
    
    midiToFreq(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }
    
    scheduleBeat() {
        if (!this.isPlaying || !this.ctx) return;
        
        const now = this.ctx.currentTime;
        const scheduleAhead = 0.1;
        
        while (this.lastBeatTime < now + scheduleAhead) {
            this.playBeat(this.lastBeatTime);
            this.lastBeatTime += this.beatDuration / 2;
            this.currentBeat++;
        }
        
        this.intensity += (this.targetIntensity - this.intensity) * 0.02;
        
        setTimeout(() => this.scheduleBeat(), 50);
    }
    
    playBeat(time) {
        this.playBass(time);
        
        if (this.intensity > 0.2) {
            this.playArp(time);
        }
        
        if (this.currentBeat % 4 === 0) {
            this.playKick(time);
        }
        
        if (this.intensity > 0.4 && this.currentBeat % 4 === 2) {
            this.playSnare(time);
        }
        
        if (this.intensity > 0.6 && this.currentBeat % 2 === 1) {
            this.playHihat(time);
        }
        
        if (this.bossActive && this.currentBeat % 8 === 0) {
            this.playBossLayer(time);
        }
        
        if (this.lowHealth && this.currentBeat % 2 === 0) {
            this.playTensionLayer(time);
        }
    }
    
    playBass(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        const baseNote = 36;
        const note = baseNote + this.bassPattern[this.bassIndex % this.bassPattern.length];
        this.bassIndex++;
        
        osc.type = 'sawtooth';
        osc.frequency.value = this.midiToFreq(note);
        
        const volume = 0.12 * (0.5 + this.intensity * 0.5);
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + this.beatDuration * 0.9);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400 + this.intensity * 600;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        
        osc.start(time);
        osc.stop(time + this.beatDuration);
    }
    
    playArp(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        const baseNote = 60;
        const note = baseNote + this.arpPattern[this.arpIndex % this.arpPattern.length];
        this.arpIndex++;
        
        osc.type = 'square';
        osc.frequency.value = this.midiToFreq(note);
        
        const volume = 0.06 * this.intensity;
        gain.gain.setValueAtTime(volume, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + this.beatDuration * 0.4);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        
        osc.start(time);
        osc.stop(time + this.beatDuration * 0.5);
    }
    
    playKick(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, time);
        osc.frequency.exponentialRampToValueAtTime(30, time + 0.15);
        
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
        
        osc.connect(gain);
        gain.connect(this.musicGain);
        
        osc.start(time);
        osc.stop(time + 0.2);
    }
    
    playSnare(time) {
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.15 * this.intensity, time);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        
        noise.start(time);
    }
    
    playHihat(time) {
        const bufferSize = this.ctx.sampleRate * 0.05;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
        }
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08 * this.intensity, time);
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 5000;
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        
        noise.start(time);
    }
    
    playBossLayer(time) {
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.value = 55;
        osc2.type = 'sawtooth';
        osc2.frequency.value = 55.5;
        
        gain.gain.setValueAtTime(0.1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + this.beatDuration * 4);
        
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.musicGain);
        
        osc.start(time);
        osc2.start(time);
        osc.stop(time + this.beatDuration * 4);
        osc2.stop(time + this.beatDuration * 4);
    }
    
    playTensionLayer(time) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sine';
        const tensionNote = 48 + Math.floor(Math.random() * 3) * 12;
        osc.frequency.value = this.midiToFreq(tensionNote);
        
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + this.beatDuration);
        
        osc.connect(gain);
        gain.connect(this.musicGain);
        
        osc.start(time);
        osc.stop(time + this.beatDuration);
    }
}

export const audio = new RetroAudio();
