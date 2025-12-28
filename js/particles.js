import * as THREE from 'three';
import { getTexture } from './textures.js';

export class ParticleSystem {
    constructor(maxParticles = 5000) {
        this.maxParticles = maxParticles;
        this.particleIndex = 0;
        
        this.geometry = new THREE.BufferGeometry();
        
        this.positions = new Float32Array(maxParticles * 3);
        this.colors = new Float32Array(maxParticles * 3);
        this.sizes = new Float32Array(maxParticles);
        this.alphas = new Float32Array(maxParticles);
        
        this.velocities = new Float32Array(maxParticles * 3);
        this.lifetimes = new Float32Array(maxParticles);
        this.maxLifetimes = new Float32Array(maxParticles);
        this.gravities = new Float32Array(maxParticles);
        this.initialSizes = new Float32Array(maxParticles);
        
        this.lifetimes.fill(-1);
        this.alphas.fill(0);
        
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));
        
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                pointTexture: { value: getTexture('particle') }
            },
            vertexShader: `
                attribute float size;
                attribute float alpha;
                attribute vec3 color;
                varying vec3 vColor;
                varying float vAlpha;
                void main() {
                    vColor = color;
                    vAlpha = alpha;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                varying vec3 vColor;
                varying float vAlpha;
                void main() {
                    vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                    gl_FragColor = vec4(vColor, texColor.a * vAlpha);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true
        });
        
        this.points = new THREE.Points(this.geometry, this.material);
        this.qualityMultiplier = 1.0;
    }
    
    emit(config) {
        const {
            position,
            velocity = { x: 0, y: 0, z: 0 },
            color = { r: 1, g: 1, b: 1 },
            count = 10,
            spread = 1,
            speedVariation = 0.5,
            size = 1,
            lifetime = 1,
            gravity = 0
        } = config;
        
        const adjustedCount = Math.max(1, Math.floor(count * this.qualityMultiplier));
        
        for (let i = 0; i < adjustedCount; i++) {
            const idx = this.particleIndex;
            const idx3 = idx * 3;
            
            this.positions[idx3] = position.x + (Math.random() - 0.5) * spread;
            this.positions[idx3 + 1] = position.y + (Math.random() - 0.5) * spread;
            this.positions[idx3 + 2] = position.z + (Math.random() - 0.5) * spread;
            
            const speedMult = 1 + (Math.random() - 0.5) * speedVariation * 2;
            const randomDir = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize().multiplyScalar(spread * 2);
            
            this.velocities[idx3] = (velocity.x + randomDir.x) * speedMult;
            this.velocities[idx3 + 1] = (velocity.y + randomDir.y) * speedMult;
            this.velocities[idx3 + 2] = (velocity.z + randomDir.z) * speedMult;
            
            this.colors[idx3] = Math.min(1, color.r + (Math.random() - 0.5) * 0.2);
            this.colors[idx3 + 1] = Math.min(1, color.g + (Math.random() - 0.5) * 0.2);
            this.colors[idx3 + 2] = Math.min(1, color.b + (Math.random() - 0.5) * 0.2);
            
            this.sizes[idx] = size * (0.5 + Math.random() * 0.5);
            this.initialSizes[idx] = this.sizes[idx];
            this.alphas[idx] = 1;
            this.lifetimes[idx] = lifetime;
            this.maxLifetimes[idx] = lifetime;
            this.gravities[idx] = gravity;
            
            this.particleIndex = (this.particleIndex + 1) % this.maxParticles;
        }
    }
    
    update(deltaTime) {
        for (let i = 0; i < this.maxParticles; i++) {
            if (this.lifetimes[i] <= 0) continue;
            
            const idx3 = i * 3;
            
            this.positions[idx3] += this.velocities[idx3] * deltaTime;
            this.positions[idx3 + 1] += this.velocities[idx3 + 1] * deltaTime;
            this.positions[idx3 + 2] += this.velocities[idx3 + 2] * deltaTime;
            
            this.velocities[idx3 + 1] -= this.gravities[i] * deltaTime;
            
            this.lifetimes[i] -= deltaTime;
            
            const progress = 1 - (this.lifetimes[i] / this.maxLifetimes[i]);
            
            this.alphas[i] = 1 - progress;
            this.sizes[i] = this.initialSizes[i] * (1 - progress * 0.5);
        }
        
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
        this.geometry.attributes.size.needsUpdate = true;
        this.geometry.attributes.alpha.needsUpdate = true;
    }
}
