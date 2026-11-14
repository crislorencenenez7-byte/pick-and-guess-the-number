# Pick & Guess — Firebase

This is a static GitHub Pages web app using Firebase Authentication, Cloud Firestore, and Firebase Realtime Database.

## Correct repository structure

```text
pick-and-guess-the-number/
├── index.html
├── app.js
├── firebase-config.js
├── style.css
├── firestore.rules
├── database.rules.json
├── README.md
└── .nojekyll
```

Do not publish from `public/` or `docs/` when using the root layout. In GitHub:
Settings → Pages → Deploy from a branch → `main` → `/(root)`.

## Firebase setup

1. Firebase Console → Authentication → Sign-in method → enable Email/Password.
2. Authentication → Settings → Authorized domains: add `crislorencenenez7-byte.github.io`.
3. Create Cloud Firestore database.
4. Firestore → Rules: publish the contents of `firestore.rules`.
5. Realtime Database → Rules: publish the contents of `database.rules.json`.
6. Confirm `firebase-config.js` contains the Web App config for project `pick-and-guess`.

## Firestore connection troubleshooting

The app initializes Firestore with forced long polling to improve compatibility with some mobile networks and browsers. This does not fix a disabled database, incorrect project config, missing internet, or unpublished rules.

If the screen says it cannot reach Firestore:
- Confirm the phone has internet.
- Open Firebase Console and confirm the Firestore database exists and is enabled.
- Confirm Authentication Email/Password is enabled.
- Confirm the GitHub Pages domain is listed under Authorized domains.
- Confirm Firestore rules are published.
- Reload the site and tap Retry connection.

## Run locally in Termux

```bash
pkg install python
cd ~/pick-and-guess-the-number
python -m http.server 8000
```

Open `http://127.0.0.1:8000` in the same device browser. Do not open the HTML file directly with `file://`.

## Deploy to GitHub Pages

Use repository root:
- Branch: `main`
- Folder: `/(root)`

GitHub Pages hosts the static frontend only. Firebase provides authentication and databases.

## Included game

- Email/password signup, login, logout
- Classic 1–100 number guessing with 3 attempts
- Higher/lower feedback
- Hint for 10 earned coins; extra try for 30 earned coins
- EXP, six rank names, levels, wins, losses, scores
- Firestore leaderboard
- Basic Realtime Database PvP room prototype

## Prototype limitations and security

PvP is a friend-play prototype: the room creator's browser evaluates guesses and must remain online. It is not cheat-proof. A trusted server-side backend is required for secure competitive play and authoritative reward validation.

The current Firestore rules let signed-in players update their own player document. This is adequate for an early prototype but does not prevent a modified browser from changing its own score/coins. For a public competitive game, move rewards and profile updates to trusted server-side code.
