// public/js/galaxyRenderer.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Noise Generation Utility ---
const SimplexNoise = new (function() {
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
    const ARM_STARS_PARTICLES = 300000;
    const NEBULA_PARTICLES = 500;
    const DUST_PARTICLES = 150000;
    // --- NEW: Added constant for the galactic disk stars ---
    const DISK_STARS_PARTICLES = 100000;

    const armProfiles = [
        { angleOffset: 0.0, tightness: 4.0, length: 1.0 },
        { angleOffset: Math.PI, tightness: 4.0, length: 1.0 },
    ];
    
    function _createStarTexture(color, innerRadius = 0, outerRadius = 1) {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');
        const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(innerRadius, `rgba(${color.r*255}, ${color.g*255}, ${color.b*255}, 1)`);
        gradient.addColorStop((innerRadius + outerRadius) / 2, `rgba(${color.r*255}, ${color.g*255}, ${color.b*255}, 0.5)`);
        gradient.addColorStop(outerRadius, `rgba(${color.r*255}, ${color.g*255}, ${color.b*255}, 0)`);
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
        
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        raycaster.params.Points.threshold = 5;
        
        galaxyGroup = new TH
