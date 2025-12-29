import * as THREE from 'three';
import { getTexture } from './textures.js';

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
        this.isEvolved = false;
    }
    
    get isActive() { return this.level > 0; }
    get count() { return this.baseCount + Math.floor(this.level / 2) + (this.isEvolved ? 2 : 0); }
    get damage() { return (this.baseDamage + this.level * 8) * (this.isEvolved ? 2.5 : 1); }
    get radius() { return this.baseRadius + this.level * 0.3 + (this.isEvolved ? 1 : 0); }
    
    upgrade() {
        if (this.level >= 5 && !this.isEvolved) {
            this.isEvolved = true;
        } else {
            this.level++;
        }
        this.rebuildShields();
    }
    
    rebuildShields() {
        this.shields.forEach(s => this.scene.remove(s));
        this.shields = [];
        
        const shieldTexture = getTexture('shield');
        const count = this.count;
        const color = this.isEvolved ? 0xff00ff : 0x00ffff;
        
        for (let i = 0; i < count; i++) {
            const geometry = new THREE.SphereGeometry(this.isEvolved ? 0.6 : 0.4, 16, 16);
            const material = new THREE.MeshStandardMaterial({
                map: shieldTexture,
                color: color,
                emissive: color,
                emissiveIntensity: this.isEvolved ? 1.5 : 0.8,
                emissiveMap: shieldTexture,
                transparent: true,
                opacity: 0.9,
                roughness: 0.2,
                metalness: 0.8
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
        const rotationSpeed = this.rotationSpeed * (this.isEvolved ? 1.5 : 1);
        
        this.shields.forEach(shield => {
            shield.userData.angle += rotationSpeed * deltaTime;
            shield.position.x = playerPosition.x + Math.cos(shield.userData.angle) * radius;
            shield.position.z = playerPosition.z + Math.sin(shield.userData.angle) * radius;
            shield.position.y = 1;
            shield.rotation.x += deltaTime * (this.isEvolved ? 6 : 3);
            shield.rotation.y += deltaTime * (this.isEvolved ? 4 : 2);
            
            if (Math.random() < (this.isEvolved ? 0.3 : 0.1)) {
                this.particleSystem.emit({
                    position: { x: shield.position.x, y: shield.position.y, z: shield.position.z },
                    velocity: { x: 0, y: 1, z: 0 },
                    color: this.isEvolved ? { r: 1, g: 0, b: 1 } : { r: 0, g: 1, b: 1 },
                    count: 1, spread: 0.1, size: this.isEvolved ? 0.5 : 0.3, lifetime: 0.2, gravity: 0
                });
            }
            
            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                if (enemy.userData.phased) continue;
                
                const dist = shield.position.distanceTo(enemy.position);
                const hitRadius = (enemy.userData.isBoss ? 2.5 : 1.2) * (this.isEvolved ? 1.5 : 1);
                
                if (dist < hitRadius) {
                    const enemyId = enemy.uuid;
                    const lastHit = shield.userData.lastDamageTime[enemyId] || 0;
                    
                    if (gameTime - lastHit >= this.damageCooldown) {
                        shield.userData.lastDamageTime[enemyId] = gameTime;
                        
                        this.particleSystem.emit({
                            position: { x: shield.position.x, y: 1, z: shield.position.z },
                            velocity: { x: 0, y: 3, z: 0 },
                            color: this.isEvolved ? { r: 1, g: 0, b: 1 } : { r: 0, g: 1, b: 1 },
                            count: this.isEvolved ? 20 : 10, spread: 0.3, size: 0.6, lifetime: 0.3, gravity: 5
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
        this.isEvolved = false;
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
        this.isEvolved = false;
    }
    
    get isActive() { return this.level > 0; }
    get damage() { return (this.baseDamage + this.level * 20) * (this.isEvolved ? 2 : 1); }
    get radius() { return this.baseRadius + this.level * 1.5 + (this.isEvolved ? 4 : 0); }
    get cooldown() { return Math.max(this.isEvolved ? 1.0 : 1.5, this.baseCooldown - this.level * 0.4); }
    
    upgrade() {
        if (this.level >= 5 && !this.isEvolved) {
            this.isEvolved = true;
        } else {
            this.level++;
        }
    }
    
    update(gameTime, playerPosition, enemies, onHit) {
        if (!this.isActive) return;
        if (gameTime - this.lastFireTime < this.cooldown) return;
        
        this.lastFireTime = gameTime;
        
        const color = this.isEvolved ? { r: 1, g: 0.1, b: 0.5 } : { r: 1, g: 0.5, b: 0 };
        const shockColor = this.isEvolved ? 0xff0066 : 0xff6600;
        
        this.particleSystem.emit({
            position: { x: playerPosition.x, y: 1, z: playerPosition.z },
            velocity: { x: 0, y: 5, z: 0 },
            color: color,
            count: this.isEvolved ? 120 : 60, spread: this.isEvolved ? 3 : 1.5, size: this.isEvolved ? 3 : 2, lifetime: 0.6, gravity: 0
        });
        
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / (this.isEvolved ? 16 : 8)) {
            const dist = this.radius * 0.7;
            this.particleSystem.emit({
                position: { 
                    x: playerPosition.x + Math.cos(angle) * dist, 
                    y: 0.5, 
                    z: playerPosition.z + Math.sin(angle) * dist 
                },
                velocity: { x: Math.cos(angle) * (this.isEvolved ? 10 : 5), y: 3, z: Math.sin(angle) * (this.isEvolved ? 10 : 5) },
                color: this.isEvolved ? { r: 0.8, g: 0, b: 1 } : { r: 1, g: 0.3, b: 0 },
                count: this.isEvolved ? 8 : 5, spread: 0.3, size: 1.2, lifetime: 0.4, gravity: 5
            });
        }
        
        this.shockwaves.spawn(playerPosition.clone(), shockColor, this.radius);
        this.screenShake.addTrauma(this.isEvolved ? 0.6 : 0.3);
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
    
    reset() { this.level = 0; this.lastFireTime = -999; this.isEvolved = false; }
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
        this.isEvolved = false;
    }
    
    get isActive() { return this.level > 0; }
    get damage() { return (this.baseDamage + this.level * 10) * (this.isEvolved ? 1.5 : 1); }
    get chainCount() { return this.baseChainCount + Math.floor(this.level / 2) + (this.isEvolved ? 5 : 0); }
    get range() { return this.baseRange + this.level * 1 + (this.isEvolved ? 5 : 0); }
    get cooldown() { return Math.max(this.isEvolved ? 0.3 : 0.5, this.baseCooldown - this.level * 0.15); }
    
    upgrade() {
        if (this.level >= 5 && !this.isEvolved) {
            this.isEvolved = true;
        } else {
            this.level++;
        }
    }
    
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
            this.createBolt(previousPos, targetPos, chain === 0 ? (this.isEvolved ? 0xff00ff : 0x00ffff) : (this.isEvolved ? 0xff88ff : 0x88ffff));
            
            const damageMultiplier = 1 - chain * (this.isEvolved ? 0.05 : 0.15);
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
        this.isEvolved = false;
        this.lightningBolts.forEach(b => {
            this.scene.remove(b);
            b.geometry.dispose();
            b.material.dispose();
        });
        this.lightningBolts = [];
    }
}

export class Flamethrower {
    constructor(scene, particleSystem, audio) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.audio = audio;
        this.level = 0;
        this.baseDamage = 8;
        this.baseRange = 5;
        this.baseConeAngle = Math.PI / 4;
        this.tickRate = 0.1;
        this.lastTickTime = 0;
        this.burnDuration = 2;
        this.burnDamagePerSecond = 5;
        this.flameAngle = 0;
        this.burningEnemies = new Map();
        this.isEvolved = false;
        this.hazardSystem = null;
    }
    
    get isActive() { return this.level > 0; }
    get damage() { return (this.baseDamage + this.level * 4) * (this.isEvolved ? 1.5 : 1); }
    get range() { return this.baseRange + this.level * 0.8 + (this.isEvolved ? 3 : 0); }
    get coneAngle() { return this.baseConeAngle + this.level * 0.05 + (this.isEvolved ? Math.PI / 4 : 0); }
    get burnDPS() { return (this.burnDamagePerSecond + this.level * 2) * (this.isEvolved ? 3 : 1); }
    
    upgrade() {
        if (this.level >= 5 && !this.isEvolved) {
            this.isEvolved = true;
        } else {
            this.level++;
        }
    }
    
    update(deltaTime, gameTime, playerPosition, enemies, playerDirection, onHit, hazardSystem) {
        if (!this.isActive) return;
        
        const color = this.isEvolved ? { r: 0, g: 0.5, b: 1 } : { r: 1, g: 0.3, b: 0 };
        const secondaryColor = this.isEvolved ? { r: 0.3, g: 0.8, b: 1 } : { r: 1, g: 0.7, b: 0 };
        
        for (const [enemyId, burnData] of this.burningEnemies) {
            burnData.timer -= deltaTime;
            burnData.tickTimer -= deltaTime;
            
            if (burnData.tickTimer <= 0) {
                burnData.tickTimer = 0.5;
                const enemy = enemies.find(e => e.uuid === enemyId);
                if (enemy && onHit) {
                    const idx = enemies.indexOf(enemy);
                    onHit(enemy, idx, this.burnDPS * 0.5);
                    
                    this.particleSystem.emit({
                        position: { x: enemy.position.x, y: 1.5, z: enemy.position.z },
                        velocity: { x: 0, y: 2, z: 0 },
                        color: color,
                        count: 3, spread: 0.3, size: 0.5, lifetime: 0.3, gravity: -1
                    });
                }
            }
            
            if (burnData.timer <= 0) {
                this.burningEnemies.delete(enemyId);
            }
        }
        
        if (gameTime - this.lastTickTime < this.tickRate) return;
        this.lastTickTime = gameTime;
        
        this.flameAngle += deltaTime * 2;
        const baseAngle = Math.atan2(playerDirection.z, playerDirection.x);
        
        for (let i = 0; i < (this.isEvolved ? 15 : 8); i++) {
            const spreadAngle = baseAngle + (Math.random() - 0.5) * this.coneAngle;
            const dist = Math.random() * this.range;
            const x = playerPosition.x + Math.cos(spreadAngle) * dist;
            const z = playerPosition.z + Math.sin(spreadAngle) * dist;
            
            this.particleSystem.emit({
                position: { x, y: 0.8, z },
                velocity: { x: Math.cos(spreadAngle) * 4, y: 1.5 + Math.random(), z: Math.sin(spreadAngle) * 4 },
                color: Math.random() > 0.3 ? color : secondaryColor,
                count: 4, spread: 0.4, size: 1.2 + Math.random() * 0.8, lifetime: 0.5, gravity: -2
            });

            if (this.isEvolved && hazardSystem && Math.random() < 0.05) {
                hazardSystem.spawnFireTrail(new THREE.Vector3(x, 0, z), 1.5, 3);
            }
        }
        
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.userData.phased) continue;
            
            const toEnemy = new THREE.Vector3().subVectors(enemy.position, playerPosition);
            const dist = toEnemy.length();
            if (dist > this.range) continue;
            
            toEnemy.normalize();
            const angle = Math.abs(Math.atan2(toEnemy.z, toEnemy.x) - baseAngle);
            const normalizedAngle = Math.min(angle, Math.PI * 2 - angle);
            
            if (normalizedAngle <= this.coneAngle / 2) {
                if (onHit) onHit(enemy, i, this.damage);
                
                this.burningEnemies.set(enemy.uuid, {
                    timer: this.burnDuration,
                    tickTimer: 0.5
                });
            }
        }
    }
    
    reset() {
        this.level = 0;
        this.isEvolved = false;
        this.burningEnemies.clear();
    }
}

export class Boomerang {
    constructor(scene, particleSystem, audio) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.audio = audio;
        this.level = 0;
        this.baseDamage = 25;
        this.baseSpeed = 12;
        this.baseRange = 10;
        this.baseCooldown = 2;
        this.lastFireTime = -999;
        this.boomerangs = [];
        this.isEvolved = false;
    }
    
    get isActive() { return this.level > 0; }
    get damage() { return (this.baseDamage + this.level * 12) * (this.isEvolved ? 2 : 1); }
    get speed() { return this.baseSpeed + this.level * 1 + (this.isEvolved ? 5 : 0); }
    get range() { return this.baseRange + this.level * 2 + (this.isEvolved ? 5 : 0); }
    get cooldown() { return Math.max(this.isEvolved ? 0.4 : 0.8, this.baseCooldown - this.level * 0.2); }
    get count() { return 1 + Math.floor(this.level / 3) + (this.isEvolved ? 2 : 0); }
    
    upgrade() {
        if (this.level >= 5 && !this.isEvolved) {
            this.isEvolved = true;
        } else {
            this.level++;
        }
    }
    
    createBoomerang(position, direction) {
        const geometry = new THREE.TorusGeometry(this.isEvolved ? 0.6 : 0.4, 0.1, 8, 16);
        const color = this.isEvolved ? 0x00ffff : 0xffaa00;
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: this.isEvolved ? 1.0 : 0.6,
            metalness: 0.8,
            roughness: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.position.y = 1;
        mesh.rotation.x = Math.PI / 2;
        
        mesh.userData = {
            direction: direction.clone().normalize(),
            distanceTraveled: 0,
            returning: false,
            hitEnemies: new Set(),
            speed: this.speed,
            maxDistance: this.range,
            spin: 0
        };
        
        this.scene.add(mesh);
        this.boomerangs.push(mesh);
    }
    
    update(deltaTime, gameTime, playerPosition, enemies, gems, onHit, onGemCollect) {
        if (!this.isActive) return;
        
        for (let i = this.boomerangs.length - 1; i >= 0; i--) {
            const boom = this.boomerangs[i];
            const data = boom.userData;
            
            data.spin += deltaTime * (this.isEvolved ? 25 : 15);
            boom.rotation.z = data.spin;
            
            const moveDir = data.returning 
                ? new THREE.Vector3().subVectors(playerPosition, boom.position).normalize()
                : data.direction;
            
            const moveAmount = data.speed * deltaTime;
            boom.position.add(moveDir.clone().multiplyScalar(moveAmount));
            
            if (!data.returning) {
                data.distanceTraveled += moveAmount;
                if (data.distanceTraveled >= data.maxDistance) {
                    data.returning = true;
                    data.hitEnemies.clear();
                }
            }
            
            if (data.returning && boom.position.distanceTo(playerPosition) < 1.5) {
                this.scene.remove(boom);
                boom.geometry.dispose();
                boom.material.dispose();
                this.boomerangs.splice(i, 1);
                continue;
            }
            
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                if (enemy.userData.phased) continue;
                if (data.hitEnemies.has(enemy.uuid)) continue;
                
                const dist = boom.position.distanceTo(enemy.position);
                const hitRadius = (enemy.userData.isBoss ? 2.5 : 1.2) * (this.isEvolved ? 1.5 : 1);
                
                if (dist < hitRadius) {
                    data.hitEnemies.add(enemy.uuid);
                    if (onHit) onHit(enemy, j, this.damage);
                    
                    if (this.isEvolved) {
                        enemy.userData.frozenUntil = gameTime + 0.5;
                    }
                    
                    this.particleSystem.emit({
                        position: { x: boom.position.x, y: 1, z: boom.position.z },
                        velocity: { x: 0, y: 3, z: 0 },
                        color: this.isEvolved ? { r: 0.5, g: 1, b: 1 } : { r: 1, g: 0.6, b: 0 },
                        count: this.isEvolved ? 15 : 8, spread: 0.4, size: 0.6, lifetime: 0.3, gravity: 5
                    });
                }
            }
            
            if (data.returning && onGemCollect) {
                for (let j = gems.length - 1; j >= 0; j--) {
                    const gem = gems[j];
                    const dist = boom.position.distanceTo(gem.position);
                    if (dist < (this.isEvolved ? 4 : 2)) {
                        onGemCollect(gem, j);
                    }
                }
            }
            
            if (Math.random() < 0.3) {
                this.particleSystem.emit({
                    position: { x: boom.position.x, y: boom.position.y, z: boom.position.z },
                    velocity: { x: -moveDir.x * 2, y: 0.5, z: -moveDir.z * 2 },
                    color: this.isEvolved ? { r: 0, g: 1, b: 1 } : { r: 1, g: 0.5, b: 0 },
                    count: 1, spread: 0.1, size: 0.4, lifetime: 0.2, gravity: 0
                });
            }
        }
        
        if (gameTime - this.lastFireTime >= this.cooldown) {
            this.lastFireTime = gameTime;
            
            let nearest = null;
            let nearestDist = this.range * 2;
            for (const enemy of enemies) {
                if (enemy.userData.phased) continue;
                const dist = playerPosition.distanceTo(enemy.position);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearest = enemy;
                }
            }
            
            if (nearest) {
                const count = this.count;
                for (let c = 0; c < count; c++) {
                    const dir = new THREE.Vector3().subVectors(nearest.position, playerPosition);
                    dir.y = 0;
                    if (count > 1) {
                        const spreadAngle = (c - (count - 1) / 2) * (this.isEvolved ? 0.2 : 0.3);
                        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle);
                    }
                    this.createBoomerang(playerPosition, dir);
                }
                this.audio.playShoot();
            }
        }
    }
    
    reset() {
        this.level = 0;
        this.lastFireTime = -999;
        this.isEvolved = false;
        this.boomerangs.forEach(b => {
            this.scene.remove(b);
            b.geometry.dispose();
            b.material.dispose();
        });
        this.boomerangs = [];
    }
}

export class OrbitalLaser {
    constructor(scene, particleSystem, audio) {
        this.scene = scene;
        this.particleSystem = particleSystem;
        this.audio = audio;
        this.level = 0;
        this.baseDamage = 15;
        this.baseLength = 8;
        this.rotationSpeed = 1.5;
        this.angle = 0;
        this.tickRate = 0.1;
        this.lastTickTime = 0;
        this.beams = [];
        this.beamMeshes = [];
        this.isEvolved = false;
    }
    
    get isActive() { return this.level > 0; }
    get damage() { return (this.baseDamage + this.level * 8) * (this.isEvolved ? 2 : 1); }
    get length() { return this.baseLength + this.level * 1.5 + (this.isEvolved ? 5 : 0); }
    get beamCount() { return 1 + Math.floor(this.level / 2) + (this.isEvolved ? 1 : 0); }
    get speed() { return (this.rotationSpeed + this.level * 0.2) * (this.isEvolved ? 1.5 : 1); }
    
    upgrade() {
        if (this.level >= 5 && !this.isEvolved) {
            this.isEvolved = true;
        } else {
            this.level++;
        }
        this.rebuildBeams();
    }
    
    rebuildBeams() {
        this.beamMeshes.forEach(m => {
            this.scene.remove(m);
            m.geometry.dispose();
            m.material.dispose();
        });
        this.beamMeshes = [];
        
        const count = this.beamCount;
        for (let i = 0; i < count; i++) {
            const geometry = new THREE.CylinderGeometry(this.isEvolved ? 0.3 : 0.15, this.isEvolved ? 0.3 : 0.15, this.length, 8);
            geometry.rotateZ(Math.PI / 2);
            geometry.translate(this.length / 2, 0, 0);
            
            const color = this.isEvolved ? 0x00ffaa : 0xff0066;
            const material = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: this.isEvolved ? 2 : 1,
                transparent: true,
                opacity: 0.8
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.userData = { baseAngle: (Math.PI * 2 / count) * i };
            mesh.position.y = 0.8;
            this.beamMeshes.push(mesh);
            this.scene.add(mesh);
        }
    }
    
    update(deltaTime, gameTime, playerPosition, enemies, onHit) {
        if (!this.isActive) return;
        
        this.angle += this.speed * deltaTime;
        
        this.beamMeshes.forEach((mesh, idx) => {
            mesh.position.x = playerPosition.x;
            mesh.position.z = playerPosition.z;
            mesh.rotation.y = this.angle + mesh.userData.baseAngle;
            
            const pulseIntensity = (this.isEvolved ? 1.5 : 0.7) + Math.sin(gameTime * 10 + idx) * 0.3;
            mesh.material.emissiveIntensity = pulseIntensity;
        });
        
        if (gameTime - this.lastTickTime < this.tickRate) return;
        this.lastTickTime = gameTime;
        
        this.beamMeshes.forEach(mesh => {
            const beamAngle = this.angle + mesh.userData.baseAngle;
            const beamDir = new THREE.Vector3(Math.cos(beamAngle), 0, Math.sin(beamAngle));
            
            for (let d = 1; d < this.length; d += 2) {
                if (Math.random() < 0.3) {
                    const x = playerPosition.x + beamDir.x * d;
                    const z = playerPosition.z + beamDir.z * d;
                    this.particleSystem.emit({
                        position: { x, y: 0.8, z },
                        velocity: { x: 0, y: 2, z: 0 },
                        color: this.isEvolved ? { r: 0, g: 1, b: 0.7 } : { r: 1, g: 0, b: 0.4 },
                        count: 1, spread: 0.2, size: 0.4, lifetime: 0.2, gravity: 0
                    });
                }
            }
            
            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                if (enemy.userData.phased) continue;
                
                const toEnemy = new THREE.Vector3().subVectors(enemy.position, playerPosition);
                toEnemy.y = 0;
                const dist = toEnemy.length();
                
                if (dist > this.length) continue;
                
                toEnemy.normalize();
                const dot = toEnemy.dot(beamDir);
                const perpDist = Math.sqrt(Math.max(0, 1 - dot * dot)) * dist;
                
                const hitRadius = (enemy.userData.isBoss ? 2.5 : 1.2) * (this.isEvolved ? 1.4 : 1);
                if (dot > 0 && perpDist < hitRadius + (this.isEvolved ? 0.8 : 0.3)) {
                    if (onHit) onHit(enemy, i, this.damage);
                    
                    if (this.isEvolved) {
                        const pullDir = new THREE.Vector3().subVectors(mesh.position.clone().add(beamDir.clone().multiplyScalar(dist)), enemy.position).normalize();
                        enemy.position.add(pullDir.multiplyScalar(5 * deltaTime));
                    }
                    
                    this.particleSystem.emit({
                        position: { x: enemy.position.x, y: 1, z: enemy.position.z },
                        velocity: { x: 0, y: 2, z: 0 },
                        color: this.isEvolved ? { r: 0, g: 1, b: 0.7 } : { r: 1, g: 0, b: 0.4 },
                        count: 5, spread: 0.3, size: 0.5, lifetime: 0.2, gravity: 3
                    });
                }
            }
        });
    }
    
    reset() {
        this.level = 0;
        this.angle = 0;
        this.isEvolved = false;
        this.beamMeshes.forEach(m => {
            this.scene.remove(m);
            m.geometry.dispose();
            m.material.dispose();
        });
        this.beamMeshes = [];
    }
}

export class WeaponSystem {
    constructor(scene, particleSystem, shockwaves, screenShake, audio) {
        this.orbitingShields = new OrbitingShields(scene, particleSystem);
        this.areaNova = new AreaNova(scene, particleSystem, shockwaves, screenShake, audio);
        this.chainLightning = new ChainLightning(scene, particleSystem, audio);
        this.flamethrower = new Flamethrower(scene, particleSystem, audio);
        this.boomerang = new Boomerang(scene, particleSystem, audio);
        this.orbitalLaser = new OrbitalLaser(scene, particleSystem, audio);
    }
    
    update(deltaTime, gameTime, playerPosition, enemies, onHit, playerDirection, gems, onGemCollect) {
        this.orbitingShields.update(deltaTime, playerPosition, enemies, gameTime, onHit);
        this.areaNova.update(gameTime, playerPosition, enemies, onHit);
        this.chainLightning.update(deltaTime, gameTime, playerPosition, enemies, onHit);
        this.flamethrower.update(deltaTime, gameTime, playerPosition, enemies, playerDirection || new THREE.Vector3(1, 0, 0), onHit);
        this.boomerang.update(deltaTime, gameTime, playerPosition, enemies, gems || [], onHit, onGemCollect);
        this.orbitalLaser.update(deltaTime, gameTime, playerPosition, enemies, onHit);
    }
    
    reset() {
        this.orbitingShields.reset();
        this.areaNova.reset();
        this.chainLightning.reset();
        this.flamethrower.reset();
        this.boomerang.reset();
        this.orbitalLaser.reset();
    }
}
