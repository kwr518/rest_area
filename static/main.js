let map;
let polyline;
let markers = [];
let lastRests = [];
let infowindow = null;
let isSelectingAutocomplete = false;
let routeBaseLevel = null;

const addressCache = {};
const geocoder = new kakao.maps.services.Geocoder();

// =========================
// 초기화 및 이벤트 바인딩
// =========================
window.onload = function () {
  const container = document.getElementById("map");
  map = new kakao.maps.Map(container, {
    center: new kakao.maps.LatLng(36.5, 127.8),
    level: 13,
  });

  addInputListeners();
  setupOutsideClick();
};

function addInputListeners() {
  const startInput = document.getElementById("start");
  const endInput = document.getElementById("end");
  startInput.addEventListener("input", () => autoComplete("start"));
  endInput.addEventListener("input", () => autoComplete("end"));
}

function setupOutsideClick() {
  document.addEventListener("click", (e) => {
    ["start", "end"].forEach((type) => {
      const input = document.getElementById(type);
      const box = document.getElementById(`autocomplete-${type}`);
      if (input && box && !input.contains(e.target) && !box.contains(e.target)) {
        box.classList.add("hidden");
      }
    });
  });
}

function autoComplete(type) {
  if (isSelectingAutocomplete) return;
  const input = document.getElementById(type);
  const keyword = input.value.trim();
  const box = document.getElementById(`autocomplete-${type}`);

  if (!keyword) { box.classList.add("hidden"); return; }

  const ps = new kakao.maps.services.Places();
  ps.keywordSearch(keyword, (data, status) => {
    if (status !== kakao.maps.services.Status.OK) { box.classList.add("hidden"); return; }
    box.innerHTML = "";
    box.classList.remove("hidden");
    data.forEach((place) => {
      const item = document.createElement("div");
      item.className = "p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors";
      item.innerHTML = `<div class="font-bold text-sm text-gray-800">${place.place_name}</div><div class="text-xs text-gray-400 truncate">${place.road_address_name || place.address_name}</div>`;
      item.onmousedown = (e) => {
        e.preventDefault();
        isSelectingAutocomplete = true;
        input.value = place.place_name;
        box.classList.add("hidden");
        setTimeout(() => { isSelectingAutocomplete = false; input.blur(); }, 0);
      };
      box.appendChild(item);
    });
  });
}

// =========================
// 경로 탐색 및 그리기
// =========================
function requestRoute() {
  const start = document.getElementById("start").value.trim();
  const end = document.getElementById("end").value.trim();
  if (!start || !end) { alert("출발지와 목적지를 모두 입력해주세요."); return; }

  const btn = document.querySelector("button[onclick='requestRoute()']");
  btn.innerText = "🚗 경로 탐색 중...";
  btn.disabled = true;

  fetch("/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, end }),
  })
    .then((res) => res.json())
    .then((data) => {
      btn.innerText = "🔍 맛집 로드 검색하기";
      btn.disabled = false;
      document.getElementById("empty-state").classList.add("hidden");
      document.getElementById("result-area").classList.remove("hidden");
      map.relayout();
      drawRoute(data);
    })
    .catch((err) => {
      btn.innerText = "🔍 맛집 로드 검색하기";
      btn.disabled = false;
      alert("오류: " + err.message);
    });
}

function drawRoute(data) {
  const path = data.route.map((p) => new kakao.maps.LatLng(p[1], p[0]));
  if (polyline) polyline.setMap(null);
  polyline = new kakao.maps.Polyline({ path, strokeWeight: 6, strokeColor: "#2563EB", strokeOpacity: 0.8 });
  polyline.setMap(map);

  const bounds = new kakao.maps.LatLngBounds();
  path.forEach((p) => bounds.extend(p));
  map.setBounds(bounds);

  const totalMeters = calculateTotalDistance(path);
  document.getElementById("route-meta").classList.remove("hidden");
  document.getElementById("meta-distance").textContent = `${(totalMeters / 1000).toFixed(1)} km`;
  document.getElementById("meta-time").textContent = estimateTime(totalMeters);

  lastRests = data.rests || [];
  drawRestAreas(lastRests);
}

// =========================
// 휴게소 리스트 및 카드 생성 (별점 제거 / highway_name 반영)
// =========================
function drawRestAreas(rests) {
  const list = document.getElementById("rest-list");
  list.innerHTML = "";
  markers.forEach((m) => m.setMap(null));
  markers = [];

  if (!polyline) return;
  const path = polyline.getPath();
  const travelDirection = getTravelDirection(path);
  const startPoint = path[0];

  // 0. 출발지 및 도착지 이름 가져오기
  const startName = document.getElementById("start").value.trim();
  const endName = document.getElementById("end").value.trim();

  let filtered = rests.filter((r) => isRestAreaNearRoute(r.lat, r.lng, path) && r.direction === travelDirection);
  
  filtered.sort((a, b) => getDistance(startPoint.getLat(), startPoint.getLng(), a.lat, a.lng) - getDistance(startPoint.getLat(), startPoint.getLng(), b.lat, b.lng));

  // --- [1] 상단 출발지 카드 추가 ---
  const startItem = document.createElement("div");
startItem.className = "timeline-item animate-fade-in-up";
startItem.innerHTML = `
    <div class="timeline-dot bg-blue-400 border-red shadow-sm"></div>
    <div class="timeline-card-wrapper flex">
        <div class="bg-red-300/20 p-3 px-4 rounded-xl border border-red-100/50 flex items-center gap-3">
            <span class="text-[9px] font-bold text-red-400 uppercase tracking-tighter bg-white px-1.5 py-0.5 rounded border border-red-50">START</span>
            <h3 class="text-sm font-bold text-gray-900">${startName}</h3>
        </div>
    </div>
`;
list.appendChild(startItem);

  // --- [2] 휴게소 목록 반복문 ---
  filtered.forEach((r, idx) => {
    const loc = new kakao.maps.LatLng(r.lat, r.lng);
    const marker = new kakao.maps.Marker({ position: loc, map: map });
    markers.push(marker);
    kakao.maps.event.addListener(marker, "click", () => openSimpleInfo(marker, r));

    const facIcons = `
      <div class="absolute bottom-4 right-5 flex gap-1.5">
          <i data-lucide="fuel" class="w-3.5 h-3.5 ${r.gas === 'Y' ? 'text-gray-400' : 'text-gray-200 opacity-30'}"></i>
          <i data-lucide="zap" class="w-3.5 h-3.5 ${r.elec === 'Y' ? 'text-yellow-500' : 'text-gray-200 opacity-30'}"></i>
          <i data-lucide="pill" class="w-3.5 h-3.5 ${r.pharmacy === 'Y' ? 'text-blue-400' : 'text-gray-200 opacity-30'}"></i>
          <i data-lucide="baby" class="w-3.5 h-3.5 ${r.nurse === 'Y' ? 'text-pink-400' : 'text-gray-200 opacity-30'}"></i>
      </div>
    `;

    const item = document.createElement("div");
    item.className = "timeline-item animate-fade-in-up";
    item.style.animationDelay = `${(idx + 1) * 0.1}s`; // 출발지 이후부터 순차적 애니메이션

    item.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-card-wrapper">
        <div class="relative bg-white p-5 pr-16 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer"
             onclick="handleCardClick(${r.id})">
          <h3 class="font-black text-lg text-gray-800 mb-1">${formatRestName(r.name)}</h3>
          <div class="flex items-center mb-2">
            <span class="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              ${r.highway_name || "고속도로"} 
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <div class="flex items-center gap-1 bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">
              <i data-lucide="award" class="w-3 h-3"></i>
              <span>Best</span>
            </div>
            <span class="text-xs font-bold text-gray-600 truncate max-w-[140px]">
              ${r.food || "대표 메뉴 정보"}
            </span>
          </div>
          ${facIcons}
        </div>
      </div>
    `;

    if (!window.restData) window.restData = {};
    window.restData[r.id] = r;
    list.appendChild(item);
  });

  // --- [3] 하단 도착지 카드 추가 ---
  const endItem = document.createElement("div");
  endItem.className = "timeline-item animate-fade-in-up";
  endItem.style.animationDelay = `${(filtered.length + 1) * 0.1}`;
  endItem.innerHTML = `
      <div class="timeline-dot bg-blue-300 border-white shadow-sm"></div>
      <div class="timeline-card-wrapper flex">
          <div class="bg-blue-300/20 p-3 px-4 rounded-xl border border-blue-200/50 flex items-center gap-3">
              <span class="text-[9px] font-bold text-gray-900 uppercase tracking-tighter bg-white px-1.5 py-0.5 rounded border border-gray-100">END</span>
              <h3 class="text-sm font-bold text-gray-900">${endName}</h3>
          </div>
      </div>
  `;
  list.appendChild(endItem);

  if (window.lucide) lucide.createIcons();
}

// =========================
// 상세 모달 로직
// =========================
window.handleCardClick = function (restId) {
  const r = window.restData?.[restId];
  if (r) openRestModal(r);
};

function openRestModal(rest) {
  const restName = formatRestName(rest.name);
  document.getElementById("modal-name").textContent = restName;
  const addrEl = document.getElementById("modal-address");
  
  if (addressCache[rest.id]) addrEl.textContent = addressCache[rest.id];
  else getAddressFromCoords(rest.lat, rest.lng, (addr) => { 
    addressCache[rest.id] = addr; 
    addrEl.textContent = addr; 
  });

  document.getElementById("modal-menu-name").textContent = rest.food || "정보 없음";
  
  setFac("fac-gas", rest.gas);
  setFac("fac-ev", rest.elec);
  setFac("fac-pharmacy", rest.pharmacy);
  setFac("fac-baby", rest.nurse);

  // --- [추가된 부분: 카카오맵 위치보기 버튼 로직] ---
  const kakaoBtn = document.getElementById("modal-kakao");
  kakaoBtn.onclick = () => {
    // 카카오맵 목적지 공유/길찾기 URL (좌표와 장소명 전달)
    const url = `https://map.kakao.com/link/map/${restName},${rest.lat},${rest.lng}`;
    window.open(url, '_blank'); // 새 창에서 열기
  };
  // ------------------------------------------------

  const descEl = document.getElementById("modal-menu-desc");
  descEl.textContent = "정보를 불러오는 중...";
  fetch("/get_info", { 
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify({ name: rest.name }) 
  })
    .then(res => res.json()).then(data => { 
      descEl.innerHTML = data.info ? data.info.replace(/\n/g, "<br>") : "이 휴게소의 인기 메뉴 정보를 제공합니다."; 
    })
    .catch(() => descEl.textContent = "정보를 불러오지 못했습니다.");

  document.getElementById("rest-modal").classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

window.closeRestModal = () => document.getElementById("rest-modal").classList.add("hidden");

// =========================
// 유틸리티 함수
// =========================
function setFac(id, has) {
  const el = document.getElementById(id);
  if (!el) return;

  if (has === "Y") {
    el.className = "flex flex-col items-center justify-center min-h-[90px] py-4 rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 transition-all duration-300 shadow-sm";
    el.style.opacity = "1";
    el.style.filter = "none";
  } else {
    el.className = "flex flex-col items-center justify-center min-h-[90px] py-4 rounded-2xl border border-gray-100 bg-gray-50/50 text-gray-300 transition-all duration-300";
    el.style.opacity = "0.3"; 
    el.style.filter = "grayscale(1)";
  }
}

function getAddressFromCoords(lat, lng, callback) {
  geocoder.coord2Address(lng, lat, (result, status) => {
    if (status === kakao.maps.services.Status.OK) {
      callback(result[0].road_address?.address_name || result[0].address?.address_name || "주소 미상");
    }
  });
}

function formatRestName(name) { return name.endsWith("휴게소") ? name : `${name}휴게소`; }

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateTotalDistance(path) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    total += getDistance(path[i].getLat(), path[i].getLng(), path[i + 1].getLat(), path[i + 1].getLng());
  }
  return total;
}

function estimateTime(totalMeters) {
  const minutes = Math.round((totalMeters / 1000) / 90 * 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}분` : `${h}시간 ${m}분`;
}

function isRestAreaNearRoute(restLat, restLng, routePoints) {
  for (let i = 0; i < routePoints.length - 1; i += 5) {
    if (getDistance(restLat, restLng, routePoints[i].getLat(), routePoints[i].getLng()) <= 1500) return true;
  }
  return false;
}

function getTravelDirection(path) {
  const start = path[0];
  const end = path[path.length - 1];
  return end.getLat() < start.getLat() ? "하행" : "상행";
}

function openSimpleInfo(marker, rest) {
  if (infowindow) infowindow.close();
  infowindow = new kakao.maps.InfoWindow({ 
    content: `<div class="p-2 text-xs font-bold">${formatRestName(rest.name)}</div>`, 
    removable: true 
  });
  infowindow.open(map, marker);
}