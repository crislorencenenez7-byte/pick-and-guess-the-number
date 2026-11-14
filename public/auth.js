import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let gameLoaded = false;

function showMessage(message) {
  $("authMessage").textContent = message;
}

function showAuthForm(mode) {
  $("registerFields").classList.toggle("hidden", mode !== "register");
  $("authTitle").textContent = mode === "register" ? "Create Account" : "Welcome Back";
  $("authSubmit").textContent = mode === "register" ? "Register" : "Login";
  $("switchAuth").textContent = mode === "register"
    ? "Already have an account? Login"
    : "No account yet? Register";
  $("authMode").value = mode;
  showMessage("");
}

$("switchAuth").addEventListener("click", () => {
  showAuthForm($("authMode").value === "login" ? "register" : "login");
});

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const mode = $("authMode").value;
  const email = $("email").value.trim();
  const password = $("password").value;
  const username = $("username").value.trim();

  if (mode === "register" && username.length < 3) {
    return showMessage("Username must have at least 3 characters.");
  }

  if (password.length < 6) {
    return showMessage("Password must have at least 6 characters.");
  }

  $("authSubmit").disabled = true;
  showMessage("Please wait...");

  try {
    if (mode === "register") {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const profile = doc(db, "users", result.user.uid);

      await setDoc(profile, {
        uid: result.user.uid,
        username,
        email,
        exp: 0,
        rank: "Beginner",
        level: 1,
        money: 0,
        createdAt: serverTimestamp()
      });

      showMessage("Account created successfully!");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      showMessage("Login successful!");
    }
  } catch (error) {
    const messages = {
      "auth/email-already-in-use": "This email is already registered.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/weak-password": "Password must be at least 6 characters.",
      "auth/network-request-failed": "Network error. Check your internet."
    };

    showMessage(messages[error.code] || error.message);
  } finally {
    $("authSubmit").disabled = false;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    location.reload();
  } catch (error) {
    showMessage(error.message);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("authPanel").classList.remove("hidden");
    $("setup").classList.add("hidden");
    $("gamePanel").classList.add("hidden");
    $("profileBar").classList.add("hidden");
    return;
  }

  try {
    const profileRef = doc(db, "users", user.uid);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      await setDoc(profileRef, {
        uid: user.uid,
        username: user.email.split("@")[0],
        email: user.email,
        exp: 0,
        rank: "Beginner",
        level: 1,
        money: 0,
        createdAt: serverTimestamp()
      });
    }

    const profile = (await getDoc(profileRef)).data();

    $("profileName").textContent = profile.username || "Player";
    $("playerName").value = profile.username || "Player";
    $("authPanel").classList.add("hidden");
    $("profileBar").classList.remove("hidden");
    $("setup").classList.remove("hidden");

    if (!gameLoaded) {
      gameLoaded = true;
      await import("./client.js");
    }
  } catch (error) {
    showMessage("Could not load your player profile: " + error.message);
    $("authPanel").classList.remove("hidden");
  }
});

showAuthForm("login");
