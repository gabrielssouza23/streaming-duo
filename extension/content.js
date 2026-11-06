console.log("[watch-party] content carregado");

function toPage(action, data = {}) {
  window.postMessage({ source: "watch-party-content", action, ...data }, location.origin);
}

const SERVER_URL = "ws://localhost:8080";
const ROOM_ID = "teste"; // temporário, até ter UI
const NAME = "Gabriel";  // temporário

let isHost = false;

const ws = new WebSocket(SERVER_URL);

function toServer(msg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

ws.addEventListener("open", () => {
  console.log("[watch-party] conectado ao servidor");
  toServer({ type: "create", roomId: ROOM_ID, name: NAME });
});

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  console.log("[watch-party] servidor:", msg);

  if (msg.type === "error" && msg.reason === "sala já existe") {
    toServer({ type: "join", roomId: ROOM_ID, name: NAME });
  }
  
  if (msg.type === "joined") {
    isHost = msg.isHost;
    if (!isHost && msg.state) {
      toPage("apply", { playing: msg.state.playing, time: msg.state.time });
    }
  }

  if (msg.type === "promoted") {
    isHost = true;
  }

  if (msg.type === "state"){
    toPage("apply", {playing: msg.playing, time: msg.time})
  }

 
});

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const msg = event.data;
  if (msg?.source !== "watch-party-page") return;

  if(msg?.action === "state"){
    toServer({ type: "state", playing: msg.playing, time: msg.time });
  }

  if (msg.action === "heartbeat" && isHost) {
    toServer({ type: "state", playing: msg.playing, time: msg.time });
  }

});

ws.addEventListener("close", () => console.log("[watch-party] desconectado"));