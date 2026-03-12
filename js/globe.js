import * as THREE from 'three';

/**
 * EarthGlobe – Aceternity-inspired 3D globe with Blue Marble texture,
 * Fresnel atmosphere glow, city pin markers and arc line.
 * Replaces the previous textured-sphere implementation.
 */
export class EarthGlobe {
    constructor(scene) {
        this.scene = scene;
        this.GLOBE_RADIUS = 60; // Reduced to 60 to prevent clipping with particle ring
        this.globeGroup = null;
        this.globe = null;
        this.clouds = null;
        this.clock = new THREE.Clock();
        this.arcPoints = [];

        // City coordinates (lat, lon) in degrees
        // Banjarmasin: -3.3194°, 114.5908°
        // Semarang:    -6.9932°, 110.4229°
        this.cities = [
            { name: 'Banjarmasin', lat: -3.3194, lon: 114.5908, color: 0xff6b6b },
            { name: 'Semarang', lat: -6.9932, lon: 110.4229, color: 0xffd700 }
        ];

        this.autoRotateSpeed = 0.002;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2(-1, -1);

        // Set up mouse move listener
        window.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });

        // Set up touch move listener for mobile
        window.addEventListener('touchstart', (event) => {
            if (event.touches.length > 0) {
                this.mouse.x = (event.touches[0].clientX / window.innerWidth) * 2 - 1;
                this.mouse.y = -(event.touches[0].clientY / window.innerHeight) * 2 + 1;
            }
        });

        this.createGlobe();
    }

    /**
     * Convert lat/lon to 3D position on a sphere surface
     */
    latLonToVec3(lat, lon, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(
            -(radius * Math.sin(phi) * Math.cos(theta)),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
        );
    }

    createGlobe() {
        this.globeGroup = new THREE.Group();
        this.globeGroup.position.set(0, 0, 0);

        const textureLoader = new THREE.TextureLoader();

        // ── Earth sphere (Aceternity-style: Blue Marble + bump) ────────────────
        const earthGeo = new THREE.SphereGeometry(this.GLOBE_RADIUS, 64, 64);

        const earthTexture = textureLoader.load(
            'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
            (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.anisotropy = 16;
            },
            undefined,
            () => {
                // fallback: solid dark blue if texture fails
                globeMat.color.set(0x1a1a2e);
            }
        );

        const bumpTexture = textureLoader.load(
            'https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png',
            (tex) => {
                tex.anisotropy = 8;
            },
            undefined,
            () => { } // silently ignore bump failures
        );

        const globeMat = new THREE.MeshStandardMaterial({
            map: earthTexture,
            bumpMap: bumpTexture,
            bumpScale: 0.25,      // Aceternity demo uses bumpScale=5 → 5*0.05=0.25
            roughness: 0.7,
            metalness: 0.1,
            color: 0x4444ff, // Default bright blue base color
        });
        this.globe = new THREE.Mesh(earthGeo, globeMat);
        this.globeGroup.add(this.globe);

        // ── Cloud layer ────────────────────────────────────────────────────────
        const cloudTexture = textureLoader.load(
            'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_clouds_1024.png',
            undefined,
            undefined,
            () => { } // silently ignore cloud texture failures
        );
        const cloudGeo = new THREE.SphereGeometry(this.GLOBE_RADIUS * 1.015, 48, 48);
        const cloudMat = new THREE.MeshStandardMaterial({
            map: cloudTexture,
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
        });
        this.clouds = new THREE.Mesh(cloudGeo, cloudMat);
        // Add clouds to globe so they rotate together, we'll animate them slightly faster in animate()
        this.globe.add(this.clouds);

        // ── City pin markers (Aceternity-style: cone base + stem) ──────────────
        this.cityObjects = [];
        this.cities.forEach(city => {
            const surfacePos = this.latLonToVec3(city.lat, city.lon, this.GLOBE_RADIUS);
            const normal = surfacePos.clone().normalize();

            // Pin base (cone pointing outward)
            const coneHeight = 1.4;
            const coneGeo = new THREE.ConeGeometry(0.55, coneHeight, 8);
            const coneMat = new THREE.MeshStandardMaterial({
                color: city.color,
                emissive: city.color,
                emissiveIntensity: 0.6,
                roughness: 0.3,
            });
            const cone = new THREE.Mesh(coneGeo, coneMat);
            // Position cone base on globe surface, tip pointing outward
            const conePos = surfacePos.clone().add(normal.clone().multiplyScalar(coneHeight * 0.5));
            cone.position.copy(conePos);
            // Orient cone to point away from globe center
            cone.lookAt(conePos.clone().add(normal));
            cone.rotateX(Math.PI / 2);
            this.globe.add(cone); // Added directly to globe mesh so it rotates perfectly with the earth texture

            // Pin stem (thin cylinder extending outward)
            const stemHeight = 3.5;
            const stemGeo = new THREE.CylinderGeometry(0.12, 0.12, stemHeight, 8);
            const stemMat = new THREE.MeshStandardMaterial({
                color: 0x94a3b8,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
            });
            const stem = new THREE.Mesh(stemGeo, stemMat);
            const stemPos = surfacePos.clone().add(normal.clone().multiplyScalar(coneHeight + stemHeight * 0.5));
            stem.position.copy(stemPos);
            // Orient stem to point away from globe center
            stem.lookAt(stemPos.clone().add(normal));
            stem.rotateX(Math.PI / 2);
            this.globe.add(stem); 

            // Pulsing glow ring at pin tip
            const ringRadius = 1.0;
            const ringGeo = new THREE.RingGeometry(ringRadius * 0.7, ringRadius, 32);
            const ringMat = new THREE.MeshBasicMaterial({
                color: city.color,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            const ringPos = surfacePos.clone().add(normal.clone().multiplyScalar(coneHeight + stemHeight));
            ring.position.copy(ringPos);
            ring.lookAt(new THREE.Vector3(0, 0, 0));
            ring.rotateX(Math.PI / 2);
            this.globe.add(ring);

            // Add reference data for raycaster
            cone.userData = { cityName: city.name, cityObj: null };
            stem.userData = { cityName: city.name, cityObj: null };
            ring.userData = { cityName: city.name, cityObj: null };

            const cityObj = { cityName: city.name, cone, stem, ring, baseColor: city.color };
            cone.userData.cityObj = cityObj;
            stem.userData.cityObj = cityObj;
            ring.userData.cityObj = cityObj;

            this.cityObjects.push(cityObj);
        });

        // ── Arc line between Banjarmasin and Semarang ──────────────────────────
        this.createArcLine();

        // ── Aurora Borealis (Cinta) ────────────────────────────────────────────
        this.createAurora();

        // ── Lighting (Aceternity-style: key + fill + ambient) ──────────────────
        // Key light (sun)
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
        keyLight.position.set(
            this.GLOBE_RADIUS * 2.3,
            this.GLOBE_RADIUS * 0.6,
            this.GLOBE_RADIUS * 2.3
        );
        this.globeGroup.add(keyLight);

        // Fill light (blue sky bounce)
        const fillLight = new THREE.DirectionalLight(0x88ccff, 0.45);
        fillLight.position.set(
            -this.GLOBE_RADIUS * 1.7,
            this.GLOBE_RADIUS * 0.6,
            -this.GLOBE_RADIUS * 1.1
        );
        this.globeGroup.add(fillLight);

        // Ambient
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.globeGroup.add(ambientLight);

        // Add globe group to scene
        this.scene.add(this.globeGroup);
        // Set initial orientation so Banjarmasin and Semarang face front
        if (this.globe) {
            this.globe.rotation.y = 4.0; 
        }
        
        // Do not assign to window.heart3D, because sphere.js hides window.heart3D at the beginning!
        if (window.centralSphere && window.centralSphere.applyCentralHeartState) {
            window.centralSphere.applyCentralHeartState(false);
        }

        // Signal ready
        try {
            document.dispatchEvent(new CustomEvent('heart3d_ready'));
        } catch (_) { }

        console.log('🌍 EarthGlobe loaded successfully!');
    }

    createArcLine() {
        const posA = this.latLonToVec3(
            this.cities[0].lat, this.cities[0].lon, this.GLOBE_RADIUS
        );
        const posB = this.latLonToVec3(
            this.cities[1].lat, this.cities[1].lon, this.GLOBE_RADIUS
        );

        // Build a curved arc above the globe surface
        const arcHeight = this.GLOBE_RADIUS * 0.45;
        const segments = 60;
        const points = [];

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const interp = new THREE.Vector3().lerpVectors(posA, posB, t).normalize();
            const lift = 1 + (arcHeight / this.GLOBE_RADIUS) * Math.sin(Math.PI * t);
            interp.multiplyScalar(this.GLOBE_RADIUS * lift);
            points.push(interp);
        }

        const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
        const arcMat = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            linewidth: 2,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
        });
        const arcLine = new THREE.Line(arcGeo, arcMat);
        this.globe.add(arcLine); // Added to globe so it rotates perfectly
        this.arcLine = arcLine;

        // Animated paper plane along the arc
        const planeLength = 3.2;
        const particleGeo = new THREE.ConeGeometry(1.0, planeLength, 4);
        particleGeo.rotateX(Math.PI / 2); // Point the tip forward along Z axis
        const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.arcParticle = new THREE.Mesh(particleGeo, particleMat);
        this.globe.add(this.arcParticle); // Added to globe
        this.arcPoints = points;
        this.arcT = 0;

        // Add trail system
        this.trailGroup = new THREE.Group();
        this.globe.add(this.trailGroup);
        this.trailParticles = [];
    }

    createAurora() {
        // Create an equatorial/aurora ring slightly larger than the globe
        const ringGeo = new THREE.CylinderGeometry(this.GLOBE_RADIUS * 1.05, this.GLOBE_RADIUS * 1.05, this.GLOBE_RADIUS * 0.6, 64, 1, true);
        
        this.auroraUniforms = {
            time: { value: 0 },
            color1: { value: new THREE.Color(0x00ffcc) }, // Cyan-ish
            color2: { value: new THREE.Color(0xff6bca) }  // Pink-ish
        };

        const auroraMat = new THREE.ShaderMaterial({
            uniforms: this.auroraUniforms,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 color1;
                uniform vec3 color2;
                varying vec2 vUv;
                
                // Simple pseudo-random for noise
                float hash(float n) { return fract(sin(n) * 43758.5453123); }
                float noise(vec2 x) {
                    vec2 p = floor(x);
                    vec2 f = fract(x);
                    f = f * f * (3.0 - 2.0 * f);
                    float n = p.x + p.y * 57.0;
                    return mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
                               mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
                }

                void main() {
                    // Wavy vertical stripes
                    float wave = sin(vUv.x * 20.0 + time * 0.5) * 0.5 + 0.5;
                    float n = noise(vec2(vUv.x * 10.0, vUv.y * 10.0 + time));
                    
                    // Fade out at top and bottom edges 
                    float edgeAlpha = smoothstep(0.0, 0.4, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
                    
                    vec3 finalColor = mix(color1, color2, wave + n * 0.3);
                    
                    // Pulse alpha
                    float alpha = edgeAlpha * (0.3 + 0.7 * sin(time * 2.0 + vUv.x * 15.0));
                    
                    // Overall transparency
                    gl_FragColor = vec4(finalColor, alpha * 0.5); // 0.5 max opacity
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.auroraMesh = new THREE.Mesh(ringGeo, auroraMat);
        
        // Tilt the aurora ring so it wraps beautifully across Indonesia
        this.auroraMesh.rotation.x = 0.2;
        this.auroraMesh.rotation.z = -0.1;
        
        this.globe.add(this.auroraMesh);
    }

    animate() {
        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        if (this.auroraUniforms) {
            this.auroraUniforms.time.value = elapsed;
        }

        if (this.clouds) {
            this.clouds.rotation.y += this.autoRotateSpeed * 1.15;
        }

        // Pause auto-rotation during cinematic camera intro
        const isAnimating = window.cameraController && window.cameraController.isAnimating;
        if (this.globe && !isAnimating) {
            this.globe.rotation.y += this.autoRotateSpeed;
        }

        // Hover Tooltips with Raycaster
        if (window.cameraController && window.cameraController.camera) {
            const cam = window.cameraController.camera;
            this.raycaster.setFromCamera(this.mouse, cam);

            // Create flat array of hittable objects
            let hitObjects = [];
            if (this.cityObjects) {
                this.cityObjects.forEach(obj => {
                    if (obj.cone && obj.stem && obj.ring) {
                        hitObjects.push(obj.cone, obj.stem, obj.ring);
                    }
                });
            }

            const intersects = this.raycaster.intersectObjects(hitObjects);
            
            // Reset hover state
            this.cities.forEach(c => {
               const el = document.getElementById(`tooltip-${c.name}`);
               if (el) {
                   el.classList.remove('visible');
                   el.style.zIndex = '1000';
               }
            });

            let isHovered = false;
            if (intersects.length > 0) {
                const hit = intersects[0].object;
                const cityName = hit.userData.cityName;
                const cityObj = hit.userData.cityObj;

                if (cityName) {
                    isHovered = true;
                    // Pulse ring intensely on hover
                    if (cityObj && cityObj.ring) {
                        cityObj.ring.material.opacity = 0.8;
                        cityObj.ring.scale.setScalar(1.5);
                    }

                    const el = document.getElementById(`tooltip-${cityName}`);
                    if (el) {
                        el.classList.add('visible');
                        el.style.zIndex = '1000000'; // Bring to front
                        
                        // Project 3D pos to 2D screen
                        const worldPos = new THREE.Vector3();
                        if (cityObj && cityObj.ring) {
                            cityObj.ring.getWorldPosition(worldPos);
                        } else {
                            hit.getWorldPosition(worldPos);
                        }
                        worldPos.project(cam);
                        
                        const x = (worldPos.x * .5 + .5) * window.innerWidth;
                        const y = (worldPos.y * -.5 + .5) * window.innerHeight;
                        
                        el.style.left = `${x}px`;
                        el.style.top = `${y}px`;
                    }
                }
            }

            // Normal Pulsing rings on city pins if not hovered
            if (this.cityObjects) {
                this.cityObjects.forEach((obj, idx) => {
                    // Skip if currently being hovered
                    if (isHovered && intersects.length > 0 && intersects[0].object.userData.cityName === obj.cityName) return;
                    
                    const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3 + idx * Math.PI);
                    
                    // Audio reactivity for rings
                    let audioPulse = 0;
                    if (window.beatDetector && window.beatDetector.smoothedBass > 0.5) {
                        audioPulse = (window.beatDetector.smoothedBass - 0.5) * 2.0; // scales 0 to 1
                    }

                    obj.ring.material.opacity = 0.3 + 0.5 * pulse + (audioPulse * 0.4);
                    const scale = 1 + 0.3 * pulse + (audioPulse * 0.8);
                    obj.ring.scale.setScalar(scale);
                });
            }
        }
        
        // Audio reactivity for arc line and aurora
        if (window.beatDetector) {
             let bassPulse = 0;
             if (window.beatDetector.smoothedBass > 0.4) {
                 bassPulse = (window.beatDetector.smoothedBass - 0.4) * 1.5;
             }
             if (this.arcLine) {
                 this.arcLine.material.opacity = 0.5 + bassPulse;
             }
             if (this.auroraMesh && this.auroraUniforms) {
                 // Aurora pulses with beat!
                 this.auroraMesh.material.opacity = 1.0 + bassPulse * 2.0;
             }
        }

        // Arc particle animation (Paper Plane & Trail)
        if (this.arcParticle && this.arcPoints.length > 0) {
            // Slower animation speed: 0.002 instead of 0.005
            this.arcT = (this.arcT + 0.002) % 1;
            const idx = Math.floor(this.arcT * (this.arcPoints.length - 1));
            const frac = this.arcT * (this.arcPoints.length - 1) - idx;
            const pA = this.arcPoints[idx];
            const pB = this.arcPoints[Math.min(idx + 1, this.arcPoints.length - 1)];
            this.arcParticle.position.lerpVectors(pA, pB, frac);

            // Orient plane towards travel direction
            if (idx < this.arcPoints.length - 1) {
                const lookTarget = this.arcPoints[idx + 1].clone();
                const worldPosTarget = lookTarget.clone();
                this.globe.localToWorld(worldPosTarget);
                this.arcParticle.lookAt(worldPosTarget);
            }

            // Spawn Heart Trail Particle sporadically
            if (Math.random() < 0.4) {
               const x = 0, y = 0;
               const heartShape = new THREE.Shape();
               heartShape.moveTo( x + 5, y + 5 );
               heartShape.bezierCurveTo( x + 5, y + 5, x + 4, y, x, y );
               heartShape.bezierCurveTo( x - 6, y, x - 6, y + 7,x - 6, y + 7 );
               heartShape.bezierCurveTo( x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19 );
               heartShape.bezierCurveTo( x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7 );
               heartShape.bezierCurveTo( x + 16, y + 7, x + 16, y, x + 10, y );
               heartShape.bezierCurveTo( x + 7, y, x + 5, y + 5, x + 5, y + 5 );

               const geo = new THREE.ShapeGeometry(heartShape);
               geo.center(); // Adjust pivot to center of heart shape
               const mat = new THREE.MeshBasicMaterial({ color: 0xffadc7, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
               const mesh = new THREE.Mesh(geo, mat);
               
               // Scale down the heart severely
               mesh.scale.set(0.04, 0.04, 0.04);
               mesh.position.copy(this.arcParticle.position);
               
               // Add velocity drifting slightly upwards & opposite to travel direction
               const travelDir = pB.clone().sub(pA).normalize();
               mesh.userData.velocity = travelDir.clone().multiplyScalar(-0.6).add(new THREE.Vector3(0, 0.5, 0));
               
               this.trailGroup.add(mesh);
               this.trailParticles.push({ mesh, life: 1.0 });
            }
        }

        // Update trail particles
        if (this.trailParticles) {
            for (let i = this.trailParticles.length - 1; i >= 0; i--) {
                let p = this.trailParticles[i];
                p.life -= delta * 0.8; 
                if (p.life <= 0) {
                    this.trailGroup.remove(p.mesh);
                    this.trailParticles.splice(i, 1);
                } else {
                    p.mesh.position.add(p.mesh.userData.velocity.clone().multiplyScalar(delta * 5));
                    p.mesh.material.opacity = p.life;
                    const s = 0.04 + Math.sin(p.life * Math.PI) * 0.03;
                    p.mesh.scale.setScalar(s);
                    // Slow rotation to make them drift organically
                    p.mesh.rotation.z += delta * 2;
                }
            }
        }

        // Gentle globe bob
        if (this.globeGroup) {
            this.globeGroup.position.y = Math.sin(elapsed * 0.6) * 5;
        }
    }
}
