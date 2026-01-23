// ================================
// SUPABASE CONFIG
// ================================
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="/js/supabase.js"></script>

// ================================
// UI ELEMENTS
// ================================
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

// ================================
// TAB SWITCHING
// ================================
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

// ================================
// PASSWORD TOGGLE
// ================================
document.querySelectorAll(".toggle-password").forEach(toggle => {
  toggle.addEventListener("click", () => {
    const input = toggle.previousElementSibling;
    input.type = input.type === "password" ? "text" : "password";
  });
});

// ================================
// LOGIN
// ================================
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.textContent = "⏳ Logging in...";

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message.textContent = "❗ " + error.message;
    return;
  }

  message.textContent = "✔️ Login successful!";
  console.log("User:", data.user);

  // 🔁 Redirect after login
  // window.location.href = "/dashboard.html";
});

// ================================
// REGISTER
// ================================
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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username
      }
    }
  });

  if (error) {
    message.textContent = "❗ " + error.message;
    return;
  }

  message.textContent = "✔️ Account created! Check your email.";
  console.log("New user:", data.user);
});

// ================================
// SESSION CHECK (AUTO LOGIN)
// ================================
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    console.log("Session active:", session.user.email);
    // Optional auto-redirect
    // window.location.href = "/dashboard.html";
  }
});

