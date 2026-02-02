// js/navbar.js
if (!sb) {
  console.error("❌ Supabase client not found. Load supabaseClient.js first.");
} 

// ================================
// DOM HELPERS
// ================================
const $ = (id) => document.getElementById(id);

// ================================
// ELEMENTS (SAFE)
// ================================
const menu = $("menu");
const menuBtn = $("menuBtn");
const loginLink = $("loginLink");
const userPanel = $("userPanel");
const userEmail = $("userEmail");
const logoutBtn = $("logoutBtn");

// ================================
// MENU LOGIC (GUARDED)
// ================================
if (menu && menuBtn) {
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
      menu.classList.add("hidden");
    }
  });
}

// ================================
// AUTH UI HELPERS
// ================================
function showLoggedIn(user) {
  if (loginLink) loginLink.classList.add("hidden");

  if (userPanel) userPanel.classList.remove("hidden");
  if (logoutBtn) logoutBtn.classList.remove("hidden");
  if (userEmail) userEmail.textContent = user.email;
}

function showLoggedOut() {
  if (loginLink) loginLink.classList.remove("hidden");

  if (userPanel) userPanel.classList.add("hidden");
  if (logoutBtn) logoutBtn.classList.add("hidden");
  if (userEmail) userEmail.textContent = "";
}

// ================================
// LOGOUT
// ================================
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    const { error } = await sb.auth.signOut();
    if (error) {
      console.error("Logout failed:", error.message);
      return;
    }
    window.location.href = "/WebsiteLogin/";
  });
}

// ================================
// AUTH STATE (SOURCE OF TRUTH)
// ================================
sb.auth.onAuthStateChange((_event, session) => {
  session ? showLoggedIn(session.user) : showLoggedOut();
});

// ================================
// INITIAL SESSION LOAD
// ================================
(async () => {
  const { data } = await sb.auth.getSession();
  data?.session ? showLoggedIn(data.session.user) : showLoggedOut();
})();
