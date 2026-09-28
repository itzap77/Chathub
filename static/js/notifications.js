function setNotifyFilter(f){
  activeNotifyFilter = f;
  document.getElementById("tabAll").classList.toggle("active", f === "all");
  document.getElementById("tabRequests").classList.toggle("active", f === "requests");
  document.getElementById("tabMentions").classList.toggle("active", f === "mentions");
  renderNotifications();
}

function pushActivityNotification(category, title, text, payload=null){
  activityFeed.unshift({
    id: Date.now() + Math.random(),
    category,
    title,
    text,
    time: Date.now() / 1000,
    payload
  });
  updateTotalAlertBadge();
  if (currentView === "notify") renderNotifications();
}

function clearActivityFeed(){
  activityFeed = [];
  renderNotifications();
  updateTotalAlertBadge();
  showToast("Activity history cleared", "✓");
}

function removeActivityNotification(id, e){
  if(e) e.stopPropagation();
  activityFeed = activityFeed.filter(a => a.id !== id);
  renderNotifications();
  updateTotalAlertBadge();
}

function updateTotalAlertBadge(){
  const total = pendingRequests.length + activityFeed.length;
  const badge = document.getElementById("reqBadge");
  if(badge){
    badge.style.display = total > 0 ? "grid" : "none";
    badge.textContent = total > 99 ? "99+" : total;
  }
  const reqTag = document.getElementById("reqCountTag");
  if(reqTag) reqTag.textContent = `(${pendingRequests.length})`;
}

function renderNotifications(){
  const feed = document.getElementById("notificationsFeed");
  let items = [];

  if (activeNotifyFilter === "all" || activeNotifyFilter === "requests") {
    pendingRequests.forEach(r => {
      items.push({
        type: "request",
        raw: r,
        time: r.created_at
      });
    });
  }

  if (activeNotifyFilter === "all" || activeNotifyFilter === "mentions") {
    activityFeed.forEach(a => {
      if (activeNotifyFilter === "all" || (activeNotifyFilter === "mentions" && a.category !== "request")) {
        items.push({
          type: a.category,
          activity: a,
          time: a.time
        });
      }
    });
  }

  items.sort((a, b) => b.time - a.time);

  if (!items.length) {
    feed.innerHTML = `<div style="color:var(--muted-2);font-size:.82rem;padding:16px 0">No notifications in this category.</div>`;
    return;
  }

  feed.innerHTML = items.map(item => {
    if (item.type === "request") {
      const r = item.raw;
      return `
        <div class="notify-card">
          <div style="display:flex;align-items:center;gap:10px">
            <div class="av pres-green" style="width:34px;height:34px;font-size:.8rem">${esc(initials(r.sender))}</div>
            <div>
              <div style="font-size:.84rem;font-weight:600">@${esc(r.sender)} <span class="notify-tag req">Invitation</span></div>
              <div style="font-size:.72rem;color:var(--muted);margin-top:2px">Invited you to chat directly 1-on-1 · ${fmtTime(r.created_at)}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <button class="btn-mini" onclick="respondRequest(${r.id},'accept')">Accept</button>
            <button class="btn-secondary" style="margin:0;padding:5px 10px" onclick="respondRequest(${r.id},'reject')">Decline</button>
          </div>
        </div>
      `;
    } else {
      const a = item.activity;
      const tagClass = a.category === "mention" ? "mention" : "system";
      return `
        <div class="notify-card">
          <div>
            <div style="font-size:.84rem;font-weight:600">${esc(a.title)} <span class="notify-tag ${tagClass}">${esc(a.category)}</span></div>
            <div style="font-size:.72rem;color:var(--muted);margin-top:2px">${esc(a.text)} · ${fmtTime(a.time)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            ${a.payload && a.payload.room_id ? `<button class="btn-mini" onclick="openRoom('${esc(a.payload.room_id)}','${esc(a.payload.room_name)}',false)">Jump</button>` : ''}
            <button class="notify-del-btn" onclick="removeActivityNotification(${a.id}, event)" title="Remove notification">✕</button>
          </div>
        </div>
      `;
    }
  }).join("");
}

async function fetchRequests(){
  if(!authToken) return;
  const res=await fetch(`/api/dm/requests?token=${encodeURIComponent(authToken)}`);
  if(!res.ok) return;
  pendingRequests=await res.json();
  updateTotalAlertBadge();
  if(currentView==="notify") renderNotifications();
}

async function respondRequest(id,action){
  const res=await fetch("/api/dm/respond",{method:"POST",body:new URLSearchParams({request_id:id,action,token:authToken})});
  const data=await res.json();
  await Promise.all([fetchRequests(),fetchMyRooms()]);
  if(action==="accept" && data.room_id) openRoom(data.room_id,data.room_name,true);
}

