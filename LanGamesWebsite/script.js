import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🔑 REPLACE THESE
const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ELEMENTS */
const menu = document.getElementById("menu");
const menuBtn = document.getElementById("menuBtn");

const authStatus = document.getElementById("authStatus");
const authForms = document.getElementById("authForms");
const userPanel = document.getElementById("userPanel");
const userEmail = document.getElementById("userEmail");

/* MENU LOGIC */
/* MENU LOGIC */
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
document.getElementById("registerBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signUp({ email, password });
  authStatus.textContent = error ? error.message : "✔️ Registered!";
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    authStatus.textContent = error.message;
  } else {
    showUser(data.user.email);
  }
});
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  authForms.classList.remove("hidden");
  userPanel.classList.add("hidden");
});

/* SESSION */
function showUser(email) {
  authForms.classList.add("hidden");
  userPanel.classList.remove("hidden");
  userEmail.textContent = `Logged in as ${email}`;
}

supabase.auth.getSession().then(({ data }) => {
  if (data.session) showUser(data.session.user.email);
});
