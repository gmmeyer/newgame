import * as THREE from 'three';
import { getTexture } from './textures.js';

export class PowerupSystem {
    constructor(scene, particleSystem, audio) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.audio = audio;
        this.powerups = [];
        this.activeEffects = {
            invincibility: { active: false, endTime: 0 },
            damageBoost: { active: false, endTime: 0, multiplier: 1 },
            speedBoost: { active: false, endTime: 0, multiplier: 1 },
            magnetPulse: { active: false, endTime: 0 }
        };
    }
    
    spawnPowerup(position, type = null) {
        const types = ['invincibility', 'damageBoost', 'speedBoost', 'magnetPulse'];
        const selectedType = type || types[Math.floor(Math.random() * types.length)];
        
        const config = this.getPowerupConfig(selectedType);
        const powerupTexture = getTexture('powerup_' + selectedType);
        
        const group = new THREE.Group();
        
        const geometry = new THREE.OctahedronGeometry(0.5, 0);
        const material = new THREE.MeshStandardMaterial({
            map: powerupTexture,
            color: config.color,
            emissive: config.color,
            emissiveIntensity: 0.8,
            emissiveMap: powerupTexture,
            transparent: true,
            opacity: 0.9,
            roughness: 0.2,
            metalness: 0.8
        });
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
        
        const ringGeometry = new THREE.RingGeometry(0.7, 0.9, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: config.color,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);
        
        const light = new THREE.PointLight(config.color, 1, 5);
        group.add(light);
        
        group.position.copy(position);
        group.position.y = 1;
        
        group.userData = {
            type: selectedType,
            config: config,
            lifetime: 15,
            bobOffset: Math.random() * Math.PI * 2
        };
        
        this.scene.add(group);
        this.powerups.push(group);
        
        this.particleSystem.emit({
            position: { x: position.x, y: 1, z: position.z },
            velocity: { x: 0, y: 5, z: 0 },
            color: { r: config.colorRGB.r, g: config.colorRGB.g, b: config.colorRGB.b },
            count: 20, spread: 0.5, size: 1, lifetime: 0.5, gravity: 0
        });
    }
    
    getPowerupConfig(type) {
        const configs = {
            invincibility: {
                color: 0x00ffff,
                colorRGB: { r: 0, g: 1, b: 1 },
                duration: 5,
                name: 'INVINCIBILITY',
                icon: '🛡️'
            },
            damageBoost: {
                color: 0xff0000,
                colorRGB: { r: 1, g: 0, b: 0 },
                duration: 8,
                multiplier: 2,
                name: 'DOUBLE DAMAGE',
                icon: '⚔️'
            },
            speedBoost: {
                color: 0xffff00,
                colorRGB: { r: 1, g: 1, b: 0 },
                duration: 6,
                multiplier: 1.5,
                name: 'SPEED BOOST',
                icon: '⚡'
            },
            magnetPulse: {
                color: 0x00ff00,
                colorRGB: { r: 0, g: 1, b: 0 },
                duration: 10,
                name: 'MEGA MAGNET',
                icon: '🧲'
            }
        };
        return configs[type];
    }
    
    update(deltaTime, gameTime, playerPosition) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            const data = powerup.userData;
            
            data.lifetime -= deltaTime;
            
            powerup.rotation.y += deltaTime * 2;
            powerup.position.y = 1 + Math.sin(gameTime * 3 + data.bobOffset) * 0.2;
            
            powerup.children[1].rotation.z += deltaTime * 3;
            
            if (data.lifetime < 3) {
                const flash = Math.sin(gameTime * 10) * 0.5 + 0.5;
                powerup.children[0].material.opacity = 0.5 + flash * 0.5;
            }
            
            if (Math.random() < 0.05) {
                this.particleSystem.emit({
                    position: { x: powerup.position.x, y: powerup.position.y, z: powerup.position.z },
                    velocity: { x: 0, y: 2, z: 0 },
                    color: data.config.colorRGB,
                    count: 1, spread: 0.3, size: 0.5, lifetime: 0.3, gravity: -1
                });
            }
            
            const dist = playerPosition.distanceTo(powerup.position);
            if (dist < 1.5) {
                this.collectPowerup(powerup, gameTime);
                this.scene.remove(powerup);
                this.powerups.splice(i, 1);
                continue;
            }
            
            if (data.lifetime <= 0) {
                this.scene.remove(powerup);
                this.powerups.splice(i, 1);
            }
        }
        
        Object.keys(this.activeEffects).forEach(key => {
            const effect = this.activeEffects[key];
            if (effect.active && gameTime >= effect.endTime) {
                effect.active = false;
                effect.multiplier = 1;
            }
        });
    }
    
    collectPowerup(powerup, gameTime) {
        const data = powerup.userData;
        const config = data.config;
        
        this.particleSystem.emit({
            position: { x: powerup.position.x, y: powerup.position.y, z: powerup.position.z },
            velocity: { x: 0, y: 5, z: 0 },
            color: config.colorRGB,
            count: 40, spread: 1, size: 1.2, lifetime: 0.6, gravity: 3
        });
        
        this.audio.playLevelUp();
        
        const effect = this.activeEffects[data.type];
        effect.active = true;
        effect.endTime = gameTime + config.duration;
        if (config.multiplier) {
            effect.multiplier = config.multiplier;
        }
        
        this.showPowerupMessage(config.name, config.icon);
    }
    
    showPowerupMessage(name, icon) {
        const existing = document.getElementById('powerup-message');
        if (existing) existing.remove();
        
        const msg = document.createElement('div');
        msg.id = 'powerup-message';
        msg.textContent = `${icon} ${name} ${icon}`;
        document.body.appendChild(msg);
        
        setTimeout(() => msg.remove(), 2000);
    }
    
    isInvincible() {
        return this.activeEffects.invincibility.active;
    }
    
    getDamageMultiplier() {
        return this.activeEffects.damageBoost.multiplier;
    }
    
    getSpeedMultiplier() {
        return this.activeEffects.speedBoost.multiplier;
    }
    
    getMagnetMultiplier() {
        return this.activeEffects.magnetPulse.active ? 3 : 1;
    }
    
    getActiveEffects() {
        const active = [];
        Object.keys(this.activeEffects).forEach(key => {
            if (this.activeEffects[key].active) {
                active.push({
                    type: key,
                    remaining: this.activeEffects[key].endTime
                });
            }
        });
        return active;
    }
    
    shouldDropPowerup(enemyType) {
        if (enemyType === 'boss') return Math.random() < 0.8;
        if (enemyType === 'elite') return Math.random() < 0.15;
        return Math.random() < 0.005;
    }
    
    reset() {
        this.powerups.forEach(p => {
            this.scene.remove(p);
        });
        this.powerups = [];
        
        Object.keys(this.activeEffects).forEach(key => {
            this.activeEffects[key].active = false;
            this.activeEffects[key].endTime = 0;
            this.activeEffects[key].multiplier = 1;
        });
    }
}
