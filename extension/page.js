console.log("[watch-party] page carregado");

function getPlayer() {
  const videoPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
  if (!videoPlayer) return null;

  const sessionId = videoPlayer.getAllPlayerSessionIds().find(id => id.startsWith("watch"));
  if (!sessionId) return null;

  return videoPlayer.getVideoPlayerBySessionId(sessionId);
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;                    // só mensagens desta própria aba
  const msg = event.data;
  if (msg?.source !== "watch-party-content") return;      // só as suas

  const player = getPlayer();
  if (!player) return console.warn("[watch-party] nenhum player ativo");

  switch (msg.action){
    case "play":
      player.play()
      break;
    case "pause":
      player.pause()
      break;
    case "seek":
      if (typeof msg.time === "number"){
        player.seek(msg.time)
      }
    break;
    case "apply":
      if (typeof msg.time === "number") {
        player.seek(msg.time);
      }
      if(!msg.playing){
        player.pause();
      }  else {
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

  const player = getPlayer();
  
  if(!player) return;

  const playing = !player.isPaused()
  const time = player.getCurrentTime()

  toContent("state", { playing, time})
}

for (const evt of ["play", "pause", "seeked"]) {
  document.addEventListener(evt, reportState, true);
}