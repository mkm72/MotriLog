console.log("VEHICLE-DETAILS.JS LOADED!");

const API_BASE_URL = "http://127.0.0.1:5000";

async function fetch_vehicle_details() {
  const params = new URLSearchParams(window.location.search);
  const vehicleId = params.get("id");
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

    document.getElementById("vehicle-title").textContent =
      `${data.manufacturer} ${data.model}`;
    document.getElementById("vehicle-plate").textContent = data.license_plate || "";
    const imgEl = document.getElementById("vehicle-img");
    if (imgEl) {
      imgEl.src = "../static/img/car-interior.jpg";
    }

    await fetch_service_history(vehicleId);

  } catch (err) {
    console.error(err);
  }
}

async function fetch_service_history(vehicleId) {
  const container = document.getElementById("service-history");
  if (!container) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/services`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      throw new Error("Failed to fetch service history");
    }

    const history = await response.json();

    if (!history || !history.length) {
      container.innerHTML = "<p class='empty-history'>No service records yet.</p>";
      return;
    }

    container.innerHTML = "";
    history.forEach(rec => {
      const item = document.createElement("div");
      item.className = "service-item";
      item.innerHTML = `
        <div class="service-date">${rec.service_date}</div>
        <div class="service-desc">
          ${rec.service_type || ""} @ ${rec.mileage_at_service || 0} km
          <br>
          Provider: ${rec.service_provider || "-"}
          <br>
          Notes: ${rec.notes || "-"}
        </div>
      `;
      container.appendChild(item);
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p class='error-text'>Failed to load service history.</p>";
  }
}

async function handle_add_service_record(event) {
  event.preventDefault();

  const params = new URLSearchParams(window.location.search);
  const vehicleId = params.get("id");
  const dateInput = document.getElementById("service-date");
  const descInput = document.getElementById("service-desc");
  const errorEl = document.getElementById("service-error");

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  const payload = {
    service_type: "other",
    service_date: dateInput.value,
    mileage_at_service: 0,
    cost: 0,
    service_provider: "",
    notes: descInput.value
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/services`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Failed to add service record");
    }

    dateInput.value = "";
    descInput.value = "";
    await fetch_service_history(vehicleId);

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
