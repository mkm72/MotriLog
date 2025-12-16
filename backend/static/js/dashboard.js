console.log("DASHBOARD.JS LOADED!");

// Define URL locally or rely on window.location.origin
const DASH_API_URL = window.location.origin;

// --- 1. Vehicle Logic ---
async function fetch_and_display_vehicles() {
  const container = document.getElementById("vehicles-list");
  if (!container) return;
  container.innerHTML = "<p>Loading vehicles...</p>";

  try {
    const response = await fetch(`${DASH_API_URL}/api/vehicles`, { headers: { "Content-Type": "application/json" } });
    if (!response.ok) { container.innerHTML = "<p class='no-vehicles'>No vehicles found.</p>"; return; }
    
    const vehicles = await response.json();
    container.innerHTML = "";
    if (!vehicles || vehicles.length === 0) {
      container.innerHTML = "<p class='no-vehicles'>No vehicles found. Add one!</p>"; return;
    }

    vehicles.forEach(v => {
      const card = document.createElement("div");
      card.className = "vehicle-card";
      const img = v.image_filename ? `/static/uploads/${v.image_filename}` : "/static/img/car-interior.jpg";
      card.innerHTML = `
        <img src="${img}" class="vehicle-img" style="width:100%; height:150px; object-fit:cover; border-radius:12px;">
        <div class="vehicle-info" style="padding:10px;">
          <h3>${v.manufacturer} ${v.model}</h3>
          <p>Plate: ${v.license_plate || ""}</p>
          <p>Mileage: ${v.current_mileage || 0} km</p>
        </div>
        <button class="view-btn" data-id="${v._id}" style="width:100%; padding:8px; margin-top:5px; cursor:pointer;">View Details</button>
      `;
      container.appendChild(card);
    });

    document.querySelectorAll(".view-btn").forEach(btn => {
      btn.onclick = () => window.location.href = `/vehicle-details?id=${btn.getAttribute("data-id")}`;
    });
  } catch (err) { container.innerHTML = "<p>Error loading vehicles.</p>"; }
}

// --- 2. Telegram Logic ---
async function setupTelegramFeatures() {
    const tgBtn = document.getElementById("connect-tg-btn");
    if (!tgBtn) return; // Exit if button not found

    const connectModal = document.getElementById("tg-modal");
    const unlinkModal = document.getElementById("unlink-modal");
    const closeConnect = document.querySelector(".close-modal");
    const cmdText = document.getElementById("tg-command");
    const copyBtn = document.getElementById("btn-copy-cmd");
    const openAppBtn = document.getElementById("btn-open-tg");
    const btnCancelUnlink = document.getElementById("btn-cancel-unlink");
    const btnConfirmUnlink = document.getElementById("btn-confirm-unlink");

    let isLinked = false;
    try {
        const res = await fetch(`${DASH_API_URL}/api/profile`, { credentials: "include" });
        if (res.ok) {
            const user = await res.json();
            isLinked = user.is_telegram_linked;
            updateButtonState(isLinked);
        }
    } catch(e) { console.error("Profile check failed"); }

    function updateButtonState(linked) {
        if (linked) {
            tgBtn.innerHTML = "✅ Telegram Linked";
            tgBtn.style.color = "#28a745";
            tgBtn.style.borderColor = "#28a745";
        } else {
            tgBtn.innerHTML = "✈️ Connect Telegram";
            tgBtn.style.color = "#0088cc";
            tgBtn.style.borderColor = "#0088cc";
        }
        isLinked = linked;
    }

    tgBtn.onclick = async () => {
        if (isLinked) {
            unlinkModal.style.display = "block";
        } else {
            try {
                const res = await fetch(`${DASH_API_URL}/api/telegram/link`, {
                    method: "POST", headers: {"Content-Type": "application/json"}, credentials: "include"
                });
                const data = await res.json();
                
                if (res.ok) {
                    cmdText.textContent = `/start ${data.token}`;
                    if(openAppBtn) openAppBtn.onclick = () => window.open(data.link, '_blank');
                    connectModal.style.display = "block";
                } else {
                    alert("Error: " + data.error);
                }
            } catch(e) { alert("Network error"); }
        }
    };

    if(closeConnect) closeConnect.onclick = () => connectModal.style.display = "none";
    window.onclick = (e) => {
        if (e.target == connectModal) connectModal.style.display = "none";
        if (e.target == unlinkModal) unlinkModal.style.display = "none";
    };

    if(copyBtn) {
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(cmdText.textContent);
            copyBtn.innerText = "✅ Copied!";
            setTimeout(() => copyBtn.innerText = "📋 Copy Command", 2000);
        };
    }

    if(btnCancelUnlink) btnCancelUnlink.onclick = () => unlinkModal.style.display = "none";
    
    if(btnConfirmUnlink) {
        btnConfirmUnlink.onclick = async () => {
            btnConfirmUnlink.innerText = "...";
            try {
                const res = await fetch(`${DASH_API_URL}/api/telegram/unlink`, { method: "POST", credentials: "include" });
                if(res.ok) {
                    updateButtonState(false);
                    unlinkModal.style.display = "none";
                    alert("Telegram disconnected.");
                } else { alert("Failed to unlink."); }
            } catch(e) { alert("Network Error"); }
            btnConfirmUnlink.innerText = "Yes, Disconnect";
        };
    }
}

document.addEventListener("DOMContentLoaded", () => {
  fetch_and_display_vehicles();
  setupTelegramFeatures();
  // Logout is now handled by auth.js automatically
});
