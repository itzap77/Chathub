function setAuthTab(m){
  authMode = m;
  document.getElementById("authTabLogin").classList.toggle("active", m === "login");
  document.getElementById("authTabReg").classList.toggle("active", m === "register");
  document.getElementById("authSubmitBtn").textContent = m === "login" ? "Sign In" : "Create Account";
  document.getElementById("authHeading").textContent = m === "login" ? "Welcome Back" : "Join ChatHub";
  document.getElementById("authSub").textContent = m === "login" ? "Enter your credentials to continue" : "Create a permanent user identity";
}

async function submitAuth(){
  const u=document.getElementById("authUser").value.trim().toLowerCase();
  const p=document.getElementById("authPass").value;
  if(!u||!p) return showToast("Username and password required", "⚠️");

  try {
    const res=await fetch(`/api/${authMode}`,{method:"POST",body:new URLSearchParams({username:u,password:p})});
    const data=await res.json();
    if(!res.ok) return showToast(data.detail || "Authentication error", "❌");

    if(authMode === "register"){
      showToast("Account created! Please sign in.", "✓");
      document.getElementById("authPass").value = "";
      setAuthTab("login");
    } else {
      isGuestUser = false;
      myUser=data.username; authToken=data.token;
      
      myDisplayName = "";
      refreshSidebarIdentity();
      document.getElementById("navPublic").style.display="flex";
      document.getElementById("btnCreateSpace").style.display="flex";
      document.getElementById("dmLabel").style.display="block";
      document.getElementById("searchBtn").style.display="grid";
      
      renderAvatar(document.getElementById("sideAvatar"),myUser,"pres-green");
      closeOverlay("authOverlay");
      loadMyDisplayName();
      await Promise.all([fetchMyRooms(),fetchRequests()]);
      openRoom("public","Public Group",false);
    }
  } catch(e) {
    showToast("Unable to connect to server", "❌");
  }
}

function logout(){ 
  if(ws) ws.close(); 
  myUser=""; 
  authToken=""; 
  window.history.replaceState(null, null, window.location.pathname);
  location.reload(); 
}

function applyGuestUIRestrictions(){
  document.getElementById("sideUser").textContent = myUser;
  document.getElementById("sideStatus").textContent = "temporary guest";
  renderAvatar(document.getElementById("sideAvatar"), myUser, "pres-green");
  
  document.getElementById("navPublic").style.display = "none";
  document.getElementById("requestsWrap").style.display = "none";
  document.getElementById("searchBtn").style.display = "none";
  document.getElementById("btnCreateSpace").style.display = "none";
  document.getElementById("dmLabel").style.display = "none";
  document.getElementById("roomsList").innerHTML = "";
  document.getElementById("dmsList").innerHTML = "";
}


function setAccountTab(tab){
  document.getElementById("acctTabProfile").classList.toggle("active", tab === "profile");
  document.getElementById("acctTabPassword").classList.toggle("active", tab === "password");
  document.getElementById("acctProfilePane").style.display = tab === "profile" ? "block" : "none";
  document.getElementById("acctPasswordPane").style.display = tab === "password" ? "block" : "none";
}

async function openMyAccount(){
  if(isGuestUser) return showToast("Guest sessions don't have an account", "⚠️");
  document.getElementById("myAcctUsername").textContent = myUser;
  renderAvatar(document.getElementById("myAcctAvatar"), myUser, "pres-green");
  setAccountTab("profile");
  document.getElementById("acctCurrentPass").value = "";
  document.getElementById("acctNewPass").value = "";
  document.getElementById("acctConfirmPass").value = "";

  try {
    const res = await fetch(`/api/account/profile?token=${encodeURIComponent(authToken)}`);
    const data = await res.json();
    if(res.ok){
      document.getElementById("acctDisplayName").value = data.display_name || "";
      document.getElementById("acctBio").value = data.bio || "";
      document.getElementById("acctShowDisplayName").checked = !!data.show_display_name;
      document.getElementById("acctShowBio").checked = !!data.show_bio;
    }
  } catch(e) {}

  openOverlay("myAccountOverlay");
}

async function saveAccountProfile(){
  const display_name = document.getElementById("acctDisplayName").value.trim();
  const bio = document.getElementById("acctBio").value.trim();
  const show_display_name = document.getElementById("acctShowDisplayName").checked;
  const show_bio = document.getElementById("acctShowBio").checked;
  try {
    const res = await fetch("/api/account/update_profile", {
      method: "POST",
      body: new URLSearchParams({
        token: authToken,
        display_name,
        bio,
        show_display_name: show_display_name ? "on" : "",
        show_bio: show_bio ? "on" : ""
      })
    });
    const data = await res.json();
    if(!res.ok) return showToast(apiError(data, "Couldn't save profile"), "❌");
    myDisplayName = data.display_name || "";
    refreshSidebarIdentity();
    showToast("Profile saved", "✓");
  } catch(e) {
    showToast("Network error saving profile", "❌");
  }
}

async function saveAccountPassword(){
  const current_password = document.getElementById("acctCurrentPass").value;
  const new_password = document.getElementById("acctNewPass").value;
  const confirm_password = document.getElementById("acctConfirmPass").value;

  if(!current_password || !new_password) return showToast("Fill in both password fields", "⚠️");
  if(new_password !== confirm_password) return showToast("New passwords don't match", "⚠️");
  if(new_password.length < 6) return showToast("New password must be 6+ characters", "⚠️");

  try {
    const res = await fetch("/api/account/change_password", {
      method: "POST",
      body: new URLSearchParams({ token: authToken, current_password, new_password })
    });
    const data = await res.json();
    if(!res.ok) return showToast(apiError(data, "Couldn't change password"), "❌");
    showToast("Password updated", "✓");
    document.getElementById("acctCurrentPass").value = "";
    document.getElementById("acctNewPass").value = "";
    document.getElementById("acctConfirmPass").value = "";
  } catch(e) {
    showToast("Network error changing password", "❌");
  }
}


// Sidebar identity: your display name (if you set one) is shown to YOU regardless
// of the visibility checkbox; that checkbox only controls what OTHER users see.
function refreshSidebarIdentity(){
  if(isGuestUser) return;
  const nameEl = document.getElementById("sideUser");
  const subEl = document.getElementById("sideStatus");
  if(myDisplayName){
    nameEl.textContent = myDisplayName;
    subEl.textContent = "@" + myUser;
  } else {
    nameEl.textContent = myUser;
    subEl.textContent = "profile & settings";
  }
}

async function loadMyDisplayName(){
  try {
    const res = await fetch(`/api/account/profile?token=${encodeURIComponent(authToken)}`);
    if(!res.ok) return;
    const data = await res.json();
    myDisplayName = data.display_name || "";
    refreshSidebarIdentity();
  } catch(e) {}
}
