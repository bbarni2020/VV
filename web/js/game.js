import Player from './player.js';
import Bullet from './bullet.js';
import Explosion from './explosion.js';
import Map from './map.js';
import input from './input.js';
import { bounceOffWalls } from './physics.js';
import { sendPlayerAction, sendPlayerInfo, getAuthenticationStatus } from './multiplayer.js';

let lastPlayerInfoSent = 0;
const playerInfoInterval = 100;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gameMap = new Map(canvas.width, canvas.height);

const safeSpawn = gameMap.getSafeSpawnPosition(20);
const player = new Player(safeSpawn.x, safeSpawn.y, 5);
const bullets = [];
const explosions = [];

let score = 0;
let lastTime = 0;

const camera = {
    x: 0,
    y: 0,
    update: function(player, mapWidth, mapHeight, canvasWidth, canvasHeight) {
        this.x = player.position.x - canvasWidth / 2;
        this.y = player.position.y - canvasHeight / 2;
        
        this.x = Math.max(0, Math.min(mapWidth - canvasWidth, this.x));
        this.y = Math.max(0, Math.min(mapHeight - canvasHeight, this.y));
    }
};

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    render();

    requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
    let playerMoved = false;

    if (input.isKeyPressed('KeyW') || input.isKeyPressed('ArrowUp')) {
        player.move('up', gameMap);
        playerMoved = true;
    }
    if (input.isKeyPressed('KeyS') || input.isKeyPressed('ArrowDown')) {
        player.move('down', gameMap);
        playerMoved = true;
    }
    if (input.isKeyPressed('KeyA') || input.isKeyPressed('ArrowLeft')) {
        player.move('left', gameMap);
        playerMoved = true;
    }
    if (input.isKeyPressed('KeyD') || input.isKeyPressed('ArrowRight')) {
        player.move('right', gameMap);
        playerMoved = true;
    }
    const now = Date.now();
    if (now-lastPlayerInfoSent > playerInfoInterval && getAuthenticationStatus()) {
        sendPlayerInfo({
            position: player.position,
            score: score,
            bulletCount: bullets.length,
            timestamp: now
        });
        lastPlayerInfoSent = now
    }


    camera.update(player, gameMap.width, gameMap.height, canvas.width, canvas.height);

    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        const shouldRemove = bounceOffWalls(bullets[i], gameMap.width, gameMap.height, gameMap);
        
        if (shouldRemove) {
            explosions.push(new Explosion(bullets[i].position.x, bullets[i].position.y));
            bullets.splice(i, 1);
            score += 10;
        }
    }
    
    for (let i = explosions.length - 1; i >= 0; i--) {
        const shouldRemoveExplosion = explosions[i].update();
        if (shouldRemoveExplosion) {
            explosions.splice(i, 1);
        }
    }
    
    document.getElementById('score').textContent = score;
    document.getElementById('bulletCount').textContent = bullets.length;
}

function drawBackground(ctx, cameraX, cameraY) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    const gridSize = 32;
    
    const startX = Math.floor(cameraX / gridSize) * gridSize;
    const startY = Math.floor(cameraY / gridSize) * gridSize;
    const endX = startX + canvas.width + gridSize;
    const endY = startY + canvas.height + gridSize;
    
    for (let x = startX; x <= endX; x += gridSize) {
        const screenX = x - cameraX;
        if (screenX >= -gridSize && screenX <= canvas.width + gridSize) {
            ctx.beginPath();
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, canvas.height);
            ctx.stroke();
        }
    }
    
    for (let y = startY; y <= endY; y += gridSize) {
        const screenY = y - cameraY;
        if (screenY >= -gridSize && screenY <= canvas.height + gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(canvas.width, screenY);
            ctx.stroke();
        }
    }
    
    ctx.fillStyle = 'rgba(100, 200, 255, 0.05)';
    for (let x = startX; x <= endX; x += gridSize * 4) {
        for (let y = startY; y <= endY; y += gridSize * 4) {
            const screenX = x - cameraX;
            const screenY = y - cameraY;
            if (screenX >= -gridSize && screenX <= canvas.width && 
                screenY >= -gridSize && screenY <= canvas.height) {
                ctx.fillRect(screenX + 8, screenY + 8, 16, 16);
            }
        }
    }
}

function render() {
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawBackground(ctx, camera.x, camera.y);
    
    gameMap.draw(ctx, camera.x, camera.y);
    
    player.draw(ctx, camera.x, camera.y);
    
    bullets.forEach(bullet => {
        bullet.draw(ctx, camera.x, camera.y);
    });
    
    explosions.forEach(explosion => {
        explosion.draw(ctx, camera.x, camera.y);
    });
}

canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left + camera.x;
    const mouseY = event.clientY - rect.top + camera.y;
    
    const bulletData = player.shoot(mouseX, mouseY);
    bullets.push(new Bullet(bulletData.x, bulletData.y, bulletData.velocityX, bulletData.velocityY));

    sendPlayerAction({
        type: 'shoot',
        position: { x: bulletData.x, y: bulletData.y },
        velocity: { x: bulletData.velocityX, y: bulletData.velocityY },
        timestamp: Date.now()
    })
});

window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault();
        bullets.push(new Bullet(player.position.x, player.position.y, 0, -8));
        sendPlayerAction({
            type: 'shoot',
            position: { x: player.position.x, y: player.position.y },
            velocity: { x: 0, y: -8 },
            timestamp: Date.now()
        });
    }
});

requestAnimationFrame(gameLoop);