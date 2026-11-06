console.log("[watch-party] content carregado");

const SERVER_URL = "ws://localhost:8080";

let ws = null;
let roomId = null;
let myName = null;
let isHost = false;
let ignoreReportsUntil = 0
// ---------- comunicação com o page.js ----------

function toPage(action, data = {}) {
  window.postMessage({ source: "watch-party-content", action, ...data }, location.origin);
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (msg?.source !== "watch-party-page") return;

  if (msg.action === "state") {
    if (Date.now() < ignoreReportsUntil) return; // ainda na janela de entrada
    toServer({ type: "state", playing: msg.playing, time: msg.time });
  }

  if (msg.action === "heartbeat" && isHost) {
    toServer({ type: "state", playing: msg.playing, time: msg.time });
  }
});

// ---------- comunicação com o servidor ----------

function toServer(msg) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function handleServerMessage(event) {
  const msg = JSON.parse(event.data);
  console.log("[watch-party] servidor:", msg);

  if (msg.type === "joined") {
    isHost = msg.isHost;
    if (!isHost) {
      ignoreReportsUntil = Date.now() + 5000; // ignora o autoplay de quem acabou de entrar
      if (msg.state) {
        toPage("apply", { playing: msg.state.playing, time: msg.state.time });
      }
    }
  }

  if (msg.type === "promoted") {
    isHost = true;
  }

  if (msg.type === "state") {
    toPage("apply", { playing: msg.playing, time: msg.time });
  }
}

function connect(onOpen) {
  ws = new WebSocket(SERVER_URL);
  ws.addEventListener("open", () => {
    console.log("[watch-party] conectado ao servidor");
    onOpen();
  });
  ws.addEventListener("message", handleServerMessage);
  ws.addEventListener("close", () => {
    console.log("[watch-party] desconectado");
    ws = null;
    roomId = null;
    isHost = false;
  });
}

// ---------- pedidos do popup ----------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "create-room") return;

  if (!location.pathname.startsWith("/watch")) {
    sendResponse({ error: "Abra um episódio primeiro." });
    return;
  }

  if (!roomId) {
    roomId = crypto.randomUUID().slice(0, 8);
    myName = msg.name;
    connect(() => toServer({ type: "create", roomId, name: myName }));
  }

  const link = `${location.origin}${location.pathname}?wp=${roomId}`;
  sendResponse({ link });
});

// ---------- entrar pelo link de convite ----------

const inviteRoom = new URLSearchParams(location.search).get("wp");

if (inviteRoom) {
  chrome.storage.local.get("name").then(({ name }) => {
    roomId = inviteRoom;
    myName = name || "Convidado";
    connect(() => toServer({ type: "join", roomId, name: myName }));
  });
}