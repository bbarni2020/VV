class Player {
    constructor(x, y, speed, color = '#4285f4') {
        this.position = { x: x, y: y };
        this.speed = speed;
        this.size = 20;
        this.color = color;
        this.animationTime = 0;
        this.lastDirection = 'idle';
        this.isMoving = false;
        this.bobOffset = 0;
        this.squishFactor = 1;
        this.walkCycle = 0;
        this.footStepTimer = 0;
        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;
        this.deathTime = 0;
        this.respawnTimer = 0;
        this.respawnDelay = 3000;
        this.ammo = 10;
        this.maxAmmo = 10;
        this.reloadTime = 0;
        this.reloadDuration = 2000;
    }

    move(direction, map) {
        if (this.isDead) return;
        
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
        if (this.isDead || this.ammo <= 0 || this.reloadTime > 0) return null;
        
        this.ammo--;
        if (this.ammo <= 0) {
            this.reloadTime = this.reloadDuration;
        }
        
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

    takeDamage(damage, isOwnBullet = false) {
        if (this.isDead) return false;
        
        const actualDamage = isOwnBullet ? 5 : damage;
        this.health -= actualDamage;
        
        if (this.health <= 0) {
            this.health = 0;
            this.die();
            return true;
        }
        return false;
    }

    die() {
        this.isDead = true;
        this.deathTime = Date.now();
        this.respawnTimer = this.respawnDelay;
    }

    respawn(map) {
        const spawnPos = map.getSafeSpawnPosition(this.size);
        this.position.x = spawnPos.x;
        this.position.y = spawnPos.y;
        this.health = this.maxHealth;
        this.isDead = false;
        this.deathTime = 0;
        this.respawnTimer = 0;
        this.ammo = this.maxAmmo;
        this.reloadTime = 0;
    }

    update(deltaTime) {
        if (this.isDead && this.respawnTimer > 0) {
            this.respawnTimer -= deltaTime;
        }
        
        if (this.reloadTime > 0) {
            this.reloadTime -= deltaTime;
            if (this.reloadTime <= 0) {
                this.ammo = this.maxAmmo;
                this.reloadTime = 0;
            }
        }
    }

    draw(ctx, cameraX = 0, cameraY = 0) {
        if (this.isDead) {
            this.drawDeathAnimation(ctx, cameraX, cameraY);
            return;
        }
        
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
        
        ctx.fillStyle = this.color;
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
        
        if (this.reloadTime > 0) {
            this.drawReloadAnimation(ctx, cameraX, cameraY);
        }
    }

    drawDeathAnimation(ctx, cameraX = 0, cameraY = 0) {
        const timeSinceDeath = Date.now() - this.deathTime;
        const deathProgress = Math.min(timeSinceDeath / 1000, 1);
        
        const baseX = this.position.x - this.size / 2 - cameraX;
        const baseY = this.position.y - this.size / 2 - cameraY;
        
        ctx.save();
        ctx.translate(baseX + this.size/2, baseY + this.size/2);
        
        const rotation = deathProgress * Math.PI * 2;
        const scale = 1 - (deathProgress * 0.7);
        const opacity = 1 - (deathProgress * 0.8);
        
        ctx.rotate(rotation);
        ctx.scale(scale, scale);
        ctx.globalAlpha = opacity;
        
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + timeSinceDeath * 0.01;
            const radius = deathProgress * 30;
            const sparkleX = Math.cos(angle) * radius;
            const sparkleY = Math.sin(angle) * radius;
            
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = opacity * (1 - deathProgress);
            ctx.fillRect(sparkleX - 1, sparkleY - 1, 2, 2);
        }
        
        ctx.restore();
        
        if (this.respawnTimer > 0) {
            const respawnText = `RESPAWN: ${Math.ceil(this.respawnTimer / 1000)}`;
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(respawnText, baseX + this.size/2, baseY - 10);
        }
    }

    drawHealthBar(ctx, cameraX = 0, cameraY = 0) {
        if (this.isDead) return;
        
        const barWidth = this.size + 4;
        const barHeight = 4;
        const x = this.position.x - barWidth/2 - cameraX;
        const y = this.position.y - this.size/2 - 8 - cameraY;
        
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);
        
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        const healthPercent = this.health / this.maxHealth;
        let healthColor;
        if (healthPercent > 0.7) {
            healthColor = '#00ff00';
        } else if (healthPercent > 0.4) {
            healthColor = '#ffff00';
        } else if (healthPercent > 0.2) {
            healthColor = '#ff8800';
        } else {
            healthColor = '#ff0000';
        }
        ctx.fillStyle = healthColor;
        ctx.fillRect(x, y, barWidth * healthPercent, barHeight);
    }

    drawReloadAnimation(ctx, cameraX = 0, cameraY = 0) {
        const time = Date.now() * 0.008;
        const reloadProgress = 1 - (this.reloadTime / this.reloadDuration);
        
        const x = this.position.x - cameraX;
        const y = this.position.y - this.size - 20 - cameraY;
        
        ctx.save();
        ctx.translate(x, y + Math.sin(time * 2) * 2);
        
        const opacity = 0.8 + Math.sin(time * 4) * 0.2;
        ctx.globalAlpha = opacity;
        
        const textSize = 8 + Math.sin(time * 3) * 1;
        ctx.font = `${textSize}px monospace`;
        ctx.textAlign = 'center';
        
        const shadowOffset = Math.sin(time * 5) * 0.5;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText('RELOADING', shadowOffset, shadowOffset);
        
        const hue = (time * 60) % 360;
        ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
        ctx.fillText('RELOADING', 0, 0);
        
        for (let i = 0; i < 3; i++) {
            const dotOpacity = Math.sin(time * 6 + i * 0.5) > 0 ? 1 : 0.3;
            ctx.globalAlpha = dotOpacity;
            ctx.fillStyle = `hsl(${(hue + i * 30) % 360}, 80%, 70%)`;
            ctx.fillText('.', 35 + i * 6, 0);
        }
        
        ctx.globalAlpha = 0.6;
        const barWidth = 60;
        const barHeight = 3;
        const barY = 8;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-barWidth/2 - 1, barY - 1, barWidth + 2, barHeight + 2);
        
        ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
        ctx.fillRect(-barWidth/2, barY, barWidth, barHeight);
        
        ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
        ctx.fillRect(-barWidth/2, barY, barWidth * reloadProgress, barHeight);
        
        ctx.restore();
    }
}

export default Player;