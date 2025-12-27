import * as THREE from 'three';

export const TextureGenerator = {
    
    createGroundTexture() {
        const size = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#080812';
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        const hexSize = 40;
        for (let row = 0; row < size / hexSize + 1; row++) {
            for (let col = 0; col < size / hexSize + 1; col++) {
                const x = col * hexSize * 1.5;
                const y = row * hexSize * Math.sqrt(3) + (col % 2) * hexSize * Math.sqrt(3) / 2;
                this.drawHex(ctx, x, y, hexSize / 2);
            }
        }
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 50; i++) {
            const startX = Math.random() * size;
            const startY = Math.random() * size;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            let x = startX, y = startY;
            for (let j = 0; j < 10; j++) {
                const dir = Math.floor(Math.random() * 4);
                const len = 20 + Math.random() * 40;
                if (dir === 0) x += len;
                else if (dir === 1) x -= len;
                else if (dir === 2) y += len;
                else y -= len;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        
        const mainGridSize = 128;
        for (let i = 0; i <= size; i += mainGridSize) {
            const gradH = ctx.createLinearGradient(0, i - 2, 0, i + 2);
            gradH.addColorStop(0, 'rgba(0, 255, 255, 0)');
            gradH.addColorStop(0.5, 'rgba(0, 255, 255, 0.6)');
            gradH.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = gradH;
            ctx.fillRect(0, i - 2, size, 4);
            
            const gradV = ctx.createLinearGradient(i - 2, 0, i + 2, 0);
            gradV.addColorStop(0, 'rgba(0, 255, 255, 0)');
            gradV.addColorStop(0.5, 'rgba(0, 255, 255, 0.6)');
            gradV.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = gradV;
            ctx.fillRect(i - 2, 0, 4, size);
        }
        
        const subGridSize = 32;
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= size; i += subGridSize) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, size);
            ctx.moveTo(0, i);
            ctx.lineTo(size, i);
            ctx.stroke();
        }
        
        for (let x = 0; x <= size; x += mainGridSize) {
            for (let y = 0; y <= size; y += mainGridSize) {
                const nodeGrad = ctx.createRadialGradient(x, y, 0, x, y, 12);
                nodeGrad.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
                nodeGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.3)');
                nodeGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
                ctx.fillStyle = nodeGrad;
                ctx.fillRect(x - 12, y - 12, 24, 24);
            }
        }
        
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const pulseGrad = ctx.createRadialGradient(x, y, 0, x, y, 20);
            pulseGrad.addColorStop(0, 'rgba(255, 0, 255, 0.3)');
            pulseGrad.addColorStop(0.5, 'rgba(255, 0, 255, 0.1)');
            pulseGrad.addColorStop(1, 'rgba(255, 0, 255, 0)');
            ctx.fillStyle = pulseGrad;
            ctx.fillRect(x - 20, y - 20, 40, 40);
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
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.15, '#00ffff');
        grad.addColorStop(0.4, '#0088cc');
        grad.addColorStop(0.7, '#004466');
        grad.addColorStop(1, '#001122');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        for (let r = 20; r < size/2; r += 20) {
            ctx.beginPath();
            ctx.arc(size/2, size/2, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI / 6) * i;
            ctx.beginPath();
            ctx.moveTo(size/2 + Math.cos(angle) * 20, size/2 + Math.sin(angle) * 20);
            ctx.lineTo(size/2 + Math.cos(angle) * size/2, size/2 + Math.sin(angle) * size/2);
            ctx.stroke();
        }
        
        ctx.fillStyle = 'rgba(255, 0, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(size/2, size/2, 30, 0, Math.PI * 2);
        ctx.fill();
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createEnemyTexture(type) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        switch(type) {
            case 'basic': return this.createBasicEnemyTexture(ctx, size);
            case 'fast': return this.createFastEnemyTexture(ctx, size);
            case 'tank': return this.createTankEnemyTexture(ctx, size);
            case 'exploder': return this.createExploderTexture(ctx, size);
            case 'splitter': return this.createSplitterTexture(ctx, size);
            case 'splitter_child': return this.createSplitterChildTexture(ctx, size);
            case 'shooter': return this.createShooterTexture(ctx, size);
            case 'ghost': return this.createGhostTexture(ctx, size);
            case 'teleporter': return this.createTeleporterTexture(ctx, size);
            case 'elite_basic': return this.createEliteBasicTexture(ctx, size);
            case 'elite_fast': return this.createEliteFastTexture(ctx, size);
            case 'boss': return this.createBossTexture(ctx, size);
            default: return this.createBasicEnemyTexture(ctx, size);
        }
    },
    
    createBasicEnemyTexture(ctx, size) {
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#ff6666');
        grad.addColorStop(0.4, '#cc3333');
        grad.addColorStop(0.8, '#880000');
        grad.addColorStop(1, '#330000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.lineWidth = 3;
        const gridStep = size / 8;
        for (let i = 0; i <= size; i += gridStep) {
            ctx.beginPath();
            ctx.moveTo(i, 0); ctx.lineTo(i, size);
            ctx.moveTo(0, i); ctx.lineTo(size, i);
            ctx.stroke();
        }
        
        ctx.fillStyle = 'rgba(255, 200, 200, 0.8)';
        ctx.beginPath();
        ctx.arc(size * 0.35, size * 0.4, 15, 0, Math.PI * 2);
        ctx.arc(size * 0.65, size * 0.4, 15, 0, Math.PI * 2);
        ctx.fill();
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createFastEnemyTexture(ctx, size) {
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, '#dd00ff');
        grad.addColorStop(0.5, '#8800aa');
        grad.addColorStop(1, '#440066');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(255, 100, 255, 0.6)';
        ctx.lineWidth = 4;
        for (let i = 0; i < 8; i++) {
            const y = size * 0.1 + (size * 0.8 / 8) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size * 0.7, y);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(size * 0.7, y);
            ctx.lineTo(size, y - 10);
            ctx.lineTo(size, y + 10);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 100, 255, 0.6)';
            ctx.fill();
        }
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createTankEnemyTexture(ctx, size) {
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#44ff88');
        grad.addColorStop(0.3, '#22aa55');
        grad.addColorStop(0.7, '#116633');
        grad.addColorStop(1, '#003311');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(0, 50, 0, 0.8)';
        ctx.lineWidth = 8;
        for (let r = 30; r < size/2; r += 25) {
            ctx.beginPath();
            ctx.arc(size/2, size/2, r, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        ctx.fillStyle = 'rgba(100, 255, 150, 0.3)';
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = size/2 + Math.cos(angle) * size * 0.3;
            const y = size/2 + Math.sin(angle) * size * 0.3;
            ctx.beginPath();
            ctx.arc(x, y, 20, 0, Math.PI * 2);
            ctx.fill();
        }
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createExploderTexture(ctx, size) {
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(0, 0, size, size);
        
        ctx.fillStyle = '#000000';
        const stripeWidth = size / 10;
        for (let i = -size; i < size * 2; i += stripeWidth * 2) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + size, size);
            ctx.lineTo(i + size + stripeWidth, size);
            ctx.lineTo(i + stripeWidth, 0);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 4;
        const warningSize = size * 0.4;
        ctx.beginPath();
        ctx.moveTo(size/2, size/2 - warningSize/2);
        ctx.lineTo(size/2 + warningSize/2, size/2 + warningSize/2);
        ctx.lineTo(size/2 - warningSize/2, size/2 + warningSize/2);
        ctx.closePath();
        ctx.stroke();
        
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', size/2, size/2 + 10);
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createSplitterTexture(ctx, size) {
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#88ffff');
        grad.addColorStop(0.4, '#00ccdd');
        grad.addColorStop(0.8, '#006688');
        grad.addColorStop(1, '#002233');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(150, 255, 255, 0.7)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
            const cx = size/2 + (i - 1) * 40;
            const cy = size/2;
            ctx.beginPath();
            ctx.arc(cx, cy, 25, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(size/2, size/2);
            ctx.lineTo(cx, cy);
            ctx.stroke();
        }
        
        ctx.fillStyle = 'rgba(200, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(size/2, size/2, 15, 0, Math.PI * 2);
        ctx.fill();
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createSplitterChildTexture(ctx, size) {
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#aaffff');
        grad.addColorStop(0.5, '#44ddee');
        grad.addColorStop(1, '#0088aa');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(200, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(size/2, size/2, size * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createShooterTexture(ctx, size) {
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#ffff88');
        grad.addColorStop(0.3, '#dddd00');
        grad.addColorStop(0.7, '#888800');
        grad.addColorStop(1, '#333300');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(255, 255, 100, 0.6)';
        ctx.lineWidth = 2;
        const techSize = 15;
        for (let x = techSize; x < size; x += techSize * 2) {
            for (let y = techSize; y < size; y += techSize * 2) {
                ctx.strokeRect(x - techSize/2, y - techSize/2, techSize, techSize);
            }
        }
        
        const eyeGrad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, 40);
        eyeGrad.addColorStop(0, '#ff0000');
        eyeGrad.addColorStop(0.3, '#ff0000');
        eyeGrad.addColorStop(0.5, '#880000');
        eyeGrad.addColorStop(1, 'rgba(136, 0, 0, 0)');
        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.arc(size/2, size/2, 40, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(size/2, size/2, 8, 0, Math.PI * 2);
        ctx.fill();
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createGhostTexture(ctx, size) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        
        const imageData = ctx.getImageData(0, 0, size, size);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const noise = Math.random() * 150;
            const base = 180 + Math.random() * 75;
            imageData.data[i] = base - noise * 0.3;
            imageData.data[i+1] = base - noise * 0.3;
            imageData.data[i+2] = base;
            imageData.data[i+3] = 200 + Math.random() * 55;
        }
        ctx.putImageData(imageData, 0, 0);
        
        ctx.strokeStyle = 'rgba(100, 100, 120, 0.3)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * size, Math.random() * size);
            ctx.lineTo(Math.random() * size, Math.random() * size);
            ctx.stroke();
        }
        
        ctx.fillStyle = 'rgba(50, 50, 80, 0.7)';
        ctx.beginPath();
        ctx.ellipse(size * 0.35, size * 0.4, 20, 30, 0, 0, Math.PI * 2);
        ctx.ellipse(size * 0.65, size * 0.4, 20, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createTeleporterTexture(ctx, size) {
        ctx.fillStyle = '#220033';
        ctx.fillRect(0, 0, size, size);
        
        for (let r = 0; r < 8; r++) {
            const ringGrad = ctx.createRadialGradient(size/2, size/2, r * 15, size/2, size/2, r * 15 + 15);
            ringGrad.addColorStop(0, 'rgba(255, 0, 255, 0)');
            ringGrad.addColorStop(0.5, `rgba(255, 0, 255, ${0.3 - r * 0.03})`);
            ringGrad.addColorStop(1, 'rgba(255, 0, 255, 0)');
            ctx.fillStyle = ringGrad;
            ctx.fillRect(0, 0, size, size);
        }
        
        ctx.strokeStyle = 'rgba(255, 150, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 200; i++) {
            const angle = i * 0.15;
            const r = 10 + i * 0.5;
            const x = size/2 + Math.cos(angle) * r;
            const y = size/2 + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        
        const coreGrad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, 30);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.5, '#ff00ff');
        coreGrad.addColorStop(1, 'rgba(255, 0, 255, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(size/2, size/2, 30, 0, Math.PI * 2);
        ctx.fill();
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createEliteBasicTexture(ctx, size) {
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#ffaa00');
        grad.addColorStop(0.3, '#ff4400');
        grad.addColorStop(0.7, '#aa0000');
        grad.addColorStop(1, '#440000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 4;
        const crownY = size * 0.2;
        ctx.beginPath();
        ctx.moveTo(size * 0.2, crownY + 40);
        ctx.lineTo(size * 0.2, crownY);
        ctx.lineTo(size * 0.35, crownY + 20);
        ctx.lineTo(size * 0.5, crownY - 10);
        ctx.lineTo(size * 0.65, crownY + 20);
        ctx.lineTo(size * 0.8, crownY);
        ctx.lineTo(size * 0.8, crownY + 40);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
        ctx.fill();
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createEliteFastTexture(ctx, size) {
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, '#ff00ff');
        grad.addColorStop(0.5, '#ff8800');
        grad.addColorStop(1, '#ffff00');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 6;
        for (let i = 0; i < 5; i++) {
            const y = size * 0.2 + (size * 0.6 / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size * 0.6, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(size * 0.7, size * 0.3);
        ctx.lineTo(size, size * 0.5);
        ctx.lineTo(size * 0.7, size * 0.7);
        ctx.closePath();
        ctx.fill();
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createBossTexture(ctx, size) {
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#ff2200');
        grad.addColorStop(0.3, '#aa0000');
        grad.addColorStop(0.6, '#660000');
        grad.addColorStop(1, '#220000');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20;
        
        const runePatterns = [
            [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7], [0.3, 0.3]],
            [[0.5, 0.2], [0.5, 0.8]],
            [[0.2, 0.5], [0.8, 0.5]],
            [[0.35, 0.35], [0.65, 0.65]],
            [[0.65, 0.35], [0.35, 0.65]]
        ];
        
        runePatterns.forEach(pattern => {
            ctx.beginPath();
            pattern.forEach((point, i) => {
                const x = point[0] * size;
                const y = point[1] * size;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        });
        
        ctx.beginPath();
        ctx.arc(size/2, size/2, size * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 4) * i;
            const innerR = size * 0.35;
            const outerR = size * 0.45;
            ctx.beginPath();
            ctx.moveTo(size/2 + Math.cos(angle) * innerR, size/2 + Math.sin(angle) * innerR);
            ctx.lineTo(size/2 + Math.cos(angle) * outerR, size/2 + Math.sin(angle) * outerR);
            ctx.stroke();
        }
        
        const eyeGrad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, 25);
        eyeGrad.addColorStop(0, '#ffffff');
        eyeGrad.addColorStop(0.3, '#ffff00');
        eyeGrad.addColorStop(0.6, '#ff0000');
        eyeGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.shadowBlur = 0;
        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.arc(size/2, size/2, 25, 0, Math.PI * 2);
        ctx.fill();
        
        return new THREE.CanvasTexture(ctx.canvas);
    },
    
    createShieldTexture() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, 'rgba(0, 255, 255, 0.9)');
        grad.addColorStop(0.5, 'rgba(0, 200, 255, 0.6)');
        grad.addColorStop(0.8, 'rgba(0, 150, 255, 0.3)');
        grad.addColorStop(1, 'rgba(0, 100, 200, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        const hexSize = 20;
        for (let row = 0; row < size / hexSize + 1; row++) {
            for (let col = 0; col < size / hexSize + 1; col++) {
                const x = col * hexSize * 1.5;
                const y = row * hexSize * Math.sqrt(3) + (col % 2) * hexSize * Math.sqrt(3) / 2;
                this.drawHex(ctx, x, y, hexSize / 2);
            }
        }
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(size/2, size/2, 15, 0, Math.PI * 2);
        ctx.fill();
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createLightningTexture() {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const grad = ctx.createLinearGradient(0, 0, size, 0);
        grad.addColorStop(0, 'rgba(0, 255, 255, 0)');
        grad.addColorStop(0.3, 'rgba(100, 255, 255, 0.5)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.7, 'rgba(100, 255, 255, 0.5)');
        grad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createNovaTexture() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.1, 'rgba(255, 200, 100, 0.9)');
        grad.addColorStop(0.3, 'rgba(255, 100, 0, 0.6)');
        grad.addColorStop(0.6, 'rgba(255, 50, 0, 0.3)');
        grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(255, 200, 100, 0.8)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 16; i++) {
            const angle = (Math.PI / 8) * i;
            const len = size * 0.4 + Math.random() * size * 0.1;
            ctx.beginPath();
            ctx.moveTo(size/2, size/2);
            ctx.lineTo(size/2 + Math.cos(angle) * len, size/2 + Math.sin(angle) * len);
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
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(size/2, size/2, size * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createGemTexture() {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.2, '#88ffaa');
        grad.addColorStop(0.5, '#00ff66');
        grad.addColorStop(0.8, '#00aa44');
        grad.addColorStop(1, 'rgba(0,100,50,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(size/2, size * 0.1);
        ctx.lineTo(size/2, size * 0.9);
        ctx.moveTo(size * 0.1, size/2);
        ctx.lineTo(size * 0.9, size/2);
        ctx.moveTo(size * 0.2, size * 0.2);
        ctx.lineTo(size * 0.8, size * 0.8);
        ctx.moveTo(size * 0.8, size * 0.2);
        ctx.lineTo(size * 0.2, size * 0.8);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(size * 0.35, size * 0.35, 10, 0, Math.PI * 2);
        ctx.fill();
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createParticleTexture() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.2, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
        grad.addColorStop(0.8, 'rgba(255,255,255,0.2)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createPowerupTexture(type) {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        const colors = {
            invincibility: { primary: '#00ffff', secondary: '#0088aa' },
            damageBoost: { primary: '#ff0000', secondary: '#880000' },
            speedBoost: { primary: '#ffff00', secondary: '#888800' },
            magnetPulse: { primary: '#00ff00', secondary: '#008800' }
        };
        
        const c = colors[type] || colors.invincibility;
        
        const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, c.primary);
        grad.addColorStop(0.7, c.secondary);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 3;
        
        if (type === 'invincibility') {
            ctx.beginPath();
            ctx.moveTo(size/2, size * 0.2);
            ctx.lineTo(size * 0.7, size * 0.35);
            ctx.lineTo(size * 0.7, size * 0.6);
            ctx.lineTo(size/2, size * 0.8);
            ctx.lineTo(size * 0.3, size * 0.6);
            ctx.lineTo(size * 0.3, size * 0.35);
            ctx.closePath();
            ctx.stroke();
        } else if (type === 'damageBoost') {
            ctx.beginPath();
            ctx.moveTo(size * 0.3, size * 0.3);
            ctx.lineTo(size * 0.7, size * 0.5);
            ctx.lineTo(size * 0.3, size * 0.7);
            ctx.lineTo(size * 0.4, size * 0.5);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(size * 0.5, size * 0.3);
            ctx.lineTo(size * 0.8, size * 0.5);
            ctx.lineTo(size * 0.5, size * 0.7);
            ctx.stroke();
        } else if (type === 'speedBoost') {
            for (let i = 0; i < 3; i++) {
                const x = size * 0.25 + i * size * 0.15;
                ctx.beginPath();
                ctx.moveTo(x, size * 0.3);
                ctx.lineTo(x + size * 0.2, size * 0.5);
                ctx.lineTo(x, size * 0.7);
                ctx.stroke();
            }
        } else if (type === 'magnetPulse') {
            ctx.beginPath();
            ctx.arc(size/2, size/2, size * 0.25, Math.PI, 0);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(size/2, size/2, size * 0.25, 0, Math.PI);
            ctx.stroke();
            ctx.fillStyle = c.primary;
            ctx.fillRect(size * 0.35, size * 0.4, size * 0.1, size * 0.2);
            ctx.fillRect(size * 0.55, size * 0.4, size * 0.1, size * 0.2);
        }
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createHazardTexture(type) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        if (type === 'laser') {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(0, 0, size, size);
            
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            const gridStep = size / 8;
            for (let i = 0; i <= size; i += gridStep) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, size);
                ctx.moveTo(0, i);
                ctx.lineTo(size, i);
                ctx.stroke();
            }
            
            ctx.strokeStyle = '#ff4444';
            ctx.lineWidth = 4;
            ctx.strokeRect(10, 10, size - 20, size - 20);
            
        } else if (type === 'danger') {
            const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            grad.addColorStop(0, 'rgba(255, 100, 0, 0.8)');
            grad.addColorStop(0.5, 'rgba(255, 50, 0, 0.4)');
            grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, size, size);
            
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(size/2, size/2, size * 0.4, 0, Math.PI * 2);
            ctx.stroke();
            
        } else if (type === 'orb') {
            const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.2, '#00ffff');
            grad.addColorStop(0.5, '#0088aa');
            grad.addColorStop(0.8, '#004466');
            grad.addColorStop(1, 'rgba(0, 50, 100, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, size, size);
            
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
            ctx.lineWidth = 2;
            for (let r = 30; r < size/2; r += 20) {
                ctx.beginPath();
                ctx.arc(size/2, size/2, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
        return new THREE.CanvasTexture(canvas);
    },
    
    createUpgradeIcon(type) {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, size, size);
        
        ctx.strokeStyle = '#00ffff';
        ctx.fillStyle = '#00ffff';
        ctx.lineWidth = 2;
        
        const icons = {
            maxHealth: () => {
                ctx.beginPath();
                ctx.moveTo(size/2, size * 0.15);
                ctx.bezierCurveTo(size * 0.8, size * 0.15, size * 0.8, size * 0.5, size/2, size * 0.85);
                ctx.bezierCurveTo(size * 0.2, size * 0.5, size * 0.2, size * 0.15, size/2, size * 0.15);
                ctx.fillStyle = '#ff0000';
                ctx.fill();
            },
            speed: () => {
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    ctx.moveTo(size * 0.2 + i * 10, size * 0.3);
                    ctx.lineTo(size * 0.6 + i * 10, size * 0.5);
                    ctx.lineTo(size * 0.2 + i * 10, size * 0.7);
                    ctx.stroke();
                }
            },
            damage: () => {
                ctx.beginPath();
                ctx.moveTo(size/2, size * 0.1);
                ctx.lineTo(size * 0.7, size * 0.3);
                ctx.lineTo(size * 0.6, size * 0.5);
                ctx.lineTo(size * 0.8, size * 0.5);
                ctx.lineTo(size/2, size * 0.9);
                ctx.lineTo(size * 0.55, size * 0.55);
                ctx.lineTo(size * 0.35, size * 0.55);
                ctx.closePath();
                ctx.fillStyle = '#ffff00';
                ctx.fill();
            },
            orbitingShields: () => {
                ctx.beginPath();
                ctx.arc(size/2, size/2, size * 0.2, 0, Math.PI * 2);
                ctx.stroke();
                for (let i = 0; i < 3; i++) {
                    const angle = (Math.PI * 2 / 3) * i;
                    const x = size/2 + Math.cos(angle) * size * 0.35;
                    const y = size/2 + Math.sin(angle) * size * 0.35;
                    ctx.beginPath();
                    ctx.arc(x, y, 8, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
            areaNova: () => {
                for (let r = 1; r <= 3; r++) {
                    ctx.beginPath();
                    ctx.arc(size/2, size/2, r * 12, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.fillStyle = '#ff6600';
                ctx.beginPath();
                ctx.arc(size/2, size/2, 8, 0, Math.PI * 2);
                ctx.fill();
            },
            chainLightning: () => {
                ctx.beginPath();
                ctx.moveTo(size * 0.2, size * 0.3);
                ctx.lineTo(size * 0.4, size * 0.5);
                ctx.lineTo(size * 0.3, size * 0.5);
                ctx.lineTo(size * 0.5, size * 0.7);
                ctx.lineTo(size * 0.6, size * 0.5);
                ctx.lineTo(size * 0.8, size * 0.7);
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 3;
                ctx.stroke();
            },
            lifeSteal: () => {
                ctx.beginPath();
                ctx.moveTo(size/2, size * 0.2);
                ctx.bezierCurveTo(size * 0.75, size * 0.2, size * 0.75, size * 0.5, size/2, size * 0.8);
                ctx.bezierCurveTo(size * 0.25, size * 0.5, size * 0.25, size * 0.2, size/2, size * 0.2);
                ctx.fillStyle = '#00ff00';
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(size * 0.35, size * 0.5);
                ctx.lineTo(size/2, size * 0.5);
                ctx.lineTo(size/2, size * 0.35);
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
            }
        };
        
        if (icons[type]) {
            icons[type]();
        } else {
            ctx.beginPath();
            ctx.arc(size/2, size/2, size * 0.35, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#00ffff';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', size/2, size/2);
        }
        
        return canvas.toDataURL();
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
            case 'shield': textureCache[type] = TextureGenerator.createShieldTexture(); break;
            case 'lightning': textureCache[type] = TextureGenerator.createLightningTexture(); break;
            case 'nova': textureCache[type] = TextureGenerator.createNovaTexture(); break;
            case 'hazard_laser': textureCache[type] = TextureGenerator.createHazardTexture('laser'); break;
            case 'hazard_danger': textureCache[type] = TextureGenerator.createHazardTexture('danger'); break;
            case 'hazard_orb': textureCache[type] = TextureGenerator.createHazardTexture('orb'); break;
            default:
                if (type.startsWith('enemy_')) {
                    textureCache[type] = TextureGenerator.createEnemyTexture(type.replace('enemy_', ''));
                } else if (type.startsWith('powerup_')) {
                    textureCache[type] = TextureGenerator.createPowerupTexture(type.replace('powerup_', ''));
                }
        }
    }
    return textureCache[type];
}

export function getUpgradeIcon(type) {
    return TextureGenerator.createUpgradeIcon(type);
}
