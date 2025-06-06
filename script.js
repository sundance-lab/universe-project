// script.js

// Import animation functions from animationController.js
import { startSolarSystemAnimation, stopSolarSystemAnimation } from './animationController.js';

document.addEventListener('DOMContentLoaded', () => {
  // Define constants FIRST, so functions defined below can access them
  // These constants might be accessed by planetDesigner.js via the window object
  window.DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
  window.DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
  window.DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;
  const DEFAULT_NUM_GALAXIES = 3;
  const DEFAULT_MIN_SS_COUNT_CONST = 200; // Consistent naming with other CONST
  const DEFAULT_MAX_SS_COUNT_CONST = 300; // Consistent naming
  const DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER = 1.0;
  const DEFAULT_MIN_PLANETS_PER_SYSTEM = 0;
  const DEFAULT_MAX_PLANETS_PER_SYSTEM = 3;
  const DEFAULT_SHOW_PLANET_ORBITS = false;
  window.DEFAULT_PLANET_AXIAL_SPEED = 0.01; // Make it global if used in planet generation across files

  const BASE_MAX_PLANET_DISTANCE_FACTOR = 25;
  window.PLANET_ROTATION_SENSITIVITY = 0.75; // Accessed by PlanetDesigner

  // Get DOM elements
  const mainScreen = document.getElementById('main-screen');
  const galaxyDetailScreen = document.getElementById('galaxy-detail-screen');
  const solarSystemScreen = document.getElementById('solar-system-screen');
  const universeCircle = document.getElementById('universe-circle');
  const galaxyViewport = document.getElementById('galaxy-viewport');
  const galaxyZoomContent = document.getElementById('galaxy-zoom-content');
  const solarSystemLinesCanvasEl = document.getElementById('solar-system-lines-canvas'); // For galaxy connections
  const solarSystemContent = document.getElementById('solar-system-content'); // Container for sun, planets, orbit canvas
  const planetDesignerScreen = document.getElementById('planet-designer-screen');
  const mainScreenTitleText = document.getElementById('main-screen-title-text');
  const galaxyDetailTitleText = document.getElementById('galaxy-detail-title-text');
  const galaxyDetailTitleInput = document.getElementById('galaxy-detail-title-input');
  const solarSystemTitleText = document.getElementById('solar-system-title-text');
  const solarSystemTitleInput = document.getElementById('solar-system-title-input');
  const backToMainButton = document.getElementById('back-to-main');
  const backToGalaxyButton = document.getElementById('back-to-galaxy');
  const zoomControlsElement = document.getElementById('zoom-controls');
  const zoomInButton = document.getElementById('zoom-in-btn');
  const zoomOutButton = document.getElementById('zoom-out-btn');
  const regenerateUniverseButton = document.getElementById('regenerate-universe-btn');
  
  const createPlanetDesignButton = document.getElementById('create-planet-design-btn');
  
  // Planet Visual Panel (Pop-up) elements - these are handled by PlanetVisualPanelManager now.
  // const planetVisualPanel = document.getElementById('planet-visual-panel');
  // const closePlanetVisualPanelBtn = document.getElementById('close-planet-visual-panel');
  // const planetVisualPanelHeader = document.getElementById('planet-visual-panel-header');
  // const planetVisualTitle = document.getElementById('planet-visual-title');
  // const planetVisualSize = document.getElementById('planet-visual-size');
  // const planetVisualCanvas = document.getElementById('planet-visual-canvas');

  // --- FUNCTION DEFINITIONS --- (Will review these in detail later)

  window.generatePlanetInstanceFromBasis = function (basis, isForDesignerPreview = false) {
    // ... (implementation looks reasonable, using ranges or defaults)
    // This function seems fine.
    const getValueFromRange = (range, defaultValue, defaultSpread = 1.0) => {
      if (Array.isArray(range) && range.length === 2 && typeof range[0] === 'number' && typeof range[1] === 'number') {
        const min = Math.min(range[0], range[1]);
        const max = Math.max(range[0], range[1]);
        if (min === max) return min;
        return min + Math.random() * (max - min);
      }
      if (typeof range === 'number') return range; 
      const base = typeof defaultValue === 'number' ? defaultValue : 0;
      const spread = typeof defaultSpread === 'number' ? defaultSpread : 1.0;
      if (isNaN(base) || isNaN(spread)) {
        console.warn("Invalid default/spread in getValueFromRange, returning 0", { range, defaultValue, defaultSpread });
        return 0;
      }
      return base + (Math.random() - 0.5) * spread * 2; 
    };

    return {
      waterColor: basis.waterColor || '#0000FF', // Default blue
      landColor: basis.landColor || '#008000',  // Default green
      continentSeed: isForDesignerPreview ? (basis.continentSeed !== undefined ? basis.continentSeed : Math.random()) : Math.random(),
      minTerrainHeight: getValueFromRange(basis.minTerrainHeightRange, window.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0),
      maxTerrainHeight: getValueFromRange(basis.maxTerrainHeightRange, window.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0),
      oceanHeightLevel: getValueFromRange(basis.oceanHeightRange, window.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0)
    };
  }

  // --- STATE VARIABLES (Global to script.js) ---
  let linesCtx; // For galaxy connection lines (on solarSystemLinesCanvasEl)
  let solarSystemOrbitCanvasEl; // Canvas for planet orbits in solar system view (created dynamically)
  let orbitCtx; // Context for solarSystemOrbitCanvasEl

  // Visual Panel state variables - these are now primarily managed by PlanetVisualPanelManager.
  // Remove or comment out if PlanetVisualPanelManager handles them fully.
  // let isDraggingPlanetVisual = false; 
  // let isRenderingVisualPlanet = false; 
  // let needsPlanetVisualRerender = false;
  // let planetVisualRotationQuat = quat_identity(); 
  // let startDragPlanetVisualQuat = quat_identity();
  // let startDragMouseX = 0; 
  // let startDragMouseY = 0; 
  // let currentPlanetDisplayedInPanel = null;

  // Game generation parameters
  let currentNumGalaxies = DEFAULT_NUM_GALAXIES;
  let currentMinSSCount = DEFAULT_MIN_SS_COUNT_CONST;
  let currentMaxSSCount = DEFAULT_MAX_SS_COUNT_CONST;
  let currentMaxPlanetDistanceMultiplier = DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
  let currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM;
  let currentMaxPlanets = DEFAULT_MAX_PLANETS_PER_SYSTEM;
  let currentShowPlanetOrbits = DEFAULT_SHOW_PLANET_ORBITS; // Used by drawAllOrbits

  // Visual constants
  const GALAXY_ICON_SIZE = 60;
  const SOLAR_SYSTEM_BASE_ICON_SIZE = 2.5; // Very small, consider if this is intended.
  const SUN_ICON_SIZE = 60; // Default sun size in solar system view
  const MAX_PLACEMENT_ATTEMPTS = 150;
  const GALAXY_VIEW_MIN_ZOOM = 1.0; // Cannot zoom out further than 1x for galaxy
  const GALAXY_VIEW_MAX_ZOOM = 5.0;
  const SOLAR_SYSTEM_VIEW_MIN_ZOOM = 0.05; // Allows significant zoom out for solar system
  const SOLAR_SYSTEM_VIEW_MAX_ZOOM = 10.0;
  const ZOOM_STEP = 0.2; // Multiplicative or additive? Current handleZoom implies additive to currentZoom * ZOOM_STEP.

  // Galaxy generation constants
  const MAX_CONNECTIONS_PER_SYSTEM = 3;
  const MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS = 5;
  const MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT = 0.07; // 7% of galaxy diameter
  const MAX_FORCED_CONNECTION_DISTANCE_PERCENT = 0.20;  // 20% of galaxy diameter

  // Solar System generation constants (dynamic ones updated by updateDerivedConstants)
  const MIN_PLANET_SIZE = 5;
  const MAX_PLANET_SIZE = 15;
  let MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0; // Will be updated
  let MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER; // Will be updated
  let ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2; // Will be updated
  let SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2; // Will be updated
  const MIN_ORBITAL_SEPARATION = 20; // Min pixels between orbit paths
  
  // Planet animation speeds (These are used in switchToSolarSystemView to set initial planet data)
  let MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.005; // "PER_PERLIN_UNIT" naming is odd. Should be per second or per frame? Currently used as rad/sec multiplier effectively.
  let MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.01;

  const FIXED_COLORS = { /* ... looks fine ... */ };

  window.gameSessionData = { // Global game state object
    universe: { diameter: null },
    galaxies: [],
    activeGalaxyId: null,
    activeSolarSystemId: null,
    solarSystemView: { 
        zoomLevel: 1.0, 
        currentPanX: 0, 
        currentPanY: 0, 
        planets: [], // Planet objects for the current solar system
        systemId: null 
    },
    isInitialized: false,
    panning: { /* ... looks fine ... */ },
    customPlanetDesigns: [] // Loaded/saved here
  };

  // --- WEB WORKER SETUP ---
  let planetVisualWorker = null; // For the pop-up panel
  // window.designerWorker is already declared on window by PlanetDesigner.js (IIFE pattern)
  // Actually, script.js creates designerWorker and assigns it to window.designerWorker
  window.designerWorker = null; // Initialize on script.js

  if (window.Worker) {
    try {
      planetVisualWorker = new Worker('planetRendererWorker.js');
      window.designerWorker = new Worker('planetRendererWorker.js'); // This is correct, both panel and designer use the same worker code

      planetVisualWorker.onmessage = function (e) {
        const { renderedData, width, height, senderId, error } = e.data; // Added senderId and error
        // This specific onmessage handler is for results intended for the PlanetVisualPanelManager
        if (senderId === 'planet-visual-canvas') { // Check if message is for the visual panel
            if (window.PlanetVisualPanelManager && typeof window.PlanetVisualPanelManager.handleWorkerMessage === 'function') {
                window.PlanetVisualPanelManager.handleWorkerMessage({ renderedData, width, height, error, senderId });
            } else {
                console.error("script.js: PlanetVisualPanelManager or its handler not found for planetVisualWorker message.");
            }
        } else {
            // This else block might not be necessary if planetVisualWorker is exclusively for PlanetVisualPanelManager
            // console.warn(`script.js: planetVisualWorker received message with unhandled senderId: $`);
        }
      };
      planetVisualWorker.onerror = function (error) {
        console.error("Error in planetVisualWorker (from script.js):", error.message, error.filename, error.lineno);
        // Optionally, notify PlanetVisualPanelManager about a generic worker error
        if (window.PlanetVisualPanelManager && typeof window.PlanetVisualPanelManager.handleWorkerMessage === 'function') {
            window.PlanetVisualPanelManager.handleWorkerMessage({ error: "Worker Error: " + error.message, senderId: 'planet-visual-canvas' });
        }
      };

      if (window.designerWorker) {
        window.designerWorker.onmessage = function (e) {
          const { renderedData, width, height, senderId, error } = e.data; // Added error
          if (senderId === 'designer-planet-canvas') {
            if (window.PlanetDesigner && typeof window.PlanetDesigner.handleDesignerWorkerMessage === 'function') {
              window.PlanetDesigner.handleDesignerWorkerMessage({ renderedData, width, height, error, senderId }); // Pass senderId too
            } else {
              console.error("script.js: PlanetDesigner module or handleDesignerWorkerMessage not found in designerWorker callback.");
            }
          }
        };
        window.designerWorker.onerror = function (error) {
          console.error("Error in designerWorker (from script.js):", error.message, error.filename, error.lineno);
           if (window.PlanetDesigner && typeof window.PlanetDesigner.handleDesignerWorkerMessage === 'function') {
              window.PlanetDesigner.handleDesignerWorkerMessage({ error: "Worker Error: " + error.message, senderId: 'designer-planet-canvas' });
            }
        };
      } else {
        // This case should not be hit if the try block for new Worker succeeded.
        console.error("script.js: window.designerWorker is unexpectedly null after instantiation attempt!");
      }

    } catch (err) {
      console.error("Failed to create Web Workers. Make sure planetRendererWorker.js exists and is accessible.", err);
      planetVisualWorker = null;
      window.designerWorker = null; 
    }
  } else {
    console.warn("Web Workers not supported in this browser. Planet rendering will be limited or disabled.");
  }

  // Generic renderPlanetVisual - This is the function called by PlanetDesigner and PlanetVisualPanelManager
  window.renderPlanetVisual = function (planetData, rotationQuaternion, targetCanvas) {
    // Determine which worker to use based on the target canvas
    const workerToUse = (targetCanvas && targetCanvas.id === 'designer-planet-canvas') ? window.designerWorker : planetVisualWorker;
    
    // State flag to prevent multiple simultaneous renders *to the same worker instance* if that's desired.
    // However, PlanetDesigner and PlanetVisualPanelManager have their own 'isRendering' flags.
    // This function is a dispatcher, so it might not need its own render flag if callers manage theirs.
    // For now, let's assume callers (PlanetDesigner/Manager) manage their own 'isRendering' state.

    if (!planetData || !targetCanvas || !workerToUse) {
      console.warn("renderPlanetVisual: Missing planetData, targetCanvas, or appropriate worker.", 
                   { planetDataExists: !!planetData, targetCanvasId: targetCanvas?.id, workerExists: !!workerToUse });
      // If a caller was expecting this to set its 'isRendering' flag to false, this early return might leave it true.
      // Caller should handle this.
      return;
    }

    if (targetCanvas.width === 0 || targetCanvas.height === 0) {
      console.warn(`renderPlanetVisual: Target canvas ${targetCanvas.id} has zero dimensions. Aborting worker call. Caller should retry.`);
      // Caller (PlanetDesigner or PlanetVisualPanelManager) is responsible for retrying.
      return;
    }

    // Prepare a clean copy of essential planet data for the worker
    const pD = { ...planetData }; // Shallow copy
    // Ensure essential rendering properties exist with defaults
    if (!pD.continentSeed && pD.continentSeed !== 0) pD.continentSeed = Math.random();
    if (!pD.waterColor) pD.waterColor = '#000080'; // Default from PlanetDesigner
    if (!pD.landColor) pD.landColor = '#006400';  // Default from PlanetDesigner
    // These defaults ensure the worker has what it needs if basis is incomplete
    pD.minTerrainHeight = pD.minTerrainHeight ?? window.DEFAULT_MIN_TERRAIN_HEIGHT;
    pD.maxTerrainHeight = pD.maxTerrainHeight ?? window.DEFAULT_MAX_TERRAIN_HEIGHT;
    pD.oceanHeightLevel = pD.oceanHeightLevel ?? window.DEFAULT_OCEAN_HEIGHT_LEVEL;

    // Data actually sent to worker should only contain rendering-relevant fields
    const dataToSendToWorker = {
      waterColor: pD.waterColor, 
      landColor: pD.landColor, 
      continentSeed: pD.continentSeed,
      minTerrainHeight: pD.minTerrainHeight, 
      maxTerrainHeight: pD.maxTerrainHeight, 
      oceanHeightLevel: pD.oceanHeightLevel,
      // Any other properties the worker 'renderPlanet' command explicitly uses from planetData
    };
    
    const canvasId = targetCanvas.id; // Crucial for routing the response

    console.log(`renderPlanetVisual: Posting to worker for canvasId: ${canvasId}`); // Debug log
    workerToUse.postMessage({
      cmd: 'renderPlanet', 
      planetData: dataToSendToWorker, 
      rotationQuaternion,
      canvasWidth: targetCanvas.width, 
      canvasHeight: targetCanvas.height, 
      senderId: canvasId, // Send the ID of the target canvas
      planetRadiusOverride: (canvasId === 'designer-planet-canvas') 
                            ? Math.min(targetCanvas.width, targetCanvas.height) / 2 * 0.9 
                            : undefined // No override for the visual panel, let worker use its default
    });
  }


  function switchToPlanetDesignerScreen() {
    setActiveScreen(planetDesignerScreen); // Ensure this is the correct screen element
    if (window.PlanetDesigner && typeof window.PlanetDesigner.activate === 'function') {
      window.PlanetDesigner.activate();
    } else {
      console.error("switchToPlanetDesignerScreen: PlanetDesigner module or activate function not found.");
    }
  }

  function updateDerivedConstants() {
    // These constants depend on SUN_ICON_SIZE and currentMaxPlanetDistanceMultiplier
    // Ensure SUN_ICON_SIZE is defined before this can be effectively called.
    // (It is defined as a const earlier, so this is fine.)
    MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier;
    // Ensure MIN_PLANET_DISTANCE doesn't become >= MAX_PLANET_DISTANCE if multiplier is very small.
    MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0 * Math.min(1.0, (currentMaxPlanetDistanceMultiplier > 0.5 ? currentMaxPlanetDistanceMultiplier * 0.8 : 0.5));
    // Consider a scenario: if currentMaxPlanetDistanceMultiplier is 0.1, currentMaxPlanetDistanceMultiplier * 0.8 = 0.08. min factor = 0.5
    // MIN_PLANET_DISTANCE = 60 * 3.0 * 0.5 = 90
    // MAX_PLANET_DISTANCE = (60 * 25) * 0.1 = 1500 * 0.1 = 150.
    // This is okay. A small multiplier should logically reduce both, with a floor on the minFactor.

    ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2; // Scale factor for canvas size
    SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2; // Slightly larger than max planet orbit
    // This function is crucial and should be called after customization settings are loaded/changed.
  }

  window.saveGameState = function () {
    try {
      const stateToSave = { // Renamed for clarity
        universeDiameter: window.gameSessionData.universe.diameter,
        galaxies: window.gameSessionData.galaxies, // This can be large.
        customPlanetDesigns: window.gameSessionData.customPlanetDesigns 
      };
      localStorage.setItem('galaxyGameSaveData', JSON.stringify(stateToSave));
      console.log("Game state saved."); // Optional: confirmation
    } catch (e) {
      console.error("Error saving game state:", e);
      // Could alert user if localStorage is full or disabled.
    }
  }

  function loadGameState() {
    try {
      const savedStateString = localStorage.getItem('galaxyGameSaveData');
      if (savedStateString) {
        const loadedState = JSON.parse(savedStateString);
        if (loadedState && typeof loadedState.universeDiameter === 'number' && Array.isArray(loadedState.galaxies)) {
          window.gameSessionData.universe.diameter = loadedState.universeDiameter;
          window.gameSessionData.galaxies = loadedState.galaxies;
          
          // Deep data massaging/migration for galaxies and solar systems:
          window.gameSessionData.galaxies.forEach(gal => {
            gal.currentZoom = gal.currentZoom || 1.0; // Default zoom
            gal.currentPanX = gal.currentPanX || 0;   // Default pan
            gal.currentPanY = gal.currentPanY || 0;
            gal.customName = gal.customName || null;
            gal.generationParams = gal.generationParams || { densityFactor: 0.8 + Math.random() * 0.4 };
            gal.solarSystems = gal.solarSystems || [];
            if (gal.solarSystems && Array.isArray(gal.solarSystems)) {
              gal.solarSystems.forEach(ss => {
                ss.customName = ss.customName || null;
                // Ensure sunSizeFactor exists, providing a default if not (e.g. from older save)
                ss.sunSizeFactor = ss.sunSizeFactor ?? (0.5 + Math.random() * 0.5); // Original was 9.5 range, might be too large? Let's check usage.
                                                                                   // switchToSolarSystemView uses 0.5 + Math.random() * 9.5.
                                                                                   // For loading old data, a smaller default might be safer if this field was missing.
                                                                                   // Let's stick to original generation for now:
                ss.sunSizeFactor = ss.sunSizeFactor ?? (0.5 + Math.random() * 9.5); 

              });
            }
            gal.lineConnections = gal.lineConnections || [];
            gal.layoutGenerated = gal.layoutGenerated || false; // Important for regeneration logic
          });

          // Migration for customPlanetDesigns (from single height values to ranges)
          window.gameSessionData.customPlanetDesigns = (loadedState.customPlanetDesigns || []).map(design => {
            const migratedDesign = { ...design }; // Shallow copy, properties will be reassigned
            if (migratedDesign.continentSeed === undefined) migratedDesign.continentSeed = Math.random();
            
            const ensureRange = (currentRangeValue, oldSinglePropValue, defaultBase, defaultSpread) => {
              if (Array.isArray(currentRangeValue) && currentRangeValue.length === 2 && 
                  typeof currentRangeValue[0] === 'number' && typeof currentRangeValue[1] === 'number') {
                return [...currentRangeValue]; // Already a valid range
              }
              // If not a valid range, try to create from old single property or defaults
              const base = typeof oldSinglePropValue === 'number' ? oldSinglePropValue : 
                           (typeof defaultBase === 'number' ? defaultBase : 0);
              return [base, base + (typeof defaultSpread === 'number' ? defaultSpread : 1.0)];
            };

            migratedDesign.minTerrainHeightRange = ensureRange(migratedDesign.minTerrainHeightRange, migratedDesign.minTerrainHeight, window.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0);
            migratedDesign.maxTerrainHeightRange = ensureRange(migratedDesign.maxTerrainHeightRange, migratedDesign.maxTerrainHeight, window.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0);
            migratedDesign.oceanHeightRange = ensureRange(migratedDesign.oceanHeightRange, migratedDesign.oceanHeightLevel, window.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0);
            
            // Remove old single properties if they existed
            delete migratedDesign.minTerrainHeight; 
            delete migratedDesign.maxTerrainHeight; 
            delete migratedDesign.oceanHeightLevel;
            return migratedDesign;
          });
          console.log("Game state loaded successfully.");
          return true;
        }
      }
    } catch (error) { 
        console.error("Error loading game state:", error); 
        localStorage.removeItem('galaxyGameSaveData'); // Clear corrupted save
    }
    console.log("No valid game state found or error loading.");
    return false;
  }

  function saveCustomizationSettings() {
    const settings = { // Renamed for clarity
      numGalaxies: currentNumGalaxies, 
      minSS: currentMinSSCount, 
      maxSS: currentMaxSSCount,
      spread: currentMaxPlanetDistanceMultiplier, 
      minPlanets: currentMinPlanets, 
      maxPlanets: currentMaxPlanets,
      showOrbits: currentShowPlanetOrbits
    };
    try {
        localStorage.setItem('galaxyCustomizationSettings', JSON.stringify(settings));
    } catch (e) {
        console.error("Error saving customization settings:", e);
    }
  }

  function loadCustomizationSettings() {
    const settingsString = localStorage.getItem('galaxyCustomizationSettings'); // Renamed
    if (settingsString) {
      try {
        const loadedSettings = JSON.parse(settingsString); // Renamed
        currentNumGalaxies = parseInt(loadedSettings.numGalaxies, 10) || DEFAULT_NUM_GALAXIES;
        currentMinSSCount = parseInt(loadedSettings.minSS, 10) || DEFAULT_MIN_SS_COUNT_CONST;
        currentMaxSSCount = parseInt(loadedSettings.maxSS, 10) || DEFAULT_MAX_SS_COUNT_CONST;
        currentMaxPlanetDistanceMultiplier = parseFloat(loadedSettings.spread); // No || default here, as 0 could be valid value if logic supports
        if (isNaN(currentMaxPlanetDistanceMultiplier)) currentMaxPlanetDistanceMultiplier = DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;

        currentMinPlanets = parseInt(loadedSettings.minPlanets, 10);
        if (isNaN(currentMinPlanets)) currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM; // Default if NaN
        
        currentMaxPlanets = parseInt(loadedSettings.maxPlanets, 10);
        if (isNaN(currentMaxPlanets)) currentMaxPlanets = DEFAULT_MAX_PLANETS_PER_SYSTEM; // Default if NaN
        
        currentShowPlanetOrbits = typeof loadedSettings.showOrbits === 'boolean' ? loadedSettings.showOrbits : DEFAULT_SHOW_PLANET_ORBITS;
      } catch (e) {
        console.error("Error loading customization settings:", e);
        resetToDefaultCustomization(); // Fallback to defaults on error
      }
    } else {
      resetToDefaultCustomization(); // No settings saved, use defaults
    }
    updateDerivedConstants(); // Crucial: call this after loading/resetting customization
  }

  function resetToDefaultCustomization() {
    currentNumGalaxies = DEFAULT_NUM_GALAXIES;
    currentMinSSCount = DEFAULT_MIN_SS_COUNT_CONST;
    currentMaxSSCount = DEFAULT_MAX_SS_COUNT_CONST;
    currentMaxPlanetDistanceMultiplier = DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
    currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM;
    currentMaxPlanets = DEFAULT_MAX_PLANETS_PER_SYSTEM;
    currentShowPlanetOrbits = DEFAULT_SHOW_PLANET_ORBITS;
    // updateDerivedConstants(); // Not strictly needed here if loadCustomizationSettings always calls it.
                              // But good for safety if resetToDefaultCustomization is called independently.
                              // Let's keep it where loadCustomizationSettings calls it to avoid redundancy.
  }

  // --- GEOMETRY HELPER FUNCTIONS ---
  function checkOverlap(rect1, rect2) { // Standard AABB overlap check
    return !(
      rect1.x + rect1.width < rect2.x ||  // rect1 is to the left of rect2
      rect2.x + rect2.width < rect1.x ||  // rect2 is to the left of rect1
      rect1.y + rect1.height < rect2.y || // rect1 is above rect2
      rect2.y + rect2.height < rect1.y    // rect2 is above rect1
    );
  }

  function getNonOverlappingPositionInCircle(circleRadius, objectDiameter, existingRects) {
    // Calculates a radius within which the *center* of the object can be placed.
    let placementRadius = circleRadius - (objectDiameter / 2) - 5; // -5 for a small margin from edge
    if (placementRadius < 0) placementRadius = 0; // Ensure not negative

    for (let i = 0; i < MAX_PLACEMENT_ATTEMPTS; i++) {
      const angle = Math.random() * 2 * Math.PI;
      // Distribute points more evenly within the circle using sqrt(random) for radius
      const r = Math.sqrt(Math.random()) * placementRadius; 
      
      // Calculate center of the new object
      const centerX = circleRadius + r * Math.cos(angle); // Relative to top-left of circle container (0,0)
      const centerY = circleRadius + r * Math.sin(angle);
      
      // Calculate top-left for the new rectangle
      const x = centerX - (objectDiameter / 2);
      const y = centerY - (objectDiameter / 2);
      
      const newRect = { x, y, width: objectDiameter, height: objectDiameter };
      
      // Check against all existing rectangles
      if (!existingRects.some(existingRect => checkOverlap(newRect, existingRect))) {
        return { x, y }; // Found a valid position
      }
    }
    console.warn(`getNonOverlappingPositionInCircle: Could not find non-overlapping position after ${MAX_PLACEMENT_ATTEMPTS} attempts.`);
    return null; // Failed to find a position
  }

  function getWeightedNumberOfConnections() { 
    const rand = Math.random(); 
    // 60% chance for 1, 30% for 2 (0.9-0.6), 10% for 3 (1.0-0.9)
    return rand < 0.6 ? 1 : rand < 0.9 ? 2 : 3; 
  }
  
  function adjustColor(hex, amount) { // Simple brightness adjustment
    if (!hex || typeof hex !== 'string' || hex.charAt(0) !== '#' || hex.length !== 7) {
        console.warn("adjustColor: Invalid hex input.", hex);
        return hex; // Return original if invalid
    }
    try {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);

        r = Math.max(0, Math.min(255, r + amount)); 
        g = Math.max(0, Math.min(255, g + amount)); 
        b = Math.max(0, Math.min(255, b + amount));

        // Convert back to hex
        const toHex = (c) => {
            const hexVal = c.toString(16);
            return hexVal.length === 1 ? "0" + hexVal : hexVal;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch (e) {
        console.error("Error in adjustColor:", e, "Input hex:", hex);
        return hex; // Return original on error
    }
  }

  // --- SCREEN MANAGEMENT ---
  window.setActiveScreen = function (screenToShow) {
    // Ensure all screen elements are valid before trying to access classList
    const screens = [mainScreen, galaxyDetailScreen, solarSystemScreen, planetDesignerScreen].filter(s => s);

    screens.forEach(s => {
      s.classList.remove('active', 'panning-active');
    });

    if (screenToShow) { 
      screenToShow.classList.add('active'); 
    } else {
      console.warn("setActiveScreen called with no screenToShow. No screen will be active.");
      // Optionally, default to mainScreen if screenToShow is null/undefined
      // if (mainScreen) mainScreen.classList.add('active');
    }

    if (zoomControlsElement) {
      zoomControlsElement.classList.toggle('visible', screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen);
    }
    
    const isOnOverlayScreen = screenToShow === planetDesignerScreen; 
                                                                 
    // Toggle visibility of general control buttons based on current screen
    if (regenerateUniverseButton) regenerateUniverseButton.style.display = isOnOverlayScreen ? 'none' : 'block';
    if (createPlanetDesignButton) createPlanetDesignButton.style.display = isOnOverlayScreen ? 'none' : 'block';

    // If navigating away from solar system screen or to an overlay, hide the Planet Visual Panel
    if (screenToShow !== solarSystemScreen || isOnOverlayScreen) {
        if (window.PlanetVisualPanelManager && typeof window.PlanetVisualPanelManager.hide === 'function') {
            window.PlanetVisualPanelManager.hide();
        }
    }
  }
  window.mainScreen = mainScreen; // Expose for PlanetDesigner cancel button (already done)


  function generateUniverseLayout() {
    const screenMinDimension = Math.min(window.innerWidth, window.innerHeight);
    window.gameSessionData.universe.diameter = Math.max(300, screenMinDimension * 0.85); // Ensure a minimum size

    if (universeCircle) {
      universeCircle.style.width = `${window.gameSessionData.universe.diameter}px`;
      universeCircle.style.height = `${window.gameSessionData.universe.diameter}px`;
      universeCircle.style.backgroundColor = FIXED_COLORS.universeBg; // Set explicitly, though CSS might also do it
    } else {
      console.warn("generateUniverseLayout: universeCircle element not found.");
    }
  }

  function generateGalaxies() {
    if (!window.gameSessionData.universe.diameter) {
      console.warn("generateGalaxies: Universe diameter not set. Cannot generate galaxies.");
      return;
    }
    if (!universeCircle) { // Need universeCircle to determine the containing space for placement if not using diameter directly
        console.warn("generateGalaxies: universeCircle DOM element not found.");
        return;
    }

    window.gameSessionData.galaxies = []; // Clear previous galaxies
    const universeRadius = window.gameSessionData.universe.diameter / 2;
    const existingGalaxyRects = []; // To prevent galaxy icons from overlapping significantly

    for (let i = 0; i < currentNumGalaxies; i++) {
      const galaxyId = `galaxy-${i + 1}`;
      // GALAXY_ICON_SIZE is used for the object diameter in getNonOverlappingPositionInCircle
      const position = getNonOverlappingPositionInCircle(universeRadius, GALAXY_ICON_SIZE, existingGalaxyRects);
      
      if (position && typeof position.x === 'number' && typeof position.y === 'number') {
        window.gameSessionData.galaxies.push({
          id: galaxyId,
          x: position.x, // Top-left position for the icon
          y: position.y,
          customName: null,
          solarSystems: [],
          lineConnections: [], // For connections between solar systems within this galaxy
          layoutGenerated: false, // Flag to check if solar systems have been generated
          currentZoom: 1.0,     // Default zoom level for galaxy detail view
          currentPanX: 0,       // Default pan X for galaxy detail view
          currentPanY: 0,       // Default pan Y for galaxy detail view
          generationParams: { densityFactor: 0.8 + Math.random() * 0.4 } // Example per-galaxy param
        });
        existingGalaxyRects.push({ x: position.x, y: position.y, width: GALAXY_ICON_SIZE, height: GALAXY_ICON_SIZE });
      } else {
        console.warn(`generateGalaxies: Could not place galaxy ${galaxyId}. Max attempts reached or invalid placement.`);
      }
    }
  }

  // Helper for distance calculation (Euclidean)
  function getDistance(system1, system2) { 
    // Assumes system1 and system2 have centerX and centerY properties
    return Math.sqrt(Math.pow(system1.centerX - system2.centerX, 2) + Math.pow(system1.centerY - system2.centerY, 2)); 
  }

  // Helper to check if a connection can be added
  function tryAddConnection(fromSystemId, toSystemId, currentConnectionsArray, connectionCountObj, allSolarSystemsList, maxDistanceLimit = null) {
    if (!fromSystemId || !toSystemId || fromSystemId === toSystemId) return false; // Basic checks
    if ((connectionCountObj[fromSystemId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM) return false;
    if ((connectionCountObj[toSystemId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM) return false;

    // Check if this connection (in either direction) already exists
    const sortedKey = [fromSystemId, toSystemId].sort().join('-');
    if (currentConnectionsArray.some(conn => [conn.fromId, conn.toId].sort().join('-') === sortedKey)) return false;

    // Optional distance check
    if (maxDistanceLimit !== null && typeof maxDistanceLimit === 'number') {
      const system1 = allSolarSystemsList.find(s => s.id === fromSystemId);
      const system2 = allSolarSystemsList.find(s => s.id === toSystemId);
      if (!system1 || !system2) {
          console.warn("tryAddConnection: Could not find one or both systems for distance check.", fromSystemId, toSystemId);
          return false; // Cannot verify distance if systems are missing
      }
      if (getDistance(system1, system2) > maxDistanceLimit) return false;
    }
    return true; // Connection is possible
  }

  function generateSolarSystemsForGalaxy(galaxyId) {
    const galaxy = window.gameSessionData.galaxies.find(g => g.id === galaxyId);
    if (!galaxy) {
      console.warn(`generateSolarSystemsForGalaxy: Galaxy ${galaxyId} not found.`);
      return;
    }
    // galaxyViewport is used to determine the dimensions for placing solar systems.
    // This implies generateSolarSystemsForGalaxy might be called when the galaxy detail screen is active.
    // What if it's called during pre-generation (e.g., preGenerateAllContents)?
    // galaxyViewport might not have its final dimensions if the screen isn't active.
    // It's better to use galaxy.generationParams.diameter or similar if available, or a default fixed size for pre-gen.
    // The current code uses galaxyViewport.offsetWidth or gameSessionData.universe.diameter as fallback. This should be okay.
    if (!galaxyViewport) {
        console.warn(`generateSolarSystemsForGalaxy: galaxyViewport element not found. Cannot determine placement area for galaxy ${galaxyId}.`);
        return;
    }

    // Skip if already generated and not force regenerating
    // window.gameSessionData.isForceRegenerating is a custom flag an external process might set.
    if (galaxy.layoutGenerated && !window.gameSessionData.isForceRegenerating) {
      return;
    }

    // Determine the radius of the content area for this galaxy
    // Uses current offsetWidth of the viewport, or falls back to universe diameter.
    // This means the "density" of solar systems could vary if viewport size changes between generations
    // unless universe.diameter is always used as a consistent base.
    const galaxyContentDiameter = galaxyViewport.offsetWidth > 0 ? galaxyViewport.offsetWidth : (window.gameSessionData.universe.diameter || 500);
    const galaxyContentRadius = galaxyContentDiameter / 2;

    if (galaxyContentDiameter <= 0 || isNaN(galaxyContentRadius) || galaxyContentRadius <= 0) {
      console.warn(`generateSolarSystemsForGalaxy: Invalid content dimensions for galaxy ${galaxyId}. Diameter: ${galaxyContentDiameter}`);
      galaxy.layoutGenerated = true; // Mark as "generated" (albeit empty) to prevent re-attempts
      if (!window.gameSessionData.isForceRegenerating) window.saveGameState();
      return;
    }

    galaxy.solarSystems = []; 
    galaxy.lineConnections = [];
    const solarSystemPlacementRects = [];
    const numSystemsToAttempt = Math.floor(Math.random() * (currentMaxSSCount - currentMinSSCount + 1)) + currentMinSSCount;

    for (let i = 0; i < numSystemsToAttempt; i++) {
      const solarSystemId = `${galaxy.id}-ss-${i + 1}`;
      const position = getNonOverlappingPositionInCircle(galaxyContentRadius, SOLAR_SYSTEM_BASE_ICON_SIZE, solarSystemPlacementRects);
      if (position && typeof position.x === 'number' && typeof position.y === 'number') {
        const sunSizeFactor = 0.5 + Math.random() * 9.5; // Consistent with switchToSolarSystemView
        galaxy.solarSystems.push({ 
            id: solarSystemId, 
            customName: null, 
            x: position.x, 
            y: position.y, 
            iconSize: SOLAR_SYSTEM_BASE_ICON_SIZE, 
            sunSizeFactor: sunSizeFactor,
            // centerX and centerY will be added for connection logic
        });
        solarSystemPlacementRects.push({ x: position.x, y: position.y, width: SOLAR_SYSTEM_BASE_ICON_SIZE, height: SOLAR_SYSTEM_BASE_ICON_SIZE });
      }
    }

    if (galaxy.solarSystems.length < 2) { // Need at least 2 systems to form connections
      galaxy.layoutGenerated = true;
      if (!window.gameSessionData.isForceRegenerating) window.saveGameState();
      return;
    }

    // Prepare systems with centerX/Y for distance calculations
    const systemsWithCenters = galaxy.solarSystems.map(ss => ({ 
      ...ss, 
      centerX: ss.x + ss.iconSize / 2, 
      centerY: ss.y + ss.iconSize / 2 
    }));

    const systemConnectionCounts = {};
    const allowedMaxEuclideanDist = galaxyContentDiameter * MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT;
    const allowedMaxForcedDist = galaxyContentDiameter * MAX_FORCED_CONNECTION_DISTANCE_PERCENT;
    
    let connectedSystemIds = new Set();
    let unconnectedSystemIds = new Set(systemsWithCenters.map(s => s.id));

    // Basic Minimum Spanning Tree-like approach to ensure all systems are connected (if possible)
    if (systemsWithCenters.length > 0) {
      const firstSystem = systemsWithCenters[0];
      connectedSystemIds.add(firstSystem.id);
      unconnectedSystemIds.delete(firstSystem.id);

      while (unconnectedSystemIds.size > 0) {
        let bestConnection = null; // { fromId (connected), toId (unconnected), dist }
        let minConnectionDist = Infinity;

        for (const unconnectedId of unconnectedSystemIds) {
          const currentUnconnectedSys = systemsWithCenters.find(s => s.id === unconnectedId);
          for (const connectedId of connectedSystemIds) {
            const currentConnectedSys = systemsWithCenters.find(s => s.id === connectedId);
            if (!currentConnectedSys || !currentUnconnectedSys) continue;
            
            const dist = getDistance(currentUnconnectedSys, currentConnectedSys);
            if (dist < minConnectionDist) {
              minConnectionDist = dist;
              bestConnection = { fromId: connectedId, toId: unconnectedId, dist: dist };
            }
          }
        }

        if (bestConnection) {
          let connectionMade = false;
          // Try to connect with normal distance limit
          if (tryAddConnection(bestConnection.fromId, bestConnection.toId, galaxy.lineConnections, systemConnectionCounts, systemsWithCenters, allowedMaxEuclideanDist)) {
            galaxy.lineConnections.push({ fromId: bestConnection.fromId, toId: bestConnection.toId });
            systemConnectionCounts[bestConnection.fromId] = (systemConnectionCounts[bestConnection.fromId] || 0) + 1;
            systemConnectionCounts[bestConnection.toId] = (systemConnectionCounts[bestConnection.toId] || 0) + 1;
            connectionMade = true;
          } else {
            // If failed, try with forced distance limit (more lenient)
            // This part looks for *any* connected system to connect the 'bestConnection.toId' (the unconnected one)
            let forcedTargetId = null;
            let minForcedDist = Infinity;
            const targetUnconnectedSys = systemsWithCenters.find(s => s.id === bestConnection.toId);

            for (const connectedId of connectedSystemIds) {
                const potentialConnectedSys = systemsWithCenters.find(s => s.id === connectedId);
                if (!potentialConnectedSys || !targetUnconnectedSys) continue;
                
                const dist = getDistance(targetUnconnectedSys, potentialConnectedSys);
                if (dist < minForcedDist && tryAddConnection(bestConnection.toId, connectedId, galaxy.lineConnections, systemConnectionCounts, systemsWithCenters, allowedMaxForcedDist)) {
                    minForcedDist = dist;
                    forcedTargetId = connectedId;
                }
            }
            if (forcedTargetId) {
                galaxy.lineConnections.push({ fromId: bestConnection.toId, toId: forcedTargetId });
                systemConnectionCounts[bestConnection.toId] = (systemConnectionCounts[bestConnection.toId] || 0) + 1;
                systemConnectionCounts[forcedTargetId] = (systemConnectionCounts[forcedTargetId] || 0) + 1;
                connectionMade = true;
            } else {
                 // Ultimate force: connect to *any* available connected system, ignoring distance, if limits not met
                let ultimateTargetId = null;
                let minUltimateDist = Infinity;
                for (const connectedId of connectedSystemIds) {
                    const potentialConnectedSys = systemsWithCenters.find(s => s.id === connectedId);
                    if (!potentialConnectedSys || !targetUnconnectedSys) continue;

                    const dist = getDistance(targetUnconnectedSys, potentialConnectedSys);
                    if (dist < minUltimateDist && tryAddConnection(bestConnection.toId, connectedId, galaxy.lineConnections, systemConnectionCounts, systemsWithCenters, null /* no distance limit */)) {
                        minUltimateDist = dist;
                        ultimateTargetId = connectedId;
                    }
                }
                if (ultimateTargetId) {
                    galaxy.lineConnections.push({ fromId: bestConnection.toId, toId: ultimateTargetId });
                    systemConnectionCounts[bestConnection.toId] = (systemConnectionCounts[bestConnection.toId] || 0) + 1;
                    systemConnectionCounts[ultimateTargetId] = (systemConnectionCounts[ultimateTargetId] || 0) + 1;
                    connectionMade = true;
                }
            }
          }

          if (connectionMade) {
            connectedSystemIds.add(bestConnection.toId);
            unconnectedSystemIds.delete(bestConnection.toId);
          } else {
            // If after all attempts, bestConnection.toId could not be connected, it remains an orphan.
            console.warn(`System ${bestConnection.toId} could not be connected to the main network. Removing from unconnected.`);
            // To prevent infinite loop, remove it from unconnected. It might be isolated.
            // Or, decide to remove it from galaxy.solarSystems if isolation is not allowed.
            unconnectedSystemIds.delete(bestConnection.toId); 
            // galaxy.solarSystems = galaxy.solarSystems.filter(s => s.id !== bestConnection.toId); // Optional: remove isolated system
          }

        } else {
          // No bestConnection found. This can happen if unconnected systems are too far or all potential partners are full.
          if (unconnectedSystemIds.size > 0 && connectedSystemIds.size === 0 && systemsWithCenters.length > 0) {
            // Bootstrap if connectedSystemIds became empty somehow mid-process (should not happen with this logic)
             const nextUnconnectedId = Array.from(unconnectedSystemIds)[0]; 
             connectedSystemIds.add(nextUnconnectedId); 
             unconnectedSystemIds.delete(nextUnconnectedId);
          } else {
            // All remaining systems are orphans or cannot be connected.
            console.warn(`generateSolarSystemsForGalaxy: Could not connect all systems. ${unconnectedSystemIds.size} systems remain unconnected.`);
            break; 
          }
        }
      }
    }

    // Add additional connections to meet desired density
    systemsWithCenters.forEach(sys1 => {
      const desiredConnections = getWeightedNumberOfConnections();
      let currentConnections = systemConnectionCounts[sys1.id] || 0;
      let connectionsToAdd = Math.min(desiredConnections, MAX_CONNECTIONS_PER_SYSTEM) - currentConnections;

      if (connectionsToAdd <= 0) return;

      // Find potential targets, sorted by distance, within Euclidean limit
      let potentialTargets = systemsWithCenters
        .filter(sys2 => sys1.id !== sys2.id)
        .map(sys2 => ({ ...sys2, dist: getDistance(sys1, sys2) }))
        .filter(sys2WithDist => sys2WithDist.dist <= allowedMaxEuclideanDist) // Only consider relatively close systems
        .sort((a, b) => a.dist - b.dist)
        .slice(0, MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS); // Limit candidates

      for (const sys2 of potentialTargets) {
        if (connectionsToAdd <= 0) break;
        // tryAddConnection checks max connections per system and existing connections
        if (tryAddConnection(sys1.id, sys2.id, galaxy.lineConnections, systemConnectionCounts, systemsWithCenters, allowedMaxEuclideanDist)) {
          galaxy.lineConnections.push({ fromId: sys1.id, toId: sys2.id });
          systemConnectionCounts[sys1.id] = (systemConnectionCounts[sys1.id] || 0) + 1;
          systemConnectionCounts[sys2.id] = (systemConnectionCounts[sys2.id] || 0) + 1;
          connectionsToAdd--;
        }
      }
    });

    galaxy.layoutGenerated = true;
    if (!window.gameSessionData.isForceRegenerating) window.saveGameState();
  }

  async function preGenerateAllGalaxyContents() {
    // This flag is used by generateSolarSystemsForGalaxy to bypass the "if already generated" check.
    window.gameSessionData.isForceRegenerating = true; 
    console.log("Pre-generating all galaxy contents...");
    for (const g of window.gameSessionData.galaxies) {
      // Only generate if not already done or if it's empty despite being "done" (e.g. error during prev gen)
      if (!g.layoutGenerated || g.solarSystems.length === 0) { 
        // console.log(`Pre-generating for galaxy: ${g.id}`);
        // await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI to breathe, tiny delay
        generateSolarSystemsForGalaxy(g.id); // This is synchronous now
      }
    }
    window.gameSessionData.isForceRegenerating = false; // Reset the flag
    console.log("Pre-generation complete.");
    window.saveGameState(); // Save after all pre-generation is done
  }


  // --- RENDERING FUNCTIONS ---

  function renderMainScreen() {
    if (mainScreenTitleText) mainScreenTitleText.textContent = "Universe"; // Sets the title
    if (!universeCircle) {
      console.warn("renderMainScreen: universeCircle element not found.");
      return;
    }
    universeCircle.innerHTML = ''; // Clear previous galaxy icons

    window.gameSessionData.galaxies.forEach(galaxy => {
      const galaxyNumDisplay = galaxy.id.split('-').pop(); // For default title
      const galaxyElement = document.createElement('div');
      galaxyElement.className = 'galaxy-icon';
      galaxyElement.style.width = `${GALAXY_ICON_SIZE}px`;
      galaxyElement.style.height = `${GALAXY_ICON_SIZE}px`;
      galaxyElement.style.left = `${galaxy.x}px`;
      galaxyElement.style.top = `${galaxy.y}px`;
      // CSS already sets background-color, border, etc. for .galaxy-icon
      // galaxyElement.style.backgroundColor = FIXED_COLORS.galaxyIconFill; 
      // galaxyElement.style.border = `3px solid ${FIXED_COLORS.galaxyIconBorder}`;
      
      galaxyElement.title = galaxy.customName || `Galaxy ${galaxyNumDisplay}`;
      galaxyElement.dataset.galaxyId = galaxy.id;
      galaxyElement.addEventListener('click', () => switchToGalaxyDetailView(galaxy.id));
      universeCircle.appendChild(galaxyElement);
    });
  }

  function drawGalaxyLines(galaxy) { // Draws lines between solar systems in galaxy view
    if (!solarSystemLinesCanvasEl || !galaxyZoomContent) {
      // console.warn("drawGalaxyLines: Canvas or zoom content element not found."); // Can be noisy
      return;
    }
    // Ensure canvas drawing surface matches its display size
    if (galaxyZoomContent.offsetWidth > 0 && solarSystemLinesCanvasEl.width !== galaxyZoomContent.offsetWidth) {
      solarSystemLinesCanvasEl.width = galaxyZoomContent.offsetWidth;
    }
    if (galaxyZoomContent.offsetHeight > 0 && solarSystemLinesCanvasEl.height !== galaxyZoomContent.offsetHeight) {
      solarSystemLinesCanvasEl.height = galaxyZoomContent.offsetHeight;
    }
    
    if (!linesCtx) linesCtx = solarSystemLinesCanvasEl.getContext('2d');
    if (!linesCtx) {
      console.warn("drawGalaxyLines: Could not get 2D context for solarSystemLinesCanvasEl.");
      return;
    }

    linesCtx.clearRect(0, 0, solarSystemLinesCanvasEl.width, solarSystemLinesCanvasEl.height);
    if (!galaxy || !galaxy.lineConnections || !galaxy.solarSystems || galaxy.solarSystems.length === 0) {
      return; // No lines to draw
    }

    linesCtx.strokeStyle = FIXED_COLORS.connectionLine;
    linesCtx.lineWidth = 0.5; // Thin lines
    linesCtx.setLineDash([]); // Solid lines

    // Create a quick lookup for system positions
    const systemPositions = {};
    galaxy.solarSystems.forEach(ss => {
      systemPositions[ss.id] = { 
        x: ss.x + (ss.iconSize / 2), // Center of the icon
        y: ss.y + (ss.iconSize / 2) 
      };
    });

    galaxy.lineConnections.forEach(connection => {
      const fromPos = systemPositions[connection.fromId];
      const toPos = systemPositions[connection.toId];
      if (fromPos && toPos) {
        linesCtx.beginPath();
        linesCtx.moveTo(fromPos.x, fromPos.y);
        linesCtx.lineTo(toPos.x, toPos.y);
        linesCtx.stroke();
      }
    });
  }

  function renderGalaxyDetailScreen(isInteractivePanOrZoom = false) {
    const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
    if (!galaxy) {
      console.warn("renderGalaxyDetailScreen: Active galaxy not found. Switching to main view.");
      switchToMainView(); // Fallback if active galaxy is missing
      return;
    }
    if (!galaxyViewport || !galaxyZoomContent) {
      console.warn("renderGalaxyDetailScreen: Viewport or zoom content element not found.");
      return;
    }

    // Set the logical size of the viewport (where content is placed)
    // This should match the conceptual diameter used for generating solar system positions for this galaxy
    const galaxyContentDiameter = window.gameSessionData.universe.diameter || 500; // Fallback from universe diameter consistent with generation
    galaxyViewport.style.width = `${galaxyContentDiameter}px`;
    galaxyViewport.style.height = `${galaxyContentDiameter}px`;

    // Clear old solar system icons
    const existingIcons = galaxyZoomContent.querySelectorAll('.solar-system-icon');
    existingIcons.forEach(icon => icon.remove());

    const zoomScaleDependency = 0.6; // How much icon size is affected by zoom for perceived depth

    galaxy.solarSystems.forEach(ss => {
      const solarSystemElement = document.createElement('div');
      solarSystemElement.className = 'solar-system-icon';
      
      // Adjust icon size based on zoom for a pseudo-3D effect or to maintain visibility
      // Original: let dIPx = ss.iconSize * (1 + (g.currentZoom - GALAXY_VIEW_MIN_ZOOM) * zoomSD); if (g.currentZoom > 0) dIPx /= g.currentZoom; dIPx = Math.max(2.5, dIPx);
      // This formula seems to try to make icons smaller as you zoom in (divide by currentZoom),
      // which might be counter-intuitive if zoom is meant to enlarge. Let's analyze:
      // If currentZoom = 1 (min), factor is 1. dIPx = iconSize.
      // If currentZoom = 2, factor = 1 + (2-1)*0.6 = 1.6. dIPx = iconSize * 1.6 / 2 = iconSize * 0.8 (smaller).
      // This makes icons appear fixed in world space if the zoom scales the whole view.
      // Let's simplify: icons are drawn at their ss.iconSize, and the view transform handles scaling.
      // If dynamic sizing is still desired (e.g. for LOD or emphasis), it needs careful thought.
      // For now, let's use base icon size. CSS :hover can handle individual scaling.
      let displayIconSize = ss.iconSize; // Use base size.
      // If you want them to appear slightly larger at closer zooms to avoid them becoming tiny:
      // displayIconSize = ss.iconSize / Math.sqrt(galaxy.currentZoom); // Example: scale inversely with sqrt of zoom
      // displayIconSize = Math.max(SOLAR_SYSTEM_BASE_ICON_SIZE, displayIconSize); // Ensure min size

      solarSystemElement.style.width = `${displayIconSize}px`;
      solarSystemElement.style.height = `${displayIconSize}px`;
      
      // Position icons based on their (x,y) which is top-left. No complex offset needed beyond centering if icon size changes.
      // The ss.x, ss.y are already top-left coordinates.
      const currentIconCenterOffsetX = displayIconSize / 2;
      const baseIconCenterOffsetX = ss.iconSize / 2;
      solarSystemElement.style.left = `${ss.x + baseIconCenterOffsetX - currentIconCenterOffsetX}px`;
      solarSystemElement.style.top = `${ss.y + baseIconCenterOffsetX - currentIconCenterOffsetX}px`;

      solarSystemElement.dataset.solarSystemId = ss.id;
      if (ss.customName) solarSystemElement.title = ss.customName;
      
      solarSystemElement.addEventListener('click', (e) => { 
        e.stopPropagation(); // Prevent galaxy viewport pan start
        switchToSolarSystemView(ss.id); 
      });
      galaxyZoomContent.appendChild(solarSystemElement);
    });

    // Ensure lines canvas is first child for correct layering
    if (solarSystemLinesCanvasEl.parentNode !== galaxyZoomContent || galaxyZoomContent.firstChild !== solarSystemLinesCanvasEl) {
      galaxyZoomContent.insertBefore(solarSystemLinesCanvasEl, galaxyZoomContent.firstChild);
    }
    drawGalaxyLines(galaxy); // Redraw lines after icons are placed (or if zoom/pan changes underlying canvas size)

    galaxyZoomContent.style.transition = isInteractivePanOrZoom ? 'none' : 'transform 0.1s ease-out';
    galaxyZoomContent.style.transform = `translate(${galaxy.currentPanX}px,${galaxy.currentPanY}px) scale(${galaxy.currentZoom})`;

    if (galaxyDetailTitleText) { 
      const galaxyNumDisplay = galaxy.id.split('-').pop();
      galaxyDetailTitleText.textContent = galaxy.customName || `Galaxy ${galaxyNumDisplay}`; 
    }
  }

  function drawAllOrbits() { // For Solar System View
    if (!orbitCtx || !solarSystemOrbitCanvasEl || !window.gameSessionData.solarSystemView.planets) {
      // console.warn("drawAllOrbits: Missing context, canvas, or planets data.");
      return;
    }
    orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);

    if (!currentShowPlanetOrbits) { // If orbits are turned off
      if (solarSystemOrbitCanvasEl) solarSystemOrbitCanvasEl.style.display = 'none';
      return;
    } else {
      if (solarSystemOrbitCanvasEl) solarSystemOrbitCanvasEl.style.display = 'block';
    }

    const centerX = solarSystemOrbitCanvasEl.width / 2;
    const centerY = solarSystemOrbitCanvasEl.height / 2;

    window.gameSessionData.solarSystemView.planets.forEach(planetData => {
      orbitCtx.beginPath();
      orbitCtx.arc(centerX, centerY, planetData.distance, 0, 2 * Math.PI);
      orbitCtx.strokeStyle = 'rgba(255,255,255,0.2)'; // Faint white lines
      orbitCtx.lineWidth = 1;
      orbitCtx.setLineDash([5, 5]); // Dashed lines
      orbitCtx.stroke();
    });
    orbitCtx.setLineDash([]); // Reset for other potential canvas uses
  }

  function renderSolarSystemScreen(isInteractivePanOrZoom = false) {
    if (!solarSystemContent || !solarSystemScreen || !window.gameSessionData.activeSolarSystemId) {
      console.warn("renderSolarSystemScreen: Core elements or active solar system missing.");
      return;
    }

    // Ensure the dynamically created orbit canvas has the correct size
    if (solarSystemOrbitCanvasEl && (solarSystemOrbitCanvasEl.width !== ORBIT_CANVAS_SIZE || solarSystemOrbitCanvasEl.height !== ORBIT_CANVAS_SIZE)) {
      solarSystemOrbitCanvasEl.width = ORBIT_CANVAS_SIZE;
      solarSystemOrbitCanvasEl.height = ORBIT_CANVAS_SIZE;
      // If size changed, orbits need redraw even if not interactive, unless animation handles it.
      // drawAllOrbits(); // This might be called too frequently if here.
    }
    
    const solarSystemData = window.gameSessionData.solarSystemView;
    let panX = solarSystemData.currentPanX || 0;
    let panY = solarSystemData.currentPanY || 0;
    let zoom = solarSystemData.zoomLevel || SOLAR_SYSTEM_VIEW_MIN_ZOOM; // Default to min_zoom

    solarSystemContent.style.transition = isInteractivePanOrZoom ? 'none' : 'transform 0.1s ease-out';
    solarSystemContent.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

    // Update title
    const galaxyIdMatch = window.gameSessionData.activeSolarSystemId.match(/^(galaxy-\d+)-ss-\d+$/);
    const parentGalaxyId = galaxyIdMatch ? galaxyIdMatch[1] : null;
    const activeGalaxy = parentGalaxyId ? window.gameSessionData.galaxies.find(g => g.id === parentGalaxyId) : null;
    let solarSystemObject = null;
    if (activeGalaxy && activeGalaxy.solarSystems) {
      solarSystemObject = activeGalaxy.solarSystems.find(s => s.id === solarSystemData.systemId);
    }
    if (solarSystemTitleText) { 
      const systemNumDisplay = solarSystemData.systemId ? solarSystemData.systemId.substring(solarSystemData.systemId.lastIndexOf('-') + 1) : 'N/A';
      solarSystemTitleText.textContent = (solarSystemObject && solarSystemObject.customName) ? solarSystemObject.customName : `System ${systemNumDisplay}`; 
    }
    
    // The animationController handles planet element positions.
    // Orbits are drawn if currentShowPlanetOrbits is true.
    // This function mainly handles the zoom/pan transform and title.
    // Call drawAllOrbits if not interactive (e.g. initial render) or if animation isn't running.
    const solarSystemScreenIsActive = solarSystemScreen.classList.contains('active');
    if ((!isInteractivePanOrZoom && solarSystemScreenIsActive) || (solarSystemScreenIsActive && !isSolarSystemAnimationRunning())) {
        drawAllOrbits();
    }
  }

  // --- VIEW SWITCHING FUNCTIONS ---

  window.switchToMainView = switchToMainView; // Expose for PlanetDesigner cancel, or just use setActiveScreen(mainScreen)
  function switchToMainView() {
    window.gameSessionData.activeGalaxyId = null;
    window.gameSessionData.activeSolarSystemId = null;
    stopSolarSystemAnimation(); // Stop animation when leaving solar system context
    setActiveScreen(mainScreen);
    // renderMainScreen(); // setActiveScreen might trigger this via resize/init, or call explicitly if needed.
                         // Let's assume renderMainScreen is called by initializeGame or when data changes.
  }

  function makeTitleEditable(titleTextElement, inputElement, onSaveCallback) {
    if (!titleTextElement || !inputElement) {
        console.warn("makeTitleEditable: Missing title or input element.");
        return;
    }
    titleTextElement.ondblclick = () => { 
      titleTextElement.style.display = 'none'; 
      inputElement.style.display = 'inline-block'; 
      inputElement.value = titleTextElement.textContent; 
      inputElement.focus(); 
      inputElement.select(); 
    };
    const saveName = () => { 
      const newName = inputElement.value.trim(); 
      // onSaveCallback is expected to persist the name and return the name to display (could be default if newName is empty)
      const displayName = onSaveCallback(newName || null); 
      titleTextElement.textContent = displayName; 
      inputElement.style.display = 'none'; 
      titleTextElement.style.display = 'inline-block'; 
    };
    inputElement.onblur = saveName; 
    inputElement.onkeydown = (e) => { 
      if (e.key === 'Enter') inputElement.blur(); 
      else if (e.key === 'Escape') { 
        inputElement.value = titleTextElement.textContent; // Revert to original on escape
        inputElement.blur(); 
      } 
    };
  }

  function switchToGalaxyDetailView(galaxyId) {
    const galaxy = window.gameSessionData.galaxies.find(g => g.id === galaxyId);
    if (!galaxy) {
      console.warn(`switchToGalaxyDetailView: Galaxy ${galaxyId} not found. Switching to main view.`);
      switchToMainView();
      return;
    }

    window.gameSessionData.activeGalaxyId = galaxyId;
    const galaxyNumDisplay = galaxy.id.split('-').pop();
    if (backToGalaxyButton) { // This button is on the Solar System Screen
        // This is text for "Back to Galaxy [name]" from Solar System View
        backToGalaxyButton.textContent = galaxy.customName ? `← ${galaxy.customName}` : `← Galaxy ${galaxyNumDisplay}`;
    }
    
    window.gameSessionData.activeSolarSystemId = null; // Clear active solar system
    stopSolarSystemAnimation(); // Stop any solar system animation

    // Initialize zoom/pan for the galaxy if not already set
    galaxy.currentZoom = galaxy.currentZoom || 1.0;
    galaxy.currentPanX = galaxy.currentPanX || 0;
    galaxy.currentPanY = galaxy.currentPanY || 0;

    if (galaxyDetailTitleText) { 
        galaxyDetailTitleText.textContent = galaxy.customName || `Galaxy ${galaxyNumDisplay}`; 
        galaxyDetailTitleText.style.display = 'inline-block'; 
    } 
    if (galaxyDetailTitleInput) galaxyDetailTitleInput.style.display = 'none';
    
    setActiveScreen(galaxyDetailScreen);
    makeTitleEditable(galaxyDetailTitleText, galaxyDetailTitleInput, (newName) => { 
      galaxy.customName = newName || null; 
      window.saveGameState(); 
      renderMainScreen(); // Re-render main screen to reflect new galaxy name on its icon
      // Update backToGalaxyButton text if we are currently in a solar system of this galaxy
      if (window.gameSessionData.activeSolarSystemId && window.gameSessionData.activeSolarSystemId.startsWith(galaxy.id)) {
          if (backToGalaxyButton) backToGalaxyButton.textContent = galaxy.customName ? `← ${galaxy.customName}` : `← Galaxy ${galaxyNumDisplay}`;
      }
      return galaxy.customName || `Galaxy ${galaxyNumDisplay}`; 
    });

    // Set the logical dimensions of the galaxyViewport container where content is scaled/panned
    if (galaxyViewport && window.gameSessionData.universe.diameter) {
      // This sets the *masking* viewport size, not the content scroll size.
      // The content (#galaxy-zoom-content) is 100% of this and then scaled.
      galaxyViewport.style.width = `${window.gameSessionData.universe.diameter}px`;
      galaxyViewport.style.height = `${window.gameSessionData.universe.diameter}px`;
    }

    // Generate solar systems if not already done
    if (!galaxy.layoutGenerated) {
      console.log(`switchToGalaxyDetailView: Galaxy ${galaxy.id} layout not generated. Generating now.`);
      // Delay slightly to allow screen transition / first paint
      setTimeout(() => {
        function attemptGeneration(retriesLeft = 5) {
          if (galaxyViewport && galaxyViewport.offsetWidth > 0 && galaxyViewport.offsetHeight > 0) {
            generateSolarSystemsForGalaxy(galaxyId); // This uses galaxyViewport.offsetWidth
            renderGalaxyDetailScreen(false); // Render after generation
          } else if (retriesLeft > 0) {
            // console.log(`switchToGalaxyDetailView: galaxyViewport not ready, retrying generation draw. Retries: ${retriesLeft}`);
            requestAnimationFrame(() => attemptGeneration(retriesLeft - 1));
          } else {
            console.warn("switchToGalaxyDetailView: galaxyViewport did not get dimensions. Solar systems might not be placed correctly or lines drawn.");
            galaxy.layoutGenerated = true; // Mark as generated to avoid loops, even if it failed.
            renderGalaxyDetailScreen(false); // Attempt to render anyway
          }
        }
        attemptGeneration();
      }, 50); // Small delay
    } else {
      renderGalaxyDetailScreen(false); // Just render if already generated
    }
  }

  function switchToSolarSystemView(solarSystemId) {
    window.gameSessionData.activeSolarSystemId = solarSystemId;

    // Find parent galaxy and the solar system object
    const galaxyIdMatch = solarSystemId.match(/^(galaxy-\d+)-ss-\d+$/);
    const parentGalaxyId = galaxyIdMatch ? galaxyIdMatch[1] : null;
    const activeGalaxy = parentGalaxyId ? window.gameSessionData.galaxies.find(g => g.id === parentGalaxyId) : null;
    let solarSystemObject = null;
    if (activeGalaxy && activeGalaxy.solarSystems) {
      solarSystemObject = activeGalaxy.solarSystems.find(s => s.id === solarSystemId);
    }
    if (!solarSystemObject) {
        console.error(`switchToSolarSystemView: Solar System object ${solarSystemId} not found in game data.`);
        switchToMainView(); // Fallback
        return;
    }

    // Reset solar system view state for the new system
    window.gameSessionData.solarSystemView.zoomLevel = 0.5; // Default zoom
    window.gameSessionData.solarSystemView.currentPanX = 0;
    window.gameSessionData.solarSystemView.currentPanY = 0;
    window.gameSessionData.solarSystemView.systemId = solarSystemId;
    window.gameSessionData.solarSystemView.planets = []; // Clear previous planets

    if (solarSystemContent) solarSystemContent.innerHTML = ''; // Clear previous DOM content (sun, planets)

    // Create Sun Element
    let currentSunSize = SUN_ICON_SIZE; // Default
    if (solarSystemObject && typeof solarSystemObject.sunSizeFactor === 'number') {
      currentSunSize = SUN_ICON_SIZE * solarSystemObject.sunSizeFactor;
    }
    currentSunSize = Math.max(currentSunSize, 15); // Min sun size

    const sunElement = document.createElement('div');
    sunElement.className = 'sun-icon sun-animated'; // sun-animated for CSS pulse
    sunElement.style.width = `${currentSunSize}px`;
    sunElement.style.height = `${currentSunSize}px`;
    // CSS Variables for sun gradient and border are set in styles.css
    // const coreColor = FIXED_COLORS.sunFill, /* ... etc */ 
    // sunElement.style.setProperty('--sun-core-color', coreColor); // Not needed if CSS is sufficient
    if (solarSystemContent) solarSystemContent.appendChild(sunElement);

    // Create and append orbit canvas (if it doesn't exist or needs reset)
    // solarSystemOrbitCanvasEl is a global-like variable in script.js
    if (solarSystemOrbitCanvasEl && solarSystemOrbitCanvasEl.parentNode) {
        solarSystemOrbitCanvasEl.remove(); // Remove old one if exists
    }
    solarSystemOrbitCanvasEl = document.createElement('canvas');
    solarSystemOrbitCanvasEl.id = 'solar-system-orbit-canvas'; // Used by CSS
    solarSystemOrbitCanvasEl.width = ORBIT_CANVAS_SIZE; // Set by updateDerivedConstants
    solarSystemOrbitCanvasEl.height = ORBIT_CANVAS_SIZE;
    if (solarSystemContent) solarSystemContent.appendChild(solarSystemOrbitCanvasEl);
    orbitCtx = solarSystemOrbitCanvasEl.getContext('2d');
    if (!orbitCtx) console.error("Failed to get 2D context for orbit canvas");

    // Generate Planets for this system
    let usedOrbitalDistances = [];
    const numPlanetsToGenerate = Math.floor(Math.random() * (currentMaxPlanets - currentMinPlanets + 1)) + currentMinPlanets;

    for (let i = 0; i < numPlanetsToGenerate; i++) {
      const planetSize = MIN_PLANET_SIZE + Math.random() * (MAX_PLANET_SIZE - MIN_PLANET_SIZE);
      let planetDistance;
      let placementAttempts = 0;
      
      // Ensure planets have minimum separation
      do {
        planetDistance = MIN_PLANET_DISTANCE + Math.random() * (MAX_PLANET_DISTANCE - MIN_PLANET_DISTANCE);
        let tooCloseToOtherOrbit = false;
        for (const usedDist of usedOrbitalDistances) {
          if (Math.abs(planetDistance - usedDist.distance) < (MIN_ORBITAL_SEPARATION + (usedDist.size / 2) + (planetSize / 2))) {
            tooCloseToOtherOrbit = true;
            break;
          }
        }
        if (!tooCloseToOtherOrbit) break;
        placementAttempts++;
      } while (placementAttempts < 200);

      if (placementAttempts >= 200) {
        console.warn(`Could not place planet ${i + 1} due to orbital separation constraints.`);
        continue; // Skip this planet
      }
      usedOrbitalDistances.push({ distance: planetDistance, size: planetSize });

      // Use a custom design if available, otherwise a default basis
      const basisToUse = (window.gameSessionData.customPlanetDesigns && window.gameSessionData.customPlanetDesigns.length > 0)
        ? window.gameSessionData.customPlanetDesigns[Math.floor(Math.random() * window.gameSessionData.customPlanetDesigns.length)]
        : { // Default fallback basis if no custom designs
            waterColor: '#0077BE', landColor: '#3A5F0B', 
            minTerrainHeightRange: [0.0, 1.0], 
            maxTerrainHeightRange: [5.0, 8.0], 
            oceanHeightRange: [1.0, 3.0],
            continentSeed: Math.random() // Ensure seed is present
          };
      
      const planetInstanceAppearance = window.generatePlanetInstanceFromBasis(basisToUse, false);

      const initialOrbitalAngle = Math.random() * 2 * Math.PI;
      // Orbital speed randomization: use the MIN/MAX_ROTATION_SPEED constants
      const orbitalSpeed = MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT + Math.random() * (MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT - MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT);
      const initialAxialAngle = Math.random() * 2 * Math.PI;
      const axialSpeed = window.DEFAULT_PLANET_AXIAL_SPEED; // Use global default

      const newPlanet = {
        id: `${solarSystemId}-planet-${i + 1}`,
        planetName: `Planet ${i + 1}`, // Generic name, can be made more interesting
        size: planetSize,
        distance: planetDistance,
        currentOrbitalAngle: initialOrbitalAngle,
        orbitalSpeed: orbitalSpeed,
        currentAxialAngle: initialAxialAngle,
        axialSpeed: axialSpeed,
        element: null, // DOM element will be created next
        type: 'terrestrial', // Example type
        ...planetInstanceAppearance, // waterColor, landColor, terrain params, continentSeed
        sourceDesignId: basisToUse.designId || null // Track originating design
      };
      window.gameSessionData.solarSystemView.planets.push(newPlanet);

      const planetElement = document.createElement('div');
      planetElement.classList.add('planet-icon');
      // The 'clickable-when-paused' class is for visual feedback, handled by CSS. Click listener below.
      if (window.PlanetVisualPanelManager && window.PlanetVisualPanelManager.init) { // Check if manager is available
          planetElement.classList.add('clickable-when-paused');
          planetElement.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent solar system pan/zoom
            // Use PlanetVisualPanelManager to show the panel
            window.PlanetVisualPanelManager.show(newPlanet);
          });
      }
      
      planetElement.style.width = `${newPlanet.size}px`;
      planetElement.style.height = `${newPlanet.size}px`;
      
      // Simple visual representation. The actual detailed look comes from the visual panel.
      const randPos1 = 15 + Math.random() * 70; // More varied spots
      const randSize1 = 20 + Math.random() * 60; // More varied splotch sizes
      let backgroundStyle = `radial-gradient(circle at ${randPos1}% ${randPos1}%, ${newPlanet.landColor} ${randSize1}%, transparent ${randSize1 + 20}%), ${newPlanet.waterColor}`;
      if (Math.random() < 0.6) { // Add a second splotch often
          const randPos2 = 15 + Math.random() * 70;
          const randSize2 = 20 + Math.random() * 50;
          const slightlyDarkerLand = adjustColor(newPlanet.landColor, -30); // Use adjustColor helper
          backgroundStyle = `radial-gradient(circle at ${randPos1}% ${randPos1}%, ${newPlanet.landColor} ${randSize1}%, transparent ${randSize1 + 20}%), radial-gradient(circle at ${randPos2}% ${randPos2}%, ${slightlyDarkerLand} ${randSize2}%, transparent ${randSize2 + 15}%), ${newPlanet.waterColor}`;
      }
      planetElement.style.background = backgroundStyle;
      planetElement.style.boxShadow = `0 0 ${newPlanet.size / 3}px rgba(200,200,255,0.2)`; // Faint atmospheric glow

      if (solarSystemContent) solarSystemContent.appendChild(planetElement);
      newPlanet.element = planetElement; // Link DOM element to data
    }

    // Preload planet textures for the visual panel worker
    if (planetVisualWorker && window.gameSessionData.solarSystemView.planets.length > 0) {
      window.gameSessionData.solarSystemView.planets.forEach(planetToPreload => {
        const planetRenderData = { ...planetToPreload }; // Shallow copy
        delete planetRenderData.element; // Don't send DOM element
        // Add any other properties that should be excluded from worker data
        planetVisualWorker.postMessage({
            cmd: 'preloadPlanet', 
            planetData: planetRenderData, // Send the appearance data
            // Rotation and canvas size for preload are minimal, worker just needs seed primarily
            rotationQuaternion: (typeof quat_identity === 'function' ? quat_identity() : [1,0,0,0]), 
            canvasWidth: 50, // Small dummy size for preload
            canvasHeight: 50,
            senderId: `preload-${planetToPreload.id}` // Unique senderId for preloading
        });
      });
    }
    
    const systemNumDisplay = solarSystemId.substring(solarSystemId.lastIndexOf('-') + 1);
    if (solarSystemTitleText) {
        solarSystemTitleText.textContent = (solarSystemObject && solarSystemObject.customName) ? solarSystemObject.customName : `System ${systemNumDisplay}`;
    }
    if (solarSystemTitleInput) solarSystemTitleInput.style.display = 'none';

    setActiveScreen(solarSystemScreen);
    makeTitleEditable(solarSystemTitleText, solarSystemTitleInput, (newName) => { 
      if (solarSystemObject) { 
        solarSystemObject.customName = newName || null; 
        window.saveGameState(); 
        renderGalaxyDetailScreen(); // Re-render galaxy screen to update solar system icon title
        return solarSystemObject.customName || `System ${systemNumDisplay}`; 
      } 
      return `System ${systemNumDisplay}`; // Fallback
    });
    
    renderSolarSystemScreen(false); // Initial render of the solar system content (zoom/pan)
    startSolarSystemAnimation(); // Start planet movement
  }


// script.js
// ... (previous code) ...

  // Animation functions (animateSolarSystem, startSolarSystemAnimation, stopSolarSystemAnimation)
  // are imported from animationController.js and REMOVED from direct definition in script.js

  // --- PANNING AND ZOOMING ---

  function clampSolarSystemPan(solarSystemDataObject, viewportWidth, viewportHeight) { 
    if (!solarSystemDataObject || !viewportWidth || !viewportHeight) { 
      if (solarSystemDataObject) { 
        solarSystemDataObject.currentPanX = 0; 
        solarSystemDataObject.currentPanY = 0; 
      }
      return; 
    }
    const zoom = solarSystemDataObject.zoomLevel;
    // SOLAR_SYSTEM_EXPLORABLE_RADIUS defines the logical size of the content
    const contentWidth = SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2; 
    const contentHeight = SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2;
    
    const scaledContentWidth = contentWidth * zoom;
    const scaledContentHeight = contentHeight * zoom;

    // Max pan is half the difference between scaled content and viewport, or 0 if content is smaller
    const maxPanX = Math.max(0, (scaledContentWidth - viewportWidth) / 2);
    const maxPanY = Math.max(0, (scaledContentHeight - viewportHeight) / 2);

    solarSystemDataObject.currentPanX = Math.max(-maxPanX, Math.min(maxPanX, solarSystemDataObject.currentPanX));
    solarSystemDataObject.currentPanY = Math.max(-maxPanY, Math.min(maxPanY, solarSystemDataObject.currentPanY));
  }

  function clampGalaxyPan(galaxyDataObject) { 
    if (!galaxyDataObject || !galaxyViewport) return; 
    
    const viewportWidth = galaxyViewport.offsetWidth;
    const viewportHeight = galaxyViewport.offsetHeight;
    const zoom = galaxyDataObject.currentZoom;

    if (zoom <= GALAXY_VIEW_MIN_ZOOM) { // If at min zoom (or less), center content
      galaxyDataObject.currentPanX = 0;
      galaxyDataObject.currentPanY = 0;
    } else {
      // Content diameter for galaxy view is based on universe diameter (or fallback)
      const contentDiameter = window.gameSessionData.universe.diameter || 500;
      const scaledContentWidth = contentDiameter * zoom;
      const scaledContentHeight = contentDiameter * zoom;
      
      const maxPanX = Math.max(0, (scaledContentWidth - viewportWidth) / 2);
      const maxPanY = Math.max(0, (scaledContentHeight - viewportHeight) / 2);
      
      galaxyDataObject.currentPanX = Math.max(-maxPanX, Math.min(maxPanX, galaxyDataObject.currentPanX));
      galaxyDataObject.currentPanY = Math.max(-maxPanY, Math.min(maxPanY, galaxyDataObject.currentPanY));
    }
  }

  function handleZoom(direction, mouseEvent = null) {
    let targetDataObject, viewElement, clampFunction, renderFunction, minZoomConst, maxZoomConst, 
        zoomKey, panXKey, panYKey, isSolarSystem = false;

    if (galaxyDetailScreen.classList.contains('active')) {
      const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
      if (!galaxy) return;
      targetDataObject = galaxy;
      viewElement = galaxyViewport; // The element whose bounds are relevant for mouse-centric zoom
      clampFunction = clampGalaxyPan;
      renderFunction = renderGalaxyDetailScreen;
      minZoomConst = GALAXY_VIEW_MIN_ZOOM;
      maxZoomConst = GALAXY_VIEW_MAX_ZOOM;
      zoomKey = 'currentZoom'; panXKey = 'currentPanX'; panYKey = 'currentPanY';
    } else if (solarSystemScreen.classList.contains('active')) {
      isSolarSystem = true;
      targetDataObject = window.gameSessionData.solarSystemView;
      viewElement = solarSystemScreen; // The whole screen is the viewport for solar system
      clampFunction = clampSolarSystemPan;
      renderFunction = renderSolarSystemScreen;
      minZoomConst = SOLAR_SYSTEM_VIEW_MIN_ZOOM;
      maxZoomConst = SOLAR_SYSTEM_VIEW_MAX_ZOOM;
      zoomKey = 'zoomLevel'; panXKey = 'currentPanX'; panYKey = 'currentPanY';
    } else {
      return; // Not on a zoomable screen
    }

    const oldZoom = targetDataObject[zoomKey];
    // Calculate new zoom level: current zoom +/- a fraction of itself or a fixed step
    // The original logic: oldZoom + (dir === 'in' ? (ZOOM_STEP * oldZoom) : -(ZOOM_STEP * oldZoom))
    // This means ZOOM_STEP is a percentage. 0.2 means 20% zoom in/out.
    let newZoom = oldZoom * (1 + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP));

    let effectiveMinZoom = minZoomConst;
    if (isSolarSystem && viewElement) { // Solar system has dynamic min zoom to fit content
      const vw = viewElement.offsetWidth;
      const vh = viewElement.offsetHeight;
      let dynamicMinZoomBasedOnExplorableArea = 0;
      if (SOLAR_SYSTEM_EXPLORABLE_RADIUS > 0 && (vw > 0 || vh > 0)) {
        const zoomToFitWidth = vw > 0 ? vw / (SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2) : 0;
        const zoomToFitHeight = vh > 0 ? vh / (SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2) : 0;
        // Smallest zoom required to see the whole explorable area
        dynamicMinZoomBasedOnExplorableArea = Math.max(zoomToFitWidth, zoomToFitHeight, SOLAR_SYSTEM_VIEW_MIN_ZOOM); 
      }
      effectiveMinZoom = Math.max(minZoomConst, dynamicMinZoomBasedOnExplorableArea);
    }
    
    newZoom = Math.max(effectiveMinZoom, Math.min(maxZoomConst, newZoom));

    if (Math.abs(oldZoom - newZoom) < 0.0001) return; // No significant change

    targetDataObject[zoomKey] = newZoom;

    // Mouse-centric zoom: Adjust pan so the point under the mouse stays in the same screen position
    if (mouseEvent && viewElement) {
      const rect = viewElement.getBoundingClientRect();
      const mouseXInViewport = mouseEvent.clientX - rect.left;
      const mouseYInViewport = mouseEvent.clientY - rect.top;

      // Position of mouse relative to center of the viewport element
      const mouseXRelToCenter = mouseXInViewport - (viewElement.offsetWidth / 2);
      const mouseYRelToCenter = mouseYInViewport - (viewElement.offsetHeight / 2);
      
      const currentPanX = targetDataObject[panXKey] || 0;
      const currentPanY = targetDataObject[panYKey] || 0;

      // World coordinates of the point under the mouse before zoom
      // (mouseXRelToCenter - currentPanX) is mouse pos in scaled content space, relative to content center.
      // Dividing by oldZoom gives mouse pos in unscaled content space, relative to content center.
      const worldX = (mouseXRelToCenter - currentPanX) / oldZoom;
      const worldY = (mouseYRelToCenter - currentPanY) / oldZoom;

      // New pan to keep worldX, worldY at mouseXRelToCenter, mouseYRelToCenter
      targetDataObject[panXKey] = mouseXRelToCenter - (worldX * newZoom);
      targetDataObject[panYKey] = mouseYRelToCenter - (worldY * newZoom);
    }

    // Clamp pan and re-render
    if (isSolarSystem && viewElement) {
      clampFunction(targetDataObject, viewElement.offsetWidth, viewElement.offsetHeight);
      if (currentShowPlanetOrbits) drawAllOrbits(); // Redraw orbits if zoom changes their apparent scale
      renderFunction(true); // True for interactive
    } else {
      clampFunction(targetDataObject); // For galaxy
      renderFunction(true); // True for interactive
    }
  }

  // --- Panning Start/Move/Up handlers for Galaxy and Solar System views ---
  // These use window.gameSessionData.panning to store state.
  function startPan(event, viewportElement, contentElementToTransform, dataObjectWithPanProperties) {
    if (event.button !== 0 || event.target.closest('button')) return; // Only left click, not on buttons
    
    // For galaxy view, don't start pan if clicking on a solar system icon
    if (viewportElement === galaxyViewport && event.target.closest('.solar-system-icon')) return;
    // For solar system view, don't start pan if clicking on a planet icon (that opens the panel)
    if (viewportElement === solarSystemScreen && event.target.closest('.planet-icon')) return;


    const panningState = window.gameSessionData.panning;
    panningState.isActive = true;
    panningState.startX = event.clientX;
    panningState.startY = event.clientY;
    panningState.initialPanX = dataObjectWithPanProperties.currentPanX || dataObjectWithPanProperties.zoomLevel /* typo, should be currentPanX/Y */;
    panningState.initialPanY = dataObjectWithPanProperties.currentPanY || 0; // Corrected typo, default to 0
    // Ensure correct keys are used:
    const panXKey = viewportElement === galaxyViewport ? 'currentPanX' : 'currentPanX'; // Same for solarSystemView
    const panYKey = viewportElement === galaxyViewport ? 'currentPanY' : 'currentPanY';
    panningState.initialPanX = dataObjectWithPanProperties[panXKey] || 0;
    panningState.initialPanY = dataObjectWithPanProperties[panYKey] || 0;

    panningState.targetElement = contentElementToTransform;
    panningState.viewportElement = viewportElement; // e.g. galaxyViewport or solarSystemScreen
    panningState.dataObject = dataObjectWithPanProperties;

    if (viewportElement) viewportElement.classList.add('dragging'); // For cursor style
    if (contentElementToTransform) contentElementToTransform.style.transition = 'none'; // For smooth drag
    event.preventDefault();
  }

  function panMouseMove(event) {
    const panningState = window.gameSessionData.panning;
    if (!panningState.isActive || !panningState.dataObject) return;

    const deltaX = event.clientX - panningState.startX;
    const deltaY = event.clientY - panningState.startY;
    
    // Determine pan keys based on which view is active
    const panXKey = panningState.viewportElement === galaxyViewport ? 'currentPanX' : 'currentPanX';
    const panYKey = panningState.viewportElement === galaxyViewport ? 'currentPanY' : 'currentPanY';

    panningState.dataObject[panXKey] = panningState.initialPanX + deltaX;
    panningState.dataObject[panYKey] = panningState.initialPanY + deltaY;

    // Clamp and re-render
    if (panningState.viewportElement === galaxyViewport) {
      clampGalaxyPan(panningState.dataObject);
      renderGalaxyDetailScreen(true); // isInteractive = true
    } else if (panningState.viewportElement === solarSystemScreen) {
      clampSolarSystemPan(panningState.dataObject, panningState.viewportElement.offsetWidth, panningState.viewportElement.offsetHeight);
      renderSolarSystemScreen(true); // isInteractive = true
    }
  }

  function panMouseUp() {
    const panningState = window.gameSessionData.panning;
    if (!panningState.isActive) return;

    if (panningState.viewportElement) panningState.viewportElement.classList.remove('dragging');
    panningState.isActive = false;
    if (panningState.targetElement) panningState.targetElement.style.transition = ''; // Re-enable CSS transitions

    // Final render without 'interactive' flag to allow CSS transitions for any subsequent non-interactive updates
    // if (galaxyDetailScreen.classList.contains('active')) {
    //   renderGalaxyDetailScreen(false); 
    // } else if (solarSystemScreen.classList.contains('active')) {
    //   renderSolarSystemScreen(false);
    // }
    // The above final render might be redundant if the view isn't expected to snap back or animate further.
    // The 'true' render during panMouseMove is usually sufficient.

    panningState.targetElement = null;
    panningState.viewportElement = null;
    panningState.dataObject = null;
  }


  // --- UNIVERSE REGENERATION ---
  function regenerateCurrentUniverseState(forceConfirmationDialog = false) {
    // Renamed 'force' to 'forceConfirmationDialog' for clarity
    if (forceConfirmationDialog && !confirm("This will erase your current universe and generate a new one. Custom planet designs will be kept. Are you sure?")) {
      return;
    }
    
    // Save custom planet designs before clearing other data
    const existingCustomPlanetDesigns = [...(window.gameSessionData.customPlanetDesigns || [])];
    
    // Clear only game world data, not all of localStorage for 'galaxyGameSaveData'
    // This is better than localStorage.removeItem which would also clear designs if they were part of the same key.
    // Actually, saveGameState only saves universeDiameter, galaxies, customPlanetDesigns.
    // So, if we want to keep designs, we must NOT remove the whole item if designs are in it.
    // The current saveGameState includes designs.
    // Option 1: Separate localStorage key for designs.
    // Option 2: Reload designs after clearing sessionData and before re-initializing.
    // For now, let's assume designs are re-instated from existingCustomPlanetDesigns.

    // Reset core game data structures in memory
    window.gameSessionData.universe = { diameter: null };
    window.gameSessionData.galaxies = [];
    window.gameSessionData.activeGalaxyId = null;
    window.gameSessionData.activeSolarSystemId = null;
    window.gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };
    window.gameSessionData.isInitialized = false;
    // Restore custom planet designs to the session data
    window.gameSessionData.customPlanetDesigns = existingCustomPlanetDesigns;
    
    // Clear UI elements
    if (universeCircle) universeCircle.innerHTML = '';
    if (galaxyZoomContent) { 
      const linesCanvas = galaxyZoomContent.querySelector('#solar-system-lines-canvas');
      galaxyZoomContent.innerHTML = ''; // Clear icons
      if (linesCanvas) galaxyZoomContent.appendChild(linesCanvas); // Re-add lines canvas
    }
    if (solarSystemContent) solarSystemContent.innerHTML = '';
    if (orbitCtx && solarSystemOrbitCanvasEl) {
      orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);
    }
    
    stopSolarSystemAnimation();
    initializeGame(true); // Pass true to indicate a forced regeneration (skips loading saved game state)
  }

  // --- EVENT LISTENERS ---
  if (regenerateUniverseButton) regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(true)); // Pass true to force confirm dialog
  if (createPlanetDesignButton) createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);

  // Planet Visual Panel mouse listeners for dragging panel and rotating planet
  // These were originally in script.js but should be managed by PlanetVisualPanelManager.
  // The PlanetVisualPanelManager.init() function sets up its own window mousemove/mouseup listeners.
  // So, the specific handlers (_onWindowMouseMove_forPanel, _onWindowMouseUp_forPanel etc.)
  // in script.js for the visual panel are now redundant and have been removed.
  // PlanetVisualPanelManager's internal _onWindowMouseMove and _onWindowMouseUp will handle its needs.

  // General window mousemove and mouseup listeners primarily for Panning (galaxy/solar system views)
  // These were previously combined with panel dragging logic. Now they are just for panning.
  window.addEventListener('mousemove', (e) => {
    panMouseMove(e); // Handles galaxy/solar system panning
    // PlanetVisualPanelManager's own mousemove listener will handle its logic separately.
  });

  window.addEventListener('mouseup', () => {
    panMouseUp(); // Handles end of galaxy/solar system panning
    // PlanetVisualPanelManager's own mouseup listener will handle its logic separately.
  });

  // --- GAME INITIALIZATION ---
  function initializeGame(isForcedRegeneration = false) {
    console.log("Initializing game. Forced regeneration:", isForcedRegeneration);
    loadCustomizationSettings(); // Load user prefs for generation (numGalaxies, etc.)
                                 // This also calls updateDerivedConstants().

    const designsBeforeLoad = window.gameSessionData.customPlanetDesigns ? 
                              [...window.gameSessionData.customPlanetDesigns] : [];

    if (!isForcedRegeneration && loadGameState()) {
      // Game state loaded successfully from localStorage
      console.log("Loaded existing game state.");
      // Ensure universe circle dimensions are set from loaded data
      if (universeCircle && window.gameSessionData.universe.diameter) {
        universeCircle.style.width = `${window.gameSessionData.universe.diameter}px`;
        universeCircle.style.height = `${window.gameSessionData.universe.diameter}px`;
        universeCircle.style.backgroundColor = FIXED_COLORS.universeBg;
      } else if (universeCircle) {
        // Fallback if diameter was missing in save (shouldn't happen if save is valid)
        generateUniverseLayout(); 
      }
      setActiveScreen(mainScreen); // Start on main screen
      renderMainScreen(); // Render galaxies based on loaded state
      preGenerateAllGalaxyContents(); // Ensure all galaxy sub-content (solar systems, lines) is generated
                                      // This also saves the game state after generation.
    } else {
      // No valid game state found, or regeneration is forced
      if (isForcedRegeneration) console.log("Forcing new universe generation.");
      else console.log("No valid saved game found. Generating new universe.");

      // Ensure custom designs persist through a forced regeneration or if loadGameState failed but designs were in memory
      window.gameSessionData.customPlanetDesigns = designsBeforeLoad; 
      
      generateUniverseLayout(); // Calculate universe size
      generateGalaxies();       // Place galaxies
      setActiveScreen(mainScreen);
      renderMainScreen();       // Draw the new galaxies
      preGenerateAllGalaxyContents(); // Generate solar systems for all new galaxies and save.
    }
    window.gameSessionData.isInitialized = true;
    console.log("Game initialization complete.");
  }

  // --- WINDOW RESIZE HANDLING ---
  window.addEventListener('resize', () => {
    console.log("Window resize detected.");
    // The original resize logic re-initialized almost everything from scratch.
    // This can be disruptive if, e.g., the user is deep in a solar system.
    // A less disruptive approach might be to:
    // 1. Recalculate universe diameter based on new screen size.
    // 2. Re-scale existing galaxy positions proportionally if the universe circle changes size.
    // 3. Re-render the current view, adjusting viewport sizes and re-clamping pan/zoom.

    // For simplicity and to match original intent of full regeneration on resize:
    // Let's keep the full regeneration but ensure custom designs are preserved.
    
    const activeScreenElement = document.querySelector('.screen.active');
    const currentScreenIdBeforeResize = activeScreenElement ? activeScreenElement.id : null;
    const activeGalaxyIdBeforeResize = window.gameSessionData.activeGalaxyId;
    const activeSolarSystemIdBeforeResize = window.gameSessionData.activeSolarSystemId;
    
    // Preserve custom planet designs
    const existingCustomPlanetDesigns = [...(window.gameSessionData.customPlanetDesigns || [])];

    console.log("Regenerating universe due to resize...");
    // Reset core game data structures in memory
    window.gameSessionData.universe = { diameter: null };
    window.gameSessionData.galaxies = [];
    window.gameSessionData.activeGalaxyId = null;
    window.gameSessionData.activeSolarSystemId = null;
    window.gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };
    window.gameSessionData.isInitialized = false;
    window.gameSessionData.panning = { isActive: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0, targetElement: null, viewportElement: null, dataObject: null };
    window.gameSessionData.customPlanetDesigns = existingCustomPlanetDesigns; // Restore

    // Clear UI
    if (universeCircle) universeCircle.innerHTML = '';
    if (galaxyZoomContent) { 
      const linesCanvas = galaxyZoomContent.querySelector('#solar-system-lines-canvas');
      galaxyZoomContent.innerHTML = ''; 
      if (linesCanvas) galaxyZoomContent.appendChild(linesCanvas);
    }
    if (solarSystemContent) solarSystemContent.innerHTML = '';
    if (orbitCtx && solarSystemOrbitCanvasEl) {
      orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);
    }
    
    stopSolarSystemAnimation();
    initializeGame(true); // True for forced regeneration, will keep designs from above

    // Attempt to restore view (best effort, IDs might not match if numGalaxies changes etc.)
    console.log("Resize: Attempting to restore view to:", currentScreenIdBeforeResize);
    try {
      if (currentScreenIdBeforeResize === 'planet-designer-screen' && window.PlanetDesigner) {
        switchToPlanetDesignerScreen();
      } else if (currentScreenIdBeforeResize === 'galaxy-detail-screen' && activeGalaxyIdBeforeResize) {
        const galaxyExists = window.gameSessionData.galaxies.find(g => g.id === activeGalaxyIdBeforeResize);
        if (galaxyExists) switchToGalaxyDetailView(activeGalaxyIdBeforeResize);
        else switchToMainView();
      } else if (currentScreenIdBeforeResize === 'solar-system-screen' && activeSolarSystemIdBeforeResize) {
        const galaxyIdMatch = activeSolarSystemIdBeforeResize.match(/^(galaxy-\d+)-ss-\d+$/);
        const parentGalaxyId = galaxyIdMatch ? galaxyIdMatch[1] : null;
        const parentGalaxyExists = parentGalaxyId ? window.gameSessionData.galaxies.find(g => g.id === parentGalaxyId) : null;
        if (parentGalaxyExists && parentGalaxyExists.solarSystems.find(s => s.id === activeSolarSystemIdBeforeResize)) {
          switchToSolarSystemView(activeSolarSystemIdBeforeResize);
        } else {
          switchToMainView(); // Parent galaxy or SS might not exist with same ID after regen
        }
      } else {
        // Default to main screen if previous screen cannot be restored
        if (mainScreen && !mainScreen.classList.contains('active')) { // Check if not already set by some other flow
            switchToMainView();
        } else if (!mainScreen.classList.contains('active')) { // Fallback if mainScreen element itself is an issue
             setActiveScreen(document.getElementById('main-screen'));
             renderMainScreen();
        }
      }
    } catch (viewRestoreError) {
        console.error("Error restoring view after resize:", viewRestoreError);
        switchToMainView(); // Safe fallback
    }


    // If Planet Visual Panel was visible, try to re-render it
    // (currentPlanetDisplayedInPanel is now internal to manager)
    if (window.PlanetVisualPanelManager && window.PlanetVisualPanelManager.isVisible()) {
        const currentPanelPlanetData = window.PlanetVisualPanelManager.getCurrentPlanetData();
        if (currentPanelPlanetData) {
            console.log("Resize: Re-rendering visible planet visual panel.");
            // The panel manager's rerenderIfNeeded or a direct _render call might be better suited if its canvas also needs resize.
            // window.PlanetVisualPanelManager.show(currentPanelPlanetData); // This would reset rotation
            window.PlanetVisualPanelManager.rerenderIfNeeded(); // This also handles canvas resize
        }
    }
    console.log("Window resize processing finished.");
  });

  // --- OTHER EVENT LISTENERS (Navigation, Zoom) ---
  if (backToMainButton) backToMainButton.addEventListener('click', switchToMainView);
  if (backToGalaxyButton) {
    backToGalaxyButton.addEventListener('click', () => {
      if (window.gameSessionData.activeSolarSystemId) {
        // Determine parent galaxy of current solar system
        const galaxyIdMatch = window.gameSessionData.activeSolarSystemId.match(/^(galaxy-\d+)-ss-\d+$/);
        const parentGalaxyId = galaxyIdMatch ? galaxyIdMatch[1] : null;
        if (parentGalaxyId) {
          switchToGalaxyDetailView(parentGalaxyId);
        } else {
          console.warn("Could not determine parent galaxy from activeSolarSystemId. Defaulting to main view.");
          switchToMainView(); // Fallback if parent galaxy ID can't be parsed
        }
      } else if (window.gameSessionData.activeGalaxyId) {
        // This case should ideally not happen if backToGalaxyButton is only on solar system screen
        // But as a fallback, go to current active galaxy if any (e.g. if button was on galaxy screen itself)
        switchToGalaxyDetailView(window.gameSessionData.activeGalaxyId);
      } else {
        switchToMainView(); // Ultimate fallback
      }
    });
  }

  if (zoomInButton) zoomInButton.addEventListener('click', (e) => handleZoom('in', e));
  if (zoomOutButton) zoomOutButton.addEventListener('click', (e) => handleZoom('out', e));
  
  // Wheel zoom listeners
  if (galaxyDetailScreen) { // Attach to screen, not viewport, to catch events even if mouse is not over viewport center
    galaxyDetailScreen.addEventListener('wheel', (e) => { 
      if (galaxyDetailScreen.classList.contains('active')) { 
        e.preventDefault(); // Prevent page scroll
        handleZoom(e.deltaY < 0 ? 'in' : 'out', e); 
      } 
    }, { passive: false }); // passive: false because we call preventDefault
  }
  if (solarSystemScreen) {
    solarSystemScreen.addEventListener('wheel', (e) => { 
      if (solarSystemScreen.classList.contains('active')) { 
        e.preventDefault(); // Prevent page scroll
        handleZoom(e.deltaY < 0 ? 'in' : 'out', e); 
      } 
    }, { passive: false }); // passive: false because we call preventDefault
  }
  
  // Consolidated Pan Start Listeners (mousedown on the view background)
  if (galaxyViewport) { // Panning starts on the viewport itself for galaxy view
    galaxyViewport.addEventListener('mousedown', (e) => { 
      if (galaxyDetailScreen.classList.contains('active')) { 
        const gal = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
        if(gal) startPan(e, galaxyViewport, galaxyZoomContent, gal); 
      }
    });
  }
  if (solarSystemScreen) { // Panning starts on the whole screen for solar system view
    solarSystemScreen.addEventListener('mousedown', (e) => { 
      if (solarSystemScreen.classList.contains('active')) { 
        startPan(e, solarSystemScreen, solarSystemContent, window.gameSessionData.solarSystemView); 
      } 
    });
  }

  // --- INITIALIZE MODULES and GAME ---
  console.log("script.js: DOMContentLoaded. Initializing auxiliary modules.");
  if (typeof quat_identity !== 'function') { // Check if mathUtils.js loaded (it defines global functions)
    console.error("Math utilities (quat_identity) not found. Ensure mathUtils.js is loaded before script.js.");
    // Potentially halt further initialization or show an error to the user.
  }

  if (window.PlanetDesigner && typeof window.PlanetDesigner.init === 'function') {
    window.PlanetDesigner.init();
    console.log("script.js: PlanetDesigner.init() called.");
  } else {
    console.error("script.js: PlanetDesigner module not found or init function is missing.");
  }

  if (window.PlanetVisualPanelManager && typeof window.PlanetVisualPanelManager.init === 'function') {
    window.PlanetVisualPanelManager.init();
    console.log("script.js: PlanetVisualPanelManager.init() called.");
  } else {
    console.error("script.js: PlanetVisualPanelManager module not found or its init function is missing.");
  }
  
  initializeGame(); // Start the game logic
});
