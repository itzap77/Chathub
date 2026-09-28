async function refreshDirectory(){
  if(!authToken) return;
  const res=await fetch(`/api/users/directory?token=${encodeURIComponent(authToken)}`);
  if(!res.ok) return;
  const data=await res.json();
  directoryCache=data.users;
  document.getElementById("statOnline").textContent=data.total_online;
  document.getElementById("statRooms").textContent=myRooms.length;
  updateTotalAlertBadge();
  document.getElementById("peersGrid").innerHTML = directoryCache.map(u=>`
    <div class="peer-card">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="av ${u.online ? 'pres-green' : 'pres-grey'}" style="width:30px;height:30px;font-size:.76rem">${esc(initials(u.username))}</div>
        <div><div style="font-size:.82rem;font-weight:600">${u.display_name ? `${esc(u.display_name)} <span style="color:var(--muted-2);font-weight:400">@${esc(u.username)}</span>` : `@${esc(u.username)}`}</div><div style="font-size:.65rem;font-family:var(--mono);color:${u.online?'var(--online)':'var(--offline)'}">${u.online?'● Online':'Offline'}</div></div>
      </div>
      <button class="btn-mini" onclick="openProfile('${esc(u.username)}','${u.online ? 'here' : 'offline'}',false)">Chat</button>
    </div>
  `).join("");
}

function openPeopleSearch(){
  if(!authToken) return showToast("Only logged in accounts can search users", "ℹ️");
  document.getElementById("userSearchInput").value = "";
  document.getElementById("userSearchResults").innerHTML = `<div style="color:var(--muted-2);font-size:.8rem;padding:8px">Type a username above to search...</div>`;
  openOverlay("searchOverlay");
  setTimeout(()=>document.getElementById("userSearchInput").focus(), 150);
}

function runUserSearch(){
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(async ()=>{
    const q = document.getElementById("userSearchInput").value.trim();
    const c = document.getElementById("userSearchResults");
    if(!q){
      c.innerHTML = `<div style="color:var(--muted-2);font-size:.8rem;padding:8px">Type a username above to search...</div>`;
      return;
    }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&token=${encodeURIComponent(authToken)}`);
      if(!res.ok) return;
      const d = await res.json();
      if(!d.users || !d.users.length){
        c.innerHTML = `<div style="color:var(--muted-2);font-size:.8rem;padding:8px">No users found matching "${esc(q)}".</div>`;
        return;
      }
      c.innerHTML = d.users.map(u => `
        <button class="search-hit" onclick="closeOverlay('searchOverlay'); openProfile('${esc(u.username)}', '${u.online ? 'here' : 'offline'}', false);">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="av ${u.online ? 'pres-green' : 'pres-grey'}" style="width:28px;height:28px;font-size:.74rem">${esc(initials(u.username))}</div>
            <div>
              <div style="font-size:.82rem;font-weight:600">${u.display_name ? `${esc(u.display_name)} <span style="color:var(--muted-2);font-weight:400">@${esc(u.username)}</span>` : `@${esc(u.username)}`}</div>
              <div style="font-size:.65rem;color:${u.online ? 'var(--online)' : 'var(--offline)'};font-family:var(--mono)">${u.online ? 'Online' : 'Offline'}</div>
            </div>
          </div>
          <span style="font-size:.72rem;color:var(--accent);font-weight:600">View</span>
        </button>
      `).join("");
    } catch(e) {}
  }, 200);
}

function openProfile(u, presence="offline", isPrivateSpace=false){
  if(isGuestUser) return;
  window.targetProfile = u;
  document.getElementById("profName").textContent="@"+u;
  const bioEl = document.getElementById("profBio");
  bioEl.style.display = "none";
  bioEl.textContent = "";

  let presClass = "pres-grey";
  let label = "Offline";
  let labelColor = "var(--offline)";

  if (!isPrivateSpace) {
    if (presence === "here" || presence === "online") {
      presClass = "pres-green";
      label = "● Online";
      labelColor = "var(--online)";
    }
  } else {
    if (presence === "here") {
      presClass = "pres-green";
      label = "● in this space";
      labelColor = "var(--online)";
    } else if (presence === "elsewhere") {
      presClass = "pres-orange";
      label = "● online elsewhere";
      labelColor = "var(--away)";
    }
  }

  renderAvatar(document.getElementById("profAvatar"), u, presClass);
  const statusEl = document.getElementById("profStatus");
  statusEl.textContent = label;
  statusEl.style.color = labelColor;

  document.getElementById("profDmBtn").style.display = u===myUser ? "none" : "block";
  openOverlay("profileOverlay");

  fetch(`/api/users/public_profile?username=${encodeURIComponent(u)}&token=${encodeURIComponent(authToken)}`)
    .then(res => res.ok ? res.json() : null)
    .then(data => {
      if(!data || window.targetProfile !== u) return;
      if(data.display_name){
        document.getElementById("profName").innerHTML = `${esc(data.display_name)} <span style="color:var(--muted-2);font-weight:400">@${esc(u)}</span>`;
      }
      if(data.bio){
        bioEl.textContent = data.bio;
        bioEl.style.display = "block";
      }
    })
    .catch(()=>{});
}

async function requestChat(){
  if(!window.targetProfile) return;
  const res=await fetch("/api/dm/request",{method:"POST",body:new URLSearchParams({target:window.targetProfile,token:authToken})});
  const d=await res.json();
  closeOverlay("profileOverlay");
  if(d.status==="already_connected"){ openRoom(d.room_id,d.room_name,true); return; }
  showToast(d.detail||"Chat request sent.", "✉️");
}

