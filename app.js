// ====== الإعدادات ======
const FAMILY_PASS = "family2026";              // ← غيّرها
const SUPABASE_URL = "https://qunmvyhlkdannjwghbhq.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bm12eWhsa2Rhbm5qd2doYmhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTU1NTgsImV4cCI6MjEwODk3MTU1OH0.oKzEGhLLq3Nie0BH_BCXbYABV73NDwLZXyM5ujRwOFg";            // ← ضع مفتاح anon
const HOME_CENTER = [26.41226, 50.093419];         // ← إحداثيات مدينتك

// ====== الحالة ======
let selectedTime = null;
let selectedMood = null;
let allPlaces = [];
let map, markersLayer;

// ====== شاشة القفل ======
const lockScreen = document.getElementById("lockScreen");
const app = document.getElementById("app");
const passInput = document.getElementById("passInput");
const passBtn = document.getElementById("passBtn");
const passError = document.getElementById("passError");

if (localStorage.getItem("familyPass") === FAMILY_PASS) {
  unlock();
}

passBtn.addEventListener("click", () => {
  if (passInput.value === FAMILY_PASS) {
    localStorage.setItem("familyPass", FAMILY_PASS);
    unlock();
  } else {
    passError.textContent = "كلمة المرور غير صحيحة";
  }
});

function unlock() {
  lockScreen.classList.add("hidden");
  app.classList.remove("hidden");
  initMap();
  loadPlaces();
}

// ====== الخريطة ======
function initMap() {
  map = L.map("map").setView(HOME_CENTER, 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 19
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

// ====== جلب الأماكن من Supabase ======
async function loadPlaces() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/places?select=*&order=name.asc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    if (!res.ok) throw new Error("فشل الجلب: " + res.status);
    allPlaces = await res.json();
    console.log("تم تحميل", allPlaces.length, "مكان");
  } catch (e) {
    console.error(e);
    document.getElementById("results").innerHTML =
      `<p class="empty">تعذر تحميل الأماكن. تحقق من الإعدادات.</p>`;
  }
}

// ====== اختيار الوقت والمزاج ======
document.querySelectorAll("#timeChips button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#timeChips button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedTime = parseInt(btn.dataset.val);
    checkReady();
  });
});

document.querySelectorAll("#moodChips button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#moodChips button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedMood = btn.dataset.val;
    checkReady();
  });
});

function checkReady() {
  document.getElementById("suggestBtn").disabled = !(selectedTime && selectedMood);
}

// ====== المسافة ======
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ====== الاقتراح ======
document.getElementById("suggestBtn").addEventListener("click", async () => {
  if (!allPlaces.length) {
    await loadPlaces();
  }

  // فلترة حسب المزاج والوقت
  let filtered = allPlaces.filter(p =>
    p.category === selectedMood &&
    (p.avg_time_minutes || 60) <= selectedTime
  );

  // إذا لا نتائج مطابقة بالوقت، خفف الفلتر
  if (filtered.length === 0) {
    filtered = allPlaces.filter(p => p.category === selectedMood);
  }

  // ترتيب حسب المسافة من مركز المدينة
  filtered.sort((a, b) =>
    distanceKm(HOME_CENTER[0], HOME_CENTER[1], a.lat, a.lng) -
    distanceKm(HOME_CENTER[0], HOME_CENTER[1], b.lat, b.lng)
  );

  const top = filtered.slice(0, 5);
  renderResults(top);
});

// ====== عرض النتائج ======
function renderResults(places) {
  const resultsEl = document.getElementById("results");
  const mapEl = document.getElementById("map");

  markersLayer.clearLayers();

  if (places.length === 0) {
    resultsEl.innerHTML = `<p class="empty">لا توجد أماكن مطابقة حالياً. جرّب مزاجاً آخر.</p>`;
    mapEl.classList.remove("visible");
    return;
  }

  mapEl.classList.add("visible");
  setTimeout(() => map.invalidateSize(), 100);

  resultsEl.innerHTML = places.map(p => {
    const dist = distanceKm(HOME_CENTER[0], HOME_CENTER[1], p.lat, p.lng).toFixed(1);
    return `
      <div class="result-card">
        <h3>${p.name}</h3>
        <div class="meta">📍 ${dist} كم • ⏱️ ~${p.avg_time_minutes || 60} دقيقة • ${p.budget || ""}</div>
        <div class="desc">${p.description || ""}</div>
        ${p.notes ? `<div class="notes">💡 ${p.notes}</div>` : ""}
      </div>
    `;
  }).join("");

  const bounds = [];
  places.forEach(p => {
    const marker = L.marker([p.lat, p.lng]).addTo(markersLayer)
      .bindPopup(`<b>${p.name}</b><br>${p.category}<br>${p.description || ""}`);
    bounds.push([p.lat, p.lng]);
  });
  map.fitBounds(bounds, { padding: [30, 30] });
}

// ====== Service Worker ======
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(console.error);
}