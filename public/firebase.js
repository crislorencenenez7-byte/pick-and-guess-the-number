import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDgd_-OLm8DaULaQyn2qI9-ukzDcZAAOpA",
  authDomain: "pick-and-guess.firebaseapp.com",
  projectId: "pick-and-guess",
  storageBucket: "pick-and-guess.firebasestorage.app",
  messagingSenderId: "756784079550",
  appId: "1:756784079550:web:02a87ee5bd2add166e74ef",
  measurementId: "G-0NJ2WCKB18"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
