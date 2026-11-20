/* ───────── slide animations: DDIL demo kit deck ───────── */
/* step captions: step k starts at T[k]; onStep(k) sets the figure state for that step */
const seqCap=(capId,T,caps,onStep)=>{let last=-2;
  return t=>{let k=-1;T.forEach((x,i)=>{if(t>=x)k=i;});if(k!==last){last=k;onStep(k);const c=caps[Math.max(k,0)];
    $(capId).innerHTML=k<0?'':`<div style="display:flex;gap:6px;margin-bottom:8px">${caps.map((_,i)=>`<i style="display:block;width:34px;height:4px;background:${i<=k?'var(--blue)':'var(--line)'}"></i>`).join('')}</div><div style="font:600 12px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--blue)">Step ${k+1} of ${caps.length} · ${c[0]}</div><div style="font-size:15.5px;line-height:1.45;color:var(--char);margin-top:6px;max-width:1110px">${c[1]}</div>`;}};};
const STEPS=(n,g=2.4)=>Array.from({length:n},(_,i)=>.3+i*g);
const cls=(id,c,v)=>$(id).classList.toggle(c,v);

FX.cover=s=>t=>on('cvfig',t>.5);
FX.close=s=>t=>on('clfig',t>.3);
const shotDiv=k=>s=>t=>{on('dv'+k,t>.5);on('dc'+k,t>1.1);};
FX.vdiv=shotDiv('vin');FX.sdiv=shotDiv('sec');FX.mdiv=shotDiv('mm');

/* 2 · four ways the link fails, drawn live */
FX.ddil=s=>{const L=[['Disconnected','No link at all. The team works on its own.'],['Denied','Someone jams or blocks the link.'],['Intermittent','The link drops and returns without warning.'],['Limited','A link exists, but it is thin and slow.']];
  $('dl').innerHTML=L.map((l,i)=>`<div class="dlane" id="dln${i}"><div class="w"><b>${l[0][0]}</b>${l[0].slice(1)}<small>${l[1]}</small></div><canvas id="dcv${i}" width="1772" height="160"></canvas></div>`).join('');
  const G=L.map((_,i)=>{const c=$('dcv'+i),g=c.getContext('2d');g.setTransform(2,0,0,2,0,0);return g;}),W=886,H=80,y=40,x0=70,x1=W-70;
  const end=(g,x,lab,col)=>{g.fillStyle=col;g.fillRect(x-7,y-7,14,14);g.font="600 10px 'IBM Plex Mono'";g.fillStyle=C.grey;g.textAlign='center';g.fillText(lab,x,y+26);};
  return t=>{L.forEach((_,i)=>on('dln'+i,t>.4+i*.35));on('dcap',t>2.4);
    G.forEach((g,i)=>{g.clearRect(0,0,W,H);const a=ease((t-.6-i*.35)/.8);if(a<=0)return;g.globalAlpha=a;
      end(g,x0,'THE KIT',C.blue);end(g,x1,'REACH-BACK',C.gl);
      const mid=(x0+x1)/2;g.lineWidth=2;
      if(i===0){g.strokeStyle=C.line;g.beginPath();g.moveTo(x0+10,y);g.lineTo(mid-40,y);g.moveTo(mid+40,y);g.lineTo(x1-10,y);g.stroke();
        g.strokeStyle=C.pink;g.lineWidth=3;g.beginPath();g.moveTo(mid-10,y-10);g.lineTo(mid+10,y+10);g.moveTo(mid+10,y-10);g.lineTo(mid-10,y+10);g.stroke();
        for(let k=0;k<3;k++){const p=((t*.35+k/3)%1);const x=x0+12+p*(mid-52-x0);g.fillStyle=C.blue;g.globalAlpha=a*(1-p*.6);g.fillRect(x-4,y-4,8,8);}g.globalAlpha=a;}
      if(i===1){g.strokeStyle=C.line;g.beginPath();g.moveTo(x0+10,y);g.lineTo(x1-10,y);g.stroke();g.strokeStyle=C.pink;g.lineWidth=1.4;g.beginPath();
        for(let x=mid-150;x<=mid+150;x+=3){const n=Math.sin(x*.21+t*19)*Math.sin(x*.05+t*7)*16;x===mid-150?g.moveTo(x,y+n):g.lineTo(x,y+n);}g.stroke();
        for(let k=0;k<3;k++){const p=((t*.35+k/3)%1);const x=x0+12+p*(mid-160-x0);g.fillStyle=C.blue;g.fillRect(x-4,y-4,8,8);}}
      if(i===2){const up=Math.sin(t*2.2)>-.1;g.strokeStyle=up?C.teal:C.line;g.setLineDash(up?[]:[4,6]);g.beginPath();g.moveTo(x0+10,y);g.lineTo(x1-10,y);g.stroke();g.setLineDash([]);
        g.font="600 10px 'IBM Plex Mono'";g.textAlign='center';g.fillStyle=up?C.teal:C.pink;g.fillText(up?'LINK UP':'LINK DOWN',mid,y-12);
        if(up)for(let k=0;k<4;k++){const p=((t*.3+k/4)%1);g.fillStyle=C.blue;g.fillRect(x0+12+p*(x1-x0-24)-4,y-4,8,8);}}
      if(i===3){g.strokeStyle=C.sl;g.lineWidth=.8;g.beginPath();g.moveTo(x0+10,y);g.lineTo(x1-10,y);g.stroke();
        const p=((t*.07)%1);g.fillStyle=C.blue;g.fillRect(x0+12+p*(x1-x0-24)-2.5,y-2.5,5,5);
        g.font="600 10px 'IBM Plex Mono'";g.textAlign='center';g.fillStyle=C.grey;g.fillText('ONE PACKET AT A TIME',mid,y-12);}
      g.globalAlpha=1;});};};

/* 3 · requirements, each answered by what the kit uses */
FX.needs=s=>{const R=[['Models','The model runs on the box','NVIDIA Nemotron 3.5 Lightning in Ollama on the Spark. Jina Embeddings v5 Omni on port 8081.'],
  ['Data','The data lives on the box','One Elasticsearch cluster, <code>ddil-vineyard</code>, across the Spark and the Framework.'],
  ['Retrieval','Search is local','BM25, kNN, hybrid RRF and ES|QL against local indices. GPU vector indexing on the Spark node.'],
  ['Agents','Agents call local tools','Kibana Agent Builder with the <code>finance-ollama-llm</code> connector pointed at Ollama on the Spark.'],
  ['Access','Answers respect clearance','Clearance, compartment and NOFORN rules applied to every query in the backend. Application side.'],
  ['Names','Names resolve on the LAN','<code>es.ddil</code>, <code>ollama.ddil</code>, <code>jina.ddil</code>, <code>kibana.ddil</code>. Added in the latest commit, not yet verified on the box.']];
  $('nd').innerHTML=R.map((r,i)=>`<div class="req" id="rq${i}"><div class="k"><i>&#10003;</i>${r[0]}</div><div class="h">${r[1]}</div><div class="x">${r[2]}</div></div>`).join('');
  return t=>{R.forEach((_,i)=>{on('rq'+i,t>.4+i*.3);cls('rq'+i,'ok',t>2.6+i*.3);});on('ncut',t>4.8);};};

/* 4 · the kit, piece by piece */
/* markers sit on the setup-guide rendering at the hotspot positions in setup/src/hotspots.json (front set, % of the image box) */
FX.kit=s=>{const P=[['F1',20,6,'Frame and handles','10 in mini rack, travels in a Pelican Air 1615'],['F2',34,26,'Touchscreen panel','1280x400 · kiosk app :3100'],
    ['F3',50,42,'Framework Desktop','192.168.1.10 · behind blank panels'],['F4',50,58,'DGX Spark','192.168.1.20 · GB10 · 128 GB'],['F5',27.5,69,'JetKVM','remote console'],
    ['F6',57,68,'UniFi Express 7','192.168.1.1 · gateway'],['F7',59.5,76.5,'Switch Flex Mini','5-port GbE'],['F8',29.5,86.5,'PDU','kit master power switch']];
  const G=[[0,7],[3],[2],[5,6,4],[1]];
  $('kmk').innerHTML=P.map((p,i)=>`<i class="kmk" id="km${i}" style="left:${p[1]}%;top:${p[2]}%">${i+1}</i>`).join('');
  $('klg').innerHTML=P.map((p,i)=>`<div class="klr" id="kl${i}"><i>${String(i+1).padStart(2,'0')}</i><div><b>${p[3]}</b><span>${p[4]}</span></div></div>`).join('');
  /* the rendering is drawn with object-fit:contain; pin the marker layer to the drawn image box */
  const im=$('kfig').querySelector('img'),fit=()=>{const f=$('kfig'),W=f.clientWidth,H=f.clientHeight,r=1122/1402,w=Math.min(W,H*r),h=w/r;Object.assign($('kmk').style,{left:(W-w)/2+'px',top:(H-h)/2+'px',width:w+'px',height:h+'px',right:'auto',bottom:'auto'});};fit();
  return seqCap('kitc',STEPS(5),[
  ['The kit','A 10 in mini rack holds the whole kit: two compute nodes, a gateway, a switch, a PDU and a touchscreen panel. It travels in a Pelican Air 1615 case.'],
  ['DGX Spark · 192.168.1.20','GB10 Blackwell, 128 GB unified memory, aarch64. It runs the GPU Elasticsearch node, Ollama and the Jina embedding server.'],
  ['Framework Desktop · 192.168.1.10','Ryzen AI Max+ 395, 64 GB, x86_64, behind the blank panels. It runs the CPU Elasticsearch node, Kibana, the backend and the frontend, all in Docker.'],
  ['The network','UniFi Express 7 is the gateway at 192.168.1.1 and a Switch Flex Mini carries the wired ports. A JetKVM gives a remote console. Services resolve by .ddil names on the kit LAN.'],
  ['The touchscreen','A separate kiosk app on port 3100 shows branding and system health. Its health view is mock data until the MOCK flag is set to false.']],
  k=>{const seen=G.slice(0,k+1).flat(),hot=k<0?[]:G[k];P.forEach((_,i)=>{const v=seen.includes(i),h=hot.includes(i);on('km'+i,v);cls('km'+i,'hot',h);on('kl'+i,v);cls('kl'+i,'hot',h);});});};

/* 5 · architecture */
FX.arch=s=>{const T=(id,x,y,w,h,c,b,em,sm)=>`<div class="atl lat" id="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;--c:${c}"><b>${b}</b><em>${em}</em><small>${sm}</small></div>`;
  $('arx').innerHTML=`<div class="ahd sp lat" id="ah0" style="left:0;width:520px"><b>DGX Spark</b><span>192.168.1.20 · aarch64 · GB10 GPU · 128 GB unified</span></div>`+
    `<div class="ahd fw lat" id="ah1" style="left:616px;width:520px"><b>Framework Desktop</b><span>192.168.1.10 · x86_64 · Ryzen AI Max+ 395 · 64 GB</span></div>`+
    `<div class="acl lat" id="acl"><span class="lb">One Elasticsearch cluster · ddil-vineyard</span><div class="xp">:9300<br>transport</div></div>`+
    T('ae0',16,92,488,68,'var(--blue)','es-gpu · node spark-gpu',':9200','Elasticsearch 9.5.6 + cuVS · accel=gpu · GPU vector indexing')+
    T('ae1',632,92,488,68,'var(--blue)','es-cpu · node framework-cpu',':9200','Elasticsearch 9.5.6 · accel=cpu · ML role')+
    T('as0',0,194,254,126,'#1D2A5A','Ollama',':11434','Nemotron 3.5 Lightning<br>NVIDIA NeMo LLM<br>native, under systemd')+
    T('as1',266,194,254,126,'var(--teal)','Jina v5 Omni server',':8081','Jina Embeddings v5 Omni<br>text and image embeddings<br>started by hand')+
    T('af0',616,194,254,58,'var(--pink)','Kibana 9.5.6',':5601','Agent Builder')+T('af1',882,194,254,58,'var(--ink)','Backend',':8000','FastAPI · three adventures')+
    T('af2',616,262,254,58,'var(--ink)','Frontend',':3000','React · Vite')+T('af3',882,262,254,58,'var(--grey-l)','Kiosk',':3100','touchscreen app')+
    `<i class="avl lat" id="av0" style="left:259px"></i><i class="avl lat" id="av1" style="left:875px"></i>`+
    `<div class="anet lat" id="anet"><span class="k">Kit LAN</span><span><b>UniFi Express 7</b> · 192.168.1.1 · gateway, DHCP, Wi-Fi</span><span><b>Switch Flex Mini</b> · 5-port GbE · links the gateway and both hosts</span></div>`;
  const G=[['ah0','ah1','anet','av0','av1'],['acl','ae0','ae1'],['as0','as1'],['af0','af1','af2','af3']];
  return seqCap('archc',STEPS(4),[
  ['Two hosts','The DGX Spark is aarch64 with the GPU. The Framework is x86_64. Both sit on the same switch.'],
  ['One cluster','One Elasticsearch cluster, ddil-vineyard, seeded at each other\'s port 9300. Nodes carry accel=gpu or accel=cpu. The ML role sits on the x86 node so ELSER can allocate there.'],
  ['Inference on the Spark','Ollama serves Nemotron 3.5 Lightning on port 11434. Jina Embeddings v5 Omni answers on 8081. No request goes to a hosted model.'],
  ['Kibana and the apps','Kibana and Agent Builder on 5601, the FastAPI backend on 8000 for all three adventures, the React frontend on 3000. Both Elasticsearch nodes and Kibana run 9.5.6.']],
  k=>G.forEach((g,i)=>g.forEach(id=>on(id,i<=k))));};

/* 6 · the three demos at a glance */
FX.demos=s=>t=>{[0,1,2].forEach(i=>on('dm'+i,t>.4+i*.45));on('dmcap',t>2);};

/* 8 · estate map (schematic) and the indices filling up */
FX.estate=s=>{const IX=[['vineyard-soil',841536,'8-d reading_vector','var(--blue)'],['vineyard-imagery',17151,'768-d in the mapping · not loaded by the bulk script','#9DC7FF'],
    ['vineyard-npk',10032,'7-d npk_vector','var(--teal)'],['vineyard-harvest',175,'structured','#FEC514'],['vineyard-wine',106,'structured','var(--pink)']];
  $('eix').innerHTML=IX.map((r,i)=>`<div class="eix lat" id="ex${i}" style="--c:${r[3]}"><div class="ezh"><b>${r[0]}</b><em>${r[1].toLocaleString('en-US')}</em></div><div class="ezx">${r[2]}</div><div class="ezb"><i id="exb${i}"></i></div></div>`).join('');
  const B=[['A','Les Pierres','Cabernet Sauvignon',4.2,'#48EFCF','healthy'],['B','Clos du Vent','Syrah',3.8,'#9DC7FF','drought watch'],['C','La Rivière','Merlot',5.1,'#FF957D','critical'],
    ['D','Le Jardin','Chardonnay',3.5,'#FEC514','disease risk'],['E','Vieilles Vignes','Cabernet Franc',2.8,'#48EFCF','healthy'],['F','Le Plateau','Riesling',2.2,'#48EFCF','healthy']];
  const poly=[[[18,20],[118,14],[124,112],[22,120]],[[128,14],[218,18],[214,104],[132,110]],[[226,18],[318,26],[312,150],[220,138]],[[22,128],[124,122],[128,232],[26,240]],[[132,118],[214,112],[218,206],[136,214]],[[220,146],[312,158],[306,238],[224,232]]];
  const sv=$('emsvg');let h='<rect width="560" height="384" fill="#F3F5F2"/>';for(let i=0;i<14;i++)h+=`<path d="M${-40+i*45} 384 L${40+i*45} 0" stroke="#E3E8E1" stroke-width="1"/>`;
  h+=`<g transform="translate(6,20)">`+B.map((b,i)=>`<g id="eb${i}" style="opacity:0;transition:opacity .4s"><polygon points="${poly[i].map(p=>p.join(',')).join(' ')}" fill="${b[4]}" fill-opacity=".55" stroke="${i===2?'#E5533A':'#1D1E24'}" stroke-width="${i===2?3:1}"/>`+
    `<text x="${(poly[i][0][0]+poly[i][2][0])/2}" y="${(poly[i][0][1]+poly[i][2][1])/2-4}" text-anchor="middle" style="font:600 11px 'IBM Plex Mono'" fill="#1D1E24">BLK-${b[0]}</text><text x="${(poly[i][0][0]+poly[i][2][0])/2}" y="${(poly[i][0][1]+poly[i][2][1])/2+11}" text-anchor="middle" style="font:500 10px Inter" fill="#343741">${b[1]}</text></g>`).join('')+
    `<circle id="epul" cx="272" cy="84" r="16" fill="none" stroke="#E5533A" stroke-width="2"/></g>`;
  h+=`<g transform="translate(16,286)">`+[['#48EFCF','Healthy'],['#9DC7FF','Watch'],['#FEC514','Warning'],['#FF957D','Critical']].map((l,i)=>`<rect x="${i*76}" y="0" width="10" height="10" fill="${l[0]}"/><text x="${i*76+15}" y="9" style="font:500 10px 'IBM Plex Mono'" fill="#69707D">${l[1]}</text>`).join('')+
    `<text x="0" y="34" style="font:500 10px 'IBM Plex Mono'" fill="#98A2B3">Schematic. Block shapes are not to scale.</text><text x="0" y="50" style="font:500 10px 'IBM Plex Mono'" fill="#98A2B3">Walla Walla AVA · 46.0150, -118.3800 · offline tiles</text></g>`;
  h+=`<g id="edet" style="opacity:0;transition:opacity .5s"><rect x="340" y="14" width="208" height="356" fill="#fff" stroke="#1D1E24"/><text x="354" y="38" style="font:600 10px 'IBM Plex Mono'" fill="#E5533A" letter-spacing=".08em">BLK-C · CRITICAL</text><text x="354" y="60" style="font:600 18px Inter" fill="#1D1E24">La Rivière</text>`+
    [['Variety','Merlot'],['Acres','5.1'],['Elevation','245 m · E'],['Soil','Alluvial clay'],['Story','Declining since 2022']].map((r,i)=>`<text x="354" y="${88+i*20}" style="font:500 10px 'IBM Plex Mono'" fill="#69707D">${r[0].toUpperCase()}</text><text x="440" y="${88+i*20}" style="font:500 11.5px Inter" fill="#343741">${r[1]}</text>`).join('')+
    `<line x1="354" x2="534" y1="${88+5*20-4}" y2="${88+5*20-4}" stroke="#D3DAE6"/><text x="354" y="${212}" style="font:600 10px 'IBM Plex Mono'" fill="#69707D">ALERTS (STAGED IN UI)</text>`+
    [['#E5533A','Potassium depletion','K 210 to 50 since mid-2022'],['#FEC514','Persistent high moisture','15 % above normal, 18 months']].map((a,i)=>`<rect x="354" y="${222+i*44}" width="4" height="34" fill="${a[0]}"/><text x="364" y="${236+i*44}" style="font:600 12px Inter" fill="#1D1E24">${a[1]}</text><text x="364" y="${251+i*44}" style="font:500 10px 'IBM Plex Mono'" fill="#69707D">${a[2]}</text>`).join('')+
    `<rect id="ebtn" x="354" y="318" width="180" height="36" fill="#0B64DD"/><text x="444" y="341" text-anchor="middle" style="font:600 12.5px Inter" fill="#fff">Investigate with AI &#8594;</text></g>`;
  sv.innerHTML=h;
  return t=>{IX.forEach((r,i)=>{const v=t>.9+i*.35;on('ex'+i,v);$('exb'+i).style.width=v?(Math.log10(r[1])/6*100)+'%':'0';});on('emap',t>.2);B.forEach((_,i)=>$('eb'+i).style.opacity=t>.5+i*.15?1:0);const k=(t*1.2)%1;$('epul').setAttribute('r',16+k*26);$('epul').setAttribute('opacity',t>1.6?(1-k):0);
    $('edet').style.opacity=t>2.2?1:0;on('ecap',t>4);};};

/* 9 · the five-phase agronomist */
FX.agro=s=>{const Q='Analyze the current status of block BLK-C and recommend actions';
  const P=[['Sensor Snapshot','sensors · latest soil and NPK docs for the block','ES'],['Historical Context','historical · kNN k=5 on reading_vector, block filter','ES + LLM'],
    ['Risk Analysis','risk · JSON from sensors, history and the question','LLM'],['Crop Recommendation','recommendation · variety-aware, Merlot for BLK-C','LLM'],['Action Plan','action_plan · tasks, assignee, deadline, cost','LLM']];
  $('aph').innerHTML=P.map((p,i)=>`<div class="ph" id="ap${i}"><span class="dot">${i}</span><div class="h">${p[0]}<small>${p[1]}</small></div><span class="t${p[2]==='ES'?'':' llm'}">${p[2]}</span></div>`).join('');
  const R=[['Phase 0','Reads Elasticsearch directly on the GPU node. No model call.'],['Phase 1','8-d query vector from moisture and temperature, kNN k=5 with 100 candidates.'],['Model','Four sequential calls to Nemotron 3.5 Lightning through Ollama. Temperature 0.1, 120 s timeout each.'],['Transport','Server-sent events from the FastAPI backend. Heartbeats every 3 s while the model works.'],['Grounding','Start from the map or an Investigate button. Typed questions send no block id.']];
  $('ar').innerHTML=`<div class="card lat" id="arc"><div class="ch">How it runs <b>chat.py</b></div><div style="padding:6px 16px 10px">${R.map(r=>`<div class="kv"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}</div></div>`+
    `<div class="bal lat" id="arb" style="margin-top:16px;box-shadow:none;padding:10px 14px"><div class="k">Say it straight</div><div class="x" style="font:500 13px/1.45 var(--sans);color:var(--char);margin-top:4px">This pipeline is Python plus Ollama. It does not call Agent Builder, whatever the chooser card says. Agent Builder is live in the SEC adventure.</div></div>`;
  const T0=1.9,D=1.35;
  return t=>{on('aw',t>.2);on('arc',t>1);on('arb',t>8.6);const n=Math.max(0,Math.min(Q.length,Math.floor((t-.5)*40)));$('aqt').textContent=Q.slice(0,n);
    let log=[];P.forEach((p,i)=>{const a=T0+i*D,b=a+D*.85;on('ap'+i,t>a);cls('ap'+i,'run',t>a&&t<b);cls('ap'+i,'done',t>=b);if(t>a)log.push(`<span class="m">phase</span> ${p[1].split(' ')[0]} · running`);if(t>=b)log.push(`<span class="m">phase</span> ${p[1].split(' ')[0]} · <span class="g">complete</span>`);});
    if(t>T0+5*D)log.push('<span class="g">job_complete</span> · model nemotron-3.5-lightning · phases_completed 5');$('asse').innerHTML=log.slice(-3).join('\n');};};

/* 10 · the staged race */
FX.race=s=>{const N=841536,L=[['GPU HNSW · cuVS','es-gpu · spark-gpu',15,'var(--blue)'],['CPU HNSW','es-cpu · framework-cpu',55,'var(--grey-l)']];
  $('rl').innerHTML=`<div style="font:600 11px var(--mono);letter-spacing:.08em;color:var(--grey);text-transform:uppercase">Simulated clock · <span id="rclk">0</span> s of 55</div>`+
    L.map((l,i)=>`<div style="margin-top:22px"><div style="display:flex;align-items:baseline;gap:10px"><b style="font:600 20px var(--sans);letter-spacing:-.4px">${l[0]}</b><span style="font:500 11px var(--mono);color:var(--grey)">${l[1]}</span><span id="rs${i}" style="margin-left:auto;font:600 11px var(--mono);color:var(--grey)">RUNNING</span></div>`+
      `<div style="height:30px;background:#E9EDF3;margin-top:10px;position:relative"><i id="rb${i}" style="position:absolute;left:0;top:0;bottom:0;width:0;background:${l[3]}"></i></div><div style="display:flex;justify-content:space-between;margin-top:6px;font:500 12px var(--mono);color:var(--char)"><span><span id="rn${i}">0</span> / 841,536 docs</span><span>scripted finish: ${l[2]} s</span></div></div>`).join('')+
    `<div style="margin-top:34px;border-top:1px solid var(--line);padding-top:12px;font:500 11.5px/1.6 var(--mono);color:var(--grey)">Progress rises linearly to a scripted finish time. The live screen also shows throughput, merge time and recall; those are simulated too, so they are left off this slide.</div>`;
  const K=[['Touches ES','Never. run_race ignores the index name and data file.'],['Durations','Constants in indexer.py: 15 s and 55 s.'],['Throughput','On screen it is a target times a ramp times noise.'],['Recall','Hardcoded with a note that says computed post-race.']];
  $('rr').innerHTML=`<div class="card lat" id="rc1"><div class="ch">What the simulator does <b>indexer.py</b></div><div style="padding:6px 16px 10px">${K.map(r=>`<div class="kv"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}</div></div>`+
    `<div class="card lat" id="rc2" style="margin-top:16px"><div class="ch">What is real <b>es-gpu image</b></div><div style="padding:6px 16px 10px"><div class="kv"><b>cuVS</b><span>aarch64 cuVS Java jar in the 9.5.6 image</span></div><div class="kv"><b>Setting</b><span>vectors.indexing.use_gpu=true on spark-gpu</span></div></div></div>`;
  return t=>{on('rst',t>.3);on('rw',t>.3);on('rc1',t>1.2);on('rc2',t>2.2);const sim=Math.max(0,Math.min(55,(t-1)*5.5));$('rclk').textContent=Math.floor(sim);
    L.forEach((l,i)=>{const p=Math.min(1,sim/l[2]);$('rb'+i).style.width=(p*100)+'%';$('rn'+i).textContent=Math.round(N*p).toLocaleString('en-US');const d=p>=1;$('rs'+i).textContent=d?'COMPLETE':'RUNNING';$('rs'+i).style.color=d?'var(--teal)':'var(--grey)';});};};

/* 12 · SEC semantic search */
FX.secs=s=>{const Q='AI model risk and governance disclosures';
  $('schips').innerHTML=['Commercial real estate exposure','Climate-related transition risk','Cybersecurity incident response'].map(c=>`<span class="chp">${c}</span>`).join('');
  $('sres').innerHTML=Array.from({length:5},(_,i)=>`<div class="skr" id="sk${i}"><span class="tk">TICKER</span><div><div class="bar"></div><div class="bar"></div></div><span class="scr">_score</span></div>`).join('');
  $('smeta').innerHTML=['took_ms · measured','hits · measured','embed_dims · 768'].map(m=>`<span class="mtag">${m}</span>`).join('')+'<span style="font:500 11px var(--mono);color:var(--grey);align-self:center">Rows are placeholders. On the kit they are live hits.</span>';
  $('scode').innerHTML=`<div class="code3"><span class="c">// the query, as the screen shows it</span>
<span class="k">POST</span> sec_10k_2026/_search
{
  <span class="s">"knn"</span>: {
    <span class="s">"field"</span>: <span class="g">"emb"</span>,
    <span class="s">"query_vector"</span>: [ <span class="c">768 floats, Jina v5 Omni</span> ],
    <span class="s">"k"</span>: 8,
    <span class="s">"num_candidates"</span>: 80,
    <span class="s">"filter"</span>: <span class="c">optional sector filter</span>
  }
}</div><div class="card" style="margin-top:16px"><div style="padding:6px 16px 10px">
<div class="kv"><b>Index</b><span>sec_10k_2026 · 768-d cosine HNSW</span></div><div class="kv"><b>Embedder</b><span>Jina Embeddings v5 Omni on the Spark, port 8081</span></div>
<div class="kv"><b>Stated</b><span>503 filings and 93,541 chunks in UI text and the agent prompt. Not a live count.</span></div><div class="kv"><b>Check</b><span>Index re-embedded at 768-d on the kit; backend reports embed_backend jina.</span></div></div></div>`;
  return t=>{on('sw',t>.2);const n=Math.max(0,Math.min(Q.length,Math.floor((t-.6)*30)));$('sq').textContent=Q.slice(0,n);
    for(let i=0;i<5;i++)on('sk'+i,t>2.2+i*.18);on('smeta',t>3.3);on('scode',t>2.6);};};

/* 13 · SEC agentic */
FX.seca=s=>{const C1=[['Agent','finance-analyst · Financial Filings Analyst'],['Connector','finance-ollama-llm · .gen-ai to Nemotron 3.5 Lightning on the Spark'],['Custom tools','finance.company_disclosures · finance.compare_companies · finance.sector_breakdown'],['Platform','search · execute_esql · generate_esql · get_document_by_id · get_index_mapping · list_indices · index_explorer'],['Rules','At most 6 tool calls. Cite ticker and accession.']];
  $('acl').innerHTML=C1.map(r=>`<div class="kv" style="grid-template-columns:86px 1fr;font-size:12.5px"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('');
  const T=[['var(--ink)','Analyst','Across the S&amp;P 500, which sector has the most filings citing supply-chain disruption?'],['#6B4FD8','Reasoning','The question asks for a count by sector, so passages alone will not answer it.'],
    ['var(--pink)','Tool call · finance.sector_breakdown','<span style="color:var(--ink)">FROM sec_10k_2026 | WHERE MATCH(text, ?topic)<br>| STATS filings = COUNT_DISTINCT(accession) BY sector</span><br>topic = "supply-chain disruption"'],
    ['var(--teal)','Result','One row per sector with a distinct filing count, computed by ES|QL on the box.'],['var(--blue)','Answer','Ranks the sectors and cites ticker and accession for the filings it quotes. Streamed back to the screen.']];
  $('atl').innerHTML=T.map((r,i)=>`<div class="tl" id="tl${i}"><i style="background:${r[0]}"></i><div><div class="h">${r[1]}</div><div class="x">${r[2]}</div></div></div>`).join('')+
    `<div class="lat" id="tlx" style="margin-top:8px;border-top:1px solid var(--line);padding-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:12px;line-height:1.4;color:var(--char)"><div><b style="font:600 10.5px var(--mono);letter-spacing:.06em;color:var(--blue)">SEMANTIC RAG</b><br>One query, one kNN search, passages to the model.</div><div><b style="font:600 10.5px var(--mono);letter-spacing:.06em;color:var(--pink)">AGENTIC RAG</b><br>The agent picks tools and parameters, reads results, and decides on the next call.</div></div>`;
  return t=>{on('acfg',t>.3);on('aconv',t>.6);T.forEach((_,i)=>on('tl'+i,t>1.2+i*1.1));on('tlx',t>7);};};

/* 15 · text to image */
FX.mms=s=>{const Q='a red square';const sq=(c,shape,r=0)=>{const S={sq:`<rect x="22" y="12" width="46" height="46" fill="${c}" transform="rotate(${r} 45 35)"/>`,ci:`<circle cx="45" cy="35" r="24" fill="${c}"/>`,tr:`<polygon points="45,10 70,58 20,58" fill="${c}"/>`,st:[0,1,2,3].map(k=>`<rect x="18" y="${14+k*12}" width="54" height="6" fill="${c}"/>`).join('')};return `<svg viewBox="0 0 90 70" style="width:64%">${S[shape]}</svg>`;};
  const A=[['#E5533A','sq'],['#E5533A','sq',20],['#FF957D','sq'],['#E5533A','ci'],['#0B64DD','sq'],['#E5533A','tr']];
  $('mgrid').innerHTML=A.map((a,i)=>`<div class="tile${i?'':' top'}" id="mt${i}"><em>${i+1}</em>${sq(a[0],a[1],a[2]||0)}</div>`).join('');
  const R=[['Track','Synthetic shapes, 10 documents'],['Index','jina-multimodal'],['image_vector','768-d, embedded by the Jina server at ingest'],['caption_vector','768-d, embedded inside ES by pipeline jina-embed-caption'],['Query','query_vector_builder with jina-omni-text, k=6'],['Model','Jina Embeddings v5 Omni on the Spark']];
  $('mr').innerHTML=`<div class="card lat" id="mrc"><div class="ch">How it works <b>routers/jina.py</b></div><div style="padding:6px 16px 10px">${R.map(r=>`<div class="kv" style="grid-template-columns:104px 1fr"><b>${r[0]}</b><span>${r[1]}</span></div>`).join('')}</div></div>`;
  return t=>{on('mw',t>.2);on('mrc',t>1.4);on('mcap',t>4);const n=Math.max(0,Math.min(Q.length,Math.floor((t-.6)*14)));$('mq').textContent=Q.slice(0,n);
    A.forEach((_,i)=>on('mt'+i,t>1.9+i*.16));const cap=t>6.5;$('mswe').style.left=cap?'50%':'0';const sp=$('msw').querySelectorAll('span');sp[0].style.color=cap?'var(--ink)':'#fff';sp[1].style.color=cap?'#fff':'var(--ink)';};};

/* 16 · need to know: who sees what */
FX.ntk=s=>{const LV=['U','CUI','C','S','TS'],COL={U:'#9AA5B8',CUI:'#7FB0F5',C:'#0B64DD',S:'#F04E98',TS:'#153385'};
  const PER=[['Public User','U · no compartments · foreign',0,[],false],['Analyst A','SECRET · SI · US',3,['SI'],true],['Analyst B','TS/SCI · HCS · SI · US',4,['SCI','HCS','SI'],true],['Senior Analyst','TS/SCI · HCS · TK · SI · US',4,['SCI','HCS','TK','SI'],true]];
  const r=rand(20261113),D=[];const pick=()=>{const x=r()*100;return x<40?0:x<65?1:x<80?2:x<93?3:4;};
  for(let i=0;i<72;i++){const l=pick();let cp=[];if(l>=3){const pool=['SI','HCS','SCI','TK'],n=Math.floor(r()*(l===3?3:4));for(let k=0;k<n;k++){const c=pool[Math.floor(r()*4)];if(!cp.includes(c))cp.push(c);}}D.push({l,cp,nf:l>=2&&r()<.45});}
  const sees=(p,d)=>d.l<=p[2]&&d.cp.every(c=>p[3].includes(c))&&(!d.nf||p[4]);
  $('ng').innerHTML=D.map((d,i)=>`<div class="dc" id="dc${i}" style="background:${COL[LV[d.l]]};${d.nf?'box-shadow:inset 0 0 0 2px #FEC514':''}">${LV[d.l]}</div>`).join('');
  $('nleg').innerHTML=LV.map(l=>`<span><i style="display:inline-block;width:9px;height:9px;background:${COL[l]};margin-right:5px"></i>${l}</span>`).join('')+`<span><i style="display:inline-block;width:9px;height:9px;box-shadow:inset 0 0 0 2px #FEC514;margin-right:5px"></i>NOFORN</span>`;
  $('np').innerHTML=PER.map((p,i)=>`<div class="pc" id="pp${i}"><div class="n">${p[0]}</div><div class="l">${p[1]}</div></div>`).join('');
  const cnt=PER.map(p=>D.filter(d=>sees(p,d)).length);
  $('nr').innerHTML=`<div class="ac-k" style="margin-bottom:6px">Visible in this grid</div>`+PER.map((p,i)=>`<div class="cbar"><span>${p[0].replace('Analyst','An.')}</span><div class="ctr"><i id="nb${i}" style="width:0"></i></div><b id="nc${i}">&nbsp;</b></div>`).join('')+
    `<div style="margin-top:14px;border-top:1px solid var(--ink);padding-top:8px">${[['1','Classification at or below clearance'],['2','Holds every compartment on the doc'],['3','NOFORN only if NOFORN-cleared']].map(x=>`<div class="kv" style="grid-template-columns:20px 1fr;font-size:12px"><b style="color:var(--blue)">${x[0]}</b><span>${x[1]}</span></div>`).join('')}</div>`;
  let last=-1;
  return t=>{on('nwarn',t>1.2);const n=t<.8?-1:Math.floor((t-.8)/2.2),k=n<0?-1:n%4;if(k!==last){last=k;PER.forEach((_,i)=>on('pp'+i,i===k));
      $('nlab').textContent=k<0?'Signed in as':'Signed in as '+PER[k][0]+' · '+PER[k][1];D.forEach((d,i)=>cls('dc'+i,'off',k>=0&&!sees(PER[k],d)));}
    PER.forEach((_,i)=>{if(n>=i){$('nb'+i).style.width=(cnt[i]/72*100)+'%';$('nc'+i).textContent=cnt[i];}else{$('nb'+i).style.width='0';$('nc'+i).innerHTML='&nbsp;';}});};};

/* 17 · what runs where */
FX.where=s=>{const H=[['DGX Spark','192.168.1.20 · aarch64',[['es-gpu','Elasticsearch 9.5.6 + cuVS',':9200'],['Ollama','Nemotron 3.5 Lightning',':11434'],['Jina v5 Omni server','text and image embeddings',':8081']]],
    ['Framework Desktop','192.168.1.10 · x86_64',[['es-cpu','Elasticsearch 9.5.6',':9200'],['Kibana','Agent Builder · connector to Ollama',':5601'],['Backend','FastAPI · three adventures',':8000'],['Frontend','React · Vite dev server',':3000'],['Kiosk','touchscreen app',':3100']]]];
  let n=0;$('wh').innerHTML=H.map((h,j)=>`<div class="host" id="wh${j}"><div class="hh"><b>${h[0]}</b><span>${h[1]}</span></div>${h[2].map(s=>`<div class="svc" id="sv${n++}"><div>${s[0]}<small>${s[1]}</small></div><em>${s[2]}</em></div>`).join('')}</div>`).join('')+
    `<div><div class="host" id="wh2"><div class="hh"><b>Kit LAN</b><span>UniFi Express 7 · .1</span></div><div style="padding:10px 16px;font:500 12px/1.75 var(--mono);color:var(--char)">spark.ddil · es.ddil<br>ollama.ddil · jina.ddil<br>framework.ddil · kibana.ddil<br><span style="color:var(--grey)">ES transport stays on raw IPs</span></div></div>`+
    `<div class="bal lat" id="wh3" style="margin-top:16px;box-shadow:none;padding:12px 14px"><div class="k">Pre-show check</div><div class="x" style="font:500 12.5px/1.5 var(--sans);color:var(--char);margin-top:4px">All nodes and Kibana on 9.5.6, security settings matched. Kit config points at Nemotron 3.5 Lightning and Jina v5 Omni. Set it in the compose environment; the container never reads .env.</div></div></div>`;
  return t=>{for(let j=0;j<3;j++)on('wh'+j,t>.3+j*.5);for(let i=0;i<n;i++)on('sv'+i,t>1+i*.3);on('wh3',t>4);};};

/* 18 · deployment and operations */
FX.ops=s=>{const O=[['var(--blue)','Bring-up','On each host',['Spark: <code>sg docker -c "docker compose up -d"</code>','Framework: <code>docker compose up -d</code>','Pull <code>nemotron-3.5-lightning</code> in Ollama; no repo script does it','Start the Jina v5 Omni server by hand on :8081','<code>vm.max_map_count=262144</code> on the Framework']],
    ['var(--teal)','Before going dark','While a network exists',['Build backend and frontend images: pip and npm run at build time','Stage the data that is not in git: vineyard JSONL, SEC NDJSON, Jina media','SEC <code>run-all.sh</code>: re-embed, index, connector, agent, Kibana','es-gpu needs <code>ELASTIC_PASSWORD</code> and its transport cert','Give the backend ES credentials in the compose environment']],
    ['var(--pink)','On stage','Reset and recover',['<b>Reset Demo</b> returns to the chooser; the race resets separately','SEC: Reset conversation in chapter 04. Esc exits SEC and Multimodal','<b>F1</b> backend has no ES credentials: 401s, silent fallbacks','<b>Check</b> all nodes and Kibana on 9.5.6, security matched; config on Nemotron 3.5 Lightning and Jina v5 Omni','Never run the guide\'s model unload; it deletes the model']]];
  $('op').innerHTML=O.map((o,i)=>`<div class="dfc2" id="oc${i}" style="--c:${o[0]}"><div class="k">${i+1} · ${o[2]}</div><div class="h">${o[1]}</div><ul>${o[3].map(x=>`<li>${x}</li>`).join('')}</ul></div>`).join('');
  return t=>{O.forEach((_,i)=>on('oc'+i,t>.4+i*.6));};};

/* 20 · appendix: live vs staged */
FX.status=s=>{const S=[['Vineyard Intelligence','click path: chooser, architecture, race, app','Dashboard KPIs and per-block map when ES answers · agronomist phases 0 and 1 on ES · four Nemotron 3.5 Lightning calls','Race (simulator) · architecture and system screens · dashboard alerts · Crop Health scanner · Search hybrid and semantic (fall back to mock) · silent fallbacks when ES fails'],
    ['SEC Findings','eight chapters, Esc exits','Chapter 03 search and sector facets · chapter 04 Agent Builder chat · took_ms, hits, sector counts','Chapter 00 kit hardware text · chapter 01 race and presenter TCO figures · 503 and 93,541 text · workflows chapter (not provisioned)'],
    ['Multimodal and need-to-know','two scenes, Esc exits','Search by Image kNN · need-to-know hybrid search · accessible docs and chunks · analyst answer from Nemotron 3.5 Lightning','509 total in the corpus meter (kit corpus: 198 papers, 9,636 chunks) · personas and markings are a fictional model · the filter is application side']];
  $('stt').innerHTML=`<div class="sth"><div>Adventure</div><div style="color:var(--teal)">Live when the stack is healthy</div><div style="color:var(--pink)">Staged or canned</div></div>`+
    S.map((r,i)=>`<div class="st" id="st${i}"><div class="a">${r[0]}<small>${r[1]}</small></div><div class="lv">${r[2]}</div><div class="sg">${r[3]}</div></div>`).join('')+
    `<div class="bal lat" id="stb" style="margin-top:16px;box-shadow:none;padding:10px 16px"><div class="k">Check first, or nothing above is live</div><div class="x" style="font:500 12.5px/1.5 var(--sans);color:var(--char);margin-top:4px">F1 give the backend container ES credentials · all nodes and Kibana on 9.5.6, security settings matched · kit config on Nemotron 3.5 Lightning and Jina v5 Omni. The .ddil names are not yet verified on the box.</div></div>`;
  return t=>{S.forEach((_,i)=>on('st'+i,t>.4+i*.4));on('stb',t>1.8);};};
