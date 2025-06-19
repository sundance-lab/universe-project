// public/js/gameStateManager.js

class GameStateManager {
    constructor() {
        if (GameStateManager.instance) {
            return GameStateManager.instance;
        }

        this._state = {
            universe: { diameter: null },
            galaxies: [],
            activeGalaxyId: null,
            activeSolarSystemId: null,
            isInitialized: false,
            customPlanetDesigns: [],
            customGalaxyDesigns: [],
        };

        GameStateManager.instance = this;
    }

    // --- Getters to safely access state ---

    getState() { return this._state; }
    getGalaxies() { return this._state.galaxies; }
    getCustomPlanetDesigns() { return this._state.customPlanetDesigns; }
    getCustomGalaxyDesigns() { return this._state.customGalaxyDesigns; }

    getActiveGalaxy() {
        return this._state.galaxies.find(g => g.id === this._state.activeGalaxyId);
    }

    getActiveSolarSystem() {
        const galaxy = this.getActiveGalaxy();
        return galaxy?.solarSystems.find(s => s.id === this._state.activeSolarSystemId);
    }

    setUniverseDiameter(diameter) {
        this._state.universe.diameter = diameter;
    }

    setGalaxies(galaxies) {
        this._state.galaxies = galaxies;
    }

    setActiveGalaxyId(id) {
        this._state.activeGalaxyId = id;
        this._state.activeSolarSystemId = null; 
    }

    setActiveSolarSystemId(id) {
        this._state.activeSolarSystemId = id;
    }

    setInitialized(isInitialized) {
        this._state.isInitialized = isInitialized;
    }
    
    addCustomPlanetDesign(design) {
        this._state.customPlanetDesigns.push(design);
        this.saveGameState(); 
    }

    deleteCustomPlanetDesign(designId) {
        const designIndex = this._state.customPlanetDesigns.findIndex(d => d.designId === designId);
        if (designIndex > -1) {
            this._state.customPlanetDesigns.splice(designIndex, 1);
            this.saveGameState();
        }
    }

    addCustomGalaxyDesign(design) {
        this._state.customGalaxyDesigns.push(design);
        this.saveGameState();
    }

    deleteCustomGalaxyDesign(designId) {
        const designIndex = this._state.customGalaxyDesigns.findIndex(d => d.designId === designId);
        if (designIndex > -1) {
            this._state.customGalaxyDesigns.splice(designIndex, 1);
            this.saveGameState();
        }
    }
    
    resetState(preserveCustomDesigns = true) {
        const designs = preserveCustomDesigns ? {
            customPlanetDesigns: this._state.customPlanetDesigns,
            customGalaxyDesigns: this._state.customGalaxyDesigns
        } : {
            customPlanetDesigns: [],
            customGalaxyDesigns: []
        };

        this._state = {
            universe: { diameter: null },
            galaxies: [],
            activeGalaxyId: null,
            activeSolarSystemId: null,
            isInitialized: false,
            ...designs
        };
        console.log("Game state has been reset via GameStateManager.");
    }

    updateGalaxyProperty(galaxyId, property, value) {
        const galaxy = this._state.galaxies.find(g => g.id === galaxyId);
        if (galaxy) {
            galaxy[property] = value;
            this.saveGameState();
        }
    }

    updateSolarSystemProperty(systemId, property, value) {
        for (const galaxy of this._state.galaxies) {
            const system = galaxy.solarSystems.find(s => s.id === systemId);
            if (system) {
                system[property] = value;
                this.saveGameState();
                return;
            }
        }
    }

    addLandingLocation(planetId, locationData) {
        const system = this.getActiveSolarSystem();
        if (!system) return;

        const planet = system.planets.find(p => p.id === planetId);
        if (planet) {
            if (!planet.landingLocations) {
                planet.landingLocations = [];
            }
            planet.landingLocations.push(locationData);
            this.saveGameState();
            console.log(`Added location to ${planet.name}`, locationData);
        }
    }

    saveGameState() {
        try {
            const stateToSave = {
                universeDiameter: this._state.universe.diameter,
                galaxies: this._state.galaxies,
                customPlanetDesigns: this._state.customPlanetDesigns,
                customGalaxyDesigns: this._state.customGalaxyDesigns,
                activeGalaxyId: this._state.activeGalaxyId,
                activeSolarSystemId: this._state.activeSolarSystemId
            };
            localStorage.setItem('galaxyGameSaveData', JSON.stringify(stateToSave));
            console.log("Game state saved via GameStateManager.");
        } catch (e) {
            console.error("Error saving game state:", e);
        }
    }

    loadGameState() {
        try {
            const savedStateString = localStorage.getItem('galaxyGameSaveData');
            if (!savedStateString) return false;

            const loadedState = JSON.parse(savedStateString);
            if (!loadedState || typeof loadedState.universeDiameter !== 'number' || !Array.isArray(loadedState.galaxies)) {
                return false;
            }
            
            loadedState.galaxies.forEach(gal => {
                gal.currentZoom = gal.currentZoom || 1.0;
                gal.currentPanX = gal.currentPanX || 0;
                gal.currentPanY = gal.currentPanY || 0;
                gal.customName = gal.customName || null;
                gal.generationParams = gal.generationParams || { densityFactor: 0.8 + Math.random() * 0.4 };
                if (!gal.generationParams.galaxyConfig) {
                    gal.generationParams.galaxyConfig = null;
                }
                gal.solarSystems = gal.solarSystems || [];
                gal.solarSystems.forEach(ss => {
                    ss.customName = ss.customName || null;
                    ss.sunSizeFactor = ss.sunSizeFactor ?? (0.5 + Math.random() * 9.5);
                    if (ss.sunType === undefined || ss.sunType === null) {
                        ss.sunType = Math.floor(Math.random() * 5);
                    }
                });
                gal.lineConnections = gal.lineConnections || [];
                gal.layoutGenerated = gal.layoutGenerated || false;
            });
            
            this._state.universe.diameter = loadedState.universeDiameter;
            this._state.galaxies = loadedState.galaxies;
            this._state.activeGalaxyId = loadedState.activeGalaxyId || null;
            this._state.activeSolarSystemId = loadedState.activeSolarSystemId || null;
            this._state.customPlanetDesigns = loadedState.customPlanetDesigns || [];
            this._state.customGalaxyDesigns = loadedState.customGalaxyDesigns || [];
            
            console.log("Game state loaded successfully via GameStateManager.");
            return true;

        } catch (error) {
            console.error("Error loading game state:", error);
            localStorage.removeItem('galaxyGameSaveData');
            return false;
        }
    }
}

const instance = new GameStateManager();
Object.freeze(instance);

export default instance;
