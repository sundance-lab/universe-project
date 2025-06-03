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
  let isDraggingDesignerPlanet = false; // ADDED

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
  let designerStartDragMouseX = 0; // ADDED
  let designerStartDragMouseY = 0; // ADDED

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

  planetVisualWorker = new Worker('planetRendererWorker.js');
  designerWorker = new Worker('planetRendererWorker.js');

  // Worker message handlers for rendering results
  planetVisualWorker.onmessage = function(e) {
    const { renderedData, width, height, senderId } = e.data;
    if (senderId === 'planet-visual-canvas') {
      const ctx = planetVisualCanvas.getContext('2d');
      ctx.clearRect(0, 0, planetVisualCanvas.width, planetVisualCanvas.height);
      if (renderedData && width && height) {
        const imageData = new ImageData(renderedData, width, height);
        ctx.putImageData(imageData, 0, 0);
      }
    }
  };

  designerWorker.onmessage = function(e) {
    const { renderedData, width, height, senderId } = e.data;
    if (senderId === 'designer-planet-canvas') {
      const ctx = designerPlanetCanvas.getContext('2d');
      ctx.clearRect(0, 0, designerPlanetCanvas.width, designerPlanetCanvas.height);
      if (renderedData && width && height) {
        const imageData = new ImageData(renderedData, width, height);
        ctx.putImageData(imageData, 0, 0);
      }
    }
  };
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
    planetVisualPanel.classList.remove('visible'); // Hide planet panel on screen switch
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
      el.style.width = `${GALAXY_ICON_SIZE}px`; // Corrected
      el.style.height = `${GALAXY_ICON_SIZE}px`; // Corrected
      el.style.left = `${gal.x}px`;
      el.style.top = `${gal.y}px`;
      el.style.backgroundColor = FIXED_COLORS.galaxyIconFill;
      el.style.border = `3px solid ${FIXED_COLORS.galaxyIconBorder}`;
      el.title = gal.customName || `Galaxy ${displayId}`; // Corrected
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
      // Icon size should appear to grow slightly with zoom, but not 1:1 with the main content zoom
      // This makes them more visible when zoomed out, but not overly large when zoomed in.
      const baseEffectiveZoom = 1 + (gal.currentZoom - GALAXY_VIEW_MIN_ZOOM) * zoomScaleDampening;
      // The icon itself is inside the zoomed content, so its styled size needs to be INVERSELY scaled by the content's zoom
      // to maintain a desired visual size on the screen.
      let desiredSizeInParent = (ss.iconSize * baseEffectiveZoom); // Apparent size if parent wasn't scaled
      if (gal.currentZoom > 0) { // Avoid division by zero
        desiredSizeInParent = desiredSizeInParent / gal.currentZoom; // Actual size in scaled parent
      }
      desiredSizeInParent = Math.max(0.5, desiredSizeInParent); // Min size to prevent disappearance
      el.style.width = `${desiredSizeInParent}px`; // Corrected
      el.style.height = `${desiredSizeInParent}px`; // Corrected
      // Position icons correctly considering their new dynamic size
      const centerOffset = desiredSizeInParent / 2;
      const baseCenterOffset = ss.iconSize / 2; // Original center offset before dynamic sizing
      el.style.left = `${ss.x + baseCenterOffset - centerOffset}px`;
      el.style.top = `${ss.y + baseCenterOffset - centerOffset}px`;
      el.dataset.solarSystemId = ss.id;
      if (solarSystemObject && solarSystemObject.customName) { el.title = solarSystemObject.customName; }
      el.addEventListener('click', e => { e.stopPropagation(); switchToSolarSystemView(ss.id) });
      galaxyZoomContent.appendChild(el)
    });
    // Ensure line canvas is first child for proper layering
    if (solarSystemLinesCanvasEl.parentNode !== galaxyZoomContent || galaxyZoomContent.firstChild !== solarSystemLinesCanvasEl) {
      galaxyZoomContent.insertBefore(solarSystemLinesCanvasEl, galaxyZoomContent.firstChild);
    }
    drawGalaxyLines(gal); // Draw connection lines
    // Apply pan and zoom to the content container
    galaxyZoomContent.style.transition = isInteractive ? 'none' : 'transform 0.1s ease-out';
    galaxyZoomContent.style.transform = `translate(${gal.currentPanX}px,${gal.currentPanY}px)scale(${gal.currentZoom})`;
    if (galaxyDetailTitleText) {
      const displayId = gal.id.split('-').pop(); // "galaxy-1" -> "1"
      galaxyDetailTitleText.textContent = gal.customName || `Galaxy ${displayId}`; // Corrected
    }
  }
  function drawAllOrbits() {
    if (!orbitCtx || !solarSystemOrbitCanvasEl || !gameSessionData.solarSystemView.planets) return;
    orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);
    if (!currentShowPlanetOrbits) return; // This already handles visibility based on parameter
    const canvasCenterX = solarSystemOrbitCanvasEl.width / 2;
    const canvasCenterY = solarSystemOrbitCanvasEl.height / 2;
    gameSessionData.solarSystemView.planets.forEach(planetData => {
      const orbitalRadius = planetData.distance; // Use the planet's distance directly
      orbitCtx.beginPath();
      orbitCtx.arc(canvasCenterX, canvasCenterY, orbitalRadius, 0, 2 * Math.PI);
      orbitCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      orbitCtx.lineWidth = 1;
      orbitCtx.setLineDash([5, 5]); // Dashed lines for orbits
      orbitCtx.stroke();
    });
    orbitCtx.setLineDash([]); // Reset for other drawings
  }
  function renderSolarSystemScreen(isInteractive = false) {
    if (!solarSystemContent || !solarSystemScreen || !gameSessionData.activeSolarSystemId) { return; }
    const data = gameSessionData.solarSystemView;
    let panX = data.currentPanX || 0, panY = data.currentPanY || 0;
    let zoom = data.zoomLevel || SOLAR_SYSTEM_VIEW_MIN_ZOOM;
    solarSystemContent.style.transition = isInteractive ? 'none' : 'transform 0.1s ease-out';
    solarSystemContent.style.transform = `translate(${panX}px,${panY}px)scale(${zoom})`; // Corrected
    // Correctly find galaxy from system id prefix (e.g., "galaxy-1-ss-5" -> "galaxy-1")
    const galaxyPart = gameSessionData.activeSolarSystemId.substring(0, gameSessionData.activeSolarSystemId.indexOf('-ss-'));
    const activeGalaxy = gameSessionData.galaxies.find(g => g.id === galaxyPart);

    let solarSystemObject = null;
    if (activeGalaxy && activeGalaxy.solarSystems) {
      solarSystemObject = activeGalaxy.solarSystems.find(ss => ss.id === data.systemId);
    }
    if (solarSystemTitleText) {
      solarSystemTitleText.textContent = (solarSystemObject && solarSystemObject.customName) ? solarSystemObject.customName : `System ${data.systemId ? data.systemId.substring(data.systemId.lastIndexOf('-') + 1) : 'N/A'}`;
    }
    if (isInteractive || !animationFrameId) { drawAllOrbits(); } // Redraw orbits on interaction or if animation isn't running
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
      const defaultName = onSaveCallback(newName || null); // Pass null if newName is empty
      titleTextElement.textContent = newName || defaultName; // Use given name or fallback to default
      titleInputElement.style.display = 'none';
      titleTextElement.style.display = 'inline-block';
    };
    titleInputElement.onblur = saveName;
    titleInputElement.onkeydown = (event) => {
      if (event.key === 'Enter') { titleInputElement.blur(); } // Save on Enter
      else if (event.key === 'Escape') { titleInputElement.value = titleTextElement.textContent; titleInputElement.blur(); } // Revert on Escape
    };
  }
  function switchToGalaxyDetailView(galaxyId) {
    const gal = gameSessionData.galaxies.find(g => g.id === galaxyId);
    if (!gal) { switchToMainView(); return; }
    gameSessionData.activeGalaxyId = galaxyId;
    const displayId = gal.id.split('-').pop(); // Used for default naming
    if (backToGalaxyButton) {
      backToGalaxyButton.textContent = gal.customName
        ? `← ${gal.customName}`
        : `← Galaxy ${displayId}`; // Corrected
    }
    gameSessionData.activeSolarSystemId = null; // Reset active solar system
    // Ensure galaxy has pan/zoom values
    gal.currentZoom = gal.currentZoom || 1.0;
    gal.currentPanX = gal.currentPanX || 0;
    gal.currentPanY = gal.currentPanY || 0;
    if (galaxyDetailTitleText) {
      galaxyDetailTitleText.textContent = gal.customName || `Galaxy ${displayId}`; // Corrected
      galaxyDetailTitleText.style.display = 'inline-block';
    }
    if (galaxyDetailTitleInput) galaxyDetailTitleInput.style.display = 'none';
    setActiveScreen(galaxyDetailScreen);
    makeTitleEditable(galaxyDetailTitleText, galaxyDetailTitleInput, (newName) => {
      gal.customName = newName || null; // Store null if name is cleared
      saveGameState(); // Save changes immediately
      renderMainScreen(); // Re-render main screen to update galaxy name there
      // Return the name to be displayed (new name or default with displayId)
      return gal.customName || `Galaxy ${displayId}`; // Corrected
    });
    // Set viewport size, should be based on universe diameter for consistency
    if (galaxyViewport && gameSessionData.universe.diameter) { // Ensure diameter exists
      galaxyViewport.style.width = `${gameSessionData.universe.diameter}px`;
      galaxyViewport.style.height = `${gameSessionData.universe.diameter}px`;
    }
    if (!gal.layoutGenerated) { // Generate layout if not already done
      setTimeout(() => {
        function attemptLayoutGeneration(retriesLeft = 5) {
          if (galaxyViewport && galaxyViewport.offsetWidth > 0) {
            generateSolarSystemsForGalaxy(galaxyId); renderGalaxyDetailScreen(false);
          } else if (retriesLeft > 0) {
            requestAnimationFrame(() => attemptLayoutGeneration(retriesLeft - 1));
          } else { // Fallback if viewport never gets width
            console.warn("Galaxy viewport width not available after retries, layout generation might be incorrect.");
            gal.layoutGenerated = true; renderGalaxyDetailScreen(false);
          }
        }
        attemptLayoutGeneration();
      }, 50); // Short delay to ensure DOM is ready
    } else { renderGalaxyDetailScreen(false); } // Just render if layout exists
  }

  // Modified to accept quaternion
  function renderPlanetVisual(planetData, rotationQuaternion, targetCanvas = planetVisualCanvas) {
    if (!planetData || !targetCanvas) return;

    // Ensure color properties exist, migrate from old `color` if needed
    if (!planetData.continentSeed) { // Every planet needs a seed
      planetData.continentSeed = Math.random();
    }
    if (!planetData.waterColor) { // If waterColor isn't set, it's likely old data or needs defaults
      if (planetData.type === 'normal' && planetData.color) { // Check if original color exists (old format)
        planetData.waterColor = `hsl(${planetData.color.hue}, ${planetData.color.saturation}%, ${planetData.color.lightness}%)`;
        planetData.landColor = `hsl(${planetData.color.hue}, ${planetData.color.saturation + 10}%, ${planetData.color.lightness + 10}%)`; // Slightly varied
        delete planetData.color; // Clean up old color property
      } else { // Default colors if no other info
        planetData.waterColor = '#000080'; // Default navy blue for water
        planetData.landColor = '#006400';  // Default dark green for land
      }
      planetData.type = 'terrestrial'; // Assume terrestrial if colors are set this way or defaulted
    }

    const dataToSend = { // Only send necessary data to worker
      waterColor: planetData.waterColor,
      landColor: planetData.landColor,
      continentSeed: planetData.continentSeed, // The seed is crucial
    };

    const canvasId = targetCanvas.id; // To identify which canvas the worker should respond to

    if (targetCanvas === planetVisualCanvas) {
      planetVisualWorker.postMessage({
        cmd: 'renderPlanet',
        planetData: dataToSend,
        rotationQuaternion: rotationQuaternion, // Pass quaternion directly
        canvasWidth: targetCanvas.width,
        canvasHeight: targetCanvas.height,
        senderId: canvasId
      });
    } else if (targetCanvas === designerPlanetCanvas) {
      designerWorker.postMessage({
        cmd: 'renderPlanet',
        planetData: dataToSend,
        rotationQuaternion: rotationQuaternion, // Pass quaternion directly
        canvasWidth: targetCanvas.width,
        canvasHeight: targetCanvas.height,
        senderId: canvasId
      });
    }
  }

  function switchToSolarSystemView(solarSystemId) {
    gameSessionData.activeSolarSystemId = solarSystemId;
    const galaxyPart = solarSystemId.substring(0, solarSystemId.indexOf('-ss-')); // Extract "galaxy-1" from "galaxy-1-ss-5"
    const activeGalaxy = gameSessionData.galaxies.find(g => g.id === galaxyPart);

    let solarSystemObject = null;
    if (activeGalaxy && activeGalaxy.solarSystems) {
      solarSystemObject = activeGalaxy.solarSystems.find(ss => ss.id === solarSystemId);
    }
    // Reset view state for the new system
    gameSessionData.solarSystemView.zoomLevel = 0.5; // Default zoom
    gameSessionData.solarSystemView.currentPanX = 0;
    gameSessionData.solarSystemView.currentPanY = 0;
    gameSessionData.solarSystemView.systemId = solarSystemId;
    solarSystemContent.innerHTML = ''; // Clear previous system's elements
    // Add Sun
    const sunEl = document.createElement('div');
    sunEl.className = 'sun-icon';
    sunEl.style.width = `${SUN_ICON_SIZE}px`; // Corrected
    sunEl.style.height = `${SUN_ICON_SIZE}px`; // Corrected
    // Center sun using CSS if possible, or position it here
    // sunEl.style.left = `calc(50% - ${SUN_ICON_SIZE / 2}px)`;
    // sunEl.style.top = `calc(50% - ${SUN_ICON_SIZE / 2}px)`;
    solarSystemContent.appendChild(sunEl);
    // Add Orbit Canvas (recreate if necessary for size)
    solarSystemOrbitCanvasEl = document.createElement('canvas'); // Recreate canvas for correct size
    solarSystemOrbitCanvasEl.id = 'solar-system-orbit-canvas'; // Important for styling/selection
    solarSystemOrbitCanvasEl.width = ORBIT_CANVAS_SIZE;
    solarSystemOrbitCanvasEl.height = ORBIT_CANVAS_SIZE;
    // Center the orbit canvas
    // solarSystemOrbitCanvasEl.style.left = `calc(50% - ${ORBIT_CANVAS_SIZE / 2}px)`;
    // solarSystemOrbitCanvasEl.style.top = `calc(50% - ${ORBIT_CANVAS_SIZE / 2}px)`;
    // solarSystemOrbitCanvasEl.style.position = 'absolute'; // Ensure it's positioned relative to solarSystemContent
    solarSystemContent.appendChild(solarSystemOrbitCanvasEl); // Add new canvas
    orbitCtx = solarSystemOrbitCanvasEl.getContext('2d');
    // Generate Planets
    gameSessionData.solarSystemView.planets = [];
    let usedDistances = []; // To avoid overlapping orbits: [{ distance, size }]
    const numPlanets = Math.floor(Math.random() * (currentMaxPlanets - currentMinPlanets + 1)) + currentMinPlanets;
    for (let i = 0; i < numPlanets; i++) {
      const planetSize = Math.random() * (MAX_PLANET_SIZE - MIN_PLANET_SIZE) + MIN_PLANET_SIZE;
      let planetDistance;
      let attemptCount = 0;
      do { // Find a non-overlapping orbital distance
        planetDistance = Math.floor(Math.random() * (MAX_PLANET_DISTANCE - MIN_PLANET_DISTANCE + 1)) + MIN_PLANET_DISTANCE;
        let tooClose = false;
        for (const d of usedDistances) {
          // Check if new planet's orbit is too close to an existing one, considering sizes
          if (Math.abs(planetDistance - d.distance) < (MIN_ORBITAL_SEPARATION + (d.size + planetSize) / 2)) {
            tooClose = true; break;
          }
        }
        if (!tooClose) break; // Found a good distance
        attemptCount++;
      } while (attemptCount < 200); // Max attempts to find a slot
      if (attemptCount === 200) { console.warn("Could not place planet, too crowded."); continue; } // Skip planet if unable to find a non-overlapping distance

      // *** START Planet Design Enforcement ***
      if (gameSessionData.customPlanetDesigns.length === 0) {
        // If NO custom designs exist, skip creating this planet
        // This ensures "planets only use the designs created"
        console.warn("No custom planet designs exist. Skipping planet generation for this system.");
        continue; // Or break if no planets should be generated at all for this system
      }

      // Always use a random custom design if any exist
      const randomDesign = gameSessionData.customPlanetDesigns[Math.floor(Math.random() * gameSessionData.customPlanetDesigns.length)];
      // *** END Planet Design Enforcement ***

      usedDistances.push({ distance: planetDistance, size: planetSize }); // Store for next planet
      const initialOrbitalAngle = Math.random() * 2 * Math.PI;
      const orbitalSpeed = MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT + Math.random() * (MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT - MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT);
      const initialAxialAngle = Math.random() * 2 * Math.PI;
      const axialSpeed = DEFAULT_PLANET_AXIAL_SPEED * (Math.random() * 0.5 + 0.75); // Slight variation
      const newPlanet = {
        id: `planet-${i + 1}`, size: planetSize, distance: planetDistance,
        currentOrbitalAngle: initialOrbitalAngle, orbitalSpeed: orbitalSpeed,
        currentAxialAngle: initialAxialAngle, axialSpeed: axialSpeed,
        element: null, // Will be assigned the DOM element
        planetName: `Planet ${i + 1}`, // Generic name, can be customized later
        // Assign properties from the selected custom design
        type: 'terrestrial', // All custom designs are assumed terrestrial
        waterColor: randomDesign.waterColor,
        landColor: randomDesign.landColor,
        continentSeed: randomDesign.continentSeed,
        sourceDesignId: randomDesign.designId // Keep a reference to the source design
      };

      gameSessionData.solarSystemView.planets.push(newPlanet);

      // *** Pre-load texture for this planet ***
      const preloadData = {
        waterColor: newPlanet.waterColor,
        landColor: newPlanet.landColor,
        continentSeed: newPlanet.continentSeed,
      };
      if (planetVisualWorker) { // Ensure worker exists
          planetVisualWorker.postMessage({
              cmd: 'preloadPlanet', // New command for preloading
              planetData: preloadData,
              rotationQuaternion: quat_identity(), // Dummy rotation, not used for preloading calculation
              canvasWidth: planetVisualCanvas.width, // Worker needs canvas dimensions for texture generation
              canvasHeight: planetVisualCanvas.height,
              senderId: 'preload' // Identifies this as a non-rendering request
          });
      }
      // *** End Pre-load texture ***

      const planetEl = document.createElement('div');
      planetEl.className = 'planet-icon';
      planetEl.style.width = `${newPlanet.size}px`;
      planetEl.style.height = `${newPlanet.size}px`;
      // Basic visual representation for the planet icon (can be replaced by canvas rendering later)
      const randomPos = 15 + Math.random() * 40; // %
      const randomSize = 20 + Math.random() * 30; // %
      let backgroundStyle = `radial-gradient(circle at ${randomPos}% ${randomPos}%, ${newPlanet.landColor} ${randomSize}%, transparent ${randomSize + 20}%), ${newPlanet.waterColor}`; // Corrected
      if (Math.random() < 0.5) { // Add a second "continent" sometimes
        const randomPos2 = 15 + Math.random() * 40; // %
        const randomSize2 = 20 + Math.random() * 30; // %
        backgroundStyle = `radial-gradient(circle at ${90 - randomPos2}% ${90 - randomPos2}% , ${newPlanet.landColor} ${randomSize2}%, transparent ${randomSize2 + 20}%), ` + backgroundStyle; // Corrected
      }
      planetEl.style.background = backgroundStyle;
      planetEl.style.boxShadow = `0 0 ${newPlanet.size / 3}px rgba(255, 255, 255, 0.3)`; // Simple glow
      planetEl.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent solar system pan when clicking planet
        currentPlanetDisplayedInPanel = newPlanet;
        planetVisualTitle.textContent = newPlanet.planetName;
        planetVisualSize.textContent = Math.round(newPlanet.size);
        planetVisualPanel.classList.add('visible');
        // Center the panel
        planetVisualPanel.style.left = '50%';
        planetVisualPanel.style.top = '50%';
        planetVisualPanel.style.transform = 'translate(-50%, -50%)';
        planetVisualPanel.style.transition = ''; // Remove transition for immediate placement

          // Reset rotation to identity when panel is opened for a new planet
          planetVisualRotationQuat = quat_identity();
        renderPlanetVisual(newPlanet, planetVisualRotationQuat, planetVisualCanvas);
      });
      solarSystemContent.appendChild(planetEl);
      newPlanet.element = planetEl; // Store reference to the DOM element
    }

    if (solarSystemTitleText) {
      solarSystemTitleText.textContent = (solarSystemObject && solarSystemObject.customName) ? solarSystemObject.customName : `System ${solarSystemId.substring(solarSystemId.lastIndexOf('-') + 1)}`;
    }
    if (solarSystemTitleInput) solarSystemTitleInput.style.display = 'none'; // Hide input field
    setActiveScreen(solarSystemScreen);
    makeTitleEditable(solarSystemTitleText, solarSystemTitleInput, (newName) => {
      if (solarSystemObject) {
        solarSystemObject.customName = newName || null;
        saveGameState(); // Save change
        renderGalaxyDetailScreen(); // Update galaxy screen if it shows this system's name
        return solarSystemObject.customName || `System ${solarSystemId.substring(solarSystemId.lastIndexOf('-') + 1)}`;
      }
      return `System ${solarSystemId.substring(solarSystemId.lastIndexOf('-') + 1)}`; // Default if somehow no object
    });
    renderSolarSystemScreen(false); // Initial render
    startSolarSystemAnimation(); // Start planet animations
  }

  function animateSolarSystem(now) {
    if (!now) now = performance.now();
    if (lastAnimationTime === null) lastAnimationTime = now; // Initialize if first frame
    const deltaTime = (now - lastAnimationTime) / 1000; // Calculate delta time in seconds
    lastAnimationTime = now;

    const activeSysView = gameSessionData.solarSystemView;
    if (activeSysView && solarSystemScreen.classList.contains('active') && activeSysView.planets) {
      activeSysView.planets.forEach(planet => {
        // Update orbital angle based on delta time and orbital speed
        planet.currentOrbitalAngle += planet.orbitalSpeed * 6 * deltaTime; // Multiplier to make speed noticeable
        // Update axial angle based on delta time and axial speed
        planet.currentAxialAngle += planet.axialSpeed * 60 * deltaTime; // Multiplier for visual rotation speed

        // Calculate model-space orbital offsets (planet's center relative to sun's center)
        // These values are in the coordinate system of the solarSystemContent, before its own pan/zoom transform.
        const planetModelOrbitX = planet.distance * Math.cos(planet.currentOrbitalAngle);
        const planetModelOrbitY = planet.distance * Math.sin(planet.currentOrbitalAngle);

        // Position the planet icon's center relative to the parent's center (50%)
        // The parent (solarSystemContent) will be panned and zoomed.
        planet.element.style.left = `calc(50% + ${planetModelOrbitX}px)`;
        planet.element.style.top = `calc(50% + ${planetModelOrbitY}px)`;

        // Use transform to align the element's own center with the calculated left/top point, and apply axial rotation.
        planet.element.style.transform = `translate(-50%, -50%) rotate(${planet.currentAxialAngle}rad)`;
      });
      animationFrameId = requestAnimationFrame(animateSolarSystem);
    } else {
      if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
      lastAnimationTime = null; // Reset last animation time when animation stops
    }
  }
  function startSolarSystemAnimation() {
    if (!animationFrameId && solarSystemScreen.classList.contains('active')) {
      lastAnimationTime = null; // Ensure fresh start for deltaTime calculation
      animateSolarSystem();
    }
  }
  function clampSolarSystemPan(dataObject, viewportWidth, viewportHeight) {
    if (!dataObject || !viewportWidth || !viewportHeight) { // Basic safety
      if (dataObject) { dataObject.currentPanX = 0; dataObject.currentPanY = 0; }
      return;
    }
    const zm = dataObject.zoomLevel;
    // Content "world" size - effectively the boundary of the solar system view
    const contentWidth = SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2; // Total width of the "universe" in solar system view
    const contentHeight = SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2;
    // How much of the content is visible after scaling
    const scaledContentWidth = contentWidth * zm;
    const scaledContentHeight = contentHeight * zm;
    // Max pan is how much the scaled content exceeds the viewport, divided by 2 (since pan is from center)
    const maxPanX = Math.max(0, (scaledContentWidth - viewportWidth) / 2); // Max positive pan, relative to 0,0 being center of content
    const maxPanY = Math.max(0, (scaledContentHeight - viewportHeight) / 2);
    // Clamp current pan values
    dataObject.currentPanX = Math.max(-maxPanX, Math.min(maxPanX, dataObject.currentPanX));
    dataObject.currentPanY = Math.max(-maxPanY, Math.min(maxPanY, dataObject.currentPanY));
  }
  function clampGalaxyPan(galaxy) {
    if (!galaxy || !galaxyViewport) return;
    const vw = galaxyViewport.offsetWidth;
    const vh = galaxyViewport.offsetHeight;
    const zm = galaxy.currentZoom;
    if (zm <= GALAXY_VIEW_MIN_ZOOM) { // If at min zoom or less, reset pan
      galaxy.currentPanX = 0;
      galaxy.currentPanY = 0;
    } else {
      // Pan limit is half the difference between scaled viewport and original viewport size
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
      isSolarView = true; targetData = gameSessionData.solarSystemView; viewportElement = solarSystemScreen; /* Viewport is the screen itself for solar system */ currentClampFunction = clampSolarSystemPan; currentRenderFunction = renderSolarSystemScreen; hardcodedMinZoom = SOLAR_SYSTEM_VIEW_MIN_ZOOM; hardcodedMaxZoom = SOLAR_SYSTEM_VIEW_MAX_ZOOM; currentZoomProp = 'zoomLevel'; currentPanXProp = 'currentPanX'; currentPanYProp = 'currentPanY';
    } else return; // No active screen for zooming
    const oldZoom = targetData[currentZoomProp];
    let newCalculatedZoom = oldZoom + (direction === 'in' ? (ZOOM_STEP * oldZoom) : -(ZOOM_STEP * oldZoom)); // Proportional zoom step
    // Determine minimum zoom, especially for solar view to keep explorable area visible
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
    newCalculatedZoom = Math.max(finalMinZoomForClamping, Math.min(hardcodedMaxZoom, newCalculatedZoom)); // Clamp zoom
    if (Math.abs(oldZoom - newCalculatedZoom) < 0.0001) return; // No significant change
    targetData[currentZoomProp] = newCalculatedZoom;
    // Zoom towards mouse cursor if mouseEvent is provided
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
      // Point in content space under cursor before zoom. Relative to center of TARGET CONTENT.
      const worldX = (mouseXRelativeToCenter - currentPanX) / oldZoom;
      const worldY = (mouseYRelativeToCenter - currentPanY) / oldZoom;
      // New pan so that worldX, worldY remains under mouseXRelativeToCenter, mouseYRelativeToCenter
      targetData[currentPanXProp] = mouseXRelativeToCenter - (worldX * newCalculatedZoom);
      targetData[currentPanYProp] = mouseYRelativeToCenter - (worldY * newCalculatedZoom);
    }
    // Apply clamping and re-render
    if (isSolarView) {
      currentClampFunction(targetData, viewportElement.offsetWidth, viewportElement.offsetHeight);
      currentRenderFunction(true); // Interactive render
      startSolarSystemAnimation(); // Ensure animation continues
      drawAllOrbits(); // Redraw orbits after zoom/pan
    } else { // Galaxy View
      currentClampFunction(targetData); // Clamp pan for galaxy
      currentRenderFunction(true); // Interactive render for galaxy
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
    const pS = gameSessionData.panning; pS.isActive = false; // Corrected: use assignment
    if (pS.targetElement) pS.targetElement.style.transition = ''; // Restore transitions
    // Final render with transitions enabled if needed by the render function
    if (galaxyDetailScreen.classList.contains('active')) renderGalaxyDetailScreen(false);
    else if (solarSystemScreen.classList.contains('active')) renderSolarSystemScreen(false);
    // Clear panning state
    pS.targetElement = null; pS.viewportElement = null; pS.dataObject = null;
  }
  function regenerateCurrentUniverseState(fromModal = false) {
    if (!fromModal && !confirm("Regenerate universe with current settings? This will clear the currently saved layout.")) { return; }
    localStorage.removeItem('galaxyGameSaveData'); // Clear saved game
    // Reset game state variables
    gameSessionData.universe = { diameter: null };
    gameSessionData.galaxies = [];
    gameSessionData.activeGalaxyId = null;
    gameSessionData.activeSolarSystemId = null;
    gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };
    gameSessionData.isInitialized = false; // Will be set true by initializeGame
    // Clear UI elements
    if (universeCircle) universeCircle.innerHTML = '';
    if (galaxyZoomContent) { const canvas = galaxyZoomContent.querySelector('#solar-system-lines-canvas'); galaxyZoomContent.innerHTML = ''; if (canvas) galaxyZoomContent.appendChild(canvas); } // Preserve canvas, clear icons
    if (solarSystemContent) solarSystemContent.innerHTML = '';
    if (orbitCtx && solarSystemOrbitCanvasEl) orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);
    // Stop animations
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    lastAnimationTime = null; // Reset for solar system animation timing
    initializeGame(true); // Force regeneration in initialization
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
      updateDerivedConstants(); // Update constants based on new settings
      saveCustomizationSettings(); // Save these settings
      customizationModal.classList.remove('visible');
      regenerateCurrentUniverseState(true); // Regenerate with new settings (fromModal = true to bypass confirm)
    });
  }
  if (closePlanetVisualPanelBtn) {
    closePlanetVisualPanelBtn.addEventListener('click', () => {
      planetVisualPanel.classList.remove('visible');
      currentPlanetDisplayedInPanel = null; // Clear the displayed planet
    });
  }
  let isPanelDragging = false; // For dragging the planet visual panel itself
  let visualPanelOffset = { x: 0, y: 0 };

  // Change event listener from the entire panel to the header for dragging
  if (planetVisualPanelHeader) { // Ensure the header element exists
    planetVisualPanelHeader.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left-click

      isPanelDragging = true;
      planetVisualPanel.classList.add('dragging');

      planetVisualPanel.style.transition = 'none'; // Disable transition during drag
      const rect = planetVisualPanel.getBoundingClientRect();
      visualPanelOffset.x = e.clientX - rect.left;
      visualPanelOffset.y = e.clientY - rect.top;

      // Set initial position to fixed pixel values for easier dragging calculus
      // This takes it out of the "transform: translate(-50%, -50%)" flow.
      planetVisualPanel.style.left = `${e.clientX - visualPanelOffset.x}px`;
      planetVisualPanel.style.top = `${e.clientY - visualPanelOffset.y}px`;
      planetVisualPanel.style.transform = 'none'; // Reset transform to avoid conflicts
      planetVisualPanel.style.right = 'auto'; // Clear other position properties
      planetVisualPanel.style.bottom = 'auto';
      e.preventDefault(); // Prevent default browser drag behavior (e.g., text selection)
    });
  }

  planetVisualCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !currentPlanetDisplayedInPanel) return; // Only left-click, ensure planet is shown
    isDraggingPlanetVisual = true; // Flag for planet canvas drag
    startDragMouseX = e.clientX;
    startDragMouseY = e.clientY;
    startDragPlanetVisualQuat = [...planetVisualRotationQuat]; // Copy current quaternion

    planetVisualCanvas.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (isPanelDragging) { // Dragging the entire panel
      planetVisualPanel.style.left = `${e.clientX - visualPanelOffset.x}px`;
      planetVisualPanel.style.top = `${e.clientY - visualPanelOffset.y}px`;
    }

    if (isDraggingPlanetVisual && currentPlanetDisplayedInPanel && planetVisualPanel.classList.contains('visible')) {
      const rect = planetVisualCanvas.getBoundingClientRect();
      const canvasWidth = rect.width;
      const canvasHeight = rect.height;

      const deltaMouseX = e.clientX - startDragMouseX;
      const deltaMouseY = e.clientY - startDragMouseY;

      // Determine rotation amounts based on mouse movement
      const rotationAroundX = (deltaMouseY / canvasHeight) * Math.PI * PLANET_ROTATION_SENSITIVITY; // Vertical movement for X-axis rotation
      const rotationAroundY = (deltaMouseX / canvasWidth) * (2 * Math.PI) * PLANET_ROTATION_SENSITIVITY; // Horizontal movement for Y-axis rotation

      // Create incremental quaternions for rotation about camera's X and Y axes
      // Negative sign to make the *surface* drag in the same direction as the mouse
      const incX_quat = quat_from_axis_angle([1, 0, 0], -rotationAroundX);
      const incY_quat = quat_from_axis_angle([0, 1, 0], -rotationAroundY);

      // Combine these incremental rotations by multiplying them into a single update quaternion.
      // Order matters: here, Y (yaw) then X (pitch) in camera space, then apply to current rotation.
      // The rotation is applied to the starting quaternion.
      const combined_inc_quat = quat_multiply(incY_quat, incX_quat);

      // The new total rotation is the product of the incremental rotation and the starting rotation.
      // Order: combined_inc_quat * startDragPlanetVisualQuat
      planetVisualRotationQuat = quat_normalize(quat_multiply(combined_inc_quat, startDragPlanetVisualQuat));

      if (!renderPending) {
        renderPending = true;
        requestAnimationFrame(() => {
          renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas);
          renderPending = false;
        });
      }
    } else if (isDraggingDesignerPlanet) { // Dragging the designer planet
      const rect = designerPlanetCanvas.getBoundingClientRect();
      const canvasWidth = rect.width;
      const canvasHeight = rect.height;

      const deltaMouseX = e.clientX - designerStartDragMouseX; // Use designer-specific start coords
      const deltaMouseY = e.clientY - designerStartDragMouseY;

      const rotationAroundX = (deltaMouseY / canvasHeight) * Math.PI * PLANET_ROTATION_SENSITIVITY;
      const rotationAroundY = (deltaMouseX / canvasWidth) * (2 * Math.PI) * PLANET_ROTATION_SENSITIVITY;

      const incX_quat = quat_from_axis_angle([1, 0, 0], -rotationAroundX);
      const incY_quat = quat_from_axis_angle([0, 1, 0], -rotationAroundY);

      const combined_inc_quat = quat_multiply(incY_quat, incX_quat);

      designerPlanetRotationQuat = quat_normalize(quat_multiply(combined_inc_quat, startDragDesignerPlanetQuat)); // Use designer quaternions

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
      planetVisualPanel.style.transition = ''; // Restore transitions if any
    }
    if (isDraggingPlanetVisual) {
      isDraggingPlanetVisual = false;
      planetVisualCanvas.classList.remove('dragging');
    }
    if (isDraggingDesignerPlanet) { // Also handle designer panel mouseup
      isDraggingDesignerPlanet = false;
      designerPlanetCanvas.classList.remove('dragging');
    }
  });
  // --- Planet Designer Logic ---
  let currentDesignerPlanet = { waterColor: '#000080', landColor: '#006400', continentSeed: Math.random() };
  function renderDesignerPlanet(planet, rotationQuaternion) {
    if (!planet || !designerPlanetCanvas) return;
    // Call the main renderPlanetVisual function, but target the designer canvas
    renderPlanetVisual(planet, rotationQuaternion, designerPlanetCanvas);
  }
  function updateDesignerPlanetFromInputs() {
    currentDesignerPlanet.waterColor = designerWaterColorInput.value;
    currentDesignerPlanet.landColor = designerLandColorInput.value;
    // continentSeed is not changed by color inputs
    renderDesignerPlanet(currentDesignerPlanet, designerPlanetRotationQuat); // Pass current quaternion
  }
  function randomizeDesignerPlanet() {
    currentDesignerPlanet.waterColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    currentDesignerPlanet.landColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    currentDesignerPlanet.continentSeed = Math.random(); // Also randomize seed
    // Update input fields
    designerWaterColorInput.value = currentDesignerPlanet.waterColor;
    designerLandColorInput.value = currentDesignerPlanet.landColor;
    designerPlanetRotationQuat = quat_identity(); // Reset rotation on randomize
    renderDesignerPlanet(currentDesignerPlanet, designerPlanetRotationQuat);
  }
  function saveCustomPlanetDesign() {
    const newDesign = {
      designId: `design-${Date.now()}`, // Unique ID for the design
      waterColor: currentDesignerPlanet.waterColor,
      landColor: currentDesignerPlanet.landColor,
      continentSeed: currentDesignerPlanet.continentSeed,
      name: `Custom Planet ${gameSessionData.customPlanetDesigns.length + 1}` // Default name
    };
    gameSessionData.customPlanetDesigns.push(newDesign);
    saveGameState(); // Persist the new design
    populateSavedDesignsList(); // Update the list of saved designs
  }
  function populateSavedDesignsList() {
    savedDesignsUl.innerHTML = ''; // Clear existing list
    if (gameSessionData.customPlanetDesigns.length === 0) {
      savedDesignsUl.innerHTML = '<li>No designs saved yet.</li>';
      return;
    }
    gameSessionData.customPlanetDesigns.forEach(design => {
      const li = document.createElement('li');
      li.dataset.designId = design.designId; // Store ID for potential future use (e.g., edit)

      const designNameSpan = document.createElement('span');
      designNameSpan.className = 'design-item-name';
      designNameSpan.textContent = design.name;
      li.appendChild(designNameSpan);

      // Add a delete button for each design
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'design-item-delete';
      deleteBtn.textContent = 'x'; // Simple 'x' for delete
      deleteBtn.title = `Delete ${design.name}`;
      deleteBtn.onclick = (e) => {
        e.stopPropagation(); // Don't trigger li click if any
        if (confirm(`Delete design "${design.name}"?`)) {
          gameSessionData.customPlanetDesigns = gameSessionData.customPlanetDesigns.filter(d => d.designId !== design.designId);
          saveGameState();
          populateSavedDesignsList(); // Re-render the list
        }
      };
      li.appendChild(deleteBtn);
      savedDesignsUl.appendChild(li);
    });
  }
  function switchToPlanetDesignerScreen() {
    setActiveScreen(planetDesignerScreen);
    randomizeDesignerPlanet(); // Start with a random planet design
    populateSavedDesignsList(); // Show currently saved designs
  }
  designerPlanetCanvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Only left-click
    isDraggingDesignerPlanet = true;
    designerStartDragMouseX = e.clientX;
    designerStartDragMouseY = e.clientY;
    startDragDesignerPlanetQuat = [...designerPlanetRotationQuat]; // Copy current designer quaternion

    designerPlanetCanvas.classList.add('dragging');
    e.preventDefault();
  });
  designerWaterColorInput.addEventListener('change', updateDesignerPlanetFromInputs);
  designerLandColorInput.addEventListener('change', updateDesignerPlanetFromInputs);
  designerRandomizeBtn.addEventListener('click', randomizeDesignerPlanet);
  designerSaveBtn.addEventListener('click', saveCustomPlanetDesign);
  designerCancelBtn.addEventListener('click', () => setActiveScreen(mainScreen)); // Go back to main screen
  createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);
  // --- End Planet Designer Logic ---
  function initializeGame(isForcedRegeneration = false) {
    loadCustomizationSettings();
    if (!isForcedRegeneration && loadGameState()) { // Try to load saved game first if not forced
      setActiveScreen(mainScreen);
      // Ensure universe circle is sized correctly from loaded data
      if (universeCircle && gameSessionData.universe.diameter) {
        universeCircle.style.width = `${gameSessionData.universe.diameter}px`;
        universeCircle.style.height = `${gameSessionData.universe.diameter}px`;
        universeCircle.style.backgroundColor = FIXED_COLORS.universeBg;
      } else { generateUniverseLayout(); } // Generate layout if missing from save (shouldn't happen)
      renderMainScreen();
      preGenerateAllGalaxyContents(); // Ensure all galaxy solar systems are generated
    } else { // No save data or forced regeneration
      generateUniverseLayout();
      generateGalaxies();
      setActiveScreen(mainScreen);
      renderMainScreen();
      preGenerateAllGalaxyContents(); // Generate all solar systems now
      // Save initial state if all galaxies were generated successfully
      if (gameSessionData.galaxies.every(g => g.layoutGenerated)) { saveGameState(); }
    }
    gameSessionData.isInitialized = true;
  }
  window.addEventListener('resize', () => {
    // This is a destructive resize, it resets the game.
    // Consider a more sophisticated approach if state preservation is critical during resize.
    const currentScreenIdBeforeResize = document.querySelector('.screen.active')?.id;

    localStorage.removeItem('galaxyGameSaveData'); // Clear saved game on resize
    // Reset all game state
    gameSessionData.universe = { diameter: null };
    gameSessionData.galaxies = [];
    gameSessionData.activeGalaxyId = null;
    gameSessionData.activeSolarSystemId = null;
    gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };
    gameSessionData.isInitialized = false;
    // Clear UI
    if (universeCircle) universeCircle.innerHTML = '';
    if (galaxyZoomContent) { const canvas = galaxyZoomContent.querySelector('#solar-system-lines-canvas'); galaxyZoomContent.innerHTML = ''; if (canvas) galaxyZoomContent.appendChild(canvas); }
    if (solarSystemContent) solarSystemContent.innerHTML = '';
    if (orbitCtx && solarSystemOrbitCanvasEl) orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);
    // Stop animations
    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    lastAnimationTime = null;

    // Re-initialize with new dimensions
    loadCustomizationSettings(); // Reload customization, as these are independent of game state
    initializeGame(true); // Force regeneration

    // Try to return to the screen that was active before resize
    if (currentScreenIdBeforeResize) {
      const screenToActivate = document.getElementById(currentScreenIdBeforeResize) || mainScreen;
      setActiveScreen(screenToActivate);
    } else {
      setActiveScreen(mainScreen);
    }
  });
  if (backToMainButton) backToMainButton.addEventListener('click', switchToMainView);
  if (backToGalaxyButton) backToGalaxyButton.addEventListener('click', () => {
    // Ensure activeGalaxyId is valid before switching
    if (gameSessionData.activeGalaxyId && gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId)) {
      switchToGalaxyDetailView(gameSessionData.activeGalaxyId);
    } else { // Fallback to main view if active galaxy is somehow invalid
      switchToMainView();
    }
  });
  if (zoomInButton) zoomInButton.addEventListener('click', (e) => handleZoom('in', e)); // Pass event for mouse-centered zoom
  if (zoomOutButton) zoomOutButton.addEventListener('click', (e) => handleZoom('out', e)); // Pass event
  // --- Wheel Zoom Event Listeners ---
  if (galaxyViewport) { // Zoom for Galaxy Detail View
    galaxyViewport.addEventListener('wheel', (e) => {
      if (galaxyDetailScreen.classList.contains('active')) {
        e.preventDefault(); // Prevent page scroll
        handleZoom(e.deltaY < 0 ? 'in' : 'out', e); // Zoom based on wheel direction, pass event
      }
    });
  }
  if (solarSystemScreen) { // Zoom for Solar System View (event on the screen itself)
    solarSystemScreen.addEventListener('wheel', (e) => {
      if (solarSystemScreen.classList.contains('active')) {
        e.preventDefault(); // Prevent page scroll
        handleZoom(e.deltaY < 0 ? 'in' : 'out', e); // Zoom based on wheel direction, pass event
      }
    });
  }
  // --- Panning Event Listeners ---
  // Solar System Panning (using the generic pan functions)
  if (solarSystemScreen) { solarSystemScreen.addEventListener('mousedown', (e) => { if (solarSystemScreen.classList.contains('active')) { startPan(e, solarSystemScreen, solarSystemContent, gameSessionData.solarSystemView); } }); }
  // Global mouse move and up listeners for the generic panning system
  window.addEventListener('mousemove', panMouseMove);
  window.addEventListener('mouseup', panMouseUp);
  // Galaxy Detail Panning (using its own specific listeners for now, consider unifying later)
  // Click on solar system icon within galaxy view (event delegation on galaxyZoomContent)
  if (galaxyZoomContent) {
    galaxyZoomContent.addEventListener('click', function (event) {
      // Check if panning is active and if the click was not on a solar system icon
      // This can help differentiate between a pan-ending click and an icon click.
      if (gameSessionData.panning.isActive && !event.target.closest('.solar-system-icon')) {
        // If a pan was in progress and ended on the background, it's handled by panMouseUp.
        // If it was a click without drag, this block might not be strictly necessary depending on pan logic.
        return;
      }
      // Handle click on a solar system icon
      const ssIcon = event.target.closest('.solar-system-icon');
      if (ssIcon) {
        const ssId = ssIcon.dataset.solarSystemId;
        if (ssId) {
          switchToSolarSystemView(ssId);
          event.stopPropagation(); // Prevent further bubbling if needed
        }
      }
    });
  }
  let isGalaxyPanning = false; // Specific flag for galaxy view panning
  let galaxyPanStart = { x: 0, y: 0 };
  let galaxyLastPan = { x: 0, y: 0 }; // To store initial pan at mousedown
  if (galaxyViewport) {
    galaxyViewport.addEventListener('mousedown', (e) => {
      if (
        e.button !== 0 || // Only left click
        !galaxyDetailScreen.classList.contains('active') || // Only when this screen is active
        e.target.closest('.solar-system-icon') || // Don't pan if clicking on a solar system
        e.target.closest('button') // Don't pan if clicking on a button (e.g. zoom controls if they were inside)
      ) return;

      isGalaxyPanning = true;
      galaxyPanStart.x = e.clientX;
      galaxyPanStart.y = e.clientY;

      const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
      galaxyLastPan.x = gal?.currentPanX || 0; // Store current pan of the active galaxy
      galaxyLastPan.y = gal?.currentPanY || 0;

      galaxyViewport.classList.add('dragging'); // Visual feedback for dragging
      if (galaxyZoomContent) galaxyZoomContent.style.transition = 'none'; // Disable transition for smooth drag
      e.preventDefault(); // Prevent text selection, etc.
    });

    // These listeners were on `window` which is more robust for dragging outside the element
    // Ensuring they are correctly scoped or that the generic panMouseMove/Up handle this.
    // For now, assuming the specific galaxy panning uses these window listeners.
    // If unifying, these would be removed and panMouseMove/Up would be adapted.
    // Duplicated window event listeners for mousemove/mouseup are generally not ideal.
    // The generic panMouseMove/panMouseUp already exist. This is a point for future refactoring.
    // For now, the second set of listeners is kept if it handles galaxy panning specifically.
    // However, the provided code already wires `panMouseMove` and `panMouseUp` to `window`.
    // The following specialized listeners are likely redundant or conflicting with the generic one.
    // I'll keep them as they were in the original structure if `startPan` is NOT called for galaxy.

    // The current structure HAS the generic `panMouseMove` and `panMouseUp` on `window`.
    // The `startPan` function is NOT called by the galaxyViewport mousedown.
    // So these specific handlers are necessary for galaxy panning IF the generic system isn't used for it.
    // Let's keep the dedicated galaxy panning logic that was present.

    window.addEventListener('mousemove', (e) => { // This window listener could conflict if not careful
      if (!isGalaxyPanning) return; // Only act if galaxy panning is active

      const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
      if (!gal) return; // No active galaxy

      const dx = e.clientX - galaxyPanStart.x;
      const dy = e.clientY - galaxyPanStart.y;

      gal.currentPanX = galaxyLastPan.x + dx;
      gal.currentPanY = galaxyLastPan.y + dy;

      if (typeof clampGalaxyPan === 'function') { // Ensure function exists
        clampGalaxyPan(gal); // Clamp the pan values
      }
      renderGalaxyDetailScreen(true); // Re-render interactively
    });

    window.addEventListener('mouseup', (e) => { // This window listener could conflict
      if (isGalaxyPanning) {
        isGalaxyPanning = false;
        galaxyViewport.classList.remove('dragging');
        if (galaxyZoomContent) galaxyZoomContent.style.transition = ''; // Restore transition
        // Final render might not be needed if renderGalaxyDetailScreen(true) above is sufficient
        // renderGalaxyDetailScreen(false); // Non-interactive render after pan ends
      }
    });
  }
  // --- Initial Game Load ---
  initializeGame();
});
