import { startSolarSystemAnimation, stopSolarSystemAnimation } from './animationController.js';
import { PlanetDesigner } from './planetDesigner.js';
import { PlanetVisualPanelManager } from './planetVisualPanelManager.js';
import { HexPlanetViewController } from './hexPlanetViewController.js';
import { SolarSystemRenderer } from './solarSystemRenderer.js';

function initializeModules() {
 // The imports now directly provide the objects, so we can assign them directly.
 window.PlanetDesigner = PlanetDesigner;
 window.PlanetVisualPanelManager = PlanetVisualPanelManager;
 HexPlanetViewController.init();
}

document.addEventListener('DOMContentLoaded', () => {

  window.DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
  window.DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
  window.DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;
  const DEFAULT_NUM_GALAXIES = 3;
  const DEFAULT_MIN_SS_COUNT_CONST = 200;
  const DEFAULT_MAX_SS_COUNT_CONST = 300;
  const DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER = 1.0;
  const DEFAULT_MIN_PLANETS_PER_SYSTEM = 2;
  const DEFAULT_MAX_PLANETS_PER_SYSTEM = 8;
  const DEFAULT_SHOW_PLANET_ORBITS = false;
  const PLANET_EXPLORE_BUTTON_SIZE = 30;
  const PLANET_EXPLORE_BUTTON_MARGIN = 5;
  window.DEFAULT_PLANET_AXIAL_SPEED = 0.01;

  const BASE_MAX_PLANET_DISTANCE_FACTOR = 25;
  window.PLANET_ROTATION_SENSITIVITY = 0.75;

  const mainScreen = document.getElementById('main-screen');
  const galaxyDetailScreen = document.getElementById('galaxy-detail-screen');
  const solarSystemScreen = document.getElementById('solar-system-screen');
  const hexPlanetScreen = document.getElementById('hex-planet-screen');
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
  window.activeSolarSystemRenderer = null;
  let galaxyIconCache = {};

  window.generatePlanetInstanceFromBasis = function (basis, isForDesignerPreview = false) {
      // If not in preview mode, and custom designs exist, there's a 50% chance to use one.
      const useCustomDesign = !isForDesignerPreview && 
                              window.gameSessionData?.customPlanetDesigns?.length > 0 && 
                              Math.random() < 0.5;

      if (useCustomDesign) {
          const randomDesign = window.gameSessionData.customPlanetDesigns[
              Math.floor(Math.random() * window.gameSessionData.customPlanetDesigns.length)
          ];
          
          console.log("[DEBUG] Using custom template:", randomDesign.designId);
          
          return {
              waterColor: randomDesign.waterColor,
              landColor: randomDesign.landColor,
              continentSeed: Math.random(),
              minTerrainHeight: randomDesign.minTerrainHeight,
              maxTerrainHeight: randomDesign.maxTerrainHeight,
              oceanHeightLevel: randomDesign.oceanHeightLevel,
              riverBasin: randomDesign.riverBasin,
              forestDensity: randomDesign.forestDensity,
              sourceDesignId: randomDesign.designId,
              isExplorable: true, // Ensure it's explorable
          };
      }

      // Fallback to default generation for previews, or if the 50% chance fails.
      console.log("[DEBUG] Using default random generation.");
      
      return {
          waterColor: basis.waterColor || '#0000FF',
          landColor: basis.landColor || '#008000',
          continentSeed: isForDesignerPreview ? 
              (basis.continentSeed !== undefined ? basis.continentSeed : Math.random()) : 
              Math.random(),
          minTerrainHeight: (typeof basis.minTerrainHeight === 'number') ? 
              basis.minTerrainHeight : window.DEFAULT_MIN_TERRAIN_HEIGHT,
          maxTerrainHeight: (typeof basis.maxTerrainHeight === 'number') ? 
              basis.maxTerrainHeight : window.DEFAULT_MAX_TERRAIN_HEIGHT,
          oceanHeightLevel: (typeof basis.oceanHeightLevel === 'number') ? 
              basis.oceanHeightLevel : window.DEFAULT_OCEAN_HEIGHT_LEVEL,
          riverBasin: basis.riverBasin || 0.05,
          forestDensity: basis.forestDensity || 0.5,
          sourceDesignId: null,
          
          isExplorable: true,
          explorationData: {
              surfaceDetail: basis.surfaceDetail || 1.0,
              atmosphereColor: basis.atmosphereColor || '#87CEEB',
              rotationSpeed: basis.rotationSpeed || window.DEFAULT_PLANET_AXIAL_SPEED
          }
      };
  };

  // --- STATE VARIABLES ---
  let linesCtx;
  let currentStarfieldCleanup = null;
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
  const MIN_PLANET_SIZE = 50;
  const MAX_PLANET_SIZE = 150;
  let MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 3.0;
  let MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
  let ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
  let SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2;
  const MIN_ORBITAL_SEPARATION = 200;
  let MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.0005;
  let MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.005;
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
    panning: { 
      isActive: false, 
      startX: 0, 
      startY: 0, 
      initialPanX: 0, 
      initialPanY: 0, 
      targetElement: null, 
      viewportElement: null, 
      dataObject: null,
      mouseMoveHandler: null
    },
  };

  function switchToPlanetDesignerScreen() {
    setActiveScreen(planetDesignerScreen);
    if (window.PlanetDesigner?.activate) {
      window.PlanetDesigner.activate();
    } else {
      console.error("switchToPlanetDesignerScreen: PlanetDesigner module or activate function not found.");
    }
  }

  window.switchToPlanetDesignerScreen = switchToPlanetDesignerScreen;

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
                // Planet data is now generated on-demand in switchToSolarSystemView
            });
            gal.lineConnections = gal.lineConnections || [];
            gal.layoutGenerated = gal.layoutGenerated || false;
          });

          window.gameSessionData.customPlanetDesigns = (loadedState.customPlanetDesigns || []).map(design => {
            console.log("[DEBUG] Loading planet template:", {
              designId: design.designId,
              waterColor: design.waterColor,
              landColor: design.landColor
            });
            const migratedDesign = { ...design };
            if (migratedDesign.continentSeed === undefined) migratedDesign.continentSeed = Math.random();

            if (typeof migratedDesign.minTerrainHeight !== 'number' && Array.isArray(migratedDesign.minTerrainHeightRange)) {
              migratedDesign.minTerrainHeight = migratedDesign.minTerrainHeightRange[0];
            }
            if (typeof migratedDesign.maxTerrainHeight !== 'number' && Array.isArray(migratedDesign.maxTerrainHeightRange)) {
              migratedDesign.maxTerrainHeight = migratedDesign.maxTerrainHeightRange[1];
            }
            if (typeof migratedDesign.oceanHeightLevel !== 'number' && Array.isArray(migratedDesign.oceanHeightRange)) {
              migratedDesign.oceanHeightLevel = migratedDesign.oceanHeightRange[0];
            }

            delete migratedDesign.minTerrainHeightRange;
            delete migratedDesign.maxTerrainHeightRange;
            delete migratedDesign.oceanHeightRange;
            return migratedDesign;
          });
          console.log("[DEBUG] Total templates loaded:", window.gameSessionData.customPlanetDesigns.length);  
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

  function generateStarBackgroundCanvas(containerElement) {
    const existingBackground = containerElement.querySelector('.star-background');
    if (existingBackground) {
      existingBackground.remove();
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'star-background';
    containerElement.insertBefore(canvas, containerElement.firstChild);

    const updateCanvasSize = () => {
      const rect = containerElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    updateCanvasSize();

    const ctx = canvas.getContext('2d');
    const stars = [];

    const numStars = Math.floor((canvas.width * canvas.height) / 1000);
    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 0.5 + Math.random() * 2,
        parallaxFactor: 0.1 + Math.random() * 0.005 
      });
    }

    let offsetX = 0;
    let offsetY = 0;
    let targetOffsetX = 0;
    let targetOffsetY = 0;

    let animationFrame;
    function animate(timestamp) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      offsetX += (targetOffsetX - offsetX) * 0.005;
      offsetY += (targetOffsetY - offsetY) * 0.005;

      stars.forEach(star => {
        const twinkle = Math.sin(timestamp * 0.001 * star.twinkleSpeed) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * twinkle})`;
        
        let drawX = ((star.x + offsetX * star.parallaxFactor) + canvas.width) % canvas.width;
        let drawY = ((star.y + offsetY * star.parallaxFactor) + canvas.height) % canvas.height;
        
        ctx.beginPath();
        ctx.arc(drawX, drawY, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(animate);
    }

    animate(0);

    const updateStarOffset = (deltaX, deltaY) => {
      targetOffsetX = -deltaX;
      targetOffsetY = -deltaY;
    };

    const originalPanMouseMove = window.gameSessionData.panning.mouseMoveHandler;
    window.gameSessionData.panning.mouseMoveHandler = (event) => {
      if (!window.gameSessionData.panning.isActive) return;
      
      const deltaX = event.clientX - window.gameSessionData.panning.startX;
      const deltaY = event.clientY - window.gameSessionData.panning.startY;
      
      updateStarOffset(deltaX * 0.5, deltaY * 0.005);
    };

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
      if (originalPanMouseMove) {
        window.gameSessionData.panning.mouseMoveHandler = originalPanMouseMove;
      }
    };
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
    const screens = [mainScreen, galaxyDetailScreen, solarSystemScreen, planetDesignerScreen, hexPlanetScreen].filter(s => s);
    screens.forEach(s => s.classList.remove('active', 'panning-active'));

    if (screenToShow) {
      screenToShow.classList.add('active');
    } else {
      console.warn("setActiveScreen called with no screenToShow.");
    }

    if (zoomControlsElement) {
      zoomControlsElement.classList.toggle('visible', screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen);
    }

    const isOnOverlayScreen = (screenToShow === planetDesignerScreen || screenToShow === hexPlanetScreen);

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
        console.warn(`generateGalaxies: Could not place galaxy ${galaxyId}. Max attempts reached or invalid placement.`);
      }
    }
  }
 
  function getDistance(system1, system2) { 
    return Math.sqrt(Math.pow(system1.centerX - system2.centerX, 2) + Math.pow(system1.centerY - system2.centerY, 2)); 
  }

  function tryAddConnection(fromSystemId, toSystemId, currentConnectionsArray, connectionCountObj, allSolarSystemsList, maxDistanceLimit = null) {
    if (!fromSystemId || !toSystemId || fromSystemId === toSystemId) return false;
    if ((connectionCountObj[fromSystemId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM) return false;
    if ((connectionCountObj[toSystemId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM) return false;

    const sortedKey = [fromSystemId, toSystemId].sort().join('-');
    if (currentConnectionsArray.some(conn => [conn.fromId, conn.toId].sort().join('-') === sortedKey)) return false;

    if (maxDistanceLimit !== null) {
      const system1 = allSolarSystemsList.find(s => s.id === fromSystemId);
      const system2 = allSolarSystemsList.find(s => s.id === toSystemId);
      if (!system1 || !system2) {
        console.warn("tryAddConnection: Could not find one or both systems for distance check.", fromSystemId, toSystemId);
        return false;
      }
      if (getDistance(system1, system2) > maxDistanceLimit) return false;
    }
    return true;
  }

  function generateSolarSystemsForGalaxy(galaxyId) {
    const galaxy = window.gameSessionData.galaxies.find(g => g.id === galaxyId);
    if (!galaxy) {
      console.warn(`generateSolarSystemsForGalaxy: Galaxy ${galaxyId} not found.`);
      return;
    }
    
    if (!galaxyViewport) {
      console.warn(`generateSolarSystemsForGalaxy: galaxyViewport element not found. Cannot determine placement area for galaxy ${galaxyId}.`);
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

    if (galaxy.solarSystems.length < 2) {
      galaxy.layoutGenerated = true;
      if (!window.gameSessionData.isForceRegenerating) window.saveGameState();
      return;
    }

    const systemsWithCenters = galaxy.solarSystems.map(ss => ({ 
      ...ss, centerX: ss.x + ss.iconSize / 2, centerY: ss.y + ss.iconSize / 2 
    }));

    const systemConnectionCounts = {};
    const allowedMaxEuclideanDist = galaxyContentDiameter * MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT;
    const allowedMaxForcedDist = galaxyContentDiameter * MAX_FORCED_CONNECTION_DISTANCE_PERCENT;
    
    let connectedSystemIds = new Set();
    let unconnectedSystemIds = new Set(systemsWithCenters.map(s => s.id));

    if (systemsWithCenters.length > 0) {
      const firstSystem = systemsWithCenters[0];
      connectedSystemIds.add(firstSystem.id);
      unconnectedSystemIds.delete(firstSystem.id);

      while (unconnectedSystemIds.size > 0) {
        let bestConnection = null;
        let minConnectionDist = Infinity;

        for (const unconnectedId of unconnectedSystemIds) {
          const currentUnconnectedSys = systemsWithCenters.find(s => s.id === unconnectedId);
          for (const connectedId of connectedSystemIds) {
            const currentConnectedSys = systemsWithCenters.find(s => s.id === connectedId);
            if (!currentConnectedSys || !currentUnconnectedSys) continue;
            const dist = getDistance(currentUnconnectedSys, currentConnectedSys);
            if (dist < minConnectionDist) {
              minConnectionDist = dist;
              bestConnection = { fromId: connectedId, toId: unconnectedId, dist };
            }
          }
        }

        if (bestConnection) {
          let connectionMade = false;
          if (tryAddConnection(bestConnection.fromId, bestConnection.toId, galaxy.lineConnections, systemConnectionCounts, systemsWithCenters, allowedMaxEuclideanDist)) {
              connectionMade = true;
          } else {
            let forcedTargetId = null;
            let minForcedDist = Infinity;
            const targetUnconnectedSys = systemsWithCenters.find(s => s.id === bestConnection.toId);
            for (const connectedId of connectedSystemIds) {
              const potentialConnectedSys = systemsWithCenters.find(s => s.id === connectedId);
              if (potentialConnectedSys && targetUnconnectedSys) {
                const dist = getDistance(targetUnconnectedSys, potentialConnectedSys);
                if (dist < minForcedDist && tryAddConnection(bestConnection.toId, connectedId, galaxy.lineConnections, systemConnectionCounts, systemsWithCenters, allowedMaxForcedDist)) {
                  minForcedDist = dist;
                  forcedTargetId = connectedId;
                }
              }
            }
            if (forcedTargetId) {
              bestConnection.fromId = forcedTargetId;
              connectionMade = true;
            } else {
              let ultimateTargetId = null;
              let minUltimateDist = Infinity;
              for (const connectedId of connectedSystemIds) {
                const potentialConnectedSys = systemsWithCenters.find(s => s.id === connectedId);
                if (potentialConnectedSys && targetUnconnectedSys) {
                  const dist = getDistance(targetUnconnectedSys, potentialConnectedSys);
                  if (dist < minUltimateDist && tryAddConnection(bestConnection.toId, connectedId, galaxy.lineConnections, systemConnectionCounts, systemsWithCenters, null)) {
                    minUltimateDist = dist;
                    ultimateTargetId = connectedId;
                  }
                }
              }
              if (ultimateTargetId) {
                  bestConnection.fromId = ultimateTargetId;
                  connectionMade = true;
              }
            }
          }

          if (connectionMade) {
              galaxy.lineConnections.push({ fromId: bestConnection.fromId, toId: bestConnection.toId });
              systemConnectionCounts[bestConnection.fromId] = (systemConnectionCounts[bestConnection.fromId] || 0) + 1;
              systemConnectionCounts[bestConnection.toId] = (systemConnectionCounts[bestConnection.toId] || 0) + 1;
              connectedSystemIds.add(bestConnection.toId);
              unconnectedSystemIds.delete(bestConnection.toId);
          } else {
            console.warn(`System ${bestConnection.toId} could not be connected to the main network. Removing from unconnected set.`);
            unconnectedSystemIds.delete(bestConnection.toId); 
          }
        } else {
          if (unconnectedSystemIds.size > 0 && connectedSystemIds.size === 0 && systemsWithCenters.length > 0) {
            const nextUnconnectedId = Array.from(unconnectedSystemIds)[0]; 
            connectedSystemIds.add(nextUnconnectedId); 
            unconnectedSystemIds.delete(nextUnconnectedId);
          } else {
            console.warn(`generateSolarSystemsForGalaxy: Could not connect all systems. ${unconnectedSystemIds.size} systems remain unconnected.`);
            break; 
          }
        }
      }
    }
    systemsWithCenters.forEach(sys1 => {
      const desiredConnections = getWeightedNumberOfConnections();
      let connectionsToAdd = Math.min(desiredConnections, MAX_CONNECTIONS_PER_SYSTEM) - (systemConnectionCounts[sys1.id] || 0);
      if (connectionsToAdd <= 0) return;

      let potentialTargets = systemsWithCenters
        .filter(sys2 => sys1.id !== sys2.id)
        .map(sys2 => ({ ...sys2, dist: getDistance(sys1, sys2) }))
        .filter(sys2 => sys2.dist <= allowedMaxEuclideanDist)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS);

      for (const sys2 of potentialTargets) {
        if (connectionsToAdd <= 0) break;
        if (tryAddConnection(sys1.id, sys2.id, galaxy.lineConnections, systemConnectionCounts, systemsWithCenters, allowedMaxEuclideanDist)) {
          galaxy.lineConnections.push({ fromId: sys1.id, toId: sys2.id });
          systemConnectionCounts[sys1.id]++;
          systemConnectionCounts[sys2.id] = (systemConnectionCounts[sys2.id] || 0) + 1;
          connectionsToAdd--;
        }
      }
    });

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

  function drawGalaxyLines(galaxy) {
    if (!solarSystemLinesCanvasEl || !galaxyZoomContent) return;
    
    // MODIFICATION: Set a fixed canvas size based on the unscaled content diameter.
    // This prevents the canvas from being cleared and redrawn on pan/zoom.
    const galaxyContentDiameter = parseFloat(galaxyZoomContent.style.width);
    if (solarSystemLinesCanvasEl.width !== galaxyContentDiameter) {
        solarSystemLinesCanvasEl.width = galaxyContentDiameter;
        solarSystemLinesCanvasEl.height = galaxyContentDiameter;
    }
    
    if (!linesCtx) linesCtx = solarSystemLinesCanvasEl.getContext('2d');
    if (!linesCtx) return;

    linesCtx.clearRect(0, 0, solarSystemLinesCanvasEl.width, solarSystemLinesCanvasEl.height);
    if (!galaxy?.lineConnections?.length) return;

    linesCtx.strokeStyle = FIXED_COLORS.connectionLine;
    linesCtx.lineWidth = 0.5;
    linesCtx.setLineDash([]);

    const systemPositions = Object.fromEntries(
        galaxy.solarSystems.map(ss => [ss.id, { x: ss.x + ss.iconSize / 2, y: ss.y + ss.iconSize / 2 }])
    );

    galaxy.lineConnections.forEach(connection => {
      const fromPos = systemPositions[connection.fromId];
      const toPos = systemPositions[connection.toId];
      if (fromPos && toPos) {
        linesCtx.beginPath();
        linesCtx.moveTo(fromPos.x, fromPos.y);
        linesCtx.lineTo(toPos.x, toPos.y);
        linesCtx.stroke();
      }
    });
  }

  function renderGalaxyDetailScreen(isInteractivePanOrZoom = false) {
    const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
    if (!galaxy) return switchToMainView();
    if (!galaxyViewport || !galaxyZoomContent) return;

    // Set container dimensions
    const galaxyContentDiameter = window.gameSessionData.universe.diameter || 500;
    galaxyViewport.style.width = `${galaxyContentDiameter}px`;
    galaxyViewport.style.height = `${galaxyContentDiameter}px`;
    // MODIFICATION: Explicitly set the zoom content and line canvas size.
    galaxyZoomContent.style.width = `${galaxyContentDiameter}px`;
    galaxyZoomContent.style.height = `${galaxyContentDiameter}px`;
    solarSystemLinesCanvasEl.style.width = `${galaxyContentDiameter}px`;
    solarSystemLinesCanvasEl.style.height = `${galaxyContentDiameter}px`;
    
    // If we haven't rendered this galaxy's icons before, create and cache them.
    if (!galaxyIconCache[galaxy.id]) {
        galaxyZoomContent.innerHTML = ''; // Clear previous galaxy's icons
        const fragment = document.createDocumentFragment();

        galaxy.solarSystems.forEach(ss => {
            const solarSystemElement = document.createElement('div');
            solarSystemElement.className = 'solar-system-icon';
            solarSystemElement.style.width = `${ss.iconSize}px`;
            solarSystemElement.style.height = `${ss.iconSize}px`;
            solarSystemElement.style.left = `${ss.x}px`;
            solarSystemElement.style.top = `${ss.y}px`;
            solarSystemElement.dataset.solarSystemId = ss.id;
            if (ss.customName) solarSystemElement.title = ss.customName;
            solarSystemElement.addEventListener('click', (e) => {
                e.stopPropagation();
                switchToSolarSystemView(ss.id);
            });
            fragment.appendChild(solarSystemElement);
        });
        
        // Add the lines canvas first, then the icons
        galaxyZoomContent.appendChild(solarSystemLinesCanvasEl);
        galaxyZoomContent.appendChild(fragment);

        // Mark this galaxy as rendered in our cache
        galaxyIconCache[galaxy.id] = true;
    }
    
    drawGalaxyLines(galaxy);

    // This is the only part that should run on every pan/zoom
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
    if (window.activeSolarSystemRenderer) {
      window.activeSolarSystemRenderer.dispose();
      window.activeSolarSystemRenderer = null;
    }
    window.gameSessionData.activeGalaxyId = null;
    window.gameSessionData.activeSolarSystemId = null;
    stopSolarSystemAnimation();
    setActiveScreen(mainScreen);
      if (mainScreen) {
          if (currentStarfieldCleanup) {
              currentStarfieldCleanup();
          }
          currentStarfieldCleanup = generateStarBackgroundCanvas(mainScreen);
      }
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
    if (window.activeSolarSystemRenderer) {
      window.activeSolarSystemRenderer.dispose();
      window.activeSolarSystemRenderer = null;
    }

    const galaxy = window.gameSessionData.galaxies.find(g => g.id === galaxyId);
    if (!galaxy) {
      console.warn(`switchToGalaxyDetailView: Galaxy ${galaxyId} not found. Switching to main view.`);
      return switchToMainView();
    }

    window.gameSessionData.activeGalaxyId = galaxyId;
    const galaxyNumDisplay = galaxy.id.split('-').pop();
    if (backToGalaxyButton) {
      backToGalaxyButton.textContent = galaxy.customName ? `← ${galaxy.customName}` : `← Galaxy ${galaxyNumDisplay}`;
        if (window.PlanetVisualPanelManager?.isVisible()) {
          window.PlanetVisualPanelManager.hide();
      }
    }
    
    window.gameSessionData.activeSolarSystemId = null;
    stopSolarSystemAnimation();

    galaxy.currentZoom = galaxy.currentZoom || 1.0;
    galaxy.currentPanX = galaxy.currentPanX || 0;
    galaxy.currentPanY = galaxy.currentPanY || 0;

    if (galaxyDetailTitleText) { 
      galaxyDetailTitleText.textContent = galaxy.customName || `Galaxy ${galaxyNumDisplay}`; 
      galaxyDetailTitleText.style.display = 'inline-block'; 
    } 
    if (galaxyDetailTitleInput) galaxyDetailTitleInput.style.display = 'none';
    
    setActiveScreen(galaxyDetailScreen);
      if (galaxyDetailScreen) {
          if (currentStarfieldCleanup) {
              currentStarfieldCleanup();
          }
          currentStarfieldCleanup = generateStarBackgroundCanvas(galaxyDetailScreen);
      }
    makeTitleEditable(galaxyDetailTitleText, galaxyDetailTitleInput, (newName) => { 
      galaxy.customName = newName || null; 
      window.saveGameState(); 
      renderMainScreen();
      if (window.gameSessionData.activeSolarSystemId?.startsWith(galaxy.id) && backToGalaxyButton) {
        backToGalaxyButton.textContent = galaxy.customName ? `← ${galaxy.customName}` : `← Galaxy ${galaxyNumDisplay}`;
      }
      return galaxy.customName || `Galaxy ${galaxyNumDisplay}`; 
    });

    if (galaxyViewport && window.gameSessionData.universe.diameter) {
      galaxyViewport.style.width = `${window.gameSessionData.universe.diameter}px`;
      galaxyViewport.style.height = `${window.gameSessionData.universe.diameter}px`;
    }

    if (!galaxy.layoutGenerated) {
      console.log(`switchToGalaxyDetailView: Galaxy ${galaxy.id} layout not generated. Generating now.`);
      setTimeout(() => {
        function attemptGeneration(retriesLeft = 5) {
          if (galaxyViewport?.offsetWidth > 0) {
            generateSolarSystemsForGalaxy(galaxyId);
            renderGalaxyDetailScreen(false);
          } else if (retriesLeft > 0) {
            requestAnimationFrame(() => attemptGeneration(retriesLeft - 1));
          } else {
            console.warn("switchToGalaxyDetailView: galaxyViewport did not get dimensions.");
            galaxy.layoutGenerated = true;
            renderGalaxyDetailScreen(false);
          }
        }
        attemptGeneration();
      }, 50);
    } else {
      renderGalaxyDetailScreen(false);
    }
  }

  function calculateInitialZoom(screenWidth, screenHeight) {
    const horizontalZoom = screenWidth / (SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2);
    const verticalZoom = screenHeight / (SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2);
    
    const minRequiredZoom = Math.max(horizontalZoom, verticalZoom);
    
    return Math.max(SOLAR_SYSTEM_VIEW_MIN_ZOOM, minRequiredZoom * 1.2);
  }
    
  function switchToSolarSystemView(solarSystemId) {
      if (window.activeSolarSystemRenderer) {
          window.activeSolarSystemRenderer.dispose();
          window.activeSolarSystemRenderer = null;
      }
      stopSolarSystemAnimation();

      window.gameSessionData.activeSolarSystemId = solarSystemId;
      const activeGalaxy = window.gameSessionData.galaxies.find(g => solarSystemId.startsWith(g.id));
      const solarSystemObject = activeGalaxy?.solarSystems.find(s => s.id === solarSystemId);

      if (!solarSystemObject) {
          console.error(`Solar System object ${solarSystemId} not found.`);
          return switchToMainView();
      }

      // --- FIX: GENERATE PLANETS IF THEY DON'T EXIST ---
      if (!solarSystemObject.planets || solarSystemObject.planets.length === 0) {
          console.log(`Generating planets for ${solarSystemId}`);
          solarSystemObject.planets = [];
          // MODIFICATION: Generate a random number of planets from 0 to 8
          const numPlanets = Math.floor(Math.random() * 9);
          let lastOrbitalRadius = MIN_PLANET_DISTANCE;

          for (let i = 0; i < numPlanets; i++) {
              const planetData = generatePlanetInstanceFromBasis({});
              const orbitalRadius = lastOrbitalRadius + MIN_ORBITAL_SEPARATION + Math.random() * 800;
              
              solarSystemObject.planets.push({
                  ...planetData,
                  id: `${solarSystemId}-planet-${i}`,
                  planetName: `Planet ${i + 1}`, // Give a default name
                  size: MIN_PLANET_SIZE + Math.random() * (MAX_PLANET_SIZE - MIN_PLANET_SIZE),
                  orbitalRadius: orbitalRadius,
                  orbitalSpeed: Math.sqrt(10000 / orbitalRadius), // Gravitational-like speed
                  currentOrbitalAngle: Math.random() * 2 * Math.PI,
                  axialSpeed: (Math.random() - 0.5) * 0.05,
                  currentAxialAngle: Math.random() * 2 * Math.PI,
              });
              lastOrbitalRadius = orbitalRadius + MIN_ORBITAL_SEPARATION;
          }
      }
      
      const solarSystemDataForRenderer = {
          id: solarSystemObject.id,
          sun: {
              size: solarSystemObject.sunSizeFactor,
              type: Math.floor(Math.random() * 5)
          },
          planets: solarSystemObject.planets.map(p => ({...p}))
      };
      
      window.gameSessionData.solarSystemView.systemId = solarSystemId;
      window.gameSessionData.solarSystemView.planets = solarSystemObject.planets;
      
      const systemNumDisplay = solarSystemId.split('-').pop();
      if (solarSystemTitleText) {
          solarSystemTitleText.textContent = solarSystemObject?.customName || `System ${systemNumDisplay}`;
      }
      makeTitleEditable(solarSystemTitleText, solarSystemTitleInput, (newName) => {
          if (solarSystemObject) {
              solarSystemObject.customName = newName || null;
              window.saveGameState();
              renderGalaxyDetailScreen();
              return solarSystemObject.customName || `System ${systemNumDisplay}`;
          }
          return `System ${systemNumDisplay}`;
      });

      setActiveScreen(solarSystemScreen);
      SolarSystemRenderer.init(solarSystemDataForRenderer);
      window.activeSolarSystemRenderer = SolarSystemRenderer;
      
      startSolarSystemAnimation();
  }

  window.switchToHexPlanetView = (planetData, onBackCallback) => {
      if (!planetData) {
          console.error("switchToHexPlanetView: No planet data provided.");
          return;
      }

      const hexPlanetScreen = document.getElementById('hex-planet-screen');
      if (!hexPlanetScreen) {
          console.error("switchToHexPlanetView: hex-planet-screen element not found!");
          return;
      }

      setActiveScreen(hexPlanetScreen);
      stopSolarSystemAnimation(); // Stop animation when entering hex view

      if (HexPlanetViewController && typeof HexPlanetViewController.activate === 'function') {
          const fallbackCallback = () => window.switchToMainView();
          HexPlanetViewController.activate(planetData, typeof onBackCallback === 'function' ? onBackCallback : fallbackCallback);
      } else {
          console.error("HexPlanetViewController or its .activate() method is not available.");
      }
  };
  
  // --- PANNING AND ZOOMING ---

  function clampSolarSystemPan(solarSystemDataObject, viewportWidth, viewportHeight) { 
    if (!solarSystemDataObject || !viewportWidth || !viewportHeight) { 
      if (solarSystemDataObject) { 
        solarSystemDataObject.currentPanX = 0; 
        solarSystemDataObject.currentPanY = 0; 
      }
      return; 
    }
    const zoom = solarSystemDataObject.zoomLevel;
    const contentWidth = SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2; 
    const contentHeight = SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2;
    const scaledContentWidth = contentWidth * zoom;
    const scaledContentHeight = contentHeight * zoom;
    const maxPanX = Math.max(0, (scaledContentWidth - viewportWidth) / 2);
    const maxPanY = Math.max(0, (scaledContentHeight - viewportHeight) / 2);

    solarSystemDataObject.currentPanX = Math.max(-maxPanX, Math.min(maxPanX, solarSystemDataObject.currentPanX));
    solarSystemDataObject.currentPanY = Math.max(-maxPanY, Math.min(maxPanY, solarSystemDataObject.currentPanY));
  }

  function clampGalaxyPan(galaxyDataObject) { 
    if (!galaxyDataObject || !galaxyViewport) return; 
    
    const viewportWidth = galaxyViewport.offsetWidth;
    const viewportHeight = galaxyViewport.offsetHeight;
    const zoom = galaxyDataObject.currentZoom;

    if (zoom <= GALAXY_VIEW_MIN_ZOOM) {
      galaxyDataObject.currentPanX = 0;
      galaxyDataObject.currentPanY = 0;
    } else {
      const contentDiameter = window.gameSessionData.universe.diameter || 500;
      const scaledContentWidth = contentDiameter * zoom;
      const scaledContentHeight = contentDiameter * zoom;
      const maxPanX = Math.max(0, (scaledContentWidth - viewportWidth) / 2);
      const maxPanY = Math.max(0, (scaledContentHeight - viewportHeight) / 2);
      galaxyDataObject.currentPanX = Math.max(-maxPanX, Math.min(maxPanX, galaxyDataObject.currentPanX));
      galaxyDataObject.currentPanY = Math.max(-maxPanY, Math.min(maxPanY, galaxyDataObject.currentPanY));
    }
  }

  function handleZoom(direction, mouseEvent = null) {
      const activeScreen = document.querySelector('.screen.active');
      
      if (activeScreen === galaxyDetailScreen) {
          const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
          if (!galaxy) return;
          
          const viewData = {
              target: galaxy, viewElement: galaxyViewport, clampFn: clampGalaxyPan, renderFn: renderGalaxyDetailScreen,
              minZoom: GALAXY_VIEW_MIN_ZOOM, maxZoom: GALAXY_VIEW_MAX_ZOOM, zoomKey: 'currentZoom', panXKey: 'currentPanX', panYKey: 'currentPanY'
          };

          const { target, viewElement, clampFn, renderFn, minZoom, maxZoom, zoomKey, panXKey, panYKey } = viewData;

          const oldZoom = target[zoomKey];
          let newZoom = oldZoom * (1 + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP));
          newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

          if (Math.abs(oldZoom - newZoom) < 0.0001) return;

          if (mouseEvent && viewElement) {
              const rect = viewElement.getBoundingClientRect();
              const mouseX = mouseEvent.clientX - rect.left;
              const mouseY = mouseEvent.clientY - rect.top;
              const mouseRelX = mouseX - viewElement.offsetWidth / 2;
              const mouseRelY = mouseY - viewElement.offsetHeight / 2;
              const worldX = (mouseRelX - target[panXKey]) / oldZoom;
              const worldY = (mouseRelY - target[panYKey]) / oldZoom;
              target[panXKey] = mouseRelX - (worldX * newZoom);
              target[panYKey] = mouseRelY - (worldY * newZoom);
          }
          target[zoomKey] = newZoom;

          clampFn(target, viewElement.offsetWidth, viewElement.offsetHeight);
          renderFn(true);

      } else if (activeScreen === solarSystemScreen) {
          const ssViewData = window.gameSessionData.solarSystemView;
          let newZoom = ssViewData.zoomLevel * (1 + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP));
          newZoom = Math.max(SOLAR_SYSTEM_VIEW_MIN_ZOOM, Math.min(SOLAR_SYSTEM_VIEW_MAX_ZOOM, newZoom));
          ssViewData.zoomLevel = newZoom;
          
          if (window.activeSolarSystemRenderer) {
              window.activeSolarSystemRenderer.handlePanAndZoom(ssViewData.currentPanX, ssViewData.currentPanY, ssViewData.zoomLevel);
          }
      }
  }
    
  function startPan(event, viewportElement, contentElementToTransform, dataObjectWithPanProperties) {
    if (event.button !== 0 || event.target.closest('button, .solar-system-icon, .planet-icon')) {
      console.log("SCRIPT: startPan returned early. Clicked on:", event.target);
      return;
    }

    const p = window.gameSessionData.panning;
    p.isActive = true;
    p.startX = event.clientX;
    p.startY = event.clientY;

    const panXKey = 'currentPanX';
    const panYKey = 'currentPanY';
    p.initialPanX = dataObjectWithPanProperties[panXKey] || 0;
    p.initialPanY = dataObjectWithPanProperties[panYKey] || 0;
    p.targetElement = contentElementToTransform;
    p.viewportElement = viewportElement;
    p.dataObject = dataObjectWithPanProperties;
      
    if (viewportElement) viewportElement.classList.add('dragging');
    if (contentElementToTransform) contentElementToTransform.style.transition = 'none';
    event.preventDefault();
  }

  function panMouseMove(event) {
    const p = window.gameSessionData.panning;
    if (!p.isActive) return;

    const deltaX = event.clientX - p.startX;
    const deltaY = event.clientY - p.startY;

    const zoomKey = p.dataObject.hasOwnProperty('currentZoom') ? 'currentZoom' : 'zoomLevel';
    const zoom = p.dataObject[zoomKey] || 1.0;

    const zoomCompensation = Math.max(0.5, Math.min(1, 1 / zoom));
    
    const panXKey = 'currentPanX';
    const panYKey = 'currentPanY';
    
    p.dataObject[panXKey] = p.initialPanX + (deltaX * zoomCompensation);
    p.dataObject[panYKey] = p.initialPanY + (deltaY * zoomCompensation);

    if (p.mouseMoveHandler) {
      p.mouseMoveHandler(event);
    }

    if (p.viewportElement === galaxyViewport) {
      clampGalaxyPan(p.dataObject);
      renderGalaxyDetailScreen(true);
      } else if (p.viewportElement === solarSystemScreen) {
        if (window.activeSolarSystemRenderer) {
            window.activeSolarSystemRenderer.handlePanAndZoom(p.dataObject.currentPanX, p.dataObject.currentPanY, p.dataObject.zoomLevel);
        }
      }
  }

  function panMouseUp() {
    const p = window.gameSessionData.panning;
    if (!p.isActive) return;
    if (p.viewportElement) p.viewportElement.classList.remove('dragging');
    if (p.targetElement) p.targetElement.style.transition = '';
    p.isActive = false;
  }

  let lastFrameTime = 0;
  function animate(currentTime) {
      requestAnimationFrame(animate);
      
      const deltaTime = currentTime - lastFrameTime;
      lastFrameTime = currentTime;
  }
  requestAnimationFrame(animate);
    
  // --- UNIVERSE REGENERATION ---
  
  function regenerateCurrentUniverseState(forceConfirmationDialog = false) {
    if (forceConfirmationDialog && !confirm("This will erase your current universe and generate a new one. Are you sure?")) {
      return;
    }

    if (window.activeSolarSystemRenderer) {
        window.activeSolarSystemRenderer.dispose();
        window.activeSolarSystemRenderer = null;
    }
    
    const existingCustomPlanetDesigns = [...(window.gameSessionData.customPlanetDesigns || [])];
    
    galaxyIconCache = {};
    window.gameSessionData.universe = { diameter: null };
    window.gameSessionData.galaxies = [];
    window.gameSessionData.activeGalaxyId = null;
    window.gameSessionData.activeSolarSystemId = null;
    window.gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };
    window.gameSessionData.isInitialized = false;
    window.gameSessionData.customPlanetDesigns = existingCustomPlanetDesigns;
    
    if (universeCircle) universeCircle.innerHTML = '';
    if (galaxyZoomContent) {
      const linesCanvas = galaxyZoomContent.querySelector('#solar-system-lines-canvas');
      galaxyZoomContent.innerHTML = '';
      if (linesCanvas) galaxyZoomContent.appendChild(linesCanvas);
    }
    if (solarSystemContent) solarSystemContent.innerHTML = '';
    
    stopSolarSystemAnimation();
    initializeGame(true);
  }

  // --- EVENT LISTENERS ---
  if (regenerateUniverseButton) regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(true));
  if (createPlanetDesignButton) createPlanetDesignButton.addEventListener('click', switchToPlanetDesignerScreen);
  if (backToMainButton) backToMainButton.addEventListener('click', switchToMainView);
  if (backToGalaxyButton) backToGalaxyButton.addEventListener('click', () => {
      if (window.gameSessionData.activeGalaxyId) {
          switchToGalaxyDetailView(window.gameSessionData.activeGalaxyId);
      } else {
          switchToMainView();
      }
  });
  if (zoomInButton) zoomInButton.addEventListener('click', () => handleZoom('in'));
  if (zoomOutButton) zoomOutButton.addEventListener('click', () => handleZoom('out'));

  if (galaxyViewport) galaxyViewport.addEventListener('mousedown', e => {
      const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
      if (galaxy) {
          startPan(e, galaxyViewport, galaxyZoomContent, galaxy);
      }
  });

  if (solarSystemScreen) {
    console.log("SCRIPT: Attaching mousedown listener to solarSystemScreen");

    solarSystemScreen.addEventListener('mousedown', e => {
      if (e.target.closest('button, .solar-system-icon, .planet-icon')) {
        console.log("SCRIPT: Mousedown on interactive element. Pan will not start.");
        return; 
      }

      console.log("SCRIPT: Mousedown on solarSystemScreen FIRED. Target:", e.target.id || e.target.className);

      if (window.gameSessionData.solarSystemView &&
        window.gameSessionData.solarSystemView.systemId &&
        window.gameSessionData.solarSystemView.systemId === window.gameSessionData.activeSolarSystemId) {
          
        console.log("SCRIPT: Conditions met for solar system pan. Calling startPan.");
        startPan(e, solarSystemScreen, solarSystemContent, window.gameSessionData.solarSystemView);
      } else {
        console.warn("SCRIPT: Pan on solarSystemScreen aborted - view conditions not met.");
      }
    });
  } else {
    console.error("SCRIPT: solarSystemScreen is null. Cannot attach mousedown listener.");
  }

  const zoomableScreens = [galaxyDetailScreen, solarSystemScreen];
  zoomableScreens.forEach(screen => {
    if (screen) {
      console.log(`SCRIPT: Attaching wheel listener to ${screen.id}`);
      screen.addEventListener('wheel', e => {
        e.preventDefault(); 
        handleZoom(e.deltaY < 0 ? 'in' : 'out', e); 
      }, { passive: false }); 
    } else {
      if (screen === galaxyDetailScreen) console.error("SCRIPT: wheel listener - galaxyDetailScreen is null.");
      if (screen === solarSystemScreen) console.error("SCRIPT: wheel listener - solarSystemScreen is null.");
    }
  });
  
  window.addEventListener('mousemove', panMouseMove);
  window.addEventListener('mouseup', panMouseUp);
  
  let resizeTimeout;
  window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
          console.log("Debounced resize event: Adjusting layout.");

          if (mainScreen.classList.contains('active')) {
              generateUniverseLayout();
              renderMainScreen();
          }

          if (window.activeSolarSystemRenderer?.handleResize) {
            window.activeSolarSystemRenderer.handleResize();
          }
          
          const activeScreen = document.querySelector('.screen.active');
          if (activeScreen === galaxyDetailScreen) {
              const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
              if (galaxy) {
                  clampGalaxyPan(galaxy);
                  renderGalaxyDetailScreen(true);
              }
          }
          
      }, 250); 
  });
    
  // --- GAME INITIALIZATION ---
  function initializeGame(isForcedRegeneration = false) {
    console.log("Initializing game...");
    loadCustomizationSettings();

    const designsBeforeLoad = [...(window.gameSessionData.customPlanetDesigns || [])];

    if (!isForcedRegeneration && loadGameState()) {
      console.log("Loaded existing game state.");
      if (universeCircle && window.gameSessionData.universe.diameter) {
        universeCircle.style.width = `${window.gameSessionData.universe.diameter}px`;
        universeCircle.style.height = `${window.gameSessionData.universe.diameter}px`;
      } else {
        generateUniverseLayout(); 
      }
      setActiveScreen(mainScreen);
      renderMainScreen();
      preGenerateAllGalaxyContents();
    } else {
      if (!isForcedRegeneration) console.log("No valid save found. Generating new universe.");
      window.gameSessionData.customPlanetDesigns = designsBeforeLoad; 
      generateUniverseLayout();
      generateGalaxies();
      setActiveScreen(mainScreen);
      renderMainScreen();
      preGenerateAllGalaxyContents();
    }
    window.gameSessionData.isInitialized = true;
    console.log("Game initialization complete.");
  }

  console.log("DOMContentLoaded. Initializing modules and game.");
  initializeModules();
  
  if (window.PlanetDesigner?.init) {
    window.PlanetDesigner.init();
  } else {
    console.error("PlanetDesigner module or init function is missing.");
  }

  if (window.PlanetVisualPanelManager?.init) {
    window.PlanetVisualPanelManager.init();
  } else {
    console.error("PlanetVisualPanelManager module or its init function is missing.");
  }

  initializeGame();
});
