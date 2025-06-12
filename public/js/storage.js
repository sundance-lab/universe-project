// public/js/storage.js

export function saveGameState() {
    try {
        const stateToSave = {
            universeDiameter: window.gameSessionData.universe.diameter,
            galaxies: window.gameSessionData.galaxies,
            customPlanetDesigns: window.gameSessionData.customPlanetDesigns,
            customGalaxyDesigns: window.gameSessionData.customGalaxyDesigns // NEW: Save custom galaxy designs
        };
        localStorage.setItem('galaxyGameSaveData', JSON.stringify(stateToSave));
        console.log("Game state saved.");
    } catch (e) {
        console.error("Error saving game state:", e);
    }
}

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
                    // NEW: Ensure galaxyConfig is initialized if missing
                    if (!gal.generationParams.galaxyConfig) {
                        // This will be set to a default by GalaxyRenderer if needed, or by a loaded custom design
                        gal.generationParams.galaxyConfig = null; 
                    }
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
                // NEW: Load custom galaxy designs
                window.gameSessionData.customGalaxyDesigns = loadedState.customGalaxyDesigns || [];
                console.log("[DEBUG] Total planet templates loaded:", window.gameSessionData.customPlanetDesigns.length);
                console.log("[DEBUG] Total galaxy templates loaded:", window.gameSessionData.customGalaxyDesigns.length);
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
