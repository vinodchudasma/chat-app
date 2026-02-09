class RingtoneService {
  constructor() {
    this.currentRingtone = null;
    this.volume = 0.6;
    this.isPlaying = false;
  }

  play(type = 'incoming') {
    this.stop(); // Stop any existing ringtone
    
    try {
      // Determine which ringtone to play based on type
      const ringtonePath = type === 'outgoing' 
        ? '/sounds/incoming-call.mp3'
        : '/sounds/outgoing-call.mp3';
      
      console.log(`🎵 Playing ${type} ringtone: ${ringtonePath}`);
      
      const audio = new Audio(ringtonePath);
      audio.loop = true;
      audio.volume = this.volume;
      
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            this.currentRingtone = audio;
            this.isPlaying = true;
            console.log(` Ringtone started playing`);
          })
          .catch(error => {
            console.warn('Ringtone auto-play prevented:', error);
            // Fallback: Use a simple oscillator if audio file can't play
            this.playFallbackTone(type);
          });
      }
      
      return audio;
    } catch (error) {
      console.error('Error playing ringtone:', error);
      this.playFallbackTone(type);
    }
  }

  playFallbackTone(type) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      if (type === 'incoming') {
        // Standard phone ring pattern
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.4);
        
        // Pulsing volume
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
        
        // Repeat pattern every 2 seconds
        const repeatTone = () => {
          if (!this.isPlaying) return;
          
          setTimeout(() => {
            if (!this.isPlaying) return;
            
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            
            osc.frequency.setValueAtTime(800, audioContext.currentTime);
            osc.frequency.setValueAtTime(1000, audioContext.currentTime + 0.2);
            osc.frequency.setValueAtTime(800, audioContext.currentTime + 0.4);
            
            gain.gain.setValueAtTime(0, audioContext.currentTime);
            gain.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
            
            osc.connect(gain);
            gain.connect(audioContext.destination);
            
            osc.start();
            osc.stop(audioContext.currentTime + 0.5);
            
            repeatTone();
          }, 2000);
        };
        
        repeatTone();
        
      } else if (type === 'outgoing') {
        // Continuous tone for outgoing call
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        this.currentRingtone = oscillator;
      }
      
      this.isPlaying = true;
      
    } catch (error) {
      console.error('Fallback tone error:', error);
    }
  }

  stop() {
    if (this.currentRingtone) {
      if (this.currentRingtone instanceof Audio) {
        this.currentRingtone.pause();
        this.currentRingtone.currentTime = 0;
      } else if (this.currentRingtone.stop) {
        this.currentRingtone.stop();
      }
      this.currentRingtone = null;
    }
    
    this.isPlaying = false;
    console.log('🔇 Ringtone stopped');
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.currentRingtone && this.currentRingtone instanceof Audio) {
      this.currentRingtone.volume = this.volume;
    }
  }
}

// Global instance
export const ringtoneService = new RingtoneService();