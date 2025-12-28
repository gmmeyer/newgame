import * as THREE from 'three';

export class ScreenShake {
    constructor() {
        this.trauma = 0;
        this.traumaDecay = 2.0;
        this.maxOffset = 0.8;
        this.maxRotation = 0.03;
        this.shakeTime = 0;
        this.enabled = true;
    }
    
    addTrauma(amount) {
        if (!this.enabled) return;
        this.trauma = Math.min(1, this.trauma + amount);
    }
    
    update(deltaTime, camera, originalPosition) {
        if (this.trauma <= 0) return;
        
        this.shakeTime += deltaTime;
        this.trauma = Math.max(0, this.trauma - this.traumaDecay * deltaTime);
        
        const shake = this.trauma * this.trauma;
        
        const offsetX = Math.sin(this.shakeTime * 50) * this.maxOffset * shake;
        const offsetY = Math.sin(this.shakeTime * 60 + 100) * this.maxOffset * shake;
        const rotation = Math.sin(this.shakeTime * 55 + 200) * this.maxRotation * shake;
        
        camera.position.x = originalPosition.x + offsetX;
        camera.position.y = originalPosition.y + offsetY;
        camera.rotation.z = rotation;
    }
}

export class TimeController {
    constructor() {
        this.timeScale = 1;
        this.freezeDuration = 0;
        this.slowMoDuration = 0;
        this.slowMoScale = 1;
        this.targetTimeScale = 1;
    }
    
    freeze(duration) {
        this.freezeDuration = Math.max(this.freezeDuration, duration);
    }
    
    slowMotion(duration, scale = 0.3) {
        this.slowMoDuration = duration;
        this.slowMoScale = scale;
    }
    
    update(deltaTime) {
        if (this.freezeDuration > 0) {
            this.freezeDuration -= deltaTime;
            return 0;
        }
        
        if (this.slowMoDuration > 0) {
            this.slowMoDuration -= deltaTime;
            this.targetTimeScale = this.slowMoScale;
        } else {
            this.targetTimeScale = 1;
        }
        
        this.timeScale += (this.targetTimeScale - this.timeScale) * Math.min(1, deltaTime * 10);
        
        return deltaTime * this.timeScale;
    }
}

export class ScreenFlash {
    constructor() {
        this.overlay = null;
        this.createOverlay();
    }
    
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'screen-flash';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.05s ease-out;
        `;
        document.body.appendChild(this.overlay);
    }
    
    flash(color = '#ffffff', intensity = 0.3, duration = 0.1) {
        this.overlay.style.backgroundColor = color;
        this.overlay.style.opacity = intensity;
        
        setTimeout(() => {
            this.overlay.style.transition = `opacity ${duration}s ease-out`;
            this.overlay.style.opacity = 0;
        }, 16);
        
        setTimeout(() => {
            this.overlay.style.transition = 'opacity 0.05s ease-out';
        }, duration * 1000 + 50);
    }
    
    killFlash() {
        this.flash('#ffffff', 0.15, 0.08);
    }
    
    bossDeathFlash() {
        this.flash('#ff4400', 0.4, 0.3);
    }
    
    damageFlash() {
        this.flash('#ff0000', 0.25, 0.15);
    }
    
    levelUpFlash() {
        this.flash('#ffff00', 0.2, 0.2);
    }
}

export class VignetteController {
    constructor() {
        this.overlay = null;
        this.intensity = 0;
        this.targetIntensity = 0;
        this.pulsePhase = 0;
        this.createOverlay();
    }
    
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'vignette-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 999;
            opacity: 0;
            background: radial-gradient(ellipse at center, transparent 40%, rgba(255,0,0,0.6) 100%);
        `;
        document.body.appendChild(this.overlay);
    }
    
    update(deltaTime, healthPercent) {
        this.pulsePhase += deltaTime * 6;
        
        if (healthPercent < 0.3) {
            const urgency = 1 - (healthPercent / 0.3);
            const pulse = Math.sin(this.pulsePhase) * 0.15 + 0.85;
            this.targetIntensity = urgency * 0.6 * pulse;
        } else {
            this.targetIntensity = 0;
        }
        
        this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, deltaTime * 5);
        this.overlay.style.opacity = this.intensity;
    }
    
    damageSpike(amount) {
        this.intensity = Math.min(0.8, this.intensity + amount * 0.02);
    }
}

export class DamageNumberSystem {
    constructor(scene) {
        this.scene = scene;
        this.numbers = [];
    }
    
    spawn(position, damage, isCrit = false) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        let color, fontSize;
        if (isCrit || damage > 50) {
            color = '#ff4444';
            fontSize = 72;
        } else if (damage > 20) {
            color = '#ffaa00';
            fontSize = 56;
        } else {
            color = '#ffffff';
            fontSize = 48;
        }
        
        ctx.font = `Bold ${fontSize}px Courier New`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = color;
        ctx.fillText(Math.floor(damage), 128, 64);
        
        if (isCrit) {
            ctx.font = 'Bold 24px Courier New';
            ctx.fillText('CRIT!', 128, 100);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        sprite.position.y += 1;
        sprite.scale.set(2, 1, 1);
        
        this.scene.add(sprite);
        
        this.numbers.push({
            sprite,
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                5 + Math.random() * 2,
                (Math.random() - 0.5) * 3
            ),
            lifetime: 1.5,
            elapsed: 0
        });
    }
    
    update(deltaTime) {
        for (let i = this.numbers.length - 1; i >= 0; i--) {
            const num = this.numbers[i];
            num.elapsed += deltaTime;
            
            if (num.elapsed >= num.lifetime) {
                this.scene.remove(num.sprite);
                num.sprite.material.dispose();
                this.numbers.splice(i, 1);
                continue;
            }
            
            num.sprite.position.add(num.velocity.clone().multiplyScalar(deltaTime));
            num.velocity.y -= 15 * deltaTime;
            
            const alpha = 1 - (num.elapsed / num.lifetime);
            num.sprite.material.opacity = alpha;
            
            const scale = 1 + num.elapsed * 0.3;
            num.sprite.scale.set(2 * scale, 1 * scale, 1);
        }
    }
}

export class ShockwaveSystem {
    constructor(scene) {
        this.scene = scene;
        this.waves = [];
    }
    
    spawn(position, color = 0x00ffff, maxRadius = 8) {
        const geometry = new THREE.RingGeometry(0.1, 0.5, 32);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(geometry, material);
        ring.position.copy(position);
        ring.position.y = 0.1;
        ring.rotation.x = -Math.PI / 2;
        
        this.scene.add(ring);
        
        this.waves.push({
            ring,
            maxRadius,
            currentRadius: 0.5,
            lifetime: 0.5,
            elapsed: 0
        });
    }
    
    update(deltaTime) {
        for (let i = this.waves.length - 1; i >= 0; i--) {
            const wave = this.waves[i];
            wave.elapsed += deltaTime;
            
            if (wave.elapsed >= wave.lifetime) {
                this.scene.remove(wave.ring);
                wave.ring.geometry.dispose();
                wave.ring.material.dispose();
                this.waves.splice(i, 1);
                continue;
            }
            
            const progress = wave.elapsed / wave.lifetime;
            wave.currentRadius = wave.maxRadius * progress;
            
            wave.ring.geometry.dispose();
            wave.ring.geometry = new THREE.RingGeometry(
                wave.currentRadius - 0.3,
                wave.currentRadius,
                32
            );
            
            wave.ring.material.opacity = 1 - progress;
        }
    }
}

export const ChromaticAberrationShader = {
    uniforms: {
        tDiffuse: { value: null },
        amount: { value: 0.0 },
        angle: { value: 0.0 }
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
        uniform float amount;
        uniform float angle;
        varying vec2 vUv;
        
        void main() {
            vec2 offset = amount * vec2(cos(angle), sin(angle));
            
            vec4 cr = texture2D(tDiffuse, vUv + offset);
            vec4 cg = texture2D(tDiffuse, vUv);
            vec4 cb = texture2D(tDiffuse, vUv - offset);
            
            gl_FragColor = vec4(cr.r, cg.g, cb.b, cg.a);
        }
    `
};

export class ChromaticAberrationController {
    constructor(shaderPass) {
        this.pass = shaderPass;
        this.intensity = 0;
        this.decaySpeed = 3;
    }
    
    trigger(amount = 0.02) {
        this.intensity = Math.min(0.05, this.intensity + amount);
        this.pass.uniforms.angle.value = Math.random() * Math.PI * 2;
    }
    
    update(deltaTime) {
        if (this.intensity > 0) {
            this.intensity = Math.max(0, this.intensity - this.decaySpeed * deltaTime);
            this.pass.uniforms.amount.value = this.intensity;
        }
    }
}
