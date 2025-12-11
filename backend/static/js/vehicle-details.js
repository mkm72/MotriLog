console.log("VEHICLE-DETAILS.JS LOADED");

const urlParams = new URLSearchParams(window.location.search);
const vehicleId = urlParams.get("id");
if (!vehicleId) window.location.href = "/dashboard";

let currentVehicleMileage = 0;
let currentVehicleData = {}; // Store data for editing

// 1. Fetch Details
async function fetchVehicleDetails() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}`, { credentials: "include" });
    const vehicle = await res.json();
    
    // Save for Edit Modal
    currentVehicleData = vehicle;
    currentVehicleMileage = vehicle.current_mileage || 0;

    // Update UI
    document.getElementById("vehicle-title").textContent = `${vehicle.manufacturer} ${vehicle.model} (${vehicle.year})`;
    document.getElementById("vehicle-plate").textContent = vehicle.license_plate;
    document.getElementById("vehicle-details").innerHTML = `
        <p><strong>Color:</strong> ${vehicle.color || "-"}</p>
        <p><strong>VIN:</strong> ${vehicle.vin || "-"}</p>
        <p><strong>Mileage:</strong> ${currentVehicleMileage.toLocaleString()} km</p>
    `;

    const img = document.getElementById("vehicle-img");
    img.src = vehicle.image_filename ? `/static/uploads/${vehicle.image_filename}?t=${Date.now()}` : "/static/img/car-interior.jpg";

  } catch (err) { console.error(err); }
}

// ---------------------------------------------------------
// 2. EDIT VEHICLE LOGIC
// ---------------------------------------------------------
const modal = document.getElementById("edit-modal");
const editBtn = document.getElementById("edit-vehicle-btn");
const closeBtn = document.querySelector(".close-modal");
const editForm = document.getElementById("edit-form");

if (editBtn) {
    editBtn.addEventListener("click", () => {
        // Pre-fill form
        document.getElementById("edit-plate").value = currentVehicleData.license_plate || "";
        document.getElementById("edit-color").value = currentVehicleData.color || "";
        document.getElementById("edit-model").value = currentVehicleData.model || "";
        document.getElementById("edit-year").value = currentVehicleData.year || "";
        
        // Show Modal
        modal.style.display = "block";
    });
}

if (closeBtn) {
    closeBtn.addEventListener("click", () => {
        modal.style.display = "none";
    });
}

// Close if clicking outside box
window.onclick = (event) => {
    if (event.target == modal) {
        modal.style.display = "none";
    }
};

if (editForm) {
    editForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const payload = {
            license_plate: document.getElementById("edit-plate").value,
            color: document.getElementById("edit-color").value,
            model: document.getElementById("edit-model").value,
            year: parseInt(document.getElementById("edit-year").value)
        };

        const btn = editForm.querySelector("button");
        btn.innerText = "Saving...";
        btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("✅ Vehicle details updated!");
                modal.style.display = "none";
                fetchVehicleDetails(); // Refresh UI
            } else {
                const data = await res.json();
                alert("❌ Error: " + (data.error || "Update failed"));
            }
        } catch (err) {
            alert("❌ Network error");
        } finally {
            btn.innerText = "Save Changes";
            btn.disabled = false;
        }
    });
}

// ---------------------------------------------------------
// 3. DELETE LOGIC (With Confirmation)
// ---------------------------------------------------------
const deleteBtn = document.getElementById("delete-vehicle-btn");
if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
        // CONFIRMATION DIALOG
        const confirmed = confirm("⚠️ Are you sure you want to delete this vehicle?\n\nThis action cannot be undone.");
        
        if (!confirmed) return; // Stop if user clicked Cancel

        try {
            const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}`, { 
                method: "DELETE", 
                credentials: "include" 
            });
            
            if (res.ok) {
                alert("Vehicle deleted successfully.");
                window.location.href = "/dashboard";
            } else {
                alert("Failed to delete vehicle.");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting vehicle.");
        }
    });
}

// ---------------------------------------------------------
// 4. PHOTO & SERVICE LOGIC (Existing)
// ---------------------------------------------------------
const fileInput = document.getElementById("new-vehicle-photo");
if (fileInput) {
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("image", file);
        try {
            const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}`, {
                method: "PUT", credentials: "include", body: formData
            });
            if (res.ok) window.location.reload();
        } catch(e) { console.error(e); }
    });
}

document.getElementById("service-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const type = document.getElementById("service-type").value;
    const date = document.getElementById("service-date").value;
    const mileage = parseInt(document.getElementById("service-mileage").value);
    const notes = document.getElementById("service-notes").value;

    if (mileage <= currentVehicleMileage) return alert("Mileage must be higher than current.");

    try {
        await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/services`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ service_type: type, service_date: date, mileage_at_service: mileage, notes })
        });
        await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/mileage`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ current_mileage: mileage })
        });
        window.location.reload();
    } catch (err) { alert("Failed to add service"); }
});

document.getElementById("service-type").addEventListener("change", (e) => {
    document.getElementById("other-notes-group").style.display = e.target.value === "other" ? "block" : "none";
});

async function loadExtras() {
    const hRes = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/services`, {credentials: "include"});
    const hData = await hRes.json();
    document.getElementById("service-history").innerHTML = hData.length ? hData.map(s => `
        <div class="service-item"><b>${s.service_type}</b> - ${new Date(s.service_date).toLocaleDateString()} (${s.mileage_at_service} km)</div>
    `).join('') : "<p class='muted'>No history.</p>";

    const pRes = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/predictions`, {credentials: "include"});
    const pData = await pRes.json();
    document.getElementById("predictions-box").innerHTML = pData.length ? pData.map(p => `
        <div class="prediction-card">${p.maintenance_type} due ${new Date(p.predicted_date).toLocaleDateString()}</div>
    `).join('') : "<p class='muted'>No predictions.</p>";
}

document.addEventListener("DOMContentLoaded", () => {
    fetchVehicleDetails();
    loadExtras();
});
