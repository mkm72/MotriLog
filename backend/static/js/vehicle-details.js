console.log("VEHICLE-DETAILS.JS LOADED!");


let currentVehicle = null;
let currentVehicleId = null;
let serviceHistory = [];

// --- Config: Intervals per service (km) ---
const SERVICE_INTERVALS = {
  oil_change: { km: 5000, label: "Oil Change" },
  tire_rotation: { km: 10000, label: "Tire Rotation" },
  brake_service: { km: 30000, label: "Brake Service" },
  air_filter: { km: 20000, label: "Air Filter" },
  battery: { km: 60000, label: "Battery" },
  timing_belt: { km: 100000, label: "Timing Belt" }
};

// --- Helpers ---
function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString();
}

function mapServiceType(type) {
  const map = {
    oil_change: "Oil Change",
    tire_rotation: "Tire Rotation",
    brake_service: "Brake Service",
    air_filter: "Air Filter",
    battery: "Battery",
    timing_belt: "Timing Belt",
    other: "Other"
  };
  return map[type] || type || "-";
}

function computeMaintenanceRecommendations(mileage) {
  let alerts = [];

  if (mileage >= 5000 && mileage % 5000 < 500) {
    alerts.push("⛽ Oil change recommended (every 5,000 km)");
  }
  if (mileage >= 10000 && mileage % 10000 < 500) {
    alerts.push("🔧 Tire rotation recommended (every 10,000 km)");
  }
  if (mileage >= 20000 && mileage % 20000 < 500) {
    alerts.push("🛞 Brake / Air filter check (every 20,000 km)");
  }
  if (mileage >= 100000 && mileage % 100000 < 1000) {
    alerts.push("⛓ Timing belt service recommended (~100,000 km)");
  }

  return alerts;
}

// تقدير متوسط الممشى اليومي بين آخر خدمة والممشى الحالي
function estimateDailyMileage(lastService) {
  if (!currentVehicle || !lastService) return null;
  const currentMileage = currentVehicle.current_mileage || 0;
  const lastMileage = lastService.mileage_at_service || 0;

  const deltaKm = currentMileage - lastMileage;
  if (deltaKm <= 0) return null;

  const lastDate = new Date(lastService.service_date);
  const today = new Date();
  const deltaDays = (today - lastDate) / (1000 * 60 * 60 * 24);

  if (deltaDays <= 0.5) return null; // أقل من يوم، نعتبرها غير منطقية

  return deltaKm / deltaDays; // كم في اليوم
}

function estimateNextDateFromDailyMileage(nextDueMileage, dailyMileage) {
  if (!currentVehicle || !dailyMileage || dailyMileage <= 0) return null;

  const currentMileage = currentVehicle.current_mileage || 0;
  const remainingKm = nextDueMileage - currentMileage;
  if (remainingKm <= 0) return null;

  const days = remainingKm / dailyMileage;
  const today = new Date();
  const nextDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
  return nextDate;
}

// --- Fetch Vehicle + Fill Header ---
async function fetch_vehicle_details() {
  const params = new URLSearchParams(window.location.search);
  const vehicleId = params.get("id");
  currentVehicleId = vehicleId;

  if (!vehicleId) {
    console.error("No vehicle id in URL");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch vehicle details");
    }

    const data = await response.json();
    currentVehicle = data;

    document.getElementById("vehicle-title").textContent =
      `${data.manufacturer} ${data.model}`;
    document.getElementById("vehicle-plate").textContent =
      data.license_plate || "-";
    document.getElementById("vehicle-color").textContent = data.color || "-";
    document.getElementById("vehicle-year").textContent = data.year || "-";
    document.getElementById("vehicle-mileage").textContent =
      data.current_mileage || 0;

    const imgEl = document.getElementById("vehicle-img");
    if (imgEl) {
      if (data.image) {
        // مثال: image = "static/uploads/xxxx.jpg"
        imgEl.src = `/${data.image}`;
      } else {
        imgEl.src = "../static/img/car-interior.jpg";
      }
    }

    // توصيات عامة في البوكس
    const mileage = data.current_mileage || 0;
    const alerts = computeMaintenanceRecommendations(mileage);
    const box = document.getElementById("maintenance-warning");
    if (alerts.length === 0) {
      box.innerHTML = "<p>✅ No urgent maintenance needed right now.</p>";
    } else {
      box.innerHTML = alerts.map(a => `<p>${a}</p>`).join("");
    }

    // بعد ما نجيب بيانات السيارة نجيب الهستوري
    await fetch_service_history(vehicleId);
  } catch (err) {
    console.error(err);
  }
}

// --- Fetch Service History + render summary & history ---
async function fetch_service_history(vehicleId) {
  const container = document.getElementById("service-history");
  if (!container) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/vehicles/${vehicleId}/services`,
      {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" }
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch service history");
    }

    serviceHistory = await response.json();

    // ---- History list ----
    if (!serviceHistory || !serviceHistory.length) {
      container.innerHTML = "<p class='empty-history'>No service records yet.</p>";
    } else {
      container.innerHTML = "";
      serviceHistory.forEach(rec => {
        const item = document.createElement("div");
        item.className = "service-item";
        item.innerHTML = `
          <div class="service-date">${formatDate(rec.service_date)}</div>
          <div class="service-desc">
            <strong>${mapServiceType(rec.service_type)}</strong>
            <br>
            Cost: ${rec.cost != null ? rec.cost + " SAR" : "-"}
            <br>
            Notes: ${rec.notes || "-"}
          </div>
        `;
        container.appendChild(item);
      });
    }

    // ---- Maintenance overview table ----
    renderMaintenanceSummary();

  } catch (err) {
    console.error(err);
    container.innerHTML =
      "<p class='error-text'>Failed to load service history.</p>";
  }
}

// --- Build Maintenance Overview Table ---
function renderMaintenanceSummary() {
  const tbody = document.querySelector("#maintenance-summary tbody");
  if (!tbody || !currentVehicle) return;

  const currentMileage = currentVehicle.current_mileage || 0;
  tbody.innerHTML = "";

  Object.entries(SERVICE_INTERVALS).forEach(([key, cfg]) => {
    // آخر صيانة من هذا النوع
    const records = serviceHistory
      .filter(r => r.service_type === key)
      .sort(
        (a, b) =>
          new Date(b.service_date).getTime() - new Date(a.service_date).getTime()
      );

    const last = records[0] || null;

    const lastDate = last ? formatDate(last.service_date) : "-";
    const lastMileage = last ? last.mileage_at_service || 0 : 0;

    // متى اللي بعده؟
    let nextDueMileage;
    if (last) {
      nextDueMileage = (last.mileage_at_service || 0) + cfg.km;
    } else {
      // لو ما قد سواها، نفترض أول موعد لها عند أول interval من ممشى السيارة
      nextDueMileage = currentMileage + cfg.km;
    }

    // تقدير التاريخ القادم
    let estDateStr = "-";
    const dailyMileage = estimateDailyMileage(last);
    const estDate = estimateNextDateFromDailyMileage(nextDueMileage, dailyMileage);
    if (estDate) {
      estDateStr = estDate.toLocaleDateString();
    }

    // الحالة بناءً على الممشى
    let status = "OK";
    let statusClass = "status-ok";

    if (currentMileage >= nextDueMileage) {
      status = "Overdue";
      statusClass = "status-overdue";
    } else if (currentMileage >= nextDueMileage - cfg.km * 0.2) {
      // 20% قبل الموعد
      status = "Due Soon";
      statusClass = "status-soon";
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cfg.label}</td>
      <td>${lastDate}</td>
      <td>${last ? lastMileage + " km" : "-"}</td>
      <td>${nextDueMileage} km</td>
      <td>${estDateStr}</td>
      <td><span class="status-pill ${statusClass}">${status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Add Service Record ---
async function handle_add_service_record(event) {
  event.preventDefault();

  const dateInput = document.getElementById("service-date");
  const typeSelect = document.getElementById("service-type");
  const costInput = document.getElementById("service-cost");
  const notesInput = document.getElementById("service-notes");
  const errorEl = document.getElementById("service-error");

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  const costValue = costInput.value ? parseFloat(costInput.value) : null;
  const mileageAtService = currentVehicle ? currentVehicle.current_mileage || 0 : 0;

  const payload = {
    service_type: typeSelect.value,
    service_date: dateInput.value, // backend marshmallow يقبل ISO yyyy-mm-dd
    mileage_at_service: mileageAtService,
    cost: costValue,
    service_provider: "",
    service_location: "",
    notes: notesInput.value || ""
  };

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/vehicles/${currentVehicleId}/services`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error(data);
      throw new Error("Failed to add service record");
    }

    // reset form
    dateInput.value = "";
    typeSelect.value = "";
    costInput.value = "";
    notesInput.value = "";

    // reload history + overview
    await fetch_service_history(currentVehicleId);
  } catch (err) {
    console.error(err);
    if (errorEl) {
      errorEl.textContent = "Failed to add service record.";
      errorEl.hidden = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetch_vehicle_details();

  const form = document.getElementById("service-form");
  if (form) {
    form.addEventListener("submit", handle_add_service_record);
  }
});
