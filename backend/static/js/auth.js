console.log("AUTH.JS LOADED!");

// Define API_BASE_URL here (Single Source of Truth)
const API_BASE_URL = window.location.origin;

async function handle_login_submit(event) {
  event.preventDefault();
  
  const btn = event.target.querySelector("button[type='submit']");
  if (!btn) return; // Safety check

  const originalText = btn.innerText;
  btn.innerText = "Checking...";
  btn.disabled = true;

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");

  if(errorEl) errorEl.style.display = "none";

  try {
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json().catch(() => ({}));

    // 2FA Trigger
    if (response.status === 202 && data.status === "2fa_required") {
        btn.innerText = originalText;
        btn.disabled = false;
        open2FAModal(); // Show the white popup
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

    // Success
    window.location.href = (data.user && data.user.role === 'admin') ? "/admin" : "/dashboard";

  } catch (err) {
    console.error(err);
    if(errorEl) { errorEl.textContent = "Network error"; errorEl.style.display="block"; }
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

// 2FA Helper
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
        try {
            const res = await fetch(`${API_BASE_URL}/api/verify-2fa`, {
                method: "POST", headers: {"Content-Type":"application/json"}, credentials: "include",
                body: JSON.stringify({ code })
            });
            const d = await res.json();
            if (res.ok) window.location.href = (d.user.role==='admin')?"/admin":"/dashboard";
            else { alert(d.error || "Invalid"); verifyBtn.innerText="Verify"; }
        } catch(e) { alert("Error"); verifyBtn.innerText="Verify"; }
    };

    // Replace button to clear old listeners
    const newVerify = verifyBtn.cloneNode(true);
    verifyBtn.parentNode.replaceChild(newVerify, verifyBtn);
    newVerify.onclick = submit;

    // Enter key support
    input.onkeydown = (e) => { if(e.key === "Enter") submit(); };
    cancelBtn.onclick = () => { modal.style.display = "none"; };
}

// Global Logout Logic (Safe to be here)
async function logout() {
    try { await fetch(`${API_BASE_URL}/api/logout`, { method: "POST", credentials: "include" }); } 
    catch (e) { console.warn(e); }
    window.location.href = "/login";
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", handle_login_submit);

  // Attach logout to any button with id="logout-btn"
  const logoutBtns = document.querySelectorAll("#logout-btn");
  logoutBtns.forEach(btn => btn.onclick = (e) => { e.preventDefault(); logout(); });
});
