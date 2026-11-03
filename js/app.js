const CATS=['POS & Computers','Peripherals','Printing','Network','Security','Power','Other'];
const STATUSES=['Operational','For Monitoring','Defective','Under Maintenance'];
const STATUS_HELP={'Operational':'Working normally','For Monitoring':'Working, re-check next visit','Defective':'Needs repair or replacement','Under Maintenance':'Being repaired or with vendor'};
const STORE_TYPES=['In-Line','Kiosk','Other'];
const LEASE_TYPES=['Fixed','Percentage'];
const MALLS=[['Ayala Malls','Project UNO'],['SM Supermalls','SIA Mosaic'],['Robinsons Malls','SFTP Server'],['Other','']];
const mallIface=m=>(MALLS.find(x=>x[0]===m)||['',''])[1];
const SALES_CHECKS=['Mall interface connected','Mall interface configured','Daily sales file sent successfully','Sales received by the mall (no missing or rejected days)'];
const isPct=s=>(s&&s.leaseType)==='Percentage';
function radioRows(prefix,list,labels){return list.map((c,k)=>`<div class="check-row"><span class="t">${esc(c)}</span><span class="rad" role="radiogroup" aria-label="${esc(c)}">${labels.map(([val,lab,cl])=>`<label><input type="radio" name="${prefix}${k}" value="${val}"><span class="${cl}">${lab}</span></label>`).join('')}</span></div>`).join('')}
const LBL_CHECK=[['OK','OK','v-ok'],['Not OK','Not OK','v-bad'],['N/A','N/A','v-na']];
const LBL_SOFT=[['OK','Working','v-ok'],['Not OK','Issue','v-bad'],['N/A','N/A','v-na']];
const LBL_SALES=[['OK','OK','v-ok'],['Not OK','Failed','v-bad'],['N/A','N/A','v-na']];
function readRadios(prefix,list){return list.map((c,k)=>({t:c,r:document.querySelector(`input[name="${prefix}${k}"]:checked`)?.value||''}))}
function resultTag(r){return r==='OK'?'<span class="r-ok">✓ OK</span>':r==='Not OK'?'<span class="r-bad">✕ Issue</span>':'<span class="r-na">N/A</span>'}
function storeSales(sid,L){let best=null;for(const e of storeEquip(sid)){if(!S.types[e.typeId]?.salesSending)continue;for(const r of Object.values(S.pm)){if(r.equipmentId!==e.id||!r.sales)continue;if(!best||(r.date||'')>(best.date||'')||((r.date||'')===(best.date||'')&&(r.createdAt||0)>(best.createdAt||0)))best=r}}
  if(!best)return{state:'none'};const bad=(best.sales.items||[]).some(x=>x.r==='Not OK');return{state:bad?'bad':'ok',rec:best}}
function salesTag(s,L){if(!isPct(s))return '';const x=storeSales(s.id,L);const iface=s.mallInterface?esc(s.mallInterface):'Daily sales';
  if(x.state==='none')return `<span class="tag">${iface}: not checked yet</span>`;
  return x.state==='ok'?`<span class="tag ok">${iface}: sending OK</span>`:`<span class="tag bad">${iface}: sending issue</span>`}
function leaseLine(s,L){if(!isPct(s))return `<div class="lease-line"><span class="chip">Fixed lease</span></div>`;const x=storeSales(s.id,L);
  return `<div class="lease-line"><span class="chip chip-lease">Percentage lease</span><span class="note">${esc(s.mallOperator||'Mall')} · daily sales via <b>${esc(s.mallInterface||'—')}</b>${s.tenantId?` · Tenant ID ${esc(s.tenantId)}`:''}</span>${salesTag(s,L)}${x.rec?`<span class="note">Last checked ${fmt(x.rec.date)}${x.rec.sales.lastSent?` · last successful send ${fmt(x.rec.sales.lastSent)}`:''}</span>`:''}</div>`}
function extraResults(r){let h='';const sw=r.software||[];
  if(sw.length){const ok=sw.filter(x=>x.r==='OK').length,app=sw.filter(x=>x.r!=='N/A').length;h+=`<div class="eqd-sub"><span class="k">Software</span><b class="${ok===app?'r-ok':'r-bad'}">${ok} of ${app} working</b></div><ul class="eqd-list">${sw.map(x=>`<li><span>${esc(x.t)}</span>${resultTag(x.r)}</li>`).join('')}</ul>`}
  if(r.sales){const it=r.sales.items||[];h+=`<div class="eqd-sub"><span class="k">Daily sales sending</span><b>${esc(r.sales.interface||'Mall interface')}</b>${r.sales.lastSent?` · last successful send ${fmt(r.sales.lastSent)}`:''}</div><ul class="eqd-list">${it.map(x=>`<li><span>${esc(x.t)}</span>${resultTag(x.r)}</li>`).join('')}</ul>`}
  return h}
function histExtra(r){const sw=r.software||[];let h='';
  if(sw.length)h+=`<details class="h-check"><summary>Software results</summary><ul>${sw.map(x=>`<li><span>${esc(x.t)}</span>${resultTag(x.r)}</li>`).join('')}</ul></details>`;
  if(r.sales)h+=`<details class="h-check"><summary>Daily sales sending · ${esc(r.sales.interface||'Mall interface')}</summary><ul>${(r.sales.items||[]).map(x=>`<li><span>${esc(x.t)}</span>${resultTag(x.r)}</li>`).join('')}${r.sales.lastSent?`<li><span>Last successful send</span><span>${fmt(r.sales.lastSent)}</span></li>`:''}</ul></details>`;
  return h}
const S={stores:{},equipment:{},types:{},pm:{},ready:{stores:false,equipment:false,types:false,pm:false}};
let sb=null,ROLE={admin:false,write:false},myName='',offline=false,slow=false,dbErr='';
let AUTH={screen:'loading',err:'',msg:''},PROFILE=null,USERS=[];
const BASE_URL=location.origin+location.pathname;
const UI={schedFilter:'all',schedStore:'',expanded:{},hKind:'all',hStore:'',hQ:'',hFrom:'',hTo:''};

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slug=s=>s?String(s).toLowerCase().replace(/[^a-z]+/g,'-'):'none';
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const addMonths=(ds,m)=>{if(!ds)return '';const [y,mo,d]=ds.split('-').map(Number);const t=new Date(y,mo-1+Number(m||1),1);const last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();t.setDate(Math.min(d,last));return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`};
const daysBetween=(a,b)=>Math.round((new Date(b+'T00:00')-new Date(a+'T00:00'))/864e5);
const fmt=ds=>{if(!ds)return '—';const [y,m,d]=ds.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})};
const newId=p=>p+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const freqLabel=m=>({1:'Monthly',2:'Every 2 months',3:'Quarterly',6:'Every 6 months',12:'Yearly'})[Number(m)||1]||`Every ${m} months`;
const natural=(a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});

/* ---------- derived ---------- */
function latestMap(){const m={};for(const r of Object.values(S.pm)){const k=r.equipmentId;if(!k)continue;const cur=m[k];if(!cur||(r.date||'')>(cur.date||'')||((r.date||'')===(cur.date||'')&&(r.createdAt||0)>(cur.createdAt||0)))m[k]=r}return m}
function dueState(next){if(!next)return 'none';const t=today();if(next<t)return 'overdue';if(daysBetween(t,next)<=7)return 'soon';return 'ok'}
function eqInfo(eq,L){const last=L[eq.id];const type=S.types[eq.typeId]||{};return{eq,type,last,status:last?.status||'',lastDate:last?.date||'',next:last?.next||'',due:last?dueState(last.next):'none'}}
function storeEquip(sid){return Object.values(S.equipment).filter(e=>e.storeId===sid)}
function typeName(id){return S.types[id]?.name||'Unknown type'}
function catOf(eq){return S.types[eq.typeId]?.category||'Other'}
function sortEquip(list){return list.sort((a,b)=>CATS.indexOf(catOf(a))-CATS.indexOf(catOf(b))||natural(a.name,b.name))}
function sortedStores(){return Object.values(S.stores).sort((a,b)=>natural(a.code||a.name,b.code||b.name))}

/* ---------- writes ---------- */
function errMsg(e){const c=e?.code;if(c==='42501'||/row-level security/i.test(e?.message||''))return "You don't have permission for this change.";if(c==='23505')return 'That value is already used by another record (for example, an asset tag).';if(c==='23503')return 'This item is still in use by other records. Remove those first.';if(/fetch|network/i.test(e?.message||''))return "Couldn't reach the server. Check your connection and try again.";return e?.message||"Couldn't save right now. Try again."}
const TBL={stores:'stores',types:'equipment_types',equipment:'equipment',pm:'pm_records'};
const MAP={stores:{leaseType:'lease_type',mallOperator:'mall_operator',mallInterface:'mall_interface',tenantId:'tenant_id'},types:{freqMonths:'freq_months',salesSending:'sales_sending'},equipment:{storeId:'store_id',typeId:'type_id',assetTag:'asset_tag'},pm:{equipmentId:'equipment_id',storeId:'store_id',equipmentName:'equipment_name',typeName:'type_name',storeName:'store_name',createdBy:'created_by'}};
const COLS={stores:['id','name','code','type','location','notes','leaseType','mallOperator','mallInterface','tenantId'],types:['id','name','prefix','category','freqMonths','checklist','software','salesSending'],equipment:['id','storeId','typeId','name','assetTag','brand','model','serial','ip','purchased','warranty','notes'],pm:['id','equipmentId','storeId','equipmentName','typeName','storeName','date','next','tech','kind','status','items','software','sales','issues','action']};
const DATECOLS=['purchased','warranty','date','next'];
function toRow(k,o){const r={};for(const c of COLS[k]){if(!(c in o))continue;let v=o[c];if(DATECOLS.includes(c)&&!v)v=null;if(c==='assetTag'&&!v)v=null;if(c==='equipmentId'&&!v)v=null;r[MAP[k][c]||c]=v}if(k!=='pm')r.updated_at=new Date().toISOString();return r}
function fromRow(k,r){const inv={};for(const [c,s] of Object.entries(MAP[k]))inv[s]=c;const o={};for(const [key,val] of Object.entries(r))o[inv[key]||key]=val;for(const c of DATECOLS)if(c in o&&o[c]==null)o[c]='';if(k==='equipment'&&o.assetTag==null)o.assetTag='';if(k==='pm')o.createdAt=Date.parse(r.created_at)||0;return o}
async function put(path,data){const [k,id]=path.split('/');const row=toRow(k,{...data,id});
  if(k==='pm'){const e=S.equipment[row.equipment_id]||{};row.equipment_name=e.name||'';row.type_name=e.typeId?typeName(e.typeId):'';row.store_name=S.stores[row.store_id]?.name||''}
  const q=k==='pm'?sb.from(TBL[k]).insert(row):sb.from(TBL[k]).upsert(row);
  const {data:res,error}=await q.select().maybeSingle();
  if(error||!res){toast(error?errMsg(error):"You don't have permission for this change.",true);return false}
  S[k]={...S[k],[res.id]:fromRow(k,res)};render();return true}
async function del(path){const [k,id]=path.split('/');const {data,error}=await sb.from(TBL[k]).delete().eq('id',id).select('id');
  if(error){toast(errMsg(error),true);return false}if(!data||!data.length){toast("You don't have permission to delete this.",true);return false}
  const n={...S[k]};delete n[id];S[k]=n;if(k==='stores'){const eq={...S.equipment};for(const e of Object.values(eq))if(e.storeId===id)delete eq[e.id];S.equipment=eq}render();return true}
async function fetchAll(t){let all=[],from=0;for(;;){const {data,error}=await sb.from(t).select('*').order('id').range(from,from+999);if(error)throw error;all=all.concat(data);if(data.length<1000)break;from+=1000}return all}
let loadingAll=false;
async function loadAll(){if(loadingAll||!ROLE_READY)return;loadingAll=true;try{const keys=['stores','types','equipment','pm'];const res=await Promise.all(keys.map(k=>fetchAll(TBL[k])));
  keys.forEach((k,i)=>{const o={};res[i].forEach(r=>{o[r.id]=fromRow(k,r)});S[k]=o;S.ready[k]=true});offline=false;dbErr=''}
  catch(e){offline=true;dbErr="Couldn't load PMS records: "+errMsg(e)}finally{loadingAll=false}render()}
async function loadUsers(){if(!REAL.admin)return;const {data,error}=await sb.from('profiles').select('*').order('created_at',{ascending:false});if(!error){USERS=data||[];render()}}
let toastT;function toast(msg,err){const r=document.getElementById('toast-root');r.innerHTML=`<div class="toast ${err?'err':''}" role="status">${esc(msg)}</div>`;clearTimeout(toastT);toastT=setTimeout(()=>r.innerHTML='',err?6000:2600)}

/* ---------- routing ---------- */
function route(){const h=decodeURIComponent(location.hash.slice(1));if(h.startsWith('store-'))return{v:'store',id:h.slice(6)};if(h.startsWith('item-'))return{v:'item',id:h.slice(5)};if(['dashboard','schedule','history','issues','setup','users'].includes(h))return{v:h};return{v:'stores'}}
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0)});

/* ---------- render ---------- */
let raf=0;function render(){cancelAnimationFrame(raf);raf=requestAnimationFrame(doRender)}
function doRender(){
  if(AUTH.screen){renderAuth();return}
  const r0=route(),r=(ROLE.write||!ROLE_READY)?r0:{v:'dashboard'},L=latestMap();
  const issues=Object.values(S.equipment).filter(e=>['Defective','Under Maintenance'].includes(L[e.id]?.status)).length;
  const overdue=Object.values(S.equipment).filter(e=>L[e.id]&&dueState(L[e.id].next)==='overdue').length;
  const cur=r.v==='store'||r.v==='item'?'stores':r.v==='history'?'schedule':r.v;
  const tabs=(ROLE.write||!ROLE_READY)?[['dashboard','Dashboard'],['stores','Stores'],['schedule','PM Schedule',overdue],['issues','Defective',issues]]:[['dashboard','Dashboard']];
  if(ROLE.admin)tabs.push(['setup','Equipment Types']);
  if(ROLE.admin)tabs.push(['users','Users',USERS.filter(u=>u.status==='pending').length]);
  document.getElementById('nav').innerHTML=tabs.map(([k,l,c])=>`<a href="#${k}" ${cur===k?'aria-current="page"':''}>${l}${c?`<span class="count">${c}</span>`:''}</a>`).join('');
  const app=document.getElementById('app');
  let html='';
  if(offline)html+=`<div class="banner">${esc(dbErr||"Couldn't reach the PMS database. Check your connection.")}</div>`;
  else if(slow&&!allReady())html+=`<div class="banner">Still connecting to the PMS records. They'll load as soon as the connection answers.</div>`;
  if(PREVIEW)html+=`<div class="banner preview"><span>Previewing as <b>${PREVIEW==='staff'?'IT Staff':'Manager'}</b>. This is what they see. ${PREVIEW==='staff'?'They can record PM and repairs, but cannot add, edit or delete stores, equipment or types.':'They see only the Dashboard and cannot record or change anything.'}</span><button class="btn sm" data-act="end-preview">Back to admin view</button></div>`;
  if(r.v==='stores')html+=viewStores(L);
  else if(r.v==='store')html+=viewStore(r.id,L);
  else if(r.v==='item')html+=viewItem(r.id,L);
  else if(r.v==='schedule')html+=viewSchedule(L);
  else if(r.v==='history')html+=viewHistory();
  else if(r.v==='dashboard')html+=viewDashboard(L);
  else if(r.v==='users')html+=ROLE.admin?viewUsers():`<div class="empty"><h3>Admins only</h3><p>Only admins can manage users.</p></div>`;
  else if(r.v==='issues')html+=viewIssues(L);
  else if(r.v==='setup')html+=ROLE.admin?viewSetup():`<div class="empty"><h3>Admins only</h3><p>Only admins can manage equipment types.</p></div>`;
  const act=document.activeElement&&document.activeElement.id;
  app.innerHTML=html;
  if(act){const el=document.getElementById(act);if(el&&el!==document.activeElement&&app.contains(el)){el.focus();try{if(el.type==='search'||el.type==='text')el.setSelectionRange(el.value.length,el.value.length)}catch(_){}}}
}
let REAL={admin:false,write:false},PREVIEW='',ROLE_READY=false;
const roleLabel=()=>ROLE.admin?'Admin':ROLE.write?'IT Staff':'Manager (view only)';
function renderMe(){const box=document.getElementById('me');if(!box)return;if(AUTH.screen&&AUTH.screen!=='pending'&&AUTH.screen!=='denied'){box.innerHTML='';return}if(AUTH.screen){box.innerHTML=`<button class="btn sm" data-act="signout">Sign out</button>`;return}box.innerHTML=`${myName?`<span>${esc(myName)}</span>`:''}<span class="role">${roleLabel()}</span>${REAL.admin?`<select class="inp auto viewas" id="view-as" aria-label="View the page as"><option value="" ${!PREVIEW?'selected':''}>View as: Admin</option><option value="staff" ${PREVIEW==='staff'?'selected':''}>View as: IT Staff</option><option value="manager" ${PREVIEW==='manager'?'selected':''}>View as: Manager</option></select>`:''}<button class="btn sm" data-act="signout">Sign out</button>`}
function setPreview(p){if(!REAL.admin)return;PREVIEW=p;if(p==='staff'){ROLE.admin=false;ROLE.write=true}else if(p==='manager'){ROLE.admin=false;ROLE.write=false}else{ROLE.admin=REAL.admin;ROLE.write=REAL.write}closeSheet();renderMe();render()}
const allReady=()=>Object.values(S.ready).every(Boolean);
function loading(what){return `<div class="empty"><h3>Loading ${what}…</h3></div>`}

function viewStores(L){
  const stores=sortedStores(),eqs=Object.values(S.equipment);
  const infos=eqs.map(e=>eqInfo(e,L));
  const od=infos.filter(i=>i.due==='overdue').length,df=infos.filter(i=>i.status==='Defective').length,nopm=infos.filter(i=>!i.last).length;
  let h=`<div class="page-head"><div><div class="eyebrow">All branches</div><h1>Stores</h1></div><div class="actions">${ROLE.admin?`<button class="btn primary" data-act="add-store">+ Add store</button>`:''}</div></div>`;
  h+=`<div class="summary"><div><b>${stores.length}</b><span>Stores</span></div><div><b>${eqs.length}</b><span>Equipment items</span></div><div class="bad"><b>${od}</b><span>PM overdue</span></div><div class="${df?'bad':''}"><b>${df}</b><span>Defective</span></div></div>`;
  if(!S.ready.stores&&!stores.length)return h+loading('stores');
  if(!stores.length)return h+`<div class="empty"><h3>No stores yet</h3><p>${ROLE.admin?'Add your first store, then add its equipment.':'An admin needs to add stores first.'}</p>${ROLE.admin?'<p><button class="btn primary" data-act="add-store">+ Add store</button></p>':''}</div>`;
  h+='<div class="grid">';
  for(const s of stores){
    const si=infos.filter(i=>i.eq.storeId===s.id);
    const o=si.filter(i=>i.due==='overdue').length,soon=si.filter(i=>i.due==='soon').length,d=si.filter(i=>['Defective','Under Maintenance'].includes(i.status)).length,n=si.filter(i=>!i.last).length;
    h+=`<a class="store-card" href="#store-${esc(s.id)}"><div class="sc-top"><span class="mono muted">${esc(s.code||'—')}</span><span class="sc-chips"><span class="chip">${esc(s.type||'Store')}</span>${isPct(s)?`<span class="chip chip-lease" title="Percentage lease">% ${esc(s.mallInterface||'')}</span>`:''}</span></div><h3>${esc(s.name)}</h3><p class="muted">${esc(s.location||'')}</p>
    <div class="sc-stats"><span class="tag"><b>${si.length}</b> items</span>${o?`<span class="tag bad"><b>${o}</b> overdue</span>`:''}${soon?`<span class="tag warn"><b>${soon}</b> due soon</span>`:''}${d?`<span class="tag bad"><b>${d}</b> defective</span>`:''}${n?`<span class="tag"><b>${n}</b> no PM yet</span>`:''}${!o&&!soon&&!d&&!n&&si.length?'<span class="tag ok">All up to date</span>':''}</div></a>`;
  }
  return h+'</div>';
}

function eqRow(i){
  const e=i.eq,bm=[e.brand,e.model].filter(Boolean).join(' ');
  const row=`<a class="eq-row" href="#item-${esc(e.id)}"><div class="eq-main"><span class="eq-name">${esc(e.name)}</span><span class="muted">${esc(i.type.name||'Unknown type')}${bm?' · '+esc(bm):''}${e.serial?' · SN '+esc(e.serial):''}</span></div>
  <span class="pill s-${slug(i.status)}">${esc(i.status||'No PM yet')}</span>
  <div class="eq-dates"><span class="muted">Last PM ${fmt(i.lastDate)}</span><span class="due-${i.due}">Next ${fmt(i.next)}${i.due==='overdue'?' · overdue':''}</span></div><span class="chev" aria-hidden="true">›</span></a>`;
  return ROLE.admin?`<div class="eq-line">${row}<button type="button" class="btn sm eq-del" data-act="del-eq" data-id="${esc(e.id)}" aria-label="Delete ${esc(e.name)}">Delete</button></div>`:row;
}

function viewStore(id,L){
  const s=S.stores[id];
  if(!s)return S.ready.stores?`<div class="empty"><h3>Store not found</h3><p>It may have been deleted. <a href="#stores">Back to stores</a></p></div>`:loading('store');
  const list=sortEquip(storeEquip(id)).map(e=>eqInfo(e,L));
  let h=`<div class="crumbs"><a href="#stores">Stores</a> › ${esc(s.code||'')}</div><div class="page-head"><div><div class="eyebrow">${esc(s.type||'Store')}${s.location?' · '+esc(s.location):''}</div><h1>${esc(s.name)}</h1></div><div class="actions">`;
  if(ROLE.admin)h+=`<button class="btn" data-act="edit-store" data-id="${esc(id)}">Edit store</button><button class="btn primary" data-act="add-eq" data-id="${esc(id)}">+ Add equipment</button>`;
  h+='</div></div>';
  h+=leaseLine(s,L);
  if(s.notes)h+=`<p class="note">${esc(s.notes)}</p>`;
  if(!list.length)return h+`<div class="empty"><h3>No equipment yet</h3><p>${ROLE.admin?'Add the POS, printers, routers and other devices installed at this store.':'An admin needs to add this store\'s equipment.'}</p>${ROLE.admin?`<p><button class="btn primary" data-act="add-eq" data-id="${esc(id)}">+ Add equipment</button></p>`:''}</div>`;
  for(const c of CATS){const items=list.filter(i=>(i.type.category||'Other')===c);if(!items.length)continue;
    h+=`<section class="cat"><h2>${esc(c)} <span>${items.length}</span></h2><div class="list">${items.map(eqRow).join('')}</div></section>`}
  return h;
}

function viewItem(id,L){
  const e=S.equipment[id];
  if(!e)return S.ready.equipment?`<div class="empty"><h3>Equipment not found</h3><p>It may have been removed. <a href="#stores">Back to stores</a></p></div>`:loading('equipment');
  const s=S.stores[e.storeId]||{},i=eqInfo(e,L),t=i.type;
  const recs=Object.values(S.pm).filter(r=>r.equipmentId===id).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||0)-(a.createdAt||0));
  let h=`<div class="crumbs"><a href="#stores">Stores</a> › <a href="#store-${esc(e.storeId)}">${esc(s.name||'Store')}</a></div><div class="page-head"><div><div class="eyebrow">${esc(t.category||'Equipment')} · ${esc(t.name||'Unknown type')}</div><h1>${esc(e.name)}</h1></div><div class="actions">`;
  if(ROLE.admin)h+=`<button class="btn" data-act="edit-eq" data-id="${esc(id)}">Edit</button>`;
  if(ROLE.write)h+=`<button class="btn primary" data-act="pm" data-id="${esc(id)}">Record PM</button>`;
  h+='</div></div><div class="two"><div class="panel">';
  h+=`<div class="status-big"><span class="pill s-${slug(i.status)}">${esc(i.status||'No PM yet')}</span><span class="due-${i.due}">Next PM ${fmt(i.next)}</span></div>`;
  const rows=[['Store',s.name],['Brand / Model',[e.brand,e.model].filter(Boolean).join(' ')],['Serial No.',e.serial],['IP Address',e.ip],['Date Purchased',e.purchased&&fmt(e.purchased)],['Warranty End',e.warranty&&fmt(e.warranty)],['PM Frequency',t.freqMonths?freqLabel(t.freqMonths):''],['Notes',e.notes]];
  h+='<dl class="info">'+rows.map(([k,v])=>`<dt>${k}</dt><dd>${v?esc(v):'<span class="muted">—</span>'}</dd>`).join('')+'</dl>';
  h+=`<details class="h-check" style="margin-top:14px"><summary>PM checklist for ${esc(t.name||'this type')} (${(t.checklist||[]).length} items)</summary><ul>${(t.checklist||[]).map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details>`;
  h+='</div><div class="panel"><h2>Maintenance history</h2>';
  if(!recs.length)h+=`<div class="empty" style="padding:24px"><h3>No PM recorded yet</h3><p>${ROLE.write?'Record the first PM for this item.':'Records will show here once IT logs a PM.'}</p>${ROLE.write?`<p><button class="btn primary" data-act="pm" data-id="${esc(id)}">Record PM</button></p>`:''}</div>`;
  else{h+='<div class="history">';for(const r of recs){const items=r.items||[],ok=items.filter(x=>x.r==='OK').length,bad=items.filter(x=>x.r==='Not OK').length,app=items.filter(x=>x.r!=='N/A').length;
    h+=`<div class="h-item"><div class="h-top"><b>${fmt(r.date)}</b><span class="chip">${esc(r.kind||'Preventive')}</span><span class="pill s-${slug(r.status)}">${esc(r.status||'—')}</span>${items.length?`<span class="note">${ok}/${app} OK${bad?` · <span class="r-bad">${bad} not OK</span>`:''}</span>`:''}${ROLE.admin?`<button class="btn ghost sm" style="margin-left:auto" data-act="del-pm" data-id="${esc(r.id)}">Delete</button>`:''}</div>
    <div class="h-body">${r.tech?`<div><span class="k">Technician</span>${esc(r.tech)}</div>`:''}${r.issues?`<div><span class="k">Issues</span>${esc(r.issues)}</div>`:''}${r.action?`<div><span class="k">Action</span>${esc(r.action)}</div>`:''}<div><span class="k">Next maintenance</span>${fmt(r.next)}</div></div>
    ${items.length?`<details class="h-check"><summary>Checklist results</summary><ul>${items.map(x=>`<li><span>${esc(x.t)}</span><span class="${x.r==='OK'?'r-ok':x.r==='Not OK'?'r-bad':'r-na'}">${esc(x.r||'—')}</span></li>`).join('')}</ul></details>`:''}${histExtra(r)}</div>`}
    h+='</div>'}
  return h+'</div></div>';
}

function viewSchedule(L){
  let infos=Object.values(S.equipment).map(e=>eqInfo(e,L));
  const counts={all:infos.length,overdue:0,soon:0,none:0,ok:0};infos.forEach(i=>counts[i.due]++);
  if(UI.schedStore)infos=infos.filter(i=>i.eq.storeId===UI.schedStore);
  if(UI.schedFilter!=='all')infos=infos.filter(i=>i.due===UI.schedFilter);
  const order={overdue:0,soon:1,none:2,ok:3};
  infos.sort((a,b)=>order[a.due]-order[b.due]||(a.next||'').localeCompare(b.next||'')||natural(S.stores[a.eq.storeId]?.name||'',S.stores[b.eq.storeId]?.name||''));
  let h=`<div class="page-head"><div><div class="eyebrow">All branches</div><h1>PM Schedule</h1></div><div class="actions"><button class="btn" data-act="export-master">Export masterlist (CSV)</button></div></div>${subnav('schedule')}`;
  const f=[['all','All'],['overdue','Overdue'],['soon','Due in 7 days'],['none','No PM yet'],['ok','Up to date']];
  h+=`<div class="filters"><div class="seg" role="group" aria-label="Filter by due status">${f.map(([k,l])=>`<button data-act="sched-filter" data-id="${k}" aria-pressed="${UI.schedFilter===k}">${l} <span class="mono">${counts[k]}</span></button>`).join('')}</div>
  <select class="inp auto" id="sched-store" aria-label="Filter by store"><option value="">All stores</option>${sortedStores().map(s=>`<option value="${esc(s.id)}" ${UI.schedStore===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>`;
  if(!infos.length)return h+`<div class="empty"><h3>Nothing here</h3><p>No equipment matches this filter.</p></div>`;
  h+=`<div class="tablewrap"><table><thead><tr><th>Store</th><th>Equipment</th><th>Type</th><th>Status</th><th>Last PM</th><th>Next PM</th></tr></thead><tbody>`;
  for(const i of infos){const s=S.stores[i.eq.storeId]||{};h+=`<tr class="click" data-act="go" data-id="item-${esc(i.eq.id)}"><td>${esc(s.name||'—')}</td><td><b>${esc(i.eq.name)}</b></td><td>${esc(i.type.name||'—')}</td><td><span class="pill s-${slug(i.status)}">${esc(i.status||'No PM yet')}</span></td><td>${fmt(i.lastDate)}</td><td class="due-${i.due}">${i.due==='none'?'Not scheduled':fmt(i.next)}${i.due==='overdue'?` · ${daysBetween(i.next,today())}d late`:''}</td></tr>`}
  return h+'</tbody></table></div><p class="note">Next PM comes from the latest PM record and the equipment type\'s frequency.</p>';
}

function storeHealth(sid,L){const items=sortEquip(storeEquip(sid)).map(e=>eqInfo(e,L));const c={'Operational':0,'For Monitoring':0,'Defective':0,'Under Maintenance':0,none:0};items.forEach(i=>{const k=i.status&&c[i.status]!==undefined?i.status:'none';c[k]++});const checked=items.length-c.none;const pct=checked?Math.round(c['Operational']/checked*100):null;const ongoing=items.filter(i=>['Defective','Under Maintenance','For Monitoring'].includes(i.status));const last=items.reduce((m,i)=>(i.lastDate||'')>m?i.lastDate:m,'');return{items,c,checked,pct,ongoing,last,overdue:items.filter(i=>i.due==='overdue').length}}
function pctClass(p){return p===null?'none':p===100?'ok':p>=75?'warn':'bad'}
function checksCell(i){const it=i.last?.items||[];if(!i.last)return '<span class="muted">Not checked yet</span>';if(!it.length)return '<span class="muted">—</span>';const app=it.filter(x=>x.r!=='N/A'),ok=app.filter(x=>x.r==='OK'),bad=app.filter(x=>x.r==='Not OK');return `<span class="${bad.length?'r-bad':'r-ok'}">${ok.length}/${app.length} passed</span>${bad.length?`<div class="note">Failed: ${bad.map(x=>esc(x.t)).join(', ')}</div>`:''}`}
function eqDetailRow(i){const r=i.last,e=i.eq;let b;
  if(!r)b='<p class="note" style="margin:0">No PM has been recorded for this item yet.</p>';
  else{const it=r.items||[],app=it.filter(x=>x.r!=='N/A'),ok=app.filter(x=>x.r==='OK').length,bm=[e.brand,e.model].filter(Boolean).join(' ');
    b=`<div class="eqd"><div class="eqd-meta"><span><span class="k">Checked</span>${fmt(r.date)} by ${esc(r.tech||'—')}</span><span><span class="k">Type</span>${r.kind==='Corrective'?'Repair':'Preventive maintenance'}</span>${it.length?`<span><span class="k">Result</span><b class="${ok===app.length?'r-ok':'r-bad'}">${ok} of ${app.length} conditions passed</b></span>`:''}${bm?`<span><span class="k">Model</span>${esc(bm)}</span>`:''}${e.serial?`<span><span class="k">Serial</span>${esc(e.serial)}</span>`:''}</div>
    ${it.length?`<ul class="eqd-list">${it.map(x=>`<li><span>${esc(x.t)}</span><span class="${x.r==='OK'?'r-ok':x.r==='Not OK'?'r-bad':'r-na'}">${x.r==='OK'?'✓ Passed':x.r==='Not OK'?'✕ Failed':'N/A'}</span></li>`).join('')}</ul>`:'<p class="note" style="margin:0">No checklist was recorded for this check.</p>'}
    ${extraResults(r)}${r.issues?`<div><span class="k">Issue found</span>${esc(r.issues)}</div>`:''}${r.action?`<div><span class="k">Action taken</span>${esc(r.action)}</div>`:''}</div>`}
  return `<tr class="eqd-row"><td colspan="5">${b}</td></tr>`}
function viewDashboard(L){
  const stores=sortedStores();
  if(!S.ready.stores&&!stores.length)return loading('dashboard');
  const H=stores.map(s=>({s,h:storeHealth(s.id,L)}));
  const all=H.flatMap(x=>x.h.items),checked=all.filter(i=>i.last),op=checked.filter(i=>i.status==='Operational').length;
  const overall=checked.length?Math.round(op/checked.length*100):null;
  const fully=H.filter(x=>x.h.checked&&x.h.pct===100&&!x.h.ongoing.length).length;
  const ongoing=H.filter(x=>x.h.ongoing.length);
  const nOngoing=ongoing.reduce((a,x)=>a+x.h.ongoing.length,0),od=all.filter(i=>i.due==='overdue').length;
  const clickable=ROLE.write;
  let h=`<div class="page-head"><div><div class="eyebrow">All branches · as of ${fmt(today())}</div><h1>Store IT Dashboard</h1></div></div>`;
  h+=`<div class="summary"><div class="${overall===100?'okc':overall===null?'':overall>=75?'warn':'bad'}"><b>${overall===null?'—':overall+'%'}</b><span>Equipment operational</span></div><div><b>${fully}/${stores.length}</b><span>Stores fully operational</span></div><div class="${nOngoing?'bad':''}"><b>${nOngoing}</b><span>Ongoing repairs / monitoring</span></div><div class="${od?'warn':''}"><b>${od}</b><span>PM overdue</span></div></div>`;
  h+=`<section class="cat" style="margin-top:0"><h2>Ongoing maintenance and repairs <span>${nOngoing}</span></h2>`;
  if(!nOngoing)h+=`<div class="panel ok-panel">No ongoing maintenance or repairs. All checked equipment is operational.</div>`;
  else{h+=`<div class="tablewrap"><table><thead><tr><th>Store</th><th>Equipment</th><th>Status</th><th>Since</th><th>Issue found</th><th>Action taken</th><th>Technician</th></tr></thead><tbody>`;
    const rank={'Defective':0,'Under Maintenance':1,'For Monitoring':2};
    for(const {s,h:sh} of ongoing){const list=sh.ongoing.slice().sort((a,b)=>rank[a.status]-rank[b.status]);list.forEach((i,k)=>{h+=`<tr>${k===0?`<td rowspan="${list.length}" class="store-cell"><b>${esc(s.name)}</b><div class="note">${esc(s.location||'')}</div></td>`:''}<td><b>${esc(i.eq.name)}</b><div class="note">${esc(i.type.name||'')}</div></td><td><span class="pill s-${slug(i.status)}">${esc(i.status)}</span></td><td style="white-space:nowrap">${fmt(i.lastDate)}<div class="note">${daysBetween(i.lastDate,today())} days</div></td><td class="wrapcell">${esc(i.last.issues||'—')}</td><td class="wrapcell">${esc(i.last.action||'—')}</td><td>${esc(i.last.tech||'—')}</td></tr>`})}
    h+='</tbody></table></div>'}
  h+='</section>';
  h+=`<section class="cat"><h2>All stores <span>${stores.length}</span></h2><p class="note" style="margin:-4px 0 10px">Operational % counts equipment that has been checked. Open a store to see every item's latest check.</p><div class="dash-list">`;
  const sorted=H.slice().sort((a,b)=>(b.h.ongoing.length>0)-(a.h.ongoing.length>0)||(a.h.pct??101)-(b.h.pct??101)||natural(a.s.name,b.s.name));
  for(const {s,h:sh} of sorted){const n=sh.items.length||1,cls=pctClass(sh.pct);
    const seg=[['Operational','ok'],['For Monitoring','warn'],['Under Maintenance','info'],['Defective','bad'],['none','none']].map(([k,c])=>sh.c[k]?`<span class="seg-${c}" style="width:${sh.c[k]/n*100}%"></span>`:'').join('');
    const open=UI.dashOpen&&UI.dashOpen[s.id];
    h+=`<details class="dash-store" data-store="${esc(s.id)}" ${open?'open':''}><summary><div class="ds-head"><div class="ds-name"><h3>${esc(s.name)}</h3><span class="note">${esc([s.type,s.location,isPct(s)?'Percentage lease':'Fixed lease'].filter(Boolean).join(' · '))}</span></div><div class="ds-pct pct-${cls}"><b>${sh.pct===null?'—':sh.pct+'%'}</b><span>${sh.pct===null?'Not checked yet':'Operational'}</span></div><span class="ds-chev" aria-hidden="true">▾</span></div>
    <div class="bar" role="img" aria-label="${sh.c['Operational']} operational, ${sh.c['For Monitoring']} for monitoring, ${sh.c['Under Maintenance']} under maintenance, ${sh.c['Defective']} defective, ${sh.c.none} not checked">${seg}</div>
    <div class="ds-tags">${salesTag(s,L)}<span class="tag ok"><b>${sh.c['Operational']}</b> operational</span>${sh.c['For Monitoring']?`<span class="tag warn"><b>${sh.c['For Monitoring']}</b> for monitoring</span>`:''}${sh.c['Under Maintenance']?`<span class="tag info"><b>${sh.c['Under Maintenance']}</b> under maintenance</span>`:''}${sh.c['Defective']?`<span class="tag bad"><b>${sh.c['Defective']}</b> defective</span>`:''}${sh.c.none?`<span class="tag"><b>${sh.c.none}</b> not checked yet</span>`:''}<span class="note" style="margin-left:auto">Last check ${fmt(sh.last)}</span></div></summary>
    <div class="ds-body">${sh.items.length?`<div class="tablewrap"><table><thead><tr><th>Equipment</th><th>Status</th><th>Last check</th><th>Checklist</th><th>Next PM</th></tr></thead><tbody>${sh.items.map(i=>{const op=!!(UI.dashEq&&UI.dashEq[i.eq.id]);return `<tr class="click eq-toggle${op?' is-open':''}" data-act="dash-eq" data-id="${esc(i.eq.id)}" tabindex="0" aria-expanded="${op}"><td><div class="eq-cell"><span class="eq-chev" aria-hidden="true">${op?'▾':'▸'}</span><div><b>${esc(i.eq.name)}</b><div class="note">${esc(i.type.name||'')}</div></div></div></td><td><span class="pill s-${slug(i.status)}">${esc(i.status||'Not checked yet')}</span></td><td style="white-space:nowrap">${fmt(i.lastDate)}${i.last?.tech?`<div class="note">${esc(i.last.tech)}</div>`:''}</td><td>${checksCell(i)}</td><td class="due-${i.due}" style="white-space:nowrap">${i.due==='none'?'—':fmt(i.next)}${i.due==='overdue'?'<div class="note r-bad">Overdue</div>':''}</td></tr>${op?eqDetailRow(i):''}`}).join('')}</tbody></table></div>`:'<p class="note">No equipment listed for this store yet.</p>'}</div></details>`}
  return h+'</div></section>'}
function subnav(a){return `<div class="filters"><div class="seg" role="group" aria-label="Schedule view"><button data-act="go" data-id="schedule" aria-pressed="${a==='schedule'}">Upcoming PM</button><button data-act="go" data-id="history" aria-pressed="${a==='history'}">Maintenance History <span class="mono">${Object.keys(S.pm).length}</span></button></div></div>`}
function histFiltered(){const q=(UI.hQ||'').toLowerCase().trim();return Object.values(S.pm).filter(r=>{if(UI.hStore&&r.storeId!==UI.hStore)return false;if(UI.hKind!=='all'&&(r.kind||'Preventive')!==UI.hKind)return false;if(UI.hFrom&&(r.date||'')<UI.hFrom)return false;if(UI.hTo&&(r.date||'')>UI.hTo)return false;if(q){const e=S.equipment[r.equipmentId]||{};const hay=[e.name,e.typeId?typeName(e.typeId):'',S.stores[r.storeId]?.name,r.tech,r.issues,r.action,r.status,r.kind==='Corrective'?'repair corrective':'pm preventive'].join(' ').toLowerCase();if(!hay.includes(q))return false}return true}).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.createdAt||0)-(a.createdAt||0))}
function historyResults(){const all=Object.keys(S.pm).length;
  if(!all)return S.ready.pm?`<div class="empty"><h3>No maintenance recorded yet</h3><p>PM and repair records from every store will be listed here.</p></div>`:loading('history');
  const recs=histFiltered();
  if(!recs.length)return `<div class="empty"><h3>No records match</h3><p>Try another search, store, type or date range.</p></div>`;
  const corr=recs.filter(r=>r.kind==='Corrective').length;
  let h=`<p class="note" style="margin:0 0 8px">${recs.length} record${recs.length===1?'':'s'} · ${corr} repair${corr===1?'':'s'}${recs.length>300?' · showing the latest 300 (narrow the filters or export to see all)':''}</p><div class="tablewrap"><table><thead><tr><th>Date</th><th>Store</th><th>Equipment</th><th>Type</th><th>Status</th><th>Issues found</th><th>Action taken</th><th>Technician</th></tr></thead><tbody>`;
  for(const r of recs.slice(0,300)){const e=S.equipment[r.equipmentId];const st=S.stores[r.storeId]||{};const rep=r.kind==='Corrective';
    h+=`<tr ${e?`class="click" data-act="go" data-id="item-${esc(e.id)}"`:''}><td style="white-space:nowrap">${fmt(r.date)}</td><td>${esc(st.name||r.storeName||'—')}</td><td><b>${esc(e?e.name:((r.equipmentName||'Item')+' (removed)'))}</b><div class="note">${esc(e?typeName(e.typeId):'')}</div></td><td><span class="chip ${rep?'chip-rep':''}">${rep?'Repair':'PM'}</span></td><td><span class="pill s-${slug(r.status)}">${esc(r.status||'—')}</span></td><td class="wrapcell">${esc(r.issues||'—')}</td><td class="wrapcell">${esc(r.action||'—')}</td><td>${esc(r.tech||'—')}</td></tr>`}
  return h+'</tbody></table></div>'}
function viewHistory(){
  const filtered=UI.hQ||UI.hStore||UI.hKind!=='all'||UI.hFrom||UI.hTo;
  let h=`<div class="page-head"><div><div class="eyebrow">All branches</div><h1>PM Schedule</h1></div><div class="actions"><button class="btn" data-act="export-history">Export ${filtered?'these records':'PM history'} (CSV)</button></div></div>${subnav('history')}`;
  h+=`<div class="filters"><input class="inp" id="hist-q" type="search" placeholder="Search equipment, issue, action or technician" value="${esc(UI.hQ)}" style="flex:1 1 260px;width:auto" aria-label="Search maintenance history">
  <select class="inp auto" id="hist-store" aria-label="Filter by store"><option value="">All stores</option>${sortedStores().map(s=>`<option value="${esc(s.id)}" ${UI.hStore===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
  <div class="seg" role="group" aria-label="Filter by record type">${[['all','All'],['Preventive','PM only'],['Corrective','Repairs only']].map(([k,l])=>`<button data-act="hist-kind" data-id="${k}" aria-pressed="${UI.hKind===k}">${l}</button>`).join('')}</div>
  <span class="date-range"><label class="note" for="hist-from">From</label><input class="inp auto" type="date" id="hist-from" value="${esc(UI.hFrom)}"><label class="note" for="hist-to">To</label><input class="inp auto" type="date" id="hist-to" value="${esc(UI.hTo)}"></span>
  ${filtered?'<button class="btn ghost sm" data-act="hist-clear">Clear filters</button>':''}</div><div id="hist-results">${historyResults()}</div>`;
  return h}

function viewIssues(L){
  const infos=Object.values(S.equipment).map(e=>eqInfo(e,L)).filter(i=>['Defective','Under Maintenance','For Monitoring'].includes(i.status));
  let h=`<div class="page-head"><div><div class="eyebrow">All branches</div><h1>Defective Equipment</h1></div></div>`;
  if(!infos.length)return h+`<div class="empty"><h3>No equipment needs attention</h3><p>Items show here when their latest PM marks them Defective, Under Maintenance or For Monitoring.</p></div>`;
  for(const st of ['Defective','Under Maintenance','For Monitoring']){const items=infos.filter(i=>i.status===st).sort((a,b)=>(a.lastDate||'').localeCompare(b.lastDate||''));if(!items.length)continue;
    h+=`<section class="cat"><h2>${st} <span>${items.length}</span></h2><div class="tablewrap"><table><thead><tr><th>Store</th><th>Equipment</th><th>Since</th><th>Issue found</th><th>Action taken</th><th>Technician</th></tr></thead><tbody>`;
    for(const i of items){const s=S.stores[i.eq.storeId]||{};h+=`<tr class="click" data-act="go" data-id="item-${esc(i.eq.id)}"><td>${esc(s.name||'—')}</td><td><b>${esc(i.eq.name)}</b><div class="note">${esc(i.type.name||'')}</div></td><td>${fmt(i.lastDate)}<div class="note">${daysBetween(i.lastDate,today())} days</div></td><td class="wrapcell">${esc(i.last.issues||'—')}</td><td class="wrapcell">${esc(i.last.action||'—')}</td><td>${esc(i.last.tech||'—')}</td></tr>`}
    h+='</tbody></table></div></section>'}
  return h+`<p class="note">To close an item, open it and record a PM or repair with the new status.</p>`;
}

function viewSetup(){
  const types=Object.values(S.types).sort((a,b)=>CATS.indexOf(a.category)-CATS.indexOf(b.category)||natural(a.name,b.name));
  let h=`<div class="page-head"><div><div class="eyebrow">Admin</div><h1>Equipment Types</h1></div><div class="actions"><button class="btn primary" data-act="add-type">+ Add type</button></div></div>
  <p class="note" style="max-width:70ch">Each type sets its category, how often PM is due, and the checklist used in its PM form. Changing a checklist affects new PM records only; past records keep the checklist they were done with.</p>`;
  if(!types.length)return h+`<div class="empty"><h3>No equipment types yet</h3><p>Add a type (for example All-in-One POS) with its checklist.</p></div>`;
  for(const c of CATS){const items=types.filter(t=>(t.category||'Other')===c);if(!items.length)continue;
    h+=`<section class="cat"><h2>${esc(c)} <span>${items.length}</span></h2><div class="list types-list">${items.map(t=>{const used=Object.values(S.equipment).filter(e=>e.typeId===t.id).length;return `<div class="t-row"><div class="eq-main"><span class="eq-name">${esc(t.name)}</span><span class="muted">${(t.checklist||[]).length} checklist items${(t.software||[]).length?` · ${(t.software||[]).length} software`:''}${t.salesSending?' · daily sales':''} · ${freqLabel(t.freqMonths)} · used by ${used}</span></div><span></span><button class="btn sm" data-act="edit-type" data-id="${esc(t.id)}">Edit</button></div>`}).join('')}</div></section>`}
  h+=`<section class="cat"><h2>Who can do what</h2><div class="panel"><dl class="info"><dt><b>Admin</b></dt><dd>Adds and edits stores, equipment, types and users; can delete records.</dd><dt><b>IT Staff</b></dt><dd>Records PM and repairs. Cannot change stores, equipment or types.</dd><dt><b>Manager</b></dt><dd>Sees only the Dashboard. Cannot record or change anything.</dd></dl><p class="note" style="margin:10px 0 0">Approve new accounts and set roles in the <a href="#users">Users</a> tab.</p></div></section>`;
  return h;
}

/* ---------- sheets (forms) ---------- */
function openSheet(title,body,foot){document.getElementById('sheet-root').innerHTML=`<div class="sheet-bg" data-act="sheet-bg"><form class="sheet" id="sheet-form" role="dialog" aria-modal="true" aria-label="${esc(title)}" novalidate><div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="btn ghost sm" data-act="close" aria-label="Close">✕</button></div><div class="sheet-body">${body}</div><div class="sheet-foot">${foot}</div></form></div>`;const f=document.querySelector('#sheet-form input,#sheet-form select,#sheet-form textarea');f&&f.focus()}
function closeSheet(){document.getElementById('sheet-root').innerHTML=''}
const fld=(id,label,inner)=>`<div class="field"><label for="${id}">${label}</label>${inner}</div>`;
const inp=(id,label,val,type='text',extra='')=>fld(id,label,`<input class="inp" id="${id}" name="${id}" type="${type}" value="${esc(val||'')}" ${extra}>`);
const sel=(id,label,opts,val)=>fld(id,label,`<select class="inp" id="${id}" name="${id}">${opts.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${v===val?'selected':''}>${esc(l)}</option>`}).join('')}</select>`);
const ta=(id,label,val,extra='')=>fld(id,label,`<textarea class="inp" id="${id}" name="${id}" ${extra}>${esc(val||'')}</textarea>`);
const v=id=>(document.getElementById(id)?.value||'').trim();
let onSubmit=null;

function storeForm(s){
  const isNew=!s;s=s||{};
  openSheet(isNew?'Add store':'Edit store',
    `<div class="row2">${inp('f-name','Store name *',s.name,'text','required')}${inp('f-code','Store code',s.code)}</div><div class="row2">${sel('f-type','Store type',STORE_TYPES,s.type||'In-Line')}${inp('f-loc','Location / Mall',s.location)}</div>
    <div class="row2">${sel('f-lease','Lease type',LEASE_TYPES,s.leaseType||'Fixed')}<div></div></div>
    <div class="subbox" id="sales-box" ${isPct(s)?'':'hidden'}><p class="note" style="margin:0">Percentage-lease stores send daily sales to the mall. This is checked during POS PM.</p>
    <div class="row2">${sel('f-mall','Mall operator',MALLS.map(m=>m[0]),s.mallOperator||'SM Supermalls')}${inp('f-iface','Daily sales interface',s.mallInterface||mallIface(s.mallOperator||'SM Supermalls'))}</div>
    ${inp('f-tenant','Tenant / store ID for sales sending (optional)',s.tenantId)}</div>
    ${ta('f-notes','Notes',s.notes)}`,
    `${isNew?'':`<button type="button" class="btn danger" data-act="del-store" data-id="${esc(s.id)}" style="margin-right:auto">Delete store</button>`}<button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary" type="submit">${isNew?'Add store':'Save'}</button>`);
  const lease=document.getElementById('f-lease'),box=document.getElementById('sales-box'),mall=document.getElementById('f-mall'),iface=document.getElementById('f-iface');let ifaceTouched=!!s.mallInterface;
  lease.addEventListener('change',()=>{box.hidden=lease.value!=='Percentage'});iface.addEventListener('input',()=>ifaceTouched=true);mall.addEventListener('change',()=>{if(!ifaceTouched||!iface.value)iface.value=mallIface(mall.value)});
  onSubmit=async()=>{if(!v('f-name'))return toast('Enter a store name.',true);const id=s.id||newId('store');const pct=v('f-lease')==='Percentage';if(pct&&!v('f-iface'))return toast('Enter the daily sales interface (for example SIA Mosaic).',true);
    if(await put('stores/'+id,{name:v('f-name'),code:v('f-code'),type:v('f-type'),location:v('f-loc'),notes:v('f-notes'),leaseType:v('f-lease'),mallOperator:pct?v('f-mall'):'',mallInterface:pct?v('f-iface'):'',tenantId:pct?v('f-tenant'):'',updatedAt:Date.now()})){closeSheet();toast(isNew?'Store added':'Store saved');if(isNew)location.hash='store-'+id}};
}

function typeOptions(){const types=Object.values(S.types);return CATS.flatMap(c=>types.filter(t=>(t.category||'Other')===c).sort((a,b)=>natural(a.name,b.name)).map(t=>[t.id,`${t.name} — ${c}`]))}
function suggestName(typeId,storeId,qty,excludeId){const t=S.types[typeId];if(!t)return '';const base=t.prefix||t.name;const n=storeEquip(storeId).filter(e=>e.typeId===typeId&&e.id!==excludeId).length;return qty>1||n>0?`${base} ${n+1}`:base}
function eqForm(e,storeId){
  const isNew=!e;e=e||{storeId};const opts=typeOptions();const tId=e.typeId||opts[0]?.[0]||'';
  if(!opts.length){toast('Add an equipment type first (Equipment Types tab).',true);return}
  openSheet(isNew?'Add equipment':'Edit equipment',
    `<div class="row2">${sel('f-type','Equipment type *',opts,tId)}${isNew?inp('f-qty','Quantity','1','number','min="1" max="20"'):sel('f-store','Store',sortedStores().map(s=>[s.id,s.name]),e.storeId)}</div>
    ${inp('f-name','Name *',isNew?suggestName(tId,storeId,1):e.name,'text','required')}
    <p class="note" id="qty-note" hidden>Items will be numbered automatically.</p>
    <div class="row2">${inp('f-brand','Brand',e.brand)}${inp('f-model','Model',e.model)}</div>
    <div class="row2">${inp('f-serial','Serial No.',e.serial)}${inp('f-ip','IP Address',e.ip)}</div>
    <div class="row2">${inp('f-purch','Date purchased',e.purchased,'date')}${inp('f-warr','Warranty end',e.warranty,'date')}</div>${ta('f-notes','Notes',e.notes)}`,
    `${isNew?'':`<button type="button" class="btn danger" data-act="del-eq" data-id="${esc(e.id)}" style="margin-right:auto">Delete</button>`}<button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary" type="submit">${isNew?'Add':'Save'}</button>`);
  let nameTouched=!isNew;
  const nameEl=document.getElementById('f-name');nameEl.addEventListener('input',()=>nameTouched=true);
  const refresh=()=>{const q=Math.max(1,Math.min(20,parseInt(v('f-qty')||'1')||1));if(!nameTouched)nameEl.value=suggestName(v('f-type'),storeId,q);const qn=document.getElementById('qty-note');if(qn)qn.hidden=q<2};
  if(isNew){document.getElementById('f-type').addEventListener('change',refresh);document.getElementById('f-qty').addEventListener('input',refresh)}
  onSubmit=async()=>{if(!v('f-name'))return toast('Enter a name for this equipment.',true);
    const base={typeId:v('f-type'),brand:v('f-brand'),model:v('f-model'),ip:v('f-ip'),purchased:v('f-purch'),warranty:v('f-warr'),notes:v('f-notes'),updatedAt:Date.now()};
    if(!isNew){const {id:_omit,...rest}=e;if(await put('equipment/'+e.id,{...rest,...base,storeId:v('f-store')||e.storeId,name:v('f-name'),serial:v('f-serial')})){closeSheet();toast('Equipment saved')}return}
    const q=Math.max(1,Math.min(20,parseInt(v('f-qty')||'1')||1));
    let name=v('f-name');const m=name.match(/^(.*?)(\d+)$/);const stem=m?m[1]:name+' ',start=m?parseInt(m[2]):1;
    for(let k=0;k<q;k++){const nm=q>1?`${stem}${start+k}`:name;const ok=await put('equipment/'+newId('eq'),{...base,storeId,name:nm,serial:q>1?'':v('f-serial')});if(!ok)return}
    closeSheet();toast(q>1?`${q} items added`:'Equipment added')};
}

function addEqForm(storeId){
  const types=Object.values(S.types);
  if(!types.length){toast('Add an equipment type first (Equipment Types tab).',true);return}
  const s=S.stores[storeId]||{};
  const counts={};storeEquip(storeId).forEach(e=>counts[e.typeId]=(counts[e.typeId]||0)+1);
  let body=`<p class="note" style="margin:0">Tick what is installed at ${esc(s.name||'this store')} and set how many. Add brand, model and serial later from each item's Edit.</p>`;
  for(const c of CATS){const items=types.filter(t=>(t.category||'Other')===c).sort((a,b)=>natural(a.name,b.name));if(!items.length)continue;
    body+=`<div class="pick-cat">${esc(c)}</div><div class="checks">${items.map(t=>`<div class="pick-row"><label class="pick-l"><input type="checkbox" data-pick="${esc(t.id)}"><span class="pick-n">${esc(t.name)}</span>${counts[t.id]?`<span class="note">${counts[t.id]} already here</span>`:''}</label><span class="qty"><button type="button" data-act="qty" data-id="${esc(t.id)}" data-d="-1" aria-label="Fewer ${esc(t.name)}">−</button><input type="number" min="1" max="20" value="1" inputmode="numeric" data-qty="${esc(t.id)}" aria-label="Quantity of ${esc(t.name)}"><button type="button" data-act="qty" data-id="${esc(t.id)}" data-d="1" aria-label="More ${esc(t.name)}">+</button></span></div>`).join('')}</div>`}
  openSheet(`Add equipment · ${s.name||''}`,body,`<span class="note" id="pick-sum" style="margin-right:auto;align-self:center">Nothing selected</span><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary" type="submit" id="pick-go" disabled>Add equipment</button>`);
  const form=document.getElementById('sheet-form');
  form.addEventListener('input',ev=>{const q=ev.target.dataset.qty;if(q){const cb=form.querySelector(`[data-pick="${CSS.escape(q)}"]`);if(cb)cb.checked=true}pickSum()});
  form.addEventListener('change',pickSum);
  let busy=false;
  onSubmit=async()=>{if(busy)return;const picks=pickList();if(!picks.length)return toast('Tick at least one equipment type.',true);busy=true;document.getElementById('pick-go').disabled=true;
    let total=0;
    for(const {typeId,q} of picks){const t=S.types[typeId]||{};const base=t.prefix||t.name||'Item';const n=counts[typeId]||0;
      for(let k=0;k<q;k++){const nm=(q===1&&n===0)?base:`${base} ${n+k+1}`;if(!await put('equipment/'+newId('eq'),{storeId,typeId,name:nm,brand:'',model:'',serial:'',ip:'',purchased:'',warranty:'',notes:'',updatedAt:Date.now()})){busy=false;const g=document.getElementById('pick-go');if(g)g.disabled=false;return}total++}}
    closeSheet();toast(`${total} item${total===1?'':'s'} added`)};
}
function pickList(){return [...document.querySelectorAll('#sheet-form [data-pick]:checked')].map(cb=>{const id=cb.dataset.pick;const inp=document.querySelector(`#sheet-form [data-qty="${CSS.escape(id)}"]`);return{typeId:id,q:Math.max(1,Math.min(20,parseInt(inp?.value)||1))}})}
function pickSum(){const p=pickList(),n=p.reduce((a,b)=>a+b.q,0);const el=document.getElementById('pick-sum'),go=document.getElementById('pick-go');if(el)el.textContent=n?`${n} item${n===1?'':'s'} from ${p.length} type${p.length===1?'':'s'}`:'Nothing selected';if(go)go.disabled=!n}

function typeForm(t){
  const isNew=!t;t=t||{category:'POS & Computers',freqMonths:1,checklist:[]};
  openSheet(isNew?'Add equipment type':'Edit equipment type',
    `<div class="row2">${inp('f-name','Type name *',t.name,'text','required')}${inp('f-prefix','Default item name',t.prefix,'text','placeholder="e.g. POS"')}</div>
    <div class="row2">${sel('f-cat','Category',CATS,t.category)}${sel('f-freq','PM frequency',[['1','Monthly'],['2','Every 2 months'],['3','Quarterly'],['6','Every 6 months'],['12','Yearly']],String(t.freqMonths||1))}</div>
    ${ta('f-check','Checklist — one item per line *',(t.checklist||[]).join('\n'),'style="min-height:180px"')}
    ${ta('f-soft','Software to check — one per line (optional)',(t.software||[]).join('\n'),'style="min-height:120px" placeholder="WebPOS&#10;AnyDesk&#10;UltraViewer"')}
    <label class="checkline"><input type="checkbox" id="f-sales" ${t.salesSending?'checked':''}><span>This equipment sends daily sales to the mall. The daily sales checks appear in its PM form at Percentage-lease stores.</span></label>`,
    `${isNew?'':`<button type="button" class="btn danger" data-act="del-type" data-id="${esc(t.id)}" style="margin-right:auto">Delete type</button>`}<button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary" type="submit">${isNew?'Add type':'Save'}</button>`);
  onSubmit=async()=>{const list=v('f-check').split('\n').map(x=>x.trim()).filter(Boolean);if(!v('f-name'))return toast('Enter a type name.',true);if(!list.length)return toast('Add at least one checklist item.',true);
    const soft=v('f-soft').split('\n').map(x=>x.trim()).filter(Boolean);const id=t.id||newId('type');if(await put('types/'+id,{name:v('f-name'),prefix:v('f-prefix'),category:v('f-cat'),freqMonths:Number(v('f-freq'))||1,checklist:list,software:soft,salesSending:!!document.getElementById('f-sales')?.checked,updatedAt:Date.now()})){closeSheet();toast(isNew?'Type added':'Type saved')}};
}

function pmForm(e){
  const t=S.types[e.typeId]||{checklist:[],freqMonths:1};const s=S.stores[e.storeId]||{};const L=latestMap();const prev=L[e.id];const showSales=isPct(s)&&!!t.salesSending;
  const d=today();
  openSheet(`Record PM · ${e.name}`,
    `<p class="note" style="margin:0">${esc(s.name||'')} · ${esc(t.name||'')}${e.serial?' · SN '+esc(e.serial):''}</p>
    <div class="row2">${inp('f-date','Inspection date *',d,'date','required')}${inp('f-tech','Technician *',myName,'text','required')}</div>
    ${sel('f-kind','Maintenance type',['Preventive','Corrective / Repair'],'Preventive')}
    <div class="field"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><label>Preventive maintenance checklist</label><button type="button" class="btn sm" data-act="all-ok">Mark all OK</button></div>
    <div class="checks">${radioRows('c',t.checklist||[],LBL_CHECK)||'<div class="check-row muted">This type has no checklist yet.</div>'}</div></div>
    ${(t.software||[]).length?`<div class="field"><label>Software</label><div class="checks">${radioRows('sw',t.software,LBL_SOFT)}</div></div>`:''}
    ${showSales?`<div class="field"><label>Daily sales sending · ${esc(s.mallInterface||'Mall interface')}${s.mallOperator?` (${esc(s.mallOperator)})`:''}</label><div class="checks">${radioRows('sl',SALES_CHECKS,LBL_SALES)}</div>${inp('f-lastsent','Last successful send (optional)','','date')}</div>`:''}
    <div class="field"><label>Equipment status *</label><div class="status-pick" role="radiogroup" aria-label="Equipment status">${STATUSES.map(st=>`<label title="${esc(STATUS_HELP[st])}"><input type="radio" name="f-status" value="${st}" ${(prev?.status||'Operational')===st?'checked':''}><span class="pill s-${slug(st)}">${st}</span></label>`).join('')}</div></div>
    ${ta('f-issues','Issues found',prev&&prev.status!=='Operational'?prev.issues:'','placeholder="Leave blank if none"')}
    ${ta('f-action','Action taken','')}
    ${inp('f-next','Next maintenance',addMonths(d,t.freqMonths||1),'date')}
    <p class="note" style="margin:0">Next maintenance is set from the date and this type's frequency (${freqLabel(t.freqMonths).toLowerCase()}). You can change it.</p>`,
    `<button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary" type="submit">Save PM record</button>`);
  let nextTouched=false;const nx=document.getElementById('f-next');nx.addEventListener('input',()=>nextTouched=true);
  document.getElementById('f-date').addEventListener('change',()=>{if(!nextTouched)nx.value=addMonths(v('f-date'),t.freqMonths||1)});
  onSubmit=async()=>{
    if(!v('f-date'))return toast('Enter the inspection date.',true);if(!v('f-tech'))return toast('Enter the technician name.',true);
    const items=(t.checklist||[]).map((c,k)=>({t:c,r:document.querySelector(`input[name="c${k}"]:checked`)?.value||''}));
    const missing=items.filter(x=>!x.r).length;if(missing)return toast(`Answer all checklist items (${missing} left).`,true);
    const sw=readRadios('sw',t.software||[]);const swLeft=sw.filter(x=>!x.r).length;if(swLeft)return toast(`Answer all software items (${swLeft} left).`,true);
    let sales=null;if(showSales){const it=readRadios('sl',SALES_CHECKS);const left=it.filter(x=>!x.r).length;if(left)return toast(`Answer all daily sales checks (${left} left).`,true);sales={interface:s.mallInterface||'',operator:s.mallOperator||'',items:it,lastSent:v('f-lastsent')}}
    const status=document.querySelector('input[name="f-status"]:checked')?.value;if(!status)return toast('Choose the equipment status.',true);
    const by=null;
    const rec={equipmentId:e.id,storeId:e.storeId,date:v('f-date'),tech:v('f-tech'),kind:v('f-kind').startsWith('Corrective')?'Corrective':'Preventive',items,software:sw,sales,status,issues:v('f-issues'),action:v('f-action'),next:v('f-next'),by:by||'',createdAt:Date.now()};
    if(await put('pm/'+newId('pm'),rec)){closeSheet();toast('PM record saved')}};
}

function confirmSheet(title,msg,label,fn){openSheet(title,`<p style="margin:0">${msg}</p>`,`<button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary" type="submit" style="background:var(--bad);border-color:var(--bad);color:#fff">${esc(label)}</button>`);onSubmit=fn}

/* ---------- export ---------- */
function csv(rows){return '﻿'+rows.map(r=>r.map(c=>{const s=String(c??'');return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}).join(',')).join('\r\n')}
async function saveFile(name,data){try{const blob=new Blob([data],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast('File downloaded')}catch(e){toast("The file couldn't be saved.",true)}}
function exportMaster(){const L=latestMap();const rows=[['Store','Store Code','Store Type','Lease Type','Daily Sales Interface','Category','Equipment Type','Name','Brand','Model','Serial No.','IP Address','Date Purchased','Warranty End','Status','Last PM','Next PM','PM State']];
  for(const s of sortedStores())for(const e of sortEquip(storeEquip(s.id))){const i=eqInfo(e,L);rows.push([s.name,s.code,s.type,s.leaseType||'Fixed',isPct(s)?s.mallInterface:'',i.type.category,i.type.name,e.name,e.brand,e.model,e.serial,e.ip,e.purchased,e.warranty,i.status||'No PM yet',i.lastDate,i.next,{overdue:'Overdue',soon:'Due soon',ok:'OK',none:'No PM yet'}[i.due]])}
  saveFile(`Equipment_Masterlist_${today()}.csv`,csv(rows))}
function exportHistory(list){const rows=[['Date','Store','Equipment','Type','Maintenance Type','Technician','Status','Checklist OK','Checklist Not OK','Not OK Items','Issues Found','Action Taken','Next Maintenance','Software Issues','Daily Sales Check']];
  const recs=(list||Object.values(S.pm)).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  for(const r of recs){const e=S.equipment[r.equipmentId]||{};const items=r.items||[];rows.push([r.date,S.stores[r.storeId]?.name||r.storeName||'',e.name||(r.equipmentName?r.equipmentName+' (removed)':'(removed)'),e.typeId?typeName(e.typeId):(r.typeName||''),r.kind,r.tech,r.status,items.filter(x=>x.r==='OK').length,items.filter(x=>x.r==='Not OK').length,items.filter(x=>x.r==='Not OK').map(x=>x.t).join('; '),r.issues,r.action,r.next,(r.software||[]).filter(x=>x.r==='Not OK').map(x=>x.t).join('; '),r.sales?((r.sales.items||[]).some(x=>x.r==='Not OK')?'Issue: '+(r.sales.items||[]).filter(x=>x.r==='Not OK').map(x=>x.t).join('; '):'OK')+(r.sales.interface?' ('+r.sales.interface+')':''):''])}
  saveFile(`PM_History_${today()}.csv`,csv(rows))}

/* ---------- events ---------- */
document.addEventListener('click',async ev=>{
  const el=ev.target.closest('[data-act]');if(!el)return;const act=el.dataset.act,id=el.dataset.id;
  if(act==='sheet-bg'){if(ev.target===el)closeSheet();return}
  if(act==='close'){closeSheet();return}
  if(act==='go'){location.hash=id;return}
  if(act==='add-store')return storeForm();
  if(act==='edit-store')return storeForm(S.stores[id]);
  if(act==='add-eq')return addEqForm(id);
  if(act==='qty'){const inp=document.querySelector(`#sheet-form [data-qty="${CSS.escape(id)}"]`);if(inp){inp.value=Math.max(1,Math.min(20,(parseInt(inp.value)||1)+Number(el.dataset.d)));const cb=document.querySelector(`#sheet-form [data-pick="${CSS.escape(id)}"]`);if(cb&&el.dataset.d==='1')cb.checked=true;pickSum()}return}
  if(act==='edit-eq')return eqForm(S.equipment[id]);
  if(act==='add-type')return typeForm();
  if(act==='edit-type')return typeForm(S.types[id]);
  if(act==='pm')return pmForm(S.equipment[id]);
  if(act==='all-ok'){document.querySelectorAll('.check-row input[value="OK"]').forEach(i=>i.checked=true);return}
  if(act==='sched-filter'){UI.schedFilter=id;render();return}
  if(act==='export-master')return exportMaster();
  if(act==='export-history')return exportHistory(route().v==='history'?histFiltered():null);
  if(act==='hist-kind'){UI.hKind=id;render();return}
  if(act==='end-preview'){setPreview('');return}
  if(act==='signout'){await sb.auth.signOut();location.hash='';return}
  if(act==='auth-mode'){AUTH.screen=id;AUTH.err='';AUTH.msg='';render();return}
  if(act==='recheck'){onSession((await sb.auth.getSession()).data.session,'RECHECK',true);return}
  if(act==='u-approve'||act==='u-enable'){const sel=document.getElementById('role-'+id);const role=sel?sel.value:(USERS.find(u=>u.id===id)?.role||'staff');return updateUser(id,{status:'approved',role,approved_at:new Date().toISOString(),approved_by:PROFILE.id},'Access approved')}
  if(act==='u-reject')return updateUser(id,{status:'rejected'},'Request rejected');
  if(act==='u-disable'){const u=USERS.find(x=>x.id===id);return confirmSheet('Disable account?',`<b>${esc(u?.full_name||u?.email)}</b> will no longer be able to see or change anything. You can enable them again later.`,'Disable',async()=>{if(await updateUser(id,{status:'disabled'},'Account disabled'))closeSheet()})}
  if(act==='dash-eq'){UI.dashEq=UI.dashEq||{};UI.dashEq[id]=!UI.dashEq[id];render();return}
  if(act==='hist-clear'){Object.assign(UI,{hKind:'all',hStore:'',hQ:'',hFrom:'',hTo:''});render();return}
  if(act==='del-store'){const s=S.stores[id],n=storeEquip(id).length;return confirmSheet('Delete store?',`Delete <b>${esc(s?.name)}</b> and its ${n} equipment item${n===1?'':'s'}? PM history stays in the export but will no longer show here.`,'Delete store',async()=>{for(const e of storeEquip(id))if(!await del('equipment/'+e.id))return;if(await del('stores/'+id)){closeSheet();toast('Store deleted');location.hash='stores'}})}
  if(act==='del-eq'){const e=S.equipment[id];return confirmSheet('Delete equipment?',`Delete <b>${esc(e?.name)}</b> from ${esc(S.stores[e?.storeId]?.name||'this store')}?`,'Delete',async()=>{if(await del('equipment/'+id)){closeSheet();toast('Equipment deleted');location.hash='store-'+e.storeId}})}
  if(act==='del-type'){const used=Object.values(S.equipment).filter(e=>e.typeId===id).length;if(used)return toast(`This type is used by ${used} item${used>1?'s':''}. Change or delete them first.`,true);return confirmSheet('Delete type?',`Delete <b>${esc(S.types[id]?.name)}</b>?`,'Delete type',async()=>{if(await del('types/'+id)){closeSheet();toast('Type deleted')}})}
  if(act==='del-pm')return confirmSheet('Delete PM record?','This removes the record from the history. Use it only to fix a mistake.','Delete record',async()=>{if(await del('pm/'+id)){closeSheet();toast('Record deleted')}});
});
document.addEventListener('submit',ev=>{if(ev.target.id==='sheet-form'){ev.preventDefault();onSubmit&&onSubmit()}});
document.addEventListener('change',ev=>{const t=ev.target;if(t.id==='view-as'){setPreview(t.value);return}if(t.classList&&t.classList.contains('u-role')&&t.dataset.live==='1'){updateUser(t.dataset.id,{role:t.value},'Role updated');return}if(t.id==='sched-store'){UI.schedStore=t.value;render()}else if(t.id==='hist-store'){UI.hStore=t.value;render()}else if(t.id==='hist-from'){UI.hFrom=t.value;render()}else if(t.id==='hist-to'){UI.hTo=t.value;render()}});
document.addEventListener('keydown',ev=>{const t=ev.target;if((ev.key==='Enter'||ev.key===' ')&&t&&t.dataset&&t.dataset.act==='dash-eq'){ev.preventDefault();t.click()}});
document.addEventListener('toggle',ev=>{const d=ev.target;if(d&&d.classList&&d.classList.contains('dash-store')){UI.dashOpen=UI.dashOpen||{};UI.dashOpen[d.dataset.store]=d.open}},true);
let histT;document.addEventListener('input',ev=>{if(ev.target.id==='hist-q'){UI.hQ=ev.target.value;clearTimeout(histT);histT=setTimeout(()=>{const box=document.getElementById('hist-results');if(box)box.innerHTML=historyResults()},150)}});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&document.getElementById('sheet-root').innerHTML)closeSheet()});

/* ---------- auth screens ---------- */
const val=id=>document.getElementById(id)?.value||'';
function authErr(e){const m=(e&&e.message)||'';if(/invalid login credentials/i.test(m))return 'Wrong email or password.';if(/email not confirmed/i.test(m))return 'Confirm your email first. Open the link we sent to your inbox (check spam too).';if(/rate limit|too many/i.test(m))return 'Too many attempts. Wait a minute, then try again.';if(/already registered/i.test(m))return 'That email already has an account. Sign in instead.';if(/fetch|network/i.test(m))return "Couldn't reach the server. Check your connection.";return m||'Something went wrong. Try again.'}
function authCard(title,body,foot){return `<div class="auth-wrap"><form class="auth-card" id="auth-form" novalidate><div class="auth-brand"><img src="assets/logo.png" alt=""><span>TEI Store PMS</span></div><h1>${title}</h1>${AUTH.err?`<div class="auth-err" role="alert">${esc(AUTH.err)}</div>`:''}${AUTH.msg?`<div class="auth-msg" role="status">${esc(AUTH.msg)}</div>`:''}${body}</form>${foot||''}</div>`}
function renderAuth(){
  document.getElementById('nav').innerHTML='';renderMe();
  const s=AUTH.screen;let h='';
  if(s==='loading')h=`<div class="auth-wrap"><div class="empty"><h3>Loading…</h3></div></div>`;
  else if(s==='login')h=authCard('Sign in',`${inp('a-email','Email','','email','autocomplete="email" required')}${inp('a-pass','Password','','password','autocomplete="current-password" required')}<button class="btn primary block" type="submit">Sign in</button><div class="auth-links"><button type="button" class="linkbtn" data-act="auth-mode" data-id="forgot">Forgot password?</button></div>`,`<p class="auth-alt">New to the PMS? <button type="button" class="linkbtn" data-act="auth-mode" data-id="register">Create an account</button></p>`);
  else if(s==='register')h=authCard('Create an account',`<p class="note" style="margin:0">After you confirm your email, an admin approves your account and sets your role.</p>${inp('a-name','Full name','','text','autocomplete="name" required')}${inp('a-email','Work email','','email','autocomplete="email" required')}${inp('a-pass','Password (at least 8 characters)','','password','autocomplete="new-password" required minlength="8"')}${inp('a-pass2','Confirm password','','password','autocomplete="new-password" required')}<button class="btn primary block" type="submit">Create account</button>`,`<p class="auth-alt">Already have an account? <button type="button" class="linkbtn" data-act="auth-mode" data-id="login">Sign in</button></p>`);
  else if(s==='forgot')h=authCard('Reset your password',`<p class="note" style="margin:0">Enter your email and we'll send you a link to set a new password.</p>${inp('a-email','Email','','email','autocomplete="email" required')}<button class="btn primary block" type="submit">Send reset link</button>`,`<p class="auth-alt"><button type="button" class="linkbtn" data-act="auth-mode" data-id="login">Back to sign in</button></p>`);
  else if(s==='recovery')h=authCard('Set a new password',`${inp('a-pass','New password (at least 8 characters)','','password','autocomplete="new-password" required minlength="8"')}${inp('a-pass2','Confirm new password','','password','autocomplete="new-password" required')}<button class="btn primary block" type="submit">Save new password</button>`);
  else if(s==='check-email')h=authCard('Check your email',`<p style="margin:0">We sent a confirmation link to <b>${esc(AUTH.pendingEmail||'your email')}</b>. Open it to confirm your account (check spam too).</p><p class="note" style="margin:0">After that, an admin needs to approve your account before you can use the PMS.</p><button type="button" class="btn block" data-act="auth-mode" data-id="login">Back to sign in</button>`);
  else if(s==='pending')h=authCard('Waiting for approval',`<p style="margin:0">Your account <b>${esc(PROFILE?.email||'')}</b> is set up. An admin needs to approve it and give you a role before you can see the PMS.</p><p class="note" style="margin:0">Ask your IT admin to approve you, then press Check again.</p><div class="auth-actions"><button type="button" class="btn primary" data-act="recheck">Check again</button><button type="button" class="btn" data-act="signout">Sign out</button></div>`);
  else if(s==='denied')h=authCard('No access',`<p style="margin:0">The account <b>${esc(PROFILE?.email||'')}</b> doesn't have access to the PMS. It may have been rejected or disabled.</p><p class="note" style="margin:0">Contact your IT admin if you think this is a mistake.</p><div class="auth-actions"><button type="button" class="btn" data-act="signout">Sign out</button></div>`);
  document.getElementById('app').innerHTML=h;
  const first=document.querySelector('#auth-form input');if(first&&!document.activeElement?.closest?.('#auth-form'))first.focus();
}
document.addEventListener('submit',async ev=>{
  if(ev.target.id!=='auth-form')return;ev.preventDefault();
  const s=AUTH.screen,btn=ev.target.querySelector('button[type="submit"]');if(btn)btn.disabled=true;AUTH.err='';AUTH.msg='';
  try{
    if(s==='login'){const email=v('a-email'),password=val('a-pass');if(!email||!password)throw{message:'Enter your email and password.'};const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;return}
    if(s==='register'){const name=v('a-name'),email=v('a-email'),p1=val('a-pass'),p2=val('a-pass2');if(!name)throw{message:'Enter your full name.'};if(!email)throw{message:'Enter your email.'};if(p1.length<8)throw{message:'Use a password with at least 8 characters.'};if(p1!==p2)throw{message:"The passwords don't match."};
      const {data,error}=await sb.auth.signUp({email,password:p1,options:{data:{full_name:name},emailRedirectTo:BASE_URL}});if(error)throw error;if(!data.session){AUTH.screen='check-email';AUTH.pendingEmail=email}}
    else if(s==='forgot'){const email=v('a-email');if(!email)throw{message:'Enter your email.'};const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:BASE_URL});if(error)throw error;AUTH.msg='If that email has an account, a reset link is on its way. Check your inbox and spam folder.'}
    else if(s==='recovery'){const p1=val('a-pass'),p2=val('a-pass2');if(p1.length<8)throw{message:'Use a password with at least 8 characters.'};if(p1!==p2)throw{message:"The passwords don't match."};const {error}=await sb.auth.updateUser({password:p1});if(error)throw error;toast('Password updated');AUTH.screen='loading';render();onSession((await sb.auth.getSession()).data.session,'RECHECK',true);return}
  }catch(e){AUTH.err=authErr(e)}
  render();
});

/* ---------- session ---------- */
let currentUid=null;
async function onSession(session,event,force){
  if(event==='PASSWORD_RECOVERY'){AUTH.screen='recovery';AUTH.err='';AUTH.msg='';render();return}
  if(AUTH.screen==='recovery'&&session&&!force)return;
  if(!session){
    currentUid=null;PROFILE=null;ROLE_READY=false;REAL={admin:false,write:false};ROLE={admin:false,write:false};PREVIEW='';USERS=[];myName='';
    for(const k of ['stores','types','equipment','pm']){S[k]={};S.ready[k]=false}
    if(!['register','forgot','check-email'].includes(AUTH.screen))AUTH.screen='login';
    render();return}
  if(!force&&currentUid===session.user.id&&(ROLE_READY||AUTH.screen==='pending'||AUTH.screen==='denied'))return;
  currentUid=session.user.id;
  const {data,error}=await sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle();
  if(error){AUTH.screen='login';AUTH.err=errMsg(error);render();return}
  PROFILE=data;
  if(!PROFILE||(PROFILE.status!=='approved'&&PROFILE.status!=='pending')){ROLE_READY=false;AUTH.screen='denied';render();return}
  if(PROFILE.status==='pending'){ROLE_READY=false;AUTH.screen='pending';AUTH.err='';render();return}
  ROLE.admin=PROFILE.role==='admin';ROLE.write=PROFILE.role!=='manager';REAL={...ROLE};PREVIEW='';
  myName=PROFILE.full_name||PROFILE.email||'';ROLE_READY=true;AUTH.screen='';AUTH.err='';AUTH.msg='';
  renderMe();render();await loadAll();if(REAL.admin)loadUsers();
}

/* ---------- users (admin) ---------- */
const ROLE_NAMES={admin:'Admin',staff:'IT Staff',manager:'Manager'};
async function updateUser(id,patch,msg){const {data,error}=await sb.from('profiles').update(patch).eq('id',id).select().maybeSingle();
  if(error||!data){toast(error?errMsg(error):"Couldn't update this user.",true);return false}
  USERS=USERS.map(u=>u.id===id?data:u);toast(msg);render();return true}
function roleSelect(u,live){const self=u.id===PROFILE?.id;return `<select class="inp auto u-role" id="role-${esc(u.id)}" data-id="${esc(u.id)}" data-live="${live?1:0}" aria-label="Role for ${esc(u.full_name||u.email)}" ${self?'disabled':''}>${Object.entries(ROLE_NAMES).map(([k,l])=>`<option value="${k}" ${u.role===k?'selected':''}>${l}</option>`).join('')}</select>`}
function fmtTs(ts){return ts?fmt(String(ts).slice(0,10)):'—'}
function viewUsers(){
  const pend=USERS.filter(u=>u.status==='pending'),active=USERS.filter(u=>u.status==='approved'),off=USERS.filter(u=>u.status==='rejected'||u.status==='disabled');
  const who=u=>`<b>${esc(u.full_name||'(no name)')}</b>${u.id===PROFILE?.id?' <span class="chip">You</span>':''}`;
  let h=`<div class="page-head"><div><div class="eyebrow">Admin</div><h1>Users</h1></div><div class="actions"><button class="btn" data-act="reload-users">Refresh</button></div></div>
  <p class="note" style="max-width:72ch">People create their own account from the sign-in page. Approve them here and choose their role. Accounts that aren't approved can't see any data.</p>`;
  h+=`<section class="cat"><h2>Waiting for approval <span>${pend.length}</span></h2>`;
  if(!pend.length)h+=`<div class="panel note">No pending requests.</div>`;
  else h+=`<div class="tablewrap"><table><thead><tr><th>Name</th><th>Email</th><th>Registered</th><th>Role to give</th><th></th></tr></thead><tbody>${pend.map(u=>`<tr><td>${who(u)}</td><td>${esc(u.email)}</td><td style="white-space:nowrap">${fmtTs(u.created_at)}</td><td>${roleSelect(u,false)}</td><td style="white-space:nowrap"><button class="btn primary sm" data-act="u-approve" data-id="${esc(u.id)}">Approve</button> <button class="btn sm danger" data-act="u-reject" data-id="${esc(u.id)}">Reject</button></td></tr>`).join('')}</tbody></table></div>`;
  h+=`</section><section class="cat"><h2>Active users <span>${active.length}</span></h2>`;
  h+=`<div class="tablewrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Approved</th><th></th></tr></thead><tbody>${active.map(u=>`<tr><td>${who(u)}</td><td>${esc(u.email)}</td><td>${roleSelect(u,true)}</td><td style="white-space:nowrap">${fmtTs(u.approved_at)}</td><td>${u.id===PROFILE?.id?'':`<button class="btn sm" data-act="u-disable" data-id="${esc(u.id)}">Disable</button>`}</td></tr>`).join('')}</tbody></table></div>`;
  h+=`<p class="note">Role changes apply the next time that person loads the page.</p></section>`;
  if(off.length)h+=`<section class="cat"><h2>Rejected or disabled <span>${off.length}</span></h2><div class="tablewrap"><table><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Role if enabled</th><th></th></tr></thead><tbody>${off.map(u=>`<tr><td>${who(u)}</td><td>${esc(u.email)}</td><td><span class="chip">${u.status==='rejected'?'Rejected':'Disabled'}</span></td><td>${roleSelect(u,false)}</td><td><button class="btn sm" data-act="u-enable" data-id="${esc(u.id)}">Approve</button></td></tr>`).join('')}</tbody></table></div></section>`;
  return h;
}
document.addEventListener('click',ev=>{if(ev.target.closest('[data-act="reload-users"]'))loadUsers()});

/* ---------- background refresh ---------- */
function refreshNow(){if(!ROLE_READY||document.visibilityState!=='visible'||document.getElementById('sheet-root').innerHTML)return;loadAll();if(REAL.admin)loadUsers()}
setInterval(refreshNow,60000);
document.addEventListener('visibilitychange',refreshNow);

/* ---------- boot ---------- */
(function boot(){
  if(!window.supabase||!window.CONFIG){document.getElementById('app').innerHTML='<div class="empty"><h3>The app could not start</h3><p>Check your internet connection, then reload the page.</p></div>';return}
  const h=location.hash;
  if(/error_description=|error_code=/.test(h)){const p=new URLSearchParams(h.slice(1));AUTH.err=p.get('error_code')==='otp_expired'?'That email link has expired or was already used. Sign in, or request a new link.':(p.get('error_description')||'That link did not work.').replace(/\+/g,' ');history.replaceState(null,'',BASE_URL)}
  sb=supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  render();
  sb.auth.onAuthStateChange((event,session)=>{if(event==='TOKEN_REFRESHED')return;setTimeout(()=>onSession(session,event),0)});
})();
