// hexPlanetViewController.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { getHexPlanetShaders } from './shaders.js';

export const HexPlanetViewController = (() => {
    let scene, camera, renderer, controls, lod;
    let animationId = null;
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

    function initScene(canvas, planetBasis) {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x000000);

        camera = new THREE.PerspectiveCamera(60, canvas.offsetWidth / canvas.offsetHeight, 0.1, 1000);
        camera.position.z = 2.4;

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
        renderer.setSize(canvas.offsetWidth, canvas.offsetHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
      
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;    
        controls.rotateSpeed = 1.0;     
        controls.zoomSpeed = 0.8;        
        controls.minDistance = 1.2;
        controls.maxDistance = 40.0;
        controls.enablePan = false;

        const { vertexShader, fragmentShader } = getHexPlanetShaders();

        const uniforms = THREE.UniformsUtils.merge([
            THREE.UniformsLib.common,
            THREE.UniformsLib.lights,
            {
                // Shared
                uTime: { value: 0.0 },
                uSphereRadius: { value: SPHERE_BASE_RADIUS },
                uContinentSeed: { value: planetBasis.continentSeed },
                uLightDirection: { value: new THREE.Vector3(0.8, 0.6, 1.0) },
                // Planet Type
                uIsGasGiant: { value: planetBasis.isGasGiant },
                // Terrestrial
                uLandColor: { value: new THREE.Color(planetBasis.landColor) },
                uWaterColor: { value: new THREE.Color(planetBasis.waterColor) },
                uOceanHeightLevel: { value: 0.0 }, // Calculated below
                uForestDensity: { value: planetBasis.forestDensity },
                uDisplacementAmount: { value: 0.0 }, // Calculated below
                uVolcanicActivity: { value: planetBasis.volcanicActivity },
                uSnowCapLevel: { value: planetBasis.snowCapLevel },
                // Gas Giant
                uGgBandColor1: { value: new THREE.Color(planetBasis.ggBandColor1) },
                uGgBandColor2: { value: new THREE.Color(planetBasis.ggBandColor2) },
                uGgPoleColor: { value: new THREE.Color(planetBasis.ggPoleColor) },
                uGgPoleSize: { value: planetBasis.ggPoleSize },
                uGgAtmosphereStyle: { value: planetBasis.ggAtmosphereStyle },
                uGgTurbulence: { value: planetBasis.ggTurbulence },
                uGgStormIntensity: { value: planetBasis.ggStormIntensity },
                // Hex specific
                uShowStrokes: { value: true },
            }
        ]);

        if (!planetBasis.isGasGiant) {
            const terrainRange = Math.max(0.1, planetBasis.maxTerrainHeight - planetBasis.minTerrainHeight);
            const normalizedOceanLevel = (planetBasis.oceanHeightLevel - planetBasis.minTerrainHeight) / terrainRange;
            uniforms.uOceanHeightLevel.value = normalizedOceanLevel - 0.5;
            uniforms.uDisplacementAmount.value = terrainRange * DISPLACEMENT_SCALING_FACTOR;
        }

        const baseMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader,
            fragmentShader,
            lights: true
        });

        lod = new THREE.LOD();
        scene.add(lod);

        const detailLevels = [
            { subdivision: 128, distance: 0.0 },
            { subdivision: 64, distance: 4.0 },
            { subdivision: 32, distance: 8.0 },
            { subdivision: 16, distance: 15.0 }
        ];

        detailLevels.forEach(level => {
            const geometry = new THREE.IcosahedronGeometry(SPHERE_BASE_RADIUS, level.subdivision);
            addBarycentricCoordinates(geometry);
            const mesh = new THREE.Mesh(geometry, baseMaterial);
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
