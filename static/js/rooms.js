async function fetchMyRooms(){
  if(!authToken) return;
  const res=await fetch(`/api/user/rooms?token=${encodeURIComponent(authToken)}`);
  if(!res.ok) return;
  myRooms=await res.json();
  renderRoomLists();
}

function renderRoomLists(){
  const isChat = currentView === "chat";

  if (!isGuestUser) {
    document.getElementById("navPublic").classList.toggle("active", isChat && currentRoom==="public");
  }
  
  const ephSlot = document.getElementById("ephRoomSlot");
  if (myPinnedEphemerals.length > 0) {
    ephSlot.innerHTML = myPinnedEphemerals.map(r => {
      const isActive = isChat && currentRoom === r.id;
      return `
        <div class="nav-row ${isActive ? 'active-eph' : ''}" onclick="openRoom('${esc(r.id)}','${esc(r.title)}',false)">
          <span class="prefix">⚡</span>
          <span class="label">${esc(r.title)}</span>
          <button class="close-eph-btn" onclick="unpinEphemeralRoom('${esc(r.id)}', event)" title="Leave space">✕</button>
        </div>
      `;
    }).join("");
  } else {
    ephSlot.innerHTML = "";
  }

  if(isGuestUser) return;

  const groups=myRooms.filter(r=>!r.is_dm), dms=myRooms.filter(r=>r.is_dm);
  document.getElementById("roomsList").innerHTML = groups.map(r=>`
    <button class="nav-row ${isChat && currentRoom===r.id?'active':''}" onclick="openRoom('${esc(r.id)}','${esc(r.name)}',false)">
      <span class="prefix">#</span><span class="label">${esc(r.name)}</span>
    </button>`).join("");
  document.getElementById("dmsList").innerHTML = dms.map(r=>`
    <button class="nav-row ${isChat && currentRoom===r.id?'active':''}" onclick="openRoom('${esc(r.id)}','${esc(r.name)}',true)">
      <span class="prefix">@</span><span class="label">${esc(r.name)}</span>
    </button>`).join("");
  document.getElementById("statRooms").textContent=myRooms.length;
}

function openRoom(id,name,isDm){ 
  if (isGuestUser && !id.startsWith("tmp_")) {
    showToast("Guest accounts cannot access persistent channels", "🚫");
    return;
  }
  
  setView("chat"); 
  connectRoom(id,name,isDm); 
}

function openRoomModal(tab){
  setRoomTab(tab);
  openOverlay("roomOverlay");
}

function setRoomTab(t){
  document.getElementById("roomTabCreate").classList.toggle("active", t === "create");
  document.getElementById("roomTabJoin").classList.toggle("active", t === "join");
  document.getElementById("createFields").style.display = t === "create" ? "block" : "none";
  document.getElementById("joinFields").style.display = t === "join" ? "block" : "none";
}

async function createRoom(){
  const name=document.getElementById("cRoomName").value.trim();
  const pass=document.getElementById("cRoomPass").value;
  if(!name) return showToast("Room title required", "⚠️");
  if(pass.length<4) return showToast("Passkey must be 4+ characters", "⚠️");
  const res=await fetch("/api/rooms/create",{method:"POST",body:new URLSearchParams({room_name:name,passkey:pass,token:authToken})});
  const d=await res.json();
  if(!res.ok) return showToast(apiError(d,"Error creating room"), "❌");
  closeOverlay("roomOverlay");
  document.getElementById("cRoomName").value = "";
  document.getElementById("cRoomPass").value = "";
  await fetchMyRooms();
  openRoom(d.room_id,d.room_name,false);
  showToast(`Space created! Key: ${d.room_id}`, "🔑");
}

async function joinRoomSubmit(){
  const key=document.getElementById("jRoomKey").value.trim().toLowerCase();
  const pass=document.getElementById("jRoomPass").value;
  if(!key) return showToast("Room key required", "⚠️");
  const res=await fetch("/api/rooms/join",{method:"POST",body:new URLSearchParams({room_key:key,passkey:pass,token:authToken})});
  const d=await res.json();
  if(!res.ok) return showToast(apiError(d,"Invalid room key or passkey"), "❌");
  closeOverlay("roomOverlay");
  document.getElementById("jRoomKey").value = "";
  document.getElementById("jRoomPass").value = "";
  await fetchMyRooms();
  openRoom(d.room_id,d.room_name,false);
}

function promptDestruct(){
  document.getElementById("btnShowDestruct").style.display = "none";
  document.getElementById("confirmDestructBox").style.display = "block";
}

function cancelDestruct(){
  document.getElementById("confirmDestructBox").style.display = "none";
  document.getElementById("btnShowDestruct").style.display = "block";
}

async function executeDestruct(){
  const res = await fetch("/api/rooms/destruct", {
    method: "POST",
    body: new URLSearchParams({ room_id: currentRoom, token: authToken })
  });
  if(res.ok){
    closeOverlay("infoOverlay");
    cancelDestruct();
    await fetchMyRooms();
    openRoom("public","Public Group",false);
    showToast("Space disbanded permanently.", "🗑️");
  } else {
    showToast("Failed to disband space.", "❌");
  }
}

async function submitPasskeyChange(){
  const oldPass = document.getElementById("oldPasskeyInput").value;
  const newPass = document.getElementById("newPasskeyInput").value;
  if(!oldPass) return showToast("Current passkey required", "⚠️");
  if(!newPass || newPass.length < 4) return showToast("New passkey must be 4+ characters", "⚠️");

  try {
    const res = await fetch("/api/rooms/update_passkey", {
      method: "POST",
      body: new URLSearchParams({
        room_id: currentRoom,
        current_passkey: oldPass,
        new_passkey: newPass,
        token: authToken
      })
    });
    const d = await res.json();
    if(res.ok){
      document.getElementById("oldPasskeyInput").value = "";
      document.getElementById("newPasskeyInput").value = "";
      showToast(d.detail || "Passkey updated!", "🔑");
    } else {
      showToast(apiError(d, "Could not update passkey"), "❌");
    }
  } catch(e) {
    showToast("Error updating passkey", "❌");
  }
}

async function fetchBans(){
  if(!amIRoomAdmin || currentRoom==="public" || currentRoom.startsWith("dm_") || currentRoom.startsWith("tmp_")) return;
  try {
    const res = await fetch(`/api/rooms/bans?room_id=${encodeURIComponent(currentRoom)}&token=${encodeURIComponent(authToken)}`);
    if(!res.ok) return;
    const d = await res.json();
    const list = document.getElementById("bannedList");
    if(!d.bans || !d.bans.length){
      list.innerHTML = `<div style="color:var(--muted-2);font-size:.76rem;padding:4px 0">No banned members.</div>`;
      return;
    }
    list.innerHTML = d.bans.map(b => `
      <div class="ban-row">
        <div style="font-size:.8rem">
          <b>@${esc(b.username)}</b>
          <span style="font-size:.68rem;color:var(--muted);margin-left:6px">${b.permanent ? 'Permanent' : 'Timed'}</span>
        </div>
        <button class="btn-mini" style="padding:4px 8px;font-size:.72rem" onclick="promptUnban('${esc(b.username)}')">Unban</button>
      </div>
    `).join("");
  } catch(e) {}
}

function promptUnban(target){
  showConfirmCard({
    icon: "🔓",
    title: `Unban @${target}?`,
    text: `They will be allowed to rejoin ${currentRoomTitle} using the passkey.`,
    onConfirm: ()=>executeUnban(target)
  });
}

async function executeUnban(target){
  try {
    const res = await fetch("/api/rooms/unban", {method:"POST", body:new URLSearchParams({
      room_id: currentRoom, target_user: target, token: authToken
    })});
    const d = await res.json();
    if(!res.ok) return showToast(apiError(d, "Couldn't unban member"), "❌");
    showToast(`@${target} can now rejoin.`, "✓");
    fetchBans();
  } catch(e) {
    showToast("Error unbanning member", "❌");
  }
}

async function syncSpaceInspector(){
  if (currentView !== "chat") return;
  const isEphemeral = currentRoom.startsWith("tmp_");
  const isDm = currentRoomIsDm;
  const isPublic = currentRoom === "public";
  
  document.getElementById("btnCopyKey").style.display = (isEphemeral || (!isDm && !isPublic)) ? "grid" : "none";

  try {
    const res = await fetch(`/api/rooms/details?room_id=${encodeURIComponent(currentRoom)}&token=${encodeURIComponent(authToken)}`);
    if(!res.ok) return;
    const data = await res.json();

    if (data.members) {
      roomMembersCache = data.members.map(m => m.username);
    }

    document.getElementById("inspectName").textContent = data.room_name;
    document.getElementById("inspectAvatar").textContent = initials(data.room_name);
    // avatar keeps the default monochrome background from CSS
    document.getElementById("inspectSub").textContent = isEphemeral 
      ? `Ephemeral Space · Capacity: ${data.max_users}` 
      : (isDm ? "Direct 1-on-1 Stream" : `Owner: @${data.created_by || 'Admin'}`);
    document.getElementById("inspectCount").textContent = `${data.total_members} participant${data.total_members===1?'':'s'}`;

    const canBan = amIRoomAdmin && !isEphemeral && !isDm && !isPublic;
    const activeAlias = getActiveRoomAlias();
    
    document.getElementById("inspectRoster").innerHTML = data.members.map(m => {
      const isOwner = (m.username === data.created_by);
      let presClass = "pres-grey";
      let statusText = "offline";

      if (!data.is_private) {
        presClass = (m.presence === "online" || m.presence === "here") ? "pres-green" : "pres-grey";
        statusText = (presClass === "pres-green") ? "online" : "offline";
      } else {
        if (m.presence === "here") {
          presClass = "pres-green";
          statusText = "in this space";
        } else if (m.presence === "elsewhere") {
          presClass = "pres-orange";
          statusText = "online elsewhere";
        } else {
          presClass = "pres-grey";
          statusText = "offline";
        }
      }

      return `
        <div class="roster-item">
          <div class="roster-user" onclick="${isEphemeral ? '' : `openProfile('${esc(m.username)}', '${m.presence}',${data.is_private})`}">
            <div class="av ${presClass}" style="width:26px;height:26px;font-size:.7rem">${esc(initials(m.username))}</div>
            <div>
              <div class="roster-name">${m.display_name ? `${esc(m.display_name)} <span style="color:var(--muted-2);font-weight:400">@${esc(m.username)}</span>` : `@${esc(m.username)}`} ${isOwner ? '👑' : ''}</div>
              <div class="roster-status ${presClass}">● ${statusText}</div>
            </div>
          </div>
          ${(canBan && m.username !== activeAlias) ? `<button class="roster-ban-btn" onclick="openBan('${esc(m.username)}')">Ban</button>` : ''}
        </div>
      `;
    }).join("");
  } catch(e) {}
}

function getActiveRoomAlias(){
  if (currentRoom.startsWith("tmp_")) {
    const pinned = myPinnedEphemerals.find(r => r.id === currentRoom);
    return pinned ? pinned.alias : myUser;
  }
  return myUser;
}

function copySpaceKey(){
  navigator.clipboard.writeText(currentRoom);
  showToast(`Space key copied: ${currentRoom}`, "📋");
}

function openRoomInfo(){
  cancelDestruct();
  const adminControls = document.getElementById("adminRoomControls");
  const activeAlias = getActiveRoomAlias();

  if(currentRoom.startsWith("tmp_")){
    document.getElementById("infoTitle").textContent = "⚡ Disposable Session";
    document.getElementById("infoDesc").textContent = "Auto-Destruct Active";
    document.getElementById("infoBody").innerHTML = `
      <div style="background:var(--surface-2);padding:10px;border-radius:9px;border:1px solid var(--border)">
        <div><b>Room Code:</b> <code style="color:#fcd34d;user-select:all;font-size:.85rem">${currentRoom}</code></div>
        <div style="margin-top:6px"><b>Your Temporary Alias:</b> <code style="color:var(--text);font-weight:600">${esc(activeAlias)}</code></div>
        <div style="color:#fca5a5;font-size:.72rem;margin-top:6px;line-height:1.4">
          ⚠️ This session is non-persistent. When all participants disconnect, all messages and attachments are wiped permanently.
        </div>
      </div>`;
    adminControls.style.display = "none";
  } else if(currentRoomIsDm){
    document.getElementById("infoTitle").textContent = currentRoomTitle;
    document.getElementById("infoDesc").textContent = "Direct 1-on-1 Session";
    document.getElementById("infoBody").innerHTML = `
      <div style="background:var(--surface-2);padding:10px;border-radius:8px;border:1px solid var(--border)">
        <div><b>Session:</b> Private Conversation</div>
        <div style="color:var(--muted);font-size:.72rem;margin-top:4px">Only invited participants can view this stream.</div>
      </div>`;
    adminControls.style.display = "none";
  } else if(currentRoom === "public"){
    document.getElementById("infoTitle").textContent = "Public Group";
    document.getElementById("infoDesc").textContent = "Global Channel";
    document.getElementById("infoBody").innerHTML = `
      <div style="background:var(--surface-2);padding:10px;border-radius:8px;border:1px solid var(--border)">
        <div><b>Retention:</b> 48-Hour Message Auto-Purge</div>
        <div style="color:var(--muted);font-size:.72rem;margin-top:4px">Messages auto-clean from the database after 48 hours.</div>
      </div>`;
    adminControls.style.display = "none";
  } else {
    document.getElementById("infoTitle").textContent = currentRoomTitle;
    document.getElementById("infoDesc").textContent = `Passkey-protected space`;
    document.getElementById("infoBody").innerHTML = `
      <div style="background:var(--surface-2);padding:10px;border-radius:8px;border:1px solid var(--border)">
        <div><b>Owner:</b> @${esc(currentCreator) || 'Admin'}</div>
        <div style="margin-top:6px"><b>Share Key:</b> <code style="color:var(--text);user-select:all">${currentRoom}</code></div>
        <div style="color:var(--muted);font-size:.74rem;margin-top:4px">New users require the space key and passkey to join.</div>
      </div>`;
    adminControls.style.display = (currentCreator === myUser) ? "block" : "none";
    if(currentCreator === myUser) fetchBans();
  }
  openOverlay("infoOverlay");
}

function openBan(target){
  window.banTarget = target;
  document.getElementById("banTargetLabel").textContent = `Target: @${target}`;
  openOverlay("banOverlay");
}

async function submitBan(){
  const banType = document.getElementById("banType").value;
  const duration = document.getElementById("banDur").value;
  try {
    const res = await fetch("/api/rooms/ban", {method:"POST", body:new URLSearchParams({
      room_id: currentRoom,
      token: authToken,
      target_user: window.banTarget,
      ban_type: banType,
      duration: duration
    })});
    const d = await res.json();
    if(!res.ok) return showToast(apiError(d, "Couldn't ban member"), "❌");
    closeOverlay("banOverlay");
    showToast(`@${window.banTarget} was banned.`, "🚫");
    syncSpaceInspector();
  } catch(e) {
    showToast("Network error executing ban", "❌");
  }
}

