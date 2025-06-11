// public/js/storage.js

/**
 * Saves the core game state to localStorage.
 * Note: This function relies on the global window.gameSessionData object.
 * A future refactor could pass the state as a parameter.
 */
export function saveGameState() {
    try {
        const stateToSave = {
            universeDiameter: window.gameSessionData.universe.diameter,
            galaxies: window.gameSessionData.galaxies,
            customPlanetDesigns: window.gameSessionData.customPlanetDesigns
        };
        localStorage.setItem('galaxyGameSaveData', JSON.stringify(stateToSave));
        console.log("Game state saved.");
    } catch (e) {
        console.error("Error saving game state:", e);
    }
}

/**
 * Loads the core game state from localStorage.
 * Note: This function modifies the global window.gameSessionData object.
 * A future refactor could return the loaded state instead.
 * @returns {boolean} - True if a valid state was loaded, false otherwise.
 */
export function loadGameState() {
    try {
        const savedStateString = localStorage.getItem('galaxyGameSaveData');
        if (savedStateString) {
            const loadedState = JSON.parse(savedStateString);
            if (loadedState && typeof loadedState.universeDiameter === 'number' && Array.isArray(loadedState.galaxies)) {
                window.gameSessionData.universe.diameter = loadedState.universeDiameter;
                window.gameSessionData.galaxies = loadedState.galaxies;

                window.gameSessionData.galaxies.forEach(gal => {
                    gal.currentZoom = gal.currentZoom || 1.0;
                    gal.currentPanX = gal.currentPanX || 0;
                    gal.currentPanY = gal.currentPanY || 0;
                    gal.customName = gal.customName || null;
                    gal.generationParams = gal.generationParams || { densityFactor: 0.8 + Math.random() * 0.4 };
                    gal.solarSystems = gal.solarSystems || [];
                    gal.solarSystems.forEach(ss => {
                        ss.customName = ss.customName || null;
                        ss.sunSizeFactor = ss.sunSizeFactor ?? (0.5 + Math.random() * 9.5);
                        // Planet data is now generated on-demand in switchToSolarSystemView
                    });
                    gal.lineConnections = gal.lineConnections || [];
                    gal.layoutGenerated = gal.layoutGenerated || false;
                });

                window.gameSessionData.customPlanetDesigns = (loadedState.customPlanetDesigns || []).map(design => {
                    console.log("[DEBUG] Loading planet template:", {
                        designId: design.designId,
                        waterColor: design.waterColor,
                        landColor: design.landColor
                    });
                    const migratedDesign = { ...design };
                    if (migratedDesign.continentSeed === undefined) migratedDesign.continentSeed = Math.random();

                    if (typeof migratedDesign.minTerrainHeight !== 'number' && Array.isArray(migratedDesign.minTerrainHeightRange)) {
                        migratedDesign.minTerrainHeight = migratedDesign.minTerrainHeightRange[0];
                    }
                    if (typeof migratedDesign.maxTerrainHeight !== 'number' && Array.isArray(migratedDesign.maxTerrainHeightRange)) {
                        migratedDesign.maxTerrainHeight = migratedDesign.maxTerrainHeightRange[1];
                    }
                    if (typeof migratedDesign.oceanHeightLevel !== 'number' && Array.isArray(migratedDesign.oceanHeightRange)) {
                        migratedDesign.oceanHeightLevel = migratedDesign.oceanHeightRange[0];
                    }

                    delete migratedDesign.minTerrainHeightRange;
                    delete migratedDesign.maxTerrainHeightRange;
                    delete migratedDesign.oceanHeightRange;
                    return migratedDesign;
                });
                console.log("[DEBUG] Total templates loaded:", window.gameSessionData.customPlanetDesigns.length);
                console.log("Game state loaded successfully.");
                return true;
            }
        }
    } catch (error) {
        console.error("Error loading game state:", error);
        localStorage.removeItem('galaxyGameSaveData');
    }
    console.log("No valid game state found or error loading.");
    return false;
}
