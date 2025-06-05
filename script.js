// script.js

// Import animation functions from animationController.js
import { startSolarSystemAnimation, stopSolarSystemAnimation, isSolarSystemAnimationRunning } from './animationController.js'; // Added isSolarSystemAnimationRunning

document.addEventListener('DOMContentLoaded', () => {
  // Define constants FIRST
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
  window.DEFAULT_PLANET_AXIAL_SPEED = 0.01;

  const BASE_MAX_PLANET_DISTANCE_FACTOR = 25;
  window.PLANET_ROTATION_SENSITIVITY = 0.75;

  // Get DOM elements
  const mainScreen = document.getElementById('main-screen');
  const galaxyDetailScreen = document.getElementById('galaxy-detail-screen');
  const solarSystemScreen = document.getElementById('solar-system-screen');
  const universeCircle = document.getElementById('universe-circle');
  const galaxyViewport = document.getElementById('galaxy-viewport');
  const galaxyZoomContent = document.getElementById('galaxy-zoom-content');
  const solarSystemLinesCanvasEl = document.getElementById('solar-system-lines-canvas');
  const solarSystemContent = document.getElementById('solar-system-content');
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
  
  const planetVisualPanel = document.getElementById('planet-visual-panel');
  const closePlanetVisualPanelBtn = document.getElementById('close-planet-visual-panel');
  const planetVisualPanelHeader = document.getElementById('planet-visual-panel-header');
  const planetVisualTitle = document.getElementById('planet-visual-title');
  const planetVisualSize = document.getElementById('planet-visual-size');
  const planetVisualCanvas = document.getElementById('planet-visual-canvas');

  // --- NEW DOM Elements for Planet Detail View ---
  const planetDetailViewScreen = document.getElementById('planet-detail-view-screen');
  const planetDetailViewTitleText = document.getElementById('planet-detail-view-title-text');
  const planetDetailViewCanvas = document.getElementById('planet-detail-view-canvas');
  const backToSolarSystemFromDetailButton = document.getElementById('back-to-solar-system-from-detail');
  const viewFullPlanetMapButton = document.getElementById('view-full-planet-map-btn');


  // --- FUNCTION DEFINITIONS ---

  window.generatePlanetInstanceFromBasis = function (basis, isForDesignerPreview = false) {
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

    let seedToUse;
    if (isForDesignerPreview) {
      seedToUse = (basis.continentSeed !== undefined ? basis.continentSeed : Math.random());
    } else {
      seedToUse = (basis.continentSeed !== undefined ? basis.continentSeed : Math.random());
    }

    // This function now returns the core visual properties for a planet instance
    return {
      waterColor: basis.waterColor || '#0000FF',
      landColor: basis.landColor || '#008000',
      continentSeed: seedToUse,
      minTerrainHeight: getValueFromRange(basis.minTerrainHeightRange, window.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0),
      maxTerrainHeight: getValueFromRange(basis.maxTerrainHeightRange, window.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0),
      oceanHeightLevel: getValueFromRange(basis.oceanHeightRange, window.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0)
    };
  }

  // --- STATE VARIABLES ---
  let linesCtx;
  let solarSystemOrbitCanvasEl; 
  let orbitCtx;
    
  let isDraggingPlanetVisual = false; 
  let isRenderingVisualPlanet = false; 
  let needsPlanetVisualRerender = false;

  let planetVisualRotationQuat = quat_identity(); 
  let startDragPlanetVisualQuat = quat_identity(); 
  let startDragMouseX = 0; 
  let startDragMouseY = 0; 
  let currentPlanetDisplayedInPanel = null;
  let currentPlanetForDetailView = null; // Store data for the detail view

  // ... (rest of existing state variables like currentNumGalaxies etc.) ...
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


  window.gameSessionData = {
    universe: { diameter: null },
    galaxies: [],
    activeGalaxyId: null,
    activeSolarSystemId: null,
    solarSystemView: { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null },
    isInitialized: false,
    panning: { isActive: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0, targetElement: null, viewportElement: null, dataObject: null },
    customPlanetDesigns: []
  };

  // --- WEB WORKER SETUP ---
  let planetVisualWorker = null;
  window.designerWorker = null;

  if (window.Worker) {
    try {
      planetVisualWorker = new Worker('planetRendererWorker.js');
      window.designerWorker = new Worker('planetRendererWorker.js');

      planetVisualWorker.onmessage = function (e) {
        const { renderedData, width, height, senderId, error } = e.data;

        if (error) {
          console.error(`[planetVisualWorker] Error from worker for ${senderId}: ${error}`);
          if (senderId === 'planet-visual-canvas') isRenderingVisualPlanet = false;
          return;
        }
          
        let targetCanvasElement;
        if (senderId === 'planet-visual-canvas') { 
          targetCanvasElement = planetVisualCanvas;
        } else if (senderId === 'planet-detail-view-canvas') { // Handle new canvas
          targetCanvasElement = planetDetailViewCanvas;
        } else if (senderId && senderId.startsWith('planet-icon-canvas-')) { 
          targetCanvasElement = document.getElementById(senderId);
        }

        if (targetCanvasElement) {
          const ctx = targetCanvasElement.getContext('2d');
          if (!ctx) {
            console.error(`Failed to get 2D context from targetCanvas: ${senderId}`);
            if (senderId === 'planet-visual-canvas') isRenderingVisualPlanet = false;
            // No specific flag for planetDetailViewCanvas rendering state currently
            return;
          }
            
          ctx.clearRect(0, 0, targetCanvasElement.width, targetCanvasElement.height);
          if (renderedData && width && height) {
            try {
              const clampedArray = new Uint8ClampedArray(renderedData);
              const imageDataObj = new ImageData(clampedArray, width, height);
              ctx.putImageData(imageDataObj, 0, 0);

              if (senderId === 'planet-visual-canvas') {
                targetCanvasElement.style.transform = ""; 
              }
            } catch (err) {
              console.error(`Error putting ImageData on canvas ${senderId}:`, err);
            }
          }
        } else if (senderId && (senderId.startsWith('planet-icon-canvas-') || senderId === 'planet-detail-view-canvas')) {
          // console.warn(`[planetVisualWorker] Target canvas ${senderId} not found for message (likely view changed).`);
        }

        if (senderId === 'planet-visual-canvas') {
          isRenderingVisualPlanet = false;
          if (needsPlanetVisualRerender && currentPlanetDisplayedInPanel && planetVisualPanel.classList.contains('visible')) {
            needsPlanetVisualRerender = false;
            if (currentPlanetDisplayedInPanel.visuals) {
                renderPlanetVisual(currentPlanetDisplayedInPanel.visuals, planetVisualRotationQuat, planetVisualCanvas);
            } else {
                console.warn("[planetVisualWorker.onmessage] currentPlanetDisplayedInPanel missing 'visuals' sub-object for rerender. Using planet root.");
                renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas);
            }
          }
        }
        // No specific flag reset for planetDetailViewCanvas post-render yet
      };
      planetVisualWorker.onerror = function (error) {
        console.error("Error in planetVisualWorker:", error.message, error.filename, error.lineno);
      };

      if (window.designerWorker) {
        window.designerWorker.onmessage = function (e) {
          const { renderedData, width, height, senderId } = e.data;
          if (senderId === 'designer-planet-canvas') {
            if (window.PlanetDesigner && typeof window.PlanetDesigner.handleDesignerWorkerMessage === 'function') {
              window.PlanetDesigner.handleDesignerWorkerMessage({ renderedData, width, height });
            } else {
              console.error("script.js: PlanetDesigner module or handleDesignerWorkerMessage not found in worker callback.");
            }
          }
        };
        window.designerWorker.onerror = function (error) {
          console.error("Error in designerWorker (from script.js):", error.message, error.filename, error.lineno);
        };
      } else {
        console.error("script.js: window.designerWorker is not initialized!");
      }

    } catch (err) {
      console.error("Failed to create Web Workers. Make sure planetRendererWorker.js exists and is accessible.", err);
      planetVisualWorker = null; window.designerWorker = null;
    }
  } else {
    console.warn("Web Workers not supported in this browser. Planet rendering will be limited or disabled.");
  }

  // THIS IS THE window.renderPlanetVisual WITH AGGRESSIVE DEBUGGING LOGS:
  window.renderPlanetVisual = function (planetData, rotationQuaternion, targetCanvas) {
    // **** AGGRESSIVE DEBUG LOG - VERY FIRST LINE ****
    console.log("%%% ENTERING RENDER_PLANET_VISUAL %%%", "Canvas ID:", targetCanvas ? targetCanvas.id : "targetCanvas_UNDEFINED", "PlanetData exists:", !!planetData);

    if (!targetCanvas) {
        console.error("renderPlanetVisual: FATAL - targetCanvas is undefined or null. EXITING.");
        return;
    }
    const canvasId = targetCanvas.id; // Get canvasId early for logging

    // **** AGGRESSIVE DEBUG LOG - AFTER targetCanvas CHECK ****
    console.log("%%% RPV_DEBUG %%% Checked targetCanvas. ID:", canvasId);

    const workerToUse = targetCanvas.id === 'planet-visual-canvas' ? planetVisualWorker :
                     (targetCanvas.id === 'planet-detail-view-canvas' ? planetVisualWorker : // Also use planetVisualWorker for detail view
                     (targetCanvas.id.startsWith('planet-icon-canvas-') ? planetVisualWorker : window.designerWorker));

    // **** AGGRESSIVE DEBUG LOG - AFTER workerToUse ****
    console.log("%%% RPV_DEBUG %%% Determined workerToUse. Target ID:", canvasId, "Worker exists:", !!workerToUse);


    if (targetCanvas.id === 'planet-visual-canvas') {
        if (isRenderingVisualPlanet) {
            console.log("[renderPlanetVisual] Visual panel rendering already in progress for " + canvasId + ". Queuing rerender if needed.");
            needsPlanetVisualRerender = true;
            return;
        }
        isRenderingVisualPlanet = true;
    }
    // No separate rendering flag for planet-detail-view-canvas, assuming it runs to completion or errors out.

    if (!planetData || !rotationQuaternion || !workerToUse) {
        console.warn("renderPlanetVisual: Missing data, rotation, or appropriate worker for " + canvasId + ".",
            { planetDataExists: !!planetData, rotationQuaternionExists: !!rotationQuaternion, targetCanvasId: targetCanvas?.id, workerExists: !!workerToUse });
        if (targetCanvas.id === 'planet-visual-canvas' && isRenderingVisualPlanet) {
            isRenderingVisualPlanet = false;
        }
        return;
    }

    // **** AGGRESSIVE DEBUG LOG - BEFORE DIMENSION CHECK ****
    console.log("%%% RPV_DEBUG %%% Data/worker checks passed for " + canvasId + ". Canvas W:", targetCanvas.width, "H:", targetCanvas.height);

    if (targetCanvas.width === 0 || targetCanvas.height === 0) {
        console.warn(`renderPlanetVisual: Target canvas ${canvasId} has zero dimensions (W:${targetCanvas.width}, H:${targetCanvas.height}). Aborting worker call.`);
        if (targetCanvas.id === 'planet-visual-canvas' && isRenderingVisualPlanet) {
            isRenderingVisualPlanet = false;
        }
        // For zero-dimension icons or detail canvas, let's try to defer via rAF
        if (canvasId.startsWith('planet-icon-canvas-') || canvasId === 'planet-detail-view-canvas') {
            console.log(`%%% RPV_DEBUG %%% Deferring render for zero-dim canvas ${canvasId} via rAF.`);
            requestAnimationFrame(() => {
                console.log(`%%% RPV_DEBUG %%% rAF callback for ${canvasId}. Retrying renderPlanetVisual.`);
                window.renderPlanetVisual(planetData, rotationQuaternion, targetCanvas);
            });
        }
        return;
    }

    const pD = { ...planetData };

    if (pD.continentSeed === undefined) pD.continentSeed = Math.random();
    if (!pD.waterColor) pD.waterColor = '#000080';
    if (!pD.landColor) pD.landColor = '#006400';
    pD.minTerrainHeight = (typeof pD.minTerrainHeight === 'number' && !isNaN(pD.minTerrainHeight)) ? pD.minTerrainHeight : (window.DEFAULT_MIN_TERRAIN_HEIGHT || 0.0);
    pD.maxTerrainHeight = (typeof pD.maxTerrainHeight === 'number' && !isNaN(pD.maxTerrainHeight)) ? pD.maxTerrainHeight : (window.DEFAULT_MAX_TERRAIN_HEIGHT || 10.0);
    pD.oceanHeightLevel = (typeof pD.oceanHeightLevel === 'number' && !isNaN(pD.oceanHeightLevel)) ? pD.oceanHeightLevel : (window.DEFAULT_OCEAN_HEIGHT_LEVEL || 2.0);

    const dataToSend = {
        waterColor: pD.waterColor,
        landColor: pD.landColor,
        continentSeed: pD.continentSeed,
        minTerrainHeight: pD.minTerrainHeight,
        maxTerrainHeight: pD.maxTerrainHeight,
        oceanHeightLevel: pD.oceanHeightLevel,
    };

    // **** THIS IS THE CRUCIAL ORIGINAL DEBUG LOGGING (renamed for clarity) ****
    console.log(`[DEBUG_RPV_PARAMS] For canvas: "${canvasId}"`,
        `Seed: ${dataToSend.continentSeed.toFixed(4)}, ` +
        `OceanLvl: ${dataToSend.oceanHeightLevel.toFixed(2)}, ` +
        `MinH: ${dataToSend.minTerrainHeight.toFixed(2)}, ` +
        `MaxH: ${dataToSend.maxTerrainHeight.toFixed(2)}`
    );

    let radiusOverride;
    if (canvasId === 'designer-planet-canvas' || canvasId.startsWith('planet-icon-canvas-')) {
        radiusOverride = Math.min(targetCanvas.width, targetCanvas.height) / 2 * 0.9;
    } 
    // For planet-detail-view-canvas, radiusOverride is NOT set here by default,
    // so the worker will use Math.min(canvasWidth, canvasHeight) / 2 * 0.9;
    // This should be fine as planet-detail-view-canvas is expected to be square-ish.

    // **** AGGRESSIVE DEBUG LOG - BEFORE POSTMESSAGE ****
    console.log("%%% RPV_DEBUG %%% About to postMessage to worker for " + canvasId);

    workerToUse.postMessage({
        cmd: 'renderPlanet',
        planetData: dataToSend,
        rotationQuaternion,
        canvasWidth: targetCanvas.width,
        canvasHeight: targetCanvas.height,
        senderId: canvasId,
        planetRadiusOverride: radiusOverride
    });

    // **** AGGRESSIVE DEBUG LOG - AFTER POSTMESSAGE ****
    console.log("%%% RPV_DEBUG %%% Message posted to worker for " + canvasId);
  };


  function switchToPlanetDesignerScreen() { /* ... as before ... */  }
  function updateDerivedConstants() { /* ... as before ... */ }
  window.saveGameState = function () { /* ... as before ... */ }
  function loadGameState() { /* ... as before ... */ }
  function saveCustomizationSettings() { /* ... as before ... */ }
  function loadCustomizationSettings() { /* ... as before ... */ }
  function resetToDefaultCustomization() { /* ... as before ... */ }
  function checkOverlap(r1, r2) { return !(r1.x + r1.width < r2.x || r2.x + r2.width < r1.x || r1.y + r1.height < r2.y || r2.y + r2.height < r1.y) }
  function getNonOverlappingPositionInCircle(circleRadius, objectDiameter, existingRects) { /* ... placeholder ... */ return { x:0, y:0 };}
  function getWeightedNumberOfConnections() { /* ... placeholder ... */ return 1; }
  function adjustColor(hex, amount) { /* ... placeholder ... */ return hex; }


    // --- UPDATE setActiveScreen ---
  window.setActiveScreen = function(screenToShow) {
    // Add the new screen to the list
    [mainScreen, galaxyDetailScreen, solarSystemScreen, planetDesignerScreen, planetDetailViewScreen].forEach(s => {
      if (s) s.classList.remove('active', 'panning-active');
    });
    if (screenToShow) { screenToShow.classList.add('active'); }

    if (zoomControlsElement) {
      zoomControlsElement.classList.toggle('visible', screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen);
    }
    const isOnOverlayScreen = screenToShow === planetDesignerScreen || screenToShow === planetDetailViewScreen;
    
    if (regenerateUniverseButton) regenerateUniverseButton.style.display = isOnOverlayScreen ? 'none' : 'block';
    if (createPlanetDesignButton) createPlanetDesignButton.style.display = isOnOverlayScreen ? 'none' : 'block';

    if (screenToShow !== solarSystemScreen && planetVisualPanel.classList.contains('visible')) {
        if(screenToShow !== planetDetailViewScreen || !currentPlanetDisplayedInPanel) { 
             planetVisualPanel.classList.remove('visible');
             // currentPlanetDisplayedInPanel = null; // Let panel button clear this
        }
    }
     if (screenToShow === planetDetailViewScreen) { 
          planetVisualPanel.classList.remove('visible');
     }

    if (screenToShow !== solarSystemScreen && typeof isSolarSystemAnimationRunning === 'function' && isSolarSystemAnimationRunning()) {
        stopSolarSystemAnimation();
    } else if (screenToShow === solarSystemScreen && typeof isSolarSystemAnimationRunning === 'function' && !isSolarSystemAnimationRunning()) {
        // This might be needed if animation was stopped and we return to solar system screen
        // startSolarSystemAnimation(); // Be careful, it has its own internal checks
    }
  }
  window.mainScreen = mainScreen;

  function generateUniverseLayout() { /* ... placeholder ... */ if(universeCircle) universeCircle.style.width = '600px'; universeCircle.style.height = '600px'; window.gameSessionData.universe.diameter = 600;}
  function generateGalaxies() { /* ... placeholder ... */ }
  function tryAddConnection(fromId, toId, currentConnectionsArray, connectionCountObj, allSolarSystemsList, maxDistanceLimit) { /* ... placeholder ... */ }
  function generateSolarSystemsForGalaxy(galaxyId) { /* ... placeholder ... */ }
  async function preGenerateAllGalaxyContents() { /* ... placeholder ... */ }
  function renderMainScreen() { /* ... placeholder ... */ }
  function drawGalaxyLines(galaxy) { /* ... placeholder ... */ }
  function renderGalaxyDetailScreen(isInteractive = false) { /* ... placeholder ... */ }
  function drawAllOrbits() { /* ... placeholder ... */ }
  function renderSolarSystemScreen(isInteractive = false) { /* ... placeholder ... */ }
  function switchToMainView() {
    window.gameSessionData.activeGalaxyId = null; window.gameSessionData.activeSolarSystemId = null;
    currentPlanetForDetailView = null; // Clear detail view context
    if (typeof stopSolarSystemAnimation === 'function') stopSolarSystemAnimation(); 
    window.setActiveScreen(mainScreen);
  }
  function makeTitleEditable(titleTextElement, inputElement, onSaveCallback) { /* ... placeholder ... */ }
  function switchToGalaxyDetailView(galaxyId) {
    const g = window.gameSessionData.galaxies.find(gl => gl.id === galaxyId); 
    // if (!g) { switchToMainView(); return; } // Simplified for now
    window.gameSessionData.activeGalaxyId = galaxyId; 
    // const dId = g.id.split('-').pop();
    if (backToGalaxyButton) backToGalaxyButton.textContent = `← Galaxy ${galaxyId}`; // Simplified
    window.gameSessionData.activeSolarSystemId = null;
    currentPlanetForDetailView = null; 
    if (typeof stopSolarSystemAnimation === 'function') stopSolarSystemAnimation(); 
    // g.currentZoom = g.currentZoom || 1.0; g.currentPanX = g.currentPanX || 0; g.currentPanY = g.currentPanY || 0;
    if (galaxyDetailTitleText) { galaxyDetailTitleText.textContent = `Galaxy ${galaxyId}`; galaxyDetailTitleText.style.display = 'inline-block'; } 
    if (galaxyDetailTitleInput) galaxyDetailTitleInput.style.display = 'none';
    window.setActiveScreen(galaxyDetailScreen);
    // ... more logic needed here from original ...
  }

  // --- NEW FUNCTION: switchToPlanetDetailView ---
  function switchToPlanetDetailView(planetData) {
    if (!planetData || !planetDetailViewScreen || !planetDetailViewCanvas || !planetDetailViewTitleText) {
      console.error("[switchToPlanetDetailView] Cannot switch: missing planet data or DOM elements.");
      return;
    }
    currentPlanetForDetailView = planetData; 

    console.log("[switchToPlanetDetailView] Switching to detail view for planet:", planetData.planetName);
    console.log("[switchToPlanetDetailView] Planet visual data to use:", planetData.visuals);


    planetDetailViewTitleText.textContent = planetData.planetName || "Planet Details";
    window.setActiveScreen(planetDetailViewScreen); // This handles hiding the panel

    const contentBox = document.getElementById('planet-detail-view-content'); // Make sure this div exists
    const desiredSize = Math.min(contentBox.offsetWidth, contentBox.offsetHeight, 1600); 
    
    planetDetailViewCanvas.width = desiredSize > 0 ? desiredSize : 800; // Fallback size
    planetDetailViewCanvas.height = desiredSize > 0 ? desiredSize : 800; // Fallback size

    console.log(`[switchToPlanetDetailView] Canvas size set to: ${planetDetailViewCanvas.width}x${planetDetailViewCanvas.height}`);

    const rotationForDetailView = quat_identity(); // Default, non-rotated view for detail map

    if (window.renderPlanetVisual && planetData.visuals) { 
      window.renderPlanetVisual(planetData.visuals, rotationForDetailView, planetDetailViewCanvas);
    } else {
      console.error("[switchToPlanetDetailView] renderPlanetVisual or planetData.visuals is missing. Cannot render.");
    }
  }


  function switchToSolarSystemView(solarSystemId) {
    window.gameSessionData.activeSolarSystemId = solarSystemId;
    currentPlanetForDetailView = null; // Clear detail view context
    const gPM = solarSystemId.match(/^(galaxy-\d+)-ss-\d+$/), gP = gPM ? gPM[1] : null;
    const aG = gP ? window.gameSessionData.galaxies.find(g => g.id === gP) : null;
    let sSO = null; if (aG && aG.solarSystems) sSO = aG.solarSystems.find(s => s.id === solarSystemId);

    window.gameSessionData.solarSystemView.zoomLevel = 0.5;
    window.gameSessionData.solarSystemView.currentPanX = 0;
    window.gameSessionData.solarSystemView.currentPanY = 0;
    window.gameSessionData.solarSystemView.systemId = solarSystemId;
    if (solarSystemContent) solarSystemContent.innerHTML = ''; 

    let currentSunSize = SUN_ICON_SIZE;
    if (sSO && typeof sSO.sunSizeFactor === 'number') currentSunSize = SUN_ICON_SIZE * sSO.sunSizeFactor;
    currentSunSize = Math.max(currentSunSize, 15);
    const sunElement = document.createElement('div');
    sunElement.className = 'sun-icon sun-animated';
    sunElement.style.width = `${currentSunSize}px`;
    sunElement.style.height = `${currentSunSize}px`;
    // const coreColor = FIXED_COLORS.sunFill, midColor = FIXED_COLORS.sunBorder, edgeColor = adjustColor(FIXED_COLORS.sunBorder, -40), actualBorderColor = FIXED_COLORS.sunBorder;
    // sunElement.style.setProperty('--sun-core-color', coreColor); sunElement.style.setProperty('--sun-mid-color', midColor); sunElement.style.setProperty('--sun-edge-color', edgeColor); sunElement.style.setProperty('--sun-actual-border-color', actualBorderColor);
    if (solarSystemContent) solarSystemContent.appendChild(sunElement);

    solarSystemOrbitCanvasEl = document.createElement('canvas');
    solarSystemOrbitCanvasEl.id = 'solar-system-orbit-canvas';
    solarSystemOrbitCanvasEl.width = ORBIT_CANVAS_SIZE;
    solarSystemOrbitCanvasEl.height = ORBIT_CANVAS_SIZE;
    if (solarSystemContent) solarSystemContent.appendChild(solarSystemOrbitCanvasEl);
    orbitCtx = solarSystemOrbitCanvasEl.getContext('2d');

    window.gameSessionData.solarSystemView.planets = [];
    let usedDistances = [];
    const numPlanetsToGenerate = Math.floor(Math.random() * (currentMaxPlanets - currentMinPlanets + 1)) + currentMinPlanets;

    for (let i = 0; i < numPlanetsToGenerate; i++) {
      const planetSize = Math.random() * (MAX_PLANET_SIZE - MIN_PLANET_SIZE) + MIN_PLANET_SIZE;
      let planetDistance, attempts = 0;
      do {
        planetDistance = Math.floor(Math.random() * (MAX_PLANET_DISTANCE - MIN_PLANET_DISTANCE + 1)) + MIN_PLANET_DISTANCE;
        let tooClose = false;
        for (const d of usedDistances) { if (Math.abs(planetDistance - d.distance) < (MIN_ORBITAL_SEPARATION + (d.size + planetSize) / 2)) { tooClose = true; break; } }
        if (!tooClose) break; attempts++;
      } while (attempts < 200);
      if (attempts === 200) continue; 
      usedDistances.push({ distance: planetDistance, size: planetSize });

      const basisToUse = (window.gameSessionData.customPlanetDesigns.length > 0) ?
        window.gameSessionData.customPlanetDesigns[Math.floor(Math.random() * window.gameSessionData.customPlanetDesigns.length)]
        : { waterColor: '#0077be', landColor: '#3A5F0B', continentSeed: Math.random(), minTerrainHeightRange: [0.0, 1.0], maxTerrainHeightRange: [5.0, 8.0], oceanHeightRange: [1.0, 3.0] };
      
      const planetVisualProperties = window.generatePlanetInstanceFromBasis(basisToUse, false);
        
      const initialOrbitalAngle = Math.random() * 2 * Math.PI;
      const orbitalSpeed = Math.random() * (MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT - MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT) + MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT;
      const initialAxialAngle = Math.random() * 2 * Math.PI;
      const axialSpeed = window.DEFAULT_PLANET_AXIAL_SPEED;

      const newPlanet = {
        id: `planet-${solarSystemId}-${i}`, 
        size: planetSize,
        distance: planetDistance,
        currentOrbitalAngle: initialOrbitalAngle,
        orbitalSpeed: orbitalSpeed,
        currentAxialAngle: initialAxialAngle,
        axialSpeed: axialSpeed,
        element: null,
        iconCanvasElement: null, 
        planetName: `Planet ${i + 1}`, 
        type: 'terrestrial', 
        visuals: planetVisualProperties, 
        sourceDesignId: basisToUse.designId || null
      };
      window.gameSessionData.solarSystemView.planets.push(newPlanet);

      const planetElement = document.createElement('div');
      planetElement.classList.add('planet-icon');
      if (planetVisualPanel) planetElement.classList.add('clickable-when-paused');
      planetElement.style.width = `${newPlanet.size}px`;
      planetElement.style.height = `${newPlanet.size}px`;
      planetElement.style.position = 'absolute'; 

      const iconCanvas = document.createElement('canvas');
      const iconRenderResolutionFactor = 2; 
      iconCanvas.width = Math.round(newPlanet.size * iconRenderResolutionFactor);
      iconCanvas.height = Math.round(newPlanet.size * iconRenderResolutionFactor);
      iconCanvas.style.width = '100%'; 
      iconCanvas.style.height = '100%';
      iconCanvas.style.borderRadius = '50%';
      iconCanvas.id = `planet-icon-canvas-${newPlanet.id}`; 
      newPlanet.iconCanvasElement = iconCanvas; 
      planetElement.appendChild(iconCanvas);
        
      planetElement.style.boxShadow = `0 0 ${newPlanet.size / 4}px rgba(100,100,150,0.4)`;

      planetElement.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!planetVisualPanel || !planetVisualTitle || !planetVisualSize || !planetVisualCanvas) {
          console.error("Panel elements missing for planet click"); return;
        }
        const wasVisible = planetVisualPanel.classList.contains('visible');
        currentPlanetDisplayedInPanel = newPlanet; 
        planetVisualTitle.textContent = newPlanet.planetName;
        planetVisualSize.textContent = Math.round(newPlanet.size);
        planetVisualPanel.classList.add('visible');
        if (!wasVisible) {
          planetVisualPanel.style.left = '50%'; planetVisualPanel.style.top = '50%';
          planetVisualPanel.style.transform = 'translate(-50%, -50%)'; planetVisualPanel.style.transition = '';
        } else { planetVisualPanel.style.transition = 'none'; }
        planetVisualRotationQuat = quat_identity();
        window.renderPlanetVisual(newPlanet.visuals, planetVisualRotationQuat, planetVisualCanvas);
      });

      if (solarSystemContent) solarSystemContent.appendChild(planetElement);
      newPlanet.element = planetElement;

      if (planetVisualWorker && newPlanet.iconCanvasElement) {
        const tryRenderIcon = (canvasElementToRenderOn, visualDataForIcon) => {
          if (canvasElementToRenderOn.width > 0 && canvasElementToRenderOn.height > 0) {
            window.renderPlanetVisual(visualDataForIcon, quat_identity(), canvasElementToRenderOn);
          } else {
            console.warn(`[switchToSolarSystemView] Icon canvas ${canvasElementToRenderOn.id} not sized (W:${canvasElementToRenderOn.width}, H:${canvasElementToRenderOn.height}). Retrying render.`);
            requestAnimationFrame(() => tryRenderIcon(canvasElementToRenderOn, visualDataForIcon));
          }
        };
        tryRenderIcon(newPlanet.iconCanvasElement, newPlanet.visuals);
      }
    }
      
    const sysIdSuffix = solarSystemId.substring(solarSystemId.lastIndexOf('-') + 1);
    if (solarSystemTitleText) solarSystemTitleText.textContent = (sSO && sSO.customName) ? sSO.customName : `System ${sysIdSuffix}`;
    if (solarSystemTitleInput) solarSystemTitleInput.style.display = 'none';

    window.setActiveScreen(solarSystemScreen);
    // makeTitleEditable(...); // Placeholder for now
    renderSolarSystemScreen(false); 
    if (typeof startSolarSystemAnimation === 'function') startSolarSystemAnimation();   
  }

  function clampSolarSystemPan(dO,vW,vH){ /* ... placeholder ... */ }
  function clampGalaxyPan(g){ /* ... placeholder ... */ }
  function handleZoom(dir,mE=null){ /* ... placeholder ... */ }
  function startPan(e,vEl,cEl,dObjR){ /* ... placeholder ... */ }
  function panMouseMove(e){ /* ... placeholder ... */ }
  function panMouseUp(){ /* ... placeholder ... */ }
  function regenerateCurrentUniverseState(force=false){ 
    if (!force && !confirm("This will erase your current universe and generate a new one. Custom planet designs will be kept. Are you sure?")) return;
    localStorage.removeItem('galaxyGameSaveData'); 
    // ... (rest of the reset logic as before) ...
    if (typeof stopSolarSystemAnimation === 'function') stopSolarSystemAnimation(); 
    initializeGame(true); 
  }


  // --- EVENT LISTENERS ---
  if (regenerateUniverseButton) regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(false));
  if (createPlanetDesignButton) createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);
  if (closePlanetVisualPanelBtn) {
    closePlanetVisualPanelBtn.addEventListener('click', () => {
      if (planetVisualPanel) planetVisualPanel.classList.remove('visible');
      currentPlanetDisplayedInPanel = null; // Clear when panel is closed
    });
  }

  // --- NEW Event Listener for "View Full Map" button ---
  if (viewFullPlanetMapButton) {
    viewFullPlanetMapButton.addEventListener('click', () => {
      if (currentPlanetDisplayedInPanel) {
        console.log("[ViewFullMapButton] Clicked. Current planet:", currentPlanetDisplayedInPanel.planetName);
        switchToPlanetDetailView(currentPlanetDisplayedInPanel);
      } else {
        console.warn("[ViewFullMapButton] Clicked, but no currentPlanetDisplayedInPanel is set.");
      }
    });
  }

  // --- NEW Event Listener for "Back to Solar System" from detail view ---
  if (backToSolarSystemFromDetailButton) {
    backToSolarSystemFromDetailButton.addEventListener('click', () => {
      if (window.gameSessionData.activeSolarSystemId) {
        console.log("[BackToSolarSystem] Current active solar system:", window.gameSessionData.activeSolarSystemId);
        switchToSolarSystemView(window.gameSessionData.activeSolarSystemId); 
      } else if (window.gameSessionData.activeGalaxyId) {
        console.warn("[BackToSolarSystem] No active solar system ID, going to active galaxy.");
        switchToGalaxyDetailView(window.gameSessionData.activeGalaxyId);
      } else {
        console.warn("[BackToSolarSystem] No active solar system or galaxy ID, going to main view.");
        switchToMainView();
      }
      currentPlanetForDetailView = null; 
    });
  }
  
  let isPanelDragging = false; let visualPanelOffset = { x: 0, y: 0 };
  // Removed placeholder event listeners for panelHeader, PVisualCanvas, to avoid conflict with PlanetVisualPanelManager.js provided earlier.
  // It's assumed PlanetVisualPanelManager.js handles its own dragging if it's being used.
  // If not, those listeners would need to be restored or correctly integrated.

  window.addEventListener('mousemove', (e) => { panMouseMove(e); });
  window.addEventListener('mouseup', () => { panMouseUp(); });

  function initializeGame(isForcedRegeneration = false) {
    loadCustomizationSettings(); 
    // ... (rest of your initializeGame logic, ensure it calls generateUniverseLayout etc.)
    // For this example, let's make it simpler:
    if (!isForcedRegeneration && loadGameState()){
        // Simplified load path
    } else {
        generateUniverseLayout();
        generateGalaxies(); // Ensure this generates some basic data
    }
     window.setActiveScreen(mainScreen);
     renderMainScreen(); // Ensure this can render something
     // preGenerateAllGalaxyContents(); 
    window.gameSessionData.isInitialized = true;
  }

  window.addEventListener('resize', () => { 
    if (typeof stopSolarSystemAnimation === 'function') stopSolarSystemAnimation(); 
    // ... add logic to re-render current view if necessary ... 
    if (planetDetailViewScreen.classList.contains('active') && currentPlanetForDetailView) {
        // Re-calculate canvas size and re-render for planet detail view
        const contentBox = document.getElementById('planet-detail-view-content');
        if (contentBox) {
            const desiredSize = Math.min(contentBox.offsetWidth, contentBox.offsetHeight, 1600);
            planetDetailViewCanvas.width = desiredSize > 0 ? desiredSize : 800;
            planetDetailViewCanvas.height = desiredSize > 0 ? desiredSize : 800;
            if (window.renderPlanetVisual && currentPlanetForDetailView.visuals) {
               window.renderPlanetVisual(currentPlanetForDetailView.visuals, quat_identity(), planetDetailViewCanvas);
            }
        }
    }
  });
  if (backToMainButton) backToMainButton.addEventListener('click', switchToMainView);
  if (backToGalaxyButton) backToGalaxyButton.addEventListener('click', () => { 
    if(window.gameSessionData.activeGalaxyId) { // Need to get parent galaxy of current SS
        // This simplistic approach assumes activeGalaxyId is set when in SS view
        // A better way would be to extract galaxyId from solarSystemId
        const solarSystemId = window.gameSessionData.activeSolarSystemId;
        const match = solarSystemId ? solarSystemId.match(/^(galaxy-\d+)-ss-\d+$/) : null;
        const parentGalaxyId = match ? match[1] : window.gameSessionData.activeGalaxyId;
        if (parentGalaxyId) {
             switchToGalaxyDetailView(parentGalaxyId);
        } else {
            switchToMainView();
        }
    } else {
        switchToMainView();
    }
  });
  if (zoomInButton) zoomInButton.addEventListener('click', (e) => handleZoom('in', e));
  if (zoomOutButton) zoomOutButton.addEventListener('click', (e) => handleZoom('out', e));
  
  if(galaxyViewport) galaxyViewport.addEventListener('wheel', (e) => { handleZoom(e.deltaY > 0 ? 'out' : 'in', e); e.preventDefault(); });
  if(solarSystemScreen) solarSystemScreen.addEventListener('wheel', (e) => { handleZoom(e.deltaY > 0 ? 'out' : 'in', e); e.preventDefault(); });
  
  if(galaxyViewport) galaxyViewport.addEventListener('mousedown', (e) => { startPan(e, galaxyViewport, galaxyZoomContent, window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId) || {}); });
  if(solarSystemScreen) solarSystemScreen.addEventListener('mousedown', (e) => { startPan(e, solarSystemScreen, solarSystemContent, window.gameSessionData.solarSystemView); });
    
  // --- INITIALIZATION ---
  console.log("script.js: Attempting to initialize PlanetDesigner.");
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
    // console.warn("script.js: PlanetVisualPanelManager module not found or init function is missing.");
    // If not using the manager, the simplified panel logic in script.js might be sufficient for now.
  }
    
  initializeGame();
});

// Many placeholder functions like generateUniverseLayout, renderMainScreen, etc. need to be
// filled with their original logic if you want the full game functionality beyond this new screen.
// The quat_identity function is also assumed to exist from mathUtils.js
