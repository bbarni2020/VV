class Player {
    constructor(x, y, speed) {
        this.position = { x: x, y: y };
        this.speed = speed;
        this.size = 20;
    }

    move(direction, map) {
        const oldX = this.position.x;
        const oldY = this.position.y;
        
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
        }
    }

    shoot(targetX, targetY) {
        const dx = targetX - this.position.x;
        const dy = targetY - this.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const speed = 8;
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
        const x = this.position.x - this.size / 2 - cameraX;
        const y = this.position.y - this.size / 2 - cameraY;
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - 1, y - 1, this.size + 2, this.size + 2);
        
        ctx.fillStyle = '#4285f4';
        ctx.fillRect(x, y, this.size, this.size);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 4, y + 4, 3, 3);
        ctx.fillRect(x + 13, y + 4, 3, 3);
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 5, y + 5, 1, 1);
        ctx.fillRect(x + 14, y + 5, 1, 1);
        
        ctx.fillStyle = '#87ceeb';
        ctx.fillRect(x + 2, y + 2, this.size - 4, 3);
    }
}

export default Player;