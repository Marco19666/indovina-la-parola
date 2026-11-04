const API_BASE = "https://indovina-la-parola.chiccovision.workers.dev";
const $ = id => document.getElementById(id);
let game = null;
let busy = false;

async function api(path, body={}) {
  const response = await fetch(API_BASE + "/api/" + path, {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({...body,gameId:game?.gameId,language:$("language").value})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Errore del server");
  return data;
}
function say(message){$("message").textContent=message}
function spinAnimation(button){
  button.classList.remove("spinning");
  void button.offsetWidth;
  button.classList.add("spinning");
}
function render(){
  const started=!!game;
  $("newGame").hidden=started;
  $("stats").hidden=!started;
  $("categoryStage").hidden=!started || game.phase!=="choose_category";
  $("questionStage").hidden=!started || !["choose_prize","playing","finished"].includes(game.phase);
  $("prizeStage").hidden=!started || game.phase!=="choose_prize";
  $("resultStage").hidden=!started || !["playing","finished"].includes(game.phase);
  if(!started)return;
  $("round").textContent=game.round;
  $("consonants").textContent=game.consonants;
  $("vowels").textContent=game.vowels;
  $("difficulty").textContent=game.difficulty;
  $("category").textContent=game.category || "In attesa";
  $("clue").textContent=game.clue || "";
  $("prizeResult").textContent=game.prizeResult || "";
  $("categorySpin").disabled=busy || game.phase!=="choose_category";
  $("prizeSpin").disabled=busy || game.phase!=="choose_prize";
}
async function run(action,button){
  if(busy)return;
  busy=true;
  if(button){button.disabled=true;spinAnimation(button)}
  render();
  try{
    const data=await action();
    game=data.game;
    say(data.message || "");
  }catch(error){say(error.message)}
  finally{busy=false;render()}
}
$("newGame").onclick=()=>run(()=>api("new"),$("newGame"));
$("categorySpin").onclick=()=>run(()=>api("category"),$("categorySpin"));
$("prizeSpin").onclick=()=>run(()=>api("prize"),$("prizeSpin"));
$("language").onchange=()=>{if(game)run(()=>api("language"));};
render();
