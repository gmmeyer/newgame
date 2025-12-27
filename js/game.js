import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

import { audio } from './audio.js';
import { getTexture, getUpgradeIcon } from './textures.js';
import { ParticleSystem } from './particles.js';
import { ScreenShake, TimeController, DamageNumberSystem, ShockwaveSystem, ChromaticAberrationShader, ChromaticAberrationController } from './effects.js';
import { WeaponSystem } from './weapons.js';
import { HazardSystem } from './hazards.js';
import { PassiveSystem, passiveUpgrades } from './passives.js';
import { EnemyHealthBars, Minimap } from './ui.js';
import { MetaSystem } from './meta.js';
import { PowerupSystem } from './powerups.js';

const GameState = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    LEVEL_UP: 'level_up',
    GAME_OVER: 'game_over'
};

let currentState = GameState.MENU;
let scene, camera, renderer, composer;
let player, ground;
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

let cameraTargetPosition = new THREE.Vector3();
let cameraBasePosition = new THREE.Vector3();

let playerStats = {
    health: 100,
    maxHealth: 100,
    speed: 8,
    exp: 0,
    expToLevel: 10,
    level: 1,
    damage: 25,
    attackSpeed: 1,
    attackRange: 15,
    projectileSpeed: 20,
    projectileCount: 1,
    killCount: 0
};

let comboCount = 0;
let comboTimer = 0;
const COMBO_TIMEOUT = 2;

let gameTime = 0;
let lastAttackTime = 0;
let spawnInterval = 2;
let lastSpawnTime = 0;
let difficultyMultiplier = 1;
let currentDifficultyTier = 1;
let lastBossSpawnTime = -60;
let enemyProjectiles = [];

const keys = {};

const difficultyTiers = [
    { time: 0, name: 'I', enemies: ['basic', 'fast'] },
    { time: 30, name: 'II', enemies: ['basic', 'fast', 'tank'] },
    { time: 60, name: 'III', enemies: ['basic', 'fast', 'tank', 'exploder'] },
    { time: 90, name: 'IV', enemies: ['basic', 'fast', 'tank', 'exploder', 'splitter'] },
    { time: 120, name: 'V', enemies: ['basic', 'fast', 'tank', 'exploder', 'splitter', 'shooter'] },
    { time: 180, name: 'VI', enemies: ['basic', 'fast', 'tank', 'exploder', 'splitter', 'shooter', 'ghost'] },
    { time: 240, name: 'VII', enemies: ['basic', 'fast', 'tank', 'exploder', 'splitter', 'shooter', 'ghost', 'teleporter'] },
    { time: 300, name: 'VIII', enemies: ['elite_basic', 'elite_fast', 'tank', 'exploder', 'splitter', 'shooter', 'ghost', 'teleporter'] }
];

const enemyTypes = {
    basic: {
        geometry: () => new THREE.BoxGeometry(0.8, 0.8, 0.8),
        color: 0xe74c3c, emissive: 0x922b21,
        health: 30, speed: 3, damage: 10, scale: 1, weight: 40,
        gemCount: () => Math.ceil(Math.random() * 2),
        deathParticles: { color: { r: 1, g: 0.2, b: 0.2 }, count: 30 }
    },
    fast: {
        geometry: () => new THREE.ConeGeometry(0.4, 1, 8),
        color: 0x9b59b6, emissive: 0x6c3483,
        health: 15, speed: 7, damage: 5, scale: 0.8, weight: 25,
        gemCount: () => 1,
        deathParticles: { color: { r: 0.6, g: 0.2, b: 0.8 }, count: 20 }
    },
    tank: {
        geometry: () => new THREE.SphereGeometry(0.7, 16, 16),
        color: 0x27ae60, emissive: 0x1e8449,
        health: 100, speed: 1.5, damage: 25, scale: 1.5, weight: 15,
        gemCount: () => Math.ceil(Math.random() * 3) + 2,
        deathParticles: { color: { r: 0.2, g: 0.8, b: 0.4 }, count: 50 }
    },
    exploder: {
        geometry: () => new THREE.DodecahedronGeometry(0.5, 0),
        color: 0xff6600, emissive: 0xcc4400,
        health: 25, speed: 4, damage: 8, scale: 1, weight: 20,
        explosionRadius: 4, explosionDamage: 30,
        gemCount: () => Math.ceil(Math.random() * 2),
        deathParticles: { color: { r: 1, g: 0.4, b: 0 }, count: 60, size: 2.5 }
    },
    splitter: {
        geometry: () => new THREE.IcosahedronGeometry(0.6, 0),
        color: 0x00bcd4, emissive: 0x008ba3,
        health: 40, speed: 2.5, damage: 12, scale: 1.2, weight: 15,
        splitCount: 3,
        gemCount: () => 1,
        deathParticles: { color: { r: 0, g: 0.8, b: 1 }, count: 25 }
    },
    splitter_child: {
        geometry: () => new THREE.IcosahedronGeometry(0.3, 0),
        color: 0x4dd0e1, emissive: 0x00acc1,
        health: 15, speed: 5, damage: 5, scale: 0.6, weight: 0,
        gemCount: () => 1,
        deathParticles: { color: { r: 0.3, g: 0.9, b: 1 }, count: 15 }
    },
    shooter: {
        geometry: () => new THREE.OctahedronGeometry(0.5, 0),
        color: 0xffeb3b, emissive: 0xfbc02d,
        health: 35, speed: 2, damage: 5, scale: 1, weight: 15,
        shootRange: 15, shootCooldown: 2, projectileDamage: 15,
        gemCount: () => Math.ceil(Math.random() * 2) + 1,
        deathParticles: { color: { r: 1, g: 0.9, b: 0.2 }, count: 35 }
    },
    ghost: {
        geometry: () => new THREE.TetrahedronGeometry(0.6, 0),
        color: 0xffffff, emissive: 0xaaaaaa,
        health: 20, speed: 4, damage: 15, scale: 1, weight: 10,
        transparent: true, phaseInterval: 1.5,
        gemCount: () => Math.ceil(Math.random() * 2),
        deathParticles: { color: { r: 1, g: 1, b: 1 }, count: 25 }
    },
    teleporter: {
        geometry: () => new THREE.TorusGeometry(0.4, 0.15, 8, 16),
        color: 0xff00ff, emissive: 0xaa00aa,
        health: 30, speed: 3, damage: 20, scale: 1, weight: 10,
        teleportCooldown: 3, teleportRange: 8,
        gemCount: () => Math.ceil(Math.random() * 3),
        deathParticles: { color: { r: 1, g: 0, b: 1 }, count: 40 }
    },
    elite_basic: {
        geometry: () => new THREE.BoxGeometry(1, 1, 1),
        color: 0xff0000, emissive: 0xaa0000,
        health: 150, speed: 4, damage: 20, scale: 1.3, weight: 20,
        isElite: true,
        gemCount: () => Math.ceil(Math.random() * 3) + 2,
        deathParticles: { color: { r: 1, g: 0.8, b: 0 }, count: 60 }
    },
    elite_fast: {
        geometry: () => new THREE.ConeGeometry(0.5, 1.2, 8),
        color: 0xff00ff, emissive: 0xaa00aa,
        health: 50, speed: 10, damage: 12, scale: 1, weight: 15,
        isElite: true,
        gemCount: () => Math.ceil(Math.random() * 2) + 1,
        deathParticles: { color: { r: 1, g: 0, b: 1 }, count: 40 }
    },
    boss: {
        geometry: () => new THREE.BoxGeometry(1.5, 1.5, 1.5),
        color: 0x8b0000, emissive: 0x660000,
        health: 500, speed: 2, damage: 40, scale: 2.5, weight: 0,
        isBoss: true,
        gemCount: () => 10 + Math.floor(Math.random() * 10),
        deathParticles: { color: { r: 1, g: 0, b: 0 }, count: 150, size: 3 }
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
    }
];

function getAvailableUpgrades() {
    const available = [];
    
    baseUpgrades.forEach(u => available.push({ ...u, currentLevel: 0 }));
    
    weaponUpgrades.forEach(u => {
        if (playerStats.level >= (u.unlockLevel || 1)) {
            const weapon = weaponSystem[u.id.replace('Shields', 'ingShields')];
            const level = weapon ? weapon.level : 0;
            if (level < u.maxLevel) {
                available.push({ ...u, currentLevel: level, desc: typeof u.desc === 'function' ? u.desc() : u.desc });
            }
        }
    });
    
    passiveUpgrades.forEach(u => {
        if (playerStats.level >= (u.unlockLevel || 1)) {
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
    
    return available;
}

export function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.FogExp2(0x1a1a2e, 0.015);

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
        1.2, 0.5, 0.6
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
    vignettePass.uniforms.darkness.value = 0.3;
    vignettePass.uniforms.offset.value = 1.0;
    composer.addPass(vignettePass);
    
    const chromaticPass = new ShaderPass(ChromaticAberrationShader);
    composer.addPass(chromaticPass);
    chromaticAberration = new ChromaticAberrationController(chromaticPass);

    const ambientLight = new THREE.AmbientLight(0x4466aa, 1.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xaaaaff, 1.0);
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

    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
        map: getTexture('ground'),
        roughness: 0.9,
        metalness: 0.1,
        emissive: 0x003333,
        emissiveIntensity: 0.4
    });
    ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    createPlayer();

    particleSystem = new ParticleSystem(5000);
    scene.add(particleSystem.points);
    
    screenShake = new ScreenShake();
    timeController = new TimeController();
    damageNumbers = new DamageNumberSystem(scene);
    shockwaves = new ShockwaveSystem(scene);
    
    weaponSystem = new WeaponSystem(scene, particleSystem, shockwaves, screenShake, audio);
    passiveSystem = new PassiveSystem();
    healthBars = new EnemyHealthBars(scene);
    minimap = new Minimap();
    minimap.hide();
    metaSystem = new MetaSystem();
    powerupSystem = new PowerupSystem(scene, particleSystem, audio);
    hazardSystem = new HazardSystem(scene, particleSystem, audio);

    clock = new THREE.Clock();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', restartGame);

    initCharacterSelect();
    updateGlobalStatsDisplay();

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

    const geometry = type.geometry();
    const enemyTexture = getTexture('enemy_' + typeName);
    const material = new THREE.MeshStandardMaterial({
        map: enemyTexture,
        color: type.color,
        emissive: type.emissive,
        emissiveIntensity: type.isElite ? 0.8 : (type.isBoss ? 1 : 0.4),
        emissiveMap: enemyTexture,
        transparent: type.transparent || false,
        opacity: type.transparent ? 0.6 : 1,
        roughness: 0.4,
        metalness: 0.6
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = 0.5 * type.scale;
    mesh.castShadow = true;
    mesh.scale.set(type.scale, type.scale, type.scale);
    enemyGroup.add(mesh);

    if (type.isElite || type.isBoss) {
        const ringGeometry = new THREE.RingGeometry(type.scale * 0.8, type.scale * 1.0, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: type.isBoss ? 0xff0000 : 0xffff00,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.05;
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
        gemCount: type.gemCount, deathParticles: type.deathParticles
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
    const geometry = new THREE.SphereGeometry(0.2, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.9 });
    const projectile = new THREE.Mesh(geometry, material);
    projectile.position.copy(fromPos);
    projectile.position.y = 1;

    const direction = new THREE.Vector3();
    direction.subVectors(toPos, fromPos).normalize();
    direction.y = 0;

    projectile.userData = { velocity: direction.multiplyScalar(12), damage, lifetime: 3 };

    scene.add(projectile);
    enemyProjectiles.push(projectile);
}

function createProjectile(direction, offset = 0) {
    const geometry = new THREE.SphereGeometry(0.25, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 1 });
    const projectile = new THREE.Mesh(geometry, material);

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

    scene.add(projectile);
    projectiles.push(projectile);
    
    particleSystem.emit({
        position: { x: player.position.x, y: 1, z: player.position.z },
        velocity: { x: direction.x * 5, y: 2, z: direction.z * 5 },
        color: { r: 1, g: 1, b: 0.5 },
        count: 5, spread: 0.2, size: 0.8, lifetime: 0.15, gravity: 0
    });
    
    audio.playShoot();
}

function createGem(x, z, value = 1) {
    const geometry = new THREE.OctahedronGeometry(0.3, 0);
    const material = new THREE.MeshStandardMaterial({
        color: 0x00ff88,
        emissive: 0x00ff88,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.9,
        roughness: 0.2,
        metalness: 0.8
    });
    const gem = new THREE.Mesh(geometry, material);
    gem.position.set(x, 0.5, z);
    gem.userData = { value, spawnTime: gameTime };

    scene.add(gem);
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

    difficultyMultiplier = 1 + (gameTime / 60) * 0.5;
    spawnInterval = Math.max(0.3, 2 - (gameTime / 60) * 0.3);

    const newTier = getCurrentTier();
    const tierIndex = difficultyTiers.indexOf(newTier) + 1;
    if (tierIndex > currentDifficultyTier) {
        currentDifficultyTier = tierIndex;
        showWaveWarning(`DIFFICULTY ${newTier.name}`);
        audio.playBossWarning();
    }

    if (gameTime >= 60 && gameTime - lastBossSpawnTime >= 60) {
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

    if (lastSpawnTime >= spawnInterval) {
        lastSpawnTime = 0;
        const spawnCount = Math.min(1 + Math.floor(gameTime / 30), 8);
        for (let i = 0; i < spawnCount; i++) {
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

function updatePlayer(deltaTime) {
    const velocity = new THREE.Vector3();

    if (keys['w']) velocity.z -= 1;
    if (keys['s']) velocity.z += 1;
    if (keys['a']) velocity.x -= 1;
    if (keys['d']) velocity.x += 1;

    if (velocity.length() > 0) {
        velocity.normalize();
        const speed = playerStats.speed * powerupSystem.getSpeedMultiplier();
        velocity.multiplyScalar(speed * deltaTime);
        player.position.add(velocity);

        player.position.x = Math.max(-45, Math.min(45, player.position.x));
        player.position.z = Math.max(-45, Math.min(45, player.position.z));
        
        if (Math.random() < 0.3) {
            particleSystem.emit({
                position: { x: player.position.x, y: 0.2, z: player.position.z },
                velocity: { x: -velocity.x * 2, y: 1, z: -velocity.z * 2 },
                color: { r: 0, g: 0.8, b: 1 },
                count: 1, spread: 0.1, size: 0.5, lifetime: 0.3, gravity: 0
            });
        }
    }

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

function updateEnemies(deltaTime) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const data = enemy.userData;
        const distToPlayer = player.position.distanceTo(enemy.position);

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

        if (data.shootRange && distToPlayer <= data.shootRange && distToPlayer > 3) {
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
        } else {
            const direction = new THREE.Vector3();
            direction.subVectors(player.position, enemy.position).normalize();
            direction.y = 0;
            enemy.position.add(direction.multiplyScalar(data.speed * deltaTime));
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
                
                if (powerupSystem.isInvincible()) {
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
                
                setTimeout(() => {
                    player.children[0].material.emissive.setHex(0x00ffff);
                }, 100);

                if (playerStats.health <= 0) gameOver();
            }
            
            scene.remove(projectile);
            enemyProjectiles.splice(i, 1);
            continue;
        }

        if (projectile.userData.lifetime <= 0) {
            scene.remove(projectile);
            enemyProjectiles.splice(i, 1);
        }
    }
}

function handleEnemyDeath(enemy, index) {
    const data = enemy.userData;
    const x = enemy.position.x;
    const z = enemy.position.z;

    playDeathEffect(enemy);
    
    comboCount++;
    comboTimer = COMBO_TIMEOUT;
    updateComboDisplay();
    metaSystem.statistics.recordCombo(comboCount);
    
    const enemyType = data.isBoss ? 'boss' : (data.isElite ? 'elite' : 'normal');
    metaSystem.statistics.recordKill(enemyType);

    if (data.explosionRadius) createExplosion(x, z, data.explosionRadius, data.explosionDamage);

    if (data.splitCount) {
        for (let i = 0; i < data.splitCount; i++) {
            const angle = (Math.PI * 2 / data.splitCount) * i;
            const offsetX = Math.cos(angle) * 1.5;
            const offsetZ = Math.sin(angle) * 1.5;
            createEnemy(x + offsetX, z + offsetZ, 'splitter_child');
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
                let damage = projectile.userData.damage;
                damage *= powerupSystem.getDamageMultiplier();
                const critResult = passiveSystem.rollCrit(damage);
                damage = critResult.damage;
                
                data.health -= damage;
                metaSystem.statistics.recordDamageDealt(damage);
                
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
            scene.remove(projectile);
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
            playerStats.exp += Math.floor(gem.userData.value * expMultiplier);
            metaSystem.statistics.recordGem();
            
            particleSystem.emit({
                position: { x: gem.position.x, y: gem.position.y, z: gem.position.z },
                velocity: { x: 0, y: 5, z: 0 },
                color: { r: 0.2, g: 1, b: 0.5 },
                count: 10, spread: 0.3, size: 0.6, lifetime: 0.4, gravity: -5
            });
            
            audio.playGemPickup();
            
            scene.remove(gem);
            gems.splice(i, 1);

            if (playerStats.exp >= playerStats.expToLevel) levelUp();
        }
    }
}

function updateComboDisplay() {
    const display = document.getElementById('combo-display');
    if (comboCount >= 3) {
        display.textContent = `COMBO x${comboCount}!`;
        display.style.opacity = '1';
        display.style.transform = `scale(${1 + comboCount * 0.02})`;
    } else {
        display.style.opacity = '0';
    }
}

function levelUp() {
    playerStats.exp -= playerStats.expToLevel;
    playerStats.expToLevel = Math.floor(playerStats.expToLevel * 1.5);
    playerStats.level++;

    particleSystem.emit({
        position: { x: player.position.x, y: 1, z: player.position.z },
        velocity: { x: 0, y: 8, z: 0 },
        color: { r: 1, g: 0.9, b: 0.2 },
        count: 80, spread: 1, size: 1.5, lifetime: 1.2, gravity: 5
    });
    
    shockwaves.spawn(player.position.clone(), 0xffff00, 10);
    screenShake.addTrauma(0.2);
    audio.playLevelUp();

    currentState = GameState.LEVEL_UP;
    showLevelUpScreen();
}

function showLevelUpScreen() {
    const screen = document.getElementById('level-up-screen');
    const options = document.getElementById('upgrade-options');
    options.innerHTML = '';

    const available = getAvailableUpgrades();
    const shuffled = available.sort(() => Math.random() - 0.5);
    const choices = shuffled.slice(0, 4);

    choices.forEach(upgrade => {
        const card = document.createElement('div');
        const categoryClass = upgrade.category === 'weapon' ? 'weapon' : (upgrade.category === 'passive' ? 'passive' : '');
        card.className = `upgrade-card ${categoryClass}`;
        
        let levelBadge = '';
        if (upgrade.currentLevel !== undefined && upgrade.maxLevel) {
            levelBadge = `<span class="level-badge">Lv ${upgrade.currentLevel} → ${upgrade.currentLevel + 1}</span>`;
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
            <div class="title">${achievement.name}</div>
            <div class="desc">${achievement.desc}</div>
        </span>
    `;
    document.body.appendChild(notif);
    
    setTimeout(() => notif.remove(), 4000);
}

function startGame() {
    audio.init();
    
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
        
        if (player.children[0] && player.children[0].material) {
            player.children[0].material.color.setHex(character.color);
            player.children[0].material.emissive.setHex(character.color);
        }
    }
    
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    minimap.show();
    metaSystem.startRun();
    currentState = GameState.PLAYING;
    cameraBasePosition.copy(camera.position);
    cameraTargetPosition.copy(camera.position);
    clock.start();
    animate();
}

function restartGame() {
    const character = metaSystem.unlocks.getCharacter(selectedCharacterId);
    const baseHealth = character ? character.stats.health : 100;
    const baseSpeed = character ? character.stats.speed : 8;
    const baseDamage = character ? character.stats.damage : 25;
    const baseAttackSpeed = character ? character.stats.attackSpeed : 1;
    
    playerStats = {
        health: baseHealth, maxHealth: baseHealth, speed: baseSpeed, exp: 0, expToLevel: 10,
        level: 1, damage: baseDamage, attackSpeed: baseAttackSpeed, attackRange: 15,
        projectileSpeed: 20, projectileCount: 1, killCount: 0
    };
    
    if (character && player.children[0] && player.children[0].material) {
        player.children[0].material.color.setHex(character.color);
        player.children[0].material.emissive.setHex(character.color);
    }

    enemies.forEach(e => scene.remove(e));
    projectiles.forEach(p => scene.remove(p));
    enemyProjectiles.forEach(p => scene.remove(p));
    gems.forEach(g => scene.remove(g));
    enemies = [];
    projectiles = [];
    enemyProjectiles = [];
    gems = [];

    player.position.set(0, 0, 0);

    gameTime = 0;
    lastAttackTime = 0;
    lastSpawnTime = 0;
    difficultyMultiplier = 1;
    currentDifficultyTier = 1;
    lastBossSpawnTime = -60;
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
        
        weaponSystem.update(deltaTime, gameTime, player.position, enemies, handleWeaponHit);
        powerupSystem.update(deltaTime, gameTime, player.position);
        hazardSystem.update(deltaTime, gameTime, player.position, playerStats, enemies);
        
        enemies.forEach(enemy => healthBars.ensureHealthBar(enemy));
        healthBars.update(camera, enemies);
        minimap.update(player.position, enemies, gems);
        
        updateHUD();
        updateActiveEffectsDisplay();
        
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
    
    enemy.children[0].material.emissive.setHex(0xffffff);
    const originalEmissive = enemyTypes[data.type]?.emissive || 0x922b21;
    setTimeout(() => {
        if (enemy.children[0]) enemy.children[0].material.emissive.setHex(originalEmissive);
    }, 50);
    
    if (data.health <= 0) {
        handleEnemyDeath(enemy, index);
    }
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
