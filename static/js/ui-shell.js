function toggleLeft(){
  rightPanel.classList.remove("open");
  leftPanel.classList.toggle("open");
  backdrop.classList.toggle("show", leftPanel.classList.contains("open") || rightPanel.classList.contains("open"));
}

function toggleRight(){
  if(currentView !== "chat") return;
  if(window.innerWidth < 768){
    leftPanel.classList.remove("open");
    rightPanel.classList.toggle("open");
    backdrop.classList.toggle("show", rightPanel.classList.contains("open"));
    toggleRightBtn.classList.toggle("active-btn", rightPanel.classList.contains("open"));
  } else {
    rightPanelOpen = !rightPanelOpen;
    rightPanel.style.display = rightPanelOpen ? "flex" : "none";
    toggleRightBtn.classList.toggle("active-btn", rightPanelOpen);
  }
}

function closePanels(){
  leftPanel.classList.remove("open");
  rightPanel.classList.remove("open");
  backdrop.classList.remove("show");
  toggleRightBtn.classList.remove("active-btn");
}

function openOverlay(id){ document.getElementById(id).classList.add("open"); }

function closeOverlay(id){ document.getElementById(id).classList.remove("open"); }

function onBrandClick(){
  if (isGuestUser) {
    showToast("Guest accounts cannot access user directory", "ℹ️");
    return;
  }
  showHome();
}

function setView(name){
  if(isGuestUser && name !== "chat"){
    showToast("Guest mode is isolated to temporary rooms only", "ℹ️");
    return;
  }
  currentView = name;
  const isChat = (name === "chat");

  document.getElementById("homeView").style.display = name==="home" ? "flex" : "none";
  document.getElementById("notifyView").style.display = name==="notify" ? "flex" : "none";
  document.getElementById("chatView").style.display = isChat ? "flex" : "none";

  document.getElementById("roomChip").style.display = isChat ? "block" : "none";
  document.getElementById("headerInfoBtn").style.display = isChat ? "grid" : "none";
  toggleRightBtn.style.display = isChat ? "grid" : "none";

  if (!isChat) {
    rightPanel.style.display = "none";
    toggleRightBtn.classList.remove("active-btn");
  } else if (window.innerWidth >= 768) {
    rightPanel.style.display = rightPanelOpen ? "flex" : "none";
    toggleRightBtn.classList.toggle("active-btn", rightPanelOpen);
  }

  renderRoomLists();
  closePanels();
}

function showHome(){ setView("home"); refreshDirectory(); }

function showNotifications(){ setView("notify"); renderNotifications(); }

