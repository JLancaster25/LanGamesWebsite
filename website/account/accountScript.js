// ===============================
// SUPABASE CONFIG
// ===============================
const sb = window.supabaseClient;

// ===============================
// ELEMENTS
// ===============================
const emailEl = document.getElementById('email');
const displayUsernameEl = document.getElementById('displayUsername');
const avatarEl = document.getElementById('currentAvatar');
const avatarOptions = document.querySelectorAll('.avatar-option');
const daubColorSelect = document.getElementById('daubColor');

document.getElementById('saveColor').onclick = saveDaubColor;
document.getElementById('resetPassword').onclick = resetPassword;
document.getElementById('logout').onclick = logout;

// ===============================
// LOAD PROFILE
// ===============================
async function loadProfile() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return location.href = '/WebsiteLogin/index.html';

  emailEl.textContent = user.email;

  const { data, error } = await supabase
    .from('profiles')
    .select('display_username')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  displayUsernameEl.textContent = data.display_username;

  const meta = user.user_metadata || {};
  if (meta.avatar) avatarEl.src = meta.avatar;
  if (meta.daub_color) daubColorSelect.value = meta.daub_color;
}

loadProfile();

// ===============================
// AVATAR SELECT
// ===============================
avatarOptions.forEach(img => {
  img.addEventListener('click', async () => {
    const src = img.getAttribute('src');

    await sb.auth.updateUser({
      data: { avatar: src }
    });

    avatarEl.src = src;

    avatarOptions.forEach(a => a.classList.remove('selected'));
    img.classList.add('selected');
  });
});

// ===============================
// SAVE DAUB COLOR
// ===============================
async function saveDaubColor() {
  await sb.auth.updateUser({
    data: { daub_color: daubColorSelect.value }
  });
document.getElementById("daubColorPicker").addEventListener("input", e => {
  saveDaubColor(e.target.value);
});

  alert('Daub color saved');
}

// ===============================
// PASSWORD RESET
// ===============================
async function resetPassword() {
  const { data: { user } } = await sb.auth.getUser();
  await sb.auth.resetPasswordForEmail(user.email);
  alert('Password reset email sent');
}

// ===============================
// LOGOUT
// ===============================
async function logout() {
  await sb.auth.signOut();
  location.href = '/';
}


