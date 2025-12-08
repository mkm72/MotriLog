console.log("AUTH.JS LOADED!");

const API_BASE_URL = "";

// ------------------------------------------------------------
// LOGIN
// ------------------------------------------------------------
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
    password: passwordInput.value,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data.message || data.detail || "Login failed.";
      errorEl.textContent = msg;
      errorEl.hidden = false;
      return;
    }

    window.location.href = "/dashboard";
  } catch (err) {
    console.error("Login error:", err);
    if (errorEl) {
      errorEl.textContent = "Network error. Please try again.";
      errorEl.hidden = false;
    }
  }
}

// ------------------------------------------------------------
// REGISTER
// ------------------------------------------------------------
async function handle_register_submit(event) {
  event.preventDefault();

  const firstNameInput =
    document.getElementById("reg-first-name") ||
    document.getElementById("first-name");
  const lastNameInput =
    document.getElementById("reg-last-name") ||
    document.getElementById("last-name");
  const emailInput = document.getElementById("reg-email");
  const phoneInput = document.getElementById("reg-phone");
  const passwordInput = document.getElementById("reg-password");
  const confirmPasswordInput = document.getElementById(
    "reg-password-confirm"
  );
  const termsCheckbox = document.getElementById("terms");
  const errorEl = document.getElementById("register-error");

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  let hasError = false;

  const nameRegex = /[0-9]/;
  if (
    nameRegex.test(firstNameInput.value) ||
    nameRegex.test(lastNameInput.value)
  ) {
    if (errorEl) {
      errorEl.textContent = "First or Last Name cannot contain numbers.";
      errorEl.hidden = false;
    }
    hasError = true;
  }

  if (passwordInput.value.length < 8) {
    if (errorEl) {
      errorEl.textContent = "Password must be at least 8 characters long.";
      errorEl.hidden = false;
    }
    hasError = true;
  }

  if (hasError) return;

  if (passwordInput.value !== confirmPasswordInput.value) {
    if (errorEl) {
      errorEl.textContent = "Passwords do not match.";
      errorEl.hidden = false;
    }
    return;
  }

  if (!termsCheckbox.checked) {
    if (errorEl) {
      errorEl.textContent = "You must agree to the terms.";
      errorEl.hidden = false;
    }
    return;
  }

  const payload = {
    email: emailInput.value.trim(),
    password_hash: passwordInput.value,
    full_name: `${firstNameInput.value.trim()} ${lastNameInput.value.trim()}`,
    phone_number: phoneInput.value.trim() || null,
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      let msg = data.message || data.detail || "Registration failed.";

      if (typeof data === "object" && !data.message && !data.detail) {
        msg = JSON.stringify(data)
          .replace(/[{"}\[\]]/g, "")
          .replace(/:/g, ": ");
      }

      if (msg.includes("Email already exists")) {
        msg = "This email address is already registered. Please login.";
      }

      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
      }

      return;
    }

    window.location.href = "/login";
  } catch (err) {
    console.error("Register error:", err);
    if (errorEl) {
      errorEl.textContent = "Network error. Please try again.";
      errorEl.hidden = false;
    }
  }
}

// ------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------
async function logout() {
  try {
    await fetch(`${API_BASE_URL}/api/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (e) {
    console.warn("Logout request failed:", e);
  }

  window.location.href = "/login";
}

// ------------------------------------------------------------
// Check authentication for Main_Page navbar
// ------------------------------------------------------------
async function updateHomeNavbar() {
  const loginBtn = document.getElementById("home-login-btn");
  const registerBtn = document.getElementById("home-register-btn");

  if (!loginBtn) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/profile`, {
      credentials: "include",
    });

    if (res.ok) {
      loginBtn.textContent = "Dashboard";
      loginBtn.href = "/dashboard";
      if (registerBtn) registerBtn.style.display = "none";
    } else {
      loginBtn.textContent = "Login";
      loginBtn.href = "/login";
      if (registerBtn) registerBtn.style.display = "inline-block";
    }
  } catch (err) {
    console.warn("Auth check failed:", err);
  }
}

// ------------------------------------------------------------
// EVENT LISTENERS
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm)
    loginForm.addEventListener("submit", handle_login_submit);

  const registerForm = document.getElementById("register-form");
  if (registerForm)
    registerForm.addEventListener("submit", handle_register_submit);

  const logoutButtons = document.querySelectorAll("#logout-btn");
  logoutButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  });

  updateHomeNavbar();
});
