console.log("ADMIN.JS LOADED!");

// --- 1. Add Manufacturer Logic ---
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
                alert(`✅ Successfully added ${data.name}!`);
                makerForm.reset();
            } else if (res.status === 409) {
                alert(`⚠️ Manufacturer "${payload.name}" already exists.`);
            } else {
                alert(`❌ Error: ${data.error || 'Failed to add'}`);
            }
        } catch (err) {
            console.error(err);
            alert("❌ Network Error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    });
}

// --- 2. Add Workshop Logic ---
function setupAddWorkshopForm() {
    const workshopForm = document.getElementById('addWorkshopForm');
    const locationBtn = document.getElementById('btn-get-location');

    if (!workshopForm) return;

    // Handle Form Submit
    workshopForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = workshopForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = "Saving...";
        submitBtn.disabled = true;

        const workshopData = {
            name: document.getElementById('w_name').value,
            address: document.getElementById('w_address').value,
            lat: document.getElementById('w_lat').value,
            lng: document.getElementById('w_lng').value,
            services: ['general_repair']
        };

        try {
            const response = await fetch('/workshops/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(workshopData)
            });

            const result = await response.json();

            if (response.ok) {
                alert('✅ Workshop Added Successfully!');
                workshopForm.reset();
            } else {
                alert('❌ Error: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            alert('❌ Server Error');
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    });

    // Handle Location Button
    if (locationBtn) {
        locationBtn.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert("Geolocation not supported.");
                return;
            }
            locationBtn.innerText = "...";
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    document.getElementById('w_lat').value = pos.coords.latitude;
                    document.getElementById('w_lng').value = pos.coords.longitude;
                    locationBtn.innerText = "📍";
                },
                () => { alert("Location failed."); locationBtn.innerText = "📍"; }
            );
        });
    }
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    setupAddMakerForm();
    setupAddWorkshopForm();
});
