console.log("ADD-VEHICLE.JS LOADED! (Live Check Version)");

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

// Year Elements
const yearInput = document.getElementById("vehicle-year");
const yearError = document.getElementById("year-error");

// Default Icon
const DEFAULT_ICON = "https://cdn-icons-png.flaticon.com/512/744/744465.png";

// 1. Fetch Makers on Load
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const API_BASE_URL = window.location.origin;
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

// -----------------------------------------------------------
// 2. LIVE YEAR CHECK (NEW)
// -----------------------------------------------------------
if (yearInput && yearError) {
    yearInput.addEventListener('input', () => {
        const val = parseInt(yearInput.value);
        // Show error if value exists and is less than 1900
        if (val && val < 1900) {
            yearError.style.display = 'block';
        } else {
            yearError.style.display = 'none';
        }
    });
}

// -----------------------------------------------------------
// 3. COLOR SWATCH LOGIC
// -----------------------------------------------------------
colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
        colorSwatches.forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        
        const colorName = swatch.getAttribute('data-color');
        
        if (colorName === 'Other') {
            hiddenColorInput.value = ""; 
            customColorInput.style.display = 'block';
            customColorInput.focus();
            colorNameDisplay.textContent = "Custom";
        } else {
            hiddenColorInput.value = colorName;
            customColorInput.style.display = 'none';
            colorNameDisplay.textContent = colorName;
        }
    });
});

if(customColorInput) {
    customColorInput.addEventListener('input', (e) => {
        hiddenColorInput.value = e.target.value;
    });
}

// -----------------------------------------------------------
// 4. DROPDOWN LOGIC
// -----------------------------------------------------------
function populateDropdown(makers) {
    if(!dropdownList) return;
    dropdownList.innerHTML = "";

    makers.forEach(maker => {
        const div = document.createElement("div");
        div.className = "dropdown-item";
        
        // Smart Logo Logic
        let logoSrc = maker.logo_url;
        if (logoSrc && !logoSrc.startsWith("http")) {
            logoSrc = `/static/img/logos/${logoSrc}`;
        }
        if (!logoSrc) logoSrc = DEFAULT_ICON;
        
        div.innerHTML = `
            <img src="${logoSrc}" class="maker-logo" alt="logo" onerror="this.style.display='none'">
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
            <img src="${logo}" class="maker-logo" onerror="this.style.display='none'">
            <span>${name}</span>
        </div>
        <span>▼</span>
    `;
    hiddenMakerInput.value = name;
    manualMakerInput.style.display = "none";
    manualMakerInput.value = "";
    dropdownList.classList.remove("show");
    
    // Clear error
    if(errorEl) errorEl.style.display = 'none';
}

function enableManualEntry() {
    dropdownBtn.innerHTML = `<span>Type below...</span> <span>▼</span>`;
    hiddenMakerInput.value = "OTHER";
    manualMakerInput.style.display = "block";
    manualMakerInput.focus();
    dropdownList.classList.remove("show");
}

// -----------------------------------------------------------
// 5. SUBMIT LOGIC
// -----------------------------------------------------------
async function handle_add_vehicle_submit(event) {
  event.preventDefault();
  
  if(!errorEl) return;
  errorEl.hidden = true;
  errorEl.textContent = "";
  errorEl.style.display = 'none';

  // Validate Year First
  const yearVal = parseInt(yearInput.value);
  if (isNaN(yearVal) || yearVal < 1900) {
      showError("Year must be 1900 or greater.");
      yearInput.focus();
      yearError.style.display = 'block'; // Ensure live error is also visible
      return;
  }

  // Manufacturer
  let finalMaker = hiddenMakerInput.value;
  if (finalMaker === "OTHER" || !finalMaker) {
      finalMaker = manualMakerInput.value.trim();
  }
  if (!finalMaker) {
      showError("Please select a Manufacturer.");
      return;
  }

  // Color
  const finalColor = hiddenColorInput.value.trim();
  if (!finalColor) {
      showError("Please select a Color.");
      return;
  }

  // Other Fields
  const model = document.getElementById("vehicle-model").value.trim();
  const plate = document.getElementById("vehicle-plate").value.trim();
  const mileage = parseInt(document.getElementById("vehicle-mileage").value.trim());
  const vin = document.getElementById("vehicle-vin").value.trim();
  const purchase_date = document.getElementById("purchase-date").value;

  if (isNaN(mileage) || mileage < 0) {
      showError("Mileage must be a valid number.");
      return;
  }

  const payload = {
    manufacturer: finalMaker,
    model: model,
    year: yearVal,
    license_plate: plate,
    initial_mileage: mileage,
    current_mileage: mileage,
    color: finalColor,
    vin: vin || null, 
    purchase_date: purchase_date || null 
  };

  const API_BASE_URL = window.location.origin;
  
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
            let msg = data.message || data.error || "Failed to add vehicle.";
            if (typeof msg === 'object') msg = Object.values(msg).join(", ");
            showError(msg);
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
    }
}

const form = document.getElementById("add-vehicle-form");
if(form) form.addEventListener("submit", handle_add_vehicle_submit);
