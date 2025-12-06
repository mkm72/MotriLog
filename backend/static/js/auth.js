console.log("AUTH.JS LOADED!");

// Using session cookies with Flask API
const API_BASE_URL = "http://127.0.0.1:5000";
function setupPasswordToggle(inputId, toggleId) {
    const passwordInput = document.getElementById(inputId);
    const toggleIcon = document.getElementById(toggleId);

    if (passwordInput && toggleIcon) {
        toggleIcon.addEventListener("click", function () {
            const type =
                passwordInput.getAttribute("type") === "password"
                    ? "text"
                    : "password";
            passwordInput.setAttribute("type", type);
            this.textContent = type === "password" ? "👁️" : "🔒";
        });
    }
}

function checkNameForNumbers(inputId, errorId) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    const nameRegex = /^\D*$/;

    if (input && error) {
        input.addEventListener("input", function () {
            if (!nameRegex.test(this.value)) {
                error.textContent = "Name cannot contain numbers.";
                error.removeAttribute("hidden");
            } else {
                error.setAttribute("hidden", "");
                error.textContent = "";
            }
        });
    }
}
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
    password: passwordInput.value
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data.message || data.detail || "Login failed.";
      errorEl.textContent = msg;
      errorEl.hidden = false;
      return;
    }

    // Session cookie is now set
    window.location.href = "/dashboard";

  } catch (err) {
    console.error("Login error:", err);
    errorEl.textContent = "Network error. Please try again.";
    errorEl.hidden = false;
  }
}

// ------------------------------------------------------------
// REGISTER
// ------------------------------------------------------------
async function handle_register_submit(event) {
  event.preventDefault();

  const firstNameInput = document.getElementById("reg-first-name") || document.getElementById("first-name");
  const lastNameInput = document.getElementById("reg-last-name") || document.getElementById("last-name");
  const emailInput = document.getElementById("reg-email");
  const phoneInput = document.getElementById("reg-phone");
  const passwordInput = document.getElementById("reg-password");
  const confirmPasswordInput = document.getElementById("reg-password-confirm");
  const termsCheckbox = document.getElementById("terms");
  const errorEl = document.getElementById("register-error");

  // Reset errors
  errorEl.hidden = true;
  errorEl.textContent = "";

  let hasError = false;

  // Validations
  const nameRegex = /[0-9]/;
  if (nameRegex.test(firstNameInput.value) || nameRegex.test(lastNameInput.value)) {
    errorEl.textContent = "First or Last Name cannot contain numbers.";
    errorEl.hidden = false;
    hasError = true;
  }

  if (passwordInput.value.length < 8) {
    errorEl.textContent = "Password must be at least 8 characters long.";
    errorEl.hidden = false;
    hasError = true;
  }
    
  if (hasError) {
      return;
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
    // FIX: Changed 'password' to 'password_hash' to match Backend Schema
    password_hash: passwordInput.value, 
    full_name: `${firstNameInput.value.trim()} ${lastNameInput.value.trim()}`,
    phone_number: phoneInput.value.trim() || null
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
        let msg = data.message || data.detail || "Registration failed.";
        
        // Handle specific dictionary errors from Marshmallow
        if (typeof data === 'object' && !data.message && !data.detail) {
             msg = JSON.stringify(data).replace(/[{"}\[\]]/g, '').replace(/:/g, ': ');
        }

        if (msg.includes("Email already exists")) {
            msg = "This email address is already registered. Please login.";
        } else if (msg.includes("passwords do not match")) {
            msg = "The passwords you entered do not match.";
        }

        errorEl.textContent = msg;
        errorEl.hidden = false;
        return;
    }

    // Redirect to login on success
    window.location.href = "/login";

  } catch (err) {
    console.error("Register error:", err);
    errorEl.textContent = "Network error. Please try again.";
    errorEl.hidden = false;
  }
}

// ------------------------------------------------------------
// LOGOUT
// ------------------------------------------------------------
async function logout() {
  try {
    await fetch(`${API_BASE_URL}/api/logout`, {
      method: "POST",
      credentials: "include"
    });
  } catch (e) {
    console.warn("Logout request failed (ignored)", e);
  }

  window.location.href = "/login";
}

// ------------------------------------------------------------
// EVENT LISTENERS
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", handle_login_submit);

  const registerForm = document.getElementById("register-form");
  if (registerForm) registerForm.addEventListener("submit", handle_register_submit);

  const logoutButtons = document.querySelectorAll("#logout-btn");
  logoutButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  });
});
