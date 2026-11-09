console.log("[watch-party] page carregado");
let expected = null; // { playing, time, at } — o estado que o último apply deveria produzir

function getPlayer() {
  const videoPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer;
  if (!videoPlayer) return null;

  const ids = videoPlayer.getAllPlayerSessionIds();
  const sessionId = ids.find(id => id.startsWith("watch")) ?? ids[0];
  if (!sessionId) {
    console.warn("[watch-party] nenhuma sessão de player:", ids);
    return null;
  }

  return videoPlayer.getVideoPlayerBySessionId(sessionId);
}

function getState() {
  const player = getPlayer();
  if (!player) return null

  const playing = !player.isPaused()
  const time = player.getCurrentTime()

  return { playing, time }
}

function expectedTimeNow() {
  if (!expected) return null;
  if (!expected.playing) return expected.time;           // pausado: o tempo não andou
  return expected.time + (Date.now() - expected.at);     // tocando: andou desde o apply
}

function isEcho(state) {
  if (!expected) return false;
  if (state.playing !== expected.playing) return false;  // tocando/pausado diferente: foi o usuário
  return Math.abs(state.time - expectedTimeNow()) < 1500; // tempo bate: é eco
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
      expected = { playing: msg.playing, time: msg.time, at: Date.now() };
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
  const state = getState();
  if (!state) return; 
  
  if (isEcho(state)) return;

  expected = null;
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
