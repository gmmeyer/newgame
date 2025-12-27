export class PassiveSystem {
    constructor() {
        this.lifeSteal = new LifeSteal();
        this.thorns = new Thorns();
        this.magnetRange = new MagnetRange();
        this.armor = new Armor();
        this.critChance = new CritChance();
        this.expBonus = new ExpBonus();
    }
    
    onDealDamage(damage, playerStats) {
        return this.lifeSteal.onDealDamage(damage, playerStats);
    }
    
    onTakeDamage(damage, playerStats, enemyPosition, particleSystem) {
        const reducedDamage = this.armor.reduceDamage(damage);
        const thornsDamage = this.thorns.getDamage(damage);
        return { reducedDamage, thornsDamage, enemyPosition };
    }
    
    getGemPickupRadius(baseRadius) {
        return this.magnetRange.getRadius(baseRadius);
    }
    
    rollCrit(baseDamage) {
        return this.critChance.rollCrit(baseDamage);
    }
    
    getExpMultiplier() {
        return this.expBonus.getMultiplier();
    }
    
    reset() {
        this.lifeSteal.reset();
        this.thorns.reset();
        this.magnetRange.reset();
        this.armor.reset();
        this.critChance.reset();
        this.expBonus.reset();
    }
}

class LifeSteal {
    constructor() {
        this.level = 0;
        this.basePercent = 0.03;
    }
    
    get isActive() { return this.level > 0; }
    get percent() { return this.basePercent + (this.level - 1) * 0.02; }
    
    upgrade() { this.level++; }
    
    onDealDamage(damage, playerStats) {
        if (!this.isActive) return 0;
        const healAmount = Math.floor(damage * this.percent);
        const actualHeal = Math.min(healAmount, playerStats.maxHealth - playerStats.health);
        playerStats.health += actualHeal;
        return actualHeal;
    }
    
    reset() { this.level = 0; }
}

class Thorns {
    constructor() {
        this.level = 0;
        this.basePercent = 0.2;
        this.baseFlatDamage = 5;
    }
    
    get isActive() { return this.level > 0; }
    get percent() { return this.basePercent + (this.level - 1) * 0.1; }
    get flatDamage() { return this.baseFlatDamage + (this.level - 1) * 5; }
    
    upgrade() { this.level++; }
    
    getDamage(incomingDamage) {
        if (!this.isActive) return 0;
        return Math.floor(incomingDamage * this.percent) + this.flatDamage;
    }
    
    reset() { this.level = 0; }
}

class MagnetRange {
    constructor() {
        this.level = 0;
        this.baseMultiplier = 1.5;
    }
    
    get isActive() { return this.level > 0; }
    get multiplier() { return this.isActive ? this.baseMultiplier + (this.level - 1) * 0.4 : 1; }
    
    upgrade() { this.level++; }
    
    getRadius(baseRadius) {
        return baseRadius * this.multiplier;
    }
    
    reset() { this.level = 0; }
}

class Armor {
    constructor() {
        this.level = 0;
        this.baseReduction = 0.1;
    }
    
    get isActive() { return this.level > 0; }
    get reduction() { return this.isActive ? this.baseReduction + (this.level - 1) * 0.05 : 0; }
    
    upgrade() { this.level++; }
    
    reduceDamage(damage) {
        return Math.floor(damage * (1 - this.reduction));
    }
    
    reset() { this.level = 0; }
}

class CritChance {
    constructor() {
        this.level = 0;
        this.baseChance = 0.1;
        this.critMultiplier = 2;
    }
    
    get isActive() { return this.level > 0; }
    get chance() { return this.isActive ? this.baseChance + (this.level - 1) * 0.05 : 0; }
    
    upgrade() { this.level++; }
    
    rollCrit(baseDamage) {
        if (!this.isActive) return { damage: baseDamage, isCrit: false };
        const isCrit = Math.random() < this.chance;
        return {
            damage: isCrit ? Math.floor(baseDamage * this.critMultiplier) : baseDamage,
            isCrit
        };
    }
    
    reset() { this.level = 0; }
}

class ExpBonus {
    constructor() {
        this.level = 0;
        this.baseBonus = 0.15;
    }
    
    get isActive() { return this.level > 0; }
    get bonus() { return this.isActive ? this.baseBonus + (this.level - 1) * 0.1 : 0; }
    
    upgrade() { this.level++; }
    
    getMultiplier() {
        return 1 + this.bonus;
    }
    
    reset() { this.level = 0; }
}

export const passiveUpgrades = [
    {
        id: 'lifeSteal',
        name: 'Life Steal',
        desc: (level) => level === 0 ? 'Heal 3% of damage dealt' : `Heal ${3 + level * 2}% of damage dealt`,
        maxLevel: 5,
        category: 'passive',
        unlockLevel: 1
    },
    {
        id: 'thorns',
        name: 'Thorns',
        desc: (level) => level === 0 ? 'Reflect 20% + 5 damage to attackers' : `Reflect ${20 + level * 10}% + ${5 + level * 5} damage`,
        maxLevel: 5,
        category: 'passive',
        unlockLevel: 1
    },
    {
        id: 'magnetRange',
        name: 'Magnet',
        desc: (level) => level === 0 ? 'Increase gem pickup range by 50%' : `Gem pickup range +${50 + level * 40}%`,
        maxLevel: 5,
        category: 'passive',
        unlockLevel: 1
    },
    {
        id: 'armor',
        name: 'Armor',
        desc: (level) => level === 0 ? 'Reduce damage taken by 10%' : `Reduce damage by ${10 + level * 5}%`,
        maxLevel: 5,
        category: 'passive',
        unlockLevel: 3
    },
    {
        id: 'critChance',
        name: 'Critical Hit',
        desc: (level) => level === 0 ? '10% chance for 2x damage' : `${10 + level * 5}% crit chance`,
        maxLevel: 5,
        category: 'passive',
        unlockLevel: 2
    },
    {
        id: 'expBonus',
        name: 'Wisdom',
        desc: (level) => level === 0 ? 'Gain 15% more experience' : `+${15 + level * 10}% experience`,
        maxLevel: 5,
        category: 'passive',
        unlockLevel: 2
    }
];
