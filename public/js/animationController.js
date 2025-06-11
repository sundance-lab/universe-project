// public/js/animationController.js

// This file is now simplified. The renderer manages its own animation loop.
// These functions are kept for now to avoid breaking the UI manager, but they no longer do anything.

export function startSolarSystemAnimation() {
    // No longer needed; renderer's init() starts its own loop.
    console.log("[AnimationController] Start called (now handled by renderer).");
}

export function stopSolarSystemAnimation() {
    // No longer needed; renderer's dispose() stops its own loop.
    console.log("[AnimationController] Stop called (now handled by renderer).");
}

export function isSolarSystemAnimationRunning() {
    // This can be considered deprecated, but we'll return true for compatibility.
    return true; 
}
