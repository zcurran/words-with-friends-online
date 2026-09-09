# Words with Friends / Scrabble Online (1 to 10 Players)

A complete, modern, responsive web-based multiplayer word game designed to capture the authentic visual style, board layout, and rules of **Words with Friends**, with full support for **1 to 10 players** and an actively updating live player list.

---

## 🌟 Key Features

1. **Authentic Words with Friends Gameplay:**
   - **15×15 Grid:** Accurate multiplier placement with **Triple Word (TW)** squares positioned 4 spaces inward from the perimeter, **Double Word (DW)** on the center star (7, 7), and diamond-pattern **Triple Letter (TL)** and **Double Letter (DL)** bonus spaces.
   - **104-Tile Distribution:** Words with Friends letter frequencies and point values (e.g. J=10, Z=10, K=5, Q=10).
   - **+35 Bingo Bonus:** Playing all 7 tiles from your rack in a single turn awards a 35-point bonus (with a toggle for Classic Scrabble 50-point bonus if desired).

2. **1 to 10 Player Multiplayer & Live Player Roster:**
   - **Multiplayer Lobby:** Create private rooms with a unique **Friend Code** (e.g., `WWF-7249`).
   - **1-Click Invite Links:** Copy and share instant room links (`?room=CODE`) with up to 9 friends.
   - **Play with 1 to 10 players** (solo practice, pass & play, or online with friends).
   - **Actively Updating Player List:** Real-time presence updates when players join, leave, or disconnect, with automatic turn advancement so matches never freeze.
   - **Smart AI Bots:** Fill empty seats with computer players (Easy, Medium, or Hard difficulty) - strictly opt-in and off by default.
   - **Custom Display Name:** Change your player name anytime via the header badge or scoreboard pencil (`✏️`).

3. **Polished Words with Friends UI & Interactions:**
   - **7-Tile Wooden Rack:** Smooth drag-and-drop tile placement and tap-to-place support for mobile/touch devices.
   - **Live Score Preview:** Floating badge projects move score and validates dictionary legality in real-time.
   - **Tile Bag Peeker:** Inspect remaining counts of every letter in the bag.
   - **Tile Swap & Pass:** Select tiles from your rack to exchange with the bag or pass your turn.
   - **Blank Tile Wildcard Chooser:** Pick any letter (A–Z) when placing blank tiles.
   - **Procedural Sound Effects:** Wooden tile clicks, rack shuffle rattles, turn bell, and score fanfares synthesized via HTML5 Web Audio API.

4. **172,800+ Word Tournament Dictionary:**
   - Powered by the official ENABLE1 lexicon used in Words with Friends.

---

## 🚀 How to Play

### Option 1: 1-Click Launch (Recommended)
Double-click **`run_game.bat`** in this folder. It starts the local HTTP & WebSocket server and automatically opens `http://localhost:8080/` in your browser.

### Option 2: Direct Browser Play (Zero Installs)
Double-click **`index.html`** in any web browser (Chrome, Edge, Firefox, Safari). The game is fully functional offline with Pass & Play and AI Bots!

### Option 3: Playing with Friends Across Devices
When running `run_game.bat`, open command prompt and run `ipconfig` to find your local IPv4 address (e.g., `192.168.1.50`), and send this link to anyone on your Wi-Fi:
```
http://192.168.1.50:8080/?room=YOUR_CODE
```
They can open it on their iPhone, Android, iPad, or laptop and join immediately!
