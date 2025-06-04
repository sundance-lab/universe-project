// js/core/game_lifecycle.js

import * as Config from 'js/config.js';
import * as State from 'js/state.js'; // Import State as module, access properties as State.appSettings.property
import * as DOM from 'js/dom_elements.js';
import * as ScreenManager from 'js/ui/screen_manager.js';
import * as GameGeneration from 'js/game_generation.js';
import * as AnimationManager from 'js/animation_manager.js';
import * as GalaxyUI from 'js/ui/galaxy_ui.js'; // Needed for renderMainScreen

/**
 * Saves the current customization settings to local storage.
 */
export function saveCustomizationSettings() {
    const settings = {
        numGalaxies: State.appSettings.currentNumGalaxies, // Access via appSettings
        minSS: State.appSettings.currentMinSSCount,
        maxSS: State.appSettings.currentMaxSSCount,
        spread: State.appSettings.currentMaxPlanetDistanceMultiplier,
        minPlanets: State.appSettings.currentMinPlanets,
        maxPlanets: State.appSettings.currentMaxPlanets,
        showOrbits: State.appSettings.currentShowPlanetOrbits
    };
    localStorage.setItem('galaxyCustomizationSettings', JSON.stringify(settings));
}

/**
 * Loads customization settings from local storage. If not found or invalid, resets to defaults.
 */
export function loadCustomizationSettings() {
    const storedSettings = localStorage.getItem('galaxyCustomizationSettings');
    if (storedSettings) {
        try {
            const parsedSettings = JSON.parse(storedSettings);
            State.appSettings.currentNumGalaxies = parseInt(parsedSettings.numGalaxies, 10) || Config.DEFAULT_NUM_GALAXIES; // Assign to appSettings.property
            State.appSettings.currentMinSSCount = parseInt(parsedSettings.minSS, 10) || Config.DEFAULT_MIN_SS_COUNT_CONST;
            State.appSettings.currentMaxSSCount = parseInt(parsedSettings.maxSS, 10) || Config.DEFAULT_MAX_SS_COUNT_CONST;
            State.appSettings.currentMaxPlanetDistanceMultiplier = parseFloat(parsedSettings.spread) || Config.DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;

            State.appSettings.currentMinPlanets = parseInt(parsedSettings.minPlanets, 10);
            if (isNaN(State.appSettings.currentMinPlanets)) State.appSettings.currentMinPlanets = Config.DEFAULT_MIN_PLANETS_PER_SYSTEM;
            State.appSettings.currentMaxPlanets = parseInt(parsedSettings.maxPlanets, 10);
            if (isNaN(State.appSettings.currentMaxPlanets)) State.appSettings.currentMaxPlanets = Config.DEFAULT_MAX_PLANETS_PER_SYSTEM;

            State.appSettings.currentShowPlanetOrbits = typeof parsedSettings.showOrbits === 'boolean' ? parsedSettings.showOrbits : Config.DEFAULT_SHOW_PLANET_ORBITS;
        } catch (e) {
            console.error("Error loading customization settings:", e);
            resetToDefaultCustomization();
        }
    } else {
        resetToDefaultCustomization();
    }
    GameGeneration.updateDerivedConstants(); // Update constants dependent on customization
}

/**
 * Resets all customization settings to their default values.
 */
export function resetToDefaultCustomization() {
    State.appSettings.currentNumGalaxies = Config.DEFAULT_NUM_GALAXIES; // Assign to appSettings.property
    State.appSettings.currentMinSSCount = Config.DEFAULT_MIN_SS_COUNT_CONST;
    State.appSettings.currentMaxSSCount = Config.DEFAULT_MAX_SS_COUNT_CONST;
    State.appSettings.currentMaxPlanetDistanceMultiplier = Config.DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
    State.appSettings.currentMinPlanets = Config.DEFAULT_MIN_PLANETS_PER_SYSTEM;
    State.appSettings.currentMaxPlanets = Config.DEFAULT_MAX_PLANETS_PER_SYSTEM;
    State.appSettings.currentShowPlanetOrbits = Config.DEFAULT_SHOW_PLANET_ORBITS;
}

/**
 * Saves the current game session data (universe, galaxies, custom designs) to local storage.
 */
export function saveGameState() {
    try {
        const gameStateToSave = {
            universeDiameter: State.gameSessionData.universe.diameter,
            galaxies: State.gameSessionData.galaxies,
            customPlanetDesigns: State.gameSessionData.customPlanetDesigns
        };
        localStorage.setItem('galaxyGameSaveData', JSON.stringify(gameStateToSave));
    } catch (e) {
        console.error("Error saving game state:", e);
    }
}

/**
 * Loads game session data from local storage.
 * Handles migration for older saved data formats.
 * @returns {boolean} True if data was successfully loaded, false otherwise.
 */
export function loadGameState() {
    try {
        const savedStateString = localStorage.getItem('galaxyGameSaveData');
        if (savedStateString) {
            const loadedState = JSON.parse(savedStateString);
            if (loadedState && typeof loadedState.universeDiameter === 'number' && Array.isArray(loadedState.galaxies)) {
                // Mutate properties of the existing gameSessionData object
                State.gameSessionData.universe.diameter = loadedState.universeDiameter;
                State.gameSessionData.galaxies = loadedState.galaxies;

                // Migration and ensuring default properties for loaded galaxies/systems
                State.gameSessionData.galaxies.forEach(gal => {
                    gal.currentZoom = gal.currentZoom || 1.0;
                    gal.currentPanX = gal.currentPanX || 0;
                    gal.currentPanY = gal.currentPanY || 0;
                    gal.customName = gal.customName || null;
                    gal.generationParams = gal.generationParams || { densityFactor: 0.8 + Math.random() * 0.4 };
                    gal.solarSystems = gal.solarSystems || [];
                    if (gal.solarSystems && Array.isArray(gal.solarSystems)) {
                        gal.solarSystems.forEach(ss => {
                            ss.customName = ss.customName || null;
                            ss.sunSizeFactor = ss.sunSizeFactor ?? (0.5 + Math.random() * 9.5);
                        });
                    }
                    gal.lineConnections = gal.lineConnections || [];
                    gal.layoutGenerated = gal.layoutGenerated || false; // Ensure this is set
                });

                // Migrate and ensure default properties for loaded custom planet designs
                State.gameSessionData.customPlanetDesigns = (loadedState.customPlanetDesigns || []).map(design => {
                    const migratedDesign = { ...design };
                    if (migratedDesign.continentSeed === undefined) migratedDesign.continentSeed = Math.random();

                    const ensureRange = (value, oldSingleProp, defaultVal, spread) => {
                        if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
                            return [...value];
                        }
                        const base = typeof oldSingleProp === 'number' ? oldSingleProp : (typeof defaultVal === 'number' ? defaultVal : 0);
                        return [base, base + (typeof spread === 'number' ? spread : 1.0)];
                    };

                    migratedDesign.minTerrainHeightRange = ensureRange(
                        migratedDesign.minTerrainHeightRange, (migratedDesign).minTerrainHeight, // Casting to any for old format access
                        Config.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0
                    );
                    migratedDesign.maxTerrainHeightRange = ensureRange(
                        migratedDesign.maxTerrainHeightRange, (migratedDesign).maxTerrainHeight,
                        Config.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0
                    );
                    migratedDesign.oceanHeightRange = ensureRange(
                        migratedDesign.oceanHeightRange, (migratedDesign).oceanHeightLevel,
                        Config.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0
                    );
                    delete migratedDesign.minTerrainHeight; // Clean up old properties
                    delete migratedDesign.maxTerrainHeight;
                    delete migratedDesign.oceanHeightLevel;
                    return migratedDesign;
                });
                return true;
            }
        }
    } catch (error) {
        console.error("Error loading game state:", error);
        localStorage.removeItem('galaxyGameSaveData'); // Clear corrupted data
    }
    return false;
}

/**
 * Regenerates the entire universe based on current customization settings.
 * Clears existing game data and re-initializes.
 * @param {boolean} force - If true, regenerates without confirmation prompt.
 */
export function regenerateCurrentUniverseState(force = false) {
    if (!force && !confirm("Regenerate universe with current settings? This will clear the currently saved layout.")) {
        return;
    }

    localStorage.removeItem('galaxyGameSaveData'); // Clear saved game data

    // Mutate properties of the existing gameSessionData object
    State.gameSessionData.universe = { diameter: null };
    State.gameSessionData.galaxies = [];
    State.gameSessionData.activeGalaxyId = null;
    State.gameSessionData.activeSolarSystemId = null;
    State.gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };
    State.gameSessionData.isInitialized = false;
    // customPlanetDesigns are preserved by default, if needed uncomment next line to clear:
    // State.gameSessionData.customPlanetDesigns = [];

    // Clear UI elements
    if (DOM.universeCircle) DOM.universeCircle.innerHTML = '';
    if (DOM.galaxyZoomContent) {
        // Preserve the solarSystemLinesCanvasEl element
        const canvasLines = DOM.galaxyZoomContent.querySelector('#solar-system-lines-canvas');
        DOM.galaxyZoomContent.innerHTML = '';
        if (canvasLines) DOM.galaxyZoomContent.appendChild(canvasLines); // Re-append the canvas
    }
    if (DOM.solarSystemContent) DOM.solarSystemContent.innerHTML = '';
    if (State.solarSystemOrbitCtx && State.solarSystemOrbitCanvasEl) {
        State.solarSystemOrbitCtx.clearRect(0, 0, State.solarSystemOrbitCanvasEl.width, State.solarSystemOrbitCanvasEl.height);
    }

    // Stop any ongoing animations
    AnimationManager.stopSolarSystemAnimation();

    // Re-initialize the game fully
    initializeGame(true);
}

/**
 * Initializes the game: loads settings, game state, generates content, and sets up initial UI.
 * @param {boolean} isForcedRegeneration - True if a regeneration was explicitly requested by user/system.
 */
export function initializeGame(isForcedRegeneration = false) {
    loadCustomizationSettings(); // Always load customization settings first

    if (!isForcedRegeneration && loadGameState()) {
        ScreenManager.setActiveScreen(DOM.mainScreen);
        if (DOM.universeCircle && State.gameSessionData.universe.diameter) {
            DOM.universeCircle.style.width = `${State.gameSessionData.universe.diameter}px`;
            DOM.universeCircle.style.height = `${State.gameSessionData.universe.diameter}px`;
            DOM.universeCircle.style.backgroundColor = Config.FIXED_COLORS.universeBg;
        } else {
            GameGeneration.generateUniverseLayout(); // If universe diameter was not loaded
        }
        GalaxyUI.renderMainScreen(); // Render main screen galaxies based on loaded data
        GameGeneration.preGenerateAllGalaxyContents(); // Pre-generate layouts for existing galaxies
    } else {
        // New game or forced regeneration
        GameGeneration.generateUniverseLayout();
        GameGeneration.generateGalaxies();
        ScreenManager.setActiveScreen(DOM.mainScreen);
        GalaxyUI.renderMainScreen();
        // This will save the state *after* all generation is complete within preGenerateAllGalaxyContents
        GameGeneration.preGenerateAllGalaxyContents();
    }
    State.gameSessionData.isInitialized = true;
}
