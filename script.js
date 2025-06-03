// script.js (Finalized Panel Rotation & Drag with Quaternion-based Rotation)
console.log("Script V1.3.10.2 (Full Enhancements) Loaded.");
document.addEventListener('DOMContentLoaded', () => {
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
  const planetVisualCanvas = document.getElementById('planet-visual-canvas');
  const designerPlanetCanvas = document.getElementById('designer-planet-canvas');
  const designerWaterColorInput = document.getElementById('designer-water-color');
  const designerLandColorInput = document.getElementById('designer-land-color');
  const designerRandomizeBtn = document.getElementById('designer-randomize-btn');
  const designerSaveBtn = document.getElementById('designer-save-btn');
  const designerCancelBtn = document.getElementById('designer-cancel-btn');
  const savedDesignsUl = document.getElementById('saved-designs-ul');
  let linesCtx;
  let solarSystemOrbitCanvasEl;
  let orbitCtx;
  let animationFrameId = null;
  let lastAnimationTime = null;
  let isSolarSystemPaused = false;
  let isDraggingPlanetVisual = false;
  let isDraggingDesignerPlanet = false;

  // --- Quaternion Math Utilities (Copied from worker and simplified for client where inverse is not needed) ---
  /**
  * Represents a quaternion as [w, x, y, z]
  */

  // Identity quaternion (no rotation)
  function quat_identity() {
    return [1, 0, 0, 0];
  }

  // Create a quaternion from an axis and an angle (radians)
  function quat_from_axis_angle(axis, angle) {
    const halfAngle = angle * 0.5;
    const s = Math.sin(halfAngle);
    return [
      Math.cos(halfAngle), // w
      axis[0] * s,       // x
      axis[1] * s,       // y
      axis[2] * s        // z
    ];
  }

  // Multiply two quaternions: q1 * q2
  function quat_multiply(q1, q2) {
    const w1 = q1[0], x1 = q1[1], y1 = q1[2], z1 = q1[3];
    const w2 = q2[0], x2 = q2[1], y2 = q2[2], z2 = q2[3];

    return [
      w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2, // w
      w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2, // x
      w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2, // y
      w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2  // z
    ];
  }

  // Normalize a quaternion
  function quat_normalize(q) {
    let len_sq = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
    if (len_sq === 0) return [1, 0, 0, 0]; // Return identity if zero length
    let len = 1 / Math.sqrt(len_sq);
    return [q[0] * len, q[1] * len, q[2] * len, q[3] * len];
  }

  // --- End Quaternion Math Utilities ---

  // New: Quaternion to track planet rotation for the visual panel
  let planetVisualRotationQuat = quat_identity();
  let startDragPlanetVisualQuat = quat_identity();

  // New: Quaternion to track designer planet rotation
  let designerPlanetRotationQuat = quat_identity();
  let startDragDesignerPlanetQuat = quat_identity();
  let designerStartDragMouseX = 0;
  let designerStartDragMouseY = 0;

  let startDragMouseX = 0;
  let startDragMouseY = 0;

  let currentPlanetDisplayedInPanel = null;

  const DEFAULT_NUM_GALAXIES = 3;
  const DEFAULT_MIN_SS_COUNT_CONST = 200;
  const DEFAULT_MAX_SS_COUNT_CONST = 300;
  const DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER = 1.0;
  const DEFAULT_MIN_PLANETS_PER_SYSTEM = 0;
  const DEFAULT_MAX_PLANETS_PER_SYSTEM = 3;
  const DEFAULT_SHOW_PLANET_ORBITS = false;
  const DEFAULT_PLANET_AXIAL_SPEED = 0.01; // Radians per some internal tick/update
  const BASE_MAX_PLANET_DISTANCE_FACTOR = 8;

  // NEW: Controls the overall "speed" or sensitivity of planet rotation when dragging.
  const PLANET_ROTATION_SENSITIVITY = 0.75; // Adjust this value to make rotation faster/slower

  let currentNumGalaxies = DEFAULT_NUM_GALAXIES;
  let currentMinSSCount = DEFAULT_MIN_SS_COUNT_CONST;
  let currentMaxSSCount = DEFAULT_MAX_SS_COUNT_CONST;
  let currentMaxPlanetDistanceMultiplier = DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
  let currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM;
  let currentMaxPlanets = DEFAULT_MAX_PLANETS_PER_SYSTEM;
  let currentShowPlanetOrbits = DEFAULT_SHOW_PLANET_ORBITS;
  const GALAXY_ICON_SIZE = 60; // px
  const SOLAR_SYSTEM_BASE_ICON_SIZE = 2.5; // px (relative to parent, initially)
  const SUN_ICON_SIZE = 60; // px
  const MAX_PLACEMENT_ATTEMPTS = 150;
  const GALAXY_VIEW_MIN_ZOOM = 1.0;
  const GALAXY_VIEW_MAX_ZOOM = 5.0;
  const SOLAR_SYSTEM_VIEW_MIN_ZOOM = 0.05;
  const SOLAR_SYSTEM_VIEW_MAX_ZOOM = 10.0;
  const ZOOM_STEP = 0.2; // 20% zoom per step
  const MAX_CONNECTIONS_PER_SYSTEM = 3;
  const MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS = 5;
  const MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT = 0.07; // % of galaxy diameter
  const MAX_FORCED_CONNECTION_DISTANCE_PERCENT = 0.20; // % of galaxy diameter
  const MIN_PLANET_SIZE = 5; // px
  const MAX_PLANET_SIZE = 15; // px
  let MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 1.5; // Recalculated with multiplier
  let MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier; // Recalculated
  let ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2; // Recalculated
  const SOLAR_SYSTEM_EXPLORABLE_RADIUS = 3000; // Max content boundary in solar system view
  const MIN_ORBITAL_SEPARATION = 20; // Minimum pixel separation between orbit paths (center to center)
  let MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.005; // orbital speed base
  let MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.01; // orbital speed base
  const FIXED_COLORS = { universeBg: "#100520", galaxyIconFill: "#7f00ff", galaxyIconBorder: "#da70d6", solarSystemBaseColor: "#ffd700", sunFill: "#FFD700", sunBorder: "#FFA500", connectionLine: "rgba(255, 255, 255, 0.3)" };
  let gameSessionData = { universe: { diameter: null }, galaxies: [], activeGalaxyId: null, activeSolarSystemId: null, solarSystemView: { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null }, isInitialized: false, panning: { isActive: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0, targetElement: null, viewportElement: null, dataObject: null }, customPlanetDesigns: [] };
  let renderPending = false;
  let designerRenderPending = false;

  // --- Web Worker Declarations and Initialization ---
  let planetVisualWorker = null;
  let designerWorker = null;

  if (window.Worker) { // Check for Worker support
    planetVisualWorker = new Worker('planetRendererWorker.js');
    designerWorker = new Worker('planetRendererWorker.js');

    // Worker message handlers for rendering results
    planetVisualWorker.onmessage = function(e) {
      const { renderedData, width, height, senderId } = e.data;
      if (senderId === 'planet-visual-canvas' && planetVisualCanvas) {
        const ctx = planetVisualCanvas.getContext('2d');
        ctx.clearRect(0, 0, planetVisualCanvas.width, planetVisualCanvas.height);
        if (renderedData && width && height) {
          try {
            const imageData = new ImageData(renderedData, width, height);
            ctx.putImageData(imageData, 0, 0);
          } catch (err) {
            console.error("Error putting ImageData on planetVisualCanvas:", err, "Data length:", renderedData.length, "Expected:", width * height * 4);
          }
        }
      }
    };

    designerWorker.onmessage = function(e) {
      const { renderedData, width, height, senderId } = e.data;
      if (senderId === 'designer-planet-canvas' && designerPlanetCanvas) {
        const ctx = designerPlanetCanvas.getContext('2d');
        ctx.clearRect(0, 0, designerPlanetCanvas.width, designerPlanetCanvas.height);
        if (renderedData && width && height) {
         try {
            const imageData = new ImageData(renderedData, width, height);
            ctx.putImageData(imageData, 0, 0);
          } catch (err) {
            console.error("Error putting ImageData on designerPlanetCanvas:", err, "Data length:", renderedData.length, "Expected:", width * height * 4);
          }
        }
      }
    };
  } else {
    console.warn("Web Workers not supported in this browser. Planet rendering will be disabled.");
  }
  // --- End Web Worker Declarations and Initialization ---

  class PerlinNoise { // Basic Perlin Noise Implementation
    constructor(seed = Math.random()) {
      this.p = new Array(512);
      this.permutation = new Array(256);
      this.seed = seed;
      this.initPermutationTable();
    }
    initPermutationTable() {
      for (let i = 0; i < 256; i++) {
        this.permutation[i] = i;
      }
      // Shuffle the permutation table using the seed
      for (let i = 0; i < 256; i++) {
        let r = Math.floor(this.random() * (i + 1)); // Use a seeded random
        let tmp = this.permutation[i];
        this.permutation[i] = this.permutation[r];
        this.permutation[r] = tmp;
      }
      for (let i = 0; i < 256; i++) {
        this.p[i] = this.p[i + 256] = this.permutation[i];
      }
    }
    random() { // Simple LCG for seeded random
      let x = Math.sin(this.seed++) * 10000;
      return x - Math.floor(x);
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); } // 6t^5 - 15t^4 + 10t^3
    lerp(a, b, t) { return a + t * (b - a); }
    grad(hash, x, y, z) {
      hash = hash & 15; // Ensure hash is between 0 and 15
      let u = hash < 8 ? x : y;
      let v = hash < 4 ? y : hash === 12 || hash === 14 ? x : z;
      return ((hash & 1) === 0 ? u : -u) + ((hash & 2) === 0 ? v : -v);
    }
    noise(x, y, z) {
      let floorX = Math.floor(x) & 255; // & 255 to wrap around 0-255
      let floorY = Math.floor(y) & 255;
      let floorZ = Math.floor(z) & 255;
      x -= Math.floor(x); // Relative x, y, z in cube
      y -= Math.floor(y);
      z -= Math.floor(z);
      let u = this.fade(x); // Compute fade curves for x, y, z
      let v = this.fade(y);
      let w = this.fade(z);
      let A = this.p[floorX] + floorY;
      let AA = this.p[A] + floorZ;
      let AB = this.p[A + 1] + floorZ;
      let B = this.p[floorX + 1] + floorY;
      let BA = this.p[B] + floorZ;
      let BB = this.p[B + 1] + floorZ;
      // Blend 8 gradient values
      return this.lerp(
        this.lerp(
          this.lerp(this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z), u),
          this.lerp(this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z), u),
          v
        ),
        this.lerp(
          this.lerp(this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1), u),
          this.lerp(this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1), u),
          v
        ),
        w
      );
    }
    fractalNoise(x, y, z, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
      let total = 0;
      let frequency = 1;
      let amplitude = 1;
      let maxValue = 0; // Used for normalizing result to 0.0 - 1.0
      for (let i = 0; i < octaves; i++) {
        total += this.noise(x * frequency, y * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }
      return total / maxValue; // Normalize
    }
  }
  function updateDerivedConstants() {
    MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier;
    MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 1.5 * (currentMaxPlanetDistanceMultiplier > 0.5 ? currentMaxPlanetDistanceMultiplier * 0.8 : 0.5);
    ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2; // Ensure orbits fit
  }
  function saveCustomizationSettings() {
    const settings = {
      numGalaxies: currentNumGalaxies,
      minSS: currentMinSSCount,
      maxSS: currentMaxSSCount,
      spread: currentMaxPlanetDistanceMultiplier,
      minPlanets: currentMinPlanets,
      maxPlanets: currentMaxPlanets,
      showOrbits: currentShowPlanetOrbits
    };
    localStorage.setItem('galaxyCustomizationSettings', JSON.stringify(settings));
  }
  function loadCustomizationSettings() {
    const savedSettingsString = localStorage.getItem('galaxyCustomizationSettings');
    if (savedSettingsString) {
      try {
        const loadedSettings = JSON.parse(savedSettingsString);
        currentNumGalaxies = parseInt(loadedSettings.numGalaxies, 10) || DEFAULT_NUM_GALAXIES;
        currentMinSSCount = parseInt(loadedSettings.minSS, 10) || DEFAULT_MIN_SS_COUNT_CONST;
        currentMaxSSCount = parseInt(loadedSettings.maxSS, 10) || DEFAULT_MAX_SS_COUNT_CONST;
        currentMaxPlanetDistanceMultiplier = parseFloat(loadedSettings.spread) || DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
        currentMinPlanets = parseInt(loadedSettings.minPlanets, 10); // Default handled by isNaN check below
        if (isNaN(currentMinPlanets)) currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM;
        currentMaxPlanets = parseInt(loadedSettings.maxPlanets, 10); // Default handled by isNaN check below
        if (isNaN(currentMaxPlanets)) currentMaxPlanets = DEFAULT_MAX_PLANETS_PER_SYSTEM;
        currentShowPlanetOrbits = typeof loadedSettings.showOrbits === 'boolean' ? loadedSettings.showOrbits : DEFAULT_SHOW_PLANET_ORBITS;
      } catch (e) { console.error("Error loading customization settings:", e); resetToDefaultCustomization(); }
    } else { resetToDefaultCustomization(); }
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
  function saveGameState() {
    try {
      const stateToSave = {
        universeDiameter: gameSessionData.universe.diameter,
        galaxies: gameSessionData.galaxies,
        customPlanetDesigns: gameSessionData.customPlanetDesigns
      };
      localStorage.setItem('galaxyGameSaveData', JSON.stringify(stateToSave));
    } catch (error) { console.error("Error saving game state:", error); }
  }
  function loadGameState() {
    try {
      const savedStateString = localStorage.getItem('galaxyGameSaveData');
      if (savedStateString) {
        const loadedState = JSON.parse(savedStateString);
        if (loadedState && typeof loadedState.universeDiameter === 'number' && Array.isArray(loadedState.galaxies)) {
          gameSessionData.universe.diameter = loadedState.universeDiameter;
          gameSessionData.galaxies = loadedState.galaxies;
          // Ensure all expected properties are present with defaults
          gameSessionData.galaxies.forEach(gal => {
            gal.currentZoom = gal.currentZoom || 1.0;
            gal.currentPanX = gal.currentPanX || 0;
            gal.currentPanY = gal.currentPanY || 0;
            gal.customName = gal.customName || null;
            gal.generationParams = gal.generationParams || { densityFactor: 0.8 + Math.random() * 0.4 };
            gal.solarSystems = gal.solarSystems || [];
            if (gal.solarSystems && Array.isArray(gal.solarSystems)) {
              gal.solarSystems.forEach(ss => {
                ss.customName = ss.customName || null;
              });
            }
            gal.lineConnections = gal.lineConnections || [];
          });
          gameSessionData.customPlanetDesigns = loadedState.customPlanetDesigns || [];
          return true;
        }
      }
    } catch (error) { console.error("Error loading game state:", error); localStorage.removeItem('galaxyGameSaveData'); }
    return false;
  }
  function checkOverlap(r1, r2) { return !(r1.x + r1.width < r2.x || r2.x + r2.width < r1.x || r1.y + r1.height < r2.y || r2.y + r2.height < r1.y) }
  function getNonOverlappingPositionInCircle(pr, od, exR) { let plr = pr - (od / 2) - 5; if (plr < 0) plr = 0; for (let i = 0; i < MAX_PLACEMENT_ATTEMPTS; i++) { const a = Math.random() * 2 * Math.PI, r = Math.sqrt(Math.random()) * plr, cx = pr + r * Math.cos(a), cy = pr + r * Math.sin(a), x = cx - (od / 2), y = cy - (od / 2), nr = { x, y, width: od, height: od }; if (!exR.some(er => checkOverlap(nr, er))) return { x, y } } return null }
  function getWeightedNumberOfConnections() { const e = Math.random(); return e < .6 ? 1 : e < .9 ? 2 : 3; }
  function adjustColor(e, t) { let r = parseInt(e.slice(1, 3), 16), o = parseInt(e.slice(3, 5), 16), a = parseInt(e.slice(5, 7), 16); return r = Math.max(0, Math.min(255, r + t)), o = Math.max(0, Math.min(255, o + t)), a = Math.max(0, Math.min(255, a + t)), `#${r.toString(16).padStart(2, "0")}${o.toString(16).padStart(2, "0")}${a.toString(16).padStart(2, "0")}`; }
  function setActiveScreen(screenToShow) {
    [mainScreen, galaxyDetailScreen, solarSystemScreen, planetDesignerScreen].forEach(screen => {
      if (screen) screen.classList.remove('active', 'panning-active'); // Ensure panning-active also removed
    });
    if (screenToShow) {
      screenToShow.classList.add('active');
    }
    if (zoomControlsElement) {
      if (screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen) zoomControlsElement.classList.add('visible');
      else zoomControlsElement.classList.remove('visible');
    }
    if (regenerateUniverseButton) { // Safety check if elements exist
      regenerateUniverseButton.style.display = (screenToShow === mainScreen || screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen || screenToShow === planetDesignerScreen) ? 'block' : 'none';
    }
    if (customizeGenerationButton) {
      customizeGenerationButton.style.display = (screenToShow === mainScreen || screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen || screenToShow === planetDesignerScreen) ? 'block' : 'none';
    }
    if (createPlanetDesignButton) {
      createPlanetDesignButton.style.display = (screenToShow === mainScreen || screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen || screenToShow === planetDesignerScreen) ? 'block' : 'none';
    }
    // Do not hide planet panel if the target screen is the solar system and panel is already visible
    if (!(screenToShow === solarSystemScreen && planetVisualPanel.classList.contains('visible'))) {
         planetVisualPanel.classList.remove('visible');
    }
  }
  function generateUniverseLayout() { const smd = Math.min(window.innerWidth, window.innerHeight); gameSessionData.universe.diameter = Math.max(300, smd * 0.85); if (universeCircle) { universeCircle.style.width = `${gameSessionData.universe.diameter}px`; universeCircle.style.height = `${gameSessionData.universe.diameter}px`; universeCircle.style.backgroundColor = FIXED_COLORS.universeBg; } }
  function generateGalaxies() {
    if (!gameSessionData.universe.diameter) return;
    gameSessionData.galaxies = [];
    const pr = gameSessionData.universe.diameter / 2;
    const tpr = []; // Temp placed rects
    for (let i = 0; i < currentNumGalaxies; i++) {
      const id = `galaxy-${i + 1}`, pos = getNonOverlappingPositionInCircle(pr, GALAXY_ICON_SIZE, tpr);
      if (pos && !isNaN(pos.x) && !isNaN(pos.y)) { //Ensure valid position
        gameSessionData.galaxies.push({ id, x: pos.x, y: pos.y, customName: null, solarSystems: [], lineConnections: [], layoutGenerated: false, currentZoom: 1.0, currentPanX: 0, currentPanY: 0, generationParams: { densityFactor: 0.8 + Math.random() * 0.4 } });
        tpr.push({ x: pos.x, y: pos.y, width: GALAXY_ICON_SIZE, height: GALAXY_ICON_SIZE })
      }
    }
  }
  function getDistance(sys1, sys2) { return Math.sqrt(Math.pow(sys1.centerX - sys2.centerX, 2) + Math.pow(sys1.centerY - sys2.centerY, 2)); }
  function tryAddConnection(fromId, toId, currentConnectionsArray, currentCountsObject, allSystemsLookup, maxDistanceLimit) { if (!fromId || !toId || fromId === toId || fromId === null || toId === null) return false; if ((currentCountsObject[fromId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM || (currentCountsObject[toId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM) { return false; } const key = [fromId, toId].sort().join('-'); if (currentConnectionsArray.some(conn => ([conn.fromId, conn.toId].sort().join('-') === key))) { return false; } if (maxDistanceLimit !== undefined && maxDistanceLimit !== null) { const sys1 = allSystemsLookup.find(s => s.id === fromId); const sys2 = allSystemsLookup.find(s => s.id === toId); if (sys1 && sys2 && getDistance(sys1, sys2) > maxDistanceLimit) { return false; } } return true; }
  function generateSolarSystemsForGalaxy(galaxyId) {
    const gal = gameSessionData.galaxies.find(g => g.id === galaxyId);
    if (!gal || !galaxyViewport) { console.warn("Cannot find galaxy or viewport for ID:", galaxyId); return; }
    if (gal.layoutGenerated && !gameSessionData.isForceRegenerating) return; // Don't regenerate if already done, unless forced
    const pd = galaxyViewport.offsetWidth > 0 ? galaxyViewport.offsetWidth : (gameSessionData.universe.diameter || 500); // Parent diameter
    const pr = pd / 2; // Parent radius for centering
    if (pd <= 0 || isNaN(pr) || pr <= 0) { console.warn("Invalid dimensions for galaxy layout:", pd, pr); gal.layoutGenerated = true; if (!gameSessionData.isForceRegenerating) saveGameState(); return }
    gal.solarSystems = []; gal.lineConnections = []; const tpr = []; // Temp placed rects
    const numSystemsToAssign = Math.floor(Math.random() * (currentMaxSSCount - currentMinSSCount + 1)) + currentMinSSCount;
    for (let i = 0; i < numSystemsToAssign; i++) {
      const sysId = `${gal.id}-ss-${i + 1}`; // e.g., "galaxy-1-ss-1"
      const pos = getNonOverlappingPositionInCircle(pr, SOLAR_SYSTEM_BASE_ICON_SIZE, tpr);
      if (pos && !isNaN(pos.x) && !isNaN(pos.y)) { //Ensure valid position
        gal.solarSystems.push({ id: sysId, customName: null, x: pos.x, y: pos.y, iconSize: SOLAR_SYSTEM_BASE_ICON_SIZE });
        tpr.push({ x: pos.x, y: pos.y, width: SOLAR_SYSTEM_BASE_ICON_SIZE, height: SOLAR_SYSTEM_BASE_ICON_SIZE })
      }
    }
    // --- MST-based Connection Logic ---
    if (gal.solarSystems.length < 2) { gal.layoutGenerated = true; if (!gameSessionData.isForceRegenerating) saveGameState(); return; } // Not enough systems to connect
    const allSystemCoords = gal.solarSystems.map(ss => ({ ...ss, centerX: ss.x + ss.iconSize / 2, centerY: ss.y + ss.iconSize / 2 }));
    const systemConnectionCounts = {}; // { systemId: count }
    const currentGalaxyDiameter = pd;
    const actualMaxEuclideanConnectionDistance = currentGalaxyDiameter * MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT;
    const actualMaxForcedConnectionDistance = currentGalaxyDiameter * MAX_FORCED_CONNECTION_DISTANCE_PERCENT;
    // Prim-like algorithm for MST to ensure graph connectivity
    let connectedSet = new Set();
    let unconnectedSet = new Set(allSystemCoords.map(s => s.id));
    if (allSystemCoords.length > 0) {
      const firstSysId = allSystemCoords[0].id;
      connectedSet.add(firstSysId);
      unconnectedSet.delete(firstSysId);
      while (unconnectedSet.size > 0) {
        let bestCandidate = null; // { fromId, toId, dist }
        let minCurrentDist = Infinity;
        for (const unconnId of unconnectedSet) {
          const currentUnconnSys = allSystemCoords.find(s => s.id === unconnId);
          for (const connId of connectedSet) {
            const currentConnSys = allSystemCoords.find(s => s.id === connId);
            const dist = getDistance(currentUnconnSys, currentConnSys);
            if (dist < minCurrentDist) {
              minCurrentDist = dist;
              bestCandidate = { fromId: connId, toId: unconnId, dist: dist };
            }
          }
        }
        if (bestCandidate) {
          const connectionIsValidPrimary = tryAddConnection(bestCandidate.fromId, bestCandidate.toId, gal.lineConnections, systemConnectionCounts, allSystemCoords, actualMaxEuclideanConnectionDistance);
          if (connectionIsValidPrimary) {
            gal.lineConnections.push({ fromId: bestCandidate.fromId, toId: bestCandidate.toId });
            systemConnectionCounts[bestCandidate.fromId] = (systemConnectionCounts[bestCandidate.fromId] || 0) + 1;
            systemConnectionCounts[bestCandidate.toId] = (systemConnectionCounts[bestCandidate.toId] || 0) + 1;
            connectedSet.add(bestCandidate.toId);
            unconnectedSet.delete(bestCandidate.toId);
          } else { // Failed primary, try forced fallback connection
            const systemToConnectId = bestCandidate.toId;
            const systemToConnect = allSystemCoords.find(s => s.id === systemToConnectId);
            let fallbackTargetId = null;
            let minFallbackDist = Infinity;
            for (const connId of connectedSet) {
              const connSys = allSystemCoords.find(s => s.id === connId);
              const dist = getDistance(systemToConnect, connSys);
              const isPossibleFallback = tryAddConnection(systemToConnectId, connId, gal.lineConnections, systemConnectionCounts, allSystemCoords, actualMaxForcedConnectionDistance);
              if (isPossibleFallback) {
                if (dist < minFallbackDist) {
                  minFallbackDist = dist;
                  fallbackTargetId = connId;
                }
              }
            }
            if (fallbackTargetId) {
              gal.lineConnections.push({ fromId: systemToConnectId, toId: fallbackTargetId });
              systemConnectionCounts[systemToConnectId] = (systemConnectionCounts[systemToConnectId] || 0) + 1;
              systemConnectionCounts[fallbackTargetId] = (systemConnectionCounts[fallbackTargetId] || 0) + 1;
              connectedSet.add(systemToConnectId);
              unconnectedSet.delete(systemToConnectId);
            } else { // No forced fallback, try ultimate fallback (any distance)
              let ultimateFallbackId = null;
              let minUltimateFallbackDist = Infinity;
              for (const currentConnectedId of connectedSet) { // Correct iteration for Set objects
                const connSys = allSystemCoords.find(s => s.id === currentConnectedId);
                const dist = getDistance(systemToConnect, connSys);
                const isPossibleUltimateFallback = tryAddConnection(systemToConnectId, currentConnectedId, gal.lineConnections, systemConnectionCounts, allSystemCoords, null); // No distance limit
                if (isPossibleUltimateFallback) {
                  if (dist < minUltimateFallbackDist) {
                    minUltimateFallbackDist = dist;
                    ultimateFallbackId = currentConnectedId;
                  }
                }
              }
              if (ultimateFallbackId) {
                gal.lineConnections.push({ fromId: systemToConnectId, toId: ultimateFallbackId });
                systemConnectionCounts[systemToConnectId] = (systemConnectionCounts[systemToConnectId] || 0) + 1;
                systemConnectionCounts[ultimateFallbackId] = (systemConnectionCounts[ultimateFallbackId] || 0) + 1;
                connectedSet.add(systemToConnectId);
                unconnectedSet.delete(systemToConnectId);
              } else {
                unconnectedSet.delete(systemToConnectId); // Cannot connect, remove from candidates
              }
            }
          }
        } else { // No best candidate found, might mean unconnected components
          if (unconnectedSet.size > 0 && connectedSet.size === 0 && allSystemCoords.length > 0) {
            // This state can happen if the first system could not be placed, try next.
            const nextUnconnectedId = Array.from(unconnectedSet)[0];
            connectedSet.add(nextUnconnectedId);
            unconnectedSet.delete(nextUnconnectedId);
          } else {
            break; // Exit loop if no more connections can be made
          }
        }
      }
    };
    // --- Add additional connections ---
    allSystemCoords.forEach(ss1 => {
      const desiredConnections = getWeightedNumberOfConnections();
      let currentConnections = systemConnectionCounts[ss1.id] || 0;
      let connectionsToAdd = Math.min(desiredConnections, MAX_CONNECTIONS_PER_SYSTEM - currentConnections);
      if (connectionsToAdd <= 0) return;
      // Find closest neighbors that are not already at max connections and not already connected
      let potentialTargets = allSystemCoords
        .filter(ss2 => ss1.id !== ss2.id) // Not itself
        .map(ss2 => ({ ...ss2, distance: getDistance(ss1, ss2) }))
        .sort((a, b) => a.distance - b.distance);
      // Only consider targets within the Euclidean connection distance for these additional links
      const limitedPotentialTargets = potentialTargets.filter(ss2 => ss2.distance <= actualMaxEuclideanConnectionDistance);
      // Take a small pool of the closest candidates to avoid too many long connections
      const finalCandidates = limitedPotentialTargets.slice(0, MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS);
      for (const ss2 of finalCandidates) {
        if (connectionsToAdd <= 0) break;
        const success = tryAddConnection(ss1.id, ss2.id, gal.lineConnections, systemConnectionCounts, allSystemCoords, actualMaxEuclideanConnectionDistance);
        if (success) {
          gal.lineConnections.push({ fromId: ss1.id, toId: ss2.id });
          systemConnectionCounts[ss1.id] = (systemConnectionCounts[ss1.id] || 0) + 1;
          systemConnectionCounts[ss2.id] = (systemConnectionCounts[ss2.id] || 0) + 1;
          connectionsToAdd--;
        }
      }
    });
    gal.layoutGenerated = true;
    if (!gameSessionData.isForceRegenerating) { saveGameState(); }
  }
  async function preGenerateAllGalaxyContents() {
    gameSessionData.isForceRegenerating = true; // Set flag to allow regeneration
    for (const gal of gameSessionData.galaxies) {
      if (galaxyViewport && (!gal.layoutGenerated || gal.solarSystems.length === 0)) { // Ensure viewport is available
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield to allow UI updates if necessary
        generateSolarSystemsForGalaxy(gal.id);
      }
    }
    gameSessionData.isForceRegenerating = false; // Reset flag
    saveGameState(); // Save after all pre-generation is done
  }
  function renderMainScreen() {
    if (mainScreenTitleText) mainScreenTitleText.textContent = "Universe";
    if (!universeCircle) return;
    universeCircle.innerHTML = ''; // Clear existing galaxies
    gameSessionData.galaxies.forEach(gal => {
      const displayId = gal.id.split('-').pop(); // Get the numeric part of "galaxy-1"
      const el = document.createElement('div');
      el.className = 'galaxy-icon';
      el.style.width = `${GALAXY_ICON_SIZE}px`;
      el.style.height = `${GALAXY_ICON_SIZE}px`;
      el.style.left = `${gal.x}px`;
      el.style.top = `${gal.y}px`;
      el.style.backgroundColor = FIXED_COLORS.galaxyIconFill;
      el.style.border = `3px solid ${FIXED_COLORS.galaxyIconBorder}`;
      el.title = gal.customName || `Galaxy ${displayId}`;
      el.dataset.galaxyId = gal.id;
      el.addEventListener('click', () => switchToGalaxyDetailView(gal.id));
      universeCircle.appendChild(el)
    });
  }
  function drawGalaxyLines(galaxy) { if (!solarSystemLinesCanvasEl || !galaxyZoomContent) return; if (galaxyZoomContent.offsetWidth > 0 && solarSystemLinesCanvasEl.width !== galaxyZoomContent.offsetWidth) solarSystemLinesCanvasEl.width = galaxyZoomContent.offsetWidth; if (galaxyZoomContent.offsetHeight > 0 && solarSystemLinesCanvasEl.height !== galaxyZoomContent.offsetHeight) solarSystemLinesCanvasEl.height = galaxyZoomContent.offsetHeight; if (!linesCtx) linesCtx = solarSystemLinesCanvasEl.getContext('2d'); linesCtx.clearRect(0, 0, solarSystemLinesCanvasEl.width, solarSystemLinesCanvasEl.height); if (!galaxy || !galaxy.lineConnections || !galaxy.solarSystems) return; linesCtx.strokeStyle = FIXED_COLORS.connectionLine; linesCtx.lineWidth = 0.5; linesCtx.setLineDash([]); const spos = {}; galaxy.solarSystems.forEach(ss => { spos[ss.id] = { x: ss.x + ss.iconSize / 2, y: ss.y + ss.iconSize / 2 } }); galaxy.lineConnections.forEach(conn => { const f = spos[conn.fromId], t = spos[conn.toId]; if (f && t) { linesCtx.beginPath(); linesCtx.moveTo(f.x, f.y); linesCtx.lineTo(t.x, t.y); linesCtx.stroke() } }) }
  function renderGalaxyDetailScreen(isInteractive = false) {
    const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
    if (!gal) { switchToMainView(); return }
    if (!galaxyViewport || !galaxyZoomContent) return;
    // Set fixed size for viewport (content will scale and pan inside this)
    galaxyViewport.style.width = `${gameSessionData.universe.diameter || 500}px`;
    galaxyViewport.style.height = `${gameSessionData.universe.diameter || 500}px`;
    // Clear old icons, but preserve canvas
    const icons = galaxyZoomContent.querySelectorAll('.solar-system-icon');
    icons.forEach(i => i.remove());
    // --- Render Solar System Icons ---
    const zoomScaleDampening = 0.6; // How much icon size scales with zoom (0 to 1)
    gal.solarSystems.forEach(ss => {
      const solarSystemObject = ss; // For clarity
      const el = document.createElement('div');
      el.className = 'solar-system-icon';
      const baseEffectiveZoom = 1 + (gal.currentZoom - GALAXY_VIEW_MIN_ZOOM) * zoomScaleDampening;
      let desiredSizeInParent = (ss.iconSize * baseEffectiveZoom);
      if (gal.currentZoom > 0) {
        desiredSizeInParent = desiredSizeInParent / gal.currentZoom;
      }
      desiredSizeInParent = Math.max(0.5, desiredSizeInParent);
      el.style.width = `${desiredSizeInParent}px`;
      el.style.height = `${desiredSizeInParent}px`;
      const centerOffset = desiredSizeInParent / 2;
      const baseCenterOffset = ss.iconSize / 2;
      el.style.left = `${ss.x + baseCenterOffset - centerOffset}px`;
      el.style.top = `${ss.y + baseCenterOffset - centerOffset}px`;
      el.dataset.solarSystemId = ss.id;
      if (solarSystemObject && solarSystemObject.customName) { el.title = solarSystemObject.customName; }
      el.addEventListener('click', e => { e.stopPropagation(); switchToSolarSystemView(ss.id) });
      galaxyZoomContent.appendChild(el)
    });
    if (solarSystemLinesCanvasEl.parentNode !== galaxyZoomContent || galaxyZoomContent.firstChild !== solarSystemLinesCanvasEl) {
      galaxyZoomContent.insertBefore(solarSystemLinesCanvasEl, galaxyZoomContent.firstChild);
    }
    drawGalaxyLines(gal);
    galaxyZoomContent.style.transition = isInteractive ? 'none' : 'transform 0.1s ease-out';
    galaxyZoomContent.style.transform = `translate(${gal.currentPanX}px,${gal.currentPanY}px)scale(${gal.currentZoom})`;
    if (galaxyDetailTitleText) {
      const displayId = gal.id.split('-').pop();
      galaxyDetailTitleText.textContent = gal.customName || `Galaxy ${displayId}`;
    }
  }
  function drawAllOrbits() {
    if (!orbitCtx || !solarSystemOrbitCanvasEl || !gameSessionData.solarSystemView.planets) return;
    orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);
    if (!currentShowPlanetOrbits) return;
    const canvasCenterX = solarSystemOrbitCanvasEl.width / 2;
    const canvasCenterY = solarSystemOrbitCanvasEl.height / 2;
    gameSessionData.solarSystemView.planets.forEach(planetData => {
      const orbitalRadius = planetData.distance;
      orbitCtx.beginPath();
      orbitCtx.arc(canvasCenterX, canvasCenterY, orbitalRadius, 0, 2 * Math.PI);
      orbitCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      orbitCtx.lineWidth = 1;
      orbitCtx.setLineDash([5, 5]);
      orbitCtx.stroke();
    });
    orbitCtx.setLineDash([]);
  }
  function renderSolarSystemScreen(isInteractive = false) {
    if (!solarSystemContent || !solarSystemScreen || !gameSessionData.activeSolarSystemId) { return; }
    const data = gameSessionData.solarSystemView;
    let panX = data.currentPanX || 0, panY = data.currentPanY || 0;
    let zoom = data.zoomLevel || SOLAR_SYSTEM_VIEW_MIN_ZOOM;
    solarSystemContent.style.transition = isInteractive ? 'none' : 'transform 0.1s ease-out';
    solarSystemContent.style.transform = `translate(${panX}px,${panY}px)scale(${zoom})`;
    const galaxyPart = gameSessionData.activeSolarSystemId.substring(0, gameSessionData.activeSolarSystemId.indexOf('-ss-'));
    const activeGalaxy = gameSessionData.galaxies.find(g => g.id === galaxyPart);

    let solarSystemObject = null;
    if (activeGalaxy && activeGalaxy.solarSystems) {
      solarSystemObject = activeGalaxy.solarSystems.find(ss => ss.id === data.systemId);
    }
    if (solarSystemTitleText) {
      solarSystemTitleText.textContent = (solarSystemObject && solarSystemObject.customName) ? solarSystemObject.customName : `System ${data.systemId ? data.systemId.substring(data.systemId.lastIndexOf('-') + 1) : 'N/A'}`;
    }
    if (isInteractive || !animationFrameId) { drawAllOrbits(); }
  }
  function switchToMainView() { gameSessionData.activeGalaxyId = null; gameSessionData.activeSolarSystemId = null; setActiveScreen(mainScreen); }
  function makeTitleEditable(titleTextElement, titleInputElement, onSaveCallback) {
    titleTextElement.ondblclick = () => {
      titleTextElement.style.display = 'none';
      titleInputElement.style.display = 'inline-block';
      titleInputElement.value = titleTextElement.textContent;
      titleInputElement.focus();
      titleInputElement.select();
    };
    const saveName = () => {
      const newName = titleInputElement.value.trim();
      const defaultName = onSaveCallback(newName || null);
      titleTextElement.textContent = newName || defaultName;
      titleInputElement.style.display = 'none';
      titleTextElement.style.display = 'inline-block';
    };
    titleInputElement.onblur = saveName;
    titleInputElement.onkeydown = (event) => {
      if (event.key === 'Enter') { titleInputElement.blur(); }
      else if (event.key === 'Escape') { titleInputElement.value = titleTextElement.textContent; titleInputElement.blur(); }
    };
  }
  function switchToGalaxyDetailView(galaxyId) {
    const gal = gameSessionData.galaxies.find(g => g.id === galaxyId);
    if (!gal) { switchToMainView(); return; }
    gameSessionData.activeGalaxyId = galaxyId;
    const displayId = gal.id.split('-').pop();
    if (backToGalaxyButton) {
      backToGalaxyButton.textContent = gal.customName
        ? `← ${gal.customName}`
        : `← Galaxy ${displayId}`;
    }
    gameSessionData.activeSolarSystemId = null;
    gal.currentZoom = gal.currentZoom || 1.0;
    gal.currentPanX = gal.currentPanX || 0;
    gal.currentPanY = gal.currentPanY || 0;
    if (galaxyDetailTitleText) {
      galaxyDetailTitleText.textContent = gal.customName || `Galaxy ${displayId}`;
      galaxyDetailTitleText.style.display = 'inline-block';
    }
    if (galaxyDetailTitleInput) galaxyDetailTitleInput.style.display = 'none';
    setActiveScreen(galaxyDetailScreen);
    makeTitleEditable(galaxyDetailTitleText, galaxyDetailTitleInput, (newName) => {
      gal.customName = newName || null;
      saveGameState();
      renderMainScreen();
      return gal.customName || `Galaxy ${displayId}`;
    });
    if (galaxyViewport && gameSessionData.universe.diameter) {
      galaxyViewport.style.width = `${gameSessionData.universe.diameter}px`;
      galaxyViewport.style.height = `${gameSessionData.universe.diameter}px`;
    }
    if (!gal.layoutGenerated) {
      setTimeout(() => {
        function attemptLayoutGeneration(retriesLeft = 5) {
          if (galaxyViewport && galaxyViewport.offsetWidth > 0) {
            generateSolarSystemsForGalaxy(galaxyId); renderGalaxyDetailScreen(false);
          } else if (retriesLeft > 0) {
            requestAnimationFrame(() => attemptLayoutGeneration(retriesLeft - 1));
          } else {
            console.warn("Galaxy viewport width not available after retries, layout generation might be incorrect.");
            gal.layoutGenerated = true; renderGalaxyDetailScreen(false);
          }
        }
        attemptLayoutGeneration();
      }, 50);
    } else { renderGalaxyDetailScreen(false); }
  }

  function renderPlanetVisual(planetData, rotationQuaternion, targetCanvas = planetVisualCanvas) {
    if (!planetData || !targetCanvas || !window.Worker) return; // Also check for worker support

    if (!planetData.continentSeed) {
      planetData.continentSeed = Math.random();
    }
    if (!planetData.waterColor) {
      if (planetData.type === 'normal' && planetData.color) {
        planetData.waterColor = `hsl(${planetData.color.hue}, ${planetData.color.saturation}%, ${planetData.color.lightness}%)`;
        planetData.landColor = `hsl(${planetData.color.hue}, ${planetData.color.saturation + 10}%, ${planetData.color.lightness + 10}%)`;
        delete planetData.color;
      } else {
        planetData.waterColor = '#000080';
        planetData.landColor = '#006400';
      }
      planetData.type = 'terrestrial';
    }

    const dataToSend = {
      waterColor: planetData.waterColor,
      landColor: planetData.landColor,
      continentSeed: planetData.continentSeed,
    };

    const canvasId = targetCanvas.id;

    if (targetCanvas === planetVisualCanvas && planetVisualWorker) {
      planetVisualWorker.postMessage({
        cmd: 'renderPlanet',
        planetData: dataToSend,
        rotationQuaternion: rotationQuaternion,
        canvasWidth: targetCanvas.width,
        canvasHeight: targetCanvas.height,
        senderId: canvasId
      });
    } else if (targetCanvas === designerPlanetCanvas && designerWorker) {
      designerWorker.postMessage({
        cmd: 'renderPlanet',
        planetData: dataToSend,
        rotationQuaternion: rotationQuaternion,
        canvasWidth: targetCanvas.width,
        canvasHeight: targetCanvas.height,
        senderId: canvasId
      });
    }
  }

  function switchToSolarSystemView(solarSystemId) {
    gameSessionData.activeSolarSystemId = solarSystemId;
    const galaxyPart = solarSystemId.substring(0, solarSystemId.indexOf('-ss-'));
    const activeGalaxy = gameSessionData.galaxies.find(g => g.id === galaxyPart);

    let solarSystemObject = null;
    if (activeGalaxy && activeGalaxy.solarSystems) {
      solarSystemObject = activeGalaxy.solarSystems.find(ss => ss.id === solarSystemId);
    }
    gameSessionData.solarSystemView.zoomLevel = 0.5;
    gameSessionData.solarSystemView.currentPanX = 0;
    gameSessionData.solarSystemView.currentPanY = 0;
    gameSessionData.solarSystemView.systemId = solarSystemId;
    solarSystemContent.innerHTML = '';
    const sunEl = document.createElement('div');
    sunEl.className = 'sun-icon';
    sunEl.style.width = `${SUN_ICON_SIZE}px`;
    sunEl.style.height = `${SUN_ICON_SIZE}px`;
    solarSystemContent.appendChild(sunEl);
    solarSystemOrbitCanvasEl = document.createElement('canvas');
    solarSystemOrbitCanvasEl.id = 'solar-system-orbit-canvas';
    solarSystemOrbitCanvasEl.width = ORBIT_CANVAS_SIZE;
    solarSystemOrbitCanvasEl.height = ORBIT_CANVAS_SIZE;
    solarSystemContent.appendChild(solarSystemOrbitCanvasEl);
    orbitCtx = solarSystemOrbitCanvasEl.getContext('2d');
    gameSessionData.solarSystemView.planets = [];
    let usedDistances = [];
    const numPlanets = Math.floor(Math.random() * (currentMaxPlanets - currentMinPlanets + 1)) + currentMinPlanets;
    for (let i = 0; i < numPlanets; i++) {
      const planetSize = Math.random() * (MAX_PLANET_SIZE - MIN_PLANET_SIZE) + MIN_PLANET_SIZE;
      let planetDistance;
      let attemptCount = 0;
      do {
        planetDistance = Math.floor(Math.random() * (MAX_PLANET_DISTANCE - MIN_PLANET_DISTANCE + 1)) + MIN_PLANET_DISTANCE;
        let tooClose = false;
        for (const d of usedDistances) {
          if (Math.abs(planetDistance - d.distance) < (MIN_ORBITAL_SEPARATION + (d.size + planetSize) / 2)) {
            tooClose = true; break;
          }
        }
        if (!tooClose) break; attemptCount++;
      } while (attemptCount < 200);
      if (attemptCount === 200) { console.warn("Could not place planet, too crowded."); continue; }

      if (gameSessionData.customPlanetDesigns.length === 0) {
        console.warn("No custom planet designs exist. Skipping planet generation for this system.");
        continue;
      }

      const randomDesign = gameSessionData.customPlanetDesigns[Math.floor(Math.random() * gameSessionData.customPlanetDesigns.length)];

      usedDistances.push({ distance: planetDistance, size: planetSize });
      const initialOrbitalAngle = Math.random() * 2 * Math.PI;
      const orbitalSpeed = MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT + Math.random() * (MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT - MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT);
      const initialAxialAngle = Math.random() * 2 * Math.PI;
      const axialSpeed = DEFAULT_PLANET_AXIAL_SPEED * (Math.random() * 0.5 + 0.75);
      const newPlanet = {
        id: `planet-${i + 1}`, size: planetSize, distance: planetDistance,
        currentOrbitalAngle: initialOrbitalAngle, orbitalSpeed: orbitalSpeed,
        currentAxialAngle: initialAxialAngle, axialSpeed: axialSpeed,
        element: null,
        planetName: `Planet ${i + 1}`,
        type: 'terrestrial',
        waterColor: randomDesign.waterColor,
        landColor: randomDesign.landColor,
        continentSeed: randomDesign.continentSeed,
        sourceDesignId: randomDesign.designId
      };

      gameSessionData.solarSystemView.planets.push(newPlanet);

      // MODIFICATION 2 IS HERE, below this loop, not inside, for efficiency.
      // We will preload all planets after the loop.

      const planetEl = document.createElement('div');
      planetEl.className = 'planet-icon';
      planetEl.style.width = `${newPlanet.size}px`;
      planetEl.style.height = `${newPlanet.size}px`;
      const randomPos = 15 + Math.random() * 40;
      const randomSize = 20 + Math.random() * 30;
      let backgroundStyle = `radial-gradient(circle at ${randomPos}% ${randomPos}%, ${newPlanet.landColor} ${randomSize}%, transparent ${randomSize + 20}%), ${newPlanet.waterColor}`;
      if (Math.random() < 0.5) {
        const randomPos2 = 15 + Math.random() * 40;
        const randomSize2 = 20 + Math.random() * 30;
        backgroundStyle = `radial-gradient(circle at ${90 - randomPos2}% ${90 - randomPos2}% , ${newPlanet.landColor} ${randomSize2}%, transparent ${randomSize2 + 20}%), ` + backgroundStyle;
      }
      planetEl.style.background = backgroundStyle;
      planetEl.style.boxShadow = `0 0 ${newPlanet.size / 3}px rgba(255, 255, 255, 0.3)`;
      planetEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasPanelVisible = planetVisualPanel.classList.contains('visible'); // MODIFICATION 3 Check
        currentPlanetDisplayedInPanel = newPlanet;
        planetVisualTitle.textContent = newPlanet.planetName;
        planetVisualSize.textContent = Math.round(newPlanet.size);
        planetVisualPanel.classList.add('visible');

        // MODIFICATION 3 START: Panel Position Persistence
        if (!wasPanelVisible) { // Only recenter if the panel was not already visible
            planetVisualPanel.style.left = '50%';
            planetVisualPanel.style.top = '50%';
            planetVisualPanel.style.transform = 'translate(-50%, -50%)';
            planetVisualPanel.style.transition = ''; // Remove transition for immediate placement
        } else {
            // If panel was already visible, ensure transition is off for content update but don't move panel
            planetVisualPanel.style.transition = 'none';
            // setTimeout(() => planetVisualPanel.style.transition = '', 0); // Re-enable after a tick if needed for future style changes
        }
        // MODIFICATION 3 END

        planetVisualRotationQuat = quat_identity();
        renderPlanetVisual(newPlanet, planetVisualRotationQuat, planetVisualCanvas);
      });
      solarSystemContent.appendChild(planetEl);
      newPlanet.element = planetEl;
    }

    // MODIFICATION 2 START: Preload all planets in the current solar system view
    if (planetVisualWorker && gameSessionData.solarSystemView.planets) {
        gameSessionData.solarSystemView.planets.forEach(planetToPreload => {
            const preloadData = {
                waterColor: planetToPreload.waterColor,
                landColor: planetToPreload.landColor,
                continentSeed: planetToPreload.continentSeed,
            };
            planetVisualWorker.postMessage({
                cmd: 'preloadPlanet',
                planetData: preloadData,
                rotationQuaternion: quat_identity(),
                canvasWidth: planetVisualCanvas?.width || 200, // Use actual or a default
                canvasHeight: planetVisualCanvas?.height || 200,
                senderId: `preload-${planetToPreload.id}` // Unique senderId for potential tracking
            });
        });
    }
    // MODIFICATION 2 END

    if (solarSystemTitleText) {
      solarSystemTitleText.textContent = (solarSystemObject && solarSystemObject.customName) ? solarSystemObject.customName : `System ${solarSystemId.substring(solarSystemId.lastIndexOf('-') + 1)}`;
    }
    if (solarSystemTitleInput) solarSystemTitleInput.style.display = 'none';
    setActiveScreen(solarSystemScreen);
    makeTitleEditable(solarSystemTitleText, solarSystemTitleInput, (newName) => {
      if (solarSystemObject) {
        solarSystemObject.customName = newName || null;
        saveGameState();
        renderGalaxyDetailScreen();
        return solarSystemObject.customName || `System ${solarSystemId.substring(solarSystemId.lastIndexOf('-') + 1)}`;
      }
      return `System ${solarSystemId.substring(solarSystemId.lastIndexOf('-') + 1)}`;
    });
    renderSolarSystemScreen(false);
    startSolarSystemAnimation();
  }

  function animateSolarSystem(now) {
    if (!now) now = performance.now();
    if (lastAnimationTime === null) lastAnimationTime = now;
    const deltaTime = (now - lastAnimationTime) / 1000;
    lastAnimationTime = now;

    const activeSysView = gameSessionData.solarSystemView;
    if (activeSysView && solarSystemScreen.classList.contains('active') && activeSysView.planets) {
      activeSysView.planets.forEach(planet => {
        planet.currentOrbitalAngle += planet.orbitalSpeed * 6 * deltaTime;
        planet.currentAxialAngle += planet.axialSpeed * 60 * deltaTime;

        const planetModelOrbitX = planet.distance * Math.cos(planet.currentOrbitalAngle);
        const planetModelOrbitY = planet.distance * Math.sin(planet.currentOrbitalAngle);

        planet.element.style.left = `calc(50% + ${planetModelOrbitX}px)`;
        planet.element.style.top = `calc(50% + ${planetModelOrbitY}px)`;
        planet.element.style.transform = `translate(-50%, -50%) rotate(${planet.currentAxialAngle}rad)`;
      });
      animationFrameId = requestAnimationFrame(animateSolarSystem);
    } else {
      if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
      lastAnimationTime = null;
    }
  }
  function startSolarSystemAnimation() {
    if (!animationFrameId && solarSystemScreen.classList.contains('active')) {
      lastAnimationTime = null;
      animateSolarSystem();
    }
  }
  function clampSolarSystemPan(dataObject, viewportWidth, viewportHeight) {
    if (!dataObject || !viewportWidth || !viewportHeight) {
      if (dataObject) { dataObject.currentPanX = 0; dataObject.currentPanY = 0; }
      return;
    }
    const zm = dataObject.zoomLevel;
    const contentWidth = SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2;
    const contentHeight = SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2;
    const scaledContentWidth = contentWidth * zm;
    const scaledContentHeight = contentHeight * zm;
    const maxPanX = Math.max(0, (scaledContentWidth - viewportWidth) / 2);
    const maxPanY = Math.max(0, (scaledContentHeight - viewportHeight) / 2);
    dataObject.currentPanX = Math.max(-maxPanX, Math.min(maxPanX, dataObject.currentPanX));
    dataObject.currentPanY = Math.max(-maxPanY, Math.min(maxPanY, dataObject.currentPanY));
  }
  function clampGalaxyPan(galaxy) {
    if (!galaxy || !galaxyViewport) return;
    const vw = galaxyViewport.offsetWidth;
    const vh = galaxyViewport.offsetHeight;
    const zm = galaxy.currentZoom;
    if (zm <= GALAXY_VIEW_MIN_ZOOM) {
      galaxy.currentPanX = 0;
      galaxy.currentPanY = 0;
    } else {
      const panLimitX = (vw * zm - vw) / 2;
      const panLimitY = (vh * zm - vh) / 2;
      galaxy.currentPanX = Math.max(-panLimitX, Math.min(panLimitX, galaxy.currentPanX));
      galaxy.currentPanY = Math.max(-panLimitY, Math.min(panLimitY, galaxy.currentPanY));
    }
  }
  function handleZoom(direction, mouseEvent = null) {
    let targetData, viewportElement, currentClampFunction, currentRenderFunction, hardcodedMinZoom, hardcodedMaxZoom, currentZoomProp, currentPanXProp, currentPanYProp, isSolarView = false;
    if (galaxyDetailScreen.classList.contains('active')) {
      const g = gameSessionData.galaxies.find(gl => gl.id === gameSessionData.activeGalaxyId); if (!g) return;
      targetData = g; viewportElement = galaxyViewport; currentClampFunction = clampGalaxyPan; currentRenderFunction = renderGalaxyDetailScreen; hardcodedMinZoom = GALAXY_VIEW_MIN_ZOOM; hardcodedMaxZoom = GALAXY_VIEW_MAX_ZOOM; currentZoomProp = 'currentZoom'; currentPanXProp = 'currentPanX'; currentPanYProp = 'currentPanY';
    } else if (solarSystemScreen.classList.contains('active')) {
      isSolarView = true; targetData = gameSessionData.solarSystemView; viewportElement = solarSystemScreen; currentClampFunction = clampSolarSystemPan; currentRenderFunction = renderSolarSystemScreen; hardcodedMinZoom = SOLAR_SYSTEM_VIEW_MIN_ZOOM; hardcodedMaxZoom = SOLAR_SYSTEM_VIEW_MAX_ZOOM; currentZoomProp = 'zoomLevel'; currentPanXProp = 'currentPanX'; currentPanYProp = 'currentPanY';
    } else return;
    const oldZoom = targetData[currentZoomProp];
    let newCalculatedZoom = oldZoom + (direction === 'in' ? (ZOOM_STEP * oldZoom) : -(ZOOM_STEP * oldZoom));
    let finalMinZoomForClamping = hardcodedMinZoom;
    if (isSolarView) {
      const viewportWidth = viewportElement.offsetWidth;
      const viewportHeight = viewportElement.offsetHeight;
      let dynamicMinZoomBasedOnExplorable = 0;
      if (SOLAR_SYSTEM_EXPLORABLE_RADIUS > 0 && (viewportWidth > 0 || viewportHeight > 0)) {
        const minZoomToCoverWidth = viewportWidth > 0 ? viewportWidth / (SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2) : 0;
        const minZoomToCoverHeight = viewportHeight > 0 ? viewportHeight / (SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2) : 0;
        dynamicMinZoomBasedOnExplorable = Math.max(minZoomToCoverWidth, minZoomToCoverHeight);
      }
      finalMinZoomForClamping = Math.max(hardcodedMinZoom, dynamicMinZoomBasedOnExplorable);
    }
    newCalculatedZoom = Math.max(finalMinZoomForClamping, Math.min(hardcodedMaxZoom, newCalculatedZoom));
    if (Math.abs(oldZoom - newCalculatedZoom) < 0.0001) return;
    targetData[currentZoomProp] = newCalculatedZoom;
    if (mouseEvent) {
      const rect = viewportElement.getBoundingClientRect();
      const mouseXInViewport = mouseEvent.clientX - rect.left;
      const mouseYInViewport = mouseEvent.clientY - rect.top;
      const viewportCenterX = viewportElement.offsetWidth / 2;
      const viewportCenterY = viewportElement.offsetHeight / 2;
      const mouseXRelativeToCenter = mouseXInViewport - viewportCenterX;
      const mouseYRelativeToCenter = mouseYInViewport - viewportCenterY;
      const currentPanX = targetData[currentPanXProp] || 0;
      const currentPanY = targetData[currentPanYProp] || 0;
      const worldX = (mouseXRelativeToCenter - currentPanX) / oldZoom;
      const worldY = (mouseYRelativeToCenter - currentPanY) / oldZoom;
      targetData[currentPanXProp] = mouseXRelativeToCenter - (worldX * newCalculatedZoom);
      targetData[currentPanYProp] = mouseYRelativeToCenter - (worldY * newCalculatedZoom);
    }
    if (isSolarView) {
      currentClampFunction(targetData, viewportElement.offsetWidth, viewportElement.offsetHeight);
      currentRenderFunction(true);
      startSolarSystemAnimation();
      drawAllOrbits();
    } else {
      currentClampFunction(targetData);
      currentRenderFunction(true);
    }
  }
  function startPan(event, viewportEl, contentEl, dataObjectRef) { if (event.button !== 0 || event.target.closest('button')) return; if (viewportEl === galaxyViewport && (event.target.classList.contains('solar-system-icon') || event.target.closest('.solar-system-icon'))) return; const pS = gameSessionData.panning; pS.isActive = true; pS.startX = event.clientX; pS.startY = event.clientY; pS.initialPanX = dataObjectRef.currentPanX || 0; pS.initialPanY = dataObjectRef.currentPanY || 0; pS.targetElement = contentEl; pS.viewportElement = viewportEl; pS.dataObject = dataObjectRef; viewportEl.classList.add('dragging'); if (contentEl) contentEl.style.transition = 'none'; event.preventDefault() }
  function panMouseMove(event) {
    if (!gameSessionData.panning.isActive) return;
    const pS = gameSessionData.panning, dX = event.clientX - pS.startX, dY = event.clientY - pS.startY;
    pS.dataObject.currentPanX = pS.initialPanX + dX;
    pS.dataObject.currentPanY = pS.initialPanY + dY;
    if (pS.viewportElement === galaxyViewport) { clampGalaxyPan(pS.dataObject); renderGalaxyDetailScreen(true) }
    else if (pS.viewportElement === solarSystemScreen) { clampSolarSystemPan(pS.dataObject, pS.viewportElement.offsetWidth, pS.viewportElement.offsetHeight); renderSolarSystemScreen(true); }
  }
  function panMouseUp() {
    if (!gameSessionData.panning.isActive) return;
    if (gameSessionData.panning.viewportElement) gameSessionData.panning.viewportElement.classList.remove('dragging');
    const pS = gameSessionData.panning; pS.isActive = false;
    if (pS.targetElement) pS.targetElement.style.transition = '';
    if (galaxyDetailScreen.classList.contains('active')) renderGalaxyDetailScreen(false);
    else if (solarSystemScreen.classList.contains('active')) renderSolarSystemScreen(false);
    pS.targetElement = null; pS.viewportElement = null; pS.dataObject = null;
  }
  function regenerateCurrentUniverseState(fromModal = false) {
    if (!fromModal && !confirm("Regenerate universe with current settings? This will clear the currently saved layout.")) { return; }
    localStorage.removeItem('galaxyGameSaveData');
    gameSessionData.universe = { diameter: null };
    gameSessionData.galaxies = [];
    gameSessionData.activeGalaxyId = null;
    gameSessionData.activeSolarSystemId = null;
    gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };
    gameSessionData.isInitialized = false;
    if (universeCircle) universeCircle.innerHTML = '';
    if (galaxyZoomContent) { const canvas = galaxyZoomContent.querySelector('#solar-system-lines-canvas'); galaxyZoomContent.innerHTML = ''; if (canvas) galaxyZoomContent.appendChild(canvas); }
    if (solarSystemContent) solarSystemContent.innerHTML = '';
    if (orbitCtx && solarSystemOrbitCanvasEl) orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    lastAnimationTime = null;
    initializeGame(true);
  }
  if (regenerateUniverseButton) { regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(false)); }
  if (customizeGenerationButton) { customizeGenerationButton.addEventListener('click', () => { numGalaxiesInput.value = currentNumGalaxies; minSSInput.value = currentMinSSCount; maxSSInput.value = currentMaxSSCount; ssSpreadInput.value = currentMaxPlanetDistanceMultiplier.toFixed(1); minPlanetsInput.value = currentMinPlanets; maxPlanetsInput.value = currentMaxPlanets; showOrbitsInput.checked = currentShowPlanetOrbits; customizationModal.classList.add('visible'); }); }
  if (cancelCustomizationButton) { cancelCustomizationButton.addEventListener('click', () => { customizationModal.classList.remove('visible'); }); }
  if (applyCustomizationButton) {
    applyCustomizationButton.addEventListener('click', () => {
      const numGal = parseInt(numGalaxiesInput.value, 10);
      const minSS = parseInt(minSSInput.value, 10);
      const maxSS = parseInt(maxSSInput.value, 10);
      const spread = parseFloat(ssSpreadInput.value);
      const minP = parseInt(minPlanetsInput.value, 10);
      const maxP = parseInt(maxPlanetsInput.value, 10);
      if (isNaN(numGal) || numGal < 1 || numGal > 10 || isNaN(minSS) || minSS < 10 || minSS > 500 || isNaN(maxSS) || maxSS < 10 || maxSS > 1000 || maxSS < minSS || isNaN(spread) || spread < 0.1 || spread > 5.0 || isNaN(minP) || minP < 0 || minP > 5 || isNaN(maxP) || maxP < minP || maxP > 8) { alert("Invalid input values. Please check ranges and ensure Max >= Min for systems and planets."); return; }
      currentNumGalaxies = numGal;
      currentMinSSCount = minSS;
      currentMaxSSCount = maxSS;
      currentMaxPlanetDistanceMultiplier = spread;
      currentMinPlanets = minP;
      currentMaxPlanets = maxP;
      currentShowPlanetOrbits = showOrbitsInput.checked;
      updateDerivedConstants();
      saveCustomizationSettings();
      customizationModal.classList.remove('visible');
      regenerateCurrentUniverseState(true);
    });
  }
  if (closePlanetVisualPanelBtn) {
    closePlanetVisualPanelBtn.addEventListener('click', () => {
      planetVisualPanel.classList.remove('visible');
      currentPlanetDisplayedInPanel = null;
    });
  }
  let isPanelDragging = false;
  let visualPanelOffset = { x: 0, y: 0 };

  if (planetVisualPanelHeader) {
    planetVisualPanelHeader.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;

      isPanelDragging = true;
      planetVisualPanel.classList.add('dragging');

      planetVisualPanel.style.transition = 'none';
      const rect = planetVisualPanel.getBoundingClientRect();
      visualPanelOffset.x = e.clientX - rect.left;
      visualPanelOffset.y = e.clientY - rect.top;

      planetVisualPanel.style.left = `${e.clientX - visualPanelOffset.x}px`;
      planetVisualPanel.style.top = `${e.clientY - visualPanelOffset.y}px`;
      planetVisualPanel.style.transform = 'none';
      planetVisualPanel.style.right = 'auto';
      planetVisualPanel.style.bottom = 'auto';
      e.preventDefault();
    });
  }

  planetVisualCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !currentPlanetDisplayedInPanel) return;
    isDraggingPlanetVisual = true;
    startDragMouseX = e.clientX;
    startDragMouseY = e.clientY;
    startDragPlanetVisualQuat = [...planetVisualRotationQuat];

    planetVisualCanvas.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (isPanelDragging) {
      planetVisualPanel.style.left = `${e.clientX - visualPanelOffset.x}px`;
      planetVisualPanel.style.top = `${e.clientY - visualPanelOffset.y}px`;
    }

    if (isDraggingPlanetVisual && currentPlanetDisplayedInPanel && planetVisualPanel.classList.contains('visible')) {
      const rect = planetVisualCanvas.getBoundingClientRect();
      const canvasWidth = rect.width;
      const canvasHeight = rect.height;

      const deltaMouseX = e.clientX - startDragMouseX;
      const deltaMouseY = e.clientY - startDragMouseY;

      const rotationAroundX = (deltaMouseY / canvasHeight) * Math.PI * PLANET_ROTATION_SENSITIVITY;
      // MODIFICATION 1 START: Invert horizontal rotation
      // Original was: (deltaMouseX / canvasWidth) * (2 * Math.PI) * PLANET_ROTATION_SENSITIVITY;
      // then incY_quat = quat_from_axis_angle([0, 1, 0], -rotationAroundY);
      // To invert, make rotationAroundY positive here, or remove negative in quat_from_axis_angle for Y only.
      // Let's make rotationAroundY have the correct sign directly.
      const rotationAroundY = -(deltaMouseX / canvasWidth) * (2 * Math.PI) * PLANET_ROTATION_SENSITIVITY;
      // MODIFICATION 1 END

      const incX_quat = quat_from_axis_angle([1, 0, 0], -rotationAroundX); // Vertical drag rotation (around X-axis)
      const incY_quat = quat_from_axis_angle([0, 1, 0], rotationAroundY); // Horizontal drag rotation (around Y-axis) - Note: sign of rotationAroundY might be adjusted here or above
      // MODIFICATION 1 Note: We changed rotationAroundY sign above so this line now uses positive rotationAroundY.
      // This means if you drag mouse left (negative deltaMouseX), rotationAroundY becomes positive.
      // A positive rotation around Y-axis (using right-hand rule, thumb along Y+) means rotating from +Z to +X.
      // This should achieve the effect where dragging left pulls the left side of the planet towards you / rotates the planet to the left.

      const combined_inc_quat = quat_multiply(incY_quat, incX_quat);
      planetVisualRotationQuat = quat_normalize(quat_multiply(combined_inc_quat, startDragPlanetVisualQuat));

      if (!renderPending) {
        renderPending = true;
        requestAnimationFrame(() => {
          renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas);
          renderPending = false;
        });
      }
    } else if (isDraggingDesignerPlanet) {
      const rect = designerPlanetCanvas.getBoundingClientRect();
      const canvasWidth = rect.width;
      const canvasHeight = rect.height;

      const deltaMouseX = e.clientX - designerStartDragMouseX;
      const deltaMouseY = e.clientY - designerStartDragMouseY;

      const rotationAroundX = (deltaMouseY / canvasHeight) * Math.PI * PLANET_ROTATION_SENSITIVITY;
      // MODIFICATION 1 START: Invert horizontal rotation for designer
      const rotationAroundY = -(deltaMouseX / canvasWidth) * (2 * Math.PI) * PLANET_ROTATION_SENSITIVITY;
      // MODIFICATION 1 END

      const incX_quat = quat_from_axis_angle([1, 0, 0], -rotationAroundX);
      const incY_quat = quat_from_axis_angle([0, 1, 0], rotationAroundY); // Same logic as above

      const combined_inc_quat = quat_multiply(incY_quat, incX_quat);
      designerPlanetRotationQuat = quat_normalize(quat_multiply(combined_inc_quat, startDragDesignerPlanetQuat));

      if (!designerRenderPending) {
        designerRenderPending = true;
        requestAnimationFrame(() => {
          renderDesignerPlanet(currentDesignerPlanet, designerPlanetRotationQuat);
          designerRenderPending = false;
        });
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (isPanelDragging) {
      isPanelDragging = false;
      planetVisualPanel.classList.remove('dragging');
      planetVisualPanel.style.transition = '';
    }
    if (isDraggingPlanetVisual) {
      isDraggingPlanetVisual = false;
      planetVisualCanvas.classList.remove('dragging');
    }
    if (isDraggingDesignerPlanet) {
      isDraggingDesignerPlanet = false;
      designerPlanetCanvas.classList.remove('dragging');
    }
  });
  let currentDesignerPlanet = { waterColor: '#000080', landColor: '#006400', continentSeed: Math.random() };
  function renderDesignerPlanet(planet, rotationQuaternion) {
    if (!planet || !designerPlanetCanvas) return;
    renderPlanetVisual(planet, rotationQuaternion, designerPlanetCanvas);
  }
  function updateDesignerPlanetFromInputs() {
    currentDesignerPlanet.waterColor = designerWaterColorInput.value;
    currentDesignerPlanet.landColor = designerLandColorInput.value;
    renderDesignerPlanet(currentDesignerPlanet, designerPlanetRotationQuat);
  }
  function randomizeDesignerPlanet() {
    currentDesignerPlanet.waterColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    currentDesignerPlanet.landColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    currentDesignerPlanet.continentSeed = Math.random();
    designerWaterColorInput.value = currentDesignerPlanet.waterColor;
    designerLandColorInput.value = currentDesignerPlanet.landColor;
    designerPlanetRotationQuat = quat_identity();
    renderDesignerPlanet(currentDesignerPlanet, designerPlanetRotationQuat);
  }
  function saveCustomPlanetDesign() {
    const newDesign = {
      designId: `design-${Date.now()}`,
      waterColor: currentDesignerPlanet.waterColor,
      landColor: currentDesignerPlanet.landColor,
      continentSeed: currentDesignerPlanet.continentSeed,
      name: `Custom Planet ${gameSessionData.customPlanetDesigns.length + 1}`
    };
    gameSessionData.customPlanetDesigns.push(newDesign);
    saveGameState();
    populateSavedDesignsList();
  }
  function populateSavedDesignsList() {
    savedDesignsUl.innerHTML = '';
    if (gameSessionData.customPlanetDesigns.length === 0) {
      savedDesignsUl.innerHTML = '<li>No designs saved yet.</li>';
      return;
    }
    gameSessionData.customPlanetDesigns.forEach(design => {
      const li = document.createElement('li');
      li.dataset.designId = design.designId;
      const designNameSpan = document.createElement('span');
      designNameSpan.className = 'design-item-name';
      designNameSpan.textContent = design.name;
      li.appendChild(designNameSpan);
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'design-item-delete';
      deleteBtn.textContent = 'x';
      deleteBtn.title = `Delete ${design.name}`;
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm(`Delete design "${design.name}"?`)) {
          gameSessionData.customPlanetDesigns = gameSessionData.customPlanetDesigns.filter(d => d.designId !== design.designId);
          saveGameState();
          populateSavedDesignsList();
        }
      };
      li.appendChild(deleteBtn);
      savedDesignsUl.appendChild(li);
    });
  }
  function switchToPlanetDesignerScreen() {
    setActiveScreen(planetDesignerScreen);
    randomizeDesignerPlanet();
    populateSavedDesignsList();
  }
  designerPlanetCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDraggingDesignerPlanet = true;
    designerStartDragMouseX = e.clientX;
    designerStartDragMouseY = e.clientY;
    startDragDesignerPlanetQuat = [...designerPlanetRotationQuat];

    designerPlanetCanvas.classList.add('dragging');
    e.preventDefault();
  });
  designerWaterColorInput.addEventListener('change', updateDesignerPlanetFromInputs);
  designerLandColorInput.addEventListener('change', updateDesignerPlanetFromInputs);
  designerRandomizeBtn.addEventListener('click', randomizeDesignerPlanet);
  designerSaveBtn.addEventListener('click', saveCustomPlanetDesign);
  designerCancelBtn.addEventListener('click', () => setActiveScreen(mainScreen));
  createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);
  function initializeGame(isForcedRegeneration = false) {
    loadCustomizationSettings();
    if (!isForcedRegeneration && loadGameState()) {
      setActiveScreen(mainScreen);
      if (universeCircle && gameSessionData.universe.diameter) {
        universeCircle.style.width = `${gameSessionData.universe.diameter}px`;
        universeCircle.style.height = `${gameSessionData.universe.diameter}px`;
        universeCircle.style.backgroundColor = FIXED_COLORS.universeBg;
      } else { generateUniverseLayout(); }
      renderMainScreen();
      preGenerateAllGalaxyContents();
    } else {
      generateUniverseLayout();
      generateGalaxies();
      setActiveScreen(mainScreen);
      renderMainScreen();
      preGenerateAllGalaxyContents();
      if (gameSessionData.galaxies.every(g => g.layoutGenerated)) { saveGameState(); }
    }
    gameSessionData.isInitialized = true;
  }
  window.addEventListener('resize', () => {
    const currentScreenIdBeforeResize = document.querySelector('.screen.active')?.id;

    localStorage.removeItem('galaxyGameSaveData');
    gameSessionData.universe = { diameter: null };
    gameSessionData.galaxies = [];
    gameSessionData.activeGalaxyId = null;
    gameSessionData.activeSolarSystemId = null;
    gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };
    gameSessionData.isInitialized = false;
    if (universeCircle) universeCircle.innerHTML = '';
    if (galaxyZoomContent) { const canvas = galaxyZoomContent.querySelector('#solar-system-lines-canvas'); galaxyZoomContent.innerHTML = ''; if (canvas) galaxyZoomContent.appendChild(canvas); }
    if (solarSystemContent) solarSystemContent.innerHTML = '';
    if (orbitCtx && solarSystemOrbitCanvasEl) orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    lastAnimationTime = null;

    loadCustomizationSettings();
    initializeGame(true);
    if (currentScreenIdBeforeResize) {
      const screenToActivate = document.getElementById(currentScreenIdBeforeResize) || mainScreen;
      setActiveScreen(screenToActivate);
    } else {
      setActiveScreen(mainScreen);
    }
  });
  if (backToMainButton) backToMainButton.addEventListener('click', switchToMainView);
  if (backToGalaxyButton) backToGalaxyButton.addEventListener('click', () => {
    if (gameSessionData.activeGalaxyId && gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId)) {
      switchToGalaxyDetailView(gameSessionData.activeGalaxyId);
    } else {
      switchToMainView();
    }
  });
  if (zoomInButton) zoomInButton.addEventListener('click', (e) => handleZoom('in', e));
  if (zoomOutButton) zoomOutButton.addEventListener('click', (e) => handleZoom('out', e));
  if (galaxyViewport) {
    galaxyViewport.addEventListener('wheel', (e) => {
      if (galaxyDetailScreen.classList.contains('active')) {
        e.preventDefault();
        handleZoom(e.deltaY < 0 ? 'in' : 'out', e);
      }
    });
  }
  if (solarSystemScreen) {
    solarSystemScreen.addEventListener('wheel', (e) => {
      if (solarSystemScreen.classList.contains('active')) {
        e.preventDefault();
        handleZoom(e.deltaY < 0 ? 'in' : 'out', e);
      }
    });
  }
  if (solarSystemScreen) { solarSystemScreen.addEventListener('mousedown', (e) => { if (solarSystemScreen.classList.contains('active')) { startPan(e, solarSystemScreen, solarSystemContent, gameSessionData.solarSystemView); } }); }
  window.addEventListener('mousemove', panMouseMove); // Generic pan move
  window.addEventListener('mouseup', panMouseUp);   // Generic pan up

  // Galaxy Specific Panning - This needs to be carefully managed with the generic pan handlers
  // The current structure has the generic panMouseMove and panMouseUp.
  // The mousedown for galaxyViewport does NOT call startPan, so it uses its own flags.
  // This is kept for now but is a candidate for future unification.
  if (galaxyViewport) {
    galaxyViewport.addEventListener('click', function (event) { // Changed from galaxyZoomContent to galaxyViewport for wider click area if needed, or keep on zoomContent
      if (gameSessionData.panning.isActive && !event.target.closest('.solar-system-icon')) {
        return;
      }
      const ssIcon = event.target.closest('.solar-system-icon');
      if (ssIcon) { // Check if click was on a solar system icon
        const ssId = ssIcon.dataset.solarSystemId;
        if (ssId) {
          switchToSolarSystemView(ssId);
          event.stopPropagation();
        }
      }
    });

    let isGalaxyPanningSpecific = false; // Renamed to avoid confusion with generic panning's isActive
    let galaxyPanStartSpecific = { x: 0, y: 0 };
    let galaxyLastPanSpecific = { x: 0, y: 0 };

    galaxyViewport.addEventListener('mousedown', (e) => {
      if (
        e.button !== 0 ||
        !galaxyDetailScreen.classList.contains('active') ||
        e.target.closest('.solar-system-icon') ||
        e.target.closest('button')
      ) return;

      // Prevent generic panning if we are starting galaxy specific panning
      if (gameSessionData.panning.isActive) return;

      isGalaxyPanningSpecific = true;
      galaxyPanStartSpecific.x = e.clientX;
      galaxyPanStartSpecific.y = e.clientY;

      const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
      galaxyLastPanSpecific.x = gal?.currentPanX || 0;
      galaxyLastPanSpecific.y = gal?.currentPanY || 0;

      galaxyViewport.classList.add('dragging');
      if (galaxyZoomContent) galaxyZoomContent.style.transition = 'none';
      e.preventDefault();
    });

    // Use a single window mousemove listener that branches based on active panning type
    // This requires modifying the generic panMouseMove or careful flag management.
    // For now, the multiple window listeners from the original code are problematic.
    // Let's assume the global panMouseMove ALREADY handles standard panning.
    // We need to ensure it doesn't interfere with this specific galaxy pan.
    // The current global panMouseMove checks `gameSessionData.panning.isActive`.
    // The global panMouseUp checks `gameSessionData.panning.isActive`.

    // This specific mousemove for galaxy only runs if `isGalaxyPanningSpecific` is true.
    // It should be fine as long as `startPan` is not called for galaxy view background.
    const galaxyMouseMoveHandler = (e) => {
      if (!isGalaxyPanningSpecific) return;
      const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
      if (!gal) return;
      const dx = e.clientX - galaxyPanStartSpecific.x;
      const dy = e.clientY - galaxyPanStartSpecific.y;
      gal.currentPanX = galaxyLastPanSpecific.x + dx;
      gal.currentPanY = galaxyLastPanSpecific.y + dy;
      if (typeof clampGalaxyPan === 'function') {
        clampGalaxyPan(gal);
      }
      renderGalaxyDetailScreen(true);
    };
    window.addEventListener('mousemove', galaxyMouseMoveHandler);


    const galaxyMouseUpHandler = (e) => {
      if (isGalaxyPanningSpecific) {
        isGalaxyPanningSpecific = false;
        galaxyViewport.classList.remove('dragging');
        if (galaxyZoomContent) galaxyZoomContent.style.transition = '';
        renderGalaxyDetailScreen(false); // Non-interactive render after pan ends
      }
    };
    window.addEventListener('mouseup', galaxyMouseUpHandler);
  }
  initializeGame();
});
