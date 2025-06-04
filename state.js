// js/state.js

import * as Config from './config.js';

// --- Game Session Data (Properties will be mutated, not the object itself) ---
export const gameSessionData = {
    universe: { diameter: null },
    galaxies: [],
    activeGalaxyId: null,
    activeSolarSystemId: null,
    solarSystemView: { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null },
    isInitialized: false,
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

// --- Customization Settings (User Defined) - GROUPED INTO AN OBJECT ---
// We use 'const' here because we intend to mutate its properties, not reassign `appSettings` itself.
export const appSettings = {
    currentNumGalaxies: Config.DEFAULT_NUM_GALAXIES,
    currentMinSSCount: Config.DEFAULT_MIN_SS_COUNT_CONST,
    currentMaxSSCount: Config.DEFAULT_MAX_SS_COUNT_CONST,
    currentMaxPlanetDistanceMultiplier: Config.DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER,
    currentMinPlanets: Config.DEFAULT_MIN_PLANETS_PER_SYSTEM,
    currentMaxPlanets: Config.DEFAULT_MAX_PLANETS_PER_SYSTEM,
    currentShowPlanetOrbits: Config.DEFAULT_SHOW_PLANET_ORBITS,
};

// --- Dynamically Calculated Constants (Derived from customization or fixed) ---
// These are still 'let' because their values are reassigned by updateDerivedConstants
export let MIN_PLANET_DISTANCE = Config.SUN_ICON_SIZE * 3.0; // Initial value, updated by updateDerivedConstants
export let MAX_PLANET_DISTANCE = (Config.SUN_ICON_SIZE * Config.BASE_MAX_PLANET_DISTANCE_FACTOR) * Config.DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER; // Initial, updated by updateDerivedConstants
export let ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
export let SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2;

// --- UI / Interaction State ---
// These can remain `let` or be grouped into a UI state object if desired for more organization later
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
export const currentDesignerBasis = { // Made const as its properties will be mutated
    waterColor: '#000080',
    landColor: '#006400',
    continentSeed: Math.random(),
    minTerrainHeightRange: [0.0, 2.0],
    maxTerrainHeightRange: [8.0, 12.0],
    oceanHeightRange: [1.0, 3.0]
};
export let currentDesignerPlanetInstance = null; // Actual planet data being rendered in designer
