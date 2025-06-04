// js/core/game_lifecycle.js

import * as Config from '../config.js';
import * as State from '../state.js';
import * as DOM from '../dom_elements.js';
import * as ScreenManager from '../ui/screen_manager.js';
import * as GameGeneration from './game_generation.js';
import * as AnimationManager from './animation_manager.js';
import * as GalaxyUI from '../ui/galaxy_ui.js'; // Needed for renderMainScreen

/**
 * Saves the current customization settings to local storage.
 */
export function saveCustomizationSettings() {
    const settings = {
        numGalaxies: State.currentNumGalaxies,
        minSS: State.currentMinSSCount,
        maxSS: State.currentMaxSSCount,
        spread: State.currentMaxPlanetDistanceMultiplier,
        minPlanets: State.currentMinPlanets,
        maxPlanets: State.currentMaxPlanets,
        showOrbits: State.currentShowPlanetOrbits
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
            State.currentNumGalaxies = parseInt(parsedSettings.numGalaxies, 10) || Config.DEFAULT_NUM_GALAXIES;
            State.currentMinSSCount = parseInt(parsedSettings.minSS, 10) || Config.DEFAULT_MIN_SS_COUNT_CONST;
            State.currentMaxSSCount = parseInt(parsedSettings.maxSS, 10) || Config.DEFAULT_MAX_SS_COUNT_CONST;
            State.currentMaxPlanetDistanceMultiplier = parseFloat(parsedSettings.spread) || Config.DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;

            // Ensure planets ranges don't cause issues if loaded from older saves
            State.currentMinPlanets = parseInt(parsedSettings.minPlanets, 10);
            if (isNaN(State.currentMinPlanets)) State.currentMinPlanets = Config.DEFAULT_MIN_PLANETS_PER_SYSTEM;
            State.currentMaxPlanets = parseInt(parsedSettings.maxPlanets, 10);
            if (isNaN(State.currentMaxPlanets)) State.currentMaxPlanets = Config.DEFAULT_MAX_PLANETS_PER_SYSTEM;

            State.currentShowPlanetOrbits = typeof parsedSettings.showOrbits === 'boolean' ? parsedSettings.showOrbits : Config.DEFAULT_SHOW_PLANET_ORBITS;
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
    State.currentNumGalaxies = Config.DEFAULT_NUM_GALAXIES;
    State.currentMinSSCount = Config.DEFAULT_MIN_SS_COUNT_CONST;
    State.currentMaxSSCount = Config.DEFAULT_MAX_SS_COUNT_CONST;
    State.currentMaxPlanetDistanceMultiplier = Config.DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
    State.currentMinPlanets = Config.DEFAULT_MIN_PLANETS_PER_SYSTEM;
    State.currentMaxPlanets = Config.DEFAULT_MAX_PLANETS_PER_SYSTEM;
    State.currentShowPlanetOrbits = Config.DEFAULT_SHOW_PLANET_ORBITS;
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
                        migratedDesign.minTerrainHeightRange, migratedDesign.minTerrainHeight,
                        Config.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0
                    );
                    migratedDesign.maxTerrainHeightRange = ensureRange(
                        migratedDesign.maxTerrainHeightRange, migratedDesign.maxTerrainHeight,
                        Config.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0
                    );
                    migratedDesign.oceanHeightRange = ensureRange(
                        migratedDesign.oceanHeightRange, migratedDesign.oceanHeightLevel,
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

    // Reset all game state variables
    State.gameSessionData.universe = { diameter: null };
    State.gameSessionData.galaxies = [];
    State.gameSessionData.activeGalaxyId = null;
    State.gameSessionData.activeSolarSystemId = null;
    State.gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };
    // customPlanetDesigns are preserved by default, if needed uncomment next line to clear:
    // State.gameSessionData.customPlanetDesigns = [];
    State.gameSessionData.isInitialized = false;

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
