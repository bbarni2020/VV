import Player from './player.js';
import Bullet from './bullet.js';
import Explosion from './explosion.js';
import Map from './map.js';
import input from './input.js';
import MobileControls from './mobile.js';
import { bounceOffWalls } from './physics.js';
import { sendPlayerAction, sendPlayerInfo, getAuthenticationStatus, getOtherPlayers, socket, updateOtherPlayers, playerName, getPlayerId } from './multiplayer.js';

let lastPlayerInfoSent = 0;
const playerInfoInterval = 100;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const FIXED_MAP_WIDTH = 1280;
const FIXED_MAP_HEIGHT = 720;
const gameMap = new Map(FIXED_MAP_WIDTH, FIXED_MAP_HEIGHT);

window.gameMap = gameMap;

const safeSpawn = gameMap.getSafeSpawnPosition(20);
const playerColor = localStorage.getItem('playerColor') || '#4285f4';
const player = new Player(safeSpawn.x, safeSpawn.y, 5, playerColor);
const bullets = [];
const explosions = [];
const otherPlayerBullets = [];

const mobileControls = new MobileControls();
let mobileInputState = { left: false, right: false, up: false, down: false, shoot: false, reload: false };
let lastMobileShot = 0;
let lastMobileReload = 0;
const mobileShotCooldown = 150;
const mobileReloadCooldown = 500;

console.log('Mobile controls active:', mobileControls.isActive());

let kills = 0;
let lastTime = 0;

socket.on('player_action', (data) => {
    if (data.action.type === 'shoot') {
        const bulletData = data.action;
        otherPlayerBullets.push(new Bullet(
            bulletData.position.x, 
            bulletData.position.y, 
            bulletData.velocity.x, 
            bulletData.velocity.y,
            data.playerId
        ));
    } else if (data.action.type === 'player_hit') {
        if (data.action.targetId === getPlayerId()) {
            const damage = data.action.isOwnBullet ? 5 : 10;
            const died = player.takeDamage(damage, data.action.isOwnBullet);
            if (died) {
                explosions.push(new Explosion(player.position.x, player.position.y));
                sendPlayerAction({
                    type: 'player_died',
                    killerId: data.playerId,
                    timestamp: Date.now()
                });
            }
        }
    } else if (data.action.type === 'player_died') {
        if (data.action.killerId === getPlayerId()) {
            kills++;
        }
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
    updateOtherPlayers(deltaTime);
    player.update(deltaTime);
    
    gameMap.updateHealthPickups();
    gameMap.checkHealthPickup(player);
    
    if (player.isDead && player.respawnTimer <= 0) {
        player.respawn(gameMap);
    }
    
    let playerMoved = false;

    if (mobileControls.isActive()) {
        mobileInputState = mobileControls.getInputState();
    }

    if (input.isKeyPressed('KeyW') || input.isKeyPressed('ArrowUp') || mobileInputState.up) {
        player.move('up', gameMap);
        playerMoved = true;
    }
    if (input.isKeyPressed('KeyS') || input.isKeyPressed('ArrowDown') || mobileInputState.down) {
        player.move('down', gameMap);
        playerMoved = true;
    }
    if (input.isKeyPressed('KeyA') || input.isKeyPressed('ArrowLeft') || mobileInputState.left) {
        player.move('left', gameMap);
        playerMoved = true;
    }
    if (input.isKeyPressed('KeyD') || input.isKeyPressed('ArrowRight') || mobileInputState.right) {
        player.move('right', gameMap);
        playerMoved = true;
    }

    const mobileShootTime = Date.now();
    if (mobileInputState.shoot && !player.isDead && player.ammo > 0 && player.reloadTime <= 0 && 
        mobileShootTime - lastMobileShot >= mobileShotCooldown) {
        
        const shootDirection = mobileControls.getShootingDirection(player.position.x, player.position.y);
        
        console.log('Mobile directional shooting:', shootDirection);
        const bulletData = player.shoot(shootDirection.targetX, shootDirection.targetY);
        
        if (bulletData) {
            bullets.push(new Bullet(bulletData.x, bulletData.y, bulletData.velocityX, bulletData.velocityY, getPlayerId()));
            sendPlayerAction({
                type: 'shoot',
                position: { x: bulletData.x, y: bulletData.y },
                velocity: { x: bulletData.velocityX, y: bulletData.velocityY },
                timestamp: Date.now()
            });
            
            console.log('Bullet created with velocity:', { vx: bulletData.velocityX, vy: bulletData.velocityY });
            lastMobileShot = mobileShootTime;
        }
    }

    const mobileReloadTime = Date.now();
    if (mobileInputState.reload && !player.isDead && player.reloadTime <= 0 && player.ammo < player.maxAmmo &&
        mobileReloadTime - lastMobileReload >= mobileReloadCooldown) {
        player.reloadTime = player.reloadDuration;
        lastMobileReload = mobileReloadTime;
    }
    
    const now = Date.now();
    if (now-lastPlayerInfoSent > playerInfoInterval && getAuthenticationStatus()) {
        sendPlayerInfo({
            position: player.position,
            kills: kills,
            bulletCount: bullets.length,
            health: player.health,
            isDead: player.isDead,
            ammo: player.ammo,
            reloadTime: player.reloadTime,
            color: player.color,
            timestamp: now
        });
        lastPlayerInfoSent = now
    }

    camera.update(player, gameMap.width, gameMap.height, canvas.width, canvas.height);

    for (let i = bullets.length - 1; i >= 0; i--) {
        bullets[i].update();
        
        const otherPlayers = getOtherPlayers();
        let bulletRemoved = false;
        
        for (const playerId of Object.keys(otherPlayers)) {
            const otherPlayer = otherPlayers[playerId];
            if (otherPlayer.isDead) continue;
            
            const playerPos = otherPlayer.displayPosition || otherPlayer.position;
            const dx = bullets[i].position.x - playerPos.x;
            const dy = bullets[i].position.y - playerPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < bullets[i].radius + 10) {
                explosions.push(new Explosion(bullets[i].position.x, bullets[i].position.y));
                
                otherPlayer.clientHit = true;
                otherPlayer.clientHitTime = Date.now();
                
                sendPlayerAction({
                    type: 'player_hit',
                    targetId: playerId,
                    isOwnBullet: false,
                    timestamp: Date.now()
                });
                bullets.splice(i, 1);
                bulletRemoved = true;
                break;
            }
        }
        
        if (bulletRemoved) continue;
        
        if (!player.isDead) {
            const dx = bullets[i].position.x - player.position.x;
            const dy = bullets[i].position.y - player.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < bullets[i].radius + 10) {
                const isOwnBullet = bullets[i].ownerId === getPlayerId();
                
                if (!isOwnBullet || bullets[i].hasBounced) {
                    explosions.push(new Explosion(bullets[i].position.x, bullets[i].position.y));
                    const died = player.takeDamage(5, isOwnBullet);
                    if (died) {
                        explosions.push(new Explosion(player.position.x, player.position.y));
                        sendPlayerAction({
                            type: 'player_died',
                            killerId: bullets[i].ownerId,
                            timestamp: Date.now()
                        });
                    }
                    bullets.splice(i, 1);
                    bulletRemoved = true;
                }
            }
        }
        
        if (bulletRemoved) continue;
        
        if (i < bullets.length && bullets[i]) {
            const shouldRemove = bounceOffWalls(bullets[i], gameMap.width, gameMap.height, gameMap);
            
            if (shouldRemove) {
                explosions.push(new Explosion(bullets[i].position.x, bullets[i].position.y));
                bullets.splice(i, 1);
            }
        }
    }
    
    for (let i = otherPlayerBullets.length - 1; i >= 0; i--) {
        otherPlayerBullets[i].update();
        
        if (!player.isDead) {
            const dx = otherPlayerBullets[i].position.x - player.position.x;
            const dy = otherPlayerBullets[i].position.y - player.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < otherPlayerBullets[i].radius + 10) {
                const isOwnBullet = otherPlayerBullets[i].ownerId === getPlayerId();
                
                if (!isOwnBullet || otherPlayerBullets[i].hasBounced) {
                    explosions.push(new Explosion(otherPlayerBullets[i].position.x, otherPlayerBullets[i].position.y));
                    const damage = isOwnBullet ? 5 : 10;
                    const died = player.takeDamage(damage, isOwnBullet);
                    if (died) {
                        explosions.push(new Explosion(player.position.x, player.position.y));
                        sendPlayerAction({
                            type: 'player_died',
                            killerId: otherPlayerBullets[i].ownerId,
                            timestamp: Date.now()
                        });
                    }
                    otherPlayerBullets.splice(i, 1);
                    continue;
                }
            }
        }
        
        if (i < otherPlayerBullets.length && otherPlayerBullets[i]) {
            const shouldRemove = bounceOffWalls(otherPlayerBullets[i], gameMap.width, gameMap.height, gameMap);
            
            if (shouldRemove) {
                explosions.push(new Explosion(otherPlayerBullets[i].position.x, otherPlayerBullets[i].position.y));
                otherPlayerBullets.splice(i, 1);
            }
        }
    }
    
    for (let i = explosions.length - 1; i >= 0; i--) {
        const shouldRemoveExplosion = explosions[i].update();
        if (shouldRemoveExplosion) {
            explosions.splice(i, 1);
        }
    }
    
    document.getElementById('bulletCount').textContent = bullets.length;
    
    const healthElement = document.getElementById('health');
    if (healthElement) {
        healthElement.textContent = player.health;
    }
    
    const killsElement = document.getElementById('kills');
    if (killsElement) {
        killsElement.textContent = kills;
    }
    
    const ammoElement = document.getElementById('ammo');
    if (ammoElement) {
        ammoElement.textContent = player.ammo;
    }
    
    const reloadStatus = document.getElementById('reloadStatus');
    const reloadTimeElement = document.getElementById('reloadTime');
    if (player.reloadTime > 0) {
        reloadStatus.style.display = 'block';
        reloadTimeElement.textContent = Math.ceil(player.reloadTime / 1000);
    } else {
        reloadStatus.style.display = 'none';
    }
    
    const otherPlayers = getOtherPlayers();
    const totalPlayers = Object.keys(otherPlayers).length + 1;
    document.getElementById('playerCount').textContent = totalPlayers;
    
    const currentTime = Date.now();
    const timeElapsed = currentTime - window.gameStartTime;
    const timeRemaining = Math.max(0, window.gameTimeLimit - timeElapsed);
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    const timeElement = document.getElementById('gameTime');
    if (timeElement) {
        timeElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (timeRemaining <= 0 && !gameEnded) {
        gameEnded = true;
        
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = 'ROUND ENDED';
            statusElement.style.color = '#ffcc00';
        }
        
        setTimeout(() => {
            gameEnded = false;
        }, 3000);
    }
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
    if (playerData.isDead) {
        drawOtherPlayerDeath(ctx, playerData, cameraX, cameraY);
        return;
    }
    
    const size = 20;
    const time = Date.now() * 0.005;
    const displayPos = playerData.displayPosition || playerData.position;
    const walkBob = Math.sin(time + displayPos.x * 0.01) * 1.2;
    const walkSquish = 1 + Math.sin(time * 2 + displayPos.y * 0.01) * 0.06;
    
    const baseX = displayPos.x - size / 2 - cameraX;
    const baseY = displayPos.y - size / 2 - cameraY;
    
    const x = baseX + Math.sin(time * 0.5) * 0.3;
    const y = baseY + walkBob;
    
    const width = size * walkSquish;
    const height = size / walkSquish;
    
    const playerNameText = playerData.name || 'PLAYER';
    const nameWidth = playerNameText.length * 6;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x + width/2 - nameWidth/2 - 2, y - 25, nameWidth + 4, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(playerNameText, x + width/2, y - 19);
    
    const health = playerData.health || 100;
    const maxHealth = 100;
    const healthPercent = health / maxHealth;
    const barWidth = size + 4;
    const barHeight = 3;
    const barX = x + width/2 - barWidth/2;
    const barY = y - 15;
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(barX, barY, barWidth, barHeight);
    
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
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    
    ctx.save();
    ctx.translate(x + width/2, y + height/2);
    ctx.rotate(Math.sin(time * 0.8) * 0.02);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-width/2 - 2, -height/2 - 2, width + 4, height + 4);
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(-width/2 - 1, -height/2 - 1, width + 2, height + 2);
    
    ctx.fillStyle = playerData.color || '#ff6b6b';
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
    
    if (Math.sin(time * 4) > 0.7) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 2; i++) {
            const sparkleX = -width/2 + Math.random() * width;
            const sparkleY = -height/2 + Math.random() * height;
            ctx.fillRect(sparkleX, sparkleY, 1, 1);
        }
    }
    
    ctx.restore();
    
    if (playerData.reloadTime > 0) {
        drawOtherPlayerReload(ctx, playerData, cameraX, cameraY);
    }
}

function drawOtherPlayerDeath(ctx, playerData, cameraX, cameraY) {
    const displayPos = playerData.displayPosition || playerData.position;
    const baseX = displayPos.x - 10 - cameraX;
    const baseY = displayPos.y - 10 - cameraY;
    
    const time = Date.now() * 0.01;
    
    ctx.save();
    ctx.translate(baseX + 10, baseY + 10);
    
    const rotation = time;
    const scale = 0.5 + Math.sin(time * 2) * 0.2;
    const opacity = 0.3 + Math.sin(time * 3) * 0.2;
    
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    ctx.globalAlpha = opacity;
    
    ctx.fillStyle = playerData.color || '#ff0000';
    ctx.fillRect(-10, -10, 20, 20);
    
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + time;
        const radius = 15;
        const sparkleX = Math.cos(angle) * radius;
        const sparkleY = Math.sin(angle) * radius;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sparkleX - 1, sparkleY - 1, 2, 2);
    }
    
    ctx.restore();
}

function drawOtherPlayerReload(ctx, playerData, cameraX, cameraY) {
    const time = Date.now() * 0.008;
    const displayPos = playerData.displayPosition || playerData.position;
    const reloadProgress = playerData.reloadTime > 0 ? 1 - (playerData.reloadTime / 2000) : 0;
    
    const x = displayPos.x - cameraX;
    const y = displayPos.y - 20 - 20 - cameraY;
    
    ctx.save();
    ctx.translate(x, y + Math.sin(time * 2) * 2);
    
    const opacity = 0.8 + Math.sin(time * 4) * 0.2;
    ctx.globalAlpha = opacity;
    
    const textSize = 7 + Math.sin(time * 3) * 0.8;
    ctx.font = `${textSize}px monospace`;
    ctx.textAlign = 'center';
    
    const shadowOffset = Math.sin(time * 5) * 0.4;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillText('RELOADING', shadowOffset, shadowOffset);
    
    const hue = (time * 60) % 360;
    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    ctx.fillText('RELOADING', 0, 0);
    
    for (let i = 0; i < 3; i++) {
        const dotOpacity = Math.sin(time * 6 + i * 0.5) > 0 ? 1 : 0.3;
        ctx.globalAlpha = dotOpacity;
        ctx.fillStyle = `hsl(${(hue + i * 30) % 360}, 80%, 70%)`;
        ctx.fillText('.', 30 + i * 5, 0);
    }
    
    ctx.globalAlpha = 0.6;
    const barWidth = 50;
    const barHeight = 2;
    const barY = 7;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(-barWidth/2 - 1, barY - 1, barWidth + 2, barHeight + 2);
    
    ctx.fillStyle = 'rgba(100, 100, 100, 0.8)';
    ctx.fillRect(-barWidth/2, barY, barWidth, barHeight);
    
    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
    ctx.fillRect(-barWidth/2, barY, barWidth * reloadProgress, barHeight);
    
    ctx.restore();
}

let gameStartTime = Date.now();
let gameTimeLimit = 10 * 60 * 1000;
let gameEnded = false;

window.gameStartTime = gameStartTime;
window.gameTimeLimit = gameTimeLimit;
window.resetPlayerState = resetPlayerState;

function render() {
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawBackground(ctx, camera.x, camera.y);
    
    gameMap.draw(ctx, camera.x, camera.y);
    
    player.draw(ctx, camera.x, camera.y);
    player.drawHealthBar(ctx, camera.x, camera.y);
    
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
    if (player.isDead) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left + camera.x;
    const mouseY = event.clientY - rect.top + camera.y;
    
    const bulletData = player.shoot(mouseX, mouseY);
    if (bulletData) {
        bullets.push(new Bullet(bulletData.x, bulletData.y, bulletData.velocityX, bulletData.velocityY, getPlayerId()));

        sendPlayerAction({
            type: 'shoot',
            position: { x: bulletData.x, y: bulletData.y },
            velocity: { x: bulletData.velocityX, y: bulletData.velocityY },
            timestamp: Date.now()
        });
    }
});

window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') {
        event.preventDefault();
        if (player.isDead || player.ammo <= 0 || player.reloadTime > 0) return;
        
        player.ammo--;
        if (player.ammo <= 0) {
            player.reloadTime = player.reloadDuration;
        }
        
        bullets.push(new Bullet(player.position.x, player.position.y, 0, -8, getPlayerId()));
        sendPlayerAction({
            type: 'shoot',
            position: { x: player.position.x, y: player.position.y },
            velocity: { x: 0, y: -8 },
            timestamp: Date.now()
        });
    }
    
    if (event.code === 'KeyR') {
        event.preventDefault();
        if (player.isDead || player.reloadTime > 0 || player.ammo === player.maxAmmo) return;
        
        player.reloadTime = player.reloadDuration;
    }
    
    if (event.code === 'KeyM') {
        import('./multiplayer.js').then(module => {
            module.debugMultiplayerState();
        });
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        const menu = document.getElementById('menu');
        if (menu.classList.contains('show')) {
            menu.classList.remove('show');
        } else {
            menu.classList.add('show');
        }
    }
});

document.getElementById('menu').addEventListener('click', (event) => {
    if (event.target.textContent === 'Resume') {
        const menu = document.getElementById('menu');
        menu.classList.remove('show');
    } else if (event.target.textContent === 'Leave') {
        window.location.href = 'index.html';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const backButton = document.getElementById('backToLobby');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.href = 'index.html';
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

window.hideLoadingScreen = hideLoadingScreen;

let globalVolume = 0.5;
let backgroundMusic = null;

function initializeAudio() {
    const savedVolume = localStorage.getItem('gameVolume');
    if (savedVolume) {
        globalVolume = parseFloat(savedVolume);
        const volumeSlider = document.getElementById('volume');
        const volumeValue = document.getElementById('volumeValue');
        if (volumeSlider && volumeValue) {
            volumeSlider.value = Math.round(globalVolume * 100);
            volumeValue.textContent = Math.round(globalVolume * 100) + '%';
        }
    }
}

function playBackgroundMusic() {
    if (!backgroundMusic) {
        backgroundMusic = new Audio('sound/VV.mp3');
        backgroundMusic.loop = true;
    }
    backgroundMusic.volume = globalVolume;
    backgroundMusic.play().catch(error => {
        console.log('Background music play failed:', error);
    });
}

function updateBackgroundMusicVolume() {
    if (backgroundMusic) {
        backgroundMusic.volume = globalVolume;
    }
}

function getGlobalVolume() {
    return globalVolume;
}

function playReloadSound() {
    if (globalVolume > 0) {
        const reloadSound = new Audio('sound/reload.mp3');
        reloadSound.volume = globalVolume * 0.7;
        reloadSound.play().catch(error => {
            console.log('Reload sound play failed:', error);
        });
    }
}

function playRestoreSound() {
    if (globalVolume > 0) {
        const restoreSound = new Audio('sound/restore.mp3');
        restoreSound.volume = globalVolume * 0.8;
        restoreSound.play().catch(error => {
            console.log('Restore sound play failed:', error);
        });
    }
}

function playLowHealthSound() {
    if (globalVolume > 0) {
        const lowHealthSound = new Audio('sound/low.mp3');
        lowHealthSound.volume = globalVolume * 0.6;
        lowHealthSound.play().catch(error => {
            console.log('Low health sound play failed:', error);
        });
    }
}

function playDamageSound() {
    if (globalVolume > 0) {
        const damageSound = new Audio('sound/damage.wav');
        damageSound.volume = globalVolume * 0.7;
        damageSound.play().catch(error => {
            console.log('Damage sound play failed:', error);
        });
    }
}

function playDeathSound() {
    if (globalVolume > 0) {
        const deathSound = new Audio('sound/die.mp3');
        deathSound.volume = globalVolume * 0.8;
        deathSound.play().catch(error => {
            console.log('Death sound play failed:', error);
        });
    }
}

window.getGlobalVolume = getGlobalVolume;
window.playReloadSound = playReloadSound;
window.playRestoreSound = playRestoreSound;
window.playLowHealthSound = playLowHealthSound;
window.playDamageSound = playDamageSound;
window.playDeathSound = playDeathSound;
window.playDamageSound = playDamageSound;
window.playDeathSound = playDeathSound;

const volumeSlider = document.getElementById('volume');
const volumeValue = document.getElementById('volumeValue');

if (volumeSlider && volumeValue) {
    volumeSlider.addEventListener('input', (event) => {
        const volumeLevel = event.target.value / 100;
        globalVolume = volumeLevel;
        volumeValue.textContent = event.target.value + '%';
        localStorage.setItem('gameVolume', globalVolume.toString());
        updateBackgroundMusicVolume();
        console.log(`Volume set to: ${Math.round(globalVolume * 100)}%`);
    });
}

initializeAudio();
setTimeout(() => {
    playBackgroundMusic();
}, 1000);

requestAnimationFrame(gameLoop);

function resetPlayerState() {

    player.health = 100;
    player.isDead = false;
    player.ammo = player.maxAmmo;
    player.reloadTime = 0;
    player.lowHealthSoundPlayed = false;
    

    const safeSpawn = gameMap.getSafeSpawnPosition(20);
    player.position.x = safeSpawn.x;
    player.position.y = safeSpawn.y;
    
    bullets.length = 0;
    otherPlayerBullets.length = 0;
    explosions.length = 0;
}