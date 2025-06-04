from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import uuid
import secrets
import time
import threading

app = Flask(__name__)
app.config['SECRET_KEY'] = 'abc'

socketio = SocketIO(app, cors_allowed_origins='*')

player_sessions = {}
player_tokens = {}
players_data = {}

def cleanup_stale_players():
    current_time = time.time() * 1000
    stale_players = []
    
    for player_id, data in players_data.items():
        if current_time - data.get('lastUpdate', 0) > 60000:
            stale_players.append(player_id)
    
    for player_id in stale_players:
        if player_id in players_data:
            del players_data[player_id]
            socketio.emit('player_disconnected', {'playerId': player_id}, broadcast=True)
            print(f'Removed stale player: {player_id}')
        
        session_to_remove = None
        for sid, session in player_sessions.items():
            if session.get('playerId') == player_id:
                session_to_remove = sid
                break
        
        if session_to_remove:
            session = player_sessions[session_to_remove]
            if session.get('token') and session['token'] in player_tokens:
                del player_tokens[session['token']]
            del player_sessions[session_to_remove]

def start_cleanup_timer():
    def cleanup_loop():
        while True:
            time.sleep(30)
            cleanup_stale_players()
    
    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()

start_cleanup_timer()

@socketio.on('connect')
def handle_connect():
    print(f'Client connected: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Client disconnected: {request.sid}')
    if request.sid in player_sessions:
        session = player_sessions[request.sid]
        player_id = session.get('playerId')
        if player_id and player_id in players_data:
            del players_data[player_id]
            emit('player_disconnected', {'playerId': player_id}, broadcast=True)
            print(f'Player removed from game: {player_id}')
        
        if session.get('token') and session['token'] in player_tokens:
            del player_tokens[session['token']]
        del player_sessions[request.sid]
        
        print(f'Player session cleaned up: {player_id if player_id else request.sid}')

@socketio.on('request_auth')
def handle_request_auth(data=None):
    player_id = str(uuid.uuid4())
    token = secrets.token_hex(32)
    player_name = data.get('name', 'Anonymous') if data else 'Anonymous'

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
        'name': player_name,
        'position': {'x': 400 + (len(players_data) * 50), 'y': 300 + (len(players_data) * 30)},
        'score': 0,
        'bulletCount': 0,
        'lastUpdate': time.time() * 1000
    }

    emit('auth_success', {'token': token, 'playerId': player_id})

    other_players = {pid: data for pid, data in players_data.items() if pid != player_id}
    emit('players_data', {'players': other_players})

    emit('player_joined', {'playerId': player_id, 'data': players_data[player_id]}, broadcast=True, include_self=False)

    print(f'New player connected: {player_name} ({player_id}), sent {len(other_players)} existing players')

@socketio.on('authenticate')
def handle_authenticate(data):
    token = data.get('token')
    player_id = data.get('id')
    player_name = data.get('name', 'Anonymous')

    if token in player_tokens and player_tokens[token]['playerId'] == player_id:
        player_tokens[token]['socket_id'] = request.sid
        player_sessions[request.sid] = {
            'playerId': player_id,
            'token': token,
            'authenticated': True
        }
        if player_id not in players_data:
            players_data[player_id] = {
                'name': player_name,
                'position': {'x': 400 + (len(players_data) * 50), 'y': 300 + (len(players_data) * 30)},
                'score': 0,
                'bulletCount': 0,
                'lastUpdate': time.time() * 1000
            }
        else:
            players_data[player_id]['name'] = player_name

        emit('auth_success', {'token': token, 'playerId': player_id})

        other_players = {pid: data for pid, data in players_data.items() if pid != player_id}
        emit('players_data', {'players': other_players})

        emit('player_joined', {'playerId': player_id, 'data': players_data[player_id]}, broadcast=True, include_self=False)
        print(f'Player reconnected: {player_name} ({player_id}), sent {len(other_players)} existing players')
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
        

    emit('player_info_update', {
        'playerId': player_id,
        'data': player_info}, broadcast=True, include_self=False)

@socketio.on('heartbeat')
def handle_heartbeat(data):
    is_valid, message = validate_player_request(data)
    
    if not is_valid:
        return
    
    player_id = data.get('playerId')
    if player_id in players_data:
        players_data[player_id]['lastUpdate'] = time.time() * 1000

if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=7895, debug=True)