import * as DOM from 'js/dom_elements.js';
import * as State from 'js/state.js';
import * as Config from 'js/config.js';

export let planetVisualWorker = null;
export let designerWorker = null;

export function setupWorkers() {
    if (window.Worker) {
        try {
            planetVisualWorker = new Worker('planetRendererWorker.js');
            designerWorker = new Worker('planetRendererWorker.js');

            planetVisualWorker.onmessage = (e) => { /* ... process message, update DOM/state ... */ };
            designerWorker.onmessage = (e) => { /* ... process message, update DOM/state ... */ };

        } catch (err) { /* ... handle error ... */ }
    } else { /* ... warn about no worker support ... */ }
}

export function renderPlanetWithWorker(planetData, rotationQuaternion, targetCanvasId, planetRadiusOverride) {
    // Wrapper function to send data to appropriate worker
    const workerToUse = (targetCanvasId === 'planet-visual-canvas') ? planetVisualWorker : designerWorker;
    // ... send message with all necessary data
}
// and/or generic postMessage function
export function postMessageToWorker(workerType, data, transferList) { /* ... */ }
