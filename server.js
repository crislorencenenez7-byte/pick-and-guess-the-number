const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.use(express.static(path.join(__dirname, "public")));

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 5 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)]
    ).join("");
  } while (rooms.has(code));
  return code;
}

function cleanName(value) {
  return String(value || "Player").trim().replace(/[<>]/g, "").slice(0, 16) || "Player";
}

function publicRoom(room) {
  return {
    code: room.code,
    players: room.players.map((p) => ({ name: p.name, isHost: p.id === room.hostId })),
    status: room.status,
    round: room.round
  };
}

function sendRoom(room) {
  io.to(room.code).emit("room:update", publicRoom(room));
  for (const player of room.players) {
    io.to(player.id).emit("room:role", {
      role: player.id === room.hostId ? "host" : "guesser"
    });
  }
}

function sendError(socket, message) {
  socket.emit("game:error", message);
}

function findRoomForSocket(socket) {
  const code = socket.data.roomCode;
  return code ? rooms.get(code) : null;
}

io.on("connection", (socket) => {
  socket.on("room:create", ({ name } = {}) => {
    if (socket.data.roomCode) return sendError(socket, "Leave your current room first.");

    const code = makeRoomCode();
    const player = { id: socket.id, name: cleanName(name) };
    const room = {
      code,
      players: [player],
      hostId: socket.id,
      guesserId: null,
      secret: null,
      attemptsLeft: 3,
      status: "waiting",
      round: 1
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit("room:joined", { code, role: "host" });
    sendRoom(room);
  });

  socket.on("room:join", ({ code, name } = {}) => {
    if (socket.data.roomCode) return sendError(socket, "Leave your current room first.");

    const normalizedCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(normalizedCode);
    if (!room) return sendError(socket, "Room not found. Check the code.");
    if (room.players.length >= 2) return sendError(socket, "This room is full.");
    if (room.status !== "waiting") return sendError(socket, "This game has already started.");

    room.players.push({ id: socket.id, name: cleanName(name) });
    room.guesserId = socket.id;
    room.status = "choosing";
    socket.join(room.code);
    socket.data.roomCode = room.code;

    socket.emit("room:joined", { code: room.code, role: "guesser" });
    io.to(room.code).emit("game:phase", {
      phase: "choosing",
      message: `${room.players.find(p => p.id === room.hostId).name} is choosing a secret number.`
    });
    sendRoom(room);
  });

  socket.on("game:set-number", ({ number } = {}) => {
    const room = findRoomForSocket(socket);
    if (!room || room.status !== "choosing" || socket.id !== room.hostId) {
      return sendError(socket, "You cannot choose the number right now.");
    }

    const secret = Number(number);
    if (!Number.isInteger(secret) || secret < 1 || secret > 100) {
      return sendError(socket, "Choose a whole number from 1 to 100.");
    }

    room.secret = secret;
    room.attemptsLeft = 3;
    room.status = "guessing";
    io.to(room.code).emit("game:phase", {
      phase: "guessing",
      message: "The secret number is locked. The guesser has 3 attempts."
    });
    io.to(room.guesserId).emit("game:your-turn", {
      attemptsLeft: room.attemptsLeft
    });
    io.to(room.hostId).emit("game:waiting", {
      message: "Your opponent is guessing. Keep the number secret!"
    });
    sendRoom(room);
  });

  socket.on("game:guess", ({ number } = {}) => {
    const room = findRoomForSocket(socket);
    if (!room || room.status !== "guessing" || socket.id !== room.guesserId) {
      return sendError(socket, "It is not your turn to guess.");
    }

    const guess = Number(number);
    if (!Number.isInteger(guess) || guess < 1 || guess > 100) {
      return sendError(socket, "Choose a whole number from 1 to 100.");
    }

    room.attemptsLeft -= 1;
    let result = "exact";
    if (guess < room.secret) result = "higher";
    if (guess > room.secret) result = "lower";

    io.to(room.code).emit("game:guess-result", {
      guess,
      result,
      attemptsLeft: room.attemptsLeft
    });

    if (result === "exact") {
      room.status = "finished";
      io.to(room.code).emit("game:over", {
        winnerId: room.guesserId,
        winnerName: room.players.find(p => p.id === room.guesserId).name,
        message: "Exact! The guesser wins!"
      });
    } else if (room.attemptsLeft <= 0) {
      room.status = "finished";
      io.to(room.code).emit("game:over", {
        winnerId: room.hostId,
        winnerName: room.players.find(p => p.id === room.hostId).name,
        message: `No attempts left! The secret number was ${room.secret}.`
      });
    }
    sendRoom(room);
  });

  socket.on("game:next-round", () => {
    const room = findRoomForSocket(socket);
    if (!room || room.status !== "finished") return;
    if (!room.players.some(p => p.id === socket.id)) return;

    // Either player can start the next round. Roles alternate.
    const oldHost = room.hostId;
    room.hostId = room.players.find(p => p.id !== oldHost).id;
    room.guesserId = oldHost;
    room.secret = null;
    room.attemptsLeft = 3;
    room.status = "choosing";
    room.round += 1;

    sendRoom(room);
    io.to(room.code).emit("game:phase", {
      phase: "choosing",
      message: `${room.players.find(p => p.id === room.hostId).name} chooses the secret number for round ${room.round}.`
    });
    io.to(room.hostId).emit("game:your-turn", { phase: "choose" });
    io.to(room.guesserId).emit("game:waiting", { message: "Wait for your opponent to choose a number." });
  });

  socket.on("room:leave", () => leaveRoom(socket));
  socket.on("disconnect", () => leaveRoom(socket));
});

function leaveRoom(socket) {
  const room = findRoomForSocket(socket);
  if (!room) return;

  room.players = room.players.filter(p => p.id !== socket.id);
  socket.leave(room.code);
  delete socket.data.roomCode;

  if (room.players.length === 0) {
    rooms.delete(room.code);
    return;
  }

  room.status = "waiting";
  room.secret = null;
  room.guesserId = null;
  room.hostId = room.players[0].id;
  io.to(room.code).emit("game:opponent-left", {
    message: "The other player left. You are now the room host."
  });
  sendRoom(room);
}

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Pick & Guess is running on http://localhost:${PORT}`);
});
