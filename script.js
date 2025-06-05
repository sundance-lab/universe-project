// script.js

// Import animation functions from animationController.js
import { startSolarSystemAnimation, stopSolarSystemAnimation } from './animationController.js';

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
  window.DEFAULT_PLANET_AXIAL_SPEED = 0.01; // Made global for wider access if needed

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
      // sourceDesignId is no longer returned here; it's handled at the planet creation site if needed.
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
        } else if (senderId && senderId.startsWith('planet-icon-canvas-')) { 
          targetCanvasElement = document.getElementById(senderId);
        }

        if (targetCanvasElement) {
          const ctx = targetCanvasElement.getContext('2d');
          if (!ctx) {
            console.error(`Failed to get 2D context from targetCanvas: ${senderId}`);
            if (senderId === 'planet-visual-canvas') isRenderingVisualPlanet = false;
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
        } else if (senderId && senderId.startsWith('planet-icon-canvas-')) {
          // console.warn(`[planetVisualWorker] Icon canvas ${senderId} not found for message (likely view changed).`);
        }

        if (senderId === 'planet-visual-canvas') {
          isRenderingVisualPlanet = false;
          if (needsPlanetVisualRerender && currentPlanetDisplayedInPanel && planetVisualPanel.classList.contains('visible')) {
            needsPlanetVisualRerender = false;
            // Ensure the panel uses the consistent 'visuals' sub-object too
            if (currentPlanetDisplayedInPanel.visuals) {
                renderPlanetVisual(currentPlanetDisplayedInPanel.visuals, planetVisualRotationQuat, planetVisualCanvas);
            } else {
                // Fallback or error for older planets if migration wasn't perfect.
                // This path might be hit if a planet was saved before the 'visuals' sub-object change.
                // For now, use the planet object directly and hope for the best, or log an error.
                console.warn("[planetVisualWorker.onmessage] currentPlanetDisplayedInPanel missing 'visuals' sub-object for rerender. Using planet root.");
                renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas);
            }
          }
        }
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
                     (targetCanvas.id.startsWith('planet-icon-canvas-') ? planetVisualWorker : window.designerWorker);

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
        // For zero-dimension icons, let's try to defer via rAF
        if (canvasId.startsWith('planet-icon-canvas-')) {
            console.log(`%%% RPV_DEBUG %%% Deferring render for zero-dim icon ${canvasId} via rAF.`);
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

    // **** THIS IS THE CRUCIAL ORIGINAL DEBUG LOGGING ****
    console.log(`[renderPlanetVisual] Preparing to render for canvas: "${canvasId}"`,
        `Seed: ${dataToSend.continentSeed.toFixed(4)}, ` +
        `OceanLvl: ${dataToSend.oceanHeightLevel.toFixed(2)}, ` +
        `MinH: ${dataToSend.minTerrainHeight.toFixed(2)}, ` +
        `MaxH: ${dataToSend.maxTerrainHeight.toFixed(2)}`
    );

    let radiusOverride;
    if (canvasId === 'designer-planet-canvas' || canvasId.startsWith('planet-icon-canvas-')) {
        radiusOverride = Math.min(targetCanvas.width, targetCanvas.height) / 2 * 0.9;
    }

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
  function switchToPlanetDesignerScreen() {
    setActiveScreen(planetDesignerScreen);
    if (window.PlanetDesigner && typeof window.PlanetDesigner.activate === 'function') {
      window.PlanetDesigner.activate();
    } else {
      console.error("PlanetDesigner module or activate function not found.");
    }
  }

  function updateDerivedConstants() { /* ... as before ... */ }
  window.saveGameState = function () { /* ... as before ... */ }
  function loadGameState() { /* ... as before ... */ }
  function saveCustomizationSettings() { /* ... as before ... */ }
  function loadCustomizationSettings() { /* ... as before ... */ }
  function resetToDefaultCustomization() { /* ... as before ... */ }
  function checkOverlap(r1, r2) { /* ... as before ... */ }
  function getNonOverlappingPositionInCircle(circleRadius, objectDiameter, existingRects) { /* ... as before ... */ }
  function getWeightedNumberOfConnections() { /* ... as before ... */ }
  function adjustColor(hex, amount) { /* ... as before ... */ }
  window.setActiveScreen = function(screenToShow) { /* ... as before (ensure includes stopSolarSystemAnimation for solarSystemScreen)... */ }
  window.mainScreen = mainScreen; // Already exists

  function generateUniverseLayout() { /* ... as before ... */ }
  function generateGalaxies() { /* ... as before ... */ }
  function tryAddConnection(fromId, toId, currentConnectionsArray, connectionCountObj, allSolarSystemsList, maxDistanceLimit) { /* ... as before ... */ }
  function generateSolarSystemsForGalaxy(galaxyId) { /* ... as before ... */ }
  async function preGenerateAllGalaxyContents() { /* ... as before ... */ }
  function renderMainScreen() { /* ... as before ... */ }
  function drawGalaxyLines(galaxy) { /* ... as before ... */ }
  function renderGalaxyDetailScreen(isInteractive = false) { /* ... as before ... */ }
  function drawAllOrbits() { /* ... as before ... */ }
  function renderSolarSystemScreen(isInteractive = false) { /* ... as before ... */ }
  function switchToMainView() { /* ... as before ... */ }
  function makeTitleEditable(titleTextElement, inputElement, onSaveCallback) { /* ... as before ... */ }
  function switchToGalaxyDetailView(galaxyId) { /* ... as before ... */ }

  function switchToSolarSystemView(solarSystemId) {
    window.gameSessionData.activeSolarSystemId = solarSystemId;
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
    const coreColor = FIXED_COLORS.sunFill, midColor = FIXED_COLORS.sunBorder, edgeColor = adjustColor(FIXED_COLORS.sunBorder, -40), actualBorderColor = FIXED_COLORS.sunBorder;
    sunElement.style.setProperty('--sun-core-color', coreColor); sunElement.style.setProperty('--sun-mid-color', midColor); sunElement.style.setProperty('--sun-edge-color', edgeColor); sunElement.style.setProperty('--sun-actual-border-color', actualBorderColor);
    if (solarSystemContent) solarSystemContent.appendChild(sunElement);

    solarSystemOrbitCanvasEl = document.createElement('canvas');
    solarSystemOrbitCanvasEl.id = 'solar-system-orbit-canvas';
    solarSystemOrbitCanvasEl.width = ORBIT_CANVAS_SIZE;
    solarSystemOrbitCanvasEl.height = ORBIT_CANVAS_SIZE;
    if (solarSystemContent) solarSystemContent.appendChild(solarSystemOrbitCanvasEl);
    orbitCtx = solarSystemOrbitCanvasEl.getContext('2d');

    window.gameSessionData.solarSystemView.planets = [];
    let usedDistances = [];
    const numPlanets = Math.floor(Math.random() * (currentMaxPlanets - currentMinPlanets + 1)) + currentMinPlanets;

    for (let i = 0; i < numPlanets; i++) {
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
      
        // Generate the core visual properties for this planet instance ONCE
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
          visuals: planetVisualProperties, // Store the single source of truth for visual parameters
        sourceDesignId: basisToUse.designId || null // Keep track of the original design ID if any
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
          // Pass the consistent 'visuals' object to the panel renderer
        window.renderPlanetVisual(newPlanet.visuals, planetVisualRotationQuat, planetVisualCanvas);
      });

      if (solarSystemContent) solarSystemContent.appendChild(planetElement);
      newPlanet.element = planetElement;

      if (planetVisualWorker && newPlanet.iconCanvasElement) {
        // Use the consistent 'visuals' object for icon rendering
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
    makeTitleEditable(solarSystemTitleText, solarSystemTitleInput, (newName) => { 
      if (sSO) { 
        sSO.customName = newName || null; 
        window.saveGameState(); 
        renderGalaxyDetailScreen(); 
        return sSO.customName || `System ${sysIdSuffix}`; 
      } return `System ${sysIdSuffix}`; 
    });
    renderSolarSystemScreen(false); 
    startSolarSystemAnimation();   
  }

  function clampSolarSystemPan(dO,vW,vH){ /* ... as before ... */ }
  function clampGalaxyPan(g){ /* ... as before ... */ }
  function handleZoom(dir,mE=null){ /* ... as before ... */ }
  function startPan(e,vEl,cEl,dObjR){ /* ... as before ... */ }
  function panMouseMove(e){ /* ... as before ... */ }
  function panMouseUp(){ /* ... as before ... */ }
  function regenerateCurrentUniverseState(force=false){ /* ... as before (ensure stopSolarSystemAnimation is called) ... */ }

  // --- EVENT LISTENERS ---
  if (regenerateUniverseButton) regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(false));
  if (createPlanetDesignButton) createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);
  if (closePlanetVisualPanelBtn) closePlanetVisualPanelBtn.addEventListener('click', () => { if (planetVisualPanel) planetVisualPanel.classList.remove('visible'); currentPlanetDisplayedInPanel = null; });
   
  let isPanelDragging = false; let visualPanelOffset = { x: 0, y: 0 };
  if (planetVisualPanelHeader) planetVisualPanelHeader.addEventListener('mousedown', (e) => { /* ... panel mousedown ... */ });
  if (planetVisualCanvas) planetVisualCanvas.addEventListener('mousedown', (e) => { /* ... visual canvas mousedown ... */ });

  window.addEventListener('mousemove', (e) => { /* ... existing mousemove logic ... */ panMouseMove(e); });
  window.addEventListener('mouseup', () => { /* ... existing mouseup logic ... */ panMouseUp(); });
  function initializeGame(isForcedRegeneration = false) {  /* ... as before (ensure stopSolarSystemAnimation is called appropriately) ... */ }
  window.addEventListener('resize', () => { /* ... as before, ensure stopSolarSystemAnimation is called ... */ });
  if (backToMainButton) backToMainButton.addEventListener('click', switchToMainView);
  if (backToGalaxyButton) backToGalaxyButton.addEventListener('click', () => { /* ... (needs activeGalaxyId access for context) ... */ });
  if (zoomInButton) zoomInButton.addEventListener('click', (e) => handleZoom('in', e));
  if (zoomOutButton) zoomOutButton.addEventListener('click', (e) => handleZoom('out', e));
  if(galaxyViewport) galaxyViewport.addEventListener('wheel', (e) => { /* ... */ });
  if(solarSystemScreen) solarSystemScreen.addEventListener('wheel', (e) => { /* ... */ });
  if(galaxyViewport) galaxyViewport.addEventListener('mousedown', (e) => { /* ... */ });
  if(solarSystemScreen) solarSystemScreen.addEventListener('mousedown', (e) => { /* ... */ });
   
  // --- INITIALIZATION ---
  console.log("script.js: Attempting to initialize PlanetDesigner.");
  if (window.PlanetDesigner && typeof window.PlanetDesigner.init === 'function') {
    window.PlanetDesigner.init();
    console.log("script.js: PlanetDesigner.init() called.");
  } else {
    console.error("script.js: PlanetDesigner module not found or init function is missing.");
  }
   
  initializeGame();
});
