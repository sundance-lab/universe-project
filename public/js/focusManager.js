// public/js/focusManager.js

/**
 * A centralized module to manage focus state for celestial objects.
 * This creates a single source of truth for what is currently "focused" in the UI.
 * It uses an event-based system to allow other modules to react to focus changes
 * without being tightly coupled.
 */
export const FocusManager = (() => {
    let _currentFocusedPlanetId = null;
    const _listeners = {};

    /**
     * Dispatches an event to all registered listeners.
     * @param {string} event - The name of the event to dispatch.
     * @param {object} data - The data payload to send with the event.
     */
    const _dispatchEvent = (event, data) => {
        if (_listeners[event]) {
            _listeners[event].forEach(callback => callback(data));
        }
    };

    return {
        /**
         * Registers a callback for a specific event.
         * @param {string} event - The event to listen for (e.g., 'focusChanged').
         * @param {function} callback - The function to execute when the event fires.
         */
        addEventListener: (event, callback) => {
            if (!_listeners[event]) {
                _listeners[event] = [];
            }
            _listeners[event].push(callback);
        },

        /**
         * Unregisters a callback for a specific event.
         * @param {string} event - The event to unregister from.
         * @param {function} callback - The specific callback to remove.
         */
        removeEventListener: (event, callback) => {
            if (_listeners[event]) {
                _listeners[event] = _listeners[event].filter(cb => cb !== callback);
            }
        },

        /**
         * Sets the focus to a specific planet ID.
         * If the ID is the same as the current focus, it does nothing.
         * @param {string | null} planetId - The ID of the planet to focus, or null to clear focus.
         */
        setFocus: (planetId) => {
            if (_currentFocusedPlanetId === planetId) return;

            _currentFocusedPlanetId = planetId;
            _dispatchEvent('focusChanged', { planetId: _currentFocusedPlanetId });
        },

        /**
         * A convenience method to clear the current focus.
         */
        clearFocus: () => {
            if (_currentFocusedPlanetId === null) return;
            FocusManager.setFocus(null);
        },

        /**
         * Returns the ID of the currently focused planet.
         * @returns {string | null}
         */
        getFocusedPlanetId: () => _currentFocusedPlanetId,
    };
})();
