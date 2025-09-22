# Vivid Violence

A 2D Nintendo-styled multiplayer shooting game that I built because honestly, I got tired of all the overly complex modern games. Sometimes you just want to shoot things in colorful pixels, right?

This thing runs in your browser and lets you duke it out with friends (or strangers) in real-time. It's got bouncy green walls, solid gray ones, and enough chaos to keep you entertained for way longer than it should.

## What's In Here

The game's split into two parts - a Python backend that handles all the multiplayer magic and a frontend that's just vanilla HTML/CSS/JS (no fancy frameworks needed).

### The Good Stuff
- Real-time multiplayer that actually works
- Physics that feel surprisingly decent for something I cobbled together
- Sound effects (turn your volume down first, trust me)
- Mobile support because why shouldn't you be able to shoot people on your phone?
- AI-generated quotes on the home page (because why not?)

### Known Issues
- Sometimes the server gets cranky and you'll need to refresh
- The mobile controls could be better but they work
- Color picker might not sync perfectly between devices

## File Layout

```
server/               # Backend stuff
├── api.py           # Main game server (WebSocket magic happens here)
├── user.py          # User management & quote API
├── launcher.py      # Starts both servers
├── create_db.py     # Sets up the user database
└── run.sh           # Quick start script

web/                 # Frontend files
├── index.html       # Main menu/lobby
├── game.html        # Where the actual game happens
├── js/              # All the game logic
│   ├── game.js      # Main game loop
│   ├── multiplayer.js # WebSocket handling
│   ├── physics.js   # Movement and collision detection
│   └── ...more stuff
├── css/style.css    # Makes it look pretty
└── sound/           # Pew pew sounds
```

## Running This Thing

You'll need Python 3.11+ (I tested it on 3.13, older versions might work but no promises).

### Quick Start
```bash
cd server
pip install -r requirements.txt
./run.sh
```

Then open `web/index.html` in your browser. The default server runs on `localhost:7895` for the game and `:4765` for user stuff.

### What The Script Does
The `run.sh` script fires up two servers:
- Game server on port 7895 (WebSocket + HTTP)
- User API on port 4765 (just HTTP)

If you want to run them separately:
```bash
# Terminal 1
python api.py

# Terminal 2  
python user.py
```

## How To Play

Open the game in two different browser windows (or devices). Use WASD or arrow keys to move around, click to shoot, space to shoot up, and R to reload.

Gray walls are solid, green walls are bouncy (because physics should be fun). Try not to die.

## Deployment Notes

I've got this running at `https://vv.bbarni.hackclub.app` if you want to see it in action. The user API is on a separate subdomain because that's just how I set it up.

If you're deploying your own:
- Make sure both servers are accessible
- Update the server URLs in the frontend
- The game expects CORS to be enabled (it is by default)


## Contributing

If you want to add something or fix my terrible code, go for it. Just don't judge me too harshly for the JavaScript - it started as a quick experiment and spiraled out of control.

## License

Do whatever you want with this. If it breaks, you get to keep both pieces.



