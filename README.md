# Pick & Guess — Online Multiplayer Prototype

A two-player browser game built with HTML, CSS, JavaScript, Node.js, Express, and Socket.IO.

## Requirements

- Node.js 18 or newer
- npm
- Internet connection for the Google Fonts stylesheet (the game itself does not require Google Fonts)

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser.

## Test multiplayer

1. Open the game in two browser tabs or on two devices on the same network.
2. In the first tab, enter a name and select **Create Room**.
3. Copy the 5-character room code.
4. In the second tab, enter a name and that room code, then select **Join**.
5. The host picks a secret number from 1 to 100.
6. The other player gets three guesses. The server checks every guess and sends Higher, Lower, or Exact.
7. After the round, select **Next Round**. Roles swap.

For two devices on the same Wi-Fi, open the server computer's local network IP on the second device, for example `http://192.168.1.20:3000`. Both devices must be on the same network and the firewall must allow port 3000.

## Deploy online

Deploy this Node.js project to a host that supports long-running Node servers and WebSocket connections. Set the start command to `npm start`. Use the public HTTPS URL to invite friends.

A static-only host (such as GitHub Pages) cannot run this Socket.IO server by itself. The server and browser client must both be deployed.

## Current prototype scope

Included:
- Create and join private rooms with a room code
- Two-player lobby
- Host chooses a secret number
- Three guesses for the opponent
- Server-authoritative Higher / Lower / Exact feedback
- Win/loss result
- Next round with roles swapped
- Responsive phone-friendly layout

Not yet included:
- Accounts and saved profiles
- Persistent ranks, EXP, levels, Money, scores, and leaderboards
- Friend requests and invitations
- Matchmaking and reconnect recovery
- Payments or real-money purchases

The server keeps rooms in memory. Restarting the server clears active rooms. Add a database and authentication before treating this as a public production game.

## Important security note

The secret number is stored on the server and is not sent to the guessing player. Do not add client-side code that reveals it before the round ends.
