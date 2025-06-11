import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * A fast and simple 3D Simplex noise function.
 */
const SimplexNoise = new (function() {
    const F3 = 1.0/3.0, G3 = 1.0/6.0;
    const perm = new Uint8Array(512);
    for(let i=0; i<256; i++) perm[i] = i;
    for(let i=0; i<255; i++) {
        const r = i + ~~(Math.random() * (256-i)), g = perm[i];
        perm[i] = perm[r]; perm[r] = g;
    }
    for(let i=0; i<256; i++) perm[i+256] = perm[i];
    const grad3 = new Float32Array([1,1,0, -1,1,0, 1,-1,0, -1,-1,0, 1,0,1, -1,0,1, 1,0,-1, -1,0,-1, 0,1,1, 0,-1,1, 0,1,-1, 0,-1,-1]);
    this.noise = function(xin, yin, zin) {
        let n0, n1, n2, n3, s = (xin + yin + zin) * F3, i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s), t = (i + j + k) * G3;
        let x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t), i1, j1, k1, i2, j2, k2;
        if(x0 >= y0) { if(y0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; } else if(x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; } else { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }}
        else { if(y0 < z0) { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; } else if(x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; } else { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }}
        let x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3, x2 = x0 - i2 + 2.0 * G3, y2 = y0 - j2 + 2.0 * G3, z2 = z0 - k2 + 2.0 * G3, x3 = x0 - 1.0 + 3.0 * G3, y3 = y0 - 1.0 + 3.0 * G3, z3 = z0 - 1.0 + 3.0 * G3;
        let ii = i & 255, jj = j & 255, kk = k & 255;
        let gi0 = perm[ii+perm[jj+perm[kk]]] % 12, gi1 = perm[ii+i1+perm[jj+j1+perm[kk+k1]]] % 12, gi2 = perm[ii+i2+perm[jj+j2+perm[kk+k2]]] % 12, gi3 = perm[ii+1+perm[jj+1+perm[kk+1]]] % 12;
        let t0 = 0.6 - x0*x0 - y0*y0 - z0*z0; if(t0 < 0) n0 = 0.0; else { t0 *= t0; n0 = t0 * t0 * (grad3[gi0*3] * x0 + grad3[gi0*3+1] * y0 + grad3[gi0*3+2] * z0); }
        let t1 = 0.6 - x1*x1 - y1*y1 - z1*z1; if(t1 < 0) n1 = 0.0; else { t1 *= t1; n1 = t1 * t1 * (grad3[gi1*3] * x1 + grad3[gi1*3+1] * y1 + grad3[gi1*3+2] * z1); }
        let t2 = 0.6 - x2*x2 - y2*y2 - z2*z2; if(t2 < 0) n2 = 0.0; else { t2 *= t2; n2 = t2 * t2 * (grad3[gi2*3] * x2 + grad3[gi2*3+1] * y2 + grad3[gi2*3+2] * z2); }
        let t3 = 0.6 - x3*x3 - y3*y3 - z3*z3; if(t3 < 0) n3 = 0.0; else { t3 *= t3; n3 = t3 * t3 * (grad3[gi3*3] * x3 + grad3[gi3*3+1] * y3 + grad3[gi3*3+2] * z3); }
        return 32.0 * (n0 + n1 + n2 + n3);
    };
})();

/**
 * Creates layered noise for more organic patterns.
 */
function fbm(x, y, z, octaves, persistence, lacunarity) {
    let total = 0, frequency = 1.0, amplitude = 1.0, maxValue = 0;
    for (let i = 0; i < octaves; i++) {
        total += SimplexNoise.noise(x * frequency, y * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return total / maxValue;
}


export const GalaxyRenderer = (() => {
    // --- STATE ---
    let scene, camera, renderer, controls, raycaster, mouse;
    let galaxyGroup, solarSystemParticles;
    let animationFrameId = null;
    let onSystemClickCallback = null;
    let solarSystemData = [];
    let starTexture, nebulaTexture;

    // --- GALAXY PARAMETERS (Tweak these for different galaxy styles) ---
    const GALAXY_RADIUS = 800;
    const GALAXY_THICKNESS = 60;
    const NUM_ARMS = 4;
    const ARM_TIGHTNESS = 3.5;
    const ARM_ROTATION = 2.0;

    // --- PARTICLE COUNTS ---
    const COUNT_BULGE = 50000;
    const COUNT_ARMS = 250000;
    const COUNT_DISK = 400000;
    const COUNT_DUST = 1000000;
    const COUNT_NEBULAE = 100;

    // --- COLORS ---
    const COLOR_CORE_YELLOW = new THREE.Color('#FFDDBB');
    const COLOR_ARM_BLUE = new THREE.Color('#a3d5ff');
    const COLOR_ARM_WHITE = new THREE.Color('#FFFFFF');
    const COLOR_DUST = new THREE.Color('#211812');
    const COLOR_NEBULA_PINK = new THREE.Color('#ff4488');
    const COLOR_NEBULA_PURPLE = new THREE.Color('#8A2BE2');

    // --- HELPER FUNCTIONS ---

    function _createParticleTexture(color, size, gradient) {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const context = canvas.getContext('2d');
        const g = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.forEach(stop => g.addColorStop(stop.pos, stop.color));
        context.fillStyle = g;
        context.fillRect(0, 0, size, size);
        return new THREE.CanvasTexture(canvas);
    }

    // --- CORE LOGIC ---

    function _initScene(canvas, galaxy) {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 1, 15000);
        camera.position.set(GALAXY_RADIUS * 0.8, GALAXY_RADIUS, GALAXY_RADIUS * 1.8);

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        
        controls = new OrbitControls(camera, renderer.domElement);
        Object.assign(controls, { enableDamping: true, dampingFactor: 0.05, minDistance: 100, maxDistance: GALAXY_RADIUS * 5 });
        
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        raycaster.params.Points.threshold = 5;

        // Create shared textures
        starTexture = _createParticleTexture(new THREE.Color(1,1,1), 128, [{pos: 0, color: 'rgba(255,255,255,1)'}, {pos: 0.3, color: 'rgba(255,255,255,0.8)'}, {pos: 1, color: 'rgba(255,255,255,0)'}]);
        nebulaTexture = _createParticleTexture(new THREE.Color(1,1,1), 256, [{pos: 0, color: 'rgba(255,255,255,1)'}, {pos: 0.4, color: 'rgba(255,255,255,0.5)'}, {pos: 1, color: 'rgba(255,255,255,0)'}]);

        // Build the galaxy
        galaxyGroup = new THREE.Group();
        _createGalacticDisk();
        _createGalacticBulge();
        _createGalaxyArms();
        _createDustLanes();
        _createNebulae();
        _createSolarSystemParticles(galaxy.solarSystems);
        scene.add(galaxyGroup);
        
        renderer.domElement.addEventListener('click', _onCanvasClick);
        window.addEventListener('resize', _onResize);
    }
    
    function _createGalacticBulge() {
        const positions = [];
        for (let i = 0; i < COUNT_BULGE; i++) {
            const r = Math.pow(Math.random(), 2.5) * GALAXY_RADIUS * 0.3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi) * 0.6, // Ellipsoid shape
                r * Math.sin(phi) * Math.sin(theta)
            );
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 2, color: COLOR_CORE_YELLOW, map: starTexture, sizeAttenuation: true,
            depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.8
        });
        galaxyGroup.add(new THREE.Points(geometry, material));
    }

    function _createGalacticDisk() {
        const positions = [];
        for (let i = 0; i < COUNT_DISK; i++) {
            const r = (Math.pow(Math.random(), 0.8) * GALAXY_RADIUS) + 50;
            const theta = Math.random() * Math.PI * 2;
            const y = (Math.random() - 0.5) * GALAXY_THICKNESS * 0.5 * Math.pow(Math.random(), 1.5);
            const noise = fbm(Math.cos(theta) * 2, Math.sin(theta) * 2, 0, 3, 0.5, 2.0);
            const noisyRadius = r * (1 + noise * 0.1);
            positions.push(Math.cos(theta) * noisyRadius, y, Math.sin(theta) * noisyRadius);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 1.5, color: COLOR_ARM_WHITE, map: starTexture, sizeAttenuation: true,
            depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.1
        });
        galaxyGroup.add(new THREE.Points(geometry, material));
    }

    function _createGalaxyArms() {
        const positions = [], colors = [];
        for (let i = 0; i < COUNT_ARMS; i++) {
            const armIndex = i % NUM_ARMS;
            const progress = Math.pow(Math.random(), 1.5);
            const distance = progress * GALAXY_RADIUS;
            const angle = progress * ARM_TIGHTNESS;
            const armRotation = (armIndex / NUM_ARMS) * Math.PI * 2;
            
            const pos = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
            
            const noiseCoord = pos.clone().divideScalar(GALAXY_RADIUS);
            const noise = fbm(noiseCoord.x * 5, noiseCoord.y * 5, noiseCoord.z * 5, 4, 0.6, 2.5);
            
            const scatter = (Math.random() - 0.5) * GALAXY_RADIUS * 0.15 * (1 - progress * 0.5);
            pos.x += noise * scatter;
            pos.y += (Math.random() - 0.5) * GALAXY_THICKNESS * noise * (1 - progress);
            pos.z += (Math.random() - 0.5) * scatter;
            
            pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), armRotation + ARM_ROTATION / distance);
            
            positions.push(pos.x, pos.y, pos.z);
            
            const color = COLOR_ARM_BLUE.clone().lerp(COLOR_ARM_WHITE, Math.random() * 0.6);
            colors.push(color.r, color.g, color.b);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 2.0, map: starTexture, vertexColors: true, sizeAttenuation: true,
            depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.7
        });
        galaxyGroup.add(new THREE.Points(geometry, material));
    }

    function _createDustLanes() {
        const positions = [];
        for (let i = 0; i < COUNT_DUST; i++) {
            const armIndex = i % NUM_ARMS;
            const progress = Math.pow(Math.random(), 1.2);
            const distance = progress * GALAXY_RADIUS * 0.8 + GALAXY_RADIUS * 0.1; // Concentrated in mid-arms
            const angle = progress * ARM_TIGHTNESS;
            const armRotation = (armIndex / NUM_ARMS) * Math.PI * 2;
            
            const pos = new THREE.Vector3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
            
            const noiseCoord = pos.clone().divideScalar(GALAXY_RADIUS);
            const noise = fbm(noiseCoord.x * 8, noiseCoord.y * 8, noiseCoord.z * 8, 5, 0.5, 2.0);
            
            const scatter = (Math.random() - 0.5) * GALAXY_RADIUS * 0.1 * noise;
            pos.x += scatter;
            pos.y += (Math.random() - 0.5) * (GALAXY_THICKNESS * 0.4);
            pos.z += (Math.random() - 0.5) * scatter;
            
            // Offset to sit on the inner edge of the bright arms
            const armOffset = -0.8 / (progress + 0.1);
            pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), armRotation + ARM_ROTATION / distance + armOffset);
            
            positions.push(pos.x, pos.y, pos.z);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({
            size: 4.0, color: COLOR_DUST, sizeAttenuation: true,
            depthWrite: false, blending: THREE.NormalBlending, transparent: true, opacity: 0.15
        });
        galaxyGroup.add(new THREE.Points(geometry, material));
    }

    function _createNebulae() {
        const positions = [], colors = [];
        for (let i = 0; i < COUNT_NEBULAE; i++) {
            const armIndex = i % NUM_ARMS;
            const progress = Math.random() * 0.6 + 0.2; // Only in mid-arms
            const distance = progress * GALAXY_RADIUS;
            const angle = progress * ARM_TIGHTNESS;
            const armRotation = (armIndex / NUM_ARMS) * Math.PI * 2;
            
            const pos = new THREE.Vector3(Math.cos(angle) * distance, (Math.random()-0.5) * GALAXY_THICKNESS * 0.5, Math.sin(angle) * distance);
            pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), armRotation + ARM_ROTATION / distance);
            
            positions.push(pos.x, pos.y, pos.z);
            const color = COLOR_NEBULA_PINK.clone().lerp(COLOR_NEBULA_PURPLE, Math.random());
            colors.push(color.r, color.g, color.b);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 150, map: nebulaTexture, vertexColors: true, sizeAttenuation: true,
            depthWrite: false, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.5
        });
        galaxyGroup.add(new THREE.Points(geometry, material));
    }
    
    function _createSolarSystemParticles(systems) {
        solarSystemData = systems;
        const geometry = new THREE.BufferGeometry();
        const positions = [], colors = [];
        const galaxyContentDiameter = window.gameSessionData.universe.diameter || 500;
        const sunVariations = [ { baseColor: new THREE.Color(0x4A90E2) }, { baseColor: new THREE.Color(0xFF5722) }, { baseColor: new THREE.Color(0xFFA500) }, { baseColor: new THREE.Color(0xE0E0E0) }, { baseColor: new THREE.Color(0xE65100) }];

        systems.forEach((system) => {
            const scale = (GALAXY_RADIUS * 1.5) / galaxyContentDiameter;
            const x = (system.x - galaxyContentDiameter / 2) * scale;
            const z = (system.y - galaxyContentDiameter / 2) * scale;
            const y = (Math.random() - 0.5) * (GALAXY_THICKNESS * 0.1);
            positions.push(x, y, z);
            const sunColor = sunVariations[(system.sunType || 0) % sunVariations.length].baseColor;
            colors.push(sunColor.r, sunColor.g, sunColor.b);
        });

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const material = new THREE.PointsMaterial({
            size: 25, map: starTexture, vertexColors: true, sizeAttenuation: true,
            depthWrite: false, blending: THREE.AdditiveBlending, transparent: true
        });
        solarSystemParticles = new THREE.Points(geometry, material);
        galaxyGroup.add(solarSystemParticles);
    }
    
    // --- EVENT HANDLERS & LIFECYCLE ---

    function _onCanvasClick(event) {
        if (!onSystemClickCallback) return;
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(solarSystemParticles);
        if (intersects.length > 0) {
            onSystemClickCallback(solarSystemData?.[intersects[0]?.index]?.id);
        }
    }

    function _onResize() {
        if (!renderer) return;
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    }

    function _animate() {
        animationFrameId = requestAnimationFrame(_animate);
        galaxyGroup.rotation.y += 0.0002;
        controls.update();
        renderer.render(scene, camera);
    }

    function _dispose() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', _onResize);
        if (renderer) renderer.domElement.removeEventListener('click', _onCanvasClick);
        if (controls) controls.dispose();
        scene?.traverse(object => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
                else object.material.dispose();
            }
        });
        starTexture?.dispose();
        nebulaTexture?.dispose();
        renderer?.dispose();
        scene = camera = renderer = controls = animationFrameId = onSystemClickCallback = null;
    }

    // --- PUBLIC API ---

    return {
        init: (canvas, galaxy, callback) => {
            _dispose(); // Clean up any previous instance
            onSystemClickCallback = callback;
            _initScene(canvas, galaxy);
            _animate();
        },
        dispose: _dispose
    };
})();
