// public/js/planetVisualPanelManager.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SHADERS from './shaders.js'; // Import the centralized shaders

export const PlanetVisualPanelManager = (() => {
    // --- CACHED DOM ELEMENTS ---
    let panelElement, headerElement, titleElement, sizeElement, closeButton, planet360CanvasElement;
    
    // --- STATE VARIABLES ---
    let currentPlanetData = null;
    let isDraggingPanel = false;
    let panelOffset = { x: 0, y: 0 };
    let is360ViewActive = false;
    let threeScene, threeCamera, threeRenderer, threePlanetMesh, threeControls, threeAnimationId, threeShaderMaterial;

    const SPHERE_BASE_RADIUS = 0.8;
    const DISPLACEMENT_SCALING_FACTOR = 0.005;

    function _onHeaderMouseDown(e) {
        if (e.target.closest('button')) return;
        isDraggingPanel = true;
        panelElement.classList.add('dragging');
        const panelRect = panelElement.getBoundingClientRect();
        panelOffset = { x: e.clientX - panelRect.left, y: e.clientY - panelRect.top };
        e.preventDefault();
    }

    function _onWindowMouseMove(e) {
        if (!isDraggingPanel) return;
        const newX = e.clientX - panelOffset.x;
        const newY = e.clientY - panelOffset.y;
        
        // --- SYNTAX FIX ---
        // Corrected the template literal syntax from `$px` to `${newX}px`
        panelElement.style.left = `${newX}px`;
        panelElement.style.top = `${newY}px`;

        if (panelElement.style.transform !== 'none') {
            panelElement.style.transform = 'none';
        }
    }

    function _onWindowMouseUp() {
        if (isDraggingPanel) {
            isDraggingPanel = false;
            panelElement.classList.remove('dragging');
        }
    }

    function init() {
        panelElement = document.getElementById('planet-visual-panel');
        headerElement = document.getElementById('planet-visual-panel-header');
        titleElement = document.getElementById('planet-visual-title');
        sizeElement = document.getElementById('planet-visual-size');
        closeButton = document.getElementById('close-planet-visual-panel');
        planet360CanvasElement = document.getElementById('panel-planet-360-canvas');
        if (!planet360CanvasElement) console.error("PVisualPanelManager: CRITICAL - 360 Canvas not found in DOM!");
        
        closeButton?.addEventListener('click', _closePanel);
        headerElement?.addEventListener('mousedown', _onHeaderMouseDown);
        
        // These listeners are now on the window, which is fine for this functionality.
        window.addEventListener('mousemove', _onWindowMouseMove);
        window.addEventListener('mouseup', _onWindowMouseUp);
        
        window.addEventListener('resize', () => {
            const panelIsVisible = panelElement?.classList.contains('visible');
            if (is360ViewActive && panelIsVisible && threeRenderer && threeCamera && planet360CanvasElement?.offsetParent !== null) {
                const canvas = planet360CanvasElement;
                const newWidth = canvas.offsetWidth;
                const newHeight = canvas.offsetHeight;
                if (newWidth > 0 && newHeight > 0) {
                    threeCamera.aspect = newWidth / newHeight;
                    threeCamera.updateProjectionMatrix();
                    threeRenderer.setSize(newWidth, newHeight);
                }
            }
        });
        console.log("PVisualPanelManager: Init complete.");
    }

    function show(planetData) {
        if (panelElement) {
            panelElement.classList.add('visible');
            // Center the panel when it first appears
            panelElement.style.left = '50%';
            panelElement.style.top = '50%';
            panelElement.style.transform = 'translate(-50%, -50%)';
        }
        if (planetData) {
            currentPlanetData = planetData;
            if (titleElement) titleElement.textContent = planetData.planetName || 'Planet';
            if (sizeElement) sizeElement.textContent = `${Number(planetData.size).toFixed(2)} units`;
            _switchTo360View();
        }
    }

    function _switchTo360View() {
        if (!currentPlanetData) return;
        is360ViewActive = true;
        _stopAndCleanupThreeJSView();
        if (planet360CanvasElement) {
            planet360CanvasElement.style.display = 'block';
            requestAnimationFrame(() => {
                if (planet360CanvasElement.offsetParent !== null) {
                    const newWidth = planet360CanvasElement.offsetWidth;
                    const newHeight = planet360CanvasElement.offsetHeight;
                    if (newWidth > 0 && newHeight > 0) {
                        planet360CanvasElement.width = newWidth;
                        planet360CanvasElement.height = newHeight;
                        _initThreeJSView(currentPlanetData);
                    }
                }
            });
        }
    }

    function _initThreeJSView(planet) {
        // --- SHADER SETUP (Now using imported shaders) ---
        const noiseFunctions = SHADERS.glslSimpleValueNoise3D;
        const finalVertexShader = SHADERS.planetVertexShader.replace('$', noiseFunctions);
        const finalFragmentShader = SHADERS.planetFragmentShader.replace('$', noiseFunctions);

        threeScene = new THREE.Scene();
        threeScene.background = new THREE.Color(0x050510);
        const aspectRatio = planet360CanvasElement.offsetWidth / planet360CanvasElement.offsetHeight;
        threeCamera = new THREE.PerspectiveCamera(60, aspectRatio, 0.001, 1000);
        threeCamera.position.z = 2.5;

        threeRenderer = new THREE.WebGLRenderer({ canvas: planet360CanvasElement, antialias: true });
        threeRenderer.setSize(planet360CanvasElement.offsetWidth, planet360CanvasElement.offsetHeight);
        threeRenderer.setPixelRatio(window.devicePixelRatio);

        const geometry = new THREE.SphereGeometry(SPHERE_BASE_RADIUS, 1024, 512);

        // Normalize planet properties for shader uniforms
        let normalizedOceanLevel = 0.5;
        const pMin = planet.minTerrainHeight ?? 0.0;
        const pMax = planet.maxTerrainHeight ?? (pMin + 10.0);
        const pOcean = planet.oceanHeightLevel ?? (pMin + (pMax - pMin) * 0.3);
        if (pMax > pMin) {
            normalizedOceanLevel = (pOcean - pMin) / (pMax - pMin);
        }
        normalizedOceanLevel = Math.max(0.2, Math.min(0.8, normalizedOceanLevel));
        const conceptualRange = Math.max(0, pMax - pMin);
        const displacementAmount = conceptualRange * DISPLACEMENT_SCALING_FACTOR;

        const uniforms = {
            uLandColor: { value: new THREE.Color(planet.landColor || '#556B2F') },
            uWaterColor: { value: new THREE.Color(planet.waterColor || '#1E90FF') },
            uOceanHeightLevel: { value: normalizedOceanLevel },
            uContinentSeed: { value: planet.continentSeed ?? Math.random() },
            uRiverBasin: { value: planet.riverBasin ?? 0.05 },
            uForestDensity: { value: planet.forestDensity ?? 0.5 },
            uTime: { value: 0.0 },
            uSphereRadius: { value: SPHERE_BASE_RADIUS },
            uDisplacementAmount: { value: displacementAmount }
        };
        
        threeShaderMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: finalVertexShader,
            fragmentShader: finalFragmentShader,
        });

        threePlanetMesh = new THREE.Mesh(geometry, threeShaderMaterial);
        threeScene.add(threePlanetMesh);

        threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
        threeControls.enableDamping = true;
        threeControls.dampingFactor = 0.05;
        threeControls.screenSpacePanning = false;
        threeControls.rotateSpeed = 0.5;
        threeControls.minDistance = 0.9;
        threeControls.maxDistance = SPHERE_BASE_RADIUS * 7;
        threeControls.target.set(0, 0, 0);

        _animateThreeJSView();
    }

    function _animateThreeJSView() {
        if (!is360ViewActive || !threeRenderer) return;
        threeAnimationId = requestAnimationFrame(_animateThreeJSView);
        if (threeShaderMaterial?.uniforms.uTime) {
            threeShaderMaterial.uniforms.uTime.value += 0.005;
        }
        if (threeControls) threeControls.update();
        if (threeRenderer && threeScene && threeCamera) threeRenderer.render(threeScene, threeCamera);
    }

    function _stopAndCleanupThreeJSView() {
        if (threeAnimationId) cancelAnimationFrame(threeAnimationId);
        if (threeControls) threeControls.dispose();
        if (threeShaderMaterial) threeShaderMaterial.dispose();
        if (threePlanetMesh) {
            if(threePlanetMesh.geometry) threePlanetMesh.geometry.dispose();
            if(threeScene) threeScene.remove(threePlanetMesh);
        }
        if (threeRenderer) threeRenderer.dispose();
        threeAnimationId = null;
        threeControls = null;
        threeShaderMaterial = null;
        threePlanetMesh = null;
        threeScene = null;
        threeCamera = null;
        threeRenderer = null; // Also nullify the renderer
    }

    function _closePanel() {
        if (panelElement) panelElement.classList.remove('visible');
        is360ViewActive = false;
        _stopAndCleanupThreeJSView();
        if (planet360CanvasElement) planet360CanvasElement.style.display = 'none';
    }

    return {
        init,
        show,
        hide: _closePanel,
        isVisible: () => panelElement?.classList.contains('visible'),
        getCurrentPlanetData: () => currentPlanetData,
    };
})();
