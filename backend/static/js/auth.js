console.log("AUTH.JS LOADED!");

const API_BASE_URL = window.location.origin;

// ---------------------------------------------------------
// 1. SVG ICONS
// ---------------------------------------------------------
const EYE_OPEN = `
<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;fill:none;stroke:#00AEEF;transition:0.2s;">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
</svg>`;

const EYE_CLOSED = `
<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px;fill:none;stroke:#999;transition:0.2s;">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
</svg>`;

// ---------------------------------------------------------
// 2. UI HELPERS
// ---------------------------------------------------------
function setupPasswordToggles() {
    const eyes = document.querySelectorAll('.eye-icon');
    const passInputs = [
        document.getElementById('reg-password'),
        document.getElementById('reg-confirm')
    ];

    const updateState = (newType) => {
        passInputs.forEach(input => { if(input) input.type = newType; });
        eyes.forEach(icon => {
            icon.innerHTML = (newType === 'text') ? EYE_OPEN : EYE_CLOSED;
        });
    };

    eyes.forEach(eye => {
        eye.addEventListener('click', () => {
            const mainInput = passInputs[0] || document.getElementById(eye.getAttribute('data-target'));
            if(!mainInput) return;
            const newState = (mainInput.type === 'password') ? 'text' : 'password';
            updateState(newState);
        });
    });
}

function setupNameValidation() {
    const inputs = [
        { el: document.getElementById('reg-fname'), err: document.getElementById('err-fname') },
        { el: document.getElementById('reg-lname'), err: document.getElementById('err-lname') }
    ];

    inputs.forEach(item => {
        if (!item.el) return;
        item.el.addEventListener('input', (e) => {
            if (/\d/.test(e.target.value)) {
                item.err.textContent = "Numbers are not allowed.";
            } else {
                item.err.textContent = "";
            }
        });
    });
}

// ---------------------------------------------------------
// 3. LOGIN LOGIC
// ---------------------------------------------------------
async function handle_login_submit(event) {
  event.preventDefault();
  
  const btn = event.target.querySelector("button[type='submit']");
  const originalText = btn.innerText;
  btn.innerText = "Checking...";
  btn.disabled = true;

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");

  if(errorEl) errorEl.style.display = "none";

  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => ({}));

    // 2FA TRIGGER
    if (response.status === 202 && data.status === "2fa_required") {
        btn.innerText = originalText;
        btn.disabled = false;
        open2FAModal(); 
        return;
    }

    if (!response.ok) {
        if (errorEl) {
            errorEl.textContent = data.message || data.error || "Login failed";
            errorEl.style.display = "block";
        }
        btn.innerText = originalText;
        btn.disabled = false;
        return;
    }

    window.location.href = (data.user && data.user.role === 'admin') ? "/admin" : "/dashboard";

  } catch (err) {
    if(errorEl) { errorEl.textContent = "Network error"; errorEl.style.display="block"; }
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

// ---------------------------------------------------------
// 4. 2FA MODAL LOGIC
// ---------------------------------------------------------
function open2FAModal() {
    const modal = document.getElementById("two-factor-modal");
    const input = document.getElementById("2fa-code-input");
    const verifyBtn = document.getElementById("btn-2fa-ok");
    const cancelBtn = document.getElementById("btn-2fa-cancel");

    if(!modal) return;

    modal.style.display = "flex";
    input.value = "";
    input.focus();

    const submit = async () => {
        const code = input.value.trim();
        if(!code) return;

        verifyBtn.innerText = "...";
        verifyBtn.disabled = true;

        try {
            const res = await fetch(`${API_BASE_URL}/api/verify-2fa`, {
                method: "POST", headers: {"Content-Type":"application/json"}, credentials: "include",
                body: JSON.stringify({ code })
            });
            const d = await res.json();

            if (res.ok) {
                window.location.href = (d.user.role === 'admin') ? "/admin" : "/dashboard";
            } else {
                // Inline error handling could go here instead of alert if desired
                // For now, reset button if failed
                verifyBtn.innerText = "Verify";
                verifyBtn.disabled = false;
                input.value = "";
                input.focus();
            }
        } catch(e) {
            verifyBtn.innerText = "Verify";
            verifyBtn.disabled = false;
        }
    };

    const newVerify = verifyBtn.cloneNode(true);
    verifyBtn.parentNode.replaceChild(newVerify, verifyBtn);
    newVerify.onclick = submit;

    input.onkeydown = (e) => { if(e.key === "Enter") submit(); };
    cancelBtn.onclick = () => { modal.style.display = "none"; };
}

// ---------------------------------------------------------
// 5. REGISTER SUBMIT
// ---------------------------------------------------------
async function handle_register_submit(event) {
  event.preventDefault();

  const fname = document.getElementById("reg-fname").value.trim();
  const lname = document.getElementById("reg-lname").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const phone = document.getElementById("reg-phone").value.trim();
  const password = document.getElementById("reg-password").value;
  const confirmPass = document.getElementById("reg-confirm").value;
  const terms = document.getElementById("reg-terms").checked;
  const errorEl = document.getElementById("register-error");

  if (errorEl) { errorEl.style.display = "none"; errorEl.textContent = ""; }

  if (/\d/.test(fname) || /\d/.test(lname)) {
      if(errorEl) { errorEl.textContent = "Please remove numbers from your name."; errorEl.style.display="block"; }
      return;
  }

  if (!terms) {
      if(errorEl) { errorEl.textContent = "You must agree to the Terms."; errorEl.style.display="block"; }
      return;
  }

  if (password !== confirmPass) {
      if(errorEl) { errorEl.textContent = "Passwords do not match."; errorEl.style.display="block"; }
      return;
  }
  if (password.length < 8) {
      if(errorEl) { errorEl.textContent = "Password too short (min 8)."; errorEl.style.display="block"; }
      return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
          full_name: `${fname} ${lname}`,
          email, phone_number: phone, password
      }),
    });

    const data = await res.json();
    if (!res.ok) {
        if(errorEl) { errorEl.textContent = data.error || "Failed."; errorEl.style.display="block"; }
    } else {
        // SUCCESS: Redirect instantly (No alert/prompt)
        window.location.href = "/login";
    }
  } catch (err) {
    if(errorEl) { errorEl.textContent = "Network error."; errorEl.style.display="block"; }
  }
}

// ---------------------------------------------------------
// 6. GLOBAL LOGOUT
// ---------------------------------------------------------
async function logout() {
    try { await fetch(`${API_BASE_URL}/api/logout`, { method: "POST", credentials: "include" }); } 
    catch (e) { console.warn(e); }
    window.location.href = "/login";
}

// ---------------------------------------------------------
// INIT
// ---------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupPasswordToggles();
  setupNameValidation();

  const regForm = document.getElementById("register-form");
  if (regForm) regForm.addEventListener("submit", handle_register_submit);

  const loginForm = document.getElementById("login-form");
  if (loginForm && typeof handle_login_submit !== "undefined") {
      loginForm.addEventListener("submit", handle_login_submit);
  }

  const logoutBtns = document.querySelectorAll("#logout-btn");
  logoutBtns.forEach(btn => btn.onclick = (e) => { e.preventDefault(); logout(); });
});
