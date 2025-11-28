// Universal Sound Manager for $COCKPANTS Games
// Handles loading, playing, and managing all sound effects

class SoundManager {
  constructor() {
    this.sounds = {};
    this.enabled = localStorage.getItem('soundsEnabled') !== 'false'; // Default ON
    this.volume = parseFloat(localStorage.getItem('soundVolume') || '0.7');
    this.currentlyPlaying = new Set();
  }

  // Load a sound file
  load(name, path) {
    const audio = new Audio(path);
    audio.volume = this.volume;
    audio.preload = 'auto';
    this.sounds[name] = audio;
  }

  // Load all sounds at once
  loadAll(soundPaths) {
    Object.keys(soundPaths).forEach(name => {
      this.load(name, soundPaths[name]);
    });
  }

  // Play a sound
  play(name, options = {}) {
    if (!this.enabled) return;
    if (!this.sounds[name]) {
      console.warn(`Sound "${name}" not loaded`);
      return;
    }

    const sound = this.sounds[name];
    
    // Clone for overlapping sounds (optional)
    if (options.allowOverlap) {
      const clone = sound.cloneNode();
      clone.volume = this.volume * (options.volumeMultiplier || 1);
      clone.play().catch(err => console.warn('Sound play failed:', err));
      return;
    }

    // Stop if already playing (prevents spam)
    if (this.currentlyPlaying.has(name)) {
      sound.pause();
      sound.currentTime = 0;
    }

    sound.volume = this.volume * (options.volumeMultiplier || 1);
    this.currentlyPlaying.add(name);
    
    sound.play()
      .then(() => {
        // Remove from playing set when done
        sound.onended = () => {
          this.currentlyPlaying.delete(name);
        };
      })
      .catch(err => console.warn('Sound play failed:', err));
  }

  // Stop a sound
  stop(name) {
    if (!this.sounds[name]) return;
    const sound = this.sounds[name];
    sound.pause();
    sound.currentTime = 0;
    this.currentlyPlaying.delete(name);
  }

  // Stop all sounds
  stopAll() {
    Object.keys(this.sounds).forEach(name => this.stop(name));
  }

  // Set volume (0.0 to 1.0)
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('soundVolume', this.volume);
    Object.values(this.sounds).forEach(sound => {
      sound.volume = this.volume;
    });
  }

  // Toggle sounds on/off
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('soundsEnabled', this.enabled);
    if (!this.enabled) {
      this.stopAll();
    }
    return this.enabled;
  }

  // Enable sounds
  enable() {
    this.enabled = true;
    localStorage.setItem('soundsEnabled', 'true');
  }

  // Disable sounds
  disable() {
    this.enabled = false;
    localStorage.setItem('soundsEnabled', 'false');
    this.stopAll();
  }

  // Check if enabled
  isEnabled() {
    return this.enabled;
  }
}

// Global sound manager instance
const soundManager = new SoundManager();

// Load all available sounds
soundManager.loadAll({
  // Universal sounds
  'ready': 'audio/ready.mp3',
  'dolphin': 'audio/dolphin.mp3',
  'myleg': 'audio/myleg.mp3',
  'wawawa': 'audio/wawawa.mp3',
  'gary': 'audio/gary.mp3',
  'cash': 'audio/cash.mp3',
  
  // Clicker sounds
  'ohyeah': 'audio/ohyeah.mp3',
  'feelit': 'audio/feelit.mp3',
  'money': 'audio/money.mp3',
  
  // Plankton sounds
  'plaugh': 'audio/plaugh.mp3',
  'victory': 'audio/victory.mp3',
  'scream': 'audio/scream.mp3',
  
  // Boating sounds
  'drive': 'audio/drive.mp3',
  'puffscream': 'audio/puffscream.mp3',
  
  // Patrick sounds
  'ily': 'audio/ily.mp3',
  
  // Krusty Krab sounds
  'order': 'audio/order.mp3'
});

// Export for use in games
window.soundManager = soundManager;