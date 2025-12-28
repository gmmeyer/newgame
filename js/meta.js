const STORAGE_KEYS = {
    HIGH_SCORES: 'survivor3d_highscores',
    ACHIEVEMENTS: 'survivor3d_achievements',
    UNLOCKS: 'survivor3d_unlocks',
    STATISTICS: 'survivor3d_statistics',
    META_UPGRADES: 'survivor3d_metaupgrades',
    CURRENCY: 'survivor3d_currency'
};

export class HighScoreSystem {
    constructor() {
        this.maxScores = 10;
        this.scores = this.load();
    }
    
    load() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.HIGH_SCORES);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }
    
    save() {
        try {
            localStorage.setItem(STORAGE_KEYS.HIGH_SCORES, JSON.stringify(this.scores));
        } catch (e) {
            console.warn('Could not save high scores:', e);
        }
    }
    
    addScore(time, level, kills, character = 'default') {
        const score = {
            time,
            level,
            kills,
            character,
            date: Date.now(),
            composite: this.calculateComposite(time, level, kills)
        };
        
        this.scores.push(score);
        this.scores.sort((a, b) => b.composite - a.composite);
        this.scores = this.scores.slice(0, this.maxScores);
        this.save();
        
        const rank = this.scores.findIndex(s => s.date === score.date) + 1;
        return { rank, isHighScore: rank <= 3 };
    }
    
    calculateComposite(time, level, kills) {
        return Math.floor(time * 10 + level * 100 + kills * 5);
    }
    
    getScores() {
        return this.scores;
    }
    
    getBestTime() {
        return this.scores.length > 0 ? Math.max(...this.scores.map(s => s.time)) : 0;
    }
    
    getBestKills() {
        return this.scores.length > 0 ? Math.max(...this.scores.map(s => s.kills)) : 0;
    }
    
    getBestLevel() {
        return this.scores.length > 0 ? Math.max(...this.scores.map(s => s.level)) : 0;
    }
}

export class AchievementSystem {
    constructor() {
        this.unlocked = this.load();
        this.definitions = this.defineAchievements();
        this.pendingNotifications = [];
    }
    
    defineAchievements() {
        return [
            { id: 'first_blood', name: 'First Blood', desc: 'Kill your first enemy', icon: '🗡️', check: (stats) => stats.totalKills >= 1 },
            { id: 'centurion', name: 'Centurion', desc: 'Kill 100 enemies in one run', icon: '💯', check: (stats) => stats.killCount >= 100 },
            { id: 'genocide', name: 'Genocide', desc: 'Kill 500 enemies in one run', icon: '💀', check: (stats) => stats.killCount >= 500 },
            { id: 'slayer', name: 'Slayer', desc: 'Kill 1000 enemies in one run', icon: '👹', check: (stats) => stats.killCount >= 1000 },
            
            { id: 'survivor_1', name: 'Survivor', desc: 'Survive for 1 minute', icon: '⏱️', check: (stats) => stats.gameTime >= 60 },
            { id: 'survivor_5', name: 'Veteran', desc: 'Survive for 5 minutes', icon: '🏅', check: (stats) => stats.gameTime >= 300 },
            { id: 'survivor_10', name: 'Legend', desc: 'Survive for 10 minutes', icon: '🏆', check: (stats) => stats.gameTime >= 600 },
            { id: 'survivor_15', name: 'Immortal', desc: 'Survive for 15 minutes', icon: '👑', check: (stats) => stats.gameTime >= 900 },
            
            { id: 'level_5', name: 'Novice', desc: 'Reach level 5', icon: '📗', check: (stats) => stats.level >= 5 },
            { id: 'level_10', name: 'Adept', desc: 'Reach level 10', icon: '📘', check: (stats) => stats.level >= 10 },
            { id: 'level_20', name: 'Master', desc: 'Reach level 20', icon: '📕', check: (stats) => stats.level >= 20 },
            { id: 'level_30', name: 'Grandmaster', desc: 'Reach level 30', icon: '📓', check: (stats) => stats.level >= 30 },
            
            { id: 'boss_slayer', name: 'Boss Slayer', desc: 'Kill your first boss', icon: '🎯', check: (stats) => stats.bossKills >= 1 },
            { id: 'boss_hunter', name: 'Boss Hunter', desc: 'Kill 5 bosses total', icon: '🎖️', check: (stats) => stats.totalBossKills >= 5 },
            
            { id: 'combo_10', name: 'Combo Starter', desc: 'Get a 10x combo', icon: '🔥', check: (stats) => stats.maxCombo >= 10 },
            { id: 'combo_25', name: 'Combo Master', desc: 'Get a 25x combo', icon: '💥', check: (stats) => stats.maxCombo >= 25 },
            { id: 'combo_50', name: 'Combo God', desc: 'Get a 50x combo', icon: '⚡', check: (stats) => stats.maxCombo >= 50 },
            
            { id: 'close_call', name: 'Close Call', desc: 'Survive with less than 10% HP', icon: '💔', check: (stats) => stats.lowestHealthPercent <= 0.1 && stats.lowestHealthPercent > 0 },
            { id: 'untouchable', name: 'Untouchable', desc: 'Reach level 5 without taking damage', icon: '🛡️', check: (stats) => stats.level >= 5 && stats.damageTaken === 0 },
            
            { id: 'collector', name: 'Gem Collector', desc: 'Collect 500 gems in one run', icon: '💎', check: (stats) => stats.gemsCollected >= 500 },
            { id: 'hoarder', name: 'Gem Hoarder', desc: 'Collect 2000 gems in one run', icon: '💰', check: (stats) => stats.gemsCollected >= 2000 },
            
            { id: 'full_arsenal', name: 'Full Arsenal', desc: 'Unlock all 3 special weapons', icon: '⚔️', check: (stats) => stats.weaponsUnlocked >= 3 },
            { id: 'passive_master', name: 'Passive Master', desc: 'Have 5 different passives', icon: '✨', check: (stats) => stats.passivesUnlocked >= 5 }
        ];
    }
    
    load() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }
    
    save() {
        try {
            localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(this.unlocked));
        } catch (e) {
            console.warn('Could not save achievements:', e);
        }
    }
    
    check(stats) {
        const newUnlocks = [];
        
        for (const achievement of this.definitions) {
            if (this.unlocked.includes(achievement.id)) continue;
            
            if (achievement.check(stats)) {
                this.unlocked.push(achievement.id);
                newUnlocks.push(achievement);
                this.pendingNotifications.push(achievement);
            }
        }
        
        if (newUnlocks.length > 0) {
            this.save();
        }
        
        return newUnlocks;
    }
    
    getUnlocked() {
        return this.definitions.filter(a => this.unlocked.includes(a.id));
    }
    
    getLocked() {
        return this.definitions.filter(a => !this.unlocked.includes(a.id));
    }
    
    getProgress() {
        return {
            unlocked: this.unlocked.length,
            total: this.definitions.length,
            percent: Math.round((this.unlocked.length / this.definitions.length) * 100)
        };
    }
    
    popNotification() {
        return this.pendingNotifications.shift();
    }
}

export class UnlockSystem {
    constructor() {
        this.unlocked = this.load();
        this.characters = this.defineCharacters();
    }
    
    defineCharacters() {
        return [
            {
                id: 'default',
                name: 'Survivor',
                desc: 'Balanced fighter',
                unlocked: true,
                stats: { health: 100, speed: 8, damage: 25, attackSpeed: 1 },
                color: 0x00aaff
            },
            {
                id: 'tank',
                name: 'Juggernaut',
                desc: 'Slow but sturdy',
                unlocked: false,
                unlockReq: 'Survive for 5 minutes',
                unlockCheck: (stats) => stats.bestTime >= 300,
                stats: { health: 200, speed: 5, damage: 20, attackSpeed: 0.8 },
                color: 0x00ff00
            },
            {
                id: 'speedster',
                name: 'Speedster',
                desc: 'Fast and fragile',
                unlocked: false,
                unlockReq: 'Kill 200 enemies in one run',
                unlockCheck: (stats) => stats.bestKills >= 200,
                stats: { health: 60, speed: 12, damage: 20, attackSpeed: 1.5 },
                color: 0xffff00
            },
            {
                id: 'glass_cannon',
                name: 'Glass Cannon',
                desc: 'Maximum damage, minimum health',
                unlocked: false,
                unlockReq: 'Reach level 15',
                unlockCheck: (stats) => stats.bestLevel >= 15,
                stats: { health: 40, speed: 8, damage: 50, attackSpeed: 1.3 },
                color: 0xff00ff
            },
            {
                id: 'vampire',
                name: 'Vampire',
                desc: 'Starts with life steal',
                unlocked: false,
                unlockReq: 'Kill 3 bosses total',
                unlockCheck: (stats) => stats.totalBossKills >= 3,
                stats: { health: 80, speed: 9, damage: 22, attackSpeed: 1.1 },
                startingPassives: ['lifeSteal'],
                color: 0x8b0000
            },
            {
                id: 'dasher',
                name: 'Dasher',
                desc: 'Dash through enemies on kill',
                unlocked: false,
                unlockReq: 'Get a 50x combo',
                unlockCheck: (stats) => stats.bestCombo >= 50,
                stats: { health: 70, speed: 11, damage: 18, attackSpeed: 1.2 },
                ability: 'dash',
                color: 0x00ffaa
            },
            {
                id: 'guardian',
                name: 'Guardian',
                desc: 'Starts with shields, takes less damage',
                unlocked: false,
                unlockReq: 'Survive 10 minutes',
                unlockCheck: (stats) => stats.bestTime >= 600,
                stats: { health: 150, speed: 6, damage: 15, attackSpeed: 0.9 },
                startingPassives: ['armor'],
                startingWeapons: ['orbitingShields'],
                color: 0x4488ff
            },
            {
                id: 'bomber',
                name: 'Bomber',
                desc: 'Explosions deal +50% damage',
                unlocked: false,
                unlockReq: 'Kill 1000 enemies total',
                unlockCheck: (stats) => stats.totalKills >= 1000,
                stats: { health: 90, speed: 7, damage: 30, attackSpeed: 0.8 },
                startingWeapons: ['areaNova'],
                explosionBonus: 1.5,
                color: 0xff6600
            },
            {
                id: 'vampire_lord',
                name: 'Vampire Lord',
                desc: 'Massive life steal, but no natural regen',
                unlocked: false,
                unlockReq: 'Reach level 25',
                unlockCheck: (stats) => stats.bestLevel >= 25,
                stats: { health: 60, speed: 10, damage: 35, attackSpeed: 1.3 },
                startingPassives: ['lifeSteal', 'lifeSteal'],
                noRegen: true,
                color: 0x660066
            }
        ];
    }
    
    load() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.UNLOCKS);
            return data ? JSON.parse(data) : ['default'];
        } catch {
            return ['default'];
        }
    }
    
    save() {
        try {
            localStorage.setItem(STORAGE_KEYS.UNLOCKS, JSON.stringify(this.unlocked));
        } catch (e) {
            console.warn('Could not save unlocks:', e);
        }
    }
    
    checkUnlocks(globalStats) {
        const newUnlocks = [];
        
        for (const char of this.characters) {
            if (this.unlocked.includes(char.id)) continue;
            if (!char.unlockCheck) continue;
            
            if (char.unlockCheck(globalStats)) {
                this.unlocked.push(char.id);
                newUnlocks.push(char);
            }
        }
        
        if (newUnlocks.length > 0) {
            this.save();
        }
        
        return newUnlocks;
    }
    
    getAvailableCharacters() {
        return this.characters.filter(c => this.unlocked.includes(c.id));
    }
    
    getLockedCharacters() {
        return this.characters.filter(c => !this.unlocked.includes(c.id));
    }
    
    getCharacter(id) {
        return this.characters.find(c => c.id === id);
    }
}

export class StatisticsSystem {
    constructor() {
        this.global = this.load();
        this.current = this.createRunStats();
    }
    
    load() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.STATISTICS);
            return data ? JSON.parse(data) : this.createGlobalStats();
        } catch {
            return this.createGlobalStats();
        }
    }
    
    save() {
        try {
            localStorage.setItem(STORAGE_KEYS.STATISTICS, JSON.stringify(this.global));
        } catch (e) {
            console.warn('Could not save statistics:', e);
        }
    }
    
    createGlobalStats() {
        return {
            totalRuns: 0,
            totalKills: 0,
            totalBossKills: 0,
            totalGemsCollected: 0,
            totalPlayTime: 0,
            totalDamageTaken: 0,
            totalDamageDealt: 0,
            bestTime: 0,
            bestKills: 0,
            bestLevel: 0,
            bestCombo: 0
        };
    }
    
    createRunStats() {
        return {
            killCount: 0,
            bossKills: 0,
            eliteKills: 0,
            gemsCollected: 0,
            damageDealt: 0,
            damageTaken: 0,
            damageHealed: 0,
            gameTime: 0,
            level: 1,
            maxCombo: 0,
            lowestHealthPercent: 1,
            weaponsUnlocked: 0,
            passivesUnlocked: 0,
            upgradesTaken: [],
            powerupsCollected: 0
        };
    }
    
    resetRun() {
        this.current = this.createRunStats();
    }
    
    recordKill(enemyType) {
        this.current.killCount++;
        if (enemyType === 'boss') this.current.bossKills++;
        if (enemyType === 'elite') this.current.eliteKills++;
    }
    
    recordDamageDealt(amount) {
        this.current.damageDealt += amount;
    }
    
    recordDamageTaken(amount) {
        this.current.damageTaken += amount;
    }
    
    recordHealing(amount) {
        this.current.damageHealed += amount;
    }
    
    recordGem() {
        this.current.gemsCollected++;
    }
    
    recordCombo(count) {
        if (count > this.current.maxCombo) {
            this.current.maxCombo = count;
        }
    }
    
    recordHealth(current, max) {
        const percent = current / max;
        if (percent < this.current.lowestHealthPercent) {
            this.current.lowestHealthPercent = percent;
        }
    }
    
    recordUpgrade(upgradeId, isWeapon, isPassive) {
        this.current.upgradesTaken.push(upgradeId);
        if (isWeapon) this.current.weaponsUnlocked++;
        if (isPassive) this.current.passivesUnlocked++;
    }
    
    updateTime(time) {
        this.current.gameTime = time;
    }
    
    updateLevel(level) {
        this.current.level = level;
    }
    
    endRun() {
        this.global.totalRuns++;
        this.global.totalKills += this.current.killCount;
        this.global.totalBossKills += this.current.bossKills;
        this.global.totalGemsCollected += this.current.gemsCollected;
        this.global.totalPlayTime += this.current.gameTime;
        this.global.totalDamageTaken += this.current.damageTaken;
        this.global.totalDamageDealt += this.current.damageDealt;
        
        if (this.current.gameTime > this.global.bestTime) {
            this.global.bestTime = this.current.gameTime;
        }
        if (this.current.killCount > this.global.bestKills) {
            this.global.bestKills = this.current.killCount;
        }
        if (this.current.level > this.global.bestLevel) {
            this.global.bestLevel = this.current.level;
        }
        if (this.current.maxCombo > this.global.bestCombo) {
            this.global.bestCombo = this.current.maxCombo;
        }
        
        this.save();
        
        return this.current;
    }
    
    getGlobalStats() {
        return this.global;
    }
    
    getCurrentStats() {
        return this.current;
    }
}

export class MetaUpgradeSystem {
    constructor() {
        this.souls = this.loadCurrency();
        this.upgrades = this.loadUpgrades();
        this.definitions = this.defineUpgrades();
    }
    
    defineUpgrades() {
        return [
            {
                id: 'startHealth',
                name: 'Vitality',
                desc: '+10 starting HP per level',
                icon: '❤️',
                maxLevel: 10,
                cost: (level) => 50 + level * 30,
                effect: (level) => ({ health: level * 10 })
            },
            {
                id: 'startDamage',
                name: 'Power',
                desc: '+5% starting damage per level',
                icon: '⚔️',
                maxLevel: 10,
                cost: (level) => 75 + level * 40,
                effect: (level) => ({ damageMultiplier: 1 + level * 0.05 })
            },
            {
                id: 'startSpeed',
                name: 'Swiftness',
                desc: '+3% starting speed per level',
                icon: '💨',
                maxLevel: 5,
                cost: (level) => 100 + level * 50,
                effect: (level) => ({ speedMultiplier: 1 + level * 0.03 })
            },
            {
                id: 'xpGain',
                name: 'Wisdom',
                desc: '+10% XP gain per level',
                icon: '📚',
                maxLevel: 10,
                cost: (level) => 80 + level * 45,
                effect: (level) => ({ xpMultiplier: 1 + level * 0.10 })
            },
            {
                id: 'gemMagnet',
                name: 'Magnetism',
                desc: '+15% gem pickup range per level',
                icon: '🧲',
                maxLevel: 5,
                cost: (level) => 60 + level * 35,
                effect: (level) => ({ pickupRange: 1 + level * 0.15 })
            },
            {
                id: 'revival',
                name: 'Second Chance',
                desc: 'Revive once per run with 30% HP',
                icon: '💀',
                maxLevel: 1,
                cost: () => 500,
                effect: () => ({ revival: true, revivalHealth: 0.3 })
            },
            {
                id: 'startArmor',
                name: 'Toughness',
                desc: '+5% damage reduction per level',
                icon: '🛡️',
                maxLevel: 5,
                cost: (level) => 120 + level * 60,
                effect: (level) => ({ damageReduction: level * 0.05 })
            },
            {
                id: 'critChance',
                name: 'Precision',
                desc: '+3% crit chance per level',
                icon: '🎯',
                maxLevel: 5,
                cost: (level) => 90 + level * 50,
                effect: (level) => ({ critChance: level * 0.03 })
            },
            {
                id: 'soulBonus',
                name: 'Soul Harvest',
                desc: '+10% souls earned per level',
                icon: '👻',
                maxLevel: 10,
                cost: (level) => 100 + level * 60,
                effect: (level) => ({ soulMultiplier: 1 + level * 0.10 })
            },
            {
                id: 'reroll',
                name: 'Fate Weaver',
                desc: '+1 free reroll per run',
                icon: '🎲',
                maxLevel: 3,
                cost: (level) => 150 + level * 100,
                effect: (level) => ({ freeRerolls: level })
            }
        ];
    }
    
    loadCurrency() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.CURRENCY);
            return data ? JSON.parse(data).souls || 0 : 0;
        } catch {
            return 0;
        }
    }
    
    saveCurrency() {
        try {
            localStorage.setItem(STORAGE_KEYS.CURRENCY, JSON.stringify({ souls: this.souls }));
        } catch (e) {
            console.warn('Could not save currency:', e);
        }
    }
    
    loadUpgrades() {
        try {
            const data = localStorage.getItem(STORAGE_KEYS.META_UPGRADES);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }
    
    saveUpgrades() {
        try {
            localStorage.setItem(STORAGE_KEYS.META_UPGRADES, JSON.stringify(this.upgrades));
        } catch (e) {
            console.warn('Could not save meta upgrades:', e);
        }
    }
    
    getLevel(upgradeId) {
        return this.upgrades[upgradeId] || 0;
    }
    
    getUpgrade(upgradeId) {
        return this.definitions.find(u => u.id === upgradeId);
    }
    
    getCost(upgradeId) {
        const upgrade = this.getUpgrade(upgradeId);
        if (!upgrade) return Infinity;
        const level = this.getLevel(upgradeId);
        if (level >= upgrade.maxLevel) return Infinity;
        return upgrade.cost(level);
    }
    
    canAfford(upgradeId) {
        return this.souls >= this.getCost(upgradeId);
    }
    
    purchase(upgradeId) {
        const upgrade = this.getUpgrade(upgradeId);
        if (!upgrade) return { success: false, reason: 'Invalid upgrade' };
        
        const level = this.getLevel(upgradeId);
        if (level >= upgrade.maxLevel) return { success: false, reason: 'Max level reached' };
        
        const cost = this.getCost(upgradeId);
        if (this.souls < cost) return { success: false, reason: 'Not enough souls' };
        
        this.souls -= cost;
        this.upgrades[upgradeId] = level + 1;
        
        this.saveCurrency();
        this.saveUpgrades();
        
        return { success: true, newLevel: level + 1, remaining: this.souls };
    }
    
    addSouls(amount) {
        const bonus = this.getEffect('soulMultiplier') || 1;
        const earned = Math.floor(amount * bonus);
        this.souls += earned;
        this.saveCurrency();
        return earned;
    }
    
    getEffect(effectKey) {
        let combined = effectKey.includes('Multiplier') ? 1 : 0;
        
        for (const def of this.definitions) {
            const level = this.getLevel(def.id);
            if (level > 0) {
                const effect = def.effect(level);
                if (effect[effectKey] !== undefined) {
                    if (effectKey.includes('Multiplier')) {
                        combined *= effect[effectKey];
                    } else {
                        combined += effect[effectKey];
                    }
                }
            }
        }
        
        return combined;
    }
    
    getAllEffects() {
        const effects = {
            health: 0,
            damageMultiplier: 1,
            speedMultiplier: 1,
            xpMultiplier: 1,
            pickupRange: 1,
            revival: false,
            revivalHealth: 0,
            damageReduction: 0,
            critChance: 0,
            soulMultiplier: 1,
            freeRerolls: 0
        };
        
        for (const def of this.definitions) {
            const level = this.getLevel(def.id);
            if (level > 0) {
                const effect = def.effect(level);
                for (const key in effect) {
                    if (key.includes('Multiplier')) {
                        effects[key] *= effect[key];
                    } else if (typeof effects[key] === 'boolean') {
                        effects[key] = effects[key] || effect[key];
                    } else {
                        effects[key] += effect[key];
                    }
                }
            }
        }
        
        return effects;
    }
    
    getSouls() {
        return this.souls;
    }
    
    getUpgradesList() {
        return this.definitions.map(def => ({
            ...def,
            level: this.getLevel(def.id),
            cost: this.getCost(def.id),
            canAfford: this.canAfford(def.id),
            isMaxed: this.getLevel(def.id) >= def.maxLevel
        }));
    }
}

export class MetaSystem {
    constructor() {
        this.highScores = new HighScoreSystem();
        this.achievements = new AchievementSystem();
        this.unlocks = new UnlockSystem();
        this.statistics = new StatisticsSystem();
        this.metaUpgrades = new MetaUpgradeSystem();
    }
    
    endRun(playerStats, gameTime) {
        const runStats = this.statistics.endRun();
        
        const scoreResult = this.highScores.addScore(
            gameTime,
            playerStats.level,
            playerStats.killCount
        );
        
        const combinedStats = {
            ...runStats,
            ...this.statistics.getGlobalStats(),
            gameTime,
            level: playerStats.level,
            killCount: playerStats.killCount
        };
        
        const newAchievements = this.achievements.check(combinedStats);
        const newUnlocks = this.unlocks.checkUnlocks(this.statistics.getGlobalStats());
        
        const baseSouls = this.calculateSouls(runStats, gameTime, playerStats.level);
        const soulsEarned = this.metaUpgrades.addSouls(baseSouls);
        
        return {
            runStats,
            scoreResult,
            newAchievements,
            newUnlocks,
            soulsEarned,
            totalSouls: this.metaUpgrades.getSouls()
        };
    }
    
    calculateSouls(runStats, gameTime, level) {
        let souls = 0;
        souls += Math.floor(gameTime / 10);
        souls += level * 5;
        souls += Math.floor(runStats.killCount / 10);
        souls += runStats.bossKills * 25;
        souls += Math.floor(runStats.maxCombo / 5);
        return souls;
    }
    
    startRun() {
        this.statistics.resetRun();
    }
    
    getMetaEffects() {
        return this.metaUpgrades.getAllEffects();
    }
}
