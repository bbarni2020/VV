const socket = io('http://localhost:7895');

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


socket.on('connect', () => {
    console.log('Connected to the server');
    
    playerName = localStorage.getItem('playerName');
    
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = 'AUTHENTICATING...';
        statusElement.style.color = '#ffff00';
    }
    
    authenticatePlayer();
})

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    stopHeartbeat();
    isAuthenticated = false;
    
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.textContent = 'DISCONNECTED';
        statusElement.style.color = '#ff0000';
    }
})

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
                score: data.data.score || 0,
                bulletCount: data.data.bulletCount || 0
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

socket.on('error_message', (message) => {
    console.error('Server error: ', message);
})

function authenticatePlayer() {
    if (!playerName) {
        playerName = prompt('Enter your player name:') || 'Anonymous';
        localStorage.setItem('playerName', playerName);
    }
    
    const storedToken = localStorage.getItem('playerToken');
    const storedId = localStorage.getItem('playerId');

    console.log('Attempting authentication...', { storedId: !!storedId, storedToken: !!storedToken });

    if (storedId && storedToken) {
        playerId = storedId;
        playerToken = storedToken;
        console.log('Using stored credentials');
        socket.emit('authenticate', { id: playerId, token: playerToken, name: playerName });
    } else {
        console.log('Requesting new authentication');
        socket.emit('request_auth', { name: playerName });
    }
}

function sendPlayerAction(action) {
    if (!isAuthenticated || !playerId || !playerToken) {
        console.error('Not authenticated. Cannot send player action.');
        return;
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
    if (!isAuthenticated || !playerId || !playerToken) {
        console.error('Not authenticated. Cannot send player information.')
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
    return isAuthenticated;
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

// Debug every 10 seconds
setInterval(debugMultiplayerState, 10000);

export {
    sendPlayerAction,
    sendPlayerInfo,
    playerId,
    playerName,
    socket,
    getAuthenticationStatus,
    getOtherPlayers,
    getPlayerId,
    updateOtherPlayers,
    debugMultiplayerState,
    startHeartbeat,
    stopHeartbeat
};