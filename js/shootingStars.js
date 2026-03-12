import * as THREE from 'three';

export class ShootingStarSystem {
    constructor(scene) {
        this.scene = scene;
        this.stars = [];
        this.lastSpawnTime = 0;
        this.spawnInterval = 3; // roughly one every 3 seconds

        // Reusable geometry for a streak
        this.geometry = new THREE.CylinderGeometry(0.1, 1.5, 40, 8);
        this.geometry.rotateX(Math.PI / 2); // align along Z initially
        this.geometry.translate(0, 0, -20); // origin at the front tip
        this.material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
    }

    spawn() {
        const mesh = new THREE.Mesh(this.geometry, this.material.clone());
        
        // Random start position far away
        const r = 600 + Math.random() * 400;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        
        const startPos = new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            (Math.random() * 600) + 200, // mostly upper hemisphere
            r * Math.sin(phi) * Math.sin(theta)
        );

        // Target position (fly inward / slightly downward)
        const targetPos = new THREE.Vector3(
            startPos.x * 0.1 + (Math.random() * 200 - 100),
            -200,
            startPos.z * 0.1 + (Math.random() * 200 - 100)
        );

        mesh.position.copy(startPos);
        mesh.lookAt(targetPos);
        
        const speed = 400 + Math.random() * 300;
        const dist = startPos.distanceTo(targetPos);
        const lifeTime = dist / speed;

        this.scene.add(mesh);
        
        this.stars.push({
            mesh,
            startPos,
            targetPos,
            speed,
            age: 0,
            lifeTime
        });
    }

    animate(delta) {
        this.lastSpawnTime += delta;
        if (this.lastSpawnTime > this.spawnInterval) {
            if (Math.random() > 0.3) {
                this.spawn();
            }
            this.lastSpawnTime = 0;
            this.spawnInterval = 2 + Math.random() * 3; // Randomize next interval
        }

        for (let i = this.stars.length - 1; i >= 0; i--) {
            let star = this.stars[i];
            star.age += delta;
            
            if (star.age >= star.lifeTime) {
                this.scene.remove(star.mesh);
                star.mesh.material.dispose();
                this.stars.splice(i, 1);
                continue;
            }

            const t = star.age / star.lifeTime;
            star.mesh.position.lerpVectors(star.startPos, star.targetPos, t);
            
            // Fade out near the end
            if (t > 0.8) {
                star.mesh.material.opacity = (1.0 - t) * 5.0 * 0.8;
            }
        }
    }
}
