// public/js/planetDesigner.js
import '../styles.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as SHADERS from './shaders.js';

export const PlanetDesigner = (() => {
    // --- CACHED DOM ELEMENTS ---
    let savedDesignsUl, designerPlanetCanvas, designerWaterColorInput, designerLandColorInput, designerMinHeightInput, designerMaxHeightInput, designerOceanHeightInput,
        designerSaveBtn, designerCancelBtn, designerRiverBasinInput, designerRiverBasinValue,
        designerForestDensityInput, designerForestDensityValue, designerRandomizeBtn;
    
    // --- THREE.JS & STATE VARIABLES ---
    const DISPLACEMENT_SCALING_FACTOR = 0.005;
    const SPHERE_BASE_RADIUS = 0.8;

    let currentDesignerBasis = {
        waterColor: '#1E90FF', landColor: '#556B2F', continentSeed: Math.random(),
        riverBasin: 0.05, forestDensity: 0.5,
        minTerrainHeightRange: [0.0, 2.0], maxTerrainHeightRange: [8.0, 12.0], oceanHeightRange: [1.0, 3.0]
    };
    
    let designerThreeScene, designerThreeCamera, designerThreeRenderer,
        designerThreePlanetMesh, designerThreeControls, designerThreeAnimationId, designerShaderMaterial;

function clampOceanLevel() {
    let minH = parseFloat(designerMinHeightInput.value);
    let maxH = parseFloat(designerMaxHeightInput.value);
    let oceanH = parseFloat(designerOceanHeightInput.value);

    // Clamp ocean within min and max
    if (oceanH < minH) designerOceanHeightInput.value = minH;
    if (oceanH > maxH) designerOceanHeightInput.value = maxH;
}
    
    function _initDesignerThreeJSView() {
        if (!designerPlanetCanvas) return;
        
        // --- SHADER SETUP (Now using imported shaders) ---
        const noiseFunctions = SHADERS.glslSimpleValueNoise3D;
        const finalVertexShader = SHADERS.planetVertexShader.replace('$', noiseFunctions);
        const finalFragmentShader = SHADERS.planetFragmentShader.replace('$', noiseFunctions);

        designerThreeScene = new THREE.Scene();
        designerThreeScene.background = new THREE.Color(0x1a1a2a);
        designerThreeCamera = new THREE.PerspectiveCamera(60, designerPlanetCanvas.offsetWidth / designerPlanetCanvas.offsetHeight, 0.001, 100);
        designerThreeCamera.position.z = 2.5;

        designerThreeRenderer = new THREE.WebGLRenderer({ canvas: designerPlanetCanvas, antialias: true });
        designerThreeRenderer.setSize(designerPlanetCanvas.offsetWidth, designerPlanetCanvas.offsetHeight);
        designerThreeRenderer.setPixelRatio(window.devicePixelRatio);
        
        const geometry = new THREE.SphereGeometry(SPHERE_BASE_RADIUS, 1024, 512);

        const uniforms = {
            uLandColor: { value: new THREE.Color() }, uWaterColor: { value: new THREE.Color() },
            uOceanHeightLevel: { value: 0.5 }, uContinentSeed: { value: Math.random() },
            uRiverBasin: { value: 0.05 }, uForestDensity: { value: 0.5 }, 
            uTime: { value: 0.0 }, uSphereRadius: { value: SPHERE_BASE_RADIUS },
            uDisplacementAmount: { value: 0.0 }
        };
        
        designerShaderMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: finalVertexShader, fragmentShader: finalFragmentShader });

        designerThreePlanetMesh = new THREE.Mesh(geometry, designerShaderMaterial);
        designerThreeScene.add(designerThreePlanetMesh);

        designerThreeControls = new OrbitControls(designerThreeCamera, designerThreeRenderer.domElement);
        designerThreeControls.enableDamping = true;
        designerThreeControls.dampingFactor = 0.1;
        designerThreeControls.rotateSpeed = 0.5;
        designerThreeControls.minDistance = 0.9;
        designerThreeControls.maxDistance = 4;

        _animateDesignerThreeJSView();
    }

    function _animateDesignerThreeJSView() {
        if (!designerThreeRenderer) return;
        designerThreeAnimationId = requestAnimationFrame(_animateDesignerThreeJSView);
        if (designerShaderMaterial?.uniforms.uTime) designerShaderMaterial.uniforms.uTime.value += 0.015;
        if (designerThreeControls) designerThreeControls.update();
        if (designerThreeScene && designerThreeCamera) designerThreeRenderer.render(designerThreeScene, designerThreeCamera);
    }

    function _stopAndCleanupDesignerThreeJSView() {
        if (designerThreeAnimationId) cancelAnimationFrame(designerThreeAnimationId);
        if (designerThreeControls) designerThreeControls.dispose();
        if (designerShaderMaterial) designerShaderMaterial.dispose();
        if (designerThreePlanetMesh) {
            if(designerThreePlanetMesh.geometry) designerThreePlanetMesh.geometry.dispose();
            if(designerThreeScene) designerThreeScene.remove(designerThreePlanetMesh);
        }
        if (designerThreeRenderer) designerThreeRenderer.dispose();
        designerThreeAnimationId = null; designerThreeControls = null; designerShaderMaterial = null;
        designerThreePlanetMesh = null; designerThreeRenderer = null; designerThreeScene = null; designerThreeCamera = null;
    }

    function _populateDesignerInputsFromBasis() {
        if (!designerWaterColorInput) return; // Guard against missing elements
        designerWaterColorInput.value = currentDesignerBasis.waterColor;
        designerLandColorInput.value = currentDesignerBasis.landColor;

        if (designerRiverBasinInput) {
            designerRiverBasinInput.value = currentDesignerBasis.riverBasin;
            designerRiverBasinValue.textContent = Number(currentDesignerBasis.riverBasin).toFixed(2);
        }
        if (designerForestDensityInput) {
            designerForestDensityInput.value = currentDesignerBasis.forestDensity;
            designerForestDensityValue.textContent = Number(currentDesignerBasis.forestDensity).toFixed(2);
        }
        
        // Use cached elements
    }

   function _updateBasisAndRefreshDesignerPreview() {
    if (!designerWaterColorInput || !designerShaderMaterial) return;

    // Read values from inputs
    const minHeight = parseFloat(designerMinHeightInput.value);
    const maxHeight = parseFloat(designerMaxHeightInput.value);
    const oceanHeight = parseFloat(designerOceanHeightInput.value);

    // Clamp oceanHeight for safety (should already be done by clampOceanLevel)
    const clampedOceanHeight = Math.max(minHeight, Math.min(maxHeight, oceanHeight));
    const terrainRange = Math.max(0.1, maxHeight - minHeight); // Avoid divide by zero

    // Normalize for shader (0 = min, 1 = max)
    let normalizedOceanLevel = (clampedOceanHeight - minHeight) / terrainRange;
    normalizedOceanLevel = Math.max(0, Math.min(1, normalizedOceanLevel));

    // Update your designerBasis object (for saving/loading)
    currentDesignerBasis.minTerrainHeight = minHeight;
    currentDesignerBasis.maxTerrainHeight = maxHeight;
    currentDesignerBasis.oceanHeightLevel = clampedOceanHeight;

    // Set shader uniforms
    const uniforms = designerShaderMaterial.uniforms;
    uniforms.uWaterColor.value.set(currentDesignerBasis.waterColor);
    uniforms.uLandColor.value.set(currentDesignerBasis.landColor);
    uniforms.uContinentSeed.value = currentDesignerBasis.continentSeed;
    uniforms.uRiverBasin.value = currentDesignerBasis.riverBasin;
    uniforms.uForestDensity.value = currentDesignerBasis.forestDensity;
    uniforms.uOceanHeightLevel.value = normalizedOceanLevel;

    // Set displacement scaling
    const displacementAmount = terrainRange * DISPLACEMENT_SCALING_FACTOR;
    uniforms.uDisplacementAmount.value = displacementAmount;
}
    
    function _randomizeDesignerPlanet() {
        function _getRandomHexColor() { return '#' + (Math.random() * 0xFFFFFF | 0).toString(16).padStart(6, '0'); }
        function _getRandomFloat(min, max, p = 1) { const f = Math.pow(10, p); return parseFloat((Math.random() * (max - min) + min).toFixed(p)); }
        currentDesignerBasis.waterColor = _getRandomHexColor();
        currentDesignerBasis.landColor = _getRandomHexColor();
        currentDesignerBasis.continentSeed = Math.random();
        currentDesignerBasis.riverBasin = _getRandomFloat(0.01, 0.15, 2);
        currentDesignerBasis.forestDensity = _getRandomFloat(0.1, 0.9, 2);
        const minH1 = _getRandomFloat(0.0, 2.0), minH2 = minH1 + _getRandomFloat(0.5, 2.0);
        currentDesignerBasis.minTerrainHeightRange = [minH1, minH2];
        const maxH1 = _getRandomFloat(6.0, 10.0), maxH2 = maxH1 + _getRandomFloat(2.0, 5.0);
        currentDesignerBasis.maxTerrainHeightRange = [maxH1, maxH2];
        const oceanH1 = _getRandomFloat(minH2, (minH2 + maxH1) / 2), oceanH2 = oceanH1 + _getRandomFloat(0.5, 2.0);
        currentDesignerBasis.oceanHeightRange = [oceanH1, oceanH2];
        _populateDesignerInputsFromBasis();
        _updateBasisAndRefreshDesignerPreview();
    }

    function _generateUUID() { return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 3 | 8); return v.toString(16); }); }
    
    function _saveCustomPlanetDesign() { 
        const designName = prompt("Enter a name for this planet design:", "My Custom Planet");
        if (!designName?.trim()) return;
        const newDesign = { designId: _generateUUID(), designName: designName.trim(), ...JSON.parse(JSON.stringify(currentDesignerBasis)) };
        if (window.gameSessionData?.customPlanetDesigns) {
            window.gameSessionData.customPlanetDesigns.push(newDesign);
            if (typeof window.saveGameState === 'function') window.saveGameState();
            _populateSavedDesignsList();
        }
    }
    
    function _loadAndPreviewDesign(designId) {
        const designToLoad = window.gameSessionData?.customPlanetDesigns?.find(d => d.designId === designId);
        if (designToLoad) {
            if(designToLoad.riverBasin === undefined) designToLoad.riverBasin = 0.05;
            if(designToLoad.forestDensity === undefined) designToLoad.forestDensity = 0.5;
            currentDesignerBasis = { ...JSON.parse(JSON.stringify(designToLoad)) };
            delete currentDesignerBasis.designId;
            delete currentDesignerBasis.designName;
            _populateDesignerInputsFromBasis();
            _updateBasisAndRefreshDesignerPreview();
        }
    }
    
    function _deleteCustomPlanetDesign(designId) {
        if (window.gameSessionData?.customPlanetDesigns) {
            window.gameSessionData.customPlanetDesigns = window.gameSessionData.customPlanetDesigns.filter(d => d.designId !== designId);
            if (typeof window.saveGameState === 'function') window.saveGameState();
            _populateSavedDesignsList();
        }
    }
    
    function _populateSavedDesignsList() {
        if (!savedDesignsUl) return;
        savedDesignsUl.innerHTML = '';
        const designs = window.gameSessionData?.customPlanetDesigns;
        if (designs?.length > 0) {
            designs.forEach(design => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="design-item-name">${design.designName || 'Unnamed Design'}</span> <button class="design-item-load modal-button-apply" data-id="${design.designId}">Load</button> <button class="design-item-delete" data-id="${design.designId}" title="Delete Design">&times;</button>`;
                savedDesignsUl.appendChild(li);
            });
        } else {
            savedDesignsUl.innerHTML = '<li>No saved designs yet.</li>';
        }
    }

    return {
        init: () => {
            // --- CACHE ALL DOM ELEMENTS ONCE ---
            designerPlanetCanvas = document.getElementById('designer-planet-canvas');
            designerWaterColorInput = document.getElementById('designer-water-color');
            designerLandColorInput = document.getElementById('designer-land-color');
            designerRiverBasinInput = document.getElementById('designer-river-basin');
            designerRiverBasinValue = document.getElementById('designer-river-basin-value');
            designerForestDensityInput = document.getElementById('designer-forest-density');
            designerForestDensityValue = document.getElementById('designer-forest-density-value');
            designerMinHeightInput = document.getElementById('designer-min-height');
            designerMaxHeightInput = document.getElementById('designer-max-height');
            designerOceanHeightInput = document.getElementById('designer-ocean-height');
            savedDesignsUl = document.getElementById('saved-designs-ul');
            designerRandomizeBtn = document.getElementById('designer-randomize-btn');
            designerSaveBtn = document.getElementById('designer-save-btn');
            designerCancelBtn = document.getElementById('designer-cancel-btn');

            const inputsToWatch = [
                designerWaterColorInput, designerLandColorInput,
            ];
            inputsToWatch.forEach(input => input?.addEventListener('input', _updateBasisAndRefreshDesignerPreview));            
            const liveSliders = [
                { slider: designerRiverBasinInput, display: designerRiverBasinValue, precision: 2 },
                { slider: designerForestDensityInput, display: designerForestDensityValue, precision: 2 }
            ];
            liveSliders.forEach(({slider, display, precision}) => {
                slider?.addEventListener('input', () => {
                    if (display) display.textContent = Number(slider.value).toFixed(precision);
                    _updateBasisAndRefreshDesignerPreview();
                });
            });
            
            designerRandomizeBtn?.addEventListener('click', _randomizeDesignerPlanet);
            designerSaveBtn?.addEventListener('click', _saveCustomPlanetDesign);
            designerCancelBtn?.addEventListener('click', () => {
                _stopAndCleanupDesignerThreeJSView();
                // Assumes a global function exists to handle view switching
                if (window.switchToMainView) window.switchToMainView();
            });

            savedDesignsUl?.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                if (!id) return;
                if (e.target.classList.contains('design-item-load')) _loadAndPreviewDesign(id);
                else if (e.target.classList.contains('design-item-delete')) {
                    if (confirm("Are you sure you want to delete this planet design?")) _deleteCustomPlanetDesign(id);
                }
            });
            
            window.addEventListener('resize', () => {
                if (designerThreeRenderer && document.getElementById('planet-designer-screen')?.classList.contains('active')) {
                    const newWidth = designerPlanetCanvas.offsetWidth;
                    const newHeight = designerPlanetCanvas.offsetHeight;
                    if (newWidth > 0 && newHeight > 0) {
                        designerThreeCamera.aspect = newWidth / newHeight;
                        designerThreeCamera.updateProjectionMatrix();
                        designerThreeRenderer.setSize(newWidth, newHeight);
                    }
                }
            });
        },

        activate: () => {
            console.log("PlanetDesigner.activate called.");
            if (!designerPlanetCanvas) designerPlanetCanvas = document.getElementById('designer-planet-canvas');
            _populateDesignerInputsFromBasis();
            _populateSavedDesignsList();
            requestAnimationFrame(() => {
                _stopAndCleanupDesignerThreeJSView();
                _initDesignerThreeJSView();
                _updateBasisAndRefreshDesignerPreview();

                [designerMinHeightInput, designerMaxHeightInput, designerOceanHeightInput].forEach(input =>
    input?.addEventListener('input', () => {
        clampOceanLevel();
        _updateBasisAndRefreshDesignerPreview();
    })
);
            });
        },
    };
})();
