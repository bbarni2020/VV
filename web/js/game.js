import Player from './player.js';
import Bullet from './bullet.js';
import Explosion from './explosion.js';
import Map from './map.js';
import input from './input.js';
import { bounceOffWalls } from './physics.js';
import { sendPlayerAction, sendPlayerInfo, getAuthenticationStatus, getOtherPlayers, socket } from './multiplayer.js';

let lastPlayerInfoSent = 0;
const playerInfoInterval = 100;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const FIXED_MAP_WIDTH = 1280;
const FIXED_MAP_HEIGHT = 720;
const gameMap = new Map(FIXED_MAP_WIDTH, FIXED_MAP_HEIGHT);

const safeSpawn = gameMap.getSafeSpawnPosition(20);
const player = new Player(safeSpawn.x, safeSpawn.y, 5);
const bullets = [];
const explosions = [];
const otherPlayerBullets = [];

let score = 0;
let lastTime = 0;

socket.on('player_action', (data) => {
    if (data.action.type === 'shoot') {
        const bulletData = data.action;
        otherPlayerBullets.push(new Bullet(
            bulletData.position.x, 
            bulletData.position.y, 
            bulletData.velocity.x, 
            bulletData.velocity.y
        ));
    }
});

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
    
    for (let i = otherPlayerBullets.length - 1; i >= 0; i--) {
        otherPlayerBullets[i].update();
        const shouldRemove = bounceOffWalls(otherPlayerBullets[i], gameMap.width, gameMap.height, gameMap);
        
        if (shouldRemove) {
            explosions.push(new Explosion(otherPlayerBullets[i].position.x, otherPlayerBullets[i].position.y));
            otherPlayerBullets.splice(i, 1);
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
    
    for (let x = 0; x <= FIXED_MAP_WIDTH; x += gridSize) {
        const screenX = x - cameraX;
        if (screenX >= -gridSize && screenX <= canvas.width + gridSize) {
            ctx.beginPath();
            ctx.moveTo(screenX, Math.max(0, -cameraY));
            ctx.lineTo(screenX, Math.min(canvas.height, FIXED_MAP_HEIGHT - cameraY));
            ctx.stroke();
        }
    }
    
    for (let y = 0; y <= FIXED_MAP_HEIGHT; y += gridSize) {
        const screenY = y - cameraY;
        if (screenY >= -gridSize && screenY <= canvas.height + gridSize) {
            ctx.beginPath();
            ctx.moveTo(Math.max(0, -cameraX), screenY);
            ctx.lineTo(Math.min(canvas.width, FIXED_MAP_WIDTH - cameraX), screenY);
            ctx.stroke();
        }
    }
    
    ctx.fillStyle = 'rgba(100, 200, 255, 0.05)';
    for (let x = 0; x <= FIXED_MAP_WIDTH; x += gridSize * 4) {
        for (let y = 0; y <= FIXED_MAP_HEIGHT; y += gridSize * 4) {
            const screenX = x - cameraX;
            const screenY = y - cameraY;
            if (screenX >= -gridSize && screenX <= canvas.width && 
                screenY >= -gridSize && screenY <= canvas.height) {
                ctx.fillRect(screenX + 8, screenY + 8, 16, 16);
            }
        }
    }
}

function drawOtherPlayer(ctx, playerData, cameraX, cameraY) {
    const size = 20;
    const time = Date.now() * 0.005;
    const walkBob = Math.sin(time + playerData.position.x * 0.01) * 1.2;
    const walkSquish = 1 + Math.sin(time * 2 + playerData.position.y * 0.01) * 0.06;
    
    const baseX = playerData.position.x - size / 2 - cameraX;
    const baseY = playerData.position.y - size / 2 - cameraY;
    
    const x = baseX + Math.sin(time * 0.5) * 0.3;
    const y = baseY + walkBob;
    
    const width = size * walkSquish;
    const height = size / walkSquish;
    
    ctx.save();
    ctx.translate(x + width/2, y + height/2);
    ctx.rotate(Math.sin(time * 0.8) * 0.02);
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(-width/2 - 1, -height/2 - 1, width + 2, height + 2);
    
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(-width/2, -height/2, width, height);
    
    const eyeSize = 3 + Math.sin(time * 3) * 0.2;
    const eyeY = -height/2 + 4 + Math.sin(time) * 0.3;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-width/2 + 4, eyeY, eyeSize, eyeSize);
    ctx.fillRect(width/2 - 7, eyeY, eyeSize, eyeSize);
    
    ctx.fillStyle = '#000000';
    const pupilOffset = Math.sin(time * 0.3) * 0.4;
    ctx.fillRect(-width/2 + 5 + pupilOffset, eyeY + 1, 1, 1);
    ctx.fillRect(width/2 - 6 + pupilOffset, eyeY + 1, 1, 1);
    
    const blushIntensity = Math.abs(Math.sin(time * 0.4)) * 0.6 + 0.4;
    ctx.fillStyle = `rgba(255, 204, 203, ${blushIntensity})`;
    ctx.fillRect(-width/2 + 2, -height/2 + 2, width - 4, 3);
    
    ctx.restore();
}

function render() {
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawBackground(ctx, camera.x, camera.y);
    
    gameMap.draw(ctx, camera.x, camera.y);
    
    player.draw(ctx, camera.x, camera.y);
    
    const otherPlayers = getOtherPlayers();
    Object.keys(otherPlayers).forEach(playerId => {
        drawOtherPlayer(ctx, otherPlayers[playerId], camera.x, camera.y);
    });
    
    bullets.forEach(bullet => {
        bullet.draw(ctx, camera.x, camera.y);
    });
    
    ctx.save();
    otherPlayerBullets.forEach(bullet => {
        const x = bullet.position.x - bullet.radius - camera.x;
        const y = bullet.position.y - bullet.radius - camera.y;
        
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(x + bullet.radius, y + bullet.radius, bullet.radius + 1, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(x + bullet.radius, y + bullet.radius, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + bullet.radius - 1, y + bullet.radius - 1, 1, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
    
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

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.5s ease-out';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
    }
}

setTimeout(() => {
    hideLoadingScreen();
    requestAnimationFrame(gameLoop);
}, 3000);