// public/js/planetVisualPanelManager.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Shader Definitions ---
const glslRandom2to1 = `...`; // Shader code remains the same
const glslSimpleValueNoise3D = `...`; // Shader code remains the same
const glslLayeredNoise = `...`; // Shader code remains the same
const planetVertexShader = `...`; // Shader code remains the same
const planetFragmentShader = `...`; // Shader code remains the same


export const PlanetVisualPanelManager = (() => {
    console.log("PVisualPanelManager: Script loaded.");

    // DOM Elements
    let panelElement, headerElement, titleElement, sizeElement,
        closeButton, planet360CanvasElement;

    // State
    let currentPlanetData = null;
    let isDraggingPanel = false;
    let panelOffset = { x: 0, y: 0 };

    let is360ViewActive = false;
    let threeScene, threeCamera, threeRenderer, threePlanetMesh, threeControls, threeAnimationId;
    let threeShaderMaterial;

    const SPHERE_BASE_RADIUS = 0.8;
    const DISPLACEMENT_SCALING_FACTOR = 0.01;

    // --- Panel Dragging Logic (Header Only) ---
    function _onHeaderMouseDown(e) {
        if (e.target.closest('button')) return; // Ignore clicks on buttons in the header
        isDraggingPanel = true;
        panelElement.classList.add('dragging');
        const panelRect = panelElement.getBoundingClientRect();
        panelOffset = {
            x: e.clientX - panelRect.left,
            y: e.clientY - panelRect.top,
        };
        // Prevent text selection while dragging
        e.preventDefault();
    }

    function _onWindowMouseMove(e) {
        if (!isDraggingPanel) return;
        const newX = e.clientX - panelOffset.x;
        const newY = e.clientY - panelOffset.y;
        panelElement.style.left = `${newX}px`;
        panelElement.style.top = `${newY}px`;
        // This move is direct, not using transform, to avoid conflict with the initial centering transform
        // To make this work best, ensure the initial transform is removed after first drag
        if (panelElement.style.transform !== 'none') {
             panelElement.style.transform = 'none';
        }
    }

    function _onWindowMouseUp(e) {
        if (isDraggingPanel) {
            isDraggingPanel = false;
            panelElement.classList.remove('dragging');
        }
    }
    
    // --- Core Module Functions ---
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

        // Global listeners for panel dragging
        window.addEventListener('mousemove', _onWindowMouseMove);
        window.addEventListener('mouseup', _onWindowMouseUp);

        // Resize handler for the 3D view
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
            // Reset position to center before showing
            panelElement.style.left = '50%';
            panelElement.style.top = '50%';
            panelElement.style.transform = 'translate(-50%, -50%)';
        }
        if (planetData) {
            currentPlanetData = planetData;
            if (titleElement) titleElement.textContent = planetData.planetName || 'Planet';
            if (sizeElement) sizeElement.textContent = `${planetData.size.toFixed(2)} units`;
            // Directly switch to the 360-degree (3D) view
            _switchTo360View();
        }
    }
    
    function _switchTo360View() {
        if (!currentPlanetData) return;

        is360ViewActive = true;
        _stopAndCleanupThreeJSView(); // Clean up any previous instance

        if (planet360CanvasElement) {
            planet360CanvasElement.style.display = 'block';
            
            // Defer initialization to ensure canvas is visible and has dimensions
            requestAnimationFrame(() => {
                if (planet360CanvasElement.offsetParent !== null) {
                    const newWidth = planet360CanvasElement.offsetWidth;
                    const newHeight = planet360CanvasElement.offsetHeight;

                    if (newWidth > 0 && newHeight > 0) {
                        planet360CanvasElement.width = newWidth;
                        planet360CanvasElement.height = newHeight;
                        _initThreeJSView(currentPlanetData);
                    } else {
                        console.warn("PVisualPanelManager: 360 canvas had zero dimensions. Using fallback.");
                        planet360CanvasElement.width = 300;
                        planet360CanvasElement.height = 300;
                         _initThreeJSView(currentPlanetData);
                    }
                } else {
                    console.warn("PVisualPanelManager: 360 canvas not in DOM or not visible, deferring Three.js init.");
                }
            });
        }
    }

    function _initThreeJSView(planet) {
        if (!planet360CanvasElement || !planet) {
            console.error("PVisualPanelManager: Cannot init 360 view - canvas or planet data missing.");
            return;
        }

        console.log("PVisualPanelManager: Initializing Three.js view for:", planet.planetName);

        threeScene = new THREE.Scene();
        threeScene.background = new THREE.Color(0x050510);

        const aspectRatio = planet360CanvasElement.offsetWidth / planet360CanvasElement.offsetHeight;
        threeCamera = new THREE.PerspectiveCamera(60, aspectRatio, 0.1, 1000);
        const fovInRadians = THREE.MathUtils.degToRad(threeCamera.fov);
        const distance = SPHERE_BASE_RADIUS / Math.sin(fovInRadians / 2) + 0.2;
        threeCamera.position.z = Math.max(distance, SPHERE_BASE_RADIUS * 1.5);

        threeRenderer = new THREE.WebGLRenderer({ canvas: planet360CanvasElement, antialias: true, alpha: true });
        threeRenderer.setSize(planet360CanvasElement.offsetWidth, planet360CanvasElement.offsetHeight);
        threeRenderer.setPixelRatio(window.devicePixelRatio);

        const geometry = new THREE.SphereGeometry(SPHERE_BASE_RADIUS, 64, 48);

        // --- Calculate Shader Uniforms (as before) ---
        let normalizedOceanLevel = 0.3;
        const pMin = planet.minTerrainHeight ?? 0.0;
        const pMax = planet.maxTerrainHeight ?? (pMin + 10.0);
        const pOcean = planet.oceanHeightLevel ?? (pMin + (pMax - pMin) * 0.3);
        if (pMax > pMin) {
            normalizedOceanLevel = (pOcean - pMin) / (pMax - pMin);
        }
        normalizedOceanLevel = Math.max(0.0, Math.min(1.0, normalizedOceanLevel));
        const conceptualRange = Math.max(0, pMax - pMin);
        const displacementAmount = conceptualRange * DISPLACEMENT_SCALING_FACTOR;

        const uniforms = {
            uLandColor: { value: new THREE.Color(planet.landColor || '#006400') },
            uWaterColor: { value: new THREE.Color(planet.waterColor || '#0000FF') },
            uOceanHeightLevel: { value: normalizedOceanLevel },
            uContinentSeed: { value: planet.continentSeed ?? Math.random() },
            uTime: { value: 0.0 },
            uSphereRadius: { value: SPHERE_BASE_RADIUS },
            uDisplacementAmount: { value: displacementAmount }
        };

        threeShaderMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: planetVertexShader.replace(/\$/g, glslLayeredNoise.replace(/\$/g, glslSimpleValueNoise3D.replace(/\$/g, glslRandom2to1))),
            fragmentShader: planetFragmentShader,
        });

        threePlanetMesh = new THREE.Mesh(geometry, threeShaderMaterial);
        threeScene.add(threePlanetMesh);

        threeControls = new OrbitControls(threeCamera, threeRenderer.domElement);
        threeControls.enableDamping = true;
        threeControls.dampingFactor = 0.05;
        threeControls.screenSpacePanning = false;
        threeControls.minDistance = SPHERE_BASE_RADIUS * 1.05;
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
        threeAnimationId = null;

        if (threeControls) {
            threeControls.dispose();
            threeControls = null;
        }
        if (threePlanetMesh) {
            if (threePlanetMesh.geometry) threePlanetMesh.geometry.dispose();
            if (threeShaderMaterial) threeShaderMaterial.dispose();
            if (threeScene) threeScene.remove(threePlanetMesh);
            threePlanetMesh = null;
            threeShaderMaterial = null;
        }
        if (threeScene) {
            while(threeScene.children.length > 0){ 
                threeScene.remove(threeScene.children[0]);
            }
        }
        if (threeRenderer) {
            threeRenderer.dispose();
            threeRenderer = null;
        }
        threeScene = null;
        threeCamera = null;
        console.log("PVisualPanelManager: Three.js 360 view cleaned up.");
    }
    
    function _closePanel() {
        if (panelElement) {
            panelElement.classList.remove('visible');
        }
        is360ViewActive = false;
        _stopAndCleanupThreeJSView();
        
        // Hide the 3D canvas when the panel is closed
        if (planet360CanvasElement) {
            planet360CanvasElement.style.display = 'none';
        }
    }

    // --- Public API ---
    return {
        init,
        show,
        hide: _closePanel,
        isVisible: () => panelElement?.classList.contains('visible'),
        getCurrentPlanetData: () => currentPlanetData,
    };
})();
