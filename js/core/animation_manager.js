// js/core/animation_manager.js

import * as State from './state.js';
import * as DOM from './dom_elements.js';

/**
 * Animates the orbital and axial rotation of planets in the solar system view.
 * Uses requestAnimationFrame for smooth animations.
 * @param {DOMHighResTimeStamp} now - The current time provided by requestAnimationFrame.
 */
export function animateSolarSystem(now) {
    if (!now) now = performance.now(); // Fallback for initial call
    if (State.lastAnimationTime === null) State.lastAnimationTime = now;

    // Calculate delta time in seconds
    const deltaTime = (now - State.lastAnimationTime) / 1000;
    State.lastAnimationTime = now;

    const activeSolarSystemView = State.gameSessionData.solarSystemView;

    // Only animate if on the solar system screen and planets exist
    if (activeSolarSystemView && DOM.solarSystemScreen && DOM.solarSystemScreen.classList.contains('active') && activeSolarSystemView.planets) {
        activeSolarSystemView.planets.forEach(planet => {
            if (planet.element) {
                // Update orbital angle
                planet.currentOrbitalAngle += planet.orbitalSpeed * 60 * deltaTime; // Speed adjusted for deltaTime
                // Update axial rotation angle
                planet.currentAxialAngle += planet.axialSpeed * 60 * deltaTime; // Speed adjusted for deltaTime

                // Calculate planet's position based on orbital angle
                const xOffset = planet.distance * Math.cos(planet.currentOrbitalAngle);
                const yOffset = planet.distance * Math.sin(planet.currentOrbitalAngle);

                // Apply position and axial rotation to the element
                planet.element.style.left = `calc(50% + ${xOffset}px)`;
                planet.element.style.top = `calc(50% + ${yOffset}px)`;
                planet.element.style.transform = `translate(-50%, -50%) rotate(${planet.currentAxialAngle}rad)`;
            }
        });
        // Request the next animation frame
        State.animationFrameId = requestAnimationFrame(animateSolarSystem);
    } else {
        // If not on solar system screen or no planets, stop animation
        if (State.animationFrameId) {
            cancelAnimationFrame(State.animationFrameId);
            State.animationFrameId = null;
        }
        State.lastAnimationTime = null; // Reset last animation time
    }
}

/**
 * Starts the solar system animation loop if it's not already running.
 */
export function startSolarSystemAnimation() {
    if (!State.animationFrameId && DOM.solarSystemScreen && DOM.solarSystemScreen.classList.contains('active')) {
        State.lastAnimationTime = null; // Ensure fresh start for deltaTime calculation
        State.animationFrameId = requestAnimationFrame(animateSolarSystem);
    }
}

/**
 * Stops the solar system animation loop.
 */
export function stopSolarSystemAnimation() {
    if (State.animationFrameId) {
        cancelAnimationFrame(State.animationFrameId);
        State.animationFrameId = null;
        State.lastAnimationTime = null; // Reset last animation time
    }
}
