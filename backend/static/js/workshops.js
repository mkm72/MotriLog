const GOOGLE_API_KEY = "AIzaSyDc-KRt7xmzTtvPdCZPGrgtttlUSqtkW_k";

let map;
let userLocation = null;
let placesService;
let selectedCategory = "oil_change";
let markers = [];

// ============================
//  INIT MAP
// ============================
function initMap() {
    map = new google.maps.Map(document.getElementById("map-bg"), {
        center: { lat: 24.7136, lng: 46.6753 }, // Riyadh
        zoom: 13,
        disableDefaultUI: true,
    });

    placesService = new google.maps.places.PlacesService(map);

    getUserLocation();
}

// ============================
// GET USER LOCATION
// ============================
function getUserLocation() {
    if (!navigator.geolocation) {
        alert("Location access denied.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userLocation = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
            };

            map.setCenter(userLocation);

            new google.maps.Marker({
                position: userLocation,
                map,
                title: "You are here",
                icon: {
                    url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                }
            });

            searchNearbyWorkshops();
        },
        () => alert("Please allow location access to find nearby workshops.")
    );
}

// ============================
// CATEGORY → PLACES SEARCH TYPE
// ============================
function categoryToQuery(category) {
    switch (category) {
        case "oil_change": return "oil change";
        case "tire": return "tire shop";
        case "general": return "car repair";
        case "ac": return "AC repair";
        default: return "car workshop";
    }
}

// ============================
// SEARCH NEARBY WORKSHOPS
// ============================
function searchNearbyWorkshops() {
    if (!userLocation) return;

    const request = {
        location: userLocation,
        radius: 5000,
        keyword: categoryToQuery(selectedCategory),
    };

    placesService.nearbySearch(request, (results, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK) {
            console.error("Places error:", status);
            return;
        }

        renderWorkshopList(results);
        placeMarkers(results);
    });
}

// ============================
// RENDER WORKSHOPS IN LIST
// ============================
function renderWorkshopList(places) {
    const list = document.getElementById("workshop-list");
    list.innerHTML = "";

    places.forEach((place) => {
        const distance = calcDistance(userLocation.lat, userLocation.lng, place.geometry.location.lat(), place.geometry.location.lng());

        const item = document.createElement("li");
        item.className = "workshop-item";
        item.innerHTML = `
            <div class="workshop-info">
                <h4>${place.name}</h4>
                <p class="muted">${distance.toFixed(1)} km · ⭐ ${place.rating || "N/A"}</p>
            </div>
        `;

        list.appendChild(item);
    });
}

// ============================
// MAP MARKERS
// ============================
function placeMarkers(places) {
    markers.forEach(m => m.setMap(null));
    markers = [];

    places.forEach(place => {
        const marker = new google.maps.Marker({
            map,
            position: place.geometry.location,
            title: place.name,
        });

        markers.push(marker);
    });
}

// ============================
// DISTANCE CALCULATION
// ============================
function calcDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI/180;
    const dLon = (lon2 - lon1) * Math.PI/180;

    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI/180) *
        Math.cos(lat2 * Math.PI/180) *
        Math.sin(dLon/2) *
        Math.sin(dLon/2);

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================
// CATEGORY FILTER BUTTONS
// ============================
document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
        document.querySelectorAll(".chip").forEach(c => c.classList.remove("chip-active"));
        chip.classList.add("chip-active");

        selectedCategory = chip.textContent
            .toLowerCase()
            .replace(" ", "_");

        searchNearbyWorkshops();
    });
});

// ============================
// SEARCH BAR
// ============================
document.getElementById("search-input").addEventListener("input", (e) => {
    const text = e.target.value.toLowerCase();

    document.querySelectorAll(".workshop-item").forEach(item => {
        const name = item.querySelector("h4").textContent.toLowerCase();
        item.style.display = name.includes(text) ? "block" : "none";
    });
});

// ============================
// GET DIRECTIONS BUTTON
// ============================
document.querySelector(".btn-primary").addEventListener("click", () => {
    if (!userLocation) return alert("Location not available");

    window.open(
        `https://www.google.com/maps/search/?api=1&query=car+repair&center=${userLocation.lat},${userLocation.lng}`,
        "_blank"
    );
});

// ============================
// MOTRILOG LOGO REDIRECT
// ============================
document.querySelector(".brand-logo").addEventListener("click", () => {
    window.location.href = "/";
});
