const nameInput = document.getElementById("name");
const createBtn = document.getElementById("create");
const copyBtn = document.getElementById("copy");
const result = document.getElementById("result");

// preenche com o nome salvo da última vez
chrome.storage.local.get("name").then(({ name }) => {
  if (name) nameInput.value = name;
});

createBtn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  if (!name) {
    result.textContent = "Digite seu nome.";
    return;
  }

  await chrome.storage.local.set({ name });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "create-room", name });

    if (res.error) {
      result.textContent = `Erro: ${res.error}`;
      copyBtn.hidden = true;
      return;
    }

    result.textContent = res.link;
    copyBtn.hidden = false;
    copyBtn.textContent = "Copiar link";
    copyBtn.onclick = async () => {
      await navigator.clipboard.writeText(res.link);
      copyBtn.textContent = "Copiado!";
    };
  } catch (err) {
    console.error("[popup]", err);
    result.textContent = "Abra um episódio da Netflix nesta aba.";
    copyBtn.hidden = true;
  }
});