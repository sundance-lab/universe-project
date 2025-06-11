import * as THREE from 'three';

class GalaxyGenerator {
    constructor() {
        // Scientifically accurate parameters (all distances in kiloparsecs)
        this.params = {
            // Structure parameters
            discScale: 3.5,          // Disk scale length (MW ~3.5 kpc)
            bulgeRadius: 1.0,        // Bulge radius (~1 kpc)
            haloRadius: 50.0,        // Dark matter halo extent
            discHeight: 0.3,         // Thin disk scale height
            thickDiscHeight: 1.0,    // Thick disk scale height
            
            // Particle counts
            nDisc: 500000,           // Thin disk stars
            nThickDisc: 200000,      // Thick disk stars
            nBulge: 150000,          // Galactic bulge
            nHalo: 50000,           // Stellar halo
            
            // Spiral structure
            numArms: 4,              // Major spiral arms
            pitchAngle: 12.5,        // Logarithmic spiral pitch angle
            spiralStart: 2.5,        // Inner radius where spiral starts
            spiralDensity: 0.5,      // Density contrast of spiral arms
            
            // Kinematics
            rotationCurve: 220,      // Rotation curve plateau (km/s)
            velocityDispersion: 30    // Velocity dispersion (km/s)
        };
        
        this.geometry = null;
        this.particles = null;
    }

    generateGalaxy() {
        const positions = new Float32Array(this.getTotalParticles() * 3);
        const colors = new Float32Array(this.getTotalParticles() * 3);
        const sizes = new Float32Array(this.getTotalParticles());
        
        let offset = 0;
        
        // Generate components
        offset = this.generateBulge(positions, colors, sizes, offset);
        offset = this.generateThinDisc(positions, colors, sizes, offset);
        offset = this.generateThickDisc(positions, colors, sizes, offset);
        offset = this.generateHalo(positions, colors, sizes, offset);
        
        return this.createParticleSystem(positions, colors, sizes);
    }

    generateBulge(positions, colors, sizes, offset) {
        // Using de Vaucouleurs profile (R^(1/4) law)
        for(let i = 0; i < this.params.nBulge; i++) {
            const r = this.deVaucouleursRadius();
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);
            
            // Position
            positions[offset + i * 3] = x;
            positions[offset + i * 3 + 1] = y;
            positions[offset + i * 3 + 2] = z;
            
            // Color (yellower, older stars)
            colors[offset + i * 3] = 1.0;     // R
            colors[offset + i * 3 + 1] = 0.9; // G
            colors[offset + i * 3 + 2] = 0.7; // B
            
            // Size (brighter in bulge)
            sizes[i] = 2.0;
        }
        return offset + this.params.nBulge * 3;
    }

    generateThinDisc(positions, colors, sizes, offset) {
        const spiralPhase = 2 * Math.PI / this.params.numArms;
        const pitchAngleRad = (this.params.pitchAngle * Math.PI) / 180;
        
        for(let i = 0; i < this.params.nDisc; i++) {
            // Exponential disk profile
            const r = this.exponentialRadius(this.params.discScale);
            const theta = Math.random() * Math.PI * 2;
            
            // Spiral arm perturbation
            const spiralAmplitude = this.getSpiralAmplitude(r);
            const armPhase = Math.log(r) / Math.tan(pitchAngleRad);
            const spiralTheta = theta + spiralAmplitude * Math.sin(armPhase);
            
            // Position with vertical distribution
            const x = r * Math.cos(spiralTheta);
            const y = r * Math.sin(spiralTheta);
            const z = this.gaussianZ(this.params.discHeight);
            
            positions[offset + i * 3] = x;
            positions[offset + i * 3 + 1] = y;
            positions[offset + i * 3 + 2] = z;
            
            // Color (bluer in spiral arms)
            const armFactor = this.getArmFactor(r, spiralTheta);
            colors[offset + i * 3] = 0.7 + armFactor * 0.3;     // R
            colors[offset + i * 3 + 1] = 0.7 + armFactor * 0.3; // G
            colors[offset + i * 3 + 2] = 1.0;                   // B
            
            sizes[i] = 1.0 + armFactor;
        }
        return offset + this.params.nDisc * 3;
    }

    // Helper methods for physical distributions
    deVaucouleursRadius() {
        // Implements R^(1/4) law for bulge
        const u = Math.random();
        return this.params.bulgeRadius * Math.pow(-Math.log(1 - u), 4);
    }

    exponentialRadius(scale) {
        // Implements exponential disk profile
        const u = Math.random();
        return -scale * Math.log(1 - u);
    }

    gaussianZ(scaleHeight) {
        // Box-Muller transform for vertical distribution
        const u = 1 - Math.random();
        const v = Math.random();
        return scaleHeight * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    getSpiralAmplitude(r) {
        // Spiral arm strength varies with radius
        const normalizedR = r / this.params.discScale;
        return this.params.spiralDensity * 
               Math.exp(-(normalizedR - 2.5) * (normalizedR - 2.5) / 4);
    }

    createParticleSystem(positions, colors, sizes) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 0.05,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        return new THREE.Points(geometry, material);
    }

    getTotalParticles() {
        return this.params.nDisc + this.params.nThickDisc + 
               this.params.nBulge + this.params.nHalo;
    }
}

export default GalaxyGenerator;
