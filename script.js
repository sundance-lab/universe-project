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
  const designerMinHeightMinInput = document.getElementById('designer-min-height-min');
  const designerMinHeightMaxInput = document.getElementById('designer-min-height-max');
  const designerMaxHeightMinInput = document.getElementById('designer-max-height-min');
  const designerMaxHeightMaxInput = document.getElementById('designer-max-height-max');
  const designerOceanHeightMinInput = document.getElementById('designer-ocean-height-min');
  const designerOceanHeightMaxInput = document.getElementById('designer-ocean-height-max');

  // --- STATE VARIABLES ---
  let linesCtx;
  let solarSystemOrbitCanvasEl;
  let orbitCtx;
  let animationFrameId = null;
  let lastAnimationTime = null;
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
    continentSeed: Math.random(), // Seed for the basis itself, instance seeds will vary
    minTerrainHeightRange: [0.0, 2.0],
    maxTerrainHeightRange: [8.0, 12.0],
    oceanHeightRange: [1.0, 3.0]
  };
  let currentDesignerPlanetInstance = null; // Holds specific values of the rendered preview

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
  const BASE_MAX_PLANET_DISTANCE_FACTOR = 25;
  const PLANET_ROTATION_SENSITIVITY = 0.75;
  const DEFAULT_MIN_TERRAIN_HEIGHT = 0.0; // Used for legacy loading if needed
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
  let MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0;
  let MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier;
  let ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
  let SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2;
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
            planetVisualCanvas.style.transform = ""; 
            planetVisualRotationQuatDisplayed = planetVisualRotationQuatTarget;
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
      // console.log("Designer worker responded:", e.data.senderId);
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

  class PerlinNoise { /* ... (PerlinNoise class code - unchanged) ... */ 
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

function resizeDesignerCanvasToDisplaySize() {
  const canvas = designerPlanetCanvas;
  if (!canvas) return; // Exit if the canvas doesn't exist
  const displayWidth = canvas.offsetWidth;
  const displayHeight = canvas.offsetHeight;

    // Check if dimensions are available (offsetWidth/offsetHeight may be 0 initially)
    if (displayWidth && displayHeight) {
      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
        }
    } else {
        // If dimensions not available, try again on the next animation frame
        requestAnimationFrame(resizeDesignerCanvasToDisplaySize);
    }
}

function populateDesignerInputsFromBasis() {
    designerWaterColorInput.value = currentDesignerBasis.waterColor;
    designerLandColorInput.value = currentDesignerBasis.landColor;

    designerMinHeightMinInput.value = currentDesignerBasis.minTerrainHeightRange[0].toFixed(1);
    designerMinHeightMaxInput.value = currentDesignerBasis.minTerrainHeightRange[1].toFixed(1);

    designerMaxHeightMinInput.value = currentDesignerBasis.maxTerrainHeightRange[0].toFixed(1);
    designerMaxHeightMaxInput.value = currentDesignerBasis.maxTerrainHeightRange[1].toFixed(1);

    designerOceanHeightMinInput.value = currentDesignerBasis.oceanHeightRange[0].toFixed(1);
    designerOceanHeightMaxInput.value = currentDesignerBasis.oceanHeightRange[1].toFixed(1);
}

function updateBasisAndRefreshDesignerPreview() {
    currentDesignerBasis.waterColor = designerWaterColorInput.value;
    currentDesignerBasis.landColor = designerLandColorInput.value;

    let minH_min = parseFloat(designerMinHeightMinInput.value) || 0.0;
    let minH_max = parseFloat(designerMinHeightMaxInput.value) || 0.0;
    let maxH_min = parseFloat(designerMaxHeightMinInput.value) || 0.0;
    let maxH_max = parseFloat(designerMaxHeightMaxInput.value) || 0.0;
    let oceanH_min = parseFloat(designerOceanHeightMinInput.value) || 0.0;
    let oceanH_max = parseFloat(designerOceanHeightMaxInput.value) || 0.0;

    // Validate and correct ranges (min <= max)
    if (minH_min > minH_max) minH_min = minH_max;
    if (maxH_min > maxH_max) maxH_min = maxH_max;
    if (oceanH_min > oceanH_max) oceanH_min = oceanH_max;

    // Ensure min values are not negative
    minH_min = Math.max(0, minH_min); minH_max = Math.max(0, minH_max);
    maxH_min = Math.max(0, maxH_min); maxH_max = Math.max(0, maxH_max);
    oceanH_min = Math.max(0, oceanH_min); oceanH_max = Math.max(0, oceanH_max);

    currentDesignerBasis.minTerrainHeightRange = [minH_min, minH_max];
    currentDesignerBasis.maxTerrainHeightRange = [maxH_min, maxH_max];
    currentDesignerBasis.oceanHeightRange = [oceanH_min, oceanH_max];

    populateDesignerInputsFromBasis(); // Reflect corrections to inputs
    generateAndRenderDesignerPreviewInstance();
}

function generateAndRenderDesignerPreviewInstance(resetRotation = false) {
    currentDesignerPlanetInstance = generatePlanetInstanceFromBasis(currentDesignerBasis);
    if (resetRotation) designerPlanetRotationQuat = quat_identity();
    resizeDesignerCanvasToDisplaySize(); // Add this
    if (!isRenderingDesignerPlanet) {
        isRenderingDesignerPlanet = true;
        renderDesignerPlanet(currentDesignerPlanetInstance, designerPlanetRotationQuat);
    }
}

function renderDesignerPlanet(planetToRender, rotationQuaternion) {
    if (!planetToRender || !designerPlanetCanvas) return;
    //resizeDesignerCanvasToDisplaySize(); //Reset on render call
    if (designerPlanetCanvas.width === 0 || designerPlanetCanvas.height === 0) {
        console.warn("Designer canvas has 0 dimensions. Aborting render.");
        isRenderingDesignerPlanet = false;
        return;
    }
    renderPlanetVisual(planetToRender, rotationQuaternion, designerPlanetCanvas);
}

function randomizeDesignerPlanet() {
    currentDesignerBasis.waterColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    currentDesignerBasis.landColor = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
    currentDesignerBasis.continentSeed = Math.random();

    let minH_min_rand = parseFloat((Math.random() * 2.0).toFixed(1)); // 0 to 2
    let minH_max_rand = parseFloat((minH_min_rand + Math.random() * 2.0 + 0.1).toFixed(1)); // min_min to min_min + 2.1

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

  function saveCustomPlanetDesign() {
      updateBasisAndRefreshDesignerPreview(); // Ensure basis reflects current inputs

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
      // console.log("Saved design basis:", newDesign);
  }

   function loadAndPreviewDesign(designId) {
       const designToLoad = gameSessionData.customPlanetDesigns.find(d => d.designId === designId);
       if (designToLoad) {
           currentDesignerBasis.waterColor = designToLoad.waterColor;
           currentDesignerBasis.landColor = designToLoad.landColor;
           currentDesignerBasis.continentSeed = designToLoad.continentSeed || Math.random();

           currentDesignerBasis.minTerrainHeightRange = (Array.isArray(designToLoad.minTerrainHeightRange) && designToLoad.minTerrainHeightRange.length === 2)
               ? [...designToLoad.minTerrainHeightRange]
               : [designToLoad.minTerrainHeight ?? 0.0, (designToLoad.minTerrainHeight ?? 0.0) + 1.0];

           currentDesignerBasis.maxTerrainHeightRange = (Array.isArray(designToLoad.maxTerrainHeightRange) && designToLoad.maxTerrainHeightRange.length === 2)
               ? [...designToLoad.maxTerrainHeightRange]
               : [designToLoad.maxTerrainHeight ?? 10.0, (designToLoad.maxTerrainHeight ?? 10.0) + 2.0];

           currentDesignerBasis.oceanHeightRange = (Array.isArray(designToLoad.oceanHeightRange) && designToLoad.oceanHeightRange.length === 2)
               ? [...designToLoad.oceanHeightRange]
               : [designToLoad.oceanHeightLevel ?? 2.0, (designToLoad.oceanHeightLevel ?? 2.0) + 1.0];

           populateDesignerInputsFromBasis();
           generateAndRenderDesignerPreviewInstance(true);
       }
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
      resetCanvasSize(); //Fix
      requestAnimationFrame(() => {
          generateAndRenderDesignerPreviewInstance(true);
      });
  }

// --- END PLANET DESIGNER CORE LOGIC ---

// Event listeners for designer range inputs (now call the new central handler)
[designerMinHeightMinInput, designerMinHeightMaxInput,
    designerMaxHeightMinInput, designerMaxHeightMaxInput,
    designerOceanHeightMinInput, designerOceanHeightMaxInput,
    designerWaterColorInput, designerLandColorInput].forEach(input => {
    input.addEventListener('change', updateBasisAndRefreshDesignerPreview);
});

designerRandomizeBtn.addEventListener('click', randomizeDesignerPlanet);
designerSaveBtn.addEventListener('click', saveCustomPlanetDesign);
designerCancelBtn.addEventListener('click', () => setActiveScreen(mainScreen));
createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);

// ... (Rest of the code remains the same) ...

  function quat_identity() { /* ... ( unchanged) ... */ return [1,0,0,0]; }
  function quat_from_axis_angle(axis, angle) { /* ... ( unchanged) ... */ const hA = angle*0.5, s=Math.sin(hA); return [Math.cos(hA),axis[0]*s,axis[1]*s,axis[2]*s];}
  function quat_multiply(q1, q2) { /* ... ( unchanged) ... */ const w1=q1[0],x1=q1[1],y1=q1[2],z1=q1[3],w2=q2[0],x2=q2[1],y2=q2[2],z2=q2[3]; return [w1*w2-x1*x2-y1*y2-z1*z2,w1*x2+x1*w2+y1*z2-z1*y2,w1*y2-x1*z2+y1*w2+z1*x2,w1*z2+x1*y2-y1*x2+z1*w2];}
  function quat_normalize(q) { /* ... ( unchanged) ... */ let l=q[0]*q[0]+q[1]*q[1]+q[2]*q[2]+q[3]*q[3]; if(l===0)return [1,0,0,0]; l=1/Math.sqrt(l); return [q[0]*l, q[1]*l, q[2]*l, q[3]*l];}
  
  function updateDerivedConstants() { /* ... ( unchanged) ... */ MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier; MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0 * (currentMaxPlanetDistanceMultiplier > 0.5 ? currentMaxPlanetDistanceMultiplier * 0.8 : 0.5); ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2; SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2; }
  function saveCustomizationSettings() { /* ... ( unchanged) ... */ const s={numGalaxies:currentNumGalaxies,minSS:currentMinSSCount,maxSS:currentMaxSSCount,spread:currentMaxPlanetDistanceMultiplier,minPlanets:currentMinPlanets,maxPlanets:currentMaxPlanets,showOrbits:currentShowPlanetOrbits};localStorage.setItem('galaxyCustomizationSettings',JSON.stringify(s));}
  function loadCustomizationSettings() { /* ... (major parts unchanged, ensure defaults are fine) ... */ const sS=localStorage.getItem('galaxyCustomizationSettings');if(sS){try{const lS=JSON.parse(sS);currentNumGalaxies=parseInt(lS.numGalaxies,10)||DEFAULT_NUM_GALAXIES;currentMinSSCount=parseInt(lS.minSS,10)||DEFAULT_MIN_SS_COUNT_CONST;currentMaxSSCount=parseInt(lS.maxSS,10)||DEFAULT_MAX_SS_COUNT_CONST;currentMaxPlanetDistanceMultiplier=parseFloat(lS.spread)||DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;currentMinPlanets=parseInt(lS.minPlanets,10);if(isNaN(currentMinPlanets))currentMinPlanets=DEFAULT_MIN_PLANETS_PER_SYSTEM;currentMaxPlanets=parseInt(lS.maxPlanets,10);if(isNaN(currentMaxPlanets))currentMaxPlanets=DEFAULT_MAX_PLANETS_PER_SYSTEM;currentShowPlanetOrbits=typeof lS.showOrbits==='boolean'?lS.showOrbits:DEFAULT_SHOW_PLANET_ORBITS;}catch(e){console.error("Error loading customization settings:",e);resetToDefaultCustomization();}}else{resetToDefaultCustomization();}updateDerivedConstants();}
  function resetToDefaultCustomization() { /* ... ( unchanged) ... */ currentNumGalaxies=DEFAULT_NUM_GALAXIES;currentMinSSCount=DEFAULT_MIN_SS_COUNT_CONST;currentMaxSSCount=DEFAULT_MAX_SS_COUNT_CONST;currentMaxPlanetDistanceMultiplier=DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;currentMinPlanets=DEFAULT_MIN_PLANETS_PER_SYSTEM;currentMaxPlanets=DEFAULT_MAX_PLANETS_PER_SYSTEM;currentShowPlanetOrbits=DEFAULT_SHOW_PLANET_ORBITS;}
  function saveGameState() { /* ... ( unchanged) ... */ try{const sTS={universeDiameter:gameSessionData.universe.diameter,galaxies:gameSessionData.galaxies,customPlanetDesigns:gameSessionData.customPlanetDesigns};localStorage.setItem('galaxyGameSaveData',JSON.stringify(sTS));}catch(e){console.error("Error saving game state:",e);}}
  function loadGameState() { /* ... (Major logic unchanged, but ensure customPlanetDesigns are handled by generatePlanetInstanceFromBasis) ... */
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
            gal.lineConnections = gal.lineConnections || [];
          });
          // Handle customPlanetDesigns loading.
          // generatePlanetInstanceFromBasis will handle if range properties are missing.
          gameSessionData.customPlanetDesigns = loadedState.customPlanetDesigns || [];
          // No specific processing needed here for old designs as generatePlanetInstanceFromBasis handles it.
          return true;
        }
      }
    } catch (error) { console.error("Error loading game state:", error); localStorage.removeItem('galaxyGameSaveData'); }
    return false;
  }
  function checkOverlap(r1, r2) { /* ... ( unchanged) ... */ return!(r1.x+r1.width<r2.x||r2.x+r2.width<r1.x||r1.y+r1.height<r2.y||r2.y+r2.height<r1.y)}
  function getNonOverlappingPositionInCircle(pr, od, exR) { /* ... ( unchanged) ... */ let plr=pr-(od/2)-5;if(plr<0)plr=0;for(let i=0;i<MAX_PLACEMENT_ATTEMPTS;i++){const a=Math.random()*2*Math.PI,r=Math.sqrt(Math.random())*plr,cx=pr+r*Math.cos(a),cy=pr+r*Math.sin(a),x=cx-(od/2),y=cy-(od/2),nr={x,y,width:od,height:od};if(!exR.some(er=>checkOverlap(nr,er)))return{x,y}}return null}
  function getWeightedNumberOfConnections() { /* ... ( unchanged) ... */ const e=Math.random();return e<.6?1:e<.9?2:3;}
  function adjustColor(e, t) { /* ... ( unchanged) ... */ let r=parseInt(e.slice(1,3),16),o=parseInt(e.slice(3,5),16),a=parseInt(e.slice(5,7),16);return r=Math.max(0,Math.min(255,r+t)),o=Math.max(0,Math.min(255,o+t)),a=Math.max(0,Math.min(255,a+t)),`#${r.toString(16).padStart(2,"0")}${o.toString(16).padStart(2,"0")}${a.toString(16).padStart(2,"0")}`}
  function setActiveScreen(screenToShow) { /* ... ( unchanged) ... */ [mainScreen,galaxyDetailScreen,solarSystemScreen,planetDesignerScreen].forEach(s=>{if(s)s.classList.remove('active','panning-active');});if(screenToShow){screenToShow.classList.add('active');}if(zoomControlsElement){if(screenToShow===galaxyDetailScreen||screenToShow===solarSystemScreen)zoomControlsElement.classList.add('visible');else zoomControlsElement.classList.remove('visible');}if(regenerateUniverseButton){regenerateUniverseButton.style.display=(screenToShow===mainScreen||screenToShow===galaxyDetailScreen||screenToShow===solarSystemScreen||screenToShow===planetDesignerScreen)?'block':'none';}if(customizeGenerationButton){customizeGenerationButton.style.display=(screenToShow===mainScreen||screenToShow===galaxyDetailScreen||screenToShow===solarSystemScreen||screenToShow===planetDesignerScreen)?'block':'none';}if(createPlanetDesignButton){createPlanetDesignButton.style.display=(screenToShow===mainScreen||screenToShow===galaxyDetailScreen||screenToShow===solarSystemScreen||screenToShow===planetDesignerScreen)?'block':'none';}if(!(screenToShow===solarSystemScreen&&planetVisualPanel.classList.contains('visible'))){planetVisualPanel.classList.remove('visible');}}
  function generateUniverseLayout() { /* ... ( unchanged) ... */ const s=Math.min(window.innerWidth,window.innerHeight);gameSessionData.universe.diameter=Math.max(300,s*0.85);if(universeCircle){universeCircle.style.width=`${gameSessionData.universe.diameter}px`;universeCircle.style.height=`${gameSessionData.universe.diameter}px`;universeCircle.style.backgroundColor=FIXED_COLORS.universeBg;}}
  function generateGalaxies() { /* ... ( unchanged) ... */ if(!gameSessionData.universe.diameter)return;gameSessionData.galaxies=[];const p=gameSessionData.universe.diameter/2;const t=[];for(let i=0;i<currentNumGalaxies;i++){const id=`galaxy-${i+1}`,pos=getNonOverlappingPositionInCircle(p,GALAXY_ICON_SIZE,t);if(pos&&!isNaN(pos.x)&&!isNaN(pos.y)){gameSessionData.galaxies.push({id,x:pos.x,y:pos.y,customName:null,solarSystems:[],lineConnections:[],layoutGenerated:false,currentZoom:1.0,currentPanX:0,currentPanY:0,generationParams:{densityFactor:0.8+Math.random()*0.4}});t.push({x:pos.x,y:pos.y,width:GALAXY_ICON_SIZE,height:GALAXY_ICON_SIZE})}}}
  function getDistance(s1, s2) { /* ... ( unchanged) ... */ return Math.sqrt(Math.pow(s1.centerX-s2.centerX,2)+Math.pow(s1.centerY-s2.centerY,2));}
  function tryAddConnection(fId, tId, cCA, cCO, aSL, mDL) { /* ... ( unchanged) ... */ if(!fId||!tId||fId===tId||fId===null||tId===null)return false;if((cCO[fId]||0)>=MAX_CONNECTIONS_PER_SYSTEM||(cCO[tId]||0)>=MAX_CONNECTIONS_PER_SYSTEM){return false;}const k=[fId,tId].sort().join('-');if(cCA.some(c=>([c.fromId,c.toId].sort().join('-')===k))){return false;}if(mDL!==undefined&&mDL!==null){const s1=aSL.find(s=>s.id===fId);const s2=aSL.find(s=>s.id===tId);if(s1&&s2&&getDistance(s1,s2)>mDL){return false;}}return true;}
  function generateSolarSystemsForGalaxy(galaxyId) { /* ... ( unchanged) ... */ const g=gameSessionData.galaxies.find(gl=>gl.id===galaxyId);if(!g||!galaxyViewport){return;}if(g.layoutGenerated&&!gameSessionData.isForceRegenerating)return;const pD=galaxyViewport.offsetWidth>0?galaxyViewport.offsetWidth:(gameSessionData.universe.diameter||500);const pR=pD/2;if(pD<=0||isNaN(pR)||pR<=0){g.layoutGenerated=true;if(!gameSessionData.isForceRegenerating)saveGameState();return}g.solarSystems=[];g.lineConnections=[];const tPR=[];const nSTA=Math.floor(Math.random()*(currentMaxSSCount-currentMinSSCount+1))+currentMinSSCount;for(let i=0;i<nSTA;i++){const sId=`${g.id}-ss-${i+1}`;const pos=getNonOverlappingPositionInCircle(pR,SOLAR_SYSTEM_BASE_ICON_SIZE,tPR);if(pos&&!isNaN(pos.x)&&!isNaN(pos.y)){const sSF=0.5+Math.random()*9.5;g.solarSystems.push({id:sId,customName:null,x:pos.x,y:pos.y,iconSize:SOLAR_SYSTEM_BASE_ICON_SIZE,sunSizeFactor:sSF});tPR.push({x:pos.x,y:pos.y,width:SOLAR_SYSTEM_BASE_ICON_SIZE,height:SOLAR_SYSTEM_BASE_ICON_SIZE})}}if(g.solarSystems.length<2){g.layoutGenerated=true;if(!gameSessionData.isForceRegenerating)saveGameState();return;}const aSC=g.solarSystems.map(ss=>({...ss,centerX:ss.x+ss.iconSize/2,centerY:ss.y+ss.iconSize/2}));const sCC={};const cGD=pD;const aMECDP=cGD*MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT;const aMFCDP=cGD*MAX_FORCED_CONNECTION_DISTANCE_PERCENT;let cS=new Set();let uS=new Set(aSC.map(s=>s.id));if(aSC.length>0){const fSI=aSC[0].id;cS.add(fSI);uS.delete(fSI);while(uS.size>0){let bC=null;let mCD=Infinity;for(const uId of uS){const cUS=aSC.find(s=>s.id===uId);for(const cId of cS){const cCS=aSC.find(s=>s.id===cId);const d=getDistance(cUS,cCS);if(d<mCD){mCD=d;bC={fromId:cId,toId:uId,dist:d};}}}if(bC){const cIVP=tryAddConnection(bC.fromId,bC.toId,g.lineConnections,sCC,aSC,aMECDP);if(cIVP){g.lineConnections.push({fromId:bC.fromId,toId:bC.toId});sCC[bC.fromId]=(sCC[bC.fromId]||0)+1;sCC[bC.toId]=(sCC[bC.toId]||0)+1;cS.add(bC.toId);uS.delete(bC.toId);}else{const sTCI=bC.toId;const sTC=aSC.find(s=>s.id===sTCI);let fTI=null;let mFD=Infinity;for(const cId of cS){const cSy=aSC.find(s=>s.id===cId);const dist=getDistance(sTC,cSy);const iPF=tryAddConnection(sTCI,cId,g.lineConnections,sCC,aSC,aMFCDP);if(iPF){if(dist<mFD){mFD=dist;fTI=cId;}}}if(fTI){g.lineConnections.push({fromId:sTCI,toId:fTI});sCC[sTCI]=(sCC[sTCI]||0)+1;sCC[fTI]=(sCC[fTI]||0)+1;cS.add(sTCI);uS.delete(sTCI);}else{let uFI=null;let mUFD=Infinity;for(const cCI of cS){const cSy=aSC.find(s=>s.id===cCI);const dist=getDistance(sTC,cSy);const iPUE=tryAddConnection(sTCI,cCI,g.lineConnections,sCC,aSC,null);if(iPUE){if(dist<mUFD){mUFD=dist;uFI=cCI;}}}if(uFI){g.lineConnections.push({fromId:sTCI,toId:uFI});sCC[sTCI]=(sCC[sTCI]||0)+1;sCC[uFI]=(sCC[uFI]||0)+1;cS.add(sTCI);uS.delete(sTCI);}else{uS.delete(sTCI);}}}}else{if(uS.size>0&&cS.size===0&&aSC.length>0){const nUI=Array.from(uS)[0];cS.add(nUI);uS.delete(nUI);}else{break;}}}}aSC.forEach(ss1=>{const dC=getWeightedNumberOfConnections();let cCo=sCC[ss1.id]||0;let cTA=Math.min(dC,MAX_CONNECTIONS_PER_SYSTEM-cCo);if(cTA<=0)return;let pT=aSC.filter(ss2=>ss1.id!==ss2.id).map(ss2=>({...ss2,distance:getDistance(ss1,ss2)})).sort((a,b)=>a.distance-b.distance);const lPT=pT.filter(ss2=>ss2.distance<=aMECDP);const fC=lPT.slice(0,MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS);for(const ss2 of fC){if(cTA<=0)break;const succ=tryAddConnection(ss1.id,ss2.id,g.lineConnections,sCC,aSC,aMECDP);if(succ){g.lineConnections.push({fromId:ss1.id,toId:ss2.id});sCC[ss1.id]=(sCC[ss1.id]||0)+1;sCC[ss2.id]=(sCC[ss2.id]||0)+1;cTA--;}}});g.layoutGenerated=true;if(!gameSessionData.isForceRegenerating){saveGameState();}}
  async function preGenerateAllGalaxyContents() { /* ... ( unchanged) ... */ gameSessionData.isForceRegenerating=true;for(const g of gameSessionData.galaxies){if(galaxyViewport&&(!g.layoutGenerated||g.solarSystems.length===0)){await new Promise(r=>setTimeout(r,0));generateSolarSystemsForGalaxy(g.id);}}gameSessionData.isForceRegenerating=false;saveGameState();}
  function renderMainScreen() { /* ... ( unchanged) ... */ if(mainScreenTitleText)mainScreenTitleText.textContent="Universe";if(!universeCircle)return;universeCircle.innerHTML='';gameSessionData.galaxies.forEach(g=>{const dId=g.id.split('-').pop();const el=document.createElement('div');el.className='galaxy-icon';el.style.width=`${GALAXY_ICON_SIZE}px`;el.style.height=`${GALAXY_ICON_SIZE}px`;el.style.left=`${g.x}px`;el.style.top=`${g.y}px`;el.style.backgroundColor=FIXED_COLORS.galaxyIconFill;el.style.border=`3px solid ${FIXED_COLORS.galaxyIconBorder}`;el.title=g.customName||`Galaxy ${dId}`;el.dataset.galaxyId=g.id;el.addEventListener('click',()=>switchToGalaxyDetailView(g.id));universeCircle.appendChild(el)}); }
  function drawGalaxyLines(galaxy) { /* ... ( unchanged) ... */ if(!solarSystemLinesCanvasEl||!galaxyZoomContent)return;if(galaxyZoomContent.offsetWidth>0&&solarSystemLinesCanvasEl.width!==galaxyZoomContent.offsetWidth)solarSystemLinesCanvasEl.width=galaxyZoomContent.offsetWidth;if(galaxyZoomContent.offsetHeight>0&&solarSystemLinesCanvasEl.height!==galaxyZoomContent.offsetHeight)solarSystemLinesCanvasEl.height=galaxyZoomContent.offsetHeight;if(!linesCtx)linesCtx=solarSystemLinesCanvasEl.getContext('2d');linesCtx.clearRect(0,0,solarSystemLinesCanvasEl.width,solarSystemLinesCanvasEl.height);if(!galaxy||!galaxy.lineConnections||!galaxy.solarSystems)return;linesCtx.strokeStyle=FIXED_COLORS.connectionLine;linesCtx.lineWidth=0.5;linesCtx.setLineDash([]);const spos={};galaxy.solarSystems.forEach(ss=>{spos[ss.id]={x:ss.x+ss.iconSize/2,y:ss.y+ss.iconSize/2}});galaxy.lineConnections.forEach(c=>{const f=spos[c.fromId],t=spos[c.toId];if(f&&t){linesCtx.beginPath();linesCtx.moveTo(f.x,f.y);linesCtx.lineTo(t.x,t.y);linesCtx.stroke()}})}
  function renderGalaxyDetailScreen(isInteractive = false) { /* ... ( unchanged) ... */ const g=gameSessionData.galaxies.find(gl=>gl.id===gameSessionData.activeGalaxyId);if(!g){switchToMainView();return}if(!galaxyViewport||!galaxyZoomContent)return;galaxyViewport.style.width=`${gameSessionData.universe.diameter||500}px`;galaxyViewport.style.height=`${gameSessionData.universe.diameter||500}px`;const icons=galaxyZoomContent.querySelectorAll('.solar-system-icon');icons.forEach(i=>i.remove());const zSD=0.6;g.solarSystems.forEach(ss=>{const sSO=ss;const el=document.createElement('div');el.className='solar-system-icon';const bEZ=1+(g.currentZoom-GALAXY_VIEW_MIN_ZOOM)*zSD;let dSIP=(ss.iconSize*bEZ);if(g.currentZoom>0){dSIP=dSIP/g.currentZoom;}dSIP=Math.max(0.5,dSIP);el.style.width=`${dSIP}px`;el.style.height=`${dSIP}px`;const cO=dSIP/2;const bCO=ss.iconSize/2;el.style.left=`${ss.x+bCO-cO}px`;el.style.top=`${ss.y+bCO-cO}px`;el.dataset.solarSystemId=ss.id;if(sSO&&sSO.customName){el.title=sSO.customName;}el.addEventListener('click',e=>{e.stopPropagation();switchToSolarSystemView(ss.id)});galaxyZoomContent.appendChild(el)});if(solarSystemLinesCanvasEl.parentNode!==galaxyZoomContent||galaxyZoomContent.firstChild!==solarSystemLinesCanvasEl){galaxyZoomContent.insertBefore(solarSystemLinesCanvasEl,galaxyZoomContent.firstChild);}drawGalaxyLines(g);galaxyZoomContent.style.transition=isInteractive?'none':'transform 0.1s ease-out';galaxyZoomContent.style.transform=`translate(${g.currentPanX}px,${g.currentPanY}px)scale(${g.currentZoom})`;if(galaxyDetailTitleText){const dId=g.id.split('-').pop();galaxyDetailTitleText.textContent=g.customName||`Galaxy ${dId}`;}}
  function drawAllOrbits() { /* ... ( unchanged) ... */ if(!orbitCtx||!solarSystemOrbitCanvasEl||!gameSessionData.solarSystemView.planets)return;orbitCtx.clearRect(0,0,solarSystemOrbitCanvasEl.width,solarSystemOrbitCanvasEl.height);if(!currentShowPlanetOrbits)return;const cCX=solarSystemOrbitCanvasEl.width/2;const cCY=solarSystemOrbitCanvasEl.height/2;gameSessionData.solarSystemView.planets.forEach(pD=>{const oR=pD.distance;orbitCtx.beginPath();orbitCtx.arc(cCX,cCY,oR,0,2*Math.PI);orbitCtx.strokeStyle='rgba(255,255,255,0.2)';orbitCtx.lineWidth=1;orbitCtx.setLineDash([5,5]);orbitCtx.stroke();});orbitCtx.setLineDash([]);}
  function renderSolarSystemScreen(isInteractive = false) { /* ... ( unchanged) ... */ if(!solarSystemContent||!solarSystemScreen||!gameSessionData.activeSolarSystemId){return;}const d=gameSessionData.solarSystemView;let pX=d.currentPanX||0,pY=d.currentPanY||0;let z=d.zoomLevel||SOLAR_SYSTEM_VIEW_MIN_ZOOM;solarSystemContent.style.transition=isInteractive?'none':'transform 0.1s ease-out';solarSystemContent.style.transform=`translate(${pX}px,${pY}px)scale(${z})`;const gP=gameSessionData.activeSolarSystemId.substring(0,gameSessionData.activeSolarSystemId.indexOf('-ss-'));const aG=gameSessionData.galaxies.find(g=>g.id===gP);let sSO=null;if(aG&&aG.solarSystems){sSO=aG.solarSystems.find(ss=>ss.id===d.systemId);}if(solarSystemTitleText){solarSystemTitleText.textContent=(sSO&&sSO.customName)?sSO.customName:`System ${d.systemId?d.systemId.substring(d.systemId.lastIndexOf('-')+1):'N/A'}`;}if(isInteractive||!animationFrameId){drawAllOrbits();}}
  function switchToMainView() { /* ... ( unchanged) ... */ gameSessionData.activeGalaxyId=null;gameSessionData.activeSolarSystemId=null;setActiveScreen(mainScreen);}
  function makeTitleEditable(tTE, tIE, oSC) { /* ... ( unchanged) ... */ tTE.ondblclick=()=>{tTE.style.display='none';tIE.style.display='inline-block';tIE.value=tTE.textContent;tIE.focus();tIE.select();};const sN=()=>{const nN=tIE.value.trim();const dN=oSC(nN||null);tTE.textContent=nN||dN;tIE.style.display='none';tTE.style.display='inline-block';};tIE.onblur=sN;tIE.onkeydown=(e)=>{if(e.key==='Enter'){tIE.blur();}else if(e.key==='Escape'){tIE.value=tTE.textContent;tIE.blur();}};}
  function switchToGalaxyDetailView(galaxyId) { /* ... ( unchanged) ... */ const g=gameSessionData.galaxies.find(gl=>gl.id===galaxyId);if(!g){switchToMainView();return;}gameSessionData.activeGalaxyId=galaxyId;const dId=g.id.split('-').pop();if(backToGalaxyButton){backToGalaxyButton.textContent=g.customName?`← ${g.customName}`:`← Galaxy ${dId}`;}gameSessionData.activeSolarSystemId=null;g.currentZoom=g.currentZoom||1.0;g.currentPanX=g.currentPanX||0;g.currentPanY=g.currentPanY||0;if(galaxyDetailTitleText){galaxyDetailTitleText.textContent=g.customName||`Galaxy ${dId}`;galaxyDetailTitleText.style.display='inline-block';}if(galaxyDetailTitleInput)galaxyDetailTitleInput.style.display='none';setActiveScreen(galaxyDetailScreen);makeTitleEditable(galaxyDetailTitleText,galaxyDetailTitleInput,(nN)=>{g.customName=nN||null;saveGameState();renderMainScreen();return g.customName||`Galaxy ${dId}`;});if(galaxyViewport&&gameSessionData.universe.diameter){galaxyViewport.style.width=`${gameSessionData.universe.diameter}px`;galaxyViewport.style.height=`${gameSessionData.universe.diameter}px`;}if(!g.layoutGenerated){setTimeout(()=>{function aLG(rL=5){if(galaxyViewport&&galaxyViewport.offsetWidth>0){generateSolarSystemsForGalaxy(galaxyId);renderGalaxyDetailScreen(false);}else if(rL>0){requestAnimationFrame(()=>aLG(rL-1));}else{g.layoutGenerated=true;renderGalaxyDetailScreen(false);}}aLG();},50);}else{renderGalaxyDetailScreen(false);}}

  function renderPlanetVisual(planetData, rotationQuaternion, targetCanvas = planetVisualCanvas) {
    if (!planetData || !targetCanvas || !window.Worker) return;
    if (targetCanvas.width === 0 || targetCanvas.height === 0) {
        // console.warn(renderPlanetVisual: Target canvas ${targetCanvas.id} has zero dimensions. Aborting worker call.);
        if (targetCanvas === designerPlanetCanvas) isRenderingDesignerPlanet = false;
        if (targetCanvas === planetVisualCanvas) isRenderingVisualPlanet = false;
        return;
    }

    // console.log("renderPlanetVisual called for:", targetCanvas.id, "with dims:", targetCanvas.width, "x", targetCanvas.height);
	// Ensure that we clone planetData if it is from the session state
	const pD = { ...planetData }; // Clone to avoid modifying original object if it's from state

    if (!pD.continentSeed) pD.continentSeed = Math.random();
    if (!pD.waterColor) { /* Default color logic */
        pD.waterColor = '#000080'; pD.landColor = '#006400';
    }
    pD.minTerrainHeight = pD.minTerrainHeight ?? DEFAULT_MIN_TERRAIN_HEIGHT;
    pD.maxTerrainHeight = pD.maxTerrainHeight ?? DEFAULT_MAX_TERRAIN_HEIGHT;
    pD.oceanHeightLevel = pD.oceanHeightLevel ?? DEFAULT_OCEAN_HEIGHT_LEVEL;

    const dataToSend = {
        waterColor: pD.waterColor, landColor: pD.landColor, continentSeed: pD.continentSeed,
        minTerrainHeight: pD.minTerrainHeight, maxTerrainHeight: pD.maxTerrainHeight, oceanHeightLevel: pD.oceanHeightLevel,
    };
    const canvasId = targetCanvas.id;
    const workerToUse = targetCanvas === planetVisualCanvas ? planetVisualWorker : designerWorker;

    if (workerToUse) {
        workerToUse.postMessage({
            cmd: 'renderPlanet', planetData: dataToSend, rotationQuaternion,
            canvasWidth: targetCanvas.width, canvasHeight: targetCanvas.height, senderId: canvasId
        });
    }
}
  
  function switchToSolarSystemView(solarSystemId) { /* ... (Major parts unchanged, ensure generatePlanetInstanceFromBasis is used) ... */
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

    let currentSunSize = SUN_ICON_SIZE;
    if (solarSystemObject && typeof solarSystemObject.sunSizeFactor === 'number') {
      currentSunSize = SUN_ICON_SIZE * solarSystemObject.sunSizeFactor;
    }
    currentSunSize = Math.max(currentSunSize, 15);
    const sunEl = document.createElement('div');
    sunEl.className = 'sun-icon sun-animated';
    sunEl.style.width = `${currentSunSize}px`; sunEl.style.height = `${currentSunSize}px`;
    const coreColor=FIXED_COLORS.sunFill,midColor=FIXED_COLORS.sunBorder,edgeColor=adjustColor(FIXED_COLORS.sunBorder,-40),actualBorderColor=FIXED_COLORS.sunBorder;
    sunEl.style.setProperty('--sun-core-color',coreColor); sunEl.style.setProperty('--sun-mid-color',midColor); sunEl.style.setProperty('--sun-edge-color',edgeColor); sunEl.style.setProperty('--sun-actual-border-color',actualBorderColor);
    solarSystemContent.appendChild(sunEl);

    solarSystemOrbitCanvasEl = document.createElement('canvas');
    solarSystemOrbitCanvasEl.id = 'solar-system-orbit-canvas';
    solarSystemOrbitCanvasEl.width = ORBIT_CANVAS_SIZE; solarSystemOrbitCanvasEl.height = ORBIT_CANVAS_SIZE;
    solarSystemContent.appendChild(solarSystemOrbitCanvasEl);
    orbitCtx = solarSystemOrbitCanvasEl.getContext('2d');
    gameSessionData.solarSystemView.planets = [];
    let usedDistances = [];
    const numPlanets = Math.floor(Math.random() * (currentMaxPlanets - currentMinPlanets + 1)) + currentMinPlanets;

    for (let i = 0; i < numPlanets; i++) {
      const planetSize = Math.random() * (MAX_PLANET_SIZE - MIN_PLANET_SIZE) + MIN_PLANET_SIZE;
      let planetDistance, attemptCount = 0;
      do { /* Orbit placement logic */
        planetDistance = Math.floor(Math.random()*(MAX_PLANET_DISTANCE-MIN_PLANET_DISTANCE+1))+MIN_PLANET_DISTANCE;
        let tooClose=false; for(const d of usedDistances){if(Math.abs(planetDistance-d.distance)<(MIN_ORBITAL_SEPARATION+(d.size+planetSize)/2)){tooClose=true;break;}}
        if(!tooClose)break;attemptCount++;
      } while (attemptCount < 200);
      if (attemptCount === 200) continue;
      usedDistances.push({distance: planetDistance, size: planetSize});


      if (gameSessionData.customPlanetDesigns.length === 0) {
        // Create a default design "basis" on the fly if none exist
        const defaultBasis = { 
            waterColor: '#0077be', landColor: '#3A5F0B', continentSeed: Math.random(),
            minTerrainHeightRange: [0, 1], maxTerrainHeightRange: [5, 8], oceanHeightRange: [1, 3]
        };
        const newPlanetData = generatePlanetInstanceFromBasis(defaultBasis);
        // ... create planet with newPlanetData (code below)
      } else {
          const basis = gameSessionData.customPlanetDesigns[Math.floor(Math.random() * gameSessionData.customPlanetDesigns.length)];
          const newPlanetData = generatePlanetInstanceFromBasis(basis); // USE THE NEW FUNCTION
          // ... create planet with newPlanetData (code below)
      }
      // Common planet creation part
      // (This part must be inside the loop, after newPlanetData is determined either from default or custom)
      const basisToUse = (gameSessionData.customPlanetDesigns.length > 0) 
          ? gameSessionData.customPlanetDesigns[Math.floor(Math.random() * gameSessionData.customPlanetDesigns.length)]
          : { waterColor: '#0077be', landColor: '#3A5F0B', continentSeed: Math.random(),
              minTerrainHeightRange: [0, 1], maxTerrainHeightRange: [5, 8], oceanHeightRange: [1, 3] };
      const newPlanetData = generatePlanetInstanceFromBasis(basisToUse);


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
        sourceDesignId: basisToUse.designId // Store if it came from a saved design
      };
      gameSessionData.solarSystemView.planets.push(newPlanet);
      const planetEl=document.createElement('div'); planetEl.className='planet-icon';
      planetEl.style.width=`${newPlanet.size}px`; planetEl.style.height=`${newPlanet.size}px`;
      const rp=15+Math.random()*40,rs=20+Math.random()*30;
      let bS=`radial-gradient(circle at ${rp}% ${rp}%, ${newPlanet.landColor} ${rs}%, transparent ${rs+20}%), ${newPlanet.waterColor}`;
      if(Math.random()<0.5){const rp2=15+Math.random()*40,rs2=20+Math.random()*30;bS=`radial-gradient(circle at ${90-rp2}% ${90-rp2}% , ${newPlanet.landColor} ${rs2}%, transparent ${rs2+20}%), `+bS;}
      planetEl.style.background=bS; planetEl.style.boxShadow=`0 0 ${newPlanet.size/3}px rgba(255,255,255,0.3)`;
      planetEl.addEventListener('click',(e)=>{e.stopPropagation();const wPV=planetVisualPanel.classList.contains('visible');currentPlanetDisplayedInPanel=newPlanet;planetVisualTitle.textContent=newPlanet.planetName;planetVisualSize.textContent=Math.round(newPlanet.size);planetVisualPanel.classList.add('visible');if(!wPV){planetVisualPanel.style.left='50%';planetVisualPanel.style.top='50%';planetVisualPanel.style.transform='translate(-50%, -50%)';planetVisualPanel.style.transition='';}else{planetVisualPanel.style.transition='none';}planetVisualRotationQuat=quat_identity();isRenderingVisualPlanet=false;renderPlanetVisual(newPlanet,planetVisualRotationQuat,planetVisualCanvas);});
      solarSystemContent.appendChild(planetEl);newPlanet.element=planetEl;
    }

    if(planetVisualWorker&&gameSessionData.solarSystemView.planets){gameSessionData.solarSystemView.planets.forEach(pTP=>{const pD={waterColor:pTP.waterColor,landColor:pTP.landColor,continentSeed:pTP.continentSeed,minTerrainHeight:pTP.minTerrainHeight,maxTerrainHeight:pTP.maxTerrainHeight,oceanHeightLevel:pTP.oceanHeightLevel,};planetVisualWorker.postMessage({cmd:'preloadPlanet',planetData:pD,rotationQuaternion:quat_identity(),canvasWidth:planetVisualCanvas?.width||200,canvasHeight:planetVisualCanvas?.height||200,senderId:`preload-${pTP.id}`});});}
    if(solarSystemTitleText){solarSystemTitleText.textContent=(solarSystemObject&&solarSystemObject.customName)?solarSystemObject.customName:`System ${solarSystemId.substring(solarSystemId.lastIndexOf('-')+1)}`;}
    if(solarSystemTitleInput)solarSystemTitleInput.style.display='none';
    setActiveScreen(solarSystemScreen);
    makeTitleEditable(solarSystemTitleText,solarSystemTitleInput,(nN)=>{if(solarSystemObject){solarSystemObject.customName=nN||null;saveGameState();renderGalaxyDetailScreen();return solarSystemObject.customName||`System ${solarSystemId.substring(solarSystemId.lastIndexOf('-')+1)}`;}return`System ${solarSystemId.substring(solarSystemId.lastIndexOf('-')+1)}`;});
    renderSolarSystemScreen(false);startSolarSystemAnimation();
  }
  function animateSolarSystem(now) { /* ... ( unchanged) ... */ if(!now)now=performance.now();if(lastAnimationTime===null)lastAnimationTime=now;const dT=(now-lastAnimationTime)/1000;lastAnimationTime=now;const aSV=gameSessionData.solarSystemView;if(aSV&&solarSystemScreen.classList.contains('active')&&aSV.planets){aSV.planets.forEach(p=>{p.currentOrbitalAngle+=p.orbitalSpeed*6*dT;p.currentAxialAngle+=p.axialSpeed*60*dT;const pMOX=p.distance*Math.cos(p.currentOrbitalAngle);const pMOY=p.distance*Math.sin(p.currentOrbitalAngle);p.element.style.left=`calc(50% + ${pMOX}px)`;p.element.style.top=`calc(50% + ${pMOY}px)`;p.element.style.transform=`translate(-50%, -50%) rotate(${p.currentAxialAngle}rad)`;});animationFrameId=requestAnimationFrame(animateSolarSystem);}else{if(animationFrameId){cancelAnimationFrame(animationFrameId);animationFrameId=null;}lastAnimationTime=null;}}
  function startSolarSystemAnimation() { /* ... ( unchanged) ... */ if(!animationFrameId&&solarSystemScreen.classList.contains('active')){lastAnimationTime=null;animateSolarSystem();}}
  function clampSolarSystemPan(dO, vW, vH) { /* ... ( unchanged) ... */ if(!dO||!vW||!vH){if(dO){dO.currentPanX=0;dO.currentPanY=0;}return;}const zm=dO.zoomLevel;const cW=SOLAR_SYSTEM_EXPLORABLE_RADIUS*2;const cH=SOLAR_SYSTEM_EXPLORABLE_RADIUS*2;const sCW=cW*zm;const sCH=cH*zm;const mPX=Math.max(0,(sCW-vW)/2);const mPY=Math.max(0,(sCH-vH)/2);dO.currentPanX=Math.max(-mPX,Math.min(mPX,dO.currentPanX));dO.currentPanY=Math.max(-mPY,Math.min(mPY,dO.currentPanY));}
  function clampGalaxyPan(galaxy) { /* ... ( unchanged) ... */ if(!galaxy||!galaxyViewport)return;const vW=galaxyViewport.offsetWidth;const vH=galaxyViewport.offsetHeight;const zm=galaxy.currentZoom;if(zm<=GALAXY_VIEW_MIN_ZOOM){galaxy.currentPanX=0;galaxy.currentPanY=0;}else{const pLX=(vW*zm-vW)/2;const pLY=(vH*zm-vH)/2;galaxy.currentPanX=Math.max(-pLX,Math.min(pLX,galaxy.currentPanX));galaxy.currentPanY=Math.max(-pLY,Math.min(pLY,galaxy.currentPanY));}}
  function handleZoom(direction, mouseEvent = null) { /* ... ( unchanged) ... */ let tD,vE,cCF,cRF,hMZ,hMX,cZP,cPXP,cPYP,iSV=false;if(galaxyDetailScreen.classList.contains('active')){const g=gameSessionData.galaxies.find(gl=>gl.id===gameSessionData.activeGalaxyId);if(!g)return;tD=g;vE=galaxyViewport;cCF=clampGalaxyPan;cRF=renderGalaxyDetailScreen;hMZ=GALAXY_VIEW_MIN_ZOOM;hMX=GALAXY_VIEW_MAX_ZOOM;cZP='currentZoom';cPXP='currentPanX';cPYP='currentPanY';}else if(solarSystemScreen.classList.contains('active')){iSV=true;tD=gameSessionData.solarSystemView;vE=solarSystemScreen;cCF=clampSolarSystemPan;cRF=renderSolarSystemScreen;hMZ=SOLAR_SYSTEM_VIEW_MIN_ZOOM;hMX=SOLAR_SYSTEM_VIEW_MAX_ZOOM;cZP='zoomLevel';cPXP='currentPanX';cPYP='currentPanY';}else return;const oZ=tD[cZP];let nCZ=oZ+(direction==='in'?(ZOOM_STEP*oZ):-(ZOOM_STEP*oZ));let fMZFC=hMZ;if(iSV){const vW=vE.offsetWidth;const vH=vE.offsetHeight;let dMZBOE=0;if(SOLAR_SYSTEM_EXPLORABLE_RADIUS>0&&(vW>0||vH>0)){const mZTCW=vW>0?vW/(SOLAR_SYSTEM_EXPLORABLE_RADIUS*2):0;const mZTCH=vH>0?vH/(SOLAR_SYSTEM_EXPLORABLE_RADIUS*2):0;dMZBOE=Math.max(mZTCW,mZTCH);}fMZFC=Math.max(hMZ,dMZBOE);}nCZ=Math.max(fMZFC,Math.min(hMX,nCZ));if(Math.abs(oZ-nCZ)<0.0001)return;tD[cZP]=nCZ;if(mouseEvent){const r=vE.getBoundingClientRect();const mXIV=mouseEvent.clientX-r.left;const mYIV=mouseEvent.clientY-r.top;const vCX=vE.offsetWidth/2;const vCY=vE.offsetHeight/2;const mXRTC=mXIV-vCX;const mYRTC=mYIV-vCY;const cPX=tD[cPXP]||0;const cPY=tD[cPYP]||0;const wX=(mXRTC-cPX)/oZ;const wY=(mYRTC-cPY)/oZ;tD[cPXP]=mXRTC-(wX*nCZ);tD[cPYP]=mYRTC-(wY*nCZ);}if(iSV){cCF(tD,vE.offsetWidth,vE.offsetHeight);cRF(true);startSolarSystemAnimation();drawAllOrbits();}else{cCF(tD);cRF(true);}}
  function startPan(event, vE, cE, dORef) { /* ... ( unchanged) ... */ if(event.button!==0||event.target.closest('button'))return;if(vE===galaxyViewport&&(event.target.classList.contains('solar-system-icon')||event.target.closest('.solar-system-icon')))return;const pS=gameSessionData.panning;pS.isActive=true;pS.startX=event.clientX;pS.startY=event.clientY;pS.initialPanX=dORef.currentPanX||0;pS.initialPanY=dORef.currentPanY||0;pS.targetElement=cE;pS.viewportElement=vE;pS.dataObject=dORef;vE.classList.add('dragging');if(cE)cE.style.transition='none';event.preventDefault()}
  function panMouseMove(event) { /* ... ( unchanged) ... */ if(!gameSessionData.panning.isActive)return;const pS=gameSessionData.panning,dX=event.clientX-pS.startX,dY=event.clientY-pS.startY;pS.dataObject.currentPanX=pS.initialPanX+dX;pS.dataObject.currentPanY=pS.initialPanY+dY;if(pS.viewportElement===galaxyViewport){clampGalaxyPan(pS.dataObject);renderGalaxyDetailScreen(true)}else if(pS.viewportElement===solarSystemScreen){clampSolarSystemPan(pS.dataObject,pS.viewportElement.offsetWidth,pS.viewportElement.offsetHeight);renderSolarSystemScreen(true);}}
  function panMouseUp() { /* ... ( unchanged) ... */ if(!gameSessionData.panning.isActive)return;if(gameSessionData.panning.viewportElement)gameSessionData.panning.viewportElement.classList.remove('dragging');const pS=gameSessionData.panning;pS.isActive=false;if(pS.targetElement)pS.targetElement.style.transition='';if(galaxyDetailScreen.classList.contains('active'))renderGalaxyDetailScreen(false);else if(solarSystemScreen.classList.contains('active'))renderSolarSystemScreen(false);pS.targetElement=null;pS.viewportElement=null;pS.dataObject=null;}
  function regenerateCurrentUniverseState(fM=false) { /* ... ( unchanged) ... */ if(!fM&&!confirm("Regenerate universe with current settings? This will clear the currently saved layout."))return;localStorage.removeItem('galaxyGameSaveData');gameSessionData.universe={diameter:null};gameSessionData.galaxies=[];gameSessionData.activeGalaxyId=null;gameSessionData.activeSolarSystemId=null;gameSessionData.solarSystemView={zoomLevel:1.0,currentPanX:0,currentPanY:0,planets:[],systemId:null};gameSessionData.isInitialized=false;if(universeCircle)universeCircle.innerHTML='';if(galaxyZoomContent){const c=galaxyZoomContent.querySelector('#solar-system-lines-canvas');galaxyZoomContent.innerHTML='';if(c)galaxyZoomContent.appendChild(c);}if(solarSystemContent)solarSystemContent.innerHTML='';if(orbitCtx&&solarSystemOrbitCanvasEl)orbitCtx.clearRect(0,0,solarSystemOrbitCanvasEl.width,solarSystemOrbitCanvasEl.height);if(animationFrameId){cancelAnimationFrame(animationFrameId);animationFrameId=null;}lastAnimationTime=null;initializeGame(true);}
  
  if (regenerateUniverseButton) regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(false));
  if (customizeGenerationButton) customizeGenerationButton.addEventListener('click', () => { numGalaxiesInput.value=currentNumGalaxies;minSSInput.value=currentMinSSCount;maxSSInput.value=currentMaxSSCount;ssSpreadInput.value=currentMaxPlanetDistanceMultiplier.toFixed(1);minPlanetsInput.value=currentMinPlanets;maxPlanetsInput.value=currentMaxPlanets;showOrbitsInput.checked=currentShowPlanetOrbits;customizationModal.classList.add('visible');});
  if (cancelCustomizationButton) cancelCustomizationButton.addEventListener('click', () => { customizationModal.classList.remove('visible'); });
  if (applyCustomizationButton) applyCustomizationButton.addEventListener('click', () => {const nG=parseInt(numGalaxiesInput.value,10);const mSS=parseInt(minSSInput.value,10);const mxSS=parseInt(maxSSInput.value,10);const sp=parseFloat(ssSpreadInput.value);const mP=parseInt(minPlanetsInput.value,10);const mxP=parseInt(maxPlanetsInput.value,10);if(isNaN(nG)||nG<1||nG>100||isNaN(mSS)||mSS<1||mSS>1000||isNaN(mxSS)||mxSS<1||mxSS>2000||mxSS<mSS||isNaN(sp)||sp<0.1||sp>5.0||isNaN(mP)||mP<0||mP>20||isNaN(mxP)||mxP<mP||mxP>20){alert("Invalid input values. Please check ranges and ensure Max >= Min.");return;}currentNumGalaxies=nG;currentMinSSCount=mSS;currentMaxSSCount=mxSS;currentMaxPlanetDistanceMultiplier=sp;currentMinPlanets=mP;currentMaxPlanets=mxP;currentShowPlanetOrbits=showOrbitsInput.checked;updateDerivedConstants();saveCustomizationSettings();customizationModal.classList.remove('visible');regenerateCurrentUniverseState(true);});
  if (closePlanetVisualPanelBtn) closePlanetVisualPanelBtn.addEventListener('click', () => { planetVisualPanel.classList.remove('visible'); currentPlanetDisplayedInPanel = null; });
  
  let isPanelDragging = false; let visualPanelOffset = { x: 0, y: 0 };
  if (planetVisualPanelHeader) planetVisualPanelHeader.addEventListener('mousedown', (e) => {if(e.button!==0)return;isPanelDragging=true;planetVisualPanel.classList.add('dragging');planetVisualPanel.style.transition='none';const r=planetVisualPanel.getBoundingClientRect();visualPanelOffset.x=e.clientX-r.left;visualPanelOffset.y=e.clientY-r.top;planetVisualPanel.style.left=`${e.clientX-visualPanelOffset.x}px`;planetVisualPanel.style.top=`${e.clientY-visualPanelOffset.y}px`;planetVisualPanel.style.transform='none';planetVisualPanel.style.right='auto';planetVisualPanel.style.bottom='auto';e.preventDefault();});
  
  planetVisualCanvas.addEventListener('mousedown', (e) => {if(e.button!==0||!currentPlanetDisplayedInPanel)return;isDraggingPlanetVisual=true;startDragMouseX=e.clientX;startDragMouseY=e.clientY;startDragPlanetVisualQuat=[...planetVisualRotationQuat];planetVisualCanvas.classList.add('dragging');e.preventDefault();});
  designerPlanetCanvas.addEventListener('mousedown', (e) => {if(e.button!==0)return;isDraggingDesignerPlanet=true;designerStartDragMouseX=e.clientX;designerStartDragMouseY=e.clientY;startDragDesignerPlanetQuat=[...designerPlanetRotationQuat];designerPlanetCanvas.classList.add('dragging');e.preventDefault();});

  window.addEventListener('mousemove', (e) => {
    if (isPanelDragging) {
      planetVisualPanel.style.left = `${e.clientX - visualPanelOffset.x}px`;
      planetVisualPanel.style.top = `${e.clientY - visualPanelOffset.y}px`;
    }
    if (isDraggingPlanetVisual && currentPlanetDisplayedInPanel && planetVisualPanel.classList.contains('visible')) {
      const rect=planetVisualCanvas.getBoundingClientRect(),cW=rect.width,cH=rect.height,dMX=e.clientX-startDragMouseX,dMY=e.clientY-startDragMouseY;
      const rAX=(dMY/cH)*Math.PI*PLANET_ROTATION_SENSITIVITY,rAY=(dMX/cW)*(2*Math.PI)*PLANET_ROTATION_SENSITIVITY;
      const iXQ=quat_from_axis_angle([1,0,0],-rAX),iYQ=quat_from_axis_angle([0,1,0],rAY);
      const cIQ=quat_multiply(iYQ,iXQ);
      planetVisualRotationQuat = quat_normalize(quat_multiply(cIQ, startDragPlanetVisualQuat));
      if (!isRenderingVisualPlanet) { isRenderingVisualPlanet = true; renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas); } 
      else { needsPlanetVisualRerender = true; }
    } else if (isDraggingDesignerPlanet) {
      const rect=designerPlanetCanvas.getBoundingClientRect(),cBFW=designerPlanetCanvas.width||rect.width,cBFH=designerPlanetCanvas.height||rect.height;
      if(cBFW===0||cBFH===0)return;
      const dMX=e.clientX-designerStartDragMouseX,dMY=e.clientY-designerStartDragMouseY;
      const rAX=(dMY/cBFH)*Math.PI*PLANET_ROTATION_SENSITIVITY,rAY=(dMX/cBFW)*(2*Math.PI)*PLANET_ROTATION_SENSITIVITY;
      const iXQ=quat_from_axis_angle([1,0,0],-rAX),iYQ=quat_from_axis_angle([0,1,0],rAY);
      const cIQ=quat_multiply(iYQ,iXQ);
      designerPlanetRotationQuat = quat_normalize(quat_multiply(cIQ, startDragDesignerPlanetQuat));
      if (!isRenderingDesignerPlanet && currentDesignerPlanetInstance) { isRenderingDesignerPlanet = true; renderDesignerPlanet(currentDesignerPlanetInstance, designerPlanetRotationQuat); }
    }
  });

  function applyPlanetPanelVisualRotation() { /* ... ( unchanged) ... */ const q=planetVisualRotationQuatTarget;const yS=q[2]*q[2];let t0=+2.0*(q[0]*q[1]+q[2]*q[3]);let t1=+1.0-2.0*(q[1]*q[1]+yS);let rX=Math.atan2(t0,t1);let t2=+2.0*(q[0]*q[2]-q[3]*q[1]);t2=t2>1?1:t2;t2=t2<-1?-1:t2;let pY=Math.asin(t2);planetVisualCanvas.style.transform=`rotateX(${pY*180/Math.PI}deg) rotateY(${rX*180/Math.PI}deg)`;}
  
  window.addEventListener('mouseup', () => {
    if (isPanelDragging) { isPanelDragging = false; planetVisualPanel.classList.remove('dragging'); planetVisualPanel.style.transition = ''; }
    if (isDraggingPlanetVisual) { isDraggingPlanetVisual = false; planetVisualCanvas.classList.remove('dragging'); }
    if (isDraggingDesignerPlanet) { isDraggingDesignerPlanet = false; designerPlanetCanvas.classList.remove('dragging'); }
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
      preGenerateAllGalaxyContents();
      if (gameSessionData.galaxies.every(g => g.layoutGenerated)) { saveGameState(); }
    }
    gameSessionData.isInitialized = true;
  }

  window.addEventListener('resize', () => {
    const cSBRI = document.querySelector('.screen.active')?.id;
    localStorage.removeItem('galaxyGameSaveData'); 
    gameSessionData.universe={diameter:null};gameSessionData.galaxies=[];gameSessionData.activeGalaxyId=null;gameSessionData.activeSolarSystemId=null;gameSessionData.solarSystemView={zoomLevel:1.0,currentPanX:0,currentPanY:0,planets:[],systemId:null};gameSessionData.isInitialized=false;
    if(universeCircle)universeCircle.innerHTML='';if(galaxyZoomContent){const c=galaxyZoomContent.querySelector('#solar-system-lines-canvas');galaxyZoomContent.innerHTML='';if(c)galaxyZoomContent.appendChild(c);}if(solarSystemContent)solarSystemContent.innerHTML='';if(orbitCtx&&solarSystemOrbitCanvasEl)orbitCtx.clearRect(0,0,solarSystemOrbitCanvasEl.width,solarSystemOrbitCanvasEl.height);if(animationFrameId){cancelAnimationFrame(animationFrameId);animationFrameId=null;}lastAnimationTime=null;
    loadCustomizationSettings();
    initializeGame(true);
    const sTA = document.getElementById(cSBRI) || mainScreen;
    setActiveScreen(sTA);
    if (sTA === planetDesignerScreen) { // If designer was active, re-trigger its setup
        switchToPlanetDesignerScreen(); // This will handle rAF for rendering
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
  if (galaxyViewport) { /* ... (galaxy specific panning logic - unchanged) ... */ 
    galaxyViewport.addEventListener('click', function (event) {
        if (gameSessionData.panning.isActive && !event.target.closest('.solar-system-icon')) { return; }
        const ssIcon = event.target.closest('.solar-system-icon');
        if (ssIcon) { const ssId = ssIcon.dataset.solarSystemId; if (ssId) { switchToSolarSystemView(ssId); event.stopPropagation();}}
    });
    let isGalaxyPanningSpecific = false; let galaxyPanStartSpecific = { x: 0, y: 0 }; let galaxyLastPanSpecific = { x: 0, y: 0 };
    galaxyViewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !galaxyDetailScreen.classList.contains('active') || e.target.closest('.solar-system-icon') || e.target.closest('button')) return;
        if (gameSessionData.panning.isActive) return; 
        isGalaxyPanningSpecific = true; galaxyPanStartSpecific.x = e.clientX; galaxyPanStartSpecific.y = e.clientY;
        const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
        galaxyLastPanSpecific.x = gal?.currentPanX || 0; galaxyLastPanSpecific.y = gal?.currentPanY || 0;
        galaxyViewport.classList.add('dragging'); if (galaxyZoomContent) galaxyZoomContent.style.transition = 'none';
        e.preventDefault();
    });
    const galaxyMouseMoveHandler = (e) => {
        if (!isGalaxyPanningSpecific) return; const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId); if (!gal) return;
        const dx = e.clientX - galaxyPanStartSpecific.x; const dy = e.clientY - galaxyPanStartSpecific.y;
        gal.currentPanX = galaxyLastPanSpecific.x + dx; gal.currentPanY = galaxyLastPanSpecific.y + dy;
        if (typeof clampGalaxyPan === 'function') { clampGalaxyPan(gal); }
        renderGalaxyDetailScreen(true);
    };
    window.addEventListener('mousemove', galaxyMouseMoveHandler);
    const galaxyMouseUpHandler = (e) => {
        if (isGalaxyPanningSpecific) { isGalaxyPanningSpecific = false; galaxyViewport.classList.remove('dragging'); if (galaxyZoomContent) galaxyZoomContent.style.transition = ''; renderGalaxyDetailScreen(false); }
    };
    window.addEventListener('mouseup', galaxyMouseUpHandler);
  }
  
  initializeGame();
});
