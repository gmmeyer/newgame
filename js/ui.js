import * as THREE from 'three';

export class EnemyHealthBars {
    constructor(scene) {
        this.scene = scene;
        this.healthBars = new Map();
    }
    
    createHealthBar(enemy) {
        const group = new THREE.Group();
        
        const bgGeometry = new THREE.PlaneGeometry(1.2, 0.15);
        const bgMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000, 
            transparent: true, 
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        const background = new THREE.Mesh(bgGeometry, bgMaterial);
        group.add(background);
        
        const fgGeometry = new THREE.PlaneGeometry(1.1, 0.1);
        const fgMaterial = new THREE.MeshBasicMaterial({ 
            color: this.getHealthColor(enemy.userData),
            side: THREE.DoubleSide
        });
        const foreground = new THREE.Mesh(fgGeometry, fgMaterial);
        foreground.position.z = 0.01;
        group.add(foreground);
        
        if (enemy.userData.isBoss) {
            const borderGeometry = new THREE.EdgesGeometry(bgGeometry);
            const borderMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
            const border = new THREE.LineSegments(borderGeometry, borderMaterial);
            group.add(border);
        }
        
        group.userData = { foreground, enemy };
        this.healthBars.set(enemy.uuid, group);
        this.scene.add(group);
        
        return group;
    }
    
    getHealthColor(userData) {
        if (userData.isBoss) return 0xff0000;
        if (userData.isElite) return 0xffaa00;
        return 0x00ff00;
    }
    
    update(camera, enemies) {
        const toRemove = [];
        
        this.healthBars.forEach((bar, uuid) => {
            const enemy = bar.userData.enemy;
            
            if (!enemies.includes(enemy)) {
                toRemove.push(uuid);
                return;
            }
            
            const healthPercent = enemy.userData.health / enemy.userData.maxHealth;
            
            if (healthPercent >= 1 && !enemy.userData.isBoss && !enemy.userData.isElite) {
                bar.visible = false;
                return;
            }
            
            bar.visible = true;
            
            const scale = enemy.userData.scale || 1;
            const yOffset = enemy.userData.isBoss ? 4 : (enemy.userData.isElite ? 2.5 : 1.8);
            bar.position.copy(enemy.position);
            bar.position.y += yOffset * scale;
            
            bar.lookAt(camera.position);
            
            const fg = bar.userData.foreground;
            fg.scale.x = Math.max(0.01, healthPercent);
            fg.position.x = -(1 - healthPercent) * 0.55;
            
            if (healthPercent < 0.3) {
                fg.material.color.setHex(0xff0000);
            } else if (healthPercent < 0.6) {
                fg.material.color.setHex(0xffaa00);
            } else {
                fg.material.color.setHex(this.getHealthColor(enemy.userData));
            }
        });
        
        toRemove.forEach(uuid => {
            const bar = this.healthBars.get(uuid);
            this.scene.remove(bar);
            bar.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
            this.healthBars.delete(uuid);
        });
    }
    
    ensureHealthBar(enemy) {
        if (!this.healthBars.has(enemy.uuid)) {
            if (enemy.userData.isBoss || enemy.userData.isElite || enemy.userData.type === 'tank') {
                this.createHealthBar(enemy);
            }
        }
    }
    
    reset() {
        this.healthBars.forEach(bar => {
            this.scene.remove(bar);
            bar.children.forEach(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        });
        this.healthBars.clear();
    }
}

export class Minimap {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.size = 150;
        this.range = 50;
        this.init();
    }
    
    init() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'minimap';
        this.canvas.width = this.size;
        this.canvas.height = this.size;
        this.ctx = this.canvas.getContext('2d');
        
        document.body.appendChild(this.canvas);
    }
    
    update(playerPosition, enemies, gems) {
        const ctx = this.ctx;
        const size = this.size;
        const range = this.range;
        const center = size / 2;
        const scale = size / (range * 2);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(center, center, size * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(center, center, size * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.moveTo(center, 0);
        ctx.lineTo(center, size);
        ctx.moveTo(0, center);
        ctx.lineTo(size, center);
        ctx.stroke();
        
        gems.forEach(gem => {
            const dx = gem.position.x - playerPosition.x;
            const dz = gem.position.z - playerPosition.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            if (dist < range) {
                const x = center + dx * scale;
                const y = center + dz * scale;
                
                ctx.fillStyle = '#00ff88';
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        
        enemies.forEach(enemy => {
            const dx = enemy.position.x - playerPosition.x;
            const dz = enemy.position.z - playerPosition.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            
            if (dist < range) {
                const x = center + dx * scale;
                const y = center + dz * scale;
                
                if (enemy.userData.isBoss) {
                    ctx.fillStyle = '#ff0000';
                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, Math.PI * 2);
                    ctx.fill();
                    
                    ctx.strokeStyle = '#ff0000';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.arc(x, y, 7, 0, Math.PI * 2);
                    ctx.stroke();
                } else if (enemy.userData.isElite) {
                    ctx.fillStyle = '#ffaa00';
                    ctx.beginPath();
                    ctx.arc(x, y, 4, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    ctx.fillStyle = '#ff4444';
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (enemy.userData.isBoss) {
                const angle = Math.atan2(dz, dx);
                const edgeX = center + Math.cos(angle) * (size * 0.45);
                const edgeY = center + Math.sin(angle) * (size * 0.45);
                
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.moveTo(edgeX + Math.cos(angle) * 6, edgeY + Math.sin(angle) * 6);
                ctx.lineTo(edgeX + Math.cos(angle + 2.5) * 4, edgeY + Math.sin(angle + 2.5) * 4);
                ctx.lineTo(edgeX + Math.cos(angle - 2.5) * 4, edgeY + Math.sin(angle - 2.5) * 4);
                ctx.closePath();
                ctx.fill();
            }
        });
        
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(center, center, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center, center, 6, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size, size);
    }
    
    show() {
        if (this.canvas) this.canvas.style.display = 'block';
    }
    
    hide() {
        if (this.canvas) this.canvas.style.display = 'none';
    }
    
    destroy() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}
