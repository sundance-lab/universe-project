import * as THREE from 'three';
import { SunRenderer } from './sunRenderer.js';
import { getPlanetShaders } from './shaders.js';

export const SolarSystemRenderer = (() => {
    let scene, camera, renderer;
    let sunRenderer, sunLight;
    let planetMeshes = [];
    let orbitLines = [];
    let currentSystemData = null;
    let animationFrameId = null;

    const SPHERE_BASE_RADIUS = 0.8;
    const DISPLACEMENT_SCALING_FACTOR = 0.005;

    function _createPlanetMesh(planetData) {
        const { vertexShader, fragmentShader } = getPlanetShaders();

        const geometry = new THREE.SphereGeometry(planetData.size, 32, 32);

        const pMin = planetData.minTerrainHeight ?? 0.0;
        const pMax = planetData.maxTerrainHeight ?? (pMin + 10.0);
        const pOcean = planetData.oceanHeightLevel ?? (pMin + (pMax - pMin) * 0.3);
        const terrainRange = Math.max(0.1, pMax - pMin);
        const normalizedOceanLevel = terrainRange > 0 ? (pOcean - pMin) / terrainRange : 0.5;
        const displacementAmount = terrainRange * DISPLACEMENT_SCALING_FACTOR * 40;

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uLandColor: { value: new THREE.Color(planetData.landColor || '#556B2F') },
                uWaterColor: { value: new THREE.Color(planetData.waterColor || '#1E90FF') },
                uOceanHeightLevel: { value: normalizedOceanLevel - 0.5 },
                uContinentSeed: { value: planetData.continentSeed ?? Math.random() },
                uRiverBasin: { value: planetData.riverBasin ?? 0.05 },
                uForestDensity: { value: planetData.forestDensity ?? 0.5 },
                uSphereRadius: { value: SPHERE_BASE_RADIUS },
                uDisplacementAmount: { value: displacementAmount },
                uTime: { value: 0.0 }
            },
            vertexShader,
            fragmentShader,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { ...planetData }; // Store data for interactions
        return mesh;
    }

    function _cleanup() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }

        if (sunRenderer) {
            sunRenderer.dispose();
            sunRenderer = null;
        }

        planetMeshes.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
            scene.remove(mesh);
        });
        planetMeshes = [];

        orbitLines.forEach(line => {
            line.geometry.dispose();
            line.material.dispose();
            scene.remove(line);
        });
        orbitLines = [];
        
        if (renderer) {
            renderer.dispose();
            renderer.domElement.remove();
            renderer = null;
        }

        scene = null;
        camera = null;
        currentSystemData = null;
    }

    function _setupScene(container) {
        _cleanup();

        scene = new THREE.Scene();
        const width = container.offsetWidth;
        const height = container.offsetHeight;

        camera = new THREE.PerspectiveCamera(50, width / height, 1, 50000);
        camera.position.set(0, 1200, 2000);
        camera.lookAt(0, 0, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        sunLight = new THREE.PointLight(0xffffff, 2.5, 50000);
        scene.add(sunLight);
        scene.add(new THREE.AmbientLight(0xffffff, 0.1));
    }

    function _animate(now) {
        if (!renderer) return;
        animationFrameId = requestAnimationFrame(_animate);

        // Update sun animation
        if (sunRenderer) {
            sunRenderer.update(now);
        }

        // Update planet rotations and orbital positions from data calculated in animationController
        if (currentSystemData && currentSystemData.planets) {
            currentSystemData.planets.forEach((planet, index) => {
                const mesh = planetMeshes[index];
                if (mesh) {
                    // Axial rotation
                    mesh.rotation.y = planet.currentAxialAngle;

                    // Orbital position
                    const x = planet.orbitalRadius * Math.cos(planet.currentOrbitalAngle);
                    const z = planet.orbitalRadius * Math.sin(planet.currentOrbitalAngle);
                    mesh.position.set(x, 0, z);
                }
            });
        }
        
        renderer.render(scene, camera);
    }
    
    return {
        init: (solarSystemData) => {
            const container = document.getElementById('solar-system-content');
            if (!container) {
                console.error("SolarSystemRenderer: Container #solar-system-content not found.");
                return;
            }

            _setupScene(container);
            
            currentSystemData = solarSystemData;
            const sunContainer = document.createElement('div');
            container.appendChild(sunContainer);
            
            // The SunRenderer is now a component managed by the SolarSystemRenderer
            sunRenderer = new SunRenderer(sunContainer, solarSystemData.sun.type);

            // Create planet meshes
            solarSystemData.planets.forEach(planet => {
                const planetMesh = _createPlanetMesh(planet);
                planetMeshes.push(planetMesh);
                scene.add(planetMesh);

                // Create orbit lines
                const orbitGeometry = new THREE.BufferGeometry().setFromPoints(
                    new THREE.Path().absarc(0, 0, planet.orbitalRadius, 0, Math.PI * 2, false).getPoints(128)
                );
                const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x444444 });
                const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
                orbitLine.rotation.x = Math.PI / 2;
                orbitLines.push(orbitLine);
                scene.add(orbitLine);
            });

            _animate();
        },

        update: (now, systemData) => {
            // This function is called by the external animationController to update data
            currentSystemData = systemData;
        },

        handlePanAndZoom: (panX, panY, zoom) => {
            if (camera) {
                // This is a simplified zoom/pan. A more robust implementation
                // would use OrbitControls or a similar utility.
                const newX = -panX * 2;
                const newY = 1200 / zoom; // Dolly zoom
                const newZ = 2000 / zoom;
                camera.position.set(newX, newY, newZ);
                camera.lookAt(newX, 0, 0);
            }
        },

        handleResize: () => {
            if (renderer && camera) {
                const container = renderer.domElement.parentElement;
                const width = container.offsetWidth;
                const height = container.offsetHeight;
                renderer.setSize(width, height);
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
            }
             if (sunRenderer) {
                sunRenderer._resize();
            }
        },

        dispose: () => {
            _cleanup();
        }
    };
})();
