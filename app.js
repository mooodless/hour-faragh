// ====== الإعدادات ======
const FAMILY_PASS = "family2026";              // ← غيّرها
const SUPABASE_URL = "https://qunmvyhlkdannjwghbhq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bm12eWhsa2Rhbm5qd2doYmhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTU1NTgsImV4cCI6MjEwODk3MTU1OH0.oKzEGhLLq3Nie0BH_BCXbYABV73NDwLZXyM5ujRwOFg";            // ← ضع مفتاح anon
const FALLBACK_CENTER = [26.41226, 50.093419];         // ← إحداثيات مدينتك

// ====== الحالة ======
let selectedTime = null;
let selectedMood = null;
let allPlaces = [];
let map, markersLayer;
let userLocation = null;

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

async function unlock() {
  lockScreen.classList.add("hidden");
  app.classList.remove("hidden");
  initMap();

  // جلب الموقع أولاً (سيظهر طلب الإذن للمستخدم)
  userLocation = await getUserLocation();

  // توسيط الخريطة على موقع المستخدم
  map.setView(userLocation, 13);

  // ثم تحميل الأماكن
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

// ====== جلب موقع المستخدم ======
function getUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("⚠️ المتصفح لا يدعم تحديد الموقع");
      resolve(FALLBACK_CENTER);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = [position.coords.latitude, position.coords.longitude];
        console.log("📍 تم الحصول على موقع المستخدم:", loc);
        resolve(loc);
      },
      (error) => {
        console.warn("⚠️ فشل الحصول على الموقع:", error.message);
        console.log("💡 سيتم استخدام المركز الافتراضي (الدمام)");
        resolve(FALLBACK_CENTER);
      },
      {
        enableHighAccuracy: true,  // دقة عالية
        timeout: 10000,             // 10 ثوانٍ كحد أقصى
        maximumAge: 60000           // يمكن استخدام موقع محفوظ لمدة دقيقة
      }
    );
  });
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

  // تأكد من وجود موقع المستخدم
  if (!userLocation) {
    userLocation = await getUserLocation();
  }

  // 1. فلترة حسب المزاج
  let filtered = allPlaces.filter(p => p.category === selectedMood);

  // 2. شرط "50% من الوقت المتاح"
  const maxVisitDuration = selectedTime * 0.5;
  let timeFiltered = filtered.filter(p =>
    (p.avg_time_minutes || 60) <= maxVisitDuration
  );

  // إذا لم توجد نتائج، خفف الشرط
  if (timeFiltered.length === 0) {
    timeFiltered = filtered;
  }

  // 3. الترتيب: التقييم أولاً، ثم عدد المقيمين، ثم المسافة من موقع المستخدم
  timeFiltered.sort((a, b) => {
    const ratingDiff = (b.rating || 0) - (a.rating || 0);
    if (Math.abs(ratingDiff) > 0.001) return ratingDiff;

    const reviewDiff = (b.review_count || 0) - (a.review_count || 0);
    if (reviewDiff !== 0) return reviewDiff;

    // المسافة من موقع المستخدم
    return distanceKm(userLocation[0], userLocation[1], a.lat, a.lng) -
           distanceKm(userLocation[0], userLocation[1], b.lat, b.lng);
  });

  const top = timeFiltered.slice(0, 5);
  renderResults(top);
  if (top.length > 0) {
    const origin = userLocation || FALLBACK_CENTER;
    const nearestDist = distanceKm(origin[0], origin[1], top[0].lat, top[0].lng);
    if (nearestDist > 100) {
      document.getElementById("results").insertAdjacentHTML("afterbegin",
        `<p class="empty" style="background:#fef5e7; padding:12px; border-radius:12px; margin-bottom:12px;">
          ⚠️ أنت بعيد عن الدمام (${nearestDist.toFixed(0)} كم). الأماكن المعروضة قد لا تكون قريبة منك.
        </p>`
      );
    }
  }
  
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

  // استخدام موقع المستخدم في حساب المسافة
  const origin = userLocation || FALLBACK_CENTER;

  resultsEl.innerHTML = places.map(p => {
    const dist = distanceKm(origin[0], origin[1], p.lat, p.lng).toFixed(1);
    const ratingStars = p.rating ? `⭐ ${p.rating.toFixed(1)}` : "⭐ —";
    const reviews = p.review_count ? `(${p.review_count} تقييم)` : "";

    // رابط لفتح الموقع في خرائط جوجل (اختياري)
    const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;

    return `
      <div class="result-card">
        <h3>${p.name}</h3>
        <div class="meta">
          📍 ${dist} كم • ⏱️ ~${p.avg_time_minutes || 60} دقيقة • ${p.budget || ""}
          <br>${ratingStars} ${reviews}
        </div>
        <div class="desc">${p.description || ""}</div>
        ${p.notes ? `<div class="notes">💡 ${p.notes}</div>` : ""}
        <a href="${gmapsUrl}" target="_blank" rel="noopener" class="gmaps-link">🗺️ فتح في خرائط جوجل</a>
      </div>
    `;
  }).join("");

  const bounds = [];
  places.forEach(p => {
    L.marker([p.lat, p.lng]).addTo(markersLayer)
      .bindPopup(`<b>${p.name}</b><br>${p.category}<br>${p.description || ""}`);
    bounds.push([p.lat, p.lng]);
  });

  // أضف موقع المستخدم كدائرة زرقاء
  if (userLocation) {
    L.circleMarker(userLocation, {
      radius: 8,
      color: "#2c7a7b",
      fillColor: "#2c7a7b",
      fillOpacity: 0.5
    }).addTo(markersLayer).bindPopup("📍 موقعك الحالي");
    bounds.push(userLocation);
  }

  map.fitBounds(bounds, { padding: [30, 30] });
}

// ====== Service Worker ======
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(console.error);
}