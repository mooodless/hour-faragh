// ====== الإعدادات ======
const FAMILY_PASS = "family2026";              // ← غيّرها
const SUPABASE_URL = "https://qunmvyhlkdannjwghbhq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bm12eWhsa2Rhbm5qd2doYmhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzOTU1NTgsImV4cCI6MjEwODk3MTU1OH0.oKzEGhLLq3Nie0BH_BCXbYABV73NDwLZXyM5ujRwOFg";
const FALLBACK_CENTER = [26.41226, 50.093419]; // ← يُستخدم فقط إذا رفض المستخدم إذن الموقع

// ====== الحالة ======
let selectedTime = null;
let selectedMood = null;
let allPlaces = [];
let map, markersLayer;
let userLocation = null; // ← موقع المستخدم الحالي
let selectedCity = "";

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

  // جلب موقع المستخدم أولاً (سيظهر طلب الإذن)
  userLocation = await getUserLocation();
  console.log("📍 الموقع المستخدم:", userLocation);

  // توسيط الخريطة على موقع المستخدم
  map.setView(userLocation, 12);

  // ثم تحميل الأماكن
  loadPlaces();
}

// ====== الخريطة ======
function initMap() {
  map = L.map("map").setView(FALLBACK_CENTER, 12);
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
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
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

document.querySelectorAll("#cityChips button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#cityChips button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedCity = btn.dataset.val;
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

// ====== تحديد مدينة المستخدم التقريبية من إحداثياته ======
// (بدون استدعاء Nominatim — نستخدم نطاقات إحداثيات معروفة)
function getUserCityFromCoords(coords) {
  if (!coords) return null;
  const [lat, lng] = coords;

  // نطاقات تقريبية للمدن الرئيسية في المنطقة الشرقية
    // نطاقات تقريبية للمدن الرئيسية في المنطقة الشرقية
  const cities = [
    { name: "الخبر",     lat: 26.28, lng: 50.20, radius: 15 },
    { name: "الدمام",    lat: 26.43, lng: 50.10, radius: 15 },
    { name: "الظهران",   lat: 26.29, lng: 50.15, radius: 12 },
    { name: "القطيف",    lat: 26.55, lng: 50.02, radius: 25 }, // ← شمل سيهات، صفوى، تاروت، جِدحفص
    { name: "رأس تنورة", lat: 26.65, lng: 50.16, radius: 12 },
    { name: "بقيق",      lat: 26.00, lng: 49.65, radius: 20 },
    { name: "الأحساء",   lat: 25.38, lng: 49.59, radius: 40 },
  ];

  let best = null;
  let bestDist = Infinity;

  for (const c of cities) {
    const d = distanceKm(lat, lng, c.lat, c.lng);
    if (d <= c.radius && d < bestDist) {
      best = c.name;
      bestDist = d;
    }
  }

  return best;
}

// ====== الاقتراح ======
document.getElementById("suggestBtn").addEventListener("click", async () => {
  if (!allPlaces.length) {
    await loadPlaces();
  }

  if (!userLocation) {
    userLocation = await getUserLocation();
  }

    // 1. فلترة حسب المزاج
  let filtered = allPlaces.filter(p => p.category === selectedMood);

  // 1.b فلترة حسب المدينة (إذا اختار المستخدم مدينة معينة)
  if (selectedCity) {
    const cityFiltered = filtered.filter(p => p.city === selectedCity);
    if (cityFiltered.length > 0) {
      filtered = cityFiltered;
    } else {
      console.warn(`لا توجد أماكن من فئة ${selectedMood} في ${selectedCity}، سيتم تجاهل فلتر المدينة`);
    }
  }

  // 2. شرط "50% من الوقت المتاح"
  const maxVisitDuration = selectedTime * 0.5;
  let timeFiltered = filtered.filter(p =>
    (p.avg_time_minutes || 60) <= maxVisitDuration
  );

  // إذا لم توجد نتائج، خفف الشرط
  if (timeFiltered.length === 0) {
    timeFiltered = filtered;
  }

    // 3. الترتيب الذكي:

  const userCity = getUserCityFromCoords(userLocation);
  console.log("🏙️ مدينة المستخدم التقريبية:", userCity);

  timeFiltered.sort((a, b) => {
    const ratingDiff = (b.rating || 0) - (a.rating || 0);
    if (Math.abs(ratingDiff) > 0.001) return ratingDiff;

    const reviewDiff = (b.review_count || 0) - (a.review_count || 0);
    if (reviewDiff !== 0) return reviewDiff;

    // نفس المدينة أولاً
    const aSameCity = a.city === userCity ? 1 : 0;
    const bSameCity = b.city === userCity ? 1 : 0;
    if (aSameCity !== bSameCity) return bSameCity - aSameCity;

    return distanceKm(userLocation[0], userLocation[1], a.lat, a.lng) -
           distanceKm(userLocation[0], userLocation[1], b.lat, b.lng);
  });

  const top = timeFiltered.slice(0, 5);
  renderResults(top, timeFiltered.length);
});

// ====== عرض النتائج ======
function renderResults(places, totalCount) {
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

  const origin = userLocation || FALLBACK_CENTER;

  // تحذير إذا كانت أقرب نتيجة بعيدة
  const nearestDist = distanceKm(origin[0], origin[1], places[0].lat, places[0].lng);
  let warning = "";
  if (nearestDist > 100) {
    warning = `<p class="empty" style="background:#fef5e7; padding:12px; border-radius:12px; margin-bottom:12px;">
      ⚠️ أنت بعيد جداً (${nearestDist.toFixed(0)} كم). الأماكن المعروضة قد لا تكون قريبة منك.
    </p>`;
  }

  // عرض عدد النتائج الإجمالي
  let countMsg = "";
  if (totalCount && totalCount > places.length) {
    countMsg = `<p class="empty" style="background:#e6fffa; padding:10px; border-radius:12px; margin-bottom:12px;">
      🔍 وجدنا ${totalCount} مكاناً مطابقاً، نعرض أفضل ${places.length}.
    </p>`;
  }

  resultsEl.innerHTML = warning + countMsg + places.map(p => {
    const dist = distanceKm(origin[0], origin[1], p.lat, p.lng).toFixed(1);
    const ratingStars = p.rating ? `⭐ ${p.rating.toFixed(1)}` : "⭐ —";
    const reviews = p.review_count ? `(${p.review_count} تقييم)` : "";
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

    return `
      <div class="result-card">
        <h3>${p.name}</h3>
        <div class="meta">
          ${p.city ? `🏙️ ${p.city} • ` : ""}📍 ${dist} كم • ⏱️ ~${p.avg_time_minutes || 60} دقيقة • ${p.budget || ""}
          <br>${ratingStars} ${reviews}
        </div>
        <div class="desc">${p.description || ""}</div>
        ${p.notes ? `<div class="notes">💡 ${p.notes}</div>` : ""}
        <a href="${gmapsUrl}" target="_blank" rel="noopener" class="gmaps-link">🚗 الاتجاهات إلى المكان</a>
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