class Player {
    constructor(x, y, speed) {
        this.position = { x: x, y: y };
        this.speed = speed;
        this.size = 20;
        this.animationTime = 0;
        this.lastDirection = 'idle';
        this.isMoving = false;
        this.bobOffset = 0;
        this.squishFactor = 1;
        this.walkCycle = 0;
        this.footStepTimer = 0;
    }

    move(direction, map) {
        const oldX = this.position.x;
        const oldY = this.position.y;
        
        this.isMoving = true;
        this.lastDirection = direction;
        this.animationTime += 0.3;
        this.walkCycle += 0.4;
        this.footStepTimer += 0.5;
        
        switch (direction) {
            case 'up':
                this.position.y -= this.speed;
                break;
            case 'down':
                this.position.y += this.speed;
                break;
            case 'left':
                this.position.x -= this.speed;
                break;
            case 'right':
                this.position.x += this.speed;
                break;
        }
        
        const collision = map.checkCollision(
            this.position.x - this.size / 2,
            this.position.y - this.size / 2,
            this.size,
            this.size
        );
        
        if (collision) {
            this.position.x = oldX;
            this.position.y = oldY;
        } else {
            this.bobOffset = Math.sin(this.animationTime) * 2;
            this.squishFactor = 1 + Math.sin(this.walkCycle) * 0.1;
        }
    }

    shoot(targetX, targetY) {
        const dx = targetX - this.position.x;
        const dy = targetY - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const speed = 12;
        const velocityX = (dx / distance) * speed;
        const velocityY = (dy / distance) * speed;
        
        return {
            x: this.position.x,
            y: this.position.y,
            velocityX: velocityX,
            velocityY: velocityY
        };
    }

    draw(ctx, cameraX = 0, cameraY = 0) {
        if (!this.isMoving) {
            this.animationTime += 0.08;
            this.walkCycle += 0.05;
            this.footStepTimer += 0.03;
            this.bobOffset = Math.sin(this.animationTime * 0.6) * 0.4;
            this.squishFactor = 1 + Math.sin(this.walkCycle * 0.4) * 0.02;
        }
        this.isMoving = false;
        
        const baseX = this.position.x - this.size / 2 - cameraX;
        const baseY = this.position.y - this.size / 2 - cameraY;
        
        const walkBob = this.isMoving ? Math.sin(this.animationTime) * 1.5 : this.bobOffset;
        const walkSquish = this.isMoving ? 1 + Math.sin(this.walkCycle * 1.5) * 0.08 : this.squishFactor;
        const walkTilt = this.isMoving ? Math.sin(this.walkCycle * 0.8) * 0.02 : Math.sin(this.animationTime * 0.3) * 0.005;
        
        const x = baseX + (this.isMoving ? Math.sin(this.footStepTimer * 0.3) * 0.5 : Math.sin(this.footStepTimer * 0.2) * 0.1);
        const y = baseY + walkBob;
        
        const width = this.size * walkSquish;
        const height = this.size / walkSquish;
        
        ctx.save();
        ctx.translate(x + width/2, y + height/2);
        ctx.rotate(walkTilt);
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(-width/2 - 1, -height/2 - 1, width + 2, height + 2);
        
        ctx.fillStyle = '#4285f4';
        ctx.fillRect(-width/2, -height/2, width, height);
        
        const eyeOffset = this.isMoving ? Math.sin(this.animationTime * 0.5) * 0.5 : Math.sin(this.animationTime * 0.3) * 0.2;
        const eyeSize = this.isMoving ? 3 + Math.sin(this.walkCycle * 2) * 0.3 : 3 + Math.sin(this.walkCycle * 0.8) * 0.1;
        const eyeY = -height/2 + 4 + eyeOffset;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-width/2 + 4, eyeY, eyeSize, eyeSize);
        ctx.fillRect(width/2 - 7, eyeY, eyeSize, eyeSize);
        
        ctx.fillStyle = '#000000';
        const pupilOffset = this.isMoving ? Math.sin(this.footStepTimer * 0.2) * 0.5 : Math.sin(this.footStepTimer * 0.1) * 0.2;
        ctx.fillRect(-width/2 + 5 + pupilOffset, eyeY + 1, 1, 1);
        ctx.fillRect(width/2 - 6 + pupilOffset, eyeY + 1, 1, 1);
        
        const blushIntensity = this.isMoving ? Math.abs(Math.sin(this.animationTime * 0.3)) * 0.7 + 0.3 : Math.abs(Math.sin(this.animationTime * 0.2)) * 0.3 + 0.5;
        ctx.fillStyle = `rgba(135, 206, 235, ${blushIntensity})`;
        ctx.fillRect(-width/2 + 2, -height/2 + 2, width - 4, 3);
        
        if (this.isMoving && Math.sin(this.footStepTimer) > 0.8) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            for (let i = 0; i < 3; i++) {
                const sparkleX = -width/2 + Math.random() * width;
                const sparkleY = height/2 + 2 + Math.random() * 4;
                ctx.fillRect(sparkleX, sparkleY, 1, 1);
            }
        }
        
        ctx.restore();
    }
}

export default Player;