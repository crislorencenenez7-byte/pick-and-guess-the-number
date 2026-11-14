const socket = io();

const $ = (id) => document.getElementById(id);
const setup = $("setup");
const gamePanel = $("gamePanel");
const states = ["waitingState", "chooseState", "guessState", "watchState", "finishedState"];
let roomCode = null;
let myRole = null;
let myName = "Player";
let toastTimer;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function showState(id) {
  states.forEach((state) => $(state).classList.toggle("hidden", state !== id));
}

function setStatus(message) {
  $("statusMessage").textContent = message;
}

function getName() {
  return $("playerName").value.trim().slice(0, 16) || "Player";
}

function enterGame() {
  setup.classList.add("hidden");
  gamePanel.classList.remove("hidden");
  $("roomCode").textContent = roomCode;
}

function leaveGame() {
  socket.emit("room:leave");
  roomCode = null;
  myRole = null;
  gamePanel.classList.add("hidden");
  setup.classList.remove("hidden");
  showState("waitingState");
  setStatus("Connected");
}

$("createBtn").addEventListener("click", () => {
  myName = getName();
  socket.emit("room:create", { name: myName });
});

$("joinBtn").addEventListener("click", () => {
  myName = getName();
  const code = $("roomCodeInput").value.trim().toUpperCase();
  if (code.length !== 5) return toast("Enter a valid 5-character room code.");
  socket.emit("room:join", { name: myName, code });
});

$("copyCodeBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(roomCode);
    toast("Room code copied!");
  } catch {
    toast(`Share this code: ${roomCode}`);
  }
});

$("lockNumberBtn").addEventListener("click", () => {
  const number = Number($("secretInput").value);
  if (!Number.isInteger(number) || number < 1 || number > 100) {
    return toast("Choose a whole number from 1 to 100.");
  }
  socket.emit("game:set-number", { number });
  $("secretInput").value = "";
  showState("watchState");
  setStatus("Secret number locked.");
});

$("guessBtn").addEventListener("click", submitGuess);
$("guessInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") submitGuess();
});

function submitGuess() {
  const number = Number($("guessInput").value);
  if (!Number.isInteger(number) || number < 1 || number > 100) {
    return toast("Enter a whole number from 1 to 100.");
  }
  socket.emit("game:guess", { number });
  $("guessInput").value = "";
  $("guessBtn").disabled = true;
}

$("nextRoundBtn").addEventListener("click", () => {
  socket.emit("game:next-round");
  showState("watchState");
  setStatus("Starting next round...");
});

$("leaveBtn").addEventListener("click", leaveGame);

socket.on("connect", () => setStatus("Connected to game server"));
socket.on("disconnect", () => setStatus("Connection lost. Refresh to reconnect."));
socket.on("game:error", (message) => {
  toast(message);
  $("guessBtn").disabled = false;
});

socket.on("room:joined", ({ code, role }) => {
  roomCode = code;
  myRole = role;
  enterGame();
  showState("waitingState");
  setStatus(role === "host" ? "Room created. Waiting for a friend." : "Joined room.");
});

socket.on("room:role", ({ role }) => {
  myRole = role;
});

socket.on("room:update", (room) => {
  $("roomCode").textContent = room.code;
  $("roundBadge").textContent = `Round ${room.round}`;
  const host = room.players.find(p => p.isHost);
  const guest = room.players.find(p => !p.isHost);
  $("playerOne").textContent = host ? host.name : "Waiting...";
  $("playerTwo").textContent = guest ? guest.name : "Waiting...";
  $("playerOneRole").textContent = "Picking the number";
  $("playerTwoRole").textContent = "Guessing";
  if (room.players.length < 2) showState("waitingState");
});

socket.on("game:phase", ({ phase, message }) => {
  toast(message);
  if (phase === "choosing") {
    showState(myRole === "host" ? "chooseState" : "watchState");
    if (myRole === "host") setStatus("Choose a secret number.");
  }
  if (phase === "guessing") {
    showState(myRole === "guesser" ? "guessState" : "watchState");
    $("guessBtn").disabled = false;
    $("guessFeedback").textContent = "Make your first guess!";
  }
});

socket.on("game:your-turn", ({ attemptsLeft } = {}) => {
  if (myRole === "guesser") {
    showState("guessState");
    if (attemptsLeft) $("attemptsLeft").textContent = attemptsLeft;
  } else {
    showState("chooseState");
  }
});

socket.on("game:waiting", ({ message }) => {
  showState("watchState");
  setStatus(message);
});

socket.on("game:guess-result", ({ guess, result, attemptsLeft }) => {
  $("guessBtn").disabled = false;
  $("attemptsLeft").textContent = attemptsLeft;
  const messages = {
    higher: `${guess} is too low. HIGHER!`,
    lower: `${guess} is too high. LOWER!`,
    exact: "EXACT! You got it!"
  };
  $("guessFeedback").textContent = messages[result];
  if (myRole === "host") {
    setStatus(`${guess}: ${messages[result]}`);
  }
});

socket.on("game:over", ({ winnerId, winnerName, message }) => {
  showState("finishedState");
  $("resultTitle").textContent = winnerName === myName ? "You won! 🎉" : `${winnerName} wins!`;
  $("resultMessage").textContent = message;
  $("nextRoundBtn").disabled = false;
  setStatus("Round finished.");
});

socket.on("game:opponent-left", ({ message }) => {
  toast(message);
  showState("waitingState");
  setStatus(message);
  $("nextRoundBtn").disabled = false;
});
