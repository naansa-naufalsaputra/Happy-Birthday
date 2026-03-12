import * as THREE from 'three';

export class ConstellationSystem {
    constructor(scene, text = "I Love You") {
        this.scene = scene;
        this.text = text;
        this.particles = null;
        this.lines = null;
        this.group = new THREE.Group();
        this.scene.add(this.group);
        
        this.isActive = false;
        this.progress = 0; // for fade in

        this.init();
    }

    init() {
        // Create canvas to sample text
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // Draw text
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Choose an ethereal, thin font
        ctx.font = 'bold 130px "Times New Roman", Times, serif'; 
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, canvas.width / 2, canvas.height / 2);

        // Sample pixels
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const positions = [];
        
        // Sampling frequency
        const step = 6; // Denser points
        
        for (let y = 0; y < canvas.height; y += step) {
            for (let x = 0; x < canvas.width; x += step) {
                const idx = (y * canvas.width + x) * 4;
                // If pixel is somewhat white
                if (imgData[idx] > 100) {
                    // Normalize position to world scale, center it
                    const px = (x - canvas.width / 2) * 1.6 + (Math.random() * 8 - 4);
                    const py = -(y - canvas.height / 2) * 1.6 + (Math.random() * 8 - 4);
                    const pz = (Math.random() * 40 - 20); // Add some depth
                    positions.push(new THREE.Vector3(px, py, pz));
                }
            }
        }

        // Create Points
        const geoPoints = new THREE.BufferGeometry().setFromPoints(positions);
        
        // Custom texture for star flare
        const starCanvas = document.createElement('canvas');
        starCanvas.width = 32;
        starCanvas.height = 32;
        const starCtx = starCanvas.getContext('2d');
        const gradient = starCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.1, 'rgba(200, 220, 255, 0.9)');
        gradient.addColorStop(0.5, 'rgba(100, 150, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        starCtx.fillStyle = gradient;
        starCtx.fillRect(0, 0, 32, 32);
        const tex = new THREE.CanvasTexture(starCanvas);

        const matPoints = new THREE.PointsMaterial({
            size: 8,
            map: tex,
            transparent: true,
            opacity: 0, // initially invisible
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            color: 0xccffff
        });

        this.particles = new THREE.Points(geoPoints, matPoints);
        this.group.add(this.particles);

        // Create Lines (Connections) for the constellation web
        const linePositions = [];
        const connectionDistance = 22; // max distance between stars to connect

        for (let i = 0; i < positions.length; i++) {
            for (let j = i + 1; j < positions.length; j++) {
                const dist = positions[i].distanceTo(positions[j]);
                if (dist < connectionDistance) {
                    // Random chance to connect to keep it looking airy
                    if (Math.random() > 0.8) {
                        linePositions.push(
                            positions[i].x, positions[i].y, positions[i].z,
                            positions[j].x, positions[j].y, positions[j].z
                        );
                    }
                }
            }
        }

        const geoLines = new THREE.BufferGeometry();
        geoLines.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const matLines = new THREE.LineBasicMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0, // initially invisible
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.lines = new THREE.LineSegments(geoLines, matLines);
        this.group.add(this.lines);

        // Place it far in the background and very large
        this.group.position.set(0, 400, -900);
        this.group.scale.setScalar(1.5);
    }

    start() {
        this.isActive = true;
    }

    animate(delta, elapsed) {
        if (!this.isActive) return;

        // Fade in nicely over 4 seconds
        if (this.progress < 1) {
            this.progress += delta * 0.25; 
            if (this.progress > 1) this.progress = 1;
        }

        // Star pulsing effect
        if (this.particles) {
            const pulse = 0.5 + 0.5 * Math.sin(elapsed * 2.5);
            this.particles.material.opacity = this.progress * (0.6 + pulse * 0.4);
            
            // Audio reactivity
            let audioPulse = 0;
            if (window.beatDetector && window.beatDetector.smoothedBass > 0.4) {
               audioPulse = (window.beatDetector.smoothedBass - 0.4) * 2.0;
            }
            this.particles.material.opacity += (audioPulse * this.progress);
        }

        // Web lines pulsing effect
        if (this.lines) {
            const pulse = 0.5 + 0.5 * Math.sin(elapsed * 1.8 + Math.PI);
            this.lines.material.opacity = this.progress * (0.2 + pulse * 0.2);
            
            // Audio reactivity
            let audioPulse = 0;
            if (window.beatDetector && window.beatDetector.smoothedBass > 0.4) {
               audioPulse = (window.beatDetector.smoothedBass - 0.4) * 1.5;
            }
            this.lines.material.opacity += (audioPulse * this.progress);
        }

        // Gentle float/drift in space
        this.group.position.y = 400 + Math.sin(elapsed * 0.6) * 30;
        this.group.position.x = Math.cos(elapsed * 0.4) * 20;

        // Force look at camera so the text is always readable from the current perspective
        if (window.cameraController && window.cameraController.camera) {
             const camPos = window.cameraController.camera.position.clone();
             camPos.y = this.group.position.y; // Keep it somewhat level
             this.group.lookAt(camPos);
        }
    }
}
