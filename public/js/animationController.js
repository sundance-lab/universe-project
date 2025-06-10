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
    if (!isSolarSystemAnimationRunning()) return; // Check if animation was stopped

    animationFrameId = requestAnimationFrame(animateSolarSystem);

    if (lastAnimationTime === null) lastAnimationTime = now;
    const deltaTime = (now - lastAnimationTime) / 1000;
    lastAnimationTime = now;

    if(window.gameSessionData?.solarSystemView?.planets) {
        window.gameSessionData.solarSystemView.planets.forEach(planet => {
            planet.currentOrbitalAngle += planet.orbitalSpeed * 6 * deltaTime;
            planet.currentAxialAngle += planet.axialSpeed * 60 * deltaTime;
        });
    }

    if(window.SolarSystemRenderer) { 
        window.SolarSystemRenderer.update(now, window.gameSessionData.solarSystemView);
    }
}

 const deltaTime = (now - lastAnimationTime) / 1000; 
 lastAnimationTime = now;

 const solarSystemScreenElement = getSolarSystemScreenElement();

 if (window.gameSessionData?.solarSystemView?.planets &&
  solarSystemScreenElement &&
  solarSystemScreenElement.classList.contains('active')) {

  animationFrameId = requestAnimationFrame(animateSolarSystem);

  window.gameSessionData.solarSystemView.planets.forEach(planet => {
   if (planet.element) { 
    planet.currentOrbitalAngle += planet.orbitalSpeed * 6 * deltaTime; 

    planet.currentAxialAngle += planet.axialSpeed * 60 * deltaTime;

    const xOrbit = planet.distance * Math.cos(planet.currentOrbitalAngle);
    const yOrbit = planet.distance * Math.sin(planet.currentOrbitalAngle);

    planet.element.style.left = `calc(50% + ${xOrbit}px)`;
    planet.element.style.top = `calc(50% + ${yOrbit}px)`;
    planet.element.style.transform = `translate(-50%, -50%) rotate(${planet.currentAxialAngle}rad)`;
   }
  });
 } else {
  if (animationFrameId) {
   cancelAnimationFrame(animationFrameId);
   animationFrameId = null;
  }
  lastAnimationTime = null; in
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
