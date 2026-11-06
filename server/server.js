import { WebSocketServer, WebSocket } from "ws";

const wss = new WebSocketServer({ port: 8080 });

wss.on("listening", () => console.log("rodando"))

wss.on("error", (err) => console.error("erro no servidor:", err.message));

// roomId -> { members: Set<ws>, host: ws, lastState: { playing, time, updatedAt } }
const rooms = new Map();

// ws -> { roomId, name }
const clients = new Map();

function formatMsg(msg) {
  return JSON.stringify(msg)
}

function createRoom(roomId, hostWs) {
  return {
    members: new Set([hostWs]),
    host: hostWs,
    lastState: {
      playing: false,
      time: 0,
      updatedAt: Date.now()
    }
  }
}

function registerClient(ws, roomId, name) {
  clients.set(ws, { roomId, name })
}

function disconnectClient(ws) {
  clients.delete(ws);
}

function send(ws, msg) {
  if (ws.readyState !== WebSocket.OPEN) return

  ws.send(formatMsg(msg))
}

function broadcast(room, msg, exceptWs) {
  for (const member of room.members) {
    if (member === exceptWs) continue

    send(member, msg)
  }
}

const handlers = {
  create: handleCreate,
  join: handleJoin,
  chat: handleChat,
  state: handleState,
};

function handleCreate(ws, msg) {
  const { roomId, name } = msg;

  if (!roomId || !name) {
    return send(ws, { type: "error", reason: "roomId e name são obrigatórios" });
  }

  if (rooms.has(roomId)) {
    return send(ws, { type: "error", reason: "sala já existe" });
  }

  const room = createRoom(roomId, ws)
  rooms.set(roomId, room)

  registerClient(ws, roomId, name)

  send(ws, {
    type: "joined",
    roomId,
    members: [name],
    state: room.lastState,
    isHost: true
  })

  console.log("salas:", rooms.size);
}

function handleJoin(ws, msg) {
  const { roomId, name } = msg;

  if (!roomId || !name) {
    return send(ws, { type: "error", reason: "roomId e name são obrigatórios" });
  }

  const room = rooms.get(roomId);
  if (!room) {
    return send(ws, { type: "error", reason: "Sala não existe" })
  }

  room.members.add(ws)
  registerClient(ws, roomId, name)

  const names = [...room.members].map((member) => clients.get(member).name);

  send(ws, { type: "joined", roomId, members: names, state: room.lastState, isHost: false });
  broadcast(room, { type: "member", name, action: "joined" }, ws)
}

function handleChat(ws, msg) {
  const client = clients.get(ws);
  if (!client) {
    return send(ws, { type: "error", reason: "você não está em uma sala" });
  }

  const text = msg.text?.trim();
  if (!text || text.length > 500) {
    return send(ws, { type: "error", reason: "mensagem vazia ou longa demais" });
  }

  const room = rooms.get(client.roomId);
  if (!room) return;

  broadcast(room, { type: "chat", text, from: client.name, at: Date.now() }, ws);
}

function handleState(ws, msg) {
  const client = clients.get(ws);
  if (!client) {
    return send(ws, { type: "error", reason: "você não está em uma sala" });
  }

  const { playing, time } = msg;
  if (typeof playing !== "boolean" || typeof time !== "number" || time < 0) {
    return send(ws, { type: "error", reason: "state inválido" });
  }

  const room = rooms.get(client.roomId);
  if (!room) return;

  room.lastState = { playing, time, updatedAt: Date.now() };

  broadcast(room, { type: "state", playing, time, from: client.name }, ws);
}

function handleLeave(ws) {
  const client = clients.get(ws);
  if (!client) return; // conectou mas nunca entrou numa sala, nada a limpar

  disconnectClient(ws);

  const room = rooms.get(client.roomId);
  if (!room) return;

  room.members.delete(ws);

  // sala vazia -> apaga e acabou
  if (room.members.size === 0) {
    rooms.delete(client.roomId);
    console.log("sala apagada:", client.roomId, "| salas:", rooms.size);
    return;
  }

  broadcast(room, { type: "member", name: client.name, action: "left" });

  // se quem saiu era o host, passa o bastão
  if (room.host === ws) {
    const [newHost] = room.members;
    room.host = newHost;
    broadcast(room, { type: "host", name: clients.get(newHost).name });
    send(newHost, { type: "promoted" });
  }
}

wss.on('connection', (ws) => {
  console.log("connected");
  ws.on('error', console.error);

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return send(ws, { type: "error", reason: "JSON inválido" });
    }

    const handler = handlers[msg.type];
    if (!handler) {
      return send(ws, { type: "error", reason: `tipo desconhecido: ${msg.type}` });
    }

    try {
      handler(ws, msg);
    } catch (err) {
      console.error(`erro no handler "${msg.type}":`, err);
      send(ws, { type: "error", reason: "erro interno" });
    }
  });


  ws.on("close", () => handleLeave(ws));
});