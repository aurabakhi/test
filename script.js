import { db, rtdb } from "./firebase.js";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  updateDoc,
  increment,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

import { 
  ref, 
  push, 
  onValue, 
  query as rtdbQuery, 
  limitToLast, 
  serverTimestamp as rtdbTimestamp,
  get,
  set,
  remove
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

// ==========================================
// NAVIGATION & SCREEN MANAGEMENT
// ==========================================
const screens = {
  loadingScreen: document.getElementById("loadingScreen"),
  home: document.getElementById("home"),
  register: document.getElementById("register"),
  waiting: document.getElementById("waiting"),
  schedule: document.getElementById("schedule"),
  voteScreen: document.getElementById("voteScreen"),
  rulesScreen: document.getElementById("rulesScreen"),
  chatScreen: document.getElementById("chatScreen")
};

function showScreen(name) {
  Object.values(screens).forEach((s) => {
    if (s) s.classList.remove("active");
  });
  if (screens[name]) {
    screens[name].classList.add("active");
  }
}

let userIP = "";
let unsubscribeRegistration = null;

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let os = "Không xác định";
  let deviceType = "Máy tính";
  if (/Android/i.test(ua)) { os = "Android"; deviceType = "Điện thoại"; } 
  else if (/iPhone/i.test(ua)) { os = "iPhone"; deviceType = "Điện thoại"; } 
  else if (/iPad/i.test(ua)) { os = "iPad"; deviceType = "Máy tính bảng"; } 
  else if (/Windows/i.test(ua)) { os = "Windows"; deviceType = "Máy tính"; } 
  else if (/Macintosh|Mac OS X/i.test(ua)) { os = "macOS"; deviceType = "Máy tính"; }
  return `${deviceType} (${os})`;
}

function getOrCreateDeviceId() {
  let storedId = localStorage.getItem("browser_device_id");
  if (storedId) return storedId;
  const finalDeviceId = "dev_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now().toString(36);
  localStorage.setItem("browser_device_id", finalDeviceId);
  return finalDeviceId;
}

async function checkUserOnLoad() {
  showScreen("loadingScreen");
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    userIP = data.ip;

    const deviceId = getOrCreateDeviceId();
    const devQuery = query(collection(db, "registrations"), where("deviceId", "==", deviceId));
    const devSnapshot = await getDocs(devQuery);

    if (!devSnapshot.empty) {
      listenToRegistrationStatus(devSnapshot.docs[0].id);
      return;
    }

    const ipQuery = query(collection(db, "registrations"), where("ip", "==", userIP));
    const ipSnapshot = await getDocs(ipQuery);

    if (!ipSnapshot.empty) {
      listenToRegistrationStatus(ipSnapshot.docs[0].id);
      return;
    }

    const localRegId = localStorage.getItem("user_registration_id");
    if (localRegId) {
      listenToRegistrationStatus(localRegId);
      return;
    }

    showScreen("home");
  } catch (err) {
    console.error("Lỗi kiểm tra thiết bị:", err);
    showScreen("home");
  }
}

function listenToRegistrationStatus(regId) {
  if (unsubscribeRegistration) unsubscribeRegistration();
  unsubscribeRegistration = onSnapshot(doc(db, "registrations", regId), (docSnap) => {
    if (!docSnap.exists()) {
      localStorage.removeItem("user_registration_id");
      showScreen("home");
      return;
    }
    const data = docSnap.data();
    showScreen("waiting");

    if (document.getElementById("waitingName")) document.getElementById("waitingName").textContent = data.name || "---";
    if (document.getElementById("waitingClass")) document.getElementById("waitingClass").textContent = data.className || "---";

    const statusIcon = document.getElementById("statusIcon");
    const waitingTitle = document.getElementById("waitingTitle");
    const waitingSubtitle = document.getElementById("waitingSubtitle");
    const waitingStatus = document.getElementById("waitingStatus");

    if (data.status === "approved") {
      if (statusIcon) statusIcon.textContent = "✅";
      if (waitingTitle) waitingTitle.textContent = "Đã được duyệt!";
      if (waitingSubtitle) waitingSubtitle.innerHTML = "Hồ sơ của bạn <strong>đã được chấp nhận</strong>. Chúc bạn thi đấu tốt!";
      if (waitingStatus) { waitingStatus.textContent = "Đã duyệt"; waitingStatus.className = "approved"; }
    } else if (data.status === "rejected") {
      if (statusIcon) statusIcon.textContent = "❌";
      if (waitingTitle) waitingTitle.textContent = "Đã bị từ chối";
      if (waitingSubtitle) waitingSubtitle.innerHTML = "Rất tiếc, hồ sơ của bạn <strong>đã bị từ chối</strong> bởi Ban Tổ Chức.";
      if (waitingStatus) { waitingStatus.textContent = "Đã bị từ chối"; waitingStatus.className = "rejected"; }
    } else {
      if (statusIcon) statusIcon.textContent = "⏳";
      if (waitingTitle) waitingTitle.textContent = "Đang chờ duyệt";
      if (waitingSubtitle) waitingSubtitle.innerHTML = "Hồ sơ của bạn đã được gửi. Hiện tại đang <strong>chờ duyệt</strong>.";
      if (waitingStatus) { waitingStatus.textContent = "Đang chờ duyệt"; waitingStatus.className = "pending"; }
    }
  }, () => showScreen("home"));
}

// ==========================================
// MENU BUTTON EVENTS
// ==========================================
document.getElementById("registerBtn")?.addEventListener("click", () => showScreen("register"));
document.getElementById("scheduleBtn")?.addEventListener("click", () => {
  showScreen("schedule");
  loadScheduleData();
  loadBracketData();
});
document.getElementById("backFromRegister")?.addEventListener("click", () => showScreen("home"));
document.getElementById("backFromSchedule")?.addEventListener("click", () => showScreen("home"));
document.getElementById("backHomeAfterRegister")?.addEventListener("click", () => showScreen("home"));

document.getElementById("voteBtn")?.addEventListener("click", () => {
  showScreen("voteScreen");
  initVoteScreen();
});
document.getElementById("backFromVote")?.addEventListener("click", () => showScreen("home"));

// LUẬT THI ĐẤU EVENTS
document.getElementById("rulesBtn")?.addEventListener("click", () => showScreen("rulesScreen"));
document.getElementById("backFromRules")?.addEventListener("click", () => showScreen("home"));

// ==========================================
// REGISTER FORM SUBMISSION
// ==========================================
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const registerError = document.getElementById("registerError");
  const submitBtn = document.getElementById("submitBtn");
  if (registerError) registerError.textContent = "";

  const nameInput = document.getElementById("name")?.value.trim();
  const classInput = document.getElementById("className")?.value.trim();

  if (!nameInput || !classInput) {
    if (registerError) registerError.textContent = "Vui lòng nhập đầy đủ thông tin.";
    return;
  }

  if (submitBtn) submitBtn.disabled = true;

  try {
    const deviceId = getOrCreateDeviceId();
    const docRef = await addDoc(collection(db, "registrations"), {
      name: nameInput,
      className: classInput,
      ip: userIP || "0.0.0.0",
      deviceId: deviceId,
      deviceInfo: getDeviceInfo(),
      status: "pending",
      createdAt: serverTimestamp()
    });

    localStorage.setItem("user_registration_id", docRef.id);
    listenToRegistrationStatus(docRef.id);
  } catch (err) {
    if (registerError) registerError.textContent = "Lỗi kết nối. Vui lòng thử lại!";
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
});

// ==========================================
// SCHEDULE & BRACKET
// ==========================================
function loadScheduleData() {
  const scheduleList = document.getElementById("scheduleList");
  if (!scheduleList) return;
  onSnapshot(query(collection(db, "matches"), orderBy("time", "asc")), (snapshot) => {
    scheduleList.innerHTML = "";
    if (snapshot.empty) {
      scheduleList.innerHTML = '<div class="empty">Chưa có lịch thi đấu nào được đăng.</div>';
      return;
    }
    snapshot.forEach((docSnap) => {
      const match = docSnap.data();
      const matchDate = match.time ? new Date(match.time.seconds * 1000) : null;
      const formattedTime = matchDate ? matchDate.toLocaleString("vi-VN") : "Chưa xác định";
      const card = document.createElement("div");
      card.className = "card match-card";
      card.innerHTML = `
        <div class="match-time">🕒 ${formattedTime}</div>
        <div class="match-versus">
          <span class="player-name">${escapeHtml(match.player1Name)}</span>
          <span class="vs">VS</span>
          <span class="player-name">${escapeHtml(match.player2Name)}</span>
        </div>
      `;
      scheduleList.appendChild(card);
    });
  });
}

function loadBracketData() {
  const bracketDisplay = document.getElementById("bracketDisplay");
  if (!bracketDisplay) return;
  onSnapshot(doc(db, "tournament", "bracket16"), (docSnap) => {
    if (!docSnap.exists()) {
      bracketDisplay.innerHTML = '<div class="empty">Sơ đồ cây chưa được cập nhật.</div>';
      return;
    }
    const data = docSnap.data();
    let html = `<div class="bracket-tree-container"><div class="bracket-grid">`;
    for (let i = 1; i <= 31; i++) {
      const slotVal = data[`slot_${i}`] || "---";
      html += `<div class="tree-node node-${i}"><span>Slot ${i}:</span> <strong>${escapeHtml(slotVal)}</strong></div>`;
    }
    html += `</div></div>`;
    bracketDisplay.innerHTML = html;
  });
}

// ==========================================
// VOTE SYSTEM (TỰ ĐỘNG KHỞI TẠO NẾU THIẾU DỮ LIỆU)
// ==========================================
function initVoteScreen() {
  const voteContent = document.getElementById("voteContent");
  if (!voteContent) return;

  const voteDocRef = doc(db, "settings", "voteConfig");

  onSnapshot(voteDocRef, async (docSnap) => {
    // Nếu chưa có dữ liệu bình chọn trên Firestore, tự động khởi tạo
    if (!docSnap.exists()) {
      await setDoc(voteDocRef, {
        active: true,
        matchId: "match_01",
        playerA: "Người chơi A",
        playerB: "Người chơi B",
        votesA: 0,
        votesB: 0
      });
      return;
    }

    const voteData = docSnap.data();

    if (!voteData.active) {
      voteContent.innerHTML = '<div class="empty">Tính năng bình chọn hiện chưa mở.</div>';
      return;
    }

    const total = (voteData.votesA || 0) + (voteData.votesB || 0);
    const percentA = total > 0 ? Math.round(((voteData.votesA || 0) / total) * 100) : 50;
    const percentB = total > 0 ? (100 - percentA) : 50;
    const hasVoted = localStorage.getItem(`voted_${voteData.matchId || 'current'}`);

    voteContent.innerHTML = `
      <div class="vote-header">
        <h2>${escapeHtml(voteData.playerA || "A")} <span style="color:#e53935;">VS</span> ${escapeHtml(voteData.playerB || "B")}</h2>
        <p class="muted">Tổng số phiếu: ${total}</p>
      </div>
      <div class="vote-bar-container" style="display:flex; height:20px; background:#333; border-radius:10px; overflow:hidden; margin:16px 0;">
        <div style="width: ${percentA}%; background:#e53935; text-align:center; color:#fff; font-size:12px; line-height:20px;">${percentA}%</div>
        <div style="width: ${percentB}%; background:#0084ff; text-align:center; color:#fff; font-size:12px; line-height:20px;">${percentB}%</div>
      </div>
      <div class="vote-actions" style="display:flex; gap:12px; margin-top:20px;">
        <button id="voteBtnA" class="primary" style="flex:1;" ${hasVoted ? 'disabled' : ''}>Vote ${escapeHtml(voteData.playerA || "A")}</button>
        <button id="voteBtnB" class="primary" style="flex:1; background:#0084ff;" ${hasVoted ? 'disabled' : ''}>Vote ${escapeHtml(voteData.playerB || "B")}</button>
      </div>
      ${hasVoted ? '<p class="muted" style="margin-top:12px; text-align:center;">Bạn đã bình chọn cho trận đấu này rồi!</p>' : ''}
    `;

    if (!hasVoted) {
      document.getElementById("voteBtnA")?.addEventListener("click", () => handleVote("A", voteData.matchId));
      document.getElementById("voteBtnB")?.addEventListener("click", () => handleVote("B", voteData.matchId));
    }
  });
}

async function handleVote(option, matchId) {
  try {
    await updateDoc(doc(db, "settings", "voteConfig"), {
      [option === "A" ? "votesA" : "votesB"]: increment(1)
    });
    localStorage.setItem(`voted_${matchId || 'current'}`, "true");
  } catch (err) {
    alert("Không thể gửi bình chọn. Thử lại sau!");
  }
}

// ==========================================
// CHAT PROFILE & AUTH LOGIC
// ==========================================
let currentUsername = localStorage.getItem("chat_username") || "";
let avatarBase64 = "";
let rawImageObj = null;

// NÚT QUAY LẠI TỪ MODAL ĐĂNG KÝ/ĐĂNG NHẬP CHAT
document.getElementById("closeAuthModalBtn")?.addEventListener("click", () => {
  document.getElementById("usernameModal")?.classList.remove("active");
  showScreen("home");
});

// CHUYỂN ĐỔI TAB ĐĂNG KÝ / ĐĂNG NHẬP
const tabRegisterBtn = document.getElementById("tabRegisterBtn");
const tabLoginBtn = document.getElementById("tabLoginBtn");
const usernameForm = document.getElementById("usernameForm");
const loginForm = document.getElementById("loginForm");

tabRegisterBtn?.addEventListener("click", () => {
  tabRegisterBtn.style.color = "#2563eb";
  tabLoginBtn.style.color = "#888";
  usernameForm.style.display = "block";
  loginForm.style.display = "none";
});

tabLoginBtn?.addEventListener("click", () => {
  tabLoginBtn.style.color = "#2563eb";
  tabRegisterBtn.style.color = "#888";
  usernameForm.style.display = "none";
  loginForm.style.display = "block";
});

document.getElementById("chatBtn")?.addEventListener("click", () => {
  if (!currentUsername) {
    document.getElementById("usernameModal")?.classList.add("active");
  } else {
    showScreen("chatScreen");
    updateChatHeaderInfo();
    initChatListener();
  }
});
document.getElementById("backFromChat")?.addEventListener("click", () => showScreen("home"));

async function updateChatHeaderInfo() {
  const currentNicknameTag = document.getElementById("currentNicknameTag");
  if (!currentNicknameTag || !currentUsername) return;

  try {
    const snap = await get(ref(rtdb, `users_profile/${currentUsername}`));
    if (snap.exists()) {
      const data = snap.val();
      const displayNameShow = data.displayName || data.username;
      currentNicknameTag.textContent = `Tài khoản: @${data.username} (${displayNameShow})`;
    } else {
      currentNicknameTag.textContent = `Tài khoản: @${currentUsername}`;
    }
  } catch (err) {
    currentNicknameTag.textContent = `Tài khoản: @${currentUsername}`;
  }
}

document.getElementById("btnSignOut")?.addEventListener("click", () => {
  if (confirm("Bạn có chắc chắn muốn đăng xuất tài khoản chat không?")) {
    localStorage.removeItem("chat_username");
    currentUsername = "";
    showScreen("home");
    alert("Đã đăng xuất thành công!");
  }
});

// ==========================================
// AVATAR HANDLING (FILE, DRAG & DROP, CTRL+V)
// ==========================================
function loadImageFromFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    rawImageObj = new Image();
    rawImageObj.onload = processAvatarZoom;
    rawImageObj.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

document.getElementById("avatarFileInput")?.addEventListener("change", (e) => {
  if (e.target.files && e.target.files[0]) {
    loadImageFromFile(e.target.files[0]);
  }
});

const dropZone = document.getElementById("dropZone");
if (dropZone) {
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.style.borderColor = "#2563eb";
      dropZone.style.background = "#1e293b";
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.style.borderColor = "#444";
      dropZone.style.background = "#16161e";
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files[0]) {
      loadImageFromFile(files[0]);
    }
  }, false);
}

document.addEventListener("paste", (e) => {
  const usernameModal = document.getElementById("usernameModal");
  if (!usernameModal || !usernameModal.classList.contains("active")) return;

  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let item of items) {
    if (item.type.indexOf("image") !== -1) {
      const file = item.getAsFile();
      loadImageFromFile(file);
      break;
    }
  }
});

document.getElementById("zoomRange")?.addEventListener("input", () => {
  if (rawImageObj) processAvatarZoom();
});

function processAvatarZoom() {
  const avatarPreview = document.getElementById("avatarPreview");
  const zoomRange = document.getElementById("zoomRange");
  if (!rawImageObj || !avatarPreview) return;
  
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const size = 150; 
  canvas.width = size; canvas.height = size;

  const zoom = parseFloat(zoomRange ? zoomRange.value : 1);
  const scale = Math.max(size / rawImageObj.width, size / rawImageObj.height) * zoom;
  const width = rawImageObj.width * scale;
  const height = rawImageObj.height * scale;
  const x = (size - width) / 2;
  const y = (size - height) / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(rawImageObj, x, y, width, height);

  avatarBase64 = canvas.toDataURL("image/jpeg", 0.8);
  avatarPreview.src = avatarBase64;
  avatarPreview.style.display = "block";
}

// FORM ĐĂNG KÝ CHAT
document.getElementById("usernameForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const usernameError = document.getElementById("usernameError");
  const enteredUsername = document.getElementById("modalUsernameInput").value.trim().toLowerCase();
  const enteredPassword = document.getElementById("modalPasswordInput").value.trim();
  const enteredBio = document.getElementById("modalBioInput")?.value.trim() || "";

  if (!/^[a-z0-9]+$/.test(enteredUsername)) {
    if (usernameError) usernameError.textContent = "Username KHÔNG được chứa chữ viết hoa, ký hiệu đặc biệt hoặc khoảng trắng!";
    return;
  }
  if (enteredUsername.includes("admin") || enteredUsername.includes("btc")) {
    if (usernameError) usernameError.textContent = "Username này chứa từ khóa hạn chế!";
    return;
  }
  if (enteredPassword.length < 4) {
    if (usernameError) usernameError.textContent = "Mật khẩu phải tối thiểu 4 ký tự!";
    return;
  }

  try {
    const nameRef = ref(rtdb, `users_profile/${enteredUsername}`);
    const snapshot = await get(nameRef);
    if (snapshot.exists()) {
      if (usernameError) usernameError.textContent = "Username này đã được sử dụng!";
      return;
    }
    
    const finalAvatar = avatarBase64 || `https://ui-avatars.com/api/?name=${encodeURIComponent(enteredUsername)}&background=2563eb&color=fff`;

    await set(nameRef, {
      username: enteredUsername,
      password: enteredPassword,
      displayName: enteredUsername,
      avatar: finalAvatar,
      bio: enteredBio,
      createdAt: rtdbTimestamp()
    });

    localStorage.setItem("chat_username", enteredUsername);
    currentUsername = enteredUsername;
    document.getElementById("usernameModal")?.classList.remove("active");
    showScreen("chatScreen");
    updateChatHeaderInfo();
    initChatListener();
  } catch (err) {
    if (usernameError) usernameError.textContent = "Lỗi kết nối Server. Vui lòng thử lại!";
  }
});

// FORM ĐĂNG NHẬP CHAT
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const loginError = document.getElementById("loginError");
  const enteredUsername = document.getElementById("loginUsernameInput").value.trim().toLowerCase();
  const enteredPassword = document.getElementById("loginPasswordInput").value.trim();

  if (!enteredUsername || !enteredPassword) {
    if (loginError) loginError.textContent = "Vui lòng nhập đầy đủ thông tin!";
    return;
  }

  try {
    const userRef = ref(rtdb, `users_profile/${enteredUsername}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      if (loginError) loginError.textContent = "Tài khoản không tồn tại!";
      return;
    }

    const userData = snapshot.val();
    if (userData.password !== enteredPassword) {
      if (loginError) loginError.textContent = "Sai mật khẩu!";
      return;
    }

    localStorage.setItem("chat_username", enteredUsername);
    currentUsername = enteredUsername;
    document.getElementById("usernameModal")?.classList.remove("active");
    showScreen("chatScreen");
    updateChatHeaderInfo();
    initChatListener();
  } catch (err) {
    if (loginError) loginError.textContent = "Lỗi kết nối Server. Vui lòng thử lại!";
  }
});

// ==========================================
// CHAT MESSAGES REALTIME (ĐÃ KHẮC PHỤC TRÙNG LẶP TIN NHẮN)
// ==========================================
let isChatInitialized = false;

function initChatListener() {
  if (isChatInitialized) return;
  isChatInitialized = true;

  const chatMessages = document.getElementById("chatMessages");

  onValue(rtdbQuery(ref(rtdb, "chat_messages"), limitToLast(60)), (snapshot) => {
    if (!chatMessages) return;

    chatMessages.innerHTML = "";
    if (!snapshot.exists()) {
      chatMessages.innerHTML = '<div class="empty">Chưa có tin nhắn nào.</div>';
      return;
    }

    snapshot.forEach((childSnap) => {
      appendMessengerBubble(chatMessages, childSnap.val());
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// SỰ KIỆN GỬI TIN NHẮN CHUẨN REALTIME
document.getElementById("chatForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const chatInput = document.getElementById("chatInput");
  const text = chatInput.value.trim();
  if (!text || !currentUsername) return;

  chatInput.value = ""; // Clear ô nhập ngay lập tức

  let userAvatar = `https://ui-avatars.com/api/?name=${currentUsername}`;
  let userDisplayName = currentUsername;

  try {
    const userSnap = await get(ref(rtdb, `users_profile/${currentUsername}`));
    if (userSnap.exists()) {
      const uData = userSnap.val();
      if (uData.avatar) userAvatar = uData.avatar;
      if (uData.displayName) userDisplayName = uData.displayName;
    }
  } catch (err) {}

  // Gửi tin nhắn lên Firebase ngầm, Firebase tự kích hoạt onValue bắn lại UI rất nhanh
  try {
    await push(ref(rtdb, "chat_messages"), {
      username: currentUsername,
      displayName: userDisplayName,
      avatar: userAvatar,
      text: text,
      isAdmin: false,
      timestamp: rtdbTimestamp()
    });
  } catch (err) {
    console.error("Lỗi gửi tin nhắn:", err);
  }
});

function appendMessengerBubble(container, msg) {
  const item = document.createElement("div");
  const isMe = msg.username === currentUsername;
  item.className = `chat-bubble-row ${isMe ? "msg-right" : "msg-left"}`;
  
  const currentDisplayName = msg.displayName || msg.username;

  item.innerHTML = `
    <div class="chat-user-header" style="display:flex; align-items:center; gap:6px; cursor:pointer;">
      <img src="${escapeHtml(msg.avatar)}" class="chat-avatar-thumb" style="width:24px; height:24px; border-radius:50%; object-fit:cover;" />
      <span class="chat-sender-name">${escapeHtml(currentDisplayName)} ${msg.isAdmin ? '<span class="admin-badge">[ ADMIN ]</span>' : ''}</span>
    </div>
    <div class="chat-bubble">${escapeHtml(msg.text)}</div>
  `;

  item.querySelector(".chat-user-header")?.addEventListener("click", () => openUserProfile(msg.username));
  container.appendChild(item);
}

// ==========================================
// USER PROFILE MODAL
// ==========================================
async function openUserProfile(targetUsername) {
  const userProfileModal = document.getElementById("userProfileModal");
  if (!targetUsername || !userProfileModal) return;
  try {
    const targetSnap = await get(ref(rtdb, `users_profile/${targetUsername}`));
    if (targetSnap.exists()) {
      const data = targetSnap.val();
      document.getElementById("profileAvatar").src = data.avatar || `https://ui-avatars.com/api/?name=${data.displayName}`;
      document.getElementById("profileDisplayName").textContent = data.displayName || data.username;
      document.getElementById("profileUsername").textContent = `@${data.username}`;
      document.getElementById("profileBio").textContent = data.bio || "Người dùng này chưa viết lời giới thiệu nào.";
    } else {
      document.getElementById("profileDisplayName").textContent = targetUsername;
      document.getElementById("profileUsername").textContent = `@${targetUsername}`;
      document.getElementById("profileBio").textContent = "Không tìm thấy hồ sơ.";
    }
    userProfileModal.classList.add("active");
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("closeProfileBtn")?.addEventListener("click", () => {
  document.getElementById("userProfileModal")?.classList.remove("active");
});

function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

checkUserOnLoad();

// ==========================================
// SETTINGS MODAL: CHANGE NAME / USERNAME (SỬ DỤNG REMOVE ĐỂ CHỐNG TRÙNG HỒ SƠ)
// ==========================================
document.getElementById("settingsBtn")?.addEventListener("click", async () => {
  if (!currentUsername) return;
  const settingsModal = document.getElementById("settingsModal");
  
  const snap = await get(ref(rtdb, `users_profile/${currentUsername}`));
  if (snap.exists()) {
    const data = snap.val();
    document.getElementById("settingDisplayName").value = data.displayName || "";
    document.getElementById("settingUsername").value = data.username || "";
    document.getElementById("settingsError").textContent = "";
    document.getElementById("settingsSuccess").textContent = "";
    settingsModal?.classList.add("active");
  }
});

document.getElementById("closeSettingsBtn")?.addEventListener("click", () => {
  document.getElementById("settingsModal")?.classList.remove("active");
});

document.getElementById("settingsForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("settingsError");
  const succEl = document.getElementById("settingsSuccess");
  errEl.textContent = ""; succEl.textContent = "";
  
  const newDisplayName = document.getElementById("settingDisplayName").value.trim();
  const newUsername = document.getElementById("settingUsername").value.trim().toLowerCase();
  
  if (!newUsername || !newDisplayName) {
    errEl.textContent = "Không được để trống thông tin!"; return;
  }
  if (!/^[a-z0-9]+$/.test(newUsername)) {
    errEl.textContent = "Username chỉ chứa chữ cái thường và số!"; return;
  }
  if (newUsername.includes("admin") || newUsername.includes("btc")) {
    errEl.textContent = "Username chứa từ khóa bị cấm!"; return;
  }

  try {
    const oldUsername = currentUsername;
    const oldRef = ref(rtdb, `users_profile/${oldUsername}`);
    const snap = await get(oldRef);
    if (!snap.exists()) return;
    
    const userData = snap.val();
    const now = Date.now();
    const ONE_DAY_MS = 86400000;
    const TWO_DAYS_MS = 172800000;
    
    let newData = { ...userData };

    // 1. Đổi Display Name
    if (newDisplayName !== userData.displayName) {
      const lastDispTime = userData.lastDisplayNameChange || 0;
      if (now - lastDispTime < ONE_DAY_MS) {
        const timeLeft = Math.ceil((ONE_DAY_MS - (now - lastDispTime)) / 3600000);
        errEl.textContent = `Vui lòng đợi ${timeLeft} giờ nữa để đổi Tên hiển thị.`; return;
      }
      newData.displayName = newDisplayName;
      newData.lastDisplayNameChange = now;
    }

    // 2. Đổi Username
    if (newUsername !== oldUsername) {
      const lastUserTime = userData.lastUsernameChange || 0;
      if (now - lastUserTime < TWO_DAYS_MS) {
        const timeLeft = Math.ceil((TWO_DAYS_MS - (now - lastUserTime)) / 3600000);
        errEl.textContent = `Vui lòng đợi ${timeLeft} giờ nữa để đổi Username.`; return;
      }
      
      const newRefSnap = await get(ref(rtdb, `users_profile/${newUsername}`));
      if (newRefSnap.exists()) {
        errEl.textContent = "Username này đã có người sử dụng!"; return;
      }
      
      newData.username = newUsername;
      newData.lastUsernameChange = now;

      // Xóa hồ sơ cũ trên Firebase trước rồi mới tạo hồ sơ mới
      await remove(oldRef);
      await set(ref(rtdb, `users_profile/${newUsername}`), newData);
      
      currentUsername = newUsername;
      localStorage.setItem("chat_username", newUsername);
    } else {
      await set(oldRef, newData);
    }

    succEl.textContent = "Cập nhật thành công!";
    updateChatHeaderInfo();
    
    setTimeout(() => document.getElementById("settingsModal")?.classList.remove("active"), 1000);

  } catch (err) {
    console.error(err);
    errEl.textContent = "Lỗi kết nối máy chủ. Vui lòng thử lại sau.";
  }
});
