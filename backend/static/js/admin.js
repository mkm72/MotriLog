console.log("ADMIN.JS LOADED!");

function setupAddMakerForm() {
    const makerForm = document.getElementById('addMakerForm');
    if (!makerForm) return;
    makerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = makerForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.disabled = true;
        submitBtn.innerText = "Adding...";
        const payload = {
            name: document.getElementById('maker_name').value,
            logo_url: document.getElementById('maker_logo').value
        };
        try {
            const res = await fetch('/api/manufacturers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (res.ok) {
                alert(` Successfully added ${data.name}!`);
                makerForm.reset();
            } else if (res.status === 409) {
                alert(` Manufacturer "${payload.name}" already exists.`);
            } else {
                alert(` Error: ${data.error || 'Failed to add'}`);
            }
        } catch (err) { alert("❌ Network Error"); } 
        finally { submitBtn.disabled = false; submitBtn.innerText = originalText; }
    });
}

function setupAddWorkshopForm() {
}

// ---: Fetch and Render Users ---
async function fetchAndRenderUsers() {
    const tbody = document.getElementById('users-table-body');
    if(!tbody) return;

    try {
        const res = await fetch('/api/admin/users');
        if(!res.ok) throw new Error("Failed to fetch");
        const users = await res.json();
        
        tbody.innerHTML = "";
        
        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center;">No users found.</td></tr>`;
            return;
        }

        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #f0f0f0";
            
            const vehStr = u.vehicles.length > 0 
                ? u.vehicles.map(v => `${v.manufacturer} ${v.model}`).join(", ") 
                : '<span style="color:#aaa;">No vehicles</span>';

            // Telegram status
            const tgStatus = u.telegram_chat_id 
                ? `<span style="color:#0088cc; font-weight:bold;"> Linked</span>` 
                : `<span style="color:#ccc;">No</span>`;
            
            // Active status
            const isActive = u.is_active !== false; // Default true if field missing
            const statusLabel = isActive 
                ? "<span style='color:green; font-weight:bold;'>Active</span>" 
                : "<span style='color:red; font-weight:bold;'>Suspended</span>";
            
            // Button Styles
            const btnColor = isActive ? "#ff4757" : "#28a745"; // Red for Ban, Green for Unban
            const btnText = isActive ? "Ban" : "Unban";

            tr.innerHTML = `
                <td style="padding: 12px;"><strong>${u.full_name}</strong></td>
                <td style="padding: 12px; color:#555;">${u.email}</td>
                <td style="padding: 12px; font-size:13px;">${vehStr}</td>
                <td style="padding: 12px; font-size:13px;">${tgStatus}</td>
                <td style="padding: 12px; font-size:13px;" id="status-${u._id}">${statusLabel}</td>
                <td style="padding: 12px;">
                    <button onclick="toggleBan('${u._id}')" 
                        style="background:${btnColor}; color:white; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:bold;"
                        id="btn-${u._id}">
                        ${btnText}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch(e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:red;">Error loading users.</td></tr>`;
    }
}

// --- 4. NEW: Ban/Unban Logic ---
window.toggleBan = async (userId) => {
    if(!confirm("Are you sure you want to change this user's status?")) return;
    
    const btn = document.getElementById(`btn-${userId}`);
    const originalText = btn.innerText;
    btn.innerText = "...";
    btn.disabled = true;
    
    try {
        const res = await fetch(`/api/admin/users/${userId}/ban`, { method: "POST" });
        const data = await res.json();
        
        if(res.ok) {
            const isActive = data.is_active;
            const statusCell = document.getElementById(`status-${userId}`);
            
            statusCell.innerHTML = isActive 
                ? "<span style='color:green; font-weight:bold;'>Active</span>" 
                : "<span style='color:red; font-weight:bold;'>Suspended</span>";
            
            btn.innerHTML = isActive ? "Ban" : "Unban";
            btn.style.background = isActive ? "#ff4757" : "#28a745";
            
            if (!isActive) alert("User has been suspended. A notification was sent if they have Telegram.");
            else alert("User has been reactivated.");
            
        } else {
            alert("Error: " + (data.error || "Failed"));
            btn.innerText = originalText;
        }
    } catch(e) {
        alert("Network Error");
        btn.innerText = originalText;
    } finally {
        btn.disabled = false;
    }
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    setupAddMakerForm();
    setupAddWorkshopForm();
    fetchAndRenderUsers(); // <-- Load the list
});
