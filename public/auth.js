import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

let gameLoaded = false;
let currentUserId = null;

function showMessage(message) {
  $("authMessage").textContent = message;
}

function showAuthForm(mode) {
  $("registerFields").classList.toggle("hidden", mode !== "register");
  $("authTitle").textContent =
    mode === "register" ? "Create Account" : "Welcome Back";

  $("authSubmit").textContent =
    mode === "register" ? "Register" : "Login";

  $("switchAuth").textContent =
    mode === "register"
      ? "Already have an account? Login"
      : "No account yet? Register";

  $("authMode").value = mode;
  showMessage("");
}

async function loadProfile(user) {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) throw readError;

  if (existing) return existing;

  const username =
    user.user_metadata?.username ||
    user.email?.split("@")[0] ||
    "Player";

  const newProfile = {
    id: user.id,
    username,
    email: user.email,
    exp: 0,
    rank: "Beginner",
    level: 1,
    money: 0
  };

  const { data, error } = await supabase
    .from("profiles")
    .insert(newProfile)
    .select()
    .single();

  if (error) throw error;

  return data;
}

async function showDashboard(user) {
  if (currentUserId === user.id) return;

  currentUserId = user.id;

  try {
    showMessage("Loading player profile...");

    const profile = await loadProfile(user);

    $("profileName").textContent = profile.username || "Player";
    $("playerName").value = profile.username || "Player";

    $("authPanel").classList.add("hidden");
    $("profileBar").classList.remove("hidden");
    $("setup").classList.remove("hidden");
    $("gamePanel").classList.add("hidden");

    if (!gameLoaded) {
      await import("./client.js");
      gameLoaded = true;
    }
  } catch (error) {
    currentUserId = null;
    $("authPanel").classList.remove("hidden");
    showMessage("Profile error: " + error.message);
  }
}

function showLoggedOut() {
  currentUserId = null;

  $("authPanel").classList.remove("hidden");
  $("profileBar").classList.add("hidden");
  $("setup").classList.add("hidden");
  $("gamePanel").classList.add("hidden");
}

$("switchAuth").addEventListener("click", () => {
  showAuthForm(
    $("authMode").value === "login" ? "register" : "login"
  );
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

  if (mode === "register" && username.length > 16) {
    return showMessage("Username must not exceed 16 characters.");
  }

  if (password.length < 6) {
    return showMessage("Password must have at least 6 characters.");
  }

  $("authSubmit").disabled = true;
  showMessage("Please wait...");

  try {
    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username }
        }
      });

      if (error) throw error;

      if (data.session && data.user) {
        await showDashboard(data.user);
      } else {
        showMessage(
          "Registration successful! Check your email to confirm your account, then login."
        );
      }
    } else {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      if (data.user) {
        await showDashboard(data.user);
      }
    }
  } catch (error) {
    const messages = {
      "Invalid login credentials": "Incorrect email or password.",
      "User already registered": "This email is already registered.",
      "Email not confirmed": "Please confirm your email first.",
      "duplicate key value violates unique constraint": "That username may already be taken."
    };

    showMessage(messages[error.message] || error.message);
  } finally {
    $("authSubmit").disabled = false;
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    showLoggedOut();
    showAuthForm("login");
  } catch (error) {
    showMessage("Logout error: " + error.message);
  }
});

async function initializeAuth() {
  showAuthForm("login");

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    showMessage(error.message);
    return;
  }

  if (data.session?.user) {
    await showDashboard(data.session.user);
  } else {
    showLoggedOut();
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    showLoggedOut();
  }
});

initializeAuth();
