// Imposta qui l'URL del Worker pubblicato, senza slash finale.
const API_BASE = "";
const $ = (id) => document.getElementById(id);
let game = null;
let busy = false;
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const vowels = "AEIOU";
const labels = {it:"Italiano",en:"English",fr:"Français",es:"Español",de:"Deutsch",pt:"Português"};
async function api(path, body={}) {
  const response = await fetch(API_BASE + "/api/" + path, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...body,gameId:game?.gameId,language:$("language").value})});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Errore del server");
  return data;
}
function say(text){$("message").textContent=text}
function render(){
  if(!game)return;
  $("round").textContent=game.round;
  $("consonants").textContent=game.consonants;
  $("vowels").textContent=game.vowels;
  $("difficulty").textContent=game.difficulty;
  $("category").textContent=game.category || "In attesa";
  $("clue").textContent=game.clue || "";
  $("board").replaceChildren();
  (game.mask || []).forEach(word=>{
    const wrap=document.createElement("div");wrap.className="word";
    [...word].forEach(ch=>{const tile=document.createElement("span");tile.className="tile "+(ch==="_"?"blank":"revealed");tile.textContent=ch==="_"?" ":ch;wrap.append(tile)});
    $("board").append(wrap);
  });
  $("buyConsonant").disabled=game.consonants<1||game.finished;
  $("buyVowel").disabled=game.vowels<1||game.finished;
  $("categorySpin").disabled=game.finished;
  $("prizeSpin").disabled=game.finished;
  renderKeyboard();
}
function renderKeyboard(){
  const lang=$("language").value;
  const chars={it:"ABCDEFGHILMNOPQRSTUVZ",en:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",fr:"ABCDEFGHIJKLMNOPQRSTUVWXYZ",es:"ABCDEFGHIJKLMNÑOPQRSTUVWXYZ",de:"ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß",pt:"ABCDEFGHIJKLMNOPQRSTUVWXYZ"}[lang];
  $("keyboard").replaceChildren();
  [...chars].forEach(ch=>{const b=document.createElement("button");b.textContent=ch;b.disabled=game?.finished; b.onclick=()=>buy(ch);$("keyboard").append(b)});
}
async function run(fn){if(busy)return;busy=true;try{await fn()}catch(e){say(e.message)}finally{busy=false;render()}}
async function buy(letter){return run(async()=>{const data=await api("buy",{letter});game=data.game;say(data.message)})}
$("newGame").onclick=()=>run(async()=>{game={gameId:crypto.randomUUID()};const data=await api("new");game=data.game;say("Nuova partita iniziata!")});
$("categorySpin").onclick=()=>run(async()=>{const data=await api("category");game=data.game;say(data.message)});
$("prizeSpin").onclick=()=>run(async()=>{const data=await api("prize");game=data.game;say(data.message)});
$("buyConsonant").onclick=()=>{const c=[...$("keyboard").querySelectorAll("button")].find(b=>!vowels.includes(b.textContent));if(c)buy(c.textContent)};
$("buyVowel").onclick=()=>{const c=[...$("keyboard").querySelectorAll("button")].find(b=>vowels.includes(b.textContent));if(c)buy(c.textContent)};
$("guessForm").onsubmit=e=>{e.preventDefault();run(async()=>{const data=await api("guess",{answer:$("guess").value});game=data.game;$("guess").value="";say(data.message);if(game.finished&&game.status==="won"){setTimeout(()=>run(async()=>{const next=await api("next");game=next.game;say("Round successivo!")}),1200)}})};
$("language").onchange=()=>{if(game)run(async()=>{const data=await api("language");game=data.game;render()});else renderKeyboard()};
renderKeyboard();
