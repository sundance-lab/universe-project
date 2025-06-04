document.addEventListener('DOMContentLoaded', () => {
  // Define constants FIRST, so functions defined below can access them
  const DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
  const DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
  const DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;
  // ... other constants that might be used by these functions ...
  const DEFAULT_NUM_GALAXIES = 3;
  const DEFAULT_MIN_SS_COUNT_CONST = 200;
  const DEFAULT_MAX_SS_COUNT_CONST = 300;
  const DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER = 1.0;
  const DEFAULT_MIN_PLANETS_PER_SYSTEM = 0;
  const DEFAULT_MAX_PLANETS_PER_SYSTEM = 3;
  const DEFAULT_SHOW_PLANET_ORBITS = false;
  // MODIFIED: Make planets revolve around stars much slower
  const DEFAULT_PLANET_AXIAL_SPEED = 0.005; // Original 0.01 (now 2x slower)
  const BASE_MAX_PLANET_DISTANCE_FACTOR = 25;
  const PLANET_ROTATION_SENSITIVITY = 0.75;


  // Get DOM elements
  const mainScreen = document.getElementById('main-screen');
  // ... (all your other getElementById calls) ...
  const designerPlanetCanvas = document.getElementById('designer-planet-canvas');
  // ... (rest of your getElementById calls) ...
  const designerWaterColorInput = document.getElementById('designer-water-color');
  const designerLandColorInput = document.getElementById('designer-land-color');
  const designerRandomizeBtn = document.getElementById('designer-randomize-btn');
  const designerSaveBtn = document.getElementById('designer-save-btn');
  const designerCancelBtn = document.getElementById('designer-cancel-btn');
  const designerNewIterationBtn = document.getElementById('designer-new-iteration-btn'); // NEW: Added for the new button
  const savedDesignsUl = document.getElementById('saved-designs-ul');
  const designerMinHeightMinInput = document.getElementById('designer-min-height-min');
  const designerMinHeightMaxInput = document.getElementById('designer-min-height-max');
  const designerMaxHeightMinInput = document.getElementById('designer-max-height-min');
  const designerMaxHeightMaxInput = document.getElementById('designer-max-height-max');
  const designerOceanHeightMinInput = document.getElementById('designer-ocean-height-min');
  const designerOceanHeightMaxInput = document.getElementById('designer-ocean-height-max');
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



  // --- FUNCTION DEFINITIONS MOVED INSIDE DOMCONTENTLOADED ---

  function generatePlanetInstanceFromBasis(basis, isForDesignerPreview = false) {
    // Helper to get a random number within a range.
    const getValueFromRange = (range, defaultValue, defaultSpread = 1.0) => {
      if (Array.isArray(range) && range.length === 2 && typeof range[0] === 'number' && typeof range[1] === 'number') {
        const min = Math.min(range[0], range[1]);
        const max = Math.max(range[0], range[1]);
        if (min === max) return min; // Avoid NaN if min == max from random * 0
        return min + Math.random() * (max - min);
      }
      if ( typeof range === 'number') return range; // Fallback for old format / forced single values
      // If completely undefined or not a valid range array, use default with a bit of spread
      const base = typeof defaultValue === 'number' ? defaultValue : 0;
      const spread = typeof defaultSpread === 'number' ? defaultSpread : 1.0;
      // Ensure default values are valid numbers before math
      if (isNaN(base) || isNaN(spread)) {
        console.warn("Invalid default/spread in getValueFromRange, returning 0", {range, defaultValue, defaultSpread});
        return 0;
      }
      return base + (Math.random() - 0.5) * spread * 2;
    };

    return {
      waterColor: basis.waterColor || '#0000FF',
      landColor: basis.landColor || '#008000',
      continentSeed: basis.continentSeed ?? Math.random(), // Use provided seed or generate new
      minTerrainHeight: getValueFromRange(basis.minTerrainHeightRange, DEFAULT_MIN_TERRAIN_HEIGHT, 1.0),
      maxTerrainHeight: getValueFromRange(basis.maxTerrainHeightRange, DEFAULT_MAX_TERRAIN_HEIGHT, 2.0),
      oceanHeightLevel: getValueFromRange(basis.oceanHeightRange, DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0)
    };
  }

  function resizeDesignerCanvasToDisplaySize() {
    const canvas = designerPlanetCanvas; // Now designerPlanetCanvas is in scope
    if (!canvas) {
      // console.warn("resizeDesignerCanvasToDisplaySize: designerPlanetCanvas not found.");
      return;
    }
    const displayWidth = canvas.offsetWidth;
    const displayHeight = canvas.offsetHeight;

    if (displayWidth && displayHeight) {
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }
    } else {
      requestAnimationFrame(resizeDesignerCanvasToDisplaySize);
    }
  }

  // --- STATE VARIABLES ---
  let linesCtx;
  // ... (rest of your state variables) ...
  let solarSystemOrbitCanvasEl;
  let orbitCtx;
  let animationFrameId = null;
  let lastAnimationTime = null;
  let isDraggingPlanetVisual = false;
  let isDraggingDesignerPlanet = false;
  let isRenderingVisualPlanet = false;
  let isRenderingDesignerPlanet = false;
  let needsPlanetVisualRerender = false;

  let currentDesignerBasis = {
    waterColor: '#000080',
    landColor: '#006400',
    continentSeed: Math.random(),
    minTerrainHeightRange: [0.0, 2.0],
    maxTerrainHeightRange: [8.0, 12.0],
    oceanHeightRange: [1.0, 3.0]
  };
  let currentDesignerPlanetInstance = null;

  let planetVisualRotationQuat = quat_identity();
  let startDragPlanetVisualQuat = quat_identity();
  let designerPlanetRotationQuat = quat_identity();
  let startDragDesignerPlanetQuat = quat_identity();
  let designerStartDragMouseX = 0;
  let designerStartDragMouseY = 0;
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
  let MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier;
  let ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
  let SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2;
  const MIN_ORBITAL_SEPARATION = 20;
  // MODIFIED: Make planets revolve around stars much slower
  let MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.0005; // Original 0.005 (now 10x slower)
  let MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.001; // Original 0.01 (now 10x slower)
  const FIXED_COLORS = { universeBg: "#100520", galaxyIconFill: "#7f00ff", galaxyIconBorder: "#da70d6", solarSystemBaseColor: "#ffd700", sunFill: "#FFD700", sunBorder: "#FFA500", connectionLine: "rgba(255, 255, 255, 0.3)" };
  let gameSessionData = { universe: { diameter: null }, galaxies: [], activeGalaxyId: null, activeSolarSystemId: null, solarSystemView: { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null }, isInitialized: false, panning: { isActive: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0, targetElement: null, viewportElement: null, dataObject: null }, customPlanetDesigns: [] };


  // ... (rest of your variables, worker setup, PerlinNoise class, other functions)

  // Ensure all the function definitions that were previously global and now need access
  // to these constants/DOM vars are also defined *within* this DOMContentLoaded scope.

  // For example, if `populateDesignerInputsFromBasis` uses `designerWaterColorInput`, etc.,
  // it should be defined here, or those vars passed to it.
  // (It seems you already have most functions inside, which is good)

  // --- WEB WORKER SETUP ---
  let planetVisualWorker = null;
  let designerWorker = null;

  if (window.Worker) {
    try {
      planetVisualWorker = new Worker('planetRendererWorker.js');
      designerWorker = new Worker('planetRendererWorker.js'); // Correctly using the same worker file

      planetVisualWorker.onmessage = function(e) {
        // ... (your worker onmessage logic)
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

      designerWorker.onmessage = function(e) {
        // ... (your worker onmessage logic)
        const { renderedData, width, height, senderId } = e.data;
        if (senderId === 'designer-planet-canvas' && designerPlanetCanvas) {
          const ctx = designerPlanetCanvas.getContext('2d');
            if (!ctx) {
            console.error("Failed to get 2D context from designerPlanetCanvas");
            isRenderingDesignerPlanet = false;
            return;
          }
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
      designerWorker.onerror = function(error) {
        console.error("Error in designerWorker:", error.message, error.filename, error.lineno);
      };

    } catch (err) {
      console.error("Failed to create Web Workers. Make sure planetRendererWorker.js exists and is accessible.", err);
      planetVisualWorker = null;
      designerWorker = null;
    }
  } else {
    console.warn("Web Workers not supported in this browser. Planet rendering will be disabled.");
  }


  class PerlinNoise { /* ... PerlinNoise class code ... */
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
      // Fisher-Yates shuffle using the seeded random
      let currentSeed = this.seed;
      const seededRandom = () => {
          let x = Math.sin(currentSeed++) * 10000;
          return x - Math.floor(x);
      };
      for (let i = 255; i > 0; i--) {
          let r = Math.floor(seededRandom() * (i + 1));
          let tmp = this.permutation[i];
          this.permutation[i] = this.permutation[r];
          this.permutation[r] = tmp;
      }
      for (let i = 0; i < 256; i++) {
      this.p[i] = this.p[i + 256] = this.permutation[i];
      }
    }
    random() { // This method is only used by the original initPermutationTable if seed was not used in shuffle
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
        this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z), u),
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


  function populateDesignerInputsFromBasis() {
    if (!designerWaterColorInput) return; // protect against null elements
    designerWaterColorInput.value = currentDesignerBasis.waterColor;
    designerLandColorInput.value = currentDesignerBasis.landColor;

    designerMinHeightMinInput.value = currentDesignerBasis.minTerrainHeightRange[0].toFixed(1);
    designerMinHeightMaxInput.value = currentDesignerBasis.minTerrainHeightRange[1].toFixed(1);

    designerMaxHeightMinInput.value = currentDesignerBasis.maxTerrainHeightRange[0].toFixed(1);
    designerMaxHeightMaxInput.value = currentDesignerBasis.maxTerrainHeightRange[1].toFixed(1);

    designerOceanHeightMinInput.value = currentDesignerBasis.oceanHeightRange[0].toFixed(1);
    designerOceanHeightMaxInput.value = currentDesignerBasis.oceanHeightRange[1].toFixed(1);
  }

  // ... The rest of your JavaScript code from the previous response,
  // ensuring all functions are within this DOMContentLoaded scope if they
  // rely on variables/constants defined at the top of this scope.
  // For brevity, I'm not repeating the entire 1000+ lines here,
  // but the structure is:
  //
  // document.addEventListener('DOMContentLoaded', () => {
  //  // CONSTANTS
  //  // DOM ELEMENT GETTERS
  //  // FUNCTION DEFINITIONS (generatePlanetInstanceFromBasis, resizeDesignerCanvasToDisplaySize, etc.)
  //  // STATE VARIABLES
  //  // WORKER SETUP
  //  // PERLIN NOISE CLASS
  //  // ALL OTHER FUNCTIONS (switchToSolarSystemView, renderMainScreen, event handlers, initializeGame etc.)
  //  // EVENT LISTENERS ATTACHMENT
  //  // initializeGame();
  // });
  // MAKE SURE TO INCLUDE ALL THE OTHER FUNCTIONS HERE

  function updateBasisAndRefreshDesignerPreview() {
    if (!designerWaterColorInput) return; // Guard
    currentDesignerBasis.waterColor = designerWaterColorInput.value;
    currentDesignerBasis.landColor = designerLandColorInput.value;

    let minH_min = parseFloat(designerMinHeightMinInput.value) || 0.0;
    let minH_max = parseFloat(designerMinHeightMaxInput.value) || 0.0;
    let maxH_min = parseFloat(designerMaxHeightMinInput.value) || 0.0;
    let maxH_max = parseFloat(designerMaxHeightMaxInput.value) || 0.0;
    let oceanH_min = parseFloat(designerOceanHeightMinInput.value) || 0.0;
    let oceanH_max = parseFloat(designerOceanHeightMaxInput.value) || 0.0;

    if (minH_min > minH_max) [minH_min, minH_max] = [minH_max, minH_min];
    if (maxH_min > maxH_max) [maxH_min, maxH_max] = [maxH_max, maxH_min];
    if (oceanH_min > oceanH_max) [oceanH_min, oceanH_max] = [oceanH_max, oceanH_min];

    minH_min = Math.max(0, minH_min); minH_max = Math.max(0, minH_max);
    maxH_min = Math.max(0, maxH_min); maxH_max = Math.max(0, maxH_max);
    oceanH_min = Math.max(0, oceanH_min); oceanH_max = Math.max(0, oceanH_max);

    if (minH_max > oceanH_min) oceanH_min = parseFloat((minH_max + 0.1).toFixed(1));
    if (oceanH_min > oceanH_max) oceanH_max = parseFloat((oceanH_min + 0.1).toFixed(1));
    if (oceanH_max > maxH_min) maxH_min = parseFloat((oceanH_max + 0.1).toFixed(1));
    if (maxH_min > maxH_max) maxH_max = parseFloat((maxH_min + 0.1).toFixed(1));


    currentDesignerBasis.minTerrainHeightRange = [minH_min, minH_max];
    currentDesignerBasis.maxTerrainHeightRange = [maxH_min, maxH_max];
    currentDesignerBasis.oceanHeightRange = [oceanH_min, oceanH_max];

    populateDesignerInputsFromBasis();
    generateAndRenderDesignerPreviewInstance();
  }

  function generateAndRenderDesignerPreviewInstance(resetRotation = false) {
    currentDesignerPlanetInstance = generatePlanetInstanceFromBasis(currentDesignerBasis, true);
    if (resetRotation) designerPlanetRotationQuat = quat_identity();
    resizeDesignerCanvasToDisplaySize();
    if (!isRenderingDesignerPlanet && designerWorker) {
      isRenderingDesignerPlanet = true;
      renderDesignerPlanet(currentDesignerPlanetInstance, designerPlanetRotationQuat);
    } else if (!designerWorker) {
      console.warn("Designer worker not available for preview rendering.");
    }
  }

  function renderDesignerPlanet(planetToRender, rotationQuaternion) {
    if (!planetToRender || !designerPlanetCanvas) return;
    if (designerPlanetCanvas.width === 0 || designerPlanetCanvas.height === 0) {
      console.warn("Designer canvas has 0 dimensions. Aborting render.");
      isRenderingDesignerPlanet = false; // Reset rendering flag
      // Request a resize and re-render on the next frame, as offsetWidth/Height might be available then
      requestAnimationFrame(() => {
          resizeDesignerCanvasToDisplaySize();
          if (designerPlanetCanvas.width > 0 && designerPlanetCanvas.height > 0) {
              renderPlanetVisual(planetToRender, rotationQuaternion, designerPlanetCanvas);
          } else {
              console.warn("Designer canvas still has 0 dimensions after rAF. Cannot render.");
          }
      });
      return;
    }
    renderPlanetVisual(planetToRender, rotationQuaternion, designerPlanetCanvas);
  }

  function randomizeDesignerPlanet() {
    currentDesignerBasis.waterColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    currentDesignerBasis.landColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    currentDesignerBasis.continentSeed = Math.random();

    let minH_min_rand = parseFloat((Math.random() * 2.0).toFixed(1));
    let minH_max_rand = parseFloat((minH_min_rand + Math.random() * 2.0 + 0.1).toFixed(1));

    let oceanH_min_rand = parseFloat((minH_max_rand + Math.random() * 1.5 + 0.1).toFixed(1));
    let oceanH_max_rand = parseFloat((oceanH_min_rand + Math.random() * 2.5 + 0.1).toFixed(1));

    let maxH_min_rand = parseFloat((oceanH_max_rand + Math.random() * 2.0 + 0.1).toFixed(1));
    let maxH_max_rand = parseFloat((maxH_min_rand + Math.random() * 5.0 + 0.5).toFixed(1));

    currentDesignerBasis.minTerrainHeightRange = [minH_min_rand, minH_max_rand];
    currentDesignerBasis.maxTerrainHeightRange = [maxH_min_rand, maxH_max_rand];
    currentDesignerBasis.oceanHeightRange = [oceanH_min_rand, oceanH_max_rand];

    populateDesignerInputsFromBasis();
    generateAndRenderDesignerPreviewInstance(true);
  }

  // NEW FUNCTION: For "New Iteration" button
  function generateNewDesignerIteration() {
      currentDesignerBasis.continentSeed = Math.random(); // Only change the seed
      generateAndRenderDesignerPreviewInstance(false); // Do not reset rotation
  }


    function saveCustomPlanetDesign() {
      updateBasisAndRefreshDesignerPreview();

      const newDesign = {
        designId: `design-${Date.now()}`,
        name: `Custom Design ${gameSessionData.customPlanetDesigns.length + 1}`,
        waterColor: currentDesignerBasis.waterColor,
        landColor: currentDesignerBasis.landColor,
        continentSeed: currentDesignerBasis.continentSeed,
        minTerrainHeightRange: [...currentDesignerBasis.minTerrainHeightRange],
        maxTerrainHeightRange: [...currentDesignerBasis.maxTerrainHeightRange],
        oceanHeightRange: [...currentDesignerBasis.oceanHeightRange]
      };
      gameSessionData.customPlanetDesigns.push(newDesign);
      saveGameState();
      populateSavedDesignsList();
    }

    function loadAndPreviewDesign(designId) {
      const designToLoad = gameSessionData.customPlanetDesigns.find(d => d.designId === designId);
      if (designToLoad) {
        currentDesignerBasis.waterColor = designToLoad.waterColor;
        currentDesignerBasis.landColor = designToLoad.landColor;
        currentDesignerBasis.continentSeed = designToLoad.continentSeed || Math.random();

        const ensureRange = (value, oldSingleProp, defaultVal, spread) => {
            if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
              return [...value];
            }
            const base = typeof oldSingleProp === 'number' ? oldSingleProp : (typeof defaultVal === 'number' ? defaultVal : 0);
            return [base, base + (typeof spread === 'number' ? spread : 1.0)];
        };
        
        currentDesignerBasis.minTerrainHeightRange = ensureRange(
          designToLoad.minTerrainHeightRange, designToLoad.minTerrainHeight, 
          DEFAULT_MIN_TERRAIN_HEIGHT, 1.0
        );
        currentDesignerBasis.maxTerrainHeightRange = ensureRange(
          designToLoad.maxTerrainHeightRange, designToLoad.maxTerrainHeight,
          DEFAULT_MAX_TERRAIN_HEIGHT, 2.0
        );
        currentDesignerBasis.oceanHeightRange = ensureRange(
          designToLoad.oceanHeightRange, designToLoad.oceanHeightLevel,
          DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0
        );

        populateDesignerInputsFromBasis();
        generateAndRenderDesignerPreviewInstance(true);
      }
    }


    function populateSavedDesignsList() {
      if (!savedDesignsUl) return;
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
        designNameSpan.textContent = design.name || `Design ${design.designId.slice(-4)}`;
        li.appendChild(designNameSpan);

        const loadBtn = document.createElement('button');
        loadBtn.className = 'design-item-load modal-button-apply';
        loadBtn.textContent = 'Load';
        loadBtn.title = `Load ${design.name || 'design'}`;
        loadBtn.style.marginLeft = "10px"; loadBtn.style.padding = "3px 6px"; loadBtn.style.fontSize = "0.8em";
        loadBtn.onclick = (e) => { e.stopPropagation(); loadAndPreviewDesign(design.designId); };
        li.appendChild(loadBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'design-item-delete';
        deleteBtn.textContent = 'x';
        deleteBtn.title = `Delete ${design.name || 'design'}`;
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          if (confirm(`Delete design "${design.name || 'this design'}"? This cannot be undone.`)) {
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
      populateDesignerInputsFromBasis();
      populateSavedDesignsList();
      resizeDesignerCanvasToDisplaySize(); // Ensure canvas is sized
      requestAnimationFrame(() => {
        generateAndRenderDesignerPreviewInstance(true);
      });
    }

  [designerMinHeightMinInput, designerMinHeightMaxInput,
   designerMaxHeightMinInput, designerMaxHeightMaxInput,
   designerOceanHeightMinInput, designerOceanHeightMaxInput,
   designerWaterColorInput, designerLandColorInput].forEach(input => {
    if (input) input.addEventListener('change', updateBasisAndRefreshDesignerPreview);
  });

  if(designerRandomizeBtn) designerRandomizeBtn.addEventListener('click', randomizeDesignerPlanet);
  if(designerNewIterationBtn) designerNewIterationBtn.addEventListener('click', generateNewDesignerIteration); // NEW: Event listener for new iteration button
  if(designerSaveBtn) designerSaveBtn.addEventListener('click', saveCustomPlanetDesign);
  if(designerCancelBtn) designerCancelBtn.addEventListener('click', () => {
      if (mainScreen) setActiveScreen(mainScreen);
      else console.error("mainScreen not found for designerCancelBtn");
  });
  if(createPlanetDesignButton) createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);

    function quat_identity() { return [1,0,0,0]; }
    function quat_from_axis_angle(axis, angle) { const hA = angle*0.5, s=Math.sin(hA); return [Math.cos(hA),axis[0]*s,axis[1]*s,axis[2]*s];}
    function quat_multiply(q1, q2) { const w1=q1[0],x1=q1[1],y1=q1[2],z1=q1[3],w2=q2[0],x2=q2[1],y2=q2[2],z2=q2[3]; return [w1*w2-x1*x2-y1*y2-z1*z2,w1*x2+x1*w2+y1*z2-z1*y2,w1*y2-x1*z2+y1*w2+z1*x2,w1*z2+x1*y2-y1*x2+z1*w2];}
    function quat_normalize(q) { let l=q[0]*q[0]+q[1]*q[1]+q[2]*q[2]+q[3]*q[3]; if(l===0)return [1,0,0,0]; l=1/Math.sqrt(l); return [q[0]*l, q[1]*l, q[2]*l, q[3]*l];}
    
    function updateDerivedConstants() { MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier; MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0 * (currentMaxPlanetDistanceMultiplier > 0.5 ? currentMaxPlanetDistanceMultiplier * 0.8 : 0.5); ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2; SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2; }
    function saveCustomizationSettings() { const s={numGalaxies:currentNumGalaxies,minSS:currentMinSSCount,maxSS:currentMaxSSCount,spread:currentMaxPlanetDistanceMultiplier,minPlanets:currentMinPlanets,maxPlanets:currentMaxPlanets,showOrbits:currentShowPlanetOrbits};localStorage.setItem('galaxyCustomizationSettings',JSON.stringify(s));}
    function loadCustomizationSettings() { const sS=localStorage.getItem('galaxyCustomizationSettings');if(sS){try{const lS=JSON.parse(sS);currentNumGalaxies=parseInt(lS.numGalaxies,10)||DEFAULT_NUM_GALAXIES;currentMinSSCount=parseInt(lS.minSS,10)||DEFAULT_MIN_SS_COUNT_CONST;currentMaxSSCount=parseInt(lS.maxSS,10)||DEFAULT_MAX_SS_COUNT_CONST;currentMaxPlanetDistanceMultiplier=parseFloat(lS.spread)||DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;currentMinPlanets=parseInt(lS.minPlanets,10);if(isNaN(currentMinPlanets))currentMinPlanets=DEFAULT_MIN_PLANETS_PER_SYSTEM;currentMaxPlanets=parseInt(lS.maxPlanets,10);if(isNaN(currentMaxPlanets))currentMaxPlanets=DEFAULT_MAX_PLANETS_PER_SYSTEM;currentShowPlanetOrbits=typeof lS.showOrbits==='boolean'?lS.showOrbits:DEFAULT_SHOW_PLANET_ORBITS;}catch(e){console.error("Error loading customization settings:",e);resetToDefaultCustomization();}}else{resetToDefaultCustomization();}updateDerivedConstants();}
    function resetToDefaultCustomization() { currentNumGalaxies=DEFAULT_NUM_GALAXIES;currentMinSSCount=DEFAULT_MIN_SS_COUNT_CONST;currentMaxSSCount=DEFAULT_MAX_SS_COUNT_CONST;currentMaxPlanetDistanceMultiplier=DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;currentMinPlanets=DEFAULT_MIN_PLANETS_PER_SYSTEM;currentMaxPlanets=DEFAULT_MAX_PLANETS_PER_SYSTEM;currentShowPlanetOrbits=DEFAULT_SHOW_PLANET_ORBITS;}
    function saveGameState() { try{const sTS={universeDiameter:gameSessionData.universe.diameter,galaxies:gameSessionData.galaxies,customPlanetDesigns:gameSessionData.customPlanetDesigns};localStorage.setItem('galaxyGameSaveData',JSON.stringify(sTS));}catch(e){console.error("Error saving game state:",e);}}
    
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
                  ss.sunSizeFactor = ss.sunSizeFactor ?? (0.5 + Math.random() * 9.5);
                });
              }
            });

            gameSessionData.customPlanetDesigns = (loadedState.customPlanetDesigns || []).map(design => {
              const migratedDesign = { ...design };
              if (migratedDesign.continentSeed === undefined) migratedDesign.continentSeed = Math.random();
                
              const ensureRange = (value, oldSingleProp, defaultVal, spread) => {
                  if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number') {
                    return [...value];
                  }
                  const base = typeof oldSingleProp === 'number' ? oldSingleProp : (typeof defaultVal === 'number' ? defaultVal : 0);
                  return [base, base + (typeof spread === 'number' ? spread : 1.0)];
              };

              migratedDesign.minTerrainHeightRange = ensureRange(
                  migratedDesign.minTerrainHeightRange, migratedDesign.minTerrainHeight, 
                  DEFAULT_MIN_TERRAIN_HEIGHT, 1.0
              );
              migratedDesign.maxTerrainHeightRange = ensureRange(
                  migratedDesign.maxTerrainHeightRange, migratedDesign.maxTerrainHeight, 
                  DEFAULT_MAX_TERRAIN_HEIGHT, 2.0
              );
              migratedDesign.oceanHeightRange = ensureRange(
                  migratedDesign.oceanHeightRange, migratedDesign.oceanHeightLevel, 
                  DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0
              );
              delete migratedDesign.minTerrainHeight;
              delete migratedDesign.maxTerrainHeight;
              delete migratedDesign.oceanHeightLevel;
              return migratedDesign;
            });
            return true;
          }
        }
      } catch (error) { console.error("Error loading game state:", error); localStorage.removeItem('galaxyGameSaveData'); }
      return false;
    }

    function checkOverlap(r1, r2) { return!(r1.x+r1.width<r2.x||r2.x+r2.width<r1.x||r1.y+r1.height<r2.y||r2.y+r2.height<r1.y)}
    function getNonOverlappingPositionInCircle(pr, od, exR) { let plr=pr-(od/2)-5;if(plr<0)plr=0;for(let i=0;i<MAX_PLACEMENT_ATTEMPTS;i++){const a=Math.random()*2*Math.PI,r=Math.sqrt(Math.random())*plr,cx=pr+r*Math.cos(a),cy=pr+r*Math.sin(a),x=cx-(od/2),y=cy-(od/2),nr={x,y,width:od,height:od};if(!exR.some(er=>checkOverlap(nr,er)))return{x,y}}return null}
    function getWeightedNumberOfConnections() { const e=Math.random();return e<.6?1:e<.9?2:3;}
    function adjustColor(e, t) { let r=parseInt(e.slice(1,3),16),o=parseInt(e.slice(3,5),16),a=parseInt(e.slice(5,7),16);r=Math.max(0,Math.min(255,r+t)),o=Math.max(0,Math.min(255,o+t)),a=Math.max(0,Math.min(255,a+t));return`#${r.toString(16).padStart(2,"0")}${o.toString(16).padStart(2,"0")}${a.toString(16).padStart(2,"0")}`}
    function setActiveScreen(screenToShow) { [mainScreen,galaxyDetailScreen,solarSystemScreen,planetDesignerScreen].forEach(s=>{if(s)s.classList.remove('active','panning-active');});if(screenToShow){screenToShow.classList.add('active');}if(zoomControlsElement){if(screenToShow===galaxyDetailScreen||screenToShow===solarSystemScreen)zoomControlsElement.classList.add('visible');else zoomControlsElement.classList.remove('visible');}if(regenerateUniverseButton){regenerateUniverseButton.style.display=(screenToShow===mainScreen||screenToShow===galaxyDetailScreen||screenToShow===solarSystemScreen||screenToShow===planetDesignerScreen)?'block':'none';}if(customizeGenerationButton){customizeGenerationButton.style.display=(screenToShow===mainScreen||screenToShow===galaxyDetailScreen||screenToShow===solarSystemScreen||screenToShow===planetDesignerScreen)?'block':'none';}if(createPlanetDesignButton){createPlanetDesignButton.style.display=(screenToShow===mainScreen||screenToShow===galaxyDetailScreen||screenToShow===solarSystemScreen||screenToShow===planetDesignerScreen)?'block':'none';}if(!(screenToShow===solarSystemScreen&&planetVisualPanel&&planetVisualPanel.classList.contains('visible'))&&planetVisualPanel){planetVisualPanel.classList.remove('visible');} cancelAnimationFrame(animationFrameId); animationFrameId = null; startSolarSystemAnimation();} // Modified: Ensure animation pauses/starts correctly.
    function generateUniverseLayout() { const s=Math.min(window.innerWidth,window.innerHeight);gameSessionData.universe.diameter=Math.max(300,s*0.85);if(universeCircle){universeCircle.style.width=`${gameSessionData.universe.diameter}px`;universeCircle.style.height=`${gameSessionData.universe.diameter}px`;universeCircle.style.backgroundColor=FIXED_COLORS.universeBg;}}
    function generateGalaxies() { if(!gameSessionData.universe.diameter)return;gameSessionData.galaxies=[];const p=gameSessionData.universe.diameter/2;const t=[];for(let i=0;i<currentNumGalaxies;i++){const id=`galaxy-${i+1}`,pos=getNonOverlappingPositionInCircle(p,GALAXY_ICON_SIZE,t);if(pos&&!isNaN(pos.x)&&!isNaN(pos.y)){gameSessionData.galaxies.push({id,x:pos.x,y:pos.y,customName:null,solarSystems:[],lineConnections:[],layoutGenerated:false,currentZoom:1.0,currentPanX:0,currentPanY:0,generationParams:{densityFactor:0.8+Math.random()*0.4}});t.push({x:pos.x,y:pos.y,width:GALAXY_ICON_SIZE,height:GALAXY_ICON_SIZE})}}}
    function getDistance(s1, s2) { return Math.sqrt(Math.pow(s1.centerX-s2.centerX,2)+Math.pow(s1.centerY-s2.centerY,2));}
    function tryAddConnection(fId, tId, cCA, cCO, aSL, mDL) { if(!fId||!tId||fId===tId||fId===null||tId===null)return false;if((cCO[fId]||0)>=MAX_CONNECTIONS_PER_SYSTEM||(cCO[tId]||0)>=MAX_CONNECTIONS_PER_SYSTEM){return false;}const k=[fId,tId].sort().join('-');if(cCA.some(c=>([c.fromId,c.toId].sort().join('-')===k))){return false;}if(mDL!==undefined&&mDL!==null){const s1=aSL.find(s=>s.id===fId);const s2=aSL.find(s=>s.id===tId);if(s1&&s2&&getDistance(s1,s2)>mDL){return false;}}return true;}
    function generateSolarSystemsForGalaxy(galaxyId) { const g=gameSessionData.galaxies.find(gl=>gl.id===galaxyId);if(!g||!galaxyViewport){return;}if(g.layoutGenerated&&!gameSessionData.isForceRegenerating)return;const pD=galaxyViewport.offsetWidth>0?galaxyViewport.offsetWidth:(gameSessionData.universe.diameter||500);const pR=pD/2;if(pD<=0||isNaN(pR)||pR<=0){g.layoutGenerated=true;if(!gameSessionData.isForceRegenerating)saveGameState();return}g.solarSystems=[];g.lineConnections=[];const tPR=[];const nSTA=Math.floor(Math.random()*(currentMaxSSCount-currentMinSSCount+1))+currentMinSSCount;for(let i=0;i<nSTA;i++){const sId=`${g.id}-ss-${i+1}`;const pos=getNonOverlappingPositionInCircle(pR,SOLAR_SYSTEM_BASE_ICON_SIZE,tPR);if(pos&&!isNaN(pos.x)&&!isNaN(pos.y)){const sSF=0.5+Math.random()*9.5;g.solarSystems.push({id:sId,customName:null,x:pos.x,y:pos.y,iconSize:SOLAR_SYSTEM_BASE_ICON_SIZE,sunSizeFactor:sSF});tPR.push({x:pos.x,y:pos.y,width:SOLAR_SYSTEM_BASE_ICON_SIZE,height:SOLAR_SYSTEM_BASE_ICON_SIZE})}}if(g.solarSystems.length<2){g.layoutGenerated=true;if(!gameSessionData.isForceRegenerating)saveGameState();return;}const aSC=g.solarSystems.map(ss=>({...ss,centerX:ss.x+ss.iconSize/2,centerY:ss.y+ss.iconSize/2}));const sCC={};const cGD=pD;const aMECDP=cGD*MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT;const aMFCDP=cGD*MAX_FORCED_CONNECTION_DISTANCE_PERCENT;let cS=new Set();let uS=new Set(aSC.map(s=>s.id));if(aSC.length>0){const fSI=aSC[0].id;cS.add(fSI);uS.delete(fSI);while(uS.size>0){let bC=null;let mCD=Infinity;for(const uId of uS){const cUS=aSC.find(s=>s.id===uId);for(const cId of cS){const cCS=aSC.find(s=>s.id===cId);const d=getDistance(cUS,cCS);if(d<mCD){mCD=d;bC={fromId:cId,toId:uId,dist:d};}}}if(bC){const cIVP=tryAddConnection(bC.fromId,bC.toId,g.lineConnections,sCC,aSC,aMECDP);if(cIVP){g.lineConnections.push({fromId:bC.fromId,toId:bC.toId});sCC[bC.fromId]=(sCC[bC.fromId]||0)+1;sCC[bC.toId]=(sCC[bC.toId]||0)+1;cS.add(bC.toId);uS.delete(bC.toId);}else{const sTCI=bC.toId;const sTC=aSC.find(s=>s.id===sTCI);let fTI=null;let mFD=Infinity;for(const cId of cS){const cSy=aSC.find(s=>s.id===cId);const dist=getDistance(sTC,cSy);const iPF=tryAddConnection(sTCI,cId,g.lineConnections,sCC,aSC,aMFCDP);if(iPF){if(dist<mFD){mFD=dist;fTI=cId;}}}if(fTI){g.lineConnections.push({fromId:sTCI,toId:fTI});sCC[sTCI]=(sCC[sTCI]||0)+1;sCC[fTI]=(sCC[fTI]||0)+1;cS.add(sTCI);uS.delete(sTCI);}else{let uFI=null;let mUFD=Infinity;for(const cCI of cS){const cSy=aSC.find(s=>s.id===cCI);const dist=getDistance(sTC,cSy);const iPUE=tryAddConnection(sTCI,cCI,g.lineConnections,sCC,aSC,null);if(iPUE){if(dist<mUFD){mUFD=dist;uFI=cCI;}}}if(uFI){g.lineConnections.push({fromId:sTCI,toId:uFI});sCC[sTCI]=(sCC[sTCI]||0)+1;sCC[uFI]=(sCC[uFI]||0)+1;cS.add(sTCI);uS.delete(sTCI);}else{uS.delete(sTCI);}}}}else{if(uS.size>0&&cS.size===0&&aSC.length>0){const nUI=Array.from(uS)[0];cS.add(nUI);uS.delete(nUI);}else{break;}}}}aSC.forEach(ss1=>{const dC=getWeightedNumberOfConnections();let cCo=sCC[ss1.id]||0;let cTA=Math.min(dC,MAX_CONNECTIONS_PER_SYSTEM-cCo);if(cTA<=0)return;let pT=aSC.filter(ss2=>ss1.id!==ss2.id).map(ss2=>({...ss2,distance:getDistance(ss1,ss2)})).sort((a,b)=>a.distance-b.distance);const lPT=pT.filter(ss2=>ss2.distance<=aMECDP);const fC=lPT.slice(0,MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS);for(const ss2 of fC){if(cTA<=0)break;const succ=tryAddConnection(ss1.id,ss2.id,g.lineConnections,sCC,aSC,aMECDP);if(succ){g.lineConnections.push({fromId:ss1.id,toId:ss2.id});sCC[ss1.id]=(sCC[ss1.id]||0)+1;sCC[ss2.id]=(sCC[ss2.id]||0)+1;cTA--;}}});g.layoutGenerated=true;if(!gameSessionData.isForceRegenerating){saveGameState();}}
    async function preGenerateAllGalaxyContents() { gameSessionData.isForceRegenerating=true;for(const g of gameSessionData.galaxies){if(galaxyViewport&&(!g.layoutGenerated||g.solarSystems.length===0)){await new Promise(r=>setTimeout(r,0));generateSolarSystemsForGalaxy(g.id);}}gameSessionData.isForceRegenerating=false;saveGameState();}
    
    function renderMainScreen() {
      if(mainScreenTitleText) mainScreenTitleText.textContent="Universe";
      if(!universeCircle) return;
      universeCircle.innerHTML='';
      gameSessionData.galaxies.forEach(g=>{
        const dId=g.id.split('-').pop();
        const el=document.createElement('div');
        el.className='galaxy-icon';
        el.style.width=`$px`; 
        el.style.height=`$px`;
        el.style.left=`${g.x}px`;
        el.style.top=`${g.y}px`;
        el.style.backgroundColor=FIXED_COLORS.galaxyIconFill;
        el.style.border=`3px solid ${FIXED_COLORS.galaxyIconBorder}`;
        el.title=g.customName||`Galaxy $`;
        el.dataset.galaxyId=g.id;
        el.addEventListener('click',()=>switchToGalaxyDetailView(g.id));
        universeCircle.appendChild(el)
      }); 
    }

    function drawGalaxyLines(galaxy) { if(!solarSystemLinesCanvasEl||!galaxyZoomContent)return;if(galaxyZoomContent.offsetWidth>0&&solarSystemLinesCanvasEl.width!==galaxyZoomContent.offsetWidth)solarSystemLinesCanvasEl.width=galaxyZoomContent.offsetWidth;if(galaxyZoomContent.offsetHeight>0&&solarSystemLinesCanvasEl.height!==galaxyZoomContent.offsetHeight)solarSystemLinesCanvasEl.height=galaxyZoomContent.offsetHeight;if(!linesCtx)linesCtx=solarSystemLinesCanvasEl.getContext('2d');if(!linesCtx)return;linesCtx.clearRect(0,0,solarSystemLinesCanvasEl.width,solarSystemLinesCanvasEl.height);if(!galaxy||!galaxy.lineConnections||!galaxy.solarSystems)return;linesCtx.strokeStyle=FIXED_COLORS.connectionLine;linesCtx.lineWidth=0.5;linesCtx.setLineDash([]);const spos={};galaxy.solarSystems.forEach(ss=>{spos[ss.id]={x:ss.x+ss.iconSize/2,y:ss.y+ss.iconSize/2}});galaxy.lineConnections.forEach(c=>{const f=spos[c.fromId],t=spos[c.toId];if(f&&t){linesCtx.beginPath();linesCtx.moveTo(f.x,f.y);linesCtx.lineTo(t.x,t.y);linesCtx.stroke()}})}
    
    function renderGalaxyDetailScreen(isInteractive = false) {
      const g=gameSessionData.galaxies.find(gl=>gl.id===gameSessionData.activeGalaxyId);
      if(!g){switchToMainView();return}
      if(!galaxyViewport||!galaxyZoomContent)return; // galaxyZoomContent already checked by drawGalaxyLines
      galaxyViewport.style.width=`${gameSessionData.universe.diameter||500}px`;
      galaxyViewport.style.height=`${gameSessionData.universe.diameter||500}px`;
      const icons=galaxyZoomContent.querySelectorAll('.solar-system-icon');
      icons.forEach(i=>i.remove());
      const zSD=0.6;
      g.solarSystems.forEach(ss=>{
        const sSO=ss;
        const el=document.createElement('div');
        el.className='solar-system-icon';
        const bEZ=1+(g.currentZoom-GALAXY_VIEW_MIN_ZOOM)*zSD;
        let dSIP=(ss.iconSize*bEZ);
        if(g.currentZoom>0){dSIP=dSIP/g.currentZoom;}
        dSIP=Math.max(0.5,dSIP);
        el.style.width=`$px`; 
        el.style.height=`$px`;
        const cO=dSIP/2;
        const bCO=ss.iconSize/2;
        el.style.left=`${ss.x+bCO-cO}px`;
        el.style.top=`${ss.y+bCO-cO}px`;
        el.dataset.solarSystemId=ss.id;
        if(sSO&&sSO.customName){el.title=sSO.customName;}
        el.addEventListener('click',e=>{e.stopPropagation();switchToSolarSystemView(ss.id)});
        galaxyZoomContent.appendChild(el)
      });
      if(solarSystemLinesCanvasEl.parentNode!==galaxyZoomContent||galaxyZoomContent.firstChild!==solarSystemLinesCanvasEl){galaxyZoomContent.insertBefore(solarSystemLinesCanvasEl,galaxyZoomContent.firstChild);}
      drawGalaxyLines(g);
      galaxyZoomContent.style.transition=isInteractive?'none':'transform 0.1s ease-out';
      galaxyZoomContent.style.transform=`translate(${g.currentPanX}px,${g.currentPanY}px)scale(${g.currentZoom})`;
      if(galaxyDetailTitleText){
        const dId=g.id.split('-').pop();
        galaxyDetailTitleText.textContent=g.customName||`Galaxy $`;
      }
    }

    function drawAllOrbits() { if(!orbitCtx||!solarSystemOrbitCanvasEl||!gameSessionData.solarSystemView.planets)return;orbitCtx.clearRect(0,0,solarSystemOrbitCanvasEl.width,solarSystemOrbitCanvasEl.height);if(!currentShowPlanetOrbits)return;const cCX=solarSystemOrbitCanvasEl.width/2;const cCY=solarSystemOrbitCanvasEl.height/2;gameSessionData.solarSystemView.planets.forEach(pD=>{const oR=pD.distance;orbitCtx.beginPath();orbitCtx.arc(cCX,cCY,oR,0,2*Math.PI);orbitCtx.strokeStyle='rgba(255,255,255,0.2)';orbitCtx.lineWidth=1;orbitCtx.setLineDash([5,5]);orbitCtx.stroke();});orbitCtx.setLineDash([]);}
    
    function renderSolarSystemScreen(isInteractive = false) {
      if(!solarSystemContent||!solarSystemScreen||!gameSessionData.activeSolarSystemId){return;}
      const d=gameSessionData.solarSystemView;
      let pX=d.currentPanX||0,pY=d.currentPanY||0;
      let z=d.zoomLevel||SOLAR_SYSTEM_VIEW_MIN_ZOOM;
      solarSystemContent.style.transition=isInteractive?'none':'transform 0.1s ease-out';
      solarSystemContent.style.transform=`translate($px, $px) scale($)`;
      const gP_match = gameSessionData.activeSolarSystemId.match(/^(galaxy-\d+)-ss-\d+$/);
      const gP = gP_match ? gP_match[1] : null;
      const aG= gP ? gameSessionData.galaxies.find(g_find=>g_find.id===gP) : null;
      let sSO=null;
      if(aG&&aG.solarSystems){sSO=aG.solarSystems.find(ss_find=>ss_find.id===d.systemId);}
      if(solarSystemTitleText){solarSystemTitleText.textContent=(sSO&&sSO.customName)?sSO.customName:`System ${d.systemId?d.systemId.substring(d.systemId.lastIndexOf('-')+1):'N/A'}`;}
      if(isInteractive||!animationFrameId){drawAllOrbits();}}
        
    function switchToMainView() { gameSessionData.activeGalaxyId=null;gameSessionData.activeSolarSystemId=null;setActiveScreen(mainScreen);}
    function makeTitleEditable(tTE, tIE, oSC) { if(!tTE || !tIE) return; tTE.ondblclick=()=>{tTE.style.display='none';tIE.style.display='inline-block';tIE.value=tTE.textContent;tIE.focus();tIE.select();};const sN=()=>{const nN=tIE.value.trim();const dN=oSC(nN||null);tTE.textContent=nN||dN;tIE.style.display='none';tTE.style.display='inline-block';};tIE.onblur=sN;tIE.onkeydown=(e)=>{if(e.key==='Enter'){tIE.blur();}else if(e.key==='Escape'){tIE.value=tTE.textContent;tIE.blur();}};}
    
    function switchToGalaxyDetailView(galaxyId) {
      const g=gameSessionData.galaxies.find(gl=>gl.id===galaxyId);
      if(!g){switchToMainView();return;}
      gameSessionData.activeGalaxyId=galaxyId;
      const dId=g.id.split('-').pop();
      if(backToGalaxyButton){backToGalaxyButton.textContent=g.customName?`← ${g.customName}`:`← Galaxy $`;}
      gameSessionData.activeSolarSystemId=null;
      g.currentZoom=g.currentZoom||1.0;
      g.currentPanX=g.currentPanX||0;
      g.currentPanY=g.currentPanY||0;
      if(galaxyDetailTitleText){galaxyDetailTitleText.textContent=g.customName||`Galaxy $`;galaxyDetailTitleText.style.display='inline-block';}
      if(galaxyDetailTitleInput)galaxyDetailTitleInput.style.display='none';
      setActiveScreen(galaxyDetailScreen);
      makeTitleEditable(galaxyDetailTitleText,galaxyDetailTitleInput,(nN)=>{g.customName=nN||null;saveGameState();renderMainScreen();return g.customName||`Galaxy $`;});
      if(galaxyViewport&&gameSessionData.universe.diameter){galaxyViewport.style.width=`${gameSessionData.universe.diameter}px`;galaxyViewport.style.height=`${gameSessionData.universe.diameter}px`;}
      if(!g.layoutGenerated){setTimeout(()=>{function aLG(rL=5){if(galaxyViewport&&galaxyViewport.offsetWidth>0){generateSolarSystemsForGalaxy(galaxyId);renderGalaxyDetailScreen(false);}else if(rL>0){requestAnimationFrame(()=>aLG(rL-1));}else{console.warn("Galaxy viewport never got dimensions for layout generation.");g.layoutGenerated=true;renderGalaxyDetailScreen(false);}}aLG();},50);}else{renderGalaxyDetailScreen(false);}}

    function renderPlanetVisual(planetData, rotationQuaternion, targetCanvas = planetVisualCanvas) {
      const workerToUse = targetCanvas === planetVisualCanvas ? planetVisualWorker : designerWorker;
      if (!planetData || !targetCanvas || !workerToUse ) {
          console.warn("renderPlanetVisual: Missing data, canvas, or appropriate worker.", { planetData, targetCanvasId: targetCanvas?.id, workerExists: !!workerToUse });
          if (targetCanvas === designerPlanetCanvas) isRenderingDesignerPlanet = false;
          if (targetCanvas === planetVisualCanvas) isRenderingVisualPlanet = false;
          return;
      }
      if (targetCanvas.width === 0 || targetCanvas.height === 0) {
        console.warn(`renderPlanetVisual: Target canvas ${targetCanvas.id} has zero dimensions. Aborting worker call.`);
        if (targetCanvas === designerPlanetCanvas) isRenderingDesignerPlanet = false;
        if (targetCanvas === planetVisualCanvas) isRenderingVisualPlanet = false;
        return;
      }

      const pD = { ...planetData };  

      if (!pD.continentSeed && pD.continentSeed !== 0) pD.continentSeed = Math.random();
      if (!pD.waterColor) pD.waterColor = '#000080';
      if (!pD.landColor) pD.landColor = '#006400';
        
      pD.minTerrainHeight = pD.minTerrainHeight ?? DEFAULT_MIN_TERRAIN_HEIGHT;
      pD.maxTerrainHeight = pD.maxTerrainHeight ?? DEFAULT_MAX_TERRAIN_HEIGHT;
      pD.oceanHeightLevel = pD.oceanHeightLevel ?? DEFAULT_OCEAN_HEIGHT_LEVEL;

      const dataToSend = {
        waterColor: pD.waterColor, landColor: pD.landColor, continentSeed: pD.continentSeed,
        minTerrainHeight: pD.minTerrainHeight, maxTerrainHeight: pD.maxTerrainHeight, oceanHeightLevel: pD.oceanHeightLevel,
      };
      const canvasId = targetCanvas.id;

      if (targetCanvas === planetVisualCanvas) isRenderingVisualPlanet = true;
      else if (targetCanvas === designerPlanetCanvas) isRenderingDesignerPlanet = true;

      workerToUse.postMessage({
        cmd: 'renderPlanet', planetData: dataToSend, rotationQuaternion,
        canvasWidth: targetCanvas.width, canvasHeight: targetCanvas.height, senderId: canvasId
      });
    }
    
    function switchToSolarSystemView(solarSystemId) {
      gameSessionData.activeSolarSystemId = solarSystemId;
      const galaxyPartMatch = solarSystemId.match(/^(galaxy-\d+)-ss-\d+$/);
      const galaxyPart = galaxyPartMatch ? galaxyPart[1] : null;

      const activeGalaxy = galaxyPart ? gameSessionData.galaxies.find(g => g.id === galaxyPart) : null;
      let solarSystemObject = null;
      if (activeGalaxy && activeGalaxy.solarSystems) {
        solarSystemObject = activeGalaxy.solarSystems.find(ss => ss.id === solarSystemId);
      }
      gameSessionData.solarSystemView.zoomLevel = 0.5;
      gameSessionData.solarSystemView.currentPanX = 0;
      gameSessionData.solarSystemView.currentPanY = 0;
      gameSessionData.solarSystemView.systemId = solarSystemId;
      if (solarSystemContent) solarSystemContent.innerHTML = ''; 

      let currentSunSize = SUN_ICON_SIZE;
      if (solarSystemObject && typeof solarSystemObject.sunSizeFactor === 'number') {
        currentSunSize = SUN_ICON_SIZE * solarSystemObject.sunSizeFactor;
      }
      currentSunSize = Math.max(currentSunSize, 15);
      const sunEl = document.createElement('div');
      // REMOVED: Sun animation class (as per request)
      sunEl.className = 'sun-icon'; // Removed sun-animated class
      sunEl.style.width = `$px`; sunEl.style.height = `$px`;
      const coreColor=FIXED_COLORS.sunFill,midColor=FIXED_COLORS.sunBorder,edgeColor=adjustColor(FIXED_COLORS.sunBorder,-40),actualBorderColor=FIXED_COLORS.sunBorder;
      sunEl.style.setProperty('--sun-core-color',coreColor); sunEl.style.setProperty('--sun-mid-color',midColor); sunEl.style.setProperty('--sun-edge-color',edgeColor); sunEl.style.setProperty('--sun-actual-border-color',actualBorderColor);
      if (solarSystemContent) solarSystemContent.appendChild(sunEl);

      // solarSystemOrbitCanvasEl is already declared in a higher scope
      solarSystemOrbitCanvasEl = document.createElement('canvas');
      solarSystemOrbitCanvasEl.id = 'solar-system-orbit-canvas';
      solarSystemOrbitCanvasEl.width = ORBIT_CANVAS_SIZE; solarSystemOrbitCanvasEl.height = ORBIT_CANVAS_SIZE;
      if (solarSystemContent) solarSystemContent.appendChild(solarSystemOrbitCanvasEl);
      orbitCtx = solarSystemOrbitCanvasEl.getContext('2d');
      gameSessionData.solarSystemView.planets = [];
      let usedDistances = [];
      const numPlanets = Math.floor(Math.random() * (currentMaxPlanets - currentMinPlanets + 1)) + currentMinPlanets;

      for (let i = 0; i < numPlanets; i++) {
        const planetSize = Math.random() * (MAX_PLANET_SIZE - MIN_PLANET_SIZE) + MIN_PLANET_SIZE;
        let planetDistance, attemptCount = 0;
        do {
          planetDistance = Math.floor(Math.random()*(MAX_PLANET_DISTANCE-MIN_PLANET_DISTANCE+1))+MIN_PLANET_DISTANCE;
          let tooClose=false; for(const d of usedDistances){if(Math.abs(planetDistance-d.distance)<(MIN_ORBITAL_SEPARATION+(d.size+planetSize)/2)){tooClose=true;break;}}
          if(!tooClose)break;attemptCount++;
        } while (attemptCount < 200);
        if (attemptCount === 200) continue;
        usedDistances.push({distance: planetDistance, size: planetSize});

        const basisToUse = (gameSessionData.customPlanetDesigns.length > 0) 
          ? gameSessionData.customPlanetDesigns[Math.floor(Math.random() * gameSessionData.customPlanetDesigns.length)]
          : { 
            waterColor: '#0077be', landColor: '#3A5F0B', 
            minTerrainHeightRange: [0.0, 1.0], 
            maxTerrainHeightRange: [5.0, 8.0], 
            oceanHeightRange: [1.0, 3.0] 
          };
          
        const newPlanetData = generatePlanetInstanceFromBasis(basisToUse, false);

        const initialOrbitalAngle=Math.random()*2*Math.PI,orbitalSpeed=Math.random()*(MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT-MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT)+MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT;
        const initialAxialAngle=Math.random()*2*Math.PI,axialSpeed=DEFAULT_PLANET_AXIAL_SPEED;
            
        const newPlanet = {
          id: `planet-${i + 1}`, size: planetSize, distance: planetDistance,
          currentOrbitalAngle: initialOrbitalAngle, orbitalSpeed: orbitalSpeed,
          currentAxialAngle: initialAxialAngle, axialSpeed: axialSpeed,
          element: null, planetName: `Planet ${i + 1}`, type: 'terrestrial',
          waterColor: newPlanetData.waterColor, landColor: newPlanetData.landColor,
          continentSeed: newPlanetData.continentSeed,
          minTerrainHeight: newPlanetData.minTerrainHeight,
          maxTerrainHeight: newPlanetData.maxTerrainHeight,
          oceanHeightLevel: newPlanetData.oceanHeightLevel,
          sourceDesignId: basisToUse.designId || null  
        };
        gameSessionData.solarSystemView.planets.push(newPlanet);
        const planetEl=document.createElement('div'); planetEl.className='planet-icon';
        planetEl.style.width=`${newPlanet.size}px`; planetEl.style.height=`${newPlanet.size}px`;
        
        const rp=15+Math.random()*40,rs=20+Math.random()*30;
        let bS=`radial-gradient(circle at $% $%, ${newPlanet.landColor} $%, transparent ${rs+20}%), ${newPlanet.waterColor}`;
        if(Math.random()<0.5){const rp2=15+Math.random()*40,rs2=20+Math.random()*30;bS=`radial-gradient(circle at ${90-rp2}% ${90-rp2}% , ${newPlanet.landColor} $%, transparent ${rs2+20}%), `+bS;}
        
        planetEl.style.background=bS; planetEl.style.boxShadow=`0 0 ${newPlanet.size/3}px rgba(255,255,255,0.3)`;
        planetEl.addEventListener('click',(e)=>{
            e.stopPropagation();
            if (!planetVisualPanel || !planetVisualTitle || !planetVisualSize || !planetVisualCanvas) {
                console.error("Planet visual panel elements not found!");
                return;
            }
            const wasPanelVisible=planetVisualPanel.classList.contains('visible');
            currentPlanetDisplayedInPanel=newPlanet;
            planetVisualTitle.textContent=newPlanet.planetName;
            planetVisualSize.textContent=Math.round(newPlanet.size);
            planetVisualPanel.classList.add('visible');
            if(!wasPanelVisible){
                planetVisualPanel.style.left='50%';
                planetVisualPanel.style.top='50%';
                planetVisualPanel.style.transform='translate(-50%, -50%)';
                planetVisualPanel.style.transition='';
            } else {
                planetVisualPanel.style.transition='none';
            }
            planetVisualRotationQuat=quat_identity();
            renderPlanetVisual(newPlanet,planetVisualRotationQuat,planetVisualCanvas);
        });
        if (solarSystemContent) solarSystemContent.appendChild(planetEl);newPlanet.element=planetEl;
      }

      if(planetVisualWorker && gameSessionData.solarSystemView.planets && planetVisualCanvas){
          gameSessionData.solarSystemView.planets.forEach(pTP=>{
              const pD={
                  waterColor:pTP.waterColor, landColor:pTP.landColor, continentSeed:pTP.continentSeed,
                  minTerrainHeight:pTP.minTerrainHeight, maxTerrainHeight:pTP.maxTerrainHeight, oceanHeightLevel:pTP.oceanHeightLevel,
              };
              planetVisualWorker.postMessage({
                  cmd:'preloadPlanet', planetData:pD, rotationQuaternion:quat_identity(),
                  canvasWidth:planetVisualCanvas.width||200, canvasHeight:planetVisualCanvas.height||200, 
                  senderId:`preload-${pTP.id}`
              });
          });
      } else if (!planetVisualCanvas) {
          console.warn("planetVisualCanvas not found for preloading.");
      }

      const systemIdentifier = solarSystemId.substring(solarSystemId.lastIndexOf('-')+1);
      if(solarSystemTitleText){solarSystemTitleText.textContent=(solarSystemObject&&solarSystemObject.customName)?solarSystemObject.customName:`System $`;}
      if(solarSystemTitleInput)solarSystemTitleInput.style.display='none';
      setActiveScreen(solarSystemScreen);
      makeTitleEditable(solarSystemTitleText,solarSystemTitleInput,(nN)=>{
          if(solarSystemObject){
              solarSystemObject.customName=nN||null;
              saveGameState();
              renderGalaxyDetailScreen();
              return solarSystemObject.customName||`System $`;
          }
          return `System $`;
      });
      renderSolarSystemScreen(false);
      startSolarSystemAnimation();
    }

    function animateSolarSystem(now) {
      if(!now)now=performance.now();
      if(lastAnimationTime===null)lastAnimationTime=now;
      const dT=(now-lastAnimationTime)/1000;
      lastAnimationTime=now;
      const aSV=gameSessionData.solarSystemView;
      if(aSV && solarSystemScreen && solarSystemScreen.classList.contains('active') && aSV.planets){
        aSV.planets.forEach(p=>{
          if (p.element) {
            p.currentOrbitalAngle+=p.orbitalSpeed*6*dT;
            p.currentAxialAngle+=p.axialSpeed*60*dT;
            const pMOX=p.distance*Math.cos(p.currentOrbitalAngle);
            const pMOY=p.distance*Math.sin(p.currentOrbitalAngle);
            p.element.style.left=`calc(50% + $px)`;
            p.element.style.top=`calc(50% + $px)`;
            p.element.style.transform=`translate(-50%, -50%) rotate(${p.currentAxialAngle}rad)`;
          }
        });
        animationFrameId=requestAnimationFrame(animateSolarSystem);
      }else{
        if(animationFrameId){cancelAnimationFrame(animationFrameId);animationFrameId=null;}
        lastAnimationTime=null;
      }
    }
    function startSolarSystemAnimation() { if(!animationFrameId && solarSystemScreen && solarSystemScreen.classList.contains('active')){lastAnimationTime=null;animateSolarSystem();}}
    function clampSolarSystemPan(dO, vW, vH) { if(!dO||!vW||!vH){if(dO){dO.currentPanX=0;dO.currentPanY=0;}return;}const zm=dO.zoomLevel;const cW=SOLAR_SYSTEM_EXPLORABLE_RADIUS*2;const cH=SOLAR_SYSTEM_EXPLORABLE_RADIUS*2;const sCW=cW*zm;const sCH=cH*zm;const mPX=Math.max(0,(sCW-vW)/2);const mPY=Math.max(0,(sCH-vH)/2);dO.currentPanX=Math.max(-mPX,Math.min(mPX,dO.currentPanX));dO.currentPanY=Math.max(-mPY,Math.min(mPY,dO.currentPanY));}
    function clampGalaxyPan(galaxy) { if(!galaxy||!galaxyViewport)return;const vW=galaxyViewport.offsetWidth;const vH=galaxyViewport.offsetHeight;const zm=galaxy.currentZoom;if(zm<=GALAXY_VIEW_MIN_ZOOM){galaxy.currentPanX=0;galaxy.currentPanY=0;}else{const pLX=(vW*zm-vW)/2;const pLY=(vH*zm-vH)/2;galaxy.currentPanX=Math.max(-pLX,Math.min(pLX,galaxy.currentPanX));galaxy.currentPanY=Math.max(-pLY,Math.min(pLY,galaxy.currentPanY));}}
    function handleZoom(direction, mouseEvent = null) { let tD,vE,cCF,cRF,hMZ,hMX,cZP,cPXP,cPYP,iSV=false;if(galaxyDetailScreen.classList.contains('active')){const g=gameSessionData.galaxies.find(gl=>gl.id===gameSessionData.activeGalaxyId);if(!g)return;tD=g;vE=galaxyViewport;cCF=clampGalaxyPan;cRF=renderGalaxyDetailScreen;hMZ=GALAXY_VIEW_MIN_ZOOM;hMX=GALAXY_VIEW_MAX_ZOOM;cZP='currentZoom';cPXP='currentPanX';cPYP='currentPanY';}else if(solarSystemScreen.classList.contains('active')){iSV=true;tD=gameSessionData.solarSystemView;vE=solarSystemScreen;cCF=clampSolarSystemPan;cRF=renderSolarSystemScreen;hMZ=SOLAR_SYSTEM_VIEW_MIN_ZOOM;hMX=SOLAR_SYSTEM_VIEW_MAX_ZOOM;cZP='zoomLevel';cPXP='currentPanX';cPYP='currentPanY';}else return;const oZ=tD[cZP];let nCZ=oZ+(direction==='in'?(ZOOM_STEP*oZ):-(ZOOM_STEP*oZ));let fMZFC=hMZ;if(iSV && vE){const vW=vE.offsetWidth;const vH=vE.offsetHeight;let dMZBOE=0;if(SOLAR_SYSTEM_EXPLORABLE_RADIUS>0&&(vW>0||vH>0)){const mZTCW=vW>0?vW/(SOLAR_SYSTEM_EXPLORABLE_RADIUS*2):0;const mZTCH=vH>0?vH/(SOLAR_SYSTEM_EXPLORABLE_RADIUS*2):0;dMZBOE=Math.max(mZTCW,mZTCH);}fMZFC=Math.max(hMZ,dMZBOE);}nCZ=Math.max(fMZFC,Math.min(hMX,nCZ));if(Math.abs(oZ-nCZ)<0.0001)return;tD[cZP]=nCZ;if(mouseEvent && vE){const r=vE.getBoundingClientRect();const mXIV=mouseEvent.clientX-r.left;const mYIV=mouseEvent.clientY-r.top;const vCX=vE.offsetWidth/2;const vCY=vE.offsetHeight/2;const mXRTC=mXIV-vCX;const mYRTC=mYIV-vCY;const cPX=tD[cPXP]||0;const cPY=tD[cPYP]||0;const wX=(mXRTC-cPX)/oZ;const wY=(mYRTC-cPY)/oZ;tD[cPXP]=mXRTC-(wX*nCZ);tD[cPYP]=mYRTC-(wY*nCZ);}if(iSV && vE){cCF(tD,vE.offsetWidth,vE.offsetHeight);cRF(true);startSolarSystemAnimation();drawAllOrbits();}else{cCF(tD);cRF(true);}}
    function startPan(event, vE, cE, dORef) { if(event.button!==0||event.target.closest('button'))return;if(vE===galaxyViewport&&(event.target.classList.contains('solar-system-icon')||event.target.closest('.solar-system-icon')))return;const pS=gameSessionData.panning;pS.isActive=true;pS.startX=event.clientX;pS.startY=event.clientY;pS.initialPanX=dORef.currentPanX||0;pS.initialPanY=dORef.currentPanY||0;pS.targetElement=cE;pS.viewportElement=vE;pS.dataObject=dORef;if(vE) vE.classList.add('dragging');if(cE)cE.style.transition='none';event.preventDefault()}
    function panMouseMove(event) { if(!gameSessionData.panning.isActive)return;const pS=gameSessionData.panning;if(!pS.dataObject)return;const dX=event.clientX-pS.startX,dY=event.clientY-pS.startY;pS.dataObject.currentPanX=pS.initialPanX+dX;pS.dataObject.currentPanY=pS.initialPanY+dY;if(pS.viewportElement===galaxyViewport){clampGalaxyPan(pS.dataObject);renderGalaxyDetailScreen(true)}else if(pS.viewportElement===solarSystemScreen && pS.viewportElement){clampSolarSystemPan(pS.dataObject,pS.viewportElement.offsetWidth,pS.viewportElement.offsetHeight);renderSolarSystemScreen(true);}}
    function panMouseUp() { if(!gameSessionData.panning.isActive)return;if(gameSessionData.panning.viewportElement)gameSessionData.panning.viewportElement.classList.remove('dragging');const pS=gameSessionData.panning;pS.isActive=false;if(pS.targetElement)pS.targetElement.style.transition='';if(galaxyDetailScreen.classList.contains('active'))renderGalaxyDetailScreen(false);else if(solarSystemScreen.classList.contains('active'))renderSolarSystemScreen(false);pS.targetElement=null;pS.viewportElement=null;pS.dataObject=null;}
    function regenerateCurrentUniverseState(fM=false) { if(!fM&&!confirm("Regenerate universe with current settings? This will clear the currently saved layout."))return;localStorage.removeItem('galaxyGameSaveData');gameSessionData.universe={diameter:null};gameSessionData.galaxies=[];gameSessionData.activeGalaxyId=null;gameSessionData.activeSolarSystemId=null;gameSessionData.solarSystemView={zoomLevel:1.0,currentPanX:0,currentPanY:0,planets:[],systemId:null};gameSessionData.isInitialized=false;if(universeCircle)universeCircle.innerHTML='';if(galaxyZoomContent){const c=galaxyZoomContent.querySelector('#solar-system-lines-canvas');galaxyZoomContent.innerHTML='';if(c)galaxyZoomContent.appendChild(c);}if(solarSystemContent)solarSystemContent.innerHTML='';if(orbitCtx&&solarSystemOrbitCanvasEl)orbitCtx.clearRect(0,0,solarSystemOrbitCanvasEl.width,solarSystemOrbitCanvasEl.height);if(animationFrameId){cancelAnimationFrame(animationFrameId);animationFrameId=null;}lastAnimationTime=null;initializeGame(true);}
    
    if (regenerateUniverseButton) regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(false));
    if (customizeGenerationButton) customizeGenerationButton.addEventListener('click', () => { if(!numGalaxiesInput)return;numGalaxiesInput.value=currentNumGalaxies;minSSInput.value=currentMinSSCount;maxSSInput.value=currentMaxSSCount;ssSpreadInput.value=currentMaxPlanetDistanceMultiplier.toFixed(1);minPlanetsInput.value=currentMinPlanets;maxPlanetsInput.value=currentMaxPlanets;showOrbitsInput.checked=currentShowPlanetOrbits;customizationModal.classList.add('visible');});
    if (cancelCustomizationButton) cancelCustomizationButton.addEventListener('click', () => { customizationModal.classList.remove('visible'); });
    if (applyCustomizationButton) applyCustomizationButton.addEventListener('click', () => { if(!numGalaxiesInput)return; const nG=parseInt(numGalaxiesInput.value,10);const mSS=parseInt(minSSInput.value,10);const mxSS=parseInt(maxSSInput.value,10);const sp=parseFloat(ssSpreadInput.value);const mP=parseInt(minPlanetsInput.value,10);const mxP=parseInt(maxPlanetsInput.value,10);if(isNaN(nG)||nG<1||nG>100||isNaN(mSS)||mSS<1||mSS>1000||isNaN(mxSS)||mxSS<1||mxSS>2000||mxSS<mSS||isNaN(sp)||sp<0.1||sp>5.0||isNaN(mP)||mP<0||mP>20||isNaN(mxP)||mxP<mP||mxP>20){alert("Invalid input values. Please check ranges and ensure Max >= Min.");return;}currentNumGalaxies=nG;currentMinSSCount=mSS;currentMaxSSCount=mxSS;currentMaxPlanetDistanceMultiplier=sp;currentMinPlanets=mP;currentMaxPlanets=mxP;currentShowPlanetOrbits=showOrbitsInput.checked;updateDerivedConstants();saveCustomizationSettings();customizationModal.classList.remove('visible');regenerateCurrentUniverseState(true);});
    if (closePlanetVisualPanelBtn) closePlanetVisualPanelBtn.addEventListener('click', () => { if(planetVisualPanel) planetVisualPanel.classList.remove('visible'); currentPlanetDisplayedInPanel = null; });
    
    let isPanelDragging = false; let visualPanelOffset = { x: 0, y: 0 };
    if (planetVisualPanelHeader) planetVisualPanelHeader.addEventListener('mousedown', (e) => {if(e.button!==0 || !planetVisualPanel)return;isPanelDragging=true;planetVisualPanel.classList.add('dragging');planetVisualPanel.style.transition='none';const r=planetVisualPanel.getBoundingClientRect();visualPanelOffset.x=e.clientX-r.left;visualPanelOffset.y=e.clientY-r.top;planetVisualPanel.style.left=`${e.clientX-visualPanelOffset.x}px`;planetVisualPanel.style.top=`${e.clientY-visualPanelOffset.y}px`;planetVisualPanel.style.transform='none';planetVisualPanel.style.right='auto';planetVisualPanel.style.bottom='auto';e.preventDefault();});
    
    if (planetVisualCanvas) {
      planetVisualCanvas.addEventListener('mousedown', (e) => {
        if(e.button!==0||!currentPlanetDisplayedInPanel)return;
        isDraggingPlanetVisual=true;
        startDragMouseX=e.clientX;startDragMouseY=e.clientY;
        startDragPlanetVisualQuat=[...planetVisualRotationQuat];
        planetVisualCanvas.classList.add('dragging');
        e.preventDefault();
      });
    }
    if (designerPlanetCanvas) {
      designerPlanetCanvas.addEventListener('mousedown', (e) => {
        if(e.button!==0)return;
        isDraggingDesignerPlanet=true;
        designerStartDragMouseX=e.clientX;designerStartDragMouseY=e.clientY;
        startDragDesignerPlanetQuat=[...designerPlanetRotationQuat];
        designerPlanetCanvas.classList.add('dragging');
        e.preventDefault();
      });
    }

    window.addEventListener('mousemove', (e) => {
      if (isPanelDragging && planetVisualPanel) {
        planetVisualPanel.style.left = `${e.clientX - visualPanelOffset.x}px`;
        planetVisualPanel.style.top = `${e.clientY - visualPanelOffset.y}px`;
      }
      if (isDraggingPlanetVisual && currentPlanetDisplayedInPanel && planetVisualCanvas && planetVisualPanel && planetVisualPanel.classList.contains('visible')) {
        const rect=planetVisualCanvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return; // Avoid division by zero
        const cW=rect.width,cH=rect.height,dMX=e.clientX-startDragMouseX,dMY=e.clientY-startDragMouseY;
        const rAX=(dMY/cH)*Math.PI*PLANET_ROTATION_SENSITIVITY,rAY=(dMX/cW)*(2*Math.PI)*PLANET_ROTATION_SENSITIVITY;
        const iXQ=quat_from_axis_angle([1,0,0],-rAX),iYQ=quat_from_axis_angle([0,1,0],rAY);
        const cIQ=quat_multiply(iYQ,iXQ);
        planetVisualRotationQuat = quat_normalize(quat_multiply(cIQ, startDragPlanetVisualQuat));
        if (!isRenderingVisualPlanet && planetVisualWorker) {  
          renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas);  
        } else {
          needsPlanetVisualRerender = true;  
        }
      } else if (isDraggingDesignerPlanet && designerPlanetCanvas) {
        const rect=designerPlanetCanvas.getBoundingClientRect();
        const cBFW=(designerPlanetCanvas.width > 0 ? designerPlanetCanvas.width : rect.width) || 1;
        const cBFH=(designerPlanetCanvas.height > 0 ? designerPlanetCanvas.height : rect.height) || 1;
        if (cBFW === 0 || cBFH === 0) return;
        
        const dMX=e.clientX-designerStartDragMouseX,dMY=e.clientY-designerStartDragMouseY;
        const rAX=(dMY/cBFH)*Math.PI*PLANET_ROTATION_SENSITIVITY,rAY=(dMX/cBFW)*(2*Math.PI)*PLANET_ROTATION_SENSITIVITY;
        const iXQ=quat_from_axis_angle([1,0,0],-rAX),iYQ=quat_from_axis_angle([0,1,0],rAY);
        const cIQ=quat_multiply(iYQ,iXQ);
        designerPlanetRotationQuat = quat_normalize(quat_multiply(cIQ, startDragDesignerPlanetQuat));
        if (!isRenderingDesignerPlanet && currentDesignerPlanetInstance && designerWorker) {  
          renderDesignerPlanet(currentDesignerPlanetInstance, designerPlanetRotationQuat);
        }
      }
    });
    
    window.addEventListener('mouseup', () => {
      if (isPanelDragging && planetVisualPanel) { isPanelDragging = false; planetVisualPanel.classList.remove('dragging'); planetVisualPanel.style.transition = ''; }
      if (isDraggingPlanetVisual && planetVisualCanvas) { isDraggingPlanetVisual = false; planetVisualCanvas.classList.remove('dragging'); }
      if (isDraggingDesignerPlanet && designerPlanetCanvas) { isDraggingDesignerPlanet = false; designerPlanetCanvas.classList.remove('dragging'); }
    });

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
        preGenerateAllGalaxyContents(); // This calls saveGameState inside if not force regenerating
        // if (gameSessionData.galaxies.every(g => g.layoutGenerated)) { saveGameState(); } // saveGameState is called within preGenerate or generateSolarSystemsForGalaxy
      }
      gameSessionData.isInitialized = true;
    }

    window.addEventListener('resize', () => {
      const activeScreenElement = document.querySelector('.screen.active');
      const cSBRI = activeScreenElement ? activeScreenElement.id : null;
        
      localStorage.removeItem('galaxyGameSaveData');  
      gameSessionData.universe={diameter:null};
      gameSessionData.galaxies=[];
      gameSessionData.activeGalaxyId=null;
      gameSessionData.activeSolarSystemId=null;
      gameSessionData.solarSystemView={zoomLevel:1.0,currentPanX:0,currentPanY:0,planets:[],systemId:null};
      // gameSessionData.customPlanetDesigns = []; // Keep custom designs on resize? Original clears them.
      gameSessionData.isInitialized=false;
        
      if(universeCircle)universeCircle.innerHTML='';
      if(galaxyZoomContent){
          const canvasLines = galaxyZoomContent.querySelector('#solar-system-lines-canvas');
          galaxyZoomContent.innerHTML='';
          if(canvasLines) galaxyZoomContent.appendChild(canvasLines);
      }
      if(solarSystemContent) solarSystemContent.innerHTML='';
      if(orbitCtx&&solarSystemOrbitCanvasEl) orbitCtx.clearRect(0,0,solarSystemOrbitCanvasEl.width,solarSystemOrbitCanvasEl.height);
      if(animationFrameId){cancelAnimationFrame(animationFrameId);animationFrameId=null;}
      lastAnimationTime=null;
        
      loadCustomizationSettings();
      initializeGame(true);
        
      const sTA = cSBRI ? document.getElementById(cSBRI) : mainScreen;
      setActiveScreen(sTA || mainScreen);
        
      if (sTA === planetDesignerScreen) {
        switchToPlanetDesignerScreen();
      } else if (sTA === galaxyDetailScreen && gameSessionData.activeGalaxyId) {
          switchToGalaxyDetailView(gameSessionData.activeGalaxyId);
      } else if (sTA === solarSystemScreen && gameSessionData.activeSolarSystemId) {
          switchToSolarSystemView(gameSessionData.activeSolarSystemId);
      }
        
      if (planetVisualPanel && planetVisualPanel.classList.contains('visible') && currentPlanetDisplayedInPanel && planetVisualCanvas) {
          resizeDesignerCanvasToDisplaySize(); // Also resize the main visual canvas if it is based on offsetWidth
          renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas);
      }
      if (designerPlanetCanvas && planetDesignerScreen && planetDesignerScreen.classList.contains('active')) {
          resizeDesignerCanvasToDisplaySize(); // Ensure designer canvas is resized
          if (currentDesignerPlanetInstance) {
              renderDesignerPlanet(currentDesignerPlanetInstance, designerPlanetRotationQuat);
          }
      }
    });

    if (backToMainButton) backToMainButton.addEventListener('click', switchToMainView);
    if (backToGalaxyButton) backToGalaxyButton.addEventListener('click', () => { if (gameSessionData.activeGalaxyId&&gameSessionData.galaxies.find(g=>g.id===gameSessionData.activeGalaxyId)){switchToGalaxyDetailView(gameSessionData.activeGalaxyId);}else{switchToMainView();}});
    if (zoomInButton) zoomInButton.addEventListener('click', (e) => handleZoom('in', e));
    if (zoomOutButton) zoomOutButton.addEventListener('click', (e) => handleZoom('out', e));
    if (galaxyViewport) galaxyViewport.addEventListener('wheel', (e) => { if (galaxyDetailScreen.classList.contains('active')) { e.preventDefault(); handleZoom(e.deltaY < 0 ? 'in' : 'out', e);}});
    if (solarSystemScreen) solarSystemScreen.addEventListener('wheel', (e) => { if (solarSystemScreen.classList.contains('active')) { e.preventDefault(); handleZoom(e.deltaY < 0 ? 'in' : 'out', e); }});
    if (solarSystemScreen) solarSystemScreen.addEventListener('mousedown', (e) => { if (solarSystemScreen.classList.contains('active')) { startPan(e, solarSystemScreen, solarSystemContent, gameSessionData.solarSystemView); } });
    window.addEventListener('mousemove', panMouseMove);
    window.addEventListener('mouseup', panMouseUp);
    
    if (galaxyViewport) {  
      galaxyViewport.addEventListener('click', function (event) {
        if (gameSessionData.panning && gameSessionData.panning.isActive) {
          // Check if it was a "real" pan or just a click without moving
          const panThreshold = 5; // pixels
          if (Math.abs(event.clientX - gameSessionData.panning.startX) > panThreshold ||
              Math.abs(event.clientY - gameSessionData.panning.startY) > panThreshold) {
            return; // It was a pan, not a click
          }
        }

        const ssIcon = event.target.closest('.solar-system-icon');
        if (ssIcon) {  
          const ssId = ssIcon.dataset.solarSystemId;  
          if (ssId) { switchToSolarSystemView(ssId); event.stopPropagation();}
        }
      });

      let isGalaxyPanningSpecific = false;  
      let galaxyPanStartSpecific = { x: 0, y: 0 };  
      let galaxyLastPanSpecific = { x: 0, y: 0 };

      galaxyViewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !galaxyDetailScreen.classList.contains('active') || e.target.closest('.solar-system-icon') || e.target.closest('button')) return;
          
        isGalaxyPanningSpecific = true;  
        galaxyPanStartSpecific.x = e.clientX;  
        galaxyPanStartSpecific.y = e.clientY;
        const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
        galaxyLastPanSpecific.x = gal?.currentPanX || 0;  
        galaxyLastPanSpecific.y = gal?.currentPanY || 0;
        galaxyViewport.classList.add('dragging');  
        if (galaxyZoomContent) galaxyZoomContent.style.transition = 'none';
        e.preventDefault();
          
        if (gameSessionData.panning) { // For click distance check
          gameSessionData.panning.startX = e.clientX;  
          gameSessionData.panning.startY = e.clientY;
        }
      });

      const galaxyMouseMoveHandler = (e) => {
        if (!isGalaxyPanningSpecific) return;  
        const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);  
        if (!gal) return;
        const dx = e.clientX - galaxyPanStartSpecific.x;  
        const dy = e.clientY - galaxyPanStartSpecific.y;
        gal.currentPanX = galaxyLastPanSpecific.x + dx;  
        gal.currentPanY = galaxyLastPanSpecific.y + dy;
        clampGalaxyPan(gal);
        renderGalaxyDetailScreen(true);
      };
      window.addEventListener('mousemove', galaxyMouseMoveHandler);

      const galaxyMouseUpHandler = () => {
        if (isGalaxyPanningSpecific) {  
          isGalaxyPanningSpecific = false;  
          if (galaxyViewport) galaxyViewport.classList.remove('dragging');  
          if (galaxyZoomContent) galaxyZoomContent.style.transition = '';  
          renderGalaxyDetailScreen(false);  
        }
      };
      window.addEventListener('mouseup', galaxyMouseUpHandler);
    }
    
    initializeGame();

}); // End of DOMContentLoaded
