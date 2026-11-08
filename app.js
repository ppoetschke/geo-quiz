(function(){
const G=window.GEO;
// touch devices (iPad): bigger tap targets, quiz panel at the top (above the on-screen keyboard)
const TOUCH=matchMedia("(pointer: coarse)").matches||new URLSearchParams(location.search).has("touch");
document.body.classList.toggle("touch",TOUCH);
const svg=d3.select("#map").append("svg");
const g=svg.append("g");
const projection=d3.geoNaturalEarth1();
const path=d3.geoPath(projection);
let W,H;

function layout(){
  const el=document.getElementById("map"); W=el.clientWidth; H=el.clientHeight;
  projection.fitExtent([[10,10],[W-10,H-10]],{type:"Sphere"});
  g.selectAll("path").attr("d",d=>d?path(d.geom||d):null);
  if(typeof ALL!=="undefined") ALL.forEach(projectItem);
}
// ---------- hit testing for click mode (projected coordinates, before zoom) ----------
function projectItem(it){
  const parts=it.geom.type==="MultiLineString"?it.geom.coordinates:it.geom.coordinates.flat();
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  it._px=parts.map(line=>{ const out=[]; let prev=null;
    for(const c of line){ const p=projection(c); if(!p) continue;
      if(prev&&Math.abs(p[0]-prev[0])>W/3){ out.push(null); } // antimeridian jump: break the line
      out.push(p); prev=p; x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]); }
    return out; });
  it._bb=[x0,y0,x1,y1];
}
function segDist(p,a,b){ const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy; let t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0; t=Math.max(0,Math.min(1,t));
  const x=a[0]+t*dx-p[0],y=a[1]+t*dy-p[1]; return Math.sqrt(x*x+y*y); }
function edgeDist(it,p,max){ const [x0,y0,x1,y1]=it._bb; if(p[0]<x0-max||p[0]>x1+max||p[1]<y0-max||p[1]>y1+max) return Infinity;
  let m=Infinity; for(const l of it._px) for(let j=1;j<l.length;j++){ if(!l[j]||!l[j-1]) continue; const d=segDist(p,l[j-1],l[j]); if(d<m) m=d; } return m; }
// screen point → items under it, thinnest first (river > lake > sea)
function hitItems(pt,items){
  const t=d3.zoomTransform(svg.node()), p=t.invert(pt), geo=projection.invert(p), tol=(TOUCH?20:10)/t.k, out=[];
  for(const it of items){
    // rank: river right under the pointer (≤4 px) > inside a lake > river nearby > lake edge > inside a sea > sea edge
    if(it.kind==="river"){ const d=edgeDist(it,p,tol); if(d<=tol) out.push([d*t.k<=(TOUCH?8:4)?0:2,d,it]); }
    else { const inside=geo&&d3.geoContains(it.geom,geo); const lake=it.kind==="lake";
      const d=inside?0:edgeDist(it,p,tol*(lake?0.8:0.5));
      if(inside) out.push([lake?1:4,0,it]); else if(d<=tol*(lake?0.8:0.5)) out.push([lake?3:5,d,it]); }
  }
  return out.sort((x,y)=>x[0]-y[0]||x[1]-y[1]).map(x=>x[2]);
}
g.append("path").datum({type:"Sphere"}).attr("fill","var(--sea)");
const ALL=G.categories.flatMap(c=>c.items.map(it=>Object.assign(it,{cat:c})));
// German grammatical gender where it differs from the category default
const FEM=["r-donau","r-elbe","r-oder","r-weichsel","r-wolga","r-loire","r-seine","r-rhone","r-themse","r-theiss","r-lena","r-dwina","r-petschora","r-kolyma","l-mueritz"];
ALL.forEach(it=>{ if(FEM.includes(it.id)) it.article="die"; });
// spellings used at school
const XALT={"r-uruguay":["Pelotas"],"r-jangtse":["Jangtsekiang"],"r-huanghe":["Huang-He","Huangho"],"s-labrador":["Labrador"],"s-arktis":["Nordpolarmeer"],"s-suedpolar":["Atlantisch-Indisches Südpolarbecken","Atlantisch-Indisches-Südpolarbecken"]};
ALL.forEach(it=>{ (XALT[it.id]||[]).forEach(n=>{ if(!it.alts.includes(n)) it.alts.push(n); }); });
// D3 expects clockwise outer rings; Natural Earth polygons may be counter-clockwise → reverse polygons whose area covers most of the sphere
function fixWinding(geom){
  if(geom.type!=="MultiPolygon") return;
  geom.coordinates=geom.coordinates.map(p=>d3.geoArea({type:"Polygon",coordinates:p})>2*Math.PI?p.map(r=>r.slice().reverse()):p);
}
ALL.filter(d=>d.kind==="lake").forEach(d=>fixWinding(d.geom));
G.lakes.forEach(f=>fixWinding(f.geometry));
[G.countries,G.deserts,G.tundra,G.glaciers].forEach(fs=>fs.forEach(f=>fixWinding(f.geometry)));
ALL.filter(d=>d.kind==="sea").forEach(d=>fixWinding(d.geom));
// seas sit under the land so coastlines clip the rough marine polygons
g.selectAll(".sq").data(ALL.filter(d=>d.kind==="sea"),d=>d.id).join("path").attr("class","sea sq");
const seaHl=g.append("path").attr("class","sea-hl").style("display","none");
// terrain: country fills (shades of green), tundra, deserts, ice, then borders on top
g.selectAll(".land").data(G.countries).join("path").attr("class",d=>"land "+(d.properties.ice?"ice":"c"+d.properties.c));
g.selectAll(".tundra").data(G.tundra).join("path").attr("class","tundra");
g.selectAll(".desert").data(G.deserts).join("path").attr("class","desert");
g.selectAll(".glacier").data(G.glaciers).join("path").attr("class","glacier");
g.selectAll(".border").data(G.countries).join("path").attr("class","border");
g.selectAll(".lake").data(G.lakes).join("path").attr("class","lake");
const lakeSel=g.selectAll(".lq").data(ALL.filter(d=>d.kind==="lake"),d=>d.id).join("path").attr("class","lake lq");
g.append("path").datum(G.otherRivers).attr("class","river other");
const itemSel0=g.selectAll(".r").data(ALL.filter(d=>d.kind==="river"),d=>d.id).join("path").attr("class","river r");
const itemSel=g.selectAll(".r,.lq,.sq");
const glow=g.append("path").attr("class","river hl-glow").style("display","none");
const hl=g.append("path").attr("class","river hl").style("display","none");
const hover=g.append("path").attr("class","hover").style("display","none").style("pointer-events","none");

const zoom=d3.zoom().scaleExtent([1,40]).on("zoom",e=>g.attr("transform",e.transform));
svg.call(zoom).on("dblclick.zoom",null);
function focusBox(b,ms=900,fill=0.9,maxK=6){
  const [[x0,y0],[x1,y1]]=b, panelW=document.querySelector(".panel:not([hidden])")?.offsetWidth||0;
  const padL=W>800&&!TOUCH?panelW+40:30, pad=50, w=Math.max(x1-x0,1), h=Math.max(y1-y0,1);
  const k=Math.max(1,Math.min(maxK,fill/Math.max(w/(W-padL-pad),h/(H-pad*2))));
  const tx=padL+(W-padL-pad)/2-(x0+x1)/2*k, ty=H/2-(y0+y1)/2*k;
  svg.transition().duration(ms).call(zoom.transform,d3.zoomIdentity.translate(tx,ty).scale(k));
}
layout(); window.addEventListener("resize",()=>{layout(); if(cur&&mode==="type") focus(cur,0);});

function focus(r,ms=900){
  const [[x0,y0],[x1,y1]]=path.bounds(r.geom);
  const panelW=document.querySelector(".panel:not([hidden])")?.offsetWidth||0;
  const padL=W>800&&!TOUCH?panelW+40:30, pad=60;
  const w=Math.max(x1-x0,1), h=Math.max(y1-y0,1);
  const lake=r.kind==="lake", sea=r.kind==="sea";
  let k=(lake?0.3:sea?0.75:0.9)/Math.max(w/(W-padL-pad),h/(H-pad*2));
  k=Math.max(1,Math.min(k,lake?28:sea?10:6));
  const cx=(x0+x1)/2, cy=(y0+y1)/2;
  const topOff=TOUCH?(document.querySelector(".panel:not([hidden])")?.offsetHeight||0)/2+10:0;
  const tx=padL+(W-padL-pad)/2-cx*k, ty=H/2+topOff-cy*k;
  svg.transition().duration(ms).call(zoom.transform,d3.zoomIdentity.translate(tx,ty).scale(k));
}

// ---------- UI ----------
const $=id=>document.getElementById(id);
const REGIONS=["Alle","Europa","Asien","Afrika","Amerika","Ozeanien"], COUNTS=[10,20,"Alle"];
const CATS=[...G.categories.map(c=>c.label),"Gemischt"];
const MODES=["Name eingeben","Auf Karte zeigen"], LEVELS=["Leicht","Schwierig","Schule"];
// "Schule": exactly the waters from the school test sheet (Geo Test, Nov 2026)
const SCHOOL=new Set(("r-yukon r-mackenzie r-colorado r-ohio r-mississippi r-amazonas r-uruguay r-rhein r-donau r-wolga r-ob r-jenissei r-lena "+
 "r-amur r-huanghe r-jangtse r-mekong r-indus r-ganges r-darling r-niger r-nil r-kongo r-sambesi "+
 "s-mexiko s-karibik s-hudson s-baffin s-labrador s-arktis s-barents s-kara s-schwarzes s-mittelmeer s-guinea s-rotes "+
 "s-arabisch s-bengalen s-persisch s-suedchin s-japan s-ochotsk s-tasman s-suedpolar "+
 "l-baikal l-balchasch l-aral l-kaspi l-ladoga l-victoria l-malawi l-tschad l-tanganjika l-huron l-michigan l-superior l-winnipeg l-sklaven").split(" "));
// "Leicht": only the largest / best-known waters; "Schwierig": everything
const EASY=new Set(("r-nil r-amazonas r-mississippi r-missouri r-jangtse r-huanghe r-kongo r-niger r-sambesi r-ganges r-indus r-mekong "+
 "r-wolga r-donau r-rhein r-elbe r-loire r-seine r-themse r-ob r-jenissei r-lena r-amur r-euphrat r-tigris r-parana r-orinoco "+
 "r-colorado r-yukon r-murray "+
 "l-kaspi l-baikal l-victoria l-tanganjika l-malawi l-tschad l-superior l-michigan l-huron l-erie l-ontario l-titicaca "+
 "l-ladoga l-aral l-totes l-genf l-boden l-garda l-baeren l-sklaven l-nasser l-eyre "+
 "s-atlantik s-pazifik s-indik s-arktis s-suedpolar s-mittelmeer s-nordsee s-ostsee s-schwarzes s-rotes s-karibik s-mexiko "+
 "s-persisch s-arabisch s-bengalen s-suedchin s-japan s-bering s-hudson s-adria s-aegaeis s-korallen s-tasman s-aermel s-gibraltar").split(" "));
const GOALS=["80 %","100 %"];
let goal="80 %", milestones=new Set();
const pick=l=>l[Math.floor(Math.random()*l.length)];
const MSG40=["Schon 40 % geschafft – du bist auf einem guten Weg!","40 % richtig! Bleib dran, das läuft.","Starker Anfang – 40 % sind schon im Kasten!"];
const MSG60=["60 %! Das Ziel kommt in Sichtweite.","Super, schon 60 % richtig – weiter so!","60 % geschafft – du wirst immer sicherer!"];
const PRAISE=["Hervorragend! Du kennst dich richtig gut aus.","Großartig – Ziel erreicht, das sitzt!","Klasse Leistung! Darauf kannst du stolz sein.","Bravo! So sieht Geografie-Profi aus."];
function toast(msg){ const t=$("toast"); t.textContent=msg; t.classList.remove("show"); void t.offsetWidth; t.classList.add("show"); }
let level="Leicht", region="Alle", count=10, catLabel=G.categories[0].label, mode="type", gamePool=[];
function chips(el,vals,get,set){
  el.innerHTML=""; vals.forEach(v=>{const b=document.createElement("button");b.textContent=v;b.className=get()===v?"on":"";
    b.onclick=()=>{set(v);chips(el,vals,get,set);info();};el.appendChild(b);});
}
function pool(){ return ALL.filter(r=>(level==="Schwierig"||(level==="Schule"?SCHOOL:EASY).has(r.id))&&(catLabel==="Gemischt"||r.cat.label===catLabel)&&(region==="Alle"||r.continent===region)); }
function info(){ $("poolinfo").textContent=pool().length+" Fragen in dieser Auswahl";
  $("subtitle").textContent=catLabel==="Gemischt"?"Flüsse, Seen & Meere":catLabel+" der Welt";
  const c=G.categories.find(c=>c.label===catLabel);
  $("starttitle").textContent=mode==="click"?"Wo liegt "+(!c?"dieses Gewässer":(c.article==="das"?"dieses ":"dieser ")+c.noun)+"?":!c?"Wie heißt dieses Gewässer?":"Wie heißt "+(c.article==="das"?"dieses ":"dieser ")+c.noun+"?";
  $("startdesc").textContent=mode==="click"?"Der Name wird vorgegeben – klicke auf der Karte auf das richtige Gewässer. Zoomen und Verschieben mit Maus oder Trackpad.":"Ein Fluss, See oder Meer wird auf der Karte rot markiert. Tippe den Namen ein – kleine Tippfehler sind erlaubt."; }
chips($("modes"),MODES,()=>mode==="type"?MODES[0]:MODES[1],v=>mode=v===MODES[0]?"type":"click");
chips($("levels"),LEVELS,()=>level,v=>level=v);
chips($("goals"),GOALS,()=>goal,v=>goal=v);
chips($("cats"),CATS,()=>catLabel,v=>catLabel=v);
chips($("regions"),REGIONS,()=>region,v=>region=v);
chips($("counts"),COUNTS,()=>count,v=>count=v);
info();

let qs=[],i=0,score=0,hints=0,tries=0,mistakes=[],t0=0,timerId=null,cur=null,locked=false;
function show(id){ ["start","quiz","result"].forEach(p=>$(p).hidden=p!==id); $("stats").hidden=id!=="quiz"; }

function goalPct(){ return goal==="100 %"?100:80; }
function start(repeat){
  if(repeat===true&&qs.length) qs=d3.shuffle(qs.slice()); // same questions again, new order
  else { const p=d3.shuffle(pool().slice()); qs=count==="Alle"?p:p.slice(0,count); }
  milestones=new Set(); $("goalinfo").textContent="Ziel "+goalPct()+" %";
  const one=QP.get("item"); if(one) qs=ALL.filter(d=>d.id===one);
  gamePool=pool();
  i=0;score=0;mistakes=[];
  $("form").hidden=mode==="click"; $("hint").textContent=mode==="click"?"💡 Tipp (heranzoomen)":"💡 Tipp";
  itemSel.classed("done",false).classed("missed",false);
  show("quiz");
  next();
}
function fmt(ms){const s=Math.floor(ms/1000);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0");}
function regionView(ms=900){
  if(region==="Alle"){ svg.transition().duration(ms).call(zoom.transform,d3.zoomIdentity); return; }
  focusBox(path.bounds({type:"GeometryCollection",geometries:gamePool.filter(d=>d.kind!=="sea"||region!=="Alle").map(d=>d.geom)}),ms,0.95,8);
}
function showTarget(on){
  const sea=cur.kind==="sea", lake=cur.kind==="lake";
  glow.classed("area",lake); hl.classed("area",lake);
  glow.datum(cur.geom).attr("d",path).style("display",on&&!sea?null:"none");
  hl.datum(cur.geom).attr("d",path).style("display",on&&!sea?null:"none");
  seaHl.datum(cur.geom).attr("d",path).style("display",on&&sea?null:"none");
}
function next(){
  if(i>=qs.length) return finish();
  cur=qs[i]; tries=0; hints=0; locked=false;
  if(mode==="click") return nextClick();
  $("progress").textContent=(i+1)+" / "+qs.length; $("score").textContent=score;
  const noun=cur.noun||cur.cat.noun, art=cur.noun?cur.article:cur.cat.article; // article of the noun ("der Fluss"), not of the name ("die Donau")
  $("qtext").innerHTML="Wie heißt "+art+" <b>rot markierte</b> "+noun+"?";
  const lake=cur.kind==="lake", sea=cur.kind==="sea"; glow.classed("area",lake); hl.classed("area",lake);
  $("answer").value=""; $("answer").disabled=false; $("feedback").textContent=""; $("feedback").className="feedback";
  $("hint").disabled=false; $("skip").disabled=false;
  glow.datum(cur.geom).attr("d",path).style("display",sea?"none":null);
  hl.datum(cur.geom).attr("d",path).style("display",sea?"none":null);
  seaHl.datum(cur.geom).attr("d",path).style("display",sea?null:"none");
  focus(cur); setTimeout(()=>$("answer").focus(),50);
}
function names(r){ return [r.name,...r.alts]; }
function label(r,cap){ const art=r.article||r.cat.article; return (cap?art[0].toUpperCase()+art.slice(1):art)+" <b>"+r.name+"</b>"; }
function nextClick(){
  $("progress").textContent=(i+1)+" / "+qs.length; $("score").textContent=score;
  $("qtext").innerHTML="Wo liegt "+label(cur)+"? <span class=small>("+(cur.noun||cur.cat.noun)+")</span>";
  $("feedback").textContent="Klicke auf die Karte."; $("feedback").className="feedback small";
  $("hint").disabled=false; $("skip").disabled=false;
  showTarget(false); hover.style("display","none");
  if(i===0||tries===0) regionView();
}
function clickWrong(hit){
  tries++;
  if(hit){ hover.datum(hit.geom).attr("d",path).attr("class","hover wrong").style("display",null);
    setTimeout(()=>hover.attr("class","hover"),900); }
  if(tries>=3){ showTarget(true); focus(cur); resolve(false,"✘ Leider nicht. Hier liegt "+label(cur)+".","bad",2600); return; }
  $("feedback").innerHTML="✘ "+(hit?"Das ist "+label(hit)+".":"Daneben.")+" Noch "+(3-tries)+" Versuch"+(3-tries>1?"e":"");
  $("feedback").className="feedback bad";
}
let hoverRAF=0;
svg.on("mousemove",e=>{
  if(mode!=="click"||locked||!cur||hoverRAF) return;
  const pt=d3.pointer(e,svg.node());
  hoverRAF=requestAnimationFrame(()=>{ hoverRAF=0; const h=hitItems(pt,gamePool)[0];
    if(h) hover.datum(h.geom).attr("d",path).classed("area",h.kind!=="river").style("display",null); else hover.style("display","none");
    svg.style("cursor",h?"pointer":null); });
});
svg.on("click",e=>{
  if(mode!=="click"||locked||!cur) return;
  const hits=hitItems(d3.pointer(e,svg.node()),gamePool);
  if(hits.includes(cur)){ hover.style("display","none"); showTarget(true); resolve(true,"✔ Richtig: "+label(cur,true),"ok",1300); }
  else clickWrong(hits[0]);
});
window.__geoSelfTest=function(){ // checks that clicking a point on each item hits that item
  const bad=[]; ALL.forEach(it=>{ let pt;
    if(it.kind==="river"){ const l=it._px.reduce((a,b)=>b.length>a.length?b:a); pt=l[Math.floor(l.length/2)]; }
    else { const cen=d3.geoCentroid(it.geom); pt=projection(cen);
      if(!d3.geoContains(it.geom,cen)){ const [x0,y0,x1,y1]=it._bb; outer: for(let s=1;s<=12;s++) for(let u=1;u<s;u++) for(let v=1;v<s;v++){
        const q=[x0+(x1-x0)*u/s,y0+(y1-y0)*v/s], gq=projection.invert(q); if(gq&&d3.geoContains(it.geom,gq)){ pt=q; break outer; } } } }
    const t=d3.zoomTransform(svg.node()); const s=t.apply(pt); const h=hitItems(s,ALL);
    if(!h.includes(it)) bad.push(it.id+":miss"); else if(h[0]!==it) bad.push(it.id+":under:"+h[0].id); });
  return bad;
};
function resolve(correct,msg,cls,delay){
  locked=true; $("answer").disabled=true; $("hint").disabled=true; $("skip").disabled=true;
  $("feedback").innerHTML=msg; $("feedback").className="feedback "+cls;
  itemSel.filter(d=>d.id===cur.id).classed(correct?"done":"missed",true);
  if(correct){ score++;
    for(const m of [40,60]) if(m<goalPct()&&!milestones.has(m)&&score>=Math.ceil(qs.length*m/100)&&qs.length>=5){ milestones.add(m); toast(pick(m===40?MSG40:MSG60)); } }
  else mistakes.push(cur);
  $("score").textContent=score;
  i++; setTimeout(()=>{ if(mode==="click"&&i<qs.length) regionView(600); next(); },delay||(correct?1100:2200));
}
$("form").onsubmit=e=>{
  e.preventDefault(); if(locked) return;
  const v=$("answer").value.trim(); if(!v) return;
  let r=Fuzzy.check(v,names(cur));
  // a typo-match that is exactly another item's name (Rotes vs. Totes Meer) counts as wrong
  if(r.ok&&!r.exact){ const nv=Fuzzy.norm(v); if(ALL.some(o=>o!==cur&&names(o).some(n=>Fuzzy.norm(n)===nv))) r={ok:false}; }
  if(r.ok){
    if(r.exact&&Fuzzy.norm(v)===Fuzzy.norm(cur.name)||r.exact) resolve(true,"✔ Richtig: <b>"+cur.name+"</b>","ok");
    else resolve(true,"✔ Fast richtig geschrieben – <b>"+cur.name+"</b>","typo");
    return;
  }
  tries++;
  const inp=$("answer"); inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake");
  if(tries>=3) resolve(false,"✘ Leider nicht. Das ist: <b>"+cur.name+"</b>.","bad");
  else { $("feedback").textContent="✘ Nicht richtig – noch "+(3-tries)+" Versuch"+(3-tries>1?"e":""); $("feedback").className="feedback bad"; inp.select(); }
};
$("hint").onclick=()=>{
  if(locked) return; hints++;
  if(mode==="click"){ const b=path.bounds(cur.geom), w=b[1][0]-b[0][0], h=b[1][1]-b[0][1], f=hints>1?1.5:4;
    focusBox([[b[0][0]-w*f-20,b[0][1]-h*f-20],[b[1][0]+w*f+20,b[1][1]+h*f+20]],900,0.95,12);
    $("feedback").textContent="💡 Hier in der Nähe ("+(cur.continent==="Welt"?"weltweit":cur.continent)+")"; $("feedback").className="feedback";
    if(hints>=2) $("hint").disabled=true; return; }
  const n=cur.name, shown=Math.min(n.length-1,hints);
  $("feedback").textContent="💡 "+n.slice(0,shown)+n.slice(shown).replace(/[^\s-]/g,"·")+"  ("+(cur.continent==="Welt"?"weltweit":cur.continent)+")";
  $("feedback").className="feedback"; if(shown>=n.length-1) $("hint").disabled=true; $("answer").focus();
};
$("skip").onclick=()=>{ if(locked) return;
  if(mode==="click"){ showTarget(true); focus(cur); resolve(false,"Übersprungen – hier liegt "+label(cur)+".","bad",2600); }
  else resolve(false,"Übersprungen – das ist: <b>"+cur.name+"</b>.","bad"); };
function finish(){
  glow.style("display","none"); hl.style("display","none"); seaHl.style("display","none"); hover.style("display","none");
  svg.transition().duration(900).call(zoom.transform,d3.zoomIdentity);
  const pct=Math.round(100*score/qs.length);
  $("respct").textContent=pct+" %";
  const ok=pct>=goalPct(), need=Math.ceil(qs.length*goalPct()/100)-score;
  $("result").classList.toggle("passed",ok); $("result").classList.toggle("failed",!ok);
  if(ok){
    $("restitle").textContent=(pct===100?"Perfekt! 🏆":"Ziel erreicht! 🎉");
    $("resdetail").innerHTML=score+" von "+qs.length+" richtig – Zielquote "+goalPct()+" % geschafft.<br><b>"+pick(PRAISE)+"</b>";
    $("again").textContent="Neue Runde"; $("menu").hidden=false;
  } else {
    $("restitle").textContent="Zielquote "+goalPct()+" % noch nicht erreicht";
    $("resdetail").innerHTML=score+" von "+qs.length+" richtig – dir "+(need===1?"fehlte nur <b>1</b> richtige Antwort":"fehlten <b>"+need+"</b> richtige Antworten")+".<br>"+
      (pct>=60?"Fast geschafft – noch eine Runde, dann klappt's!":pct>=40?"Gute Grundlage! Mit der Wiederholung wirst du sicherer.":"Jede Runde bringt dich weiter – die Fragen kommen gleich nochmal.")+
      "<br><span class=small>Der Test wird mit denselben Fragen wiederholt.</span>";
    $("again").textContent="Test wiederholen"; $("menu").hidden=true;
  }
  $("mistakes").innerHTML=mistakes.length?"<b>Nicht erkannt:</b><ul>"+mistakes.map(r=>"<li>"+r.name+" <span class=small>("+(r.noun||r.cat.noun)+(r.continent!=="Welt"?", "+r.continent:"")+")</span></li>").join("")+"</ul>":"";
  show("result");
}
// test switches (?autostart, ?selftest, ?item=…) only work locally, not on the published site
const LOCAL=location.protocol==="file:"||/^(127\.0\.0\.1|localhost)$/.test(location.hostname);
const QP=new URLSearchParams(LOCAL?location.search:"");
if(QP.get("goal")){ goal=QP.get("goal")+" %"; chips($("goals"),GOALS,()=>goal,v=>goal=v); }
if(QP.has("finishtest")) setTimeout(()=>{ score=+QP.get("finishtest"); i=qs.length; finish(); },1500);
if(QP.has("toasttest")) setTimeout(()=>toast(MSG60[0]),1500);
if(QP.get("level")){ level=QP.get("level"); chips($("levels"),LEVELS,()=>level,v=>level=v); info(); }
if(QP.get("mode")==="click"){ mode="click"; chips($("modes"),MODES,()=>MODES[1],v=>mode=v===MODES[0]?"type":"click"); info(); }
if(QP.has("selftest")) setTimeout(()=>{ const b=window.__geoSelfTest(); document.title="SELFTEST "+b.length+" "+b.join(","); },500);
if(QP.has("clicktest")) setTimeout(()=>{ // click on the right item, then a wrong spot
  const r=svg.node().getBoundingClientRect(), t=d3.zoomTransform(svg.node());
  const fire=(pt)=>svg.node().dispatchEvent(new MouseEvent("click",{bubbles:true,clientX:r.left+pt[0],clientY:r.top+pt[1]}));
  const wrong=QP.get("clicktest")==="wrong";
  fire(wrong?[5,r.height-5]:t.apply(projection(d3.geoCentroid(cur.geom))));
  setTimeout(()=>{ document.title="CLICKTEST score="+score+" fb="+$("feedback").textContent; },200);
},2500);
if(QP.get("cat")){catLabel=QP.get("cat"); chips($("cats"),CATS,()=>catLabel,v=>catLabel=v); info();}
if(QP.has("autostart")) setTimeout(start,300);
$("go").onclick=()=>start(false); $("again").onclick=()=>start(!$("result").classList.contains("passed")); $("menu").onclick=()=>{itemSel.classed("done",false).classed("missed",false);show("start");};
})();
