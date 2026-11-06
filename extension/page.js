console.log("[watch-party] page carregado");
let ignoreUntil = 0; // até quando ignorar reports (timestamp em ms)

function getPlayer() {
  const videoPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
  if (!videoPlayer) return null;

  const sessionId = videoPlayer.getAllPlayerSessionIds().find(id => id.startsWith("watch"));
  if (!sessionId) return null;

  return videoPlayer.getVideoPlayerBySessionId(sessionId);
}

function getState() {
  const player = getPlayer();
  if (!player) return null

  const playing = !player.isPaused()
  const time = player.getCurrentTime()

  return { playing, time }
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;                    // só mensagens desta própria aba
  const msg = event.data;
  if (msg?.source !== "watch-party-content") return;      // só as suas

  const player = getPlayer();
  if (!player) return console.warn("[watch-party] nenhum player ativo");

  
  switch (msg.action) {
    case "play":
      player.play()
      break;
    case "pause":
      player.pause()
      break;
    case "seek":
      if (typeof msg.time === "number") {
        player.seek(msg.time)
      }
      break;
    case "apply":
      ignoreUntil = Date.now() + 1000;
      if (typeof msg.time === "number" && Math.abs(player.getCurrentTime() - msg.time) > 1500) {
        player.seek(msg.time);
      }
      if (!msg.playing) {
        player.pause();
      } else {
        player.play();
      }
      break;
    default:
      console.warn("Action desconhecida")
      break;
  }

});

function toContent(action, data = {}) {
  window.postMessage({ source: "watch-party-page", action, ...data }, location.origin);
}

function reportState() {
  if (Date.now() < ignoreUntil) return; // eco do apply, ignora

  const state = getState();
  if (!state) return;                   // sem player, nada a reportar

  toContent("state", state);
}

// heartbeat: criado UMA vez, quando o script carrega
setInterval(() => {
  const state = getState();
  if (state) toContent("heartbeat", state);
}, 5000);

for (const evt of ["play", "pause", "seeked"]) {
  document.addEventListener(evt, reportState, true);
}
