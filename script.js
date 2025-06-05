document.addEventListener('DOMContentLoaded', () => {
  // Define constants FIRST, so functions defined below can access them
  // These constants might be accessed by planetDesigner.js via the window object
  window.DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
  window.DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
  window.DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;
  const DEFAULT_NUM_GALAXIES = 3;
  const DEFAULT_MIN_SS_COUNT_CONST = 200;
  const DEFAULT_MAX_SS_COUNT_CONST = 300;
  const DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER = 1.0;
  const DEFAULT_MIN_PLANETS_PER_SYSTEM = 0;
  const DEFAULT_MAX_PLANETS_PER_SYSTEM = 3;
  const DEFAULT_SHOW_PLANET_ORBITS = false;
  const DEFAULT_PLANET_AXIAL_SPEED = 0.01;
  const BASE_MAX_PLANET_DISTANCE_FACTOR = 25;
  window.PLANET_ROTATION_SENSITIVITY = 0.75; // Accessed by PlanetDesigner

  // Get DOM elements (some are used by PlanetDesigner, ensure they are found)
  const mainScreen = document.getElementById('main-screen');
  // Designer specific DOM elements are now primarily handled within planetDesigner.js
  const galaxyDetailScreen = document.getElementById('galaxy-detail-screen');
  const solarSystemScreen = document.getElementById('solar-system-screen');
  const universeCircle = document.getElementById('universe-circle');
  const galaxyViewport = document.getElementById('galaxy-viewport');
  const galaxyZoomContent = document.getElementById('galaxy-zoom-content');
  const solarSystemLinesCanvasEl = document.getElementById('solar-system-lines-canvas');
  const solarSystemContent = document.getElementById('solar-system-content');
  const planetDesignerScreen = document.getElementById('planet-designer-screen'); // Used by setActiveScreen
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
  const customizeGenerationButton = document.getElementById('customize-generation-btn');
  const createPlanetDesignButton = document.getElementById('create-planet-design-btn');
  const customizationModal = document.getElementById('customization-modal');
  const applyCustomizationButton = document.getElementById('apply-customization-btn');
  const cancelCustomizationButton = document.getElementById('cancel-customization-btn');
  const numGalaxiesInput = document.getElementById('num-galaxies-input');
  const minSSInput = document.getElementById('min-ss-input');
  const maxSSInput = document.getElementById('max-ss-input');
  const ssSpreadInput = document.getElementById('ss-spread-input');
  const minPlanetsInput = document.getElementById('min-planets-input');
  const maxPlanetsInput = document.getElementById('max-planets-input');
  const showOrbitsInput = document.getElementById('show-orbits-input');
  const planetVisualPanel = document.getElementById('planet-visual-panel');
  const closePlanetVisualPanelBtn = document.getElementById('close-planet-visual-panel');
  const planetVisualPanelHeader = document.getElementById('planet-visual-panel-header');
  const planetVisualTitle = document.getElementById('planet-visual-title');
  const planetVisualSize = document.getElementById('planet-visual-size');
  const planetVisualCanvas = document.getElementById('planet-visual-canvas'); // For main planet viewing

  // --- FUNCTION DEFINITIONS ---

  // This function needs to be accessible by .js
  window.generatePlanetInstanceFromBasis = function(basis, isForDesignerPreview = false) {
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
      waterColor: basis.waterColor || '#0000FF',
      landColor: basis.landColor || '#008000',
      continentSeed: isForDesignerPreview ? (basis.continentSeed || Math.random()) : Math.random(),
      minTerrainHeight: getValueFromRange(basis.minTerrainHeightRange, window.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0),
      maxTerrainHeight: getValueFromRange(basis.maxTerrainHeightRange, window.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0),
      oceanHeightLevel: getValueFromRange(basis.oceanHeightRange, window.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0)
    };
  }

  // --- STATE VARIABLES (Global to script.js) ---
  let linesCtx;
  let solarSystemOrbitCanvasEl;
  let orbitCtx;
  let animationFrameId = null;
  let lastAnimationTime = null;
  let isDraggingPlanetVisual = false; // For the pop-up visual panel
  let isRenderingVisualPlanet = false; // For the pop-up visual panel
  let needsPlanetVisualRerender = false;

  let planetVisualRotationQuat = quat_identity(); // For the pop-up visual panel
  let startDragPlanetVisualQuat = quat_identity(); // For the pop-up visual panel
  let startDragMouseX = 0; // For the pop-up visual panel
  let startDragMouseY = 0; // For the pop-up visual panel
  let currentPlanetDisplayedInPanel = null;

  let currentNumGalaxies = DEFAULT_NUM_GALAXIES;
  let currentMinSSCount = DEFAULT_MIN_SS_COUNT_CONST;
  let currentMaxSSCount = DEFAULT_MAX_SS_COUNT_CONST;
  let currentMaxPlanetDistanceMultiplier = DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
  let currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM;
  let currentMaxPlanets = DEFAULT_MAX_PLANETS_PER_SYSTEM;
  let currentShowPlanetOrbits = DEFAULT_SHOW_PLANET_ORBITS;
  const GALAXY_ICON_SIZE = 60;
  const SOLAR_SYSTEM_BASE_ICON_SIZE = 2.5;
  const SUN_ICON_SIZE = 60;
  const MAX_PLACEMENT_ATTEMPTS = 150;
  const GALAXY_VIEW_MIN_ZOOM = 1.0;
  const GALAXY_VIEW_MAX_ZOOM = 5.0;
  const SOLAR_SYSTEM_VIEW_MIN_ZOOM = 0.05;
  const SOLAR_SYSTEM_VIEW_MAX_ZOOM = 10.0;
  const ZOOM_STEP = 0.2;
  const MAX_CONNECTIONS_PER_SYSTEM = 3;
  const MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS = 5;
  const MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT = 0.07;
  const MAX_FORCED_CONNECTION_DISTANCE_PERCENT = 0.20;
  const MIN_PLANET_SIZE = 5;
  const MAX_PLANET_SIZE = 15;
  let MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0;
  let MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
  let ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
  let SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2;
  const MIN_ORBITAL_SEPARATION = 20;
  let MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.005;
  let MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.01;
  const FIXED_COLORS = { universeBg: "#100520", galaxyIconFill: "#7f00ff", galaxyIconBorder: "#da70d6", solarSystemBaseColor: "#ffd700", sunFill: "#FFD700", sunBorder: "#FFA500", connectionLine: "rgba(255, 255, 255, 0.3)" };

  // gameSessionData needs to be globally accessible by .js
  window.gameSessionData = {
    universe: { diameter: null },
    galaxies: [],
    activeGalaxyId: null,
    activeSolarSystemId: null,
    solarSystemView: { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null },
    isInitialized: false,
    panning: { isActive: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0, targetElement: null, viewportElement: null, dataObject: null },
    customPlanetDesigns: [] // This will be managed by .js but stored here
  };

  // --- WEB WORKER SETUP ---
  let planetVisualWorker = null;
  window.designerWorker = null; // Make designerWorker globally accessible for .js

  if (window.Worker) {
    try {
      planetVisualWorker = new Worker('planetRendererWorker.js');
      window.designerWorker = new Worker('planetRendererWorker.js'); // Assign to global

      planetVisualWorker.onmessage = function(e) {
        const { renderedData, width, height, senderId } = e.data;
        if (senderId === 'planet-visual-canvas' && planetVisualCanvas) {
          const ctx = planetVisualCanvas.getContext('2d');
          if (!ctx) {
            console.error("Failed to get 2D context from planetVisualCanvas");
            isRenderingVisualPlanet = false;
            return;
          }
          ctx.clearRect(0, 0, planetVisualCanvas.width, planetVisualCanvas.height);
          if (renderedData && width && height) {
            try {
              const clampedArray = new Uint8ClampedArray(renderedData);
              const imageDataObj = new ImageData(clampedArray, width, height);
              ctx.putImageData(imageDataObj, 0, 0);
              planetVisualCanvas.style.transform = "";
            } catch (err) {
              console.error("Error putting ImageData on planetVisualCanvas:", err);
            }
          }
        }
        isRenderingVisualPlanet = false;
        if (needsPlanetVisualRerender && currentPlanetDisplayedInPanel && planetVisualPanel.classList.contains('visible')) {
          needsPlanetVisualRerender = false;
          renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas);
        }
      };
      planetVisualWorker.onerror = function(error) {
        console.error("Error in planetVisualWorker:", error.message, error.filename, error.lineno);
      };

// In script.js
if (window.designerWorker) {
    window.designerWorker.onmessage = function(e) {
        const { renderedData, width, height, senderId } = e.data;
        console.log(`script.js: designerWorker.onmessage received - senderId: ${senderId}`); // ADD THIS LOG

// In script.js, inside window.designerWorker.onmessage
if (senderId === 'designer-planet-canvas') {
  if (window.PlanetDesigner && typeof window.PlanetDesigner.handleDesignerWorkerMessage === 'function') {
    console.log("script.js: Forwarding message to PlanetDesigner.handleDesignerWorkerMessage");
    window.PlanetDesigner.handleDesignerWorkerMessage({ renderedData, width, height });
  } else {
    console.error("script.js: PlanetDesigner module or handleDesignerWorkerMessage not found in worker callback.");
  }
}
    };
    window.designerWorker.onerror = function(error) { // Ensure this is also present
        console.error("Error in designerWorker (from script.js):", error.message, error.filename, error.lineno);
    };
} else {
    console.error("script.js: window.designerWorker is not initialized!"); // ADD THIS LOG
}

    } catch (err) {
      console.error("Failed to create Web Workers. Make sure planetRendererWorker.js exists and is accessible.", err);
      planetVisualWorker = null;
      window.designerWorker = null;
    }
  } else {
    console.warn("Web Workers not supported in this browser. Planet rendering will be limited or disabled.");
  }


  // This function needs to be globally accessible for planetDesigner.js
  // targetCanvas defaults to planetVisualCanvas (for the pop-up)
  // but planetDesigner.js will pass its own_resizeDesignerCanvasToDisplaySize canvas.
  window.renderPlanetVisual = function(planetData, rotationQuaternion, targetCanvas = planetVisualCanvas) {
      const workerToUse = targetCanvas === planetVisualCanvas ? planetVisualWorker : window.designerWorker;

      // Internal flag for this specific function instance, not the global module flags
      let isCurrentlyRenderingThisInstance = false;
      if (targetCanvas === planetVisualCanvas) {
          if (isRenderingVisualPlanet) return; // Already rendering for this specific canvas
          isRenderingVisualPlanet = true;
          isCurrentlyRenderingThisInstance = true;
      } else if (targetCanvas && targetCanvas.id === 'designer-planet-canvas') {
          // The isRenderingDesignerPlanet flag is now internal to PlanetDesigner module.
          // PlanetDesigner module itself should prevent multiple calls if it's busy.
          // Here we just proceed if worker is available.
      }


      if (!planetData || !targetCanvas || !workerToUse) {
          console.warn("renderPlanetVisual: Missing data, canvas, or appropriate worker.", { planetData, targetCanvasId: targetCanvas?.id, workerExists: !!workerToUse });
          if (isCurrentlyRenderingThisInstance && targetCanvas === planetVisualCanvas) isRenderingVisualPlanet = false;
          // If called from PlanetDesigner, it manages its own rendering flag.
          return;
      }

      if (targetCanvas.width === 0 || targetCanvas.height === 0) {
          console.warn(`renderPlanetVisual: Target canvas ${targetCanvas.id} has zero dimensions. Aborting worker call.`);
          if (isCurrentlyRenderingThisInstance && targetCanvas === planetVisualCanvas) isRenderingVisualPlanet = false;
          // For designer canvas, PlanetDesigner's activate/resize should handle this.
          // For visual panel, a resize might be needed or it's an error.
          requestAnimationFrame(() => {
              if (targetCanvas.id === 'designer-planet-canvas' && window.PlanetDesigner) {
                  // PlanetDesigner.activate() or a specific resize function within it should be called
              } else if (targetCanvas.id === 'planet-visual-canvas') {
                  // Attempt to re-render if it becomes available
                  if (targetCanvas.width > 0 && targetCanvas.height > 0 && currentPlanetDisplayedInPanel) {
                     window.renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas);
                  }
              }
          });
          return;
      }

      const pD = { ...planetData };
      if (!pD.continentSeed && pD.continentSeed !== 0) pD.continentSeed = Math.random();
      if (!pD.waterColor) pD.waterColor = '#000080';
      if (!pD.landColor) pD.landColor = '#006400';
      pD.minTerrainHeight = pD.minTerrainHeight ?? window.DEFAULT_MIN_TERRAIN_HEIGHT;
      pD.maxTerrainHeight = pD.maxTerrainHeight ?? window.DEFAULT_MAX_TERRAIN_HEIGHT;
      pD.oceanHeightLevel = pD.oceanHeightLevel ?? window.DEFAULT_OCEAN_HEIGHT_LEVEL;

      const dataToSend = {
          waterColor: pD.waterColor, landColor: pD.landColor, continentSeed: pD.continentSeed,
          minTerrainHeight: pD.minTerrainHeight, maxTerrainHeight: pD.maxTerrainHeight, oceanHeightLevel: pD.oceanHeightLevel,
      };
      const canvasId = targetCanvas.id;

      workerToUse.postMessage({
          cmd: 'renderPlanet', planetData: dataToSend, rotationQuaternion,
          canvasWidth: targetCanvas.width, canvasHeight: targetCanvas.height, senderId: canvasId,
          planetRadiusOverride: (targetCanvas.id === 'designer-planet-canvas') ? Math.min(targetCanvas.width, targetCanvas.height) / 2 * 0.9 : undefined
      });
  }


  function switchToPlanetDesignerScreen() {
      setActiveScreen(planetDesignerScreen); // setActiveScreen function is still in script.js
      if (window.PlanetDesigner && typeof window.PlanetDesigner.activate === 'function') {
          window.PlanetDesigner.activate();
      } else {
          console.error("PlanetDesigner module or activate function not found.");
      }
  }

  // Helper functions for game state and customization (to be accessible by PlanetDesigner)
  function updateDerivedConstants() {
    MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier;
    MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0 * (currentMaxPlanetDistanceMultiplier > 0.5 ? currentMaxPlanetDistanceMultiplier * 0.8 : 0.5);
    ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
    SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2;
  }

  //Needs to be global for planetDesigner.js to call
  window.saveGameState = function() {
    try {
      const sTS = {
        universeDiameter: window.gameSessionData.universe.diameter,
        galaxies: window.gameSessionData.galaxies,
        customPlanetDesigns: window.gameSessionData.customPlanetDesigns
      };
      localStorage.setItem('galaxyGameSaveData', JSON.stringify(sTS));
    } catch (e) {
      console.error("Error saving game state:", e);
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
          window.gameSessionData.galaxies.forEach(gal => {
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
            gal.layoutGenerated = gal.layoutGenerated || false;
          });
          // Custom planet designs are loaded from local storage if they exist.
          // The Planet Designer module will be responsible for populating its UI from this data.
          window.gameSessionData.customPlanetDesigns = (loadedState.customPlanetDesigns || []).map(design => {
            const migratedDesign = { ...design };
            if (migratedDesign.continentSeed === undefined) migratedDesign.continentSeed = Math.random();
            const ensureRange = (value, oldSingleProp, defaultVal, spread) => {
              if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') return [...value];
              const base = typeof oldSingleProp === 'number' ? oldSingleProp : (typeof defaultVal === 'number' ? defaultVal : 0);
              return [base, base + (typeof spread === 'number' ? spread : 1.0)];
            };
            migratedDesign.minTerrainHeightRange = ensureRange(migratedDesign.minTerrainHeightRange, migratedDesign.minTerrainHeight, window.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0);
            migratedDesign.maxTerrainHeightRange = ensureRange(migratedDesign.maxTerrainHeightRange, migratedDesign.maxTerrainHeight, window.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0);
            migratedDesign.oceanHeightRange = ensureRange(migratedDesign.oceanHeightRange, migratedDesign.oceanHeightLevel, window.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0);
            delete migratedDesign.minTerrainHeight; delete migratedDesign.maxTerrainHeight; delete migratedDesign.oceanHeightLevel;
            return migratedDesign;
          });
          return true;
        }
      }
    } catch (error) { console.error("Error loading game state:", error); localStorage.removeItem('galaxyGameSaveData'); }
    return false;
  }


  function saveCustomizationSettings() {
    const s = {
      numGalaxies: currentNumGalaxies,
      minSS: currentMinSSCount,
      maxSS: currentMaxSSCount,
      spread: currentMaxPlanetDistanceMultiplier,
      minPlanets: currentMinPlanets,
      maxPlanets: currentMaxPlanets,
      showOrbits: currentShowPlanetOrbits
    };
    localStorage.setItem('galaxyCustomizationSettings', JSON.stringify(s));
  }

  function loadCustomizationSettings() {
    const sS = localStorage.getItem('galaxyCustomizationSettings');
    if (sS) {
      try {
        const lS = JSON.parse(sS);
        currentNumGalaxies = parseInt(lS.numGalaxies, 10) || DEFAULT_NUM_GALAXIES;
        currentMinSSCount = parseInt(lS.minSS, 10) || DEFAULT_MIN_SS_COUNT_CONST;
        currentMaxSSCount = parseInt(lS.maxSS, 10) || DEFAULT_MAX_SS_COUNT_CONST;
        currentMaxPlanetDistanceMultiplier = parseFloat(lS.spread) || DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
        currentMinPlanets = parseInt(lS.minPlanets, 10);
        if (isNaN(currentMinPlanets)) currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM;
        currentMaxPlanets = parseInt(lS.maxPlanets, 10);
        if (isNaN(currentMaxPlanets)) currentMaxPlanets = DEFAULT_MAX_PLANETS_PER_SYSTEM;
        currentShowPlanetOrbits = typeof lS.showOrbits === 'boolean' ? lS.showOrbits : DEFAULT_SHOW_PLANET_ORBITS;
      } catch (e) {
        console.error("Error loading customization settings:", e);
        resetToDefaultCustomization();
      }
    } else {
      resetToDefaultCustomization();
    }
    updateDerivedConstants();
  }

  function resetToDefaultCustomization() {
    currentNumGalaxies = DEFAULT_NUM_GALAXIES;
    currentMinSSCount = DEFAULT_MIN_SS_COUNT_CONST;
    currentMaxSSCount = DEFAULT_MAX_SS_COUNT_CONST;
    currentMaxPlanetDistanceMultiplier = DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
    currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM;
    currentMaxPlanets = DEFAULT_MAX_PLANETS_PER_SYSTEM;
    currentShowPlanetOrbits = DEFAULT_SHOW_PLANET_ORBITS;
  }

  function checkOverlap(r1, r2) { return !(r1.x + r1.width < r2.x || r2.x + r2.width < r1.x || r1.y + r1.height < r2.y || r2.y + r2.height < r1.y) }
  function getNonOverlappingPositionInCircle(circleRadius, objectDiameter, existingRects) {
    let placementRadius = circleRadius - (objectDiameter / 2) - 5;
    if (placementRadius < 0) placementRadius = 0;
    for (let i = 0; i < MAX_PLACEMENT_ATTEMPTS; i++) {
      const angle = Math.random() * 2 * Math.PI;
      const r = Math.sqrt(Math.random()) * placementRadius;
      const cx = circleRadius + r * Math.cos(angle);
      const cy = circleRadius + r * Math.sin(angle);
      const x = cx - (objectDiameter / 2);
      const y = cy - (objectDiameter / 2);
      const newRect = { x, y, width: objectDiameter, height: objectDiameter };
      if (!existingRects.some(er => checkOverlap(newRect, er))) return { x, y };
    }
    return null;
  }
  function getWeightedNumberOfConnections() { const rand = Math.random(); return rand < .6 ? 1 : rand < .9 ? 2 : 3; }
  function adjustColor(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16),
      g = parseInt(hex.slice(3, 5), 16),
      b = parseInt(hex.slice(5, 7), 16);
    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  // setActiveScreen needs to be globally accessible for planetDesigner.js
  window.setActiveScreen = function(screenToShow) {
    [mainScreen, galaxyDetailScreen, solarSystemScreen, planetDesignerScreen, customizationModal].forEach(s => { // Include customizationModal here
      if (s) s.classList.remove('active', 'panning-active');
    });
    if (screenToShow) { screenToShow.classList.add('active'); }

    if (zoomControlsElement) {
      if (screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen)
        zoomControlsElement.classList.add('visible');
      else
        zoomControlsElement.classList.remove('visible');
    }

    const isOnOverlayScreen = screenToShow === planetDesignerScreen || (customizationModal && customizationModal.classList.contains('visible'));
    if (regenerateUniverseButton) regenerateUniverseButton.style.display = isOnOverlayScreen ? 'none' : 'block';
    if (customizeGenerationButton) customizeGenerationButton.style.display = isOnOverlayScreen ? 'none' : 'block';
    if (createPlanetDesignButton) createPlanetDesignButton.style.display = isOnOverlayScreen ? 'none' : 'block';

    if (screenToShow !== solarSystemScreen && planetVisualPanel) {
      planetVisualPanel.classList.remove('visible');
    }
  }
  // Expose mainScreen to global scope if PlanetDesigner needs it for cancel button
  window.mainScreen = mainScreen;


  function generateUniverseLayout() {
    const s = Math.min(window.innerWidth, window.innerHeight);
    window.gameSessionData.universe.diameter = Math.max(300, s * 0.85);
    if (universeCircle) {
      universeCircle.style.width = `${window.gameSessionData.universe.diameter}px`;
      universeCircle.style.height = `${window.gameSessionData.universe.diameter}px`;
      universeCircle.style.backgroundColor = FIXED_COLORS.universeBg;
    }
  }

  function generateGalaxies() {
    if (!window.gameSessionData.universe.diameter) return;
    window.gameSessionData.galaxies = [];
    const centerRadius = window.gameSessionData.universe.diameter / 2;
    const existingRects = [];
    for (let i = 0; i < currentNumGalaxies; i++) {
      const id = `galaxy-${i + 1}`;
      const pos = getNonOverlappingPositionInCircle(centerRadius, GALAXY_ICON_SIZE, existingRects);
      if (pos && !isNaN(pos.x) && !isNaN(pos.y)) {
        window.gameSessionData.galaxies.push({
          id, x: pos.x, y: pos.y, customName: null, solarSystems: [], lineConnections: [],
          layoutGenerated: false, currentZoom: 1.0, currentPanX: 0, currentPanY: 0,
          generationParams: { densityFactor: 0.8 + Math.random() * 0.4 }
        });
        existingRects.push({ x: pos.x, y: pos.y, width: GALAXY_ICON_SIZE, height: GALAXY_ICON_SIZE });
      }
    }
  }

  function getDistance(s1, s2) { return Math.sqrt(Math.pow(s1.centerX - s2.centerX, 2) + Math.pow(s1.centerY - s2.centerY, 2)); }
  function tryAddConnection(fromId, toId, currentConnectionsArray, connectionCountObj, allSolarSystemsList, maxDistanceLimit) {
    if (!fromId || !toId || fromId === toId || fromId === null || toId === null) return false;
    if ((connectionCountObj[fromId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM || (connectionCountObj[toId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM) return false;
    const sortedKey = [fromId, toId].sort().join('-');
    if (currentConnectionsArray.some(c => ([c.fromId, c.toId].sort().join('-') === sortedKey))) return false;
    if (maxDistanceLimit !== undefined && maxDistanceLimit !== null) {
      const s1 = allSolarSystemsList.find(s => s.id === fromId);
      const s2 = allSolarSystemsList.find(s => s.id === toId);
      if (s1 && s2 && getDistance(s1, s2) > maxDistanceLimit) return false;
    }
    return true;
  }

  function generateSolarSystemsForGalaxy(galaxyId) {
    const g = window.gameSessionData.galaxies.find(gl => gl.id === galaxyId);
    if (!g || !galaxyViewport) return;
    if (g.layoutGenerated && !window.gameSessionData.isForceRegenerating) return;

    const viewportDim = galaxyViewport.offsetWidth > 0 ? galaxyViewport.offsetWidth : (window.gameSessionData.universe.diameter || 500);
    const viewportRadius = viewportDim / 2;

    if (viewportDim <= 0 || isNaN(viewportRadius) || viewportRadius <= 0) {
      g.layoutGenerated = true;
      if (!window.gameSessionData.isForceRegenerating) window.saveGameState();
      return;
    }

    g.solarSystems = [];
    g.lineConnections = [];
    const tmpPlacementRects = [];
    const numSystemsToAttempt = Math.floor(Math.random() * (currentMaxSSCount - currentMinSSCount + 1)) + currentMinSSCount;

    for (let i = 0; i < numSystemsToAttempt; i++) {
      const sId = `${g.id}-ss-${i + 1}`;
      const pos = getNonOverlappingPositionInCircle(viewportRadius, SOLAR_SYSTEM_BASE_ICON_SIZE, tmpPlacementRects);
      if (pos && !isNaN(pos.x) && !isNaN(pos.y)) {
        const sunSizeFactor = 0.5 + Math.random() * 9.5;
        g.solarSystems.push({ id: sId, customName: null, x: pos.x, y: pos.y, iconSize: SOLAR_SYSTEM_BASE_ICON_SIZE, sunSizeFactor: sunSizeFactor });
        tmpPlacementRects.push({ x: pos.x, y: pos.y, width: SOLAR_SYSTEM_BASE_ICON_SIZE, height: SOLAR_SYSTEM_BASE_ICON_SIZE });
      }
    }

    if (g.solarSystems.length < 2) {
      g.layoutGenerated = true;
      if (!window.gameSessionData.isForceRegenerating) window.saveGameState();
      return;
    }

    const allSystemsCalc = g.solarSystems.map(ss => ({ ...ss, centerX: ss.x + ss.iconSize / 2, centerY: ss.y + ss.iconSize / 2 }));
    const systemConnectionCounts = {};
    const galaxyContentDiameter = viewportDim;
    const allowedMaxEuclideanConnectionDistance = galaxyContentDiameter * MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT;
    const allowedMaxForcedConnectionDistance = galaxyContentDiameter * MAX_FORCED_CONNECTION_DISTANCE_PERCENT;
    let connectedSystems = new Set();
    let unconnectedSystems = new Set(allSystemsCalc.map(s => s.id));

    if (allSystemsCalc.length > 0) {
      const firstSystemId = allSystemsCalc[0].id;
      connectedSystems.add(firstSystemId);
      unconnectedSystems.delete(firstSystemId);
      while (unconnectedSystems.size > 0) {
        let bestConnection = null; let minConnectionDist = Infinity;
        for (const unconnectedId of unconnectedSystems) {
          const currentUnconnected = allSystemsCalc.find(s => s.id === unconnectedId);
          for (const connectedId of connectedSystems) {
            const currentConnected = allSystemsCalc.find(s => s.id === connectedId);
            if(!currentConnected || !currentUnconnected) continue;
            const dist = getDistance(currentUnconnected, currentConnected);
            if (dist < minConnectionDist) { minConnectionDist = dist; bestConnection = { fromId: connectedId, toId: unconnectedId, dist: dist }; }
          }
        }
        if (bestConnection) {
          if (tryAddConnection(bestConnection.fromId, bestConnection.toId, g.lineConnections, systemConnectionCounts, allSystemsCalc, allowedMaxEuclideanConnectionDistance)) {
            g.lineConnections.push({ fromId: bestConnection.fromId, toId: bestConnection.toId });
            systemConnectionCounts[bestConnection.fromId] = (systemConnectionCounts[bestConnection.fromId] || 0) + 1;
            systemConnectionCounts[bestConnection.toId] = (systemConnectionCounts[bestConnection.toId] || 0) + 1;
            connectedSystems.add(bestConnection.toId); unconnectedSystems.delete(bestConnection.toId);
          } else {
            const targetUnconnectedId = bestConnection.toId;
            const targetUnconnected = allSystemsCalc.find(s => s.id === targetUnconnectedId);
            let forcedTargetId = null; let minForcedDist = Infinity;
            for (const connectedId of connectedSystems) {
              const connectedSystem = allSystemsCalc.find(s => s.id === connectedId);
               if(!connectedSystem || !targetUnconnected) continue;
              const dist = getDistance(targetUnconnected, connectedSystem);
              if (tryAddConnection(targetUnconnectedId, connectedId, g.lineConnections, systemConnectionCounts, allSystemsCalc, allowedMaxForcedConnectionDistance)) {
                if (dist < minForcedDist) { minForcedDist = dist; forcedTargetId = connectedId; }
              }
            }
            if (forcedTargetId) {
              g.lineConnections.push({ fromId: targetUnconnectedId, toId: forcedTargetId });
              systemConnectionCounts[targetUnconnectedId] = (systemConnectionCounts[targetUnconnectedId] || 0) + 1;
              systemConnectionCounts[forcedTargetId] = (systemConnectionCounts[forcedTargetId] || 0) + 1;
              connectedSystems.add(targetUnconnectedId); unconnectedSystems.delete(targetUnconnectedId);
            } else {
              let ultimateForceTargetId = null; let minUltimateDist = Infinity;
              for(const connectedId of connectedSystems) {
                const connectedSystem = allSystemsCalc.find(s => s.id === connectedId);
                const targetSystem = allSystemsCalc.find(s => s.id === targetUnconnectedId);
                if(!connectedSystem || !targetSystem ) continue;
                const dist = getDistance(targetSystem, connectedSystem);
                if (tryAddConnection(targetUnconnectedId, connectedId, g.lineConnections, systemConnectionCounts, allSystemsCalc, null)) {
                  if(dist < minUltimateDist) { minUltimateDist = dist; ultimateForceTargetId = connectedId; }
                }
              }
              if(ultimateForceTargetId) {
                g.lineConnections.push({ fromId: targetUnconnectedId, toId: ultimateForceTargetId });
                systemConnectionCounts[targetUnconnectedId] = (systemConnectionCounts[targetUnconnectedId] || 0) + 1;
                systemConnectionCounts[ultimateForceTargetId] = (systemConnectionCounts[ultimateForceTargetId] || 0) + 1;
                connectedSystems.add(targetUnconnectedId); unconnectedSystems.delete(targetUnconnectedId);
              } else {
                console.warn(`System ${targetUnconnectedId} could not be connected. Removing.`);
                unconnectedSystems.delete(targetUnconnectedId);
                g.solarSystems = g.solarSystems.filter(s => s.id !== targetUnconnectedId);
              }
            }
          }
        } else {
          if (unconnectedSystems.size > 0 && connectedSystems.size === 0 && allSystemsCalc.length > 0) {
            const nextUnconnectedId = Array.from(unconnectedSystems)[0];
            connectedSystems.add(nextUnconnectedId); unconnectedSystems.delete(nextUnconnectedId);
          } else break;
        }
      }
    }
    allSystemsCalc.forEach(ss1 => {
      const desiredCon = getWeightedNumberOfConnections(); let currentCon = systemConnectionCounts[ss1.id]||0;
      let conToAdd = Math.min(desiredCon, MAX_CONNECTIONS_PER_SYSTEM - currentCon); if(conToAdd <=0) return;
      let potTargets = allSystemsCalc.filter(ss2 => ss1.id !== ss2.id).map(ss2 => ({...ss2, dist:getDistance(ss1,ss2)})).sort((a,b)=>a.dist-b.dist);
      const cand = potTargets.filter(ss2 => ss2.dist <= allowedMaxEuclideanConnectionDistance).slice(0, MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS);
      for(const ss2 of cand){ if(conToAdd<=0)break; if(tryAddConnection(ss1.id,ss2.id,g.lineConnections,systemConnectionCounts,allSystemsCalc,allowedMaxEuclideanConnectionDistance)){
        g.lineConnections.push({fromId:ss1.id,toId:ss2.id}); systemConnectionCounts[ss1.id]=(systemConnectionCounts[ss1.id]||0)+1; systemConnectionCounts[ss2.id]=(systemConnectionCounts[ss2.id]||0)+1; conToAdd--;
      }}
    });
    g.layoutGenerated = true;
    if (!window.gameSessionData.isForceRegenerating) window.saveGameState();
  }

  async function preGenerateAllGalaxyContents() {
    window.gameSessionData.isForceRegenerating = true;
    for (const g of window.gameSessionData.galaxies) {
      if (!g.layoutGenerated || g.solarSystems.length === 0) {
        await new Promise(r => setTimeout(r, 0));
        generateSolarSystemsForGalaxy(g.id);
      }
    }
    window.gameSessionData.isForceRegenerating = false;
    window.saveGameState();
  }

  function renderMainScreen() {
    if (mainScreenTitleText) mainScreenTitleText.textContent = "Universe";
    if (!universeCircle) return;
    universeCircle.innerHTML = '';
    window.gameSessionData.galaxies.forEach(g => {
      const dId = g.id.split('-').pop();
      const el = document.createElement('div');
      el.className = 'galaxy-icon';
      el.style.width = `${GALAXY_ICON_SIZE}px`; el.style.height = `${GALAXY_ICON_SIZE}px`;
      el.style.left = `${g.x}px`; el.style.top = `${g.y}px`;
      el.style.backgroundColor = FIXED_COLORS.galaxyIconFill; el.style.border = `3px solid ${FIXED_COLORS.galaxyIconBorder}`;
      el.title = g.customName || `Galaxy ${dId}`; el.dataset.galaxyId = g.id;
      el.addEventListener('click', () => switchToGalaxyDetailView(g.id));
      universeCircle.appendChild(el);
    });
  }

  function drawGalaxyLines(galaxy) {
    if (!solarSystemLinesCanvasEl || !galaxyZoomContent) return;
    if (galaxyZoomContent.offsetWidth > 0 && solarSystemLinesCanvasEl.width !== galaxyZoomContent.offsetWidth) solarSystemLinesCanvasEl.width = galaxyZoomContent.offsetWidth;
    if (galaxyZoomContent.offsetHeight > 0 && solarSystemLinesCanvasEl.height !== galaxyZoomContent.offsetHeight) solarSystemLinesCanvasEl.height = galaxyZoomContent.offsetHeight;
    if (!linesCtx) linesCtx = solarSystemLinesCanvasEl.getContext('2d'); if (!linesCtx) return;
    linesCtx.clearRect(0, 0, solarSystemLinesCanvasEl.width, solarSystemLinesCanvasEl.height);
    if (!galaxy || !galaxy.lineConnections || !galaxy.solarSystems) return;
    linesCtx.strokeStyle = FIXED_COLORS.connectionLine; linesCtx.lineWidth = 0.5; linesCtx.setLineDash([]);
    const sysPos = {}; galaxy.solarSystems.forEach(ss => { sysPos[ss.id] = { x: ss.x + ss.iconSize / 2, y: ss.y + ss.iconSize / 2 }; });
    galaxy.lineConnections.forEach(c => {
      const from = sysPos[c.fromId]; const to = sysPos[c.toId];
      if (from && to) { linesCtx.beginPath(); linesCtx.moveTo(from.x, from.y); linesCtx.lineTo(to.x, to.y); linesCtx.stroke(); }
    });
  }

  function renderGalaxyDetailScreen(isInteractive = false) {
    const g = window.gameSessionData.galaxies.find(gl => gl.id === window.gameSessionData.activeGalaxyId);
    if (!g) { switchToMainView(); return; }
    if (!galaxyViewport || !galaxyZoomContent) return;
    galaxyViewport.style.width = `${window.gameSessionData.universe.diameter || 500}px`;
    galaxyViewport.style.height = `${window.gameSessionData.universe.diameter || 500}px`;
    const icons = galaxyZoomContent.querySelectorAll('.solar-system-icon'); icons.forEach(i => i.remove());
    const zoomSD = 0.6;
    g.solarSystems.forEach(ss => {
      const el = document.createElement('div'); el.className = 'solar-system-icon';
      let dIPx = ss.iconSize * (1+(g.currentZoom-GALAXY_VIEW_MIN_ZOOM)*zoomSD); if(g.currentZoom>0)dIPx/=g.currentZoom; dIPx=Math.max(2.5,dIPx);
      el.style.width = `${dIPx}px`; el.style.height = `${dIPx}px`;
      const cOff = dIPx/2, bCOff = ss.iconSize/2; el.style.left=`${ss.x+bCOff-cOff}px`; el.style.top=`${ss.y+bCOff-cOff}px`;
      el.dataset.solarSystemId = ss.id; if (ss.customName) el.title = ss.customName;
      el.addEventListener('click', e => { e.stopPropagation(); switchToSolarSystemView(ss.id); });
      galaxyZoomContent.appendChild(el);
    });
    if (solarSystemLinesCanvasEl.parentNode !== galaxyZoomContent || galaxyZoomContent.firstChild !== solarSystemLinesCanvasEl) {
      galaxyZoomContent.insertBefore(solarSystemLinesCanvasEl, galaxyZoomContent.firstChild);
    }
    drawGalaxyLines(g);
    galaxyZoomContent.style.transition = isInteractive ? 'none' : 'transform 0.1s ease-out';
    galaxyZoomContent.style.transform = `translate(${g.currentPanX}px,${g.currentPanY}px)scale(${g.currentZoom})`;
    if (galaxyDetailTitleText) { const dId = g.id.split('-').pop(); galaxyDetailTitleText.textContent = g.customName || `Galaxy ${dId}`; }
  }

  function drawAllOrbits() {
    if (!orbitCtx || !solarSystemOrbitCanvasEl || !window.gameSessionData.solarSystemView.planets) return;
    orbitCtx.clearRect(0,0,solarSystemOrbitCanvasEl.width,solarSystemOrbitCanvasEl.height);
    if(!currentShowPlanetOrbits && solarSystemOrbitCanvasEl){solarSystemOrbitCanvasEl.style.display='none'; return;} else if(solarSystemOrbitCanvasEl)solarSystemOrbitCanvasEl.style.display='block';
    const cX=solarSystemOrbitCanvasEl.width/2,cY=solarSystemOrbitCanvasEl.height/2;
    window.gameSessionData.solarSystemView.planets.forEach(pD=>{
      orbitCtx.beginPath(); orbitCtx.arc(cX,cY,pD.distance,0,2*Math.PI); orbitCtx.strokeStyle='rgba(255,255,255,0.2)';orbitCtx.lineWidth=1;orbitCtx.setLineDash([5,5]);orbitCtx.stroke();
    }); orbitCtx.setLineDash([]);
  }

  function renderSolarSystemScreen(isInteractive = false) {
    if (!solarSystemContent||!solarSystemScreen||!window.gameSessionData.activeSolarSystemId) return;
    if(solarSystemOrbitCanvasEl&&(solarSystemOrbitCanvasEl.width!==ORBIT_CANVAS_SIZE||solarSystemOrbitCanvasEl.height!==ORBIT_CANVAS_SIZE)){solarSystemOrbitCanvasEl.width=ORBIT_CANVAS_SIZE;solarSystemOrbitCanvasEl.height=ORBIT_CANVAS_SIZE;}
    const dD=window.gameSessionData.solarSystemView; let pX=dD.currentPanX||0,pY=dD.currentPanY||0,z=dD.zoomLevel||SOLAR_SYSTEM_VIEW_MIN_ZOOM;
    solarSystemContent.style.transition=isInteractive?'none':'transform 0.1s ease-out'; solarSystemContent.style.transform=`translate(${pX}px, ${pY}px) scale(${z})`;
    const gM=window.gameSessionData.activeSolarSystemId.match(/^(galaxy-\d+)-ss-\d+$/), gP=gM?gM[1]:null;
    const aG=gP?window.gameSessionData.galaxies.find(g=>g.id===gP):null;
    let sSO=null; if(aG&&aG.solarSystems)sSO=aG.solarSystems.find(s=>s.id===dD.systemId);
    if(solarSystemTitleText){const sId=dD.systemId?dD.systemId.substring(dD.systemId.lastIndexOf('-')+1):'N/A';solarSystemTitleText.textContent=(sSO&&sSO.customName)?sSO.customName:`System ${sId}`;}
    if(isInteractive||!animationFrameId)drawAllOrbits();
  }

  function switchToMainView() {
    window.gameSessionData.activeGalaxyId=null; window.gameSessionData.activeSolarSystemId=null; stopSolarSystemAnimation(); window.setActiveScreen(mainScreen);
  }
  function makeTitleEditable(titleTextElement, inputElement, onSaveCallback) {
    if(!titleTextElement||!inputElement)return; titleTextElement.ondblclick=()=>{titleTextElement.style.display='none';inputElement.style.display='inline-block';inputElement.value=titleTextElement.textContent;inputElement.focus();inputElement.select();};
    const saveName=()=>{const newN=inputElement.value.trim(); const defN=onSaveCallback(newN||null); titleTextElement.textContent=newN||defN; inputElement.style.display='none';titleTextElement.style.display='inline-block';};
    inputElement.onblur=saveName; inputElement.onkeydown=(e)=>{if(e.key==='Enter')inputElement.blur();else if(e.key==='Escape'){inputElement.value=titleTextElement.textContent;inputElement.blur();}};
  }

  function switchToGalaxyDetailView(galaxyId) {
    const g=window.gameSessionData.galaxies.find(gl=>gl.id===galaxyId); if(!g){switchToMainView();return;}
    window.gameSessionData.activeGalaxyId=galaxyId; const dId=g.id.split('-').pop();
    if(backToGalaxyButton)backToGalaxyButton.textContent=g.customName?`← ${g.customName}`:`← Galaxy ${dId}`;
    window.gameSessionData.activeSolarSystemId=null; stopSolarSystemAnimation();
    g.currentZoom=g.currentZoom||1.0; g.currentPanX=g.currentPanX||0; g.currentPanY=g.currentPanY||0;
    if(galaxyDetailTitleText){galaxyDetailTitleText.textContent=g.customName||`Galaxy ${dId}`;galaxyDetailTitleText.style.display='inline-block';} if(galaxyDetailTitleInput)galaxyDetailTitleInput.style.display='none';
    window.setActiveScreen(galaxyDetailScreen);
    makeTitleEditable(galaxyDetailTitleText,galaxyDetailTitleInput,(newName)=>{g.customName=newName||null;window.saveGameState();renderMainScreen();return g.customName||`Galaxy ${dId}`;});
    if(galaxyViewport&&window.gameSessionData.universe.diameter){galaxyViewport.style.width=`${window.gameSessionData.universe.diameter}px`;galaxyViewport.style.height=`${window.gameSessionData.universe.diameter}px`;}
    if(!g.layoutGenerated){setTimeout(()=>{function att(rL=5){if(galaxyViewport&&galaxyViewport.offsetWidth>0&&galaxyViewport.offsetHeight>0){generateSolarSystemsForGalaxy(galaxyId);renderGalaxyDetailScreen(false);}else if(rL>0){requestAnimationFrame(()=>att(rL-1));}else{console.warn("VP no dim");g.layoutGenerated=true;renderGalaxyDetailScreen(false);}}att();},50);}else{renderGalaxyDetailScreen(false);}
  }


  function switchToSolarSystemView(solarSystemId) {
    window.gameSessionData.activeSolarSystemId=solarSystemId; const gPM=solarSystemId.match(/^(galaxy-\d+)-ss-\d+$/),gP=gPM?gPM[1]:null;
    const aG=gP?window.gameSessionData.galaxies.find(g=>g.id===gP):null; let sSO=null; if(aG&&aG.solarSystems)sSO=aG.solarSystems.find(s=>s.id===solarSystemId);
    window.gameSessionData.solarSystemView.zoomLevel=0.5; window.gameSessionData.solarSystemView.currentPanX=0; window.gameSessionData.solarSystemView.currentPanY=0; window.gameSessionData.solarSystemView.systemId=solarSystemId;
    if(solarSystemContent)solarSystemContent.innerHTML='';
    let cSS=SUN_ICON_SIZE; if(sSO&&typeof sSO.sunSizeFactor==='number')cSS=SUN_ICON_SIZE*sSO.sunSizeFactor; cSS=Math.max(cSS,15);
    const sE=document.createElement('div');sE.className='sun-icon sun-animated';sE.style.width=`${cSS}px`;sE.style.height=`${cSS}px`;
    const coreC=FIXED_COLORS.sunFill,midC=FIXED_COLORS.sunBorder,edgeC=adjustColor(FIXED_COLORS.sunBorder,-40),actBC=FIXED_COLORS.sunBorder;
    sE.style.setProperty('--sun-core-color',coreC);sE.style.setProperty('--sun-mid-color',midC);sE.style.setProperty('--sun-edge-color',edgeC);sE.style.setProperty('--sun-actual-border-color',actBC);
    if(solarSystemContent)solarSystemContent.appendChild(sE);
    solarSystemOrbitCanvasEl=document.createElement('canvas');solarSystemOrbitCanvasEl.id='solar-system-orbit-canvas';solarSystemOrbitCanvasEl.width=ORBIT_CANVAS_SIZE;solarSystemOrbitCanvasEl.height=ORBIT_CANVAS_SIZE;
    if(solarSystemContent)solarSystemContent.appendChild(solarSystemOrbitCanvasEl);orbitCtx=solarSystemOrbitCanvasEl.getContext('2d');
    window.gameSessionData.solarSystemView.planets=[];let uD=[];const nP=Math.floor(Math.random()*(currentMaxPlanets-currentMinPlanets+1))+currentMinPlanets;
    for(let i=0;i<nP;i++){
      const pS=Math.random()*(MAX_PLANET_SIZE-MIN_PLANET_SIZE)+MIN_PLANET_SIZE;let pDist,attC=0;
      do{pDist=Math.floor(Math.random()*(MAX_PLANET_DISTANCE-MIN_PLANET_DISTANCE+1))+MIN_PLANET_DISTANCE;let tC=false;for(const d of uD){if(Math.abs(pDist-d.distance)<(MIN_ORBITAL_SEPARATION+(d.size+pS)/2)){tC=true;break;}}if(!tC)break;attC++;}while(attC<200);if(attC===200)continue;uD.push({distance:pDist,size:pS});
      const bTU=(window.gameSessionData.customPlanetDesigns.length>0)?window.gameSessionData.customPlanetDesigns[Math.floor(Math.random()*window.gameSessionData.customPlanetDesigns.length)]:{waterColor:'#0077be',landColor:'#3A5F0B',minTerrainHeightRange:[0.0,1.0],maxTerrainHeightRange:[5.0,8.0],oceanHeightRange:[1.0,3.0]};
      const nPD=window.generatePlanetInstanceFromBasis(bTU,false);
      const iOA=Math.random()*2*Math.PI,oS=Math.random()*(MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT-MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT)+MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT;const iAA=Math.random()*2*Math.PI,aS=DEFAULT_PLANET_AXIAL_SPEED;
      const nPl={id:`planet-${i+1}`,size:pS,distance:pDist,currentOrbitalAngle:iOA,orbitalSpeed:oS,currentAxialAngle:iAA,axialSpeed:aS,element:null,planetName:`Planet ${i+1}`,type:'terrestrial',...nPD,sourceDesignId:bTU.designId||null};
      window.gameSessionData.solarSystemView.planets.push(nPl);
      const pE=document.createElement('div');if(planetVisualPanel)pE.classList.add('planet-icon','clickable-when-paused');else pE.classList.add('planet-icon');
      pE.style.width=`${nPl.size}px`;pE.style.height=`${nPl.size}px`;
      const rPos=15+Math.random()*40,rSize=20+Math.random()*30;let bgS=`radial-gradient(circle at ${rPos}% ${rPos}%, ${nPl.landColor} ${rSize}%, transparent ${rSize+20}%), ${nPl.waterColor}`;
      if(Math.random()<0.5){const rP2=15+Math.random()*40,rS2=20+Math.random()*30;bgS=`radial-gradient(circle at ${90-rP2}% ${90-rP2}%, ${adjustColor(nPl.landColor,-30)} ${rS2}%, transparent ${rS2+20}%), ${bgS}`;}
      pE.style.background=bgS;pE.style.boxShadow=`0 0 ${nPl.size/3}px rgba(255,255,255,0.3)`;
      pE.addEventListener('click',(e)=>{e.stopPropagation();if(!planetVisualPanel||!planetVisualTitle||!planetVisualSize||!planetVisualCanvas){console.error("Panel elements missing");return;}
        const wPV=planetVisualPanel.classList.contains('visible');currentPlanetDisplayedInPanel=nPl;planetVisualTitle.textContent=nPl.planetName;planetVisualSize.textContent=Math.round(nPl.size);planetVisualPanel.classList.add('visible');
        if(!wPV){planetVisualPanel.style.left='50%';planetVisualPanel.style.top='50%';planetVisualPanel.style.transform='translate(-50%,-50%)';planetVisualPanel.style.transition='';}else{planetVisualPanel.style.transition='none';}
        planetVisualRotationQuat=quat_identity();window.renderPlanetVisual(nPl,planetVisualRotationQuat,planetVisualCanvas);});
      if(solarSystemContent)solarSystemContent.appendChild(pE);nPl.element=pE;
    }
    if(planetVisualWorker&&window.gameSessionData.solarSystemView.planets&&planetVisualCanvas){window.gameSessionData.solarSystemView.planets.forEach(pTP=>{const pD={...pTP};delete pD.element;delete pD.id;delete pD.currentOrbitalAngle;delete pD.orbitalSpeed;delete pD.currentAxialAngle;delete pD.axialSpeed;delete pD.planetName;delete pD.type;delete pD.sourceDesignId;delete pD.size;delete pD.distance; planetVisualWorker.postMessage({cmd:'preloadPlanet',planetData:pD,rotationQuaternion:quat_identity(),canvasWidth:planetVisualCanvas.width||200,canvasHeight:planetVisualCanvas.height||200,senderId:`preload-${pTP.id}`});});}else if(!planetVisualCanvas)console.warn("planetVisualCanvas not found for preloading.");
    const sI=solarSystemId.substring(solarSystemId.lastIndexOf('-')+1);if(solarSystemTitleText)solarSystemTitleText.textContent=(sSO&&sSO.customName)?sSO.customName:`System ${sI}`;if(solarSystemTitleInput)solarSystemTitleInput.style.display='none';
    window.setActiveScreen(solarSystemScreen);
    makeTitleEditable(solarSystemTitleText,solarSystemTitleInput,(newN)=>{if(sSO){sSO.customName=newN||null;window.saveGameState();renderGalaxyDetailScreen();return sSO.customName||`System ${sI}`;}return `System ${sI}`;});
    renderSolarSystemScreen(false);startSolarSystemAnimation();
  }

  function animateSolarSystem(now){if(!now)now=performance.now();if(lastAnimationTime===null)lastAnimationTime=now;const dT=(now-lastAnimationTime)/1000;lastAnimationTime=now;
    const aSSV=window.gameSessionData.solarSystemView;if(aSSV&&solarSystemScreen&&solarSystemScreen.classList.contains('active')&&aSSV.planets){aSSV.planets.forEach(p=>{if(p.element){p.currentOrbitalAngle+=p.orbitalSpeed*6*dT;p.currentAxialAngle+=p.axialSpeed*60*dT;const xO=p.distance*Math.cos(p.currentOrbitalAngle),yO=p.distance*Math.sin(p.currentOrbitalAngle);p.element.style.left=`calc(50% + ${xO}px)`;p.element.style.top=`calc(50% + ${yO}px)`;p.element.style.transform=`translate(-50%,-50%) rotate(${p.currentAxialAngle}rad)`;}});animationFrameId=requestAnimationFrame(animateSolarSystem);}else{if(animationFrameId){cancelAnimationFrame(animationFrameId);animationFrameId=null;}lastAnimationTime=null;}}
  function startSolarSystemAnimation(){if(!animationFrameId&&solarSystemScreen&&solarSystemScreen.classList.contains('active')){lastAnimationTime=null;animateSolarSystem();}}
  function stopSolarSystemAnimation(){if(animationFrameId){cancelAnimationFrame(animationFrameId);animationFrameId=null;lastAnimationTime=null;}}

  function clampSolarSystemPan(dO,vW,vH){if(!dO||!vW||!vH){if(dO){dO.currentPanX=0;dO.currentPanY=0;}return;}const z=dO.zoomLevel,cW=SOLAR_SYSTEM_EXPLORABLE_RADIUS*2,cH=SOLAR_SYSTEM_EXPLORABLE_RADIUS*2;const sCW=cW*z,sCH=cH*z;const mPX=Math.max(0,(sCW-vW)/2),mPY=Math.max(0,(sCH-vH)/2);dO.currentPanX=Math.max(-mPX,Math.min(mPX,dO.currentPanX));dO.currentPanY=Math.max(-mPY,Math.min(mPY,dO.currentPanY));}
  function clampGalaxyPan(g){if(!g||!galaxyViewport)return;const vW=galaxyViewport.offsetWidth,vH=galaxyViewport.offsetHeight,z=g.currentZoom;if(z<=GALAXY_VIEW_MIN_ZOOM){g.currentPanX=0;g.currentPanY=0;}else{const zUW=(window.gameSessionData.universe.diameter||500)*z,zUH=(window.gameSessionData.universe.diameter||500)*z;const mPOX=Math.max(0,(zUW-vW)/2),mPOY=Math.max(0,(zUH-vH)/2);g.currentPanX=Math.max(-mPOX,Math.min(mPOX,g.currentPanX));g.currentPanY=Math.max(-mPOY,Math.min(mPOY,g.currentPanY));}}

  function handleZoom(dir,mE=null){let tDO,vE,cF,rF,minZ,maxZ,zK,pXK,pYK,iSSV=false;
    if(galaxyDetailScreen.classList.contains('active')){const g=window.gameSessionData.galaxies.find(gl=>gl.id===window.gameSessionData.activeGalaxyId);if(!g)return;tDO=g;vE=galaxyViewport;cF=clampGalaxyPan;rF=renderGalaxyDetailScreen;minZ=GALAXY_VIEW_MIN_ZOOM;maxZ=GALAXY_VIEW_MAX_ZOOM;zK='currentZoom';pXK='currentPanX';pYK='currentPanY';}else if(solarSystemScreen.classList.contains('active')){iSSV=true;tDO=window.gameSessionData.solarSystemView;vE=solarSystemScreen;cF=clampSolarSystemPan;rF=renderSolarSystemScreen;minZ=SOLAR_SYSTEM_VIEW_MIN_ZOOM;maxZ=SOLAR_SYSTEM_VIEW_MAX_ZOOM;zK='zoomLevel';pXK='currentPanX';pYK='currentPanY';}else return;
    const oZ=tDO[zK];let nCZ=oZ+(dir==='in'?(ZOOM_STEP*oZ):-(ZOOM_STEP*oZ));
    let eMZ=minZ;if(iSSV&&vE){const vw=vE.offsetWidth,vh=vE.offsetHeight;let dMZBEA=0;if(SOLAR_SYSTEM_EXPLORABLE_RADIUS>0&&(vw>0||vh>0)){const zFW=vw>0?vw/(SOLAR_SYSTEM_EXPLORABLE_RADIUS*2):0,zFH=vh>0?vh/(SOLAR_SYSTEM_EXPLORABLE_RADIUS*2):0;dMZBEA=Math.max(zFW,zFH);}eMZ=Math.max(minZ,dMZBEA);}
    nCZ=Math.max(eMZ,Math.min(maxZ,nCZ));if(Math.abs(oZ-nCZ)<0.0001)return;tDO[zK]=nCZ;
    if(mE&&vE){const r=vE.getBoundingClientRect(),mXV=mE.clientX-r.left,mYV=mE.clientY-r.top;const mXRC=mXV-(vE.offsetWidth/2),mYRC=mYV-(vE.offsetHeight/2);const cPX=tDO[pXK]||0,cPY=tDO[pYK]||0;const wX=(mXRC-cPX)/oZ,wY=(mYRC-cPY)/oZ;tDO[pXK]=mXRC-(wX*nCZ);tDO[pYK]=mYRC-(wY*nCZ);}
    if(iSSV&&vE){cF(tDO,vE.offsetWidth,vE.offsetHeight);if(currentShowPlanetOrbits)drawAllOrbits();rF(true);startSolarSystemAnimation();}else{cF(tDO);rF(true);}}

  function startPan(e,vEl,cEl,dObjR){if(e.button!==0||e.target.closest('button'))return;if(vEl===galaxyViewport&&e.target.closest('.solar-system-icon'))return;
    const pS=window.gameSessionData.panning;pS.isActive=true;pS.startX=e.clientX;pS.startY=e.clientY;pS.initialPanX=dObjR.currentPanX||0;pS.initialPanY=dObjR.currentPanY||0;pS.targetElement=cEl;pS.viewportElement=vEl;pS.dataObject=dObjR;
    if(vEl)vEl.classList.add('dragging');if(cEl)cEl.style.transition='none';e.preventDefault();}
  function panMouseMove(e){if(!window.gameSessionData.panning.isActive)return;const pS=window.gameSessionData.panning;if(!pS.dataObject)return;
    const dX=e.clientX-pS.startX,dY=e.clientY-pS.startY;pS.dataObject.currentPanX=pS.initialPanX+dX;pS.dataObject.currentPanY=pS.initialPanY+dY;
    if(pS.viewportElement===galaxyViewport && pS.dataObject) { clampGalaxyPan(pS.dataObject); renderGalaxyDetailScreen(true); }
    else if(pS.viewportElement===solarSystemScreen&&pS.viewportElement && pS.dataObject) { clampSolarSystemPan(pS.dataObject,pS.viewportElement.offsetWidth,pS.viewportElement.offsetHeight);renderSolarSystemScreen(true);}}
  function panMouseUp(){if(!window.gameSessionData.panning.isActive)return;if(window.gameSessionData.panning.viewportElement)window.gameSessionData.panning.viewportElement.classList.remove('dragging');
    const pS=window.gameSessionData.panning;pS.isActive=false;if(pS.targetElement)pS.targetElement.style.transition='';
    if(galaxyDetailScreen.classList.contains('active'))renderGalaxyDetailScreen(false);else if(solarSystemScreen.classList.contains('active'))renderSolarSystemScreen(false);
    pS.targetElement=null;pS.viewportElement=null;pS.dataObject=null;}

  function regenerateCurrentUniverseState(force=false){if(!force&&!confirm("Regen?"))return;localStorage.removeItem('galaxyGameSaveData');
    window.gameSessionData.universe={diameter:null};window.gameSessionData.galaxies=[];window.gameSessionData.activeGalaxyId=null;window.gameSessionData.activeSolarSystemId=null;window.gameSessionData.solarSystemView={zoomLevel:1.0,currentPanX:0,currentPanY:0,planets:[],systemId:null};window.gameSessionData.isInitialized=false;
    if(universeCircle)universeCircle.innerHTML='';if(galaxyZoomContent){const cL=galaxyZoomContent.querySelector('#solar-system-lines-canvas');galaxyZoomContent.innerHTML='';if(cL)galaxyZoomContent.appendChild(cL);}
    if(solarSystemContent)solarSystemContent.innerHTML='';if(orbitCtx&&solarSystemOrbitCanvasEl)orbitCtx.clearRect(0,0,solarSystemOrbitCanvasEl.width,solarSystemOrbitCanvasEl.height);
    if(animationFrameId){cancelAnimationFrame(animationFrameId);animationFrameId=null;}lastAnimationTime=null;
    initializeGame(true);
  }

  // --- EVENT LISTENERS ---
  // Designer related event listeners are now in planetDesigner.js

  if (regenerateUniverseButton) regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(false));
  if (customizeGenerationButton) customizeGenerationButton.addEventListener('click', () => {
    if(!numGalaxiesInput||!minSSInput||!maxSSInput||!ssSpreadInput||!minPlanetsInput||!maxPlanetsInput||!showOrbitsInput||!customizationModal)return;
    numGalaxiesInput.value=currentNumGalaxies;minSSInput.value=currentMinSSCount;maxSSInput.value=currentMaxSSCount;ssSpreadInput.value=currentMaxPlanetDistanceMultiplier.toFixed(1);minPlanetsInput.value=currentMinPlanets;maxPlanetsInput.value=currentMaxPlanets;showOrbitsInput.checked=currentShowPlanetOrbits;
    customizationModal.classList.add('visible');window.setActiveScreen(customizationModal);
  });
  if (cancelCustomizationButton) cancelCustomizationButton.addEventListener('click', () => {customizationModal.classList.remove('visible');window.setActiveScreen(mainScreen);});
  if (applyCustomizationButton) applyCustomizationButton.addEventListener('click', () => {
    if(!numGalaxiesInput||!minSSInput||!maxSSInput||!ssSpreadInput||!minPlanetsInput||!maxPlanetsInput||!showOrbitsInput||!customizationModal)return;
    const nG=parseInt(numGalaxiesInput.value,10),mSS=parseInt(minSSInput.value,10),mxSS=parseInt(maxSSInput.value,10),sp=parseFloat(ssSpreadInput.value),mP=parseInt(minPlanetsInput.value,10),mxP=parseInt(maxPlanetsInput.value,10);
    if(isNaN(nG)||nG<1||nG>100||isNaN(mSS)||mSS<1||mSS>1000||isNaN(mxSS)||mxSS<1||mxSS>2000||mxSS<mSS||isNaN(sp)||sp<0.1||sp>5.0||isNaN(mP)||mP<0||mP>20||isNaN(mxP)||mxP<mP||mxP>20){alert("Invalid values.");return;}
    currentNumGalaxies=nG;currentMinSSCount=mSS;currentMaxSSCount=mxSS;currentMaxPlanetDistanceMultiplier=sp;currentMinPlanets=mP;currentMaxPlanets=mxP;currentShowPlanetOrbits=showOrbitsInput.checked;
    updateDerivedConstants();saveCustomizationSettings();customizationModal.classList.remove('visible');regenerateCurrentUniverseState(true);window.setActiveScreen(mainScreen);
  });

  if (createPlanetDesignButton) createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);

  if (closePlanetVisualPanelBtn) closePlanetVisualPanelBtn.addEventListener('click', () => { if(planetVisualPanel)planetVisualPanel.classList.remove('visible'); currentPlanetDisplayedInPanel=null; });
  let isPanelDragging=false; let visualPanelOffset={x:0,y:0};
  if(planetVisualPanelHeader)planetVisualPanelHeader.addEventListener('mousedown',(e)=>{if(e.button!==0||!planetVisualPanel)return;isPanelDragging=true;planetVisualPanel.classList.add('dragging');planetVisualPanel.style.transition='none';const r=planetVisualPanel.getBoundingClientRect();visualPanelOffset.x=e.clientX-r.left;visualPanelOffset.y=e.clientY-r.top;planetVisualPanel.style.left=`${e.clientX-visualPanelOffset.x}px`;planetVisualPanel.style.top=`${e.clientY-visualPanelOffset.y}px`;planetVisualPanel.style.transform='none';planetVisualPanel.style.right='auto';planetVisualPanel.style.bottom='auto';e.preventDefault();});

  if(planetVisualCanvas)planetVisualCanvas.addEventListener('mousedown',(e)=>{if(e.button!==0||!currentPlanetDisplayedInPanel)return;isDraggingPlanetVisual=true;startDragMouseX=e.clientX;startDragMouseY=e.clientY;startDragPlanetVisualQuat=[...planetVisualRotationQuat];planetVisualCanvas.classList.add('dragging');e.preventDefault();});
  // Designer canvas mousedown is now in planetDesigner.js

  window.addEventListener('mousemove', (e) => {
    if(isPanelDragging&&planetVisualPanel){planetVisualPanel.style.left=`${e.clientX-visualPanelOffset.x}px`;planetVisualPanel.style.top=`${e.clientY-visualPanelOffset.y}px`;}
    if(isDraggingPlanetVisual&&currentPlanetDisplayedInPanel&&planetVisualCanvas&&planetVisualPanel&&planetVisualPanel.classList.contains('visible')){
      const rect=planetVisualCanvas.getBoundingClientRect();if(rect.width===0||rect.height===0)return;const cW=rect.width,cH=rect.height;const dX=e.clientX-startDragMouseX,dY=e.clientY-startDragMouseY;
      const rAX=(dY/cH)*Math.PI*window.PLANET_ROTATION_SENSITIVITY,rAY=(dX/cW)*(2*Math.PI)*window.PLANET_ROTATION_SENSITIVITY;
      const xAQ=quat_from_axis_angle([1,0,0],-rAX),yAQ=quat_from_axis_angle([0,1,0],rAY);
      const iRQ=quat_multiply(yAQ,xAQ);planetVisualRotationQuat=quat_normalize(quat_multiply(iRQ,startDragPlanetVisualQuat));
      if(!isRenderingVisualPlanet&&planetVisualWorker){window.renderPlanetVisual(currentPlanetDisplayedInPanel,planetVisualRotationQuat,planetVisualCanvas);}else{needsPlanetVisualRerender=true;}
    }
    // Designer planet dragging logic removed from here, handled in planetDesigner.js
  });

  window.addEventListener('mouseup', () => {
    if(isPanelDragging&&planetVisualPanel){isPanelDragging=false;planetVisualPanel.classList.remove('dragging');planetVisualPanel.style.transition='';}
    if(isDraggingPlanetVisual&&planetVisualCanvas){isDraggingPlanetVisual=false;planetVisualCanvas.classList.remove('dragging');}
    // Designer planet dragging logic removed from here
  });

  function initializeGame(isForcedRegeneration = false) {
    loadCustomizationSettings();
    if (!isForcedRegeneration && loadGameState()) {
      window.setActiveScreen(mainScreen);
      if (universeCircle && window.gameSessionData.universe.diameter) {
        universeCircle.style.width = `${window.gameSessionData.universe.diameter}px`;
        universeCircle.style.height = `${window.gameSessionData.universe.diameter}px`;
        universeCircle.style.backgroundColor = FIXED_COLORS.universeBg;
      } else { generateUniverseLayout(); }
      renderMainScreen();
      preGenerateAllGalaxyContents(); // This calls saveGameState eventually
    } else {
      generateUniverseLayout(); generateGalaxies(); window.setActiveScreen(mainScreen); renderMainScreen();
      preGenerateAllGalaxyContents(); //This calls saveGameState eventually
    }
    window.gameSessionData.isInitialized = true;
  }

  window.addEventListener('resize', () => {
    const aSE=document.querySelector('.screen.active'),cSId=aSE?aSE.id:'main-screen';
    const pCD=[...window.gameSessionData.customPlanetDesigns];
    window.gameSessionData={universe:{diameter:null},galaxies:[],activeGalaxyId:null,activeSolarSystemId:null,solarSystemView:{zoomLevel:1.0,currentPanX:0,currentPanY:0,planets:[],systemId:null},isInitialized:false,panning:{isActive:false,startX:0,startY:0,initialPanX:0,initialPanY:0,targetElement:null,viewportElement:null,dataObject:null},customPlanetDesigns:pCD};
    if(universeCircle)universeCircle.innerHTML='';if(galaxyZoomContent){const cL=galaxyZoomContent.querySelector('#solar-system-lines-canvas');galaxyZoomContent.innerHTML='';if(cL)galaxyZoomContent.appendChild(cL);}
    if(solarSystemContent)solarSystemContent.innerHTML='';if(orbitCtx&&solarSystemOrbitCanvasEl)orbitCtx.clearRect(0,0,solarSystemOrbitCanvasEl.width,solarSystemOrbitCanvasEl.height);stopSolarSystemAnimation();
    initializeGame(true); // Force regen
    const sTA=document.getElementById(cSId);
    if(sTA){
        if (cSId === 'planet-designer-screen' && window.PlanetDesigner) {switchToPlanetDesignerScreen();} // Recalls PlanetDesigner.activate
        else if (cSId==='galaxy-detail-screen'&&window.gameSessionData.activeGalaxyId){const ex=window.gameSessionData.galaxies.find(g=>g.id===window.gameSessionData.activeGalaxyId);if(ex)switchToGalaxyDetailView(window.gameSessionData.activeGalaxyId);else switchToMainView();}
        else if (cSId==='solar-system-screen'&&window.gameSessionData.activeSolarSystemId){const gPM=window.gameSessionData.activeSolarSystemId.match(/^(galaxy-\d+)-ss-\d+$/),gP=gPM?gPM[1]:null;const aG=gP?window.gameSessionData.galaxies.find(g=>g.id===gP):null;if(aG&&aG.solarSystems.find(s=>s.id===window.gameSessionData.activeSolarSystemId))switchToSolarSystemView(window.gameSessionData.activeSolarSystemId);else switchToMainView();}
        else window.setActiveScreen(sTA);
    }else window.setActiveScreen(mainScreen);
    if(planetVisualPanel&&planetVisualPanel.classList.contains('visible')&&currentPlanetDisplayedInPanel&&planetVisualCanvas){window.renderPlanetVisual(currentPlanetDisplayedInPanel,planetVisualRotationQuat,planetVisualCanvas);}
    if(document.getElementById('designer-planet-canvas') && planetDesignerScreen && planetDesignerScreen.classList.contains('active') && window.PlanetDesigner){/* PlanetDesigner.activate() handles its own rerender if needed */ }
  });

  if(backToMainButton)backToMainButton.addEventListener('click',switchToMainView);
  if(backToGalaxyButton)backToGalaxyButton.addEventListener('click',()=>{if(window.gameSessionData.activeGalaxyId){const tG=window.gameSessionData.galaxies.find(g=>g.id===window.gameSessionData.activeGalaxyId);if(tG)switchToGalaxyDetailView(tG.id);else switchToMainView();}else switchToMainView();});
  if(zoomInButton)zoomInButton.addEventListener('click',(e)=>handleZoom('in',e));
  if(zoomOutButton)zoomOutButton.addEventListener('click',(e)=>handleZoom('out',e));
  if(galaxyViewport)galaxyViewport.addEventListener('wheel',(e)=>{if(galaxyDetailScreen.classList.contains('active')){e.preventDefault();handleZoom(e.deltaY<0?'in':'out',e);}});
  if(solarSystemScreen)solarSystemScreen.addEventListener('wheel',(e)=>{if(solarSystemScreen.classList.contains('active')){e.preventDefault();handleZoom(e.deltaY<0?'in':'out',e);}});
  if(solarSystemScreen)solarSystemScreen.addEventListener('mousedown',(e)=>{if(solarSystemScreen.classList.contains('active')){startPan(e,solarSystemScreen,solarSystemContent,window.gameSessionData.solarSystemView);}});
  window.addEventListener('mousemove',panMouseMove);
  window.addEventListener('mouseup',panMouseUp);

  if(galaxyViewport){
    galaxyViewport.addEventListener('click',function(e){if(window.gameSessionData.panning&&window.gameSessionData.panning.isActive){const pT=5;if(Math.abs(e.clientX-window.gameSessionData.panning.startX)>pT||Math.abs(e.clientY-window.gameSessionData.panning.startY)>pT)return;}const sI=e.target.closest('.solar-system-icon');if(sI){const sId=sI.dataset.solarSystemId;if(sId){switchToSolarSystemView(sId);e.stopPropagation();}}},true);
    let iGPS=false,gPSS={x:0,y:0},gLPS={x:0,y:0};
    galaxyViewport.addEventListener('mousedown',(e)=>{if(e.button!==0||!galaxyDetailScreen.classList.contains('active')||e.target.closest('.solar-system-icon')||e.target.closest('button'))return;iGPS=true;gPSS.x=e.clientX;gPSS.y=e.clientY;const gal=window.gameSessionData.galaxies.find(g=>g.id===window.gameSessionData.activeGalaxyId);if(gal){gLPS.x=gal.currentPanX||0;gLPS.y=gal.currentPanY||0;}else{gLPS.x=0;gLPS.y=0;}
    galaxyViewport.classList.add('dragging');if(galaxyZoomContent)galaxyZoomContent.style.transition='none';e.preventDefault();window.gameSessionData.panning.startX=e.clientX;window.gameSessionData.panning.startY=e.clientY;window.gameSessionData.panning.isActive=true;});
    const gMMH=(e)=>{if(!iGPS)return;const gal=window.gameSessionData.galaxies.find(g=>g.id===window.gameSessionData.activeGalaxyId);if(!gal)return;const dX=e.clientX-gPSS.x,dY=e.clientY-gPSS.y;gal.currentPanX=gLPS.x+dX;gal.currentPanY=gLPS.y+dY;clampGalaxyPan(gal);renderGalaxyDetailScreen(true);};window.addEventListener('mousemove',gMMH);
    const gMUH=()=>{if(iGPS){iGPS=false;if(galaxyViewport)galaxyViewport.classList.remove('dragging');if(galaxyZoomContent)galaxyZoomContent.style.transition='';renderGalaxyDetailScreen(false);window.gameSessionData.panning.isActive=false;}};window.addEventListener('mouseup',gMUH);
  }

// In script.js, near the end of DOMContentLoaded, before initializeGame()
console.log("script.js: Attempting to initialize PlanetDesigner."); // ADD THIS LOG
if (window.PlanetDesigner && typeof window.PlanetDesigner.init === 'function') {
    window.PlanetDesigner.init();
    console.log("script.js: PlanetDesigner.init() called."); // ADD THIS LOG
} else {
    console.error("script.js: PlanetDesigner module not found or init function is missing. Ensure planetDesigner.js is loaded before script.js and defines PlanetDesigner correctly.");
}

// --- INITIALIZATION ---
initializeGame();

}); // End of DOMContentLoaded
