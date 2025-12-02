console.log("ADD-VEHICLE.JS LOADED!");

const API_BASE_URL = "http://127.0.0.1:5000";

async function handle_add_vehicle_submit(event) {
  event.preventDefault();

  const makeInput = document.getElementById("vehicle-make");
  const modelInput = document.getElementById("vehicle-model");
  const yearInput = document.getElementById("vehicle-year");
  const plateInput = document.getElementById("vehicle-plate");
  const vinInput = document.getElementById("vehicle-vin");
  const errorEl = document.getElementById("vehicle-error");

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = "";
  }

  const payload = {
    manufacturer: makeInput.value.trim(),
    model: modelInput.value.trim(),
    year: parseInt(yearInput.value, 10),
    license_plate: plateInput.value.trim(),
    initial_mileage: 0,
    current_mileage: 0,
    color: "",
    vin: vinInput.value.trim()
  };

  try {
    const response = await fetch(`${API_BASE_URL}/api/vehicles`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data.message || data.detail || "Failed to add vehicle.";
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
      }
      return;
    }

    window.location.href = "dashboard.html";

  } catch (err) {
    console.error(err);
    if (errorEl) {
      errorEl.textContent = "Network error. Please try again.";
      errorEl.hidden = false;
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("add-vehicle-form");
  if (form) {
    form.addEventListener("submit", handle_add_vehicle_submit);
  }
});
