import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { audio, DynamicMusic } from './audio.js';
import { getTexture, getUpgradeIcon } from './textures.js';
import { ParticleSystem } from './particles.js';
import { ScreenShake, TimeController, DamageNumberSystem, ShockwaveSystem, ChromaticAberrationShader, ChromaticAberrationController, ScreenFlash, VignetteController } from './effects.js';
import { WeaponSystem } from './weapons.js';
import { HazardSystem } from './hazards.js';
import { PassiveSystem, passiveUpgrades } from './passives.js';
import { EnemyHealthBars, Minimap } from './ui.js';
import { MetaSystem } from './meta.js';
import { PowerupSystem } from './powerups.js';
import { TutorialSystem } from './tutorial.js';
import { MobileControls } from './mobile.js';

const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_UP: 'level_up',
    GAME_OVER: 'game_over'
};

let currentState = GameState.MENU;
let scene, camera, renderer, composer;
let player;
let enemies = [];
let projectiles = [];
let gems = [];
let clock;
let selectedCharacterId = 'default';

let particleSystem;
let screenShake;
let timeController;
let damageNumbers;
let shockwaves;
let weaponSystem;
let passiveSystem;
let healthBars;
let minimap;
let metaSystem;
let powerupSystem;
let hazardSystem;
let chromaticAberration;
let screenFlash;
let vignetteController;
let dynamicMusic;
let tutorialSystem;
let mobileControls;
let traderNPC = null;
let lastTraderSpawnTime = -999;
let banishedUpgrades = new Set();

let cameraTargetPosition = new THREE.Vector3();
let cameraBasePosition = new THREE.Vector3();
let playerDirection = new THREE.Vector3(1, 0, 0);

let playerStats = {
    health: 100,
    maxHealth: 100,
    speed: 8,
    exp: 0,
    expToLevel: 10,
    level: 1,
    damage: 30,
    attackSpeed: 1,
    attackRange: 15,
    projectileSpeed: 22,
    projectileCount: 1,
    killCount: 0,
    dashCharges: 1,
    maxDashCharges: 1,
    dashCooldown: 0,
    isDashing: false,
    dashTime: 0,
    dashDirection: new THREE.Vector3()
};

let comboCount = 0;
let comboTimer = 0;
const COMBO_TIMEOUT = 2;

const DASH_DURATION = 0.2;
const DASH_COOLDOWN = 3.0;
const DASH_SPEED_MULTIPLIER = 3.5;

const COMBO_THRESHOLDS = [
    { threshold: 5,  damageBonus: 0.10, speedBonus: 0,    gemBonus: 1.0, heal: 0,  color: '#ffff00', name: 'NICE' },
    { threshold: 10, damageBonus: 0.15, speedBonus: 0.05, gemBonus: 1.0, heal: 0,  color: '#ffaa00', name: 'GREAT' },
    { threshold: 25, damageBonus: 0.25, speedBonus: 0.10, gemBonus: 1.5, heal: 0,  color: '#ff6600', name: 'AMAZING' },
    { threshold: 50, damageBonus: 0.40, speedBonus: 0.15, gemBonus: 2.0, heal: 5,  color: '#ff00ff', name: 'UNSTOPPABLE' },
    { threshold: 100, damageBonus: 0.60, speedBonus: 0.20, gemBonus: 2.5, heal: 10, color: '#00ffff', name: 'GODLIKE' }
];

function getComboBonus() {
    let bonus = { damageMultiplier: 1, speedMultiplier: 1, gemMultiplier: 1, heal: 0, tier: null };
    for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
        if (comboCount >= COMBO_THRESHOLDS[i].threshold) {
            const t = COMBO_THRESHOLDS[i];
            bonus.damageMultiplier = 1 + t.damageBonus;
            bonus.speedMultiplier = 1 + t.speedBonus;
            bonus.gemMultiplier = t.gemBonus;
            bonus.heal = t.heal;
            bonus.tier = t;
            break;
        }
    }
    return bonus;
}

let gameTime = 0;
let lastAttackTime = 0;
let spawnInterval = 2;
let lastSpawnTime = 0;
let difficultyMultiplier = 1;
let currentDifficultyTier = 1;
let lastBossSpawnTime = -90;
let enemyProjectiles = [];

const MAX_ENEMIES = 60;

const miniBossSchedule = [
    { type: 'miniboss_charger', firstSpawn: 45, interval: 120, warning: 'CHARGER APPROACHES!', lastSpawn: -999 },
    { type: 'miniboss_summoner', firstSpawn: 135, interval: 150, warning: 'SUMMONER AWAKENS!', lastSpawn: -999 },
    { type: 'miniboss_splitter_king', firstSpawn: 225, interval: 180, warning: 'SPLITTER KING EMERGES!', lastSpawn: -999 }
];

const runTimeline = {
    events: [],
    
    clear() {
        this.events = [];
    },
    
    addEvent(type, data) {
        this.events.push({
            time: gameTime,
            type,
            ...data
        });
    },
    
    recordLevelUp(level) {
        this.addEvent('levelup', { level });
    },
    
    recordBossKill(bossType) {
        this.addEvent('bosskill', { bossType });
    },
    
    recordDamageTaken(amount, source) {
        this.addEvent('damage', { amount, source });
    },
    
    recordUpgradeChosen(upgradeName) {
        this.addEvent('upgrade', { upgradeName });
    },
    
    recordMilestone(description) {
        this.addEvent('milestone', { description });
    },
    
    getRecap() {
        const keyEvents = [];
        
        const levelUps = this.events.filter(e => e.type === 'levelup');
        const bossKills = this.events.filter(e => e.type === 'bosskill');
        const upgrades = this.events.filter(e => e.type === 'upgrade');
        const bigHits = this.events.filter(e => e.type === 'damage' && e.amount > 20)
            .sort((a, b) => b.amount - a.amount).slice(0, 3);
        
        levelUps.forEach(e => keyEvents.push({ ...e, icon: '⬆', color: '#ffff00' }));
        bossKills.forEach(e => keyEvents.push({ ...e, icon: '💀', color: '#ff4400' }));
        upgrades.slice(0, 5).forEach(e => keyEvents.push({ ...e, icon: '✦', color: '#00ffff' }));
        bigHits.forEach(e => keyEvents.push({ ...e, icon: '💔', color: '#ff0000' }));
        
        return keyEvents.sort((a, b) => a.time - b.time);
    }
};

const keys = {};

const AssetCache = {
    geometries: {},
    materials: {},
    
    getEnemyGeometry(typeName, type) {
        if (!this.geometries[typeName]) {
            this.geometries[typeName] = type.geometry();
        }
        return this.geometries[typeName];
    },
    
    getEnemyMaterial(typeName, type) {
        if (!this.materials[typeName]) {
            const enemyTexture = getTexture('enemy_' + typeName);
            this.materials[typeName] = new THREE.MeshStandardMaterial({
                map: enemyTexture,
                color: type.color,
                emissive: type.emissive,
                emissiveIntensity: type.isElite ? 1.2 : (type.isBoss ? 1.5 : 0.8),
                emissiveMap: enemyTexture,
                transparent: type.transparent || false,
                opacity: type.transparent ? 0.7 : 1,
                roughness: 0.3,
                metalness: 0.5
            });
        }
        return this.materials[typeName];
    },
    
    eliteRingGeometry: null,
    bossRingGeometry: null,
    eliteRingMaterial: null,
    bossRingMaterial: null,
    
    getEliteRing(scale, isBoss) {
        if (isBoss) {
            if (!this.bossRingGeometry) {
                this.bossRingGeometry = new THREE.RingGeometry(0.8, 1.0, 16);
                this.bossRingMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff0000, transparent: true, opacity: 0.8, side: THREE.DoubleSide
                });
            }
            return { geo: this.bossRingGeometry, mat: this.bossRingMaterial };
        } else {
            if (!this.eliteRingGeometry) {
                this.eliteRingGeometry = new THREE.RingGeometry(0.8, 1.0, 16);
                this.eliteRingMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffff00, transparent: true, opacity: 0.8, side: THREE.DoubleSide
                });
            }
            return { geo: this.eliteRingGeometry, mat: this.eliteRingMaterial };
        }
    }
};

const ProjectilePool = {
    playerPool: [],
    enemyPool: [],
    playerGeometry: null,
    playerMaterial: null,
    enemyGeometry: null,
    enemyMaterial: null,
    
    init() {
        this.playerGeometry = new THREE.SphereGeometry(0.25, 6, 6);
        this.playerMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.enemyGeometry = new THREE.SphereGeometry(0.2, 6, 6);
        this.enemyMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.9 });
    },
    
    getPlayerProjectile() {
        let proj = this.playerPool.pop();
        if (!proj) {
            proj = new THREE.Mesh(this.playerGeometry, this.playerMaterial);
        }
        proj.visible = true;
        return proj;
    },
    
    returnPlayerProjectile(proj) {
        proj.visible = false;
        this.playerPool.push(proj);
    },
    
    getEnemyProjectile() {
        let proj = this.enemyPool.pop();
        if (!proj) {
            proj = new THREE.Mesh(this.enemyGeometry, this.enemyMaterial);
        }
        proj.visible = true;
        return proj;
    },
    
    returnEnemyProjectile(proj) {
        proj.visible = false;
        this.enemyPool.push(proj);
    }
};

const GemPool = {
    pool: [],
    geometry: null,
    material: null,
    
    init() {
        this.geometry = new THREE.OctahedronGeometry(0.3, 0);
        this.material = new THREE.MeshStandardMaterial({
            color: 0x00ff88,
            emissive: 0x00ff88,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.9,
            roughness: 0.2,
            metalness: 0.8
        });
    },
    
    get() {
        let gem = this.pool.pop();
        if (!gem) {
            gem = new THREE.Mesh(this.geometry, this.material);
        }
        gem.visible = true;
        return gem;
    },
    
    return(gem) {
        gem.visible = false;
        this.pool.push(gem);
    }
};

const WorldSystem = {
    tiles: [],
    props: [],
    tileSize: 100,
    currentChunkX: 0,
    currentChunkZ: 0,
    groundGeometry: null,
    groundMaterial: null,
    propGeometries: {},
    propMaterials: {},
    
    init(scene, getTexture) {
        this.scene = scene;
        
        this.groundGeometry = new THREE.PlaneGeometry(this.tileSize, this.tileSize);
        this.groundMaterial = new THREE.MeshStandardMaterial({
            map: getTexture('ground'),
            roughness: 0.7,
            metalness: 0.2,
            emissive: 0x004455,
            emissiveIntensity: 0.8
        });
        
        this.propGeometries = {
            pillar: new THREE.CylinderGeometry(0.8, 1.2, 6, 8),
            spire: new THREE.ConeGeometry(1.5, 8, 6),
            rock: new THREE.DodecahedronGeometry(1.5, 0),
            crystal: new THREE.OctahedronGeometry(1.2, 0)
        };
        
        this.propMaterials = {
            pillar: new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.9, metalness: 0.1, emissive: 0x112233, emissiveIntensity: 0.3 }),
            spire: new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.8, metalness: 0.2, emissive: 0x001122, emissiveIntensity: 0.2 }),
            rock: new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 1.0, metalness: 0.0, emissive: 0x112244, emissiveIntensity: 0.2 }),
            crystal: new THREE.MeshStandardMaterial({ color: 0x66ffff, roughness: 0.2, metalness: 0.8, emissive: 0x00ffff, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 })
        };
        
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                this.createTile(dx, dz);
            }
        }
    },
    
    createTile(chunkX, chunkZ) {
        const tile = new THREE.Mesh(this.groundGeometry, this.groundMaterial);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(chunkX * this.tileSize, 0, chunkZ * this.tileSize);
        tile.receiveShadow = true;
        tile.userData = { chunkX, chunkZ };
        this.scene.add(tile);
        this.tiles.push(tile);
        
        this.generatePropsForTile(chunkX, chunkZ);
    },
    
    generatePropsForTile(chunkX, chunkZ) {
        const seed = chunkX * 1000 + chunkZ;
        const random = this.seededRandom(seed);
        
        const propCount = 3 + Math.floor(random() * 5);
        const centerX = chunkX * this.tileSize;
        const centerZ = chunkZ * this.tileSize;
        
        for (let i = 0; i < propCount; i++) {
            const propTypes = ['pillar', 'spire', 'rock', 'crystal'];
            const weights = [0.35, 0.25, 0.3, 0.1];
            let r = random();
            let typeIndex = 0;
            for (let j = 0; j < weights.length; j++) {
                r -= weights[j];
                if (r <= 0) { typeIndex = j; break; }
            }
            const propType = propTypes[typeIndex];
            
            const x = centerX + (random() - 0.5) * (this.tileSize - 10);
            const z = centerZ + (random() - 0.5) * (this.tileSize - 10);
            
            if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
            
            const prop = new THREE.Mesh(this.propGeometries[propType], this.propMaterials[propType]);
            const scale = 0.6 + random() * 0.8;
            prop.scale.set(scale, scale, scale);
            prop.position.set(x, prop.geometry.parameters.height ? prop.geometry.parameters.height * scale / 2 : scale * 1.5, z);
            prop.rotation.y = random() * Math.PI * 2;
            prop.castShadow = true;
            prop.userData = { chunkX, chunkZ, propType };
            this.scene.add(prop);
            this.props.push(prop);
        }
    },
    
    seededRandom(seed) {
        let s = seed;
        return function() {
            s = (s * 9301 + 49297) % 233280;
            return s / 233280;
        };
    },
    
    update(playerPos) {
        const newChunkX = Math.floor(playerPos.x / this.tileSize + 0.5);
        const newChunkZ = Math.floor(playerPos.z / this.tileSize + 0.5);
        
        if (newChunkX !== this.currentChunkX || newChunkZ !== this.currentChunkZ) {
            this.shiftTiles(newChunkX, newChunkZ);
            this.currentChunkX = newChunkX;
            this.currentChunkZ = newChunkZ;
        }
    },
    
    shiftTiles(newChunkX, newChunkZ) {
        const tilesToRemove = [];
        const chunksNeeded = new Set();
        
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                chunksNeeded.add(`${newChunkX + dx},${newChunkZ + dz}`);
            }
        }
        
        const existingChunks = new Set();
        this.tiles.forEach(tile => {
            const key = `${tile.userData.chunkX},${tile.userData.chunkZ}`;
            if (!chunksNeeded.has(key)) {
                tilesToRemove.push(tile);
            } else {
                existingChunks.add(key);
            }
        });
        
        tilesToRemove.forEach(tile => {
            this.scene.remove(tile);
            this.tiles.splice(this.tiles.indexOf(tile), 1);
            
            const propsToRemove = this.props.filter(p => 
                p.userData.chunkX === tile.userData.chunkX && 
                p.userData.chunkZ === tile.userData.chunkZ
            );
            propsToRemove.forEach(prop => {
                this.scene.remove(prop);
                this.props.splice(this.props.indexOf(prop), 1);
            });
        });
        
        chunksNeeded.forEach(key => {
            if (!existingChunks.has(key)) {
                const [cx, cz] = key.split(',').map(Number);
                this.createTile(cx, cz);
            }
        });
    },
    
    reset() {
        this.tiles.forEach(tile => this.scene.remove(tile));
        this.props.forEach(prop => this.scene.remove(prop));
        this.tiles = [];
        this.props = [];
        this.currentChunkX = 0;
        this.currentChunkZ = 0;
        
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                this.createTile(dx, dz);
            }
        }
    }
};

const difficultyTiers = [
    { time: 0, name: 'I', enemies: ['basic', 'fast'] },
    { time: 60, name: 'II', enemies: ['basic', 'fast', 'zigzag'] },
    { time: 120, name: 'III', enemies: ['basic', 'fast', 'zigzag', 'tank', 'bomber'] },
    { time: 180, name: 'IV', enemies: ['basic', 'fast', 'zigzag', 'tank', 'bomber', 'exploder', 'vampire'] },
    { time: 270, name: 'V', enemies: ['basic', 'fast', 'tank', 'exploder', 'splitter', 'vampire', 'shielder'] },
    { time: 360, name: 'VI', enemies: ['basic', 'fast', 'tank', 'exploder', 'splitter', 'shooter', 'shielder', 'magnet'] },
    { time: 450, name: 'VII', enemies: ['fast', 'tank', 'splitter', 'shooter', 'ghost', 'magnet', 'berserker', 'freezer'] },
    { time: 540, name: 'VIII', enemies: ['tank', 'splitter', 'shooter', 'ghost', 'teleporter', 'berserker', 'swarm_mother', 'mirror'] },
    { time: 660, name: 'IX', enemies: ['elite_basic', 'elite_fast', 'splitter', 'shooter', 'ghost', 'teleporter', 'swarm_mother', 'berserker'] },
    { time: 780, name: 'X', enemies: ['elite_basic', 'elite_fast', 'teleporter', 'swarm_mother', 'berserker', 'freezer', 'mirror', 'vampire'] }
];

const enemyTypes = {
    basic: {
        geometry: () => new THREE.BoxGeometry(0.8, 0.8, 0.8),
        color: 0xff4444, emissive: 0xff2222,
        health: 30, speed: 3, damage: 10, scale: 1, weight: 40,
        gemCount: () => Math.ceil(Math.random() * 2),
        deathParticles: { color: { r: 1, g: 0.3, b: 0.3 }, count: 30 }
    },
    fast: {
        geometry: () => new THREE.ConeGeometry(0.4, 1, 8),
        color: 0xff00ff, emissive: 0xdd00dd,
        health: 15, speed: 7, damage: 5, scale: 0.8, weight: 25,
        gemCount: () => 1,
        deathParticles: { color: { r: 1, g: 0.3, b: 1 }, count: 20 }
    },
    tank: {
        geometry: () => new THREE.SphereGeometry(0.7, 16, 16),
        color: 0x44ff88, emissive: 0x22dd66,
        health: 100, speed: 1.5, damage: 25, scale: 1.5, weight: 15,
        gemCount: () => Math.ceil(Math.random() * 3) + 2,
        deathParticles: { color: { r: 0.3, g: 1, b: 0.5 }, count: 50 }
    },
    exploder: {
        geometry: () => new THREE.DodecahedronGeometry(0.5, 0),
        color: 0xff8800, emissive: 0xffaa00,
        health: 25, speed: 4, damage: 8, scale: 1, weight: 20,
        explosionRadius: 4, explosionDamage: 30,
        gemCount: () => Math.ceil(Math.random() * 2),
        deathParticles: { color: { r: 1, g: 0.6, b: 0 }, count: 60, size: 2.5 }
    },
    splitter: {
        geometry: () => new THREE.IcosahedronGeometry(0.6, 0),
        color: 0x00ffff, emissive: 0x00dddd,
        health: 40, speed: 2.5, damage: 12, scale: 1.2, weight: 15,
        splitCount: 3,
        gemCount: () => 1,
        deathParticles: { color: { r: 0.3, g: 1, b: 1 }, count: 25 }
    },
    splitter_child: {
        geometry: () => new THREE.IcosahedronGeometry(0.3, 0),
        color: 0x66ffff, emissive: 0x44dddd,
        health: 15, speed: 5, damage: 5, scale: 0.6, weight: 0,
        gemCount: () => 1,
        deathParticles: { color: { r: 0.5, g: 1, b: 1 }, count: 15 }
    },
    shooter: {
        geometry: () => new THREE.OctahedronGeometry(0.5, 0),
        color: 0xffff00, emissive: 0xdddd00,
        health: 35, speed: 2, damage: 5, scale: 1, weight: 15,
        shootRange: 15, shootCooldown: 2, projectileDamage: 15,
        gemCount: () => Math.ceil(Math.random() * 2) + 1,
        deathParticles: { color: { r: 1, g: 1, b: 0.3 }, count: 35 }
    },
    ghost: {
        geometry: () => new THREE.TetrahedronGeometry(0.6, 0),
        color: 0xffffff, emissive: 0xddddff,
        health: 20, speed: 4, damage: 15, scale: 1, weight: 10,
        transparent: true, phaseInterval: 1.5,
        gemCount: () => Math.ceil(Math.random() * 2),
        deathParticles: { color: { r: 1, g: 1, b: 1 }, count: 25 }
    },
    teleporter: {
        geometry: () => new THREE.TorusGeometry(0.4, 0.15, 8, 16),
        color: 0xff44ff, emissive: 0xff00ff,
        health: 30, speed: 3, damage: 20, scale: 1, weight: 10,
        teleportCooldown: 3, teleportRange: 8,
        gemCount: () => Math.ceil(Math.random() * 3),
        deathParticles: { color: { r: 1, g: 0.3, b: 1 }, count: 40 }
    },
    elite_basic: {
        geometry: () => new THREE.BoxGeometry(1, 1, 1),
        color: 0xffaa00, emissive: 0xff8800,
        health: 150, speed: 4, damage: 20, scale: 1.3, weight: 20,
        isElite: true,
        gemCount: () => Math.ceil(Math.random() * 3) + 2,
        deathParticles: { color: { r: 1, g: 0.8, b: 0.2 }, count: 60 }
    },
    elite_fast: {
        geometry: () => new THREE.ConeGeometry(0.5, 1.2, 8),
        color: 0xff88ff, emissive: 0xff44ff,
        health: 50, speed: 10, damage: 12, scale: 1, weight: 15,
        isElite: true,
        gemCount: () => Math.ceil(Math.random() * 2) + 1,
        deathParticles: { color: { r: 1, g: 0.5, b: 1 }, count: 40 }
    },
    boss: {
        geometry: () => new THREE.BoxGeometry(1.5, 1.5, 1.5),
        color: 0xff2200, emissive: 0xff4400,
        health: 500, speed: 2, damage: 40, scale: 2.5, weight: 0,
        isBoss: true,
        gemCount: () => 10 + Math.floor(Math.random() * 10),
        deathParticles: { color: { r: 1, g: 0.3, b: 0.1 }, count: 150, size: 3 }
    },
    miniboss_charger: {
        geometry: () => new THREE.ConeGeometry(0.8, 1.5, 6),
        color: 0xff4400, emissive: 0xff6600,
        health: 200, speed: 2, damage: 25, scale: 1.8, weight: 0,
        isBoss: true,
        chargeSpeed: 15, chargeCooldown: 3, chargeDistance: 12,
        leavesFireTrail: true,
        gemCount: () => 8 + Math.floor(Math.random() * 5),
        deathParticles: { color: { r: 1, g: 0.4, b: 0 }, count: 100, size: 2 }
    },
    miniboss_summoner: {
        geometry: () => new THREE.OctahedronGeometry(0.8, 1),
        color: 0x8800ff, emissive: 0xaa44ff,
        health: 150, speed: 1.5, damage: 15, scale: 1.6, weight: 0,
        isBoss: true,
        summonCooldown: 4, summonCount: 2, teleportOnHit: true, teleportCooldown: 2, teleportRange: 8,
        gemCount: () => 8 + Math.floor(Math.random() * 5),
        deathParticles: { color: { r: 0.6, g: 0, b: 1 }, count: 100, size: 2 }
    },
    miniboss_splitter_king: {
        geometry: () => new THREE.IcosahedronGeometry(1, 1),
        color: 0x00ffaa, emissive: 0x00ddaa,
        health: 300, speed: 2, damage: 30, scale: 2.2, weight: 0,
        isBoss: true,
        splitCount: 4, splitsIntoElites: true,
        gemCount: () => 12 + Math.floor(Math.random() * 8),
        deathParticles: { color: { r: 0, g: 1, b: 0.7 }, count: 120, size: 2.5 }
    },
    zigzag: {
        geometry: () => new THREE.ConeGeometry(0.4, 0.8, 3),
        color: 0xff66ff, emissive: 0xdd44dd,
        health: 25, speed: 6, damage: 8, scale: 0.9, weight: 15,
        zigzagAmplitude: 3, zigzagFrequency: 2,
        gemCount: () => Math.ceil(Math.random() * 2),
        deathParticles: { color: { r: 1, g: 0.4, b: 1 }, count: 25 }
    },
    vampire: {
        geometry: () => new THREE.OctahedronGeometry(0.5, 0),
        color: 0x990033, emissive: 0xcc0044,
        health: 45, speed: 4, damage: 12, scale: 1.1, weight: 10,
        lifeSteal: 0.3, healOnHit: true,
        gemCount: () => Math.ceil(Math.random() * 2) + 1,
        deathParticles: { color: { r: 0.8, g: 0, b: 0.2 }, count: 35 }
    },
    shielder: {
        geometry: () => new THREE.CylinderGeometry(0.5, 0.5, 0.8, 8),
        color: 0x4466ff, emissive: 0x2244dd,
        health: 60, speed: 2.5, damage: 15, scale: 1.2, weight: 12,
        hasShield: true, shieldHealth: 40, shieldRegen: 5,
        gemCount: () => Math.ceil(Math.random() * 3) + 1,
        deathParticles: { color: { r: 0.3, g: 0.4, b: 1 }, count: 40 }
    },
    bomber: {
        geometry: () => new THREE.SphereGeometry(0.4, 8, 8),
        color: 0xff4400, emissive: 0xff6600,
        health: 20, speed: 5, damage: 5, scale: 0.9, weight: 12,
        dropsBomb: true, bombTimer: 3, bombDamage: 25, bombRadius: 3,
        gemCount: () => Math.ceil(Math.random() * 2),
        deathParticles: { color: { r: 1, g: 0.3, b: 0 }, count: 30 }
    },
    magnet: {
        geometry: () => new THREE.TorusKnotGeometry(0.3, 0.1, 32, 8),
        color: 0xffff44, emissive: 0xdddd00,
        health: 35, speed: 3, damage: 10, scale: 1, weight: 8,
        pullsPlayer: true, pullStrength: 2, pullRange: 8,
        gemCount: () => Math.ceil(Math.random() * 2) + 1,
        deathParticles: { color: { r: 1, g: 1, b: 0.3 }, count: 35 }
    },
    mirror: {
        geometry: () => new THREE.PlaneGeometry(0.8, 1.2),
        color: 0xaaaaff, emissive: 0x8888dd,
        health: 30, speed: 3.5, damage: 8, scale: 1, weight: 8,
        reflectsProjectiles: true, reflectChance: 0.4,
        gemCount: () => Math.ceil(Math.random() * 2) + 1,
        deathParticles: { color: { r: 0.7, g: 0.7, b: 1 }, count: 30 }
    },
    swarm_mother: {
        geometry: () => new THREE.DodecahedronGeometry(0.7, 0),
        color: 0x44ff44, emissive: 0x22dd22,
        health: 80, speed: 2, damage: 5, scale: 1.4, weight: 8,
        spawnsMinions: true, minionType: 'swarm_child', minionCount: 2, spawnCooldown: 4,
        gemCount: () => Math.ceil(Math.random() * 3) + 2,
        deathParticles: { color: { r: 0.3, g: 1, b: 0.3 }, count: 50 }
    },
    swarm_child: {
        geometry: () => new THREE.TetrahedronGeometry(0.25, 0),
        color: 0x88ff88, emissive: 0x66dd66,
        health: 8, speed: 7, damage: 3, scale: 0.5, weight: 0,
        gemCount: () => 1,
        deathParticles: { color: { r: 0.5, g: 1, b: 0.5 }, count: 10 }
    },
    berserker: {
        geometry: () => new THREE.BoxGeometry(0.9, 0.9, 0.9),
        color: 0xff0000, emissive: 0xdd0000,
        health: 70, speed: 3, damage: 20, scale: 1.3, weight: 10,
        enragesOnHit: true, enrageSpeedBonus: 2, enrageDamageBonus: 10,
        gemCount: () => Math.ceil(Math.random() * 3) + 1,
        deathParticles: { color: { r: 1, g: 0, b: 0 }, count: 45 }
    },
    freezer: {
        geometry: () => new THREE.IcosahedronGeometry(0.45, 0),
        color: 0x00ffff, emissive: 0x00ddff,
        health: 40, speed: 3, damage: 8, scale: 1, weight: 10,
        freezesPlayer: true, freezeDuration: 0.5, freezeRange: 2,
        gemCount: () => Math.ceil(Math.random() * 2) + 1,
        deathParticles: { color: { r: 0.5, g: 1, b: 1 }, count: 35 }
    }
};

const baseUpgrades = [
    { id: 'maxHealth', name: 'Max Health', desc: '+20 Max HP', category: 'stat', apply: () => { playerStats.maxHealth += 20; playerStats.health = Math.min(playerStats.health + 20, playerStats.maxHealth); }},
    { id: 'speed', name: 'Speed', desc: '+15% Movement', category: 'stat', apply: () => { playerStats.speed *= 1.15; }},
    { id: 'damage', name: 'Damage', desc: '+10 Attack Damage', category: 'stat', apply: () => { playerStats.damage += 10; }},
    { id: 'attackSpeed', name: 'Attack Speed', desc: '+20% Fire Rate', category: 'stat', apply: () => { playerStats.attackSpeed *= 1.2; }},
    { id: 'range', name: 'Range', desc: '+3 Attack Range', category: 'stat', apply: () => { playerStats.attackRange += 3; }},
    { id: 'multiShot', name: 'Multi-Shot', desc: '+1 Projectile', category: 'stat', apply: () => { playerStats.projectileCount += 1; }},
    { id: 'heal', name: 'Heal', desc: 'Restore 50 HP', category: 'stat', apply: () => { playerStats.health = Math.min(playerStats.health + 50, playerStats.maxHealth); }},
    { id: 'projectileSpeed', name: 'Projectile Speed', desc: '+25% Bullet Speed', category: 'stat', apply: () => { playerStats.projectileSpeed *= 1.25; }}
];

const weaponUpgrades = [
    { 
        id: 'orbitingShields', name: 'Orbiting Shields', 
        desc: () => weaponSystem.orbitingShields.level === 0 ? 'Summon 2 shields that orbit and damage enemies' : `+1 shield, +8 damage`,
        category: 'weapon', maxLevel: 5, unlockLevel: 2,
        apply: () => { weaponSystem.orbitingShields.upgrade(); metaSystem.statistics.recordUpgrade('orbitingShields', true, false); }
    },
    { 
        id: 'areaNova', name: 'Nova Blast', 
        desc: () => weaponSystem.areaNova.level === 0 ? 'Periodically explode, damaging nearby enemies' : `+20 damage, +1.5 radius, faster cooldown`,
        category: 'weapon', maxLevel: 5, unlockLevel: 3,
        apply: () => { weaponSystem.areaNova.upgrade(); metaSystem.statistics.recordUpgrade('areaNova', true, false); }
    },
    { 
        id: 'chainLightning', name: 'Chain Lightning', 
        desc: () => weaponSystem.chainLightning.level === 0 ? 'Lightning that chains between 3 enemies' : `+1 chain, +10 damage, faster cooldown`,
        category: 'weapon', maxLevel: 5, unlockLevel: 4,
        apply: () => { weaponSystem.chainLightning.upgrade(); metaSystem.statistics.recordUpgrade('chainLightning', true, false); }
    },
    { 
        id: 'flamethrower', name: 'Flamethrower', 
        desc: () => weaponSystem.flamethrower.level === 0 ? 'Spray fire in a cone, burning enemies' : `+4 damage, +burn damage, wider cone`,
        category: 'weapon', maxLevel: 5, unlockLevel: 3,
        apply: () => { weaponSystem.flamethrower.upgrade(); metaSystem.statistics.recordUpgrade('flamethrower', true, false); }
    },
    { 
        id: 'boomerang', name: 'Boomerang', 
        desc: () => weaponSystem.boomerang.level === 0 ? 'Throws boomerangs that pierce and return' : `+12 damage, +range, faster throws`,
        category: 'weapon', maxLevel: 5, unlockLevel: 2,
        apply: () => { weaponSystem.boomerang.upgrade(); metaSystem.statistics.recordUpgrade('boomerang', true, false); }
    },
    { 
        id: 'orbitalLaser', name: 'Orbital Laser', 
        desc: () => weaponSystem.orbitalLaser.level === 0 ? 'Rotating laser beams around you' : `+1 beam, +8 damage, faster spin`,
        category: 'weapon', maxLevel: 5, unlockLevel: 5,
        apply: () => { weaponSystem.orbitalLaser.upgrade(); metaSystem.statistics.recordUpgrade('orbitalLaser', true, false); }
    }
];

const evolvedUpgrades = [
    {
        id: 'dragonBreath', name: 'Dragon\'s Breath',
        desc: 'BLUE FIRE! Leaves permanent fire on the ground and massive burn damage.',
        category: 'evolution', weaponId: 'flamethrower', passiveId: 'armor',
        apply: () => { weaponSystem.flamethrower.upgrade(); metaSystem.statistics.recordUpgrade('dragonBreath', true, false); }
    },
    {
        id: 'singularityBeam', name: 'Singularity Beam',
        desc: 'Lasers pull enemies into their path. Massive damage.',
        category: 'evolution', weaponId: 'orbitalLaser', passiveId: 'magnet',
        apply: () => { weaponSystem.orbitalLaser.upgrade(); metaSystem.statistics.recordUpgrade('singularityBeam', true, false); }
    },
    {
        id: 'chronosBlade', name: 'Chronos Blade',
        desc: 'Boomerangs freeze enemies in time for 1 second on hit.',
        category: 'evolution', weaponId: 'boomerang', passiveId: 'speed',
        apply: () => { weaponSystem.boomerang.upgrade(); metaSystem.statistics.recordUpgrade('chronosBlade', true, false); }
    },
    {
        id: 'staticField', name: 'Static Field',
        desc: 'Constant aura of lightning around you. Massive chain count.',
        category: 'evolution', weaponId: 'chainLightning', passiveId: 'attackSpeed',
        apply: () => { weaponSystem.chainLightning.upgrade(); metaSystem.statistics.recordUpgrade('staticField', true, false); }
    },
    {
        id: 'novaPrime', name: 'Nova Prime',
        desc: 'Massive explosion radius and extra shockwaves.',
        category: 'evolution', weaponId: 'areaNova', passiveId: 'range',
        apply: () => { weaponSystem.areaNova.upgrade(); metaSystem.statistics.recordUpgrade('novaPrime', true, false); }
    },
    {
        id: 'aegisShield', name: 'Aegis Shield',
        desc: 'Shields are larger and deal 2.5x damage.',
        category: 'evolution', weaponId: 'orbitingShields', passiveId: 'damage',
        apply: () => { weaponSystem.orbitingShields.upgrade(); metaSystem.statistics.recordUpgrade('aegisShield', true, false); }
    }
];

function getAvailableUpgrades() {
    const available = [];
    
    baseUpgrades.forEach(u => {
        if (!banishedUpgrades.has(u.id)) {
            available.push({ ...u, currentLevel: 0 });
        }
    });
    
    weaponUpgrades.forEach(u => {
        if (!banishedUpgrades.has(u.id) && playerStats.level >= (u.unlockLevel || 1)) {
            const weapon = weaponSystem[u.id];
            const level = weapon ? weapon.level : 0;
            if (level < u.maxLevel) {
                available.push({ ...u, currentLevel: level, desc: typeof u.desc === 'function' ? u.desc() : u.desc });
            }
        }
    });
    
    passiveUpgrades.forEach(u => {
        if (!banishedUpgrades.has(u.id) && playerStats.level >= (u.unlockLevel || 1)) {
            const passive = passiveSystem[u.id];
            const level = passive ? passive.level : 0;
            if (level < u.maxLevel) {
                available.push({ 
                    ...u, 
                    currentLevel: level, 
                    desc: typeof u.desc === 'function' ? u.desc(level) : u.desc,
                    apply: () => { 
                        passiveSystem[u.id].upgrade(); 
                        metaSystem.statistics.recordUpgrade(u.id, false, true); 
                    }
                });
            }
        }
    });

    evolvedUpgrades.forEach(u => {
        const weapon = weaponSystem[u.weaponId];
        const passive = passiveSystem[u.passiveId];
        if (weapon && weapon.level >= 5 && !weapon.isEvolved && passive && passive.level >= 5) {
            available.push({ ...u, currentLevel: 5 });
        }
    });
    
    return available;
}

export function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    scene.fog = new THREE.FogExp2(0x0a0a1a, 0.008);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 25, 20);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 2.5;
    document.getElementById('game-container').appendChild(renderer.domElement);

    composer = new EffectComposer(renderer);
    
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.8, 0.4, 0.85
    );
    composer.addPass(bloomPass);
    
    const vignetteShader = {
        uniforms: {
            tDiffuse: { value: null },
            darkness: { value: 1.0 },
            offset: { value: 1.0 }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform float darkness;
            uniform float offset;
            varying vec2 vUv;
            void main() {
                vec4 texel = texture2D(tDiffuse, vUv);
                vec2 uv = (vUv - vec2(0.5)) * vec2(offset);
                float vignette = clamp(pow(cos(uv.x * 3.14159) * cos(uv.y * 3.14159), 0.25), 0.0, 1.0);
                texel.rgb *= 1.0 - (1.0 - vignette) * darkness;
                gl_FragColor = texel;
            }
        `
    };
    
    const vignettePass = new ShaderPass(vignetteShader);
    vignettePass.uniforms.darkness.value = 0.15;
    vignettePass.uniforms.offset.value = 1.2;
    composer.addPass(vignettePass);
    
    const chromaticPass = new ShaderPass(ChromaticAberrationShader);
    composer.addPass(chromaticPass);
    chromaticAberration = new ChromaticAberrationController(chromaticPass);

    const ambientLight = new THREE.AmbientLight(0x6688cc, 2.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8);
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    scene.add(directionalLight);

    WorldSystem.init(scene, getTexture);

    createPlayer();

    particleSystem = new ParticleSystem(5000);
    scene.add(particleSystem.points);
    
    ProjectilePool.init();
    GemPool.init();
    
    screenShake = new ScreenShake();
    timeController = new TimeController();
    damageNumbers = new DamageNumberSystem(scene);
    shockwaves = new ShockwaveSystem(scene);
    screenFlash = new ScreenFlash();
    vignetteController = new VignetteController();
    
    weaponSystem = new WeaponSystem(scene, particleSystem, shockwaves, screenShake, audio);
    passiveSystem = new PassiveSystem();
    healthBars = new EnemyHealthBars(scene);
    minimap = new Minimap();
    minimap.hide();
    metaSystem = new MetaSystem();
    powerupSystem = new PowerupSystem(scene, particleSystem, audio);
    hazardSystem = new HazardSystem(scene, particleSystem, audio);
    mobileControls = new MobileControls(keys);

    clock = new THREE.Clock();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            handleEscapeKey();
        } else if (e.key === ' ' && currentState === GameState.PLAYING) {
            handleDash();
        } else {
            keys[e.key.toLowerCase()] = true;
        }
    });
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    document.getElementById('resume-btn').addEventListener('click', resumeGame);
    document.getElementById('settings-btn').addEventListener('click', showSettings);
    document.getElementById('quit-btn').addEventListener('click', quitToMenu);
    document.getElementById('settings-back-btn').addEventListener('click', hideSettings);
    
    const traderCloseBtn = document.getElementById('trader-close-btn');
    if (traderCloseBtn) traderCloseBtn.addEventListener('click', closeTrader);

    const metaShopBtn = document.getElementById('meta-shop-btn');
    const metaShopBackBtn = document.getElementById('meta-shop-back-btn');
    if (metaShopBtn) metaShopBtn.addEventListener('click', openMetaShop);
    if (metaShopBackBtn) metaShopBackBtn.addEventListener('click', closeMetaShop);
    
    initSettingsListeners();

    initCharacterSelect();
    updateGlobalStatsDisplay();
    updateSoulDisplay();

    renderer.render(scene, camera);
}

function initCharacterSelect() {
    const container = document.getElementById('character-select');
    if (!container) return;
    
    container.innerHTML = '';
    
    const allCharacters = metaSystem.unlocks.characters;
    const unlockedIds = metaSystem.unlocks.unlocked;
    
    allCharacters.forEach(char => {
        const isUnlocked = unlockedIds.includes(char.id);
        const isSelected = char.id === selectedCharacterId;
        
        const card = document.createElement('div');
        card.className = `character-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;
        card.dataset.id = char.id;
        
        const colorHex = '#' + char.color.toString(16).padStart(6, '0');
        
        card.innerHTML = `
            <div class="avatar" style="background: ${colorHex}; border-color: ${colorHex};"></div>
            <div class="name">${char.name}</div>
            <div class="desc">${char.desc}</div>
            <div class="char-stats">
                <span title="Health">❤️${char.stats.health}</span>
                <span title="Speed">⚡${char.stats.speed}</span>
                <span title="Damage">⚔️${char.stats.damage}</span>
            </div>
            ${!isUnlocked && char.unlockReq ? `<div class="unlock-req">🔒 ${char.unlockReq}</div>` : ''}
        `;
        
        if (isUnlocked) {
            card.addEventListener('click', () => selectCharacter(char.id));
        }
        
        container.appendChild(card);
    });
}

function selectCharacter(charId) {
    selectedCharacterId = charId;
    
    document.querySelectorAll('.character-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.id === charId);
    });
}

function updateGlobalStatsDisplay() {
    const container = document.getElementById('global-stats');
    if (!container) return;
    
    const stats = metaSystem.statistics.getGlobalStats();
    const achievements = metaSystem.achievements.getProgress();
    
    if (stats.totalRuns === 0) {
        container.innerHTML = '';
        return;
    }
    
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };
    
    container.innerHTML = `
        <div class="global-stats-box">
            <div class="stat-row"><span>Total Runs:</span><span>${stats.totalRuns}</span></div>
            <div class="stat-row"><span>Best Time:</span><span>${formatTime(stats.bestTime)}</span></div>
            <div class="stat-row"><span>Best Level:</span><span>${stats.bestLevel}</span></div>
            <div class="stat-row"><span>Total Kills:</span><span>${stats.totalKills.toLocaleString()}</span></div>
            <div class="stat-row"><span>Achievements:</span><span>${achievements.unlocked}/${achievements.total}</span></div>
        </div>
    `;
}

function updateSoulDisplay() {
    const souls = metaSystem.metaUpgrades.getSouls();
    const soulCount = document.getElementById('soul-count');
    const shopSoulCount = document.getElementById('shop-soul-count');
    if (soulCount) soulCount.textContent = souls.toLocaleString();
    if (shopSoulCount) shopSoulCount.textContent = souls.toLocaleString();
}

function openMetaShop() {
    renderMetaShop();
    document.getElementById('meta-shop-screen').style.display = 'flex';
}

function closeMetaShop() {
    document.getElementById('meta-shop-screen').style.display = 'none';
}

function renderMetaShop() {
    updateSoulDisplay();
    
    const grid = document.getElementById('meta-upgrades-grid');
    if (!grid) return;
    
    const upgrades = metaSystem.metaUpgrades.getUpgradesList();
    
    grid.innerHTML = upgrades.map(upgrade => {
        const isMaxed = upgrade.isMaxed;
        const canAfford = upgrade.canAfford;
        const statusClass = isMaxed ? 'maxed' : (!canAfford ? 'cant-afford' : '');
        
        return `
            <div class="meta-upgrade-card ${statusClass}" data-id="${upgrade.id}">
                <div class="upgrade-header">
                    <span class="upgrade-icon">${upgrade.icon}</span>
                    <div>
                        <div class="upgrade-name">${upgrade.name}</div>
                        <div class="upgrade-level">Level ${upgrade.level}/${upgrade.maxLevel}</div>
                    </div>
                </div>
                <div class="upgrade-desc">${upgrade.desc}</div>
                <div class="upgrade-cost">
                    ${isMaxed ? '' : `<span class="cost-amount">👻 ${upgrade.cost}</span>`}
                    <span class="buy-text">${isMaxed ? 'MAXED' : (canAfford ? 'CLICK TO BUY' : 'NOT ENOUGH SOULS')}</span>
                </div>
            </div>
        `;
    }).join('');
    
    grid.querySelectorAll('.meta-upgrade-card:not(.maxed):not(.cant-afford)').forEach(card => {
        card.addEventListener('click', () => {
            const upgradeId = card.dataset.id;
            const result = metaSystem.metaUpgrades.purchase(upgradeId);
            if (result.success) {
                audio.playGemPickup();
                renderMetaShop();
            }
        });
    });
}

function createPlayer() {
    const playerGroup = new THREE.Group();

    const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1, 8, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        emissive: 0x00ffff,
        emissiveIntensity: 0.5,
        roughness: 0.3,
        metalness: 0.7
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1;
    body.castShadow = true;
    playerGroup.add(body);

    const coreGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const coreMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 1;
    playerGroup.add(core);

    const ringGeometry = new THREE.RingGeometry(0.8, 1, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    playerGroup.add(ring);

    const outerRingGeometry = new THREE.RingGeometry(1.2, 1.3, 32);
    const outerRingMaterial = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
    });
    const outerRing = new THREE.Mesh(outerRingGeometry, outerRingMaterial);
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 0.03;
    playerGroup.add(outerRing);

    const playerLight = new THREE.PointLight(0x00ffff, 2, 15);
    playerLight.position.set(0, 2, 0);
    playerGroup.add(playerLight);

    player = playerGroup;
    player.userData.light = playerLight;
    scene.add(player);
}

function getCurrentTier() {
    for (let i = difficultyTiers.length - 1; i >= 0; i--) {
        if (gameTime >= difficultyTiers[i].time) {
            return difficultyTiers[i];
        }
    }
    return difficultyTiers[0];
}

function selectEnemyType() {
    const tier = getCurrentTier();
    const availableTypes = tier.enemies;

    let totalWeight = 0;
    const weights = [];
    for (const typeName of availableTypes) {
        const type = enemyTypes[typeName];
        totalWeight += type.weight;
        weights.push({ name: typeName, weight: type.weight });
    }

    let random = Math.random() * totalWeight;
    for (const w of weights) {
        random -= w.weight;
        if (random <= 0) return w.name;
    }
    return availableTypes[0];
}

function createEnemy(x, z, forcedType = null) {
    const enemyGroup = new THREE.Group();
    const typeName = forcedType || selectEnemyType();
    const type = enemyTypes[typeName];

    const geometry = AssetCache.getEnemyGeometry(typeName, type);
    const material = AssetCache.getEnemyMaterial(typeName, type);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.5 * type.scale;
    mesh.castShadow = true;
    mesh.scale.set(type.scale, type.scale, type.scale);
    enemyGroup.add(mesh);

    if (type.isElite || type.isBoss) {
        const ringAssets = AssetCache.getEliteRing(type.scale, type.isBoss);
        const ring = new THREE.Mesh(ringAssets.geo, ringAssets.mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
        ring.scale.set(type.scale, type.scale, 1);
        enemyGroup.add(ring);
        
        if (type.isBoss) {
            const bossLight = new THREE.PointLight(0xff0000, 2, 10);
            bossLight.position.set(0, 2, 0);
            enemyGroup.add(bossLight);
        }
    }

    enemyGroup.position.set(x, 0, z);

    const health = type.health * difficultyMultiplier;
    enemyGroup.userData = {
        type: typeName, health, maxHealth: health,
        speed: type.speed, damage: type.damage, scale: type.scale,
        lastDamageTime: 0, lastShootTime: 0, lastTeleportTime: 0,
        lastPhaseTime: 0, phased: false,
        explosionRadius: type.explosionRadius, explosionDamage: type.explosionDamage,
        splitCount: type.splitCount, shootRange: type.shootRange,
        shootCooldown: type.shootCooldown, projectileDamage: type.projectileDamage,
        teleportCooldown: type.teleportCooldown, teleportRange: type.teleportRange,
        phaseInterval: type.phaseInterval, isElite: type.isElite, isBoss: type.isBoss,
        gemCount: type.gemCount, deathParticles: type.deathParticles,
        zigzagAmplitude: type.zigzagAmplitude, zigzagFrequency: type.zigzagFrequency,
        lifeSteal: type.lifeSteal, healOnHit: type.healOnHit,
        hasShield: type.hasShield, shieldHealth: type.shieldHealth, 
        currentShield: type.shieldHealth || 0, shieldRegen: type.shieldRegen,
        dropsBomb: type.dropsBomb, bombTimer: type.bombTimer,
        bombDamage: type.bombDamage, bombRadius: type.bombRadius, lastBombTime: 0,
        pullsPlayer: type.pullsPlayer, pullStrength: type.pullStrength, pullRange: type.pullRange,
        reflectsProjectiles: type.reflectsProjectiles, reflectChance: type.reflectChance,
        spawnsMinions: type.spawnsMinions, minionType: type.minionType, 
        minionCount: type.minionCount, spawnCooldown: type.spawnCooldown, lastSpawnTime: 0,
        enragesOnHit: type.enragesOnHit, enrageSpeedBonus: type.enrageSpeedBonus,
        enrageDamageBonus: type.enrageDamageBonus, isEnraged: false,
        freezesPlayer: type.freezesPlayer, freezeDuration: type.freezeDuration, freezeRange: type.freezeRange
    };

    scene.add(enemyGroup);
    enemies.push(enemyGroup);
    return enemyGroup;
}

function playDeathEffect(enemy) {
    const data = enemy.userData;
    const pos = enemy.position.clone();
    const deathConfig = data.deathParticles;
    
    particleSystem.emit({
        position: { x: pos.x, y: pos.y + 0.5, z: pos.z },
        velocity: { x: 0, y: 8, z: 0 },
        color: deathConfig.color,
        count: deathConfig.count,
        spread: data.scale * 0.5,
        size: deathConfig.size || 1.5,
        lifetime: 0.8,
        gravity: 15
    });
    
    if (data.isBoss || data.isElite || data.type === 'tank' || data.type === 'exploder') {
        const color = data.isBoss ? 0xff0000 : (data.type === 'exploder' ? 0xff6600 : 0x00ffff);
        shockwaves.spawn(pos, color, data.isBoss ? 15 : 8);
    }
    
    if (data.isBoss) {
        screenShake.addTrauma(0.8);
        timeController.freeze(0.2);
        audio.playEnemyDeath(true);
    } else if (data.isElite || data.type === 'tank') {
        screenShake.addTrauma(0.3);
        timeController.freeze(0.05);
        audio.playEnemyDeath(false);
    } else {
        screenShake.addTrauma(0.1);
        audio.playEnemyDeath(false);
    }
}

function createExplosion(x, z, radius, damage) {
    particleSystem.emit({
        position: { x, y: 1, z },
        velocity: { x: 0, y: 10, z: 0 },
        color: { r: 1, g: 0.4, b: 0 },
        count: 80, spread: 1, size: 2.5, lifetime: 1, gravity: 10
    });
    
    particleSystem.emit({
        position: { x, y: 0.5, z },
        velocity: { x: 0, y: 5, z: 0 },
        color: { r: 1, g: 0.8, b: 0 },
        count: 40, spread: 2, size: 1.5, lifetime: 0.6, gravity: 5
    });
    
    shockwaves.spawn(new THREE.Vector3(x, 0, z), 0xff6600, radius);
    screenShake.addTrauma(0.5);
    audio.playExplosion();

    const distToPlayer = player.position.distanceTo(new THREE.Vector3(x, 0, z));
    if (distToPlayer < radius) {
        const damageAmount = damage * (1 - distToPlayer / radius);
        playerStats.health -= damageAmount;
        player.children[0].material.emissive.setHex(0xff6600);
        audio.playHurt();
        setTimeout(() => {
            player.children[0].material.emissive.setHex(0x00ffff);
        }, 200);

        if (playerStats.health <= 0) gameOver();
    }
}

function createEnemyProjectile(fromPos, toPos, damage) {
    const projectile = ProjectilePool.getEnemyProjectile();
    projectile.position.copy(fromPos);
    projectile.position.y = 1;

    const direction = new THREE.Vector3();
    direction.subVectors(toPos, fromPos).normalize();
    direction.y = 0;

    projectile.userData = { velocity: direction.multiplyScalar(12), damage, lifetime: 3 };

    if (!projectile.parent) scene.add(projectile);
    enemyProjectiles.push(projectile);
}

function createProjectile(direction, offset = 0) {
    const projectile = ProjectilePool.getPlayerProjectile();

    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
    const offsetPosition = perpendicular.multiplyScalar(offset * 0.5);

    projectile.position.copy(player.position);
    projectile.position.y = 1;
    projectile.position.add(offsetPosition);

    projectile.userData = {
        velocity: direction.clone().multiplyScalar(playerStats.projectileSpeed),
        damage: playerStats.damage,
        lifetime: 2,
        lastTrailTime: 0
    };

    if (!projectile.parent) scene.add(projectile);
    projectiles.push(projectile);
    
    particleSystem.emit({
        position: { x: player.position.x, y: 1, z: player.position.z },
        velocity: { x: direction.x * 5, y: 2, z: direction.z * 5 },
        color: { r: 1, g: 1, b: 0.5 },
        count: 3, spread: 0.2, size: 0.6, lifetime: 0.1, gravity: 0
    });
    
    audio.playShoot();
}

function createGem(x, z, value = 1) {
    const gem = GemPool.get();
    gem.position.set(x, 0.5, z);
    gem.userData = { value, spawnTime: gameTime };

    if (!gem.parent) scene.add(gem);
    gems.push(gem);
}

function showWaveWarning(message) {
    const warning = document.getElementById('wave-warning');
    warning.textContent = message;
    warning.style.opacity = '1';
    
    const overlay = document.getElementById('low-health-overlay');
    overlay.style.boxShadow = 'inset 0 0 100px 50px rgba(255, 100, 0, 0.5)';
    overlay.style.opacity = '1';
    setTimeout(() => {
        overlay.style.opacity = '0';
        overlay.style.boxShadow = 'inset 0 0 100px 50px rgba(255, 0, 0, 0.5)';
    }, 300);
    
    setTimeout(() => { warning.style.opacity = '0'; }, 2000);
}

function spawnEnemies(deltaTime) {
    lastSpawnTime += deltaTime;

    // Gentler difficulty scaling: +15% health per minute instead of +25%
    difficultyMultiplier = 1 + (gameTime / 60) * 0.15;
    // Slower spawn rate decrease: min 0.8s instead of 0.5s
    spawnInterval = Math.max(0.8, 2 - (gameTime / 60) * 0.10);

    const newTier = getCurrentTier();
    const tierIndex = difficultyTiers.indexOf(newTier) + 1;
    if (tierIndex > currentDifficultyTier) {
        currentDifficultyTier = tierIndex;
        showWaveWarning(`DIFFICULTY ${newTier.name}`);
        audio.playBossWarning();
    }

    if (gameTime >= 120 && gameTime - lastBossSpawnTime >= 90) {
        lastBossSpawnTime = gameTime;
        const angle = Math.random() * Math.PI * 2;
        const distance = 35;
        const x = player.position.x + Math.cos(angle) * distance;
        const z = player.position.z + Math.sin(angle) * distance;
        createEnemy(x, z, 'boss');
        showWaveWarning('BOSS INCOMING!');
        audio.playBossWarning();
        screenShake.addTrauma(0.5);
    }
    
    miniBossSchedule.forEach(mb => {
        if (gameTime >= mb.firstSpawn) {
            const timeSinceFirst = gameTime - mb.firstSpawn;
            const spawnNumber = Math.floor(timeSinceFirst / mb.interval);
            const expectedSpawnTime = mb.firstSpawn + spawnNumber * mb.interval;
            
            if (gameTime >= expectedSpawnTime && mb.lastSpawn < expectedSpawnTime) {
                mb.lastSpawn = expectedSpawnTime;
                const angle = Math.random() * Math.PI * 2;
                const distance = 30;
                const x = player.position.x + Math.cos(angle) * distance;
                const z = player.position.z + Math.sin(angle) * distance;
                createEnemy(x, z, mb.type);
                showWaveWarning(mb.warning);
                audio.playBossWarning();
                screenShake.addTrauma(0.4);
            }
        }
    });

    if ((Math.floor(gameTime) === 300 || Math.floor(gameTime) === 600) && gameTime - lastTraderSpawnTime > 60) {
        lastTraderSpawnTime = gameTime;
        spawnTrader();
    }

    if (lastSpawnTime >= spawnInterval && enemies.length < MAX_ENEMIES) {
        lastSpawnTime = 0;
        const spawnCount = Math.min(1 + Math.floor(gameTime / 45), 5);
        const actualSpawnCount = Math.min(spawnCount, MAX_ENEMIES - enemies.length);
        for (let i = 0; i < actualSpawnCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = 30 + Math.random() * 10;
            const x = player.position.x + Math.cos(angle) * distance;
            const z = player.position.z + Math.sin(angle) * distance;
            createEnemy(x, z);
        }
    }
}

function findNearestEnemy() {
    let nearest = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
        const dist = player.position.distanceTo(enemy.position);
        if (dist < nearestDist && dist <= playerStats.attackRange) {
            nearestDist = dist;
            nearest = enemy;
        }
    }
    return nearest;
}

function attack(deltaTime) {
    lastAttackTime += deltaTime;
    const attackInterval = 1 / playerStats.attackSpeed;

    if (lastAttackTime >= attackInterval) {
        const nearestEnemy = findNearestEnemy();
        if (nearestEnemy) {
            lastAttackTime = 0;
            const direction = new THREE.Vector3();
            direction.subVectors(nearestEnemy.position, player.position).normalize();
            direction.y = 0;

            const count = playerStats.projectileCount;
            for (let i = 0; i < count; i++) {
                const offset = count === 1 ? 0 : (i - (count - 1) / 2);
                createProjectile(direction, offset);
            }
            
            if (player.userData.light) player.userData.light.intensity = 4;
        }
    }
}

function handleDash() {
    if (playerStats.isDashing || playerStats.dashCharges <= 0) return;
    
    playerStats.isDashing = true;
    playerStats.dashTime = DASH_DURATION;
    playerStats.dashCharges--;
    playerStats.dashDirection.copy(playerDirection).normalize();
    
    audio.playDash();
    screenShake.addTrauma(0.2);
    
    particleSystem.emit({
        position: { x: player.position.x, y: 1, z: player.position.z },
        velocity: { x: -playerStats.dashDirection.x * 5, y: 2, z: -playerStats.dashDirection.z * 5 },
        color: { r: 0, g: 1, b: 1 },
        count: 20, spread: 0.5, size: 1.2, lifetime: 0.4, gravity: 0
    });
}

function updatePlayer(deltaTime) {
    const isFrozen = playerStats.frozenUntil && gameTime < playerStats.frozenUntil;
    
    // Update Dash Cooldown
    if (playerStats.dashCharges < playerStats.maxDashCharges) {
        playerStats.dashCooldown -= deltaTime;
        if (playerStats.dashCooldown <= 0) {
            playerStats.dashCharges++;
            if (playerStats.dashCharges < playerStats.maxDashCharges) {
                playerStats.dashCooldown = DASH_COOLDOWN;
            }
        }
    } else {
        playerStats.dashCooldown = DASH_COOLDOWN;
    }

    const velocity = new THREE.Vector3();

    if (playerStats.isDashing) {
        playerStats.dashTime -= deltaTime;
        if (playerStats.dashTime <= 0) {
            playerStats.isDashing = false;
        }
        
        const dashSpeed = playerStats.speed * DASH_SPEED_MULTIPLIER;
        velocity.copy(playerStats.dashDirection).multiplyScalar(dashSpeed * deltaTime);
        player.position.add(velocity);
        
        // Dash trail
        if (Math.random() < 0.5) {
            particleSystem.emit({
                position: { x: player.position.x, y: 1, z: player.position.z },
                velocity: { x: 0, y: 1, z: 0 },
                color: { r: 0, g: 0.8, b: 1 },
                count: 5, spread: 0.3, size: 0.8, lifetime: 0.2, gravity: 0
            });
        }
    } else if (!isFrozen) {
        if (keys['w']) velocity.z -= 1;
        if (keys['s']) velocity.z += 1;
        if (keys['a']) velocity.x -= 1;
        if (keys['d']) velocity.x += 1;
    }

    if (!playerStats.isDashing && velocity.length() > 0) {
        velocity.normalize();
        playerDirection.copy(velocity);
        const speed = playerStats.speed * powerupSystem.getSpeedMultiplier() * getComboBonus().speedMultiplier;
        velocity.multiplyScalar(speed * deltaTime);
        player.position.add(velocity);
        
        if (Math.random() < 0.3) {
            particleSystem.emit({
                position: { x: player.position.x, y: 0.2, z: player.position.z },
                velocity: { x: -velocity.x * 2, y: 1, z: -velocity.z * 2 },
                color: { r: 0, g: 0.8, b: 1 },
                count: 1, spread: 0.1, size: 0.5, lifetime: 0.3, gravity: 0
            });
        }
    }
    
    if (isFrozen && Math.random() < 0.2) {
        particleSystem.emit({
            position: { x: player.position.x, y: 1, z: player.position.z },
            velocity: { x: (Math.random() - 0.5) * 2, y: 1, z: (Math.random() - 0.5) * 2 },
            color: { r: 0.5, g: 1, b: 1 },
            count: 1, spread: 0.3, size: 0.4, lifetime: 0.5, gravity: 0
        });
    }
    
    WorldSystem.update(player.position);

    player.children[2].rotation.z += deltaTime * 2;
    player.children[3].rotation.z -= deltaTime * 1.5;
    
    if (player.userData.light) {
        player.userData.light.intensity = THREE.MathUtils.lerp(player.userData.light.intensity, 2, deltaTime * 5);
    }
    
    const pulseScale = 1 + Math.sin(gameTime * 5) * 0.1;
    player.children[1].scale.set(pulseScale, pulseScale, pulseScale);

    cameraTargetPosition.set(player.position.x, 25, player.position.z + 20);
}

function updateCamera(deltaTime) {
    cameraBasePosition.lerp(cameraTargetPosition, deltaTime * 3);
    camera.position.copy(cameraBasePosition);
    screenShake.update(deltaTime, camera, cameraBasePosition);
    camera.lookAt(player.position.x, 0, player.position.z);
}

function spawnTrader() {
    if (traderNPC) scene.remove(traderNPC);
    
    const group = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.8, 1, 2, 8);
    const mat = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.5,
        wireframe: true
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 1;
    group.add(mesh);
    
    const ringGeo = new THREE.TorusKnotGeometry(1.2, 0.2, 64, 8);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, emissive: 0x00ff00 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1;
    group.add(ring);
    
    const light = new THREE.PointLight(0x00ff00, 3, 10);
    light.position.y = 2;
    group.add(light);
    
    const angle = Math.random() * Math.PI * 2;
    const dist = 25;
    group.position.set(
        player.position.x + Math.cos(angle) * dist,
        0,
        player.position.z + Math.sin(angle) * dist
    );
    
    traderNPC = group;
    scene.add(traderNPC);
    showWaveWarning('GLITCH TRADER HAS APPEARED!');
}

function updateEnemies(deltaTime) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const data = enemy.userData;
        const distToPlayer = player.position.distanceTo(enemy.position);

        if (data.isBoss) {
            const hpPercent = data.health / data.maxHealth;
            
            if (hpPercent < 0.75 && !data.isRaged) {
                data.isRaged = true;
                data.speed *= 1.5;
                enemy.children[0].material.color.setHex(0xff0000);
                enemy.children[0].scale.multiplyScalar(1.2);
                audio.playBossWarning();
            }
            
            if (hpPercent < 0.5 && gameTime - (data.lastSpecialTime || 0) > 10) {
                data.lastSpecialTime = gameTime;
                
                if (data.type === 'miniboss_splitter_king') {
                    for (let j = 0; j < 8; j++) {
                        const angle = (j / 8) * Math.PI * 2;
                        createEnemy(enemy.position.x + Math.cos(angle) * 5, enemy.position.z + Math.sin(angle) * 5, 'exploder');
                    }
                } else if (data.type === 'miniboss_summoner') {
                    for (let j = 0; j < 5; j++) {
                        createEnemy(player.position.x + (Math.random() - 0.5) * 20, player.position.z + (Math.random() - 0.5) * 20, 'fast');
                    }
                } else if (data.type === 'boss') {
                    hazardSystem.spawnLavaPool(player.position.clone(), 8, 40, 5);
                }
            }
        }

        if (data.phaseInterval) {
            if (gameTime - data.lastPhaseTime >= data.phaseInterval) {
                data.lastPhaseTime = gameTime;
                data.phased = !data.phased;
                enemy.children[0].material.opacity = data.phased ? 0.2 : 0.6;
            }
        }

        if (data.teleportCooldown && distToPlayer < 20) {
            if (gameTime - data.lastTeleportTime >= data.teleportCooldown) {
                data.lastTeleportTime = gameTime;
                
                particleSystem.emit({
                    position: { x: enemy.position.x, y: 1, z: enemy.position.z },
                    velocity: { x: 0, y: 3, z: 0 },
                    color: { r: 1, g: 0, b: 1 },
                    count: 20, spread: 0.5, size: 1, lifetime: 0.3, gravity: 0
                });
                
                const angle = Math.random() * Math.PI * 2;
                const teleportDist = 3 + Math.random() * data.teleportRange;
                enemy.position.x = player.position.x + Math.cos(angle) * teleportDist;
                enemy.position.z = player.position.z + Math.sin(angle) * teleportDist;

                particleSystem.emit({
                    position: { x: enemy.position.x, y: 1, z: enemy.position.z },
                    velocity: { x: 0, y: 3, z: 0 },
                    color: { r: 1, g: 0, b: 1 },
                    count: 20, spread: 0.5, size: 1, lifetime: 0.3, gravity: 0
                });

                enemy.children[0].material.emissive.setHex(0xffffff);
                setTimeout(() => {
                    if (enemy.children[0]) enemy.children[0].material.emissive.setHex(0xaa00aa);
                }, 100);
            }
        }

        if (data.chargeSpeed) {
            if (!data.isCharging && gameTime - (data.lastChargeTime || 0) >= data.chargeCooldown) {
                if (distToPlayer < data.chargeDistance * 1.5) {
                    data.isCharging = true;
                    data.chargeDirection = new THREE.Vector3().subVectors(player.position, enemy.position).normalize();
                    data.chargeDirection.y = 0;
                    data.chargeDistanceTraveled = 0;
                    data.lastChargeTime = gameTime;
                    
                    particleSystem.emit({
                        position: { x: enemy.position.x, y: 1, z: enemy.position.z },
                        velocity: { x: 0, y: 5, z: 0 },
                        color: { r: 1, g: 0.5, b: 0 },
                        count: 30, spread: 1, size: 1.5, lifetime: 0.5, gravity: 0
                    });
                }
            }
            
            if (data.isCharging) {
                const chargeMove = data.chargeSpeed * deltaTime;
                enemy.position.add(data.chargeDirection.clone().multiplyScalar(chargeMove));
                data.chargeDistanceTraveled += chargeMove;
                
                if (data.leavesFireTrail) {
                    hazardSystem.spawnFireTrail(enemy.position.clone(), 2, 8);
                }
                
                if (data.chargeDistanceTraveled >= data.chargeDistance) {
                    data.isCharging = false;
                }
            } else {
                const direction = new THREE.Vector3();
                direction.subVectors(player.position, enemy.position).normalize();
                direction.y = 0;
                enemy.position.add(direction.multiplyScalar(data.speed * deltaTime));
            }
        } else if (data.summonCooldown) {
            if (gameTime - (data.lastSummonTime || 0) >= data.summonCooldown) {
                data.lastSummonTime = gameTime;
                
                for (let s = 0; s < data.summonCount; s++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 2 + Math.random() * 2;
                    const sx = enemy.position.x + Math.cos(angle) * dist;
                    const sz = enemy.position.z + Math.sin(angle) * dist;
                    createEnemy(sx, sz, 'fast');
                }
                
                particleSystem.emit({
                    position: { x: enemy.position.x, y: 1, z: enemy.position.z },
                    velocity: { x: 0, y: 5, z: 0 },
                    color: { r: 0.6, g: 0, b: 1 },
                    count: 40, spread: 2, size: 1.2, lifetime: 0.6, gravity: -2
                });
            }
            
            const direction = new THREE.Vector3();
            direction.subVectors(player.position, enemy.position).normalize();
            direction.y = 0;
            enemy.position.add(direction.multiplyScalar(data.speed * deltaTime));
        } else if (data.shootRange && distToPlayer <= data.shootRange && distToPlayer > 3) {
            if (gameTime - data.lastShootTime >= data.shootCooldown) {
                data.lastShootTime = gameTime;
                createEnemyProjectile(enemy.position, player.position, data.projectileDamage);
            }
            if (distToPlayer < 8) {
                const awayDirection = new THREE.Vector3();
                awayDirection.subVectors(enemy.position, player.position).normalize();
                awayDirection.y = 0;
                enemy.position.add(awayDirection.multiplyScalar(data.speed * 0.5 * deltaTime));
            }
        } else if (data.zigzagAmplitude) {
            const direction = new THREE.Vector3();
            direction.subVectors(player.position, enemy.position).normalize();
            direction.y = 0;
            const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x);
            const zigzagOffset = Math.sin(gameTime * data.zigzagFrequency * Math.PI * 2) * data.zigzagAmplitude;
            const moveDir = direction.add(perpendicular.multiplyScalar(zigzagOffset * 0.3));
            enemy.position.add(moveDir.normalize().multiplyScalar(data.speed * deltaTime));
        } else if (data.pullsPlayer && distToPlayer < data.pullRange) {
            const pullDir = new THREE.Vector3().subVectors(enemy.position, player.position).normalize();
            pullDir.y = 0;
            player.position.add(pullDir.multiplyScalar(data.pullStrength * deltaTime));
            
            const direction = new THREE.Vector3();
            direction.subVectors(player.position, enemy.position).normalize();
            direction.y = 0;
            enemy.position.add(direction.multiplyScalar(data.speed * deltaTime));
        } else if (data.spawnsMinions) {
            if (gameTime - (data.lastSpawnTime || 0) >= data.spawnCooldown) {
                data.lastSpawnTime = gameTime;
                for (let m = 0; m < data.minionCount; m++) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 1.5 + Math.random();
                    createEnemy(
                        enemy.position.x + Math.cos(angle) * dist,
                        enemy.position.z + Math.sin(angle) * dist,
                        data.minionType
                    );
                }
                particleSystem.emit({
                    position: { x: enemy.position.x, y: 1, z: enemy.position.z },
                    velocity: { x: 0, y: 3, z: 0 },
                    color: { r: 0.3, g: 1, b: 0.3 },
                    count: 25, spread: 1.5, size: 1, lifetime: 0.5, gravity: 0
                });
            }
            const direction = new THREE.Vector3();
            direction.subVectors(player.position, enemy.position).normalize();
            direction.y = 0;
            enemy.position.add(direction.multiplyScalar(data.speed * deltaTime));
        } else {
            const direction = new THREE.Vector3();
            direction.subVectors(player.position, enemy.position).normalize();
            direction.y = 0;
            enemy.position.add(direction.multiplyScalar(data.speed * deltaTime));
        }
        
        if (data.freezesPlayer && distToPlayer < data.freezeRange) {
            if (!playerStats.frozenUntil || gameTime > playerStats.frozenUntil) {
                playerStats.frozenUntil = gameTime + data.freezeDuration;
                particleSystem.emit({
                    position: { x: player.position.x, y: 1, z: player.position.z },
                    velocity: { x: 0, y: 2, z: 0 },
                    color: { r: 0.5, g: 1, b: 1 },
                    count: 20, spread: 1, size: 0.8, lifetime: 0.4, gravity: 0
                });
            }
        }
        
        if (data.dropsBomb && gameTime - (data.lastBombTime || 0) >= data.bombTimer) {
            data.lastBombTime = gameTime;
            hazardSystem.spawnLavaPool(enemy.position.clone(), data.bombRadius, data.bombDamage, 2);
        }

        enemy.children[0].rotation.y += deltaTime * 2;
        enemy.children[0].rotation.x += deltaTime;

        if (enemy.children[1] && (data.isElite || data.isBoss)) {
            enemy.children[1].rotation.z += deltaTime * 3;
        }

        const collisionDist = data.isBoss ? 3 : 1.5;
        if (distToPlayer < collisionDist && !data.phased) {
            if (gameTime - data.lastDamageTime > 0.5) {
                data.lastDamageTime = gameTime;
                
                if (powerupSystem.isInvincible() || playerStats.isDashing) {
                    particleSystem.emit({
                        position: { x: player.position.x, y: 1, z: player.position.z },
                        velocity: { x: 0, y: 3, z: 0 },
                        color: { r: 0, g: 1, b: 1 },
                        count: 15, spread: 1, size: 0.8, lifetime: 0.3, gravity: 0
                    });
                } else {
                    const damageResult = passiveSystem.onTakeDamage(data.damage, playerStats, enemy.position, particleSystem);
                    playerStats.health -= damageResult.reducedDamage;
                    metaSystem.statistics.recordDamageTaken(damageResult.reducedDamage);
                    metaSystem.statistics.recordHealth(playerStats.health, playerStats.maxHealth);
                    
                    screenFlash.damageFlash();
                    vignetteController.damageSpike(damageResult.reducedDamage);
                    chromaticAberration.trigger(0.015);
                    runTimeline.recordDamageTaken(damageResult.reducedDamage, data.type || 'enemy');
                    
                    if (damageResult.thornsDamage > 0) {
                        data.health -= damageResult.thornsDamage;
                        damageNumbers.spawn(new THREE.Vector3(enemy.position.x, 1.5, enemy.position.z), damageResult.thornsDamage, false);
                        particleSystem.emit({
                            position: { x: enemy.position.x, y: 1, z: enemy.position.z },
                            velocity: { x: 0, y: 3, z: 0 },
                            color: { r: 1, g: 0, b: 0.5 },
                            count: 10, spread: 0.3, size: 0.6, lifetime: 0.2, gravity: 5
                        });
                        if (data.health <= 0) {
                            handleEnemyDeath(enemy, i);
                        }
                    }
                    
                    comboCount = 0;
                    updateComboDisplay();

                    player.children[0].material.emissive.setHex(0xff0000);
                    audio.playHurt();
                    screenShake.addTrauma(0.2 + damageResult.reducedDamage / 100);
                    chromaticAberration.trigger(0.01 + damageResult.reducedDamage / 500);
                    
                    setTimeout(() => {
                        player.children[0].material.emissive.setHex(0x00ffff);
                    }, 100);

                    if (playerStats.health <= 0) {
                        gameOver();
                        return;
                    }
                }
            }
        }

        if (!data.isBoss && distToPlayer > 60) {
            scene.remove(enemy);
            enemies.splice(i, 1);
        }
    }
}

function updateEnemyProjectiles(deltaTime) {
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const projectile = enemyProjectiles[i];

        projectile.position.add(projectile.userData.velocity.clone().multiplyScalar(deltaTime));
        projectile.userData.lifetime -= deltaTime;
        
        particleSystem.emit({
            position: { x: projectile.position.x, y: projectile.position.y, z: projectile.position.z },
            velocity: { x: 0, y: 0, z: 0 },
            color: { r: 1, g: 0.2, b: 0.2 },
            count: 1, spread: 0.05, size: 0.4, lifetime: 0.15, gravity: 0
        });

        const dx = player.position.x - projectile.position.x;
        const dz = player.position.z - projectile.position.z;
        const distToPlayer = Math.sqrt(dx * dx + dz * dz);
        if (distToPlayer < 1) {
            if (!powerupSystem.isInvincible()) {
                const damageResult = passiveSystem.onTakeDamage(projectile.userData.damage, playerStats);
                playerStats.health -= damageResult.reducedDamage;
                metaSystem.statistics.recordDamageTaken(damageResult.reducedDamage);
                
                player.children[0].material.emissive.setHex(0xff0000);
                audio.playHurt();
                screenShake.addTrauma(0.15);
                chromaticAberration.trigger(0.015);
                screenFlash.damageFlash();
                vignetteController.damageSpike(damageResult.reducedDamage);
                
                setTimeout(() => {
                    player.children[0].material.emissive.setHex(0x00ffff);
                }, 100);

                if (playerStats.health <= 0) gameOver();
            }
            
            ProjectilePool.returnEnemyProjectile(projectile);
            enemyProjectiles.splice(i, 1);
            continue;
        }

        if (projectile.userData.lifetime <= 0) {
            ProjectilePool.returnEnemyProjectile(projectile);
            enemyProjectiles.splice(i, 1);
        }
    }
}

function handleEnemyDeath(enemy, index) {
    const data = enemy.userData;
    const x = enemy.position.x;
    const z = enemy.position.z;

    playDeathEffect(enemy);
    
    if (data.isBoss) {
        screenFlash.bossDeathFlash();
        timeController.slowMotion(0.5, 0.2);
        chromaticAberration.trigger(0.04);
        runTimeline.recordBossKill(data.type);
    } else if (data.isElite) {
        screenFlash.flash('#ffaa00', 0.2, 0.1);
    } else {
        screenFlash.killFlash();
    }
    
    const prevCombo = comboCount;
    comboCount++;
    comboTimer = COMBO_TIMEOUT;
    updateComboDisplay();
    metaSystem.statistics.recordCombo(comboCount);
    
    for (const tier of COMBO_THRESHOLDS) {
        if (prevCombo < tier.threshold && comboCount >= tier.threshold && tier.heal > 0) {
            playerStats.health = Math.min(playerStats.maxHealth, playerStats.health + tier.heal);
            particleSystem.emit({
                position: { x: player.position.x, y: 1.5, z: player.position.z },
                velocity: { x: 0, y: 3, z: 0 },
                color: { r: 0.2, g: 1, b: 0.4 },
                count: 15, spread: 0.5, size: 0.8, lifetime: 0.5, gravity: -2
            });
            break;
        }
    }
    
    const enemyType = data.isBoss ? 'boss' : (data.isElite ? 'elite' : 'normal');
    metaSystem.statistics.recordKill(enemyType);

    if (data.explosionRadius) createExplosion(x, z, data.explosionRadius, data.explosionDamage);

    if (data.splitCount) {
        const splitType = data.splitsIntoElites ? 'elite_basic' : 'splitter_child';
        const spreadDist = data.splitsIntoElites ? 3 : 1.5;
        for (let i = 0; i < data.splitCount; i++) {
            const angle = (Math.PI * 2 / data.splitCount) * i;
            const offsetX = Math.cos(angle) * spreadDist;
            const offsetZ = Math.sin(angle) * spreadDist;
            createEnemy(x + offsetX, z + offsetZ, splitType);
        }
        
        if (data.splitsIntoElites) {
            shockwaves.spawn(new THREE.Vector3(x, 0, z), 0x00ffaa, 8);
            screenShake.addTrauma(0.4);
        }
    }

    const gemCount = data.gemCount();
    const gemValue = data.isBoss ? 3 : (data.isElite ? 2 : 1);
    for (let k = 0; k < gemCount; k++) {
        const offsetX = (Math.random() - 0.5) * 3;
        const offsetZ = (Math.random() - 0.5) * 3;
        createGem(x + offsetX, z + offsetZ, gemValue);
    }
    
    if (powerupSystem.shouldDropPowerup(enemyType)) {
        powerupSystem.spawnPowerup(new THREE.Vector3(x, 0, z));
    }

    damageNumbers.spawn(new THREE.Vector3(x, 1, z), data.maxHealth, data.isBoss || data.isElite);

    scene.remove(enemy);
    enemies.splice(index, 1);
    playerStats.killCount++;
}

function updateProjectiles(deltaTime) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];

        projectile.position.add(projectile.userData.velocity.clone().multiplyScalar(deltaTime));
        projectile.userData.lifetime -= deltaTime;
        
        projectile.userData.lastTrailTime += deltaTime;
        if (projectile.userData.lastTrailTime > 0.02) {
            projectile.userData.lastTrailTime = 0;
            particleSystem.emit({
                position: { x: projectile.position.x, y: projectile.position.y, z: projectile.position.z },
                velocity: { x: 0, y: 0, z: 0 },
                color: { r: 1, g: 0.9, b: 0.3 },
                count: 1, spread: 0.05, size: 0.5, lifetime: 0.15, gravity: 0
            });
        }

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            const data = enemy.userData;

            if (data.phased) continue;

            const hitRadius = data.isBoss ? 2 : 1;
            const dx = projectile.position.x - enemy.position.x;
            const dz = projectile.position.z - enemy.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < hitRadius) {
                if (data.reflectsProjectiles && Math.random() < data.reflectChance) {
                    projectile.userData.velocity.x *= -1;
                    projectile.userData.velocity.z *= -1;
                    projectile.userData.damage *= 0.5;
                    particleSystem.emit({
                        position: { x: enemy.position.x, y: 1, z: enemy.position.z },
                        velocity: { x: 0, y: 3, z: 0 },
                        color: { r: 0.7, g: 0.7, b: 1 },
                        count: 10, spread: 0.5, size: 0.6, lifetime: 0.3, gravity: 0
                    });
                    continue;
                }
                
                let damage = projectile.userData.damage;
                damage *= powerupSystem.getDamageMultiplier();
                damage *= getComboBonus().damageMultiplier;
                const critResult = passiveSystem.rollCrit(damage);
                damage = critResult.damage;
                
                if (data.hasShield && data.currentShield > 0) {
                    const shieldDamage = Math.min(damage, data.currentShield);
                    data.currentShield -= shieldDamage;
                    damage -= shieldDamage;
                    particleSystem.emit({
                        position: { x: enemy.position.x, y: 1.5, z: enemy.position.z },
                        velocity: { x: 0, y: 2, z: 0 },
                        color: { r: 0.3, g: 0.5, b: 1 },
                        count: 8, spread: 0.8, size: 0.6, lifetime: 0.3, gravity: 0
                    });
                }
                
                data.health -= damage;
                metaSystem.statistics.recordDamageDealt(damage);
                
                if (data.enragesOnHit && !data.isEnraged) {
                    data.isEnraged = true;
                    data.speed += data.enrageSpeedBonus;
                    data.damage += data.enrageDamageBonus;
                    enemy.children[0].material.emissive.setHex(0xff0000);
                    particleSystem.emit({
                        position: { x: enemy.position.x, y: 1, z: enemy.position.z },
                        velocity: { x: 0, y: 5, z: 0 },
                        color: { r: 1, g: 0, b: 0 },
                        count: 30, spread: 1, size: 1, lifetime: 0.5, gravity: 0
                    });
                }
                
                if (data.healOnHit && damage > 0) {
                    const healAmount = Math.floor(damage * data.lifeSteal);
                    data.health = Math.min(data.health + healAmount, data.maxHealth);
                }
                
                const healAmount = passiveSystem.onDealDamage(damage, playerStats);
                if (healAmount > 0) {
                    metaSystem.statistics.recordHealing(healAmount);
                    particleSystem.emit({
                        position: { x: player.position.x, y: 1.5, z: player.position.z },
                        velocity: { x: 0, y: 2, z: 0 },
                        color: { r: 0.2, g: 1, b: 0.4 },
                        count: 5, spread: 0.3, size: 0.5, lifetime: 0.3, gravity: -2
                    });
                }
                
                particleSystem.emit({
                    position: { x: projectile.position.x, y: projectile.position.y, z: projectile.position.z },
                    velocity: { x: -projectile.userData.velocity.x * 0.2, y: 5, z: -projectile.userData.velocity.z * 0.2 },
                    color: critResult.isCrit ? { r: 1, g: 0.5, b: 0 } : { r: 1, g: 0.8, b: 0.2 },
                    count: critResult.isCrit ? 15 : 8, spread: 0.3, size: critResult.isCrit ? 1.2 : 0.8, lifetime: 0.2, gravity: 10
                });
                
                audio.playHit();
                
                damageNumbers.spawn(
                    new THREE.Vector3(enemy.position.x, 1.5, enemy.position.z),
                    damage,
                    critResult.isCrit
                );

                enemy.children[0].material.emissive.setHex(critResult.isCrit ? 0xffaa00 : 0xffffff);
                const originalEmissive = enemyTypes[data.type]?.emissive || 0x922b21;
                setTimeout(() => {
                    if (enemy.children[0]) enemy.children[0].material.emissive.setHex(originalEmissive);
                }, 50);

                if (data.health <= 0) handleEnemyDeath(enemy, j);

                hit = true;
                break;
            }
        }

        if (hit || projectile.userData.lifetime <= 0) {
            ProjectilePool.returnPlayerProjectile(projectile);
            projectiles.splice(i, 1);
        }
    }
}

function updateGems(deltaTime) {
    const baseMagnetRange = 5;
    const magnetRange = passiveSystem.getGemPickupRadius(baseMagnetRange) * powerupSystem.getMagnetMultiplier();
    
    for (let i = gems.length - 1; i >= 0; i--) {
        const gem = gems[i];

        gem.rotation.y += deltaTime * 3;
        gem.position.y = 0.5 + Math.sin(gameTime * 3 + i) * 0.1;
        
        if (Math.random() < 0.02) {
            particleSystem.emit({
                position: { x: gem.position.x, y: gem.position.y, z: gem.position.z },
                velocity: { x: 0, y: 2, z: 0 },
                color: { r: 0.2, g: 1, b: 0.5 },
                count: 1, spread: 0.2, size: 0.4, lifetime: 0.4, gravity: -2
            });
        }

        const dist = player.position.distanceTo(gem.position);
        if (dist < magnetRange) {
            const direction = new THREE.Vector3();
            direction.subVectors(player.position, gem.position).normalize();
            const speed = 10 * (1 - dist / magnetRange) + 5;
            gem.position.add(direction.multiplyScalar(speed * deltaTime));
        }

        if (dist < 1) {
            const expMultiplier = passiveSystem.getExpMultiplier();
            playerStats.exp += Math.floor(gem.userData.value * expMultiplier * getComboBonus().gemMultiplier);
            metaSystem.statistics.recordGem();
            
            particleSystem.emit({
                position: { x: gem.position.x, y: gem.position.y, z: gem.position.z },
                velocity: { x: 0, y: 5, z: 0 },
                color: { r: 0.2, g: 1, b: 0.5 },
                count: 10, spread: 0.3, size: 0.6, lifetime: 0.4, gravity: -5
            });
            
            audio.playGemPickup();
            
            GemPool.return(gem);
            gems.splice(i, 1);

            if (playerStats.exp >= playerStats.expToLevel) levelUp();
        }
    }
}

function updateComboDisplay() {
    const display = document.getElementById('combo-display');
    const bonus = getComboBonus();
    
    if (comboCount >= 3) {
        let text = `COMBO x${comboCount}!`;
        let color = '#ffff00';
        
        if (bonus.tier) {
            text = `${bonus.tier.name}! x${comboCount}`;
            color = bonus.tier.color;
            
            const bonusInfo = [];
            if (bonus.damageMultiplier > 1) bonusInfo.push(`DMG +${Math.round((bonus.damageMultiplier - 1) * 100)}%`);
            if (bonus.speedMultiplier > 1) bonusInfo.push(`SPD +${Math.round((bonus.speedMultiplier - 1) * 100)}%`);
            if (bonus.gemMultiplier > 1) bonusInfo.push(`XP x${bonus.gemMultiplier}`);
            
            if (bonusInfo.length > 0) {
                text += ` [${bonusInfo.join(' ')}]`;
            }
        }
        
        display.textContent = text;
        display.style.color = color;
        display.style.textShadow = `0 0 15px ${color}, 0 0 30px ${color}`;
        display.style.opacity = '1';
        display.style.transform = `scale(${1 + Math.min(comboCount * 0.02, 0.5)})`;
    } else {
        display.style.opacity = '0';
    }
}

function levelUp() {
    playerStats.exp -= playerStats.expToLevel;
    playerStats.expToLevel = Math.floor(playerStats.expToLevel * 1.5);
    playerStats.level++;
    runTimeline.recordLevelUp(playerStats.level);

    particleSystem.emit({
        position: { x: player.position.x, y: 1, z: player.position.z },
        velocity: { x: 0, y: 8, z: 0 },
        color: { r: 1, g: 0.9, b: 0.2 },
        count: 80, spread: 1, size: 1.5, lifetime: 1.2, gravity: 5
    });
    
    shockwaves.spawn(player.position.clone(), 0xffff00, 10);
    screenShake.addTrauma(0.2);
    screenFlash.levelUpFlash();
    audio.playLevelUp();

    currentState = GameState.LEVEL_UP;
    showLevelUpScreen();
}

function showLevelUpScreen() {
    const screen = document.getElementById('level-up-screen');
    const options = document.getElementById('upgrade-options');
    options.innerHTML = '';

    const available = getAvailableUpgrades();
    
    const evolvedOnes = available.filter(u => u.category === 'evolution');
    const others = available.filter(u => u.category !== 'evolution');
    
    const shuffledOthers = others.sort(() => Math.random() - 0.5);
    const choices = [...evolvedOnes, ...shuffledOthers].slice(0, 4);

    choices.forEach(upgrade => {
        const card = document.createElement('div');
        const categoryClass = upgrade.category === 'weapon' ? 'weapon' : (upgrade.category === 'passive' ? 'passive' : (upgrade.category === 'evolution' ? 'evolution' : ''));
        card.className = `upgrade-card ${categoryClass}`;
        
        let levelBadge = '';
        if (upgrade.currentLevel !== undefined && upgrade.maxLevel) {
            levelBadge = `<span class="level-badge">Lv ${upgrade.currentLevel} → ${upgrade.currentLevel + 1}</span>`;
        } else if (upgrade.category === 'evolution') {
            levelBadge = `<span class="level-badge evolved">PRIMAL</span>`;
        }
        
        const iconSrc = getUpgradeIcon(upgrade.id);
        
        card.innerHTML = `
            <img src="${iconSrc}" class="upgrade-icon" alt="${upgrade.name}">
            <h3>${upgrade.name}</h3>
            <p>${upgrade.desc}</p>
            ${levelBadge}
        `;
        card.addEventListener('click', () => {
            upgrade.apply();
            runTimeline.recordUpgradeChosen(upgrade.name);
            hideLevelUpScreen();
            audio.playGemPickup();
        });
        options.appendChild(card);
    });

    screen.style.display = 'flex';
}

function hideLevelUpScreen() {
    document.getElementById('level-up-screen').style.display = 'none';
    currentState = GameState.PLAYING;
}

function openTrader() {
    if (currentState !== GameState.PLAYING) return;
    currentState = GameState.PAUSED;
    document.getElementById('trader-screen').style.display = 'flex';
    renderTraderOptions();
}

function closeTrader() {
    document.getElementById('trader-screen').style.display = 'none';
    currentState = GameState.PLAYING;
    if (traderNPC) {
        scene.remove(traderNPC);
        traderNPC = null;
    }
}

function renderTraderOptions() {
    const container = document.getElementById('trader-options');
    container.innerHTML = '';
    
    const options = [
        { name: 'Gems to Souls', desc: 'Convert 100 Gems to 25 Souls permanently.', cost: 100, apply: () => {
            playerStats.exp -= 100;
            metaSystem.metaUpgrades.addSouls(25);
        }},
        { name: 'Rage Injector', desc: 'Double damage for 60 seconds.', cost: 50, apply: () => {
            playerStats.exp -= 50;
            powerupSystem.activateDamageBoost(60);
        }},
        { name: 'Banishment', desc: 'Banish a random common upgrade from the pool.', cost: 75, apply: () => {
            playerStats.exp -= 75;
            const pool = [...baseUpgrades, ...weaponUpgrades, ...passiveUpgrades];
            const target = pool[Math.floor(Math.random() * pool.length)];
            banishedUpgrades.add(target.id);
            showWaveWarning(`BANISHED: ${target.name}`);
        }}
    ];
    
    options.forEach(opt => {
        const card = document.createElement('div');
        card.className = 'upgrade-card';
        card.style.borderColor = '#0f0';
        card.innerHTML = `
            <h3 style="color: #0f0;">${opt.name}</h3>
            <p>${opt.desc}</p>
            <div style="margin-top: 10px; color: #ff0;">Cost: ${opt.cost} Gems</div>
        `;
        
        if (playerStats.exp >= opt.cost) {
            card.addEventListener('click', () => {
                opt.apply();
                audio.playGemPickup();
                closeTrader();
            });
        } else {
            card.style.opacity = '0.5';
        }
        
        container.appendChild(card);
    });
}

function updateHUD() {
    const healthPercent = playerStats.health / playerStats.maxHealth;
    document.getElementById('health-bar').style.width = (healthPercent * 100) + '%';
    document.getElementById('exp-bar').style.width = (playerStats.exp / playerStats.expToLevel * 100) + '%';
    document.getElementById('level').textContent = playerStats.level;

    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    document.getElementById('timer').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    document.getElementById('kill-count').textContent = `Kills: ${playerStats.killCount}`;

    const tier = getCurrentTier();
    document.getElementById('difficulty-tier').textContent = `Difficulty: ${tier.name}`;
    
    const overlay = document.getElementById('low-health-overlay');
    if (healthPercent < 0.3) {
        const pulse = Math.sin(gameTime * 8) * 0.5 + 0.5;
        overlay.style.opacity = (0.3 + pulse * 0.4) * (1 - healthPercent / 0.3);
    } else {
        overlay.style.opacity = '0';
    }
}

function gameOver() {
    currentState = GameState.GAME_OVER;
    minimap.hide();
    if (mobileControls) mobileControls.hide();
    if (dynamicMusic) dynamicMusic.stop();

    const endResult = metaSystem.endRun(playerStats, gameTime);
    
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);

    document.getElementById('final-time').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('final-level').textContent = playerStats.level;
    document.getElementById('final-kills').textContent = playerStats.killCount;
    
    const statsContainer = document.getElementById('run-stats-summary');
    if (statsContainer) {
        const stats = endResult.runStats;
        statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item"><div class="value">${stats.damageDealt.toLocaleString()}</div><div class="label">Damage Dealt</div></div>
                <div class="stat-item"><div class="value">${stats.damageTaken.toLocaleString()}</div><div class="label">Damage Taken</div></div>
                <div class="stat-item"><div class="value">${stats.damageHealed.toLocaleString()}</div><div class="label">Healing</div></div>
                <div class="stat-item"><div class="value">${stats.gemsCollected}</div><div class="label">Gems</div></div>
                <div class="stat-item"><div class="value">${stats.bossKills}</div><div class="label">Bosses</div></div>
                <div class="stat-item"><div class="value">${stats.maxCombo}x</div><div class="label">Best Combo</div></div>
            </div>
        `;
    }
    
    if (endResult.scoreResult.isHighScore) {
        const rankText = endResult.scoreResult.rank === 1 ? 'NEW HIGH SCORE!' : `Rank #${endResult.scoreResult.rank}`;
        const highScoreDiv = document.createElement('div');
        highScoreDiv.style.cssText = 'color: #ffd700; font-size: 28px; margin-top: 20px; text-shadow: 0 0 20px #ffd700; animation: recordPulse 0.5s ease-in-out infinite alternate;';
        highScoreDiv.textContent = rankText;
        document.getElementById('final-stats').appendChild(highScoreDiv);
    }
    
    if (endResult.newAchievements.length > 0) {
        endResult.newAchievements.forEach((ach, i) => {
            setTimeout(() => showAchievementNotification(ach), i * 1500);
        });
    }
    
    if (endResult.newUnlocks.length > 0) {
        endResult.newUnlocks.forEach((char, i) => {
            setTimeout(() => showUnlockNotification(char), 500 + i * 2000);
        });
    }
    
    const soulsEarnedEl = document.getElementById('souls-earned-count');
    if (soulsEarnedEl) {
        soulsEarnedEl.textContent = endResult.soulsEarned || 0;
    }
    
    const recapContainer = document.getElementById('recap-timeline');
    if (recapContainer) {
        const recap = runTimeline.getRecap();
        recapContainer.innerHTML = recap.map(event => {
            const mins = Math.floor(event.time / 60);
            const secs = Math.floor(event.time % 60);
            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
            let text = '';
            switch(event.type) {
                case 'levelup': text = `Level ${event.level}`; break;
                case 'bosskill': text = `Boss killed`; break;
                case 'upgrade': text = event.upgradeName; break;
                case 'damage': text = `-${Math.floor(event.amount)} HP`; break;
                default: text = event.description || '';
            }
            return `<div class="recap-event" style="border-color: ${event.color}">
                <span class="event-time">${timeStr}</span>
                <span class="event-icon">${event.icon}</span>
                <span class="event-text" style="color: ${event.color}">${text}</span>
            </div>`;
        }).join('');
    }

    document.getElementById('game-over-screen').style.display = 'flex';
}

function showUnlockNotification(character) {
    const notif = document.createElement('div');
    notif.id = 'unlock-notification';
    const colorHex = '#' + character.color.toString(16).padStart(6, '0');
    notif.innerHTML = `
        <div class="unlock-icon" style="background: ${colorHex}; width: 50px; height: 50px; border-radius: 50%; margin-right: 15px;"></div>
        <span class="text">
            <div class="title">NEW CHARACTER UNLOCKED!</div>
            <div class="desc">${character.name} - ${character.desc}</div>
        </span>
    `;
    document.body.appendChild(notif);
    
    setTimeout(() => notif.remove(), 5000);
}

function showAchievementNotification(achievement) {
    const existing = document.getElementById('achievement-notification');
    if (existing) existing.remove();
    
    const notif = document.createElement('div');
    notif.id = 'achievement-notification';
    notif.innerHTML = `
        <span class="icon">${achievement.icon}</span>
        <span class="text">
            <div class="label">ACHIEVEMENT UNLOCKED</div>
            <div class="title">${achievement.name}</div>
            <div class="desc">${achievement.desc}</div>
        </span>
    `;
    document.body.appendChild(notif);
    
    audio.playLevelUp();
    
    setTimeout(() => notif.remove(), 5000);
}

function startGame() {
    audio.init();
    
    if (!dynamicMusic && audio.ctx) {
        dynamicMusic = new DynamicMusic(audio.ctx, audio.masterGain);
    }
    if (dynamicMusic) {
        dynamicMusic.start();
    }
    
    if (!tutorialSystem) {
        tutorialSystem = new TutorialSystem();
    }
    if (tutorialSystem.shouldShowTutorial()) {
        setTimeout(() => tutorialSystem.start(), 500);
    }
    
    const character = metaSystem.unlocks.getCharacter(selectedCharacterId);
    if (character) {
        playerStats.health = character.stats.health;
        playerStats.maxHealth = character.stats.health;
        playerStats.speed = character.stats.speed;
        playerStats.damage = character.stats.damage;
        playerStats.attackSpeed = character.stats.attackSpeed;
        
        if (character.startingPassives) {
            character.startingPassives.forEach(passiveId => {
                if (passiveSystem[passiveId]) {
                    passiveSystem[passiveId].upgrade();
                }
            });
        }
        
        if (character.startingWeapons) {
            character.startingWeapons.forEach(weaponId => {
                if (weaponSystem[weaponId]) {
                    weaponSystem[weaponId].upgrade();
                }
            });
        }
        
        if (character.id === 'dasher') {
            playerStats.maxDashCharges = 3;
            playerStats.dashCharges = 3;
        }
        
        if (player.children[0] && player.children[0].material) {
            player.children[0].material.color.setHex(character.color);
            player.children[0].material.emissive.setHex(character.color);
        }
    }
    
    const metaEffects = metaSystem.getMetaEffects();
    if (metaEffects) {
        playerStats.maxHealth += metaEffects.health;
        playerStats.health += metaEffects.health;
        playerStats.damage *= metaEffects.damageMultiplier;
        playerStats.speed *= metaEffects.speedMultiplier;
        playerStats.critChance = metaEffects.critChance;
        playerStats.damageReduction = metaEffects.damageReduction;
        playerStats.xpMultiplier = metaEffects.xpMultiplier;
        playerStats.pickupRangeMultiplier = metaEffects.pickupRange;
        playerStats.hasRevival = metaEffects.revival;
        playerStats.revivalHealth = metaEffects.revivalHealth;
        playerStats.freeRerolls = metaEffects.freeRerolls;
    }
    
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    minimap.show();
    if (mobileControls) mobileControls.show();
    metaSystem.startRun();
    currentState = GameState.PLAYING;
    cameraBasePosition.copy(camera.position);
    cameraTargetPosition.copy(camera.position);
    clock.start();
    animate();
}

const gameSettings = {
    masterVolume: 1.0,
    sfxVolume: 1.0,
    screenShake: true,
    particleQuality: 'high',
    
    load() {
        const saved = localStorage.getItem('survivor3d_settings');
        if (saved) {
            const data = JSON.parse(saved);
            this.masterVolume = data.masterVolume ?? 1.0;
            this.sfxVolume = data.sfxVolume ?? 1.0;
            this.screenShake = data.screenShake ?? true;
            this.particleQuality = data.particleQuality ?? 'high';
        }
    },
    
    save() {
        localStorage.setItem('survivor3d_settings', JSON.stringify({
            masterVolume: this.masterVolume,
            sfxVolume: this.sfxVolume,
            screenShake: this.screenShake,
            particleQuality: this.particleQuality
        }));
    }
};

function initSettingsListeners() {
    gameSettings.load();
    applySettings();
    
    const masterSlider = document.getElementById('volume-master');
    const sfxSlider = document.getElementById('volume-sfx');
    const shakeCheckbox = document.getElementById('setting-screenshake');
    const particlesSelect = document.getElementById('setting-particles');
    
    masterSlider.value = gameSettings.masterVolume * 100;
    sfxSlider.value = gameSettings.sfxVolume * 100;
    shakeCheckbox.checked = gameSettings.screenShake;
    particlesSelect.value = gameSettings.particleQuality;
    
    document.getElementById('volume-master-value').textContent = Math.round(gameSettings.masterVolume * 100) + '%';
    document.getElementById('volume-sfx-value').textContent = Math.round(gameSettings.sfxVolume * 100) + '%';
    
    masterSlider.addEventListener('input', (e) => {
        gameSettings.masterVolume = e.target.value / 100;
        document.getElementById('volume-master-value').textContent = e.target.value + '%';
        applySettings();
        gameSettings.save();
    });
    
    sfxSlider.addEventListener('input', (e) => {
        gameSettings.sfxVolume = e.target.value / 100;
        document.getElementById('volume-sfx-value').textContent = e.target.value + '%';
        applySettings();
        gameSettings.save();
    });
    
    shakeCheckbox.addEventListener('change', (e) => {
        gameSettings.screenShake = e.target.checked;
        gameSettings.save();
    });
    
    particlesSelect.addEventListener('change', (e) => {
        gameSettings.particleQuality = e.target.value;
        applySettings();
        gameSettings.save();
    });
}

function applySettings() {
    if (audio && audio.setMasterVolume) {
        audio.setMasterVolume(gameSettings.masterVolume * gameSettings.sfxVolume);
    }
    
    if (particleSystem) {
        const qualityMultipliers = { low: 0.3, medium: 0.6, high: 1.0 };
        particleSystem.qualityMultiplier = qualityMultipliers[gameSettings.particleQuality] || 1.0;
    }
    
    if (screenShake) {
        screenShake.enabled = gameSettings.screenShake;
    }
}

function handleEscapeKey() {
    if (currentState === GameState.PLAYING) {
        pauseGame();
    } else if (currentState === GameState.PAUSED) {
        const settingsScreen = document.getElementById('settings-screen');
        if (settingsScreen.style.display === 'flex') {
            hideSettings();
        } else {
            resumeGame();
        }
    }
}

function pauseGame() {
    if (currentState !== GameState.PLAYING) return;
    
    currentState = GameState.PAUSED;
    updatePauseScreen();
    document.getElementById('pause-screen').style.display = 'flex';
}

function resumeGame() {
    document.getElementById('pause-screen').style.display = 'none';
    document.getElementById('settings-screen').style.display = 'none';
    currentState = GameState.PLAYING;
}

function showSettings() {
    document.getElementById('settings-screen').style.display = 'flex';
}

function hideSettings() {
    document.getElementById('settings-screen').style.display = 'none';
}

function quitToMenu() {
    document.getElementById('pause-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
    if (mobileControls) mobileControls.hide();
    if (dynamicMusic) dynamicMusic.stop();
    currentState = GameState.MENU;
}

function updatePauseScreen() {
    const statsList = document.getElementById('pause-stats-list');
    statsList.innerHTML = `
        <div class="pause-item"><span class="pause-item-name">Level</span><span class="pause-item-value">${playerStats.level}</span></div>
        <div class="pause-item"><span class="pause-item-name">Health</span><span class="pause-item-value">${Math.floor(playerStats.health)}/${playerStats.maxHealth}</span></div>
        <div class="pause-item"><span class="pause-item-name">Damage</span><span class="pause-item-value">${Math.round(playerStats.damage)}</span></div>
        <div class="pause-item"><span class="pause-item-name">Speed</span><span class="pause-item-value">${playerStats.speed.toFixed(1)}</span></div>
        <div class="pause-item"><span class="pause-item-name">Kills</span><span class="pause-item-value">${playerStats.killCount}</span></div>
    `;
    
    const weaponsList = document.getElementById('pause-weapons-list');
    const activeWeapons = [];
    if (weaponSystem.orbitingShields.isActive) activeWeapons.push(`Shields Lv${weaponSystem.orbitingShields.level}`);
    if (weaponSystem.areaNova.isActive) activeWeapons.push(`Nova Lv${weaponSystem.areaNova.level}`);
    if (weaponSystem.chainLightning.isActive) activeWeapons.push(`Lightning Lv${weaponSystem.chainLightning.level}`);
    if (weaponSystem.flamethrower.isActive) activeWeapons.push(`Flame Lv${weaponSystem.flamethrower.level}`);
    if (weaponSystem.boomerang.isActive) activeWeapons.push(`Boomerang Lv${weaponSystem.boomerang.level}`);
    if (weaponSystem.orbitalLaser.isActive) activeWeapons.push(`Laser Lv${weaponSystem.orbitalLaser.level}`);
    weaponsList.innerHTML = activeWeapons.length > 0 
        ? activeWeapons.map(w => `<div>${w}</div>`).join('')
        : '<div style="color:#666">None</div>';
    
    const passivesList = document.getElementById('pause-passives-list');
    const passiveEntries = [
        { name: 'Life Steal', passive: passiveSystem.lifeSteal },
        { name: 'Thorns', passive: passiveSystem.thorns },
        { name: 'Magnet', passive: passiveSystem.magnetRange },
        { name: 'Armor', passive: passiveSystem.armor },
        { name: 'Crit Chance', passive: passiveSystem.critChance },
        { name: 'EXP Bonus', passive: passiveSystem.expBonus }
    ];
    const activePassives = passiveEntries
        .filter(e => e.passive.level > 0)
        .map(e => `${e.name} Lv${e.passive.level}`);
    passivesList.innerHTML = activePassives.length > 0
        ? activePassives.map(p => `<div>${p}</div>`).join('')
        : '<div style="color:#666">None</div>';
}

function restartGame() {
    runTimeline.clear();
    const character = metaSystem.unlocks.getCharacter(selectedCharacterId);
    const baseHealth = character ? character.stats.health : 100;
    const baseSpeed = character ? character.stats.speed : 8;
    const baseDamage = character ? character.stats.damage : 30;
    const baseAttackSpeed = character ? character.stats.attackSpeed : 1;
    
    playerStats = {
        health: baseHealth, maxHealth: baseHealth, speed: baseSpeed, exp: 0, expToLevel: 10,
        level: 1, damage: baseDamage, attackSpeed: baseAttackSpeed, attackRange: 15,
        projectileSpeed: 22, projectileCount: 1, killCount: 0,
        dashCharges: 1, maxDashCharges: 1, dashCooldown: 0, isDashing: false, dashTime: 0,
        dashDirection: new THREE.Vector3()
    };
    
    if (character && character.id === 'dasher') {
        playerStats.maxDashCharges = 3;
        playerStats.dashCharges = 3;
    }
    
    if (character && player.children[0] && player.children[0].material) {
        player.children[0].material.color.setHex(character.color);
        player.children[0].material.emissive.setHex(character.color);
    }

    enemies.forEach(e => scene.remove(e));
    projectiles.forEach(p => {
        ProjectilePool.returnPlayerProjectile(p);
    });
    enemyProjectiles.forEach(p => {
        ProjectilePool.returnEnemyProjectile(p);
    });
    gems.forEach(g => {
        GemPool.return(g);
    });
    enemies = [];
    projectiles = [];
    enemyProjectiles = [];
    gems = [];

    if (traderNPC) {
        scene.remove(traderNPC);
        traderNPC = null;
    }
    lastTraderSpawnTime = -999;
    banishedUpgrades.clear();
    
    player.position.set(0, 0, 0);

    gameTime = 0;
    lastAttackTime = 0;
    lastSpawnTime = 0;
    difficultyMultiplier = 1;
    currentDifficultyTier = 1;
    lastBossSpawnTime = -90;
    miniBossSchedule.forEach(mb => mb.lastSpawn = -999);
    comboCount = 0;
    comboTimer = 0;

    cameraBasePosition.set(0, 25, 20);
    cameraTargetPosition.set(0, 25, 20);
    camera.position.copy(cameraBasePosition);
    screenShake.trauma = 0;
    
    weaponSystem.reset();
    passiveSystem.reset();
    healthBars.reset();
    powerupSystem.reset();
    hazardSystem.reset();
    WorldSystem.reset();
    
    if (character && character.startingPassives) {
        character.startingPassives.forEach(passiveId => {
            if (passiveSystem[passiveId]) {
                passiveSystem[passiveId].upgrade();
            }
        });
    }
    
    metaSystem.startRun();
    
    const highScoreDivs = document.querySelectorAll('#final-stats > div[style*="ffd700"]');
    highScoreDivs.forEach(div => div.remove());
    
    const statsContainer = document.getElementById('run-stats-summary');
    if (statsContainer) statsContainer.innerHTML = '';

    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    minimap.show();

    currentState = GameState.PLAYING;
    clock.start();
}

function animate() {
    requestAnimationFrame(animate);

    const rawDeltaTime = Math.min(clock.getDelta(), 0.1);
    const deltaTime = timeController.update(rawDeltaTime);

    if (currentState === GameState.PLAYING) {
        gameTime += deltaTime;
        metaSystem.statistics.updateTime(gameTime);
        metaSystem.statistics.updateLevel(playerStats.level);
        
        if (comboTimer > 0) {
            comboTimer -= deltaTime;
            if (comboTimer <= 0) {
                comboCount = 0;
                updateComboDisplay();
            }
        }

        updatePlayer(deltaTime);
        updateCamera(deltaTime);
        spawnEnemies(deltaTime);
        updateEnemies(deltaTime);
        attack(deltaTime);
        updateProjectiles(deltaTime);
        updateEnemyProjectiles(deltaTime);
        updateGems(deltaTime);
        
        weaponSystem.update(deltaTime, gameTime, player.position, enemies, handleWeaponHit, playerDirection, gems, handleBoomerangGemCollect);
        powerupSystem.update(deltaTime, gameTime, player.position);
        hazardSystem.update(deltaTime, gameTime, player.position, playerStats, enemies);
        
        if (traderNPC) {
            traderNPC.children[1].rotation.z += deltaTime * 2;
            if (player.position.distanceTo(traderNPC.position) < 3) {
                openTrader();
            }
        }

        enemies.forEach(enemy => healthBars.ensureHealthBar(enemy));
        healthBars.update(camera, enemies);
        minimap.update(player.position, enemies, gems);
        
        updateHUD();
        updateActiveEffectsDisplay();
        
        vignetteController.update(rawDeltaTime, playerStats.health / playerStats.maxHealth);
        
        if (dynamicMusic) {
            const intensity = Math.min(1, gameTime / 300 + (enemies.length / 50));
            dynamicMusic.setIntensity(intensity);
            dynamicMusic.setBossActive(enemies.some(e => e.userData.isBoss));
            dynamicMusic.setLowHealth(playerStats.health / playerStats.maxHealth < 0.3);
        }
        
        if (playerStats.health <= 0) {
            gameOver();
        }
    }
    
    particleSystem.update(rawDeltaTime);
    damageNumbers.update(rawDeltaTime);
    shockwaves.update(rawDeltaTime);
    chromaticAberration.update(rawDeltaTime);

    composer.render();
}

function handleWeaponHit(enemy, index, damage) {
    const data = enemy.userData;
    data.health -= damage;
    
    metaSystem.statistics.recordDamageDealt(damage);
    
    const healAmount = passiveSystem.onDealDamage(damage, playerStats);
    if (healAmount > 0) {
        metaSystem.statistics.recordHealing(healAmount);
    }
    
    damageNumbers.spawn(new THREE.Vector3(enemy.position.x, 1.5, enemy.position.z), damage, false);
    audio.playHit();
    
    if (data.teleportOnHit && gameTime - (data.lastTeleportOnHitTime || 0) >= (data.teleportCooldown || 1.5)) {
        data.lastTeleportOnHitTime = gameTime;
        
        particleSystem.emit({
            position: { x: enemy.position.x, y: 1, z: enemy.position.z },
            velocity: { x: 0, y: 3, z: 0 },
            color: { r: 0.6, g: 0, b: 1 },
            count: 25, spread: 0.8, size: 1, lifetime: 0.4, gravity: 0
        });
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 5;
        enemy.position.x = player.position.x + Math.cos(angle) * dist;
        enemy.position.z = player.position.z + Math.sin(angle) * dist;
        
        particleSystem.emit({
            position: { x: enemy.position.x, y: 1, z: enemy.position.z },
            velocity: { x: 0, y: 3, z: 0 },
            color: { r: 0.6, g: 0, b: 1 },
            count: 25, spread: 0.8, size: 1, lifetime: 0.4, gravity: 0
        });
    }
    
    enemy.children[0].material.emissive.setHex(0xffffff);
    const originalEmissive = enemyTypes[data.type]?.emissive || 0x922b21;
    setTimeout(() => {
        if (enemy.children[0]) enemy.children[0].material.emissive.setHex(originalEmissive);
    }, 50);
    
    if (data.health <= 0) {
        handleEnemyDeath(enemy, index);
    }
}

function handleBoomerangGemCollect(gem, index) {
    const expMultiplier = passiveSystem.getExpMultiplier();
    playerStats.exp += Math.floor(gem.userData.value * expMultiplier * getComboBonus().gemMultiplier);
    metaSystem.statistics.recordGem();
    
    particleSystem.emit({
        position: { x: gem.position.x, y: gem.position.y, z: gem.position.z },
        velocity: { x: 0, y: 5, z: 0 },
        color: { r: 0.2, g: 1, b: 0.5 },
        count: 10, spread: 0.3, size: 0.6, lifetime: 0.4, gravity: -5
    });
    
    audio.playGemPickup();
    GemPool.return(gem);
    gems.splice(index, 1);
    
    if (playerStats.exp >= playerStats.expToLevel) levelUp();
}

function updateActiveEffectsDisplay() {
    let container = document.getElementById('active-effects');
    if (!container) {
        container = document.createElement('div');
        container.id = 'active-effects';
        document.body.appendChild(container);
    }
    
    container.innerHTML = '';
    
    const effects = powerupSystem.getActiveEffects();
    effects.forEach(effect => {
        const remaining = Math.ceil(effect.remaining - gameTime);
        if (remaining > 0) {
            const div = document.createElement('div');
            div.className = `active-effect ${effect.type}`;
            const names = {
                invincibility: 'SHIELD',
                damageBoost: 'POWER',
                speedBoost: 'SPEED',
                magnetPulse: 'MAGNET'
            };
            div.textContent = `${names[effect.type]} ${remaining}s`;
            container.appendChild(div);
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}
