// hexPlanetViewController.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { LOD } from 'three';
import { getHexPlanetShaders } from './shaders.js';

export const HexPlanetViewController = (() => {
    let scene, camera, renderer, controls, lod;
    let animationId = null;
    let backButton = null;
    // The old 'deactivate' and 'boundDeactivate' are no longer needed.

    const SPHERE_BASE_RADIUS = 1.0;
    const DISPLACEMENT_SCALING_FACTOR = 0.005;

    function addBarycentricCoordinates(geometry) {
        // ... (this function is correct, no changes needed)
        const positions = geometry.attributes.position.array;
        const vertexCount = positions.length / 3;
        const barycentric = new Float32Array(vertexCount * 3);
        
        for (let i = 0; i < vertexCount; i += 3) {
            barycentric[i * 3] = 1; barycentric[i * 3 + 1] = 0; barycentric[i * 3 + 2] = 0;
            barycentric[(i + 1) * 3] = 0; barycentric[(i + 1) * 3 + 1] = 1; barycentric[(i + 1) * 3 + 2] = 0;
            barycentric[(i + 2) * 3] = 0; barycentric[(i + 2) * 3 + 1] = 0; barycentric[(i + 2) * 3 + 2] = 1;
        }
        
        geometry.setAttribute('barycentric', new THREE.BufferAttribute(barycentric, 3));
    }

    function initScene(canvas, planetBasis) {
        // ... (this function is correct, no changes needed)
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 0.1, 1000);
        camera.position.z = 2.4;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
      
   controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;     // Increased from 0.05 for smoother transitions
controls.rotateSpeed = 1.0;     
controls.zoomSpeed = 0.8;          // Reduced from 1.2 for smoother zoom
controls.minDistance = 1.2;
controls.maxDistance = 40.0;
controls.enablePan = false;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI;

        const { vertexShader, fragmentShader } = getHexPlanetShaders();

        const baseMaterial = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.common,
                THREE.UniformsLib.lights,
                {
                    uWaterColor: { value: new THREE.Color(planetBasis.waterColor) },
                    uLandColor: { value: new THREE.Color(planetBasis.landColor) },
                    uContinentSeed: { value: planetBasis.continentSeed },
                    uRiverBasin: { value: planetBasis.riverBasin },
                    uForestDensity: { value: planetBasis.forestDensity },
                    uTime: { value: 0.0 },
                    uSphereRadius: { value: SPHERE_BASE_RADIUS },
                    uDisplacementAmount: { value: 0.0 },
                    uShowStrokes: { value: false },
                    uOceanHeightLevel: { value: 0.0 },
                    uMountainStrength: { value: 1.0 },
                    uIslandStrength: { value: 1.0 },
                }
            ]),
            vertexShader,
            fragmentShader,
            lights: true
        });

        const terrainRange = Math.max(0.1, planetBasis.maxTerrainHeight - planetBasis.minTerrainHeight);
        const normalizedOceanLevel = (planetBasis.oceanHeightLevel - planetBasis.minTerrainHeight) / terrainRange;
        baseMaterial.uniforms.uOceanHeightLevel.value = normalizedOceanLevel - 0.5;
        baseMaterial.uniforms.uDisplacementAmount.value = terrainRange * DISPLACEMENT_SCALING_FACTOR;

        lod = new LOD();
        scene.add(lod);

        const detailLevels = [
            { subdivision: 256, distance: 0.0, strengths: [1.0, 1.0] },
            // ... other levels
            { subdivision: 6,   distance: 18.0, strengths: [1.0, 1.0] }
        ];

        detailLevels.forEach(level => {
            const geometry = new THREE.IcosahedronGeometry(SPHERE_BASE_RADIUS, level.subdivision);
            addBarycentricCoordinates(geometry);
            const materialForLevel = baseMaterial.clone();
            materialForLevel.uniforms.uMountainStrength.value = level.strengths[0];
            materialForLevel.uniforms.uIslandStrength.value = level.strengths[1];
            const mesh = new THREE.Mesh(geometry, materialForLevel);
            lod.addLevel(mesh, level.distance);
        });

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(5, 5, 5);
        scene.add(directionalLight);

        animate();
    }
        
    function animate(now) {
        // ... (this function is correct, no changes needed)
        animationId = requestAnimationFrame(animate);
        if (lod) {
            lod.children.forEach(mesh => {
                if (mesh.material && mesh.material.uniforms.uTime) {
                    mesh.material.uniforms.uTime.value = now / 1000;
                }
            });
        }
        if (controls) controls.update();
        if (lod) lod.update(camera);
        if (scene && camera) renderer.render(scene, camera);
    }

    function cleanup() {
        // ... (this function is correct, no changes needed)
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (controls) {
            controls.dispose();
            controls = null;
        }
        if (lod) {
            lod.traverse((object) => {
                if (object.isMesh) {
                    object.geometry.dispose();
                    if (Array.isArray(object.material)) {
                        object.material.forEach(m => m.dispose());
                    } else if (object.material) {
                        object.material.dispose();
                    }
                }
            });
            scene.remove(lod);
            lod = null;
        }
        if (renderer) {
            renderer.dispose();
            renderer = null;
        }
        scene = null;
        camera = null;
    }

    function onResize() {
        // ... (this function is correct, no changes needed)
        if (!renderer || !camera) return;
        const canvas = renderer.domElement;
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        if (width > 0 && height > 0) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        }
    }
    
    return {
        init: () => { /* ... */ },

        activate: (planetBasis, onBackCallback) => {
            const canvas = document.getElementById('hex-planet-canvas');
            const screen = document.getElementById('hex-planet-screen');
            backButton = document.getElementById('back-from-hex-view');

            if (!canvas || !screen || !backButton) {
                console.error("HexPlanetViewController: Missing required elements...");
                return;
            }

            cleanup();
            initScene(canvas, planetBasis);
            
            const handleBackClick = () => {
                cleanup(); 
                
                if (typeof onBackCallback === 'function') {
                    onBackCallback();
                }

                backButton.removeEventListener('click', handleBackClick);
                window.removeEventListener('resize', onResize);
            };

            backButton.addEventListener('click', handleBackClick);
            window.addEventListener('resize', onResize);
            screen.classList.add('active');
        },

        cleanup: cleanup
    };
})();
