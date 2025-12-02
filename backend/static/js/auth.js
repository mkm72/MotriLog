console.log("AUTH.JS LOADED!");

// Using session cookies with Flask API
const API_BASE_URL = "http://127.0.0.1:5000";

// LOGIN
async function handle_login_submit(event) {
  event.preventDefault();

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const errorEl = document.getElementById("login-error");

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  const payload = {
    email: emailInput.value.trim(),
    password: passwordInput.value
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // important for session cookie
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data.message || data.detail || "Login failed.";
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
      }
      return;
    }

    // Session cookie is now set by backend
    window.location.href = "dashboard.html";
  } catch (err) {
    console.error("Login error:", err);
    if (errorEl) {
      errorEl.textContent = "Network error. Please try again.";
      errorEl.hidden = false;
    }
  }
}

// REGISTER
async function handle_register_submit(event) {
  event.preventDefault();

  const fullNameInput = document.getElementById("full-name");
  const emailInput = document.getElementById("reg-email");
  const phoneInput = document.getElementById("reg-phone");
  const passwordInput = document.getElementById("reg-password");
  const confirmPasswordInput = document.getElementById("reg-password-confirm");
  const termsCheckbox = document.getElementById("terms");
  const errorEl = document.getElementById("register-error");

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  if (passwordInput.value !== confirmPasswordInput.value) {
    errorEl.textContent = "Passwords do not match.";
    errorEl.hidden = false;
    return;
  }

  if (!termsCheckbox.checked) {
    errorEl.textContent = "You must agree to the terms.";
    errorEl.hidden = false;
    return;
  }

  const payload = {
    email: emailInput.value.trim(),
    password_hash: passwordInput.value, // backend expects password_hash
    full_name: fullNameInput.value.trim(),
    phone_number: phoneInput.value.trim()
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data.message || data.detail || "Registration failed.";
      errorEl.textContent = msg;
      errorEl.hidden = false;
      return;
    }

    // after register, redirect to login
    window.location.href = "login.html";
  } catch (err) {
    console.error("Register error:", err);
    errorEl.textContent = "Network error. Please try again.";
    errorEl.hidden = false;
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE_URL}/api/logout`, {
      method: "POST",
      credentials: "include"
    });
  } catch (e) {
    console.warn("Logout request failed (ignored)", e);
  }
  window.location.href = "login.html";
}

// Wire up events on pages that include this file
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handle_login_submit);
  }

  const registerForm = document.getElementById("register-form");
  if (registerForm) {
    registerForm.addEventListener("submit", handle_register_submit);
  }

  const logoutButtons = document.querySelectorAll("#logout-btn");
  logoutButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  });
});
