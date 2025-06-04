// js/main.js

import * as WorkerManager from 'js/workers/worker_manager.js';
import * as GameLifecycle from 'js/core/game_lifecycle.js';
import * as Events from 'js/events.js';

// Ensure the DOM is fully loaded before initializing the application
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content Loaded. Initializing Galaxies Reimagined.");

    // 1. Setup Web Workers
    // This needs to happen early, as other modules might try to send messages to workers.
    WorkerManager.setupWorkers();

    // 2. Setup all global event listeners
    // These listeners will call functions in various UI and core modules.
    Events.setupGlobalEventListeners();

    // 3. Initialize the game lifecycle
    // This will load existing data or generate a new universe.
    GameLifecycle.initializeGame();

    console.log("Galaxies Reimagined application started.");
});
