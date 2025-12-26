import * as THREE from 'three';

export const TextureGenerator = {
    createGroundTexture() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        const hexSize = 30;
        for (let row = 0; row < size / hexSize + 1; row++) {
            for (let col = 0; col < size / hexSize + 1; col++) {
                const x = col * hexSize * 1.5;
                const y = row * hexSize * Math.sqrt(3) + (col % 2) * hexSize * Math.sqrt(3) / 2;
                this.drawHex(ctx, x, y, hexSize / 2);
            }
        }
        
        const gridSize = 64;
        for (let i = 0; i <= size; i += gridSize) {
            const gradH = ctx.createLinearGradient(0, i - 2, 0, i + 2);
            gradH.addColorStop(0, 'rgba(0, 255, 255, 0)');
            gradH.addColorStop(0.5, 'rgba(0, 255, 255, 0.8)');
            gradH.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = gradH;
            ctx.fillRect(0, i - 2, size, 4);
            
            const gradV = ctx.createLinearGradient(i - 2, 0, i + 2, 0);
            gradV.addColorStop(0, 'rgba(0, 255, 255, 0)');
            gradV.addColorStop(0.5, 'rgba(0, 255, 255, 0.8)');
            gradV.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = gradV;
            ctx.fillRect(i - 2, 0, 4, size);
        }
        
        ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
        for (let x = 0; x <= size; x += gridSize) {
            for (let y = 0; y <= size; y += gridSize) {
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    },
    
    drawHex(ctx, x, y, size) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const px = x + size * Math.cos(angle);
            const py = y + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
    },
    
    createPlayerTexture() {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.2, '#00ffff');
        grad.addColorStop(0.5, '#0088aa');
        grad.addColorStop(1, '#003344');
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 4) * i;
            ctx.beginPath();
            ctx.moveTo(size/2, size/2);
            ctx.lineTo(
                size/2 + Math.cos(angle) * size/2,
                size/2 + Math.sin(angle) * size/2
            );
            ctx.stroke();
        }
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createEnemyTexture(type) {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const colors = {
            basic: { primary: '#ff3333', secondary: '#aa0000' },
            fast: { primary: '#aa00ff', secondary: '#660099' },
            tank: { primary: '#00ff66', secondary: '#008833' },
            exploder: { primary: '#ff6600', secondary: '#cc3300' },
            splitter: { primary: '#00ddff', secondary: '#0088aa' },
            shooter: { primary: '#ffff00', secondary: '#aaaa00' },
            ghost: { primary: '#ffffff', secondary: '#888888' },
            teleporter: { primary: '#ff00ff', secondary: '#aa00aa' },
            elite_basic: { primary: '#ff0000', secondary: '#ffaa00' },
            elite_fast: { primary: '#ff00ff', secondary: '#ffaa00' },
            boss: { primary: '#880000', secondary: '#ff0000' }
        };
        
        const c = colors[type] || colors.basic;
        
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, c.primary);
        grad.addColorStop(0.7, c.secondary);
        grad.addColorStop(1, '#000000');
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        if (type === 'exploder') {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 8;
            for (let i = 0; i < size * 2; i += 20) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i - size, size);
                ctx.stroke();
            }
        } else if (type === 'ghost') {
            const imageData = ctx.getImageData(0, 0, size, size);
            for (let i = 0; i < imageData.data.length; i += 4) {
                const noise = Math.random() * 100 - 50;
                imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + noise));
                imageData.data[i+1] = Math.min(255, Math.max(0, imageData.data[i+1] + noise));
                imageData.data[i+2] = Math.min(255, Math.max(0, imageData.data[i+2] + noise));
            }
            ctx.putImageData(imageData, 0, 0);
        } else if (type === 'teleporter') {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            for (let i = 0; i < 100; i++) {
                const angle = i * 0.2;
                const r = i * 0.6;
                const x = size/2 + Math.cos(angle) * r;
                const y = size/2 + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else if (type === 'boss') {
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 4;
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 10;
            const runeSize = 20;
            ctx.strokeRect(size/2 - runeSize, size/2 - runeSize, runeSize*2, runeSize*2);
            ctx.beginPath();
            ctx.moveTo(size/2, size/2 - runeSize - 10);
            ctx.lineTo(size/2, size/2 + runeSize + 10);
            ctx.moveTo(size/2 - runeSize - 10, size/2);
            ctx.lineTo(size/2 + runeSize + 10, size/2);
            ctx.stroke();
        }
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createProjectileTexture(color = '#ffff00') {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.2, color);
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createGemTexture() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, '#00ff88');
        grad.addColorStop(0.6, '#00aa55');
        grad.addColorStop(1, 'rgba(0,100,50,0)');
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(size/2, 0);
        ctx.lineTo(size/2, size);
        ctx.moveTo(0, size/2);
        ctx.lineTo(size, size/2);
        ctx.stroke();
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createParticleTexture() {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
        grad.addColorStop(0.7, 'rgba(255,255,255,0.3)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        return new THREE.CanvasTexture(canvas);
    }
};

const textureCache = {};

export function getTexture(type) {
    if (!textureCache[type]) {
        switch(type) {
            case 'ground': textureCache[type] = TextureGenerator.createGroundTexture(); break;
            case 'player': textureCache[type] = TextureGenerator.createPlayerTexture(); break;
            case 'particle': textureCache[type] = TextureGenerator.createParticleTexture(); break;
            case 'gem': textureCache[type] = TextureGenerator.createGemTexture(); break;
            case 'projectile': textureCache[type] = TextureGenerator.createProjectileTexture('#ffff00'); break;
            case 'enemyProjectile': textureCache[type] = TextureGenerator.createProjectileTexture('#ff0000'); break;
            default:
                if (type.startsWith('enemy_')) {
                    textureCache[type] = TextureGenerator.createEnemyTexture(type.replace('enemy_', ''));
                }
        }
    }
    return textureCache[type];
}
