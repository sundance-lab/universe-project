// hexPlanetViewController.js

import * as THREE from 'three';
// OrbitControls are now managed globally in script.js, so we don't need to import here
import { getHexPlanetShaders } from './shaders.js';
import { noiseFunctions } from './shaders.js'; // Import noiseFunctions

export const HexPlanetViewController = (() => {
    // These variables will now refer to the globally managed scene, camera, controls
    let _scene, _camera, _controls, _renderer;
    let lod;
    let animationId = null; // This will now be controlled by the global animation loop
    let backButton = null;

    const SPHERE_BASE_RADIUS = 1.0;
    const DISPLACEMENT_SCALING_FACTOR = 0.005;

    function addBarycentricCoordinates(geometry) {
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

    // Renamed initScene to setupObjects and modified to accept global Three.js instances
    function setupObjects(scene, camera, controls, renderer, planetBasis) {
        _scene = scene;
        _camera = camera;
        _controls = controls;
        _renderer = renderer;

        // Clear any existing Hex Planet objects from the scene
        clearObjects();

        // Configure camera for Hex Planet view
        _camera.position.set(0, 0, 2.4);
        _controls.target.set(0, 0, 0); // Look at the center of the planet
        _controls.enablePan = false; // Usually disabled for close-up planet inspection
        _controls.minDistance = 1.2;
        _controls.maxDistance = 40.0;
        _controls.dampingFactor = 0.08;
        _controls.rotateSpeed = 1.0;
        _controls.zoomSpeed = 0.8;
        _controls.minPolarAngle = 0;
        _controls.maxPolarAngle = Math.PI;
        _controls.update(); // Apply new settings

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
                    uPlanetType: { value: planetBasis.planetType || 0 },
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

        lod = new THREE.LOD();
        _scene.add(lod); // Add to the global scene

        const detailLevels = [
            { subdivision: 256, distance: 0.0, strengths: [1.0, 1.0] },
            { subdivision: 6,   distance: 18.0, strengths: [1.0, 1.0] } // Assuming other levels are omitted for brevity
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

    function update(now) {
        if (lod) {
            lod.children.forEach(mesh => {
                if (mesh.material && mesh.material.uniforms.uTime) {
                    mesh.material.uniforms.uTime.value = now / 1000;
                }
            });
            lod.update(_camera); 
        }
    }

    function clearObjects() {
        if (lod) {
            _scene.remove(lod); // Remove from the global scene
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
            lod = null;
        }

    }

    // onResize is now handled by the global resize listener in script.js

    return {
        // Init function is no longer needed here as part of module
        // activate now takes the global scene, camera, controls, and renderer
        activate: (planetBasis, onBackCallback, scene, camera, controls, renderer) => { // Renamed load to activate
            const canvas = renderer.domElement; // Use the global renderer's canvas
            const screen = document.getElementById('hex-planet-screen');
            backButton = document.getElementById('back-from-hex-view');

            if (!canvas || !screen || !backButton) {
                console.error("HexPlanetViewController: Missing required elements...");
                return;
            }

            // No longer calling cleanup() here as a separate step; setupObjects will handle clearing
            setupObjects(scene, camera, controls, renderer, planetBasis);

            const handleBackClick = () => {
                clearObjects(); // Only clear objects from the scene
                if (typeof onBackCallback === 'function') {
                    onBackCallback();
                }
                backButton.removeEventListener('click', handleBackClick);
                // No longer remove global resize listener here
            };

            backButton.addEventListener('click', handleBackClick);
            screen.classList.add('active'); // Set screen active here
        },
        clear: clearObjects, // Expose clear function
        update: update, // Expose update function for global animation loop
        // No longer need to expose cleanup directly as it's part of clear
    };
})();
