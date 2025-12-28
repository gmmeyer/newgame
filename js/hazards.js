import * as THREE from 'three';
import { getTexture } from './textures.js';

export class HazardSystem {
    constructor(scene, particleSystem, audio) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.audio = audio;
        this.hazards = [];
        this.spawnCooldown = 0;
        this.baseSpawnInterval = 15;
    }
    
    update(deltaTime, gameTime, playerPosition, playerStats, enemies) {
        this.spawnCooldown -= deltaTime;
        
        if (this.spawnCooldown <= 0 && gameTime > 60) {
            this.spawnCooldown = this.baseSpawnInterval - Math.min(gameTime / 60, 5);
            this.spawnRandomHazard(playerPosition, gameTime);
        }
        
        for (let i = this.hazards.length - 1; i >= 0; i--) {
            const hazard = this.hazards[i];
            hazard.update(deltaTime, gameTime);
            
            if (hazard.isActive) {
                const playerDamage = hazard.checkPlayerCollision(playerPosition);
                if (playerDamage > 0) {
                    playerStats.health -= playerDamage;
                    this.audio.playHurt();
                }
                
                enemies.forEach((enemy, idx) => {
                    const damage = hazard.checkEnemyCollision(enemy.position);
                    if (damage > 0) {
                        enemy.userData.health -= damage;
                    }
                });
            }
            
            if (hazard.isExpired) {
                hazard.destroy();
                this.hazards.splice(i, 1);
            }
        }
    }
    
    spawnRandomHazard(playerPosition, gameTime) {
        const hazardTypes = ['laserGrid', 'dangerZone', 'pulsingOrb', 'lavaPool', 'sweepingBeam'];
        const type = hazardTypes[Math.floor(Math.random() * hazardTypes.length)];
        
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 20;
        const x = playerPosition.x + Math.cos(angle) * distance;
        const z = playerPosition.z + Math.sin(angle) * distance;
        
        let hazard;
        switch (type) {
            case 'laserGrid':
                hazard = new LaserGrid(this.scene, this.particleSystem, x, z);
                break;
            case 'dangerZone':
                hazard = new DangerZone(this.scene, this.particleSystem, x, z);
                break;
            case 'pulsingOrb':
                hazard = new PulsingOrb(this.scene, this.particleSystem, x, z);
                break;
            case 'lavaPool':
                hazard = new LavaPool(this.scene, this.particleSystem, x, z);
                break;
            case 'sweepingBeam':
                hazard = new SweepingBeam(this.scene, this.particleSystem, x, z);
                break;
        }
        
        if (hazard) {
            this.hazards.push(hazard);
        }
    }
    
    reset() {
        this.hazards.forEach(h => h.destroy());
        this.hazards = [];
        this.spawnCooldown = 0;
    }
    
    spawnFireTrail(position, radius, damage) {
        const fire = new FireTrail(this.scene, this.particleSystem, position.x, position.z, radius, damage);
        this.hazards.push(fire);
    }
}

class FireTrail {
    constructor(scene, particleSystem, x, z, radius = 2, damage = 8) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.position = new THREE.Vector3(x, 0, z);
        this.radius = radius;
        this.damage = damage;
        this.lifetime = 3;
        this.age = 0;
        this.isActive = true;
        this.isExpired = false;
        this.damageCooldown = new Map();
        
        const geometry = new THREE.CircleGeometry(radius, 16);
        geometry.rotateX(-Math.PI / 2);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.6
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, 0.05, z);
        this.scene.add(this.mesh);
    }
    
    update(deltaTime, gameTime) {
        this.age += deltaTime;
        
        const fadeStart = this.lifetime * 0.6;
        if (this.age > fadeStart) {
            const fadeProgress = (this.age - fadeStart) / (this.lifetime - fadeStart);
            this.mesh.material.opacity = 0.6 * (1 - fadeProgress);
        }
        
        if (Math.random() < 0.3) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.radius * 0.8;
            this.particleSystem.emit({
                position: { 
                    x: this.position.x + Math.cos(angle) * dist, 
                    y: 0.2, 
                    z: this.position.z + Math.sin(angle) * dist 
                },
                velocity: { x: 0, y: 2 + Math.random() * 2, z: 0 },
                color: { r: 1, g: 0.3 + Math.random() * 0.3, b: 0 },
                count: 1, spread: 0.2, size: 0.6, lifetime: 0.4, gravity: -1
            });
        }
        
        if (this.age >= this.lifetime) {
            this.isExpired = true;
            this.isActive = false;
        }
    }
    
    checkPlayerCollision(playerPosition) {
        const dist = Math.sqrt(
            Math.pow(playerPosition.x - this.position.x, 2) + 
            Math.pow(playerPosition.z - this.position.z, 2)
        );
        
        if (dist < this.radius + 0.5) {
            const now = Date.now();
            const lastDamage = this.damageCooldown.get('player') || 0;
            if (now - lastDamage > 500) {
                this.damageCooldown.set('player', now);
                return this.damage;
            }
        }
        return 0;
    }
    
    checkEnemyCollision(enemyPosition) {
        return 0;
    }
    
    destroy() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

class LaserGrid {
    constructor(scene, particleSystem, x, z) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.position = new THREE.Vector3(x, 0, z);
        this.size = 8;
        this.damage = 15;
        this.lifetime = 6;
        this.warningTime = 2;
        this.age = 0;
        this.isActive = false;
        this.isExpired = false;
        this.damageCooldown = new Map();
        
        this.group = new THREE.Group();
        this.group.position.set(x, 0.1, z);
        
        this.createWarningIndicator();
        this.scene.add(this.group);
    }
    
    createWarningIndicator() {
        const geometry = new THREE.PlaneGeometry(this.size, this.size);
        const laserTexture = getTexture('hazard_laser');
        const material = new THREE.MeshBasicMaterial({
            map: laserTexture,
            color: 0xff0000,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        this.warningPlane = new THREE.Mesh(geometry, material);
        this.warningPlane.rotation.x = -Math.PI / 2;
        this.group.add(this.warningPlane);
        
        const edgeGeometry = new THREE.EdgesGeometry(geometry);
        const edgeMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
        this.warningEdge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
        this.warningEdge.rotation.x = -Math.PI / 2;
        this.group.add(this.warningEdge);
    }
    
    createLasers() {
        this.lasers = [];
        const gridCount = 4;
        const spacing = this.size / gridCount;
        
        for (let i = 0; i <= gridCount; i++) {
            const offset = -this.size / 2 + i * spacing;
            
            const hGeometry = new THREE.BoxGeometry(this.size, 0.1, 0.05);
            const hMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const hLaser = new THREE.Mesh(hGeometry, hMaterial);
            hLaser.position.set(0, 0.5, offset);
            this.group.add(hLaser);
            this.lasers.push(hLaser);
            
            const vGeometry = new THREE.BoxGeometry(0.05, 0.1, this.size);
            const vMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const vLaser = new THREE.Mesh(vGeometry, vMaterial);
            vLaser.position.set(offset, 0.5, 0);
            this.group.add(vLaser);
            this.lasers.push(vLaser);
        }
        
        const light = new THREE.PointLight(0xff0000, 2, 15);
        light.position.set(0, 1, 0);
        this.group.add(light);
        this.light = light;
    }
    
    update(deltaTime, gameTime) {
        this.age += deltaTime;
        
        if (this.age >= this.lifetime) {
            this.isExpired = true;
            return;
        }
        
        if (this.age < this.warningTime) {
            const flash = Math.sin(this.age * 15) * 0.5 + 0.5;
            this.warningPlane.material.opacity = 0.1 + flash * 0.3;
            this.warningEdge.material.opacity = 0.3 + flash * 0.5;
        } else if (!this.isActive) {
            this.isActive = true;
            this.warningPlane.visible = false;
            this.warningEdge.visible = false;
            this.createLasers();
            
            this.particleSystem.emit({
                position: { x: this.position.x, y: 0.5, z: this.position.z },
                velocity: { x: 0, y: 3, z: 0 },
                color: { r: 1, g: 0, b: 0 },
                count: 30, spread: this.size / 2, size: 1, lifetime: 0.5, gravity: 0
            });
        }
        
        if (this.isActive && this.lasers) {
            const pulse = Math.sin(this.age * 10) * 0.3 + 0.7;
            this.lasers.forEach(laser => {
                laser.material.opacity = pulse;
            });
            if (this.light) {
                this.light.intensity = 1 + pulse;
            }
        }
    }
    
    checkPlayerCollision(playerPosition) {
        if (!this.isActive) return 0;
        
        const dx = Math.abs(playerPosition.x - this.position.x);
        const dz = Math.abs(playerPosition.z - this.position.z);
        
        if (dx < this.size / 2 && dz < this.size / 2) {
            const now = Date.now();
            const lastDamage = this.damageCooldown.get('player') || 0;
            if (now - lastDamage > 500) {
                this.damageCooldown.set('player', now);
                return this.damage;
            }
        }
        return 0;
    }
    
    checkEnemyCollision(enemyPosition) {
        if (!this.isActive) return 0;
        
        const dx = Math.abs(enemyPosition.x - this.position.x);
        const dz = Math.abs(enemyPosition.z - this.position.z);
        
        if (dx < this.size / 2 && dz < this.size / 2) {
            const id = `${enemyPosition.x.toFixed(1)}_${enemyPosition.z.toFixed(1)}`;
            const now = Date.now();
            const lastDamage = this.damageCooldown.get(id) || 0;
            if (now - lastDamage > 500) {
                this.damageCooldown.set(id, now);
                return this.damage;
            }
        }
        return 0;
    }
    
    destroy() {
        this.scene.remove(this.group);
    }
}

class DangerZone {
    constructor(scene, particleSystem, x, z) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.position = new THREE.Vector3(x, 0, z);
        this.radius = 5;
        this.damage = 25;
        this.lifetime = 5;
        this.warningTime = 1.5;
        this.age = 0;
        this.isActive = false;
        this.isExpired = false;
        this.hasExploded = false;
        
        this.group = new THREE.Group();
        this.group.position.set(x, 0.1, z);
        
        this.createWarningCircle();
        this.scene.add(this.group);
    }
    
    createWarningCircle() {
        const geometry = new THREE.CircleGeometry(this.radius, 32);
        const dangerTexture = getTexture('hazard_danger');
        const material = new THREE.MeshBasicMaterial({
            map: dangerTexture,
            color: 0xff6600,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        this.circle = new THREE.Mesh(geometry, material);
        this.circle.rotation.x = -Math.PI / 2;
        this.group.add(this.circle);
        
        const ringGeometry = new THREE.RingGeometry(this.radius - 0.1, this.radius, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.ring = new THREE.Mesh(ringGeometry, ringMaterial);
        this.ring.rotation.x = -Math.PI / 2;
        this.group.add(this.ring);
    }
    
    update(deltaTime, gameTime) {
        this.age += deltaTime;
        
        if (this.age >= this.lifetime) {
            this.isExpired = true;
            return;
        }
        
        if (this.age < this.warningTime) {
            const progress = this.age / this.warningTime;
            this.circle.scale.set(progress, progress, 1);
            
            const flash = Math.sin(this.age * 20) * 0.5 + 0.5;
            this.circle.material.opacity = 0.1 + flash * 0.3;
            this.ring.material.opacity = 0.3 + flash * 0.5;
        } else if (!this.hasExploded) {
            this.hasExploded = true;
            this.isActive = true;
            
            this.particleSystem.emit({
                position: { x: this.position.x, y: 0.5, z: this.position.z },
                velocity: { x: 0, y: 8, z: 0 },
                color: { r: 1, g: 0.4, b: 0 },
                count: 60, spread: this.radius * 0.8, size: 2, lifetime: 0.6, gravity: 10
            });
            
            this.circle.material.color.setHex(0xff0000);
            this.ring.material.color.setHex(0xff0000);
            
            setTimeout(() => {
                this.isActive = false;
                this.circle.material.opacity = 0.1;
                this.ring.material.opacity = 0.2;
            }, 200);
        }
    }
    
    checkPlayerCollision(playerPosition) {
        if (!this.isActive) return 0;
        
        const dist = new THREE.Vector2(playerPosition.x - this.position.x, playerPosition.z - this.position.z).length();
        if (dist < this.radius) {
            this.isActive = false;
            return this.damage * (1 - dist / this.radius);
        }
        return 0;
    }
    
    checkEnemyCollision(enemyPosition) {
        if (!this.isActive) return 0;
        
        const dist = new THREE.Vector2(enemyPosition.x - this.position.x, enemyPosition.z - this.position.z).length();
        if (dist < this.radius) {
            return this.damage * (1 - dist / this.radius);
        }
        return 0;
    }
    
    destroy() {
        this.scene.remove(this.group);
    }
}

class PulsingOrb {
    constructor(scene, particleSystem, x, z) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.position = new THREE.Vector3(x, 1.5, z);
        this.radius = 3;
        this.damage = 10;
        this.lifetime = 8;
        this.age = 0;
        this.isActive = true;
        this.isExpired = false;
        this.damageCooldown = new Map();
        this.pulsePhase = 0;
        
        this.createOrb();
    }
    
    createOrb() {
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        const coreGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const orbTexture = getTexture('hazard_orb');
        const coreMaterial = new THREE.MeshBasicMaterial({
            map: orbTexture,
            color: 0x00ffff,
            transparent: true,
            opacity: 0.9
        });
        this.core = new THREE.Mesh(coreGeometry, coreMaterial);
        this.group.add(this.core);
        
        const outerGeometry = new THREE.SphereGeometry(this.radius, 16, 16);
        const outerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.1,
            wireframe: true
        });
        this.outer = new THREE.Mesh(outerGeometry, outerMaterial);
        this.group.add(this.outer);
        
        const light = new THREE.PointLight(0x00ffff, 1, 10);
        this.group.add(light);
        this.light = light;
        
        this.scene.add(this.group);
    }
    
    update(deltaTime, gameTime) {
        this.age += deltaTime;
        
        if (this.age >= this.lifetime) {
            this.isExpired = true;
            return;
        }
        
        this.pulsePhase += deltaTime * 3;
        const pulse = Math.sin(this.pulsePhase) * 0.5 + 0.5;
        
        this.core.scale.setScalar(0.8 + pulse * 0.4);
        this.outer.scale.setScalar(0.9 + pulse * 0.2);
        this.outer.material.opacity = 0.05 + pulse * 0.15;
        this.light.intensity = 0.5 + pulse;
        
        this.group.position.y = 1.5 + Math.sin(this.age * 2) * 0.3;
        this.group.rotation.y += deltaTime;
        
        if (Math.random() < 0.1) {
            const angle = Math.random() * Math.PI * 2;
            const dist = this.radius * Math.random();
            this.particleSystem.emit({
                position: { 
                    x: this.position.x + Math.cos(angle) * dist, 
                    y: this.group.position.y, 
                    z: this.position.z + Math.sin(angle) * dist 
                },
                velocity: { x: 0, y: 1, z: 0 },
                color: { r: 0, g: 1, b: 1 },
                count: 1, spread: 0.1, size: 0.4, lifetime: 0.3, gravity: -1
            });
        }
    }
    
    checkPlayerCollision(playerPosition) {
        if (!this.isActive) return 0;
        
        const dist = this.position.distanceTo(playerPosition);
        if (dist < this.radius) {
            const now = Date.now();
            const lastDamage = this.damageCooldown.get('player') || 0;
            if (now - lastDamage > 300) {
                this.damageCooldown.set('player', now);
                return this.damage;
            }
        }
        return 0;
    }
    
    checkEnemyCollision(enemyPosition) {
        if (!this.isActive) return 0;
        
        const dist = this.position.distanceTo(enemyPosition);
        if (dist < this.radius) {
            const id = `${enemyPosition.x.toFixed(1)}_${enemyPosition.z.toFixed(1)}`;
            const now = Date.now();
            const lastDamage = this.damageCooldown.get(id) || 0;
            if (now - lastDamage > 300) {
                this.damageCooldown.set(id, now);
                return this.damage;
            }
        }
        return 0;
    }
    
    destroy() {
        this.scene.remove(this.group);
    }
}

class LavaPool {
    constructor(scene, particleSystem, x, z) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.position = new THREE.Vector3(x, 0, z);
        this.baseRadius = 2;
        this.maxRadius = 6;
        this.currentRadius = this.baseRadius;
        this.expandSpeed = 0.5;
        this.damage = 8;
        this.lifetime = 12;
        this.age = 0;
        this.isActive = true;
        this.isExpired = false;
        this.damageCooldown = new Map();
        
        const geometry = new THREE.CircleGeometry(1, 24);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff4400,
            transparent: true,
            opacity: 0.7
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.set(x, 0.02, z);
        this.mesh.scale.set(this.currentRadius, this.currentRadius, 1);
        this.scene.add(this.mesh);
    }
    
    update(deltaTime, gameTime) {
        this.age += deltaTime;
        
        if (this.age >= this.lifetime) {
            this.isExpired = true;
            return;
        }
        
        if (this.age < this.lifetime * 0.7 && this.currentRadius < this.maxRadius) {
            this.currentRadius = Math.min(this.maxRadius, this.currentRadius + this.expandSpeed * deltaTime);
            this.mesh.scale.set(this.currentRadius, this.currentRadius, 1);
        }
        
        if (this.age > this.lifetime * 0.7) {
            const fadeProgress = (this.age - this.lifetime * 0.7) / (this.lifetime * 0.3);
            this.mesh.material.opacity = 0.7 * (1 - fadeProgress);
        }
        
        if (Math.random() < 0.2) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * this.currentRadius * 0.8;
            this.particleSystem.emit({
                position: { 
                    x: this.position.x + Math.cos(angle) * dist, 
                    y: 0.1, 
                    z: this.position.z + Math.sin(angle) * dist 
                },
                velocity: { x: 0, y: 1.5, z: 0 },
                color: { r: 1, g: 0.4 + Math.random() * 0.3, b: 0 },
                count: 1, spread: 0.2, size: 0.5, lifetime: 0.5, gravity: 0
            });
        }
    }
    
    checkPlayerCollision(playerPosition) {
        const dist = Math.sqrt(
            Math.pow(playerPosition.x - this.position.x, 2) + 
            Math.pow(playerPosition.z - this.position.z, 2)
        );
        
        if (dist < this.currentRadius) {
            const now = Date.now();
            const lastDamage = this.damageCooldown.get('player') || 0;
            if (now - lastDamage > 400) {
                this.damageCooldown.set('player', now);
                return this.damage;
            }
        }
        return 0;
    }
    
    checkEnemyCollision(enemyPosition) {
        const dist = Math.sqrt(
            Math.pow(enemyPosition.x - this.position.x, 2) + 
            Math.pow(enemyPosition.z - this.position.z, 2)
        );
        
        if (dist < this.currentRadius) {
            const id = `${enemyPosition.x.toFixed(1)}_${enemyPosition.z.toFixed(1)}`;
            const now = Date.now();
            const lastDamage = this.damageCooldown.get(id) || 0;
            if (now - lastDamage > 400) {
                this.damageCooldown.set(id, now);
                return this.damage;
            }
        }
        return 0;
    }
    
    destroy() {
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

class SweepingBeam {
    constructor(scene, particleSystem, x, z) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.position = new THREE.Vector3(x, 0, z);
        this.length = 12;
        this.damage = 20;
        this.rotationSpeed = 1.5;
        this.angle = Math.random() * Math.PI * 2;
        this.lifetime = 10;
        this.warningTime = 1.5;
        this.age = 0;
        this.isActive = false;
        this.isExpired = false;
        this.damageCooldown = new Map();
        
        this.createBeam();
    }
    
    createBeam() {
        this.group = new THREE.Group();
        this.group.position.set(this.position.x, 0.5, this.position.z);
        
        const coreGeom = new THREE.SphereGeometry(0.6, 12, 12);
        const coreMat = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.8
        });
        this.core = new THREE.Mesh(coreGeom, coreMat);
        this.group.add(this.core);
        
        const beamGeom = new THREE.BoxGeometry(this.length, 0.3, 0.3);
        beamGeom.translate(this.length / 2, 0, 0);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            transparent: true,
            opacity: 0.3
        });
        this.beam = new THREE.Mesh(beamGeom, beamMat);
        this.group.add(this.beam);
        
        const light = new THREE.PointLight(0xff00ff, 1, 15);
        this.group.add(light);
        this.light = light;
        
        this.scene.add(this.group);
    }
    
    update(deltaTime, gameTime) {
        this.age += deltaTime;
        
        if (this.age >= this.lifetime) {
            this.isExpired = true;
            return;
        }
        
        if (this.age < this.warningTime) {
            const flash = Math.sin(this.age * 20) * 0.3 + 0.5;
            this.beam.material.opacity = flash * 0.3;
            this.core.material.opacity = flash;
        } else {
            this.isActive = true;
            this.beam.material.opacity = 0.7;
            this.beam.material.color.setHex(0xff0066);
            
            this.angle += this.rotationSpeed * deltaTime;
            this.group.rotation.y = this.angle;
            
            const pulse = Math.sin(this.age * 10) * 0.2 + 0.8;
            this.light.intensity = pulse * 2;
            
            if (Math.random() < 0.3) {
                const beamDist = Math.random() * this.length;
                const beamX = this.position.x + Math.cos(this.angle) * beamDist;
                const beamZ = this.position.z + Math.sin(this.angle) * beamDist;
                this.particleSystem.emit({
                    position: { x: beamX, y: 0.5, z: beamZ },
                    velocity: { x: 0, y: 1.5, z: 0 },
                    color: { r: 1, g: 0, b: 0.5 },
                    count: 1, spread: 0.2, size: 0.4, lifetime: 0.3, gravity: 0
                });
            }
        }
        
        if (this.age > this.lifetime - 1) {
            const fade = (this.lifetime - this.age);
            this.beam.material.opacity = 0.7 * fade;
            this.core.material.opacity = fade;
        }
    }
    
    checkPlayerCollision(playerPosition) {
        if (!this.isActive) return 0;
        
        const toPlayer = new THREE.Vector2(
            playerPosition.x - this.position.x,
            playerPosition.z - this.position.z
        );
        const beamDir = new THREE.Vector2(Math.cos(this.angle), Math.sin(this.angle));
        
        const dot = toPlayer.dot(beamDir);
        if (dot < 0 || dot > this.length) return 0;
        
        const perpDist = Math.abs(toPlayer.x * beamDir.y - toPlayer.y * beamDir.x);
        
        if (perpDist < 1) {
            const now = Date.now();
            const lastDamage = this.damageCooldown.get('player') || 0;
            if (now - lastDamage > 300) {
                this.damageCooldown.set('player', now);
                return this.damage;
            }
        }
        return 0;
    }
    
    checkEnemyCollision(enemyPosition) {
        if (!this.isActive) return 0;
        
        const toEnemy = new THREE.Vector2(
            enemyPosition.x - this.position.x,
            enemyPosition.z - this.position.z
        );
        const beamDir = new THREE.Vector2(Math.cos(this.angle), Math.sin(this.angle));
        
        const dot = toEnemy.dot(beamDir);
        if (dot < 0 || dot > this.length) return 0;
        
        const perpDist = Math.abs(toEnemy.x * beamDir.y - toEnemy.y * beamDir.x);
        
        if (perpDist < 1.5) {
            const id = `${enemyPosition.x.toFixed(1)}_${enemyPosition.z.toFixed(1)}`;
            const now = Date.now();
            const lastDamage = this.damageCooldown.get(id) || 0;
            if (now - lastDamage > 300) {
                this.damageCooldown.set(id, now);
                return this.damage;
            }
        }
        return 0;
    }
    
    destroy() {
        this.scene.remove(this.group);
    }
}
