// public/js/animationController.js
// Make sure that this function actually exists, or there will be errors saying that it's not defined
function isSolarSystemAnimationRunning() {
  return animationFrameId !== null;
}
window.isSolarSystemAnimationRunning = isSolarSystemAnimationRunning;

let animationFrameId = null;
let lastAnimationTime = null;
let cachedSolarSystemScreenElement = null;

// Helper to get the cached solar system screen element
function getSolarSystemScreenElement() {
  // If the #solar-system-screen element might be removed and re-added to the DOM,
  // this cache might become stale. Consider clearing it if the screen is definitively
  // torn down (e.g. in stopSolarSystemAnimation or if its parent is removed).
  // For now, we assume it's persistent or its 'active' class dictates its use.
  if (!cachedSolarSystemScreenElement) {
    cachedSolarSystemScreenElement = document.getElementById('solar-system-screen');
  }
  return cachedSolarSystemScreenElement;
}

// This function will be internal to the module (not exported directly)
// It needs access to window.gameSessionData and the solarSystemScreen element (or its active state)
function animateSolarSystem(now) {
  // 'now' is guaranteed to be provided by requestAnimationFrame
  if (lastAnimationTime === null) {
    lastAnimationTime = now; // Initialize lastAnimationTime on the first valid frame
    // Request the next frame immediately to avoid issues if first frame processing is skipped
    animationFrameId = requestAnimationFrame(animateSolarSystem);
    return; // Skip processing for the very first call if lastAnimationTime was just set
  }

  const deltaTime = (now - lastAnimationTime) / 1000; // Time in seconds
  lastAnimationTime = now;

  const solarSystemScreenElement = getSolarSystemScreenElement();

  if (window.gameSessionData?.solarSystemView?.planets &&
    solarSystemScreenElement &&
    solarSystemScreenElement.classList.contains('active')) {

    // Schedule the next animation frame.
    // Placing it here ensures the loop continues even if errors occur below.
    animationFrameId = requestAnimationFrame(animateSolarSystem);

    window.gameSessionData.solarSystemView.planets.forEach(planet => {
      if (planet.element) { // Check if the DOM element exists
        // Update orbital angle (assuming planet.currentOrbitalAngle is initialized and in radians)
        planet.currentOrbitalAngle += planet.orbitalSpeed * 6 * deltaTime; // 6 is an arbitrary speed multiplier

        // Update axial rotation angle (assuming planet.currentAxialAngle is initialized and in radians)
        planet.currentAxialAngle += planet.axialSpeed * 60 * deltaTime; // 60 is an arbitrary speed multiplier

        // Calculate new position based on orbital angle and distance
        const xOrbit = planet.distance * Math.cos(planet.currentOrbitalAngle);
        const yOrbit = planet.distance * Math.sin(planet.currentOrbitalAngle);

        // Apply position and rotation
        planet.element.style.left = `calc(50% + ${xOrbit}px)`;
        planet.element.style.top = `calc(50% + ${yOrbit}px)`;
        planet.element.style.transform = `translate(-50%, -50%) rotate(${planet.currentAxialAngle}rad)`;
      }
    });
  } else {
    // If screen is not active or data is missing, ensure animation stops
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    lastAnimationTime = null; // Reset for when it starts again
    // If the screen element might be removed/recreated, clear the cache:
    // cachedSolarSystemScreenElement = null;
  }
}

export function startSolarSystemAnimation() {
  const screenElement = getSolarSystemScreenElement(); // Use helper to get (potentially cached) element
  
  if (!animationFrameId && screenElement && screenElement.classList.contains('active')) {
    console.log("[AnimationController] Starting solar system animation.");
    lastAnimationTime = null; // Reset time for a fresh start to ensure delta is calculated correctly on first animation.
    // Request the first frame. animateSolarSystem will handle 'now' and its own recursive calls.
    animationFrameId = requestAnimationFrame(animateSolarSystem);
  } else if (animationFrameId) {
    console.log("[AnimationController] Animation is already running.");
  } else if (!screenElement) {
    console.log("[AnimationController] Solar system screen element not found. Cannot start animation.");
  } else if (!screenElement.classList.contains('active')) {
    // This case might be redundant if the animation check inside animateSolarSystem handles it,
    // but it's good for explicit start-up logging.
    console.log("[AnimationController] Solar system screen is not active. Not starting animation.");
  }
}

export function stopSolarSystemAnimation() {
  if (animationFrameId) {
    console.log("[AnimationController] Stopping solar system animation.");
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  lastAnimationTime = null; // Reset time
   // Optionally clear the cache if the element might be removed upon stopping:
   // cachedSolarSystemScreenElement = null;
}

// Optional: A function to check if animation is running
export function isSolarSystemAnimationRunning() {
  return animationFrameId !== null;
}
