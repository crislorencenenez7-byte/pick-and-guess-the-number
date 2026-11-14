# Pick & Guess the Number — Firebase-ready

This is a clean GitHub Pages frontend for the existing Firebase project `pick-and-guess`.

## Folder structure

```text
pick-and-guess-the-number/
├── index.html
├── README.md
├── .nojekyll
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── app.js
│       └── firebase-config.js
└── firebase/
    ├── firestore.rules
    └── database.rules.json
```

## Firebase services used

- Firebase Authentication: email/password registration, email verification, login and logout.
- Cloud Firestore: player profiles and leaderboard.
- Realtime Database: reserved for future real-time multiplayer features; currently locked by default.

The Firebase web config is public client configuration. Never add service-account JSON files or private server keys to this repository.

## Setup

1. In Firebase Console → Authentication → Sign-in method, enable **Email/Password**.
2. In Authentication → Settings → Authorized domains, add:
   `crislorencenenez7-byte.github.io`
3. Make sure Cloud Firestore exists in project `pick-and-guess`.
4. In Firestore → Rules, publish the contents of `firebase/firestore.rules`.
5. Deploy the contents of `firebase/database.rules.json` only if you are configuring Realtime Database. These default rules deny client access.
6. Upload the contents of this folder to the root of the GitHub repository `pick-and-guess-the-number`.
7. In GitHub → Settings → Pages, select branch `main` and folder `/(root)`.

Website:
https://crislorencenenez7-byte.github.io/pick-and-guess-the-number/

## Current features

- Separate register and login forms.
- Email verification required before profile creation and game access.
- Firestore player profile creation and updates.
- Number guessing game (1–100, three initial tries).
- Hint (10 coins), extra try (30 coins), and new round.
- EXP, levels, coins, wins, losses, score, and top-10 leaderboard.

## Important limitations

This is a client-side prototype. Since the browser writes game results, a determined user can manipulate their own score or profile. For a production competitive leaderboard, move score validation and rewards to trusted server-side code (for example, Cloud Functions) and use stricter Firestore field validation.

Do not make Firestore or Realtime Database rules public (`allow read, write: if true`).
