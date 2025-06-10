import { PlanetDesigner } from './planetDesigner.js';
import { saveGameState, loadGameState } from './storage.js';
import {
    generatePlanetInstanceFromBasis,
    generateUniverseLayout,
    generateGalaxies,
    preGenerateAllGalaxyContents,
    regenerateCurrentUniverseState
} from './universeGenerator.js';
import { UIManager } from './uiManager.js';
import * as THREE from 'three'; // Import Three.js globally
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'; // Import OrbitControls globally

// --- INITIALIZATION ---
function initializeModules() {
    window.PlanetDesigner = PlanetDesigner;
    if (window.PlanetDesigner?.init) {
        window.PlanetDesigner.init();
    } else {
        console.error("PlanetDesigner module or init function is missing.");
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // --- GLOBAL THREE.JS SETUP ---
    // Initialize a single Three.js scene, camera, renderer, and controls
    const container = document.body; // Or a specific container for the 3D view
    const aspect = window.innerWidth / window.innerHeight; // Initial aspect ratio

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Default background for unified scene

    const camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 600000); // Wider range for solar system and close-up
    camera.position.set(0, 40000, 20000); // Initial camera position

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement); // Append to body or a specific div

    const controls = new OrbitControls(camera, renderer.domElement);
    Object.assign(controls, {
        enableDamping: true, dampingFactor: 0.05, screenSpacePanning: true,
        minDistance: 50, maxDistance: 450000, enablePan: true, rotateSpeed: 0.4,
        mouseButtons: { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE },
        enableZoom: false, // Zoom is handled manually by wheel handler
        autoRotate: false,
        autoRotateSpeed: 0.5
    });

    // Store global Three.js instances
    window.appThreeJS = {
        scene,
        camera,
        renderer,
        controls,
        // Add a simple animation loop for the global renderer
        animate: (now) => {
            requestAnimationFrame(window.appThreeJS.animate);
            if (window.appThreeJS.controls) window.appThreeJS.controls.update();
            // This is where app-specific animation logic will go.
            // For now, it just updates controls and renders the scene.
            if (window.activeSolarSystemRenderer) window.activeSolarSystemRenderer.update(now); // Call update on active renderer
            if (window.activeHexPlanetViewController) window.activeHexPlanetViewController.update(now); // Call update on active hex view
            if (window.appThreeJS.renderer && window.appThreeJS.scene && window.appThreeJS.camera) {
                window.appThreeJS.renderer.render(window.appThreeJS.scene, window.appThreeJS.camera);
            }
        },
        // Handle window resize for the global renderer
        onResize: () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            if (newWidth > 0 && newHeight > 0) {
                window.appThreeJS.camera.aspect = newWidth / newHeight;
                window.appThreeJS.camera.updateProjectionMatrix();
                window.appThreeJS.renderer.setSize(newWidth, newHeight);
            }
        }
    };
    window.addEventListener('resize', window.appThreeJS.onResize);
    window.appThreeJS.animate(0); // Start the global animation loop

    // --- GLOBAL CONFIG & STATE ---
    window.DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
    window.DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
    window.DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;
    window.DEFAULT_PLANET_AXIAL_SPEED = 0.01;

    const DEV_SETTINGS_KEY = 'universeDevSettings';
    let devSettings = {};

    window.gameSessionData = {
        universe: { diameter: null },
        galaxies: [],
        activeGalaxyId: null,
        activeSolarSystemId: null,
        isInitialized: false,
        customPlanetDesigns: [],
        panning: { isActive: false }
    };

    // --- DOM ELEMENT REFERENCES ---
    const domElements = {
        mainScreen: document.getElementById('main-screen'),
        galaxyDetailScreen: document.getElementById('galaxy-detail-screen'),
        solarSystemScreen: document.getElementById('solar-system-screen'),
        hexPlanetScreen: document.getElementById('hex-planet-screen'),
        universeCircle: document.getElementById('universe-circle'),
        galaxyViewport: document.getElementById('galaxy-viewport'),
        galaxyZoomContent: document.getElementById('galaxy-zoom-content'),
        solarSystemLinesCanvasEl: document.getElementById('solar-system-lines-canvas'),
        solarSystemContent: document.getElementById('solar-system-content'),
        planetDesignerScreen: document.getElementById('planet-designer-screen'),
        mainScreenTitleText: document.getElementById('main-screen-title-text'),
        galaxyDetailTitleText: document.getElementById('galaxy-detail-title-text'),
        galaxyDetailTitleInput: document.getElementById('galaxy-detail-title-input'),
        solarSystemTitleText: document.getElementById('solar-system-title-text'),
        solarSystemTitleInput: document.getElementById('solar-system-title-input'),
        backToMainButton: document.getElementById('back-to-main'),
        backToGalaxyButton: document.getElementById('back-to-galaxy'),
        zoomControlsElement: document.getElementById('zoom-controls'),
        zoomInButton: document.getElementById('zoom-in-btn'),
        zoomOutButton: document.getElementById('zoom-out-btn'),
        regenerateUniverseButton: document.getElementById('regenerate-universe-btn'),
        createPlanetDesignButton: document.getElementById('create-planet-design-btn'),
        planetSidebar: document.getElementById('planet-sidebar'),
        planetSidebarList: document.getElementById('planet-sidebar-list'),
        // START: Add Dev Controls Elements
        devControlsButton: document.getElementById('dev-controls-btn'),
        devControlsModal: document.getElementById('dev-controls-modal'),
        devNumGalaxiesInput: document.getElementById('dev-num-galaxies'),
        devMinPlanetsInput: document.getElementById('dev-min-planets'),
        devMaxPlanetsInput: document.getElementById('dev-max-planets'),
        devOrbitLinesVisibleInput: document.getElementById('dev-orbit-lines-visible'),
        devOrbitSpeedInput: document.getElementById('dev-orbit-speed'),
        devOrbitSpeedValue: document.getElementById('dev-orbit-speed-value'),
        devControlsSaveButton: document.getElementById('dev-controls-save'),
        devControlsCancelButton: document.getElementById('dev-controls-cancel'),
        // END: Add Dev Controls Elements
    };

    // --- FUNCTIONS ---
    window.saveGameState = saveGameState;
    window.generatePlanetInstanceFromBasis = generatePlanetInstanceFromBasis;

    // START: Add Dev Controls Logic
    function loadDevSettings() {
        const defaults = { numGalaxies: 3, minPlanets: 2, maxPlanets: 8, orbitLinesVisible: false, orbitSpeed: 1.0 };
        try {
            const storedSettings = localStorage.getItem(DEV_SETTINGS_KEY);
            devSettings = storedSettings ? { ...defaults, ...JSON.parse(storedSettings) } : defaults;
        } catch (e) {
            console.error("Error loading dev settings, using defaults.", e);
            devSettings = defaults;
        }
        updateDevControlsUI();
        applyDynamicDevSettings();
    }

    function saveDevSettings() {
        devSettings = {
            numGalaxies: parseInt(domElements.devNumGalaxiesInput.value, 10),
            minPlanets: parseInt(domElements.devMinPlanetsInput.value, 10),
            maxPlanets: parseInt(domElements.devMaxPlanetsInput.value, 10),
            orbitLinesVisible: domElements.devOrbitLinesVisibleInput.checked,
            orbitSpeed: parseFloat(domElements.devOrbitSpeedInput.value)
        };
        localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify(devSettings));
        applyDynamicDevSettings();
        domElements.devControlsModal.classList.remove('visible');
        alert("Settings saved. Some settings require a new universe generation to take effect.");
    }

    function updateDevControlsUI() {
        domElements.devNumGalaxiesInput.value = devSettings.numGalaxies;
        domElements.devMinPlanetsInput.value = devSettings.minPlanets;
        domElements.devMaxPlanetsInput.value = devSettings.maxPlanets;
        domElements.devOrbitLinesVisibleInput.checked = devSettings.orbitLinesVisible;
        domElements.devOrbitSpeedInput.value = devSettings.orbitSpeed;
        domElements.devOrbitSpeedValue.textContent = Number(devSettings.orbitSpeed).toFixed(1);
    }

    function applyDynamicDevSettings() {
        // Now SolarSystemRenderer and HexPlanetViewController will update based on this.
        // The activeRenderer/activeHexPlanetViewController reference will be set by UIManager.
        if (window.activeSolarSystemRenderer) {
            window.activeSolarSystemRenderer.setOrbitLinesVisible(devSettings.orbitLinesVisible);
            window.activeSolarSystemRenderer.setOrbitSpeed(devSettings.orbitSpeed);
        }
    }

    function setupDevControlsListeners() {
        domElements.devControlsButton.addEventListener('click', () => {
            updateDevControlsUI(); // Ensure UI is up-to-date when opened
            domElements.devControlsModal.classList.add('visible');
        });
        domElements.devControlsCancelButton.addEventListener('click', () => domElements.devControlsModal.classList.remove('visible'));
        domElements.devControlsSaveButton.addEventListener('click', saveDevSettings);
        domElements.devOrbitSpeedInput.addEventListener('input', (e) => {
            domElements.devOrbitSpeedValue.textContent = Number(e.target.value).toFixed(1);
        });
    }
    // END: Add Dev Controls Logic

    function generatePlanetsForSystem(solarSystemObject){
        solarSystemObject.planets = [];
        const numPlanets = Math.floor(Math.random() * (devSettings.maxPlanets - devSettings.minPlanets + 1)) + devSettings.minPlanets;

        console.log(`[DEBUG] Generating ${numPlanets} planets for system ${solarSystemObject.id}.`);

        const SUN_ICON_SIZE = 60;
        const MIN_ORBITAL_SEPARATION = 2000;
        const MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0;
        let lastOrbitalRadius = MIN_PLANET_DISTANCE;

        for (let i = 0; i < numPlanets; i++) {
            const planetData = generatePlanetInstanceFromBasis({});
            const orbitalRadius = lastOrbitalRadius + MIN_ORBITAL_SEPARATION + Math.random() * 45000;

            solarSystemObject.planets.push({
                ...planetData,
                id: `${solarSystemObject.id}-planet-${i}`,
                size: 50 + Math.random() * 100,
                orbitalRadius: orbitalRadius,
                orbitalSpeed: Math.sqrt(10000 / orbitalRadius),
                currentOrbitalAngle: Math.random() * 2 * Math.PI,
                axialSpeed: (Math.random() - 0.5) * 0.05,
                currentAxialAngle: Math.random() * 2 * Math.PI,
            });
            lastOrbitalRadius = orbitalRadius;
        }
        saveGameState();
    }

    function initializeGame(isForcedRegeneration = false) {
        console.log("Initializing game...");
        loadDevSettings(); // Load settings first

        if (!isForcedRegeneration && loadGameState()) {
            console.log("Loaded existing game state.");
            generateUniverseLayout(domElements.universeCircle, window.gameSessionData, { universeBg: '#100520' });
        } else {
            if (!isForcedRegeneration) console.log("No valid save found. Generating new universe.");
            generateUniverseLayout(domElements.universeCircle, window.gameSessionData, { universeBg: '#100520' });
            generateGalaxies(window.gameSessionData, domElements.universeCircle, devSettings.numGalaxies);
        }

        UIManager.renderMainScreen();
        preGenerateAllGalaxyContents(window.gameSessionData, domElements.galaxyViewport, { min: 200, max: 300 }); // Note: SS count is not in dev controls yet

        window.gameSessionData.isInitialized = true;
        console.log("Game initialization complete.");
    }

    const callbacks = {
        saveGameState: saveGameState,
        regenerateUniverseState: () => regenerateCurrentUniverseState(
            { initializeGame },
            domElements
        ),
        switchToPlanetDesignerScreen: () => {
            UIManager.setActiveScreen(domElements.planetDesignerScreen);
            if (window.PlanetDesigner?.activate) window.PlanetDesigner.activate();
            else console.error("switchToPlanetDesignerScreen: PlanetDesigner module or activate function not found.");
        },
        generatePlanetsForSystem: generatePlanetsForSystem,
        getCustomizationSettings: () => ({
            ssCountRange: { min: 200, max: 300 } // Note: Not yet in dev controls
        }),
        // Pass the global Three.js environment to UIManager
        getThreeJSEnvironment: () => window.appThreeJS
    };

    UIManager.init(domElements, callbacks);

    // --- STARTUP ---
    initializeModules();
    setupDevControlsListeners(); // Set up listeners for the new modal
    initializeGame();
});
