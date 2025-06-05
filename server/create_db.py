import sqlite3

conn = sqlite3.connect('users.db')
cur = conn.cursor()

cur.execute('''
    CREATE TABLE IF NOT EXISTS users (
        ip TEXT PRIMARY KEY,
        color TEXT,
        name TEXT
    )''')

conn.commit()
conn.close()