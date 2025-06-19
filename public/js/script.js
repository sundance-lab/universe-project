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

const planetNames = [
    "Xylos", "Zephyria", "Cinderfall", "Aethel", "Boreas", "Erebus", "Tartarus",
    "Elysium", "Arcadia", "Hyperion", "Iapetus", "Rhea", "Tethys", "Dione",
    "Enceladus", "Mimas", "Oberon", "Titania", "Umbriel", "Ariel", "Miranda",
    "Nereid", "Proteus", "Larissa", "Galatea", "Despina", "Thalassa", "Naiad",
    "Halimede", "Sao", "Laomedeia", "Psamathe", "Neso", "Varda", "Ix", "Salusa",
    "Caladan", "Giedi", "Kaitain", "Tleilax", "Risa", "Bajor", "Qo'noS",
    "Cardassia", "Vulcan", "Andoria", "Kronos", "Ferenginar", "Trill", "Betazed"
];

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
        spawnCharacterButton: document.getElementById('spawn-character-btn'),
        devPanelModal: document.getElementById('dev-panel-modal'),
        panelRegenerateUniverseButton: document.getElementById('panel-regenerate-universe-btn'),
        panelOpenPlanetDesignerButton: document.getElementById('panel-open-planet-designer-btn'),
        panelOpenGalaxyCustomizerButton: document.getElementById('panel-open-galaxy-customizer-btn'),
        devMinPlanetsInput: document.getElementById('dev-min-planets'),
        devMaxPlanetsInput: document.getElementById('dev-max-planets'),
        devOrbitLinesVisibleInput: document.getElementById('dev-orbit-lines-visible'),
        devOrbitSpeedInput: document.getElementById('dev-orbit-speed'),
        devOrbitSpeedValue: document.getElementById('dev-orbit-speed-value'),
        devShipSpeedInput: document.getElementById('dev-ship-speed'),
        devShipSpeedValue: document.getElementById('dev-ship-speed-value'),
        devLandingIconSizeInput: document.getElementById('dev-landing-icon-size'),
        devLandingIconSizeValue: document.getElementById('dev-landing-icon-size-value'),
        devPanelSaveButton: document.getElementById('dev-panel-save'),
        devPanelCancelButton: document.getElementById('dev-panel-cancel'),
        landingConfirmationPanel: document.getElementById('landing-confirmation-panel'),
        landingQuestionText: document.getElementById('landing-question-text'),
        landingBtnYes: document.getElementById('landing-btn-yes'),
        landingBtnNo: document.getElementById('landing-btn-no'),
        surfaceScreen: document.getElementById('surface-screen'),
        backToSystemButton: document.getElementById('back-to-system'),
        devPanelBackgroundScreen: document.getElementById('dev-panel-background-screen'),
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
        const defaults = {
            minPlanets: 2,
            maxPlanets: 8,
            orbitLinesVisible: false,
            orbitSpeed: 9.0,
            shipSpeed: 7500,
            landingIconSize: 0.25
        };
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
            orbitSpeed: parseFloat(domElements.devOrbitSpeedInput.value),
            shipSpeed: parseFloat(domElements.devShipSpeedInput.value),
            landingIconSize: parseFloat(domElements.devLandingIconSizeInput.value)
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
        domElements.devShipSpeedInput.value = devSettings.shipSpeed;
        domElements.devShipSpeedValue.textContent = devSettings.shipSpeed;
        domElements.devLandingIconSizeInput.value = devSettings.landingIconSize;
        domElements.devLandingIconSizeValue.textContent = Number(devSettings.landingIconSize).toFixed(2);
    }

    function applyDynamicDevSettings() {
        if (window.activeSolarSystemRenderer) {
            window.activeSolarSystemRenderer.setOrbitLinesVisible(devSettings.orbitLinesVisible);
            window.activeSolarSystemRenderer.setOrbitSpeed(devSettings.orbitSpeed);
            window.activeSolarSystemRenderer.setShipSpeed(devSettings.shipSpeed);
            window.activeSolarSystemRenderer.setLandingIconSize(devSettings.landingIconSize);
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

    function setupActionListeners() {
        domElements.devPanelButton.addEventListener('click', showDevPanel);

        domElements.spawnCharacterButton.addEventListener('click', () => {
            if (window.activeSolarSystemRenderer?.enterSpawningMode) {
                window.activeSolarSystemRenderer.enterSpawningMode();
                showNotification("Spawning Mode: Click on the system plane to place your ship.");
            }
        });

        // Dev Panel Listeners
        domElements.devPanelCancelButton.addEventListener('click', () => domElements.devPanelModal.classList.remove('visible'));
        domElements.devPanelSaveButton.addEventListener('click', saveDevSettings);

        domElements.devOrbitSpeedInput.addEventListener('input', (e) => {
            domElements.devOrbitSpeedValue.textContent = Number(e.target.value).toFixed(1);
        });

        domElements.devShipSpeedInput.addEventListener('input', (e) => {
            domElements.devShipSpeedValue.textContent = e.target.value;
        });

        domElements.devLandingIconSizeInput.addEventListener('input', (e) => {
            domElements.devLandingIconSizeValue.textContent = Number(e.target.value).toFixed(2);
        });

        domElements.panelRegenerateUniverseButton.addEventListener('click', () => {
            domElements.devPanelModal.classList.remove('visible');
            callbacks.regenerateUniverseState();
        });

        domElements.panelOpenPlanetDesignerButton.addEventListener('click', () => {
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
        const sunBaseSize = sizeTiers[variation.sizeCategory].size;
        const sunFinalSize = sunBaseSize * (0.5 + Math.random() * 1.5); // From solarSystemRenderer

        solarSystemObject.planets = [];
        const minPlanets = Math.max(1, devSettings.minPlanets);
        const maxPlanets = Math.max(minPlanets, devSettings.maxPlanets);
        const numPlanets = Math.floor(Math.random() * (maxPlanets - minPlanets + 1)) + minPlanets;

        const shuffledNames = [...planetNames].sort(() => 0.5 - Math.random());

        const MIN_ORBITAL_SEPARATION = 2000;
        const MIN_PLANET_DISTANCE_FROM_SUN_SURFACE = 5000;
        let lastOrbitalRadius = sunFinalSize + MIN_PLANET_DISTANCE_FROM_SUN_SURFACE;

        for (let i = 0; i < numPlanets; i++) {
            const planetData = generatePlanetInstanceFromBasis({});

            let separation;
            // Introduce a chance for a large gap, like an asteroid belt
            if (i > 0 && Math.random() < 0.20) {
                separation = 60000 + Math.random() * 80000;
            } else {
                separation = MIN_ORBITAL_SEPARATION + (Math.random() * Math.random()) * 55000;
            }

            const semiMajorAxis = lastOrbitalRadius + separation;
            const planetName = shuffledNames[i] || `Planet ${i + 1}`;

            let eccentricity = Math.pow(Math.random(), 2) * 0.4;
            if (Math.random() < 0.1) { // 10% chance of a highly eccentric orbit
                eccentricity = 0.4 + Math.random() * 0.3;
            }

            let inclination = Math.random() * 0.1; // Most planets on a similar plane
            if (Math.random() < 0.1) { // 10% chance of a highly inclined orbit
                inclination = Math.random() * Math.PI;
            }

            solarSystemObject.planets.push({
                ...planetData,
                id: `${solarSystemObject.id}-planet-${i}`,
                name: planetName,
                size: 50 + Math.random() * 100,
                semiMajorAxis: semiMajorAxis,
                orbitalEccentricity: eccentricity,
                orbitalInclination: inclination,
                longitudeOfAscendingNode: Math.random() * Math.PI * 2,
                argumentOfPeriapsis: Math.random() * Math.PI * 2,
                orbitalSpeed: Math.sqrt(10000 / semiMajorAxis),
                currentOrbitalAngle: Math.random() * 2 * Math.PI,
                axialSpeed: (Math.random() - 0.5) * 0.05,
                currentAxialAngle: Math.random() * 2 * Math.PI,
            });
            lastOrbitalRadius = semiMajorAxis;
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
            // Hide the dev panel modal before switching.
            domElements.devPanelModal.classList.remove('visible');
    
            const onBack = () => {
                // This is the new lightweight callback.
                // 1. Activate our simple, blank background screen. This is instant.
                UIManager.setActiveScreen(domElements.devPanelBackgroundScreen);
                // 2. Show the Dev Panel modal on top of it.
                showDevPanel();
            };
    
            // Activate the planet designer screen and pass it the new lightweight callback.
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
    setupActionListeners();
    initializeGame();
});
