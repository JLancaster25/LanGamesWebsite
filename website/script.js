import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 🔑 REPLACE THESE
const SUPABASE_URL = window.https://kppgmvfdfuhmtuaukkdn.supabase.co;
const SUPABASE_ANON_KEY = window.sb_publishable_e4AhlY9ZIgdlsG8rl111Fg_tWghrBW4;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ELEMENTS */
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
const userPanel = document.getElementById("userPanel");
const userEmail = document.getElementById("userEmail");
const logoutBtn = document.getElementById("logoutBtn");

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
    await supabase.auth.signOut();
    showLoggedOut();
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
/* SESSION */
function showUser(email) {
  authForms.classList.add("hidden");
  userPanel.classList.remove("hidden");
  userEmail.textContent = `Logged in as ${email}`;
}

supabase.auth.getSession().then(({ data }) => {
  if (data.session) showUser(data.session.user.email);
});

const LanGamesAPI = {
  baseUrl: 'https://api.langames.online/v1',
  apiKey: 'YOUR_LANGAMES_API_KEY', // Replace with your key
  
  async publishGame() {
    try {
      const gameData = {
        name: "AI Voice Bingo",
        description: "Real-time multiplayer bingo game with AI voice announcements. Features multiple game modes including Normal (5 in a row), Four Corners, and Blackout. Includes user authentication, admin controls, and real-time synchronization across all players.",
        version: "1.0.0",
        category: "board-games",
        tags: ["bingo", "multiplayer", "voice", "realtime", "party-game"],
        minPlayers: 2,
        maxPlayers: 100,
        estimatedDuration: 15,
        difficulty: "easy",
        ageRating: "everyone",
        gameUrl: window.location.origin,
        features: [
          "Real-time multiplayer synchronization",
          "AI voice number calling with Web Speech API",
          "Three game modes: Normal, 4-Corners, Blackout",
          "Secure user authentication",
          "Admin control panel with auto-call feature",
          "Mobile responsive design",
          "Real-time winner detection",
          "Customizable game speed"
        ],
        technology: {
          framework: "react",
          backend: "supabase",
          realtime: true,
          authentication: true,
          voice: true
        },
        pricing: {
          model: "free",
          iapEnabled: false
        }
      };

      const response = await fetch(`${this.baseUrl}/games/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(gameData)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Game published successfully:', result);
      return result;
    } catch (error) {
      console.error('Error publishing game:', error);
      throw error;
    }
  },

  async updateGame(gameId, updates) {
    try {
      const response = await fetch(`${this.baseUrl}/games/${gameId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating game:', error);
      throw error;
    }
  },

  async getStats(gameId) {
    try {
      const response = await fetch(`${this.baseUrl}/games/${gameId}/stats`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw error;
    }
  },

  async reportGameStart() {
    // Track when a game session starts
    try {
      await fetch(`${this.baseUrl}/events/game-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          gameId: 'bingo-ai-voice-12345',
          timestamp: new Date().toISOString(),
          players: players.length,
          gameMode: gameType
        })
      });
    } catch (error) {
      console.error('Error reporting game start:', error);
    }
  },

  async reportGameEnd(winner) {
    // Track when a game session ends
    try {
      await fetch(`${this.baseUrl}/events/game-end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          gameId: 'bingo-ai-voice-12345',
          timestamp: new Date().toISOString(),
          duration: Math.floor((Date.now() - gameStartTime) / 1000),
          winner: winner,
          gameMode: gameType
        })
      });
    } catch (error) {
      console.error('Error reporting game end:', error);
    }
  }

};




