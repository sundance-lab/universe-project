// public/js/planetSurfaceController.js
import * as THREE from 'three';
import { getPlanetSurfaceShaders } from './shaders.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const PlanetSurfaceController = (() => {
  let screen, canvas, backButton;
  let scene, camera, renderer, controls, mesh, material, animationId;
  
  // A helper to convert the planet designer's height values to something usable here
  const normalizeOceanLevel = (basis) => {
      const range = (basis.maxTerrainHeight - basis.minTerrainHeight) || 1.0;
      return (basis.oceanHeightLevel - basis.minTerrainHeight) / range - 0.5;
  };

  const _init = () => {
    screen = document.getElementById('planet-surface-screen');
    canvas = document.getElementById('planet-surface-canvas');
    backButton = document.getElementById('back-from-surface');

    backButton?.addEventListener('click', _deactivate);
  };

  const _animate = () => {
    animationId = requestAnimationFrame(_animate);
    controls.update();
    renderer.render(scene, camera);
  };

  const _activate = (planetBasis) => {
    if (!canvas) return;
    
    // --- Setup Scene ---
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // --- Setup Controls ---
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    
    // --- Create High-Detail Terrain ---
    const { vertexShader, fragmentShader } = getPlanetSurfaceShaders();
    const geometry = new THREE.PlaneGeometry(100, 100, 512, 512); // A 100x100 meter plane with over 262,000 vertices!
    
    material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uDisplacementAmount: { value: 15.0 }, // Much larger displacement for dramatic mountains
        uContinentSeed: { value: planetBasis.continentSeed },
        uLandColor: { value: new THREE.Color(planetBasis.landColor) },
        uWaterColor: { value: new THREE.Color(planetBasis.waterColor) },
        // Convert the planet's ocean height to a usable value for this view
        uOceanHeightLevel: { value: normalizeOceanLevel(planetBasis) * 15.0 }
      }
    });

    mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2; // Rotate the plane to be flat
    scene.add(mesh);
    
    // --- Activate Screen ---
    if (window.setActiveScreen) window.setActiveScreen(screen);
    _animate();
  };

  const _deactivate = () => {
    cancelAnimationFrame(animationId);
    if(window.PlanetDesigner?.activate) {
      document.getElementById('planet-designer-screen').classList.add('active'); // Manually reactivate
    }
  };

  return {
    init: _init,
    activate: _activate
  };
})();
