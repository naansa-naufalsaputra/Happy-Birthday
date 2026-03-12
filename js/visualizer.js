export class BeatDetector {
    constructor(audioElement) {
        this.audioElement = audioElement;
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.dataArray = null;
        this.initialized = false;

        // Settings
        this.beatThreshold = 0.15; // Adjustment based on bass volume spike
        this.beatHoldTime = 10; // Number of frames to hold the beat state
        this.beatCutOff = 0;
        this.beatDecayRate = 0.95;

        // Output values
        this.intensity = 0;
        this.isBeat = false;
        this.beatCount = 0;
    }

    init() {
        if (this.initialized) return;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;

            // Connect audio element
            this.source = this.audioContext.createMediaElementSource(this.audioElement);
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            this.initialized = true;
            console.log("🎵 BeatDetector initialized");
        } catch (e) {
            console.error("❌ Failed to initialize BeatDetector:", e);
        }
    }

    update() {
        if (!this.initialized || !this.dataArray) return;

        // Ensure context is running (needed due to browser autoplay policies)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.analyser.getByteFrequencyData(this.dataArray);

        // Focus on bass frequencies (usually the first few bins)
        // 256 fftSize / 2 = 128 bins. 44100Hz / 256 = ~172Hz per bin.
        // Bass is roughly bins 0 to 4 (up to ~688Hz)
        let bassSum = 0;
        const bassBins = 4;
        for (let i = 0; i < bassBins; i++) {
            bassSum += this.dataArray[i];
        }

        const bassAverage = bassSum / (bassBins * 255); // Normalize to 0-1

        // Simple beat detection logic
        if (bassAverage > this.beatCutOff && bassAverage > this.beatThreshold) {
            this.isBeat = true;
            this.beatCutOff = bassAverage * 1.1;
            this.beatCount++;
            this.intensity = 1.0;
        } else {
            this.isBeat = false;
            this.beatCutOff *= this.beatDecayRate;
            this.intensity *= this.beatDecayRate;
        }

        return {
            intensity: this.intensity,
            isBeat: this.isBeat,
            bass: bassAverage
        };
    }

    getIntensity() {
        return this.intensity;
    }
}
