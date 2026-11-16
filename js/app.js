// 화면 그리기, 추천 계산, 저장(localStorage), Claude 기능 연결

const SORTS=[["추천순","score"],["빠른순","time"],["쉬운순","easy"]];
const SKEY="jipbap-v2";
const DAY=86400000;
const today0=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const isoIn=n=>{const d=new Date(today0().getTime()+n*DAY);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
let S={have:["계란","김치","양파","대파","밥","두부","애호박"],exp:{"두부":isoIn(2),"애호박":isoIn(4)},example:true,
  serv:2,time:30,skill:2,styles:[],tools:["가스레인지","전자레인지"],seas:[...BASIC],dislike:[],dislikeText:"",
  sort:"score",seed:1,shop:[],view:"fridge"};
try{const v=JSON.parse(localStorage.getItem(SKEY)||"null");if(v)S=Object.assign(S,v)}catch(e){}
const save=()=>{try{localStorage.setItem(SKEY,JSON.stringify(S))}catch(e){}};

const $=id=>document.getElementById(id);
const el=(tag,attrs={},...kids)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(v==null||v===false)continue;if(k==="class")e.className=v;else if(k.startsWith("on"))e.addEventListener(k.slice(2),v);else e.setAttribute(k,v===true?"":v)}for(const c of kids.flat()){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(c))}return e};
const toggle=(arr,v)=>arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];
const norm=s=>String(s).replace(/\s+/g,"").trim();
const same=(a,b)=>{a=norm(a);b=norm(b);return a===b||(a.length>1&&b.length>1&&(a.includes(b)||b.includes(a)))};
const haveIt=n=>S.have.some(h=>same(h,n));
const dislikes=()=>[...S.dislike,...S.dislikeText.split(/[,，\s]+/).map(norm).filter(Boolean)];
const isDisliked=n=>dislikes().some(d=>same(d,n));
const isSeas=n=>SEAS.some(s=>same(s,n));
let toastT;
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,2200)}

// 유통기한
function daysLeft(name){const d=S.exp[name];if(!d)return null;const t=new Date(d+"T00:00:00");if(isNaN(t))return null;return Math.round((t-today0())/DAY)}
const ddayText=n=>n<0?"지남":n===0?"오늘까지":"D-"+n;
const soonList=()=>S.have.map(h=>[h,daysLeft(h)]).filter(([,d])=>d!=null&&d<=3).sort((a,b)=>a[1]-b[1]);
const isSoon=n=>soonList().some(([h])=>same(h,n));

function addHave(names){let added=0;for(const x of names){const n=x.trim();if(!n)continue;if(isSeas(n)&&!haveIt(n)){const s=SEAS.find(s=>same(s,n));if(!S.seas.includes(s))S.seas.push(s);added++;continue}if(!S.have.some(h=>norm(h)===norm(n))){S.have.push(n);added++}}S.example=false;return added}
function removeHave(n){S.have=S.have.filter(x=>x!==n);delete S.exp[n];S.example=false}
function addShop(names,why){let added=0;for(const n of names){if(!S.shop.some(s=>norm(s.n)===norm(n))){S.shop.push({n,done:false,why:why||""});added++}}return added}

// 추천 계산
function rnd(seed,str){let h=seed*2654435761>>>0;for(const ch of str)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return (h%1000)/1000}
function passes(r){
  if(r.lv>S.skill||r.t>S.time) return false;
  if(!r.tl.some(t=>S.tools.includes(t))) return false;
  if(S.styles.length&&!r.st.some(s=>S.styles.includes(s))) return false;
  if(r.m.some(([n])=>isDisliked(n))) return false;
  return true;
}
function evaluate(r){
  if(!passes(r)) return null;
  const missMain=r.m.filter(([n])=>!haveIt(n)).map(x=>x[0]);
  const mainHave=r.m.length-missMain.length;
  if(mainHave===0) return null;
  const subHave=r.s.filter(([n])=>haveIt(n)&&!isDisliked(n)).map(x=>x[0]);
  const missSeas=r.sz.filter(([n])=>!S.seas.includes(n)).map(x=>x[0]);
  const uses=[...r.m.map(x=>x[0]).filter(haveIt),...subHave];
  const hot=uses.filter(isSoon);
  const score=mainHave*3+subHave.length*1.2-missMain.length*5-missSeas.length*0.8+hot.length*3+rnd(S.seed,r.n)*2.5;
  return {r,missMain,subHave,missSeas,uses,hot,score};
}
const cmp=(a,b)=>({score:b.score-a.score,time:a.r.t-b.r.t||b.score-a.score,easy:a.r.lv-b.r.lv||a.r.t-b.r.t||b.score-a.score})[S.sort]??(b.score-a.score);
const sorted=list=>list.sort(cmp);

// 화면
const TABS=["fridge","rec","shop"];
function showView(v,scroll){S.view=v;save();for(const t of TABS){$("v-"+t).hidden=t!==v;$("tab-"+t).setAttribute("aria-selected",String(t===v))}if(scroll)window.scrollTo({top:0});renderAlert()}
document.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>showView(b.dataset.v,true));
$("goRec").onclick=()=>showView("rec",true);

function chipRow(c,list,isOn,onClick,cls="chip"){c.replaceChildren(...list.map(v=>el("button",{type:"button",class:cls,"aria-pressed":String(isOn(v)),onclick:()=>onClick(v)},v)))}

function renderFridge(){
  $("exampleNote").hidden=!S.example;
  const L=$("fridgeList");
  if(!S.have.length){L.replaceChildren(el("li",{class:"empty",style:"display:block"},"아직 재료가 없어요. 아래 버튼이나 사진으로 추가해 주세요."))}
  else{
    const items=[...S.have].sort((a,b)=>(daysLeft(a)??999)-(daysLeft(b)??999));
    L.replaceChildren(...items.map(h=>{const d=daysLeft(h);
      const inp=el("input",{type:"date",value:S.exp[h]||"","aria-label":h+" 유통기한"});
      inp.onchange=()=>{if(inp.value)S.exp[h]=inp.value;else delete S.exp[h];update()};
      return el("li",{},el("span",{class:"nm"},h),inp,
        d==null?el("span",{class:"dday ok"},"기한 없음"):el("span",{class:"dday "+(d<=3?"soon":"ok")},ddayText(d)),
        el("button",{type:"button",class:"x","aria-label":h+" 빼기",onclick:()=>{removeHave(h);update()}},"×"))}));
  }
  $("cats").replaceChildren(...Object.entries(CATS).map(([c,items])=>{const row=el("div",{class:"chips"});chipRow(row,items,v=>S.have.includes(v),v=>{if(S.have.includes(v))removeHave(v);else addHave([v]);update()});return el("div",{class:"cat"},el("div",{class:"cat-name"},c),row)}));
  chipRow($("seas"),SEAS,v=>S.seas.includes(v),v=>{S.seas=toggle(S.seas,v);update()});
  chipRow($("dislikeChips"),DISLIKE_QUICK,v=>S.dislike.includes(v),v=>{S.dislike=toggle(S.dislike,v);update()},"chip no");
  if(document.activeElement!==$("dislikeInput"))$("dislikeInput").value=S.dislikeText;
}
function renderAlert(){
  const s=soonList(),a=$("expAlert");
  if(!s.length){a.hidden=true;return}
  a.hidden=false;
  a.replaceChildren(el("span",{},"곧 상해요: ",...s.map(([h,d],i)=>[i?", ":"",el("b",{},h),` (${ddayText(d)})`])),
    ...(S.view!=="rec"?[el("button",{type:"button",class:"btn sm",onclick:()=>{S.sort="score";showView("rec",true);update()}},"이 재료로 메뉴 보기")]:[]));
}
function renderCond(){
  $("serv").textContent=S.serv+"인분";
  $("time").value=String(S.time);
  $("skill").replaceChildren(...SKILLS.map(([l,v])=>el("button",{type:"button","aria-pressed":String(S.skill===v),onclick:()=>{S.skill=v;update()}},l)));
  chipRow($("styles"),STYLES,v=>S.styles.includes(v),v=>{S.styles=toggle(S.styles,v);update()});
  chipRow($("tools"),TOOLS,v=>S.tools.includes(v),v=>{S.tools=toggle(S.tools,v);update()});
  $("sort").replaceChildren(...SORTS.map(([l,v])=>el("button",{type:"button","aria-pressed":String(S.sort===v),onclick:()=>{S.sort=v;update()}},l)));
  $("condSummary").replaceChildren(el("b",{},S.serv+"인분")," · ",el("b",{},S.time>=999?"시간 상관없음":S.time+"분 이내")," · ",el("b",{},["","초보","보통","능숙"][S.skill])," · ",el("b",{},S.styles.length?S.styles.join("·"):"전체 스타일"));
}

function card(ev,mode){
  const {r,missMain,missSeas,uses,hot}=ev;
  return el("article",{class:"card"},
    el("div",{class:"meta"},
      missMain.length?el("span",{class:"pill need"},missMain.join(", ")+" 사면 됨"):el("span",{class:"pill ok"},"바로 가능"),
      hot.length?el("span",{class:"pill hot"},"임박 재료 사용"):null,
      el("span",{class:"pill"},r.t+"분"),el("span",{class:"pill"},LV[r.lv])),
    el("button",{type:"button",class:"open-btn",onclick:()=>openRecipe(ev)},r.n),
    el("div",{class:"uses"},"쓰는 재료: ",el("b",{},uses.join(", ")||"-")),
    missSeas.length?el("div",{class:"miss"},"없는 양념: "+missSeas.join(", ")):null,
    mode==="almost"?el("button",{type:"button",class:"btn ghost sm act",onclick:()=>{const n=addShop(missMain,r.n);update();toast(n?`장보기에 ${missMain.join(", ")} 담았어요`:"이미 장보기 목록에 있어요")}},"장보기에 담기"):null
  );
}
function renderRec(){
  const evs=R.map(evaluate).filter(Boolean);
  const ready=sorted(evs.filter(e=>!e.missMain.length));
  const almost=evs.filter(e=>e.missMain.length>=1&&e.missMain.length<=2).sort((a,b)=>a.missMain.length-b.missMain.length||cmp(a,b));
  $("readyCount").textContent=ready.length?`${ready.length}개`:"";
  const shown=ready.slice(0,9);
  $("ready").replaceChildren(...(shown.length?shown.map(e=>card(e)):[el("div",{class:"emptybox"},S.have.length?"조건에 맞는 메뉴가 없어요. 위 조건에서 시간이나 스타일을 넓혀 보거나, 아래 1~2개만 더 사면 되는 메뉴를 확인해 보세요.":"냉장고 화면에서 재료를 먼저 골라 주세요.")]));
  $("almost").replaceChildren(...(almost.length?almost.slice(0,8).map(e=>card(e,"almost")):[el("div",{class:"emptybox"},"해당하는 메뉴가 없어요.")]));
  const b=$("recBadge");b.hidden=!ready.length;b.textContent=ready.length;
}
function renderShop(){
  const L=$("shopList");
  L.replaceChildren(...(S.shop.length?S.shop.map((it,i)=>{const cb=el("input",{type:"checkbox",checked:it.done});cb.onchange=()=>{it.done=cb.checked;update()};
    return el("li",{class:it.done?"done":""},el("label",{},cb,el("span",{},el("span",{class:"t"},it.n),it.why?el("div",{class:"why"},it.why+"용"):null)),
      el("button",{type:"button",class:"x","aria-label":it.n+" 지우기",onclick:()=>{S.shop.splice(i,1);update()}},"×"))}):[el("li",{class:"empty"},"비어 있어요. 추천 메뉴에서 '장보기에 담기'를 누르거나 직접 추가하세요.")]));
  $("moveBought").disabled=!S.shop.some(s=>s.done);
  const n=S.shop.filter(s=>!s.done).length,b=$("shopBadge");b.hidden=!n;b.textContent=n;
  // 활용도 높은 재료: 이 재료 하나만 더 있으면 가능한 메뉴 수
  const cnt={};
  for(const r of R){if(!passes(r))continue;const miss=r.m.filter(([x])=>!haveIt(x)).map(x=>x[0]);if(miss.length===1){(cnt[miss[0]]=cnt[miss[0]]||[]).push(r.n)}}
  const top=Object.entries(cnt).sort((a,b)=>b[1].length-a[1].length).slice(0,6);
  $("buyList").replaceChildren(...(top.length?top.map(([x,ms])=>el("li",{},el("span",{class:"t"},el("b",{},x),` · 메뉴 ${ms.length}개`,el("small",{},ms.slice(0,4).join(", ")+(ms.length>4?" 외":""))),
    el("button",{type:"button",class:"btn ghost sm",onclick:()=>{addShop([x],ms[0]);update();toast(x+" 담았어요")}},"담기"))):[el("li",{},"냉장고 재료를 더 넣으면 추천해 드려요.")]));
}
function update(){save();renderAlert();renderFridge();renderCond();renderRec();renderShop()}

// 상세
function amt(q,u){if(!q)return "약간";const r=Math.round(q*S.serv/2*10)/10;return (Number.isInteger(r)?r:r.toFixed(1))+(u?" "+u:"")}
function dialogTop(title,meta){return [el("div",{class:"top"},el("div",{class:"meta"},...meta),el("button",{type:"button",class:"btn ghost sm",onclick:()=>$("dlg").close()},"닫기")),el("h2",{},title)]}
function openRecipe(ev){
  const {r,missMain,missSeas}=ev;
  const ingRow=([n,q,u],sub)=>{const dis=isDisliked(n);return el("li",{class:dis?"skip":(!haveIt(n)&&!sub?"lack":"")},el("span",{},n+(sub?" (선택)":"")+(dis?" · 빼기":"")),el("span",{},amt(q,u)))};
  const lacking=[...missMain,...missSeas];
  $("dlgBody").replaceChildren(
    ...dialogTop(r.n,[el("span",{class:"pill"},r.t+"분"),el("span",{class:"pill"},LV[r.lv]),el("span",{class:"pill"},r.tl.join("/")),...r.st.map(s=>el("span",{class:"pill"},s))]),
    el("h3",{},`재료 (${S.serv}인분)`),
    el("ul",{class:"ing"},...r.m.map(x=>ingRow(x,false)),...r.s.map(x=>ingRow(x,true))),
    r.sz.length?el("h3",{},"양념"):null,
    r.sz.length?el("ul",{class:"ing"},...r.sz.map(([n,q,u])=>el("li",{class:S.seas.includes(n)?"":"lack"},el("span",{},n),el("span",{},amt(q,u))))):null,
    lacking.length?el("button",{type:"button",class:"btn ghost sm",onclick:()=>{const n=addShop(lacking,r.n);update();toast(n?"없는 재료를 장보기에 담았어요":"이미 장보기 목록에 있어요")}},`없는 재료 ${lacking.length}개 장보기에 담기`):null,
    el("h3",{},"만드는 법 요약"),
    el("ol",{class:"steps"},...r.p.map(p=>el("li",{},p))),
    r.tip?el("div",{class:"tip"},"팁 · "+r.tip):null);
  $("dlg").showModal();$("dlgBody").scrollTop=0;
}
$("dlg").addEventListener("click",e=>{if(e.target===$("dlg"))$("dlg").close()});

// 입력 이벤트
$("addForm").addEventListener("submit",e=>{e.preventDefault();const n=addHave($("ingInput").value.split(/[,，]/));$("ingInput").value="";update();if(n)toast(`재료 ${n}개를 넣었어요`)});
$("clearIng").onclick=()=>{S.have=[];S.exp={};S.example=false;update()};
$("clearExample").onclick=()=>{S.have=[];S.exp={};S.example=false;update()};
$("allSeas").onclick=()=>{S.seas=[...new Set([...S.seas,...BASIC])];update()};
$("servMinus").onclick=()=>{S.serv=Math.max(1,S.serv-1);update()};
$("servPlus").onclick=()=>{S.serv=Math.min(8,S.serv+1);update()};
$("time").onchange=e=>{S.time=+e.target.value;update()};
$("dislikeInput").oninput=e=>{S.dislikeText=e.target.value;save();renderRec();renderShop()};
$("reroll").onclick=()=>{S.seed=(S.seed%9973)+Math.floor(Math.random()*500)+1;S.sort="score";update();toast("새로 골라 봤어요")};
$("shopForm").addEventListener("submit",e=>{e.preventDefault();addShop($("shopInput").value.split(/[,，]/).map(s=>s.trim()).filter(Boolean));$("shopInput").value="";update()});
$("clearShop").onclick=()=>{S.shop=[];update()};
$("moveBought").onclick=()=>{const bought=S.shop.filter(s=>s.done).map(s=>s.n);S.shop=S.shop.filter(s=>!s.done);addHave(bought);update();toast(`${bought.length}개를 냉장고에 넣었어요. 유통기한도 적어 두세요.`)};

showView(TABS.includes(S.view)?S.view:"fridge");
update();

// ---- Claude 연동: 사진 인식, 새 레시피 ----
let sample=null;
(async()=>{
  sample=await connectAI();
  if(!sample) return;
  $("aiBox").hidden=false;
  const lim=await sample.limits().catch(()=>null);
  if(lim&&lim.images) $("photoWrap").hidden=false;
})();

async function shrink(file){
  const bmp=await createImageBitmap(file);
  const k=Math.min(1,1280/Math.max(bmp.width,bmp.height));
  const c=document.createElement("canvas");c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);
  c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);
  return await new Promise(res=>c.toBlob(res,"image/jpeg",0.85));
}
$("photoInput").onchange=async e=>{
  const f=e.target.files&&e.target.files[0];e.target.value="";
  if(!f||!sample) return;
  const box=$("photoRes");box.hidden=false;box.replaceChildren(el("div",{class:"status"},"사진 속 재료를 찾고 있어요… (10초 정도)"));
  try{
    const img=await shrink(f);
    const known=[...Object.values(CATS).flat(),...SEAS].join(", ");
    const out=await sample.json(`이 사진은 냉장고 안이나 장 본 식재료 사진입니다. 요리에 쓸 수 있는 식재료를 모두 찾아 한국어 이름으로 알려 주세요.
가능하면 다음 이름 중에서 고르고, 없으면 짧은 일반 이름을 쓰세요: ${known}
확실하지 않은 것은 빼세요. JSON만 출력: {"ingredients":["양파","계란"]}`,{images:[img],modelTier:"default"});
    const found=[...new Set(((out&&out.ingredients)||[]).map(s=>String(s).trim()).filter(Boolean))];
    if(!found.length){box.replaceChildren(el("div",{class:"status"},"재료를 찾지 못했어요. 재료가 잘 보이게 다시 찍어 주세요."));return}
    const pick=new Set(found.filter(n=>!haveIt(n)));
    const chips=el("div",{class:"chips"});
    const draw=()=>chipRow(chips,found,v=>pick.has(v),v=>{pick.has(v)?pick.delete(v):pick.add(v);draw()});
    draw();
    box.replaceChildren(el("div",{class:"status"},"찾은 재료예요. 맞는 것만 남기고 넣어 주세요."),chips,
      el("div",{class:"row"},el("button",{type:"button",class:"btn",onclick:()=>{const n=addHave([...pick]);box.hidden=true;update();toast(`재료 ${n}개를 넣었어요`)}},"냉장고에 넣기"),el("button",{type:"button",class:"btn ghost",onclick:()=>box.hidden=true},"취소")));
  }catch(err){
    box.replaceChildren(el("div",{class:"status"},err&&err.code==="not_granted"?"Claude 사용 권한이 꺼져 있어서 사진 인식을 쓸 수 없어요.":err&&err.code==="rate_limited"?"요청이 많아요. 잠시 뒤 다시 찍어 주세요.":"사진을 읽지 못했어요. 다시 시도해 주세요."));
  }
};

let aiRecipes=[];
$("aiBtn").onclick=async()=>{
  if(!sample) return;
  if(!S.have.length){$("aiStatus").textContent="먼저 냉장고 재료를 넣어 주세요.";return}
  const btn=$("aiBtn");btn.disabled=true;$("aiStatus").textContent="레시피를 만들고 있어요… (10~20초)";
  const soon=soonList().map(([h])=>h);
  const prompt=`당신은 신혼부부 가정의 집밥을 돕는 요리 전문가입니다. 아래 조건에 맞는 집밥 레시피 3개를 추천하세요.
- 냉장고 재료: ${S.have.join(", ")}
- 유통기한 임박(우선 사용): ${soon.join(", ")||"없음"}
- 인분: ${S.serv}인분
- 요리 실력: ${["","초보","보통","능숙"][S.skill]}
- 요리 시간: ${S.time>=999?"상관없음":S.time+"분 이내"}
- 스타일: ${S.styles.length?S.styles.join(", "):"상관없음"}
- 조리도구: ${S.tools.join(", ")||"없음(불 없이)"}
- 있는 양념: ${S.seas.join(", ")||"거의 없음"}
- 못 먹는 재료(절대 사용 금지): ${dislikes().join(", ")||"없음"}
규칙: 냉장고 재료를 최대한 쓰고, 새로 사야 하는 재료는 최대 2개. 만드는 법은 4~5단계로 짧게 요약. 이 메뉴들은 피하세요: ${R.map(r=>r.n).join(", ")}.
JSON만 출력: {"recipes":[{"name":"","minutes":0,"level":"쉬움|보통|어려움","why":"한 문장","ingredients":[{"name":"","amount":""}],"seasonings":[{"name":"","amount":""}],"toBuy":[""],"steps":[""],"tip":""}]}`;
  try{
    const data=await sample.json(prompt,{modelTier:"default"});
    aiRecipes=(data&&data.recipes)||[];
    renderAI();
    $("aiStatus").textContent=aiRecipes.length?"새로 만든 레시피예요. 이름을 누르면 자세히 볼 수 있어요.":"레시피를 받지 못했어요. 다시 눌러 주세요.";
  }catch(e){
    $("aiStatus").textContent=e&&e.code==="not_granted"?"Claude 사용 권한이 꺼져 있어요.":e&&e.code==="rate_limited"?"요청이 많아요. 잠시 뒤 다시 눌러 주세요.":"레시피를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.";
  }finally{btn.disabled=false}
};
function renderAI(){
  $("aiCards").replaceChildren(...aiRecipes.map(a=>{const buy=(a.toBuy||[]).filter(Boolean);return el("article",{class:"card"},
    el("div",{class:"meta"},buy.length?el("span",{class:"pill need"},buy.join(", ")+" 사면 됨"):el("span",{class:"pill ok"},"바로 가능"),a.minutes?el("span",{class:"pill"},a.minutes+"분"):null,a.level?el("span",{class:"pill"},a.level):null),
    el("button",{type:"button",class:"open-btn",onclick:()=>openAI(a)},a.name||"새 레시피"),
    a.why?el("div",{class:"uses"},a.why):null,
    buy.length?el("button",{type:"button",class:"btn ghost sm act",onclick:()=>{addShop(buy,a.name);update();toast("장보기에 담았어요")}},"장보기에 담기"):null)}));
}
function openAI(a){
  const li=x=>el("li",{class:haveIt(x.name)||S.seas.some(s=>same(s,x.name))?"":"lack"},el("span",{},x.name),el("span",{},x.amount||""));
  $("dlgBody").replaceChildren(
    ...dialogTop(a.name||"",[el("span",{class:"pill need"},"Claude 추천"),a.minutes?el("span",{class:"pill"},a.minutes+"분"):null,a.level?el("span",{class:"pill"},a.level):null]),
    a.why?el("p",{style:"margin:0"},a.why):null,
    el("h3",{},`재료 (${S.serv}인분)`),el("ul",{class:"ing"},...(a.ingredients||[]).map(li)),
    (a.seasonings||[]).length?el("h3",{},"양념"):null,(a.seasonings||[]).length?el("ul",{class:"ing"},...a.seasonings.map(li)):null,
    el("h3",{},"만드는 법 요약"),el("ol",{class:"steps"},...(a.steps||[]).map(p=>el("li",{},p))),
    a.tip?el("div",{class:"tip"},"팁 · "+a.tip):null);
  $("dlg").showModal();
}
