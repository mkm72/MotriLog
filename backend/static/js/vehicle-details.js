console.log("VEHICLE DETAILS JS LOADED");

let currentVehicleData = {}; 
let serviceHistory = [];
let recordToDeleteId = null;

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const vehicleId = params.get("id");

    if (!vehicleId) {
        window.location.href = "/dashboard";
        return;
    }

    loadPageData(vehicleId);
    setupPhotoUpload(vehicleId);
    setupDeleteRecordModal(vehicleId);
    setupViewRecordModal();
});

async function loadPageData(id) {
    const API_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : "";

    try {
        const vRes = await fetch(`${API_URL}/api/vehicles/${id}`);
        if(!vRes.ok) throw new Error("Failed to load vehicle");
        currentVehicleData = await vRes.json();
        
        updateProfileUI(currentVehicleData);
        setupEditModal(id, currentVehicleData);
        setupDeleteModal(id, currentVehicleData);
        setupAddServiceModal(id, currentVehicleData);
        setupUpdateMileage(id, currentVehicleData);

        const [hData, pData] = await Promise.all([
            fetch(`${API_URL}/api/vehicles/${id}/services`).then(r => r.ok ? r.json() : []),
            fetch(`${API_URL}/api/vehicles/${id}/predictions`).then(r => r.ok ? r.json() : [])
        ]);

        serviceHistory = hData;
        const predictions = Array.isArray(pData) ? pData : (pData.predictions || []);

        renderList("predictions-list", predictions, true);
        renderList("history-list", serviceHistory, false);
        renderChart(serviceHistory, predictions, currentVehicleData.current_mileage);

    } catch (e) {
        console.error(e);
        document.getElementById("v-title").textContent = "Error loading data.";
    }
}

// ... (setupViewRecordModal, confirmPrediction unchanged) ...

function viewRecord(recordId) {
    const record = serviceHistory.find(r => r._id === recordId);
    if(!record) return;
    document.getElementById("view-type").textContent = record.service_type.replace(/_/g, ' ').toUpperCase();
    document.getElementById("view-date").textContent = new Date(record.service_date).toLocaleDateString();
    document.getElementById("view-mileage").textContent = `${record.mileage_at_service.toLocaleString()} km`;
    document.getElementById("view-cost").textContent = record.cost ? `${record.cost} SAR` : "0.00 SAR";
    document.getElementById("view-notes").textContent = record.notes || "No notes provided.";
    document.getElementById("view-record-modal").style.display = "flex";
}

function setupViewRecordModal() {
    const modal = document.getElementById("view-record-modal");
    const closeBtns = modal.querySelectorAll(".close-modal, .close-view-modal");
    closeBtns.forEach(b => b.onclick = () => modal.style.display = "none");
    window.onclick = (e) => { if(e.target === modal) modal.style.display = "none"; };
}

function confirmPrediction(type, mileage) {
    const modal = document.getElementById("add-record-modal");
    const form = document.getElementById("add-service-form");
    const typeSelect = document.getElementById("s-type");
    const mileInput = document.getElementById("s-mileage");
    const dateInput = document.getElementById("s-date");
    if(modal) {
        form.reset();
        typeSelect.value = type.toLowerCase();
        mileInput.value = mileage || currentVehicleData.current_mileage;
        const today = new Date().toISOString().split("T")[0];
        dateInput.value = today;
        dateInput.max = today;
        modal.style.display = "flex";
    }
}

// ---------------------------------------------------------
// 3. EDIT VEHICLE (MILEAGE REMOVED)
// ---------------------------------------------------------
function setupEditModal(id, vehicle) {
    const modal = document.getElementById("edit-vehicle-modal");
    const openBtn = document.getElementById("btn-edit-vehicle");
    const form = document.getElementById("edit-vehicle-form");
    const saveBtn = document.getElementById("btn-save-edit");
    const closeBtns = document.querySelectorAll(".close-modal");

    if(!modal || !openBtn) return;

    openBtn.onclick = () => {
        document.getElementById("edit-plate").value = vehicle.license_plate;
        // Mileage is handled separately now
        document.getElementById("edit-color").value = vehicle.color || "";
        document.getElementById("edit-year").value = vehicle.year;
        modal.style.display = "flex";
        saveBtn.disabled = false;
    };

    closeBtns.forEach(b => b.onclick = (e) => {
        document.getElementById(e.target.dataset.target).style.display = "none";
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        saveBtn.innerText = "Saving...";
        
        // Payload does NOT include mileage
        const payload = {
            license_plate: document.getElementById("edit-plate").value,
            color: document.getElementById("edit-color").value,
            year: parseInt(document.getElementById("edit-year").value)
        };

        const API_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : "";
        try {
            const res = await fetch(`${API_URL}/api/vehicles/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if(res.ok) {
                modal.style.display = "none";
                loadPageData(id); 
            } else {
                alert("Update failed.");
            }
        } catch(e) { console.error(e); }
        finally { saveBtn.innerText = "Save Changes"; }
    };
}

// ... (All other functions: setupUpdateMileage, setupAddServiceModal, etc. remain exactly the same as previous) ...

function setupUpdateMileage(id, vehicle) {
    const modal = document.getElementById("update-mileage-modal");
    const openBtn = document.getElementById("btn-quick-mileage");
    const form = document.getElementById("update-mileage-form");
    const input = document.getElementById("quick-mileage-input");
    const errorEl = document.getElementById("quick-mileage-error");
    const saveBtn = document.getElementById("btn-save-mileage");
    if(!openBtn || !modal) return;
    openBtn.onclick = () => {
        input.value = vehicle.current_mileage;
        errorEl.style.display = "none";
        saveBtn.disabled = true;
        modal.style.display = "flex";
        setTimeout(() => input.focus(), 100);
    };
    input.addEventListener("input", () => {
        const val = parseInt(input.value) || 0;
        if (val <= vehicle.current_mileage) {
            errorEl.textContent = `Must be > ${vehicle.current_mileage}`;
            errorEl.style.display = "block";
            saveBtn.disabled = true;
        } else {
            errorEl.style.display = "none";
            saveBtn.disabled = false;
        }
    });
    form.onsubmit = async (e) => {
        e.preventDefault();
        saveBtn.innerText = "Updating...";
        const API_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : "";
        try {
            const res = await fetch(`${API_URL}/api/vehicles/${id}/mileage`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({current_mileage: parseInt(input.value)})
            });
            if(res.ok) { modal.style.display = "none"; loadPageData(id); }
        } catch(e) {} finally { saveBtn.innerText = "Update"; }
    };
}

function setupAddServiceModal(id, vehicle) {
    const modal = document.getElementById("add-record-modal");
    const openBtn = document.getElementById("btn-add-record");
    const form = document.getElementById("add-service-form");
    const saveBtn = document.getElementById("btn-save-service");
    const mileInput = document.getElementById("s-mileage");
    const dateInput = document.getElementById("s-date");
    const logicError = document.getElementById("logic-error");
    if(!openBtn) return;
    openBtn.onclick = () => {
        form.reset();
        modal.style.display = "flex";
        const today = new Date().toISOString().split("T")[0];
        dateInput.value = today;
        dateInput.max = today;
        mileInput.value = vehicle.current_mileage;
        logicError.style.display = "none";
        saveBtn.disabled = false;
    };
    const validateTimeline = () => {
        const newDate = new Date(dateInput.value);
        const newKm = parseInt(mileInput.value) || 0;
        let isValid = true;
        const sorted = [...serviceHistory].sort((a,b) => new Date(a.service_date) - new Date(b.service_date));
        let prev = null, next = null;
        for (let r of sorted) {
            const rDate = new Date(r.service_date);
            if (rDate <= newDate) prev = r;
            else { next = r; break; }
        }
        if (prev && newKm < prev.mileage_at_service) {
            isValid = false;
            logicError.textContent = `Must be ≥ ${prev.mileage_at_service} km (${new Date(prev.service_date).toLocaleDateString()})`;
        } else if (next && newKm > next.mileage_at_service) {
            isValid = false;
            logicError.textContent = `Must be ≤ ${next.mileage_at_service} km (${new Date(next.service_date).toLocaleDateString()})`;
        }
        if (!isValid) { logicError.style.display = "block"; mileInput.classList.add("invalid"); saveBtn.disabled = true; } 
        else { logicError.style.display = "none"; mileInput.classList.remove("invalid"); saveBtn.disabled = false; }
    };
    dateInput.addEventListener("change", validateTimeline);
    mileInput.addEventListener("input", validateTimeline);
    form.onsubmit = async (e) => {
        e.preventDefault();
        saveBtn.innerText = "Saving...";
        const payload = {
            service_type: document.getElementById("s-type").value,
            service_date: dateInput.value,
            mileage_at_service: parseInt(mileInput.value),
            cost: parseFloat(document.getElementById("s-cost").value) || 0,
            notes: document.getElementById("s-notes").value
        };
        const API_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : "";
        try {
            const res = await fetch(`${API_URL}/api/vehicles/${id}/services`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            if (res.ok) {
                if(payload.mileage_at_service > vehicle.current_mileage) {
                    await fetch(`${API_URL}/api/vehicles/${id}/mileage`, {
                        method: "PUT", headers: {"Content-Type":"application/json"},
                        body: JSON.stringify({current_mileage: payload.mileage_at_service})
                    });
                }
                modal.style.display = "none";
                loadPageData(id);
            }
        } catch(e) {} finally { saveBtn.innerText = "Save Record"; }
    };
}

function setupPhotoUpload(id) {
    const camBtn = document.getElementById("btn-change-photo");
    const fileInput = document.getElementById("upload-photo-input");
    const API_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : "";
    if (!camBtn || !fileInput) return;
    camBtn.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append("image", file);
        camBtn.textContent = "⏳";
        try {
            const res = await fetch(`${API_URL}/api/vehicles/${id}`, { method: "PUT", body: formData });
            if (res.ok) document.getElementById("v-image").src = URL.createObjectURL(file);
        } catch (e) {} finally { camBtn.textContent = "📷"; }
    };
}

function setupDeleteRecordModal(vehicleId) {
    const modal = document.getElementById("delete-record-modal");
    const confirmBtn = document.getElementById("btn-confirm-record-delete");
    const cancelBtn = document.querySelector(".close-record-delete");
    if(!modal) return;
    const closeModal = () => { modal.style.display = "none"; recordToDeleteId = null; };
    cancelBtn.onclick = closeModal;
    window.onclick = (e) => { if(e.target === modal) closeModal(); };
    confirmBtn.onclick = async () => {
        if (!recordToDeleteId) return;
        const API_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : "";
        try {
            const res = await fetch(`${API_URL}/api/services/${recordToDeleteId}`, { method: "DELETE" });
            if (res.ok) { closeModal(); loadPageData(vehicleId); }
        } catch(e) {}
    };
}

function promptDeleteRecord(recordId) {
    recordToDeleteId = recordId;
    document.getElementById("delete-record-modal").style.display = "flex";
}

function setupDeleteModal(id, vehicle) {
    const modal = document.getElementById("delete-modal");
    const openBtn = document.getElementById("btn-delete-init");
    const confirmBtn = document.getElementById("btn-confirm-delete");
    const cancelBtn = document.querySelector(".close-delete");
    const vehName = document.getElementById("delete-veh-name");
    if(!openBtn || !modal) return;
    openBtn.onclick = () => { vehName.textContent = `${vehicle.manufacturer} ${vehicle.model}`; modal.style.display = "flex"; };
    const closeModal = () => modal.style.display = "none";
    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = async () => {
        const API_URL = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : "";
        try { const res = await fetch(`${API_URL}/api/vehicles/${id}`, { method: "DELETE" }); if (res.ok) window.location.href = "/dashboard"; } catch(e) {}
    };
}

function renderList(elementId, items, isPrediction) {
    const container = document.getElementById(elementId);
    container.innerHTML = "";
    if (!items || items.length === 0) { container.innerHTML = `<p class="empty-text">No records found.</p>`; return; }
    items.sort((a,b) => {
        const d1 = new Date(a.due_date || a.service_date || a.predicted_date);
        const d2 = new Date(b.due_date || b.service_date || b.predicted_date);
        return isPrediction ? d1 - d2 : d2 - d1; 
    });
    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "list-item";
        const type = (item.maintenance_type || item.service_type || "").replace(/_/g, ' ');
        const dateRaw = item.due_date || item.service_date || item.predicted_date;
        const dateStr = new Date(dateRaw).toLocaleDateString();
        let rightHtml = "";
        if(isPrediction) {
            const isDue = item.status === 'due_soon';
            const miles = item.predicted_mileage ? `${item.predicted_mileage.toLocaleString()} km` : "";
            rightHtml = `<div class="item-right"><button class="btn-xs-check" title="Mark Done" onclick="confirmPrediction('${item.maintenance_type}', ${item.predicted_mileage})">✔</button><span class="tag ${isDue ? 'due' : 'ok'}">${miles || 'Upcoming'}</span></div>`;
        } else {
            const miles = item.mileage_at_service ? `${item.mileage_at_service.toLocaleString()} km` : "";
            rightHtml = `<div class="item-right"><span class="tag ok" style="margin-right:8px">${miles}</span><button class="btn-xs-view" onclick="viewRecord('${item._id}')">👁️</button><button class="btn-xs-danger" onclick="promptDeleteRecord('${item._id}')">🗑️</button></div>`;
        }
        div.innerHTML = `<div class="item-info"><h4>${type}</h4><span>${dateStr}</span></div>${rightHtml}`;
        container.appendChild(div);
    });
}

function updateProfileUI(v) {
    document.getElementById("v-title").textContent = `${v.manufacturer} ${v.model} (${v.year})`;
    document.getElementById("v-plate").textContent = v.license_plate;
    document.getElementById("v-mileage").textContent = `${(v.current_mileage || 0).toLocaleString()} km`;
    document.getElementById("v-vin").textContent = v.vin || "-";
    document.getElementById("v-color").textContent = v.color || "-";
    const imgEl = document.getElementById("v-image");
    if (v.image_filename) imgEl.src = `/static/uploads/${v.image_filename}?t=${Date.now()}`;
    else imgEl.src = "/static/img/car-interior.jpg";
}

function renderChart(history, predictions, currentKm) {
    const ctx = document.getElementById('maintenanceChart');
    if(!ctx) return;
    if(window.myMaintenanceChart) window.myMaintenanceChart.destroy();
    const histData = history.map(h => ({ x: new Date(h.service_date).toISOString().split('T')[0], y: h.mileage_at_service })).sort((a,b) => new Date(a.x) - new Date(b.x));
    const today = new Date().toISOString().split('T')[0];
    histData.push({ x: today, y: currentKm });
    const predData = [{ x: today, y: currentKm }];
    predictions.forEach(p => {
        const d = p.due_date || p.predicted_date;
        const m = p.predicted_mileage || (currentKm + 5000);
        predData.push({ x: new Date(d).toISOString().split('T')[0], y: m });
    });
    predData.sort((a,b) => new Date(a.x) - new Date(b.x));
    const allLabels = [...new Set([...histData.map(d=>d.x), ...predData.map(d=>d.x)])].sort();
    window.myMaintenanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allLabels,
            datasets: [
                { label: 'History', data: histData, borderColor: '#007aff', backgroundColor: 'rgba(0,122,255,0.1)', borderWidth: 3, fill: true, tension: 0.3 },
                { label: 'Forecast', data: predData, borderColor: '#ff3b30', borderWidth: 2, borderDash: [5, 5], tension: 0.3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { beginAtZero: false } }, plugins: { legend: { position: 'top' } } }
    });
}
