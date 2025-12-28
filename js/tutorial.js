export class TutorialSystem {
    constructor() {
        this.hasSeenTutorial = localStorage.getItem('survivor3d_tutorial_complete') === 'true';
        this.currentStep = 0;
        this.isActive = false;
        this.overlay = null;
        
        this.steps = [
            {
                message: "Use WASD keys to move",
                position: 'center',
                duration: 3000,
                condition: () => true
            },
            {
                message: "Your character attacks automatically!",
                position: 'center',
                duration: 3000,
                condition: () => true
            },
            {
                message: "Collect green gems for XP",
                position: 'bottom',
                duration: 3000,
                condition: () => true
            },
            {
                message: "Level up to choose upgrades",
                position: 'top',
                duration: 3000,
                condition: () => true
            },
            {
                message: "Build combos by killing quickly!",
                position: 'center',
                duration: 3000,
                condition: () => true
            },
            {
                message: "Press ESC to pause",
                position: 'top',
                duration: 2000,
                condition: () => true
            }
        ];
    }
    
    shouldShowTutorial() {
        return !this.hasSeenTutorial;
    }
    
    start() {
        if (!this.shouldShowTutorial()) return;
        
        this.isActive = true;
        this.currentStep = 0;
        this.createOverlay();
        this.showStep(0);
    }
    
    createOverlay() {
        if (this.overlay) return;
        
        this.overlay = document.createElement('div');
        this.overlay.id = 'tutorial-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            left: 0;
            width: 100%;
            padding: 20px;
            text-align: center;
            font-family: 'Courier New', monospace;
            font-size: 24px;
            color: #0ff;
            text-shadow: 0 0 10px #0ff, 0 0 20px #0ff;
            pointer-events: none;
            z-index: 500;
            opacity: 0;
            transition: opacity 0.3s ease;
            background: linear-gradient(transparent, rgba(0,0,0,0.7), transparent);
        `;
        document.body.appendChild(this.overlay);
        
        this.skipHint = document.createElement('div');
        this.skipHint.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            font-size: 12px;
            color: #666;
            pointer-events: auto;
            cursor: pointer;
            z-index: 501;
        `;
        this.skipHint.textContent = 'Click to skip tutorial';
        this.skipHint.addEventListener('click', () => this.complete());
        document.body.appendChild(this.skipHint);
    }
    
    showStep(index) {
        if (index >= this.steps.length) {
            this.complete();
            return;
        }
        
        const step = this.steps[index];
        this.overlay.textContent = step.message;
        
        switch(step.position) {
            case 'top':
                this.overlay.style.top = '80px';
                this.overlay.style.bottom = 'auto';
                break;
            case 'bottom':
                this.overlay.style.top = 'auto';
                this.overlay.style.bottom = '100px';
                break;
            default:
                this.overlay.style.top = '50%';
                this.overlay.style.transform = 'translateY(-50%)';
        }
        
        this.overlay.style.opacity = '1';
        
        setTimeout(() => {
            this.overlay.style.opacity = '0';
            setTimeout(() => {
                this.currentStep++;
                this.showStep(this.currentStep);
            }, 500);
        }, step.duration);
    }
    
    complete() {
        this.isActive = false;
        this.hasSeenTutorial = true;
        localStorage.setItem('survivor3d_tutorial_complete', 'true');
        
        if (this.overlay) {
            this.overlay.style.opacity = '0';
        }
        if (this.skipHint) {
            this.skipHint.remove();
            this.skipHint = null;
        }
    }
    
    reset() {
        this.hasSeenTutorial = false;
        localStorage.removeItem('survivor3d_tutorial_complete');
    }
}
