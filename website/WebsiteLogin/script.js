// ==================================================
// SUPABASE POINTER (SHARED CLIENT)
// ==================================================
const sb = window.supabaseClient;

if (!sb) {
  console.error("Supabase client not available");
}

// ==================================================
// UI ELEMENTS
// ==================================================
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

// ==================================================
// TAB SWITCHING
// ==================================================
loginTab.addEventListener("click", () => {
  loginTab.classList.add("active");
  registerTab.classList.remove("active");
  loginForm.classList.add("active");
  registerForm.classList.remove("active");
  message.textContent = "";
});

registerTab.addEventListener("click", () => {
  registerTab.classList.add("active");
  loginTab.classList.remove("active");
  registerForm.classList.add("active");
  loginForm.classList.remove("active");
  message.textContent = "";
});

// ==================================================
// PASSWORD VISIBILITY TOGGLE
// ==================================================
document.querySelectorAll(".toggle-password").forEach(toggle => {
  toggle.addEventListener("click", () => {
    const input = toggle.previousElementSibling;
    input.type = input.type === "password" ? "text" : "password";
  });
});

// ==================================================
// LOGIN
// ==================================================
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "⏳ Logging in...";

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message.textContent = "❗ " + error.message;
    return;
  }

  message.textContent = "✔️ Login successful!";
  setTimeout(() => {
    window.location.href = "/";
  }, 800);
});

// ==================================================
// REGISTER
// ==================================================
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "⏳ Creating account...";

  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;

  if (password.length < 6) {
    message.textContent = "❗ Password must be at least 6 characters.";
    return;
  }

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });

  if (error) {
    message.textContent = "❗ " + error.message;
    return;
  }

  message.textContent = "✔️ Account created! Check your email.";
});

// ==================================================
// AUTO-REDIRECT IF ALREADY LOGGED IN
// ==================================================
sb.auth.getSession().then(({ data }) => {
  if (data.session) {
    window.location.href = "/";
  }
});
