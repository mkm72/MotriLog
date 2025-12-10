// --- Global Variables ---
let map;
let markersLayer = new L.LayerGroup();
let hasAutoZoomed = false; 

// --- 1. Initialize Map ---
function initMap() {
    // Default View (Saudi Arabia)
    map = L.map('map').setView([24.7136, 46.6753], 6); 

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markersLayer.addTo(map);

    // ➤ SAFETY FETCH: Load data immediately (Default Center)
    // This ensures pins appear even if GPS is slow/blocked
    fetchWorkshops(24.7136, 46.6753);

    // Now try to get better user location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                L.circleMarker([lat, lng], {
                    radius: 8,
                    fillColor: "#3388ff",
                    color: "#fff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).addTo(map).bindPopup("You are here");

                // Re-fetch with user's actual location (optional, since radius is unlimited)
                fetchWorkshops(lat, lng);
            },
            () => {
                console.log("GPS denied. Using default view.");
            }
        );
    }
}

// --- 2. Fetch Data ---
async function fetchWorkshops(lat, lng) {
    markersLayer.clearLayers();
    
    const listContainer = document.getElementById('workshop-list');
    if (listContainer) listContainer.innerHTML = '<p style="padding:10px;">Loading...</p>';

    try {
        const response = await fetch(`/api/workshops/nearby?lat=${lat}&lng=${lng}&radius=40000000`);
        const data = await response.json();

        if (listContainer) listContainer.innerHTML = '';

        if (!data.workshops || data.workshops.length === 0) {
            if (listContainer) listContainer.innerHTML = '<p style="padding:10px;">No workshops found.</p>';
            return;
        }

        let groupBounds = [];

        data.workshops.forEach(workshop => {
            const wLat = workshop.location.coordinates[1];
            const wLng = workshop.location.coordinates[0];

            const marker = L.marker([wLat, wLng])
                .bindPopup(`
                    <b>${workshop.name}</b><br>
                    ${workshop.address}<br>
                    ⭐ ${workshop.rating}
                `);
            
            markersLayer.addLayer(marker);
            groupBounds.push([wLat, wLng]);

            if (listContainer) {
                const li = document.createElement('li');
                li.className = 'workshop-item';
                li.innerHTML = `
                    <div class="w-info">
                        <strong>${workshop.name}</strong>
                        <p>${workshop.address}</p>
                    </div>
                    <div class="w-rating">⭐ ${workshop.rating}</div>
                `;
                li.addEventListener('click', () => {
                    map.setView([wLat, wLng], 16);
                    marker.openPopup();
                });
                listContainer.appendChild(li);
            }
        });

        // Auto-Zoom to show ALL workshops
        if (groupBounds.length > 0 && !hasAutoZoomed) {
            map.fitBounds(groupBounds, { padding: [50, 50] });
            hasAutoZoomed = true;
        }

    } catch (err) {
        console.error("Error loading workshops:", err);
    }
}

// --- 3. Admin Features ---
function setupAdminFeatures() {
    const adminForm = document.getElementById('addWorkshopForm');
    const pickBtn = document.getElementById('btn-pick-location');
    let isPicking = false;
    let tempMarker = null;

    if (pickBtn && adminForm) {
        pickBtn.addEventListener('click', () => {
            isPicking = true;
            pickBtn.innerText = "👇 Click map to set pin";
            pickBtn.style.background = "#fff3cd";
        });

        map.on('click', (e) => {
            if (!isPicking) return;

            const { lat, lng } = e.latlng;
            document.getElementById('w_lat').value = lat;
            document.getElementById('w_lng').value = lng;
            
            const addrField = document.getElementById('w_address');
            if (!addrField.value) {
                addrField.value = `Loc: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }

            if (tempMarker) map.removeLayer(tempMarker);
            tempMarker = L.marker([lat, lng]).addTo(map).bindPopup("New Location").openPopup();

            isPicking = false;
            pickBtn.innerText = "✓ Location Set";
            pickBtn.style.background = "#d4edda";
        });

        adminForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const lat = document.getElementById('w_lat').value;
            const lng = document.getElementById('w_lng').value;

            if (!lat || !lng) {
                alert("Please click 'Pick on Map' first!");
                return;
            }

            const payload = {
                name: document.getElementById('w_name').value,
                address: document.getElementById('w_address').value,
                lat: lat,
                lng: lng,
                services: ['general_repair']
            };

            try {
                const res = await fetch('/api/workshops/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    alert('Workshop Saved!');
                    fetchWorkshops(lat, lng); 
                    adminForm.reset();
                    pickBtn.innerText = "📍 Pick on Map";
                    pickBtn.style.background = "#eee";
                    if (tempMarker) map.removeLayer(tempMarker);
                } else {
                    const d = await res.json();
                    alert('Error: ' + d.error);
                }
            } catch (err) {
                console.error(err);
                alert('Connection Error');
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initMap();
    setupAdminFeatures();
});
