class Map {
    constructor(width, height) {
        this.width = width * 3;
        this.height = height * 3;
        this.tileSize = 32;
        this.walls = [];
        this.movingPlatforms = [];
        this.teleporters = [];
        this.destructibleWalls = [];
        this.generateMap();
    }

    generateMap() {
        this.walls = [];
        this.movingPlatforms = [];
        this.teleporters = [];
        this.destructibleWalls = [];
        
        this.createBorderWalls();
        this.createInteriorWalls();
    }

    createBorderWalls() {
        const cols = Math.floor(this.width / this.tileSize);
        const rows = Math.floor(this.height / this.tileSize);
        
        for (let x = 0; x < cols; x++) {
            this.walls.push({
                x: x * this.tileSize,
                y: 0,
                width: this.tileSize,
                height: this.tileSize,
                type: 'solid'
            });
            this.walls.push({
                x: x * this.tileSize,
                y: (rows - 1) * this.tileSize,
                width: this.tileSize,
                height: this.tileSize,
                type: 'solid'
            });
        }
        
        for (let y = 1; y < rows - 1; y++) {
            this.walls.push({
                x: 0,
                y: y * this.tileSize,
                width: this.tileSize,
                height: this.tileSize,
                type: 'solid'
            });
            this.walls.push({
                x: (cols - 1) * this.tileSize,
                y: y * this.tileSize,
                width: this.tileSize,
                height: this.tileSize,
                type: 'solid'
            });
        }
    }

    createInteriorWalls() {
        const cols = Math.floor(this.width / this.tileSize);
        const rows = Math.floor(this.height / this.tileSize);
        
        this.createFortressSection(cols, rows);
        this.createLabyrinthSection(cols, rows);
        this.createTeleporterHubSection(cols, rows);
        this.createMovingPlatformSection(cols, rows);
        this.createDestructibleSection(cols, rows);
        this.createHazardSection(cols, rows);
        this.createCrystalCaveSection(cols, rows);
        this.createMechanicalSection(cols, rows);
        this.createGraveyardSection(cols, rows);
        this.createPortalSection(cols, rows);
    }

    createFortressSection(cols, rows) {
        const centerX = 12;
        const centerY = 8;
        const size = 12;
        
        for (let x = centerX - size/2; x <= centerX + size/2; x++) {
            this.addWall(x, centerY - size/2, 'solid');
            this.addWall(x, centerY + size/2, 'solid');
        }
        for (let y = centerY - size/2; y <= centerY + size/2; y++) {
            this.addWall(centerX - size/2, y, 'solid');
            this.addWall(centerX + size/2, y, 'solid');
        }
        
        this.addWall(centerX - size/2 - 1, centerY - size/2 - 1, 'solid');
        this.addWall(centerX + size/2 + 1, centerY - size/2 - 1, 'solid');
        this.addWall(centerX - size/2 - 1, centerY + size/2 + 1, 'solid');
        this.addWall(centerX + size/2 + 1, centerY + size/2 + 1, 'solid');
        
        for (let x = centerX - 2; x <= centerX + 2; x++) {
            this.addWall(x, centerY - 2, 'destructible');
            this.addWall(x, centerY + 2, 'destructible');
        }
        
        // Central keep
        this.addWall(centerX, centerY, 'bouncy');
        this.addWall(centerX - 1, centerY, 'hazard');
        this.addWall(centerX + 1, centerY, 'hazard');
    }

    createLabyrinthSection(cols, rows) {
        const startX = cols - 18;
        const startY = 4;
        
        const mazePattern = [
            [1,1,1,1,0,1,1,1,1,1,1,1,1,1,1],
            [1,0,0,3,0,0,0,2,0,0,0,3,0,0,1],
            [1,0,1,1,0,1,1,1,1,1,0,1,1,0,1],
            [1,0,1,0,0,0,2,0,0,0,0,0,1,0,1],
            [1,0,1,0,1,1,0,1,1,0,1,1,1,0,1],
            [1,0,0,0,1,2,0,0,1,0,2,0,0,0,1],
            [1,0,1,1,1,0,1,0,1,0,1,1,1,0,1],
            [1,0,0,3,0,0,1,0,1,0,0,3,0,0,1],
            [1,1,1,1,1,1,1,2,1,1,1,1,1,1,1]
        ];
        
        mazePattern.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell > 0 && startX + x < cols && startY + y < rows) {
                    const wallType = cell === 1 ? 'solid' : cell === 2 ? 'destructible' : 'bouncy';
                    this.addWall(startX + x, startY + y, wallType);
                }
            });
        });
    }

    createTeleporterHubSection(cols, rows) {
        const centerX = Math.floor(cols * 0.3);
        const centerY = Math.floor(rows * 0.7);
        
        this.addWall(centerX, centerY, 'teleporter');
        this.teleporters.push({
            x: centerX * this.tileSize,
            y: centerY * this.tileSize,
            id: 'hub',
            destinations: ['north', 'south', 'east', 'west']
        });
        
        const destinations = [
            { x: centerX, y: centerY - 8, id: 'north' },
            { x: centerX, y: centerY + 8, id: 'south' },
            { x: centerX + 8, y: centerY, id: 'east' },
            { x: centerX - 8, y: centerY, id: 'west' }
        ];
        
        destinations.forEach(dest => {
            this.addWall(dest.x, dest.y, 'teleporter');
            this.teleporters.push({
                x: dest.x * this.tileSize,
                y: dest.y * this.tileSize,
                id: dest.id,
                destinations: ['hub']
            });
            
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx !== 0 || dy !== 0) {
                        this.addWall(dest.x + dx, dest.y + dy, 'bouncy');
                    }
                }
            }
        });
    }

    createMovingPlatformSection(cols, rows) {
        const baseY = Math.floor(rows * 0.4);
        const startX = Math.floor(cols * 0.6);
        
        for (let i = 0; i < 3; i++) {
            const trackY = baseY + i * 6;
            const trackLength = 15;
            

            for (let x = 0; x < trackLength; x++) {
                this.addWall(startX + x, trackY - 2, 'solid');
                this.addWall(startX + x, trackY + 2, 'solid');
            }
            
            this.movingPlatforms.push({
                x: startX * this.tileSize,
                y: trackY * this.tileSize,
                width: this.tileSize * 3,
                height: this.tileSize,
                startX: startX * this.tileSize,
                endX: (startX + trackLength - 3) * this.tileSize,
                speed: 50 + i * 20,
                direction: i % 2 === 0 ? 1 : -1
            });
        }
        
        for (let i = 0; i < 2; i++) {
            const hazardY = baseY + 3 + i * 6;
            for (let x = 0; x < 12; x++) {
                if (x % 3 === 0) {
                    this.addWall(startX + x + 2, hazardY, 'hazard');
                }
            }
        }
    }

    createDestructibleSection(cols, rows) {
        const startX = 5;
        const startY = Math.floor(rows * 0.6);
        
        const pattern = [
            [2,2,2,2,2,2,2,2,2,2],
            [2,0,0,2,0,0,2,0,0,2],
            [2,0,1,2,1,0,2,1,0,2],
            [2,2,2,0,2,2,0,2,2,2],
            [2,0,0,0,2,0,0,0,0,2],
            [2,0,1,2,2,2,2,1,0,2],
            [2,0,0,0,0,0,0,0,0,2],
            [2,2,2,2,2,2,2,2,2,2]
        ];
        
        pattern.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell > 0) {
                    const wallType = cell === 1 ? 'solid' : 'destructible';
                    this.addWall(startX + x, startY + y, wallType);
                }
            });
        });
    }

    createHazardSection(cols, rows) {
        const centerX = Math.floor(cols * 0.8);
        const centerY = Math.floor(rows * 0.3);
        
        for (let x = -6; x <= 6; x++) {
            for (let y = -4; y <= 4; y++) {
                if (Math.abs(x) === 6 || Math.abs(y) === 4) {
                    this.addWall(centerX + x, centerY + y, 'solid');
                } else if ((x + y) % 3 === 0) {
                    this.addWall(centerX + x, centerY + y, 'bouncy');
                } else if (Math.abs(x) < 5 && Math.abs(y) < 3) {
                    this.addWall(centerX + x, centerY + y, 'hazard');
                }
            }
        }
    }

    createCrystalCaveSection(cols, rows) {
        const centerX = Math.floor(cols * 0.15);
        const centerY = Math.floor(rows * 0.25);
        
        const crystalSizes = [3, 5, 4, 6, 3];
        crystalSizes.forEach((size, i) => {
            const angle = (i / crystalSizes.length) * Math.PI * 2;
            const distance = 8;
            const crystalX = Math.round(centerX + Math.cos(angle) * distance);
            const crystalY = Math.round(centerY + Math.sin(angle) * distance);
            
            for (let x = -Math.floor(size/2); x <= Math.floor(size/2); x++) {
                for (let y = -Math.floor(size/2); y <= Math.floor(size/2); y++) {
                    if (Math.abs(x) + Math.abs(y) <= Math.floor(size/2)) {
                        this.addWall(crystalX + x, crystalY + y, 'bouncy');
                    }
                }
            }
        });
        
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
            const radius = 12 + Math.sin(angle * 3) * 2;
            const x = Math.round(centerX + Math.cos(angle) * radius);
            const y = Math.round(centerY + Math.sin(angle) * radius);
            this.addWall(x, y, 'solid');
        }
    }

    createMechanicalSection(cols, rows) {
        const startX = Math.floor(cols * 0.4);
        const startY = Math.floor(rows * 0.85);
        
        for (let i = 0; i < 5; i++) {
            const gearX = startX + i * 4;
            const gearY = startY;
            
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                const x = Math.round(gearX + Math.cos(angle) * 2);
                const y = Math.round(gearY + Math.sin(angle) * 2);
                this.addWall(x, y, 'solid');
            }
            
            this.addWall(gearX, gearY, 'bouncy');
            
            if (i % 2 === 0) {
                this.addWall(gearX, gearY - 4, 'destructible');
                this.addWall(gearX, gearY + 4, 'destructible');
            }
        }
    }

    createGraveyardSection(cols, rows) {
        const startX = Math.floor(cols * 0.05);
        const startY = Math.floor(rows * 0.5);
        
        for (let i = 0; i < 12; i++) {
            const tombX = startX + (i % 4) * 3 + Math.floor(i / 4) * 10;
            const tombY = startY + (i % 3) * 4;
            
            this.addWall(tombX, tombY, 'solid');
            this.addWall(tombX, tombY - 1, 'solid');
            
            if (i % 3 === 0) {
                this.addWall(tombX - 1, tombY, 'hazard');
                this.addWall(tombX + 1, tombY, 'hazard');
            }
        }
        
        const cryptX = startX + 6;
        const cryptY = startY - 3;
        for (let x = -2; x <= 2; x++) {
            for (let y = -2; y <= 2; y++) {
                if (Math.abs(x) === 2 || Math.abs(y) === 2) {
                    this.addWall(cryptX + x, cryptY + y, 'solid');
                } else if (x === 0 && y === 0) {
                    this.addWall(cryptX + x, cryptY + y, 'teleporter');
                }
            }
        }
    }

    createPortalSection(cols, rows) {
        const centerX = Math.floor(cols * 0.9);
        const centerY = Math.floor(rows * 0.8);
        
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
            const radius = 5;
            const x = Math.round(centerX + Math.cos(angle) * radius);
            const y = Math.round(centerY + Math.sin(angle) * radius);
            this.addWall(x, y, 'bouncy');
            
            if (angle % (Math.PI / 3) < 0.1) {
                this.addWall(x, y, 'hazard');
            }
        }

        this.addWall(centerX, centerY - 8, 'teleporter');
        this.addWall(centerX, centerY + 8, 'teleporter');
        this.addWall(centerX - 8, centerY, 'teleporter');
        this.addWall(centerX + 8, centerY, 'teleporter');
    }

    addWall(x, y, type) {
        if (x >= 0 && y >= 0 && x < Math.floor(this.width / this.tileSize) && y < Math.floor(this.height / this.tileSize)) {
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
            
            this.walls.push(wall);
        }
    }

    getSafeSpawnPosition(playerSize) {
        const cols = Math.floor(this.width / this.tileSize);
        const rows = Math.floor(this.height / this.tileSize);
        
        const spawnCandidates = [
            { x: 3 * this.tileSize, y: 2 * this.tileSize },
            { x: (cols - 4) * this.tileSize, y: 2 * this.tileSize },
            { x: 3 * this.tileSize, y: (rows - 3) * this.tileSize },
            { x: (cols - 4) * this.tileSize, y: (rows - 3) * this.tileSize },
            { x: 2 * this.tileSize, y: Math.floor(rows/2) * this.tileSize },
            { x: (cols - 3) * this.tileSize, y: Math.floor(rows/2) * this.tileSize },
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
                    bullet.velocity.x *= -1;
                } else {
                    bullet.velocity.y *= -1;
                }
                
                bullet.bounceCount++;
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
    }
}

export default Map;
