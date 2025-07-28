# Vivid Violence

Vivid Violence is a multiplayer web-based shooting game. The project consists of a Python backend server and a browser-based client built with HTML, CSS, and JavaScript.

## Features
- Real-time multiplayer gameplay
- Physics-based movement and shooting
- Sound effects and graphics
- Device detection and mobile support

## Project Structure

```
VV/
├── server/           # Python backend server
│   ├── api.py        # API endpoints
│   ├── create_db.py  # Script to create the user database
│   ├── launcher.py   # Server launcher
│   ├── requirements.txt # Python dependencies
│   ├── run.sh        # Shell script to run the server
│   ├── user.py       # User management
│   └── users.db      # SQLite database for users
├── web/              # Frontend files
│   ├── index.html    # Main game page
│   ├── game.html     # Game interface
│   ├── css/          # Stylesheets
│   ├── js/           # JavaScript game logic
│   └── sound/        # Sound effects
└── README.md         # Project documentation
```

## Getting Started

### Prerequisites
- Python 3.8+
- pip (Python package manager)

### Backend Setup
1. Navigate to the `server/` directory:
   ```sh
   cd server
   ```
2. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
3. (Optional) Create the user database:
   ```sh
   python create_db.py
   ```
4. Start the server:
   ```sh
   ./run.sh
   ```

### Frontend
Open `web/index.html` in your browser to play the game.


