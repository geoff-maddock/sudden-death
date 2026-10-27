/* w2: Realm map builders, ported from Terra Chimera: overworld, towns, dungeons, repair passes, worldProblems */
/* Pure data builders: no DOM. buildAllMaps() fills MAPS deterministically (mulberry seeds). */
const WORLD_VER=3, WW=96, WH=72;
const MAPS={};
/* the energy each region's wells and forage carry (Quill's enchanting) */
const REGION_ELEM={plains:'aether',bloom:'bloom',tide:'tide',ember:'ember',rime:'rime'};
function walkCh(ch){const t=DB.tiles[ch];return!!(t&&t.walk)}
function regionAt(x,y){const m=MAPS.world;return m&&m.region?m.region[y*WW+x]:'plains'}
function bfsReach(map,sx,sy){const seen=new Uint8Array(map.w*map.h),q=[[sx,sy]];seen[sy*map.w+sx]=1;while(q.length){const[x,y]=q.pop();for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=map.w||ny>=map.h)continue;const i=ny*map.w+nx;if(seen[i]||!walkCh(map.t[ny][nx]))continue;seen[i]=1;q.push([nx,ny])}}return seen}
function carvePath(map,ax,ay,bx,by,road){/* dijkstra (binary heap) over everything; turns water into bridges and rock into passes */
 const W=map.w,H=map.h,dist=new Float64Array(W*H).fill(1e9),prev=new Int32Array(W*H).fill(-1),cost=c=>c==='='||c==='b'?0.6:c==='~'?7:c==='^'?9:c==='L'?12:walkCh(c)?1:(DB.tiles[c]&&!DB.tiles[c].walk?40:1);
 const hd=[],hi=[];const push=(d,i)=>{hd.push(d);hi.push(i);let k=hd.length-1;while(k>0){const p=(k-1)>>1;if(hd[p]<=hd[k])break;[hd[p],hd[k]]=[hd[k],hd[p]];[hi[p],hi[k]]=[hi[k],hi[p]];k=p}};
 const pop=()=>{const d=hd[0],i=hi[0],ld=hd.pop(),li=hi.pop();if(hd.length){hd[0]=ld;hi[0]=li;let k=0;for(;;){let l=2*k+1,r=l+1,m=k;if(l<hd.length&&hd[l]<hd[m])m=l;if(r<hd.length&&hd[r]<hd[m])m=r;if(m===k)break;[hd[m],hd[k]]=[hd[k],hd[m]];[hi[m],hi[k]]=[hi[k],hi[m]];k=m}}return[d,i]};
 const target=by*W+bx;push(0,ay*W+ax);dist[ay*W+ax]=0;while(hd.length){const[d,i]=pop();if(d>dist[i])continue;if(i===target)break;const x=i%W,y=i/W|0;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<1||ny<1||nx>=W-1||ny>=H-1)continue;const j=ny*W+nx,nd=d+cost(map.t[ny][nx]);if(nd<dist[j]){dist[j]=nd;prev[j]=i;push(nd,j)}}}
 let i=target,n=0;while(i>=0&&n++<9999){const x=i%W,y=i/W|0,c=map.t[y][x];if(!(DB.tiles[c]&&DB.tiles[c].enter)){if(c==='~'||c==='b')map.t[y][x]='b';else if(road||!walkCh(c))map.t[y][x]='='}i=prev[i]}}
function buildWorld(){const seed=1337+WORLD_VER*101,r=mulberry(seed),nE=noise2(seed+1),nM=noise2(seed+2),nW=noise2(seed+3),t=[],region=[];
 for(let y=0;y<WH;y++){const row=[];for(let x=0;x<WW;x++){const wob=(nW(x,y,10)-.5)*16,nx=x-48+wob,ny=y-36-wob,cd=Math.hypot((x-48)/1.2,y-36);
  let reg=cd<13?'plains':ny<0?(nx<0?'rime':'ember'):(nx<0?'bloom':'tide');region.push(reg);
  const d=Math.hypot((x-48)/46,(y-36)/34)+(nW(x+50,y+50,7)-.5)*.3,e=nE(x,y,7),m=nM(x,y,5);let c;
  if(d>.93)c='~';else switch(reg){
   case'plains':c=e>.8?'^':m>.72?'f':m>.5?'"':'.';break;
   case'bloom':c=e>.8?'^':e<.14?'~':m>.45?'f':m>.3?'"':'.';break;
   case'tide':c=e<.3?'~':e<.37?':':m>.55?'s':m>.4?'"':'.';break;
   case'ember':c=e>.72?'^':e<.2?'L':m>.5?'c':'a';break;
   case'rime':c=e>.76?'^':e<.2?'i':m>.5?'p':'n';break}
  row.push(c)}t.push(row)}
 for(let y=1;y<WH-1;y++)for(let x=1;x<WW-1;x++){const c=t[y][x],rg=region[y*WW+x];if((c==='.'||c==='"'||c==='s')&&rg!=='ember'&&rg!=='rime'&&(t[y][x+1]==='~'||t[y][x-1]==='~'||t[y+1][x]==='~'||t[y-1][x]==='~')&&hash2(x,y,4)<.7)t[y][x]=':'}
 const map={id:'world',name:'The Realm',kind:'world',w:WW,h:WH,t,region,meta:{},npcs:[],light:[]};MAPS.world=map;
 const gOf={plains:'.',bloom:'.',tide:':',ember:'a',rime:'n'};
 for(const L of DB.locs){const g=gOf[region[L.y*WW+L.x]];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)t[L.y+dy][L.x+dx]=g;t[L.y][L.x]=L.tile;map.meta[L.x+','+L.y]={loc:L.id,under:g}}
 const hq=DB.locs.find(l=>l.id==='graftonbury');
 for(const L of DB.locs)if(L!==hq)carvePath(map,hq.x,hq.y+1,L.x,L.y+1,!L.hidden&&(L.kind==='town'||L.kind==='coliseum'));
 /* scatter wells, nests, bushes on reachable open ground */
 let seen=bfsReach(map,hq.x,hq.y+1);const want={V:3,N:2,Y:5},placed=[];
 for(const reg of Object.keys(REGION_ELEM))for(const ch of['V','N','Y']){let n=want[ch],tries=0;while(n>0&&tries++<4000){const x=2+(r()*(WW-4)|0),y=2+(r()*(WH-4)|0);if(region[y*WW+x]!==reg||!seen[y*WW+x])continue;const c=t[y][x];if(c==='='||c==='b'||!DB.tiles[c].ground)continue;let ok=true;for(let dy=-1;dy<=1&&ok;dy++)for(let dx=-1;dx<=1;dx++){const cc=t[y+dy][x+dx];if(!walkCh(cc)||DB.tiles[cc].enter)ok=false}if(!ok||placed.some(p=>Math.abs(p[0]-x)+Math.abs(p[1]-y)<5))continue;map.meta[x+','+y]={elem:REGION_ELEM[reg],under:c};t[y][x]=ch;placed.push([x,y]);n--}}
 /* repair: everything the player needs must be walkable-to from Graftonbury */
 seen=bfsReach(map,hq.x,hq.y+1);for(const L of DB.locs)if(!seen[(L.y+1)*WW+L.x]&&!seen[L.y*WW+L.x]){carvePath(map,hq.x,hq.y+1,L.x,L.y+1,false);seen=bfsReach(map,hq.x,hq.y+1)}
 map.spawn=[hq.x,hq.y+1];return map}
function worldProblems(){const map=MAPS.world,hq=DB.locs.find(l=>l.id==='graftonbury'),seen=bfsReach(map,hq.x,hq.y+1),out=[];for(const L of DB.locs)if(!seen[L.y*WW+L.x]&&![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>seen[(L.y+dy)*WW+L.x+dx]))out.push('cannot walk to '+L.id);for(const k in map.meta){const[x,y]=k.split(',').map(Number);if(map.meta[k].elem&&![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>seen[(y+dy)*WW+x+dx]))out.push('stranded object at '+k)}return out}
function buildTown(def){const w=def.w||30,h=def.h||22,r=mulberry(def.id.length*77+def.id.charCodeAt(0)),t=[],mx=w>>1,my=def.street||(h>>1),gc=def.ground||'.';
 for(let y=0;y<h;y++){const row=[];for(let x=0;x<w;x++)row.push(gc);t.push(row)}
 const map={id:def.id,name:def.name,kind:'town',w,h,t,meta:{},npcs:[],spawn:def.spawn||[mx,h-2],light:[]};
 for(const wr of def.water||[])for(let y=wr[1];y<wr[1]+wr[3];y++)for(let x=wr[0];x<wr[0]+wr[2];x++)if(y>=0&&y<h&&x>=0&&x<w)t[y][x]=wr[4]||'~';
 const paint=(x1,y1,x2,y2,ch)=>{for(let y=Math.min(y1,y2);y<=Math.max(y1,y2);y++)for(let x=Math.min(x1,x2);x<=Math.max(x1,x2);x++)if(y>=0&&y<h&&x>=0&&x<w)t[y][x]=t[y][x]==='~'?'b':ch};
 if(def.streets){for(const st of def.streets)paint(st[0],st[1],st[2],st[3],st[4]||'o')}else if(!def.noStreet){paint(mx,0,mx,h-1,'o');paint(1,my,w-2,my,'o')}
 const isStreet=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&(t[y][x]==='o'||t[y][x]==='b');
 for(const b of def.buildings||[]){const n=b.door==='n';for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++)t[y][x]=(y===b.y||y===b.y+b.h-1||x===b.x||x===b.x+b.w-1)?'#':(b.floor||'_');
  const dx=b.x+(b.w>>1),dy=n?b.y:b.y+b.h-1;t[dy][dx]='+';/* path from the door to the nearest street in the door's direction, at most 8 tiles */for(let y=dy+(n?-1:1),k=0;k<8&&y>=0&&y<h;y+=n?-1:1,k++){if(isStreet(dx,y))break;if(t[y][dx]===gc)t[y][dx]='o'}
  if(b.sign){const sx=dx+1,sy=dy+(n?-1:1);if(sy>=0&&sy<h&&t[sy][sx]!=='o'){t[sy][sx]='S';map.meta[sx+','+sy]={text:b.sign}}}
  if(b.npc){const ny=n?b.y+b.h-2:b.y+1;map.npcs.push({id:b.npc,x:b.npcx!=null?b.x+b.npcx:dx,y:ny,fixed:true});if(b.counter!==false){const cy=n?ny-1:ny+1;for(let x=b.x+1;x<b.x+b.w-1;x++)t[cy][x]='-'}}
  const WALLF={P:1,K:1,t:1},floorF=(b.furn||[]).filter(f=>!WALLF[f[0]]),wallF=(b.furn||[]).filter(f=>WALLF[f[0]]);
  for(let f of floorF){let fy=f[2];if(b.npc&&b.counter!==false){/* floor furniture goes on the customer side of a counter */const ny=n?b.h-2:1,cy=n?ny-1:ny+1;if(n?fy>=cy:fy<=cy){fy=n?1:b.h-2;let fx=f[1];const doorx=(b.w>>1);if(fx===doorx||t[b.y+fy][b.x+fx]!=='_')fx=[1,b.w-2,2,b.w-3].find(x=>x!==doorx&&x>0&&x<b.w-1&&t[b.y+fy][b.x+x]==='_');if(fx==null)continue;f=[f[0],fx,fy,f[3]]}}{const inx=dx-b.x,iny=n?1:b.h-2;if(f[1]===inx&&f[2]===iny){const alt=[inx-1,inx+1].find(x=>x>0&&x<b.w-1&&t[b.y+iny][b.x+x]===(b.floor||'_'));if(alt==null)continue;f=[f[0],alt,f[2],f[3]]}}t[b.y+f[2]][b.x+f[1]]=f[0];if(f[3])map.meta[(b.x+f[1])+','+(b.y+f[2])]=f[3];if(f[0]==='h'||f[0]==='l'||f[0]==='u')map.light.push([b.x+f[1],b.y+f[2]])}
  if(wallF.length){/* paintings, shelves and cases hang on a wall you can walk up to: back wall first, then the sides, then beside the door */
   const inside=new Set(),q=[[dx,n?dy+1:dy-1]],inB=(x,y)=>x>b.x&&x<b.x+b.w-1&&y>b.y&&y<b.y+b.h-1;if(inB(q[0][0],q[0][1])&&walkCh(t[q[0][1]][q[0][0]]))inside.add(q[0].join(','));else q.length=0;
   while(q.length){const[x,y]=q.pop();for(const[ax,ay]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+ax,ny=y+ay,k=nx+','+ny;if(!inB(nx,ny)||inside.has(k)||!walkCh(t[ny][nx]))continue;inside.add(k);q.push([nx,ny])}}
   const backY=n?b.y+b.h-1:b.y,frontY=n?b.y:b.y+b.h-1;
   for(const f of wallF){let best=null;for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++){const edge=y===b.y||y===b.y+b.h-1||x===b.x||x===b.x+b.w-1,corner=(x===b.x||x===b.x+b.w-1)&&(y===b.y||y===b.y+b.h-1);if(!edge||corner||t[y][x]!=='#')continue;
     if(![[1,0],[-1,0],[0,1],[0,-1]].some(([ax,ay])=>inside.has((x+ax)+','+(y+ay))))continue;const side=y===backY?0:y===frontY?2:1;const sc=side*10+Math.abs(x-(b.x+f[1]))+Math.abs(y-(b.y+f[2]))*.5;if(!best||sc<best[2])best=[x,y,sc]}
    if(!best)continue;t[best[1]][best[0]]=f[0];map.meta[best[0]+','+best[1]]=Object.assign({},f[3]||{},{under:'#'})}}}
 for(const d of def.decor||[]){t[d[2]][d[1]]=d[0];if(d[3])map.meta[d[1]+','+d[2]]=d[3];if(d[0]==='l'||d[0]==='u')map.light.push([d[1],d[2]])}
 for(const n of def.npcs||[])map.npcs.push({id:n[0],x:n[1],y:n[2],fixed:!!n[3]});
 for(let i=0;i<(def.trees==null?26:def.trees);i++){const x=1+(r()*(w-2)|0),y=1+(r()*(h-2)|0);if(t[y][x]===gc&&!map.npcs.some(n=>n.x===x&&n.y===y)&&![[1,0],[-1,0],[0,1],[0,-1]].some(([ax,ay])=>t[y+ay][x+ax]==='+'||t[y+ay][x+ax]==='o'))t[y][x]=def.tree||'T'}
 map.blds=(def.buildings||[]).map(b=>[b.x,b.y,b.w,b.h]);wSettleSpawn(map);
 return MAPS[def.id]=map}
/* a town's way in is always out in the open: on a street or open ground, never inside a building (Saltmere's was) */
function wInsideBuilding(m,x,y){return(m.blds||[]).some(([bx,by,bw,bh])=>x>=bx&&x<bx+bw&&y>=by&&y<by+bh)}
function wOpenTile(m,x,y){const c=m.t[y]&&m.t[y][x];return c!=null&&walkCh(c)&&!DB.tiles[c].enter&&!wInsideBuilding(m,x,y)&&!m.npcs.some(n=>n.x===x&&n.y===y)}
function wSettleSpawn(m){const[sx,sy]=m.spawn;if(wOpenTile(m,sx,sy))return;let best=null;for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++){if(!wOpenTile(m,x,y))continue;const d=Math.abs(x-sx)+Math.abs(y-sy)+(m.t[y][x]==='o'?0:.5);if(!best||d<best[2])best=[x,y,d]}if(best)m.spawn=[best[0],best[1]]}
function buildDungeon(def,seedOverride){const w=44,h=32,r=mulberry((seedOverride!=null?seedOverride:def.seed||7)*9176+WORLD_VER),t=[];for(let y=0;y<h;y++){const row=[];for(let x=0;x<w;x++)row.push('X');t.push(row)}
 const rooms=[];for(let i=0;i<70&&rooms.length<(def.rooms||8);i++){const rw=5+(r()*5|0),rh=4+(r()*4|0),rx=1+(r()*(w-rw-2)|0),ry=1+(r()*(h-rh-2)|0);if(rooms.some(o=>rx<o.x+o.w+1&&rx+rw+1>o.x&&ry<o.y+o.h+1&&ry+rh+1>o.y))continue;rooms.push({x:rx,y:ry,w:rw,h:rh,cx:rx+(rw>>1),cy:ry+(rh>>1)});for(let y=ry;y<ry+rh;y++)for(let x=rx;x<rx+rw;x++)t[y][x]='g'}
 for(let i=1;i<rooms.length;i++){const a=rooms[i-1],b=rooms[i];let x=a.cx,y=a.cy;while(x!==b.cx){t[y][x]=t[y][x]==='X'?'g':t[y][x];x+=x<b.cx?1:-1}while(y!==b.cy){t[y][x]=t[y][x]==='X'?'g':t[y][x];y+=y<b.cy?1:-1}}
 const map={id:def.id,name:def.name,kind:'dungeon',w,h,t,meta:{},npcs:[],light:[],dark:true,rooms};
 const first=rooms[0];t[first.cy][first.cx]='<';map.spawn=[first.cx,first.cy+1>=first.y+first.h?first.cy-1:first.cy+1];
 /* set piece room = the one farthest (by walking) from the stairs */
 const dist=new Int32Array(w*h).fill(-1),q=[[first.cx,first.cy]];dist[first.cy*w+first.cx]=0;for(let qi=0;qi<q.length;qi++){const[x,y]=q[qi];for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,i=ny*w+nx;if(t[ny][nx]!=='X'&&dist[i]<0){dist[i]=dist[y*w+x]+1;q.push([nx,ny])}}}
 let far=rooms[rooms.length-1];for(const rm of rooms)if(dist[rm.cy*w+rm.cx]>dist[far.cy*w+far.cx])far=rm;map.far=far;
 /* every object must leave the floor as connected as it found it; otherwise it moves or is dropped */
 const floorCount=()=>{const seen=bfsReach(map,map.spawn[0],map.spawn[1]);let n=0;for(let i=0;i<seen.length;i++)n+=seen[i];return n};let base=floorCount();
 const put=(ch,x,y,meta,alts)=>{const cands=[[x,y]].concat(alts||[]);for(const[cx,cy]of cands){if(t[cy][cx]!=='g')continue;t[cy][cx]=ch;if(ch==='M')t[cy][cx]='R';/* alphas block like rubble until beaten */if(floorCount()===base-1){base--;t[cy][cx]=ch;if(meta)map.meta[cx+','+cy]=meta;return true}t[cy][cx]='g'}return false};
 const ring=(rm)=>{const o=[];for(let y=rm.y;y<rm.y+rm.h;y++)for(let x=rm.x;x<rm.x+rm.w;x++)o.push([x,y]);return o};
 put('M',far.cx,far.cy,{alpha:def.alpha},ring(far));put('C',far.x,far.y,{chest:def.id+'_prize'},ring(far));put('N',far.x+far.w-1,far.y,{elem:def.elem,rare:1,alpha:def.alpha},ring(far));/* TC's rare egg nest; rare:1 marks a find for later phases */
 let k=0;for(const rm of rooms){if(rm===first||rm===far)continue;k++;const cx=rm.x+rm.w-1,cy=rm.y+rm.h-1;if(k%2===1)put('V',rm.x,rm.y,{elem:def.elem},ring(rm));if(k%3===0)put('C',cx,rm.y,{chest:def.id+'_c'+k},ring(rm));if(k%2===0)put('R',rm.x,cy,null,ring(rm));if(put('l',cx,cy,null,ring(rm))){const li=[cx,cy];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(t[y][x]==='l'&&!map.light.some(L=>L[0]===x&&L[1]===y))map.light.push([x,y])}}
 return MAPS[def.id]=map}
function dungeonProblems(map){const s=map.spawn,seen=bfsReach(map,s[0],s[1]),out=[];for(const k in map.meta){const[x,y]=k.split(',').map(Number);if(![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>seen[(y+dy)*map.w+x+dx]))out.push(map.id+': cannot reach '+k)}return out}
function buildAllMaps(){for(const k in MAPS)delete MAPS[k];buildWorld();for(const d of DB.towns)buildTown(d);for(const d of DB.dungeons)buildDungeon(d);for(const k in GROUND_CACHE)delete GROUND_CACHE[k];if(typeof wInvalidate==='function')wInvalidate()}
/* ground under a transparent object tile: ask the neighbours */
const GROUND_CACHE={};
function groundUnder(map,x,y){const key=map.id+':'+x+','+y;if(GROUND_CACHE[key])return GROUND_CACHE[key];const m=map.meta[x+','+y];if(m&&m.under)return GROUND_CACHE[key]=m.under;const cnt={};for(const[dx,dy]of[[0,1],[1,0],[-1,0],[0,-1],[1,1],[-1,1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=map.w||ny>=map.h)continue;const c=map.t[ny][nx],td=DB.tiles[c];if(td&&td.ground&&c!=='#'&&c!=='X'&&c!=='~')cnt[c]=(cnt[c]||0)+1}let best=map.kind==='dungeon'?'g':'.',bn=0;for(const c in cnt)if(cnt[c]>bn){bn=cnt[c];best=c}return GROUND_CACHE[key]=best}
/* ===== wAudit: TC's audit() minus the dropped registries (species, parts, trees, moves, encounters). [] means clean. ===== */
function wAudit(){const P=[];const chk=(c,m)=>{if(!c)P.push(m)};
 for(const r in REGION_ELEM){const rg=DB.regions[r];chk(rg,'region '+r+' missing');if(!rg)continue;chk((rg.sports||[]).length,'region '+r+' has no sports');for(const[sp,w]of rg.sports||[])chk(SPORTS[sp]&&w>0,'region '+r+' bad sport '+sp);chk((rg.kinds||[]).length>=4,'region '+r+' needs 4+ kinds');for(const k of rg.kinds||[])chk(KIND_NAME[k],'region '+r+' kind '+k+' is not a league kind')}
 for(const r in DB.recipes){for(const k in DB.recipes[r].needs)chk(DB.items[k],'recipe '+r+' needs unknown item '+k);const e=DB.recipes[r].effect;if(e&&e.kind==='item')chk(DB.items[e.item],'recipe '+r+' makes unknown item '+e.item)}
 for(const e in DB.forage)chk(DB.items[DB.forage[e]],'forage '+e+' is unknown item');for(const s in DB.shops)for(const k in DB.shops[s])chk(DB.items[k],'shop '+s+' sells unknown '+k);
 for(const c in DB.cups){chk(DB.cups[c].rounds.length===3,'cup '+c+' needs 3 rounds');chk(DB.enchants[DB.cups[c].elem],'cup '+c+' bad elem');chk(MAPS[DB.cups[c].town],'cup '+c+' town '+DB.cups[c].town+' has no map')}
 for(const d of DB.dungeons){chk(DB.alphas[d.alpha],'dungeon '+d.id+' alpha '+d.alpha+' missing');chk(DB.chests[d.id+'_prize'],'dungeon '+d.id+' has no prize chest');chk(DB.locs.some(l=>l.map===d.id),'dungeon '+d.id+' has no entrance on the world')}
 for(const L of DB.locs){if(L.hidden)chk(Object.values(DB.chars).some(c=>Object.values(c.topics||{}).some(t=>t.set===L.hidden)),'hidden loc '+L.id+' has no clue that sets '+L.hidden);chk(DB.tiles[L.tile]&&(DB.tiles[L.tile].enter||DB.tiles[L.tile].use),'loc '+L.id+' tile '+L.tile+' leads nowhere');if(L.map)chk(MAPS[L.map],'loc '+L.id+' map '+L.map+' missing');if(L.alpha)chk(DB.alphas[L.alpha],'loc '+L.id+' alpha missing');if(L.key)chk(DB.items[L.key],'loc '+L.id+' key item missing')}
 for(const t of DB.towns)chk(DB.locs.some(l=>l.map===t.id),'town '+t.id+' has no location on the world');
 for(const c in DB.chests){const used=Object.values(MAPS).some(m=>Object.values(m.meta).some(x=>x.chest===c));chk(used,'chest '+c+' is never placed');for(const k in DB.chests[c].items||{})chk(DB.items[k],'chest '+c+' unknown item '+k)}
 for(const m of Object.values(MAPS))for(const k in m.meta){const x=m.meta[k];if(x.chest)chk(DB.chests[x.chest],'map '+m.id+' chest '+x.chest+' undefined');if(x.alpha)chk(DB.alphas[x.alpha],'map '+m.id+' alpha '+x.alpha+' undefined');if(x.loc)chk(DB.locs.some(l=>l.id===x.loc),'map '+m.id+' loc '+x.loc+' undefined');if(x.ring&&x.ring.item)chk(DB.items[x.ring.item],'map '+m.id+' bell wants unknown item '+x.ring.item)}
 /* characters, keywords, flags */
 const placed=new Set();for(const m of Object.values(MAPS))for(const n of m.npcs||[])placed.add(n.id);const setFlags=new Set(DB.engineFlags),needFlags=[];for(const L of DB.locs){setFlags.add('seen_'+L.id);if(L.alpha)setFlags.add('alpha_'+L.alpha)}
 for(const m of Object.values(MAPS))for(const x of Object.values(m.meta)){if(x.rare)setFlags.add('rare_'+m.id);if(x.ring&&x.ring.set)setFlags.add(x.ring.set)}for(const d of DB.dungeons){setFlags.add('alpha_'+d.alpha);setFlags.add('rare_'+d.id);setFlags.add('seen_'+d.id)}for(const c in DB.chests)setFlags.add('chest_'+c);
 for(const id in DB.chars){const ch=DB.chars[id];chk(placed.has(id),'character '+id+' is never placed on a map');chk(KIND[ch.kind],'character '+id+' has no creature kind');for(const k in ch.topics||{}){const t=ch.topics[k];if(t.set)setFlags.add(t.set);if(t.once)setFlags.add(t.once);for(const nf of[].concat(t.need||[]))needFlags.push([nf,id+'.'+k]);for(const e in t.takeEn||{})chk(DB.enchants[e],id+'.'+k+' wants unknown energy '+e);for(const i in t.give||{})chk(DB.items[i],id+'.'+k+' gives unknown item '+i);for(const i in t.take||{})chk(DB.items[i],id+'.'+k+' takes unknown item '+i);for(const e in t.giveEn||{})chk(DB.enchants[e],id+'.'+k+' giveEn unknown elem');for(const f of['giveEgg','needSp','needCaught','takeParts','giveRp'])chk(t[f]==null,id+'.'+k+' uses dropped field '+f);if(t.act&&t.act.startsWith('cup:'))chk(DB.cups[t.act.slice(4)],id+'.'+k+' enters unknown cup');if(t.act==='shop')chk(DB.shops[ch.shop],id+' shop '+ch.shop+' missing');
   /* a capitalised word in a line that nobody answers to is a dead keyword */
   for(const w of(t.t.match(/\b[A-Z]{3,}\b/g)||[]))chk(findTopicStatic(ch,w.toLowerCase())||['DO','NOT'].includes(w),id+'.'+k+' emphasises '+w+' but has no such topic')}for(const w of(ch.greet.match(/\b[A-Z]{3,}\b/g)||[]))chk(findTopicStatic(ch,w.toLowerCase()),id+' greets with '+w+' but has no such topic')}
 for(const n of placed)chk(DB.chars[n],'placed character '+n+' has no entry');
 const evActs=['stray','duel','egg','poacher','freed','race','wisp'];
 for(const ev of DB.events||[]){const effs=[ev.auto||{}].concat(ev.choices||[]);for(const e of effs){for(const k in e.items||{})chk(DB.items[k],'event '+ev.id+' gives unknown item '+k);for(const k in (e.cost||{}).items||{})chk(DB.items[k],'event '+ev.id+' costs unknown item '+k);chk(!e.act||evActs.includes(e.act),'event '+ev.id+' has unknown act '+e.act);chk(e.rp==null&&e.rpTeam==null,'event '+ev.id+' pays dropped research data')}chk(ev.who,'event '+ev.id+' has nobody to show');if(ev.who&&ev.who.kind&&ev.who.kind!=='@region')chk(KIND[ev.who.kind],'event '+ev.id+' shows unknown kind '+ev.who.kind);chk(!(ev.who&&ev.who.chimera),'event '+ev.id+' shows a species');if(ev.need)needFlags.push([ev.need,'event '+ev.id])}
 for(const r in DB.recipes)if(DB.recipes[r].need)needFlags.push([DB.recipes[r].need,'recipe '+r]);
 for(const[f,w]of needFlags)chk(setFlags.has(f),w+' needs flag '+f+' that nothing sets');for(const s of DB.sideplots)chk(setFlags.has(s.id),'sideplot '+s.id+' flag is never set');
 /* items obtainable */
 for(const i in DB.items){const sold=Object.values(DB.shops).some(s=>s[i]!=null),given=Object.values(DB.chars).some(c=>Object.values(c.topics||{}).some(t=>t.give&&t.give[i])),chest=Object.values(DB.chests).some(c=>c.items&&c.items[i]),forage=Object.values(DB.forage).includes(i),cooked=Object.values(DB.recipes).some(r=>r.effect&&r.effect.kind==='item'&&r.effect.item===i),evt=(DB.events||[]).some(ev=>[ev.auto||{}].concat(ev.choices||[]).some(e=>e.items&&e.items[i])),start=['ration','salve','grain','salt'].includes(i);chk(sold||given||chest||forage||cooked||evt||start,'item '+i+' cannot be obtained')}
 /* geography */
 if(MAPS.world)for(const p of worldProblems())P.push(p);for(const d of DB.dungeons)if(MAPS[d.id])for(const p of dungeonProblems(MAPS[d.id]))P.push(p);
 for(const m of Object.values(MAPS))if(m.kind==='town'){const seen=bfsReach(m,m.spawn[0],m.spawn[1]);chk(!wInsideBuilding(m,m.spawn[0],m.spawn[1]),'town '+m.id+': you walk in inside a building');if(typeof wInnSpot==='function'&&m.npcs.some(n=>DB.chars[n.id]&&DB.chars[n.id].inn)){const a=wInnSpot(m.id);chk(seen[a[1]*m.w+a[0]],'town '+m.id+': you would wake at '+a+', cut off from the town')}for(const n of m.npcs)chk([[0,0],[1,0],[-1,0],[0,1],[0,-1],[0,2],[0,-2]].some(([dx,dy])=>seen[(n.y+dy)*m.w+n.x+dx]),'town '+m.id+': '+n.id+' cannot be reached');for(const k in m.meta){const[x,y]=k.split(',').map(Number);chk([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>seen[(y+dy)*m.w+x+dx]),'town '+m.id+': tile '+k+' unreachable')}for(let y=0;y<m.h;y++)for(let x=0;x<m.w;x++)if(m.t[y][x]==='W'||m.t[y][x]==='E')chk([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>seen[(y+dy)*m.w+x+dx]),'town '+m.id+': '+m.t[y][x]+' at '+x+','+y+' unreachable')}
 return P.filter(Boolean)}
function findTopicStatic(ch,kw){const ks=Object.keys(ch.topics||{});return ks.find(k=>k===kw)||(kw.length>=4?ks.find(k=>k.startsWith(kw.slice(0,4))):null)}
