// js/core/game_generation.js

import * as Config from 'js/config.js';
import * as State from 'js/state.js';
import * as DOM from 'js/dom_elements.js';
import * as MathUtils from 'js/utils/math_utils.js';
import * as ColorUtils from 'js/utils/color_utils.js';

/**
 * Updates dynamic session constants based on current customization settings.
 */
export function updateDerivedConstants() {
    State.MAX_PLANET_DISTANCE = (Config.SUN_ICON_SIZE * Config.BASE_MAX_PLANET_DISTANCE_FACTOR) * State.appSettings.currentMaxPlanetDistanceMultiplier;
    State.MIN_PLANET_DISTANCE = Config.SUN_ICON_SIZE * 3.0 * (State.appSettings.currentMaxPlanetDistanceMultiplier > 0.5 ? State.appSettings.currentMaxPlanetDistanceMultiplier * 0.8 : 0.5);
    State.ORBIT_CANVAS_SIZE = State.MAX_PLANET_DISTANCE * 2.2; // Expand for larger orbits
    State.SOLAR_SYSTEM_EXPLORABLE_RADIUS = State.MAX_PLANET_DISTANCE * 1.2;
}

/**
 * Generates the overall universe layout, primarily its diameter.
 * Influences galaxy placement and general scale.
 */
export function generateUniverseLayout() {
    const minDim = Math.min(window.innerWidth, window.innerHeight);
    State.gameSessionData.universe.diameter = Math.max(300, minDim * 0.85);

    if (DOM.universeCircle) {
        DOM.universeCircle.style.width = `${State.gameSessionData.universe.diameter}px`;
        DOM.universeCircle.style.height = `${State.gameSessionData.universe.diameter}px`;
        DOM.universeCircle.style.backgroundColor = Config.FIXED_COLORS.universeBg;
    }
}

/**
 * Generates initial galaxy positions within the universe.
 * Ensures galaxies do not overlap during initial placement.
 */
export function generateGalaxies() {
    if (!State.gameSessionData.universe.diameter) return;

    State.gameSessionData.galaxies = [];
    const centerRadius = State.gameSessionData.universe.diameter / 2;
    const existingRects = []; // Store positions of placed galaxies to avoid overlap

    for (let i = 0; i < State.appSettings.currentNumGalaxies; i++) {
        const id = `galaxy-${i + 1}`;
        const pos = getNonOverlappingPositionInCircle(centerRadius, Config.GALAXY_ICON_SIZE, existingRects);

        if (pos && !isNaN(pos.x) && !isNaN(pos.y)) {
            State.gameSessionData.galaxies.push({
                id,
                x: pos.x,
                y: pos.y,
                customName: null,
                solarSystems: [],
                lineConnections: [],
                layoutGenerated: false, // Flag to indicate if solar system layout is generated
                currentZoom: 1.0,
                currentPanX: 0,
                currentPanY: 0,
                generationParams: { densityFactor: 0.8 + Math.random() * 0.4 } // Unique parameters for each galaxy
            });
            existingRects.push({ x: pos.x, y: pos.y, width: Config.GALAXY_ICON_SIZE, height: Config.GALAXY_ICON_SIZE });
        }
    }
}

/**
 * Generates solar systems and their connections within a specified galaxy.
 * Uses a MST-like approach for initial connectivity, then adds more connections.
 * @param {string} galaxyId - The ID of the galaxy to generate solar systems for.
 */
export function generateSolarSystemsForGalaxy(galaxyId) {
    const galaxy = State.gameSessionData.galaxies.find(g => g.id === galaxyId);
    if (!galaxy || !DOM.galaxyViewport) { return; }

    // Avoid regenerating if already generated and not forced
    if (galaxy.layoutGenerated && !State.gameSessionData.isForceRegenerating) return;

    // Determine the effective viewport dimensions for system placement
    const viewportDim = DOM.galaxyViewport.offsetWidth > 0 ? DOM.galaxyViewport.offsetWidth : (State.gameSessionData.universe.diameter || 500);
    const viewportRadius = viewportDim / 2;

    if (viewportDim <= 0.01 || isNaN(viewportRadius) || viewportRadius <= 0.01) {
        console.warn("Galaxy viewport has invalid dimensions, cannot generate solar systems yet. Dimensions:", viewportDim, "Will retry.");
        galaxy.layoutGenerated = true; // Mark as generated to prevent infinite loops if sizing issues persist
        return; // Early exit, state saving handled by parent `preGenerateAllGalaxyContents` caller
    }

    galaxy.solarSystems = [];
    galaxy.lineConnections = [];
    const tmpPlacementRects = [];
    // Number of solar systems to attempt to place
    const numSystemsToAttempt = Math.floor(Math.random() * (State.appSettings.currentMaxSSCount - State.appSettings.currentMinSSCount + 1)) + State.appSettings.currentMinSSCount;

    // Place solar system icons, avoiding overlaps
    for (let i = 0; i < numSystemsToAttempt; i++) {
        const sId = `${galaxy.id}-ss-${i + 1}`;
        const pos = getNonOverlappingPositionInCircle(viewportRadius, Config.SOLAR_SYSTEM_BASE_ICON_SIZE, tmpPlacementRects);

        if (pos && !isNaN(pos.x) && !isNaN(pos.y)) {
            const sunSizeFactor = 0.5 + Math.random() * 9.5; // Random sun size factor
            galaxy.solarSystems.push({
                id: sId,
                customName: null,
                x: pos.x,
                y: pos.y,
                iconSize: Config.SOLAR_SYSTEM_BASE_ICON_SIZE,
                sunSizeFactor: sunSizeFactor
            });
            tmpPlacementRects.push({ x: pos.x, y: pos.y, width: Config.SOLAR_SYSTEM_BASE_ICON_SIZE, height: Config.SOLAR_SYSTEM_BASE_ICON_SIZE });
        }
    }

    // If fewer than 2 systems, no connections can be made
    if (galaxy.solarSystems.length < 2) {
        galaxy.layoutGenerated = true; // Mark as generated
        return;
    }

    // Prepare data for connection algorithm: add centerX/centerY for distance calculations
    const allSystemsCalc = galaxy.solarSystems.map(ss => ({
        ...ss,
        centerX: ss.x + ss.iconSize / 2,
        centerY: ss.y + ss.iconSize / 2
    }));

    // Track connection counts for each system
    const systemConnectionCounts = {};
    const galaxyContentDiameter = viewportDim;
    // Max distances for connections, relative to galaxy content diameter
    const allowedMaxEuclideanConnectionDistance = galaxyContentDiameter * Config.MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT;
    const allowedMaxForcedConnectionDistance = galaxyContentDiameter * Config.MAX_FORCED_CONNECTION_DISTANCE_PERCENT;

    // Minimum Spanning Tree (MST) approach for initial connections to ensure connectivity
    // Using Prim's or Kruskal's effectively here to connect all systems sequentially
    let connectedSystems = new Set();
    let unconnectedSystems = new Set(allSystemsCalc.map(s => s.id));

    if (allSystemsCalc.length > 0) {
        // Start from the first system (arbitrary)
        const firstSystemId = allSystemsCalc[0].id;
        connectedSystems.add(firstSystemId);
        unconnectedSystems.delete(firstSystemId);

        // Keep connecting until all systems are integrated
        while (unconnectedSystems.size > 0) {
            let bestConnection = null;
            let minConnectionDist = Infinity;

            // Find the closest unconnected system to any already connected system
            for (const unconnectedId of unconnectedSystems) {
                const currentUnconnected = allSystemsCalc.find(s => s.id === unconnectedId);
                for (const connectedId of connectedSystems) {
                    const currentConnected = allSystemsCalc.find(s => s.id === connectedId);
                    const dist = MathUtils.getDistance(currentUnconnected, currentConnected);
                    if (dist < minConnectionDist) {
                        minConnectionDist = dist;
                        bestConnection = { fromId: connectedId, toId: unconnectedId, dist: dist };
                    }
                }
            }

            if (bestConnection) {
                // Try to add the MST connection, respecting connection limits and euclidean distance
                const isValidPotentialConnection = tryAddConnection(
                    bestConnection.fromId,
                    bestConnection.toId,
                    galaxy.lineConnections,
                    systemConnectionCounts,
                    allSystemsCalc,
                    allowedMaxEuclideanConnectionDistance
                );

                if (isValidPotentialConnection) {
                    galaxy.lineConnections.push({ fromId: bestConnection.fromId, toId: bestConnection.toId });
                    systemConnectionCounts[bestConnection.fromId] = (systemConnectionCounts[bestConnection.fromId] || 0) + 1;
                    systemConnectionCounts[bestConnection.toId] = (systemConnectionCounts[bestConnection.toId] || 0) + 1;
                    connectedSystems.add(bestConnection.toId);
                    unconnectedSystems.delete(bestConnection.toId);
                } else {
                    // If the MST connection fails, try to force a connection to the closest possible system
                    // among the already connected ones, within a larger 'forced' distance.
                    const targetUnconnectedId = bestConnection.toId;
                    const targetUnconnected = allSystemsCalc.find(s => s.id === targetUnconnectedId);
                    let forcedTargetId = null;
                    let minForcedDist = Infinity;

                    for (const connectedId of connectedSystems) {
                        const connectedSystem = allSystemsCalc.find(s => s.id === connectedId);
                        const dist = MathUtils.getDistance(targetUnconnected, connectedSystem);
                        const canForceConnect = tryAddConnection(
                            targetUnconnectedId,
                            connectedId,
                            galaxy.lineConnections,
                            systemConnectionCounts,
                            allSystemsCalc,
                            allowedMaxForcedConnectionDistance // Use a larger forced distance here
                        );

                        if (canForceConnect) {
                            if (dist < minForcedDist) {
                                minForcedDist = dist;
                                forcedTargetId = connectedId;
                            }
                        }
                    }

                    if (forcedTargetId) {
                        galaxy.lineConnections.push({ fromId: targetUnconnectedId, toId: forcedTargetId });
                        systemConnectionCounts[targetUnconnectedId] = (systemConnectionCounts[targetUnconnectedId] || 0) + 1;
                        systemConnectionCounts[forcedTargetId] = (systemConnectionCounts[forcedTargetId] || 0) + 1;
                        connectedSystems.add(targetUnconnectedId);
                        unconnectedSystems.delete(targetUnconnectedId);
                    } else {
                        // As a very last resort, connect to the absolutely closest system regardless of distance,
                        // to ensure graph connectivity. This might create a visually long line but guarantees reachable systems.
                        let ultimateForceTargetId = null;
                        let minUltimateDist = Infinity;
                        for(const connectedId of connectedSystems) {
                            const connectedSystem = allSystemsCalc.find(s => s.id === connectedId);
                            const dist = MathUtils.getDistance(targetUnconnected, connectedSystem);
                            if (tryAddConnection(targetUnconnectedId, connectedId, galaxy.lineConnections, systemConnectionCounts, allSystemsCalc, null)) { // No max distance limit
                                 if(dist < minUltimateDist) {
                                    minUltimateDist = dist;
                                    ultimateForceTargetId = connectedId;
                                 }
                            }
                        }
                        if(ultimateForceTargetId) {
                            galaxy.lineConnections.push({ fromId: targetUnconnectedId, toId: ultimateForceTargetId });
                            systemConnectionCounts[targetUnconnectedId] = (systemConnectionCounts[targetUnconnectedId] || 0) + 1;
                            systemConnectionCounts[ultimateForceTargetId] = (systemConnectionCounts[ultimateForceTargetId] || 0) + 1;
                            connectedSystems.add(targetUnconnectedId);
                            unconnectedSystems.delete(targetUnconnectedId);
                        } else {
                            // If a system literally cannot be connected despite all efforts, remove it from the list.
                            // This should be very rare with the current logic.
                            console.warn(`System ${targetUnconnectedId} could not be connected. Removing.`);
                            unconnectedSystems.delete(targetUnconnectedId);
                            galaxy.solarSystems = galaxy.solarSystems.filter(s => s.id !== targetUnconnectedId);
                        }
                    }
                }
            } else {
                // If no best connection found in this iteration and unconnected systems still exist,
                // it implies a logical flaw or extreme edge case. Break to prevent infinite loop.
                if (unconnectedSystems.size > 0 && connectedSystems.size === 0 && allSystemsCalc.length > 0) {
                    // This handles the edge case where connectedSystems might be empty initially, and no connection was made
                    const nextUnconnectedId = Array.from(unconnectedSystems)[0];
                    connectedSystems.add(nextUnconnectedId);
                    unconnectedSystems.delete(nextUnconnectedId);
                } else {
                    break;
                }
            }
        }
    }


    // Add additional connections to meet desired connection density (up to MAX_CONNECTIONS_PER_SYSTEM)
    allSystemsCalc.forEach(ss1 => {
        const desiredConnections = getWeightedNumberOfConnections();
        let currentConnections = systemConnectionCounts[ss1.id] || 0;
        let connectionsToAdd = Math.min(desiredConnections, Config.MAX_CONNECTIONS_PER_SYSTEM - currentConnections);

        if (connectionsToAdd <= 0) return;

        // Sort potential targets by distance to prioritize closer ones
        let potentialTargets = allSystemsCalc
            .filter(ss2 => ss1.id !== ss2.id)
            .map(ss2 => ({ ...ss2, distance: MathUtils.getDistance(ss1, ss2) }))
            .sort((a, b) => a.distance - b.distance);

        // Consider only targets within the allowed Euclidean distance and a limited number of candidates
        const nearbyPotentialTargets = potentialTargets.filter(ss2 => ss2.distance <= allowedMaxEuclideanConnectionDistance);
        const candidates = nearbyPotentialTargets.slice(0, Config.MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS);

        for (const ss2 of candidates) {
            if (connectionsToAdd <= 0) break; // Stop if target connections are met
            const success = tryAddConnection(ss1.id, ss2.id, galaxy.lineConnections, systemConnectionCounts, allSystemsCalc, allowedMaxEuclideanConnectionDistance);
            if (success) {
                galaxy.lineConnections.push({ fromId: ss1.id, toId: ss2.id });
                systemConnectionCounts[ss1.id] = (systemConnectionCounts[ss1.id] || 0) + 1;
                systemConnectionCounts[ss2.id] = (systemConnectionCounts[ss2.id] || 0) + 1;
                connectionsToAdd--;
            }
        }
    });

    galaxy.layoutGenerated = true; // Mark generation complete
}

/**
 * Pre-generates solar system layouts for all galaxies in the universe.
 * This happens asynchronously to prevent UI freezing.
 */
export async function preGenerateAllGalaxyContents() {
    State.gameSessionData.isForceRegenerating = true; // Set flag to indicate regeneration is active
    for (const galaxy of State.gameSessionData.galaxies) {
        if (!galaxy.layoutGenerated || galaxy.solarSystems.length === 0 || State.gameSessionData.isForceRegenerating) {
            // Yield to event loop to keep UI responsive during heavy computation
            await new Promise(r => setTimeout(r, 0));
            generateSolarSystemsForGalaxy(galaxy.id);
        }
    }
    State.gameSessionData.isForceRegenerating = false; // Reset flag after all generation is done
}


// --- Internal Helper Functions for Game Generation ---

/**
 * Attempts to find a non-overlapping position for an object within a circle.
 * @param {number} circleRadius - The radius of the circular area.
 * @param {number} objectDiameter - The diameter of the object to place.
 * @param {Array<Object>} existingRects - An array of {x, y, width, height} of already placed objects.
 * @returns {Object|null} An object {x, y} for the position, or null if no space found.
 */
function getNonOverlappingPositionInCircle(circleRadius, objectDiameter, existingRects) {
    let placementRadius = circleRadius - (objectDiameter / 2) - 5; // Reduce radius slightly for padding
    if (placementRadius < 0) placementRadius = 0;

    for (let i = 0; i < Config.MAX_PLACEMENT_ATTEMPTS; i++) {
        const angle = Math.random() * 2 * Math.PI;
        // sqrt(random) to concentrate points closer to center
        const r = Math.sqrt(Math.random()) * placementRadius;
        const cx = circleRadius + r * Math.cos(angle); // Center X of the object
        const cy = circleRadius + r * Math.sin(angle); // Center Y of the object

        const x = cx - (objectDiameter / 2); // Top-left X for the rect
        const y = cy - (objectDiameter / 2); // Top-left Y for the rect

        const newRect = { x, y, width: objectDiameter, height: objectDiameter };

        // Check for overlap with any existing rectangles
        if (!existingRects.some(er => MathUtils.checkOverlap(newRect, er))) {
            return { x, y };
        }
    }
    return null; // Could not find a non-overlapping position
}

/**
 * Determines a weighted random number of connections for a solar system.
 * Higher probability for fewer connections.
 * @returns {number} The number of connections (1, 2, or 3).
 */
function getWeightedNumberOfConnections() {
    const rand = Math.random();
    if (rand < .6) return 1; // 60% chance for 1 connection
    if (rand < .9) return 2; // 30% chance for 2 connections
    return 3; // 10% chance for 3 connections
}

/**
 * Checks if a connection between two systems can be added given constraints.
 * @param {string} fromId - ID of the source system.
 * @param {string} toId - ID of the destination system.
 * @param {Array<Object>} currentConnectionsArray - List of all existing connections in the galaxy.
 * @param {Object} connectionCountObj - Object tracking current connection count for each system.
 * @param {Array<Object>} allSolarSystemsList - List of all solar systems in the galaxy (with centerX/centerY).
 * @param {number|null} maxDistanceLimit - Optional max distance for a connection (or null for no limit).
 * @returns {boolean} True if the connection can be added, false otherwise.
 */
function tryAddConnection(fromId, toId, currentConnectionsArray, connectionCountObj, allSolarSystemsList, maxDistanceLimit) {
    if (!fromId || !toId || fromId === toId || fromId === null || toId === null) return false;

    // Check if either system already has max connections
    if ((connectionCountObj[fromId] || 0) >= Config.MAX_CONNECTIONS_PER_SYSTEM || (connectionCountObj[toId] || 0) >= Config.MAX_CONNECTIONS_PER_SYSTEM) {
        return false;
    }

    // Check for duplicate connection (order-agnostic)
    const sortedKey = [fromId, toId].sort().join('-');
    if (currentConnectionsArray.some(c => ([c.fromId, c.toId].sort().join('-') === sortedKey))) {
        return false;
    }

    // Check distance limit if provided
    if (maxDistanceLimit !== undefined && maxDistanceLimit !== null) {
        const s1 = allSolarSystemsList.find(s => s.id === fromId);
        const s2 = allSolarSystemsList.find(s => s.id === toId);
        if (s1 && s2 && MathUtils.getDistance(s1, s2) > maxDistanceLimit) {
            return false;
        }
    }
    return true;
}
