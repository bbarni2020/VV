import { mapData } from './mapdata.js';

class Map {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tileSize = 32;
        this.walls = [];
        this.movingPlatforms = [];
        this.teleporters = [];
        this.destructibleWalls = [];
        this.healthPickups = [];
        this.generateMap();
    }

    generateMap() {
        this.walls = [];
        this.movingPlatforms = [];
        this.teleporters = [];
        this.destructibleWalls = [];
        this.healthPickups = [];
        
        for (let y = 0; y < mapData.length; y++) {
            for (let x = 0; x < mapData[y].length; x++) {
                const tile = mapData[y][x];
                if (tile !== 0) {
                    this.addWall(x, y, this.getTileType(tile));
                }
            }
        }
    }

    getTileType(tile) {
        switch (tile) {
            case 1: return 'bouncy';
            case 2: return 'solid';
            case 3: return 'destructible';
            case 4: return 'health';
            case 5: return 'hazard';
            default: return 'solid';
        }
    }

    addWall(x, y, type) {
        const wall = {
            x: x * this.tileSize,
            y: y * this.tileSize,
            width: this.tileSize,
            height: this.tileSize,
            type: type
        };
        
        if (type === 'destructible') {
            wall.health = 3;
            wall.maxHealth = 3;
            this.destructibleWalls.push(wall);
        }
        
        if (type === 'health') {
            this.healthPickups.push({
                x: x * this.tileSize,
                y: y * this.tileSize,
                width: this.tileSize,
                height: this.tileSize,
                collected: false,
                respawnTime: 0
            });
        }
        
        if (type !== 'health') {
            this.walls.push(wall);
        }
    }

    getSafeSpawnPosition(playerSize) {
        const cols = Math.floor(this.width / this.tileSize);
        const rows = Math.floor(this.height / this.tileSize);
        
        const spawnCandidates = [
            { x: 2 * this.tileSize, y: 2 * this.tileSize },
            { x: (cols - 3) * this.tileSize, y: 2 * this.tileSize },
            { x: 2 * this.tileSize, y: (rows - 3) * this.tileSize },
            { x: (cols - 3) * this.tileSize, y: (rows - 3) * this.tileSize },
            { x: Math.floor(cols/2) * this.tileSize, y: 2 * this.tileSize },
            { x: 2 * this.tileSize, y: Math.floor(rows/2) * this.tileSize }
        ];
        
        for (let candidate of spawnCandidates) {
            const collision = this.checkCollision(
                candidate.x - playerSize / 2,
                candidate.y - playerSize / 2,
                playerSize,
                playerSize
            );
            
            if (!collision) {
                return { x: candidate.x, y: candidate.y };
            }
        }
        
        for (let x = 2; x < cols - 2; x++) {
            for (let y = 2; y < rows - 2; y++) {
                const testX = x * this.tileSize;
                const testY = y * this.tileSize;
                
                const collision = this.checkCollision(
                    testX - playerSize / 2,
                    testY - playerSize / 2,
                    playerSize,
                    playerSize
                );
                
                if (!collision) {
                    return { x: testX, y: testY };
                }
            }
        }
        
        return { x: 100, y: 100 };
    }

    checkCollision(x, y, width, height) {
        for (let wall of this.walls) {
            if (x < wall.x + wall.width &&
                x + width > wall.x &&
                y < wall.y + wall.height &&
                y + height > wall.y) {
                return wall;
            }
        }
        return null;
    }

    checkBulletCollision(bullet) {
        const collision = this.checkCollision(
            bullet.position.x - bullet.radius,
            bullet.position.y - bullet.radius,
            bullet.radius * 2,
            bullet.radius * 2
        );
        
        if (collision) {
            if (collision.type === 'bouncy') {
                const bulletCenterX = bullet.position.x;
                const bulletCenterY = bullet.position.y;
                const wallCenterX = collision.x + collision.width / 2;
                const wallCenterY = collision.y + collision.height / 2;
                
                const deltaX = bulletCenterX - wallCenterX;
                const deltaY = bulletCenterY - wallCenterY;
                
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    bullet.velocity.x *= -1.1;
                } else {
                    bullet.velocity.y *= -1.1;
                }
                
                bullet.bounceCount++;
                bullet.hasBounced = true;
                return bullet.bounceCount >= bullet.maxBounces;
            } else if (collision.type === 'destructible') {
                collision.health--;
                if (collision.health <= 0) {
                    this.walls = this.walls.filter(wall => wall !== collision);
                    this.destructibleWalls = this.destructibleWalls.filter(wall => wall !== collision);
                }
                return true;
            } else if (collision.type === 'hazard') {
                return true;
            } else {
                return true;
            }
        }
        return false;
    }

    update(deltaTime) {
        this.movingPlatforms.forEach(platform => {
            platform.x += platform.speed * platform.direction * deltaTime / 1000;
            
            if (platform.x <= platform.startX || platform.x >= platform.endX) {
                platform.direction *= -1;
            }
        });
    }

    updateHealthPickups() {
        const currentTime = Date.now();
        this.healthPickups.forEach(pickup => {
            if (pickup.collected && currentTime - pickup.collectedTime > 10000) {
                pickup.collected = false;
                pickup.collectedTime = 0;
            }
        });
    }
    
    checkHealthPickup(player) {
        const currentTime = Date.now();
        this.healthPickups.forEach(pickup => {
            if (!pickup.collected) {
                const distance = Math.sqrt(
                    Math.pow(player.position.x - (pickup.x + pickup.width/2), 2) +
                    Math.pow(player.position.y - (pickup.y + pickup.height/2), 2)
                );
                
                if (distance < 25 && player.health < player.maxHealth) {
                    player.health = Math.min(player.maxHealth, player.health + 20);
                    pickup.collected = true;
                    pickup.collectedTime = currentTime;
                }
            }
        });
    }

    draw(ctx, cameraX = 0, cameraY = 0) {
        this.movingPlatforms.forEach(platform => {
            const drawX = platform.x - cameraX;
            const drawY = platform.y - cameraY;
            
            ctx.fillStyle = '#4444ff';
            ctx.fillRect(drawX, drawY, platform.width, platform.height);
            ctx.fillStyle = '#6666ff';
            ctx.fillRect(drawX + 2, drawY + 2, platform.width - 4, platform.height - 4);
        });

        this.walls.forEach(wall => {
            const drawX = wall.x - cameraX;
            const drawY = wall.y - cameraY;
            
            if (drawX + wall.width < 0 || drawX > ctx.canvas.width || 
                drawY + wall.height < 0 || drawY > ctx.canvas.height) {
                return;
            }
            
            ctx.fillStyle = '#000000';
            ctx.fillRect(drawX - 2, drawY - 2, wall.width + 4, wall.height + 4);
            
            if (wall.type === 'solid') {
                ctx.fillStyle = '#555555';
                ctx.fillRect(drawX, drawY, wall.width, wall.height);
                
                ctx.fillStyle = '#777777';
                ctx.fillRect(drawX + 2, drawY + 2, wall.width - 4, 6);
                ctx.fillRect(drawX + 2, drawY + 14, wall.width - 4, 6);
                ctx.fillRect(drawX + 2, drawY + 26, wall.width - 4, 4);
                
                ctx.fillStyle = '#444444';
                for (let i = 8; i < wall.width; i += 16) {
                    ctx.fillRect(drawX + i, drawY + 8, 2, 6);
                    ctx.fillRect(drawX + i + 8, drawY + 20, 2, 6);
                }
                
                ctx.fillStyle = '#888888';
                ctx.fillRect(drawX + 1, drawY + 1, 2, 2);
                ctx.fillRect(drawX + wall.width - 3, drawY + 1, 2, 2);
                
            } else if (wall.type === 'bouncy') {
                ctx.fillStyle = '#00aa00';
                ctx.fillRect(drawX, drawY, wall.width, wall.height);
                
                ctx.fillStyle = '#00ff00';
                ctx.fillRect(drawX + 2, drawY + 2, wall.width - 4, 4);
                ctx.fillRect(drawX + 2, drawY + wall.height - 6, wall.width - 4, 4);
                ctx.fillRect(drawX + 2, drawY + 2, 4, wall.height - 4);
                ctx.fillRect(drawX + wall.width - 6, drawY + 2, 4, wall.height - 4);
                
                ctx.fillStyle = '#44ff44';
                ctx.fillRect(drawX + wall.width/2 - 3, drawY + wall.height/2 - 3, 6, 6);
                
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(drawX + 4, drawY + 4, 3, 3);
                ctx.fillRect(drawX + wall.width - 7, drawY + 4, 3, 3);
                ctx.fillRect(drawX + 4, drawY + wall.height - 7, 3, 3);
                ctx.fillRect(drawX + wall.width - 7, drawY + wall.height - 7, 3, 3);
                
                const time = Date.now() * 0.01;
                if (Math.sin(time + drawX + drawY) > 0.5) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(drawX + 8 + Math.sin(time) * 4, drawY + 8, 2, 2);
                    ctx.fillRect(drawX + 20 + Math.cos(time) * 4, drawY + 20, 2, 2);
                }
                
            } else if (wall.type === 'destructible') {
                const healthPercent = wall.health / wall.maxHealth;
                ctx.fillStyle = `rgb(${255 - healthPercent * 100}, ${100 + healthPercent * 100}, 100)`;
                ctx.fillRect(drawX, drawY, wall.width, wall.height);
                
                ctx.fillStyle = '#ffaa00';
                ctx.fillRect(drawX + 4, drawY + 4, wall.width - 8, wall.height - 8);
                
                ctx.fillStyle = '#000000';
                if (wall.health < wall.maxHealth) {
                    ctx.fillRect(drawX + 8, drawY + 6, 2, 20);
                    ctx.fillRect(drawX + 6, drawY + 12, 20, 2);
                }
                if (wall.health < wall.maxHealth - 1) {
                    ctx.fillRect(drawX + 20, drawY + 8, 2, 16);
                    ctx.fillRect(drawX + 12, drawY + 24, 16, 2);
                }
                
            } else if (wall.type === 'teleporter') {
                const time = Date.now() * 0.005;
                ctx.fillStyle = `hsl(${(time * 60) % 360}, 70%, 50%)`;
                ctx.fillRect(drawX, drawY, wall.width, wall.height);
                
                ctx.fillStyle = `hsl(${(time * 60 + 180) % 360}, 70%, 70%)`;
                ctx.fillRect(drawX + 4, drawY + 4, wall.width - 8, wall.height - 8);
                
                for (let i = 0; i < 8; i++) {
                    const angle = time + i * Math.PI / 4;
                    const radius = 8 + Math.sin(time * 2) * 2;
                    const px = drawX + wall.width/2 + Math.cos(angle) * radius;
                    const py = drawY + wall.height/2 + Math.sin(angle) * radius;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px - 1, py - 1, 2, 2);
                }
                
            } else if (wall.type === 'hazard') {
                const time = Date.now() * 0.01;
                ctx.fillStyle = `rgb(${200 + Math.sin(time) * 50}, ${50 + Math.sin(time * 2) * 50}, 0)`;
                ctx.fillRect(drawX, drawY, wall.width, wall.height);
                
                ctx.fillStyle = '#ff6600';
                for (let i = 0; i < 4; i++) {
                    const bubbleX = drawX + 8 + (i % 2) * 16 + Math.sin(time + i) * 4;
                    const bubbleY = drawY + 8 + Math.floor(i / 2) * 16 + Math.cos(time + i) * 4;
                    ctx.fillRect(bubbleX - 2, bubbleY - 2, 4, 4);
                }
                
                ctx.fillStyle = '#ffff00';
                if (Math.sin(time * 3) > 0.3) {
                    ctx.fillRect(drawX + Math.random() * wall.width, drawY + Math.random() * wall.height, 1, 1);
                }
            }
        });
        
        this.healthPickups.forEach(pickup => {
            if (!pickup.collected) {
                const drawX = pickup.x - cameraX;
                const drawY = pickup.y - cameraY;
                
                if (drawX + pickup.width < 0 || drawX > ctx.canvas.width || 
                    drawY + pickup.height < 0 || drawY > ctx.canvas.height) {
                    return;
                }
                
                const time = Date.now() * 0.005;
                const pulse = 0.8 + Math.sin(time * 4) * 0.2;
                const bobY = Math.sin(time * 3) * 3;
                
                ctx.save();
                ctx.translate(drawX + pickup.width/2, drawY + pickup.height/2 + bobY);
                ctx.scale(pulse, pulse);
                
                ctx.fillStyle = '#ff4444';
                ctx.fillRect(-pickup.width/2, -pickup.height/2, pickup.width, pickup.height);
                
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-pickup.width/2 + 6, -pickup.height/2 + 10, pickup.width - 12, 4);
                ctx.fillRect(-pickup.width/2 + 12, -pickup.height/2 + 6, 8, 12);
                
                ctx.fillStyle = '#ffaaaa';
                for (let i = 0; i < 4; i++) {
                    const sparkleAngle = time * 2 + i * Math.PI / 2;
                    const sparkleRadius = 20 + Math.sin(time * 3) * 5;
                    const sparkleX = Math.cos(sparkleAngle) * sparkleRadius;
                    const sparkleY = Math.sin(sparkleAngle) * sparkleRadius;
                    ctx.fillRect(sparkleX - 1, sparkleY - 1, 2, 2);
                }
                
                ctx.restore();
            }
        });
    }
}

export default Map;
