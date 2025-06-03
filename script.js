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
  let rotationLongitude = 0;
  let rotationLatitude = 0;
  let lastDragX = 0, lastDragY = 0;
  let lastPlanetDragTime = 0;
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
  let renderPending = false;

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

fetch('https://save-api.nicholasgutteridge512.workers.dev/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
   userId: 'sundance-lab',
  })
})
.then(res => res.text())
.then(msg => console.log('Server save:', msg))
.catch(err => console.error('Server save failed:', err));

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

const userId = 'sundance-lab';

fetch(`https://save-api.nicholasgutteridge512.workers.dev/?key=$`)
  .then(res => {
   if (!res.ok) throw new Error('Not found');
   return res.json();
  })
  .then(data => {
   if (data && data.gameState) {
     console.log('Loaded game state from server:', data.gameState);
   }
  })
  .catch(err => {
   console.log('Could not load from server:', err);
  });

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

  function generateLandmassData(numLandmasses) {
    const landmasses = [];
    for (let i = 0; i < numLandmasses; i++) {
      landmasses.push({
        lon: (Math.random() - 0.5) * 2 * Math.PI,
        lat: (Math.random() - 0.5) * 0.8 * Math.PI,
        baseSize: (0.15 + Math.random() * 0.25)
      });
    }
    return landmasses;
  }

  function drawSeamlessCircle(ctx, x, y, r, canvasWidth, canvasHeight) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (x - r < 0) {
      ctx.beginPath();
      ctx.arc(x + canvasWidth, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (x + r > canvasWidth) {
      ctx.beginPath();
      ctx.arc(x - canvasWidth, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function createTerrestrialTexture(planetData, textureSize = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = textureSize * 2;
    canvas.height = textureSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    ctx.fillStyle = planetData.waterColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.filter = `blur(${textureSize * 0.02}px)`;

    ctx.fillStyle = planetData.grassColor;

    planetData.landmassData.forEach(lm => {
      const textureX = (lm.lon + Math.PI) / (2 * Math.PI) * canvas.width;
      const textureY = (lm.lat + Math.PI / 2) / Math.PI * canvas.height;

      const landmassDrawRadius = lm.baseSize * canvas.height;

      drawSeamlessCircle(ctx, textureX, textureY, landmassDrawRadius, canvas.width, canvas.height);

      const numAddBlobs = Math.floor(1 + Math.random() * 3);
      for (let i = 0; i < numAddBlobs; i++) {
        const angleOffset = (Math.random() * 2 * Math.PI);
        const radialOffset = landmassDrawRadius * (0.5 + Math.random() * 0.5);
        const blobRadius = landmassDrawRadius * (0.3 + Math.random() * 0.3);

        drawSeamlessCircle(
          ctx,
          textureX + radialOffset * Math.cos(angleOffset),
          textureY + radialOffset * Math.sin(angleOffset),
          blobRadius,
          canvas.width,
          canvas.height
        );
      }
    });

    ctx.filter = 'none';
    return canvas;
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

      const newPlanet = { id: `planet-${i+1}`, size: planetSize, distance: planetDistance,
                currentOrbitalAngle: initialOrbitalAngle, orbitalSpeed: orbitalSpeed,
                currentAxialAngle: initialAxialAngle, axialSpeed: axialSpeed,
                element: null };

      if(Math.random() < 0.5) {
        newPlanet.type = 'terrestrial';
        newPlanet.waterColor = `hsl(${200 + Math.random()*40}, ${70 + Math.random()*10}%, ${30 + Math.random()*10}%)`;
        newPlanet.grassColor = `hsl(${100 + Math.random()*40}, ${60 + Math.random()*10}%, ${30 + Math.random()*10}%)`;

        newPlanet.landmassData = generateLandmassData(Math.floor(4 + Math.random()*4));
        newPlanet.textureCanvas = createTerrestrialTexture(newPlanet, 256);
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

      if (newPlanet.type === 'normal') {
        const lighterColor = `hsl(${newPlanet.color.hue}, ${newPlanet.color.saturation}%, ${newPlanet.color.lightness + 35}%)`;
        const darkerColor = `hsl(${newPlanet.color.hue}, ${newPlanet.color.saturation}%, ${newPlanet.color.lightness - 35}%)`;
        planetEl.style.background = `radial-gradient(circle at 20% 20%, ${lighterColor}, ${darkerColor})`;
      } else {
        const randomPos = 15 + Math.random() * 40;
        const randomSize = 20 + Math.random() * 30;
        let backgroundStyle = `radial-gradient(circle at ${randomPos}% ${randomPos}%, ${newPlanet.grassColor} ${randomSize}%, transparent ${randomSize + 20}%), ${newPlanet.waterColor}`;

        if (Math.random() < 0.5) {
          const randomPos2 = 15 + Math.random() * 40;
          const randomSize2 = 20 + Math.random() * 30;
          backgroundStyle = `radial-gradient(circle at ${90 - randomPos2}% ${90 - randomPos2}% , ${newPlanet.grassColor} ${randomSize2}%, transparent ${randomSize2 + 20}%), ` + backgroundStyle;
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

        rotationLongitude = 0;
        rotationLatitude = 0;

        if (newPlanet.segmentsData) {
            newPlanet.segmentsData.map.forEach(seg => seg.isPink = false);
        }
        renderPlanetVisual(newPlanet, rotationLongitude, rotationLatitude);
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

// Place this function in place of the old generateRandomSquigglySegments(planetData, 40)
function generateRandomSquigglySegments(planetData, numSegments = 40) {
    // Generate random seed points on the sphere (phi: latitude, theta: longitude)
    const seeds = [];
    for (let i = 0; i < numSegments; i++) {
        seeds.push({
            phi: Math.acos(2 * Math.random() - 1), // 0 to PI
            theta: Math.random() * 2 * Math.PI,    // 0 to 2PI
            id: i
        });
    }

    // Perlin/simplex noise setup (optional: for squiggliness)
    function noise(phi, theta) {
        // Simple fast pseudo-noise: can be improved with proper perlin/simplex implementation
        return Math.sin(13 * phi + 17 * theta) * Math.cos(23 * phi - 19 * theta);
    }

    planetData.segmentsData = {
        seeds,
        map: new Map(),
        numSegments
    };
}
function drawSegmentLines(ctx, planetData, currentLon, currentLat, sphereRadius, centerX, centerY) {
    if (!planetData.segmentsData || planetData.segmentsData.latBandStarts.length < 2 || planetData.segmentsData.lonSliceStarts.length < 2) return;

    const { latBandStarts, lonSliceStarts } = planetData.segmentsData;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    const R = 1; // Unit sphere radius for calculations

    // Helper to get rotated 3D point and check visibility
    const getRotatedAndVisiblePoint = (phi, theta_raw) => {
        const theta = theta_raw; // Use raw theta for consistency with sphere calculation, handling 2*PI boundary will be done by atan2.

        // Cartesian for unrotated sphere
        const x_unrotated = R * Math.sin(phi) * Math.cos(theta);
        const y_unrotated = R * Math.cos(phi);
        const z_unrotated = R * Math.sin(phi) * Math.sin(theta);

        // Apply latitude rotation (around X-axis - pitch)
        const pX_lat = x_unrotated;
        const pY_lat = y_unrotated * Math.cos(currentLat) - z_unrotated * Math.sin(currentLat);
        const pZ_lat = y_unrotated * Math.sin(currentLat) + z_unrotated * Math.cos(currentLat);

        // Apply longitude rotation (around Y-axis - yaw)
        const rotatedX = pX_lat * Math.cos(currentLon) + pZ_lat * Math.sin(currentLon);
        const rotatedY = pY_lat;
        const rotatedZ = -pX_lat * Math.sin(currentLon) + pZ_lat * Math.cos(currentLon); // Z is depth from viewer

        // Check visibility (positive Z means in front)
        const threshold = -0.001 * sphereRadius; // Small epsilon to avoid lines disappearing right at the edge
        const isVisible = rotatedZ > threshold;

        return { x: rotatedX, y: rotatedY, z: rotatedZ, isVisible: isVisible };
    };

    // Draw Latitude lines (parallels)
    for (let i = 0; i < latBandStarts.length; i++) {
        const phi = latBandStarts[i];
        ctx.beginPath();
        let prevPoint = null;
        for (let j = 0; j < lonSliceStarts.length; j++) {
            const theta_raw = lonSliceStarts[j];
            const currentPoint = getRotatedAndVisiblePoint(phi, theta_raw);
            
            const canvasX = centerX + currentPoint.x * sphereRadius + (Math.random() - 0.5) * 0.7; // Jitter
            const canvasY = centerY + currentPoint.y * sphereRadius + (Math.random() - 0.5) * 0.7; // Jitter

            if (currentPoint.isVisible) {
                if (prevPoint && prevPoint.isVisible) {
                    ctx.lineTo(canvasX, canvasY);
                } else {
                    ctx.moveTo(canvasX, canvasY);
                }
            } else if (prevPoint && prevPoint.isVisible) { // Previous point was visible, current is not. Draw to intersection
                // Simplified intersection: just end the line and stroke
                ctx.lineTo(canvasX, canvasY); // Still connect, but don't start new path later
                ctx.stroke();
                ctx.beginPath(); // Start a new path for next visible segment
            } else if (prevPoint && j === lonSliceStarts.length - 1 && lonSliceStarts[0] !== lonSliceStarts[lonSliceStarts.length - 1]) { // Handle wrapping line for parallels
                // If it's the last point and wraps around, check connection to first point if both are visible.
                // This gets complex, for simplicity, assume line breaks at non-visible points.
            }
            prevPoint = currentPoint;
        }
        ctx.stroke(); // Ensure any remaining partial path is drawn
    }

    // Draw Longitude lines (meridians)
    for (let j = 0; j < lonSliceStarts.length; j++) {
        const theta_raw = lonSliceStarts[j];
        ctx.beginPath();
        let prevPoint = null;
        for (let i = 0; i < latBandStarts.length; i++) {
            const phi = latBandStarts[i];
            const currentPoint = getRotatedAndVisiblePoint(phi, theta_raw);

            const canvasX = centerX + currentPoint.x * sphereRadius + (Math.random() - 0.5) * 0.7; // Jitter
            const canvasY = centerY + currentPoint.y * sphereRadius + (Math.random() - 0.5) * 0.7; // Jitter

            if (currentPoint.isVisible) {
                if (prevPoint && prevPoint.isVisible) {
                    ctx.lineTo(canvasX, canvasY);
                } else {
                    ctx.moveTo(canvasX, canvasY);
                }
            } else if (prevPoint && prevPoint.isVisible) { // Previous point was visible, current is not. Draw to intersection
                ctx.lineTo(canvasX, canvasY);
                ctx.stroke();
                ctx.beginPath();
            }
            prevPoint = currentPoint;
        }
        ctx.stroke(); // Ensure any remaining partial path is drawn
    }
}

  function renderPlanetVisual(planetData, longitude = 0, latitude = 0) {
    if (!planetVisualCanvas) return;

    const ctx = planetVisualCanvas.getContext('2d', { willReadFrequently: true });
    const canvasWidth = planetVisualCanvas.width;
    const canvasHeight = planetVisualCanvas.height;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const radius = Math.min(canvasWidth, canvasHeight) * 0.4;
    const steps = isDraggingPlanetVisual
    ? Math.ceil(radius * 1.0)
    : Math.ceil(radius * 2);

    // Light source vector (arbitrarily chosen position relative to viewer)
    const lightSourceLongitude = Math.PI / 4;
    const lightSourceLatitude = Math.PI / 8;

    const lightVecX = Math.cos(lightSourceLatitude) * Math.sin(lightSourceLongitude); // X in viewer space
    const lightVecY = Math.sin(lightSourceLatitude); // Y in viewer space
    const lightVecZ = Math.cos(lightSourceLatitude) * Math.cos(lightSourceLongitude); // Z in viewer space (pointing out/forward)

    if (!planetData.segmentsData) {
        generateRandomSquigglySegments(planetData, 40);
    }

    // Main pixel rendering loop for both normal and terrestrial planets
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip(); // Clip drawing to the planet circle

    let textureData = null;
    let textureWidth = 0;
    let textureHeight = 0;

    if (planetData.type === 'terrestrial') {
        const textureCanvas = planetData.textureCanvas;
        textureWidth = textureCanvas.width;
        textureHeight = textureCanvas.height;
        const tempCtx = textureCanvas.getContext('2d', { willReadFrequently: true });
        textureData = tempCtx.getImageData(0, 0, textureWidth, textureHeight);
    }

    for (let i = 0; i < steps; i++) {
        for (let j = 0; j < steps; j++) {
            const nx = (i / (steps - 1)) * 2 - 1; // Normalized X from -1 to 1
            const ny = (j / (steps - 1)) * 2 - 1; // Normalized Y from -1 to 1
            if (nx * nx + ny * ny > 1) continue; // Outside the circle

            // Calculate 3D point on unit sphere (Z points out)
            const x_sphere = nx;
            const y_sphere = ny;
            const z_sphere = Math.sqrt(1 - x_sphere * x_sphere - y_sphere * y_sphere); // Z is depth, positive means facing viewer

            // Apply latitude rotation (around X-axis - pitch)
            const pX_lat = x_sphere;
            const pY_lat = y_sphere * Math.cos(latitude) - z_sphere * Math.sin(latitude);
            const pZ_lat = y_sphere * Math.sin(latitude) + z_sphere * Math.cos(latitude);

            // Apply longitude rotation (around Y-axis - yaw)
            const rotatedX = pX_lat * Math.cos(longitude) + pZ_lat * Math.sin(longitude);
            const rotatedY = pY_lat;
            const rotatedZ = -pX_lat * Math.sin(longitude) + pZ_lat * Math.cos(longitude); // Final Z is depth from viewer

            let r, g, b, a;

            // Lighting calculation
            const ambientLight = 0.25; // Minimum light for the dark side
            const diffuseLight = 0.75;
            // Normal vector for lighting is the same as the point's position vector on the unit sphere
            const dotProduct = rotatedX * lightVecX + rotatedY * lightVecY + rotatedZ * lightVecZ; // Dot product with normalized light vector
            const lightIntensity = Math.max(0, dotProduct) * diffuseLight + ambientLight; // Max(0, dot) for diffuse, add ambient

            if (planetData.type === 'terrestrial') {
                // Determine original spherical coordinates (phi, theta) for texture lookup
                const phi_original = Math.acos(rotatedY); // Latitude (0 to PI) from Y
                const theta_original = (Math.atan2(rotatedX, rotatedZ) + 2 * Math.PI) % (2 * Math.PI); // Longitude (0 to 2PI) from X, Z

                // Map to texture coordinates (0 to 1)
                let texU = theta_original / (2 * Math.PI);
                let texV = phi_original / Math.PI;

                // Sample the texture
                let sx = Math.floor(texU * textureWidth);
                let sy = Math.floor(texV * textureHeight);

                // Clamp texture coordinates
                sx = Math.max(0, Math.min(textureWidth - 1, sx));
                sy = Math.max(0, Math.min(textureHeight - 1, sy));

                const idx = (sy * textureWidth + sx) * 4;
                r = textureData.data[idx];
                g = textureData.data[idx + 1];
                b = textureData.data[idx + 2];
                a = textureData.data[idx + 3];

                // Apply lighting
                r = Math.min(255, r * lightIntensity);
                g = Math.min(255, g * lightIntensity);
                b = Math.min(255, b * lightIntensity);

            } else { // 'normal' planet type
                const hue = planetData.color.hue;
                const saturation = planetData.color.saturation;
                const lightness = planetData.color.lightness;

                // Apply lighting to lightness
                const litLightness = Math.max(0, Math.min(100, lightness * lightIntensity));
                
                // Convert HSL to RGB for direct setting
                const hslToRgb = (h, s, l) => {
                    s /= 100;
                    l /= 100;
                    let c = (1 - Math.abs(2 * l - 1)) * s,
                        x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
                        m = l - c / 2,
                        r_val = 0,
                        g_val = 0,
                        b_val = 0;
                    if (0 <= h && h < 60) {r_val = c; g_val = x; b_val = 0;}
                    else if (60 <= h && h < 120) {r_val = x; g_val = c; b_val = 0;}
                    else if (120 <= h && h < 180) {r_val = 0; g_val = c; b_val = x;}
                    else if (180 <= h && h < 240) {r_val = 0; g_val = x; b_val = c;}
                    else if (240 <= h && h < 300) {r_val = x; g_val = 0; b_val = c;}
                    else if (300 <= h && h < 360) {r_val = c; g_val = 0; b_val = x;}
                    r_val = Math.round((r_val + m) * 255);
                    g_val = Math.round((g_val + m) * 255);
                    b_val = Math.round((b_val + m) * 255);
                    return [r_val, g_val, b_val];
                };
                [r, g, b] = hslToRgb(hue, saturation, litLightness);
                a = 255;
            }

            // Determine which segment this pixel belongs to for 'pink' coloring
            const current_phi = Math.acos(rotatedY); // Use rotatedY here as it's the Y in the final viewer space
            const current_theta = (Math.atan2(rotatedX, rotatedZ) + 2 * Math.PI) % (2 * Math.PI);

            let latBandIndex = -1;
            for (let k = 0; k < planetData.segmentsData.latBandStarts.length - 1; k++) {
                if (current_phi >= planetData.segmentsData.latBandStarts[k] && current_phi < planetData.segmentsData.latBandStarts[k + 1]) {
                    latBandIndex = k;
                    break;
                }
            }
            if (latBandIndex === -1 && current_phi === Math.PI) latBandIndex = planetData.segmentsData.latBandStarts.length - 2; // Handle South Pole exact match

            let lonBandIndex = -1;
            for (let k = 0; k < planetData.segmentsData.lonSliceStarts.length - 1; k++) {
                if (current_theta >= planetData.segmentsData.lonSliceStarts[k] && current_theta < planetData.segmentsData.lonSliceStarts[k + 1]) {
                    lonBandIndex = k;
                    break;
                }
            }
            if (lonBandIndex === -1 && current_theta === 2 * Math.PI) lonBandIndex = planetData.segmentsData.lonSliceStarts.length - 2; // Handle 2PI exact match

            const segment = planetData.segmentsData.map.get(`${latBandIndex},${lonBandIndex}`);
            if (segment && segment.isPink) {
                r = 255; g = 105; b = 180; // Bright Pink
            }

            ctx.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
            ctx.fillRect(centerX + nx * radius, centerY + ny * radius, 1, 1);
        }
    }
    ctx.restore();

    // Draw segment lines on top of the rendered planet
    drawSegmentLines(ctx, planetData, longitude, latitude, radius, centerX, centerY);
  }

  function animateSolarSystem(now) {
    if (!now) now = performance.now();
    if (lastAnimationTime === null) lastAnimationTime = now;
    const deltaTime = (now - lastAnimationTime) / 1000;
    lastAnimationTime = now;

    const activeSysView = gameSessionData.solarSystemView;
    if (isSolarSystemPaused) {
      animationFrameId = requestAnimationFrame(animateSolarSystem);
      return;
    }
    if (activeSysView && solarSystemScreen.classList.contains('active') && activeSysView.planets) {
      activeSysView.planets.forEach(planet => {
        planet.currentOrbitalAngle += planet.orbitalSpeed * 6 * deltaTime;
        planet.currentAxialAngle += planet.axialSpeed * 60 * deltaTime;

        if (planet.element) {
          const planetScreenX = planet.distance * Math.cos(planet.currentOrbitalAngle);
          const planetScreenY = planet.distance * Math.sin(planet.currentOrbitalAngle);
          planet.element.style.left = `calc(50% + ${planetScreenX}px - ${planet.size / 2}px)`;
          planet.element.style.top = `calc(50% + ${planetScreenY}px - ${planet.size / 2}px)`;
          planet.element.style.transform = `translate(-50%, -50%) rotate(${planet.currentAxialAngle}rad)`;
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
  if (applyCustomizationButton) {applyCustomizationButton.addEventListener('click', () => { const numGal = parseInt(numGalaxiesInput.value, 10); const minSS = parseInt(minSSInput.value, 10); const maxSS = parseInt(maxSSInput.value, 10); const spread = parseFloat(ssSpreadInput.value); const minP = parseInt(minPlanetsInput.value, 10); const maxP = parseInt(maxPlanetsInput.value, 10); if (isNaN(numGal) || numGal < 1 || numGal > 10 || isNaN(minSS) || minSS < 10 || minSS > 500 || isNaN(maxSS) || maxSS < 10 || maxSS > 1000 || maxSS < minSS || isNaN(spread) || spread < 0.1 || spread > 5.0 || isNaN(minP) || minP < 0 || minP > 5 || isNaN(maxP) || maxP < minP || maxP > 8) { alert("Invalid input values. Please check ranges and ensure Max >= Min for systems and planets."); return; } currentNumGalaxies = numGal; currentMinSSCount = minSS; currentMaxSSCount = maxSS; currentMaxPlanetDistanceMultiplier = spread; currentMinPlanets = minP; currentMaxPlanets = maxP; currentShowPlanetOrbits = showOrbitsInput.checked; updateDerivedConstants(); saveCustomizationSettings(); customizationModal.classList.remove('visible'); regenerateCurrentUniverseState(true); });}

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

planetVisualCanvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !currentPlanetDisplayedInPanel) return;
  isDraggingPlanetVisual = true;
  lastDragX = e.clientX;
  lastDragY = e.clientY;
  planetVisualCanvas.classList.add('dragging');
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (isPanelDragging) {
    planetVisualPanel.style.left = `${e.clientX - visualPanelOffset.x}px`;
    planetVisualPanel.style.top = `${e.clientY - visualPanelOffset.y}px`;
  }
  if (isDraggingPlanetVisual && currentPlanetDisplayedInPanel && planetVisualPanel.classList.contains('visible')) {
    const deltaX = e.clientX - lastDragX;
    const deltaY = e.clientY - lastDragY;
    rotationLongitude += deltaX * 0.005;
    rotationLatitude += deltaY * 0.005;
    rotationLatitude = Math.max(-0.49 * Math.PI, Math.min(0.49 * Math.PI, rotationLatitude));
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    if (!renderPending) {
      renderPending = true;
      requestAnimationFrame(() => {
        renderPlanetVisual(currentPlanetDisplayedInPanel, rotationLongitude, rotationLatitude);
        renderPending = false;
      });
    }
  }
});

planetVisualCanvas.addEventListener('click', (e) => {
    if (!currentPlanetDisplayedInPanel || isDraggingPlanetVisual) return;

    const rect = planetVisualPanel.getBoundingClientRect();
    const canvasRect = planetVisualCanvas.getBoundingClientRect();
    const clickX_canvas_rel = e.clientX - canvasRect.left;
    const clickY_canvas_rel = e.clientY - canvasRect.top;

    const centerX = planetVisualCanvas.width / 2;
    const centerY = planetVisualCanvas.height / 2;
    const radius = Math.min(planetVisualCanvas.width, planetVisualCanvas.height) * 0.4;

    const nx = (clickX_canvas_rel - centerX) / radius;
    const ny = (clickY_canvas_rel - centerY) / radius;

    if (nx * nx + ny * ny > 1) return; // Clicked outside the sphere

    // Calculate 3D point on unit sphere (Z points out)
    const x_sphere = nx;
    const y_sphere = ny;
    const z_sphere = Math.sqrt(1 - x_sphere * x_sphere - y_sphere * y_sphere);

    // Apply INVERSE rotation to get original phi/theta
    // Inverse of Yaw then Pitch is Inverse Pitch then Inverse Yaw
    // Inverse Pitch (around X)
    const inv_lat = -rotationLatitude;
    const pX_inv_lat = x_sphere;
    const pY_inv_lat = y_sphere * Math.cos(inv_lat) - z_sphere * Math.sin(inv_lat);
    const pZ_inv_lat = y_sphere * Math.sin(inv_lat) + z_sphere * Math.cos(inv_lat);

    // Inverse Yaw (around Y)
    const inv_lon = -rotationLongitude;
    const x_original = pX_inv_lat * Math.cos(inv_lon) + pZ_inv_lat * Math.sin(inv_lon);
    const y_original = pY_inv_lat;
    const z_original = -pX_inv_lat * Math.sin(inv_lon) + pZ_inv_lat * Math.cos(inv_lon);

    // Convert original Cartesian back to spherical for segment lookup
    const phi_original = Math.acos(y_original); // Latitude (0 to PI) from Y
    const theta_original = (Math.atan2(x_original, z_original) + 2 * Math.PI) % (2 * Math.PI); // Longitude (0 to 2PI) from X, Z

    let latBandIndex = -1;
    for (let k = 0; k < currentPlanetDisplayedInPanel.segmentsData.latBandStarts.length - 1; k++) {
        if (phi_original >= currentPlanetDisplayedInPanel.segmentsData.latBandStarts[k] && phi_original < currentPlanetDisplayedInPanel.segmentsData.latBandStarts[k + 1]) {
            latBandIndex = k;
            break;
        }
    }
    if (latBandIndex === -1 && phi_original === Math.PI) latBandIndex = currentPlanetDisplayedInPanel.segmentsData.latBandStarts.length - 2;

    let lonBandIndex = -1;
    for (let k = 0; k < currentPlanetDisplayedInPanel.segmentsData.lonSliceStarts.length - 1; k++) {
        if (theta_original >= currentPlanetDisplayedInPanel.segmentsData.lonSliceStarts[k] && theta_original < currentPlanetDisplayedInPanel.segmentsData.lonSliceStarts[k + 1]) {
            lonBandIndex = k;
            break;
        }
    }
     if (lonBandIndex === -1 && theta_original === 2 * Math.PI) lonBandIndex = currentPlanetDisplayedInPanel.segmentsData.lonSliceStarts.length - 2;

    const segment = currentPlanetDisplayedInPanel.segmentsData.map.get(`${latBandIndex},${lonBandIndex}`);
    if (segment) {
        segment.isPink = !segment.isPink;
        renderPlanetVisual(currentPlanetDisplayedInPanel, rotationLongitude, rotationLatitude);
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
  loadCustomizationSettings(); initializeGame(true); if (currentScreenIdBeforeResize) { const screenToActivate = document.getElementById(currentScreenIdBeforeResize) || mainScreen; setActiveScreen(screenToActivate); } else { setActiveScreen(mainScreen); }});
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
