// ==================================================
// SUPABASE POINTER
// ==================================================
const sb = window.supabaseClient;
const message = document.getElementById("message");

// ==================================================
// HELPERS
// ==================================================
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showError(text) {
  message.textContent = text;
  message.style.color = "#dc2626";
}

function showSuccess(text) {
  message.textContent = text;
  message.style.color = "#16a34a";
}

// ==================================================
// REDIRECT IF ALREADY LOGGED IN
// ==================================================
sb.auth.getSession().then(({ data }) => {
  if (data.session) {
    window.location.href = "/";
  }
});

// ==================================================
// LOGIN
// ==================================================
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  // Validation
  if (!email || !password) {
    showError("Please enter email and password.");
    return;
  }

  if (!isValidEmail(email)) {
    showError("Please enter a valid email address.");
    return;
  }

  showSuccess("Logging in…");

  const { error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    showError(error.message);
    return;
  }

  window.location.href = "/";
});

// ==================================================
// REGISTER
// ==================================================
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = registerUsername.value.trim();
  const email = registerEmail.value.trim();
  const password = registerPassword.value;

  // Validation
  if (!username || !email || !password) {
    showError("All fields are required.");
    return;
  }

  if (username.length < 3) {
    showError("Username must be at least 3 characters.");
    return;
  }

  if (!isValidEmail(email)) {
    showError("Please enter a valid email address.");
    return;
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters.");
    return;
  }

  showSuccess("Creating account…");

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  });

  if (error) {
    showError(error.message);
    return;
  }

  showSuccess("Account created! Check your email to confirm.");
});
