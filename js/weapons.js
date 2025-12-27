import * as THREE from 'three';

export class OrbitingShields {
    constructor(scene, particleSystem) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.shields = [];
        this.level = 0;
        this.baseCount = 2;
        this.baseDamage = 15;
        this.baseRadius = 2.5;
        this.rotationSpeed = 2;
        this.damageCooldown = 0.3;
    }
    
    get isActive() { return this.level > 0; }
    get count() { return this.baseCount + Math.floor(this.level / 2); }
    get damage() { return this.baseDamage + this.level * 8; }
    get radius() { return this.baseRadius + this.level * 0.3; }
    
    upgrade() {
        this.level++;
        this.rebuildShields();
    }
    
    rebuildShields() {
        this.shields.forEach(s => this.scene.remove(s));
        this.shields = [];
        
        const count = this.count;
        for (let i = 0; i < count; i++) {
            const geometry = new THREE.SphereGeometry(0.4, 16, 16);
            const material = new THREE.MeshStandardMaterial({
                color: 0x00ffff,
                emissive: 0x00ffff,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.9
            });
            const shield = new THREE.Mesh(geometry, material);
            shield.userData = {
                angle: (Math.PI * 2 / count) * i,
                lastDamageTime: {}
            };
            this.shields.push(shield);
            this.scene.add(shield);
        }
    }
    
    update(deltaTime, playerPosition, enemies, gameTime, onHit) {
        if (!this.isActive) return;
        
        const radius = this.radius;
        this.shields.forEach(shield => {
            shield.userData.angle += this.rotationSpeed * deltaTime;
            shield.position.x = playerPosition.x + Math.cos(shield.userData.angle) * radius;
            shield.position.z = playerPosition.z + Math.sin(shield.userData.angle) * radius;
            shield.position.y = 1;
            shield.rotation.x += deltaTime * 3;
            shield.rotation.y += deltaTime * 2;
            
            if (Math.random() < 0.1) {
                this.particleSystem.emit({
                    position: { x: shield.position.x, y: shield.position.y, z: shield.position.z },
                    velocity: { x: 0, y: 1, z: 0 },
                    color: { r: 0, g: 1, b: 1 },
                    count: 1, spread: 0.1, size: 0.3, lifetime: 0.2, gravity: 0
                });
            }
            
            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                if (enemy.userData.phased) continue;
                
                const dist = shield.position.distanceTo(enemy.position);
                const hitRadius = enemy.userData.isBoss ? 2.5 : 1.2;
                
                if (dist < hitRadius) {
                    const enemyId = enemy.uuid;
                    const lastHit = shield.userData.lastDamageTime[enemyId] || 0;
                    
                    if (gameTime - lastHit >= this.damageCooldown) {
                        shield.userData.lastDamageTime[enemyId] = gameTime;
                        
                        this.particleSystem.emit({
                            position: { x: shield.position.x, y: 1, z: shield.position.z },
                            velocity: { x: 0, y: 3, z: 0 },
                            color: { r: 0, g: 1, b: 1 },
                            count: 10, spread: 0.3, size: 0.6, lifetime: 0.3, gravity: 5
                        });
                        
                        if (onHit) onHit(enemy, i, this.damage);
                    }
                }
            }
        });
    }
    
    reset() {
        this.shields.forEach(s => this.scene.remove(s));
        this.shields = [];
        this.level = 0;
    }
}

export class AreaNova {
    constructor(scene, particleSystem, shockwaves, screenShake, audio) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.shockwaves = shockwaves;
        this.screenShake = screenShake;
        this.audio = audio;
        this.level = 0;
        this.baseDamage = 40;
        this.baseRadius = 6;
        this.baseCooldown = 4;
        this.lastFireTime = -999;
    }
    
    get isActive() { return this.level > 0; }
    get damage() { return this.baseDamage + this.level * 20; }
    get radius() { return this.baseRadius + this.level * 1.5; }
    get cooldown() { return Math.max(1.5, this.baseCooldown - this.level * 0.4); }
    
    upgrade() { this.level++; }
    
    update(gameTime, playerPosition, enemies, onHit) {
        if (!this.isActive) return;
        if (gameTime - this.lastFireTime < this.cooldown) return;
        
        this.lastFireTime = gameTime;
        
        this.particleSystem.emit({
            position: { x: playerPosition.x, y: 1, z: playerPosition.z },
            velocity: { x: 0, y: 5, z: 0 },
            color: { r: 1, g: 0.5, b: 0 },
            count: 60, spread: 1.5, size: 2, lifetime: 0.5, gravity: 0
        });
        
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
            const dist = this.radius * 0.7;
            this.particleSystem.emit({
                position: { 
                    x: playerPosition.x + Math.cos(angle) * dist, 
                    y: 0.5, 
                    z: playerPosition.z + Math.sin(angle) * dist 
                },
                velocity: { x: Math.cos(angle) * 5, y: 3, z: Math.sin(angle) * 5 },
                color: { r: 1, g: 0.3, b: 0 },
                count: 5, spread: 0.3, size: 1.2, lifetime: 0.4, gravity: 5
            });
        }
        
        this.shockwaves.spawn(playerPosition.clone(), 0xff6600, this.radius);
        this.screenShake.addTrauma(0.3);
        this.audio.playExplosion();
        
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.userData.phased) continue;
            
            const dist = playerPosition.distanceTo(enemy.position);
            if (dist <= this.radius) {
                const damageMultiplier = 1 - (dist / this.radius) * 0.5;
                if (onHit) onHit(enemy, i, this.damage * damageMultiplier);
            }
        }
    }
    
    reset() { this.level = 0; this.lastFireTime = -999; }
}

export class ChainLightning {
    constructor(scene, particleSystem, audio) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.audio = audio;
        this.level = 0;
        this.baseDamage = 20;
        this.baseChainCount = 3;
        this.baseRange = 8;
        this.baseCooldown = 1.5;
        this.lastFireTime = -999;
        this.lightningBolts = [];
    }
    
    get isActive() { return this.level > 0; }
    get damage() { return this.baseDamage + this.level * 10; }
    get chainCount() { return this.baseChainCount + Math.floor(this.level / 2); }
    get range() { return this.baseRange + this.level * 1; }
    get cooldown() { return Math.max(0.5, this.baseCooldown - this.level * 0.15); }
    
    upgrade() { this.level++; }
    
    createBolt(start, end, color = 0x00ffff) {
        const points = [start.clone()];
        const segments = 8;
        const direction = end.clone().sub(start);
        const length = direction.length();
        direction.normalize();
        
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const point = start.clone().add(direction.clone().multiplyScalar(length * t));
            point.x += (Math.random() - 0.5) * 0.8;
            point.y += (Math.random() - 0.5) * 0.5;
            point.z += (Math.random() - 0.5) * 0.8;
            points.push(point);
        }
        points.push(end.clone());
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: color, 
            transparent: true, 
            opacity: 1,
            linewidth: 2
        });
        const bolt = new THREE.Line(geometry, material);
        bolt.userData = { lifetime: 0.15, maxLifetime: 0.15 };
        this.scene.add(bolt);
        this.lightningBolts.push(bolt);
        
        points.forEach((p, idx) => {
            if (idx % 2 === 0) {
                this.particleSystem.emit({
                    position: { x: p.x, y: p.y, z: p.z },
                    velocity: { x: 0, y: 1, z: 0 },
                    color: { r: 0.5, g: 1, b: 1 },
                    count: 2, spread: 0.2, size: 0.5, lifetime: 0.2, gravity: 0
                });
            }
        });
    }
    
    update(deltaTime, gameTime, playerPosition, enemies, onHit) {
        for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
            const bolt = this.lightningBolts[i];
            bolt.userData.lifetime -= deltaTime;
            bolt.material.opacity = bolt.userData.lifetime / bolt.userData.maxLifetime;
            
            if (bolt.userData.lifetime <= 0) {
                this.scene.remove(bolt);
                bolt.geometry.dispose();
                bolt.material.dispose();
                this.lightningBolts.splice(i, 1);
            }
        }
        
        if (!this.isActive) return;
        if (gameTime - this.lastFireTime < this.cooldown) return;
        if (enemies.length === 0) return;
        
        let nearest = null;
        let nearestDist = this.range;
        for (const enemy of enemies) {
            if (enemy.userData.phased) continue;
            const dist = playerPosition.distanceTo(enemy.position);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = enemy;
            }
        }
        
        if (!nearest) return;
        
        this.lastFireTime = gameTime;
        this.audio.playShoot();
        
        const hitEnemies = new Set();
        let currentTarget = nearest;
        let previousPos = playerPosition.clone();
        previousPos.y = 1;
        
        for (let chain = 0; chain < this.chainCount && currentTarget; chain++) {
            hitEnemies.add(currentTarget.uuid);
            
            const targetPos = currentTarget.position.clone();
            targetPos.y = 1;
            this.createBolt(previousPos, targetPos, chain === 0 ? 0x00ffff : 0x88ffff);
            
            const damageMultiplier = 1 - chain * 0.15;
            const idx = enemies.indexOf(currentTarget);
            if (idx !== -1 && onHit) {
                onHit(currentTarget, idx, this.damage * damageMultiplier);
            }
            
            this.particleSystem.emit({
                position: { x: targetPos.x, y: targetPos.y, z: targetPos.z },
                velocity: { x: 0, y: 3, z: 0 },
                color: { r: 0.5, g: 1, b: 1 },
                count: 15, spread: 0.5, size: 0.8, lifetime: 0.3, gravity: 3
            });
            
            previousPos = targetPos;
            
            let nextTarget = null;
            let nextDist = this.range * 0.8;
            for (const enemy of enemies) {
                if (hitEnemies.has(enemy.uuid)) continue;
                if (enemy.userData.phased) continue;
                const dist = currentTarget.position.distanceTo(enemy.position);
                if (dist < nextDist) {
                    nextDist = dist;
                    nextTarget = enemy;
                }
            }
            currentTarget = nextTarget;
        }
    }
    
    reset() {
        this.level = 0;
        this.lastFireTime = -999;
        this.lightningBolts.forEach(b => {
            this.scene.remove(b);
            b.geometry.dispose();
            b.material.dispose();
        });
        this.lightningBolts = [];
    }
}

export class WeaponSystem {
    constructor(scene, particleSystem, shockwaves, screenShake, audio) {
        this.orbitingShields = new OrbitingShields(scene, particleSystem);
        this.areaNova = new AreaNova(scene, particleSystem, shockwaves, screenShake, audio);
        this.chainLightning = new ChainLightning(scene, particleSystem, audio);
    }
    
    update(deltaTime, gameTime, playerPosition, enemies, onHit) {
        this.orbitingShields.update(deltaTime, playerPosition, enemies, gameTime, onHit);
        this.areaNova.update(gameTime, playerPosition, enemies, onHit);
        this.chainLightning.update(deltaTime, gameTime, playerPosition, enemies, onHit);
    }
    
    reset() {
        this.orbitingShields.reset();
        this.areaNova.reset();
        this.chainLightning.reset();
    }
}
