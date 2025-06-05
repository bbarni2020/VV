from flask import Flask, render_template, request, send_from_directory
from flask_socketio import SocketIO, emit
import uuid
import secrets
import time
import threading
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'abc'

socketio = SocketIO(app, cors_allowed_origins='*')

player_sessions = {}
player_tokens = {}
players_data = {}

map_data = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,2,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
]

health_pickups = []
destructible_walls = []

def initialize_map_objects():
    global health_pickups, destructible_walls
    health_pickups = []
    destructible_walls = []
    
    for y in range(len(map_data)):
        for x in range(len(map_data[y])):
            tile = map_data[y][x]
            if tile == 4:
                health_pickups.append({
                    'x': x * 32,
                    'y': y * 32,
                    'collected': False,
                    'respawn_time': 0
                })
            elif tile == 3:
                destructible_walls.append({
                    'x': x * 32,
                    'y': y * 32,
                    'health': 3,
                    'max_health': 3
                })

initialize_map_objects()

def cleanup_stale_players():
    current_time = time.time() * 1000
    stale_players = []
    
    for player_id, data in players_data.items():
        if current_time - data.get('lastUpdate', 0) > 60000:
            stale_players.append(player_id)
    
    for player_id in stale_players:
        if player_id in players_data:
            del players_data[player_id]
            socketio.emit('player_disconnected', {'playerId': player_id})
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

def update_health_pickups():
    current_time = time.time() * 1000
    for pickup in health_pickups:
        if pickup['collected'] and current_time - pickup['respawn_time'] > 10000:
            pickup['collected'] = False
            pickup['respawn_time'] = 0

def check_health_pickup_collision(player_id, player_data):
    current_time = time.time() * 1000
    for pickup in health_pickups:
        if not pickup['collected']:
            player_x = player_data['position']['x']
            player_y = player_data['position']['y']
            pickup_center_x = pickup['x'] + 16
            pickup_center_y = pickup['y'] + 16
            
            distance = ((player_x - pickup_center_x) ** 2 + (player_y - pickup_center_y) ** 2) ** 0.5
            
            if distance < 25 and player_data['health'] < 100:
                player_data['health'] = min(100, player_data['health'] + 20)
                pickup['collected'] = True
                pickup['respawn_time'] = current_time
                socketio.emit('health_pickup_collected', {
                    'playerId': player_id,
                    'pickupIndex': health_pickups.index(pickup),
                    'newHealth': player_data['health']
                })
                return True
    return False

def check_bullet_wall_collision(bullet_x, bullet_y, bullet_radius=3):
    global destructible_walls
    
    for wall in destructible_walls[:]:
        if (bullet_x - bullet_radius < wall['x'] + 32 and
            bullet_x + bullet_radius > wall['x'] and
            bullet_y - bullet_radius < wall['y'] + 32 and
            bullet_y + bullet_radius > wall['y']):
            
            wall['health'] -= 1
            
            if wall['health'] <= 0:
                destructible_walls.remove(wall)
                socketio.emit('wall_destroyed', {
                    'x': wall['x'],
                    'y': wall['y']
                })
            else:
                socketio.emit('wall_damaged', {
                    'x': wall['x'],
                    'y': wall['y'],
                    'health': wall['health'],
                    'max_health': wall['max_health']
                })
            
            return True
    
    return False

def start_cleanup_timer():
    def cleanup_loop():
        while True:
            time.sleep(5)
            cleanup_stale_players()
            update_health_pickups()
            
            current_time = time.time() * 1000
            if current_time - game_start_time > game_time_limit:
                reset_game()
    
    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()

start_cleanup_timer()

game_start_time = time.time() * 1000
game_time_limit = 5 * 60 * 1000

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
    player_color = data.get('color', '#4285f4') if data else '#4285f4'

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
        'color': player_color,
        'position': {'x': 400 + (len(players_data) * 50), 'y': 300 + (len(players_data) * 30)},
        'kills': 0,
        'bulletCount': 0,
        'health': 100,
        'isDead': False,
        'ammo': 10,
        'reloadTime': 0,
        'lastUpdate': time.time() * 1000
    }

    emit('auth_success', {'token': token, 'playerId': player_id})

    other_players = {pid: data for pid, data in players_data.items() if pid != player_id}
    emit('players_data', {'players': other_players})

    emit('map_state', {
        'destructible_walls': destructible_walls,
        'health_pickups': health_pickups
    })

    emit('player_joined', {'playerId': player_id, 'data': players_data[player_id]}, broadcast=True, include_self=False)

    emit('game_timer', {
        'start_time': game_start_time,
        'time_limit': game_time_limit,
        'current_time': time.time() * 1000
    })

    print(f'New player connected: {player_name} ({player_id}), sent {len(other_players)} existing players')

@socketio.on('authenticate')
def handle_authenticate(data):
    token = data.get('token')
    player_id = data.get('id')
    player_name = data.get('name', 'Anonymous')
    player_color = data.get('color', '#4285f4')

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
                'color': player_color,
                'position': {'x': 400 + (len(players_data) * 50), 'y': 300 + (len(players_data) * 30)},
                'kills': 0,
                'bulletCount': 0,
                'health': 100,
                'isDead': False,
                'ammo': 10,
                'reloadTime': 0,
                'lastUpdate': time.time() * 1000
            }
        else:
            players_data[player_id]['name'] = player_name
            players_data[player_id]['color'] = player_color

        emit('auth_success', {'token': token, 'playerId': player_id})

        other_players = {pid: data for pid, data in players_data.items() if pid != player_id}
        emit('players_data', {'players': other_players})

        emit('map_state', {
            'destructible_walls': destructible_walls,
            'health_pickups': health_pickups
        })

        emit('player_joined', {'playerId': player_id, 'data': players_data[player_id]}, broadcast=True, include_self=False)
        emit('game_timer', {
            'start_time': game_start_time,
            'time_limit': game_time_limit,
            'current_time': time.time() * 1000
        })
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

    if action_data.get('type') == 'bullet_wall_hit':
        bullet_x = action_data.get('bulletX', 0)
        bullet_y = action_data.get('bulletY', 0)
        
        wall_hit = check_bullet_wall_collision(bullet_x, bullet_y)
        if wall_hit:
            return

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
        
        if 'position' in player_info:
            check_health_pickup_collision(player_id, players_data[player_id])

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

def reset_game():
    global game_start_time, destructible_walls, health_pickups
    game_start_time = time.time() * 1000
    initialize_map_objects()
    
    socketio.emit('game_reset', {
        'start_time': game_start_time,
        'time_limit': game_time_limit,
        'current_time': time.time() * 1000,
        'destructible_walls': destructible_walls,
        'health_pickups': health_pickups
    })
    
    print('Game reset with a new 5-minute round')

if __name__ == '__main__':
    socketio.run(app, host="0.0.0.0", port=7895, debug=True)