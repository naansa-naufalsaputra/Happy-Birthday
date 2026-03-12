import * as THREE from 'three';

export class FireworksSystem {
    constructor(scene) {
        this.scene = scene;
        this.explosions = [];
        this.isActive = false;
        this.timer = 0;
        this.baseColorPalettes = [
            0xff0050, // TikTok red
            0xffadc7, // Pink
            0xffd700, // Gold
            0x00ffff, // Cyan
            0x88ccff  // Light blue
        ];
    }

    start() {
        this.isActive = true;
    }

    stop() {
        this.isActive = false;
    }

    explode(x, y, z, color) {
        const particleCount = 100 + Math.random() * 50;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;

            // Spherical random velocity
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            const speed = 10 + Math.random() * 20;

            velocities.push({
                x: speed * Math.sin(phi) * Math.cos(theta),
                y: speed * Math.sin(phi) * Math.sin(theta),
                z: speed * Math.cos(phi)
            });
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Create canvas for glowing spark texture
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 8);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 16, 16);
        const tex = new THREE.CanvasTexture(canvas);

        const material = new THREE.PointsMaterial({
            size: 4 + Math.random() * 3,
            color: color,
            map: tex,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            opacity: 1
        });

        const points = new THREE.Points(geometry, material);
        this.scene.add(points);

        this.explosions.push({
            points,
            velocities,
            life: 1.0, 
            decay: 0.015 + Math.random() * 0.015
        });
    }

    animate(delta) {
        if (this.isActive) {
            this.timer += delta;
            if (this.timer > 0.8) {
                // Randomly spawn somewhat around the center
                const x = (Math.random() - 0.5) * 400;
                const y = (Math.random() * 200) + 100;
                const z = (Math.random() - 0.5) * 400;
                const col = this.baseColorPalettes[Math.floor(Math.random() * this.baseColorPalettes.length)];
                
                // Explode!
                this.explode(x, y, z, col);
                
                // Also chance for a double explosion
                if (Math.random() > 0.5) {
                    setTimeout(() => {
                        this.explode(x + (Math.random() * 40 - 20), y + (Math.random() * 40 - 20), z + (Math.random() * 40 - 20), 0xffffff);
                    }, 200);
                }

                this.timer = 0;
            }
        }

        // Update explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            const positions = exp.points.geometry.attributes.position.array;
            
            exp.life -= exp.decay;

            if (exp.life <= 0) {
                this.scene.remove(exp.points);
                exp.points.geometry.dispose();
                exp.points.material.dispose();
                this.explosions.splice(i, 1);
                continue;
            }

            for (let j = 0; j < exp.velocities.length; j++) {
                // Apply gravity
                exp.velocities[j].y -= 9.8 * delta * 2.0;

                // Update position
                positions[j * 3] += exp.velocities[j].x * delta * 5.0;
                positions[j * 3 + 1] += exp.velocities[j].y * delta * 5.0;
                positions[j * 3 + 2] += exp.velocities[j].z * delta * 5.0;

                // Simple drag
                exp.velocities[j].x *= 0.95;
                exp.velocities[j].z *= 0.95;
            }

            exp.points.geometry.attributes.position.needsUpdate = true;
            exp.points.material.opacity = exp.life;
        }
    }
}
