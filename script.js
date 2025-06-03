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
  const designerMinHeightInput = document.getElementById('designer-min-height');
  const designerMaxHeightInput = document.getElementById('designer-max-height');
  const designerOceanHeightInput = document.getElementById('designer-ocean-height');

  let linesCtx;
  let solarSystemOrbitCanvasEl;
  let orbitCtx;
  let animationFrameId = null;
  let lastAnimationTime = null;
  let isSolarSystemPaused = false;
  let isDraggingPlanetVisual = false;
  let isDraggingDesignerPlanet = false;
  let isRenderingVisualPlanet = false;
  let isRenderingDesignerPlanet = false;
  let needsPlanetVisualRerender = false;
  let planetVisualRotationQuatTarget = quat_identity();
  let planetVisualRotationQuatDisplayed = quat_identity();
  let currentDesignerBasis = {
    waterColor: '#000080',
    landColor: '#006400',
    continentSeed: Math.random(),
    minTerrainHeightRange: [0, 2],      // [min, max]
    maxTerrainHeightRange: [8, 12],     // [min, max]
    oceanHeightRange: [1, 3]            // [min, max]
};
  
  function quat_identity() {
    return [1, 0, 0, 0];
  }

  function quat_from_axis_angle(axis, angle) {
    const halfAngle = angle * 0.5;
    const s = Math.sin(halfAngle);
    return [
      Math.cos(halfAngle),
      axis[0] * s,
      axis[1] * s,
      axis[2] * s
    ];
  }

  function quat_multiply(q1, q2) {
    const w1 = q1[0], x1 = q1[1], y1 = q1[2], z1 = q1[3];
    const w2 = q2[0], x2 = q2[1], y2 = q2[2], z2 = q2[3];
    return [
      w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
      w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
      w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
      w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2
    ];
  }

  function quat_normalize(q) {
    let len_sq = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
    if (len_sq === 0) return [1, 0, 0, 0];
    let len = 1 / Math.sqrt(len_sq);
    return [q[0] * len, q[1] * len, q[2] * len, q[3] * len];
  }

  let planetVisualRotationQuat = quat_identity();
  let startDragPlanetVisualQuat = quat_identity();
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
  const DEFAULT_PLANET_AXIAL_SPEED = 0.01;
  const BASE_MAX_PLANET_DISTANCE_FACTOR = 25; // Increased from 8
  const PLANET_ROTATION_SENSITIVITY = 0.75;
  const DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
  const DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
  const DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;

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
  let MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0; // Increased from 1.5 * multiplier logic
  let MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier;
  let ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
  let SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2; // Dynamically set
  const MIN_ORBITAL_SEPARATION = 20;
  let MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.005;
  let MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.01;
  const FIXED_COLORS = { universeBg: "#100520", galaxyIconFill: "#7f00ff", galaxyIconBorder: "#da70d6", solarSystemBaseColor: "#ffd700", sunFill: "#FFD700", sunBorder: "#FFA500", connectionLine: "rgba(255, 255, 255, 0.3)" };
  let gameSessionData = { universe: { diameter: null }, galaxies: [], activeGalaxyId: null, activeSolarSystemId: null, solarSystemView: { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null }, isInitialized: false, panning: { isActive: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0, targetElement: null, viewportElement: null, dataObject: null }, customPlanetDesigns: [] };

  let planetVisualWorker = null;
  let designerWorker = null;

  if (window.Worker) {
    planetVisualWorker = new Worker('planetRendererWorker.js');
    designerWorker = new Worker('planetRendererWorker.js');

planetVisualWorker.onmessage = function(e) {
  const { renderedData, width, height, senderId } = e.data;
  if (senderId === 'planet-visual-canvas' && planetVisualCanvas) {
    const ctx = planetVisualCanvas.getContext('2d');
    ctx.clearRect(0, 0, planetVisualCanvas.width, planetVisualCanvas.height);
    if (renderedData && width && height) {
      try {
        const clampedArray = new Uint8ClampedArray(renderedData);
        const imageDataObj = new ImageData(clampedArray, width, height);
        ctx.putImageData(imageDataObj, 0, 0);

        // ---- STEP D GOES HERE ----
        planetVisualCanvas.style.transform = ""; // Remove CSS rotation
        planetVisualRotationQuatDisplayed = planetVisualRotationQuatTarget;
        // --------------------------

      } catch (err) {
        console.error("Error putting ImageData on planetVisualCanvas:", err);
      }
    }
  }
  isRenderingVisualPlanet = false;
      if (needsPlanetVisualRerender && currentPlanetDisplayedInPanel && planetVisualPanel.classList.contains('visible')) {
          needsPlanetVisualRerender = false;
          isRenderingVisualPlanet = true;
          renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas);
}
    };

    designerWorker.onmessage = function(e) {
      const { renderedData, width, height, senderId } = e.data;
      if (senderId === 'designer-planet-canvas' && designerPlanetCanvas) {
        const ctx = designerPlanetCanvas.getContext('2d');
        ctx.clearRect(0, 0, designerPlanetCanvas.width, designerPlanetCanvas.height);
        if (renderedData && width && height) {
         try {
            const clampedArray = new Uint8ClampedArray(renderedData);
            const imageDataObj = new ImageData(clampedArray, width, height);
            ctx.putImageData(imageDataObj, 0, 0);
          } catch (err) {
            console.error("Error putting ImageData on designerPlanetCanvas:", err);
          }
        }
      }
      isRenderingDesignerPlanet = false;
    };
  } else {
    console.warn("Web Workers not supported in this browser. Planet rendering will be disabled.");
  }

  class PerlinNoise {
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
      for (let i = 0; i < 256; i++) {
        let r = Math.floor(this.random() * (i + 1));
        let tmp = this.permutation[i];
        this.permutation[i] = this.permutation[r];
        this.permutation[r] = tmp;
      }
      for (let i = 0; i < 256; i++) {
        this.p[i] = this.p[i + 256] = this.permutation[i];
      }
    }
    random() {
      let x = Math.sin(this.seed++) * 10000;
      return x - Math.floor(x);
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return a + t * (b - a); }
    grad(hash, x, y, z) {
      hash = hash & 15;
      let u = hash < 8 ? x : y;
      let v = hash < 4 ? y : hash === 12 || hash === 14 ? x : z;
      return ((hash & 1) === 0 ? u : -u) + ((hash & 2) === 0 ? v : -v);
    }
    noise(x, y, z) {
      let floorX = Math.floor(x) & 255;
      let floorY = Math.floor(y) & 255;
      let floorZ = Math.floor(z) & 255;
      x -= Math.floor(x);
      y -= Math.floor(y);
      z -= Math.floor(z);
      let u = this.fade(x);
      let v = this.fade(y);
      let w = this.fade(z);
      let A = this.p[floorX] + floorY;
      let AA = this.p[A] + floorZ;
      let AB = this.p[A + 1] + floorZ;
      let B = this.p[floorX + 1] + floorY;
      let BA = this.p[B] + floorZ;
      let BB = this.p[B + 1] + floorZ;
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
      let maxValue = 0;
      for (let i = 0; i < octaves; i++) {
        total += this.noise(x * frequency, y * frequency, z * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }
      return maxValue === 0 ? 0 : total / maxValue;
    }
  }
  function updateDerivedConstants() {
    MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier;
    // Adjusted MIN_PLANET_DISTANCE logic for new base factor
    MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0 * (currentMaxPlanetDistanceMultiplier > 0.5 ? currentMaxPlanetDistanceMultiplier * 0.8 : 0.5);
    ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
    SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2; // Make explorable radius dependent on max planet distance
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
        currentMinPlanets = parseInt(loadedSettings.minPlanets, 10);
        if (isNaN(currentMinPlanets)) currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM;
        currentMaxPlanets = parseInt(loadedSettings.maxPlanets, 10);
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
                ss.sunSizeFactor = ss.sunSizeFactor ?? (0.5 + Math.random() * 9.5); // Add default for old saves
              });
            }
            gal.lineConnections = gal.lineConnections || [];
          });
          gameSessionData.customPlanetDesigns = loadedState.customPlanetDesigns || [];
          gameSessionData.customPlanetDesigns.forEach(design => {
            design.minTerrainHeight = design.minTerrainHeight ?? DEFAULT_MIN_TERRAIN_HEIGHT;
            design.maxTerrainHeight = design.maxTerrainHeight ?? DEFAULT_MAX_TERRAIN_HEIGHT;
            design.oceanHeightLevel = design.oceanHeightLevel ?? DEFAULT_OCEAN_HEIGHT_LEVEL;
          });
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
      if (screen) screen.classList.remove('active', 'panning-active');
    });
    if (screenToShow) {
      screenToShow.classList.add('active');
    }
    if (zoomControlsElement) {
      if (screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen) zoomControlsElement.classList.add('visible');
      else zoomControlsElement.classList.remove('visible');
    }
    if (regenerateUniverseButton) {
      regenerateUniverseButton.style.display = (screenToShow === mainScreen || screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen || screenToShow === planetDesignerScreen) ? 'block' : 'none';
    }
    if (customizeGenerationButton) {
      customizeGenerationButton.style.display = (screenToShow === mainScreen || screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen || screenToShow === planetDesignerScreen) ? 'block' : 'none';
    }
    if (createPlanetDesignButton) {
      createPlanetDesignButton.style.display = (screenToShow === mainScreen || screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen || screenToShow === planetDesignerScreen) ? 'block' : 'none';
    }
    if (!(screenToShow === solarSystemScreen && planetVisualPanel.classList.contains('visible'))) {
         planetVisualPanel.classList.remove('visible');
    }
  }
  function generateUniverseLayout() { const smd = Math.min(window.innerWidth, window.innerHeight); gameSessionData.universe.diameter = Math.max(300, smd * 0.85); if (universeCircle) { universeCircle.style.width = `${gameSessionData.universe.diameter}px`; universeCircle.style.height = `${gameSessionData.universe.diameter}px`; universeCircle.style.backgroundColor = FIXED_COLORS.universeBg; } }
  function generateGalaxies() {
    if (!gameSessionData.universe.diameter) return;
    gameSessionData.galaxies = [];
    const pr = gameSessionData.universe.diameter / 2;
    const tpr = [];
    for (let i = 0; i < currentNumGalaxies; i++) {
      const id = `galaxy-${i + 1}`, pos = getNonOverlappingPositionInCircle(pr, GALAXY_ICON_SIZE, tpr);
      if (pos && !isNaN(pos.x) && !isNaN(pos.y)) {
        gameSessionData.galaxies.push({ id, x: pos.x, y: pos.y, customName: null, solarSystems: [], lineConnections: [], layoutGenerated: false, currentZoom: 1.0, currentPanX: 0, currentPanY: 0, generationParams: { densityFactor: 0.8 + Math.random() * 0.4 } });
        tpr.push({ x: pos.x, y: pos.y, width: GALAXY_ICON_SIZE, height: GALAXY_ICON_SIZE })
      }
    }
  }
  function getDistance(sys1, sys2) { return Math.sqrt(Math.pow(sys1.centerX - sys2.centerX, 2) + Math.pow(sys1.centerY - sys2.centerY, 2)); }
  function tryAddConnection(fromId, toId, currentConnectionsArray, currentCountsObject, allSystemsLookup, maxDistanceLimit) { if (!fromId || !toId || fromId === toId || fromId === null || toId === null) return false; if ((currentCountsObject[fromId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM || (currentCountsObject[toId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM) { return false; } const key = [fromId, toId].sort().join('-'); if (currentConnectionsArray.some(conn => ([conn.fromId, conn.toId].sort().join('-') === key))) { return false; } if (maxDistanceLimit !== undefined && maxDistanceLimit !== null) { const sys1 = allSystemsLookup.find(s => s.id === fromId); const sys2 = allSystemsLookup.find(s => s.id === toId); if (sys1 && sys2 && getDistance(sys1, sys2) > maxDistanceLimit) { return false; } } return true; }
  function generateSolarSystemsForGalaxy(galaxyId) {
    const gal = gameSessionData.galaxies.find(g => g.id === galaxyId);
    if (!gal || !galaxyViewport) { return; }
    if (gal.layoutGenerated && !gameSessionData.isForceRegenerating) return;
    const pd = galaxyViewport.offsetWidth > 0 ? galaxyViewport.offsetWidth : (gameSessionData.universe.diameter || 500);
    const pr = pd / 2;
    if (pd <= 0 || isNaN(pr) || pr <= 0) { gal.layoutGenerated = true; if (!gameSessionData.isForceRegenerating) saveGameState(); return }
    gal.solarSystems = []; gal.lineConnections = []; const tpr = [];
    const numSystemsToAssign = Math.floor(Math.random() * (currentMaxSSCount - currentMinSSCount + 1)) + currentMinSSCount;
    for (let i = 0; i < numSystemsToAssign; i++) {
      const sysId = `${gal.id}-ss-${i + 1}`;
      const pos = getNonOverlappingPositionInCircle(pr, SOLAR_SYSTEM_BASE_ICON_SIZE, tpr);
      if (pos && !isNaN(pos.x) && !isNaN(pos.y)) {
        const sunSizeFactor = 0.5 + Math.random() * 9.5;
        gal.solarSystems.push({
            id: sysId,
            customName: null,
            x: pos.x,
            y: pos.y,
            iconSize: SOLAR_SYSTEM_BASE_ICON_SIZE,
            sunSizeFactor: sunSizeFactor
        });
        tpr.push({ x: pos.x, y: pos.y, width: SOLAR_SYSTEM_BASE_ICON_SIZE, height: SOLAR_SYSTEM_BASE_ICON_SIZE })
      }
    }
    if (gal.solarSystems.length < 2) { gal.layoutGenerated = true; if (!gameSessionData.isForceRegenerating) saveGameState(); return; }
    const allSystemCoords = gal.solarSystems.map(ss => ({ ...ss, centerX: ss.x + ss.iconSize / 2, centerY: ss.y + ss.iconSize / 2 }));
    const systemConnectionCounts = {};
    const currentGalaxyDiameter = pd;
    const actualMaxEuclideanConnectionDistance = currentGalaxyDiameter * MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT;
    const actualMaxForcedConnectionDistance = currentGalaxyDiameter * MAX_FORCED_CONNECTION_DISTANCE_PERCENT;
    let connectedSet = new Set();
    let unconnectedSet = new Set(allSystemCoords.map(s => s.id));
    if (allSystemCoords.length > 0) {
      const firstSysId = allSystemCoords[0].id;
      connectedSet.add(firstSysId);
      unconnectedSet.delete(firstSysId);
      while (unconnectedSet.size > 0) {
        let bestCandidate = null;
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
          } else {
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
            } else {
              let ultimateFallbackId = null;
              let minUltimateFallbackDist = Infinity;
              for (const currentConnectedId of connectedSet) {
                const connSys = allSystemCoords.find(s => s.id === currentConnectedId);
                const dist = getDistance(systemToConnect, connSys);
                const isPossibleUltimateFallback = tryAddConnection(systemToConnectId, currentConnectedId, gal.lineConnections, systemConnectionCounts, allSystemCoords, null);
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
                unconnectedSet.delete(systemToConnectId);
              }
            }
          }
        } else {
          if (unconnectedSet.size > 0 && connectedSet.size === 0 && allSystemCoords.length > 0) {
            const nextUnconnectedId = Array.from(unconnectedSet)[0];
            connectedSet.add(nextUnconnectedId);
            unconnectedSet.delete(nextUnconnectedId);
          } else {
            break;
          }
        }
      }
    };
    allSystemCoords.forEach(ss1 => {
      const desiredConnections = getWeightedNumberOfConnections();
      let currentConnections = systemConnectionCounts[ss1.id] || 0;
      let connectionsToAdd = Math.min(desiredConnections, MAX_CONNECTIONS_PER_SYSTEM - currentConnections);
      if (connectionsToAdd <= 0) return;
      let potentialTargets = allSystemCoords
        .filter(ss2 => ss1.id !== ss2.id)
        .map(ss2 => ({ ...ss2, distance: getDistance(ss1, ss2) }))
        .sort((a, b) => a.distance - b.distance);
      const limitedPotentialTargets = potentialTargets.filter(ss2 => ss2.distance <= actualMaxEuclideanConnectionDistance);
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
    gameSessionData.isForceRegenerating = true;
    for (const gal of gameSessionData.galaxies) {
      if (galaxyViewport && (!gal.layoutGenerated || gal.solarSystems.length === 0)) {
        await new Promise(resolve => setTimeout(resolve, 0));
        generateSolarSystemsForGalaxy(gal.id);
      }
    }
    gameSessionData.isForceRegenerating = false;
    saveGameState();
  }
  function renderMainScreen() {
    if (mainScreenTitleText) mainScreenTitleText.textContent = "Universe";
    if (!universeCircle) return;
    universeCircle.innerHTML = '';
    gameSessionData.galaxies.forEach(gal => {
      const displayId = gal.id.split('-').pop();
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
    galaxyViewport.style.width = `${gameSessionData.universe.diameter || 500}px`;
    galaxyViewport.style.height = `${gameSessionData.universe.diameter || 500}px`;
    const icons = galaxyZoomContent.querySelectorAll('.solar-system-icon');
    icons.forEach(i => i.remove());
    const zoomScaleDampening = 0.6;
    gal.solarSystems.forEach(ss => {
      const solarSystemObject = ss;
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
            gal.layoutGenerated = true; renderGalaxyDetailScreen(false);
          }
        }
        attemptLayoutGeneration();
      }, 50);
    } else { renderGalaxyDetailScreen(false); }
  }

  function renderPlanetVisual(planetData, rotationQuaternion, targetCanvas = planetVisualCanvas) {
    if (!planetData || !targetCanvas || !window.Worker) return;

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
    planetData.minTerrainHeight = planetData.minTerrainHeight ?? DEFAULT_MIN_TERRAIN_HEIGHT;
    planetData.maxTerrainHeight = planetData.maxTerrainHeight ?? DEFAULT_MAX_TERRAIN_HEIGHT;
    planetData.oceanHeightLevel = planetData.oceanHeightLevel ?? DEFAULT_OCEAN_HEIGHT_LEVEL;

    const dataToSend = {
      waterColor: planetData.waterColor,
      landColor: planetData.landColor,
      continentSeed: planetData.continentSeed,
      minTerrainHeight: planetData.minTerrainHeight,
      maxTerrainHeight: planetData.maxTerrainHeight,
      oceanHeightLevel: planetData.oceanHeightLevel,
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
  solarSystemContent.innerHTML = ''; // Clear previous content

  // Calculate the sun's size dynamically
  let currentSunSize = SUN_ICON_SIZE; // Default base size
  if (solarSystemObject && typeof solarSystemObject.sunSizeFactor === 'number') {
    // Apply the random factor to the base sun icon size
    currentSunSize = SUN_ICON_SIZE * solarSystemObject.sunSizeFactor;
  }
  currentSunSize = Math.max(currentSunSize, 15); // Ensure a minimum practical size (e.g., 15px)

  const sunEl = document.createElement('div');
  sunEl.className = 'sun-icon sun-animated';
  sunEl.style.width = `${currentSunSize}px`; // Apply the calculated dynamic size
  sunEl.style.height = `${currentSunSize}px`; // Apply the calculated dynamic size

  // Set CSS variables for the gradient and border in .sun-icon
  const coreColor = FIXED_COLORS.sunFill;
  const midColor = FIXED_COLORS.sunBorder;
  const edgeColor = adjustColor(FIXED_COLORS.sunBorder, -40); // Make it darker for depth
  const actualBorderColor = FIXED_COLORS.sunBorder;

  sunEl.style.setProperty('--sun-core-color', coreColor);
  sunEl.style.setProperty('--sun-mid-color', midColor);
  sunEl.style.setProperty('--sun-edge-color', edgeColor);
  sunEl.style.setProperty('--sun-actual-border-color', actualBorderColor);

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
      if (attemptCount === 200) { continue; }

      if (gameSessionData.customPlanetDesigns.length === 0) {
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
        minTerrainHeight: randomDesign.minTerrainHeight ?? DEFAULT_MIN_TERRAIN_HEIGHT,
        maxTerrainHeight: randomDesign.maxTerrainHeight ?? DEFAULT_MAX_TERRAIN_HEIGHT,
        oceanHeightLevel: randomDesign.oceanHeightLevel ?? DEFAULT_OCEAN_HEIGHT_LEVEL,
        sourceDesignId: randomDesign.designId
      };

      gameSessionData.solarSystemView.planets.push(newPlanet);

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
        const wasPanelVisible = planetVisualPanel.classList.contains('visible');
        currentPlanetDisplayedInPanel = newPlanet;
        planetVisualTitle.textContent = newPlanet.planetName;
        planetVisualSize.textContent = Math.round(newPlanet.size);
        planetVisualPanel.classList.add('visible');

        if (!wasPanelVisible) {
            planetVisualPanel.style.left = '50%';
            planetVisualPanel.style.top = '50%';
            planetVisualPanel.style.transform = 'translate(-50%, -50%)';
            planetVisualPanel.style.transition = '';
        } else {
            planetVisualPanel.style.transition = 'none';
        }

        planetVisualRotationQuat = quat_identity();
        isRenderingVisualPlanet = false;
        renderPlanetVisual(newPlanet, planetVisualRotationQuat, planetVisualCanvas);
      });
      solarSystemContent.appendChild(planetEl);
      newPlanet.element = planetEl;
    }

    if (planetVisualWorker && gameSessionData.solarSystemView.planets) {
        gameSessionData.solarSystemView.planets.forEach(planetToPreload => {
            const preloadData = {
                waterColor: planetToPreload.waterColor,
                landColor: planetToPreload.landColor,
                continentSeed: planetToPreload.continentSeed,
                minTerrainHeight: planetToPreload.minTerrainHeight,
                maxTerrainHeight: planetToPreload.maxTerrainHeight,
                oceanHeightLevel: planetToPreload.oceanHeightLevel,
            };
            planetVisualWorker.postMessage({
                cmd: 'preloadPlanet',
                planetData: preloadData,
                rotationQuaternion: quat_identity(),
                canvasWidth: planetVisualCanvas?.width || 200,
                canvasHeight: planetVisualCanvas?.height || 200,
                senderId: `preload-${planetToPreload.id}`
            });
        });
    }

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

function generatePlanetFromBasis(basis) {
  // Pick random values within ranges
  const minTerrainHeight = randomInRange(basis.minTerrainHeightRange);
  const maxTerrainHeight = randomInRange(basis.maxTerrainHeightRange);
  const oceanHeightLevel = randomInRange(basis.oceanHeightRange);

  return {
    waterColor: basis.waterColor,
    landColor: basis.landColor,
    continentSeed: Math.random(),
    minTerrainHeight,
    maxTerrainHeight: Math.max(minTerrainHeight + 0.2, maxTerrainHeight), // ensure valid
    oceanHeightLevel,
  };
}

function randomInRange([min, max]) {
  return min + Math.random() * (max - min);
}

// When showing the designer preview, generate a random example:
function renderDesignerPlanetPreview() {
  const examplePlanet = generatePlanetFromBasis(currentDesignerBasis);
  renderPlanetVisual(examplePlanet, designerPlanetRotationQuat, designerPlanetCanvas);
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
      if (isNaN(numGal) || numGal < 1 || numGal > 100 || isNaN(minSS) || minSS < 1 || minSS > 1000 || isNaN(maxSS) || maxSS < 1 || maxSS > 2000 || maxSS < minSS || isNaN(spread) || spread < 0.1 || spread > 5.0 || isNaN(minP) || minP < 0 || minP > 20 || isNaN(maxP) || maxP < minP || maxP > 20) { alert("Invalid input values. Please check ranges and ensure Max >= Min for systems and planets."); return; }
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
      const rotationAroundY = (deltaMouseX / canvasWidth) * (2 * Math.PI) * PLANET_ROTATION_SENSITIVITY;
      const incX_quat = quat_from_axis_angle([1, 0, 0], -rotationAroundX);
      const incY_quat = quat_from_axis_angle([0, 1, 0], rotationAroundY);
      const combined_inc_quat = quat_multiply(incY_quat, incX_quat);
      planetVisualRotationQuat = quat_normalize(quat_multiply(combined_inc_quat, startDragPlanetVisualQuat));
      
      if (!isRenderingVisualPlanet) {
          isRenderingVisualPlanet = true;
          renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas);
      }

    } else if (isDraggingDesignerPlanet) {
      const rect = designerPlanetCanvas.getBoundingClientRect();
      const canvasWidth = rect.width;
      const canvasHeight = rect.height;
      const deltaMouseX = e.clientX - designerStartDragMouseX;
      const deltaMouseY = e.clientY - designerStartDragMouseY;
      const rotationAroundX = (deltaMouseY / canvasHeight) * Math.PI * PLANET_ROTATION_SENSITIVITY;
      const rotationAroundY = (deltaMouseX / canvasWidth) * (2 * Math.PI) * PLANET_ROTATION_SENSITIVITY;
      const incX_quat = quat_from_axis_angle([1, 0, 0], -rotationAroundX);
      const incY_quat = quat_from_axis_angle([0, 1, 0], rotationAroundY);
      const combined_inc_quat = quat_multiply(incY_quat, incX_quat);
      designerPlanetRotationQuat = quat_normalize(quat_multiply(combined_inc_quat, startDragDesignerPlanetQuat));

    planetVisualRotationQuatTarget = quat_normalize(quat_multiply(combined_inc_quat, startDragPlanetVisualQuat));
    applyPlanetPanelVisualRotation();
    if (!isRenderingVisualPlanet) {
        isRenderingVisualPlanet = true;
        planetVisualRotationQuatDisplayed = planetVisualRotationQuatTarget; // This will be the new real render
        renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuatDisplayed, planetVisualCanvas);
    } else {
        needsPlanetVisualRerender = true;
    }
}
  });

  function applyPlanetPanelVisualRotation() {
    const q = planetVisualRotationQuatTarget;
    // Approximate conversion to Euler (for small angles):
    const ysqr = q[2] * q[2];
    // roll (x-axis rotation)
    let t0 = +2.0 * (q[0] * q[1] + q[2] * q[3]);
    let t1 = +1.0 - 2.0 * (q[1] * q[1] + ysqr);
    let rollX = Math.atan2(t0, t1);
    // pitch (y-axis rotation)
    let t2 = +2.0 * (q[0] * q[2] - q[3] * q[1]);
    t2 = t2 > 1 ? 1 : t2;
    t2 = t2 < -1 ? -1 : t2;
    let pitchY = Math.asin(t2);
    // (you can also compute yaw Z if desired)
    planetVisualCanvas.style.transform = `rotateX(${pitchY * 180 / Math.PI}deg) rotateY(${rollX * 180 / Math.PI}deg)`;
}


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

  let currentDesignerPlanet = {
    waterColor: '#000080',
    landColor: '#006400',
    continentSeed: Math.random(),
    minTerrainHeight: DEFAULT_MIN_TERRAIN_HEIGHT,
    maxTerrainHeight: DEFAULT_MAX_TERRAIN_HEIGHT,
    oceanHeightLevel: DEFAULT_OCEAN_HEIGHT_LEVEL
  };

  function renderDesignerPlanet(planet, rotationQuaternion) {
    if (!planet || !designerPlanetCanvas) return;
    renderPlanetVisual(planet, rotationQuaternion, designerPlanetCanvas);
  }

  function updateDesignerPlanetFromInputs() {
    currentDesignerPlanet.waterColor = designerWaterColorInput.value;
    currentDesignerPlanet.landColor = designerLandColorInput.value;
    if (designerMinHeightInput) currentDesignerPlanet.minTerrainHeight = parseFloat(designerMinHeightInput.value) || DEFAULT_MIN_TERRAIN_HEIGHT;
    if (designerMaxHeightInput) currentDesignerPlanet.maxTerrainHeight = parseFloat(designerMaxHeightInput.value) || DEFAULT_MAX_TERRAIN_HEIGHT;
    if (designerOceanHeightInput) currentDesignerPlanet.oceanHeightLevel = parseFloat(designerOceanHeightInput.value) || DEFAULT_OCEAN_HEIGHT_LEVEL;

    if (currentDesignerPlanet.minTerrainHeight >= currentDesignerPlanet.maxTerrainHeight) {
        currentDesignerPlanet.minTerrainHeight = currentDesignerPlanet.maxTerrainHeight - 0.1;
        if (designerMinHeightInput) designerMinHeightInput.value = currentDesignerPlanet.minTerrainHeight.toFixed(1);
    }
    if (currentDesignerPlanet.minTerrainHeight < 0) {
        currentDesignerPlanet.minTerrainHeight = 0;
        if (designerMinHeightInput) designerMinHeightInput.value = currentDesignerPlanet.minTerrainHeight.toFixed(1);
    }
    if (currentDesignerPlanet.maxTerrainHeight <= currentDesignerPlanet.minTerrainHeight) {
        currentDesignerPlanet.maxTerrainHeight = currentDesignerPlanet.minTerrainHeight + 0.1;
        if(designerMaxHeightInput) designerMaxHeightInput.value = currentDesignerPlanet.maxTerrainHeight.toFixed(1);
    }
    if (currentDesignerPlanet.oceanHeightLevel > currentDesignerPlanet.maxTerrainHeight) {
        currentDesignerPlanet.oceanHeightLevel = currentDesignerPlanet.maxTerrainHeight;
        if(designerOceanHeightInput) designerOceanHeightInput.value = currentDesignerPlanet.oceanHeightLevel.toFixed(1);
    }
     if (currentDesignerPlanet.oceanHeightLevel < currentDesignerPlanet.minTerrainHeight) {
        currentDesignerPlanet.oceanHeightLevel = currentDesignerPlanet.minTerrainHeight;
        if(designerOceanHeightInput) designerOceanHeightInput.value = currentDesignerPlanet.oceanHeightLevel.toFixed(1);
    }

    isRenderingDesignerPlanet = false;
    renderDesignerPlanet(currentDesignerPlanet, designerPlanetRotationQuat);
  }

  function randomizeDesignerPlanet() {
    currentDesignerPlanet.waterColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    currentDesignerPlanet.landColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    currentDesignerPlanet.continentSeed = Math.random();
    currentDesignerPlanet.minTerrainHeight = parseFloat((Math.random() * 5).toFixed(1));
    currentDesignerPlanet.maxTerrainHeight = parseFloat((currentDesignerPlanet.minTerrainHeight + 0.1 + Math.random() * 10).toFixed(1));
    currentDesignerPlanet.oceanHeightLevel = parseFloat((currentDesignerPlanet.minTerrainHeight + Math.random() * (currentDesignerPlanet.maxTerrainHeight - currentDesignerPlanet.minTerrainHeight)).toFixed(1));

    designerWaterColorInput.value = currentDesignerPlanet.waterColor;
    designerLandColorInput.value = currentDesignerPlanet.landColor;
    if (designerMinHeightInput) designerMinHeightInput.value = currentDesignerPlanet.minTerrainHeight.toFixed(1);
    if (designerMaxHeightInput) designerMaxHeightInput.value = currentDesignerPlanet.maxTerrainHeight.toFixed(1);
    if (designerOceanHeightInput) designerOceanHeightInput.value = currentDesignerPlanet.oceanHeightLevel.toFixed(1);

    designerPlanetRotationQuat = quat_identity();
    isRenderingDesignerPlanet = false;
    renderDesignerPlanet(currentDesignerPlanet, designerPlanetRotationQuat);
  }

  function saveCustomPlanetDesign() {
    updateDesignerPlanetFromInputs();
    const newDesign = {
      designId: `design-${Date.now()}`,
      waterColor: currentDesignerPlanet.waterColor,
      landColor: currentDesignerPlanet.landColor,
      continentSeed: currentDesignerPlanet.continentSeed,
      minTerrainHeight: currentDesignerPlanet.minTerrainHeight,
      maxTerrainHeight: currentDesignerPlanet.maxTerrainHeight,
      oceanHeightLevel: currentDesignerPlanet.oceanHeightLevel,
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
  if(designerMinHeightInput) designerMinHeightInput.addEventListener('change', updateDesignerPlanetFromInputs);
  if(designerMaxHeightInput) designerMaxHeightInput.addEventListener('change', updateDesignerPlanetFromInputs);
  if(designerOceanHeightInput) designerOceanHeightInput.addEventListener('change', updateDesignerPlanetFromInputs);

  designerRandomizeBtn.addEventListener('click', randomizeDesignerPlanet);
  designerSaveBtn.addEventListener('click', saveCustomPlanetDesign);
  designerCancelBtn.addEventListener('click', () => setActiveScreen(mainScreen));
  createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);

  function initializeGame(isForcedRegeneration = false) {
    loadCustomizationSettings(); // This will also call updateDerivedConstants
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
  window.addEventListener('mousemove', panMouseMove);
  window.addEventListener('mouseup', panMouseUp);

  if (galaxyViewport) {
    galaxyViewport.addEventListener('click', function (event) {
      if (gameSessionData.panning.isActive && !event.target.closest('.solar-system-icon')) {
        return;
      }
      const ssIcon = event.target.closest('.solar-system-icon');
      if (ssIcon) {
        const ssId = ssIcon.dataset.solarSystemId;
        if (ssId) {
          switchToSolarSystemView(ssId);
          event.stopPropagation();
        }
      }
    });

    let isGalaxyPanningSpecific = false;
    let galaxyPanStartSpecific = { x: 0, y: 0 };
    let galaxyLastPanSpecific = { x: 0, y: 0 };

    galaxyViewport.addEventListener('mousedown', (e) => {
      if (
        e.button !== 0 ||
        !galaxyDetailScreen.classList.contains('active') ||
        e.target.closest('.solar-system-icon') ||
        e.target.closest('button')
      ) return;
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
        renderGalaxyDetailScreen(false);
      }
    };
    window.addEventListener('mouseup', galaxyMouseUpHandler);
  }
  initializeGame();
});
