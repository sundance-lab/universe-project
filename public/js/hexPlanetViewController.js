import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { getHexPlanetShaders } from './shaders.js';
import { addBarycentricCoordinates } from './utils.js';

export const HexPlanetViewController = (() => {
    // Module-level variables to manage state
    let scene, camera, renderer, controls, lod;
    let animationId = null;
    let onBackCallback = null;

    const SPHERE_BASE_RADIUS = 1.0;
    const DISPLACEMENT_SCALING_FACTOR = 0.005;

    function initScene(canvas, planetBasis) {
        // Scene and camera
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);
        camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 0.1, 1000);
        camera.position.z = 2.4;

        // Renderer
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);

        // Controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.minDistance = 1.2;
        controls.maxDistance = 40.0;
        controls.enablePan = false;

        // Planet Material and Shaders
        const { vertexShader, fragmentShader } = getHexPlanetShaders();
        const baseMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uLandColor: { value: new THREE.Color(planetBasis.landColor) },
                uWaterColor: { value: new THREE.Color(planetBasis.waterColor) },
                uOceanHeightLevel: { value: 0.5 },
                uContinentSeed: { value: planetBasis.continentSeed },
                uRiverBasin: { value: planetBasis.riverBasin },
                uForestDensity: { value: planetBasis.forestDensity },
                uTime: { value: 0.0 },
                uDisplacementAmount: { value: 0.0 },
                uPlanetType: { value: planetBasis.planetType || 0 },
                uShowStrokes: { value: false },
                uLightDirection: { value: new THREE.Vector3(0.8, 0.6, 1.0).normalize() },
                cameraPosition: { value: camera.position }
            },
            vertexShader,
            fragmentShader,
        });

        // Set terrain height uniforms
        const terrainRange = Math.max(0.1, planetBasis.maxTerrainHeight - planetBasis.minTerrainHeight);
        const normalizedOceanLevel = (planetBasis.oceanHeightLevel - planetBasis.minTerrainHeight) / terrainRange;
        baseMaterial.uniforms.uOceanHeightLevel.value = normalizedOceanLevel - 0.5;
        // FIX: Added a * 40 multiplier to match the displacement scale in solarSystemRenderer
        baseMaterial.uniforms.uDisplacementAmount.value = terrainRange * DISPLACEMENT_SCALING_FACTOR * 40;

        // Create the planet with Levels of Detail (LOD)
        lod = new THREE.LOD();
        const detailLevels = [
            { subdivision: 256, distance: 0.0 }, { subdivision: 128, distance: 3.0 },
            { subdivision: 64, distance: 6.0 },  { subdivision: 32, distance: 10.0 },
            { subdivision: 16, distance: 14.0 }, { subdivision: 8, distance: 18.0 }
        ];

        detailLevels.forEach(level => {
            const geometry = new THREE.IcosahedronGeometry(SPHERE_BASE_RADIUS, level.subdivision);
            addBarycentricCoordinates(geometry);
            const mesh = new THREE.Mesh(geometry, baseMaterial);
            lod.addLevel(mesh, level.distance);
        });
        scene.add(lod);
        animate();
    }

    function animate() {
        if (!renderer) return;
        animationId = requestAnimationFrame(animate);
        if (lod?.children[0]?.material) {
            lod.children[0].material.uniforms.uTime.value += 0.015;
        }
        controls.update();
        lod.update(camera);
        renderer.render(scene, camera);
    }

    function cleanup() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        if (controls) {
            controls.dispose();
            controls = null;
        }
        if (scene) {
            scene.traverse(object => {
                if (object.isMesh) {
                    object.geometry?.dispose();
                    object.material?.dispose();
                }
            });
            scene = null;
        }
        if (renderer) {
            renderer.dispose();
            renderer = null;
        }
        onBackCallback = null;
    }

    return {
        activate: (planetData, backCb) => {
            const screen = document.getElementById('hex-planet-screen');
            const canvas = document.getElementById('hex-planet-canvas');
            const backButton = document.getElementById('back-from-hex-view');
            
            if (!screen || !canvas || !backButton) return;

            onBackCallback = backCb;
            initScene(canvas, planetData);

            const handleBackClick = () => {
                backButton.removeEventListener('click', handleBackClick);
                
                screen.classList.remove('active');

                if (typeof onBackCallback === 'function') {
                    onBackCallback();
                }
                
                requestAnimationFrame(cleanup);
            };

            backButton.addEventListener('click', handleBackClick);
            screen.classList.add('active');
        }
    };
})();
