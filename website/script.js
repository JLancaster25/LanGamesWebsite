import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* ================================
   SUPABASE CONFIG
================================ */
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ================================
   DOM ELEMENTS
================================ */
const menu = document.getElementById("menu");
const menuBtn = document.getElementById("menuBtn");
const themeToggle = document.getElementById("themeToggle");

const authForms = document.getElementById("authForms");
const authStatus = document.getElementById("authStatus");
const userPanel = document.getElementById("userPanel");
const userEmail = document.getElementById("userEmail");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

/* ADMIN PANEL (OPTIONAL SECTION) */
const adminPanel = document.getElementById("adminPanel");

/* ================================
   MENU LOGIC
================================ */
menuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  menu.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
    menu.classList.add("hidden");
  }
});

document.querySelectorAll("[data-target]").forEach(el => {
  el.addEventListener("click", () => {
    const target = el.dataset.target;
    menu.classList.add("hidden");
    document.getElementById(target).scrollIntoView({ behavior: "smooth" });
  });
});

/* ================================
   DARK MODE
================================ */
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  themeToggle.textContent = "☀️ Light Mode";
}

themeToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  themeToggle.textContent = isDark ? "☀️ Light Mode" : "🌙 Dark Mode";
});

/* ================================
   AUTH FUNCTIONS
================================ */
async function register() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    authStatus.textContent = "❗ Missing email or password";
    return;
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    authStatus.textContent = error.message;
    return;
  }

  authStatus.textContent = "✔️ Registration successful. Check email.";
}

async function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    authStatus.textContent = error.message;
    return;
  }

  await handleUserSession(data.user);
}

async function logout() {
  await supabase.auth.signOut();
  resetUI();
}

/* ================================
   SESSION HANDLING
================================ */
async function handleUserSession(user) {
  authForms.classList.add("hidden");
  userPanel.classList.remove("hidden");
  userEmail.textContent = `Logged in as ${user.email}`;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    enableAdminPanel();
  }
}

function resetUI() {
  authForms.classList.remove("hidden");
  userPanel?.classList.add("hidden");
  adminPanel?.classList.add("hidden");
  authStatus.textContent = "";
}

/* ================================
   ADMIN PANEL
================================ */
function enableAdminPanel() {
  if (!adminPanel) return;

  adminPanel.classList.remove("hidden");
  adminPanel.innerHTML = `
    <h2>Admin Panel</h2>
    <p>Welcome, administrator.</p>
    <button id="refreshUsers" class="btn secondary">Refresh Users</button>
    <ul id="userList"></ul>
  `;

  document
    .getElementById("refreshUsers")
    .addEventListener("click", loadUsers);
}

async function loadUsers() {
  const list = document.getElementById("userList");
  list.innerHTML = "Loading...";

  const { data, error } = await supabase
    .from("profiles")
    .select("email, role");

  if (error) {
    list.innerHTML = "Error loading users";
    return;
  }

  list.innerHTML = data
    .map(u => `<li>${u.email} — ${u.role}</li>`)
    .join("");
}

/* ================================
   INIT SESSION ON LOAD
================================ */
supabase.auth.getSession().then(({ data }) => {
  if (data.session?.user) {
    handleUserSession(data.session.user);
  }
});

/* ================================
   EXPOSE AUTH BUTTONS
================================ */
window.login = login;
window.register = register;
window.logout = logout;
