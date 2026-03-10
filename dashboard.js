/* ══════════════════════════════════════════════════════
   KINGSWAY HOSPITAL — INTERACTIVE DASHBOARD
   Full CRUD via Socket.io + REST | Modals | Toasts
══════════════════════════════════════════════════════ */

// ── Clock ─────────────────────────────────────────────
(function(){ const el=document.getElementById('clock');
  if(!el)return; const t=()=>el.textContent=new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  t(); setInterval(t,1000);
})();

// ── Live State ────────────────────────────────────────
const S = { resources:[], units:[], inventory:[], staff:[], alerts:[], socket:null };

// ── Helpers ───────────────────────────────────────────
const $  = id => document.getElementById(id);
const q  = sel => document.querySelector(sel);
const qa = sel => document.querySelectorAll(sel);
function setText(id,v){ const e=$(id); if(e)e.textContent=v; }
function setWidth(id,w){ const e=$(id); if(e)e.style.width=w; }
function flash(id){ const e=$(id); if(!e)return; e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); }
const ICONS = {bed:'🛏',icu:'🏥',ventilator:'💨',xray:'🩻',default:'📦'};
function sbar(s){
  const map={available:'AVAILABLE',occupied:'OCCUPIED',in_use:'IN USE',sanitizing:'SANITIZING',processing:'PROCESSING'};
  const cls={available:'status-available',occupied:'status-occupied',in_use:'status-in_use',sanitizing:'status-sanitizing',processing:'status-processing'};
  return `<span class="status-badge ${cls[s]||'status-processing'}">${map[s]||s.toUpperCase()}</span>`;
}
function scol(s){ return s==='critical'?'var(--critical)':s==='warning'?'var(--warning)':'var(--good)'; }

// ── Toast ─────────────────────────────────────────────
function toast(msg, type='info', ms=3000){
  const wrap=$('toastWrap');
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  const icons={success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  el.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span style="flex:1">${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.animation='slideOutRight .25s ease forwards'; setTimeout(()=>el.remove(),260); }, ms);
}

// ── Modal ─────────────────────────────────────────────
function openModal(html){
  const box=$('modalBox');
  const overlay=$('modalOverlay');
  box.innerHTML=html;
  overlay.classList.add('open');
}
function closeModal(){
  $('modalOverlay').classList.remove('open');
}

// ── DB Badge ──────────────────────────────────────────
function setDB(connected, mode){
  const dot=$('dbDot'), txt=$('dbText');
  if(!dot||!txt)return;
  dot.style.background = connected ? 'var(--good)' : 'var(--warning)';
  txt.style.color = connected ? 'var(--good)' : 'var(--text-secondary)';
  txt.style.fontWeight = connected ? '700' : '400';
  txt.textContent = mode || (connected ? 'MongoDB' : 'In-Memory');
}

// ── Page Router ───────────────────────────────────────
const TITLES = {dashboard:'Command Dashboard',units:'Hospital Units',inventory:'Inventory Management',alerts:'System Alerts',staff:'Staff Directory',predictions:'Predictions'};
let page = 'dashboard';
let charts = {};

function go(p){
  qa('.page').forEach(x=>x.classList.remove('active'));
  qa('.nav-item').forEach(x=>x.classList.remove('active'));
  const pg=$(`page-${p}`); if(pg) pg.classList.add('active');
  const nv=q(`.nav-item[data-page="${p}"]`); if(nv) nv.classList.add('active');
  setText('pageTitle', TITLES[p]||p);
  page=p; render(p);
}
function render(p){
  if(p==='dashboard')   drawDash();
  if(p==='units')       drawUnits();
  if(p==='inventory')   drawInv();
  if(p==='alerts')      drawAlerts();
  if(p==='staff')       drawStaff();
  if(p==='predictions') drawPred();
}
qa('.nav-item').forEach(n=>n.addEventListener('click',e=>{ e.preventDefault(); go(n.dataset.page); }));

/* ════════════════════════════════════════════════════
   DASHBOARD
═════════════════════════════════════════════════════ */
function drawDash(){
  drawResources();
  drawStaffTab();
  if(typeof Chart!=='undefined') initOccChart(98);
}

function drawResources(){
  const el=$('resourceList'); if(!el)return;
  const data=S.resources.length ? S.resources : FB.resources;
  el.innerHTML = data.map(r=>`
    <div class="resource-item" onclick="modalResource('${r.id}')">
      <div class="resource-icon-wrap ${r.type||'default'}">${ICONS[r.type]||ICONS.default}</div>
      <div class="resource-info">
        <div class="resource-name">${r.name}</div>
        <div class="resource-dept">${r.department}</div>
      </div>
      <div class="resource-meta">${sbar(r.status)}${r.note?`<div class="resource-note">${r.note}</div>`:''}</div>
    </div>`).join('');
}

function drawStaffTab(){
  const el=$('staffTabList'); if(!el)return;
  const data=(S.staff.length?S.staff:FB.staff).slice(0,6);
  el.innerHTML = data.map(s=>`
    <div class="resource-item" onclick="modalStaff('${s.id}')">
      <div class="resource-icon-wrap default">👤</div>
      <div class="resource-info">
        <div class="resource-name">${s.name}</div>
        <div class="resource-dept">${s.role} · ${s.dept}</div>
      </div>
      <div class="resource-meta">
        <span class="status-badge ${s.status==='on-duty'?'status-available':s.status==='standby'?'status-in_use':'status-processing'}">${s.status.toUpperCase()}</span>
        <div class="resource-note">${s.shift}</div>
      </div>
    </div>`).join('');
}

function renderEmergency(d){
  const icuPct = Math.round(d.icu_capacity||94);
  const vU=d.ventilators_in_use||112, vT=d.ventilators_total||128;
  const vPct = Math.round(vU/vT*100);
  setText('statICUVal',  icuPct+'%');       flash('statICUVal');
  setText('statICUSub',  `${d.icu_beds_active||42}/${d.icu_beds_total||45} Beds Active`);
  setWidth('statICUBar', icuPct+'%');
  setText('statVentVal', vPct+'%');         setWidth('statVentBar', vPct+'%');
  setText('statStaffVal',d.staff_on_duty||142); flash('statStaffVal');
  setText('statStandbySub',`${d.staff_standby||18} on Standby`);
  setText('icuPct',    icuPct+'% Occupied');  setWidth('icuBar',  icuPct+'%');
  setText('icuActive', `${d.icu_beds_active||42}/${d.icu_beds_total||45} Beds Active`);
  setText('icuRemain', `${(d.icu_beds_total||45)-(d.icu_beds_active||42)} Beds Remaining`);
  setText('ventPct',   vPct+'% In Use');      setWidth('ventBar', vPct+'%');
  setText('ventActive',`${vU}/${vT} Units Active`);
  setText('ventRemain',`${vT-vU} Units Available`);
  setText('staffDuty',   d.staff_on_duty||142);
  setText('staffStandby',d.staff_standby||18);
  const z=$('activeZone'); if(z)z.innerHTML=`<span>📍</span> ${d.zone_restricted||'Zone 4'}: Restricted`;
}

function renderPredLive(d){
  setText('predMinutes', d.icu_full_minutes||45);
  setText('predConf',    (d.confidence||94)+'%');
  setText('chartPeak',   (d.peak_forecast_pct||98)+'%');
  setWidth('statPeakBar',(d.peak_forecast_pct||98)+'%');
  setText('statPeakVal', (d.peak_forecast_pct||98)+'%');
  setText('predHeroPct', (d.peak_forecast_pct||98)+'%');
  setText('predHeroConf',(d.confidence||94)+'%');
  setWidth('confFill',   (d.confidence||94)+'%');
  if(d.alerts){
    const el=$('thresholdAlerts');
    if(el) el.innerHTML=d.alerts.map((a,i)=>`
      <div class="threshold-item">
        <div class="threshold-dot ${i===0?'warning':'critical'}"></div>
        <div><div class="threshold-title">${a.title}</div><div class="threshold-sub">${a.sub}</div></div>
      </div>`).join('');
  }
  if(typeof Chart!=='undefined') initOccChart(d.peak_forecast_pct||98);
}

// Resource modal
window.modalResource = function(id){
  const data=S.resources.length?S.resources:FB.resources;
  const r=data.find(x=>x.id===id); if(!r)return;
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${ICONS[r.type]||'📦'} ${r.name}</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="modal-info-grid">
        <div class="modal-info-item"><div class="modal-info-label">Department</div><div class="modal-info-val">${r.department}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Type</div><div class="modal-info-val">${r.type}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Note</div><div class="modal-info-val">${r.note||'—'}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Status</div><div class="modal-info-val">${sbar(r.status)}</div></div>
      </div>
      <div class="modal-section-title">Update Status</div>
      <div class="modal-btn-group">
        ${['available','occupied','in_use','sanitizing','processing'].map(st=>`
          <button class="modal-status-btn ${r.status===st?'active':''}" onclick="setResStatus('${r.id}','${st}')">${st.replace('_',' ').toUpperCase()}</button>`).join('')}
      </div>
    </div>`);
};
window.setResStatus=function(id,status){
  const r=(S.resources.length?S.resources:FB.resources).find(x=>x.id===id);
  if(r) r.status=status;
  S.socket?.emit('update_resource_status',{id,status});
  closeModal(); drawResources();
  toast(`Resource status → ${status.replace('_',' ')}`, 'success');
};

/* ════════════════════════════════════════════════════
   UNITS
═════════════════════════════════════════════════════ */
let unitFilter='all';
function drawUnits(f){
  f=f||unitFilter;
  const grid=$('unitsGrid'); if(!grid)return;
  const data=S.units.length?S.units:FB.units;
  const list=f==='all'?data:data.filter(u=>u.category===f);
  grid.innerHTML=list.map(u=>{
    const occ=Math.round(u.occupied/u.beds*100);
    return `
    <div class="unit-card" onclick="modalUnit('${u.id}')">
      <div class="unit-card-header">
        <div><div class="unit-name">${u.name}</div><div class="unit-dept">${u.dept}</div></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="unit-icon">${u.icon}</span>
          <span class="tag tag-${u.status==='critical'?'critical':u.status==='warning'?'warning':'good'}">${u.status.toUpperCase()}</span>
        </div>
      </div>
      <div class="unit-metrics">
        <div class="unit-metric"><div class="um-label">BEDS</div><div class="um-val">${u.occupied}/${u.beds}</div></div>
        <div class="unit-metric"><div class="um-label">STAFF</div><div class="um-val">${u.staff}</div></div>
      </div>
      <div class="unit-occ-bar">
        <div class="unit-occ-label"><span>Occupancy</span><span>${occ}%</span></div>
        <div class="unit-bar"><div class="unit-bar-fill" style="width:${occ}%;background:${scol(u.status)}"></div></div>
      </div>
    </div>`;
  }).join('');
  if(!list.length) grid.innerHTML='<div style="color:var(--text-muted);padding:20px;font-size:13px">No units match this filter.</div>';
}

window.modalUnit=function(id){
  const data=S.units.length?S.units:FB.units;
  const u=data.find(x=>x.id===id); if(!u)return;
  const occ=Math.round(u.occupied/u.beds*100);
  openModal(`
    <div class="modal-header">
      <div class="modal-title">${u.icon} ${u.name}</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="modal-info-grid">
        <div class="modal-info-item"><div class="modal-info-label">Department</div><div class="modal-info-val">${u.dept}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Category</div><div class="modal-info-val">${u.category}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Beds (Occupied / Total)</div><div class="modal-info-val" style="font-size:18px;font-weight:800;color:${scol(u.status)}">${u.occupied}/${u.beds}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Staff On Duty</div><div class="modal-info-val" style="font-size:18px;font-weight:800">${u.staff}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Occupancy</div><div class="modal-info-val" style="font-size:18px;font-weight:800;color:${scol(u.status)}">${occ}%</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Status</div><div class="modal-info-val"><span class="tag tag-${u.status==='critical'?'critical':u.status==='warning'?'warning':'good'}">${u.status.toUpperCase()}</span></div></div>
      </div>
      <div class="modal-section-title">Update Occupied Beds</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
        <button class="modal-qty-btn" onclick="adjUnit(-5)">−5</button>
        <button class="modal-qty-btn" onclick="adjUnit(-1)">−1</button>
        <input type="number" id="uOccInp" value="${u.occupied}" min="0" max="${u.beds}" class="modal-input" style="width:80px;text-align:center">
        <button class="modal-qty-btn" onclick="adjUnit(1)">+1</button>
        <button class="modal-qty-btn" onclick="adjUnit(5)">+5</button>
        <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">/ ${u.beds} beds</span>
      </div>
      <div class="modal-footer" style="padding:16px 0 0;border-top:0;gap:10px">
        <button class="btn-primary" onclick="saveUnit('${u.id}',${u.beds})">Save Changes</button>
        <button class="btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </div>`);
};
window.adjUnit=function(d){ const i=$('uOccInp'); if(i)i.value=Math.max(0,parseInt(i.value||0)+d); };
window.saveUnit=function(id,maxBeds){
  const v=Math.min(parseInt($('uOccInp')?.value||0), maxBeds);
  const data=S.units.length?S.units:FB.units;
  const u=data.find(x=>x.id===id); if(!u)return;
  const pct=Math.round(v/u.beds*100);
  const ns=pct>=90?'critical':pct>=70?'warning':'ok';
  u.occupied=v; u.status=ns;
  fetch(`/api/units/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({occupied:v,status:ns})}).catch(()=>{});
  closeModal(); drawUnits();
  toast(`${u.name} — ${v}/${u.beds} beds occupied (${pct}%)`,'success');
};

$('unitsFilterGroup')?.addEventListener('click',e=>{
  if(!e.target.matches('.filter-btn'))return;
  qa('#unitsFilterGroup .filter-btn').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active'); unitFilter=e.target.dataset.filter; drawUnits(unitFilter);
});

/* ════════════════════════════════════════════════════
   INVENTORY
═════════════════════════════════════════════════════ */
let invFilter='all';
function drawInv(f){
  f=f||invFilter;
  const tbody=$('inventoryBody'); if(!tbody)return;
  const data=S.inventory.length?S.inventory:FB.inventory;
  tbody.innerHTML=data.map(item=>{
    const tc=item.status==='not_available'?'tag-critical':item.status==='low'?'tag-warning':'tag-good';
    const tl=item.status==='not_available'?'NOT AVAILABLE':item.status==='low'?'LOW STOCK':'AVAILABLE';
    const bc=item.status==='not_available'?'var(--critical)':item.status==='low'?'var(--warning)':'var(--good)';
    const bp=item.status==='not_available'?12:item.status==='low'?42:85;
    const hide=f!=='all'&&item.status!==f?'hidden-row':'';
    return `
    <tr class="${hide}" onclick="modalInv('${item.id}')" style="cursor:pointer">
      <td><strong>${item.name}</strong></td>
      <td><div class="stock-bar"><span class="stock-num">${item.stock}</span><div class="stock-mini-bar"><div class="stock-mini-fill" style="width:${bp}%;background:${bc}"></div></div></div></td>
      <td><span class="tag ${tc}">${tl}</span></td>
    </tr>`;
  }).join('');
  const all=S.inventory.length?S.inventory:FB.inventory;
  setText('invCritCount', all.filter(i=>i.status==='not_available').length);
  setText('invLowCount',  all.filter(i=>i.status==='low').length);
  setText('invOkCount',   all.filter(i=>i.status==='ok').length);
  setText('invTotalCount',all.length);
}

window.modalInv=function(id){
  const data=S.inventory.length?S.inventory:FB.inventory;
  const item=data.find(x=>x.id===id); if(!item)return;
  const tc=item.status==='not_available'?'tag-critical':item.status==='low'?'tag-warning':'tag-good';
  const tl=item.status==='not_available'?'NOT AVAILABLE':item.status==='low'?'LOW STOCK':'AVAILABLE';
  openModal(`
    <div class="modal-header">
      <div class="modal-title">📦 ${item.name}</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="modal-info-grid">
        <div class="modal-info-item"><div class="modal-info-label">Current Stock</div><div class="modal-info-val" style="font-size:32px;font-weight:800;color:var(--text)">${item.stock}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Status</div><div class="modal-info-val"><span class="tag ${tc}">${tl}</span></div></div>
      </div>
      <div class="modal-section-title">Adjust Stock Count</div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:8px;flex-wrap:wrap">
        <button class="modal-qty-btn" onclick="adjInv(-50)">−50</button>
        <button class="modal-qty-btn" onclick="adjInv(-10)">−10</button>
        <button class="modal-qty-btn" onclick="adjInv(-1)">−1</button>
        <input type="number" id="iStockInp" value="${item.stock}" min="0" class="modal-input" style="width:80px;text-align:center">
        <button class="modal-qty-btn" onclick="adjInv(1)">+1</button>
        <button class="modal-qty-btn" onclick="adjInv(10)">+10</button>
        <button class="modal-qty-btn" onclick="adjInv(50)">+50</button>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Status auto-updates: &lt;10 = Not Available · &lt;50 = Low Stock · ≥50 = Available</div>
      <div class="modal-footer" style="padding:16px 0 0;border-top:0">
        <button class="btn-primary" onclick="saveInv('${item.id}')">Save Stock</button>
        <button class="btn-outline" onclick="closeModal()">Cancel</button>
      </div>
    </div>`);
};
window.adjInv=function(d){ const i=$('iStockInp'); if(i)i.value=Math.max(0,parseInt(i.value||0)+d); };
window.saveInv=function(id){
  const ns=parseInt($('iStockInp')?.value||0);
  const data=S.inventory.length?S.inventory:FB.inventory;
  const item=data.find(x=>x.id===id); if(!item)return;
  const newStatus=ns<10?'not_available':ns<50?'low':'ok';
  item.stock=ns; item.status=newStatus;
  if(S.socket) S.socket.emit('update_inventory_stock',{id,stock:ns});
  else fetch(`/api/inventory/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({stock:ns})}).catch(()=>{});
  closeModal(); drawInv();
  toast(`${item.name} stock updated → ${ns} units`,'success');
};

$('invFilterGroup')?.addEventListener('click',e=>{
  if(!e.target.matches('.filter-btn'))return;
  qa('#invFilterGroup .filter-btn').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active'); invFilter=e.target.dataset.invFilter; drawInv(invFilter);
});

/* ════════════════════════════════════════════════════
   ALERTS
═════════════════════════════════════════════════════ */
let alertFilter='all';
function drawAlerts(f){
  f=f||alertFilter;
  const list=$('alertsList'); if(!list)return;
  const data=S.alerts.length?S.alerts:FB.alerts;
  const shown=f==='all'?data:data.filter(a=>a.severity===f);
  list.innerHTML=shown.map(a=>`
    <div class="alert-item ${a.read?'read':''}" id="alert-${a.id}" onclick="modalAlert('${a.id}')">
      <div class="alert-severity-bar ${a.severity}"></div>
      <div class="alert-icon-wrap ${a.severity}">${a.icon}</div>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.desc}</div>
        <div class="alert-meta">
          <span class="alert-time">${a.time}</span>
          <span class="alert-dept">${a.dept}</span>
          ${!a.read?'<span class="tag tag-blue">NEW</span>':''}
        </div>
      </div>
      <div class="alert-actions" onclick="event.stopPropagation()">
        <button class="alert-action-btn" onclick="doRead('${a.id}')">Mark Read</button>
        <button class="alert-action-btn dismiss" onclick="doDismiss('${a.id}')">Dismiss</button>
      </div>
    </div>`).join('');
  if(!shown.length) list.innerHTML='<div style="color:var(--text-muted);padding:40px;text-align:center;font-size:13px">No alerts in this category.</div>';
  const all=S.alerts.length?S.alerts:FB.alerts;
  const unread=all.filter(a=>!a.read).length;
  const badge=$('alertBadge');
  if(badge){badge.textContent=unread; badge.style.display=unread?'inline-block':'none';}
}

window.modalAlert=function(id){
  const data=S.alerts.length?S.alerts:FB.alerts;
  const a=data.find(x=>x.id===id); if(!a)return;
  const sc=a.severity==='critical'?'var(--critical)':a.severity==='warning'?'var(--warning)':'var(--blue)';
  const tc=a.severity==='critical'?'tag-critical':a.severity==='warning'?'tag-warning':'tag-blue';
  openModal(`
    <div class="modal-header">
      <div class="modal-title" style="color:${sc}">${a.icon} ${a.title}</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="modal-info-grid">
        <div class="modal-info-item"><div class="modal-info-label">Severity</div><div class="modal-info-val"><span class="tag ${tc}">${a.severity.toUpperCase()}</span></div></div>
        <div class="modal-info-item"><div class="modal-info-label">Department</div><div class="modal-info-val">${a.dept}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Raised</div><div class="modal-info-val">${a.time}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Read Status</div><div class="modal-info-val">${a.read?'<span style="color:var(--text-muted)">Read</span>':'<span class="tag tag-blue">UNREAD</span>'}</div></div>
      </div>
      <div class="modal-desc-box">${a.desc}</div>
      <div style="display:flex;gap:10px;margin-top:4px">
        ${!a.read?`<button class="btn-primary" onclick="doRead('${a.id}');closeModal()">✓ Mark as Read</button>`:''}
        <button class="btn-outline" style="color:var(--critical);border-color:var(--critical-border)" onclick="doDismiss('${a.id}');closeModal()">✕ Dismiss Alert</button>
      </div>
    </div>`);
};

window.doRead=function(id){
  const data=S.alerts.length?S.alerts:FB.alerts;
  const a=data.find(x=>x.id===id); if(a) a.read=true;
  if(S.socket) S.socket.emit('mark_alert_read',{id});
  else fetch(`/api/alerts/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({read:true})}).catch(()=>{});
  drawAlerts(alertFilter); toast('Alert marked as read','info');
};
window.doDismiss=function(id){
  if(S.socket) S.socket.emit('dismiss_alert',{id});
  else fetch(`/api/alerts/${id}`,{method:'DELETE'}).catch(()=>{});
  S.alerts=S.alerts.filter(x=>x.id!==id);
  FB.alerts=FB.alerts.filter(x=>x.id!==id);
  drawAlerts(alertFilter); toast('Alert dismissed','success');
};

$('clearAlertsBtn')?.addEventListener('click',()=>{
  const data=S.alerts.length?S.alerts:FB.alerts;
  const ids=data.filter(a=>a.read).map(a=>a.id);
  ids.forEach(id=>{ if(S.socket)S.socket.emit('dismiss_alert',{id}); else fetch(`/api/alerts/${id}`,{method:'DELETE'}).catch(()=>{}); });
  S.alerts=S.alerts.filter(a=>!a.read);
  FB.alerts=FB.alerts.filter(a=>!a.read);
  drawAlerts(alertFilter);
  toast(`${ids.length} read alert${ids.length===1?'':'s'} cleared`,'success');
});

$('alertFilterGroup')?.addEventListener('click',e=>{
  if(!e.target.matches('.filter-btn'))return;
  qa('#alertFilterGroup .filter-btn').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active'); alertFilter=e.target.dataset.alertFilter; drawAlerts(alertFilter);
});

/* ════════════════════════════════════════════════════
   STAFF
═════════════════════════════════════════════════════ */
let staffFilter='all';
function drawStaff(f){
  f=f||staffFilter;
  const grid=$('staffGrid'); if(!grid)return;
  const data=S.staff.length?S.staff:FB.staff;
  const shown=f==='all'?data:data.filter(s=>s.status===f);
  grid.innerHTML=shown.map(s=>`
    <div class="staff-card" onclick="modalStaff('${s.id}')">
      <div class="staff-avatar ${s.status}">${s.initials}</div>
      <div class="staff-name">${s.name}</div>
      <div class="staff-role">${s.role}</div>
      <div class="staff-shift">${s.shift}</div>
      <div class="staff-meta">
        <span class="staff-dept">${s.dept}</span>
        <span class="staff-status-dot ${s.status}"></span>
      </div>
    </div>`).join('');
  if(!shown.length) grid.innerHTML='<div style="color:var(--text-muted);padding:20px;font-size:13px">No staff in this category.</div>';
}

window.modalStaff=function(id){
  const data=S.staff.length?S.staff:FB.staff;
  const s=data.find(x=>x.id===id); if(!s)return;
  const sc={'on-duty':'var(--good)','standby':'var(--warning)','off':'var(--text-muted)'};
  openModal(`
    <div class="modal-header">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="staff-avatar ${s.status}" style="margin:0;flex-shrink:0">${s.initials}</div>
        <div>
          <div class="modal-title" style="margin:0">${s.name}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${s.role} · ${s.dept}</div>
        </div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="modal-info-grid">
        <div class="modal-info-item"><div class="modal-info-label">Shift</div><div class="modal-info-val">${s.shift}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Current Status</div><div class="modal-info-val" style="color:${sc[s.status]};font-weight:700">${s.status.toUpperCase()}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Phone</div><div class="modal-info-val">${s.phone||'—'}</div></div>
        <div class="modal-info-item"><div class="modal-info-label">Email</div><div class="modal-info-val" style="font-size:12px">${s.email||'—'}</div></div>
      </div>
      <div class="modal-section-title">Update Status</div>
      <div class="modal-btn-group">
        <button class="modal-status-btn ${s.status==='on-duty'?'active':''}" style="${s.status==='on-duty'?'background:var(--good);color:#fff;border-color:var(--good)':''}" onclick="setStaffStatus('${s.id}','on-duty')">ON DUTY</button>
        <button class="modal-status-btn ${s.status==='standby'?'active':''}" style="${s.status==='standby'?'background:var(--warning);color:#fff;border-color:var(--warning)':''}" onclick="setStaffStatus('${s.id}','standby')">STANDBY</button>
        <button class="modal-status-btn ${s.status==='off'?'active':''}" onclick="setStaffStatus('${s.id}','off')">OFF DUTY</button>
      </div>
    </div>`);
};
window.setStaffStatus=function(id,status){
  const data=S.staff.length?S.staff:FB.staff;
  const s=data.find(x=>x.id===id); if(!s)return;
  s.status=status;
  if(S.socket) S.socket.emit('update_staff_status',{id,status});
  else fetch(`/api/staff/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})}).catch(()=>{});
  closeModal(); drawStaff(staffFilter);
  if(page==='dashboard') drawStaffTab();
  toast(`${s.name} → ${status}`,'success');
};

$('staffFilterGroup')?.addEventListener('click',e=>{
  if(!e.target.matches('.filter-btn'))return;
  qa('#staffFilterGroup .filter-btn').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active'); staffFilter=e.target.dataset.staffFilter; drawStaff(staffFilter);
});

/* ════════════════════════════════════════════════════
   PREDICTIONS
═════════════════════════════════════════════════════ */
const DEPT_FC=[
  {name:'ICU Wing A',    pct:97,trend:'+8%', status:'critical'},
  {name:'Emergency',     pct:82,trend:'+5%', status:'warning'},
  {name:'Standard Wards',pct:73,trend:'+2%', status:'ok'},
  {name:'Cardiac Care',  pct:90,trend:'+11%',status:'critical'},
  {name:'Pediatrics',    pct:62,trend:'-1%', status:'ok'},
  {name:'Surgery',       pct:55,trend:'+3%', status:'ok'},
];
const PRED_AL=[
  {severity:'critical',title:'ICU full capacity in ~45 min',sub:'Confidence: 94% — Immediate diversion advised',conf:'94%'},
  {severity:'critical',title:'Cardiac Care beds at 100% by 7:00 PM',sub:'Confidence: 88%',conf:'88%'},
  {severity:'warning', title:'Ventilator shortage below 10% by 6:00 PM',sub:'Resource allocation suggested',conf:'81%'},
  {severity:'warning', title:'ER staffing shortage — North Wing 7:30 PM',sub:'Confidence: 78%',conf:'78%'},
];
function drawPred(){
  const df=$('deptForecasts');
  if(df) df.innerHTML=DEPT_FC.map(d=>`
    <div class="dept-forecast-item" onclick="toast('${d.name}: ${d.pct}% forecast — Trend ${d.trend} vs yesterday','${d.status==='critical'?'error':d.status==='warning'?'warning':'info'}')">
      <div class="dept-forecast-header">
        <span>${d.name}</span>
        <span class="dept-forecast-pct" style="color:${scol(d.status)}">${d.pct}%</span>
      </div>
      <div class="dept-forecast-bar"><div class="dept-forecast-fill" style="width:${d.pct}%;background:${scol(d.status)}"></div></div>
      <div class="dept-forecast-sub">Trend: <strong>${d.trend}</strong> vs. yesterday</div>
    </div>`).join('');

  const pa=$('predAlertsFull');
  if(pa) pa.innerHTML=PRED_AL.map(a=>`
    <div class="pred-alert-item" onclick="toast('${a.title} · Confidence ${a.conf}','${a.severity==='critical'?'error':'warning'}',4000)">
      <div class="pred-alert-dot ${a.severity}"></div>
      <div>
        <div class="pred-alert-title">${a.title}</div>
        <div class="pred-alert-sub">${a.sub}</div>
        <div class="pred-alert-conf">Confidence: ${a.conf}</div>
      </div>
    </div>`).join('');

  if(typeof Chart!=='undefined') initBigChart();
}

/* ════════════════════════════════════════════════════
   CHARTS
═════════════════════════════════════════════════════ */
function curve(base,peak,n){
  return Array.from({length:n},(_,i)=>{
    const t=i/(n-1);
    return Math.min(105,Math.max(base-3, base+(peak-base)*Math.pow(t,1.3)+(Math.random()-.5)*2.5));
  });
}
function initOccChart(peak){
  const ctx=$('occupancyChart'); if(!ctx)return;
  if(charts.occ) charts.occ.destroy();
  const data=curve(72,peak,20);
  charts.occ=new Chart(ctx,{type:'line',data:{labels:data.map(()=>''),datasets:[{data,fill:true,borderColor:'#dc2626',borderWidth:2,
    backgroundColor:c=>{const g=c.chart.ctx.createLinearGradient(0,0,0,90);g.addColorStop(0,'rgba(220,38,38,.18)');g.addColorStop(1,'rgba(220,38,38,.01)');return g;},
    tension:.45,pointRadius:0}]},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:700},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false,min:60,max:108}}}});
}
function initBigChart(){
  const ctx=$('predBigChart'); if(!ctx)return;
  if(charts.big) charts.big.destroy();
  const n=24;
  const pts=Array.from({length:n},(_,i)=>{ const t=i/(n-1); const p=t<.7?70+30*Math.pow(t/.7,1.5):100-10*Math.pow((t-.7)/.3,.8); return Math.min(103,Math.max(68,p+(Math.random()-.5)*3)); });
  charts.big=new Chart(ctx,{type:'line',data:{labels:pts.map(()=>''),datasets:[{data:pts,fill:true,borderColor:'#2563eb',borderWidth:2.5,
    backgroundColor:c=>{const g=c.chart.ctx.createLinearGradient(0,0,0,180);g.addColorStop(0,'rgba(37,99,235,.15)');g.addColorStop(1,'rgba(37,99,235,.01)');return g;},
    tension:.45,pointRadius:0}]},
    options:{responsive:true,maintainAspectRatio:false,animation:{duration:900},plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false,min:55,max:110}}}});
}

/* ════════════════════════════════════════════════════
   SOCKET.IO
═════════════════════════════════════════════════════ */
function connectSocket(){
  const dot=$('connDot'), txt=$('connText');
  const socket=io({transports:['websocket','polling']});
  S.socket=socket;

  socket.on('connect',()=>{
    dot.className='conn-dot connected'; txt.textContent='Live';
    toast('Connected to Kingsway server','success',2000);
  });
  socket.on('disconnect',()=>{ dot.className='conn-dot disconnected'; txt.textContent='Reconnecting…'; });

  socket.on('db_status', d=>{
    setDB(d.connected, d.mode);
    if(d.connected) toast('MongoDB connected','success',2000);
  });

  socket.on('resources_update',  d=>{ S.resources=d;  if(page==='dashboard') drawResources(); });
  socket.on('units_update',      d=>{ S.units=d;       if(page==='units')    drawUnits(); });
  socket.on('inventory_update',  d=>{ S.inventory=d;   if(page==='inventory')drawInv(); });
  socket.on('staff_update',      d=>{ S.staff=d;       if(page==='staff')    drawStaff(); if(page==='dashboard')drawStaffTab(); });
  socket.on('alerts_update',     d=>{ S.alerts=d;      if(page==='alerts')   drawAlerts(); updAlertBadge(d); });
  socket.on('emergency_update',  d=>renderEmergency(d));
  socket.on('predictions_update',d=>renderPredLive(d));

  qa('.live-chip').forEach(c=>{
    c.title='Click to refresh live data';
    c.addEventListener('click',()=>{ socket.emit('request_refresh'); toast('Data refreshed','info',1500); });
  });
}

function updAlertBadge(alerts){
  const n=alerts.filter(a=>!a.read).length;
  const b=$('alertBadge'); if(!b)return;
  b.textContent=n; b.style.display=n?'inline-block':'none';
}

/* ════════════════════════════════════════════════════
   GLOBAL SEARCH
═════════════════════════════════════════════════════ */
$('globalSearch')?.addEventListener('input',e=>{
  const q2=e.target.value.toLowerCase().trim();
  if(q2.length<2)return;
  const inv=(S.inventory.length?S.inventory:FB.inventory).find(i=>i.name.toLowerCase().includes(q2));
  if(inv){ go('inventory'); return; }
  const st=(S.staff.length?S.staff:FB.staff).find(s=>s.name.toLowerCase().includes(q2)||s.dept.toLowerCase().includes(q2));
  if(st){ go('staff'); return; }
  const un=(S.units.length?S.units:FB.units).find(u=>u.name.toLowerCase().includes(q2));
  if(un){ go('units'); return; }
});

/* ════════════════════════════════════════════════════
   RESOURCE TAB SWITCH
═════════════════════════════════════════════════════ */
document.addEventListener('click',e=>{
  if(!e.target.matches('.rtab'))return;
  const panel=e.target.closest('.panel-resources'); if(!panel)return;
  panel.querySelectorAll('.rtab').forEach(b=>b.classList.remove('active'));
  panel.querySelectorAll('.rtab-content').forEach(c=>c.classList.remove('active'));
  e.target.classList.add('active');
  const t=panel.querySelector(`#rtab-${e.target.dataset.rtab}`);
  if(t) t.classList.add('active');
});

/* ════════════════════════════════════════════════════
   FALLBACK DATA (used before Socket.io connects)
═════════════════════════════════════════════════════ */
const FB={
  resources:[
    {id:'bed_101',name:'Bed 101',type:'bed',department:'Standard Care',status:'available',note:'Ready for intake'},
    {id:'icu_4',name:'ICU Room 4',type:'icu',department:'Critical Care',status:'occupied',note:'High Priority'},
    {id:'vent_a12',name:'Ventilator A-12',type:'ventilator',department:'Portable Unit',status:'in_use',note:'Low Battery'},
    {id:'bed_102',name:'Bed 102',type:'bed',department:'Standard Care',status:'sanitizing',note:'Est. 10 mins'},
    {id:'xray_1',name:'X-Ray Room 1',type:'xray',department:'Radiology',status:'processing',note:'Next: 2:00 PM'},
    {id:'icu_6',name:'ICU Room 6',type:'icu',department:'Critical Care',status:'occupied',note:'Critical'},
    {id:'bed_103',name:'Bed 103',type:'bed',department:'Standard Care',status:'available',note:'Clean'},
  ],
  units:[
    {id:'u1',name:'ICU Wing A',dept:'Intensive Care',icon:'🏥',category:'icu',beds:12,occupied:11,staff:18,status:'critical'},
    {id:'u2',name:'Emergency Room',dept:'Emergency',icon:'🚨',category:'emergency',beds:20,occupied:16,staff:24,status:'warning'},
    {id:'u3',name:'Radiology Suite',dept:'Diagnostics',icon:'🩻',category:'radiology',beds:6,occupied:3,staff:8,status:'ok'},
    {id:'u4',name:'Standard Ward B',dept:'General Care',icon:'🛏',category:'standard',beds:30,occupied:22,staff:15,status:'warning'},
    {id:'u5',name:'Surgical Unit',dept:'Surgery',icon:'🔬',category:'icu',beds:8,occupied:5,staff:20,status:'ok'},
    {id:'u6',name:'Cardiac Care',dept:'Cardiology',icon:'❤️',category:'icu',beds:10,occupied:9,staff:16,status:'critical'},
    {id:'u7',name:'Neonatal ICU',dept:'Neonatology',icon:'🍼',category:'icu',beds:6,occupied:4,staff:10,status:'ok'},
  ],
  inventory:[
    {id:'i1',name:'Ventilators',stock:16,status:'not_available'},{id:'i2',name:'ICU Beds',stock:3,status:'not_available'},
    {id:'i3',name:'PPE Kits',stock:45,status:'low'},{id:'i4',name:'Surgical Gloves',stock:280,status:'low'},
    {id:'i5',name:'Oxygen Cylinders',stock:22,status:'low'},{id:'i6',name:'Syringes (10ml)',stock:1200,status:'ok'},
    {id:'i7',name:'Blood Bags (O+)',stock:18,status:'low'},{id:'i8',name:'IV Fluids (500ml)',stock:340,status:'ok'},
    {id:'i9',name:'Defibrillators',stock:8,status:'low'},{id:'i10',name:'Surgical Masks',stock:900,status:'ok'},
    {id:'i11',name:'Patient Monitors',stock:24,status:'ok'},{id:'i12',name:'Wheelchairs',stock:35,status:'ok'},
    {id:'i13',name:'Morphine (10mg)',stock:12,status:'not_available'},{id:'i14',name:'Epinephrine',stock:8,status:'not_available'},
    {id:'i15',name:'Bandages (sterile)',stock:600,status:'ok'},
  ],
  staff:[
    {id:'s1',name:'Dr. Rajesh Sharma',initials:'RS',role:'Senior Physician',dept:'ICU',status:'on-duty',shift:'07:00–19:00',phone:'+91-98201-11001',email:'r.sharma@kingsway.in'},
    {id:'s2',name:'Sr. Nurse Priya Nair',initials:'PN',role:'Head Nurse',dept:'Emergency',status:'on-duty',shift:'07:00–15:00',phone:'+91-98201-11002',email:'p.nair@kingsway.in'},
    {id:'s3',name:'Dr. Suresh Iyer',initials:'SI',role:'Surgeon',dept:'Surgery',status:'standby',shift:'On Call',phone:'+91-98201-11003',email:'s.iyer@kingsway.in'},
    {id:'s4',name:'Dr. Meena Krishnan',initials:'MK',role:'ICU Specialist',dept:'ICU',status:'on-duty',shift:'07:00–19:00',phone:'+91-98201-11004',email:'m.krishnan@kingsway.in'},
    {id:'s5',name:'Sr. Nurse Kavita Rao',initials:'KR',role:'ICU Nurse',dept:'ICU',status:'on-duty',shift:'07:00–19:00',phone:'+91-98201-11005',email:'k.rao@kingsway.in'},
    {id:'s6',name:'Dr. Anand Verma',initials:'AV',role:'Radiologist',dept:'Radiology',status:'on-duty',shift:'08:00–16:00',phone:'+91-98201-11006',email:'a.verma@kingsway.in'},
    {id:'s7',name:'Sr. Nurse Sunita Desai',initials:'SD',role:'ER Nurse',dept:'Emergency',status:'standby',shift:'On Call',phone:'+91-98201-11007',email:'s.desai@kingsway.in'},
    {id:'s8',name:'Dr. Pooja Agarwal',initials:'PA',role:'Cardiologist',dept:'Cardiac',status:'on-duty',shift:'09:00–21:00',phone:'+91-98201-11008',email:'p.agarwal@kingsway.in'},
    {id:'s9',name:'Sr. Nurse Ravi Pillai',initials:'RP',role:'Night Nurse',dept:'Ward B',status:'off',shift:'21:00–07:00',phone:'+91-98201-11009',email:'r.pillai@kingsway.in'},
    {id:'s10',name:'Dr. Deepa Menon',initials:'DM',role:'Pediatrician',dept:'Pediatrics',status:'off',shift:'19:00–07:00',phone:'+91-98201-11010',email:'d.menon@kingsway.in'},
    {id:'s11',name:'Sr. Nurse Amit Joshi',initials:'AJ',role:'Surgical Nurse',dept:'Surgery',status:'standby',shift:'On Call',phone:'+91-98201-11011',email:'a.joshi@kingsway.in'},
    {id:'s12',name:'Dr. Vikram Nambiar',initials:'VN',role:'Anesthesiologist',dept:'Surgery',status:'on-duty',shift:'07:00–19:00',phone:'+91-98201-11012',email:'v.nambiar@kingsway.in'},
  ],
  alerts:[
    {id:'a1',severity:'critical',icon:'🏥',title:'ICU Capacity Critical',desc:'ICU has only 3 beds remaining. Diversion protocol recommended.',dept:'ICU',time:'2 min ago',read:false},
    {id:'a2',severity:'critical',icon:'💊',title:'Morphine Stock Critical',desc:'Morphine 10mg is below threshold. Reorder required immediately.',dept:'Pharmacy',time:'8 min ago',read:false},
    {id:'a3',severity:'warning',icon:'💨',title:'Ventilator Supply Low',desc:'Only 16 ventilators remaining. Shortage predicted by 6:00 PM.',dept:'Equipment',time:'15 min ago',read:false},
    {id:'a4',severity:'critical',icon:'⚡',title:'Code Blue — Trauma Bay',desc:'Emergency response dispatched to Trauma Bay. All available staff report.',dept:'Emergency',time:'22 min ago',read:false},
    {id:'a5',severity:'warning',icon:'🩸',title:'Blood Bank: O+ Running Low',desc:'O+ blood supply at 72% minimum. Contact regional blood bank.',dept:'Blood Bank',time:'35 min ago',read:true},
    {id:'a6',severity:'info',icon:'📋',title:'Shift Change Reminder',desc:'Evening shift begins at 19:00. 45 staff scheduled for handover.',dept:'HR',time:'1 hr ago',read:true},
    {id:'a7',severity:'warning',icon:'🔧',title:'MRI Machine Maintenance',desc:'MRI Unit 2 maintenance at 20:00. Reroute bookings to Unit 1.',dept:'Radiology',time:'1 hr ago',read:true},
    {id:'a8',severity:'info',icon:'📦',title:'Inventory Restocking Arriving',desc:'Supply delivery at Loading Bay 3 between 16:00–17:00.',dept:'Supply',time:'2 hr ago',read:true},
  ]
};

/* ════════════════════════════════════════════════════
   BOOT
═════════════════════════════════════════════════════ */
function loadScript(src,cb){ const s=document.createElement('script'); s.src=src; s.onload=cb; document.head.appendChild(s); }

// Initial render with fallback data immediately
drawDash();

// Check DB status
fetch('/api/db-status').then(r=>r.json()).then(d=>setDB(d.connected,d.mode)).catch(()=>setDB(false,'Flask offline'));

loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',()=>{
  initOccChart(98);
  connectSocket();
});
