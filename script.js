document.addEventListener('DOMContentLoaded', () => {
    // Define constants FIRST, so functions defined below can access them
    const DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
    const DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
    const DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;
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

    // Get DOM elements
    const mainScreen = document.getElementById('main-screen');
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

    // --- FUNCTION DEFINITIONS ---

    /**
     * Generates a planet instance based on a provided basis object.
     * If isForDesignerPreview is true, the continentSeed will be preserved if already set.
     * @param {object} basis - The base properties for the planet.
     * @param {boolean} isForDesignerPreview - If true, reuses continentSeed for consistent preview.
     * @returns {object} A complete planet instance with interpolated values.
     */
    function generatePlanetInstanceFromBasis(basis, isForDesignerPreview = false) {
        // Helper to get a random number within a range.
        const getValueFromRange = (range, defaultValue, defaultSpread = 1.0) => {
            if (Array.isArray(range) && range.length === 2 && typeof range[0] === 'number' && typeof range[1] === 'number') {
                const min = Math.min(range[0], range[1]);
                const max = Math.max(range[0], range[1]);
                if (min === max) return min;
                return min + Math.random() * (max - min);
            }
            if (typeof range === 'number') return range; // Fallback for old format / forced single values
            // If completely undefined or not a valid range array, use default with a bit of spread
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
            minTerrainHeight: getValueFromRange(basis.minTerrainHeightRange, DEFAULT_MIN_TERRAIN_HEIGHT, 1.0),
            maxTerrainHeight: getValueFromRange(basis.maxTerrainHeightRange, DEFAULT_MAX_TERRAIN_HEIGHT, 2.0),
            oceanHeightLevel: getValueFromRange(basis.oceanHeightRange, DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0)
        };
    }

    function resizeDesignerCanvasToDisplaySize() {
        const canvas = designerPlanetCanvas;
        if (!canvas) {
            console.warn("resizeDesignerCanvasToDisplaySize: designerPlanetCanvas not found.");
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
    let MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0; // Initial value, updated by updateDerivedConstants
    let MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER; // Initial, updated by updateDerivedConstants
    let ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
    let SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2;
    const MIN_ORBITAL_SEPARATION = 20;
    let MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.005;
    let MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.01;
    const FIXED_COLORS = { universeBg: "#100520", galaxyIconFill: "#7f00ff", galaxyIconBorder: "#da70d6", solarSystemBaseColor: "#ffd700", sunFill: "#FFD700", sunBorder: "#FFA500", connectionLine: "rgba(255, 255, 255, 0.3)" };
    let gameSessionData = {
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
    let designerWorker = null;

    if (window.Worker) {
        try {
            planetVisualWorker = new Worker('planetRendererWorker.js');
            designerWorker = new Worker('planetRendererWorker.js');

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

            designerWorker.onmessage = function(e) {
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
        console.warn("Web Workers not supported in this browser. Planet rendering will be limited or disabled.");
    }

    // --- MATH HELPER FUNCTIONS (formerly malformed) ---
    function quat_identity() { return [1, 0, 0, 0]; }
    function quat_from_axis_angle(axis, angle) {
        const hA = angle * 0.5;
        const s = Math.sin(hA);
        return [Math.cos(hA), axis[0] * s, axis[1] * s, axis[2] * s];
    }
    function quat_multiply(q1, q2) {
        const w1 = q1[0], x1 = q1[1], y1 = q1[2], z1 = q1[3];
        const w2 = q2[0], x2 = q2[1], y2 = q2[1], z2 = q2[3]; // Fixed accidental reuse of y2
        return [
            w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
            w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
            w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
            w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2
        ];
    }
    function quat_normalize(q) {
        let l = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
        if (l === 0) return [1, 0, 0, 0];
        l = 1 / Math.sqrt(l);
        return [q[0] * l, q[1] * l, q[2] * l, q[3] * l];
    }
    // --- END MATH HELPER FUNCTIONS ---

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

        // Ensure logical ranges
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
            console.warn(`renderDesignerPlanet: Designer canvas has 0 dimensions. Aborting render.`);
            isRenderingDesignerPlanet = false; // Reset rendering flag
            // Request a resize and re-render on the next frame, as offsetWidth/Height might be available then
            requestAnimationFrame(() => {
                resizeDesignerCanvasToDisplaySize();
                if (designerPlanetCanvas.width > 0 && designerPlanetCanvas.height > 0 && currentDesignerPlanetInstance) {
                    renderDesignerPlanet(currentDesignerPlanetInstance, designerPlanetRotationQuat); // Re-call self to try again
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

        let minB = 0.0, maxB = 2.0;
        let minH_min_rand = parseFloat((Math.random() * (maxB - minB) + minB).toFixed(1));
        let minH_max_rand = parseFloat((minH_min_rand + Math.random() * 2.0 + 0.1).toFixed(1));

        let oceanB = minH_max_rand;
        let oceanH_min_rand = parseFloat((oceanB + Math.random() * 1.5 + 0.1).toFixed(1));
        let oceanH_max_rand = parseFloat((oceanH_min_rand + Math.random() * 2.5 + 0.1).toFixed(1));

        let maxBH = oceanH_max_rand;
        let maxH_min_rand = parseFloat((maxBH + Math.random() * 2.0 + 0.1).toFixed(1));
        let maxH_max_rand = parseFloat((maxH_min_rand + Math.random() * 5.0 + 0.5).toFixed(1));

        currentDesignerBasis.minTerrainHeightRange = [minH_min_rand, minH_max_rand];
        currentDesignerBasis.maxTerrainHeightRange = [maxH_min_rand, maxH_max_rand];
        currentDesignerBasis.oceanHeightRange = [oceanH_min_rand, oceanH_max_rand];

        populateDesignerInputsFromBasis();
        generateAndRenderDesignerPreviewInstance(true);
    }

    function saveCustomPlanetDesign() {
        updateBasisAndRefreshDesignerPreview(); // Ensure current inputs are in basis

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
            // Styles moved to CSS
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

    // Helper functions for game state and customization
    function updateDerivedConstants() {
        MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier;
        MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0 * (currentMaxPlanetDistanceMultiplier > 0.5 ? currentMaxPlanetDistanceMultiplier * 0.8 : 0.5);
        ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
        SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2;
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

                // Ensure planets ranges don't cause issues if loaded from older saves
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

    function saveGameState() {
        try {
            const sTS = {
                universeDiameter: gameSessionData.universe.diameter,
                galaxies: gameSessionData.galaxies,
                customPlanetDesigns: gameSessionData.customPlanetDesigns
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
                    gameSessionData.universe.diameter = loadedState.universeDiameter;
                    gameSessionData.galaxies = loadedState.galaxies;
                    // Migrate and ensure default properties for loaded galaxies/systems
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
                        gal.layoutGenerated = gal.layoutGenerated || false; // Ensure this is set
                    });

                    // Migrate and ensure default properties for loaded custom planet designs
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
                        delete migratedDesign.minTerrainHeight; // Clean up old properties
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

    // Geometry and Generation Helper Functions (corrected syntax)
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

    function setActiveScreen(screenToShow) {
        [mainScreen, galaxyDetailScreen, solarSystemScreen, planetDesignerScreen].forEach(s => {
            if (s) s.classList.remove('active', 'panning-active');
        });
        if (screenToShow) { screenToShow.classList.add('active'); }
        if (zoomControlsElement) {
            if (screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen)
                zoomControlsElement.classList.add('visible');
            else
                zoomControlsElement.classList.remove('visible');
        }
        // Controls visibility
        if (regenerateUniverseButton) regenerateUniverseButton.style.display = 'block';
        if (customizeGenerationButton) customizeGenerationButton.style.display = 'block';
        if (createPlanetDesignButton) createPlanetDesignButton.style.display = 'block';

        // Specific overrides for panel/screen combinations
        if (screenToShow !== solarSystemScreen && planetVisualPanel) {
            planetVisualPanel.classList.remove('visible');
        }
        // Hide control buttons if not on main screens
        if (screenToShow === planetDesignerScreen || screenToShow === customizationModal) {
            if (regenerateUniverseButton) regenerateUniverseButton.style.display = 'none';
            if (customizeGenerationButton) customizeGenerationButton.style.display = 'none';
            if (createPlanetDesignButton) createPlanetDesignButton.style.display = 'none';
        }
    }

    function generateUniverseLayout() {
        const s = Math.min(window.innerWidth, window.innerHeight);
        gameSessionData.universe.diameter = Math.max(300, s * 0.85);
        if (universeCircle) {
            universeCircle.style.width = `${gameSessionData.universe.diameter}px`;
            universeCircle.style.height = `${gameSessionData.universe.diameter}px`;
            universeCircle.style.backgroundColor = FIXED_COLORS.universeBg;
        }
    }

    function generateGalaxies() {
        if (!gameSessionData.universe.diameter) return;
        gameSessionData.galaxies = [];
        const centerRadius = gameSessionData.universe.diameter / 2;
        const existingRects = [];
        for (let i = 0; i < currentNumGalaxies; i++) {
            const id = `galaxy-${i + 1}`;
            const pos = getNonOverlappingPositionInCircle(centerRadius, GALAXY_ICON_SIZE, existingRects);
            if (pos && !isNaN(pos.x) && !isNaN(pos.y)) {
                gameSessionData.galaxies.push({
                    id,
                    x: pos.x,
                    y: pos.y,
                    customName: null,
                    solarSystems: [],
                    lineConnections: [],
                    layoutGenerated: false,
                    currentZoom: 1.0,
                    currentPanX: 0,
                    currentPanY: 0,
                    generationParams: { densityFactor: 0.8 + Math.random() * 0.4 }
                });
                existingRects.push({ x: pos.x, y: pos.y, width: GALAXY_ICON_SIZE, height: GALAXY_ICON_SIZE });
            }
        }
    }

    function getDistance(s1, s2) { return Math.sqrt(Math.pow(s1.centerX - s2.centerX, 2) + Math.pow(s1.centerY - s2.centerY, 2)); }
    function tryAddConnection(fromId, toId, currentConnectionsArray, connectionCountObj, allSolarSystemsList, maxDistanceLimit) {
        if (!fromId || !toId || fromId === toId || fromId === null || toId === null) return false;
        if ((connectionCountObj[fromId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM || (connectionCountObj[toId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM) {
            return false;
        }
        const sortedKey = [fromId, toId].sort().join('-');
        if (currentConnectionsArray.some(c => ([c.fromId, c.toId].sort().join('-') === sortedKey))) {
            return false;
        }
        if (maxDistanceLimit !== undefined && maxDistanceLimit !== null) {
            const s1 = allSolarSystemsList.find(s => s.id === fromId);
            const s2 = allSolarSystemsList.find(s => s.id === toId);
            if (s1 && s2 && getDistance(s1, s2) > maxDistanceLimit) {
                return false;
            }
        }
        return true;
    }

    function generateSolarSystemsForGalaxy(galaxyId) {
        const g = gameSessionData.galaxies.find(gl => gl.id === galaxyId);
        if (!g || !galaxyViewport) { return; }
        if (g.layoutGenerated && !gameSessionData.isForceRegenerating) return;

        const viewportDim = galaxyViewport.offsetWidth > 0 ? galaxyViewport.offsetWidth : (gameSessionData.universe.diameter || 500);
        const viewportRadius = viewportDim / 2;

        if (viewportDim <= 0 || isNaN(viewportRadius) || viewportRadius <= 0) {
            // console.warn("Galaxy viewport has invalid dimensions, cannot generate solar systems yet.");
            g.layoutGenerated = true; // Mark as generated to avoid infinite loops if it never gains dimensions
            if (!gameSessionData.isForceRegenerating) saveGameState();
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
            if (!gameSessionData.isForceRegenerating) saveGameState();
            return;
        }

        // Add centerX/centerY for distance calculations dynamically for new systems
        const allSystemsCalc = g.solarSystems.map(ss => ({ ...ss, centerX: ss.x + ss.iconSize / 2, centerY: ss.y + ss.iconSize / 2 }));
        const systemConnectionCounts = {};
        const galaxyContentDiameter = viewportDim; // Use viewportDim for scale of the galaxy content
        const allowedMaxEuclideanConnectionDistance = galaxyContentDiameter * MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT;
        const allowedMaxForcedConnectionDistance = galaxyContentDiameter * MAX_FORCED_CONNECTION_DISTANCE_PERCENT;

        // Minimum Spanning Tree (MST) approach for initial connections to ensure connectivity
        let connectedSystems = new Set();
        let unconnectedSystems = new Set(allSystemsCalc.map(s => s.id));

        if (allSystemsCalc.length > 0) {
            const firstSystemId = allSystemsCalc[0].id;
            connectedSystems.add(firstSystemId);
            unconnectedSystems.delete(firstSystemId);

            while (unconnectedSystems.size > 0) {
                let bestConnection = null;
                let minConnectionDist = Infinity;

                for (const unconnectedId of unconnectedSystems) {
                    const currentUnconnected = allSystemsCalc.find(s => s.id === unconnectedId);
                    for (const connectedId of connectedSystems) {
                        const currentConnected = allSystemsCalc.find(s => s.id === connectedId);
                        const dist = getDistance(currentUnconnected, currentConnected);
                        if (dist < minConnectionDist) {
                            minConnectionDist = dist;
                            bestConnection = { fromId: connectedId, toId: unconnectedId, dist: dist };
                        }
                    }
                }

                if (bestConnection) {
                    const isValidPotentialConnection = tryAddConnection(
                        bestConnection.fromId,
                        bestConnection.toId,
                        g.lineConnections,
                        systemConnectionCounts,
                        allSystemsCalc,
                        allowedMaxEuclideanConnectionDistance
                    );

                    if (isValidPotentialConnection) {
                        g.lineConnections.push({ fromId: bestConnection.fromId, toId: bestConnection.toId });
                        systemConnectionCounts[bestConnection.fromId] = (systemConnectionCounts[bestConnection.fromId] || 0) + 1;
                        systemConnectionCounts[bestConnection.toId] = (systemConnectionCounts[bestConnection.toId] || 0) + 1;
                        connectedSystems.add(bestConnection.toId);
                        unconnectedSystems.delete(bestConnection.toId);
                    } else {
                        // If direct MST connection not allowed by distance or max connections, try to connect to any other
                        // connected system within a larger forced distance, prioritizing closer one
                        const targetUnconnectedId = bestConnection.toId;
                        const targetUnconnected = allSystemsCalc.find(s => s.id === targetUnconnectedId);
                        let forcedTargetId = null;
                        let minForcedDist = Infinity;

                        for (const connectedId of connectedSystems) {
                            const connectedSystem = allSystemsCalc.find(s => s.id === connectedId);
                            const dist = getDistance(targetUnconnected, connectedSystem);
                            const canForceConnect = tryAddConnection(
                                targetUnconnectedId,
                                connectedId,
                                g.lineConnections,
                                systemConnectionCounts,
                                allSystemsCalc,
                                allowedMaxForcedConnectionDistance // Use a larger forced distance
                            );

                            if (canForceConnect) {
                                if (dist < minForcedDist) {
                                    minForcedDist = dist;
                                    forcedTargetId = connectedId;
                                }
                            }
                        }

                        if (forcedTargetId) {
                            g.lineConnections.push({ fromId: targetUnconnectedId, toId: forcedTargetId });
                            systemConnectionCounts[targetUnconnectedId] = (systemConnectionCounts[targetUnconnectedId] || 0) + 1;
                            systemConnectionCounts[forcedTargetId] = (systemConnectionCounts[forcedTargetId] || 0) + 1;
                            connectedSystems.add(targetUnconnectedId);
                            unconnectedSystems.delete(targetUnconnectedId);
                        } else {
                            // As a last resort, if cannot connect to any existing system within reasonable parameters,
                            // pick the closest one regardless of distance, just to ensure it's connected initially.
                            // This might create long lines but guarantees all are reachable.
                            let ultimateForceTargetId = null;
                            let minUltimateDist = Infinity;
                            for(const connectedId of connectedSystems) {
                                const connectedSystem = allSystemsCalc.find(s => s.id === connectedId);
                                const dist = getDistance(targetUnconnected, connectedSystem);
                                if (tryAddConnection(targetUnconnectedId, connectedId, g.lineConnections, systemConnectionCounts, allSystemsCalc, null)) { // No max distance limit
                                     if(dist < minUltimateDist) {
                                        minUltimateDist = dist;
                                        ultimateForceTargetId = connectedId;
                                     }
                                }
                            }
                            if(ultimateForceTargetId) {
                                g.lineConnections.push({ fromId: targetUnconnectedId, toId: ultimateForceTargetId });
                                systemConnectionCounts[targetUnconnectedId] = (systemConnectionCounts[targetUnconnectedId] || 0) + 1;
                                systemConnectionCounts[ultimateForceTargetId] = (systemConnectionCounts[ultimateForceTargetId] || 0) + 1;
                                connectedSystems.add(targetUnconnectedId);
                                unconnectedSystems.delete(targetUnconnectedId);
                            } else {
                                // If a system literally cannot connect, remove it. (Shouldn't happen with current logic)
                                console.warn(`System ${targetUnconnectedId} could not be connected. Removing.`);
                                unconnectedSystems.delete(targetUnconnectedId);
                                g.solarSystems = g.solarSystems.filter(s => s.id !== targetUnconnectedId);
                            }
                        }
                    }
                } else {
                    // No best connection found, means unconnectedSystems might be empty or remaining are isolated
                    if (unconnectedSystems.size > 0 && connectedSystems.size === 0 && allSystemsCalc.length > 0) {
                        // This case means connectedSystems never got initialized, so connect the first available unconnected system
                        // This happens if allSystemsCalc was initially empty or somehow disconnected.
                        const nextUnconnectedId = Array.from(unconnectedSystems)[0];
                        connectedSystems.add(nextUnconnectedId);
                        unconnectedSystems.delete(nextUnconnectedId);
                    } else {
                        break; // Break if no more connections can be made
                    }
                }
            }
        }

        // Add additional connections up to MAX_CONNECTIONS_PER_SYSTEM
        allSystemsCalc.forEach(ss1 => {
            const desiredConnections = getWeightedNumberOfConnections();
            let currentConnections = systemConnectionCounts[ss1.id] || 0;
            let connectionsToAdd = Math.min(desiredConnections, MAX_CONNECTIONS_PER_SYSTEM - currentConnections);

            if (connectionsToAdd <= 0) return;

            let potentialTargets = allSystemsCalc
                .filter(ss2 => ss1.id !== ss2.id)
                .map(ss2 => ({ ...ss2, distance: getDistance(ss1, ss2) }))
                .sort((a, b) => a.distance - b.distance);

            // Prioritize closer connections up to a limit
            const nearbyPotentialTargets = potentialTargets.filter(ss2 => ss2.distance <= allowedMaxEuclideanConnectionDistance);
            const candidates = nearbyPotentialTargets.slice(0, MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS);

            for (const ss2 of candidates) {
                if (connectionsToAdd <= 0) break;
                const success = tryAddConnection(ss1.id, ss2.id, g.lineConnections, systemConnectionCounts, allSystemsCalc, allowedMaxEuclideanConnectionDistance);
                if (success) {
                    g.lineConnections.push({ fromId: ss1.id, toId: ss2.id });
                    systemConnectionCounts[ss1.id] = (systemConnectionCounts[ss1.id] || 0) + 1;
                    systemConnectionCounts[ss2.id] = (systemConnectionCounts[ss2.id] || 0) + 1;
                    connectionsToAdd--;
                }
            }
        });

        g.layoutGenerated = true;
        if (!gameSessionData.isForceRegenerating) { saveGameState(); }
    }

    async function preGenerateAllGalaxyContents() {
        gameSessionData.isForceRegenerating = true;
        for (const g of gameSessionData.galaxies) {
            // Only generate if not already generated, or if force regenerating
            if (!g.layoutGenerated || g.solarSystems.length === 0) {
                // Yield to event loop to keep UI responsive
                await new Promise(r => setTimeout(r, 0));
                generateSolarSystemsForGalaxy(g.id);
            }
        }
        gameSessionData.isForceRegenerating = false;
        saveGameState(); // Save state after all pre-generation is done
    }


    function renderMainScreen() {
        if (mainScreenTitleText) mainScreenTitleText.textContent = "Universe";
        if (!universeCircle) return;
        universeCircle.innerHTML = '';
        gameSessionData.galaxies.forEach(g => {
            const dId = g.id.split('-').pop();
            const el = document.createElement('div');
            el.className = 'galaxy-icon';
            el.style.width = `${GALAXY_ICON_SIZE}px`;
            el.style.height = `${GALAXY_ICON_SIZE}px`;
            el.style.left = `${g.x}px`;
            el.style.top = `${g.y}px`;
            el.style.backgroundColor = FIXED_COLORS.galaxyIconFill;
            el.style.border = `3px solid ${FIXED_COLORS.galaxyIconBorder}`;
            el.title = g.customName || `Galaxy ${dId}`;
            el.dataset.galaxyId = g.id;
            el.addEventListener('click', () => switchToGalaxyDetailView(g.id));
            universeCircle.appendChild(el);
        });
    }

    function drawGalaxyLines(galaxy) {
        if (!solarSystemLinesCanvasEl || !galaxyZoomContent) return;
        if (galaxyZoomContent.offsetWidth > 0 && solarSystemLinesCanvasEl.width !== galaxyZoomContent.offsetWidth) solarSystemLinesCanvasEl.width = galaxyZoomContent.offsetWidth;
        if (galaxyZoomContent.offsetHeight > 0 && solarSystemLinesCanvasEl.height !== galaxyZoomContent.offsetHeight) solarSystemLinesCanvasEl.height = galaxyZoomContent.offsetHeight;

        if (!linesCtx) linesCtx = solarSystemLinesCanvasEl.getContext('2d');
        if (!linesCtx) return;

        linesCtx.clearRect(0, 0, solarSystemLinesCanvasEl.width, solarSystemLinesCanvasEl.height);

        if (!galaxy || !galaxy.lineConnections || !galaxy.solarSystems) return;

        linesCtx.strokeStyle = FIXED_COLORS.connectionLine;
        linesCtx.lineWidth = 0.5;
        linesCtx.setLineDash([]); // Ensure no dashes

        const systemPositions = {};
        galaxy.solarSystems.forEach(ss => {
            systemPositions[ss.id] = { x: ss.x + ss.iconSize / 2, y: ss.y + ss.iconSize / 2 };
        });

        galaxy.lineConnections.forEach(c => {
            const fromPos = systemPositions[c.fromId];
            const toPos = systemPositions[c.toId];
            if (fromPos && toPos) {
                linesCtx.beginPath();
                linesCtx.moveTo(fromPos.x, fromPos.y);
                linesCtx.lineTo(toPos.x, toPos.y);
                linesCtx.stroke();
            }
        });
    }

    function renderGalaxyDetailScreen(isInteractive = false) {
        const g = gameSessionData.galaxies.find(gl => gl.id === gameSessionData.activeGalaxyId);
        if (!g) { switchToMainView(); return; }
        if (!galaxyViewport || !galaxyZoomContent) return;

        galaxyViewport.style.width = `${gameSessionData.universe.diameter || 500}px`;
        galaxyViewport.style.height = `${gameSessionData.universe.diameter || 500}px`;

        const icons = galaxyZoomContent.querySelectorAll('.solar-system-icon');
        icons.forEach(i => i.remove());

        const zoomScaleDivisor = 0.6; // Smaller divisor means icon scales more with zoom
        g.solarSystems.forEach(ss => {
            const solarSystemObject = ss;
            const el = document.createElement('div');
            el.className = 'solar-system-icon';
            const baseEffectiveZoom = 1 + (g.currentZoom - GALAXY_VIEW_MIN_ZOOM) * zoomScaleDivisor;
            let displayIconPx = ss.iconSize * baseEffectiveZoom;
            if (g.currentZoom > 0) {
                 displayIconPx = displayIconPx / g.currentZoom; // Counter-scale due to transform scale
            }
            displayIconPx = Math.max(2.5, displayIconPx); // Minimum size to remain identifiable

            el.style.width = `${displayIconPx}px`;
            el.style.height = `${displayIconPx}px`;

            const currentOffset = displayIconPx / 2;
            const baseCircleOffset = ss.iconSize / 2;
            el.style.left = `${ss.x + baseCircleOffset - currentOffset}px`;
            el.style.top = `${ss.y + baseCircleOffset - currentOffset}px`;
            el.dataset.solarSystemId = ss.id;
            if (solarSystemObject && solarSystemObject.customName) { el.title = solarSystemObject.customName; }

            el.addEventListener('click', e => { e.stopPropagation(); switchToSolarSystemView(ss.id) });
            galaxyZoomContent.appendChild(el);
        });

        if (solarSystemLinesCanvasEl.parentNode !== galaxyZoomContent || galaxyZoomContent.firstChild !== solarSystemLinesCanvasEl) {
            galaxyZoomContent.insertBefore(solarSystemLinesCanvasEl, galaxyZoomContent.firstChild);
        }
        drawGalaxyLines(g);

        galaxyZoomContent.style.transition = isInteractive ? 'none' : 'transform 0.1s ease-out';
        galaxyZoomContent.style.transform = `translate(${g.currentPanX}px,${g.currentPanY}px)scale(${g.currentZoom})`;

        if (galaxyDetailTitleText) {
            const dId = g.id.split('-').pop();
            galaxyDetailTitleText.textContent = g.customName || `Galaxy ${dId}`;
        }
    }

    function drawAllOrbits() {
        if (!orbitCtx || !solarSystemOrbitCanvasEl || !gameSessionData.solarSystemView.planets) return;
        orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);

        if (!currentShowPlanetOrbits && solarSystemOrbitCanvasEl) {
            solarSystemOrbitCanvasEl.style.display = 'none'; // Hide if orbits not shown
            return;
        } else if (solarSystemOrbitCanvasEl) {
            solarSystemOrbitCanvasEl.style.display = 'block';
        }

        const canvasCenterX = solarSystemOrbitCanvasEl.width / 2;
        const canvasCenterY = solarSystemOrbitCanvasEl.height / 2;

        gameSessionData.solarSystemView.planets.forEach(planetData => {
            const orbitalRadius = planetData.distance;
            orbitCtx.beginPath();
            orbitCtx.arc(canvasCenterX, canvasCenterY, orbitalRadius, 0, 2 * Math.PI);
            orbitCtx.strokeStyle = 'rgba(255,255,255,0.2)';
            orbitCtx.lineWidth = 1;
            orbitCtx.setLineDash([5, 5]);
            orbitCtx.stroke();
        });
        orbitCtx.setLineDash([]);
    }

    function renderSolarSystemScreen(isInteractive = false) {
        if (!solarSystemContent || !solarSystemScreen || !gameSessionData.activeSolarSystemId) { return; }

        // Ensure canvas is correctly sized for current ORBIT_CANVAS_SIZE
        if (solarSystemOrbitCanvasEl && (solarSystemOrbitCanvasEl.width !== ORBIT_CANVAS_SIZE || solarSystemOrbitCanvasEl.height !== ORBIT_CANVAS_SIZE)) {
            solarSystemOrbitCanvasEl.width = ORBIT_CANVAS_SIZE;
            solarSystemOrbitCanvasEl.height = ORBIT_CANVAS_SIZE;
        }

        const displayData = gameSessionData.solarSystemView;
        let pX = displayData.currentPanX || 0, pY = displayData.currentPanY || 0;
        let z = displayData.zoomLevel || SOLAR_SYSTEM_VIEW_MIN_ZOOM;

        solarSystemContent.style.transition = isInteractive ? 'none' : 'transform 0.1s ease-out';
        solarSystemContent.style.transform = `translate(${pX}px, ${pY}px) scale(${z})`;

        const galaxyIdMatch = gameSessionData.activeSolarSystemId.match(/^(galaxy-\d+)-ss-\d+$/);
        const galaxyPart = galaxyIdMatch ? galaxyIdMatch[1] : null;
        const activeGalaxy = galaxyPart ? gameSessionData.galaxies.find(g_find => g_find.id === galaxyPart) : null;
        let solarSystemObject = null;
        if (activeGalaxy && activeGalaxy.solarSystems) { solarSystemObject = activeGalaxy.solarSystems.find(ss_find => ss_find.id === displayData.systemId); }

        if (solarSystemTitleText) {
            const systemIdentifier = displayData.systemId ? displayData.systemId.substring(displayData.systemId.lastIndexOf('-') + 1) : 'N/A';
            solarSystemTitleText.textContent = (solarSystemObject && solarSystemObject.customName) ? solarSystemObject.customName : `System ${systemIdentifier}`;
        }

        // Draw orbits only if interactive or if animation isn't already running (to set initial state)
        if (isInteractive || !animationFrameId) { drawAllOrbits(); }
    }

    function switchToMainView() {
        gameSessionData.activeGalaxyId = null;
        gameSessionData.activeSolarSystemId = null;
        stopSolarSystemAnimation();
        setActiveScreen(mainScreen);
    }
    function makeTitleEditable(titleTextElement, inputElement, onSaveCallback) {
        if (!titleTextElement || !inputElement) return;
        titleTextElement.ondblclick = () => {
            titleTextElement.style.display = 'none';
            inputElement.style.display = 'inline-block';
            inputElement.value = titleTextElement.textContent;
            inputElement.focus();
            inputElement.select();
        };
        const saveName = () => {
            const newName = inputElement.value.trim();
            const defaultName = onSaveCallback(newName || null); // Callback handles saving to data, returns effective name
            titleTextElement.textContent = newName || defaultName; // Set text based on saved name or default
            inputElement.style.display = 'none';
            titleTextElement.style.display = 'inline-block';
        };
        inputElement.onblur = saveName;
        inputElement.onkeydown = (e) => {
            if (e.key === 'Enter') {
                inputElement.blur();
            } else if (e.key === 'Escape') {
                inputElement.value = titleTextElement.textContent; // Revert to current displayed name
                inputElement.blur();
            }
        };
    }

    function switchToGalaxyDetailView(galaxyId) {
        const g = gameSessionData.galaxies.find(gl => gl.id === galaxyId);
        if (!g) { switchToMainView(); return; }

        gameSessionData.activeGalaxyId = galaxyId;
        const dId = g.id.split('-').pop();

        if (backToGalaxyButton) { backToGalaxyButton.textContent = g.customName ? `← ${g.customName}` : `← Galaxy ${dId}`; }
        gameSessionData.activeSolarSystemId = null; // Clear active solar system when going back to galaxy view
        stopSolarSystemAnimation(); // Ensure solar system animation stops

        g.currentZoom = g.currentZoom || 1.0;
        g.currentPanX = g.currentPanX || 0;
        g.currentPanY = g.currentPanY || 0;

        if (galaxyDetailTitleText) { galaxyDetailTitleText.textContent = g.customName || `Galaxy ${dId}`; galaxyDetailTitleText.style.display = 'inline-block'; }
        if (galaxyDetailTitleInput) galaxyDetailTitleInput.style.display = 'none';

        setActiveScreen(galaxyDetailScreen);

        makeTitleEditable(galaxyDetailTitleText, galaxyDetailTitleInput, (newName) => {
            g.customName = newName || null;
            saveGameState();
            renderMainScreen(); // Re-render main screen to update galaxy name there
            return g.customName || `Galaxy ${dId}`;
        });

        if (galaxyViewport && gameSessionData.universe.diameter) {
            galaxyViewport.style.width = `${gameSessionData.universe.diameter}px`;
            galaxyViewport.style.height = `${gameSessionData.universe.diameter}px`;
        }

        if (!g.layoutGenerated) {
            // Wait for DOM to be ready and get correct dimensions for viewport before generating layout
            setTimeout(() => {
                function attemptLayoutGeneration(retriesLeft = 5) {
                    if (galaxyViewport && galaxyViewport.offsetWidth > 0 && galaxyViewport.offsetHeight > 0) {
                        generateSolarSystemsForGalaxy(galaxyId);
                        renderGalaxyDetailScreen(false);
                    } else if (retriesLeft > 0) {
                        requestAnimationFrame(() => attemptLayoutGeneration(retriesLeft - 1));
                    } else {
                        console.warn("Galaxy viewport never got dimensions for layout generation. Proceeding without layout.");
                        g.layoutGenerated = true; // Mark as generated to avoid infinite loops
                        renderGalaxyDetailScreen(false);
                    }
                }
                attemptLayoutGeneration();
            }, 50); // Small delay to allow DOM render
        } else {
            renderGalaxyDetailScreen(false);
        }
    }

    function renderPlanetVisual(planetData, rotationQuaternion, targetCanvas = planetVisualCanvas) {
        const workerToUse = targetCanvas === planetVisualCanvas ? planetVisualWorker : designerWorker;
        if (!planetData || !targetCanvas || !workerToUse) {
            console.warn("renderPlanetVisual: Missing data, canvas, or appropriate worker.", { planetData, targetCanvasId: targetCanvas?.id, workerExists: !!workerToUse });
            if (targetCanvas === designerPlanetCanvas) isRenderingDesignerPlanet = false;
            if (targetCanvas === planetVisualCanvas) isRenderingVisualPlanet = false;
            return;
        }
        if (targetCanvas.width === 0 || targetCanvas.height === 0) {
            console.warn(`renderPlanetVisual: Target canvas ${targetCanvas.id} has zero dimensions. Aborting worker call.`);
            if (targetCanvas === designerPlanetCanvas) isRenderingDesignerPlanet = false;
            if (targetCanvas === planetVisualCanvas) isRenderingVisualPlanet = false;
            // Schedule a re-render once canvas has dimensions
            requestAnimationFrame(() => {
                // Ensure the canvas is re-measured or resized if part of auto-sizing layout
                if (targetCanvas === designerPlanetCanvas) resizeDesignerCanvasToDisplaySize();
                // Then attempt to render again if dimensions are valid now and it's still the active planet
                if (targetCanvas.width > 0 && targetCanvas.height > 0 &&
                    (targetCanvas === planetVisualCanvas && currentPlanetDisplayedInPanel) ||
                    (targetCanvas === designerPlanetCanvas && currentDesignerPlanetInstance)) {
                    renderPlanetVisual(planetData, rotationQuaternion, targetCanvas);
                }
            });
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
            canvasWidth: targetCanvas.width, canvasHeight: targetCanvas.height, senderId: canvasId,
            // Pass a fixed radius for the designed planet to keep it consistent regardless of canvas size changes
            planetRadiusOverride: (targetCanvas === designerPlanetCanvas) ? Math.min(targetCanvas.width, targetCanvas.height) / 2 * 0.9 : undefined
        });
    }

    function switchToSolarSystemView(solarSystemId) {
        gameSessionData.activeSolarSystemId = solarSystemId;
        const galaxyPartMatch = solarSystemId.match(/^(galaxy-\d+)-ss-\d+$/);
        const galaxyPart = galaxyPartMatch ? galaxyPartMatch[1] : null;

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
        sunEl.className = 'sun-icon sun-animated';
        sunEl.style.width = `${currentSunSize}px`;
        sunEl.style.height = `${currentSunSize}px`;
        const coreColor = FIXED_COLORS.sunFill, midColor = FIXED_COLORS.sunBorder, edgeColor = adjustColor(FIXED_COLORS.sunBorder, -40), actualBorderColor = FIXED_COLORS.sunBorder;
        sunEl.style.setProperty('--sun-core-color', coreColor);
        sunEl.style.setProperty('--sun-mid-color', midColor);
        sunEl.style.setProperty('--sun-edge-color', edgeColor);
        sunEl.style.setProperty('--sun-actual-border-color', actualBorderColor);
        if (solarSystemContent) solarSystemContent.appendChild(sunEl);

        // solarSystemOrbitCanvasEl is already declared in a higher scope
        solarSystemOrbitCanvasEl = document.createElement('canvas'); // Recreate to ensure correct size
        solarSystemOrbitCanvasEl.id = 'solar-system-orbit-canvas';
        solarSystemOrbitCanvasEl.width = ORBIT_CANVAS_SIZE;
        solarSystemOrbitCanvasEl.height = ORBIT_CANVAS_SIZE;
        if (solarSystemContent) solarSystemContent.appendChild(solarSystemOrbitCanvasEl);
        orbitCtx = solarSystemOrbitCanvasEl.getContext('2d');

        gameSessionData.solarSystemView.planets = [];
        let usedDistances = [];
        const numPlanets = Math.floor(Math.random() * (currentMaxPlanets - currentMinPlanets + 1)) + currentMinPlanets;

        for (let i = 0; i < numPlanets; i++) {
            const planetSize = Math.random() * (MAX_PLANET_SIZE - MIN_PLANET_SIZE) + MIN_PLANET_SIZE;
            let planetDistance, attemptCount = 0;
            do {
                planetDistance = Math.floor(Math.random() * (MAX_PLANET_DISTANCE - MIN_PLANET_DISTANCE + 1)) + MIN_PLANET_DISTANCE;
                let tooClose = false;
                for (const d of usedDistances) {
                    if (Math.abs(planetDistance - d.distance) < (MIN_ORBITAL_SEPARATION + (d.size + planetSize) / 2)) {
                        tooClose = true;
                        break;
                    }
                }
                if (!tooClose) break;
                attemptCount++;
            } while (attemptCount < 200);
            if (attemptCount === 200) continue;
            usedDistances.push({ distance: planetDistance, size: planetSize });

            const basisToUse = (gameSessionData.customPlanetDesigns.length > 0)
                ? gameSessionData.customPlanetDesigns[Math.floor(Math.random() * gameSessionData.customPlanetDesigns.length)]
                : {
                    waterColor: '#0077be', landColor: '#3A5F0B',
                    minTerrainHeightRange: [0.0, 1.0],
                    maxTerrainHeightRange: [5.0, 8.0],
                    oceanHeightRange: [1.0, 3.0]
                };

            const newPlanetData = generatePlanetInstanceFromBasis(basisToUse, false);

            const initialOrbitalAngle = Math.random() * 2 * Math.PI, orbitalSpeed = Math.random() * (MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT - MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT) + MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT;
            const initialAxialAngle = Math.random() * 2 * Math.PI, axialSpeed = DEFAULT_PLANET_AXIAL_SPEED;

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

            const planetEl = document.createElement('div');
            // Add clickable class if there is a visual panel to show
            if (planetVisualPanel) planetEl.classList.add('planet-icon', 'clickable-when-paused');
            else planetEl.classList.add('planet-icon');

            planetEl.style.width = `${newPlanet.size}px`;
            planetEl.style.height = `${newPlanet.size}px`;

            const radialPos = 15 + Math.random() * 40;
            const radialSize = 20 + Math.random() * 30;
            let backgroundStyle = `radial-gradient(circle at ${radialPos}% ${radialPos}%, ${newPlanet.landColor} ${radialSize}%, transparent ${radialSize + 20}%), ${newPlanet.waterColor}`;
            if (Math.random() < 0.5) {
                const radialPos2 = 15 + Math.random() * 40;
                const radialSize2 = 20 + Math.random() * 30;
                // Layer a slightly darker land color for more variation
                backgroundStyle = `radial-gradient(circle at ${90 - radialPos2}% ${90 - radialPos2}%, ${adjustColor(newPlanet.landColor, -30)} ${radialSize2}%, transparent ${radialSize2 + 20}%), ${backgroundStyle}`;
            }

            planetEl.style.background = backgroundStyle;
            planetEl.style.boxShadow = `0 0 ${newPlanet.size / 3}px rgba(255,255,255,0.3)`;

            planetEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!planetVisualPanel || !planetVisualTitle || !planetVisualSize || !planetVisualCanvas) {
                    console.error("Planet visual panel elements not found!");
                    return;
                }
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
                renderPlanetVisual(newPlanet, planetVisualRotationQuat, planetVisualCanvas);
            });
            if (solarSystemContent) solarSystemContent.appendChild(planetEl);
            newPlanet.element = planetEl;
        }

        // Send preload requests to worker for all planets in the system
        if (planetVisualWorker && gameSessionData.solarSystemView.planets && planetVisualCanvas) {
            gameSessionData.solarSystemView.planets.forEach(pTP => {
                const pD = {
                    waterColor: pTP.waterColor, landColor: pTP.landColor, continentSeed: pTP.continentSeed,
                    minTerrainHeight: pTP.minTerrainHeight, maxTerrainHeight: pTP.maxTerrainHeight, oceanHeightLevel: pTP.oceanHeightLevel,
                };
                planetVisualWorker.postMessage({
                    cmd: 'preloadPlanet', planetData: pD,
                    rotationQuaternion: quat_identity(), // Dummy, not used for preload
                    canvasWidth: planetVisualCanvas.width || 200, // Dummy, not used for preload
                    canvasHeight: planetVisualCanvas.height || 200, // Dummy, not used for preload
                    senderId: `preload-${pTP.id}`
                });
            });
        } else if (!planetVisualCanvas) {
            console.warn("planetVisualCanvas not found for preloading.");
        }

        const systemIdentifier = solarSystemId.substring(solarSystemId.lastIndexOf('-') + 1);
        if (solarSystemTitleText) { solarSystemTitleText.textContent = (solarSystemObject && solarSystemObject.customName) ? solarSystemObject.customName : `System ${systemIdentifier}`; }
        if (solarSystemTitleInput) solarSystemTitleInput.style.display = 'none';

        setActiveScreen(solarSystemScreen);

        makeTitleEditable(solarSystemTitleText, solarSystemTitleInput, (newName) => {
            if (solarSystemObject) {
                solarSystemObject.customName = newName || null;
                saveGameState();
                renderGalaxyDetailScreen(); // Re-render galaxy screen to update system name
                return solarSystemObject.customName || `System ${systemIdentifier}`;
            }
            return `System ${systemIdentifier}`;
        });
        renderSolarSystemScreen(false);
        startSolarSystemAnimation();
    }

    function animateSolarSystem(now) {
        if (!now) now = performance.now();
        if (lastAnimationTime === null) lastAnimationTime = now;
        const deltaTime = (now - lastAnimationTime) / 1000; // Time in seconds
        lastAnimationTime = now;

        const activeSolarSystemView = gameSessionData.solarSystemView;
        if (activeSolarSystemView && solarSystemScreen && solarSystemScreen.classList.contains('active') && activeSolarSystemView.planets) {
            activeSolarSystemView.planets.forEach(p => {
                if (p.element) {
                    p.currentOrbitalAngle += p.orbitalSpeed * 6 * deltaTime; // 60 degrees per second equivalent for 1 unit speed
                    p.currentAxialAngle += p.axialSpeed * 60 * deltaTime; // Assuming 60 degrees per second equivalent for 1 unit speed

                    const xOffset = p.distance * Math.cos(p.currentOrbitalAngle);
                    const yOffset = p.distance * Math.sin(p.currentOrbitalAngle);

                    p.element.style.left = `calc(50% + ${xOffset}px)`;
                    p.element.style.top = `calc(50% + ${yOffset}px)`;
                    p.element.style.transform = `translate(-50%, -50%) rotate(${p.currentAxialAngle}rad)`;
                }
            });
            animationFrameId = requestAnimationFrame(animateSolarSystem);
        } else {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            lastAnimationTime = null;
        }
    }

    function startSolarSystemAnimation() {
        if (!animationFrameId && solarSystemScreen && solarSystemScreen.classList.contains('active')) {
            lastAnimationTime = null;
            animateSolarSystem();
        }
    }

    function stopSolarSystemAnimation() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            lastAnimationTime = null;
        }
    }

    function clampSolarSystemPan(dataObject, viewportWidth, viewportHeight) {
        if (!dataObject || !viewportWidth || !viewportHeight) {
            if (dataObject) { dataObject.currentPanX = 0; dataObject.currentPanY = 0; }
            return;
        }
        const zoom = dataObject.zoomLevel;
        const contentWidth = SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2;
        const contentHeight = SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2;

        const scaledContentWidth = contentWidth * zoom;
        const scaledContentHeight = contentHeight * zoom;

        const maxPanX = Math.max(0, (scaledContentWidth - viewportWidth) / 2);
        const maxPanY = Math.max(0, (scaledContentHeight - viewportHeight) / 2);

        dataObject.currentPanX = Math.max(-maxPanX, Math.min(maxPanX, dataObject.currentPanX));
        dataObject.currentPanY = Math.max(-maxPanY, Math.min(maxPanY, dataObject.currentPanY));
    }

    function clampGalaxyPan(galaxy) {
        if (!galaxy || !galaxyViewport) return;
        const viewportWidth = galaxyViewport.offsetWidth;
        const viewportHeight = galaxyViewport.offsetHeight;
        const zoom = galaxy.currentZoom;

        if (zoom <= GALAXY_VIEW_MIN_ZOOM) {
            galaxy.currentPanX = 0;
            galaxy.currentPanY = 0;
        } else {
            // "Play area" dimensions within the viewport after zooming
            const zoomedUniverseWidth = (gameSessionData.universe.diameter || 500) * zoom;
            const zoomedUniverseHeight = (gameSessionData.universe.diameter || 500) * zoom;

            // Max panning offset from center of zoomed content
            const maxPanOffsetX = Math.max(0, (zoomedUniverseWidth - viewportWidth) / 2);
            const maxPanOffsetY = Math.max(0, (zoomedUniverseHeight - viewportHeight) / 2);

            galaxy.currentPanX = Math.max(-maxPanOffsetX, Math.min(maxPanOffsetX, galaxy.currentPanX));
            galaxy.currentPanY = Math.max(-maxPanOffsetY, Math.min(maxPanOffsetY, galaxy.currentPanY));
        }
    }

    function handleZoom(direction, mouseEvent = null) {
        let targetDataObject, viewportElement, clampFunction, renderFunction, minZoom, maxZoom, zoomKey, panXKey, panYKey, isSolarSystemView = false;

        if (galaxyDetailScreen.classList.contains('active')) {
            const g = gameSessionData.galaxies.find(gl => gl.id === gameSessionData.activeGalaxyId);
            if (!g) return;
            targetDataObject = g;
            viewportElement = galaxyViewport;
            clampFunction = clampGalaxyPan;
            renderFunction = renderGalaxyDetailScreen;
            minZoom = GALAXY_VIEW_MIN_ZOOM;
            maxZoom = GALAXY_VIEW_MAX_ZOOM;
            zoomKey = 'currentZoom';
            panXKey = 'currentPanX';
            panYKey = 'currentPanY';
        } else if (solarSystemScreen.classList.contains('active')) {
            isSolarSystemView = true;
            targetDataObject = gameSessionData.solarSystemView;
            viewportElement = solarSystemScreen;
            clampFunction = clampSolarSystemPan;
            renderFunction = renderSolarSystemScreen;
            minZoom = SOLAR_SYSTEM_VIEW_MIN_ZOOM;
            maxZoom = SOLAR_SYSTEM_VIEW_MAX_ZOOM;
            zoomKey = 'zoomLevel';
            panXKey = 'currentPanX';
            panYKey = 'currentPanY';
        } else return; // Not on a zoomable screen

        const oldZoom = targetDataObject[zoomKey];
        let newCurrentZoom = oldZoom + (direction === 'in' ? (ZOOM_STEP * oldZoom) : -(ZOOM_STEP * oldZoom));

        // Dynamic minimum zoom for solar system view
        let effectiveMinZoom = minZoom;
        if (isSolarSystemView && viewportElement) {
            const vw = viewportElement.offsetWidth;
            const vh = viewportElement.offsetHeight;
            let dynamicMinZoomBasedOnExplorableArea = 0;
            if (SOLAR_SYSTEM_EXPLORABLE_RADIUS > 0 && (vw > 0 || vh > 0)) {
                // Determine the minimum zoom level required to contain the entire explorable space
                const zoomToFitWidth = vw > 0 ? vw / (SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2) : 0;
                const zoomToFitHeight = vh > 0 ? vh / (SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2) : 0;
                dynamicMinZoomBasedOnExplorableArea = Math.max(zoomToFitWidth, zoomToFitHeight);
            }
            effectiveMinZoom = Math.max(minZoom, dynamicMinZoomBasedOnExplorableArea);
        }

        newCurrentZoom = Math.max(effectiveMinZoom, Math.min(maxZoom, newCurrentZoom));

        if (Math.abs(oldZoom - newCurrentZoom) < 0.0001) return; // Avoid tiny changes

        targetDataObject[zoomKey] = newCurrentZoom;

        // Adjust pan to keep mouse point fixed on zoom
        if (mouseEvent && viewportElement) {
            const rect = viewportElement.getBoundingClientRect();
            const mouseXInViewport = mouseEvent.clientX - rect.left;
            const mouseYInViewport = mouseEvent.clientY - rect.top;

            // Mouse coordinates relative to viewport center
            const mouseXRelativeToCenter = mouseXInViewport - (viewportElement.offsetWidth / 2);
            const mouseYRelativeToCenter = mouseYInViewport - (viewportElement.offsetHeight / 2);

            const currentPanX = targetDataObject[panXKey] || 0;
            const currentPanY = targetDataObject[panYKey] || 0;

            // World coordinates of the mouse point
            const worldX = (mouseXRelativeToCenter - currentPanX) / oldZoom;
            const worldY = (mouseYRelativeToCenter - currentPanY) / oldZoom;

            // New pan position to keep worldX, worldY under the mouse
            targetDataObject[panXKey] = mouseXRelativeToCenter - (worldX * newCurrentZoom);
            targetDataObject[panYKey] = mouseYRelativeToCenter - (worldY * newCurrentZoom);
        }

        if (isSolarSystemView && viewportElement) {
            clampFunction(targetDataObject, viewportElement.offsetWidth, viewportElement.offsetHeight);
            if (currentShowPlanetOrbits) drawAllOrbits(); // Redraw orbits on zoom
            renderFunction(true); // Render interactively
            startSolarSystemAnimation(); // Ensure animation keeps running
        } else {
            clampFunction(targetDataObject);
            renderFunction(true);
        }
    }

    function startPan(event, viewportEl, contentEl, dataObjRef) {
        if (event.button !== 0 || event.target.closest('button')) return; // Only left-click and not on a button
        // Prevent panning if clicking directly on a solar system icon in galaxy view
        if (viewportEl === galaxyViewport && event.target.closest('.solar-system-icon')) return;

        const panningState = gameSessionData.panning;
        panningState.isActive = true;
        panningState.startX = event.clientX;
        panningState.startY = event.clientY;
        panningState.initialPanX = dataObjRef.currentPanX || 0;
        panningState.initialPanY = dataObjRef.currentPanY || 0;
        panningState.targetElement = contentEl;
        panningState.viewportElement = viewportEl;
        panningState.dataObject = dataObjRef;

        if (viewportEl) viewportEl.classList.add('dragging');
        if (contentEl) contentEl.style.transition = 'none'; // Disable transition during drag
        event.preventDefault(); // Prevent default browser drag behavior
    }

    function panMouseMove(event) {
        if (!gameSessionData.panning.isActive) return;
        const panningState = gameSessionData.panning;
        if (!panningState.dataObject) return;

        const deltaX = event.clientX - panningState.startX;
        const deltaY = event.clientY - panningState.startY;

        panningState.dataObject.currentPanX = panningState.initialPanX + deltaX;
        panningState.dataObject.currentPanY = panningState.initialPanY + deltaY;

        if (panningState.viewportElement === galaxyViewport) {
            clampGalaxyPan(panningState.dataObject);
            renderGalaxyDetailScreen(true);
        } else if (panningState.viewportElement === solarSystemScreen && panningState.viewportElement) {
            clampSolarSystemPan(panningState.dataObject, panningState.viewportElement.offsetWidth, panningState.viewportElement.offsetHeight);
            renderSolarSystemScreen(true);
        }
    }
    function panMouseUp() {
        if (!gameSessionData.panning.isActive) return;
        if (gameSessionData.panning.viewportElement) gameSessionData.panning.viewportElement.classList.remove('dragging');
        const panningState = gameSessionData.panning;
        panningState.isActive = false;
        if (panningState.targetElement) panningState.targetElement.style.transition = ''; // Re-enable transition
        // Re-render non-interactively to apply final transitions
        if (galaxyDetailScreen.classList.contains('active')) renderGalaxyDetailScreen(false);
        else if (solarSystemScreen.classList.contains('active')) renderSolarSystemScreen(false);
        panningState.targetElement = null;
        panningState.viewportElement = null;
        panningState.dataObject = null;
    }

    function regenerateCurrentUniverseState(force = false) {
        if (!force && !confirm("Regenerate universe with current settings? This will clear the currently saved layout.")) return;

        localStorage.removeItem('galaxyGameSaveData'); // Clear saved game data

        // Reset all game state variables
        gameSessionData.universe = { diameter: null };
        gameSessionData.galaxies = [];
        gameSessionData.activeGalaxyId = null;
        gameSessionData.activeSolarSystemId = null;
        gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };
        // customPlanetDesigns are preserved by default now, you can uncomment to clear if desired:
        // gameSessionData.customPlanetDesigns = [];
        gameSessionData.isInitialized = false;

        // Clear UI elements
        if (universeCircle) universeCircle.innerHTML = '';
        if (galaxyZoomContent) {
            const canvasLines = galaxyZoomContent.querySelector('#solar-system-lines-canvas');
            galaxyZoomContent.innerHTML = '';
            if (canvasLines) galaxyZoomContent.appendChild(canvasLines); // Keep the canvas element
        }
        if (solarSystemContent) solarSystemContent.innerHTML = '';
        if (orbitCtx && solarSystemOrbitCanvasEl) orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);

        // Stop any ongoing animations
        if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
        lastAnimationTime = null;

        // Re-initialize the game
        initializeGame(true);
    }

    // --- EVENT LISTENERS ---
    if (designerRandomizeBtn) designerRandomizeBtn.addEventListener('click', randomizeDesignerPlanet);
    if (designerSaveBtn) designerSaveBtn.addEventListener('click', saveCustomPlanetDesign);
    if (designerCancelBtn) designerCancelBtn.addEventListener('click', () => {
        if (mainScreen) setActiveScreen(mainScreen);
        else console.error("mainScreen not found for designerCancelBtn");
    });
    if (createPlanetDesignButton) createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);

    [designerMinHeightMinInput, designerMinHeightMaxInput,
        designerMaxHeightMinInput, designerMaxHeightMaxInput,
        designerOceanHeightMinInput, designerOceanHeightMaxInput,
        designerWaterColorInput, designerLandColorInput].forEach(input => {
        if (input) input.addEventListener('change', updateBasisAndRefreshDesignerPreview);
    });

    if (regenerateUniverseButton) regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(false));
    if (customizeGenerationButton) customizeGenerationButton.addEventListener('click', () => {
        if (!numGalaxiesInput) return; // Guard against null element
        numGalaxiesInput.value = currentNumGalaxies;
        minSSInput.value = currentMinSSCount;
        maxSSInput.value = currentMaxSSCount;
        ssSpreadInput.value = currentMaxPlanetDistanceMultiplier.toFixed(1);
        minPlanetsInput.value = currentMinPlanets;
        maxPlanetsInput.value = currentMaxPlanets;
        showOrbitsInput.checked = currentShowPlanetOrbits;
        customizationModal.classList.add('visible');
    });
    if (cancelCustomizationButton) cancelCustomizationButton.addEventListener('click', () => { customizationModal.classList.remove('visible'); });
    if (applyCustomizationButton) applyCustomizationButton.addEventListener('click', () => {
        if (!numGalaxiesInput) return; // Guard against null element
        const nG = parseInt(numGalaxiesInput.value, 10);
        const mSS = parseInt(minSSInput.value, 10);
        const mxSS = parseInt(maxSSInput.value, 10);
        const sp = parseFloat(ssSpreadInput.value);
        const mP = parseInt(minPlanetsInput.value, 10);
        const mxP = parseInt(maxPlanetsInput.value, 10);

        // Basic validation
        if (isNaN(nG) || nG < 1 || nG > 100 ||
            isNaN(mSS) || mSS < 1 || mSS > 1000 ||
            isNaN(mxSS) || mxSS < 1 || mxSS > 2000 || mxSS < mSS ||
            isNaN(sp) || sp < 0.1 || sp > 5.0 ||
            isNaN(mP) || mP < 0 || mP > 20 ||
            isNaN(mxP) || mxP < mP || mxP > 20) {
            alert("Invalid input values. Please check ranges and ensure Max >= Min. Ranges are: Galaxies (1-100), Solar Systems (1-1000, Max up to 2000), Spread (0.1-5.0), Planets (0-20, Max up to 20).");
            return;
        }

        currentNumGalaxies = nG;
        currentMinSSCount = mSS;
        currentMaxSSCount = mxSS;
        currentMaxPlanetDistanceMultiplier = sp;
        currentMinPlanets = mP;
        currentMaxPlanets = mxP;
        currentShowPlanetOrbits = showOrbitsInput.checked;

        updateDerivedConstants(); // Update calculated constants based on new customization
        saveCustomizationSettings(); // Save these settings
        customizationModal.classList.remove('visible'); // Hide modal
        regenerateCurrentUniverseState(true); // Regenerate with new settings
    });
    if (closePlanetVisualPanelBtn) closePlanetVisualPanelBtn.addEventListener('click', () => { if (planetVisualPanel) planetVisualPanel.classList.remove('visible'); currentPlanetDisplayedInPanel = null; });

    let isPanelDragging = false;
    let visualPanelOffset = { x: 0, y: 0 };
    if (planetVisualPanelHeader) planetVisualPanelHeader.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !planetVisualPanel) return;
        isPanelDragging = true;
        planetVisualPanel.classList.add('dragging');
        planetVisualPanel.style.transition = 'none'; // Disable transition for dragging
        const r = planetVisualPanel.getBoundingClientRect();
        visualPanelOffset.x = e.clientX - r.left;
        visualPanelOffset.y = e.clientY - r.top;
        // Set actual position, remove transform for direct pixel control
        planetVisualPanel.style.left = `${e.clientX - visualPanelOffset.x}px`;
        planetVisualPanel.style.top = `${e.clientY - visualPanelOffset.y}px`;
        planetVisualPanel.style.transform = 'none';
        planetVisualPanel.style.right = 'auto'; // Ensure right/bottom don't interfere
        planetVisualPanel.style.bottom = 'auto';
        e.preventDefault();
    });

    if (planetVisualCanvas) {
        planetVisualCanvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || !currentPlanetDisplayedInPanel) return;
            isDraggingPlanetVisual = true;
            startDragMouseX = e.clientX;
            startDragMouseY = e.clientY;
            startDragPlanetVisualQuat = [...planetVisualRotationQuat]; // Save current quaternion state
            planetVisualCanvas.classList.add('dragging');
            e.preventDefault(); // Prevent default drag behavior
        });
    }
    if (designerPlanetCanvas) {
        designerPlanetCanvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDraggingDesignerPlanet = true;
            designerStartDragMouseX = e.clientX;
            designerStartDragMouseY = e.clientY;
            startDragDesignerPlanetQuat = [...designerPlanetRotationQuat];
            designerPlanetCanvas.classList.add('dragging');
            e.preventDefault();
        });
    }

    // Global mouse move for dragging panels and planets
    window.addEventListener('mousemove', (e) => {
        if (isPanelDragging && planetVisualPanel) {
            planetVisualPanel.style.left = `${e.clientX - visualPanelOffset.x}px`;
            planetVisualPanel.style.top = `${e.clientY - visualPanelOffset.y}px`;
        }
        if (isDraggingPlanetVisual && currentPlanetDisplayedInPanel && planetVisualCanvas && planetVisualPanel && planetVisualPanel.classList.contains('visible')) {
            const rect = planetVisualCanvas.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return; // Avoid division by zero
            const canvasWidth = rect.width;
            const canvasHeight = rect.height;
            const deltaX = e.clientX - startDragMouseX;
            const deltaY = e.clientY - startDragMouseY;

            // Calculate rotation amount based on mouse movement relative to canvas size and sensitivity
            const rotationAroundX = (deltaY / canvasHeight) * Math.PI * PLANET_ROTATION_SENSITIVITY;
            const rotationAroundY = (deltaX / canvasWidth) * (2 * Math.PI) * PLANET_ROTATION_SENSITIVITY;

            // Create quaternions for X and Y axis rotations
            const xAxisRotationQuat = quat_from_axis_angle([1, 0, 0], -rotationAroundX); // Negative for intuitive drag
            const yAxisRotationQuat = quat_from_axis_angle([0, 1, 0], rotationAroundY);

            // Apply the new rotations to the initial quaternion when drag started
            const incrementalRotationQuat = quat_multiply(yAxisRotationQuat, xAxisRotationQuat);
            planetVisualRotationQuat = quat_normalize(quat_multiply(incrementalRotationQuat, startDragPlanetVisualQuat));

            if (!isRenderingVisualPlanet && planetVisualWorker) {
                renderPlanetVisual(currentPlanetDisplayedInPanel, planetVisualRotationQuat, planetVisualCanvas);
            } else {
                needsPlanetVisualRerender = true; // Mark for re-render when worker is free
            }
        } else if (isDraggingDesignerPlanet && designerPlanetCanvas) {
            const rect = designerPlanetCanvas.getBoundingClientRect();
            // Use actual canvas width/height if available, otherwise fallback to bounding rect
            const canvasEffectiveWidth = (designerPlanetCanvas.width > 0 ? designerPlanetCanvas.width : rect.width) || 1;
            const canvasEffectiveHeight = (designerPlanetCanvas.height > 0 ? designerPlanetCanvas.height : rect.height) || 1;
            if (canvasEffectiveWidth === 0 || canvasEffectiveHeight === 0) return;

            const deltaX = e.clientX - designerStartDragMouseX;
            const deltaY = e.clientY - designerStartDragMouseY;

            const rotationAroundX = (deltaY / canvasEffectiveHeight) * Math.PI * PLANET_ROTATION_SENSITIVITY;
            const rotationAroundY = (deltaX / canvasEffectiveWidth) * (2 * Math.PI) * PLANET_ROTATION_SENSITIVITY;

            const xAxisRotationQuat = quat_from_axis_angle([1, 0, 0], -rotationAroundX);
            const yAxisRotationQuat = quat_from_axis_angle([0, 1, 0], rotationAroundY);

            const incrementalRotationQuat = quat_multiply(yAxisRotationQuat, xAxisRotationQuat);
            designerPlanetRotationQuat = quat_normalize(quat_multiply(incrementalRotationQuat, startDragDesignerPlanetQuat));

            if (!isRenderingDesignerPlanet && currentDesignerPlanetInstance && designerWorker) {
                renderDesignerPlanet(currentDesignerPlanetInstance, designerPlanetRotationQuat);
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (isPanelDragging && planetVisualPanel) {
            isPanelDragging = false;
            planetVisualPanel.classList.remove('dragging');
            planetVisualPanel.style.transition = ''; // Re-enable transition
        }
        if (isDraggingPlanetVisual && planetVisualCanvas) {
            isDraggingPlanetVisual = false;
            planetVisualCanvas.classList.remove('dragging');
        }
        if (isDraggingDesignerPlanet && designerPlanetCanvas) {
            isDraggingDesignerPlanet = false;
            designerPlanetCanvas.classList.remove('dragging');
        }
    });

    function initializeGame(isForcedRegeneration = false) {
        loadCustomizationSettings(); // Always load customization settings first

        if (!isForcedRegeneration && loadGameState()) {
            setActiveScreen(mainScreen);
            if (universeCircle && gameSessionData.universe.diameter) {
                universeCircle.style.width = `${gameSessionData.universe.diameter}px`;
                universeCircle.style.height = `${gameSessionData.universe.diameter}px`;
                universeCircle.style.backgroundColor = FIXED_COLORS.universeBg;
            } else {
                generateUniverseLayout(); // If universe diameter was not loaded
            }
            renderMainScreen();
            preGenerateAllGalaxyContents(); // Pre-generate layouts for existing galaxies
        } else {
            // New game or forced regeneration
            generateUniverseLayout();
            generateGalaxies();
            setActiveScreen(mainScreen);
            renderMainScreen();
            preGenerateAllGalaxyContents(); // This calls saveGameState inside after generation
        }
        gameSessionData.isInitialized = true;
    }

    // Handle window resize dynamically rebuilding universe, but keeping custom designs
    window.addEventListener('resize', () => {
        const activeScreenElement = document.querySelector('.screen.active');
        const currentScreenId = activeScreenElement ? activeScreenElement.id : 'main-screen';

        // Preserve current custom planet designs across resize regeneration
        const preservedCustomDesigns = [...gameSessionData.customPlanetDesigns];

        // Reset game session data entirely
        gameSessionData = {
            universe: { diameter: null },
            galaxies: [],
            activeGalaxyId: null,
            activeSolarSystemId: null,
            solarSystemView: { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null },
            isInitialized: false,
            panning: { isActive: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0, targetElement: null, viewportElement: null, dataObject: null },
            customPlanetDesigns: preservedCustomDesigns // Restore preserved designs
        };

        // Clear UI elements
        if (universeCircle) universeCircle.innerHTML = '';
        if (galaxyZoomContent) {
            const canvasLines = galaxyZoomContent.querySelector('#solar-system-lines-canvas');
            galaxyZoomContent.innerHTML = '';
            if (canvasLines) galaxyZoomContent.appendChild(canvasLines);
        }
        if (solarSystemContent) solarSystemContent.innerHTML = '';
        if (orbitCtx && solarSystemOrbitCanvasEl) orbitCtx.clearRect(0, 0, solarSystemOrbitCanvasEl.width, solarSystemOrbitCanvasEl.height);
        stopSolarSystemAnimation(); // Ensure animation stops cleanly

        // Initialize game fresh, which will generate a new universe based on current settings
        initializeGame(true); // Force regeneration

        // Attempt to return to the previously active screen
        const screenToActivate = document.getElementById(currentScreenId);
        if (screenToActivate) {
            if (currentScreenId === 'planet-designer-screen') {
                switchToPlanetDesignerScreen();
            } else if (currentScreenId === 'galaxy-detail-screen' && gameSessionData.activeGalaxyId) {
                switchToGalaxyDetailView(gameSessionData.activeGalaxyId);
            } else if (currentScreenId === 'solar-system-screen' && gameSessionData.activeSolarSystemId) {
                switchToSolarSystemView(gameSessionData.activeSolarSystemId);
            } else {
                setActiveScreen(screenToActivate);
            }
        } else {
            setActiveScreen(mainScreen); // Fallback to main screen
        }

        // Handle re-rendering of planet visuals if active
        if (planetVisualPanel && planetVisualPanel.classList.contains('visible') && currentPlanetDisplayedInPanel && planetVisualCanvas) {
            // Re-render visual panel planet
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
    if (backToGalaxyButton) backToGalaxyButton.addEventListener('click', () => {
        if (gameSessionData.activeGalaxyId && gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId)) {
            // Find the galaxy again in case it was regenerated during universe regen.
            const targetGalaxy = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
            if (targetGalaxy) {
                 switchToGalaxyDetailView(targetGalaxy.id);
            } else {
                switchToMainView(); // Fallback if active galaxy no longer exists after some operation
            }
        } else {
            switchToMainView();
        }
    });
    if (zoomInButton) zoomInButton.addEventListener('click', (e) => handleZoom('in', e));
    if (zoomOutButton) zoomOutButton.addEventListener('click', (e) => handleZoom('out', e));
    if (galaxyViewport) galaxyViewport.addEventListener('wheel', (e) => { if (galaxyDetailScreen.classList.contains('active')) { e.preventDefault(); handleZoom(e.deltaY < 0 ? 'in' : 'out', e); } });
    if (solarSystemScreen) solarSystemScreen.addEventListener('wheel', (e) => { if (solarSystemScreen.classList.contains('active')) { e.preventDefault(); handleZoom(e.deltaY < 0 ? 'in' : 'out', e); } });
    if (solarSystemScreen) solarSystemScreen.addEventListener('mousedown', (e) => { if (solarSystemScreen.classList.contains('active')) { startPan(e, solarSystemScreen, solarSystemContent, gameSessionData.solarSystemView); } });

    // Global mouse move/up listeners for panning
    window.addEventListener('mousemove', panMouseMove);
    window.addEventListener('mouseup', panMouseUp);

    // Galaxy view specific panning (to override general pan handler for SS icons clicks)
    if (galaxyViewport) {
        galaxyViewport.addEventListener('click', function(event) {
            // Only trigger if it wasn't a pan (based on sufficient movement from start)
            if (gameSessionData.panning && gameSessionData.panning.isActive) {
                const panThreshold = 5; // pixels
                if (Math.abs(event.clientX - gameSessionData.panning.startX) > panThreshold ||
                    Math.abs(event.clientY - gameSessionData.panning.startY) > panThreshold) {
                    return; // It was a pan, not a click
                }
            }

            const ssIcon = event.target.closest('.solar-system-icon');
            if (ssIcon) {
                const ssId = ssIcon.dataset.solarSystemId;
                if (ssId) {
                    switchToSolarSystemView(ssId);
                    event.stopPropagation(); // Stop propagation to prevent further clicks on the viewport
                }
            }
        }, true); // Use capture phase to ensure this runs before specific icon clicks perhaps

        let isGalaxyPanningSpecific = false; // Flag to indicate galaxy-specific pan is active
        let galaxyPanStartSpecific = { x: 0, y: 0 }; // Starting mouse position
        let galaxyLastPanSpecific = { x: 0, y: 0 }; // Pan position at start of drag

        galaxyViewport.addEventListener('mousedown', (e) => {
            // Check if it's left click, galaxy detail screen is active, not clicking on a solar system icon or button
            if (e.button !== 0 || !galaxyDetailScreen.classList.contains('active') || e.target.closest('.solar-system-icon') || e.target.closest('button')) return;

            isGalaxyPanningSpecific = true;
            galaxyPanStartSpecific.x = e.clientX;
            galaxyPanStartSpecific.y = e.clientY;
            const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
            galaxyLastPanSpecific.x = gal?.currentPanX || 0;
            galaxyLastPanSpecific.y = gal?.currentPanY || 0;

            galaxyViewport.classList.add('dragging');
            if (galaxyZoomContent) galaxyZoomContent.style.transition = 'none'; // Disable transition during pan

            e.preventDefault(); // Prevent default browser drag behavior

            // Set up panning state for the click-detection logic in the general panMouseMove
            gameSessionData.panning.startX = e.clientX;
            gameSessionData.panning.startY = e.clientY;
            gameSessionData.panning.isActive = true; // Temporary set to true to enable panMouseMove
        });

        const galaxyMouseMoveHandler = (e) => {
            if (!isGalaxyPanningSpecific) return;
            const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
            if (!gal) return; // Should not happen if isGalaxyPanningSpecific is true and active galaxy exists

            const dx = e.clientX - galaxyPanStartSpecific.x;
            const dy = e.clientY - galaxyPanStartSpecific.y;

            gal.currentPanX = galaxyLastPanSpecific.x + dx;
            gal.currentPanY = galaxyLastPanSpecific.y + dy;

            clampGalaxyPan(gal);
            renderGalaxyDetailScreen(true); // Re-render interactively
        };
        // Use window for mousemove to ensure pan continues if mouse leaves viewport
        window.addEventListener('mousemove', galaxyMouseMoveHandler);

        const galaxyMouseUpHandler = () => {
            if (isGalaxyPanningSpecific) {
                isGalaxyPanningSpecific = false;
                if (galaxyViewport) galaxyViewport.classList.remove('dragging');
                if (galaxyZoomContent) galaxyZoomContent.style.transition = ''; // Re-enable transition
                renderGalaxyDetailScreen(false); // Final render with transitions re-enabled
                gameSessionData.panning.isActive = false; // Reset general pan state
            }
        };
        window.addEventListener('mouseup', galaxyMouseUpHandler);
    }

    // --- INITIALIZATION ---
    initializeGame();

}); // End of DOMContentLoaded
