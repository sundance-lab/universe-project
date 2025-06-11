// public/js/galaxyRenderer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Noise Generation Utility ---
const SimplexNoise = new (function() {
    // ... (Simplex Noise implementation remains unchanged)
    const F3 = 1.0/3.0;
    const G3 = 1.0/6.0;
    const perm = new Uint8Array(512);
    const grad3 = new Float32Array([1,1,0, -1,1,0, 1,-1,0, -1,-1,0, 1,0,1, -1,0,1, 1,0,-1, -1,0,-1, 0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1]);
    const seed = Math.random;
    for(let i=0; i<256; i++) perm[i] = i;
    for(let i=0; i<255; i++) {
        const r = i + ~~(seed() * (256-i));
        const g = perm[i];
        perm[i] = perm[r];
        perm[r] = g;
    }
    for(let i=0; i<256; i++) perm[i+256] = perm[i];
    this.noise = function(xin, yin, zin) {
        let n0, n1, n2, n3;
        const s = (xin + yin + zin) * F3;
        const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
        const t = (i + j + k) * G3;
        const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
        let i1, j1, k1, i2, j2, k2; 
        if(x0 >= y0) {
            if(y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
            else if(x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
            else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
        } else {
            if(y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
            else if(x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
            else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
        }
        const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
        const x2 = x0 - i2 + 2.0 * G3, y2 = y0 - j2 + 2.0 * G3, z2 = z0 - k2 + 2.0 * G3;
        const x3 = x0 - 1.0 + 3.0 * G3, y3 = y0 - 1.0 + 3.0 * G3, z3 = z0 - 1.0 + 3.0 * G3;
        const ii = i & 255, jj = j & 255, kk = k & 255;
        const gi0 = perm[ii+perm[jj+perm[kk]]] % 12, gi1 = perm[ii+i1+perm[jj+j1+perm[kk+k1]]] % 12, gi2 = perm[ii+i2+perm[jj+j2+perm[kk+k2]]] % 12, gi3 = perm[ii+1+perm[jj+1+perm[kk+1]]] % 12;
        let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0; if(t0 < 0) n0 = 0.0; else { t0 *= t0; n0 = t0 * t0 * (grad3[gi0*3] * x0 + grad3[gi0*3+1] * y0 + grad3[gi0*3+2] * z0); }
        let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1; if(t1 < 0) n1 = 0.0; else { t1 *= t1; n1 = t1 * t1 * (grad3[gi1*3] * x1 + grad3[gi1*3+1] * y1 + grad3[gi1*3+2] * z1); }
        let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2; if(t2 < 0) n2 = 0.0; else { t2 *= t2; n2 = t2 * t2 * (grad3[gi2*3] * x2 + grad3[gi2*3+1] * y2 + grad3[gi2*3+2] * z2); }
        let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3; if(t3 < 0) n3 = 0.0; else { t3 *= t3; n3 = t3 * t3 * (grad3[gi3*3] * x3 + grad3[gi3*3+1] * y3 + grad3[gi3*3+2] * z3); }
        return 32.0 * (n0 + n1 + n2 + n3);
    };
})();

export const GalaxyRenderer = (() => {
    let scene, camera, renderer, controls, raycaster, mouse;
    let galaxyGroup, solarSystemParticles;
    let animationFrameId = null;
    let onSystemClickCallback = null;
    let solarSystemData = [];

    const sunVariations = [ { baseColor: new THREE.Color(0x4A90E2) }, { baseColor: new THREE.Color(0xFF5722) }, { baseColor: new THREE.Color(0xFFA500) }, { baseColor: new THREE.Color(0xE0E0E0) }, { baseColor: new THREE.Color(0xE65100) }];
    const GALAXY_RADIUS = 500;
    const NUM_ARMS = 2;
    const BULGE_PARTICLES = 50000;
    const ARM_STARS_PARTICLES = 90000;
    const DISK_STARS_PARTICLES = 156000;
    const NEBULA_PARTICLES = 400;
    // --- NEW: Particle counts for new features ---
    const DUST_LANE_PARTICLES = 70000;
    const HALO_PARTICLES = 30000;

    const armProfiles = [
        { angleOffset: 0.0, tightness: 4.0, length: 1.0 },
        { angleOffset: Math.PI, tightness: 4.0, length: 1.0 },
    ];
    
    // --- MODIFICATION: A more realistic star texture function ---
    function _createStarTexture(color, innerRadius = 0.05, outerRadius = 0.5) {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        const colorStr = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 1)`;
        const transparentStr = `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, 0)`;

        // A bright, white-hot core for all stars
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(innerRadius, colorStr);
        gradient.addColorStop(outerRadius, transparentStr);

        context.fillStyle = gradient;
        context.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }
    
    function _initScene(canvas, galaxy) {
        scene = new THREE.Scene();
        const aspect = canvas.offsetWidth / canvas.offsetHeight;
        camera = new THREE.PerspectiveCamera(60, aspect, 1, 15000);
        camera.position.set(0, GALAXY_RADIUS * 1.2, GALAXY_RADIUS * 2);
        
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 20;
        controls.maxDistance = GALAXY_RADIUS * 8;
        controls.enableZoom = true;
        
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        raycaster.params.Points.threshold = 5;
        
        galaxyGroup = new THREE.Group();
        galaxyGroup.rotation.x = -Math.PI / 5; 
        galaxyGroup.rotation.y = -Math.PI / 8;

        // --- MODIFICATION: Call sequence updated for proper layering ---
        _createGalacticBulge();
        _createGalaxyArms();
        _createDustLanes(); // Dust lanes render after arms
        _createNebulae();
        _createSolarSystemParticles(galaxy.solarSystems);
        _createGalacticDisk();
        _createHaloAndGlobularClusters(); // Halo is the outermost layer

        scene.add(galaxyGroup);
        
        renderer.domElement.addEventListener('click', _onCanvasClick);
        window.addEventListener('resize', _onResize);
    }

    // --- MODIFICATION: Denser core and more elliptical shape ---
    function _createGalacticBulge() {
        const positions = [];
        const color = new THREE.Color('#ffdcb1');
        
        for (let i = 0; i < BULGE_PARTICLES; i++) {
            // Higher power creates a denser core with faster falloff
            const r = Math.pow(Math.random(), 3.0) * GALAXY_RADIUS * 0.4;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            const x = r * Math.sin(phi) * Math.cos(theta) * 1.2;
            // A smaller Y multiplier makes the bulge more of an ellipsoid (flatter)
            const y = r * Math.sin(phi) * Math.sin(theta) * 0.5; 
            const z = r * Math.cos(phi) * 1.2;
            positions.push(x,y,z);
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 2.0,
            sizeAttenuation: true,
            color: color,
            depthWrite: true, 
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.8
        });
        const bulge = new THREE.Points(geometry, material);
        galaxyGroup.add(bulge);
    }
    
    // --- MODIFICATION: More realistic color variation in arms ---
    function _createGalaxyArms() {
        const positions = [];
        const colors = [];
        const finalColor = new THREE.Color();
        const blueColor = new THREE.Color('#a3d5ff');
        const whiteColor = new THREE.Color('#ffffff');
        const yellowColor = new THREE.Color('#fff1d8');


        const particlesPerArm = Math.floor(ARM_STARS_PARTICLES / NUM_ARMS);
        for (let armIndex = 0; armIndex < NUM_ARMS; armIndex++) {
            const arm = armProfiles[armIndex];
            for (let i = 0; i < particlesPerArm; i++) {
                const progress = Math.pow(i / particlesPerArm, 0.8);
                const angle = progress * Math.PI * arm.tightness;
                const armRotation = arm.angleOffset;
                const distance = progress * GALAXY_RADIUS * arm.length;
                
                const noiseFactor = 0.5 + SimplexNoise.noise(progress * 8, armIndex * 5, i / 1000) * 0.5;
                const clusterRadius = 80 * noiseFactor; 
                
                const randomX = (Math.random() - 0.5) * clusterRadius;
                const randomY = (Math.random() - 0.5) * 25 * noiseFactor;
                const randomZ = (Math.random() - 0.5) * clusterRadius;
                
                const x = Math.cos(angle + armRotation) * distance + randomX;
                const y = randomY;
                const z = Math.sin(angle + armRotation) * distance + randomZ;
                positions.push(x, y, z);

                // Add more variety to star colors - mostly young blue/white stars, with some older yellow ones
                const randomValue = Math.random();
                if (randomValue > 0.95) {
                    finalColor.copy(whiteColor);
                } else if (randomValue > 0.6) {
                    finalColor.copy(blueColor);
                } else {
                    finalColor.lerpColors(yellowColor, blueColor, randomValue);
                }
                colors.push(finalColor.r, finalColor.g, finalColor.b);
            }
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 1.5, // Slightly larger to be more visible
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true,
            opacity: 0.9,
            transparent: true
        });
        galaxyGroup.add(new THREE.Points(geometry, material));
    }

    // --- NEW: Function to create dust lanes ---
    function _createDustLanes() {
        const positions = [];
        const color = new THREE.Color(0x000000); // Dust is black

        const particlesPerArm = Math.floor(DUST_LANE_PARTICLES / NUM_ARMS);
        for (let armIndex = 0; armIndex < NUM_ARMS; armIndex++) {
            const arm = armProfiles[armIndex];
            for (let i = 0; i < particlesPerArm; i++) {
                const progress = Math.pow(Math.random(), 1.2); // Concentrate dust
                const angle = progress * Math.PI * arm.tightness;
                const armRotation = arm.angleOffset;
                const distance = progress * GALAXY_RADIUS * arm.length * 0.95; // Slightly inside arms

                const noiseFactor = 0.5 + SimplexNoise.noise(progress * 10, armIndex * 3, i / 500) * 0.5;
                const clusterRadius = 70 * noiseFactor; 

                const randomX = (Math.random() - 0.5) * clusterRadius;
                const randomY = (Math.random() - 0.5) * 15 * noiseFactor; // Keep dust flat
                const randomZ = (Math.random() - 0.5) * clusterRadius;

                const x = Math.cos(angle + armRotation) * distance + randomX;
                const y = randomY;
                const z = Math.sin(angle + armRotation) * distance + randomZ;
                positions.push(x, y, z);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        // Using a standard material to create a "dust cloud" feel rather than points
        const material = new THREE.PointsMaterial({
            size: 4.0,
            sizeAttenuation: true,
            color: color,
            depthWrite: false,
            // Subtractive blending will darken the pixels behind it
            blending: THREE.SubtractiveBlending,
            transparent: true,
            opacity: 0.15,
        });
        const dustLanes = new THREE.Points(geometry, material);
        galaxyGroup.add(dustLanes);
    }
    
    function _createGalacticDisk() {
        const positions = [];
        const color = new THREE.Color('#fefbe8');

        for (let i = 0; i < DISK_STARS_PARTICLES; i++) {
            const r = Math.pow(Math.random(), 3.0) * GALAXY_RADIUS * 1.5;
            const theta = Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * 30;

            const x = Math.cos(theta) * r;
            const z = Math.sin(theta) * r;

            positions.push(x,y,z);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 0.8,
            sizeAttenuation: true,
            color: color,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.35
        });
        const disk = new THREE.Points(geometry, material);
        galaxyGroup.add(disk);
    }

    // --- MODIFICATION: Tighter clustering in arms ---
    function _createNebulae() {
        const positions = [];
        const color = new THREE.Color('#ff4488');
        const particlesPerArm = Math.floor(NEBULA_PARTICLES / NUM_ARMS);

        for (let armIndex = 0; armIndex < NUM_ARMS; armIndex++) {
            const arm = armProfiles[armIndex];
            for (let i = 0; i < particlesPerArm; i++) {
                // Concentrate nebulae more within the arms, not at the very edge or core
                const progress = Math.random() * 0.6 + 0.2; 
                const angle = progress * Math.PI * arm.tightness;
                const armRotation = arm.angleOffset;
                const distance = progress * GALAXY_RADIUS * arm.length;
                
                const randomX = (Math.random() - 0.5) * 60;
                const randomY = (Math.random() - 0.5) * 10;
                const randomZ = (Math.random() - 0.5) * 60;
                
                const x = Math.cos(angle + armRotation) * distance + randomX;
                const y = randomY;
                const z = Math.sin(angle + armRotation) * distance + randomZ;
                positions.push(x,y,z);
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 50,
            map: _createStarTexture(color, 0.3, 0.8),
            color: color,
            sizeAttenuation: true,
            depthWrite: false,
            transparent: true,
            blending: THREE.AdditiveBlending,
            opacity: 0.5 // Slightly reduce opacity to blend better
        });
        galaxyGroup.add(new THREE.Points(geometry, material));
    }
    
    // --- NEW: Function to create the galactic halo and globular clusters ---
    function _createHaloAndGlobularClusters() {
        // Halo of old, faint stars
        const haloPositions = [];
        const haloColor = new THREE.Color('#ffddaa'); // Old stars are reddish/yellow

        for (let i = 0; i < HALO_PARTICLES; i++) {
            // Distribute in a large sphere around the galaxy
            const r = Math.random() * GALAXY_RADIUS * 2 + GALAXY_RADIUS;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);
            haloPositions.push(x, y, z);
        }

        const haloGeometry = new THREE.BufferGeometry();
        haloGeometry.setAttribute('position', new THREE.Float32BufferAttribute(haloPositions, 3));
        const haloMaterial = new THREE.PointsMaterial({
            size: 1.2,
            sizeAttenuation: true,
            color: haloColor,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.15,
        });
        galaxyGroup.add(new THREE.Points(haloGeometry, haloMaterial));

        // Globular Clusters - dense, bright clusters of old stars in the halo
        const numClusters = 50;
        const clusterPositions = [];
        const clusterColor = new THREE.Color('#ffffbb');

        for (let i = 0; i < numClusters; i++) {
            const r = Math.random() * GALAXY_RADIUS * 1.5 + GALAXY_RADIUS * 0.5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const clusterCenterX = r * Math.sin(phi) * Math.cos(theta);
            const clusterCenterY = r * Math.sin(phi) * Math.sin(theta);
            const clusterCenterZ = r * Math.cos(phi);

            const numStarsInCluster = 200 + Math.random() * 300;
            for (let j = 0; j < numStarsInCluster; j++) {
                const starR = Math.pow(Math.random(), 2) * 15; // Tightly packed stars
                const starTheta = Math.random() * Math.PI * 2;
                const starPhi = Math.acos(2 * Math.random() - 1);
                const x = clusterCenterX + starR * Math.sin(starPhi) * Math.cos(starTheta);
                const y = clusterCenterY + starR * Math.sin(starPhi) * Math.sin(starTheta);
                const z = clusterCenterZ + starR * Math.cos(starPhi);
                clusterPositions.push(x, y, z);
            }
        }

        const clusterGeometry = new THREE.BufferGeometry();
        clusterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(clusterPositions, 3));
        const clusterMaterial = new THREE.PointsMaterial({
            size: 1.5,
            sizeAttenuation: true,
            color: clusterColor,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.9,
        });
        galaxyGroup.add(new THREE.Points(clusterGeometry, clusterMaterial));
    }


    function _createSolarSystemParticles(systems) {
        solarSystemData = systems;
        const geometry = new THREE.BufferGeometry();
        const positions = [], colors = [];
        const galaxyContentDiameter = window.gameSessionData.universe.diameter || 500;
        const starTexture = _createStarTexture(new THREE.Color(1,1,1), 0, 1);

        systems.forEach((system) => {
            const scale = (GALAXY_RADIUS * 1.0) / galaxyContentDiameter;
            const x = (system.x - galaxyContentDiameter / 2) * scale;
            const z = (system.y - galaxyContentDiameter / 2) * scale;
            const y = (Math.random() - 0.5) * 10;
            positions.push(x, y, z);
            const sunColor = sunVariations[(system.sunType || 0) % sunVariations.length].baseColor;
            colors.push(sunColor.r, sunColor.g, sunColor.b);
        });

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 20,
            sizeAttenuation: true,
            depthWrite: false,
            transparent: true,
            blending: THREE.AdditiveBlending,
            map: starTexture,
            vertexColors: true
        });

        solarSystemParticles = new THREE.Points(geometry, material);
        galaxyGroup.add(solarSystemParticles);
    }
    
    function _onCanvasClick(event) {
        if (!onSystemClickCallback) return;
        const canvas = renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        
        mouse.x = ((event.clientX - rect.left) / canvas.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / canvas.clientHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(solarSystemParticles);
        if (intersects.length > 0) {
            const systemId = solarSystemData?.[intersects[0]?.index]?.id;
            if (systemId) {
                onSystemClickCallback(systemId);
            }
        }
    }

    function _onResize() {
        if (!renderer) return;
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (canvas.width !== width || canvas.height !== height) {
            renderer.setSize(width, height, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        }
    }

    function _animate() {
        animationFrameId = requestAnimationFrame(_animate);
        galaxyGroup.rotation.y += 0.0001;
        controls.update();
        renderer.render(scene, camera);
    }

    function _dispose() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', _onResize);
        if (renderer) {
            renderer.domElement.removeEventListener('click', _onCanvasClick);
        }
        if (controls) controls.dispose();
        scene?.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if(Array.isArray(object.material)) object.material.forEach(m => m.dispose());
                else object.material.dispose();
            }
        });
        renderer?.dispose();
        scene = null; camera = null; renderer = null; controls = null;
        animationFrameId = null; onSystemClickCallback = null;
    }

    return {
        init: (canvas, galaxy, callback) => {
            onSystemClickCallback = callback;
            _initScene(canvas, galaxy);
            _animate();
        },
        dispose: _dispose
    };
})();
