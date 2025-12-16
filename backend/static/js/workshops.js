console.log("WORKSHOPS.JS LOADED");

let map;
let markers = [];
// Default center (Riyadh)
let userLat = 24.7136; 
let userLng = 46.6753;
let isPickingLocation = false; // Flag for picking mode

// --- 1. Initialize Map ---
function initMap() {
    map = L.map('map').setView([userLat, userLng], 12); 

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // --- Admin: Map Click Listener ---
    map.on('click', function(e) {
        if (isPickingLocation) {
            const latInput = document.getElementById('mw_lat');
            const lngInput = document.getElementById('mw_lng');
            const pickBtn = document.getElementById('btn-activate-picker');

            if (latInput && lngInput) {
                latInput.value = e.latlng.lat.toFixed(6);
                lngInput.value = e.latlng.lng.toFixed(6);
                
                // Visual feedback
                L.popup()
                    .setLatLng(e.latlng)
                    .setContent("📍 Selected Location")
                    .openOn(map);
                
                // Turn off picker mode
                isPickingLocation = false;
                document.getElementById('map').style.cursor = ''; 
                if(pickBtn) {
                    pickBtn.classList.remove('active');
                    pickBtn.innerText = "📍 Pick Location on Map";
                }
            }
        }
    });

    // Load Data Immediately (Default Location)
    fetchWorkshops();

    // Get real location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;
                map.flyTo([userLat, userLng], 13);
                fetchWorkshops(); 
            },
            (err) => console.warn("Location access denied or failed.")
        );
    }
}

// --- 2. Fetch Workshops ---
async function fetchWorkshops() {
    const service = document.getElementById('service-filter').value;
    const radius = 5000000; // Large radius to fetch all

    try {
        const url = `${API_BASE_URL}/api/workshops/nearby?lat=${userLat}&lng=${userLng}&radius=${radius}&service=${service}`;
        
        const res = await fetch(url);
        const data = await res.json();

        updateMapMarkers(data.workshops);
        updateSidebarList(data.workshops);

    } catch (err) {
        console.error("Error fetching workshops:", err);
    }
}

// --- 3. Update Markers ---
function updateMapMarkers(workshops) {
    // Clear old markers
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    // --- NEW: USER LOCATION SHAPE (Blue Dot) ---
    const userDot = L.circleMarker([userLat, userLng], {
        radius: 8, fillColor: "#2563eb", color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 1
    }).addTo(map);
    
    const userHalo = L.circleMarker([userLat, userLng], {
        radius: 20, fillColor: "#2563eb", color: "transparent", weight: 0, fillOpacity: 0.2
    }).addTo(map);

    userDot.bindPopup("<b>📍 You are here</b>");
    markers.push(userDot);
    markers.push(userHalo);

    if(!workshops) return;

    // Add Workshop Markers (Standard Pins)
    workshops.forEach(w => {
        if (w.location && w.location.coordinates) {
            const [lng, lat] = w.location.coordinates;
            const marker = L.marker([lat, lng]).addTo(map);
            const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
            
            // --- ADMIN DELETE BUTTON ---
            let deleteBtn = "";
            if (typeof USER_ROLE !== 'undefined' && USER_ROLE === 'admin') {
                deleteBtn = `
                    <button onclick="deleteWorkshop('${w.id}')" 
                        style="display: block; width: 100%; background: #ff4757; color: white; border: none; margin-top: 8px; padding: 6px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        🗑️ Delete Workshop
                    </button>
                `;
            }
            // ---------------------------

            marker.bindPopup(`
                <div style="min-width: 180px; text-align: center;">
                    <h3 style="margin: 0 0 5px; font-size: 16px; font-weight: 700;">${w.name}</h3>
                    <p style="margin: 0 0 8px; color: #555; font-size: 13px;">${w.address}</p>
                    <div style="margin-bottom: 10px; color: #f59e0b; font-weight: bold;">⭐ ${w.rating}</div>
                    
                    <a href="${googleMapsUrl}" target="_blank" 
                       style="display: inline-block; background: #007aff; color: white; text-decoration: none; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                       🗺️ Get Directions
                    </a>
                    ${deleteBtn}
                </div>
            `);
            markers.push(marker);
        }
    });
}

// --- NEW: Delete Workshop Function ---
async function deleteWorkshop(id) {
    if(!confirm("Are you sure you want to delete this workshop?")) return;
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/workshops/${id}`, { method: 'DELETE' });
        if(res.ok) {
            alert("Workshop deleted.");
            fetchWorkshops(); // Refresh map
        } else {
            alert("Failed to delete.");
        }
    } catch(e) { console.error(e); }
}

// --- 4. Update Sidebar ---
function updateSidebarList(workshops) {
    const list = document.getElementById('workshop-list');
    list.innerHTML = "";

    if (!workshops || workshops.length === 0) {
        list.innerHTML = "<p style='text-align:center; padding:10px;'>No workshops found.</p>";
        return;
    }

    workshops.forEach(w => {
        const item = document.createElement('div');
        item.className = 'workshop-item';
        item.innerHTML = `
            <div style="font-weight:bold;">${w.name}</div>
            <div style="font-size:0.9em; color:#666;">${w.address}</div>
            <div style="font-size:0.8em; margin-top:4px;">⭐ ${w.rating}</div>
        `;
        
        item.addEventListener('click', () => {
             if (w.location && w.location.coordinates) {
                const [lng, lat] = w.location.coordinates;
                map.setView([lat, lng], 16);
                // Optionally open the popup of the matching marker
             }
        });

        list.appendChild(item);
    });
}

// --- 5. Admin Form Logic ---
function setupAdminLogic() {
    const pickBtn = document.getElementById('btn-activate-picker');
    if (pickBtn) {
        pickBtn.addEventListener('click', () => {
            isPickingLocation = true;
            document.getElementById('map').style.cursor = 'crosshair'; 
            pickBtn.classList.add('active');
            pickBtn.innerText = "Click on Map now...";
        });
    }

    const form = document.getElementById('mapAddWorkshopForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.innerText = "Saving...";
            btn.disabled = true;

            const payload = {
                name: document.getElementById('mw_name').value,
                address: document.getElementById('mw_address').value,
                lat: document.getElementById('mw_lat').value,
                lng: document.getElementById('mw_lng').value,
                services: ['general_repair']
            };

            try {
                const res = await fetch(`${API_BASE_URL}/api/workshops/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    alert("✅ Workshop Added!");
                    form.reset();
                    fetchWorkshops(); 
                } else {
                    const err = await res.json();
                    alert("❌ Error: " + (err.error || "Failed"));
                }
            } catch (error) {
                console.error(error);
                alert("❌ Network Error");
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
}

// --- Initialize ---
document.addEventListener("DOMContentLoaded", () => {
    initMap();
    setupAdminLogic();

    document.getElementById('service-filter').addEventListener('change', fetchWorkshops);
    document.getElementById('btn-refresh-loc').addEventListener('click', () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                userLat = pos.coords.latitude;
                userLng = pos.coords.longitude;
                map.setView([userLat, userLng], 13);
                fetchWorkshops();
            });
        }
    });
});
