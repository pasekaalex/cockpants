// Universal Sound Manager for $COCKPANTS Games
// Handles loading, playing, and managing all sound effects

class SoundManager {
  constructor() {
    this.sounds = {};
    this.enabled = localStorage.getItem('soundsEnabled') !== 'false'; // Default ON
    this.volume = parseFloat(localStorage.getItem('soundVolume') || '0.7');
    this.currentlyPlaying = new Set();
    this.loadedCount = 0;
    this.totalSounds = 0;
    console.log('[Sound Manager] Initialized');
  }

  // Load a sound file
  load(name, path) {
    console.log(`[Sound] Loading "${name}" from ${path}...`);
    const audio = new Audio(path);
    audio.volume = this.volume;
    audio.preload = 'auto';
    
    // Add load success/error handlers
    audio.addEventListener('canplaythrough', () => {
      this.loadedCount++;
      console.log(`[Sound] ✅ Loaded "${name}" (${this.loadedCount}/${this.totalSounds})`);
    });
    
    audio.addEventListener('error', (e) => {
      console.error(`[Sound] ❌ Failed to load "${name}" from ${path}:`, audio.error);
    });
    
    this.sounds[name] = audio;
  }

  // Load all sounds at once
  loadAll(soundPaths) {
    this.totalSounds = Object.keys(soundPaths).length;
    console.log(`[Sound Manager] Loading ${this.totalSounds} sounds...`);
    Object.keys(soundPaths).forEach(name => {
      this.load(name, soundPaths[name]);
    });
  }

  // Play a sound
  play(name, options = {}) {
    console.log(`[Sound] Attempting to play "${name}"...`);
    
    if (!this.enabled) {
      console.log(`[Sound] ⚠️ Sounds disabled - not playing "${name}"`);
      return;
    }
    
    if (!this.sounds[name]) {
      console.error(`[Sound] ❌ Sound "${name}" not loaded!`);
      console.log('[Sound] Available sounds:', Object.keys(this.sounds));
      return;
    }

    const sound = this.sounds[name];
    
    // Check if sound is ready
    if (sound.readyState < 2) {
      console.warn(`[Sound] ⚠️ "${name}" not ready yet (readyState: ${sound.readyState})`);
    }
    
    // Clone for overlapping sounds (optional)
    if (options.allowOverlap) {
      const clone = sound.cloneNode();
      clone.volume = this.volume * (options.volumeMultiplier || 1);
      clone.play()
        .then(() => console.log(`[Sound] ✅ Playing "${name}"`))
        .catch(err => console.error(`[Sound] ❌ Failed to play "${name}":`, err));
      return;
    }

    // Stop if already playing (prevents spam)
    if (this.currentlyPlaying.has(name)) {
      sound.pause();
      sound.currentTime = 0;
    }

    sound.volume = this.volume * (options.volumeMultiplier || 1);
    this.currentlyPlaying.add(name);
    
    console.log(`[Sound] 🔊 Attempting to play "${name}"...`);
    
    sound.play()
      .then(() => {
        console.log(`[Sound] ✅ Successfully playing "${name}"`);
        // Remove from playing set when done
        sound.onended = () => {
          this.currentlyPlaying.delete(name);
          console.log(`[Sound] ⏹️ Finished playing "${name}"`);
        };
      })
      .catch(err => {
        console.error(`[Sound] ❌ Failed to play "${name}":`, err);
        console.error('[Sound] This might be due to browser autoplay policy - user interaction required');
        this.currentlyPlaying.delete(name);
      });
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
console.log('[Sound] 🔊 Initializing Sound Manager...');
const soundManager = new SoundManager();

// Load all available sounds
console.log('[Sound] 📂 Loading all sound files...');

// Detect if we're in a subfolder (like /games/)
const isInSubfolder = window.location.pathname.includes('/games/');
const audioPath = isInSubfolder ? '../audio/' : 'audio/';

console.log('[Sound] 📍 Detected location:', window.location.pathname);
console.log('[Sound] 📂 Using audio path:', audioPath);

soundManager.loadAll({
  // Universal sounds
  'ready': audioPath + 'ready.mp3',
  'dolphin': audioPath + 'dolphin.mp3',
  'myleg': audioPath + 'myleg.mp3',
  'wawawa': audioPath + 'wawawa.mp3',
  'gary': audioPath + 'gary.mp3',
  'cash': audioPath + 'cash.mp3',
  
  // Clicker sounds
  'ohyeah': audioPath + 'ohyeah.mp3',
  'feelit': audioPath + 'feelit.mp3',
  'money': audioPath + 'money.mp3',
  
  // Plankton sounds
  'plaugh': audioPath + 'plaugh.mp3',
  'victory': audioPath + 'victory.mp3',
  'scream': audioPath + 'scream.mp3',
  
  // Boating sounds
  'drive': audioPath + 'drive.mp3',
  'puffscream': audioPath + 'puffscream.mp3',
  
  // Patrick sounds
  'ily': audioPath + 'ily.mp3',
  
  // Krusty Krab sounds
  'order': audioPath + 'order.mp3'
});

console.log('[Sound] ✅ Sound Manager ready! Enabled:', soundManager.isEnabled());
console.log('[Sound] 📊 Loaded sounds:', Object.keys(soundManager.sounds));

// Export for use in games
window.soundManager = soundManager;