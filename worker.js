const CATEGORIES = ["Letteratura","Geografia","Storia","Scienza","Sport","Cinema","Musica","Arte","Natura","Tecnologia"];
const PRIZES = ["-1 consonante","-1 vocale","+1 consonante","+1 vocale","+3 consonanti","Cambia domanda","Vinci il round","Perdi il round"];
const LANG = {it:"italiano",en:"English",fr:"français",es:"español",de:"Deutsch",pt:"português"};
const VOWELS = "AEIOU";
const cors = (origin) => ({ "access-control-allow-origin": origin, "access-control-allow-methods":"GET,POST,OPTIONS", "access-control-allow-headers":"content-type", "vary":"Origin" });
function difficulty(n){return n<=3?"facile":n<=6?"media":n<=10?"difficile":n<=15?"molto difficile":"esperto"}
function norm(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleUpperCase().replace(/[^A-Z0-9 ]/g,"").replace(/\s+/g," ").trim()}
function mask(answer,revealed){return answer.split(" ").map(w=>[...w].map(c=>revealed.includes(norm(c))?c:"_").join(""))}
function publicGame(s){return {gameId:s.gameId,round:s.round,consonants:s.consonants,vowels:s.vowels,difficulty:difficulty(s.round),category:s.category,clue:s.clue,mask:mask(s.answer,s.revealed),finished:s.finished,status:s.status}}
export class GameSession {
  constructor(ctx,env){this.ctx=ctx;this.env=env}
  async state(){return await this.ctx.storage.get("state")}
  async save(s){await this.ctx.storage.put("state",s)}
  async recharge(s){const now=Date.now(),period=7200000,steps=Math.floor((now-s.lastRecharge)/period);if(steps>0){s.consonants+=steps*3;s.vowels+=steps;s.lastRecharge+=steps*period}}
  async question(s,language){
    if(!this.env.GEMINI_API_KEY)throw new Error("Chiave Gemini non configurata sul Worker");
    const model=this.env.GEMINI_MODEL||"gemini-2.5-flash";
    const prompt="Crea una domanda quiz originale in "+(LANG[language]||"italiano")+". Categoria: "+s.category+". Difficoltà: "+difficulty(s.round)+". Rispondi SOLO JSON valido con chiavi clue e answer. La risposta deve essere una parola o breve espressione, senza spiegazioni. La domanda deve avere una soluzione univoca.";
    const url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent?key="+encodeURIComponent(this.env.GEMINI_API_KEY);
    const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",temperature:.8}}),signal:AbortSignal.timeout(20000)});
    if(!r.ok){const detail=(await r.text()).slice(0,700);throw new Error("Gemini non disponibile ("+r.status+"): "+detail)}
    const j=await r.json(),raw=j.candidates?.[0]?.content?.parts?.[0]?.text;
    const q=JSON.parse(raw||"{}");if(!q.answer||!q.clue)throw new Error("Risposta AI non valida");
    s.answer=String(q.answer).toLocaleUpperCase();s.clue=String(q.clue);s.revealed=[];s.finished=false;s.status="playing";
  }
  async fetch(req){
    const url=new URL(req.url);if(req.method==="OPTIONS")return new Response(null,{headers:cors(this.env.ALLOWED_ORIGIN||"*")});
    try{
      const b=req.method==="POST"?await req.json():{},action=url.pathname.split("/").pop(),lang=LANG[b.language]?b.language:"it";
      let s=await this.state();
      if(action==="new"){
        s={gameId:b.gameId||crypto.randomUUID(),round:1,consonants:10,vowels:3,lastRecharge:Date.now(),category:CATEGORIES[0],answer:"",clue:"",revealed:[],finished:false,status:"playing"};
        await this.question(s,lang);await this.save(s);return this.out({game:publicGame(s),message:"Partita iniziata"});
      }
      if(!s)throw new Error("Inizia una nuova partita");
      await this.recharge(s);
      if(action==="language"){await this.save(s);return this.out({game:publicGame(s)})}
      if(action==="category"||action==="prize"){
        if(s.finished)throw new Error("Round terminato");
        if(action==="category"){s.category=CATEGORIES[Math.floor(Math.random()*CATEGORIES.length)];await this.question(s,lang);await this.save(s);return this.out({game:publicGame(s),message:"Categoria: "+s.category})}
        const p=PRIZES[Math.floor(Math.random()*PRIZES.length)];let msg=p;
        if(p==="-1 consonante")s.consonants=Math.max(0,s.consonants-1);
        if(p==="-1 vocale")s.vowels=Math.max(0,s.vowels-1);
        if(p==="+1 consonante")s.consonants++;
        if(p==="+1 vocale")s.vowels++;
        if(p==="+3 consonanti")s.consonants+=3;
        if(p==="Cambia domanda"){await this.question(s,lang)}
        if(p==="Vinci il round"){s.finished=true;s.status="won"}
        if(p==="Perdi il round"){s.finished=true;s.status="lost"}
        await this.save(s);return this.out({game:publicGame(s),message:msg});
      }
      if(action==="buy"){
        if(s.finished)throw new Error("Round terminato");
        const letter=norm(b.letter);if(!/^[A-Z]$/.test(letter))throw new Error("Lettera non valida");
        const vowel=VOWELS.includes(letter);if(vowel?s.vowels<1:s.consonants<1)throw new Error("Gettoni insufficienti");
        if(s.revealed.includes(letter))throw new Error("Lettera già acquistata");
        if(norm(s.answer).includes(letter)){s.revealed.push(letter);const msg="Lettera trovata!";await this.save(s);return this.out({game:publicGame(s),message:msg})}
        vowel?s.vowels--:s.consonants--;await this.save(s);return this.out({game:publicGame(s),message:"La lettera non c'è. Gettone consumato."});
      }
      if(action==="guess"){
        if(s.finished)throw new Error("Round terminato");
        if(norm(b.answer)===norm(s.answer)){s.consonants+=5;s.vowels+=1;s.finished=true;s.status="won";await this.save(s);return this.out({game:publicGame(s),message:"Esatto! +5 consonanti e +1 vocale."})}
        s.consonants=Math.max(0,s.consonants-2);s.vowels=Math.max(0,s.vowels-1);await this.save(s);return this.out({game:publicGame(s),message:"Risposta errata: -2 consonanti e -1 vocale."});
      }
      if(action==="next"){
        if(!s.finished||s.status!=="won")throw new Error("Puoi avanzare solo dopo aver vinto");
        s.round++;s.category=CATEGORIES[Math.floor(Math.random()*CATEGORIES.length)];await this.question(s,lang);await this.save(s);return this.out({game:publicGame(s),message:"Nuovo round"});
      }
      throw new Error("Azione sconosciuta");
    }catch(e){return this.out({error:e.message},400)}
  }
  out(data,status=200){return Response.json(data,{status,headers:cors(this.env.ALLOWED_ORIGIN||"*")})}
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  const origin=request.headers.get("Origin")||"";
  const allowed=env.ALLOWED_ORIGIN||"*";
  if(allowed!=="*"&&origin!==allowed&&origin!==url.origin)return new Response("Origin non autorizzata",{status:403});
  if(!url.pathname.startsWith("/api/"))return env.ASSETS.fetch(request);
  const body=request.method==="POST"?await request.clone().json().catch(()=>({})): {};
  const id=env.GAME_SESSIONS.idFromName(String(body.gameId||"default"));
  return env.GAME_SESSIONS.get(id).fetch(request);
}};
