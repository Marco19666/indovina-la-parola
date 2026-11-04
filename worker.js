const CATEGORIES = ["Letteratura","Geografia","Storia","Scienza","Sport","Cinema","Musica","Arte","Natura","Tecnologia"];
const PRIZES = ["-1 consonante","-1 vocale","+1 consonante","+1 vocale","+3 consonanti","Cambia domanda","Vinci il round","Perdi il round"];
const LANG = {it:"italiano",en:"English",fr:"français",es:"español",de:"Deutsch",pt:"português"};
const MODEL = "gemini-3.5-flash-lite";
const REQUEST_TIMEOUT_MS = 20000;
const QUIZ_SYSTEM_INSTRUCTION = "Sei il generatore di domande del gioco Indovina la Parola. Crea quiz originali, chiari e con una soluzione univoca. Rispetta lingua, categoria e difficoltà richieste. La risposta deve essere una parola o una breve espressione. Restituisci esclusivamente JSON valido con le chiavi clue e answer, senza markdown né testo aggiuntivo.";
const VOWELS = "AEIOU";
const cors = origin => ({"access-control-allow-origin":origin,"access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type","vary":"Origin"});
function difficulty(n){return n<=3?"facile":n<=6?"media":n<=10?"difficile":n<=15?"molto difficile":"esperto"}
function norm(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleUpperCase().replace(/[^A-Z0-9 ]/g,"").replace(/\s+/g," ").trim()}
function mask(answer,revealed){return answer?answer.split(" ").map(w=>[...w].map(c=>revealed.includes(norm(c))?c:"_").join("")):[]}
function publicGame(s){return {gameId:s.gameId,round:s.round,consonants:s.consonants,vowels:s.vowels,difficulty:difficulty(s.round),category:s.category,clue:s.clue,mask:mask(s.answer||"",s.revealed||[]),finished:s.finished,status:s.status,phase:s.phase,prizeResult:s.prizeResult||""}}
export class GameSession{
 constructor(ctx,env){this.ctx=ctx;this.env=env}
 async state(){return await this.ctx.storage.get("state")}
 async save(s){await this.ctx.storage.put("state",s)}
 async recharge(s){const now=Date.now(),period=7200000,steps=Math.floor((now-s.lastRecharge)/period);if(steps>0){s.consonants+=steps*3;s.vowels+=steps;s.lastRecharge+=steps*period}}
 async question(s,language){
  if(!this.env.GEMINI_API_KEY)throw Object.assign(new Error("Configurazione API mancante."),{status:500});
  const prompt="Lingua della domanda e dell'indizio: "+(LANG[language]||"italiano")+". Categoria: "+s.category+". Difficoltà: "+difficulty(s.round)+". Crea una domanda quiz originale, non ambigua, la cui risposta sia una parola o una breve espressione. Restituisci esclusivamente JSON valido con le chiavi clue e answer.";
  const endpoint="https://generativelanguage.googleapis.com/v1beta/models/"+MODEL+":generateContent?key="+this.env.GEMINI_API_KEY;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  let response;
  try{response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system_instruction:{parts:[{text:QUIZ_SYSTEM_INSTRUCTION}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",temperature:.7,maxOutputTokens:300}}),signal:controller.signal})}
  catch(error){const timedOut=error?.name==="AbortError";throw Object.assign(new Error(timedOut?"La risposta sta impiegando troppo tempo.":"Errore di comunicazione con il servizio AI."),{status:timedOut?504:502})}
  finally{clearTimeout(timeout)}
  const result=await response.json().catch(()=>({}));
  if(!response.ok){const detail=result.error?.message||"Errore Gemini ("+response.status+").";if(response.status===429)console.error("GEMINI_429_DETAILS",JSON.stringify({model:MODEL,status:response.status,detail}));throw Object.assign(new Error("Il servizio AI non è al momento disponibile. "+detail),{status:response.status>=500?503:response.status})}
  const raw=result.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n").trim();
  let q;try{q=JSON.parse(raw||"{}")}catch{throw Object.assign(new Error("Gemini ha restituito una risposta JSON non valida."),{status:502})}
  if(typeof q.answer!=="string"||!q.answer.trim()||typeof q.clue!=="string"||!q.clue.trim())throw Object.assign(new Error("Risposta AI non valida."),{status:502});
  s.answer=q.answer.trim().toLocaleUpperCase();s.clue=q.clue.trim();s.revealed=[];s.finished=false;s.status="playing";
 }
 async fetch(req){
  if(req.method==="OPTIONS")return new Response(null,{headers:cors(this.env.ALLOWED_ORIGIN||"*")});
  try{
   const b=req.method==="POST"?await req.json():{},action=new URL(req.url).pathname.split("/").pop(),lang=LANG[b.language]?b.language:"it";
   let s=await this.state();
   if(action==="new"){
    s={gameId:b.gameId||crypto.randomUUID(),round:1,consonants:10,vowels:3,lastRecharge:Date.now(),category:"",answer:"",clue:"",revealed:[],finished:false,status:"playing",phase:"choose_category",prizeResult:""};
    await this.save(s);return this.out({game:publicGame(s),message:"Partita iniziata. Gira la ruota delle materie."});
   }
   if(!s)throw new Error("Inizia una nuova partita");
   await this.recharge(s);
   if(action==="language"){await this.save(s);return this.out({game:publicGame(s)})}
   if(action==="category"){
    if(s.phase!=="choose_category")throw new Error("La ruota delle materie è già stata girata.");
    s.category=CATEGORIES[Math.floor(Math.random()*CATEGORIES.length)];
    s.clue="";s.answer="";s.revealed=[];s.phase="category_selected";s.prizeResult="";
    await this.save(s);return this.out({game:publicGame(s),message:"Materia estratta: "+s.category+". In attesa dell’ordine di generare la domanda."});
   }
   if(action==="prize"){
    if(s.phase!=="choose_prize")throw new Error("Prima devi estrarre una materia e generare la domanda.");
    const p=PRIZES[Math.floor(Math.random()*PRIZES.length)];
    if(p==="-1 consonante")s.consonants=Math.max(0,s.consonants-1);
    if(p==="-1 vocale")s.vowels=Math.max(0,s.vowels-1);
    if(p==="+1 consonante")s.consonants++;
    if(p==="+1 vocale")s.vowels++;
    if(p==="+3 consonanti")s.consonants+=3;
    if(p==="Cambia domanda")await this.question(s,lang);
    if(p==="Vinci il round"){s.finished=true;s.status="won"}
    if(p==="Perdi il round"){s.finished=true;s.status="lost"}
    s.prizeResult=p;s.phase="playing";
    await this.save(s);return this.out({game:publicGame(s),message:"Risultato della ruota: "+p});
   }
   throw new Error("Azione non prevista in questa fase");
  }catch(e){return this.out({error:e.message},e.status||400)}
 }
 out(data,status=200){return Response.json(data,{status,headers:cors(this.env.ALLOWED_ORIGIN||"*")})}
}
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get("Origin")||"",allowed=env.ALLOWED_ORIGIN||"*";
 if(allowed!=="*"&&origin!==allowed&&origin!==url.origin)return new Response("Origin non autorizzata",{status:403});
 if(!url.pathname.startsWith("/api/"))return env.ASSETS.fetch(request);
 const body=request.method==="POST"?await request.clone().json().catch(()=>({})): {};
 const id=env.GAME_SESSIONS.idFromName(String(body.gameId||"default"));
 return env.GAME_SESSIONS.get(id).fetch(request);
}};
