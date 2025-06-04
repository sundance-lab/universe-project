// js/dom_elements.js

// Main Screens
export const mainScreen = document.getElementById('main-screen');
export const galaxyDetailScreen = document.getElementById('galaxy-detail-screen');
export const solarSystemScreen = document.getElementById('solar-system-screen');
export const planetDesignerScreen = document.getElementById('planet-designer-screen');

// Main Screen Elements
export const universeCircle = document.getElementById('universe-circle');
export const mainScreenTitleText = document.getElementById('main-screen-title-text');

// Galaxy Detail Screen Elements
export const galaxyViewport = document.getElementById('galaxy-viewport');
export const galaxyZoomContent = document.getElementById('galaxy-zoom-content');
export const solarSystemLinesCanvasEl = document.getElementById('solar-system-lines-canvas'); // Line canvas element
export const galaxyDetailTitleText = document.getElementById('galaxy-detail-title-text');
export const galaxyDetailTitleInput = document.getElementById('galaxy-detail-title-input');

// Solar System Screen Elements
export const solarSystemContent = document.getElementById('solar-system-content');
export const solarSystemTitleText = document.getElementById('solar-system-title-text');
export const solarSystemTitleInput = document.getElementById('solar-system-title-input');

// Planet Designer Screen Elements
export const designerPlanetCanvas = document.getElementById('designer-planet-canvas');
export const designerWaterColorInput = document.getElementById('designer-water-color');
export const designerLandColorInput = document.getElementById('designer-land-color');
export const designerRandomizeBtn = document.getElementById('designer-randomize-btn');
export const designerSaveBtn = document.getElementById('designer-save-btn');
export const designerCancelBtn = document.getElementById('designer-cancel-btn');
export const savedDesignsUl = document.getElementById('saved-designs-ul');
export const designerMinHeightMinInput = document.getElementById('designer-min-height-min');
export const designerMinHeightMaxInput = document.getElementById('designer-min-height-max');
export const designerMaxHeightMinInput = document.getElementById('designer-max-height-min');
export const designerMaxHeightMaxInput = document.getElementById('designer-max-height-max');
export const designerOceanHeightMinInput = document.getElementById('designer-ocean-height-min');
export const designerOceanHeightMaxInput = document.getElementById('designer-ocean-height-max');

// Global Controls
export const zoomControlsElement = document.getElementById('zoom-controls');
export const zoomInButton = document.getElementById('zoom-in-btn');
export const zoomOutButton = document.getElementById('zoom-out-btn');
export const regenerateUniverseButton = document.getElementById('regenerate-universe-btn');
export const customizeGenerationButton = document.getElementById('customize-generation-btn');
export const createPlanetDesignButton = document.getElementById('create-planet-design-btn');
export const backToMainButton = document.getElementById('back-to-main');
export const backToGalaxyButton = document.getElementById('back-to-galaxy');

// Customization Modal Elements
export const customizationModal = document.getElementById('customization-modal');
export const applyCustomizationButton = document.getElementById('apply-customization-btn');
export const cancelCustomizationButton = document.getElementById('cancel-customization-btn');
export const numGalaxiesInput = document.getElementById('num-galaxies-input');
export const minSSInput = document.getElementById('min-ss-input');
export const maxSSInput = document.getElementById('max-ss-input');
export const ssSpreadInput = document.getElementById('ss-spread-input');
export const minPlanetsInput = document.getElementById('min-planets-input');
export const maxPlanetsInput = document.getElementById('max-planets-input');
export const showOrbitsInput = document.getElementById('show-orbits-input');

// Planet Visual Panel Elements
export const planetVisualPanel = document.getElementById('planet-visual-panel');
export const closePlanetVisualPanelBtn = document.getElementById('close-planet-visual-panel');
export const planetVisualPanelHeader = document.getElementById('planet-visual-panel-header');
export const planetVisualTitle = document.getElementById('planet-visual-title');
export const planetVisualSize = document.getElementById('planet-visual-size');
export const planetVisualCanvas = document.getElementById('planet-visual-canvas');

// Export an object containing all DOM elements for convenience
export const elements = {
    mainScreen, galaxyDetailScreen, solarSystemScreen, planetDesignerScreen,
    universeCircle, mainScreenTitleText,
    galaxyViewport, galaxyZoomContent, solarSystemLinesCanvasEl, galaxyDetailTitleText, galaxyDetailTitleInput,
    solarSystemContent, solarSystemTitleText, solarSystemTitleInput,
    designerPlanetCanvas, designerWaterColorInput, designerLandColorInput,
    designerRandomizeBtn, designerSaveBtn, designerCancelBtn, savedDesignsUl,
    designerMinHeightMinInput, designerMinHeightMaxInput, designerMaxHeightMinInput,
    designerMaxHeightMaxInput, designerOceanHeightMinInput, designerOceanHeightMaxInput,
    zoomControlsElement, zoomInButton, zoomOutButton, regenerateUniverseButton,
    customizeGenerationButton, createPlanetDesignButton, backToMainButton, backToGalaxyButton,
    customizationModal, applyCustomizationButton, cancelCustomizationButton,
    numGalaxiesInput, minSSInput, maxSSInput, ssSpreadInput, minPlanetsInput, maxPlanetsInput,
    showOrbitsInput,
    planetVisualPanel, closePlanetVisualPanelBtn, planetVisualPanelHeader,
    planetVisualTitle, planetVisualSize, planetVisualCanvas
};
