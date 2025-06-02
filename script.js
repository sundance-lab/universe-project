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
    const pauseResumeSolarSystemButton = document.getElementById('pause-resume-solar-system-btn');

    const planetVisualPanel = document.getElementById('planet-visual-panel');
    const closePlanetVisualPanelBtn = document.getElementById('close-planet-visual-panel');
    const planetVisualPanelHeader = document.getElementById('planet-visual-panel-header');
    const planetVisualTitle = document.getElementById('planet-visual-title'); 
    const planetVisualSize = document.getElementById('planet-visual-size'); 
    const planetVisualCanvas = document.getElementById('planet-visual-canvas');

    let linesCtx; 
    let solarSystemOrbitCanvasEl;
    let orbitCtx;
    let animationFrameId = null;
    let lastAnimationTime = null; 
    let isSolarSystemPaused = false;

    let isDraggingPlanetVisual = false;
    let dragStartX = 0;
    let currentRotationAngleInPanel = 0; 
    let currentPlanetDisplayedInPanel = null; 

    const DEFAULT_NUM_GALAXIES = 3;
    const DEFAULT_MIN_SS_COUNT_CONST = 200;
    const DEFAULT_MAX_SS_COUNT_CONST = 300;
    const DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER = 1.0;
    const DEFAULT_MIN_PLANETS_PER_SYSTEM = 0;
    const DEFAULT_MAX_PLANETS_PER_SYSTEM = 3;
    const DEFAULT_SHOW_PLANET_ORBITS = true;
    const DEFAULT_PLANET_AXIAL_SPEED = 0.01; 
    const BASE_MAX_PLANET_DISTANCE_FACTOR = 8; 

    let currentNumGalaxies = DEFAULT_NUM_GALAXIES;
    let currentMinSSCount = DEFAULT_MIN_SS_COUNT_CONST;
    let currentMaxSSCount = DEFAULT_MAX_SS_COUNT_CONST;
    let currentMaxPlanetDistanceMultiplier = DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER;
    let currentMinPlanets = DEFAULT_MIN_PLANETS_PER_SYSTEM;
    let currentMaxPlanets = DEFAULT_MAX_PLANETS_PER_SYSTEM;
    let currentShowPlanetOrbits = DEFAULT_SHOW_PLANET_ORBITS;

    const GALAXY_ICON_SIZE = 60; const SOLAR_SYSTEM_BASE_ICON_SIZE = 2.5; const SUN_ICON_SIZE = 60; const MAX_PLACEMENT_ATTEMPTS = 150; const GALAXY_VIEW_MIN_ZOOM = 1.0; const GALAXY_VIEW_MAX_ZOOM = 5.0; const SOLAR_SYSTEM_VIEW_MIN_ZOOM = 0.05; const SOLAR_SYSTEM_VIEW_MAX_ZOOM = 10.0; const ZOOM_STEP = 0.2;
    const MAX_CONNECTIONS_PER_SYSTEM = 3; const MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS = 5; const MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT = 0.07; const MAX_FORCED_CONNECTION_DISTANCE_PERCENT = 0.20;
    const MIN_PLANET_SIZE = 5; const MAX_PLANET_SIZE = 15; let MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 1.5; 
    let MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier; 
    let ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2; 
    const SOLAR_SYSTEM_EXPLORABLE_RADIUS = 3000; 
    const MIN_ORBITAL_SEPARATION = 20; 
    let MIN_ROTATION_SPEED_RAD_PER_FRAME = 0.005; 
    let MAX_ROTATION_SPEED_RAD_PER_FRAME = 0.01; 
    const FIXED_COLORS = { universeBg: "#100520", galaxyIconFill: "#7f00ff", galaxyIconBorder: "#da70d6", solarSystemBaseColor: "#ffd700", sunFill: "#FFD700", sunBorder: "#FFA500", connectionLine: "rgba(255, 255, 255, 0.3)"};
    let gameSessionData = { universe: { diameter: null }, galaxies: [], activeGalaxyId: null, activeSolarSystemId: null, solarSystemView: { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null }, isInitialized: false, panning: { isActive: false, startX: 0, startY: 0, initialPanX: 0, initialPanY: 0, targetElement: null, viewportElement: null, dataObject: null }};
    
    function updateDerivedConstants() {
        MAX_PLANET_DISTANCE = (SUN_ICON_SIZE * BASE_MAX_PLANET_DISTANCE_FACTOR) * currentMaxPlanetDistanceMultiplier;
        MIN_PLANET_DISTANCE = SUN_ICON_SIZE * 1.5 * (currentMaxPlanetDistanceMultiplier > 0.5 ? currentMaxPlanetDistanceMultiplier * 0.8 : 0.5) ; 
        ORBIT_CANVAS_SIZE = MAX_PLANET_DISTANCE * 2.2;
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

            } catch (e) { resetToDefaultCustomization(); }
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
            };
            localStorage.setItem('galaxyGameSaveData', JSON.stringify(stateToSave));
        } catch (error) {}
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
                        gal.generationParams = gal.generationParams || {densityFactor:0.8+Math.random()*0.4};
                        gal.solarSystems = gal.solarSystems || [];
                        if (gal.solarSystems && Array.isArray(gal.solarSystems)) {
                            gal.solarSystems.forEach(ss => {
                                ss.customName = ss.customName || null;
                            });
                        }
                        gal.lineConnections = gal.lineConnections || [];
                    });
                    return true;
                }
            }
        } catch (error) { localStorage.removeItem('galaxyGameSaveData'); }
        return false;
    }

    function checkOverlap(r1,r2){return!(r1.x+r1.width<r2.x||r2.x+r2.width<r1.x||r1.y+r1.height<r2.y||r2.y+r2.height<r1.y)}
    function getNonOverlappingPositionInCircle(pr,od,exR){let plr=pr-(od/2)-5;if(plr<0)plr=0;for(let i=0;i<MAX_PLACEMENT_ATTEMPTS;i++){const a=Math.random()*2*Math.PI,r=Math.sqrt(Math.random())*plr,cx=pr+r*Math.cos(a),cy=pr+r*Math.sin(a),x=cx-(od/2),y=cy-(od/2),nr={x,y,width:od,height:od};if(!exR.some(er=>checkOverlap(nr,er)))return{x,y}}return null}
    function getWeightedNumberOfConnections(){ const e=Math.random(); return e < .6 ? 1 : e < .9 ? 2 : 3; }
    function adjustColor(e,t){let r=parseInt(e.slice(1,3),16),o=parseInt(e.slice(3,5),16),a=parseInt(e.slice(5,7),16);return r=Math.max(0,Math.min(255,r+t)),o=Math.max(0,Math.min(255,o+t)),a=Math.max(0,Math.min(255,a+t)),`#${r.toString(16).padStart(2,"0")}${o.toString(16).padStart(2,"0")}${a.toString(16).padStart(2,"0")}`}
    
    function setActiveScreen(screenToShow) { 
        [mainScreen, galaxyDetailScreen, solarSystemScreen].forEach(screen => { 
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
             regenerateUniverseButton.style.display = (screenToShow === mainScreen || screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen) ? 'block' : 'none';
        }
         if (customizeGenerationButton) {
            customizeGenerationButton.style.display = (screenToShow === mainScreen || screenToShow === galaxyDetailScreen || screenToShow === solarSystemScreen) ? 'block' : 'none';
        }
        if (pauseResumeSolarSystemButton) {
            pauseResumeSolarSystemButton.style.display = (screenToShow === solarSystemScreen) ? 'block' : 'none';
            if (screenToShow === solarSystemScreen) {
                 isSolarSystemPaused = false; 
                 pauseResumeSolarSystemButton.textContent = "Pause Planets";
            }
        }
        if (screenToShow === solarSystemScreen) { startSolarSystemAnimation(); } 
        else { if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; } }
        // Hide visual panel when changing screens.
        planetVisualPanel.classList.remove('visible'); 
    }

    function generateUniverseLayout() { const smd=Math.min(window.innerWidth,window.innerHeight);gameSessionData.universe.diameter=Math.max(300,smd*0.85);if(universeCircle){universeCircle.style.width=`${gameSessionData.universe.diameter}px`;universeCircle.style.height=`${gameSessionData.universe.diameter}px`;universeCircle.style.backgroundColor=FIXED_COLORS.universeBg;} }
    function generateGalaxies() { 
        if(!gameSessionData.universe.diameter)return;
        gameSessionData.galaxies=[];
        const pr=gameSessionData.universe.diameter/2;
        const tpr=[];
        for(let i=0;i<currentNumGalaxies;i++){ 
            const id=`galaxy-${i+1}`,pos=getNonOverlappingPositionInCircle(pr,GALAXY_ICON_SIZE,tpr);
            if(pos&&!isNaN(pos.x)&&!isNaN(pos.y)){
                gameSessionData.galaxies.push({id,x:pos.x,y:pos.y, customName: null, solarSystems:[],lineConnections:[],layoutGenerated:false,currentZoom:1.0,currentPanX:0,currentPanY:0,generationParams:{densityFactor:0.8+Math.random()*0.4}});
                tpr.push({x:pos.x,y:pos.y,width:GALAXY_ICON_SIZE,height:GALAXY_ICON_SIZE})
            }
        }
    }
    function getDistance(sys1, sys2) { return Math.sqrt(Math.pow(sys1.centerX - sys2.centerX, 2) + Math.pow(sys1.centerY - sys2.centerY, 2)); }
    function tryAddConnection(fromId, toId, currentConnectionsArray, currentCountsObject, allSystemsLookup, maxDistanceLimit) { if (!fromId || !toId || fromId === toId) return false; if ((currentCountsObject[fromId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM || (currentCountsObject[toId] || 0) >= MAX_CONNECTIONS_PER_SYSTEM) { return false; } const key = [fromId, toId].sort().join('-'); if (currentConnectionsArray.some(conn => ([conn.fromId, conn.toId].sort().join('-') === key))) { return false; } if (maxDistanceLimit !== undefined && maxDistanceLimit !== null) { const sys1 = allSystemsLookup.find(s => s.id === fromId); const sys2 = allSystemsLookup.find(s => s.id === toId); if (sys1 && sys2 && getDistance(sys1, sys2) > maxDistanceLimit) { return false; } } return true; }
    
    function generateSolarSystemsForGalaxy(galaxyId) { 
        const gal = gameSessionData.galaxies.find(g => g.id === galaxyId); 
        if(!gal || !galaxyViewport) {return;}
        if (gal.layoutGenerated && !gameSessionData.isForceRegenerating) return; 
        
        const pd=galaxyViewport.offsetWidth > 0 ? galaxyViewport.offsetWidth : (gameSessionData.universe.diameter || 500) ; 
        const pr=pd/2; 
        if(pd<=0||isNaN(pr)||pr<=0){ gal.layoutGenerated=true; if (!gameSessionData.isForceRegenerating) saveGameState(); return } 
        gal.solarSystems=[]; gal.lineConnections=[]; const tpr=[]; 
        const numSystemsToAssign = Math.floor(Math.random() * (currentMaxSSCount - currentMinSSCount + 1)) + currentMinSSCount; 
        for(let i=0;i<numSystemsToAssign;i++){ const sysId=`${gal.id}-ss-${i+1}`; const pos=getNonOverlappingPositionInCircle(pr,SOLAR_SYSTEM_BASE_ICON_SIZE,tpr); if(pos&&!isNaN(pos.x)&&!isNaN(pos.y)){ gal.solarSystems.push({id:sysId, customName:null, x:pos.x,y:pos.y,iconSize:SOLAR_SYSTEM_BASE_ICON_SIZE}); tpr.push({x:pos.x,y:pos.y,width:SOLAR_SYSTEM_BASE_ICON_SIZE,height:SOLAR_SYSTEM_BASE_ICON_SIZE})} } 
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
                    const connectionIsValidPrimary = tryAddConnection( bestCandidate.fromId, bestCandidate.toId, gal.lineConnections, systemConnectionCounts, allSystemCoords, actualMaxEuclideanConnectionDistance ); 
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
                            const isPossibleFallback = tryAddConnection( systemToConnectId, connId, gal.lineConnections, systemConnectionCounts, allSystemCoords, actualMaxForcedConnectionDistance ); 
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
                            for (const connId of connectedSet) { 
                                const connSys = allSystemCoords.find(s => s.id === connId); 
                                const dist = getDistance(systemToConnect, connSys); 
                                const isPossibleUltimateFallback = tryAddConnection( systemToConnectId, connId, gal.lineConnections, systemConnectionCounts, allSystemCoords, null ); 
                                if (isPossibleUltimateFallback) { 
                                    if (dist < minUltimateFallbackDist) { 
                                        minUltimateFallbackDist = dist; 
                                        ultimateFallbackId = connId; 
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
        } 
        allSystemCoords.forEach(ss1 => { 
            const desiredConnections = getWeightedNumberOfConnections(); 
            let currentConnections = systemConnectionCounts[ss1.id] || 0; 
            let connectionsToAdd = Math.min(desiredConnections, MAX_CONNECTIONS_PER_SYSTEM - currentConnections); 
            if (connectionsToAdd <= 0) return; 
            let potentialTargets = allSystemCoords.filter(ss2 => ss1.id !== ss2.id).map(ss2 => ({ ...ss2, distance: getDistance(ss1, ss2) })).sort((a, b) => a.distance - b.distance); 
            const limitedPotentialTargets = potentialTargets.filter(ss2 => ss2.distance <= actualMaxEuclideanConnectionDistance); 
            const finalCandidates = limitedPotentialTargets.slice(0, MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS); 
            for (const ss2 of finalCandidates) { 
                if (connectionsToAdd <= 0) break; 
                const success = tryAddConnection( ss1.id, ss2.id, gal.lineConnections, systemConnectionCounts, allSystemCoords, actualMaxEuclideanConnectionDistance ); 
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
            if (galaxyViewport && (!gal.layoutGenerated || gal.solarSystems.length === 0) ) { 
                await new Promise(resolve => setTimeout(resolve, 0)); 
                generateSolarSystemsForGalaxy(gal.id); 
            }
        }
        gameSessionData.isForceRegenerating = false;
        saveGameState();
    }
    
    function renderMainScreen() { 
        if (mainScreenTitleText) mainScreenTitleText.textContent = "Universe";
        if(!universeCircle)return;
        universeCircle.innerHTML='';
        gameSessionData.galaxies.forEach(gal=>{const el=document.createElement('div');el.className='galaxy-icon';el.style.width=`${GALAXY_ICON_SIZE}px`;el.style.height=`${GALAXY_ICON_SIZE}px`;el.style.left=`${gal.x}px`;el.style.top=`${gal.y}px`;el.style.backgroundColor=FIXED_COLORS.galaxyIconFill;el.style.border=`3px solid ${FIXED_COLORS.galaxyIconBorder}`; el.title = gal.customName || `Galaxy ${gal.id.split('-')[1]}`; el.dataset.galaxyId=gal.id;el.addEventListener('click',()=>switchToGalaxyDetailView(gal.id));universeCircle.appendChild(el)});
    }
    function drawGalaxyLines(galaxy) { if(!solarSystemLinesCanvasEl||!galaxyZoomContent)return;if(galaxyZoomContent.offsetWidth>0&&solarSystemLinesCanvasEl.width!==galaxyZoomContent.offsetWidth)solarSystemLinesCanvasEl.width=galaxyZoomContent.offsetWidth;if(galaxyZoomContent.offsetHeight>0&&solarSystemLinesCanvasEl.height!==galaxyZoomContent.offsetHeight)solarSystemLinesCanvasEl.height=galaxyZoomContent.offsetHeight;if(!linesCtx)linesCtx=solarSystemLinesCanvasEl.getContext('2d');linesCtx.clearRect(0,0,solarSystemLinesCanvasEl.width,solarSystemLinesCanvasEl.height);if(!galaxy||!galaxy.lineConnections||!galaxy.solarSystems)return;linesCtx.strokeStyle=FIXED_COLORS.connectionLine;linesCtx.lineWidth=0.5;linesCtx.setLineDash([]);const spos={};galaxy.solarSystems.forEach(ss=>{spos[ss.id]={x:ss.x+ss.iconSize/2,y:ss.y+ss.iconSize/2}});galaxy.lineConnections.forEach(conn=>{const f=spos[conn.fromId],t=spos[conn.toId];if(f&&t){linesCtx.beginPath();linesCtx.moveTo(f.x,f.y);linesCtx.lineTo(t.x,t.y);linesCtx.stroke()}})}
    
    function renderGalaxyDetailScreen(isInteractive = false) { 
        const gal=gameSessionData.galaxies.find(g=>g.id===gameSessionData.activeGalaxyId);
        if(!gal){switchToMainView();return}
        if(!galaxyViewport||!galaxyZoomContent)return;
        galaxyViewport.style.width=(gameSessionData.universe.diameter||500)+`px`;
        galaxyViewport.style.height=(gameSessionData.universe.diameter||500)+`px`;
        const icons=galaxyZoomContent.querySelectorAll('.solar-system-icon');
        icons.forEach(i=>i.remove());

        const zoomScaleDampening = 0.6; 
        const effectiveZoomForIconSize = GALAXY_VIEW_MIN_ZOOM + ((gal.currentZoom - GALAXY_VIEW_MIN_ZOOM) * zoomScaleDampening);

        gal.solarSystems.forEach(ss=>{
            const solarSystemObject = ss; 
            const el=document.createElement('div');
            el.className='solar-system-icon';
            
            let desiredSizeInParent = (ss.iconSize * effectiveZoomForIconSize);
            if (gal.currentZoom > 0) { 
                desiredSizeInParent = (ss.iconSize * effectiveZoomForIconSize) / gal.currentZoom;
            } else {
                desiredSizeInParent = ss.iconSize * effectiveZoomForIconSize; 
            }                   
            desiredSizeInParent = Math.max(0.5, desiredSizeInParent);

            el.style.width=`${desiredSizeInParent}px`;
            el.style.height=`${desiredSizeInParent}px`;
            const centerOffset = desiredSizeInParent / 2;
            const baseCenterOffset = ss.iconSize / 2;
            el.style.left=`${ss.x + baseCenterOffset - centerOffset}px`; 
            el.style.top=`${ss.y + baseCenterOffset - centerOffset}px`;

            el.dataset.solarSystemId=ss.id; 
            if(solarSystemObject && solarSystemObject.customName) { el.title = solarSystemObject.customName; } 
            el.addEventListener('click',e=>{e.stopPropagation();switchToSolarSystemView(ss.id)});
            galaxyZoomContent.appendChild(el)
        });
        if(solarSystemLinesCanvasEl.parentNode!==galaxyZoomContent||galaxyZoomContent.firstChild!==solarSystemLinesCanvasEl)galaxyZoomContent.insertBefore(solarSystemLinesCanvasEl,galaxyZoomContent.firstChild);
        drawGalaxyLines(gal);
        galaxyZoomContent.style.transition=isInteractive?'none':'transform 0.1s ease-out';
        galaxyZoomContent.style.transform=`translate(${gal.currentPanX}px,${gal.currentPanY}px)scale(${gal.currentZoom})`;
        
        if (galaxyDetailTitleText) {
            galaxyDetailTitleText.textContent = gal.customName || `Galaxy ${gal.id.split('-')[1]}`;
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
        if (!solarSystemContent || !solarSystemScreen || !gameSessionData.activeSolarSystemId) {return;}
        const data=gameSessionData.solarSystemView;
        let panX=data.currentPanX||0, panY=data.currentPanY||0;
        let zoom=data.zoomLevel||SOLAR_SYSTEM_VIEW_MIN_ZOOM;
        solarSystemContent.style.transition = isInteractive ? 'none': 'transform 0.1s ease-out';
        solarSystemContent.style.transform = `translate(${panX}px,${panY}px)scale(${zoom})`;
        
        const activeGalaxy = gameSessionData.galaxies.find(g => data.systemId && data.systemId.startsWith(g.id));
        let solarSystemObject = null;
        if(activeGalaxy && activeGalaxy.solarSystems) {
            solarSystemObject = activeGalaxy.solarSystems.find(ss => ss.id === data.systemId);
        }
        if(solarSystemTitleText) {
             solarSystemTitleText.textContent = (solarSystemObject && solarSystemObject.customName) ? solarSystemObject.customName : `System ${data.systemId ? data.systemId.substring(data.systemId.lastIndexOf('-')+1) : 'N/A'}`;
        }
        if(isInteractive || !animationFrameId) { drawAllOrbits(); }
    }

    function switchToMainView() { gameSessionData.activeGalaxyId=null;gameSessionData.activeSolarSystemId=null;setActiveScreen(mainScreen); }
    
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
        if (!gal){ switchToMainView(); return; }
        gameSessionData.activeGalaxyId = galaxyId;
        if (backToGalaxyButton) {
            backToGalaxyButton.textContent = gal.customName
                ? `← ${gal.customName}`
                : `← Galaxy ${gal.id.split('-')[1]}`;
        }
        gameSessionData.activeSolarSystemId = null; 
        gal.currentZoom = gal.currentZoom || 1.0; 
        gal.currentPanX = gal.currentPanX || 0; 
        gal.currentPanY = gal.currentPanY || 0;

        if (galaxyDetailTitleText) { 
             galaxyDetailTitleText.textContent = gal.customName || `Galaxy ${gal.id.split('-')[1]}`;
             galaxyDetailTitleText.style.display = 'inline-block';
        }
        if(galaxyDetailTitleInput) galaxyDetailTitleInput.style.display = 'none';

        setActiveScreen(galaxyDetailScreen); 
        makeTitleEditable(galaxyDetailTitleText, galaxyDetailTitleInput, (newName) => {
            gal.customName = newName || null; 
            saveGameState();
            renderMainScreen(); 
            return gal.customName || `Galaxy ${gal.id.split('-')[1]}`; 
        });

        if (galaxyViewport && gameSessionData.universe.diameter) { galaxyViewport.style.width = `${gameSessionData.universe.diameter}px`; galaxyViewport.style.height = `${gameSessionData.universe.diameter}px`; }
        if (!gal.layoutGenerated) { setTimeout(() => { function attemptLayoutGeneration(retriesLeft = 5) { if (galaxyViewport && galaxyViewport.offsetWidth > 0) {generateSolarSystemsForGalaxy(galaxyId);renderGalaxyDetailScreen(false); } else if (retriesLeft > 0) {requestAnimationFrame(() => attemptLayoutGeneration(retriesLeft - 1));} else {gal.layoutGenerated = true; renderGalaxyDetailScreen(false); }}attemptLayoutGeneration(); }, 50); } else {renderGalaxyDetailScreen(false); }
    }
    
    // Function to generate random landmass data (center longitude, latitude, and base size) for terrestrial planets.
    // These data points will be used to draw amorphous blobs on the planet's texture map.
    function generateLandmassData(numLandmasses) {
        const landmasses = [];
        for (let i = 0; i < numLandmasses; i++) {
            landmasses.push({
                lon: (Math.random() - 0.5) * 2 * Math.PI, // Longitude: -PI to PI
                lat: (Math.random() - 0.5) * 0.8 * Math.PI, // Latitude: approx -63 to +63 degrees for better distribution
                baseSize: (0.15 + Math.random() * 0.25) // Normalized size, will be scaled to texture (0.15 to 0.40 fraction of texture size)
            });
        }
        return landmasses;
    }

    // Function to create a 2D texture map for terrestrial planets (water and grass regions)
    // This texture will be drawn onto the planet's sphere in the visual panel.
    function createTerrestrialTexture(planetData, textureSize = 512) {
        const canvas = document.createElement('canvas'); // Offscreen canvas
        canvas.width = textureSize * 2; // Make width:height 2:1 for full cylindrical map (equirectangular projection)
        canvas.height = textureSize;
        const ctx = canvas.getContext('2d');

        // Draw water background for the entire texture
        ctx.fillStyle = planetData.waterColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Apply a blur filter to the landmasses to make them seamless and fluid
        // Blur radius proportional to texture size for consistent look
        ctx.filter = `blur(${textureSize * 0.02}px)`; 

        ctx.fillStyle = planetData.grassColor;

        // Draw landmasses onto the texture canvas
        planetData.landmassData.forEach(lm => {
            // Convert spherical coordinates (lon, lat) to 2D texture coordinates (x, y)
            // lon maps to X, lat maps to Y. We normalize them to 0-1 range first.
            const textureX = (lm.lon + Math.PI) / (2 * Math.PI) * canvas.width;
            const textureY = (lm.lat + Math.PI / 2) / Math.PI * canvas.height;

            const landmassDrawRadius = lm.baseSize * canvas.height; // Scale normalized size to texture height

            // Draw a base circle for the landmass
            ctx.beginPath();
            ctx.arc(textureX, textureY, landmassDrawRadius, 0, Math.PI * 2);
            ctx.fill();

            // Add additional, smaller blobs around the main landmass to create more organic shapes
            const numAddBlobs = Math.floor(1 + Math.random() * 3); // 1-3 additional blobs per landmass
            for (let i = 0; i < numAddBlobs; i++) {
                const angleOffset = (Math.random() * 2 * Math.PI);
                // Offset from the main blob's center, scaling by its radius
                const radialOffset = landmassDrawRadius * (0.5 + Math.random() * 0.5); 
                const blobRadius = landmassDrawRadius * (0.3 + Math.random() * 0.3); // Smaller radius for sub-blobs

                ctx.beginPath();
                ctx.arc(
                    textureX + radialOffset * Math.cos(angleOffset),
                    textureY + radialOffset * Math.sin(angleOffset),
                    blobRadius,
                    0, Math.PI * 2
                );
                ctx.fill();
            }
        });

        ctx.filter = 'none'; // Reset canvas filter after drawing landmasses
        return canvas; // Return the generated texture canvas
    }


    function switchToSolarSystemView(solarSystemId) {
        gameSessionData.activeSolarSystemId = solarSystemId;
        const activeGalaxy = gameSessionData.galaxies.find(g => solarSystemId.startsWith(g.id));
        let solarSystemObject = null;
        if(activeGalaxy && activeGalaxy.solarSystems) {
            solarSystemObject = activeGalaxy.solarSystems.find(ss => ss.id === solarSystemId);
        }

        gameSessionData.solarSystemView.zoomLevel = 0.5; 
        gameSessionData.solarSystemView.currentPanX = 0;
        gameSessionData.solarSystemView.currentPanY = 0;
        gameSessionData.solarSystemView.systemId = solarSystemId;

        solarSystemContent.innerHTML = ''; 

        const sunEl = document.createElement('div');
        sunEl.className = 'sun-icon';
        sunEl.style.width = `${SUN_ICON_SIZE}px`;
        sunEl.style.height = `${SUN_ICON_SIZE}px`;
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
            usedDistances.push({distance: planetDistance, size: planetSize});

            const initialOrbitalAngle = Math.random() * 2 * Math.PI; 
            const orbitalSpeed = MIN_ROTATION_SPEED_RAD_PER_FRAME + Math.random() * (MAX_ROTATION_SPEED_RAD_PER_FRAME - MIN_ROTATION_SPEED_RAD_PER_FRAME);
            const initialAxialAngle = Math.random() * 2 * Math.PI;
            const axialSpeed = DEFAULT_PLANET_AXIAL_SPEED * (Math.random() * 0.5 + 0.75); 

            const newPlanet = { id: `planet-${i}`, size: planetSize, distance: planetDistance, 
                                currentOrbitalAngle: initialOrbitalAngle, orbitalSpeed: orbitalSpeed, 
                                currentAxialAngle: initialAxialAngle, axialSpeed: axialSpeed, 
                                element: null };

            // 50% chance for terrestrial style, otherwise 'normal'
            if(Math.random() < 0.5) {
                newPlanet.type = 'terrestrial';
                newPlanet.waterColor = `hsl(${200 + Math.random()*40}, ${70 + Math.random()*10}%, ${30 + Math.random()*10}%)`;
                newPlanet.grassColor = `hsl(${100 + Math.random()*40}, ${60 + Math.random()*10}%, ${30 + Math.random()*10}%)`;
                
                newPlanet.landmassData = generateLandmassData(Math.floor(4 + Math.random()*4)); // 4-7 primary landmasses
                newPlanet.textureCanvas = createTerrestrialTexture(newPlanet, 256); // Create and store the texture canvas (256px height)
            } else {
                newPlanet.type = 'normal';
                const hue = Math.random() * 360, saturation = 40 + Math.random() * 40, lightnessBase = 50 + Math.random() * 10; 
                newPlanet.color = { hue: hue, saturation: saturation, lightness: lightnessBase };
            }
            gameSessionData.solarSystemView.planets.push(newPlanet);

            const planetEl = document.createElement('div');
            planetEl.className = 'planet-icon';
            planetEl.style.width = `${newPlanet.size}px`;
            planetEl.style.height = `${newPlanet.size}px`;

            // Set the background style for the small solar system icon based on planet type
            if (newPlanet.type === 'normal') {
                const lighterColor = `hsl(${newPlanet.color.hue}, ${newPlanet.color.saturation}%, ${newPlanet.color.lightness + 35}%)`;
                const darkerColor = `hsl(${newPlanet.color.hue}, ${newPlanet.color.saturation}%, ${newPlanet.color.lightness - 35}%)`; 
                planetEl.style.background = `radial-gradient(circle at 20% 20%, ${lighterColor}, ${darkerColor})`;
            } else { // terrestrial (simplified icon for system view)
                // For the small icon, we just create a simple representation of water and some blobs.
                // This doesn't use the texture canvas directly, as it's too small to show detail.
                const randomPos = 15 + Math.random() * 40; 
                const randomSize = 20 + Math.random() * 30; 
                let backgroundStyle = `radial-gradient(circle at ${randomPos}% ${randomPos}%, ${newPlanet.grassColor} ${randomSize}%, transparent ${randomSize + 20}%), ${newPlanet.waterColor}`;
                
                if (Math.random() < 0.5) { 
                    const randomPos2 = 15 + Math.random() * 40;
                    const randomSize2 = 20 + Math.random() * 30;
                    backgroundStyle = `radial-gradient(circle at ${90 - randomPos}% ${90 - randomPos}% , ${newPlanet.grassColor} ${randomSize2}%, transparent ${randomSize2 + 20}%), ` + backgroundStyle;
                }
                planetEl.style.background = backgroundStyle;
            }

            planetEl.style.boxShadow = `0 0 ${newPlanet.size / 3}px rgba(255, 255, 255, 0.3)`;
            
            planetEl.addEventListener('click', (e) => { 
                e.stopPropagation(); 

                currentPlanetDisplayedInPanel = newPlanet; 

                const planetName = `Planet ${newPlanet.id.split('-')[1]}`;
                planetVisualTitle.textContent = planetName; 
                planetVisualSize.textContent = Math.round(newPlanet.size);
                planetVisualPanel.classList.add('visible');
                
                planetVisualPanel.style.left = '50%';
                planetVisualPanel.style.top = '50%';
                planetVisualPanel.style.transform = 'translate(-50%, -50%)';
                planetVisualPanel.style.transition = ''; 

                currentRotationAngleInPanel = 0; // Reset rotation when a new planet is selected
                renderPlanetVisual(newPlanet, currentRotationAngleInPanel);
            });
            solarSystemContent.appendChild(planetEl);
            newPlanet.element = planetEl;
        }

        if (solarSystemTitleText) {
            solarSystemTitleText.textContent = (solarSystemObject && solarSystemObject.customName) ? solarSystemObject.customName : `System ${solarSystemId.substring(solarSystemId.lastIndexOf('-')+1)}`;
            solarSystemTitleText.style.display = 'inline-block';
        }
        if(solarSystemTitleInput) solarSystemTitleInput.style.display = 'none';
        
        setActiveScreen(solarSystemScreen);
        makeTitleEditable(solarSystemTitleText, solarSystemTitleInput, (newName) => {
            if (solarSystemObject) {
                solarSystemObject.customName = newName || null;
                 saveGameState(); 
                 renderGalaxyDetailScreen(); 
                 return solarSystemObject.customName || `System ${solarSystemId.substring(solarSystemId.lastIndexOf('-')+1)}`;
            }
            return `System ${solarSystemId.substring(solarSystemId.lastIndexOf('-')+1)}`;
        });
        renderSolarSystemScreen(false); 
    }

    // Renders the detailed visual of a planet on the planet-visual-canvas.
    // currentRotationAngle controls the horizontal rotation of the planet's surface.
    function renderPlanetVisual(planetData, currentRotationAngle = 0) {
        if (!planetVisualCanvas) return;

        const ctx = planetVisualCanvas.getContext('2d');
        const canvasWidth = planetVisualCanvas.width;
        const canvasHeight = planetVisualCanvas.height;
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        const radius = Math.min(canvasWidth, canvasHeight) * 0.4; 
        
        // Define light source angle (fixed relative to viewer for consistent shading)
        const lightSourceLongitude = Math.PI / 4; // Angle from the front (e.g., 45 degrees left)
        const lightSourceLatitude = Math.PI / 8; // Angle from the equator (e.g., 22.5 degrees up)

        // Calculate 3D coordinates of the light source, if it were on the sphere's surface
        const lightX3D = Math.cos(lightSourceLatitude) * Math.sin(lightSourceLongitude);
        const lightY3D = Math.sin(lightSourceLatitude);
        // We don't use lightZ3D for the gradient origin, but it determines highlight/shadow zones.

        // Convert 3D light source position to 2D canvas coordinates for gradient origin
        const lightDrawX = centerX + radius * lightX3D;
        const lightDrawY = centerY + radius * lightY3D;

        if (planetData.type === 'normal') {
            const hue = planetData.color.hue;
            const saturation = planetData.color.saturation;
            const lightness = planetData.color.lightness;

            const gradient = ctx.createRadialGradient(
                lightDrawX, lightDrawY, radius * 0.1, 
                centerX, centerY, radius * 1.8 
            );

            const lighterColor = `hsl(${hue}, ${saturation}%, ${Math.min(100, lightness + 15)}%)`;
            const darkerColor = `hsl(${hue}, ${saturation}%, ${Math.max(0, lightness - 15)}%)`;

            gradient.addColorStop(0, lighterColor);
            gradient.addColorStop(1, darkerColor);

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            ctx.shadowColor = `hsl(${hue}, ${saturation}%, ${lightness + 5}%)`;
            ctx.shadowBlur = radius * 0.1;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            ctx.fill();
            ctx.shadowBlur = 0; 

        } else { // terrestrial, using texture mapping for seamless appearance
            ctx.save();
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.clip(); // Clip drawing to the planet circle

            const textureCanvas = planetData.textureCanvas;
            const textureWidth = textureCanvas.width;
            const textureHeight = textureCanvas.height;

            // Calculate the horizontal pixel offset for the texture based on the current rotation angle.
            // A full rotation (2 * PI radians) corresponds to the full width of the texture.
            let texturePixelOffset = (currentRotationAngle / (2 * Math.PI)) * textureWidth;
            
            // Ensure the offset wraps around correctly for continuous scrolling feedback
            texturePixelOffset = texturePixelOffset % textureWidth;
            if (texturePixelOffset > 0) texturePixelOffset -= textureWidth; // Adjust to make the "wrapping from right" logic simpler

            // Draw the texture multiple times to create a seamless scrolling effect
            // We draw the texture, shifted by the rotation offset, and stretched to fit the sphere's diameter.
ctx.save();
ctx.beginPath();
ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
ctx.clip();

const steps = Math.ceil(radius * 2); // How many vertical stripes across the sphere
for (let i = 0; i < steps; i++) {
    // Normalized horizontal position [-1, 1]
    const nx = (i / (steps - 1)) * 2 - 1;
    // Angle on the sphere: -π to π (left to right)
    const sphereAngle = Math.asin(nx);

    // Texture longitude (0...1), with rotation
    let texU = ((sphereAngle / Math.PI) + 0.5 + (currentRotationAngle / (2 * Math.PI))) % 1;
    if (texU < 0) texU += 1;

    // Compute x position on the canvas
    const x = centerX + nx * radius;

    // Compute source x in texture
    const sx = Math.floor(texU * textureWidth);

    // Draw a vertical strip
    ctx.drawImage(
        textureCanvas,
        sx, 0, 1, textureHeight, // source: 1px wide vertical strip
        x, centerY - radius, 1, radius * 2 // dest: 1px wide vertical strip
    );
}
ctx.restore();
            // Apply shading over the entire planet (both water and land)
            const shadeGradient = ctx.createRadialGradient(
                lightDrawX, lightDrawY, radius * 0.1, 
                centerX, centerY, radius * 1.8 
            );
            shadeGradient.addColorStop(0, 'rgba(255,255,255,0.1)'); // Highlight
            shadeGradient.addColorStop(0.5, 'rgba(0,0,0,0)');     
            shadeGradient.addColorStop(1, 'rgba(0,0,0,0.6)');    

            ctx.globalCompositeOperation = 'multiply'; 
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.fillStyle = shadeGradient;
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over'; 
        }
    }

    function animateSolarSystem(now) {
        if (!now) now = performance.now();
        if (lastAnimationTime === null) lastAnimationTime = now;
        const deltaTime = (now - lastAnimationTime) / 1000; // Time since last frame in seconds
        lastAnimationTime = now;

        const activeSysView = gameSessionData.solarSystemView;
        if (isSolarSystemPaused) { 
            animationFrameId = requestAnimationFrame(animateSolarSystem); 
            return; 
        }
        if (activeSysView && solarSystemScreen.classList.contains('active') && activeSysView.planets) {
            activeSysView.planets.forEach(planet => {
                // Orbital speed 5x slower compared to original.
                // Orbital speed was previously `planet.orbitalSpeed * .5` per unknown frame rate.
                // Now it's `planet.orbitalSpeed * (0.5 / 5) * 60 * deltaTime` for per-second consistency.
                // So, `planet.orbitalSpeed * 6 * deltaTime`.
                planet.currentOrbitalAngle += planet.orbitalSpeed * 6 * deltaTime;
                planet.currentAxialAngle += planet.axialSpeed * 60 * deltaTime; 

                if (planet.element) {
                    const planetScreenX = planet.distance * Math.cos(planet.currentOrbitalAngle);
                    const planetScreenY = planet.distance * Math.sin(planet.currentOrbitalAngle);
                    planet.element.style.left = `calc(50% + ${planetScreenX}px - ${planet.size / 2}px)`;
                    planet.element.style.top = `calc(50% + ${planetScreenY}px - ${planet.size / 2}px)`;
                    planet.element.style.transform = `translate(-50%, -50%) rotate(${planet.currentAxialAngle}rad)`; // Center transform for rotation
                }
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
    function clampSolarSystemPan(dataObject, viewportWidth, viewportHeight) { if (!dataObject || !viewportWidth || !viewportHeight) { if (dataObject) { dataObject.currentPanX = 0; dataObject.currentPanY = 0; } return; } const zm = dataObject.zoomLevel; const explorableRadius = SOLAR_SYSTEM_EXPLORABLE_RADIUS; const scaledExplorableRadius = explorableRadius * zm; const panSlackX = scaledExplorableRadius - viewportWidth / 2; const panSlackY = scaledExplorableRadius - viewportHeight / 2; const panLimitX = Math.abs(panSlackX); const panLimitY = Math.abs(panSlackY); dataObject.currentPanX = Math.max(-panLimitX, Math.min(panLimitX, dataObject.currentPanX)); dataObject.currentPanY = Math.max(-panLimitY, Math.min(panLimitY, dataObject.currentPanY)); }
    function clampGalaxyPan(galaxy) { if(!galaxy || !galaxyViewport) return; const vw = galaxyViewport.offsetWidth; const vh = galaxyViewport.offsetHeight; const zm = galaxy.currentZoom; if(zm <= GALAXY_VIEW_MIN_ZOOM){ galaxy.currentPanX=0; galaxy.currentPanY=0; } else { const panLimitX = (vw * zm - vw) / 2; const panLimitY = (vh * zm - vh) / 2; galaxy.currentPanX = Math.max(-panLimitX, Math.min(panLimitX, galaxy.currentPanX)); galaxy.currentPanY = Math.max(-panLimitY, Math.min(panLimitY, galaxy.currentPanY)); } }
    function handleZoom(direction,mouseEvent=null){let targetData, viewportElement, currentClampFunction, currentRenderFunction, hardcodedMinZoom, hardcodedMaxZoom, currentZoomProp, currentPanXProp, currentPanYProp, isSolarView=false;if(galaxyDetailScreen.classList.contains('active')){const g=gameSessionData.galaxies.find(gl=>gl.id===gameSessionData.activeGalaxyId); if(!g)return;targetData=g; viewportElement=galaxyViewport; currentClampFunction=clampGalaxyPan; currentRenderFunction=renderGalaxyDetailScreen; hardcodedMinZoom=GALAXY_VIEW_MIN_ZOOM; hardcodedMaxZoom=GALAXY_VIEW_MAX_ZOOM;currentZoomProp='currentZoom'; currentPanXProp='currentPanX'; currentPanYProp='currentPanY';} else if(solarSystemScreen.classList.contains('active')){isSolarView = true;targetData=gameSessionData.solarSystemView; viewportElement=solarSystemScreen; currentClampFunction=clampSolarSystemPan; currentRenderFunction=renderSolarSystemScreen; hardcodedMinZoom=SOLAR_SYSTEM_VIEW_MIN_ZOOM; hardcodedMaxZoom=SOLAR_SYSTEM_VIEW_MAX_ZOOM;currentZoomProp='zoomLevel'; currentPanXProp='currentPanX'; currentPanYProp='currentPanY';} else return;const oldZoom=targetData[currentZoomProp];let newCalculatedZoom =oldZoom+(direction==='in'?(ZOOM_STEP*oldZoom):-(ZOOM_STEP*oldZoom)); let finalMinZoomForClamping = hardcodedMinZoom;if (isSolarView) {const viewportWidth = viewportElement.offsetWidth;const viewportHeight = viewportElement.offsetHeight;let dynamicMinZoomBasedOnExplorable = 0; if (SOLAR_SYSTEM_EXPLORABLE_RADIUS > 0 && (viewportWidth > 0 || viewportHeight > 0)) {const minZoomToCoverWidth = viewportWidth > 0 ? viewportWidth / (SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2) : 0;const minZoomToCoverHeight = viewportHeight > 0 ? viewportHeight / (SOLAR_SYSTEM_EXPLORABLE_RADIUS * 2) : 0;dynamicMinZoomBasedOnExplorable = Math.max(minZoomToCoverWidth, minZoomToCoverHeight);}finalMinZoomForClamping = Math.max(hardcodedMinZoom, dynamicMinZoomBasedOnExplorable);}newCalculatedZoom=Math.max(finalMinZoomForClamping, Math.min(hardcodedMaxZoom, newCalculatedZoom)); if (Math.abs(oldZoom - newCalculatedZoom) < 0.0001) return; targetData[currentZoomProp]=newCalculatedZoom; if(mouseEvent){ const rect=viewportElement.getBoundingClientRect();const mX=mouseEvent.clientX-rect.left;const mY=mouseEvent.clientY-rect.top;const oPX=targetData[currentPanXProp]||0; const oPY=targetData[currentPanYProp]||0; const worldX = (mX - viewportElement.offsetWidth/2 - oPX) / oldZoom;const worldY = (mY - viewportElement.offsetHeight/2 - oPY) / oldZoom;targetData[currentPanXProp] = (mX - viewportElement.offsetWidth/2) - (worldX * newCalculatedZoom);targetData[currentPanYProp] = (mY - viewportElement.offsetHeight/2) - (worldY * newCalculatedZoom);}if(isSolarView) currentClampFunction(targetData, viewportElement.offsetWidth, viewportElement.offsetHeight);else currentClampFunction(targetData); currentRenderFunction(true);if (isSolarView) { const activeSysView = gameSessionData.solarSystemView;activeSysView.planets.forEach(planet => {if (planet.element) {const planetScreenX = planet.distance * Math.cos(planet.currentOrbitalAngle);const planetScreenY = planet.distance * Math.sin(planet.currentOrbitalAngle);planet.element.style.left = `calc(50% + ${planetScreenX}px - ${planet.size / 2}px)`;planet.element.style.top = `calc(50% + ${planetScreenY}px - ${planet.size / 2}px)`;planet.element.style.transform = `translate(-50%, -50%) rotate(${planet.currentAxialAngle}rad)`;}});drawAllOrbits(); }}
    function startPan(event,viewportEl,contentEl,dataObjectRef){if(event.button!==0||event.target.closest('button'))return;if(viewportEl===galaxyViewport&&(event.target.classList.contains('solar-system-icon')||event.target.closest('.solar-system-icon')))return;const pS=gameSessionData.panning;pS.isActive=true;pS.startX=event.clientX;pS.startY=event.clientY;pS.initialPanX=dataObjectRef.currentPanX||0;pS.initialPanY=dataObjectRef.currentPanY||0;pS.targetElement=contentEl;pS.viewportElement=viewportEl;pS.dataObject=dataObjectRef;viewportEl.classList.add('dragging');if(contentEl) contentEl.style.transition='none';event.preventDefault()}
    function panMouseMove(event){if(!gameSessionData.panning.isActive)return;const pS=gameSessionData.panning,dX=event.clientX-pS.startX,dY=event.clientY-pS.startY;pS.dataObject.currentPanX=pS.initialPanX+dX;pS.dataObject.currentPanY=pS.initialPanY+dY;if(pS.viewportElement===galaxyViewport){clampGalaxyPan(pS.dataObject);renderGalaxyDetailScreen(true)}else if(pS.viewportElement===solarSystemScreen){clampSolarSystemPan(pS.dataObject,pS.viewportElement.offsetWidth,pS.viewportElement.offsetHeight);renderSolarSystemScreen(true); if(solarSystemScreen.classList.contains('active')) { drawAllOrbits(); } }}
    function panMouseUp(){if(!gameSessionData.panning.isActive)return;if(gameSessionData.panning.viewportElement)gameSessionData.panning.viewportElement.classList.remove('dragging');const pS=gameSessionData.panning;pS.isActive=!1;if(pS.targetElement)pS.targetElement.style.transition='';if(galaxyDetailScreen.classList.contains('active'))renderGalaxyDetailScreen(!1);else if(solarSystemScreen.classList.contains('active'))renderSolarSystemScreen(!1);pS.targetElement=null;pS.viewportElement=null;pS.dataObject=null;}
    
    function regenerateCurrentUniverseState(fromModal = false){if (!fromModal && !confirm("Regenerate universe with current settings? This will clear the currently saved layout.")) {return;}localStorage.removeItem('galaxyGameSaveData');gameSessionData.universe = { diameter: null };gameSessionData.galaxies = [];gameSessionData.activeGalaxyId = null;gameSessionData.activeSolarSystemId = null;gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };gameSessionData.isInitialized = false;if (universeCircle) universeCircle.innerHTML = '';if (galaxyZoomContent) {const canvas = galaxyZoomContent.querySelector('#solar-system-lines-canvas');galaxyZoomContent.innerHTML = ''; if(canvas) galaxyZoomContent.appendChild(canvas); }if (solarSystemContent) solarSystemContent.innerHTML = '';if (orbitCtx && solarSystemOrbitCanvasEl) orbitCtx.clearRect(0,0,solarSystemOrbitCanvasEl.width,solarSystemOrbitCanvasEl.height);if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }initializeGame(true); }
    if (regenerateUniverseButton) {regenerateUniverseButton.addEventListener('click', () => regenerateCurrentUniverseState(false));}
    if (customizeGenerationButton) {customizeGenerationButton.addEventListener('click', () => {numGalaxiesInput.value = currentNumGalaxies;minSSInput.value = currentMinSSCount;maxSSInput.value = currentMaxSSCount;ssSpreadInput.value = currentMaxPlanetDistanceMultiplier.toFixed(1);minPlanetsInput.value = currentMinPlanets;maxPlanetsInput.value = currentMaxPlanets;showOrbitsInput.checked = currentShowPlanetOrbits;customizationModal.classList.add('visible');});}
    if (cancelCustomizationButton) {cancelCustomizationButton.addEventListener('click', () => {customizationModal.classList.remove('visible');});}
    if (applyCustomizationButton) {applyCustomizationButton.addEventListener('click', () => { const numGal = parseInt(numGalaxiesInput.value, 10); const minSS = parseInt(minSSInput.value, 10); const maxSS = parseInt(maxSSInput.value, 10); const spread = parseFloat(ssSpreadInput.value); const minP = parseInt(minPlanetsInput.value, 10); const maxP = parseInt(maxPlanetsInput.value, 10); if (isNaN(numGal) || numGal < 1 || numGal > 10 || isNaN(minSS) || minSS < 10 || minSS > 1000 || isNaN(maxSS) || maxSS < 10 || maxSS > 2000 || maxSS < minSS || isNaN(spread) || spread < 0.1 || spread > 5.0 || isNaN(minP) || minP < 0 || minP > 5 || isNaN(maxP) || maxP < minP || maxP > 8) { alert("Invalid input values. Please check ranges and ensure Max >= Min for systems and planets."); return; } currentNumGalaxies = numGal; currentMinSSCount = minSS; currentMaxSSCount = maxSS; currentMaxPlanetDistanceMultiplier = spread; currentMinPlanets = minP; currentMaxPlanets = maxP; currentShowPlanetOrbits = showOrbitsInput.checked; updateDerivedConstants(); saveCustomizationSettings(); customizationModal.classList.remove('visible'); regenerateCurrentUniverseState(true); });}
    
    if (closePlanetVisualPanelBtn) {
        closePlanetVisualPanelBtn.addEventListener('click', () => {
            planetVisualPanel.classList.remove('visible');
        });
    }

    let isPanelDragging = false;
    let visualPanelOffset = { x: 0, y: 0 };

    if (planetVisualPanelHeader) {
        planetVisualPanelHeader.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; 
            isPanelDragging = true;
            planetVisualPanelHeader.classList.add('dragging');
            
            planetVisualPanel.style.transition = 'none';

            const rect = planetVisualPanel.getBoundingClientRect();
            visualPanelOffset.x = e.clientX - rect.left;
            visualPanelOffset.y = e.clientY - rect.top;

            planetVisualPanel.style.left = `${rect.left}px`;
            planetVisualPanel.style.top = `${rect.top}px`;
            planetVisualPanel.style.transform = 'none'; 
            planetVisualPanel.style.right = 'auto'; 
            planetVisualPanel.style.bottom = 'auto';

            e.preventDefault(); 
        });
    }

    // Event listeners for dragging planet visual within its panel
    planetVisualCanvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !currentPlanetDisplayedInPanel) return;
        isDraggingPlanetVisual = true;
        dragStartX = e.clientX;
        // Apply dragging class to canvas to change cursor
        planetVisualCanvas.classList.add('dragging'); 
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (isPanelDragging) {
            planetVisualPanel.style.left = `${e.clientX - visualPanelOffset.x}px`;
            planetVisualPanel.style.top = `${e.clientY - visualPanelOffset.y}px`;
        }
        if (isDraggingPlanetVisual && currentPlanetDisplayedInPanel) {
            const deltaX = e.clientX - dragStartX;
            const rotationSpeed = 0.005; // Adjust sensitivity
            currentRotationAngleInPanel += (deltaX * rotationSpeed);
            renderPlanetVisual(currentPlanetDisplayedInPanel, currentRotationAngleInPanel);
            dragStartX = e.clientX; 
        }
    });

    window.addEventListener('mouseup', () => {
        if (isPanelDragging) {
            isPanelDragging = false;
            planetVisualPanelHeader.classList.remove('dragging');
            planetVisualPanel.style.transition = ''; 
        }
        if (isDraggingPlanetVisual) {
            isDraggingPlanetVisual = false;
            planetVisualCanvas.classList.remove('dragging'); 
        }
    });

    function initializeGame(isForcedRegeneration = false) {loadCustomizationSettings(); if (!isForcedRegeneration && loadGameState()) {setActiveScreen(mainScreen); if (universeCircle && gameSessionData.universe.diameter) {universeCircle.style.width = `${gameSessionData.universe.diameter}px`;universeCircle.style.height = `${gameSessionData.universe.diameter}px`;universeCircle.style.backgroundColor = FIXED_COLORS.universeBg;} else {generateUniverseLayout(); }renderMainScreen(); preGenerateAllGalaxyContents(); } else {generateUniverseLayout();generateGalaxies(); setActiveScreen(mainScreen); renderMainScreen();preGenerateAllGalaxyContents(); if(gameSessionData.galaxies.every(g => g.layoutGenerated)) {saveGameState();}}gameSessionData.isInitialized = true;}
    window.addEventListener('resize', () => { const currentScreenIdBeforeResize = document.querySelector('.screen.active')?.id;localStorage.removeItem('galaxyGameSaveData'); gameSessionData.universe = { diameter: null };gameSessionData.galaxies = [];gameSessionData.activeGalaxyId = null;gameSessionData.activeSolarSystemId = null;gameSessionData.solarSystemView = { zoomLevel: 1.0, currentPanX: 0, currentPanY: 0, planets: [], systemId: null };gameSessionData.isInitialized = false;if (universeCircle) universeCircle.innerHTML = '';if (galaxyZoomContent) {const canvas = galaxyZoomContent.querySelector('#solar-system-lines-canvas');galaxyZoomContent.innerHTML = ''; if(canvas) galaxyZoomContent.appendChild(canvas); }if (solarSystemContent) solarSystemContent.innerHTML = '';if (orbitCtx && solarSystemOrbitCanvasEl) orbitCtx.clearRect(0,0,solarSystemOrbitCanvasEl.width,solarSystemOrbitCanvasEl.height); if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }lastAnimationTime = null; 
    loadCustomizationSettings(); initializeGame(true);  if (currentScreenIdBeforeResize) { const screenToActivate = document.getElementById(currentScreenIdBeforeResize) || mainScreen; setActiveScreen(screenToActivate);  } else { setActiveScreen(mainScreen); }});
    if(backToMainButton) backToMainButton.addEventListener('click', switchToMainView);
    if(backToGalaxyButton) backToGalaxyButton.addEventListener('click', () => { if(gameSessionData.activeGalaxyId && gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId)) {switchToGalaxyDetailView(gameSessionData.activeGalaxyId);} else {switchToMainView();} });
    if(zoomInButton) zoomInButton.addEventListener('click', (e) => handleZoom('in', e));
    if(zoomOutButton) zoomOutButton.addEventListener('click', (e) => handleZoom('out', e));
    if (galaxyViewport) {
        galaxyViewport.addEventListener('wheel', (e) => {
            if (galaxyDetailScreen.classList.contains('active')) {
                e.preventDefault();
                handleZoom(e.deltaY < 0 ? 'in' : 'out', e);
            }
        });
    }
    if(solarSystemScreen) { solarSystemScreen.addEventListener('wheel', (e) => { if(solarSystemScreen.classList.contains('active')) { e.preventDefault(); if(!e.target.closest('button')) handleZoom(e.deltaY < 0 ? 'in' : 'out', e); }}, {passive: false});solarSystemScreen.addEventListener('mousedown', (e) => { if(solarSystemScreen.classList.contains('active')) { startPan(e, solarSystemScreen, solarSystemContent, gameSessionData.solarSystemView); }});}
    window.addEventListener('mousemove', panMouseMove);
    window.addEventListener('mouseup', panMouseUp);
    if(galaxyZoomContent) { galaxyZoomContent.addEventListener('click', function(event) { if (gameSessionData.panning.isActive && !event.target.classList.contains('solar-system-icon')) { return; } if (event.target.classList.contains('solar-system-icon')) { const ssId = event.target.dataset.solarSystemId; if (ssId) { switchToSolarSystemView(ssId); event.stopPropagation(); return; } } }); }

let isGalaxyPanning = false;
let galaxyPanStart = { x: 0, y: 0 };
let galaxyLastPan = { x: 0, y: 0 };

if (galaxyViewport) {
  galaxyViewport.addEventListener('mousedown', (e) => {
    if (
      e.button !== 0 ||
      !galaxyDetailScreen.classList.contains('active') ||
      e.target.classList.contains('solar-system-icon') ||
      e.target.closest('button')
    ) return;

    isGalaxyPanning = true;
    galaxyPanStart.x = e.clientX;
    galaxyPanStart.y = e.clientY;

    const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
    galaxyLastPan.x = gal?.currentPanX || 0;
    galaxyLastPan.y = gal?.currentPanY || 0;

    galaxyViewport.classList.add('dragging');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isGalaxyPanning) return;

    const gal = gameSessionData.galaxies.find(g => g.id === gameSessionData.activeGalaxyId);
    if (!gal) return;

    const dx = e.clientX - galaxyPanStart.x;
    const dy = e.clientY - galaxyPanStart.y;

    gal.currentPanX = galaxyLastPan.x + dx;
    gal.currentPanY = galaxyLastPan.y + dy;

    if (typeof clampGalaxyPan === 'function') {
      clampGalaxyPan(gal);
    }
    renderGalaxyDetailScreen(true);
  });

  window.addEventListener('mouseup', (e) => {
    if (isGalaxyPanning) {
      isGalaxyPanning = false;
      galaxyViewport.classList.remove('dragging');
    }
  });
}
            
    initializeGame();
});
