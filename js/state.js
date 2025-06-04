// js/state.js

import * as Config from './config.js';

// --- Game Session Data ---
export let gameSessionData = {
    universe: { diameter: null },
    galaxies: [],
    activeGalaxyId: null,
    activeSolarSystemId: null,
    solarSystemView: { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null },
    isInitialized: false,
    // Panning state for general UI (galaxy detail, solar system)
    panning: {
        isActive: false,
        startX: 0,
        startY: 0,
        initialPanX: 0,
        initialPanY: 0,
        targetElement: null,
        viewportElement: null,
        dataObject: null
    },
    customPlanetDesigns: [] // Stores saved custom planet designs
};

// --- Customization Settings (User Defined) ---
// These will be loaded from localStorage or set to defaults
export let currentNumGalaxies = Config.DEFAULT_NUM_GALAXIES;
export let currentMinSSCount = Config.DEFAULT_MIN_SS_COUNT_CONST;
export let currentMaxSSCount = Config.DEFAULT_MAX_SS_COUNT_CONST;
export let currentMaxPlanetDistanceMultiplier = Config.DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
export let currentMinPlanets = Config.DEFAULT_MIN_PLANETS_PER_SYSTEM;
export let currentMaxPlanets = Config.DEFAULT_MAX_PLANETS_PER_SYSTEM;
export let currentShowPlanetOrbits = Config.DEFAULT_SHOW_PLANET_ORBITS;

// --- Dynamically Calculated Constants (Derived from customization or fixed) ---
// These are `let` because they change based on customization settings
export let MIN_PLANET_DISTANCE = Config.SUN_ICON_SIZE * 3.0;
export let MAX_PLANET_DISTANCE = (Config.SUN_ICON_SIZE * Config.BASE_MAX_PLANET_DISTANCE_FACTOR) * Config.DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
export let ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
export let SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2;

// --- UI / Interaction State ---
export let solarSystemLinesCtx = null; // Context for drawing lines in galaxy view
export let solarSystemOrbitCtx = null; // Context for drawing orbits in solar system view
export let solarSystemOrbitCanvasEl = null; // Reference to the solar system orbit canvas
export let animationFrameId = null; // For solar system animation loop
export let lastAnimationTime = null; // For solar system animation delta time calculation

// Planet visual panel dragging state
export let isPanelDragging = false;
export let visualPanelOffset = { x: 0, y: 0 };
export let currentPlanetDisplayedInPanel = null;
export let planetVisualRotationQuat = [1, 0, 0, 0]; // Quaternion for 3D planet visual
export let startDragPlanetVisualQuat = [1, 0, 0, 0];
export let startDragMouseX = 0;
export let startDragMouseY = 0;
export let isRenderingVisualPlanet = false; // Flag to prevent multiple render requests
export let needsPlanetVisualRerender = false; // Flag to queue a re-render after current is done

// Designer screen planet drawing state
export let designerPlanetRotationQuat = [1, 0, 0, 0];
export let startDragDesignerPlanetQuat = [1, 0, 0, 0];
export let designerStartDragMouseX = 0;
export let designerStartDragMouseY = 0;
export let isRenderingDesignerPlanet = false; // Flag to prevent multiple render requests

// Designer basis for current unsaved design
export let currentDesignerBasis = {
    waterColor: '#000080',
    landColor: '#006400',
    continentSeed: Math.random(),
    minTerrainHeightRange: [0.0, 2.0],
    maxTerrainHeightRange: [8.0, 12.0],
    oceanHeightRange: [1.0, 3.0]
};
export let currentDesignerPlanetInstance = null; // Actual planet data being rendered in designer
