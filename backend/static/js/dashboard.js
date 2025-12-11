console.log("DASHBOARD.JS LOADED!");

// --- Vehicle Logic ---

async function fetch_and_display_vehicles() {
  const container = document.getElementById("vehicles-list");
  if (!container) return;

  container.innerHTML = "<p>Loading vehicles...</p>";

  try {
    const response = await fetch(`/api/vehicles`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      console.error("Failed to load vehicles");
      container.innerHTML = "<p class='no-vehicles'>No vehicles found.</p>";
      return;
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

      // Display logic: Use uploaded image or fallback
      const imageSrc = v.image_filename 
          ? `/static/uploads/${v.image_filename}` 
          : "/static/img/car-interior.jpg";

      card.innerHTML = `
        <img src="${imageSrc}" alt="Vehicle" class="vehicle-img" style="width:100%; height:150px; object-fit:cover; border-radius:12px;">
        <div class="vehicle-info" style="padding:10px;">
          <h3>${v.manufacturer} ${v.model}</h3>
          <p>Plate: ${v.license_plate || ""}</p>
          <p>Color: ${v.color || "-"}</p>
          <p>Mileage: ${v.current_mileage ?? v.initial_mileage ?? 0} km</p>
        </div>
        <button class="view-btn" data-id="${v._id}" style="width:100%; padding:8px; margin-top:5px; cursor:pointer;">View Details</button>
      `;

      container.appendChild(card);
    });

    // Attach Click Listeners
    document.querySelectorAll(".view-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        window.location.href = `/vehicle-details?id=${id}`;
      });
    });

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p class='error'>Failed to load vehicles.</p>";
  }
}

// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
  fetch_and_display_vehicles();
});
