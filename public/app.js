const API_BASE = "https://indovina-la-parola.chiccovision.workers.dev";
const $ = id => document.getElementById(id);
let game = null;
let busy = false;
const categories=["Letteratura","Geografia","Storia","Scienza","Sport","Cinema","Musica","Arte","Natura","Tecnologia"];
let wheelRotation=0;

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
function drawCategoryWheel(){
  const canvas=$("categoryWheel");if(!canvas)return;
  const ctx=canvas.getContext("2d"),cx=300,cy=300,r=286,step=Math.PI*2/categories.length;
  const colors=["#31558c","#d6a83c","#477b78","#a64e52","#5969a5","#b87939","#39705d","#86568f","#9a693c","#426d9b"];
  ctx.clearRect(0,0,600,600);
  categories.forEach((name,i)=>{
    const start=-Math.PI/2-step/2+i*step,end=start+step;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,end);ctx.closePath();ctx.fillStyle=colors[i];ctx.fill();ctx.lineWidth=5;ctx.strokeStyle="#f6d77c";ctx.stroke();
    const mid=start+step/2;ctx.save();ctx.translate(cx+Math.cos(mid)*190,cy+Math.sin(mid)*190);ctx.rotate(mid+Math.PI/2);ctx.fillStyle="#fff";ctx.font="bold 25px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.shadowColor="#000";ctx.shadowBlur=4;ctx.fillText(name,0,0);ctx.restore();
  });
  ctx.beginPath();ctx.arc(cx,cy,55,0,Math.PI*2);ctx.fillStyle="#10182b";ctx.fill();ctx.lineWidth=8;ctx.strokeStyle="#f6c85f";ctx.stroke();ctx.fillStyle="#f6c85f";ctx.font="bold 25px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("GIRA",cx,cy);
}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
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
async function runCategory(){
  if(busy)return;
  busy=true;$("categorySpin").disabled=true;say("La ruota gira...");
  try{
    const data=await api("category");
    const index=categories.indexOf(data.game.category);
    const wheel=$("categoryWheel");
    wheel.style.transition="none";wheel.style.transform="rotate("+wheelRotation+"deg)";
    void wheel.offsetWidth;
    wheelRotation+=360*5+(index<0?0:-index*36);
    wheel.style.transition="transform 4.2s cubic-bezier(.12,.72,.12,1)";
    wheel.style.transform="rotate("+wheelRotation+"deg)";
    await wait(4300);
    game=data.game;say(data.message||"Materia estratta!");
  }catch(error){say(error.message)}
  finally{busy=false;render()}
}
async function run(action,button){
  if(busy)return;
  busy=true;
  if(button){button.disabled=true;spinAnimation(button)}
  drawCategoryWheel();
render();
  try{
    const data=await action();
    game=data.game;
    say(data.message || "");
  }catch(error){if(game && !game.phase)game=null;say(error.message)}
  finally{busy=false;render()}
}
$("newGame").onclick=()=>run(()=>{game={gameId:crypto.randomUUID()};return api("new")},$("newGame"));
$("categorySpin").onclick=runCategory;
$("prizeSpin").onclick=()=>run(()=>api("prize"),$("prizeSpin"));
$("language").onchange=()=>{if(game)run(()=>api("language"));};
render();
