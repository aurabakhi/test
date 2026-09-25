// Giữ nguyên phần import app, db hiện tại của mày, và bổ sung thêm getDatabase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
// Thêm dòng này để gọi Realtime Database
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyB5CnWbc_PHYdIe7XqQqxDOXF6DuKyG6OM",
  authDomain: "aurabakhi-2b90d.firebaseapp.com",
  databaseURL: "https://aurabakhi-2b90d-default-rtdb.firebaseio.com",
  projectId: "aurabakhi-2b90d",
  storageBucket: "aurabakhi-2b90d.firebasestorage.app",
  messagingSenderId: "252158539927",
  appId: "1:252158539927:web:024f93aa1790b3ecb711d2",
  measurementId: "G-H6W81SNBSR"
};

// Khởi tạo Firebase App & Firestore (giữ nguyên của mày)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// >>> BỔ SUNG THÊM DÒNG NÀY ĐỂ TẠO rtdb <<<
const rtdb = getDatabase(app);

// Xuất cả db và rtdb ra để các file khác (như admin_3.js) dùng chung
export { app, db, rtdb };