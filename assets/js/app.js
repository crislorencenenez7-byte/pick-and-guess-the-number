import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, reload, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection, query,
  orderBy, limit, getDocs, serverTimestamp, increment
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let player = null;
let secret = 0;
let triesLeft = 3;
let roundOver = false;
let hintUsed = false;

function say(id, message, error=false) {
  const el=$(id); el.textContent=message; el.classList.toggle("error",error);
}
function friendlyError(error) {
  const map = {
    "auth/email-already-in-use":"That email is already registered.",
    "auth/invalid-email":"Please enter a valid email address.",
    "auth/weak-password":"Use a stronger password (at least 6 characters).",
    "auth/invalid-credential":"Incorrect email or password.",
    "auth/network-request-failed":"Network error. Check your internet connection.",
    "permission-denied":"Firestore denied the request. Check the deployed Firestore rules.",
    "unavailable":"Firebase is temporarily unavailable. Try again."
  };
  return map[error.code] || error.message || "Something went wrong.";
}
function profileRef(uid=auth.currentUser.uid){return doc(db,"players",uid);}
function setConnection(text, ok=false){$("connection").textContent=text;$("connection").style.color=ok?"#73d6a0":"#aab7d0";}

async function loadProfile(user) {
  const ref=profileRef(user.uid);
  const snap=await getDoc(ref);
  if(!snap.exists()){
    const fresh={uid:user.uid,username:user.displayName||user.email.split("@")[0],exp:0,coins:20,wins:0,losses:0,score:0,level:1,createdAt:serverTimestamp()};
    await setDoc(ref,fresh);
    player={...fresh};
  } else {
    player=snap.data();
    if(!player.username){player.username=user.displayName||user.email.split("@")[0];await updateDoc(ref,{username:player.username});}
  }
  renderProfile();
}
function renderProfile(){
  if(!player)return;
  $("welcome").textContent=`Welcome, ${player.username}!`;
  for(const [id,key] of [["level","level"],["exp","exp"],["coins","coins"],["wins","wins"],["losses","losses"],["score","score"]]) $(id).textContent=player[key]??0;
  $("game-level").textContent=player.level||1;
}
async function refreshLeaderboard(){
  const list=$("leaderboard");list.innerHTML="<li>Loading…</li>";
  try{
    const q=query(collection(db,"players"),orderBy("score","desc"),limit(10));
    const result=await getDocs(q);
    list.innerHTML="";
    if(result.empty){list.innerHTML="<li>No players yet.</li>";return;}
    let rank=1;
    result.forEach(s=>{const d=s.data();const li=document.createElement("li");const strong=document.createElement("strong");strong.textContent=d.username||"Player";li.append(`${rank++}. `,strong,` — ${d.score||0} points`);list.append(li);});
  }catch(e){list.innerHTML="";const li=document.createElement("li");li.textContent=friendlyError(e);list.append(li);}
}
function startRound(){
  secret=Math.floor(Math.random()*100)+1;triesLeft=3;roundOver=false;hintUsed=false;
  $("guess").value="";$("guess").disabled=false;$("tries").textContent="You have 3 tries.";
  say("game-message","Make your first guess!");
}
async function saveResult(won){
  const expGain=won?10:2, coinGain=won?5:0, scoreGain=won?100:0;
  const newExp=(player.exp||0)+expGain;
  const newLevel=Math.floor(newExp/100)+1;
  await updateDoc(profileRef(),{exp:increment(expGain),coins:increment(coinGain),wins:increment(won?1:0),losses:increment(won?0:1),score:increment(scoreGain),level:newLevel});
  player.exp=newExp;player.level=newLevel;player.coins=(player.coins||0)+coinGain;player.wins=(player.wins||0)+(won?1:0);player.losses=(player.losses||0)+(won?0:1);player.score=(player.score||0)+scoreGain;
  renderProfile();refreshLeaderboard();
}
$("register-form").addEventListener("submit",async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;
  try{
    const username=$("register-name").value.trim();
    if(username.length<3)throw new Error("Username must be at least 3 characters.");
    const cred=await createUserWithEmailAndPassword(auth,$("register-email").value.trim(),$("register-password").value);
    await updateProfile(cred.user,{displayName:username});
    await sendEmailVerification(cred.user);
    say("auth-message","Verification email sent. Open the email link, then log in.");
    await signOut(auth);
    e.target.reset();
  }catch(err){say("auth-message",friendlyError(err),true);}finally{button.disabled=false;}
});
$("login-form").addEventListener("submit",async e=>{
  e.preventDefault();const button=e.submitter;button.disabled=true;
  try{
    const cred=await signInWithEmailAndPassword(auth,$("login-email").value.trim(),$("login-password").value);
    await reload(cred.user);
    if(!auth.currentUser.emailVerified){
      await signOut(auth);
      say("auth-message","Please verify your email first. Open the verification link, then log in again.",true);
      return;
    }
    await auth.currentUser.getIdToken(true);
    await loadProfile(auth.currentUser);
    $("auth-card").classList.add("hidden");$("game-card").classList.remove("hidden");
    say("auth-message","");setConnection("Connected to Firebase",true);startRound();await refreshLeaderboard();
  }catch(err){say("auth-message",friendlyError(err),true);setConnection("Firebase connection failed");}finally{button.disabled=false;}
});
$("resend-verification").addEventListener("click",async()=>{
  try{
    const email=$("login-email").value.trim(),password=$("login-password").value;
    if(!email||!password)throw new Error("Enter your email and password first.");
    const cred=await signInWithEmailAndPassword(auth,email,password);
    await reload(cred.user);
    if(cred.user.emailVerified){say("auth-message","Your email is already verified.");await signOut(auth);return;}
    await sendEmailVerification(cred.user);await signOut(auth);say("auth-message","A new verification email has been sent.");
  }catch(e){say("auth-message",friendlyError(e),true);}
});
$("logout").addEventListener("click",async()=>{await signOut(auth);player=null;$("game-card").classList.add("hidden");$("auth-card").classList.remove("hidden");say("auth-message","You have logged out.");});
$("guess-form").addEventListener("submit",async e=>{
  e.preventDefault();if(roundOver)return;
  const guess=Number($("guess").value);
  if(!Number.isInteger(guess)||guess<1||guess>100){say("game-message","Enter a whole number from 1 to 100.",true);return;}
  if(guess===secret){roundOver=true;$("guess").disabled=true;say("game-message",`Correct! The number was ${secret}. +10 EXP and +5 coins.`);try{await saveResult(true);}catch(err){say("game-message",`You won, but saving failed: ${friendlyError(err)}`,true);}return;}
  triesLeft--; $("tries").textContent=`${triesLeft} ${triesLeft===1?"try":"tries"} left.`;
  if(triesLeft<=0){roundOver=true;$("guess").disabled=true;say("game-message",`No tries left. The number was ${secret}.`);try{await saveResult(false);}catch(err){say("game-message",`Round ended, but saving failed: ${friendlyError(err)}`,true);}return;}
  say("game-message",guess<secret?"Too low. Try a higher number.":"Too high. Try a lower number.");
});
$("hint").addEventListener("click",async()=>{
  if(!player||roundOver)return;if(hintUsed){say("game-message","You already used a hint this round.",true);return;}
  if((player.coins||0)<10){say("game-message","Not enough coins for a hint.",true);return;}
  try{await updateDoc(profileRef(),{coins:increment(-10)});player.coins-=10;hintUsed=true;renderProfile();say("game-message",`Hint: the number is ${secret%2===0?"even":"odd"}.`);}catch(e){say("game-message",friendlyError(e),true);}
});
$("extra-try").addEventListener("click",async()=>{
  if(!player||roundOver)return;if((player.coins||0)<30){say("game-message","Not enough coins for an extra try.",true);return;}
  try{await updateDoc(profileRef(),{coins:increment(-30)});player.coins-=30;triesLeft++;$("tries").textContent=`${triesLeft} tries left.`;renderProfile();say("game-message","One extra try added.");}catch(e){say("game-message",friendlyError(e),true);}
});
$("new-game").addEventListener("click",startRound);
$("refresh-board").addEventListener("click",refreshLeaderboard);

setConnection("Firebase initialized",true);
