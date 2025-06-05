// animationController.js

let animationFrameId = null;
let lastAnimationTime = null;

// This function will be internal to the module (not exported directly)
// It needs access to window.gameSessionData and the solarSystemScreen element (or its active state)
function animateSolarSystem(now) {
    if (!now) now = performance.now();
    if (lastAnimationTime === null) lastAnimationTime = now;
    const deltaTime = (now - lastAnimationTime) / 1000; // Time in seconds
    lastAnimationTime = now;

    // Ensure gameSessionData and solarSystemScreen are accessible.
    // For solarSystemScreen, we might need to pass its active status or the element itself.
    // For simplicity here, we'll assume it's checked by the caller or can be accessed if needed.
    const solarSystemScreenElement = document.getElementById('solar-system-screen'); // Assuming it's always the same ID

    if (window.gameSessionData?.solarSystemView?.planets && 
        solarSystemScreenElement && 
        solarSystemScreenElement.classList.contains('active')) {

        window.gameSessionData.solarSystemView.planets.forEach(planet => {
            if (planet.element) { // Check if the DOM element exists
                // Update orbital angle
                planet.currentOrbitalAngle += planet.orbitalSpeed * 6 * deltaTime; // 6 is an arbitrary speed multiplier

                // Update axial rotation angle
                planet.currentAxialAngle += planet.axialSpeed * 60 * deltaTime; // 60 is an arbitrary speed multiplier

                // Calculate new position based on orbital angle and distance
                const xOrbit = planet.distance * Math.cos(planet.currentOrbitalAngle);
                const yOrbit = planet.distance * Math.sin(planet.currentOrbitalAngle);

                // Apply position and rotation
                // Ensure sun is centered at 50%, 50% of the solar-system-content
                planet.element.style.left = `calc(50% + ${xOrbit}px)`;
                planet.element.style.top = `calc(50% + ${yOrbit}px)`;
                planet.element.style.transform = `translate(-50%, -50%) rotate(${planet.currentAxialAngle}rad)`;
            }
        });
        animationFrameId = requestAnimationFrame(animateSolarSystem);
    } else {
        // If screen is not active or data is missing, ensure animation stops
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        lastAnimationTime = null; // Reset for when it starts again
    }
}

export function startSolarSystemAnimation() {
    // Check if solarSystemScreen is available and active before starting
    const solarSystemScreenElement = document.getElementById('solar-system-screen');
    if (!animationFrameId && solarSystemScreenElement && solarSystemScreenElement.classList.contains('active')) {
        console.log("[AnimationController] Starting solar system animation.");
        lastAnimationTime = null; // Reset time for a fresh start
        animationFrameId = requestAnimationFrame(animateSolarSystem);
    } else if (animationFrameId) {
        console.log("[AnimationController] Animation already running or screen not active.");
    } else {
        console.log("[AnimationController] Solar system screen not active, not starting animation.");
    }
}

export function stopSolarSystemAnimation() {
    if (animationFrameId) {
        console.log("[AnimationController] Stopping solar system animation.");
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    lastAnimationTime = null; // Reset time
}

// Optional: A function to check if animation is running
export function isSolarSystemAnimationRunning() {
    return animationFrameId !== null;
}
