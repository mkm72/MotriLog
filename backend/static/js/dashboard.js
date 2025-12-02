console.log("DASHBOARD.JS LOADED!");

const API_BASE_URL = "http://127.0.0.1:5000";

async function fetch_and_display_vehicles() {
  const container = document.getElementById("vehicles-list");
  if (!container) return;

  container.innerHTML = "<p>Loading vehicles...</p>";

  try {
    const response = await fetch(`${API_BASE_URL}/api/vehicles`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      throw new Error("Failed to load vehicles");
    }

    const vehicles = await response.json();
    container.innerHTML = "";

    if (!vehicles || vehicles.length === 0) {
      container.innerHTML = "<p class='no-vehicles'>No vehicles found. Add one!</p>";
      return;
    }

    vehicles.forEach(v => {
      const card = document.createElement("div");
      card.className = "vehicle-card";
      card.innerHTML = `
        <img src="../static/img/car-interior.jpg" alt="Vehicle">
        <div class="vehicle-info">
          <h3>${v.manufacturer} ${v.model}</h3>
          <p>${v.license_plate || ""}</p>
        </div>
        <button class="view-btn" data-id="${v.id}">View Details</button>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll(".view-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        window.location.href = `vehicledetails?id=${id}`;
      });
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p class='error'>Failed to load vehicles.</p>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  fetch_and_display_vehicles();
});
