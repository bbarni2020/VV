class MobileControls {
    constructor() {
        this.movementJoystick = {
            container: null,
            stick: null,
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            maxDistance: 35
        };
        
        this.shootingJoystick = {
            container: null,
            stick: null,
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            maxDistance: 35,
            lastDirectionX: 0,
            lastDirectionY: -1
        };
        
        this.buttons = {
            reload: null
        };
        
        this.inputState = {
            left: false,
            right: false,
            up: false,
            down: false,
            shoot: false,
            reload: false
        };
        
        this.isMobile = this.detectMobile();
        
        if (this.isMobile) {
            this.init();
        }
    }
    
    detectMobile() {
        return window.innerWidth <= 768 || window.innerHeight <= 768 || 
               /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    init() {
        console.log('Initializing dual joystick mobile controls...');
        
        this.movementJoystick.container = document.getElementById('movementJoystickContainer');
        this.movementJoystick.stick = document.getElementById('movementJoystickStick');
        
        this.shootingJoystick.container = document.getElementById('shootingJoystickContainer');
        this.shootingJoystick.stick = document.getElementById('shootingJoystickStick');
        
        this.buttons.reload = document.getElementById('mobileReloadBtn');
        
        if (this.movementJoystick.container && this.movementJoystick.stick) {
            this.setupMovementJoystick();
            console.log('Movement joystick initialized');
        } else {
            console.log('Movement joystick elements not found');
        }
        
        if (this.shootingJoystick.container && this.shootingJoystick.stick) {
            this.setupShootingJoystick();
            console.log('Shooting joystick initialized');
        } else {
            console.log('Shooting joystick elements not found');
        }
        
        if (this.buttons.reload) {
            this.setupReloadButton();
            console.log('Reload button initialized');
        } else {
            console.log('Reload button not found');
        }
        
        const mobileControlsElement = document.getElementById('mobileControls');
        if (mobileControlsElement) {
            mobileControlsElement.style.display = 'block';
            console.log('Mobile controls displayed');
        } else {
            console.log('Mobile controls element not found');
        }
    }
    
    setupMovementJoystick() {
        const container = this.movementJoystick.container;
        const stick = this.movementJoystick.stick;
        
        const handleStart = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.movementJoystick.active = true;
            
            const rect = container.getBoundingClientRect();
            this.movementJoystick.startX = rect.left + rect.width / 2;
            this.movementJoystick.startY = rect.top + rect.height / 2;
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            this.updateMovementJoystick(clientX, clientY);
        };
        
        const handleMove = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.movementJoystick.active) return;
            
            if (e.touches) {
                for (let i = 0; i < e.touches.length; i++) {
                    const touch = e.touches[i];
                    const rect = container.getBoundingClientRect();
                    if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                        touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                        this.updateMovementJoystick(touch.clientX, touch.clientY);
                        break;
                    }
                }
            } else {
                this.updateMovementJoystick(e.clientX, e.clientY);
            }
        };
        
        const handleEnd = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.movementJoystick.active = false;
            this.resetMovementJoystick();
        };
        
        container.addEventListener('touchstart', handleStart, { passive: false });
        container.addEventListener('touchmove', handleMove, { passive: false });
        container.addEventListener('touchend', handleEnd, { passive: false });
        container.addEventListener('touchcancel', handleEnd, { passive: false });
        
        container.addEventListener('mousedown', handleStart);
        container.addEventListener('mousemove', handleMove);
        container.addEventListener('mouseup', handleEnd);
        container.addEventListener('mouseleave', handleEnd);
    }
    
    setupShootingJoystick() {
        const container = this.shootingJoystick.container;
        const stick = this.shootingJoystick.stick;
        
        const handleStart = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.shootingJoystick.active = true;
            
            const rect = container.getBoundingClientRect();
            this.shootingJoystick.startX = rect.left + rect.width / 2;
            this.shootingJoystick.startY = rect.top + rect.height / 2;
            
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            this.updateShootingJoystick(clientX, clientY);
            
            this.inputState.shoot = true;
        };
        
        const handleMove = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.shootingJoystick.active) return;
            
            if (e.touches) {
                for (let i = 0; i < e.touches.length; i++) {
                    const touch = e.touches[i];
                    const rect = container.getBoundingClientRect();
                    if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                        touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                        this.updateShootingJoystick(touch.clientX, touch.clientY);
                        break;
                    }
                }
            } else {
                this.updateShootingJoystick(e.clientX, e.clientY);
            }
        };
        
        const handleEnd = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.shootingJoystick.active = false;
            this.inputState.shoot = false;
            this.resetShootingJoystick();
        };
        
        container.addEventListener('touchstart', handleStart, { passive: false });
        container.addEventListener('touchmove', handleMove, { passive: false });
        container.addEventListener('touchend', handleEnd, { passive: false });
        container.addEventListener('touchcancel', handleEnd, { passive: false });
        
        container.addEventListener('mousedown', handleStart);
        container.addEventListener('mousemove', handleMove);
        container.addEventListener('mouseup', handleEnd);
        container.addEventListener('mouseleave', handleEnd);
    }
    
    updateMovementJoystick(clientX, clientY) {
        const deltaX = clientX - this.movementJoystick.startX;
        const deltaY = clientY - this.movementJoystick.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance <= this.movementJoystick.maxDistance) {
            this.movementJoystick.currentX = deltaX;
            this.movementJoystick.currentY = deltaY;
        } else {
            const angle = Math.atan2(deltaY, deltaX);
            this.movementJoystick.currentX = Math.cos(angle) * this.movementJoystick.maxDistance;
            this.movementJoystick.currentY = Math.sin(angle) * this.movementJoystick.maxDistance;
        }
        
        this.movementJoystick.stick.style.transform = 
            `translate(calc(-50% + ${this.movementJoystick.currentX}px), calc(-50% + ${this.movementJoystick.currentY}px))`;
        
        this.updateMovementInputState();
    }
    
    updateShootingJoystick(clientX, clientY) {
        const deltaX = clientX - this.shootingJoystick.startX;
        const deltaY = clientY - this.shootingJoystick.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (distance <= this.shootingJoystick.maxDistance) {
            this.shootingJoystick.currentX = deltaX;
            this.shootingJoystick.currentY = deltaY;
        } else {
            const angle = Math.atan2(deltaY, deltaX);
            this.shootingJoystick.currentX = Math.cos(angle) * this.shootingJoystick.maxDistance;
            this.shootingJoystick.currentY = Math.sin(angle) * this.shootingJoystick.maxDistance;
        }
        
        this.shootingJoystick.stick.style.transform = 
            `translate(calc(-50% + ${this.shootingJoystick.currentX}px), calc(-50% + ${this.shootingJoystick.currentY}px))`;
        
        this.updateShootingDirection();
    }
    
    resetMovementJoystick() {
        this.movementJoystick.currentX = 0;
        this.movementJoystick.currentY = 0;
        this.movementJoystick.stick.style.transform = 'translate(-50%, -50%)';
        this.updateMovementInputState();
    }
    
    resetShootingJoystick() {
        this.shootingJoystick.currentX = 0;
        this.shootingJoystick.currentY = 0;
        this.shootingJoystick.stick.style.transform = 'translate(-50%, -50%)';
    }
    
    updateMovementInputState() {
        const threshold = 15;
        
        this.inputState.left = this.movementJoystick.currentX < -threshold;
        this.inputState.right = this.movementJoystick.currentX > threshold;
        this.inputState.up = this.movementJoystick.currentY < -threshold;
        this.inputState.down = this.movementJoystick.currentY > threshold;
    }
    
    updateShootingDirection() {
        if (Math.abs(this.shootingJoystick.currentX) > 2 || Math.abs(this.shootingJoystick.currentY) > 2) {
            this.shootingJoystick.lastDirectionX = this.shootingJoystick.currentX / this.shootingJoystick.maxDistance;
            this.shootingJoystick.lastDirectionY = this.shootingJoystick.currentY / this.shootingJoystick.maxDistance;
        }
    }
    
    setupReloadButton() {
        const reloadBtn = this.buttons.reload;
        
        const handleReload = (e) => {
            e.preventDefault();
            this.inputState.reload = true;
            setTimeout(() => {
                this.inputState.reload = false;
            }, 100);
        };
        
        reloadBtn.addEventListener('touchstart', handleReload);
        reloadBtn.addEventListener('click', handleReload);
    }
    
    getInputState() {
        return this.inputState;
    }
    
    getShootingDirection(playerX, playerY) {
        const shootDistance = 100;
        let normalizedX, normalizedY;
        
        if (Math.abs(this.shootingJoystick.currentX) > 5 || Math.abs(this.shootingJoystick.currentY) > 5) {
            normalizedX = this.shootingJoystick.currentX / this.shootingJoystick.maxDistance;
            normalizedY = this.shootingJoystick.currentY / this.shootingJoystick.maxDistance;
        } else {
            normalizedX = this.shootingJoystick.lastDirectionX;
            normalizedY = this.shootingJoystick.lastDirectionY;
        }
        
        const targetX = playerX + (normalizedX * shootDistance);
        const targetY = playerY + (normalizedY * shootDistance);
        
        console.log('Dual joystick shooting direction:', {
            shootingJoystickX: this.shootingJoystick.currentX,
            shootingJoystickY: this.shootingJoystick.currentY,
            lastDirectionX: this.shootingJoystick.lastDirectionX,
            lastDirectionY: this.shootingJoystick.lastDirectionY,
            normalizedX: normalizedX,
            normalizedY: normalizedY,
            targetX: targetX,
            targetY: targetY
        });
        
        return { targetX, targetY };
    }
    
    isActive() {
        return this.isMobile;
    }
}

export default MobileControls;
