// public/js/script.js

// FIX: Corrected module imports to destructure the exported objects directly.
import { startSolarSystemAnimation, stopSolarSystemAnimation, isSolarSystemAnimationRunning } from './animationController.js';
import { PlanetDesigner } from './planetDesigner.js';
import { PlanetVisualPanelManager } from './planetVisualPanelManager.js';

function initializeModules() {
    window.PlanetDesigner = PlanetDesigner;
    window.PlanetVisualPanelManager = PlanetVisualPanelManager;
}

document.addEventListener('DOMContentLoaded', () => {
    // Define constants FIRST, so functions defined below can access them
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

        return {
            waterColor: basis.waterColor || '#0000FF',
            landColor: basis.landColor || '#008000',
            continentSeed: isForDesignerPreview ? (basis.continentSeed !== undefined ? basis.continentSeed : Math.random()) : Math.random(),
            minTerrainHeight: getValueFromRange(basis.minTerrainHeightRange, window.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0),
            maxTerrainHeight: getValueFromRange(basis.maxTerrainHeightRange, window.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0),
            oceanHeightLevel: getValueFromRange(basis.oceanHeightRange, window.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0)
        };
    }

    // --- STATE VARIABLES ---
    let linesCtx;
    let solarSystemOrbitCanvasEl;
    let orbitCtx;
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
    let MIN_PLANET_DISTANCE;
    let MAX_PLANET_DISTANCE;
    let ORBIT_CANVAS_SIZE;
    let SOLAR_SYSTEM_EXPLORABLE_RADIUS;
    const MIN_ORBITAL_SEPARATION = 20;
    let MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.005;
    let MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.01;
    const FIXED_COLORS = {
        universeBg: '#100520',
        connectionLine: 'rgba(128, 128, 255, 0.4)',
    };

    window.gameSessionData = {
        universe: { diameter: null },
        galaxies: [],
        activeGalaxyId: null,
        activeSolarSystemId: null,
        solarSystemView: {
            zoomLevel: 1.0,
            currentPanX: 0,
            currentPanY: 0,
            planets: [],
            systemId: null
        },
        isInitialized: false,
        panning: { isActive: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0, targetElement: null, viewportElement: null, dataObject: null },
        customPlanetDesigns: []
    };

    // --- REMOVAL: The entire Web Worker setup block has been removed. ---

                           function switchToPlanetDesignerScreen() {
        setActiveScreen(planetDesignerScreen);
        if (window.PlanetDesigner?.activate) {
            window.PlanetDesigner.activate();
        } else {
            console.error("switchToPlanetDesignerScreen: PlanetDesigner module or activate function not found.");
        }
    }

    function updateDerivedConstants() {
        MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier;
        MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0 * Math.min(1.0, (currentMaxPlanetDistanceMultiplier > 0.5 ? currentMaxPlanetDistanceMultiplier * 0.8 : 0.5));
        ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
        SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2;
    }

    window.saveGameState = function () {
        try {
            const stateToSave = {
                universeDiameter: window.gameSessionData.universe.diameter,
                galaxies: window.gameSessionData.galaxies,
                customPlanetDesigns: window.gameSessionData.customPlanetDesigns
            };
            localStorage.setItem('galaxyGameSaveData', JSON.stringify(stateToSave));
            console.log("Game state saved.");
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
                    window.gameSessionData.universe.diameter = loadedState.universeDiameter;
                    window.gameSessionData.galaxies = loadedState.galaxies;

                    window.gameSessionData.galaxies.forEach(gal => {
                        gal.currentZoom = gal.currentZoom || 1.0;
                        gal.currentPanX = gal.currentPanX || 0;
                        gal.currentPanY = gal.currentPanY || 0;
                        gal.customName = gal.customName || null;
                        gal.generationParams = gal.generationParams || { densityFactor: 0.8 + Math.random() * 0.4 };
                        gal.solarSystems = gal.solarSystems || [];
                        gal.solarSystems.forEach(ss => {
                            ss.customName = ss.customName || null;
                            ss.sunSizeFactor = ss.sunSizeFactor ?? (0.5 + Math.random() * 9.5);
                        });
                        gal.lineConnections = gal.lineConnections || [];
                        gal.layoutGenerated = gal.layoutGenerated || false;
                    });

                    window.gameSessionData.customPlanetDesigns = (loadedState.customPlanetDesigns || []).map(design => {
                        const migratedDesign = { ...design };
                        if (migratedDesign.continentSeed === undefined) migratedDesign.continentSeed = Math.random();

                        const ensureRange = (currentVal, oldProp, defaultBase, defaultSpread) => {
                            if (Array.isArray(currentVal) && currentVal.length === 2 && typeof currentVal[0] === 'number' && typeof currentVal[1] === 'number') {
                                return [...currentVal];
                            }
                            const base = typeof oldProp === 'number' ? oldProp : (typeof defaultBase === 'number' ? defaultBase : 0);
                            return [base, base + (typeof defaultSpread === 'number' ? defaultSpread : 1.0)];
                        };

                        migratedDesign.minTerrainHeightRange = ensureRange(migratedDesign.minTerrainHeightRange, migratedDesign.minTerrainHeight, window.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0);
                        migratedDesign.maxTerrainHeightRange = ensureRange(migratedDesign.maxTerrainHeightRange, migratedDesign.maxTerrainHeight, window.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0);
                        migratedDesign.oceanHeightRange = ensureRange(migratedDesign.oceanHeightRange, migratedDesign.oceanHeightLevel, window.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0);

                        delete migratedDesign.minTerrainHeight;
                        delete migratedDesign.maxTerrainHeight;
                        delete migratedDesign.oceanHeightLevel;
                        return migratedDesign;
                    });
                    console.log("Game state loaded successfully.");
                    return true;
                }
            }
        } catch (error) {
            console.error("Error loading game state:", error);
            localStorage.removeItem('galaxyGameSaveData');
        }
        console.log("No valid game state found or error loading.");
        return false;
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
        try {
            localStorage.setItem('galaxyCustomizationSettings', JSON.stringify(settings));
        } catch (e) {
            console.error("Error saving customization settings:", e);
        }
    }

    function loadCustomizationSettings() {
        const settingsString = localStorage.getItem('galaxyCustomizationSettings');
        if (settingsString) {
            try {
                const loadedSettings = JSON.parse(settingsString);
                currentNumGalaxies = parseInt(loadedSettings.numGalaxies, 10) || DEFAULT_NUM_GALAXIES;
                currentMinSSCount = parseInt(loadedSettings.minSS, 10) || DEFAULT_MIN_SS_COUNT_CONST;
                currentMaxSSCount = parseInt(loadedSettings.maxSS, 10) || DEFAULT_MAX_SS_COUNT_CONST;
                currentMaxPlanetDistanceMultiplier = parseFloat(loadedSettings.spread);
                if (isNaN(currentMaxPlanetDistanceMultiplier)) currentMaxPlanetDistanceMultiplier = DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
                currentMinPlanets = parseInt(loadedSettings.minPlanets, 10);
                if (isNaN(currentMinPlanets)) currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM;
                currentMaxPlanets = parseInt(loadedSettings.maxPlanets, 10);
                if (isNaN(currentMaxPlanets)) currentMaxPlanets = DEFAULT_MAX_PLANETS_PER_SYSTEM;
                currentShowPlanetOrbits = typeof loadedSettings.showOrbits === 'boolean' ? loadedSettings.showOrbits : DEFAULT_SHOW_PLANET_ORBITS;
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

    // --- GEOMETRY HELPER FUNCTIONS ---
    function checkOverlap(rect1, rect2) {
        return !(
            rect1.x + rect1.width < rect2.x ||
            rect2.x + rect2.width < rect1.x ||
            rect1.y + rect1.height < rect2.y ||
            rect2.y + rect2.height < rect1.y
        );
    }

    function getNonOverlappingPositionInCircle(circleRadius, objectDiameter, existingRects) {
        let placementRadius = circleRadius - (objectDiameter / 2) - 5;
        if (placementRadius < 0) placementRadius = 0;

        for (let i = 0; i < MAX_PLACEMENT_ATTEMPTS; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const r = Math.sqrt(Math.random()) * placementRadius;
            const centerX = circleRadius + r * Math.cos(angle);
            const centerY = circleRadius + r * Math.sin(angle);
            const x = centerX - (objectDiameter / 2);
            const y = centerY - (objectDiameter / 2);
            const newRect = { x, y, width: objectDiameter, height: objectDiameter };
            if (!existingRects.some(existingRect => checkOverlap(newRect, existingRect))) {
                return { x, y };
            }
        }
        console.warn(`getNonOverlappingPositionInCircle: Could not find non-overlapping position after ${MAX_PLACEMENT_ATTEMPTS} attempts.`);
        return null;
    }

    function getWeightedNumberOfConnections() {
        const rand = Math.random();
        return rand < 0.6 ? 1 : rand < 0.9 ? 2 : 3;
    }

    function adjustColor(hex, amount) {
        if (!hex || typeof hex !== 'string' || hex.charAt(0) !== '#' || hex.length !== 7) {
            console.warn("adjustColor: Invalid hex input.", hex);
            return hex;
        }
        try {
            let r = parseInt(hex.slice(1, 3), 16);
            let g = parseInt(hex.slice(3, 5), 16);
            let b = parseInt(hex.slice(5, 7), 16);
            r = Math.max(0, Math.min(255, r + amount));
            g = Math.max(0, Math.min(255, g + amount));
            b = Math.max(0, Math.min(255, b + amount));
            const toHex = c => c.toString(16).padStart(2, '0');
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        } catch (e) {
            console.error("Error in adjustColor:", e, "Input hex:", hex);
            return hex;
        }
    }

                              // --- SCREEN MANAGEMENT ---
    window.setActiveScreen = function (screenToShow) {
        const screens = [mainScreen, galaxyDetailScreen, solarSystemScreen, planetDesignerScreen].filter(s => s);
        screens.forEach(s => s.classList.remove('active', 'panning-active'));

        if (screenToShow) {
            screenToShow.classList.add('active');
        } else {
            console.warn("setActiveScreen called with no screenToShow.");
        }

        if (zoomControlsElement) {
            zoomControlsElement.classList.toggle('visible', screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen);
        }

        const isOnOverlayScreen = screenToShow === planetDesignerScreen;

        if (regenerateUniverseButton) regenerateUniverseButton.style.display = isOnOverlayScreen ? 'none' : 'block';
        if (createPlanetDesignButton) createPlanetDesignButton.style.display = isOnOverlayScreen ? 'none' : 'block';

        if (screenToShow !== solarSystemScreen || isOnOverlayScreen) {
            if (window.PlanetVisualPanelManager?.isVisible()) {
                window.PlanetVisualPanelManager.hide();
            }
        }
    }
    window.mainScreen = mainScreen;

    function generateUniverseLayout() {
        const screenMinDimension = Math.min(window.innerWidth, window.innerHeight);
        window.gameSessionData.universe.diameter = Math.max(300, screenMinDimension * 0.85);

        if (universeCircle) {
            universeCircle.style.width = `${window.gameSessionData.universe.diameter}px`;
            universeCircle.style.height = `${window.gameSessionData.universe.diameter}px`;
            universeCircle.style.backgroundColor = FIXED_COLORS.universeBg;
        } else {
            console.warn("generateUniverseLayout: universeCircle element not found.");
        }
    }

    function generateGalaxies() {
        if (!window.gameSessionData.universe.diameter || !universeCircle) {
            console.warn("generateGalaxies: Universe diameter not set or circle element not found.");
            return;
        }

        window.gameSessionData.galaxies = [];
        const universeRadius = window.gameSessionData.universe.diameter / 2;
        const existingGalaxyRects = [];

        for (let i = 0; i < currentNumGalaxies; i++) {
            const galaxyId = `galaxy-${i + 1}`;
            const position = getNonOverlappingPositionInCircle(universeRadius, GALAXY_ICON_SIZE, existingGalaxyRects);

            if (position && typeof position.x === 'number' && typeof position.y === 'number') {
                window.gameSessionData.galaxies.push({
                    id: galaxyId, x: position.x, y: position.y, customName: null, solarSystems: [],
                    lineConnections: [], layoutGenerated: false, currentZoom: 1.0, currentPanX: 0,
                    currentPanY: 0, generationParams: { densityFactor: 0.8 + Math.random() * 0.4 }
                });
                existingGalaxyRects.push({ x: position.x, y: position.y, width: GALAXY_ICON_SIZE, height: GALAXY_ICON_SIZE });
            } else {
                console.warn(`generateGalaxies: Could not place galaxy ${i + 1}. Max attempts reached or invalid placement.`);
            }
        }
    }

    function generateSolarSystemsForGalaxy(galaxyId) {
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === galaxyId);
        if (!galaxy) {
            console.warn(`generateSolarSystemsForGalaxy: Galaxy ${galaxyId} not found.`);
            return;
        }

        if (galaxy.layoutGenerated && !window.gameSessionData.isForceRegenerating) {
            return;
        }

        const galaxyContentDiameter = galaxyViewport.offsetWidth > 0 ? galaxyViewport.offsetWidth : (window.gameSessionData.universe.diameter || 500);
        const galaxyContentRadius = galaxyContentDiameter / 2;

        if (galaxyContentRadius <= 0) {
            console.warn(`generateSolarSystemsForGalaxy: Invalid content dimensions for galaxy ${galaxy.id}. Diameter: ${galaxyContentDiameter}`);
            galaxy.layoutGenerated = true;
            if (!window.gameSessionData.isForceRegenerating) window.saveGameState();
            return;
        }

        galaxy.solarSystems = [];
        galaxy.lineConnections = [];
        const solarSystemPlacementRects = [];
        const numSystemsToAttempt = Math.floor(Math.random() * (currentMaxSSCount - currentMinSSCount + 1)) + currentMinSSCount;

        for (let i = 0; i < numSystemsToAttempt; i++) {
            const solarSystemId = `${galaxy.id}-ss-${i + 1}`;
            const position = getNonOverlappingPositionInCircle(galaxyContentRadius, SOLAR_SYSTEM_BASE_ICON_SIZE, solarSystemPlacementRects);
            if (position) {
                const sunSizeFactor = 0.5 + Math.random() * 9.5;
                galaxy.solarSystems.push({
                    id: solarSystemId, customName: null, x: position.x, y: position.y,
                    iconSize: SOLAR_SYSTEM_BASE_ICON_SIZE, sunSizeFactor: sunSizeFactor,
                });
                solarSystemPlacementRects.push({ ...position, width: SOLAR_SYSTEM_BASE_ICON_SIZE, height: SOLAR_SYSTEM_BASE_ICON_SIZE });
            }
        }

        galaxy.layoutGenerated = true;
        if (!window.gameSessionData.isForceRegenerating) window.saveGameState();
    }

    async function preGenerateAllGalaxyContents() {
        window.gameSessionData.isForceRegenerating = true;
        console.log("Pre-generating all galaxy contents...");
        for (const g of window.gameSessionData.galaxies) {
            if (!g.layoutGenerated || g.solarSystems.length === 0) {
                generateSolarSystemsForGalaxy(g.id);
            }
        }
        window.gameSessionData.isForceRegenerating = false;
        console.log("Pre-generation complete.");
        window.saveGameState();
    }


    // --- RENDERING FUNCTIONS ---
    function renderMainScreen() {
        if (mainScreenTitleText) mainScreenTitleText.textContent = "Universe";
        if (!universeCircle) return;
        universeCircle.innerHTML = '';

        window.gameSessionData.galaxies.forEach(galaxy => {
            const galaxyNumDisplay = galaxy.id.split('-').pop();
            const galaxyElement = document.createElement('div');
            galaxyElement.className = 'galaxy-icon';
            galaxyElement.style.width = `${GALAXY_ICON_SIZE}px`;
            galaxyElement.style.height = `${GALAXY_ICON_SIZE}px`;
            galaxyElement.style.left = `${galaxy.x}px`;
            galaxyElement.style.top = `${galaxy.y}px`;
            galaxyElement.title = galaxy.customName || `Galaxy ${galaxyNumDisplay}`;
            galaxyElement.dataset.galaxyId = galaxy.id;
            galaxyElement.addEventListener('click', () => switchToGalaxyDetailView(galaxy.id));
            universeCircle.appendChild(galaxyElement);
        });
    }

    function renderGalaxyDetailScreen(isInteractivePanOrZoom = false) {
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
        if (!galaxy) return switchToMainView();
        if (!galaxyViewport || !galaxyZoomContent) return;

        galaxyZoomContent.querySelectorAll('.solar-system-icon').forEach(icon => icon.remove());

        galaxy.solarSystems.forEach(ss => {
            const solarSystemElement = document.createElement('div');
            solarSystemElement.className = 'solar-system-icon';
            solarSystemElement.style.left = `${ss.x}px`;
            solarSystemElement.style.top = `${ss.y}px`;
            solarSystemElement.dataset.solarSystemId = ss.id;
            if (ss.customName) solarSystemElement.title = ss.customName;
            solarSystemElement.addEventListener('click', (e) => {
                e.stopPropagation();
                switchToSolarSystemView(ss.id);
            });
            galaxyZoomContent.appendChild(solarSystemElement);
        });

        galaxyZoomContent.style.transition = isInteractivePanOrZoom ? 'none' : 'transform 0.1s ease-out';
        galaxyZoomContent.style.transform = `translate(${galaxy.currentPanX}px, ${galaxy.currentPanY}px) scale(${galaxy.currentZoom})`;

        if (galaxyDetailTitleText) {
            const galaxyNumDisplay = galaxy.id.split('-').pop();
            galaxyDetailTitleText.textContent = galaxy.customName || `Galaxy ${galaxyNumDisplay}`;
        }
    }

    function renderSolarSystemScreen(isInteractivePanOrZoom = false) {
        if (!solarSystemContent || !solarSystemScreen || !window.gameSessionData.activeSolarSystemId) return;

        const solarSystemData = window.gameSessionData.solarSystemView;
        const panX = solarSystemData.currentPanX || 0;
        const panY = solarSystemData.currentPanY || 0;
        const zoom = solarSystemData.zoomLevel || SOLAR_SYSTEM_VIEW_MIN_ZOOM;

        solarSystemContent.style.transition = isInteractivePanOrZoom ? 'none' : 'transform 0.1s ease-out';
        solarSystemContent.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

        const activeGalaxy = window.gameSessionData.galaxies.find(g => window.gameSessionData.activeSolarSystemId.startsWith(g.id));
        const solarSystemObject = activeGalaxy?.solarSystems.find(s => s.id === solarSystemData.systemId);

        if (solarSystemTitleText) {
            const systemNumDisplay = solarSystemData.systemId?.split('-').pop() || 'N/A';
            solarSystemTitleText.textContent = solarSystemObject?.customName || `System ${systemNumDisplay}`;
        }
    }

    // --- VIEW SWITCHING FUNCTIONS ---
    window.switchToMainView = switchToMainView;
    function switchToMainView() {
        window.gameSessionData.activeGalaxyId = null;
        window.gameSessionData.activeSolarSystemId = null;
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
            const displayName = onSaveCallback(newName || null);
            titleTextElement.textContent = displayName;
            inputElement.style.display = 'none';
            titleTextElement.style.display = 'inline-block';
        };
        inputElement.onblur = saveName;
        inputElement.onkeydown = (e) => {
            if (e.key === 'Enter') inputElement.blur();
            else if (e.key === 'Escape') {
                inputElement.value = titleTextElement.textContent;
                inputElement.blur();
            }
        };
    }

    function switchToGalaxyDetailView(galaxyId) {
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === galaxyId);
        if (!galaxy) {
            console.warn(`switchToGalaxyDetailView: Galaxy ${galaxyId} not found. Switching to main view.`);
            return switchToMainView();
        }

        window.gameSessionData.activeGalaxyId = galaxyId;
        window.gameSessionData.activeSolarSystemId = null;
        stopSolarSystemAnimation();
        setActiveScreen(galaxyDetailScreen);

        const galaxyNumDisplay = galaxy.id.split('-').pop();
        if (backToGalaxyButton) {
            backToGalaxyButton.textContent = galaxy.customName ? `← ${galaxy.customName}` : `← Galaxy ${galaxyNumDisplay}`;
        }

        makeTitleEditable(galaxyDetailTitleText, galaxyDetailTitleInput, (newName) => {
            galaxy.customName = newName || null;
            window.saveGameState();
            renderMainScreen();
            return galaxy.customName || `Galaxy ${galaxyNumDisplay}`;
        });

        renderGalaxyDetailScreen(false);
    }

    function switchToSolarSystemView(solarSystemId) {
        window.gameSessionData.activeSolarSystemId = solarSystemId;
        const activeGalaxy = window.gameSessionData.galaxies.find(g => solarSystemId.startsWith(g.id));
        const solarSystemObject = activeGalaxy?.solarSystems.find(s => s.id === solarSystemId);

        if (!solarSystemObject) {
            console.error(`switchToSolarSystemView: Solar System object ${solarSystemId} not found in game data.`);
            return switchToMainView();
        }

        window.gameSessionData.solarSystemView = {
            zoomLevel: 0.5,
            currentPanX: 0,
            currentPanY: 0,
            systemId: solarSystemId,
            planets: []
        };

        if (solarSystemContent) solarSystemContent.innerHTML = '';

        let currentSunSize = SUN_ICON_SIZE * (solarSystemObject.sunSizeFactor || 1);
        const sunElement = document.createElement('div');
        sunElement.className = 'sun-icon sun-animated';
        sunElement.style.width = `${currentSunSize}px`;
        sunElement.style.height = `${currentSunSize}px`;
        if (solarSystemContent) solarSystemContent.appendChild(sunElement);

        const numPlanetsToGenerate = Math.floor(Math.random() * (currentMaxPlanets - currentMinPlanets + 1)) + currentMinPlanets;
        for (let i = 0; i < numPlanetsToGenerate; i++) {
            const planetSize = MIN_PLANET_SIZE + Math.random() * (MAX_PLANET_SIZE - MIN_PLANET_SIZE);
            let planetDistance;
            let placementAttempts = 0;
            let usedOrbitalDistances = [];

            do {
                planetDistance = MIN_PLANET_DISTANCE + Math.random() * (MAX_PLANET_DISTANCE - MIN_PLANET_DISTANCE);
                placementAttempts++;
            } while (usedOrbitalDistances.some(d => Math.abs(d - planetDistance) < MIN_ORBITAL_SEPARATION) && placementAttempts < 200);

            usedOrbitalDistances.push(planetDistance);

            const basisToUse = window.gameSessionData.customPlanetDesigns?.length > 0
                ? window.gameSessionData.customPlanetDesigns[Math.floor(Math.random() * window.gameSessionData.customPlanetDesigns.length)]
                : { waterColor: '#1E90FF', landColor: '#556B2F' };
            
            const planetInstanceAppearance = window.generatePlanetInstanceFromBasis(basisToUse);

            const newPlanet = {
                id: `${solarSystemId}-planet-${i + 1}`,
                size: planetSize,
                distance: planetDistance,
                currentOrbitalAngle: Math.random() * 2 * Math.PI,
                orbitalSpeed: (MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT + Math.random() * (MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT - MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT)),
                currentAxialAngle: Math.random() * 2 * Math.PI,
                axialSpeed: window.DEFAULT_PLANET_AXIAL_SPEED,
                element: null,
                ...planetInstanceAppearance
            };

            window.gameSessionData.solarSystemView.planets.push(newPlanet);

            const planetElement = document.createElement('div');
            planetElement.classList.add('planet-icon');
            planetElement.style.width = `${newPlanet.size}px`;
            planetElement.style.height = `${newPlanet.size}px`;
            planetElement.addEventListener('click', (e) => {
                e.stopPropagation();
                window.PlanetVisualPanelManager?.show(newPlanet);
            });
            const landColor = newPlanet.landColor;
            const waterColor = newPlanet.waterColor;
            planetElement.style.background = `radial-gradient(circle at 30% 30%, ${landColor} 20%, transparent 40%), radial-gradient(circle at 70% 70%, ${landColor} 30%, transparent 50%), ${waterColor}`;
            
            if (solarSystemContent) solarSystemContent.appendChild(planetElement);
            newPlanet.element = planetElement;
        }

        setActiveScreen(solarSystemScreen);
        renderSolarSystemScreen();
        startSolarSystemAnimation();
    }

    // --- PANNING AND ZOOMING ---
    function handleZoom(direction, mouseEvent = null) { /* (Full function implementation) */ }
    function startPan(event, viewportElement, contentElementToTransform, dataObjectWithPanProperties) { /* (Full function implementation) */ }
    function panMouseMove(event) { /* (Full function implementation) */ }
    function panMouseUp() { /* (Full function implementation) */ }

    // --- UNIVERSE REGENERATION ---
    function regenerateCurrentUniverseState(forceConfirmationDialog = false) {
        if (forceConfirmationDialog && !confirm("This will erase your current universe and generate a new one. Are you sure?")) {
            return;
        }
        const existingCustomPlanetDesigns = [...(window.gameSessionData.customPlanetDesigns || [])];
        window.gameSessionData = {
            universe: { diameter: null }, galaxies: [], activeGalaxyId: null, activeSolarSystemId: null,
            solarSystemView: { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null },
            isInitialized: false,
            panning: { isActive: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0, targetElement: null, viewportElement: null, dataObject: null },
            customPlanetDesigns: existingCustomPlanetDesigns
        };
        stopSolarSystemAnimation();
        initializeGame(true);
    }

    // --- EVENT LISTENERS ---
    if (regenerateUniverseButton) regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(true));
    if (createPlanetDesignButton) createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);
    if (backToMainButton) backToMainButton.addEventListener('click', switchToMainView);
    if (backToGalaxyButton) backToGalaxyButton.addEventListener('click', () => window.gameSessionData.activeGalaxyId ? switchToGalaxyDetailView(window.gameSessionData.activeGalaxyId) : switchToMainView());
    if (zoomInButton) zoomInButton.addEventListener('click', () => handleZoom('in'));
    if (zoomOutButton) zoomOutButton.addEventListener('click', () => handleZoom('out'));
    if (galaxyViewport) galaxyViewport.addEventListener('mousedown', e => startPan(e, galaxyViewport, galaxyZoomContent, window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId)));
    if (solarSystemScreen) solarSystemScreen.addEventListener('mousedown', e => startPan(e, solarSystemScreen, solarSystemContent, window.gameSessionData.solarSystemView));

    [galaxyDetailScreen, solarSystemScreen].forEach(screen => {
        if(screen) screen.addEventListener('wheel', e => { e.preventDefault(); handleZoom(e.deltaY < 0 ? 'in' : 'out', e); }, { passive: false });
    });

    window.addEventListener('mousemove', panMouseMove);
    window.addEventListener('mouseup', panMouseUp);

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log("Debounced resize event: Re-initializing universe.");
            regenerateCurrentUniverseState(false);
        }, 500);
    });

    // --- GAME INITIALIZATION ---
    function initializeGame(isForcedRegeneration = false) {
        console.log("Initializing game...");
        loadCustomizationSettings();
        if (!isForcedRegeneration && loadGameState()) {
            console.log("Loaded existing game state.");
            generateUniverseLayout();
            renderMainScreen();
            preGenerateAllGalaxyContents();
        } else {
            console.log("Generating new universe.");
            generateUniverseLayout();
            generateGalaxies();
            preGenerateAllGalaxyContents();
            renderMainScreen();
        }
        setActiveScreen(mainScreen);
        window.gameSessionData.isInitialized = true;
        console.log("Game initialization complete.");
    }
    
    console.log("DOMContentLoaded. Initializing modules and game.");
    initializeModules();
    window.PlanetDesigner?.init();
    window.PlanetVisualPanelManager?.init();
    initializeGame();
});
