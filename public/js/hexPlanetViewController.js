// public/js/hexPlanetViewController.js

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getHexPlanetShaders } from './shaders.js';

export const HexPlanetViewController = (() => {
  let screen, canvas, backButton;
  let scene, camera, renderer, controls, mesh, material, animationId;

  // This function adds the special 'barycentric' data to our geometry,
  // which is essential for the hexagon stroke shader to work.
  const addBarycentricCoordinates = (geometry) => {
    const count = geometry.attributes.position.count;
    const barycentric = [];

    for (let i = 0; i < count; i++) {
        // For each of the 3 vertices in a triangle, we set one of the
        // barycentric coordinates to 1 and the others to 0.
        barycentric.push(
            i % 3 === 0 ? 1 : 0,
            i % 3 === 1 ? 1 : 0,
            i % 3 === 2 ? 1 : 0
        );
    }

    const barycentricAttribute = new THREE.Float32BufferAttribute(barycentric, 3);
    geometry.setAttribute('barycentric', barycentricAttribute);
  };
  
  const _init = () => {
    screen = document.getElementById('planet-surface-screen'); // We reuse the existing screen
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
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 2.5;
    
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    
    // --- CREATE THE HIGH-DETAIL ICOSAHEDRON GEOMETRY ---
    const { vertexShader, fragmentShader } = getHexPlanetShaders();
    const geometry = new THREE.IcosahedronGeometry(1, 64); // A sphere with 1m radius and VERY high detail (64 subdivisions)
    addBarycentricCoordinates(geometry); // Add the special data for the hex shader
    
    const pMin = planetBasis.minTerrainHeight;
    const pMax = planetBasis.maxTerrainHeight;
    const pOcean = planetBasis.oceanHeightLevel;
    const normalizedOceanLevel = (pOcean - pMin) / ((pMax - pMin) || 1.0);
    const displacementAmount = ((pMax - pMin) || 1.0) * 0.005;

    material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        // Pass all the necessary data from the planet designer to the shader
        uContinentSeed: { value: planetBasis.continentSeed },
        uSphereRadius: { value: 1.0 },
        uDisplacementAmount: { value: displacementAmount },
        uLandColor: { value: new THREE.Color(planetBasis.landColor) },
        uWaterColor: { value: new THREE.Color(planetBasis.waterColor) },
        uOceanHeightLevel: { value: normalizedOceanLevel - 0.5 },
        uForestDensity: { value: planetBasis.forestDensity },
      }
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    
    if (window.setActiveScreen) window.setActiveScreen(screen);
    _animate();
  };

  const _deactivate = () => {
    cancelAnimationFrame(animationId);
    // When going back, reactivate the orbital designer view
    if (window.PlanetDesigner?.activate) {
        window.PlanetDesigner.activate(); // This properly hides our current screen and shows the designer
    }
  };

  return {
    init: _init,
    activate: _activate
  };
})();
