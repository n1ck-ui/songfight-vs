// SongFight Audio Engine
// Handles HTML5 audio playback, Web Audio API frequency analysis for visualizer,
// and synthesized game sound effects (no external audio files needed).

class AudioManager {
  constructor() {
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = 'anonymous';
    this.audioCtx = null;
    this.analyser = null;
    this.sourceNode = null;
    this.isMuted = false;
    this.synthInterval = null;
    this.initAudioContextOnUserGesture();
  }

  initAudioContextOnUserGesture() {
    const unlock = () => {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
          this.setupAnalyser();
        }
      } else if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  setupAnalyser() {
    if (!this.audioCtx || this.analyser) return;
    try {
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      if (!this.sourceNode && this.audioEl) {
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);
        this.sourceNode.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
      }
    } catch (e) {
      console.warn('Web Audio media source could not be attached (CORS/fallback):', e);
    }
  }

  playTrack(previewUrl, fallbackNotes = null, startOffset = 0) {
    this.stopTrack();

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const offset = Math.max(0, parseFloat(startOffset) || 0);

    if (previewUrl) {
      // Use media fragment URL for native browser offset support (#t=10)
      const mediaUrl = (offset > 0) ? `${previewUrl}#t=${offset}` : previewUrl;
      this.audioEl.src = mediaUrl;
      this.audioEl.volume = this.isMuted ? 0 : 0.85;

      if (offset > 0) {
        let seekApplied = false;
        const attemptSeek = () => {
          if (!seekApplied && this.audioEl.currentTime < (offset - 0.5)) {
            try {
              if (this.audioEl.duration && this.audioEl.duration > 0) {
                this.audioEl.currentTime = Math.min(offset, Math.max(0, this.audioEl.duration - 3));
              } else {
                this.audioEl.currentTime = offset;
              }
            } catch (e) {
              console.warn('Seek error:', e);
            }
          }
        };

        const onTimeUpdate = () => {
          if (this.audioEl.currentTime >= (offset - 0.5)) {
            seekApplied = true;
            this.audioEl.removeEventListener('timeupdate', onTimeUpdate);
            this._activeTimeUpdateListener = null;
          } else {
            attemptSeek();
          }
        };

        this._activeTimeUpdateListener = onTimeUpdate;
        this.audioEl.addEventListener('loadedmetadata', attemptSeek, { once: true });
        this.audioEl.addEventListener('canplay', attemptSeek, { once: true });
        this.audioEl.addEventListener('playing', attemptSeek, { once: true });
        this.audioEl.addEventListener('timeupdate', onTimeUpdate);
      } else {
        this.audioEl.currentTime = 0;
      }

      const playPromise = this.audioEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Autoplay prevented or network error, falling back to synthesizer:', err);
          this.playSyntheticMelody(fallbackNotes, offset);
        });
      }
    } else {
      this.playSyntheticMelody(fallbackNotes, offset);
    }
  }

  stopTrack() {
    if (this._activeTimeUpdateListener && this.audioEl) {
      this.audioEl.removeEventListener('timeupdate', this._activeTimeUpdateListener);
      this._activeTimeUpdateListener = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
    }
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }

  playSyntheticMelody(notes, startOffset = 0) {
    if (!this.audioCtx) return;
    const melody = notes && notes.length > 0 ? notes : [261.63, 329.63, 392.00, 523.25, 440.00, 349.23];
    const isPopular = startOffset > 0;
    let noteIdx = isPopular ? Math.floor(melody.length / 2) : 0;
    const toneType = isPopular ? 'square' : 'sawtooth';

    this.synthInterval = setInterval(() => {
      if (this.isMuted) return;
      const baseFreq = melody[noteIdx % melody.length];
      const freq = isPopular ? baseFreq * 1.25 : baseFreq;
      this.playTone(freq, toneType, 0.22, 0.12);
      noteIdx++;
    }, 420);
  }

  getFrequencyData() {
    if (!this.analyser) {
      // Generate dynamic fake frequencies for visualizer if Web Audio is detached
      const fake = new Uint8Array(32);
      if (this.audioEl && !this.audioEl.paused) {
        const time = Date.now() / 150;
        for (let i = 0; i < fake.length; i++) {
          fake[i] = Math.max(20, Math.floor((Math.sin(time + i * 0.4) * 0.5 + 0.5) * 190 + Math.random() * 40));
        }
      }
      return fake;
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  // --- Sound Effects via Web Audio Synthesizer ---

  playTone(freq, type = 'sine', duration = 0.2, volume = 0.2) {
    if (this.isMuted || !this.audioCtx) return;
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      console.warn('playTone error:', e);
    }
  }

  playCorrectSound() {
    if (this.isMuted || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.35, 0.25);
      }, i * 70);
    });
  }

  playIncorrectSound() {
    if (this.isMuted || !this.audioCtx) return;
    this.playTone(200, 'sawtooth', 0.25, 0.2);
    setTimeout(() => this.playTone(160, 'sawtooth', 0.3, 0.2), 120);
  }

  playCountdownTick() {
    this.playTone(880, 'triangle', 0.08, 0.15);
  }

  playFanfare3() {
    // Bronze fanfare
    [392.00, 440.00, 523.25].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.4, 0.25), i * 150);
    });
  }

  playFanfare2() {
    // Silver fanfare
    [440.00, 554.37, 659.25, 880.00].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.45, 0.3), i * 140);
    });
  }

  playFanfare1() {
    // Gold championship fanfare
    const chords = [
      { f: 523.25, t: 0 },
      { f: 659.25, t: 120 },
      { f: 783.99, t: 240 },
      { f: 1046.50, t: 380 },
      { f: 1318.51, t: 600 }
    ];
    chords.forEach(c => {
      setTimeout(() => {
        this.playTone(c.f, 'sine', 0.8, 0.35);
        this.playTone(c.f * 0.5, 'triangle', 0.8, 0.25);
      }, c.t);
    });
  }
}

window.audioManager = new AudioManager();
