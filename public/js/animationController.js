// public/js/animationController.js

let animationFrameId = null;
let lastAnimationTime = null;
let cachedSolarSystemScreenElement = null;

function getSolarSystemScreenElement() {
 if (!cachedSolarSystemScreenElement) {
  cachedSolarSystemScreenElement = document.getElementById('solar-system-screen');
 }
 return cachedSolarSystemScreenElement;
}

function animateSolarSystem(now) {
    // This check is important to allow the animation to be stopped.
    if (!isSolarSystemAnimationRunning()) return;

    // Request the next frame to keep the loop going.
    animationFrameId = requestAnimationFrame(animateSolarSystem);

    // Initialize or calculate time delta.
    if (lastAnimationTime === null) lastAnimationTime = now;
    const deltaTime = (now - lastAnimationTime) / 1000;
    lastAnimationTime = now;

    // 1. Update the data for the planets (their angles).
    if(window.gameSessionData?.solarSystemView?.planets) {
        window.gameSessionData.solarSystemView.planets.forEach(planet => {
            planet.currentOrbitalAngle += planet.orbitalSpeed * 6 * deltaTime;
            planet.currentAxialAngle += planet.axialSpeed * 60 * deltaTime;
        });
    }

    // 2. Tell the new 3D renderer to update the visuals using the new data.
    if(window.SolarSystemRenderer) {
        window.SolarSystemRenderer.update(now, window.gameSessionData.solarSystemView);
    }
}

export function startSolarSystemAnimation() {
 const screenElement = getSolarSystemScreenElement();

 if (!animationFrameId && screenElement && screenElement.classList.contains('active')) {
  console.log("[AnimationController] Starting solar system animation.");
  lastAnimationTime = null;
  animationFrameId = requestAnimationFrame(animateSolarSystem);
 } else if (animationFrameId) {
  console.log("[AnimationController] Animation is already running.");
 } else if (!screenElement) {
  console.log("[AnimationController] Solar system screen element not found. Cannot start animation.");
 } else if (!screenElement.classList.contains('active')) {
  console.log("[AnimationController] Solar system screen is not active. Not starting animation.");
 }
}

export function stopSolarSystemAnimation() {
 if (animationFrameId) {
  console.log("[AnimationController] Stopping solar system animation.");
  cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
 }
 lastAnimationTime = null;
}

export function isSolarSystemAnimationRunning() {
 return animationFrameId !== null;
}
