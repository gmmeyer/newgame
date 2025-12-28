export class MobileControls {
    constructor(keys) {
        this.keys = keys;
        this.isMobile = this.detectMobile();
        this.joystick = null;
        this.joystickKnob = null;
        this.joystickOrigin = { x: 0, y: 0 };
        this.joystickActive = false;
        this.maxJoystickDistance = 50;
        
        if (this.isMobile) {
            this.createControls();
        }
    }
    
    detectMobile() {
        return ('ontouchstart' in window) || 
               (navigator.maxTouchPoints > 0) || 
               (window.innerWidth <= 1024);
    }
    
    createControls() {
        this.joystick = document.createElement('div');
        this.joystick.id = 'mobile-joystick';
        this.joystick.style.cssText = `
            position: fixed;
            left: 30px;
            bottom: 30px;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: rgba(0, 255, 255, 0.1);
            border: 2px solid rgba(0, 255, 255, 0.4);
            display: none;
            z-index: 600;
            touch-action: none;
        `;
        
        this.joystickKnob = document.createElement('div');
        this.joystickKnob.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            width: 50px;
            height: 50px;
            margin-left: -25px;
            margin-top: -25px;
            border-radius: 50%;
            background: rgba(0, 255, 255, 0.5);
            border: 2px solid #0ff;
            box-shadow: 0 0 10px #0ff;
        `;
        this.joystick.appendChild(this.joystickKnob);
        document.body.appendChild(this.joystick);
        
        this.pauseBtn = document.createElement('button');
        this.pauseBtn.id = 'mobile-pause';
        this.pauseBtn.textContent = '⏸';
        this.pauseBtn.style.cssText = `
            position: fixed;
            right: 20px;
            top: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.5);
            border: 2px solid #0ff;
            color: #0ff;
            font-size: 20px;
            display: none;
            z-index: 600;
            cursor: pointer;
        `;
        document.body.appendChild(this.pauseBtn);
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.joystick.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.joystick.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.joystick.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
        
        this.pauseBtn.addEventListener('click', () => {
            const event = new KeyboardEvent('keydown', { key: 'Escape' });
            window.dispatchEvent(event);
        });
    }
    
    onTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = this.joystick.getBoundingClientRect();
        this.joystickOrigin = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        this.joystickActive = true;
        this.updateJoystick(touch.clientX, touch.clientY);
    }
    
    onTouchMove(e) {
        e.preventDefault();
        if (!this.joystickActive) return;
        const touch = e.touches[0];
        this.updateJoystick(touch.clientX, touch.clientY);
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        this.joystickActive = false;
        this.joystickKnob.style.transform = 'translate(0, 0)';
        this.keys['w'] = false;
        this.keys['s'] = false;
        this.keys['a'] = false;
        this.keys['d'] = false;
    }
    
    updateJoystick(touchX, touchY) {
        let deltaX = touchX - this.joystickOrigin.x;
        let deltaY = touchY - this.joystickOrigin.y;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > this.maxJoystickDistance) {
            deltaX = (deltaX / distance) * this.maxJoystickDistance;
            deltaY = (deltaY / distance) * this.maxJoystickDistance;
        }
        
        this.joystickKnob.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        
        const threshold = 15;
        this.keys['w'] = deltaY < -threshold;
        this.keys['s'] = deltaY > threshold;
        this.keys['a'] = deltaX < -threshold;
        this.keys['d'] = deltaX > threshold;
    }
    
    show() {
        if (!this.isMobile) return;
        if (this.joystick) this.joystick.style.display = 'block';
        if (this.pauseBtn) this.pauseBtn.style.display = 'block';
    }
    
    hide() {
        if (this.joystick) this.joystick.style.display = 'none';
        if (this.pauseBtn) this.pauseBtn.style.display = 'none';
    }
}
