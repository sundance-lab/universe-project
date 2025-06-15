// public/js/script.js
import * as THREE from 'three';
import { PlanetDesigner } from './planetDesigner.js';
import GameStateManager from './gameStateManager.js';
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

    window.DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
    window.DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
    window.DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;
    window.DEFAULT_PLANET_AXIAL_SPEED = 0.01;

    const DEV_SETTINGS_KEY = 'universeDevSettings';
    let devSettings = {};
    let oldDevSettingsForRegenCheck = {};

    const domElements = {
        mainScreen: document.getElementById('main-screen'),
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
        planetSidebar: document.getElementById('planet-sidebar'),
        planetSidebarList: document.getElementById('planet-sidebar-list'),
        galaxyCustomizationModal: document.getElementById('galaxy-customization-modal'),
        devPanelButton: document.getElementById('dev-panel-btn'),
        devPanelModal: document.getElementById('dev-panel-modal'),
        panelRegenerateUniverseButton: document.getElementById('panel-regenerate-universe-btn'),
        panelOpenPlanetDesignerButton: document.getElementById('panel-open-planet-designer-btn'),
        panelOpenGalaxyCustomizerButton: document.getElementById('panel-open-galaxy-customizer-btn'),
        devMinPlanetsInput: document.getElementById('dev-min-planets'),
        devMaxPlanetsInput: document.getElementById('dev-max-planets'),
        devOrbitLinesVisibleInput: document.getElementById('dev-orbit-lines-visible'),
        devOrbitSpeedInput: document.getElementById('dev-orbit-speed'),
        devOrbitSpeedValue: document.getElementById('dev-orbit-speed-value'),
        devPanelSaveButton: document.getElementById('dev-panel-save'),
        devPanelCancelButton: document.getElementById('dev-panel-cancel'),
    };

    // --- FUNCTIONS ---
    window.generatePlanetInstanceFromBasis = generatePlanetInstanceFromBasis;

    const sizeTiers = {
        dwarf:      { size: 15 * 100, detailMultiplier: 1.5 },
        normal:     { size: 30 * 100, detailMultiplier: 1.3 },
        giant:      { size: 60 * 100, detailMultiplier: 1.1 },
        supergiant: { size: 120 * 100, detailMultiplier: 1.0 },
        hypergiant: { size: 240 * 100, detailMultiplier: 0.9 }
    };
    const sunVariations = [
        { baseColor: new THREE.Color(0x4A90E2), hotColor: new THREE.Color(0xFFFFFF), coolColor: new THREE.Color(0x2979FF), glowColor: new THREE.Color(0x64B5F6), coronaColor: new THREE.Color(0x90CAF9), midColor: new THREE.Color(0x82B1FF), peakColor: new THREE.Color(0xE3F2FD), valleyColor: new THREE.Color(0x1565C0), turbulence: 1.2, fireSpeed: 0.35, pulseSpeed: 0.006, sizeCategory: 'normal', terrainScale: 2.0, fireIntensity: 1.8 },
        { baseColor: new THREE.Color(0xFF5722), hotColor: new THREE.Color(0xFF8A65), coolColor: new THREE.Color(0xBF360C), glowColor: new THREE.Color(0xFF7043), coronaColor: new THREE.Color(0xFFAB91), midColor: new THREE.Color(0xFF7043), peakColor: new THREE.Color(0xFFCCBC), valleyColor: new THREE.Color(0x8D1F06), turbulence: 1.0, fireSpeed: 0.25, pulseSpeed: 0.003, sizeCategory: 'giant', terrainScale: 1.8, fireIntensity: 1.6 },
        { baseColor: new THREE.Color(0xFFA500), hotColor: new THREE.Color(0xFFF7E6), coolColor: new THREE.Color(0xFF4500), glowColor: new THREE.Color(0xFFDF00), coronaColor: new THREE.Color(0xFFA726), midColor: new THREE.Color(0xFFB74D), peakColor: new THREE.Color(0xFFE0B2), valleyColor: new THREE.Color(0xE65100), turbulence: 1.1, fireSpeed: 0.3, pulseSpeed: 0.004, sizeCategory: 'normal', terrainScale: 2.2, fireIntensity: 1.7 },
        { baseColor: new THREE.Color(0xE0E0E0), hotColor: new THREE.Color(0xFFFFFF), coolColor: new THREE.Color(0x9E9E9E), glowColor: new THREE.Color(0x82B1FF), coronaColor: new THREE.Color(0xBBDEFB), midColor: new THREE.Color(0xF5F5F5), peakColor: new THREE.Color(0xFFFFFF), valleyColor: new THREE.Color(0x757575), turbulence: 1.5, fireSpeed: 0.5, pulseSpeed: 0.01, sizeCategory: 'dwarf', terrainScale: 3.0, fireIntensity: 2.5 },
        { baseColor: new THREE.Color(0xE65100), hotColor: new THREE.Color(0xFFAB40), coolColor: new THREE.Color(0xBF360C), glowColor: new THREE.Color(0xFFD740), coronaColor: new THREE.Color(0xFFC107), midColor: new THREE.Color(0xFF9800), peakColor: new THREE.Color(0xFFE0B2), valleyColor: new THREE.Color(0xBF360C), turbulence: 1.15, fireSpeed: 0.28, pulseSpeed: 0.002, sizeCategory: 'hypergiant', terrainScale: 1.5, fireIntensity: 1.9 }
    ];

    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification-toast';
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 500);
        }, 3000);
    }

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
        
        domElements.devPanelModal.classList.remove('visible');

        if (needsRegen) {
            callbacks.regenerateUniverseState();
        } else {
            applyDynamicDevSettings();
            showNotification("Settings saved. Dynamic settings have been applied.");
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

    function showDevPanel() {
        updateDevControlsUI();
        oldDevSettingsForRegenCheck = {
            minPlanets: devSettings.minPlanets,
            maxPlanets: devSettings.maxPlanets,
        };
        domElements.devPanelModal.classList.add('visible');
    }

    function setupDevPanelListeners() {
        domElements.devPanelCancelButton.addEventListener('click', () => domElements.devPanelModal.classList.remove('visible'));
        domElements.devPanelSaveButton.addEventListener('click', saveDevSettings);
        
        domElements.devOrbitSpeedInput.addEventListener('input', (e) => {
            domElements.devOrbitSpeedValue.textContent = Number(e.target.value).toFixed(1);
        });

        domElements.panelRegenerateUniverseButton.addEventListener('click', () => {
            domElements.devPanelModal.classList.remove('visible');
            callbacks.regenerateUniverseState();
        });

        domElements.panelOpenPlanetDesignerButton.addEventListener('click', () => {
            domElements.devPanelModal.classList.remove('visible');
            callbacks.switchToPlanetDesignerScreen();
        });

        domElements.panelOpenGalaxyCustomizerButton.addEventListener('click', () => {
            domElements.devPanelModal.classList.remove('visible');
            callbacks.showGalaxyCustomizationModal();
        });
    }

    function generatePlanetsForSystem(solarSystemObject){
        const sunType = solarSystemObject.sunType;
        const variation = sunVariations[sunType % sunVariations.length];
        const baseSize = sizeTiers[variation.sizeCategory].size;
        
        // Use max possible sun size for safety margin, as random variation is in renderer
        const sunRadius = baseSize * 2.0; 
        
        solarSystemObject.planets = [];
        const numPlanets = Math.floor(Math.random() * (devSettings.maxPlanets - devSettings.minPlanets + 1)) + devSettings.minPlanets;
        
        const MIN_ORBITAL_SEPARATION = 2000;
        // Set minimum distance safely outside the sun's maximum possible radius
        const MIN_PLANET_DISTANCE = sunRadius * 1.5;
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
        GameStateManager.saveGameState();
    }
    
    async function initializeGame(isForcedRegeneration = false) {
        console.log("Initializing game...");
        loadDevSettings();

        let galaxyToLoadId = null;

        if (!isForcedRegeneration && GameStateManager.loadGameState()) {
            console.log("Loaded existing game state.");
            generateUniverseLayout(null, GameStateManager.getState(), { universeBg: '#100520' });
            galaxyToLoadId = GameStateManager.getState().activeGalaxyId;
        } else {
            console.log("No valid save found. Generating new universe.");
            const state = GameStateManager.getState();
            generateUniverseLayout(null, state, { universeBg: '#100520' });
            generateGalaxies(state);
            GameStateManager.saveGameState();
        }
        
        await preGenerateAllGalaxyContents(GameStateManager.getState(), domElements.galaxyDetailScreen, { min: 80, max: 120 });
        
        if (!galaxyToLoadId && GameStateManager.getGalaxies().length > 0) {
            galaxyToLoadId = GameStateManager.getGalaxies()[0].id;
        }

        if (galaxyToLoadId) {
            if(window.switchToGalaxyDetailView){
                window.switchToGalaxyDetailView(galaxyToLoadId)
            }
        } else {
            console.error("No galaxy found to load. Cannot start game.");
        }
        
        GameStateManager.setInitialized(true);
        console.log("Game initialization complete.");
    }
    
    const callbacks = {
        saveGameState: () => GameStateManager.saveGameState(),
        regenerateUniverseState: () => regenerateCurrentUniverseState(
            { initializeGame },
            domElements,
            GameStateManager
        ),
        switchToPlanetDesignerScreen: () => {
            let onBack;
            const state = GameStateManager.getState();
            if (state.activeSolarSystemId) {
                onBack = () => window.switchToSolarSystemView(state.activeSolarSystemId);
            } else {
                onBack = () => window.switchToGalaxyDetailView(state.activeGalaxyId);
            }

            UIManager.setActiveScreen(domElements.planetDesignerScreen);
            if (window.PlanetDesigner?.activate) {
                window.PlanetDesigner.activate(onBack);
            } else {
                console.error("switchToPlanetDesignerScreen: PlanetDesigner module or activate function not found.");
            }
        },
        showGalaxyCustomizationModal: () => {
            if (UIManager.showGalaxyCustomizationModal) {
                UIManager.showGalaxyCustomizationModal();
            }
        },
        showDevPanel: showDevPanel,
        generatePlanetsForSystem: generatePlanetsForSystem,
        getCustomizationSettings: () => ({
            ssCountRange: { min: 200, max: 300 }
        }),
        getDevSettings: () => devSettings,
    };

    UIManager.init(domElements, callbacks);
    
    // --- STARTUP ---
    initializeModules();
    setupDevPanelListeners();
    initializeGame();
});
