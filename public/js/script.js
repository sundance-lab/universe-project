// public/js/script.js
import { PlanetDesigner } from './planetDesigner.js';
// NEW: Import the state manager
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
    
    // --- GLOBAL CONFIG & STATE (State is now in GameStateManager) ---
    window.DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
    window.DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
    window.DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;
    window.DEFAULT_PLANET_AXIAL_SPEED = 0.01;
    
    const DEV_SETTINGS_KEY = 'universeDevSettings';
    let devSettings = {};
    let oldDevSettingsForRegenCheck = {};

    // REMOVED: window.gameSessionData object is gone.

    // --- DOM ELEMENT REFERENCES (no changes here) ---
    const domElements = { /* ... */ };
    
    // --- FUNCTIONS (Refactored) ---
    // REMOVED: window.saveGameState and window.generatePlanetInstanceFromBasis
    // The generate function is imported, and save is handled by the manager.
    window.generatePlanetInstanceFromBasis = generatePlanetInstanceFromBasis;

    function loadDevSettings() { /* ... */ } // No changes needed
    function saveDevSettings() { /* ... */ } // No changes needed
    function updateDevControlsUI() { /* ... */ } // No changes needed
    function applyDynamicDevSettings() { /* ... */ } // No changes needed
    function setupDevPanelListeners() { /* ... */ } // No changes needed

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
        // Use the manager to save the state
        GameStateManager.saveGameState();
    }
    
    function initializeGame(isForcedRegeneration = false) {
        console.log("Initializing game...");
        loadDevSettings();

        let galaxyToLoadId = null;

        // Use the manager to load the game state
        if (!isForcedRegeneration && GameStateManager.loadGameState()) {
            console.log("Loaded existing game state.");
            // Pass state from manager to generators
            generateUniverseLayout(null, GameStateManager.getState(), { universeBg: '#100520' });
            galaxyToLoadId = GameStateManager.getState().activeGalaxyId;
        } else {
            if (!isForcedRegeneration) console.log("No valid save found. Generating new universe.");
            // Pass state from manager to generators
            generateUniverseLayout(null, GameStateManager.getState(), { universeBg: '#100520' });
            generateGalaxies(GameStateManager.getState());
        }
        
        preGenerateAllGalaxyContents(GameStateManager.getState(), domElements.galaxyDetailScreen, { min: 80, max: 120 });
        
        if (!galaxyToLoadId && GameStateManager.getGalaxies().length > 0) {
            galaxyToLoadId = GameStateManager.getGalaxies()[0].id;
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
        
        GameStateManager.setInitialized(true);
        console.log("Game initialization complete.");
    }
    
    const callbacks = {
        // Provide the save function from the manager
        saveGameState: () => GameStateManager.saveGameState(),
        regenerateUniverseState: () => regenerateCurrentUniverseState(
            { initializeGame },
            domElements
        ),
        switchToPlanetDesignerScreen: () => {
            let onBack;
            // Use manager to get active system/galaxy ID
            const activeSystemId = GameStateManager.getState().activeSolarSystemId;
            if (activeSystemId) {
                onBack = () => window.switchToSolarSystemView(activeSystemId);
            } else {
                onBack = () => window.switchToGalaxyDetailView(GameStateManager.getState().activeGalaxyId);
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
