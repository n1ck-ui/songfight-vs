// SongFight Audio Engine
// Robust HTML5 Audio & Web Audio implementation with full Mobile (iOS Safari & Android Chrome) support.

class AudioManager {
  constructor() {
    this.audioEl = new Audio();
    this.audioEl.setAttribute('playsinline', 'true');
    this.audioEl.setAttribute('webkit-playsinline', 'true');
    this.audioEl.preload = 'auto';
    this.audioEl.autoplay = false;
    // Note: Do NOT set crossOrigin = 'anonymous' on mobile as CDNs with 206 Partial Content
    // or signed query URLs will fail in iOS Safari unless strictly needed by Web Audio.

    this.audioCtx = null;
    this.isMuted = false;
    this.isAudioUnlocked = false;
    this.synthInterval = null;
    this.pendingTrack = null;

    this.initAudioContextOnUserGesture();
  }

  ensureAudioContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  initAudioContextOnUserGesture() {
    const unlock = () => {
      this.unlockAudio(false);
    };

    // Use capturing listeners on window so gestures are intercepted reliably
    ['touchstart', 'touchend', 'click', 'pointerdown', 'keydown'].forEach(evt => {
      window.addEventListener(evt, unlock, { capture: true, passive: true });
    });
  }

  // Pre-warms and unlocks audio context and HTMLAudioElement for mobile browsers
  unlockAudio(playChime = false) {
    this.ensureAudioContext();

    if (!this.isAudioUnlocked) {
      // 1. Prime the HTMLAudioElement with a silent data URI
      if (!this.audioEl.src || this.audioEl.paused) {
        const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        const prevSrc = this.audioEl.src;
        this.audioEl.src = silentWav;
        const p = this.audioEl.play();
        if (p !== undefined) {
          p.then(() => {
            this.audioEl.pause();
            this.audioEl.currentTime = 0;
            this.isAudioUnlocked = true;
            if (prevSrc && !prevSrc.startsWith('data:')) {
              this.audioEl.src = prevSrc;
            }
          }).catch(() => {});
        }
      } else {
        this.isAudioUnlocked = true;
      }
    }

    if (playChime) {
      this.playTone(523.25, 'sine', 0.15, 0.25);
      setTimeout(() => this.playTone(659.25, 'sine', 0.22, 0.3), 130);
    }
  }

  playTrack(previewUrl, fallbackNotes = null, startOffset = 0) {
    this.stopTrack();
    this.ensureAudioContext();

    const offset = Math.max(0, parseFloat(startOffset) || 0);
    this.pendingTrack = { previewUrl, fallbackNotes, offset };

    if (!previewUrl) {
      this.playSyntheticMelody(fallbackNotes, offset);
      return;
    }

    // Set source directly (avoid modifying URL with media fragments like #t= on signed CDN URLs)
    this.audioEl.src = previewUrl;
    try {
      this.audioEl.volume = this.isMuted ? 0 : 0.85;
    } catch (e) {}

    if (offset > 0) {
      let seekApplied = false;
      const attemptSeek = () => {
        if (!seekApplied) {
          try {
            if (this.audioEl.currentTime < (offset - 0.5)) {
              this.audioEl.currentTime = offset;
            }
          } catch (e) {}
        }
      };

      const onPlaying = () => {
        seekApplied = true;
        this.audioEl.removeEventListener('playing', onPlaying);
      };

      this.audioEl.addEventListener('loadedmetadata', attemptSeek, { once: true });
      this.audioEl.addEventListener('canplay', attemptSeek, { once: true });
      this.audioEl.addEventListener('playing', onPlaying, { once: true });
    } else {
      try {
        this.audioEl.currentTime = 0;
      } catch (e) {}
    }

    const playPromise = this.audioEl.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.isAudioUnlocked = true;
          this.hideUnmutePrompt();
          if (this.synthInterval) {
            clearInterval(this.synthInterval);
            this.synthInterval = null;
          }
        })
        .catch(err => {
          console.warn('Autoplay restricted by mobile browser:', err);
          // Show sleek mobile unmute prompt so a single tap plays the song
          this.showUnmutePrompt();
          // Also try synthesizer fallback
          this.playSyntheticMelody(fallbackNotes, offset);
        });
    }
  }

  stopTrack() {
    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch (e) {}
      // Note: Do NOT call removeAttribute('src') or .load() here!
      // In iOS Safari, calling .load() without a src revokes the user-activation authorization.
    }
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
    this.hideUnmutePrompt();
  }

  showUnmutePrompt() {
    const btn = document.getElementById('btn-unmute-mobile');
    if (btn) btn.style.display = 'inline-flex';

    // A single tap anywhere on screen instantly resumes playback
    const oneTapResume = () => {
      this.resumePendingAudio();
      window.removeEventListener('touchstart', oneTapResume, { capture: true });
      window.removeEventListener('click', oneTapResume, { capture: true });
    };
    window.addEventListener('touchstart', oneTapResume, { capture: true, passive: true });
    window.addEventListener('click', oneTapResume, { capture: true, passive: true });
  }

  hideUnmutePrompt() {
    const btn = document.getElementById('btn-unmute-mobile');
    if (btn) btn.style.display = 'none';
  }

  resumePendingAudio() {
    this.hideUnmutePrompt();
    this.ensureAudioContext();
    if (this.audioEl && this.audioEl.src && this.audioEl.paused) {
      this.audioEl.play().then(() => {
        this.isAudioUnlocked = true;
      }).catch(e => console.warn('Audio resume failed:', e));
    }
  }

  playSyntheticMelody(notes, startOffset = 0) {
    this.ensureAudioContext();
    if (!this.audioCtx) return;

    const melody = notes && notes.length > 0 ? notes : [261.63, 329.63, 392.00, 523.25, 440.00, 349.23];
    const isPopular = startOffset > 0;
    let noteIdx = isPopular ? Math.floor(melody.length / 2) : 0;
    const toneType = isPopular ? 'square' : 'sawtooth';

    if (this.synthInterval) clearInterval(this.synthInterval);

    this.synthInterval = setInterval(() => {
      if (this.isMuted) return;
      const baseFreq = melody[noteIdx % melody.length];
      const freq = isPopular ? baseFreq * 1.25 : baseFreq;
      this.playTone(freq, toneType, 0.22, 0.12);
      noteIdx++;
    }, 420);
  }

  getFrequencyData() {
    // Generate lively, smooth animated frequencies matching current playback
    const fake = new Uint8Array(32);
    if (this.audioEl && !this.audioEl.paused) {
      const time = Date.now() / 140;
      for (let i = 0; i < fake.length; i++) {
        fake[i] = Math.max(25, Math.floor((Math.sin(time + i * 0.42) * 0.5 + 0.5) * 195 + Math.random() * 45));
      }
    }
    return fake;
  }

  // --- Sound Effects via Web Audio Synthesizer ---

  playTone(freq, type = 'sine', duration = 0.2, volume = 0.2) {
    if (this.isMuted) return;
    this.ensureAudioContext();
    if (!this.audioCtx) return;

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
    if (this.isMuted) return;
    this.ensureAudioContext();
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 'sine', 0.35, 0.25);
      }, i * 70);
    });
  }

  playIncorrectSound() {
    if (this.isMuted) return;
    this.ensureAudioContext();
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
