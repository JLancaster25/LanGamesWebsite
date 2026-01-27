
// ================================
// SUPABASE CLIENT
// ================================
const sb = window.supabaseClient;

if (!sb) {
  console.error("❌ Supabase client not loaded. Check script order.");
}

// ================================
// NAV ELEMENTS
// ================================
const menu = document.getElementById("menu");
const menuBtn = document.getElementById("menuBtn");

const loginLink = document.getElementById("loginLink");
const userPanel = document.getElementById("userPanel");
const userEmail = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

// ================================
// MENU TOGGLE
// ================================
menuBtn.addEventListener("click", (e) => {
  e.stopPropagation(); // ⛔ prevent document click
  menu.classList.toggle("hidden");
});

/* Close menu when clicking outside */
document.addEventListener("click", (e) => {
  const clickedInsideMenu = menu.contains(e.target);
  const clickedMenuButton = menuBtn.contains(e.target);

  if (!clickedInsideMenu && !clickedMenuButton) {
    menu.classList.add("hidden");
  }
});

/* Menu item navigation */
document.querySelectorAll("[data-target]").forEach(el => {
  el.addEventListener("click", () => {
    const target = el.getAttribute("data-target");
    menu.classList.add("hidden");
    document.getElementById(target).scrollIntoView({ behavior: "smooth" });
  });
});


document.querySelectorAll("[data-target]").forEach(el => {
  el.addEventListener("click", () => {
    const target = el.getAttribute("data-target");
    menu.classList.add("hidden");
    document.getElementById(target).scrollIntoView({ behavior: "smooth" });
  });
});

/* AUTH */
// ================================
// AUTH UI ELEMENTS (MAIN SITE)
// ================================
const authLink = document.getElementById("authLink"); // menu button

function showLoggedIn(user) {
  if (loginLink) loginLink.classList.add("hidden");

  userEmail.textContent = user.email;
  userPanel.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
}

function showLoggedOut() {
  if (loginLink) loginLink.classList.remove("hidden");

  userPanel.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  userEmail.textContent = "";
}

// ================================
// SESSION CHECK ON LOAD
// ================================
async function loadSession() {
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    showLoggedIn(data.session.user);
  } else {
    showLoggedOut();
  }
}

function showLoggedIn(user) {
  if (authLink) authLink.textContent = "Account";
  if (userPanel) userPanel.classList.remove("hidden");
  if (userEmail) userEmail.textContent = user.email;
}

function showLoggedOut() {
  if (authLink) authLink.textContent = "Login";
  if (userPanel) userPanel.classList.add("hidden");
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

    // Redirect to login page
    window.location.href = "/";
  });
}

// ================================
// AUTH STATE LISTENER (REALTIME)
// ================================
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    showLoggedIn(session.user);
  } else {
    showLoggedOut();
  }
});

// INIT
loadSession();

// ================================
// INITIAL SESSION CHECK
// ================================
(async () => {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    showLoggedIn(data.session.user);
  } else {
    showLoggedOut();
  }
})();

/* SESSION */
function showUser(email) {
  authForms.classList.add("hidden");
  userPanel.classList.remove("hidden");
  userEmail.textContent = `Logged in as ${email}`;
}

supabase.auth.getSession().then(({ data }) => {
  if (data.session) showUser(data.session.user.email);
});

