const serverUrl = localStorage.getItem('serverUrl') || 'http://localhost:7895';
console.log('Connecting to multiplayer server at:', serverUrl);
const socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5
});

let playerName = null;
let playerId = null;
let playerToken = null;
let isAuthenticated = false;

let otherPlayers = {};
let heartbeatInterval = null;

function startHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    
    heartbeatInterval = setInterval(() => {
        if (socket && socket.connected && isAuthenticated) {
            socket.emit('heartbeat', { 
                playerId: playerId, 
                token: playerToken,
                timestamp: Date.now()
            });
        }
    }, 30000);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}


let connectionTimeout = null;

socket.on('connect', () => {
    console.log('Connected to the server at: ' + serverUrl);
    
    playerName = localStorage.getItem('playerName');
    
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = 'CONNECTED - WAITING...';
        statusElement.style.color = '#ffff00';
    }
    
    console.log('Waiting for connection acknowledgment...');
    
    connectionTimeout = setTimeout(() => {
        console.log('Connection acknowledgment timeout, proceeding with authentication...');
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.textContent = 'AUTHENTICATING...';
            statusElement.style.color = '#ffff00';
        }
        authenticatePlayer();
    }, 2000);
})

socket.on('connection_acknowledged', (data) => {
    console.log('Connection acknowledged by server:', data.sid);
    
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
    }
    
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = 'AUTHENTICATING...';
        statusElement.style.color = '#ffff00';
    }
    

    setTimeout(() => {
        authenticatePlayer();
    }, 500);
})

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    stopHeartbeat();
    

    isAuthenticated = false;
    playerId = null;
    playerToken = null;
    

    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
    }
    
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = 'DISCONNECTED';
        statusElement.style.color = '#ff0000';
    }
})

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = 'CONNECTION ERROR';
        statusElement.style.color = '#ff0000';
    }
    
    const errorBox = document.getElementById('connectionErrorBox');
    if (errorBox) {
        errorBox.style.display = 'block';
    }
    
    if (window.hideLoadingScreen) {
        window.hideLoadingScreen();
    }
});

socket.on('auth_success', (data) => {
    playerId = data.playerId;
    playerToken = data.token;
    isAuthenticated = true;
    localStorage.setItem('playerId', playerId);
    localStorage.setItem('playerToken', playerToken);
    console.log('Authentication successful: ', playerId);
    
    startHeartbeat();
    
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = 'CONNECTED';
        statusElement.style.color = '#00ff00';
    }
    
    if (window.hideLoadingScreen) {
        window.hideLoadingScreen();
    }
});

socket.on('auth_failed', () => {
    console.error('Authentication failed.');
    playerId = null;
    playerToken = null;
    isAuthenticated = false;
    stopHeartbeat();
    localStorage.removeItem('playerId');
    localStorage.removeItem('playerToken');
    window.location.reload();
});

socket.on('players_data', (data) => {
    console.log('Received players data: ', data);
    const playerCount = Object.keys(data.players).length;
    otherPlayers = {};
    Object.keys(data.players).forEach(id => {
        if (id !== playerId) {
            const playerData = data.players[id];
            otherPlayers[id] = {
                ...playerData,
                displayPosition: { ...playerData.position },
                targetPosition: { ...playerData.position },
                velocity: { x: 0, y: 0 },
                lastUpdate: Date.now()
            };
        }
    });
    console.log(`Loaded ${Object.keys(otherPlayers).length} other players out of ${playerCount} total`);
})

socket.on('player_joined', (data) => {
    console.log('Player joined: ', data.playerId);
    if (data.playerId !== playerId) {
        const playerData = data.data;
        otherPlayers[data.playerId] = {
            ...playerData,
            displayPosition: { ...playerData.position },
            targetPosition: { ...playerData.position },
            velocity: { x: 0, y: 0 },
            lastUpdate: Date.now()
        };
        console.log(`Added new player: ${data.playerId}, total other players: ${Object.keys(otherPlayers).length}`);
    }
})

socket.on('player_disconnected', (data) => {
    console.log('Player disconnected: ' + data.playerId);
    if (data.playerId in otherPlayers) {
        delete otherPlayers[data.playerId];
        console.log(`Removed disconnected player: ${data.playerId}, remaining players: ${Object.keys(otherPlayers).length}`);
    }
})

window.addEventListener('beforeunload', () => {
    stopHeartbeat();
    if (socket && socket.connected) {
        socket.disconnect();
    }
})

window.addEventListener('unload', () => {
    stopHeartbeat();
    if (socket && socket.connected) {
        socket.disconnect();
    }
})

window.addEventListener('pagehide', () => {
    stopHeartbeat();
    if (socket && socket.connected) {
        socket.disconnect();
    }
})

socket.on('player_info_update', (data) => {
    if (data.playerId !== playerId) {
        if (!(data.playerId in otherPlayers)) {
            otherPlayers[data.playerId] = {
                position: data.data.position || { x: 400, y: 300 },
                displayPosition: { ...(data.data.position || { x: 400, y: 300 }) },
                targetPosition: { ...(data.data.position || { x: 400, y: 300 }) },
                velocity: { x: 0, y: 0 },
                lastUpdate: Date.now(),
                kills: data.data.kills || 0,
                bulletCount: data.data.bulletCount || 0,
                health: data.data.health || 100,
                isDead: data.data.isDead || false
            };
            console.log(`Added new player from update: ${data.playerId}`);
        }
        
        const player = otherPlayers[data.playerId];
        const now = Date.now();
        const deltaTime = now - player.lastUpdate;
        
        if (data.data.position) {
            const oldPos = player.targetPosition;
            const newPos = data.data.position;
            
            player.velocity.x = (newPos.x - oldPos.x) / Math.max(deltaTime, 16);
            player.velocity.y = (newPos.y - oldPos.y) / Math.max(deltaTime, 16);
            
            player.targetPosition = { ...newPos };
        }
        
        Object.assign(player, data.data);
        player.lastUpdate = now;
    }
})

socket.on('player_action', (data) => {
})

socket.on('health_pickup_collected', (data) => {
    if (data.playerId === playerId) {
        console.log('Health pickup collected, new health:', data.newHealth);
    }
    if (window.gameMap && window.gameMap.healthPickups && window.gameMap.healthPickups[data.pickupIndex]) {
        window.gameMap.healthPickups[data.pickupIndex].collected = true;
        window.gameMap.healthPickups[data.pickupIndex].collectedTime = Date.now();
    }
})

socket.on('wall_damaged', (data) => {
    if (window.gameMap) {
        window.gameMap.updateWallHealth(data.x, data.y, data.health);
    }
})


socket.on('wall_destroyed', (data) => {
    if (window.gameMap) {
        window.gameMap.removeWall(data.x, data.y);
    }
})

socket.on('map_state', (data) => {
    if (window.gameMap) {
        window.gameMap.updateMapState(data.destructible_walls, data.health_pickups);
    }
})

socket.on('error_message', (message) => {
    console.error('Server error: ', message);
})

socket.on('game_timer', (data) => {
    if (window.gameStartTime !== undefined) {
        window.gameStartTime = data.start_time;
        window.gameTimeLimit = data.time_limit;
    }
});

socket.on('game_reset', (data) => {
    console.log('Game reset received');
    
    if (window.gameMap) {
        window.gameMap.updateMapState(data.destructible_walls, data.health_pickups);
    }
    
    if (window.gameStartTime !== undefined) {
        window.gameStartTime = data.start_time;
        window.gameTimeLimit = data.time_limit;
    }
    

    if (window.resetPlayerState) {
        window.resetPlayerState();
    }
    

    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = 'NEW ROUND';
        statusElement.style.color = '#ffcc00';
        

        setTimeout(() => {
            if (statusElement) {
                statusElement.textContent = 'CONNECTED';
                statusElement.style.color = '#00ff00';
            }
        }, 3000);
    }
    

    const notification = document.createElement('div');
    notification.className = 'game-notification';
    notification.textContent = 'NEW ROUND STARTED';
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 1000);
    }, 2000);
});

function authenticatePlayer() {

    if (!socket || !socket.connected) {
        console.log('Socket not connected, delaying authentication...');
        setTimeout(() => authenticatePlayer(), 1000);
        return;
    }
    
    if (!playerName) {
        playerName = prompt('Enter your player name:') || 'Anonymous';
        localStorage.setItem('playerName', playerName);
    }
    
    const playerColor = localStorage.getItem('playerColor') || '#4285f4';
    
    const storedToken = localStorage.getItem('playerToken');
    const storedId = localStorage.getItem('playerId');

    console.log('Attempting authentication...', { 
        storedId: !!storedId, 
        storedToken: !!storedToken,
        socketConnected: socket.connected 
    });

    if (storedId && storedToken) {
        console.log('Using stored credentials');
        socket.emit('authenticate', { id: storedId, token: storedToken, name: playerName, color: playerColor });
    } else {
        console.log('Requesting new authentication');
        socket.emit('request_auth', { name: playerName, color: playerColor });
    }
}

function sendPlayerAction(action) {
    if (!isAuthenticated || !playerId || !playerToken || !socket || !socket.connected) {
        console.warn('Cannot send player action - not authenticated or not connected', {
            isAuthenticated,
            hasPlayerId: !!playerId,
            hasPlayerToken: !!playerToken,
            socketConnected: socket && socket.connected
        });
        return false;
    }

    const secureAction = {
        token: playerToken,
        playerId: playerId, 
        timestamp: Date.now(),
        action: action
    };

    socket.emit('player_action', secureAction);
    return true;
}

function sendPlayerInfo(playerInfo) {
    if (!isAuthenticated || !playerId || !playerToken || !socket || !socket.connected) {
        console.warn('Cannot send player info - not authenticated or not connected', {
            isAuthenticated,
            hasPlayerId: !!playerId,
            hasPlayerToken: !!playerToken,
            socketConnected: socket && socket.connected
        });
        return false;
    }

    const securePayload = {
        token: playerToken,
        playerId: playerId,
        timestamp: Date.now(),
        data: playerInfo
    };

    socket.emit('player_info_update', securePayload);
    return true;
}

function getAuthenticationStatus() {
    return isAuthenticated && playerId && playerToken && socket && socket.connected;
}

function waitForAuthentication(callback, maxRetries = 50, currentRetry = 0) {
    if (getAuthenticationStatus()) {
        callback();
    } else if (currentRetry < maxRetries) {
        setTimeout(() => {
            waitForAuthentication(callback, maxRetries, currentRetry + 1);
        }, 100);
    } else {
        console.error('Authentication timeout - unable to authenticate within 5 seconds');
    }
}

function getOtherPlayers() {
    return otherPlayers;
}

function getPlayerId() {
    return playerId;
}

function updateOtherPlayers(deltaTime) {
    Object.keys(otherPlayers).forEach(id => {
        const player = otherPlayers[id];
        const now = Date.now();
        const timeSinceUpdate = now - player.lastUpdate;
        
        if (timeSinceUpdate > 200) {
            const extrapolationTime = Math.min(timeSinceUpdate - 100, 100);
            const predictedX = player.targetPosition.x + (player.velocity.x * extrapolationTime);
            const predictedY = player.targetPosition.y + (player.velocity.y * extrapolationTime);
            
            const lerpFactor = Math.min(deltaTime * 0.008, 1);
            player.displayPosition.x += (predictedX - player.displayPosition.x) * lerpFactor;
            player.displayPosition.y += (predictedY - player.displayPosition.y) * lerpFactor;
        } else {
            const lerpFactor = Math.min(deltaTime * 0.012, 1);
            player.displayPosition.x += (player.targetPosition.x - player.displayPosition.x) * lerpFactor;
            player.displayPosition.y += (player.targetPosition.y - player.displayPosition.y) * lerpFactor;
        }
        
        player.velocity.x *= 0.95;
        player.velocity.y *= 0.95;
    });
}

function debugMultiplayerState() {
    console.log('=== MULTIPLAYER DEBUG ===');
    console.log('My Player ID:', playerId);
    console.log('Is Authenticated:', isAuthenticated);
    console.log('Other Players Count:', Object.keys(otherPlayers).length);
    console.log('Other Players:', Object.keys(otherPlayers).map(id => ({
        id: id.substring(0, 8) + '...',
        position: otherPlayers[id].displayPosition,
        lastUpdate: Date.now() - otherPlayers[id].lastUpdate + 'ms ago'
    })));
    console.log('========================');
}

setInterval(debugMultiplayerState, 10000);

export {
    sendPlayerAction,
    sendPlayerInfo,
    playerId,
    playerName,
    socket,
    getAuthenticationStatus,
    waitForAuthentication,
    getOtherPlayers,
    getPlayerId,
    updateOtherPlayers,
    debugMultiplayerState,
    startHeartbeat,
    stopHeartbeat
};