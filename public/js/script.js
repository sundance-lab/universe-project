// public/js/script.js

// --- MODULE IMPORTS ---
import '../styles.css';
import { startSolarSystemAnimation, stopSolarSystemAnimation, isSolarSystemAnimationRunning } from './animationController.js';
import * as PlanetDesigner from './planetDesigner.js';
import * as PlanetVisualPanelManager from './planetVisualPanelManager.js';

// --- MODULE INITIALIZATION ---
function initializeModules() {
    window.PlanetDesigner = PlanetDesigner.PlanetDesigner;
    window.PlanetVisualPanelManager = PlanetVisualPanelManager.PlanetVisualPanelManager;
}

// =================================================================================================
// --- DOMContentLoaded EVENT ---
// =================================================================================================
document.addEventListener('DOMContentLoaded', () => {

    // --- CONSTANTS ---
    window.DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
    window.DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
    window.DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;
    const DEFAULT_NUM_GALAXIES = 3;
    const DEFAULT_MIN_SS_COUNT_CONST = 200;
    const DEFAULT_MAX_SS_COUNT_CONST = 300;
    const DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER = 1.0;
    const DEFAULT_MIN_PLANETS_PER_SYSTEM = 0;
    const DEFAULT_MAX_PLANETS_PER_SYSTEM = 3;
    const DEFAULT_SHOW_PLANET_ORBITS = true;
    window.DEFAULT_PLANET_AXIAL_SPEED = 0.01;
    const BASE_MAX_PLANET_DISTANCE_FACTOR = 25;
    window.PLANET_ROTATION_SENSITIVITY = 0.75;
    const GALAXY_ICON_SIZE = 60;
    const SOLAR_SYSTEM_BASE_ICON_SIZE = 2.5;
    const SUN_ICON_SIZE = 60;
    const MAX_PLACEMENT_ATTEMPTS = 150;
    const GALAXY_VIEW_MIN_ZOOM = 1.0;
    const GALAXY_VIEW_MAX_ZOOM = 5.0;
    const SOLAR_SYSTEM_VIEW_MIN_ZOOM = 0.05;
    const SOLAR_SYSTEM_VIEW_MAX_ZOOM = 10.0;
    const ZOOM_STEP = 0.2;
    const MIN_PLANET_SIZE = 5;
    const MAX_PLANET_SIZE = 15;
    const MIN_ORBITAL_SEPARATION = 20;
    const FIXED_COLORS = {
        universeBg: '#100520',
        connectionLine: 'rgba(128, 128, 255, 0.4)',
    };

    // --- DOM ELEMENTS ---
    const mainScreen = document.getElementById('main-screen');
    const galaxyDetailScreen = document.getElementById('galaxy-detail-screen');
    const solarSystemScreen = document.getElementById('solar-system-screen');
    const planetDesignerScreen = document.getElementById('planet-designer-screen');
    const universeCircle = document.getElementById('universe-circle');
    const galaxyViewport = document.getElementById('galaxy-viewport');
    const galaxyZoomContent = document.getElementById('galaxy-zoom-content');
    const solarSystemLinesCanvasEl = document.getElementById('solar-system-lines-canvas');
    const solarSystemContent = document.getElementById('solar-system-content');
    const mainScreenTitleText = document.getElementById('main-screen-title-text');
    const galaxyDetailTitleText = document.getElementById('galaxy-detail-title-text');
    const galaxyDetailTitleInput = document.getElementById('galaxy-detail-title-input');
    const solarSystemTitleText = document.getElementById('solar-system-title-text');
    const solarSystemTitleInput = document.getElementById('solar-system-title-input');
    const zoomControlsElement = document.getElementById('zoom-controls');
    const backToMainButton = document.getElementById('back-to-main');
    const backToGalaxyButton = document.getElementById('back-to-galaxy');
    const zoomInButton = document.getElementById('zoom-in-btn');
    const zoomOutButton = document.getElementById('zoom-out-btn');
    const regenerateUniverseButton = document.getElementById('regenerate-universe-btn');
    const createPlanetDesignButton = document.getElementById('create-planet-design-btn');

    // --- STATE VARIABLES ---
    let linesCtx, solarSystemOrbitCanvasEl, orbitCtx;
    let currentNumGalaxies, currentMinSSCount, currentMaxSSCount, currentMaxPlanetDistanceMultiplier, currentMinPlanets, currentMaxPlanets, currentShowPlanetOrbits;
    let MAX_PLANET_DISTANCE, ORBIT_CANVAS_SIZE, SOLAR_SYSTEM_EXPLORABLE_RADIUS;

    window.gameSessionData = {
        universe: { diameter: null },
        galaxies: [],
        activeGalaxyId: null,
        activeSolarSystemId: null,
        solarSystemView: { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null },
        isInitialized: false,
        panning: { isActive: false },
        customPlanetDesigns: []
    };

    // --- WEB WORKER SETUP ---
    if (window.Worker) {
        try {
            window.planetVisualWorker = new Worker(new URL('./planetRendererWorker.js', import.meta.url));
            window.designerWorker = new Worker(new URL('./planetRendererWorker.js', import.meta.url));

            window.planetVisualWorker.onmessage = (e) => window.PlanetVisualPanelManager?.handleWorkerMessage(e.data);
            window.designerWorker.onmessage = (e) => window.PlanetDesigner?.handleDesignerWorkerMessage(e.data);
        } catch (err) {
            console.error("Failed to create Web Workers.", err);
        }
    }

    // --- GLOBAL HELPER FUNCTIONS ---
    window.generatePlanetInstanceFromBasis = function (basis = {}, isForDesignerPreview = false) {
        const getValueFromRange = (range, defaultValue, defaultSpread = 1.0) => {
            if (Array.isArray(range) && range.length === 2) {
                const min = Math.min(range[0], range[1]);
                const max = Math.max(range[0], range[1]);
                return min + Math.random() * (max - min);
            }
            return (defaultValue ?? 0) + (Math.random() - 0.5) * (defaultSpread * 2);
        };
        return {
            waterColor: basis.waterColor || '#0000FF',
            landColor: basis.landColor || '#008000',
            continentSeed: isForDesignerPreview ? (basis.continentSeed ?? Math.random()) : Math.random(),
            minTerrainHeight: getValueFromRange(basis.minTerrainHeightRange, window.DEFAULT_MIN_TERRAIN_HEIGHT, 1.0),
            maxTerrainHeight: getValueFromRange(basis.maxTerrainHeightRange, window.DEFAULT_MAX_TERRAIN_HEIGHT, 2.0),
            oceanHeightLevel: getValueFromRange(basis.oceanHeightRange, window.DEFAULT_OCEAN_HEIGHT_LEVEL, 1.0)
        };
    };

    window.renderPlanetVisual = function (planetData, rotationQuaternion, targetCanvas) {
        const workerToUse = (targetCanvas?.id === 'designer-planet-canvas') ? window.designerWorker : window.planetVisualWorker;
        if (!planetData || !targetCanvas || !workerToUse || targetCanvas.width === 0 || targetCanvas.height === 0) return;
        workerToUse.postMessage({
            cmd: 'renderPlanet',
            planetData,
            rotationQuaternion,
            canvasWidth: targetCanvas.width,
            canvasHeight: targetCanvas.height,
            senderId: targetCanvas.id,
        });
    };

    // --- DATA HANDLING & PERSISTENCE ---
    function saveGameState() { /* ... full functionality can be added ... */ }
    function loadGameState() { /* ... full functionality can be added ... */ return false; }

    function resetToDefaultCustomization() {
        currentNumGalaxies = DEFAULT_NUM_GALAXIES;
        currentMinSSCount = DEFAULT_MIN_SS_COUNT_CONST;
        currentMaxSSCount = DEFAULT_MAX_SS_COUNT_CONST;
        currentMaxPlanetDistanceMultiplier = DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
        currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM;
        currentMaxPlanets = DEFAULT_MAX_PLANETS_PER_SYSTEM;
        currentShowPlanetOrbits = DEFAULT_SHOW_PLANET_ORBITS;
    }

    function loadCustomizationSettings() {
        resetToDefaultCustomization();
        updateDerivedConstants();
    }

    function updateDerivedConstants() {
        MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier;
        ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
        SOLAR_SYSTEM_EXPLORABLE_RADIUS = MAX_PLANET_DISTANCE * 1.2;
    }

    // --- GEOMETRY & GENERATION ---
     function checkOverlap(rect1, rect2) {
        return !(rect1.x + rect1.width < rect2.x || rect2.x + rect2.width < rect1.x || rect1.y + rect1.height < rect2.y || rect2.y + rect2.height < rect1.y);
    }
    
    function getNonOverlappingPositionInCircle(circleRadius, objectDiameter, existingRects) {
        let placementRadius = circleRadius - (objectDiameter / 2) - 5;
        if (placementRadius < 0) placementRadius = 0;
        for (let i = 0; i < MAX_PLACEMENT_ATTEMPTS; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const r = Math.sqrt(Math.random()) * placementRadius;
            const x = circleRadius + r * Math.cos(angle) - (objectDiameter / 2);
            const y = circleRadius + r * Math.sin(angle) - (objectDiameter / 2);
            const newRect = { x, y, width: objectDiameter, height: objectDiameter };
            if (!existingRects.some(existingRect => checkOverlap(newRect, existingRect))) {
                return { x, y };
            }
        }
        return null;
    }

    function generateUniverseLayout() {
        const screenMinDimension = Math.min(window.innerWidth, window.innerHeight);
        window.gameSessionData.universe.diameter = Math.max(300, screenMinDimension * 0.85);

        if (universeCircle) {
            universeCircle.style.width = `${window.gameSessionData.universe.diameter}px`;
            universeCircle.style.height = `${window.gameSessionData.universe.diameter}px`;
            universeCircle.style.backgroundColor = FIXED_COLORS.universeBg;
        }
    }

    function generateGalaxies() {
        if (!window.gameSessionData.universe.diameter || !universeCircle) return;
        
        window.gameSessionData.galaxies = [];
        const universeRadius = window.gameSessionData.universe.diameter / 2;
        const existingGalaxyRects = [];

        for (let i = 0; i < currentNumGalaxies; i++) {
            const galaxyId = `galaxy-${i + 1}`;
            const position = getNonOverlappingPositionInCircle(universeRadius, GALAXY_ICON_SIZE, existingGalaxyRects);
            if (position) {
                window.gameSessionData.galaxies.push({
                    id: galaxyId, x: position.x, y: position.y, customName: null, solarSystems: [],
                    lineConnections: [], layoutGenerated: false, currentZoom: 1.0, currentPanX: 0,
                    currentPanY: 0,
                });
                existingGalaxyRects.push({ ...position, width: GALAXY_ICON_SIZE, height: GALAXY_ICON_SIZE });
            }
        }
    }
    
    function generateSolarSystemsForGalaxy(galaxyId) {
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === galaxyId);
        if (!galaxy) return;

        const numSystems = Math.floor(Math.random() * (currentMaxSSCount - currentMinSSCount + 1)) + currentMinSSCount;
        const galaxyContentDiameter = window.gameSessionData.universe.diameter;
        const existingSystemRects = [];
        
        for (let i = 0; i < numSystems; i++) {
            const position = getNonOverlappingPositionInCircle(galaxyContentDiameter / 2, SOLAR_SYSTEM_BASE_ICON_SIZE, existingSystemRects);
            if(position) {
                galaxy.solarSystems.push({
                    id: `${galaxyId}-ss-${i + 1}`,
                    customName: null,
                    x: position.x,
                    y: position.y,
                    iconSize: SOLAR_SYSTEM_BASE_ICON_SIZE,
                    sunSizeFactor: 0.5 + Math.random() * 9.5
                });
                existingSystemRects.push({...position, width: SOLAR_SYSTEM_BASE_ICON_SIZE, height: SOLAR_SYSTEM_BASE_ICON_SIZE})
            }
        }
        galaxy.layoutGenerated = true;
    }

    function preGenerateAllGalaxyContents() {
        window.gameSessionData.isForceRegenerating = true;
        window.gameSessionData.galaxies.forEach(g => {
            if (!g.layoutGenerated || g.solarSystems.length === 0) {
                generateSolarSystemsForGalaxy(g.id);
            }
        });
        window.gameSessionData.isForceRegenerating = false;
        saveGameState();
    }


    // --- RENDERING ---
    function renderMainScreen() {
        if (!universeCircle) return;
        if(mainScreenTitleText) mainScreenTitleText.textContent = "Universe";
        universeCircle.innerHTML = '';
        window.gameSessionData.galaxies.forEach(galaxy => {
            const galaxyNum = galaxy.id.split('-').pop();
            const galaxyElement = document.createElement('div');
            galaxyElement.className = 'galaxy-icon';
            galaxyElement.style.width = `${GALAXY_ICON_SIZE}px`;
            galaxyElement.style.height = `${GALAXY_ICON_SIZE}px`;
            galaxyElement.style.left = `${galaxy.x}px`;
            galaxyElement.style.top = `${galaxy.y}px`;
            galaxyElement.title = galaxy.customName || `Galaxy ${galaxyNum}`;
            galaxyElement.dataset.galaxyId = galaxy.id;
            universeCircle.appendChild(galaxyElement);
        });
    }

    function renderGalaxyDetailScreen(isInteractive = false) {
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
        if (!galaxy || !galaxyViewport || !galaxyZoomContent) return;

        if (galaxyDetailTitleText) galaxyDetailTitleText.textContent = galaxy.customName || `Galaxy ${galaxy.id.split('-').pop()}`;
        
        galaxyZoomContent.style.transition = isInteractive ? 'none' : 'transform 0.1s ease-out';
        galaxyZoomContent.style.transform = `translate(${galaxy.currentPanX}px, ${galaxy.currentPanY}px) scale(${galaxy.currentZoom})`;
        
        galaxyZoomContent.querySelectorAll('.solar-system-icon').forEach(icon => icon.remove());
        galaxy.solarSystems.forEach(ss => {
            const ssElement = document.createElement('div');
            ssElement.className = 'solar-system-icon';
            ssElement.style.width = `${ss.iconSize}px`;
            ssElement.style.height = `${ss.iconSize}px`;
            ssElement.style.left = `${ss.x}px`;
            ssElement.style.top = `${ss.y}px`;
            ssElement.dataset.solarSystemId = ss.id;
            ssElement.title = ss.customName || `System ${ss.id.split('-').pop()}`;
            ssElement.addEventListener('click', (e) => { e.stopPropagation(); switchToSolarSystemView(ss.id); });
            galaxyZoomContent.appendChild(ssElement);
        });
    }

    function renderSolarSystemScreen(isInteractive = false) {
        const { systemId, currentPanX, currentPanY, zoomLevel } = window.gameSessionData.solarSystemView;
        if (!systemId) return;

        const solarSystemObject = window.gameSessionData.galaxies.flatMap(g => g.solarSystems).find(s => s.id === systemId);
        if (solarSystemTitleText) solarSystemTitleText.textContent = solarSystemObject?.customName || `System ${systemId.split('-').pop()}`;
        
        if (solarSystemContent) {
            solarSystemContent.style.transition = isInteractive ? 'none' : 'transform 0.1s ease-out';
            solarSystemContent.style.transform = `translate(${currentPanX}px, ${currentPanY}px) scale(${zoomLevel})`;
        }
        
        if (!isInteractive || !isSolarSystemAnimationRunning()) {
            drawAllOrbits();
        }
    }

    function drawAllOrbits() {
        if (!orbitCtx) orbitCtx = solarSystemOrbitCanvasEl?.getContext('2d');
        if (!orbitCtx) return;
        orbitCtx.clearRect(0, 0, orbitCtx.canvas.width, orbitCtx.canvas.height);

        if (!currentShowPlanetOrbits) return;

        const centerX = orbitCtx.canvas.width / 2;
        const centerY = orbitCtx.canvas.height / 2;
        orbitCtx.strokeStyle = 'rgba(255,255,255,0.2)';
        orbitCtx.lineWidth = 1;
        orbitCtx.setLineDash([5, 5]);
        window.gameSessionData.solarSystemView.planets.forEach(p => {
            orbitCtx.beginPath();
            orbitCtx.arc(centerX, centerY, p.distance, 0, 2 * Math.PI);
            orbitCtx.stroke();
        });
        orbitCtx.setLineDash([]);
    }


    // --- UI/UX & VIEW MANAGEMENT ---
    function setActiveScreen(screenToShow) {
        [mainScreen, galaxyDetailScreen, solarSystemScreen, planetDesignerScreen].forEach(s => s.classList.remove('active'));
        if (screenToShow) screenToShow.classList.add('active');
        if(zoomControlsElement) zoomControlsElement.style.display = (screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen) ? 'flex' : 'none';
        
        const isOnOverlayScreen = screenToShow === planetDesignerScreen;
        if(regenerateUniverseButton) regenerateUniverseButton.style.display = isOnOverlayScreen ? 'none' : 'block';
        if(createPlanetDesignButton) createPlanetDesignButton.style.display = isOnOverlayScreen ? 'none' : 'block';
    }

    // FIXED: The typo is here. Missing space.
    function switchToMainView() {
        window.gameSessionData.activeGalaxyId = null;
        window.gameSessionData.activeSolarSystemId = null;
        stopSolarSystemAnimation();
        setActiveScreen(mainScreen);
    }
    window.switchToMainView = switchToMainView;

    function switchToGalaxyDetailView(galaxyId) {
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === galaxyId);
        if (!galaxy) return switchToMainView();

        window.gameSessionData.activeGalaxyId = galaxyId;
        window.gameSessionData.activeSolarSystemId = null;
        stopSolarSystemAnimation();
        
        backToGalaxyButton.textContent = `← ${galaxy.customName || `Galaxy ${galaxy.id.split('-').pop()}`}`;
        
        if (!galaxy.layoutGenerated) { generateSolarSystemsForGalaxy(galaxy.id); }
        
        setActiveScreen(galaxyDetailScreen);
        renderGalaxyDetailScreen(false);
    }

    function switchToSolarSystemView(solarSystemId) {
        const activeGalaxy = window.gameSessionData.galaxies.find(g => solarSystemId.startsWith(g.id));
        const solarSystemObject = activeGalaxy?.solarSystems.find(s => s.id === solarSystemId);

        if (!solarSystemObject) {
            console.error(`switchToSolarSystemView: Solar System object ${solarSystemId} not found.`);
            return switchToMainView();
        }

        window.gameSessionData.activeSolarSystemId = solarSystemId;
        window.gameSessionData.solarSystemView = { zoomLevel: 0.5, currentPanX: 0, currentPanY: 0, systemId: solarSystemId, planets: [] };
        if (solarSystemContent) solarSystemContent.innerHTML = '';

        const currentSunSize = Math.max(15, SUN_ICON_SIZE * (solarSystemObject.sunSizeFactor || 1));
        const sunElement = document.createElement('div');
        sunElement.className = 'sun-icon sun-animated';
        sunElement.style.width = `${currentSunSize}px`;
        sunElement.style.height = `${currentSunSize}px`;
        solarSystemContent.appendChild(sunElement);

        if (solarSystemOrbitCanvasEl?.parentNode) solarSystemOrbitCanvasEl.remove();
        solarSystemOrbitCanvasEl = document.createElement('canvas');
        solarSystemOrbitCanvasEl.id = 'solar-system-orbit-canvas';
        solarSystemOrbitCanvasEl.width = ORBIT_CANVAS_SIZE;
        solarSystemOrbitCanvasEl.height = ORBIT_CANVAS_SIZE;
        solarSystemContent.appendChild(solarSystemOrbitCanvasEl);
        orbitCtx = solarSystemOrbitCanvasEl.getContext('2d');

        const sunRadius = currentSunSize / 2;
        const localMinPlanetDistance = sunRadius + MAX_PLANET_SIZE + MIN_ORBITAL_SEPARATION;

        let usedOrbitalDistances = [];
        if (localMinPlanetDistance < MAX_PLANET_DISTANCE) {
            const numPlanets = Math.floor(Math.random() * (currentMaxPlanets - currentMinPlanets + 1)) + currentMinPlanets;
            for (let i = 0; i < numPlanets; i++) {
                const planetSize = MIN_PLANET_SIZE + Math.random() * (MAX_PLANET_SIZE - MIN_PLANET_SIZE);
                let planetDistance, placementAttempts = 0;
                do {
                    planetDistance = localMinPlanetDistance + Math.random() * (MAX_PLANET_DISTANCE - localMinPlanetDistance);
                    if (!usedOrbitalDistances.some(used => Math.abs(planetDistance - used.distance) < (MIN_ORBITAL_SEPARATION + used.size / 2 + planetSize / 2))) break;
                    placementAttempts++;
                } while (placementAttempts < 200);

                if (placementAttempts >= 200) continue;
                usedOrbitalDistances.push({ distance: planetDistance, size: planetSize });

                const basisToUse = window.gameSessionData.customPlanetDesigns?.[Math.floor(Math.random() * window.gameSessionData.customPlanetDesigns.length)] || { waterColor: '#0077BE', landColor: '#3A5F0B' };
                const newPlanet = {
                    id: `${solarSystemId}-planet-${i + 1}`,
                    planetName: `Planet ${i + 1}`,
                    size: planetSize,
                    distance: planetDistance,
                    currentOrbitalAngle: Math.random() * 2 * Math.PI,
                    orbitalSpeed: 0.005 + Math.random() * 0.005,
                    currentAxialAngle: Math.random() * 2 * Math.PI,
                    axialSpeed: window.DEFAULT_PLANET_AXIAL_SPEED,
                    ...window.generatePlanetInstanceFromBasis(basisToUse, false)
                };
                window.gameSessionData.solarSystemView.planets.push(newPlanet);
                
                const planetElement = document.createElement('div');
                planetElement.className = 'planet-icon clickable-when-paused';
                planetElement.style.width = `${planetSize}px`;
                planetElement.style.height = `${planetSize}px`;
                planetElement.addEventListener('click', (e) => { e.stopPropagation(); window.PlanetVisualPanelManager?.show(newPlanet); });
                solarSystemContent.appendChild(planetElement);
                newPlanet.element = planetElement;
            }
        }
        
        setActiveScreen(solarSystemScreen);
        renderSolarSystemScreen(false);
        startSolarSystemAnimation();
    }

    // --- PAN/ZOOM LOGIC ---
    function clampPan(dataObject, viewportWidth, viewportHeight, contentDiameter) {
        if (!dataObject) return;
        const isSolarSystem = 'zoomLevel' in dataObject;
        const zoom = isSolarSystem ? dataObject.zoomLevel : dataObject.currentZoom;

        if (zoom <= GALAXY_VIEW_MIN_ZOOM && !isSolarSystem) {
             dataObject.currentPanX = 0; dataObject.currentPanY = 0; return;
        }

        const scaledContent = contentDiameter * zoom;
        const maxPanX = Math.max(0, (scaledContent - viewportWidth) / 2);
        const maxPanY = Math.max(0, (scaledContent - viewportHeight) / 2);

        dataObject.currentPanX = Math.max(-maxPanX, Math.min(maxPanX, dataObject.currentPanX));
        dataObject.currentPanY = Math.max(-maxPanY, Math.min(maxPanY, dataObject.currentPanY));
    }

    function handleZoom(direction, mouseEvent) {
        let dataObject, viewElement, renderFn, minZoom, maxZoom, contentDiameter;
        const activeScreen = document.querySelector('.screen.active');

        if (activeScreen === galaxyDetailScreen) {
            dataObject = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
            if (!dataObject) return;
            viewElement = galaxyViewport;
            renderFn = renderGalaxyDetailScreen;
            minZoom = GALAXY_VIEW_MIN_ZOOM;
            maxZoom = GALAXY_VIEW_MAX_ZOOM;
            contentDiameter = window.gameSessionData.universe.diameter;
        } else if (activeScreen === solarSystemScreen) {
            dataObject = window.gameSessionData.solarSystemView;
            viewElement = solarSystemScreen;
            renderFn = renderSolarSystemScreen;
            minZoom = SOLAR_SYSTEM_VIEW_MIN_ZOOM;
            maxZoom = SOLAR_SYSTEM_VIEW_MAX_ZOOM;
            contentDiameter = ORBIT_CANVAS_SIZE;
        } else {
            return;
        }

        const oldZoom = 'zoomLevel' in dataObject ? dataObject.zoomLevel : dataObject.currentZoom;
        let newZoom = oldZoom * (1 + (direction === 'in' ? ZOOM_STEP : -ZOOM_STEP));
        newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

        if (Math.abs(oldZoom - newZoom) < 0.0001) return;

        if (mouseEvent) {
            const rect = viewElement.getBoundingClientRect();
            const mouseX = mouseEvent.clientX - rect.left;
            const mouseY = mouseEvent.clientY - rect.top;
            const mouseRelX = mouseX - viewElement.offsetWidth / 2;
            const mouseRelY = mouseY - viewElement.offsetHeight / 2;
            
            const worldX = (mouseRelX - dataObject.currentPanX) / oldZoom;
            const worldY = (mouseRelY - dataObject.currentPanY) / oldZoom;

            dataObject.currentPanX = mouseRelX - (worldX * newZoom);
            dataObject.currentPanY = mouseRelY - (worldY * newZoom);
        }
        
        if ('zoomLevel' in dataObject) dataObject.zoomLevel = newZoom;
        else dataObject.currentZoom = newZoom;

        clampPan(dataObject, viewElement.offsetWidth, viewElement.offsetHeight, contentDiameter);
        renderFn(true);
    }

    function startPan(event, viewportElement, contentElement, dataObject) {
        if (!dataObject || event.button !== 0 || event.target.closest('button, .solar-system-icon, .planet-icon')) return;

        const p = window.gameSessionData.panning;
        p.isActive = true;
        p.startX = event.clientX;
        p.startY = event.clientY;
        p.initialPanX = dataObject.currentPanX || 0;
        p.initialPanY = dataObject.currentPanY || 0;
        p.dataObject = dataObject;
        p.viewportElement = viewportElement;

        viewportElement.classList.add('dragging');
        if(contentElement) contentElement.style.transition = 'none';
        event.preventDefault();
    }

    function panMouseMove(event) {
        const p = window.gameSessionData.panning;
        if (!p.isActive) return;

        const deltaX = event.clientX - p.startX;
        const deltaY = event.clientY - p.startY;
        p.dataObject.currentPanX = p.initialPanX + deltaX;
        p.dataObject.currentPanY = p.initialPanY + deltaY;
        
        let contentDiameter, renderFn;
        if(p.viewportElement === galaxyViewport) {
            contentDiameter = window.gameSessionData.universe.diameter;
            renderFn = renderGalaxyDetailScreen;
        } else {
            contentDiameter = ORBIT_CANVAS_SIZE;
            renderFn = renderSolarSystemScreen;
        }

        clampPan(p.dataObject, p.viewportElement.offsetWidth, p.viewportElement.offsetHeight, contentDiameter);
        renderFn(true);
    }

    function panMouseUp() {
        const p = window.gameSessionData.panning;
        if (!p.isActive) return;

        p.viewportElement.classList.remove('dragging');
        const contentElement = p.viewportElement.querySelector('#galaxy-zoom-content, #solar-system-content');
        if(contentElement) contentElement.style.transition = '';
        
        p.isActive = false;
        p.dataObject = null;
    }

    // --- GAME INITIALIZATION ---
    function initializeGame(isForcedRegeneration = false) {
        console.log("Initializing game...");
        loadCustomizationSettings();

        const didLoad = !isForcedRegeneration && loadGameState();
        if (didLoad) {
            console.log("Loaded existing game state.");
        } else {
            console.log("Generating new universe.");
            generateUniverseLayout();
            generateGalaxies();
        }
        
        preGenerateAllGalaxyContents();
        renderMainScreen();
        setActiveScreen(mainScreen);
        console.log("Game initialization complete.");
    }
    
    function regenerateCurrentUniverseState(forceConfirm = true) {
        if(forceConfirm && !confirm("This will erase your universe. Are you sure?")) return;
        initializeGame(true);
    }

    // --- EVENT LISTENERS ---
    initializeModules();
    if (window.PlanetDesigner?.init) window.PlanetDesigner.init();
    if (window.PlanetVisualPanelManager?.init) window.PlanetVisualPanelManager.init();

    regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(true));
    createPlanetDesignButton.addEventListener('click', () => setActiveScreen(planetDesignerScreen));
    backToMainButton.addEventListener('click', switchToMainView);
    backToGalaxyButton.addEventListener('click', () => {
        if(window.gameSessionData.activeGalaxyId) {
            switchToGalaxyDetailView(window.gameSessionData.activeGalaxyId);
        }
    });
    
    universeCircle.addEventListener('click', (e) => {
        const galaxyIcon = e.target.closest('.galaxy-icon');
        if (galaxyIcon) {
            switchToGalaxyDetailView(galaxyIcon.dataset.galaxyId);
        }
    });

    galaxyViewport.addEventListener('mousedown', (e) => {
        const galaxy = window.gameSessionData.galaxies.find(g => g.id === window.gameSessionData.activeGalaxyId);
        startPan(e, galaxyViewport, galaxyZoomContent, galaxy);
    });

    solarSystemScreen.addEventListener('mousedown', (e) => {
        startPan(e, solarSystemScreen, solarSystemContent, window.gameSessionData.solarSystemView);
    });

    window.addEventListener('mousemove', panMouseMove);
    window.addEventListener('mouseup', panMouseUp);
    
    zoomInButton.addEventListener('click', () => handleZoom('in'));
    zoomOutButton.addEventListener('click', () => handleZoom('out'));
    
    const zoomableScreens = [galaxyDetailScreen, solarSystemScreen];
    zoomableScreens.forEach(screen => {
      if(screen) screen.addEventListener('wheel', e => {
          e.preventDefault();
          handleZoom(e.deltaY < 0 ? 'in' : 'out', e);
      }, { passive: false });
    });

    // --- SCRIPT EXECUTION START ---
    initializeGame();
});
