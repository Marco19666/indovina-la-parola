const API_BASE = "https://indovina-la-parola.chiccovision.workers.dev";
const CATEGORIES = ["Letteratura","Geografia","Storia","Scienza","Sport","Cinema","Musica","Arte","Natura","Tecnologia"];
const $ = id => document.getElementById(id);
let game = null;
let busy = false;
let rotation = 0;

function showMessage(message) {
  $("message").textContent = message;
}

function drawWheel() {
  const canvas = $("categoryWheel");
  const ctx = canvas.getContext("2d");
  const center = 300;
  const radius = 286;
  const slice = Math.PI * 2 / CATEGORIES.length;
  const colors = ["#31558c","#d6a83c","#477b78","#a64e52","#5969a5","#b87939","#39705d","#86568f","#9a693c","#426d9b"];

  ctx.clearRect(0, 0, 600, 600);
  CATEGORIES.forEach((category, index) => {
    const start = -Math.PI / 2 - slice / 2 + index * slice;
    const end = start + slice;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = colors[index];
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#f6d77c";
    ctx.stroke();

    const middle = start + slice / 2;
    ctx.save();
    ctx.translate(center + Math.cos(middle) * 190, center + Math.sin(middle) * 190);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 25px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 4;
    ctx.fillText(category, 0, 0);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(center, center, 55, 0, Math.PI * 2);
  ctx.fillStyle = "#10182b";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#f6c85f";
  ctx.stroke();
  ctx.fillStyle = "#f6c85f";
  ctx.font = "bold 25px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("GIRA", center, center);
}

async function api(action, extra = {}) {
  if (!game?.gameId) throw new Error("La partita non è ancora pronta. Riprova tra un momento.");
  const response = await fetch(API_BASE + "/api/" + action, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...extra,
      gameId: game.gameId,
      language: $("language").value
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Errore di comunicazione con il server.");
  return data;
}

function render() {
  const ready = Boolean(game);
  $("stats").hidden = !ready;
  $("categoryStage").hidden = !ready || game.phase !== "choose_category";
  $("questionStage").hidden = !ready || !["category_selected","choose_prize","playing","finished"].includes(game.phase);
  $("prizeStage").hidden = true;
  $("resultStage").hidden = true;

  if (ready) {
    $("round").textContent = game.round;
    $("consonants").textContent = game.consonants;
    $("vowels").textContent = game.vowels;
    $("difficulty").textContent = game.difficulty;
    $("category").textContent = game.category || "In attesa";
    $("clue").textContent = game.clue || "La domanda non è ancora stata generata.";
  }
  $("categorySpin").disabled = busy || !ready || game.phase !== "choose_category";
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function spinCategory() {
  if (busy || !game || game.phase !== "choose_category") return;
  busy = true;
  render();
  showMessage("La ruota gira...");

  try {
    // Il server estrae la materia; l'animazione mostra quella stessa materia.
    const result = await api("category");
    const categoryIndex = CATEGORIES.indexOf(result.game?.category);
    if (categoryIndex < 0) throw new Error("Il server ha restituito una materia non valida.");

    const target = (360 - categoryIndex * 36 + 360) % 360;
    const adjustment = (target - (rotation % 360) + 360) % 360;
    const finalRotation = rotation + 360 * 7 + adjustment;

    const wheel = $("categoryWheel");
    wheel.style.transition = "none";
    wheel.style.transform = "rotate(" + rotation + "deg)";
    wheel.getBoundingClientRect();
    wheel.style.transition = "transform 4.3s cubic-bezier(.12,.72,.12,1)";
    wheel.style.transform = "rotate(" + finalRotation + "deg)";

    await wait(4400);
    rotation = finalRotation;
    game = result.game;
    showMessage("Materia estratta: " + game.category + ".");
  } catch (error) {
    showMessage(error.message || "Non è stato possibile girare la ruota.");
  } finally {
    busy = false;
    render();
  }
}

async function startGame() {
  busy = true;
  render();
  showMessage("Caricamento partita...");
  try {
    const gameId = crypto.randomUUID();
    const response = await fetch(API_BASE + "/api/new", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId, language: $("language").value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Impossibile avviare la partita.");
    game = data.game;
    showMessage("Pronto a giocare?");
  } catch (error) {
    game = null;
    showMessage(error.message || "Errore durante l'avvio.");
  } finally {
    busy = false;
    render();
  }
}

$("categorySpin").addEventListener("click", spinCategory);
$("language").addEventListener("change", () => {
  if (game) showMessage("La lingua sarà usata per le prossime domande.");
});

drawWheel();
startGame();
