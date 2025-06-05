try:
    import eventlet
    eventlet.monkey_patch()
    async_mode = 'eventlet'
except ImportError:
    async_mode = 'threading'

from flask import Flask, render_template, request, send_from_directory, jsonify
from flask_socketio import SocketIO, emit, disconnect
from flask_cors import CORS
import uuid
import secrets
import time
import threading
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = 'abc'

CORS(app)

socketio = SocketIO(
    app, 
    cors_allowed_origins='*',
    async_mode='eventlet',
    ping_timeout=60,
    ping_interval=25,
    logger=False,
    engineio_logger=False
)

logger.info('Using eventlet async mode for better WebSocket support')

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

def safe_emit(event, data=None, room=None, broadcast=False, include_self=True, namespace=None):
    try:
        if room and room not in player_sessions:
            logger.warning(f"Attempted to emit to non-existent room: {room}")
            return False
        
        if broadcast:
            socketio.emit(event, data, namespace=namespace)
        elif room:
            socketio.emit(event, data, room=room, namespace=namespace)
        else:
            socketio.emit(event, data, namespace=namespace)
        return True
    except Exception as e:
        logger.error(f"Error emitting event {event}: {str(e)}")
        return False

def is_client_connected(sid):
    try:
        if sid not in player_sessions:
            return False
        
        session = player_sessions[sid]
        current_time = time.time() * 1000
        
        if current_time - session.get('connect_time', 0) < 30000:
            return True
            
        return socketio.server.manager.is_connected(sid)
    except Exception as e:
        logger.error(f"Error checking client connection for {sid}: {str(e)}")
        return False

def cleanup_stale_players():
    current_time = time.time() * 1000
    stale_players = []
    stale_sessions = []
    
    for player_id, data in players_data.items():
        if current_time - data.get('lastUpdate', 0) > 120000:
            stale_players.append(player_id)
    
    for sid, session in player_sessions.items():
        session_age = current_time - session.get('connect_time', 0)
        if session_age > 30000 and not is_client_connected(sid):
            stale_sessions.append(sid)
    
    for player_id in stale_players:
        try:
            if player_id in players_data:
                del players_data[player_id]
                safe_emit('player_disconnected', {'playerId': player_id}, broadcast=True)
                logger.info(f'Removed stale player: {player_id}')
        except Exception as e:
            logger.error(f'Error removing stale player {player_id}: {str(e)}')
    
    for sid in stale_sessions:
        try:
            if sid in player_sessions:
                session = player_sessions[sid]
                if session.get('token') and session['token'] in player_tokens:
                    del player_tokens[session['token']]
                del player_sessions[sid]
                logger.info(f'Cleaned up stale session: {sid}')
        except Exception as e:
            logger.error(f'Error cleaning up session {sid}: {str(e)}')

def update_health_pickups():
    try:
        current_time = time.time() * 1000
        for pickup in health_pickups:
            if pickup['collected'] and current_time - pickup['respawn_time'] > 10000:
                pickup['collected'] = False
                pickup['respawn_time'] = 0
    except Exception as e:
        logger.error(f'Error updating health pickups: {str(e)}')

def check_health_pickup_collision(player_id, player_data):
    try:
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
                    safe_emit('health_pickup_collected', {
                        'playerId': player_id,
                        'pickupIndex': health_pickups.index(pickup),
                        'newHealth': player_data['health']
                    }, broadcast=True)
                    return True
        return False
    except Exception as e:
        logger.error(f'Error checking health pickup collision for {player_id}: {str(e)}')
        return False

def check_bullet_wall_collision(bullet_x, bullet_y, bullet_radius=3):
    global destructible_walls
    
    try:
        for wall in destructible_walls[:]:
            if (bullet_x - bullet_radius < wall['x'] + 32 and
                bullet_x + bullet_radius > wall['x'] and
                bullet_y - bullet_radius < wall['y'] + 32 and
                bullet_y + bullet_radius > wall['y']):
                
                wall['health'] -= 1
                
                if wall['health'] <= 0:
                    destructible_walls.remove(wall)
                    safe_emit('wall_destroyed', {
                        'x': wall['x'],
                        'y': wall['y']
                    }, broadcast=True)
                else:
                    safe_emit('wall_damaged', {
                        'x': wall['x'],
                        'y': wall['y'],
                        'health': wall['health'],
                        'max_health': wall['max_health']
                    }, broadcast=True)
                
                return True
        
        return False
    except Exception as e:
        logger.error(f'Error checking bullet wall collision: {str(e)}')
        return False

def start_cleanup_timer():
    def cleanup_loop():
        while True:
            try:
                time.sleep(5)
                cleanup_stale_players()
                update_health_pickups()
                
                current_time = time.time() * 1000
                if current_time - game_start_time > game_time_limit:
                    reset_game()
            except Exception as e:
                logger.error(f'Error in cleanup loop: {str(e)}')
                time.sleep(10)
    
    cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
    cleanup_thread.start()
    logger.info('Cleanup timer started')

start_cleanup_timer()

game_start_time = time.time() * 1000
game_time_limit = 5 * 60 * 1000

@app.route('/health')
def health_check():
    try:
        return jsonify({
            'status': 'ok', 
            'players': len(players_data),
            'active_sessions': len(player_sessions),
            'timestamp': time.time() * 1000
        }), 200
    except Exception as e:
        logger.error(f'Health check error: {str(e)}')
        return jsonify({'status': 'error', 'message': 'Internal server error'}), 500

@app.errorhandler(Exception)
def handle_exception(e):
    logger.error(f'Unhandled exception: {str(e)}')
    return jsonify({'error': 'Internal server error'}), 500

@socketio.on('connect')
def handle_connect():
    try:
        logger.info(f'Client connected: {request.sid}')
        emit('connection_acknowledged', {'sid': request.sid})
    except Exception as e:
        logger.error(f'Error handling connection for {request.sid}: {str(e)}')

@socketio.on('disconnect')
def handle_disconnect():
    try:
        logger.info(f'Client disconnected: {request.sid}')
        
        if request.sid in player_sessions:
            session = player_sessions[request.sid]
            player_id = session.get('playerId')
            
            if player_id and player_id in players_data:
                del players_data[player_id]
                safe_emit('player_disconnected', {'playerId': player_id}, broadcast=True)
                logger.info(f'Player removed from game: {player_id}')
            
            if session.get('token') and session['token'] in player_tokens:
                del player_tokens[session['token']]
            
            del player_sessions[request.sid]
            logger.info(f'Player session cleaned up: {player_id if player_id else request.sid}')
            
    except Exception as e:
        logger.error(f'Error handling disconnection for {request.sid}: {str(e)}')
        try:
            if request.sid in player_sessions:
                del player_sessions[request.sid]
        except:
            pass

@socketio.on('request_auth')
def handle_request_auth(data=None):
    try:
        import time
        time.sleep(0.1)
        
        player_id = str(uuid.uuid4())
        token = secrets.token_hex(32)
        player_name = data.get('name', 'Anonymous') if data else 'Anonymous'
        player_color = data.get('color', '#4285f4') if data else '#4285f4'

        player_sessions[request.sid] = {
            'playerId': player_id,
            'token': token,
            'authenticated': True,
            'connect_time': time.time() * 1000
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

        safe_emit('player_joined', {'playerId': player_id, 'data': players_data[player_id]}, broadcast=True)

        emit('game_timer', {
            'start_time': game_start_time,
            'time_limit': game_time_limit,
            'current_time': time.time() * 1000
        })

        logger.info(f'New player connected: {player_name} ({player_id}), sent {len(other_players)} existing players')
        
    except Exception as e:
        logger.error(f'Error handling auth request for {request.sid}: {str(e)}')
        try:
            emit('auth_failed', {'error': 'Authentication failed'})
        except:
            pass

@socketio.on('authenticate')
def handle_authenticate(data):
    try:
        import time
        time.sleep(0.1)
        
        token = data.get('token')
        player_id = data.get('id')
        player_name = data.get('name', 'Anonymous')
        player_color = data.get('color', '#4285f4')

        if token in player_tokens and player_tokens[token]['playerId'] == player_id:
            player_tokens[token]['socket_id'] = request.sid
            
            player_sessions[request.sid] = {
                'playerId': player_id,
                'token': token,
                'authenticated': True,
                'connect_time': time.time() * 1000
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
                players_data[player_id]['lastUpdate'] = time.time() * 1000

            emit('auth_success', {'token': token, 'playerId': player_id})

            other_players = {pid: data for pid, data in players_data.items() if pid != player_id}
            emit('players_data', {'players': other_players})

            emit('map_state', {
                'destructible_walls': destructible_walls,
                'health_pickups': health_pickups
            })

            safe_emit('player_joined', {'playerId': player_id, 'data': players_data[player_id]}, broadcast=True)
            
            emit('game_timer', {
                'start_time': game_start_time,
                'time_limit': game_time_limit,
                'current_time': time.time() * 1000
            })
            
            logger.info(f'Player reconnected: {player_name} ({player_id}), sent {len(other_players)} existing players')
        else:
            emit('auth_failed', {'error': 'Invalid credentials'})
            logger.warning(f'Authentication failed for: {player_id} with token: {token}')
            
    except Exception as e:
        logger.error(f'Error handling authentication for {request.sid}: {str(e)}')
        try:
            emit('auth_failed', {'error': 'Authentication error'})
        except:
            pass

def validate_player_request(data):
    try:
        if request.sid not in player_sessions:
            logger.debug(f'Validation failed for {request.sid}: Session not found')
            return False, 'Not authenticated'
        
        session = player_sessions[request.sid]
        if not session.get('authenticated'):
            logger.debug(f'Validation failed for {request.sid}: Session not authenticated')
            return False, 'Session not authenticated'
        
        if data.get('token') != session.get('token'):
            logger.debug(f'Validation failed for {request.sid}: Token mismatch')
            return False, 'Invalid token'
        
        timestamp = data.get('timestamp')
        if not timestamp or abs(time.time() * 1000 - timestamp) > 30000:
            logger.debug(f'Validation failed for {request.sid}: Request expired (timestamp: {timestamp})')
            return False, 'Request expired'

        return True, "Valid"
    except Exception as e:
        logger.error(f'Error validating request: {str(e)}')
        return False, 'Validation error'

@socketio.on('player_action')
def handle_player_action(data):
    try:
        is_valid, message = validate_player_request(data)

        if not is_valid:
            emit('error_message', {'message': message})
            logger.warning(f'Invalid request from {request.sid}: {message}')
            return
            
        action_data = data.get('action', {})
        player_id = data.get('playerId')

        if player_id not in players_data:
            emit('error_message', {'message': 'Player not found'})
            return

        if action_data.get('type') == 'bullet_wall_hit':
            bullet_x = action_data.get('bulletX', 0)
            bullet_y = action_data.get('bulletY', 0)
            
            wall_hit = check_bullet_wall_collision(bullet_x, bullet_y)
            if wall_hit:
                return

        safe_emit('player_action', {
            'playerId': player_id,
            'action': action_data
        }, broadcast=True)
        
    except Exception as e:
        logger.error(f'Error handling player action from {request.sid}: {str(e)}')
        try:
            emit('error_message', {'message': 'Action processing error'})
        except:
            pass
    
@socketio.on('player_info_update')
def handle_player_info_update(data):
    try:
        is_valid, message = validate_player_request(data)

        if not is_valid:
            emit('error_message', {'message': message})
            logger.warning(f'Invalid request from {request.sid}: {message}')
            return
        
        player_info = data.get('data', {})
        player_id = data.get('playerId')

        if player_id not in players_data:
            emit('error_message', {'message': 'Player not found'})
            return

        players_data[player_id].update(player_info)
        players_data[player_id]['lastUpdate'] = time.time() * 1000
        
        if 'position' in player_info:
            check_health_pickup_collision(player_id, players_data[player_id])

        safe_emit('player_info_update', {
            'playerId': player_id,
            'data': player_info
        }, broadcast=True)
        
    except Exception as e:
        logger.error(f'Error handling player info update from {request.sid}: {str(e)}')
        try:
            emit('error_message', {'message': 'Update processing error'})
        except:
            pass

@socketio.on('heartbeat')
def handle_heartbeat(data):
    try:
        is_valid, message = validate_player_request(data)
        
        if not is_valid:
            logger.debug(f'Invalid heartbeat from {request.sid}: {message}')
            return
        
        player_id = data.get('playerId')
        if player_id and player_id in players_data:
            players_data[player_id]['lastUpdate'] = time.time() * 1000
            
    except Exception as e:
        logger.error(f'Error handling heartbeat from {request.sid}: {str(e)}')

def reset_game():
    global game_start_time, destructible_walls, health_pickups
    
    try:
        game_start_time = time.time() * 1000
        initialize_map_objects()
        
        for player_id in list(players_data.keys()):
            try:
                if player_id in players_data:
                    players_data[player_id].update({
                        'health': 100,
                        'isDead': False,
                        'kills': 0,
                        'bulletCount': 0,
                        'ammo': 10,
                        'reloadTime': 0,
                        'lastUpdate': time.time() * 1000
                    })
            except Exception as e:
                logger.error(f'Error resetting player {player_id}: {str(e)}')
        
        safe_emit('game_reset', {
            'start_time': game_start_time,
            'time_limit': game_time_limit,
            'current_time': time.time() * 1000,
            'destructible_walls': destructible_walls,
            'health_pickups': health_pickups
        }, broadcast=True)
        
        logger.info('Game reset with a new 5-minute round')
        
    except Exception as e:
        logger.error(f'Error resetting game: {str(e)}')

@socketio.on_error_default
def default_error_handler(e):
    logger.error(f'SocketIO error from {request.sid}: {str(e)}')

@socketio.on_error()
def error_handler(e):
    logger.error(f'SocketIO error: {str(e)}')

if __name__ == '__main__':
    try:
        logger.info('Starting Flask-SocketIO server...')
        logger.info(f'Server configuration: host=0.0.0.0, port=7895, debug=False')
        logger.info(f'SocketIO configuration: async_mode={socketio.async_mode}, ping_timeout=60, ping_interval=25')
        
        socketio.run(
            app, 
            host="0.0.0.0", 
            port=7895, 
            debug=False,
            use_reloader=False,
            log_output=True
        )
    except Exception as e:
        logger.error(f'Failed to start server: {str(e)}')
        raise