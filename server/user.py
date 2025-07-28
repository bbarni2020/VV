from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
import sqlite3
import requests
import time

CACHE_DURATION = 600
cache = {
    'data': None,
    'timestamp': 0
}

app = Flask(__name__)

conn = sqlite3.connect('users.db', check_same_thread=False)
cur = conn.cursor()

limiter = Limiter(
    app,
    default_limits=["1 per minute"]
)


CORS(app)

@app.route('/auth', methods=['POST'])
def login():
    address = request.remote_addr
    name = request.json.get('name')
    color = request.json.get('color')
    if not color:
        color = '#4285f4'
    try:
        if not name:
            response = requests.post('https://ai.hackclub.com/chat/completions', 
                json={
                "messages": [{"role": "user", "content": "Give me a username for one of my users in Vivid Violence. The game is a 2d nintendo styled video game. Do not use /n or /r, just write the quote with simple charachters only. Just write out as simple text."}]
                },
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                data = response.json()
                name = data['choices'][0]['message']['content']
        else:
            name = "anonymous"
        cur.execute("INSERT INTO users (ip, color, name) VALUES (?, ?, ?)", (address, color, name))
        conn.commit()
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/edit/name', methods=['POST'])
@limiter.limit("10 per minute")
def edit_name():
    address = request.remote_addr
    new_name = request.json.get('name')
    if not new_name:
        new_name = "anonymous"
    try:
        cur.execute("UPDATE users SET name = ? WHERE ip = ?", (new_name, address))
        conn.commit()
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/edit/color', methods=['POST'])
@limiter.limit("10 per minute")
def edit_color():
    address = request.remote_addr
    new_color = request.json.get('color')
    if not new_color:
        return jsonify({'error': 'Color is required'}), 400
    try:
        cur.execute("UPDATE users SET color = ? WHERE ip = ?", (new_color, address))
        conn.commit()
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@app.route('/delete', methods=['POST'])
def delete():
    address = request.remote_addr
    try:
        cur.execute("DELETE FROM users WHERE ip = ?", (address,))
        conn.commit()
        return jsonify({'status': 'success'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get', methods=['GET'])
def get_user():
    address = request.remote_addr
    try:
        cur.execute("SELECT * FROM users WHERE ip = ?", (address,))
        user = cur.fetchone()
        if user:
            return jsonify({'ip': user[0], 'color': user[1], 'name': user[2]}), 200
        else:
            return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_quote', methods=['GET'])
@limiter.limit("1 per second")
def get_quote():
    current_time = time.time()
    if cache['data'] and (current_time - cache['timestamp']) < CACHE_DURATION:
        return jsonify({'quote': cache['data']}), 200

    try:
        response = requests.post('https://ai.hackclub.com/chat/completions', 
            json={
            "messages": [{"role": "user", "content": "Give me a random quote to write out to the home page of Vivid Violence, a 2d Nintendo styled game. Just write the quote, nothing else. Do not use /n or /r, just write the quote with simple charachters only. Just write out as simple text."}]
            },
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            data = response.json()
            content = data['choices'][0]['message']['content']
            import re
            content = re.sub(r'<think>[\s\S]*?</think>', '', content, flags=re.IGNORECASE)
            matches = re.findall(r'"([^"]+)"', content)
            if matches:
                quote = matches[-1].strip()
            else:
                lines = [line.strip() for line in content.splitlines() if line.strip()]
                quote = lines[-1] if lines else ''
            cache['data'] = quote
            cache['timestamp'] = current_time
            return jsonify({'quote': quote}), 200
        else:
            return jsonify({'error': 'Falied to fetch quote'}), response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

app.run(host='0.0.0.0', port=4765)