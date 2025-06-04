from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import uuid
import secrets
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'abc'

socketio = SocketIO(app, cors_allowed_origins='*')

player_sessions = {}
player_tokens = {}
players_data = {}

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')
    if request.sid in player_sessions:
        session = player_sessions[request.sid]
        player_id = session.get('playerId')
        if player_id in players_data:
            del players_data[player_id]
            emit('player_disconnected', {'playerId': player_id}, broadcast=True)
        
        if session['token'] in player_tokens:
            del player_tokens[session['token']]
        del player_sessions[request.sid]
        
        print(f'Player session ended: {player_id}')

@socketio.on('request_auth')
def handle_request_auth():
    player_id = str(uuid.uuid4())
    token = secrets.token_hex(32)

    player_sessions[request.sid] = {
        'playerId': player_id,
        'token': token,
        'authenticated': True
    }

    player_tokens[token] = {
        'playerId': player_id,
        'socket_id': request.sid
    }

    players_data[player_id] = {
        'position': {'x': 400 + (len(players_data) * 50), 'y': 300 + (len(players_data) * 30)},
        'score': 0,
        'bulletCount': 0,
        'lastUpdate': time.time() * 1000
    }

    emit('auth_success', {'token': token, 'playerId': player_id})

    emit('players_data', {'players': players_data})

    emit('player_joined', {'playerId': player_id, 'data': players_data[player_id]}, broadcast=True, include_self=False)

    print(f'New player connected: {player_id}')

@socketio.on('authenticate')
def handle_authenticate(data):
    token = data.get('token')
    player_id = data.get('id')

    if token in player_tokens and player_tokens[token]['playerId'] == player_id:
        player_tokens[token]['socket_id'] = request.sid
        player_sessions[request.sid] = {
            'playerId': player_id,
            'token': token,
            'authenticated': True
        }
        if player_id not in players_data:
            players_data[player_id] = {
                'position': {'x': 400 + (len(players_data) * 50), 'y': 300 + (len(players_data) * 30)},
                'score': 0,
                'bulletCount': 0,
                'lastUpdate': time.time() * 1000
            }

        emit('auth_success', {'token': token, 'playerId': player_id})

        emit('players_data', {'players': players_data})

        emit('player_joined', {'playerId': player_id, 'data': players_data[player_id]}, broadcast=True, include_self=False)
        print(f'Player reconnected: {player_id}')
    else:
        emit('auth_failed')
        print(f'Authentication failed for: {player_id} with token: {token}')

def validate_player_request(data):
    if request.sid not in player_sessions:
        return False, 'Not authenticated'
    
    session = player_sessions[request.sid]
    if not session.get('authenticated'):
        return False, 'Session not authenticated'
    
    if data.get('token') != session.get('token'):
        return False, 'Invalid token'
    
    timestamp = data.get('timestamp')
    if not timestamp or abs(time.time() * 1000 - timestamp) > 30000:
        return False, 'Request expired'

    return True, "Valid"

@socketio.on('player_action')
def handle_player_action(data):
    is_valid, message = validate_player_request(data)

    if not is_valid:
        emit('error_message', {'message': message})
        print(f'Invalid request from {request.sid}: {message}')
        return
    action_data = data.get('action', {})
    player_id = data.get('playerId')

    print(f'Valid player action from {player_id}')

    emit('player_action', {
        'playerId': player_id,
        'action': action_data}, broadcast=True, include_self=False)
    
@socketio.on('player_info_update')
def handle_player_info_update(data):
    is_valid, message = validate_player_request(data)

    if not is_valid:
        emit('error_message', {'message': message})
        print(f'Invalid request from {request.sid}')
        return
    
    player_info = data.get('data', {})
    player_id = data.get('playerId')

    if player_id in players_data:
        players_data[player_id].update(player_info)
        players_data[player_id]['lastUpdate'] = time.time() * 1000
        

    print(f'Valid player info update from {request.sid}')

    emit('player_info_update', {
        'playerId': player_id,
        'data': player_info}, broadcast=True, include_self=False)

if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=7895, debug=True)