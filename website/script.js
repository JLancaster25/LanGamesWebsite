import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/* ================================
   SUPABASE
================================ */
const supabase = createClient(
  window.SUPABASE_URL,
  window.SUPABASE_ANON_KEY
);

/* ================================
   DOM
================================ */
const menu = document.getElementById("menu");
const menuBtn = document.getElementById("menuBtn");
const themeToggle = document.getElementById("themeToggle");

const authForms = document.getElementById("authForms");
const userPanel = document.getElementById("userPanel");
const userEmail = document.getElementById("userEmail");
const userRole = document.getElementById("userRole");
const authStatus = document.getElementById("authStatus");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

/* ================================
   MENU
================================ */
menuBtn.addEventListener("click", () => {
  menu.classList.toggle("hidden");
});

document.addEventListener("click", e => {
  if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
    menu.classList.add("hidden");
  }
});

/* ================================
   DARK MODE
================================ */
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") document.body.classList.add("dark");

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
});

/* ================================
   AUTH FUNCTIONS
================================ */
async function register() {
  const { error } = await supabase.auth.signUp({
    email: emailInput.value.trim(),
    password: passwordInput.value.trim(),
    options: { emailRedirectTo: window.location.origin }
  });

  authStatus.textContent = error
    ? error.message
    : "✔ Check your email to verify your account";
}

async function login() {
  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value.trim()
  });

  authStatus.textContent = error ? error.message : "✔ Logged in";
}

async function logout() {
  await supabase.auth.signOut();
}

async function resetPassword() {
  const email = emailInput.value.trim();
  if (!email) return;

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });

  authStatus.textContent = "✔ Password reset email sent";
}

async function oauthLogin(provider) {
  await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin }
  });
}

/* ================================
   SESSION HANDLING (FIXED)
================================ */
supabase.auth.onAuthStateChange(async (_event, session) => {
  if (!session?.user) {
    authForms.classList.remove("hidden");
    userPanel.classList.add("hidden");
    document.body.classList.remove("admin");
    return;
  }

  authForms.classList.add("hidden");
  userPanel.classList.remove("hidden");

  userEmail.textContent = session.user.email;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  userRole.textContent = `Role: ${data?.role ?? "user"}`;

  if (data?.role === "admin") {
    document.body.classList.add("admin");
  }
});

/* ================================
   EXPOSE FUNCTIONS
================================ */
window.login = login;
window.register = register;
window.logout = logout;
window.resetPassword = resetPassword;
window.oauthLogin = oauthLogin;
