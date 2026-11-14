# Pick & Guess — Firebase Edition

A mobile-friendly number guessing game built with HTML, CSS, JavaScript modules, Firebase Authentication, Cloud Firestore, and Firebase Realtime Database.

## Included
- Email/password registration, login, logout
- Classic mode: guess 1–100 with 3 attempts
- Higher/lower feedback
- Hint (10 game coins) and one extra attempt (30 game coins)
- Earn game coins by playing; no real-money purchases
- EXP, ranks, levels, wins, losses, and leaderboard
- Basic real-time PvP room flow (room creator chooses the secret; the joining player guesses)
- Firebase security rules

## Setup
1. Create/enable Firebase Authentication > Email/Password.
2. Create Cloud Firestore and Realtime Database.
3. In Firebase Console > Project settings > General > Your apps, create/select a Web app.
4. Edit `public/firebase-config.js` and paste your Firebase web config.
   `databaseURL` is already set to your Realtime Database URL.
5. In Firestore > Rules, publish `firestore.rules`.
6. In Realtime Database > Rules, paste `database.rules.json` and publish.
7. Host the `public/` folder on GitHub Pages (Settings > Pages > Deploy from branch; select main and `/public`).
   Or test locally using a static server. Do not open `index.html` as a `file://` URL.

## Important PvP note
This is a client-coordinated prototype suitable for testing with friends. The room creator's browser evaluates guesses, so the creator must stay online. For competitive anti-cheat PvP, move guess validation and rewards to trusted server code (for example Firebase Cloud Functions or another server). Do not treat client-side game results as secure.

## Local test (Termux)
```bash
pkg install nodejs
cd pick-and-guess-the-number
npx serve public
```
Open the local URL printed by `serve`.

## Deploy
The GitHub Pages site is static. Firebase provides the authentication and database services; GitHub Pages does not run Node.js servers or Firebase Cloud Functions.
