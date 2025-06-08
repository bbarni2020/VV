class Bullet {
    constructor(x, y, velocityX, velocityY, ownerId = null) {
        this.position = { x: x, y: y };
        this.velocity = { x: velocityX, y: velocityY };
        this.radius = 3;
        this.bounceCount = 0;
        this.maxBounces = 3;
        this.ownerId = ownerId;
        this.hasBounced = false;
        
        this.playShootingSound();
    }

    playShootingSound() {
        try {
            const audio = new Audio('sound/shooting.wav');
            const globalVolume = window.getGlobalVolume ? window.getGlobalVolume() : 0.5;
            audio.volume = globalVolume * 0.6;
            audio.play().catch(error => {
                console.log('Shooting sound play failed:', error);
            });
        } catch (error) {
            console.log('Error creating shooting sound:', error);
        }
    }

    update() {
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;
    }

    bounce(width, height) {
        let bounced = false;
        
        if (this.position.x <= 0 || this.position.x >= width) {
            this.velocity.x *= -1;
            bounced = true;
        }
        if (this.position.y <= 0 || this.position.y >= height) {
            this.velocity.y *= -1;
            bounced = true;
        }
        
        if (bounced) {
            this.bounceCount++;
            this.hasBounced = true;
        }
        
        return this.bounceCount >= this.maxBounces;
    }

    draw(ctx, cameraX = 0, cameraY = 0) {
        const x = this.position.x - cameraX;
        const y = this.position.y - cameraY;
        
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(x, y, this.radius + 1, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(x, y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x - 1, y - 1, 1, 0, Math.PI * 2);
        ctx.fill();
    }
}

export default Bullet;