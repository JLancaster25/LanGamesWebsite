// ==================================================
// SUPABASE POINTER
// ==================================================
const sb = window.supabaseClient;
const message = document.getElementById("message");

// ELEMENTS
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const strengthBar = document.getElementById("strengthBar");

const menu = document.getElementById("menu");
const menuBtn = document.getElementById("menuBtn");

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
// TAB SWITCHING
// ==================================================
loginTab.onclick = () => {
  loginTab.classList.add("active");
  registerTab.classList.remove("active");
  loginForm.classList.add("active");
  registerForm.classList.remove("active");
  message.textContent = "";
};

registerTab.onclick = () => {
  registerTab.classList.add("active");
  loginTab.classList.remove("active");
  registerForm.classList.add("active");
  loginForm.classList.remove("active");
  message.textContent = "";
};

// ==================================================
// PASSWORD STRENGTH METER
// ==================================================
registerPassword.addEventListener("input", () => {
  const value = registerPassword.value;
  let strength = 0;

  if (value.length >= 8) strength++;
  if (/[A-Z]/.test(value)) strength++;
  if (/[0-9]/.test(value)) strength++;
  if (/[^A-Za-z0-9]/.test(value)) strength++;

  const percent = (strength / 4) * 100;
  strengthBar.style.width = percent + "%";

  strengthBar.style.background =
    percent < 50 ? "#dc2626" :
    percent < 75 ? "#f59e0b" :
    "#16a34a";
});

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
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) return showError("All fields required.");
  if (!isValidEmail(email)) return showError("Invalid email address.");

  showSuccess("Logging in…");

  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return showError(error.message);

  if (window.history.length > 1) {
    // If there is history to go back to, use history.back()
    window.history.back();
  } else {
    // Otherwise, redirect to a default page (e.g., the home page or dashboard)
    window.location.href = '/'; // Replace with your default URL
  }
});

// ==================================================
// REGISTER
// ==================================================
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = registerUsername.value.trim();
  const email = registerEmail.value.trim();
  const password = registerPassword.value;
  const confirm = confirmPassword.value;

  if (!username || !email || !password || !confirm)
    return showError("All fields are required.");

  if (username.length < 8 || username.length > 15)
    return showError("Username must be 8 - 15 characters.");

  if (!isValidEmail(email))
    return showError("Invalid email address.");

  if (password.length < 8)
    return showError("Password must be at least 8 characters.");

  if (password !== confirm)
    return showError("Passwords do not match.");

  showSuccess("Creating account…");

  const { error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { username } }
  });

  if (error) return showError(error.message);

  showSuccess("Account created! Check your email.");
});





