/* ───────── slide animations: DDIL demo handoff deck ─────────
   One pattern for every slide: elements marked .lat (blocks) and .mk (kit markers) appear in document order.
   Markers on a figure follow the legend rows they belong to. No iso figures in this deck. */
const reveal=(s,{start=.45,gap=.11,mkGap=.09}={})=>{
  const L=[...s.querySelectorAll('.lat')],M=[...s.querySelectorAll('.mk')];
  const tl=L.map((e,i)=>[e,start+i*gap]),tm=M.map((e,i)=>[e,start+.3+i*mkGap]);
  return t=>{tl.forEach(([e,at])=>e.classList.toggle('on',t>=at));tm.forEach(([e,at])=>e.classList.toggle('on',t>=at));};};
slides.forEach(s=>{const k=s.dataset.fx;if(k&&!FX[k])FX[k]=reveal;});
