// js/central.js

import * as WorkerManager from './workers/worker_manager.js'; // Corrected path
import * as GameLifecycle from './core/game_lifecycle.js';     // Corrected path
import * as Events from './events.js';

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
