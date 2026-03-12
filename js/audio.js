export class AudioManager {
    constructor() {
        // Gunakan elemen audio yang sudah ada di HTML dengan id "bgmusic"
        this.audio = document.getElementById('bgmusic');
        if (!this.audio) {
            this.audio = document.createElement('audio');
            this.audio.id = 'bgmusic';
            this.audio.loop = true;
            document.body.appendChild(this.audio);
        }
        this.isPlaying = false;
        this._setupEvents();
    }

    _setupEvents() {
        this.audio.addEventListener('play',  () => { this.isPlaying = true;  });
        this.audio.addEventListener('pause', () => { this.isPlaying = false; });
        this.audio.addEventListener('ended', () => { this.isPlaying = false; });
        this.audio.addEventListener('canplaythrough', () => {
            document.dispatchEvent(new CustomEvent('audioLoaded'));
        });
    }

    // Dipanggil dari index.html saat user double-tap / close help panel
    playOnly() {
        if (!this.audio) return;
        const p = this.audio.play();
        if (p) {
            p.then(() => { this.isPlaying = true; })
             .catch(() => {});
        }
    }

    playAudio() {
        return this.playOnly();
    }

    pauseAudio() {
        if (this.audio && !this.audio.paused) {
            this.audio.pause();
            this.isPlaying = false;
        }
    }

    setVolume(v) {
        if (this.audio) this.audio.volume = Math.max(0, Math.min(1, v));
    }

    getVolume() {
        return this.audio ? this.audio.volume : 1;
    }

    dispose() {
        this.pauseAudio();
    }
}
