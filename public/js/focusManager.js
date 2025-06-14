// public/js/focusManager.js

rt const FocusManager = (() => {
    let _currentFocusedPlanetId = null;
    const _listeners = {};

    const _dispatchEvent = (event, data) => {
        if (_listeners[event]) {
            _listeners[event].forEach(callback => callback(data));
        }
    };

    return {
        addEventListener: (event, callback) => {
            if (!_listeners[event]) {
                _listeners[event] = [];
            }
            _listeners[event].push(callback);
        },

        removeEventListener: (event, callback) => {
            if (_listeners[event]) {
                _listeners[event] = _listeners[event].filter(cb => cb !== callback);
            }
        },

        setFocus: (planetId) => {
            if (_currentFocusedPlanetId === planetId) return;

            _currentFocusedPlanetId = planetId;
            _dispatchEvent('focusChanged', { planetId: _currentFocusedPlanetId });
        },

        clearFocus: () => {
            if (_currentFocusedPlanetId === null) return;
            FocusManager.setFocus(null);
        },

        getFocusedPlanetId: () => _currentFocusedPlanetId,
    };
})();
