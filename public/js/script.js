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
    
    let currentNumGalaxies;
    let currentMinSSCount;
    let currentMaxSSCount;
    let currentMinPlanets;
    let currentMaxPlanets;

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
    };
    
    // --- FUNCTIONS ---
    
    function loadCustomizationSettings() {
        const settingsString = localStorage.getItem('galaxyCustomizationSettings');
        if (settingsString) {
            try {
                const s = JSON.parse(settingsString);
                currentNumGalaxies = s.numGalaxies || 3;
                currentMinSSCount = s.minSS || 200;
                currentMaxSSCount = s.maxSS || 300;
                currentMinPlanets = s.minPlanets || 2;
                currentMaxPlanets = s.maxPlanets || 8;
            } catch (e) {
                resetToDefaultCustomization();
            }
        } else {
            resetToDefaultCustomization();
        }
    }

    function resetToDefaultCustomization() {
        currentNumGalaxies = 3;
        currentMinSSCount = 200;
        currentMaxSSCount = 300;
        currentMinPlanets = 2;
        currentMaxPlanets = 8;
    }

    function generatePlanetsForSystem(solarSystemObject){
        console.log(`Generating planets for ${solarSystemObject.id}`);
        solarSystemObject.planets = [];
        const numPlanets = Math.floor(Math.random() * (currentMaxPlanets - currentMinPlanets + 1)) + currentMinPlanets;
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
        loadCustomizationSettings();

        if (!isForcedRegeneration && loadGameState()) {
            console.log("Loaded existing game state.");
            generateUniverseLayout(domElements.universeCircle, window.gameSessionData, { universeBg: '#100520' });
        } else {
            console.log("No valid save found. Generating new universe.");
            generateUniverseLayout(domElements.universeCircle, window.gameSessionData, { universeBg: '#100520' });
            generateGalaxies(window.gameSessionData, domElements.universeCircle, currentNumGalaxies);
        }
        
        UIManager.renderMainScreen(); // Now called from UIManager
        preGenerateAllGalaxyContents(window.gameSessionData, domElements.galaxyViewport, { min: currentMinSSCount, max: currentMaxSSCount });
        
        window.gameSessionData.isInitialized = true;
        console.log("Game initialization complete.");
    }
    
    // --- WIRING UP MODULES ---
    
    const callbacks = {
        saveGameState: saveGameState,
        startSolarSystemAnimation: startSolarSystemAnimation,
        stopSolarSystemAnimation: stopSolarSystemAnimation,
        regenerateUniverseState: () => regenerateCurrentUniverseState(
            { stopSolarSystemAnimation, initializeGame },
            domElements
        ),
        switchToPlanetDesignerScreen: () => UIManager.setActiveScreen(domElements.planetDesignerScreen),
        generatePlanetsForSystem: generatePlanetsForSystem,
        getCustomizationSettings: () => ({
            ssCountRange: { min: currentMinSSCount, max: currentMaxSSCount }
        })
    };

    UIManager.init(domElements, callbacks);
    
    // --- STARTUP ---
    initializeModules();
    initializeGame();
});
