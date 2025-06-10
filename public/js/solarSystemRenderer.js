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
    let raycaster, mouse;

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

        if (renderer?.domElement) {
            renderer.domElement.removeEventListener('click', _onPlanetClick);
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

        // MODIFICATION: Switched to OrthographicCamera for a top-down view.
        const aspect = width / height;
        const frustumSize = 4000; // This value determines the initial "zoom" level
        camera = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 1, 50000);
        camera.position.set(0, 2000, 0); // Position directly above the scene
        camera.lookAt(0, 0, 0);       // Look at the center (sun)

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        container.appendChild(renderer.domElement);

        // MODIFICATION: Add raycaster for detecting clicks.
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        renderer.domElement.addEventListener('click', _onPlanetClick, false);


        sunLight = new THREE.PointLight(0xffffff, 2.5, 50000);
        scene.add(sunLight);
        scene.add(new THREE.AmbientLight(0xffffff, 0.1));
    }

    // MODIFICATION: Added click handler for planets.
    function _onPlanetClick(event) {
        event.preventDefault();
        if (!renderer || !camera || planetMeshes.length === 0) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(planetMeshes);

        if (intersects.length > 0) {
            const clickedPlanetData = intersects[0].object.userData;
            console.log("Clicked on planet:", clickedPlanetData.id);

            // Callback to return to this view after exploring
            const onBackCallback = () => {
                if (window.switchToSolarSystemView && currentSystemData?.id) {
                    window.switchToSolarSystemView(currentSystemData.id);
                } else {
                    window.switchToMainView();
                }
            };
            
            if (window.switchToHexPlanetView) {
                window.switchToHexPlanetView(clickedPlanetData, onBackCallback);
            }
        }
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
                // MODIFICATION: Updated pan/zoom logic for OrthographicCamera.
                const frustumSize = 4000;
                const aspect = camera.right / camera.top; // Recalculate aspect
                
                // Zoom affects the camera's view frustum
                camera.left = -frustumSize * aspect / 2 / zoom;
                camera.right = frustumSize * aspect / 2 / zoom;
                camera.top = frustumSize / 2 / zoom;
                camera.bottom = -frustumSize / 2 / zoom;

                // Pan moves the camera's position on the X and Z axes
                camera.position.x = -panX;
                camera.position.z = panY; // Note: panY from screen maps to Z in 3D top-down view

                camera.updateProjectionMatrix();
            }
        },

        handleResize: () => {
            if (renderer && camera) {
                const container = renderer.domElement.parentElement;
                const width = container.offsetWidth;
                const height = container.offsetHeight;
                renderer.setSize(width, height);

                // MODIFICATION: Update aspect ratio for OrthographicCamera
                const aspect = width / height;
                camera.left = camera.right * -aspect;
                camera.right = camera.right; // right is maintained
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
