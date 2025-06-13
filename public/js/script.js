// public/js/script.js
import { startSolarSystemAnimation, stopSolarSystemAnimation } from './animationController.js';
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
    
    // --- GLOBAL CONFIG & STATE ---
    window.DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
    window.DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
    window.DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;
    window.DEFAULT_PLANET_AXIAL_SPEED = 0.01;
    
    const DEV_SETTINGS_KEY = 'universeDevSettings';
    let devSettings = {};
    let oldDevSettingsForRegenCheck = {};

    window.gameSessionData = {
        universe: { diameter: null },
        galaxies: [],
        activeGalaxyId: null,
        activeSolarSystemId: null,
        isInitialized: false,
        customPlanetDesigns: [],
        customGalaxyDesigns: [], // NEW: Initialize custom galaxy designs array
        panning: { isActive: false }
    };

    // --- DOM ELEMENT REFERENCES ---
const domElements = {
        galaxyDetailScreen: document.getElementById('galaxy-detail-screen'),
        solarSystemScreen: document.getElementById('solar-system-screen'),
        hexPlanetScreen: document.getElementById('hex-planet-screen'),
        solarSystemContent: document.getElementById('solar-system-content'),
        planetDesignerScreen: document.getElementById('planet-designer-screen'),
        galaxyDetailTitleText: document.getElementById('galaxy-detail-title-text'),
        galaxyDetailTitleInput: document.getElementById('galaxy-detail-title-input'),
        solarSystemTitleText: document.getElementById('solar-system-title-text'),
        solarSystemTitleInput: document.getElementById('solar-system-title-input'),
        backToGalaxyButton: document.getElementById('back-to-galaxy'),
        regenerateUniverseButton: document.getElementById('regenerate-universe-btn'),
        createPlanetDesignButton: document.getElementById('create-planet-design-btn'),
        planetSidebar: document.getElementById('planet-sidebar'),
        planetSidebarList: document.getElementById('planet-sidebar-list'),
        devControlsButton: document.getElementById('dev-controls-btn'),
        devControlsModal: document.getElementById('dev-controls-modal'),
        devMinPlanetsInput: document.getElementById('dev-min-planets'),
        devMaxPlanetsInput: document.getElementById('dev-max-planets'),
        devOrbitLinesVisibleInput: document.getElementById('dev-orbit-lines-visible'),
        devOrbitSpeedInput: document.getElementById('dev-orbit-speed'),
        devOrbitSpeedValue: document.getElementById('dev-orbit-speed-value'),
        devControlsSaveButton: document.getElementById('dev-controls-save'),
        devControlsCancelButton: document.getElementById('dev-controls-cancel'),
        // NEW: Add galaxy customization elements to domElements
        galaxyCustomizationModal: document.getElementById('galaxy-customization-modal'),
        customizeGalaxyBtn: document.getElementById('customize-galaxy-btn'),
    };
    
    // --- FUNCTIONS ---
    window.saveGameState = saveGameState;
    window.generatePlanetInstanceFromBasis = generatePlanetInstanceFromBasis;

    function loadDevSettings() {
        const defaults = { minPlanets: 2, maxPlanets: 8, orbitLinesVisible: false, orbitSpeed: 9.0 };
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
        const newMinPlanets = parseInt(domElements.devMinPlanetsInput.value, 10);
        const newMaxPlanets = parseInt(domElements.devMaxPlanetsInput.value, 10);

        const needsRegen = newMinPlanets !== oldDevSettingsForRegenCheck.minPlanets ||
                           newMaxPlanets !== oldDevSettingsForRegenCheck.maxPlanets;

        devSettings = {
            minPlanets: newMinPlanets,
            maxPlanets: newMaxPlanets,
            orbitLinesVisible: domElements.devOrbitLinesVisibleInput.checked,
            orbitSpeed: parseFloat(domElements.devOrbitSpeedInput.value)
        };
        localStorage.setItem(DEV_SETTINGS_KEY, JSON.stringify(devSettings));
        
        domElements.devControlsModal.classList.remove('visible');

        if (needsRegen) {
            callbacks.regenerateUniverseState();
        } else {
            applyDynamicDevSettings();
            alert("Settings saved. Dynamic settings have been applied.");
        }
    }

    function updateDevControlsUI() {
        domElements.devMinPlanetsInput.value = devSettings.minPlanets;
        domElements.devMaxPlanetsInput.value = devSettings.maxPlanets;
        domElements.devOrbitLinesVisibleInput.checked = devSettings.orbitLinesVisible;
        domElements.devOrbitSpeedInput.value = devSettings.orbitSpeed;
        domElements.devOrbitSpeedValue.textContent = Number(devSettings.orbitSpeed).toFixed(1);
    }

    function applyDynamicDevSettings() {
        if (window.activeSolarSystemRenderer) {
            window.activeSolarSystemRenderer.setOrbitLinesVisible(devSettings.orbitLinesVisible);
            window.activeSolarSystemRenderer.setOrbitSpeed(devSettings.orbitSpeed);
        }
    }

    function setupDevControlsListeners() {
        domElements.devControlsButton.addEventListener('click', () => {
            updateDevControlsUI();
            // Store settings before user can change them
            oldDevSettingsForRegenCheck = {
                minPlanets: devSettings.minPlanets,
                maxPlanets: devSettings.maxPlanets,
            };
            domElements.devControlsModal.classList.add('visible');
        });
        domElements.devControlsCancelButton.addEventListener('click', () => domElements.devControlsModal.classList.remove('visible'));
        domElements.devControlsSaveButton.addEventListener('click', saveDevSettings);
        domElements.devOrbitSpeedInput.addEventListener('input', (e) => {
            domElements.devOrbitSpeedValue.textContent = Number(e.target.value).toFixed(1);
        });
    }

    function generatePlanetsForSystem(solarSystemObject){
        solarSystemObject.planets = [];
        const numPlanets = Math.floor(Math.random() * (devSettings.maxPlanets - devSettings.minPlanets + 1)) + devSettings.minPlanets;
        
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
        loadDevSettings();

        let galaxyToLoadId = null;

        if (!isForcedRegeneration && loadGameState()) {
            console.log("Loaded existing game state.");
            generateUniverseLayout(null, window.gameSessionData, { universeBg: '#100520' });
            galaxyToLoadId = window.gameSessionData.activeGalaxyId;
        } else {
            if (!isForcedRegeneration) console.log("No valid save found. Generating new universe.");
            generateUniverseLayout(null, window.gameSessionData, { universeBg: '#100520' });
            generateGalaxies(window.gameSessionData);
        }
        
        preGenerateAllGalaxyContents(window.gameSessionData, domElements.galaxyDetailScreen, { min: 80, max: 120 });
        
        if (!galaxyToLoadId && window.gameSessionData.galaxies.length > 0) {
            galaxyToLoadId = window.gameSessionData.galaxies[0].id;
        }

        if (galaxyToLoadId) {
            setTimeout(() => {
                if(window.switchToGalaxyDetailView){
                    window.switchToGalaxyDetailView(galaxyToLoadId)
                }
            }, 0);
        } else {
            console.error("No galaxy found to load. Cannot start game.");
        }
        
        window.gameSessionData.isInitialized = true;
        console.log("Game initialization complete.");
    }
    
    const callbacks = {
        saveGameState: saveGameState,
        startSolarSystemAnimation: startSolarSystemAnimation,
        stopSolarSystemAnimation: stopSolarSystemAnimation,
        regenerateUniverseState: () => regenerateCurrentUniverseState(
            { stopSolarSystemAnimation, initializeGame },
            domElements
        ),
        switchToPlanetDesignerScreen: () => {
            let onBack;
            if (window.gameSessionData.activeSolarSystemId) {
                onBack = () => window.switchToSolarSystemView(window.gameSessionData.activeSolarSystemId);
            } else {
                onBack = () => window.switchToGalaxyDetailView(window.gameSessionData.activeGalaxyId);
            }

            UIManager.setActiveScreen(domElements.planetDesignerScreen);
            if (window.PlanetDesigner?.activate) {
                window.PlanetDesigner.activate(onBack);
            } else {
                console.error("switchToPlanetDesignerScreen: PlanetDesigner module or activate function not found.");
            }
        },
        generatePlanetsForSystem: generatePlanetsForSystem,
        getCustomizationSettings: () => ({
            ssCountRange: { min: 200, max: 300 }
        }),
        getDevSettings: () => devSettings, // FIX: Expose devSettings for other modules
    };

    UIManager.init(domElements, callbacks);
    
    // --- STARTUP ---
    initializeModules();
    setupDevControlsListeners();
    initializeGame();
});
