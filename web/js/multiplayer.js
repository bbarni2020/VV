const socket = io('http://localhost:7895');


let playerId = null;
let playerToken = null;
let isAuthenticated = false;

let otherPlayers = {};


socket.on('connect', () => {
    console.log('Connected to the server');
    authenticatePlayer();
})

socket.on('auth_success', (data) => {
    playerId = data.playerId;
    playerToken = data.token;
    isAuthenticated = true;
    localStorage.setItem('playerId', playerId);
    localStorage.setItem('playerToken', playerToken);
    console.log('Authentication successful: ', playerId);
});

socket.on('auth_failed', () => {
    console.error('Authentication failed.');
    playerId = null;
    playerToken = null;
    isAuthenticated = false;
    localStorage.removeItem('playerId');
    localStorage.removeItem('playerToken');
    window.location.reload();
});

socket.on('players_data', (data) => {
    console.log('Received players data: ', data);
    otherPlayers = {};
    Object.keys(data.players).forEach(id => {
        if (id !== playerId) {
            otherPlayers[id] = data.players[id];
        }
    });
})

socket.on('player_joined', (data) => {
    console.log('Player joined');
    if (data.playerId !== playerId) {
        otherPlayers[data.playerId] = data.data;
    };
})

socket.on('player_disconnected', (data) => {
    console.log('Player disconnected');
    if (data.playerId in otherPlayers) {
        delete otherPlayers[data.playerId];
    }
})

socket.on('player_info_update', (data) => {
    if (data.playerId !== playerId && data.playerId in otherPlayers) {
        Object.assign(otherPlayers[data.playerId], data.data);
    }
})

socket.on('player_action', (data) => {
    // Handle other players' actions (shooting, etc.)
    // This will be processed by the game logic
})

socket.on('error_message', (message) => {
    console.error('Server error: ', message);
})

function authenticatePlayer() {
    const storedToken = localStorage.getItem('playerToken');
    const storedId = localStorage.getItem('playerId');

    console.log('Attempting authentication...', { storedId: !!storedId, storedToken: !!storedToken });

    if (storedId && storedToken) {
        playerId = storedId;
        playerToken = storedToken;
        console.log('Using stored credentials');
        socket.emit('authenticate', { id: playerId, token: playerToken });
    } else {
        console.log('Requesting new authentication');
        socket.emit('request_auth');
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

export {
    sendPlayerAction,
    sendPlayerInfo,
    playerId,
    socket,
    getAuthenticationStatus,
    getOtherPlayers,
    getPlayerId
};