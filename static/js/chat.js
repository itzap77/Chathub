function triggerEventTicker(text){
  const el = document.getElementById("eventTicker");
  document.getElementById("eventTickerText").textContent = text;
  el.classList.add("show");
  clearTimeout(tickerTimer);
  tickerTimer = setTimeout(()=>{ el.classList.remove("show"); }, 3500);
}

function emitTyping(){
  const now = Date.now();
  if(ws && ws.readyState===1 && now - lastTypingSent > 2000){
    lastTypingSent = now;
    ws.send(JSON.stringify({type:"typing"}));
  }
}

function setReplyTarget(id, sender, text){
  activeReply = { id, sender, text };
  document.getElementById("replyTargetUser").textContent = `Replying to @${sender}`;
  document.getElementById("replyTargetText").textContent = text || "[Attachment]";
  document.getElementById("replyDock").classList.add("show");
  document.getElementById("chatInput").focus();
}

function cancelReply(){
  activeReply = null;
  document.getElementById("replyDock").classList.remove("show");
}

async function toggleInlineReaders(msgId){
  const tag = document.getElementById(`readers_${msgId}`);
  if (!tag) return;

  if (tag.classList.contains("show")) {
    tag.classList.remove("show");
    return;
  }

  try {
    const res = await fetch(`/api/messages/readers?message_id=${msgId}&token=${encodeURIComponent(authToken)}`);
    if (!res.ok) return;
    const d = await res.json();
    if (!d.readers || !d.readers.length) {
      tag.textContent = "Not read by anyone yet";
    } else {
      tag.textContent = `Read by: @${d.readers.join(", @")}`;
    }
    tag.classList.add("show");
  } catch(e) {}
}

function onComposerInput(input){
  emitTyping();
  const val = input.value;
  const cursor = input.selectionStart;
  const textBefore = val.slice(0, cursor);
  const atIdx = textBefore.lastIndexOf("@");

  if (atIdx !== -1 && (atIdx === 0 || /\s/.test(textBefore[atIdx - 1]))) {
    const query = textBefore.slice(atIdx + 1).toLowerCase();
    mentionMatchStart = atIdx;
    
    const activeAlias = (getActiveRoomAlias() || "").toLowerCase();
    const matches = roomMembersCache.filter(u => u && u.toLowerCase() !== activeAlias && u.toLowerCase().startsWith(query));
    
    if (matches.length > 0) {
      showMentionMenu(matches);
      return;
    }
  }
  hideMentionMenu();
}

function showMentionMenu(matches){
  const menu = document.getElementById("mentionMenu");
  mentionSelectedIndex = 0;
  menu.innerHTML = matches.map((m, idx) => `
    <div class="mention-item ${idx === 0 ? 'selected' : ''}" onclick="insertMention('${esc(m)}')">
      <div class="av pres-green" style="width:22px;height:22px;font-size:.65rem">${esc(initials(m))}</div>
      <span style="font-weight:600">@${esc(m)}</span>
    </div>
  `).join("");
  menu.classList.add("show");
}

function hideMentionMenu(){
  document.getElementById("mentionMenu").classList.remove("show");
  mentionMatchStart = -1;
}

function insertMention(username){
  const input = document.getElementById("chatInput");
  const val = input.value;
  const before = val.slice(0, mentionMatchStart);
  const after = val.slice(input.selectionStart);
  
  input.value = `${before}@${username} ${after}`;
  hideMentionMenu();
  input.focus();
  const newPos = before.length + username.length + 2;
  input.setSelectionRange(newPos, newPos);
}

function onComposerKeyDown(e){
  const menu = document.getElementById("mentionMenu");
  if (menu.classList.contains("show")) {
    const items = menu.querySelectorAll(".mention-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      mentionSelectedIndex = (mentionSelectedIndex + 1) % items.length;
      updateSelectedMention(items);
      return;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      mentionSelectedIndex = (mentionSelectedIndex - 1 + items.length) % items.length;
      updateSelectedMention(items);
      return;
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      if (items[mentionSelectedIndex]) {
        items[mentionSelectedIndex].click();
      }
      return;
    } else if (e.key === "Escape") {
      hideMentionMenu();
      return;
    }
  }

  if (e.key === "Enter") {
    e.preventDefault();
    sendMsg();
  }
}

function updateSelectedMention(items){
  items.forEach((it, idx) => {
    it.classList.toggle("selected", idx === mentionSelectedIndex);
  });
}

function connectRoom(id,title,isDm){
  if(ws) ws.close();
  currentRoom=id; currentRoomTitle=title; currentRoomIsDm=isDm;
  
  const isEphemeral = id.startsWith("tmp_");
  const activeAlias = getActiveRoomAlias();

  const chip = document.getElementById("roomChip");
  chip.classList.toggle("eph", isEphemeral);
  chip.textContent = isDm ? title : (isEphemeral ? "⚡ "+id : "# "+title);
  
  document.getElementById("chatTitle").textContent = title;
  document.getElementById("chatSub").textContent = isEphemeral 
    ? `Ephemeral Space · Identity: @${activeAlias}` 
    : (id==="public" ? "Open channel · 48h auto-purge" : (isDm ? "Direct 1-on-1 private session" : `Key: ${id}`));
  
  document.getElementById("messages").innerHTML="";
  document.getElementById("typingBar").style.display="none";
  document.getElementById("eventTicker").classList.remove("show");
  cancelReply();
  hideMentionMenu();
  renderRoomLists();

  const proto=location.protocol==="https:"?"wss:":"ws:";
  let authQuery = `?client_id=${myClientId}`;
  if (authToken && !isEphemeral) {
    authQuery += `&token=${encodeURIComponent(authToken)}`;
  }

  const connUser = isEphemeral ? activeAlias : myUser;

  ws=new WebSocket(`${proto}//${location.host}/ws/${id}/${encodeURIComponent(connUser)}${authQuery}`);
  
  ws.onclose = (e) => {
    if (e.code === 4004 || e.code === 4003) {
      showToast(e.reason || "Access denied or room expired.", "⚠️");
      if (id.startsWith("tmp_")) unpinEphemeralRoom(id);
      if (id !== "public" && !isGuestUser) openRoom("public", "Public Group", false);
    }
  };

  ws.onmessage=(e)=>{
    const d=JSON.parse(e.data);
    const activeAliasNow = getActiveRoomAlias();

    if(d.type==="init"){
      if(d.assigned_username && !isEphemeral){
        myUser = d.assigned_username;
        refreshSidebarIdentity();
      }

      if(id.startsWith("dm_")){
        const raw = id.replace("dm_", "");
        const parts = raw.includes("__") ? raw.split("__") : raw.split("_");
        const otherUser = parts[0].toLowerCase() === activeAliasNow.toLowerCase() ? parts[1] : parts[0];
        currentRoomTitle = "@" + otherUser;
        document.getElementById("chatTitle").textContent = currentRoomTitle;
        chip.textContent = currentRoomTitle;
      }

      currentCreator=d.created_by;
      amIRoomAdmin = !!d.is_admin;
      document.getElementById("messages").innerHTML="";
      d.messages.forEach(m=>addBubble(m, m.sender===activeAliasNow, false));
      
      if(d.members) roomMembersCache = d.members;
      syncSpaceInspector();
    } else if(d.type==="chat"){
      const isMe = (d.sender_cid && d.sender_cid === myClientId) || (d.sender === activeAliasNow);
      addBubble(d, isMe, true);
      
      if (!isMe) {
        const isMentioned = d.mentions && d.mentions.map(m=>m.toLowerCase()).includes(activeAliasNow.toLowerCase());
        
        if (currentRoom !== "public" || isMentioned) {
          playNotifySound(isMentioned);
        }

        // Add to notification center only if message is inside current room
        if (isMentioned && d.room_id === currentRoom) {
          showToast(`@${d.sender} tagged you in ${currentRoomTitle}`, "🔔");
          pushActivityNotification(
            "mention",
            `@${d.sender} tagged you in ${currentRoomTitle}`,
            d.text || "Mentioned you in a message",
            { room_id: currentRoom, room_name: currentRoomTitle }
          );
        }

        if (document.hidden) {
          unreadCount++;
          document.title = `(${unreadCount}) ChatHub • @${d.sender} messaged!`;

          if ("Notification" in window && Notification.permission === "granted" && (currentRoom !== "public" || isMentioned)) {
            new Notification(`@${d.sender} in ${currentRoomTitle}`, {
              body: d.text || (d.filename ? `[File] ${d.original_name}` : "Sent a message"),
              icon: "/favicon.ico"
            });
          }
        }
        
        if (d.id) {
          ws.send(JSON.stringify({type:"read_ack", message_id: d.id}));
        }
      }
    } else if(d.type==="user_mentioned"){
      // Cross-room mention alert handler (only trigger if not viewing this room)
      if(currentRoom !== d.room_id){
        playNotifySound(true);
        showToast(`@${d.by} tagged you in a message!`, "🔔");
        pushActivityNotification(
          "mention",
          `@${d.by} tagged you`,
          d.text || "Mentioned you in a message",
          { room_id: d.room_id, room_name: d.room_id === "public" ? "Public Group" : d.room_id }
        );
      }
    } else if(d.type==="typing"){
      const isMe = (d.sender_cid && d.sender_cid === myClientId) || (d.sender === activeAliasNow);
      if(!isMe){
        document.getElementById("typingUser").textContent = d.sender;
        document.getElementById("typingBar").style.display = "flex";
        clearTimeout(typingTimer);
        typingTimer = setTimeout(()=>{ document.getElementById("typingBar").style.display = "none"; }, 2500);
      }
    } else if(d.type==="read_ack"){
      const tick = document.querySelector(`.tick[data-msg-id="${d.message_id}"]`);
      if(tick){
        tick.textContent = "✓✓";
        tick.className = "tick stage-2";
      }
    } else if(d.type==="all_read_ack"){
      document.querySelectorAll(".msg-group.me .tick").forEach(c => {
        c.textContent = "✓✓";
        c.className = "tick stage-2";
      });
    } else if(d.type==="presence_sync"){
      if(d.members) roomMembersCache = d.members;
      syncSpaceInspector();
    } else if(d.type==="system"){
      triggerEventTicker(d.text);
      syncSpaceInspector();
    } else if(d.type==="dm_request_received"){
      fetchRequests();
      playNotifySound(true);
      showToast(`@${d.from} requested chat permission.`, "✉️");
    } else if(d.type==="dm_request_accepted"){
      fetchMyRooms();
      playNotifySound(true);
      showToast(`@${d.by} accepted your request.`, "🤝");
      pushActivityNotification("system", `@${d.by} accepted invitation`, "Direct message stream unlocked");
    } else if(d.type==="kicked"){
      showToast(d.reason || "You were removed from this room.", "🚫");
      fetchMyRooms();
      if (!isGuestUser) openRoom("public","Public Group",false);
    } else if(d.type==="room_destructed"){
      showToast(d.detail, "⚠️");
      unpinEphemeralRoom(d.room_id);
      fetchMyRooms();
      if (!isGuestUser) openRoom("public","Public Group",false);
    }
  };
}

function sendMsg(){
  const input=document.getElementById("chatInput"), text=input.value.trim();
  if(!text||!ws||ws.readyState!==1) return;
  ws.send(JSON.stringify({
    type: "chat",
    text: text,
    reply_to: activeReply
  }));
  input.value="";
  cancelReply();
  hideMentionMenu();
}

async function uploadSelectedFile(input){
  if(!input.files || !input.files[0]) return;
  const file = input.files[0];
  const formData = new FormData();
  formData.append("file", file);
  formData.append("token", authToken);
  formData.append("room_id", currentRoom);
  formData.append("guest_user", getActiveRoomAlias());
  formData.append("client_id", myClientId);
  if (activeReply) {
    formData.append("reply_to_id", activeReply.id);
    formData.append("reply_to_sender", activeReply.sender);
    formData.append("reply_to_text", activeReply.text);
  }
  input.value = "";
  try {
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if(!res.ok) showToast("Upload rejected (100MB max limit)", "❌");
    cancelReply();
  } catch(e) {
    showToast("Upload failed", "❌");
  }
}

function addBubble(msg, isMe, isNew=false){
  const box=document.getElementById("messages");
  const row=document.createElement("div");
  const activeAliasNow = getActiveRoomAlias();
  
  const isMentioned = msg.mentions && msg.mentions.map(m=>m.toLowerCase()).includes(activeAliasNow.toLowerCase());
  row.className=`msg-group ${isMe?"me":"them"} ${isNew?"new-entry":""} ${isMentioned?"mentioned":""}`;
  
  let content = "";

  if(msg.reply_to && msg.reply_to.id){
    content += `
      <div class="reply-quote">
        <span class="reply-quote-sender">@${esc(msg.reply_to.sender)}</span>
        <span class="reply-quote-text">${esc(msg.reply_to.text || '[Attachment]')}</span>
      </div>`;
  }

  if(msg.text) content += `<div>${esc(msg.text)}</div>`;
  if(msg.filename){
    const fn = msg.filename.toLowerCase();
    const displayName = msg.original_name || msg.filename;
    
    if(fn.match(/\.(flac|mp3|wav|ogg|m4a|aac)$/i)){
      content += `
        <div class="audio-player-box">
          <div style="font-size:.74rem;color:var(--text);margin-bottom:3px">🎵 ${esc(displayName)}</div>
          <audio controls preload="metadata">
            <source src="/uploads/${msg.filename}">
          </audio>
        </div>`;
    } 
    else if(fn.match(/\.(png|jpg|jpeg|gif|webp)$/i)){
      content += `<a href="/uploads/${msg.filename}" target="_blank" class="bubble-media"><img src="/uploads/${msg.filename}" /></a>`;
    } 
    else {
      content += `<a class="file-chip" href="/uploads/${msg.filename}" download="${esc(displayName)}">📁 ${esc(displayName)}</a>`;
    }
  }

  let tickMarkup = "";
  if(isMe){
    const stage = msg.is_read >= 2 ? 2 : (msg.is_read === 1 ? 1 : 0);
    const tickIcon = stage === 0 ? "✓" : "✓✓";
    tickMarkup = `<span class="tick stage-${stage}" data-msg-id="${msg.id||''}" onclick="toggleInlineReaders(${msg.id||0})" title="Click to view readers">${tickIcon}</span>`;
  }

  const replyBtn = `<button class="reply-action-btn" onclick="setReplyTarget(${msg.id||0}, '${esc(msg.sender)}', '${esc(msg.text || (msg.filename ? '[Attachment]' : ''))}')" title="Reply">↩</button>`;

  row.innerHTML = `
    <span class="msg-meta">${esc(msg.sender_display || msg.sender)} <span class="time">${fmtTime(msg.timestamp)}</span> ${tickMarkup}</span>
    <div class="bubble-container">
      <div class="bubble">${content}</div>
      ${replyBtn}
    </div>
    <div class="read-by-tag" id="readers_${msg.id||0}"></div>
  `;
  box.appendChild(row); 
  box.scrollTop=box.scrollHeight;
}

