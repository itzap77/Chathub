// CLEAN ADDRESS BAR ON PAGE LOAD: Clear any leftover hash fragments from past sessions
if (window.location.hash) {
  window.history.replaceState(null, null, window.location.pathname);
}

// In-memory session state (pure, matching original backup)
let ws=null, myUser="", authToken="", currentView="chat", myDisplayName="";
let currentRoom="public", currentRoomTitle="Public Group", currentRoomIsDm=false, currentCreator="";
let myRooms=[], pendingRequests=[], directoryCache=[];
let typingTimer=null, lastTypingSent=0, tickerTimer=null, searchDebounce=null;
let authMode="login", isGuestUser=false, amIRoomAdmin=false;

let myPinnedEphemerals = [];
let rightPanelOpen = false;
let activeReply = null;

let roomMembersCache = [];
let mentionSelectedIndex = 0;
let mentionMatchStart = -1;

let activityFeed = [];
let activeNotifyFilter = "all";

let unreadCount = 0;
const ORIGINAL_TITLE = "ChatHub";

let myClientId = "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 10);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

if ("Notification" in window && Notification.permission === "default") {
  window.addEventListener("click", () => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, { once: true });
}

window.addEventListener("focus", () => {
  unreadCount = 0;
  document.title = ORIGINAL_TITLE;
});

const AV_COLORS=["#3a3a3a","#4a4a4a","#2e2e2e","#525252","#383838","#464646"];




const leftPanel=document.getElementById("leftPanel"), rightPanel=document.getElementById("rightPanel"), backdrop=document.getElementById("backdrop");
const toggleRightBtn = document.getElementById("toggleRightBtn");

































// CLEAN ROOM SWITCHING: Never updates URL hash, keeping address bar clean

































function toggleTheme(){
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("chathub_theme", next); } catch(e) {}
}
