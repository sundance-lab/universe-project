// public/js/planetDesigner.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { getPlanetShaders } from './shaders.js';
import { HexPlanetViewController } from './hexPlanetViewController.js';
import GameStateManager from './gameStateManager.js'; // Import the state manager

export const PlanetDesigner = (() => {
    // --- Terrestrial Controls ---
    let terrestrialControls, designerWaterColorInput, designerLandColorInput, designerMinHeightInput, designerMaxHeightInput, designerOceanHeightInput,
        designerForestDensityInput, designerForestDensityValue,
        designerVolcanicActivityInput, designerVolcanicActivityValue, designerSnowCapsInput, designerSnowCapsValue;

    // --- Gas Giant Controls ---
    let gasGiantControls, designerGgColor1Input, designerGgColor2Input, designerGgPoleColorInput,
        designerGgTurbulenceInput, designerGgTurbulenceValue, designerGgStormIntensityInput, designerGgStormIntensityValue,
        designerGgPoleSizeInput, designerGgPoleSizeValue, designerGgAtmosphereStyleInput, designerGgAtmosphereStyleValue;
        
    // --- Common Elements ---
    let savedDesignsUl, designerPlanetCanvas, designerIsGasGiantCheckbox,
        designerSaveBtn, designerCancelBtn, designerRandomizeBtn, boundResizeHandler, designerExploreBtn;

    let onBackCallback = null;
    let handleControlChangeRef, randomizeDesignerPlanetRef, handleExploreButtonClickRef,
        saveCustomPlanetDesignRef, cancelDesignerRef, savedDesignsClickHandlerRef, handleCheckboxChangeRef;

    const DISPLACEMENT_SCALING_FACTOR = 0.005;
    const SPHERE_BASE_RADIUS = 0.8;

    let currentDesignerBasis = {};

    function setDefaultBasis(isGasGiant) {
        currentDesignerBasis = {
            isGasGiant: isGasGiant,
            continentSeed: Math.random(),
            // Terrestrial Defaults
            waterColor: '#1E90FF', landColor: '#556B2F', forestDensity: 0.5,
            minTerrainHeight: 0.0, maxTerrainHeight: 10.0, oceanHeightLevel: 1.0,
            volcanicActivity: 0.0, snowCapLevel: 0.0,
            // Gas Giant Defaults
            ggBandColor1: '#D2B48C', ggBandColor2: '#8B4513', ggPoleColor: '#ADD8E6',
            ggPoleSize: 0.3, ggAtmosphereStyle: 0.1, ggTurbulence: 0.2, ggStormIntensity: 0.2,
        };
    }

    let designerThreeScene, designerThreeCamera, designerThreeRenderer,
        designerThreePlanetMesh, designerThreeControls, designerThreeAnimationId, designerShaderMaterial;

    function _onDesignerResize() {
        if (designerThreeRenderer && document.getElementById('planet-designer-screen')?.classList.contains('active')) {
            const newWidth = designerPlanetCanvas.offsetWidth;
            const newHeight = designerPlanetCanvas.offsetHeight;
            if (newWidth > 0 && newHeight > 0) {
                designerThreeCamera.aspect = newWidth / newHeight;
                designerThreeCamera.updateProjectionMatrix();
                designerThreeRenderer.setSize(newWidth, newHeight);
            }
        }
    }

    function _initDesignerThreeJSView() {
        if (!designerPlanetCanvas) return;

        const { vertexShader, fragmentShader } = getPlanetShaders();

        designerThreeScene = new THREE.Scene();
        designerThreeScene.background = new THREE.Color(0x0d0d0d);
        designerThreeCamera = new THREE.PerspectiveCamera(60, designerPlanetCanvas.offsetWidth / designerPlanetCanvas.offsetHeight, 0.001, 100);
        designerThreeCamera.position.z = 2.5;

        designerThreeRenderer = new THREE.WebGLRenderer({ canvas: designerPlanetCanvas, antialias: true });
        designerThreeRenderer.setSize(designerPlanetCanvas.offsetWidth, designerPlanetCanvas.offsetHeight);
        designerThreeRenderer.setPixelRatio(window.devicePixelRatio);

        const geometry = new THREE.IcosahedronGeometry(SPHERE_BASE_RADIUS, 32);

        const uniforms = THREE.UniformsUtils.merge([
            THREE.UniformsLib.common,
            {
                // Shared
                uTime: { value: 0.0 },
                uSphereRadius: { value: SPHERE_BASE_RADIUS },
                uContinentSeed: { value: Math.random() },
                uLightDirection: { value: new THREE.Vector3(0.8, 0.6, 1.0) },
                // Planet Type
                uIsGasGiant: { value: false },
                // Terrestrial
                uLandColor: { value: new THREE.Color() },
                uWaterColor: { value: new THREE.Color() },
                uOceanHeightLevel: { value: 0.5 },
                uForestDensity: { value: 0.5 },
                uDisplacementAmount: { value: 0.0 },
                uVolcanicActivity: { value: 0.0 },
                uSnowCapLevel: { value: 0.0 },
                // Gas Giant
                uGgBandColor1: { value: new THREE.Color() },
                uGgBandColor2: { value: new THREE.Color() },
                uGgPoleColor: { value: new THREE.Color() },
                uGgPoleSize: { value: 0.3 },
                uGgAtmosphereStyle: { value: 0.1 },
                uGgTurbulence: { value: 0.2 },
                uGgStormIntensity: { value: 0.2 },
            }
        ]);

        designerShaderMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
        });

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
            if (designerThreePlanetMesh.geometry) designerThreePlanetMesh.geometry.dispose();
            if (designerThreeScene) designerThreeScene.remove(designerThreePlanetMesh);
        }
        if (designerThreeRenderer) designerThreeRenderer.dispose();
        designerThreeAnimationId = null; designerThreeControls = null; designerShaderMaterial = null;
        designerThreePlanetMesh = null; designerThreeRenderer = null; designerThreeScene = null; designerThreeCamera = null;
    }
    
    function _updateControlVisibility() {
        const isGasGiant = designerIsGasGiantCheckbox.checked;
        terrestrialControls.style.display = isGasGiant ? 'none' : 'block';
        gasGiantControls.style.display = isGasGiant ? 'block' : 'none';
    }

    function _handleCheckboxChange() {
        const isGasGiant = designerIsGasGiantCheckbox.checked;
        setDefaultBasis(isGasGiant);
        _populateDesignerInputsFromBasis();
        _refreshDesignerPreview();
        _updateControlVisibility();
    }

    function _handleControlChange(event) {
        const input = event.target;
        const basis = currentDesignerBasis;
        switch (input.id) {
            // Terrestrial
            case 'designer-water-color': basis.waterColor = input.value; break;
            case 'designer-land-color': basis.landColor = input.value; break;
            case 'designer-forest-density': basis.forestDensity = parseFloat(input.value); designerForestDensityValue.textContent = basis.forestDensity.toFixed(2); break;
            case 'designer-volcanic-activity': basis.volcanicActivity = parseFloat(input.value); designerVolcanicActivityValue.textContent = basis.volcanicActivity.toFixed(2); break;
            case 'designer-snow-caps': basis.snowCapLevel = parseFloat(input.value); designerSnowCapsValue.textContent = basis.snowCapLevel.toFixed(2); break;
            case 'designer-min-height': basis.minTerrainHeight = parseFloat(input.value); break;
            case 'designer-max-height': basis.maxTerrainHeight = parseFloat(input.value); break;
            case 'designer-ocean-height': basis.oceanHeightLevel = parseFloat(input.value); break;
            // Gas Giant
            case 'designer-gg-color1': basis.ggBandColor1 = input.value; break;
            case 'designer-gg-color2': basis.ggBandColor2 = input.value; break;
            case 'designer-gg-pole-color': basis.ggPoleColor = input.value; break;
            case 'designer-gg-pole-size': basis.ggPoleSize = parseFloat(input.value); designerGgPoleSizeValue.textContent = basis.ggPoleSize.toFixed(2); break;
            case 'designer-gg-atmosphere-style': basis.ggAtmosphereStyle = parseFloat(input.value); designerGgAtmosphereStyleValue.textContent = basis.ggAtmosphereStyle.toFixed(2); break;
            case 'designer-gg-turbulence': basis.ggTurbulence = parseFloat(input.value); designerGgTurbulenceValue.textContent = basis.ggTurbulence.toFixed(2); break;
            case 'designer-gg-storm-intensity': basis.ggStormIntensity = parseFloat(input.value); designerGgStormIntensityValue.textContent = basis.ggStormIntensity.toFixed(2); break;
        }
        
        basis.oceanHeightLevel = Math.max(basis.minTerrainHeight, Math.min(basis.maxTerrainHeight, basis.oceanHeightLevel));
        _refreshDesignerPreview();
    }

    function _refreshDesignerPreview() {
        if (!designerShaderMaterial) return;
        
        const uniforms = designerShaderMaterial.uniforms;
        const basis = currentDesignerBasis;

        uniforms.uIsGasGiant.value = basis.isGasGiant;
        uniforms.uContinentSeed.value = basis.continentSeed;

        if (basis.isGasGiant) {
            uniforms.uGgBandColor1.value.set(basis.ggBandColor1);
            uniforms.uGgBandColor2.value.set(basis.ggBandColor2);
            uniforms.uGgPoleColor.value.set(basis.ggPoleColor);
            uniforms.uGgPoleSize.value = basis.ggPoleSize;
            uniforms.uGgAtmosphereStyle.value = basis.ggAtmosphereStyle;
            uniforms.uGgTurbulence.value = basis.ggTurbulence;
            uniforms.uGgStormIntensity.value = basis.ggStormIntensity;
        } else {
            const terrainRange = Math.max(0.1, basis.maxTerrainHeight - basis.minTerrainHeight);
            const normalizedOceanLevel = (basis.oceanHeightLevel - basis.minTerrainHeight) / terrainRange;
            
            uniforms.uWaterColor.value.set(basis.waterColor);
            uniforms.uLandColor.value.set(basis.landColor);
            uniforms.uForestDensity.value = basis.forestDensity;
            uniforms.uOceanHeightLevel.value = normalizedOceanLevel - 0.5;
            uniforms.uDisplacementAmount.value = terrainRange * DISPLACEMENT_SCALING_FACTOR;
            uniforms.uVolcanicActivity.value = basis.volcanicActivity;
            uniforms.uSnowCapLevel.value = basis.snowCapLevel;
        }
    }

    function _populateDesignerInputsFromBasis() {
        if (!designerWaterColorInput) return;
        
        const basis = currentDesignerBasis;
        designerIsGasGiantCheckbox.checked = basis.isGasGiant;

        // Terrestrial
        designerWaterColorInput.value = basis.waterColor;
        designerLandColorInput.value = basis.landColor;
        designerForestDensityInput.value = basis.forestDensity;
        designerForestDensityValue.textContent = Number(basis.forestDensity).toFixed(2);
        designerVolcanicActivityInput.value = basis.volcanicActivity;
        designerVolcanicActivityValue.textContent = Number(basis.volcanicActivity).toFixed(2);
        designerSnowCapsInput.value = basis.snowCapLevel;
        designerSnowCapsValue.textContent = Number(basis.snowCapLevel).toFixed(2);
        designerMinHeightInput.value = basis.minTerrainHeight;
        designerMaxHeightInput.value = basis.maxTerrainHeight;
        designerOceanHeightInput.value = basis.oceanHeightLevel;

        // Gas Giant
        designerGgColor1Input.value = basis.ggBandColor1;
        designerGgColor2Input.value = basis.ggBandColor2;
        designerGgPoleColorInput.value = basis.ggPoleColor;
        designerGgPoleSizeInput.value = basis.ggPoleSize;
        designerGgPoleSizeValue.textContent = Number(basis.ggPoleSize).toFixed(2);
        designerGgAtmosphereStyleInput.value = basis.ggAtmosphereStyle;
        designerGgAtmosphereStyleValue.textContent = Number(basis.ggAtmosphereStyle).toFixed(2);
        designerGgTurbulenceInput.value = basis.ggTurbulence;
        designerGgTurbulenceValue.textContent = Number(basis.ggTurbulence).toFixed(2);
        designerGgStormIntensityInput.value = basis.ggStormIntensity;
        designerGgStormIntensityValue.textContent = Number(basis.ggStormIntensity).toFixed(2);

        _updateControlVisibility();
    }

    function _randomizeDesignerPlanet() {
        function _getRandomHexColor() { return '#' + (Math.random() * 0xFFFFFF | 0).toString(16).padStart(6, '0'); }
        function _getRandomFloat(min, max, p = 1) { const f = Math.pow(10, p); return parseFloat((Math.random() * (max - min) + min).toFixed(p)); }

        const isGasGiant = designerIsGasGiantCheckbox.checked;
        setDefaultBasis(isGasGiant);
        const basis = currentDesignerBasis;
        basis.continentSeed = Math.random();

        if (isGasGiant) {
            basis.ggBandColor1 = _getRandomHexColor();
            basis.ggBandColor2 = _getRandomHexColor();
            basis.ggPoleColor = _getRandomHexColor();
            basis.ggPoleSize = _getRandomFloat(0.0, 0.8, 2);
            basis.ggAtmosphereStyle = _getRandomFloat(0.0, 1.0, 2);
            basis.ggTurbulence = _getRandomFloat(0.1, 1.0, 2);
            basis.ggStormIntensity = _getRandomFloat(0.0, 1.0, 2);
        } else {
            const minH = _getRandomFloat(0.0, 4.0);
            const maxH = _getRandomFloat(minH + 1.0, minH + 10.0);
            basis.waterColor = _getRandomHexColor();
            basis.landColor = _getRandomHexColor();
            basis.forestDensity = _getRandomFloat(0.1, 0.9, 2);
            basis.minTerrainHeight = minH;
            basis.maxTerrainHeight = maxH;
            basis.oceanHeightLevel = _getRandomFloat(minH, maxH);
            basis.volcanicActivity = _getRandomFloat(0.0, 1.0, 2);
            basis.snowCapLevel = Math.pow(_getRandomFloat(0.0, 1.0, 2), 2);
        }

        _populateDesignerInputsFromBasis();
        _refreshDesignerPreview();
    }

    function _generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function _saveCustomPlanetDesign() {
        const designName = `My ${currentDesignerBasis.isGasGiant ? 'Gas Giant' : 'Planet'} ${GameStateManager.getCustomPlanetDesigns().length + 1}`;
        const newDesign = { ...currentDesignerBasis, designId: _generateUUID(), designName: designName };
        GameStateManager.addCustomPlanetDesign(newDesign);
        console.log(`Planet design '${designName}' saved.`);
        _populateSavedDesignsList();
    }

    function _loadAndPreviewDesign(designId) {
        const designToLoad = GameStateManager.getCustomPlanetDesigns().find(d => d.designId === designId);
        if (designToLoad) {
            setDefaultBasis(designToLoad.isGasGiant || false);
            currentDesignerBasis = { ...currentDesignerBasis, ...designToLoad };
            delete currentDesignerBasis.designId;
            delete currentDesignerBasis.designName;
            _populateDesignerInputsFromBasis();
            _refreshDesignerPreview();
        }
    }

    function _handleExploreButtonClick(fromSolarSystem = false) {
        if (currentDesignerBasis.isGasGiant) {
            alert("Exploration view is not available for Gas Giants yet.");
            return;
        }
        const planetScreen = document.getElementById('planet-designer-screen');
        const hexScreen = document.getElementById('hex-planet-screen');
        HexPlanetViewController.activate(currentDesignerBasis, () => {
            planetScreen.classList.add('active');
            hexScreen.classList.remove('active');
        });
        planetScreen.classList.remove('active');
        hexScreen.classList.add('active');
    }

    function _deleteCustomPlanetDesign(designId) {
        GameStateManager.deleteCustomPlanetDesign(designId);
        console.log(`Planet design with ID '${designId}' deleted.`);
        _populateSavedDesignsList();
    }

    function _populateSavedDesignsList() {
        if (!savedDesignsUl) return;
        savedDesignsUl.innerHTML = '';
        const designs = GameStateManager.getCustomPlanetDesigns();
        if (designs.length === 0) {
            savedDesignsUl.innerHTML = '<li>No saved designs yet.</li>';
            return;
        }
        designs.forEach(design => {
            const li = document.createElement('li');
            const nameSpan = document.createElement('span');
            nameSpan.className = 'design-item-name';
            nameSpan.textContent = `${design.designName} (${design.isGasGiant ? 'Gas Giant' : 'Terrestrial'})`;
            const buttonsDiv = document.createElement('div');
            const loadBtn = document.createElement('button');
            loadBtn.textContent = 'Load';
            loadBtn.className = 'design-item-load modal-button-apply';
            loadBtn.dataset.id = design.designId;
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '×';
            deleteBtn.className = 'design-item-delete';
            deleteBtn.dataset.id = design.designId;
            deleteBtn.title = `Delete ${design.designName}`;
            buttonsDiv.appendChild(loadBtn);
            buttonsDiv.appendChild(deleteBtn);
            li.appendChild(nameSpan);
            li.appendChild(buttonsDiv);
            savedDesignsUl.appendChild(li);
        });
    }

    return {
        init: () => {
            // Common
            designerPlanetCanvas = document.getElementById('designer-planet-canvas');
            designerIsGasGiantCheckbox = document.getElementById('designer-is-gas-giant');
            savedDesignsUl = document.getElementById('saved-designs-ul');
            designerRandomizeBtn = document.getElementById('designer-randomize-btn');
            designerExploreBtn = document.getElementById('designer-explore-btn');
            designerSaveBtn = document.getElementById('designer-save-btn');
            designerCancelBtn = document.getElementById('designer-cancel-btn');

            // Control Containers
            terrestrialControls = document.getElementById('terrestrial-controls');
            gasGiantControls = document.getElementById('gas-giant-controls');

            // Terrestrial
            designerWaterColorInput = document.getElementById('designer-water-color');
            designerLandColorInput = document.getElementById('designer-land-color');
            designerForestDensityInput = document.getElementById('designer-forest-density');
            designerForestDensityValue = document.getElementById('designer-forest-density-value');
            designerMinHeightInput = document.getElementById('designer-min-height');
            designerMaxHeightInput = document.getElementById('designer-max-height');
            designerOceanHeightInput = document.getElementById('designer-ocean-height');
            designerVolcanicActivityInput = document.getElementById('designer-volcanic-activity');
            designerVolcanicActivityValue = document.getElementById('designer-volcanic-activity-value');
            designerSnowCapsInput = document.getElementById('designer-snow-caps');
            designerSnowCapsValue = document.getElementById('designer-snow-caps-value');

            // Gas Giant
            designerGgColor1Input = document.getElementById('designer-gg-color1');
            designerGgColor2Input = document.getElementById('designer-gg-color2');
            designerGgPoleColorInput = document.getElementById('designer-gg-pole-color');
            designerGgPoleSizeInput = document.getElementById('designer-gg-pole-size');
            designerGgPoleSizeValue = document.getElementById('designer-gg-pole-size-value');
            designerGgAtmosphereStyleInput = document.getElementById('designer-gg-atmosphere-style');
            designerGgAtmosphereStyleValue = document.getElementById('designer-gg-atmosphere-style-value');
            designerGgTurbulenceInput = document.getElementById('designer-gg-turbulence');
            designerGgTurbulenceValue = document.getElementById('designer-gg-turbulence-value');
            designerGgStormIntensityInput = document.getElementById('designer-gg-storm-intensity');
            designerGgStormIntensityValue = document.getElementById('designer-gg-storm-intensity-value');
            
            // Event Listeners
            handleControlChangeRef = (e) => _handleControlChange(e);
            handleCheckboxChangeRef = () => _handleCheckboxChange();
            randomizeDesignerPlanetRef = () => _randomizeDesignerPlanet();
            handleExploreButtonClickRef = () => _handleExploreButtonClick(false);
            saveCustomPlanetDesignRef = () => _saveCustomPlanetDesign();
            cancelDesignerRef = () => PlanetDesigner.deactivate();
            savedDesignsClickHandlerRef = (e) => {
                const targetButton = e.target.closest('button');
                if (!targetButton) return;
                const id = targetButton.dataset.id;
                if (!id) return;
                if (targetButton.classList.contains('design-item-load')) _loadAndPreviewDesign(id);
                else if (targetButton.classList.contains('design-item-delete')) _deleteCustomPlanetDesign(id);
            };
            boundResizeHandler = _onDesignerResize.bind(this);
            
            document.querySelectorAll('.designer-controls input').forEach(input => input.addEventListener('input', handleControlChangeRef));
            designerIsGasGiantCheckbox.addEventListener('change', handleCheckboxChangeRef);
            designerRandomizeBtn?.addEventListener('click', randomizeDesignerPlanetRef);
            designerExploreBtn?.addEventListener('click', handleExploreButtonClickRef);
            designerSaveBtn?.addEventListener('click', saveCustomPlanetDesignRef);
            designerCancelBtn?.addEventListener('click', cancelDesignerRef);
            savedDesignsUl?.addEventListener('click', savedDesignsClickHandlerRef);
            window.addEventListener('resize', boundResizeHandler);
        },

        activate: (onBack) => {
            onBackCallback = onBack;
            setDefaultBasis(false); // Default to terrestrial
            _populateDesignerInputsFromBasis();
            _populateSavedDesignsList();
            requestAnimationFrame(() => {
                _stopAndCleanupDesignerThreeJSView();
                _initDesignerThreeJSView();
                _refreshDesignerPreview();
            });
        },

        deactivate: () => {
            _stopAndCleanupDesignerThreeJSView();
            if (typeof onBackCallback === 'function') onBackCallback();
        },
    };
})();
