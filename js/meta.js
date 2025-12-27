const STORAGE_KEYS = {
    HIGH_SCORES: 'survivor3d_highscores',
    ACHIEVEMENTS: 'survivor3d_achievements',
    UNLOCKS: 'survivor3d_unlocks',
    STATISTICS: 'survivor3d_statistics'
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

export class MetaSystem {
    constructor() {
        this.highScores = new HighScoreSystem();
        this.achievements = new AchievementSystem();
        this.unlocks = new UnlockSystem();
        this.statistics = new StatisticsSystem();
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
        
        return {
            runStats,
            scoreResult,
            newAchievements,
            newUnlocks
        };
    }
    
    startRun() {
        this.statistics.resetRun();
    }
}
