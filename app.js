import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, sendEmailVerification, reload } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { initializeFirestore, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { getDatabase, ref, set, get, update, onValue, off } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Long polling can help when a mobile network/browser blocks Firestore's default
// streaming transport. It does not replace a working internet connection.
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
const rtdb = getDatabase(app);
const $ = id => document.getElementById(id);

// Stop stalled Firebase requests from leaving the page on an endless spinner.
function withTimeout(promise, milliseconds, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out. Check your internet and Firebase settings, then retry.`)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

let user = null, profile = null, secret = 0, attempts = 3, extraUsed = false;
let currentRoom = null, roomListener = null, guessListener = null;
let authReady = false;
const ranks = [
  {name:"Beginner",need:30},{name:"Advance",need:70},{name:"Good",need:110},
  {name:"Pro",need:150},{name:"Intermediate",need:190},{name:"Smart",need:230}
];

function rankFor(exp=0) {
  let remaining = exp, index = 0;
  while (index < ranks.length - 1 && remaining >= ranks[index].need) {
    remaining -= ranks[index].need;
    index++;
  }
  return {name:ranks[index].name,progress:remaining,need:ranks[index].need};
}
function levelFor(wins=0) { return Math.min(5, 1 + Math.floor(wins / 5)); }
function showMessage(id, message) { $(id).textContent = message; }
function cleanName(value) {
  return String(value || "Player").trim().replace(/[^\w -]/g, "").slice(0,18) || "Player";
}
function profileRef() { return doc(db, "players", user.uid); }
function setScreen(screen) {
  $("loadingPanel").hidden = screen !== "loading";
  $("authPanel").hidden = screen !== "auth";
  $("verifyPanel").hidden = screen !== "verify";
  $("gameApp").hidden = screen !== "game";
}
function friendlyFirebaseError(error) {
  const code = error?.code || "";
  if (code === "permission-denied" || code === "firestore/permission-denied")
    return "Firestore blocked this request. Check that firestore.rules are published and the player is signed in.";
  if (code === "unavailable" || code === "firestore/unavailable" || /offline|network/i.test(error?.message || ""))
    return "Cannot reach Firestore right now. Check internet, Firestore database status, and try again. If this keeps happening, check the Firebase project and authorized domains.";
  if (code === "auth/unauthorized-domain")
    return "This website domain is not authorized. Add crislorencenenez7-byte.github.io in Firebase Authentication > Settings > Authorized domains.";
  return error?.message || "Something went wrong. Please try again.";
}
function renderProfile() {
  if (!profile || !user) return;
  const rank = rankFor(profile.exp || 0);
  $("rank").textContent = rank.name;
  $("level").textContent = levelFor(profile.wins || 0);
  $("exp").textContent = `${rank.progress} / ${rank.need}`;
  $("coins").textContent = profile.coins || 0;
  $("profileName").textContent = profile.username || "Player";
  $("wins").textContent = profile.wins || 0;
  $("losses").textContent = profile.losses || 0;
  $("score").textContent = profile.score || 0;
  $("accountBadge").textContent = profile.username || user.email || "Signed in";
}
async function loadProfile() {
  const snap = await withTimeout(getDoc(profileRef()), 15000, "Firestore profile request");
  if (!snap.exists()) {
    const newProfile = {
      uid:user.uid,
      username:cleanName(user.displayName || user.email?.split("@")[0]),
      exp:0, coins:20, wins:0, losses:0, score:0,
      createdAt:serverTimestamp()
    };
    await withTimeout(setDoc(profileRef(), newProfile), 15000, "Creating player profile");
    profile = {...newProfile};
  } else {
    profile = snap.data();
  }
  renderProfile();
}
async function retryProfileLoad() {
  if (!user) return;
  setScreen("loading");
  $("loadingMessage").textContent = "Connecting to Firestore and loading your player profile…";
  $("retryBtn").hidden = true;
  $("loadingLogoutBtn").hidden = false;
  try {
    await loadProfile();
    setScreen("game");
    startRound();
    await loadLeaderboard();
  } catch (error) {
    console.error("Player profile load failed:", error);
    $("loadingMessage").textContent = friendlyFirebaseError(error);
    $("retryBtn").hidden = false;
    $("loadingLogoutBtn").hidden = false;
  }
}
async function saveProgress({win,exp=0,coins=0,score=0}) {
  const patch = {
    exp:(profile.exp||0)+exp,
    coins:Math.max(0,(profile.coins||0)+coins),
    wins:(profile.wins||0)+(win?1:0),
    losses:(profile.losses||0)+(win?0:1),
    score:(profile.score||0)+score,
    updatedAt:serverTimestamp()
  };
  await updateDoc(profileRef(), patch);
  profile = {...profile,...patch};
  renderProfile();
}
async function spendCoins(cost) {
  if ((profile?.coins||0) < cost) {
    showMessage("classicStatus","Not enough coins.");
    return false;
  }
  await updateDoc(profileRef(), {coins:profile.coins-cost});
  profile.coins -= cost;
  renderProfile();
  return true;
}

function showAuthMode(mode) {
  $("loginForm").hidden = mode !== "login";
  $("registerForm").hidden = mode !== "register";
  $("showLoginBtn").classList.toggle("active", mode === "login");
  $("showRegisterBtn").classList.toggle("active", mode === "register");
  showMessage("authMessage", "");
}
$("showLoginBtn").onclick = () => showAuthMode("login");
$("showRegisterBtn").onclick = () => showAuthMode("register");

$("signupBtn").onclick = async () => {
  const button = $("signupBtn");
  button.disabled = true;
  try {
    const email = $("registerEmail").value.trim();
    const password = $("registerPassword").value;
    const username = cleanName($("registerUsername").value);
    if (!email || password.length < 6)
      throw new Error("Enter a valid email and a password with at least 6 characters.");
    if (!$("registerUsername").value.trim())
      throw new Error("Please enter a username.");
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: username });
    await sendEmailVerification(credential.user);
    user = credential.user;
    $("verifyEmail").textContent = email;
    showMessage("verifyMessage", "Verification email sent. Check your inbox.");
    setScreen("verify");
  } catch (error) {
    showMessage("authMessage", friendlyFirebaseError(error));
  } finally {
    button.disabled = false;
  }
};

$("loginBtn").onclick = async () => {
  const button = $("loginBtn");
  button.disabled = true;
  try {
    const credential = await signInWithEmailAndPassword(
      auth, $("loginEmail").value.trim(), $("loginPassword").value
    );
    await withTimeout(reload(credential.user), 12000, "Firebase Authentication check");
    user = auth.currentUser;
    if (!user.emailVerified) {
      $("verifyEmail").textContent = user.email || "";
      showMessage("verifyMessage", "Your email is not verified yet. Verify it before entering the game.");
      setScreen("verify");
      return;
    }
    await retryProfileLoad();
  } catch (error) {
    showMessage("authMessage", friendlyFirebaseError(error));
  } finally {
    button.disabled = false;
  }
};

$("resendVerifyBtn").onclick = async () => {
  try {
    if (!auth.currentUser) throw new Error("Please log in again to request a verification email.");
    await sendEmailVerification(auth.currentUser);
    showMessage("verifyMessage", "A new verification email has been sent. Check your inbox and Spam/Junk folder.");
  } catch (error) {
    showMessage("verifyMessage", friendlyFirebaseError(error));
  }
};
$("checkVerifiedBtn").onclick = async () => {
  try {
    if (!auth.currentUser) throw new Error("Your session expired. Please log in again.");
    await withTimeout(reload(auth.currentUser), 12000, "Email verification check");
    user = auth.currentUser;
    if (!user.emailVerified) {
      showMessage("verifyMessage", "Not verified yet. Open the email link first, then try again.");
      return;
    }
    showMessage("verifyMessage", "Email verified. Loading your player profile…");
    await retryProfileLoad();
  } catch (error) {
    showMessage("verifyMessage", friendlyFirebaseError(error));
  }
};
$("verifyLogoutBtn").onclick = () => signOut(auth);

$("logoutBtn").onclick = () => signOut(auth);
$("loadingLogoutBtn").onclick = () => signOut(auth);
$("retryBtn").onclick = retryProfileLoad;

onAuthStateChanged(auth, async currentUser => {
  user = currentUser;
  authReady = true;
  if (!user) {
    profile = null;
    $("accountBadge").textContent = "Not signed in";
    setScreen("auth");
    showAuthMode("login");
    return;
  }
  $("accountBadge").textContent = "Checking email…";
  try {
    await withTimeout(reload(user), 12000, "Firebase Authentication check");
    user = auth.currentUser;
    if (!user.emailVerified) {
      $("verifyEmail").textContent = user.email || "";
      showMessage("verifyMessage", "Please verify your email before entering the game.");
      setScreen("verify");
      return;
    }
    await retryProfileLoad();
  } catch (error) {
    console.error("Authentication state check failed:", error);
    $("loadingMessage").textContent = friendlyFirebaseError(error);
    $("retryBtn").hidden = false;
    setScreen("loading");
  }
});

function startRound() {
  secret=Math.floor(Math.random()*100)+1;
  attempts=3; extraUsed=false;
  $("attemptInfo").textContent="Attempts left: 3";
  $("classicStatus").textContent="Choose your first number.";
  const board=$("numberBoard");
  board.replaceChildren();
  for(let number=1;number<=100;number++){
    const button=document.createElement("button");
    button.textContent=number;
    button.onclick=()=>makeGuess(number,button);
    board.append(button);
  }
}
function disableBoard() {
  document.querySelectorAll("#numberBoard button").forEach(button=>button.disabled=true);
}
async function makeGuess(number,button) {
  if(attempts<=0 || button.disabled) return;
  button.disabled=true;
  attempts--;
  if(number===secret){
    $("classicStatus").textContent=`Correct! The number was ${secret}. +10 EXP and +5 coins.`;
    disableBoard();
    try { await saveProgress({win:true,exp:10,coins:5,score:100}); }
    catch(error) { $("classicStatus").textContent += " Save failed: "+friendlyFirebaseError(error); }
    return;
  }
  const feedback=number<secret?"Higher! Try a bigger number.":"Lower! Try a smaller number.";
  if(attempts===0){
    $("classicStatus").textContent=`No tries left. The number was ${secret}.`;
    disableBoard();
    try { await saveProgress({win:false,exp:2,coins:2,score:0}); }
    catch(error) { $("classicStatus").textContent += " Save failed: "+friendlyFirebaseError(error); }
  } else $("classicStatus").textContent=feedback;
  $("attemptInfo").textContent=`Attempts left: ${attempts}`;
}
$("newGameBtn").onclick=startRound;
$("hintBtn").onclick=async()=>{
  if(attempts<=0) return;
  try { if(await spendCoins(10)) $("classicStatus").textContent=`Hint: the number is ${secret%2===0?"even":"odd"}.`; }
  catch(error) { showMessage("classicStatus",friendlyFirebaseError(error)); }
};
$("extraBtn").onclick=async()=>{
  if(extraUsed){showMessage("classicStatus","Extra try already used this round.");return;}
  if(attempts<=0){showMessage("classicStatus","Start a new round first.");return;}
  try {
    if(await spendCoins(30)){
      attempts++; extraUsed=true;
      $("attemptInfo").textContent=`Attempts left: ${attempts}`;
      $("classicStatus").textContent="One extra try added.";
    }
  } catch(error) { showMessage("classicStatus",friendlyFirebaseError(error)); }
};

document.querySelectorAll(".tab").forEach(button=>button.onclick=()=>{
  document.querySelectorAll(".tab").forEach(tab=>tab.classList.toggle("active",tab===button));
  for(const id of ["classic","pvp","leaderboard","profile"]) $(id+"View").hidden=id!==button.dataset.tab;
  if(button.dataset.tab==="leaderboard") loadLeaderboard();
});
async function loadLeaderboard() {
  try {
    const leaderboardQuery=query(collection(db,"players"),orderBy("score","desc"),limit(20));
    const snapshot=await getDocs(leaderboardQuery);
    const box=$("leaderboardList");
    box.replaceChildren();
    let place=0;
    snapshot.forEach(documentSnapshot=>{
      const player=documentSnapshot.data();
      const row=document.createElement("div"); row.className="leader-row";
      const rank=document.createElement("strong"); rank.textContent="#"+(++place);
      const name=document.createElement("div");
      const nameStrong=document.createElement("strong"); nameStrong.textContent=player.username||"Player";
      const detail=document.createElement("small"); detail.textContent=`${player.wins||0} wins · ${rankFor(player.exp||0).name}`;
      name.append(nameStrong,detail);
      const score=document.createElement("strong"); score.textContent=player.score||0;
      row.append(rank,name,score); box.append(row);
    });
    if(!place) box.textContent="No scores yet. Play a round to appear here.";
  } catch(error) {
    $("leaderboardList").textContent=friendlyFirebaseError(error);
  }
}
$("refreshBoardBtn").onclick=loadLeaderboard;

// Realtime Database room prototype. The room creator's browser checks guesses;
// use a trusted server for anti-cheat competitive play.
function makeCode(){return Math.random().toString(36).slice(2,8).toUpperCase();}
function stopRoomListeners(){
  if(!currentRoom) return;
  if(roomListener) off(ref(rtdb,`rooms/${currentRoom}`),"value",roomListener);
  if(guessListener) off(ref(rtdb,`rooms/${currentRoom}/guessRequest`),"value",guessListener);
  roomListener=guessListener=null;
}
async function openRoom(code,role) {
  currentRoom=code;
  $("pvpRoom").hidden=false;
  $("roomCode").textContent=code;
  $("roomRole").textContent=role==="host"?"You are the number picker. Wait for a friend, then set the secret.":"You are the guesser. Wait for the number picker.";
  $("secretPicker").hidden=role!=="host";
  $("pvpGuessControls").hidden=role!=="guest";
  roomListener=snapshot=>{
    const room=snapshot.val();
    if(!room){$("pvpStatus").textContent="Room no longer exists.";return;}
    if(room.guestUid){
      $("pvpStatus").textContent=room.feedback||"Friend joined.";
      if(role==="host") $("secretPicker").hidden=false;
      else $("pvpGuessControls").hidden=room.status!=="playing";
    } else $("pvpStatus").textContent="Waiting for a friend to join…";
    if(room.status==="finished") $("pvpGuessControls").hidden=true;
  };
  onValue(ref(rtdb,`rooms/${code}`),roomListener);
  if(role==="host"){
    guessListener=snapshot=>{
      const guess=snapshot.val();
      if(!guess || guess.handled || !guess.value) return;
      get(ref(rtdb,`privateSecrets/${code}`)).then(secretSnapshot=>{
        const secretValue=secretSnapshot.val()?.number;
        if(!secretValue) return;
        const tries=(guess.attempts||0)+1;
        const won=guess.value===secretValue;
        const feedback=won?`Correct! ${guess.value} is the secret number.`:guess.value<secretValue?"Higher!":"Lower!";
        const finished=won||tries>=3;
        update(ref(rtdb,`rooms/${code}`),{
          feedback:finished&&!won?`Out of tries. The number was ${secretValue}.`:feedback,
          status:finished?"finished":"playing",
          guessRequest:{...guess,handled:true,attempts:tries}
        });
      }).catch(error=>showMessage("pvpStatus",friendlyFirebaseError(error)));
    };
    onValue(ref(rtdb,`rooms/${code}/guessRequest`),guessListener);
  }
}
$("createRoomBtn").onclick=async()=>{
  try {
    stopRoomListeners();
    const code=makeCode();
    await set(ref(rtdb,`rooms/${code}`),{hostUid:user.uid,guestUid:null,status:"waiting",createdAt:Date.now(),feedback:"Waiting for a friend…"});
    await openRoom(code,"host");
    showMessage("pvpMessage","Share this code with your friend.");
  } catch(error) { showMessage("pvpMessage",friendlyFirebaseError(error)); }
};
$("joinRoomBtn").onclick=async()=>{
  try {
    stopRoomListeners();
    const code=$("roomCodeInput").value.trim().toUpperCase();
    if(!/^[A-Z0-9]{6}$/.test(code)) throw new Error("Enter a valid 6-character code.");
    const roomReference=ref(rtdb,`rooms/${code}`);
    const snapshot=await get(roomReference),room=snapshot.val();
    if(!room) throw new Error("Room not found.");
    if(room.hostUid===user.uid) throw new Error("You cannot join your own room.");
    if(room.guestUid && room.guestUid!==user.uid) throw new Error("Room is full.");
    await update(roomReference,{guestUid:user.uid,status:"waiting",feedback:"Friend joined. Waiting for the secret number picker."});
    await openRoom(code,"guest");
  } catch(error) { showMessage("pvpMessage",friendlyFirebaseError(error)); }
};
$("setSecretBtn").onclick=async()=>{
  const number=Number($("secretNumber").value);
  if(!Number.isInteger(number)||number<1||number>100){showMessage("pvpStatus","Choose a whole number from 1 to 100.");return;}
  try {
    await set(ref(rtdb,`privateSecrets/${currentRoom}`),{number,ownerUid:user.uid});
    await update(ref(rtdb,`rooms/${currentRoom}`),{status:"playing",feedback:"Secret locked. The guesser has 3 attempts."});
    $("secretPicker").hidden=true;
  } catch(error) { showMessage("pvpStatus",friendlyFirebaseError(error)); }
};
$("sendGuessBtn").onclick=async()=>{
  const number=Number($("pvpGuess").value);
  if(!Number.isInteger(number)||number<1||number>100){showMessage("pvpStatus","Enter a whole number from 1 to 100.");return;}
  try {
    const requestRef=ref(rtdb,`rooms/${currentRoom}/guessRequest`);
    const snapshot=await get(requestRef),previous=snapshot.val();
    if(previous&&!previous.handled){showMessage("pvpStatus","Wait for the previous guess to be checked.");return;}
    await set(requestRef,{value:number,attempts:previous?.attempts||0,handled:false,by:user.uid,at:Date.now()});
    $("pvpGuess").value="";
  } catch(error) { showMessage("pvpStatus",friendlyFirebaseError(error)); }
};
$("leaveRoomBtn").onclick=()=>{
  stopRoomListeners(); currentRoom=null; $("pvpRoom").hidden=true;
  showMessage("pvpMessage","You left the room.");
};

window.addEventListener("online",()=>{
  if(user && !profile) retryProfileLoad();
});
window.addEventListener("offline",()=>{
  if(user && !profile){
    $("loadingMessage").textContent="Your device is offline. Reconnect to the internet, then tap Retry connection.";
    $("retryBtn").hidden=false;
  }
});
