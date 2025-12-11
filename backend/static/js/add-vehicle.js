console.log("ADD-VEHICLE.JS LOADED! (Color Name Version)");

// --- DOM ELEMENTS ---
const dropdownBtn = document.getElementById("dropdown-selected");
const dropdownList = document.getElementById("maker-list");
const hiddenMakerInput = document.getElementById("vehicle-make-hidden");
const manualMakerInput = document.getElementById("manual-maker-input");
const errorEl = document.getElementById("vehicle-error");

// Color Elements
const colorSwatches = document.querySelectorAll('.swatch');
const hiddenColorInput = document.getElementById('vehicle-color');
const customColorInput = document.getElementById('custom-color-input');
const colorNameDisplay = document.getElementById('color-name-display');

// 1. Fetch Makers on Load
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/manufacturers`);
        const makers = await res.json();
        populateDropdown(makers);
    } catch (err) {
        console.error("Failed to load makers:", err);
        if(manualMakerInput && dropdownBtn) {
            manualMakerInput.style.display = "block";
            dropdownBtn.style.display = "none";
        }
    }
});

// --- COLOR SWATCH LOGIC ---
colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
        // Remove 'selected' from all
        colorSwatches.forEach(s => s.classList.remove('selected'));
        
        // Add to clicked
        swatch.classList.add('selected');
        
        const colorName = swatch.getAttribute('data-color');
        
        if (colorName === 'Other') {
            // Show manual input
            hiddenColorInput.value = ""; 
            customColorInput.style.display = 'block';
            customColorInput.focus();
            colorNameDisplay.textContent = "Custom";
        } else {
            // Set standard color
            hiddenColorInput.value = colorName;
            customColorInput.style.display = 'none';
            colorNameDisplay.textContent = colorName;
        }
    });
});

// Handle custom color typing
customColorInput.addEventListener('input', (e) => {
    hiddenColorInput.value = e.target.value;
});


// --- DROPDOWN LOGIC (Keep existing) ---
function populateDropdown(makers) {
    if(!dropdownList) return;
    dropdownList.innerHTML = "";

    makers.forEach(maker => {
        const div = document.createElement("div");
        div.className = "dropdown-item";
        const logoSrc = maker.logo_url || "https://cdn.simpleicons.org/github"; 
        
        div.innerHTML = `
            <img src="${logoSrc}" class="maker-logo" alt="logo">
            <span>${maker.name}</span>
        `;
        div.onclick = () => selectMaker(maker.name, logoSrc);
        dropdownList.appendChild(div);
    });

    const otherDiv = document.createElement("div");
    otherDiv.className = "dropdown-item";
    otherDiv.innerHTML = `<span>➕ Other / Add New</span>`;
    otherDiv.style.color = "#00d2ff";
    otherDiv.onclick = () => enableManualEntry();
    dropdownList.appendChild(otherDiv);
}

if(dropdownBtn) {
    dropdownBtn.addEventListener("click", () => dropdownList.classList.toggle("show"));
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-dropdown") && dropdownList) dropdownList.classList.remove("show");
});

function selectMaker(name, logo) {
    dropdownBtn.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <img src="${logo}" class="maker-logo">
            <span>${name}</span>
        </div>
        <span>▼</span>
    `;
    hiddenMakerInput.value = name;
    manualMakerInput.style.display = "none";
    manualMakerInput.value = "";
    dropdownList.classList.remove("show");
}

function enableManualEntry() {
    dropdownBtn.innerHTML = `<span>Type below...</span> <span>▼</span>`;
    hiddenMakerInput.value = "OTHER";
    manualMakerInput.style.display = "block";
    manualMakerInput.focus();
    dropdownList.classList.remove("show");
}

// --- SUBMIT LOGIC ---
async function handle_add_vehicle_submit(event) {
  event.preventDefault();
  errorEl.hidden = true;
  errorEl.textContent = "";

  // 1. Manufacturer
  let finalMaker = hiddenMakerInput.value;
  if (finalMaker === "OTHER" || !finalMaker) {
      finalMaker = manualMakerInput.value.trim();
  }
  if (!finalMaker) {
      showError("Please select a Manufacturer.");
      return;
  }

  // 2. Color
  const finalColor = hiddenColorInput.value.trim();
  if (!finalColor) {
      showError("Please select a Color.");
      return;
  }

  // 3. Other Fields
  const model = document.getElementById("vehicle-model").value.trim();
  const year = parseInt(document.getElementById("vehicle-year").value.trim());
  const plate = document.getElementById("vehicle-plate").value.trim();
  const mileage = document.getElementById("vehicle-mileage").value.trim();
  const vin = document.getElementById("vehicle-vin").value.trim();
  const purchase_date = document.getElementById("purchase-date").value;

  const payload = {
    manufacturer: finalMaker,
    model: model,
    year: year,
    license_plate: plate,
    initial_mileage: parseInt(mileage),
    current_mileage: parseInt(mileage),
    color: finalColor, // SAVES "Red", "Silver", etc.
    vin: vin || null,
    purchase_date: purchase_date || null
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
        if (response.status === 409) {
            showError("⚠️ This License Plate is already registered!");
        } else {
            showError(data.message || data.error || "Failed to add vehicle.");
        }
        return;
    }

    window.location.href = "/dashboard";

  } catch (err) {
    console.error(err);
    showError("Network error. Please try again.");
  }
}

function showError(msg) {
    if(errorEl) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
        errorEl.style.display = 'block';
    } else {
        alert(msg);
    }
}

document.getElementById("add-vehicle-form").addEventListener("submit", handle_add_vehicle_submit);
