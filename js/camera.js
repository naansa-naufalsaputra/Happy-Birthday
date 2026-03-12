import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraController {
    constructor(camera, renderer) {
        this.camera = camera;
        this.controls = new OrbitControls(camera, renderer.domElement);
        this.isAnimating = false;

        this.setupControls();
        this.setupCamera();
    }

    setupControls() {
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.rotateSpeed = 0.5;
        this.controls.zoomSpeed = 1.0;
        this.controls.minPolarAngle = Math.PI * 0.1;
        this.controls.maxPolarAngle = Math.PI * 0.9;
        this.controls.enablePan = false;
    }

    setupCamera() {
        this.camera.position.set(0, 60, 200);
        this.camera.lookAt(0, 0, 0);
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    triggerAnimation(totalDuration = 22) {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this.controls.enabled = false;

        // Distribute total duration: 23% - 54% - 23%
        const d1 = totalDuration * 0.23;
        const d2 = totalDuration * 0.54;
        const d3 = totalDuration * 0.23;

        const tl = gsap.timeline({
            onComplete: () => {
                this.isAnimating = false;
                this.controls.enabled = true;
            }
        });

        const globe = window.earthGlobe ? window.earthGlobe.globe : null;

        // Stage 1: Close up swoop to Banjarmasin area
        tl.to(this.camera.position, {
            x: -20,
            y: 5,
            z: 95,
            duration: d1,
            ease: "power2.inOut",
            onUpdate: () => this.camera.lookAt(0, 0, 0)
        }, 0);

        if (globe) {
            tl.to(globe.rotation, {
                y: 4.25,
                duration: d1,
                ease: "power2.inOut"
            }, 0);
        }

        // Stage 2: Slow pan observing the cities and arc
        tl.to(this.camera.position, {
            x: 50,
            y: 20,
            z: 140,
            duration: d2,
            ease: "power1.inOut",
            onUpdate: () => this.camera.lookAt(0, 0, 0)
        }, d1);

        if (globe) {
            tl.to(globe.rotation, {
                y: 3.5,
                duration: d2,
                ease: "power1.inOut"
            }, d1);
        }

        // Stage 3: Final overview position
        tl.to(this.camera.position, {
            x: -200,
            y: 350,
            z: -600,
            duration: d3,
            ease: "power2.inOut",
            onUpdate: () => this.camera.lookAt(0, 0, 0)
        }, d1 + d2);

        if (globe) {
            tl.to(globe.rotation, {
                y: 6.0,
                duration: d3,
                ease: "power2.inOut"
            }, d1 + d2);
        }
    }

    update() {
        this.controls.update();
    }
}