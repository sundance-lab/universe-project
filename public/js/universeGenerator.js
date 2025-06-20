// public/js/universeGenerator.js
import { getNonOverlappingPositionInCircle, getDistance } from './utils.js';
import GameStateManager from './gameStateManager.js'; // Import the state manager

const SOLAR_SYSTEM_BASE_ICON_SIZE = 2.5;
const MAX_CONNECTIONS_PER_SYSTEM = 3;
const MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS = 5;
const MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT = 0.07;
const MAX_FORCED_CONNECTION_DISTANCE_PERCENT = 0.20;


function getWeightedNumberOfConnections() {
    const rand = Math.random();
    return rand < 0.6 ? 1 : rand < 0.9 ? 2 : 3;
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


// --- EXPORTED GENERATION FUNCTIONS ---

export function generatePlanetInstanceFromBasis(basis, isForDesignerPreview = false) {
    const defaultBasis = {
        isGasGiant: false,
        continentSeed: Math.random(),
        waterColor: '#1E90FF', landColor: '#556B2F', forestDensity: 0.5,
        minTerrainHeight: 0.0, maxTerrainHeight: 10.0, oceanHeightLevel: 1.0,
        volcanicActivity: 0.0, snowCapLevel: 0.0,
        ggBandColor1: '#D2B48C', ggBandColor2: '#8B4513', ggPoleColor: '#ADD8E6',
        ggPoleSize: 0.3, ggAtmosphereStyle: 0.1, ggTurbulence: 0.2, ggStormIntensity: 0.2,
    };

    if (isForDesignerPreview) {
         return { ...defaultBasis, ...basis };
    }

    const customDesigns = GameStateManager.getCustomPlanetDesigns();
    if (customDesigns && customDesigns.length > 0) {
        const randomDesign = customDesigns[Math.floor(Math.random() * customDesigns.length)];
        return {
            ...defaultBasis, // Ensure all properties exist
            ...randomDesign, // Overwrite with saved design properties
            continentSeed: Math.random(), // Always randomize the seed
            isExplorable: !randomDesign.isGasGiant,
        };
    }
    
    // If there are no custom designs, return null.
    return null;
};

export function generateUniverseLayout(universeCircle, gameState, fixedColors) {
    const screenMinDimension = Math.min(window.innerWidth, window.innerHeight);
    const diameter = Math.max(300, screenMinDimension * 0.85);
    GameStateManager.setUniverseDiameter(diameter);

    if (universeCircle) {
        universeCircle.style.width = `${diameter}px`;
        universeCircle.style.height = `${diameter}px`;
        universeCircle.style.backgroundColor = fixedColors.universeBg;
    }
}

export function generateGalaxies(gameState) {
    if (!gameState.universe.diameter) {
        console.warn("generateGalaxies: Universe diameter not set.");
        return;
    }
    
    const newGalaxies = [];
    const galaxyId = `galaxy-1`;

    newGalaxies.push({
        id: galaxyId,
        x: 0,
        y: 0,
        customName: "The Galaxy",
        solarSystems: [],
        lineConnections: [],
        layoutGenerated: false,
        currentZoom: 1.0,
        currentPanX: 0,
        currentPanY: 0,
        generationParams: { densityFactor: 1.0 }
    });
    GameStateManager.setGalaxies(newGalaxies);
}

export function generateSolarSystemsForGalaxy(galaxy, galaxyViewport, ssCountRange, isForcedRegeneration = false) {
    if (!galaxy) {
        console.warn(`generateSolarSystemsForGalaxy: Galaxy not provided.`);
        return;
    }

    if (!galaxyViewport) {
        console.warn(`generateSolarSystemsForGalaxy: galaxyViewport element not found.`);
        return;
    }

    if (galaxy.layoutGenerated && !isForcedRegeneration) {
        return;
    }

    const state = GameStateManager.getState();
    const galaxyContentDiameter = galaxyViewport.offsetWidth > 0 ? galaxyViewport.offsetWidth : (state.universe.diameter || 500);
    const galaxyContentRadius = galaxyContentDiameter / 2;

    if (galaxyContentRadius <= 0) {
        console.warn(`generateSolarSystemsForGalaxy: Invalid content dimensions for galaxy ${galaxy.id}.`);
        galaxy.layoutGenerated = true;
        if (!isForcedRegeneration) GameStateManager.saveGameState();
        return;
    }

    galaxy.solarSystems = [];
    galaxy.lineConnections = [];
    const solarSystemPlacementRects = [];
    const numSystemsToAttempt = Math.floor(Math.random() * (ssCountRange.max - ssCountRange.min + 1)) + ssCountRange.min;

    for (let i = 0; i < numSystemsToAttempt; i++) {
        const solarSystemId = `${galaxy.id}-ss-${i + 1}`;
        const position = getNonOverlappingPositionInCircle(galaxyContentRadius, SOLAR_SYSTEM_BASE_ICON_SIZE, solarSystemPlacementRects);
        if (position) {
            const sunSizeFactor = 0.5 + Math.random() * 9.5;
            galaxy.solarSystems.push({
                id: solarSystemId,
                customName: null,
                x: position.x,
                y: position.y,
                iconSize: SOLAR_SYSTEM_BASE_ICON_SIZE,
                sunSizeFactor: sunSizeFactor,
                sunType: Math.floor(Math.random() * 5)
            });
            solarSystemPlacementRects.push({ ...position, width: SOLAR_SYSTEM_BASE_ICON_SIZE, height: SOLAR_SYSTEM_BASE_ICON_SIZE });
        }
    }

    if (galaxy.solarSystems.length < 2) {
        galaxy.layoutGenerated = true;
        if (!isForcedRegeneration) GameStateManager.saveGameState();
        return;
    }

    const systemsWithCenters = galaxy.solarSystems.map(ss => ({
        ...ss,
        centerX: ss.x + ss.iconSize / 2,
        centerY: ss.y + ss.iconSize / 2
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
    if (!isForcedRegeneration) GameStateManager.saveGameState();
}


export async function preGenerateAllGalaxyContents(gameState, galaxyViewport, ssCountRange) {
    console.log("Pre-generating all galaxy contents...");
    for (const g of gameState.galaxies) {
        if (!g.layoutGenerated || g.solarSystems.length === 0) {
            generateSolarSystemsForGalaxy(g, galaxyViewport, ssCountRange, true);
        }
    }
    console.log("Pre-generation complete.");
    GameStateManager.saveGameState();
}

export function regenerateCurrentUniverseState(callbacks, elementsToClear, manager) {
    if (window.activeSolarSystemRenderer) {
        window.activeSolarSystemRenderer.dispose();
        window.activeSolarSystemRenderer = null;
    }

    manager.resetState(true); 

    if (elementsToClear.galaxyZoomContent) {
        const linesCanvas = elementsToClear.galaxyZoomContent.querySelector('#solar-system-lines-canvas');
        elementsToClear.galaxyZoomContent.innerHTML = '';
        if (linesCanvas) elementsToClear.galaxyZoomContent.appendChild(linesCanvas);
    }
    if (elementsToClear.solarSystemContent) elementsToClear.solarSystemContent.innerHTML = '';

    callbacks.initializeGame(true);
}
