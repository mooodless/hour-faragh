// ====== الإعدادات ======
const FAMILY_PASS = "family2026";              // ← غيّرها
const FALLBACK_CENTER = [26.41226, 50.093419]; // ← يُستخدم فقط إذا رفض المستخدم إذن الموقع
const STORAGE_KEY = "familyPlaces_v1";         // ← مفتاح التخزين المحلي

// ====== البيانات الافتراضية (تُنسخ إلى localStorage أول مرة فقط) ======
const DEFAULT_PLACES = [
  {
    id: "p1",
    name: "كوفي الأمير",
    category: "كوفي",
    city: "الخبر",
    lat: 26.2795,
    lng: 50.2085,
    description: "كوفي هادئ مناسب للعائلة",
    notes: "المواقف متوفرة بعد العصر",
    avg_time_minutes: 45,
    budget: "متوسط",
    rating: 4.5,
    review_count: 120
  },
  {
    id: "p2",
    name: "حديقة الملك فهد",
    category: "حديقة",
    city: "الدمام",
    lat: 26.4207,
    lng: 50.0888,
    description: "حديقة واسعة فيها ألعاب أطفال",
    notes: "يفضل الذهاب قبل المغرب",
    avg_time_minutes: 90,
    budget: "مجاني",
    rating: 4.3,
    review_count: 340
  },
  {
    id: "p3",
    name: "مطعم البيك",
    category: "مطعم",
    city: "الدمام",
    lat: 26.4367,
    lng: 50.1037,
    description: "وجبات سريعة محبوبة للعائلة",
    notes: "ازدحام وقت الغداء",
    avg_time_minutes: 40,
    budget: "اقتصادي",
    rating: 4.4,
    review_count: 890
  },
  {
    id: "p4",
    name: "سينما الخبر",
    category: "سينما",
    city: "الخبر",
    lat: 26.2822,
    lng: 50.2020,
    description: "قاعات حديثة ومريحة",
    notes: "احجز مسبقاً في الويكند",
    avg_time_minutes: 120,
    budget: "متوسط",
    rating: 4.2,
    review_count: 210
  },
  {
    id: "p5",
    name: "كورنيش القطيف",
    category: "حديقة",
    city: "القطيف",
    lat: 26.5194,
    lng: 50.0145,
    description: "ممشى بحري جميل",
    notes: "أجواء لطيفة بعد العصر",
    avg_time_minutes: 60,
    budget: "مجاني",
    rating: 4.6,
    review_count: 450
  }
  // ← أضف بقية الأماكن هنا
];

// ====== الحالة ======
let selectedTime = null;
let selectedMood = null;
let allPlaces = [];
let map, markersLayer;
let userLocation = null;
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

  userLocation = await getUserLocation();
  console.log("📍 الموقع المستخدم:", userLocation);

  map.setView(userLocation, 12);

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

// ====== تحميل الأماكن من التخزين المحلي ======
async function loadPlaces() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        allPlaces = parsed;
      } else {
        throw new Error("بيانات محلية فارغة أو غير صالحة");
      }
    } else {
      allPlaces = DEFAULT_PLACES.map(p => ({ ...p }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlaces));
    }
    console.log("تم تحميل", allPlaces.length, "مكان من التخزين المحلي");
  } catch (e) {
    console.error("خطأ في قراءة التخزين المحلي:", e);
    allPlaces = DEFAULT_PLACES.map(p => ({ ...p }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlaces));
    const resEl = document.getElementById("results");
    if (resEl) {
      resEl.innerHTML = `<p class="empty">تعذر قراءة البيانات المحلية. تم استخدام البيانات الافتراضية.</p>`;
    }
  }
}

// ====== اختيار الوقت والمزاج والمدينة ======
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

// ====== تحديد مدينة المستخدم التقريبية ======
function getUserCityFromCoords(coords) {
  if (!coords) return null;
  const [lat, lng] = coords;

  const cities = [
    { name: "الخبر",     lat: 26.28, lng: 50.20, radius: 15 },
    { name: "الدمام",    lat: 26.43, lng: 50.10, radius: 15 },
    { name: "الظهران",   lat: 26.29, lng: 50.15, radius: 12 },
    { name: "القطيف",    lat: 26.55, lng: 50.02, radius: 25 },
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

  // 1.b فلترة حسب المدينة
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

  if (timeFiltered.length === 0) {
    timeFiltered = filtered;
  }

  // 3. الترتيب الذكي
  const userCity = getUserCityFromCoords(userLocation);
  console.log("🏙️ مدينة المستخدم التقريبية:", userCity);

  timeFiltered.sort((a, b) => {
    const ratingDiff = (b.rating || 0) - (a.rating || 0);
    if (Math.abs(ratingDiff) > 0.001) return ratingDiff;

    const reviewDiff = (b.review_count || 0) - (a.review_count || 0);
    if (reviewDiff !== 0) return reviewDiff;

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

  const nearestDist = distanceKm(origin[0], origin[1], places[0].lat, places[0].lng);
  let warning = "";
  if (nearestDist > 100) {
    warning = `<p class="empty" style="background:#fef5e7; padding:12px; border-radius:12px; margin-bottom:12px;">
      ⚠️ أنت بعيد جداً (${nearestDist.toFixed(0)} كم). الأماكن المعروضة قد لا تكون قريبة منك.
    </p>`;
  }

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

// ====== إدارة الأماكن: تصدير / استيراد / استعادة ======
function refreshAfterManage(msg) {
  const msgEl = document.getElementById("manageMsg");
  if (msgEl) msgEl.textContent = msg;
  // مسح النتائج القديمة حتى لا تختلط
  const resEl = document.getElementById("results");
  if (resEl) resEl.innerHTML = "";
  markersLayer.clearLayers();
}

document.getElementById("exportBtn")?.addEventListener("click", () => {
  const data = JSON.stringify(allPlaces, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `family-places-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  refreshAfterManage(`✅ تم تصدير ${allPlaces.length} مكان.`);
});

document.getElementById("importInput")?.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    if (!Array.isArray(imported)) throw new Error("الملف يجب أن يحتوي مصفوفة أماكن");

    const valid = imported.filter(p =>
      p && p.name && typeof p.lat === "number" && typeof p.lng === "number" && p.category
    );
    if (!valid.length) throw new Error("لا توجد أماكن صالحة في الملف");

    const existing = new Set(allPlaces.map(p => `${p.name}|${p.lat}|${p.lng}`));
    const added = valid.filter(p => !existing.has(`${p.name}|${p.lat}|${p.lng}`));

    // ضمان وجود id
    added.forEach((p, i) => {
      if (!p.id) p.id = "p_imp_" + Date.now() + "_" + i;
    });

    allPlaces = [...allPlaces, ...added];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlaces));
    refreshAfterManage(`✅ تم استيراد ${added.length} مكان جديد. الإجمالي: ${allPlaces.length}`);
  } catch (err) {
    refreshAfterManage("❌ " + err.message);
  } finally {
    e.target.value = ""; // للسماح بإعادة استيراد نفس الملف
  }
});

document.getElementById("resetBtn")?.addEventListener("click", () => {
  if (!confirm("سيتم حذف كل الأماكن المضافة واستعادة القائمة الافتراضية. متابعة؟")) return;
  allPlaces = DEFAULT_PLACES.map(p => ({ ...p }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlaces));
  refreshAfterManage(`✅ تمت الاستعادة. الإجمالي: ${allPlaces.length}`);
});

// ====== إضافة مكان جديد ======
document.getElementById("addPlaceForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const lat = parseFloat(fd.get("lat"));
  const lng = parseFloat(fd.get("lng"));
  const name = (fd.get("name") || "").toString().trim();
  const category = fd.get("category");

  if (!name || isNaN(lat) || isNaN(lng) || !category) {
    refreshAfterManage("❌ تحقق من الاسم والإحداثيات والتصنيف.");
    return;
  }

  const place = {
    id: "p_" + Date.now(),
    name,
    city: (fd.get("city") || "").toString().trim(),
    lat,
    lng,
    category,
    avg_time_minutes: parseInt(fd.get("avg_time_minutes")) || 60,
    description: (fd.get("description") || "").toString().trim(),
    notes: (fd.get("notes") || "").toString().trim(),
    budget: (fd.get("budget") || "").toString().trim(),
    rating: parseFloat(fd.get("rating")) || 0,
    review_count: parseInt(fd.get("review_count")) || 0
  };

  allPlaces.push(place);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(allPlaces));
  e.target.reset();
  refreshAfterManage(`✅ تمت إضافة "${place.name}". الإجمالي: ${allPlaces.length}`);
});

// ====== Service Worker ======
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(console.error);
}