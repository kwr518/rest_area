// =========================
// 지도 상태
// =========================
console.log("main.js 로딩됨");

let map;
let polyline;
let markers = [];
let lastRests = [];

// =========================
// 필터 상태
// =========================
const filters = {
  onlyBestFood: false,
  hasEV: false,
  hasGas: false,
};

window.onload = function () {
  map = new kakao.maps.Map(document.getElementById("map"), {
    center: new kakao.maps.LatLng(37.5665, 126.9780),
    level: 8,
  });

  addInputListeners();
  wireFilterButtons();
};

// =========================
// 필터 버튼
// =========================
function wireFilterButtons() {
  const bestBtn = document.getElementById("filter-best");
  const evBtn = document.getElementById("filter-ev");
  const gasBtn = document.getElementById("filter-gas");

  bestBtn.onclick = () => {
    filters.onlyBestFood = !filters.onlyBestFood;
    bestBtn.classList.toggle("active-best", filters.onlyBestFood);
    if (polyline) drawRestAreas(lastRests);
  };

  evBtn.onclick = () => {
    filters.hasEV = !filters.hasEV;
    evBtn.classList.toggle("active-ev", filters.hasEV);
    if (polyline) drawRestAreas(lastRests);
  };

  gasBtn.onclick = () => {
    filters.hasGas = !filters.hasGas;
    gasBtn.classList.toggle("active-gas", filters.hasGas);
    if (polyline) drawRestAreas(lastRests);
  };
}

// =========================
// 자동완성
// =========================
function addInputListeners() {
  document.getElementById("start").addEventListener("input", () => autoComplete("start"));
  document.getElementById("end").addEventListener("input", () => autoComplete("end"));
}

function autoComplete(type) {
  const keyword = document.getElementById(type).value;
  const box = document.getElementById("autocomplete");

  if (!keyword) {
    box.style.display = "none";
    return;
  }

  const ps = new kakao.maps.services.Places();
  ps.keywordSearch(keyword, (data, status) => {
    if (status !== kakao.maps.services.Status.OK) return;

    box.innerHTML = "";
    box.style.display = "block";

    data.forEach(place => {
      const item = document.createElement("div");
      item.className = "autocomplete-item";
      item.innerHTML = `
        <b>${place.place_name}</b><br>
        <small>${place.road_address_name || place.address_name}</small>
      `;

      item.onclick = () => {
        document.getElementById(type).value = place.road_address_name || place.address_name;
        box.style.display = "none";

        const loc = new kakao.maps.LatLng(place.y, place.x);
        map.setCenter(loc);
      };

      box.appendChild(item);
    });
  });
}

function clearInputs() {
  document.getElementById("start").value = "";
  document.getElementById("end").value = "";
  document.getElementById("autocomplete").style.display = "none";
}

// =========================
// 길찾기 요청
// =========================
function requestRoute() {
  const start = document.getElementById("start").value.trim();
  const end = document.getElementById("end").value.trim();

  if (!start || !end) {
    alert("출발지/도착지를 입력하세요.");
    return;
  }

  fetch("/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start, end }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      drawRoute(data);
    })
    .catch(err => alert("오류: " + err.message));
}
// 거리 계산 함수 (Haversine)
function getDistance(lat1, lng1, lat2, lng2) {
  function toRad(v) { return v * Math.PI / 180; }

  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ✅ 경로 전체 거리 계산 (meters)
function calculateTotalDistance(path) {
  let total = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];

    total += getDistance(
      p1.getLat(), p1.getLng(),
      p2.getLat(), p2.getLng()
    );
  }

  return total;
}

// ✅ 소요시간 추정
function estimateTime(totalMeters) {
  const avgSpeedKmh = 80;
  const totalMinutes = Math.round((totalMeters / 1000) / avgSpeedKmh * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m}분` : `${h}시간 ${m}분`;
}

// =========================
// 경로 그리기
// =========================
// console.log("draw 호출");

function drawRoute(data) {
  console.log("drawRoute 호출됨");

  if (!data.route || data.route.length === 0) {
    console.error("route 데이터 없음", data);
    return;
  }

  // ✅ path는 여기서만 사용
  const path = data.route.map(p => new kakao.maps.LatLng(p[1], p[0]));
  console.log("path length:", path.length);

  if (polyline) polyline.setMap(null);

  polyline = new kakao.maps.Polyline({
    path,
    strokeWeight: 5,
    strokeColor: "#ff0000",
    strokeOpacity: 0.8,
  });
  polyline.setMap(map);

  // 지도 범위
  const bounds = new kakao.maps.LatLngBounds();
  path.forEach(p => bounds.extend(p));
  map.setBounds(bounds);

  // 휴게소
  lastRests = data.rests || [];
  drawRestAreas(lastRests);

  // ✅ 거리 계산도 반드시 여기서
  const totalMeters = calculateTotalDistance(path);
  console.log("totalMeters:", totalMeters);

  if (!isFinite(totalMeters)) {
    console.error("거리 계산 실패");
    return;
  }

  // UI 표시
  const metaBox = document.getElementById("route-meta");
  const distEl = document.getElementById("meta-distance");
  const timeEl = document.getElementById("meta-time");

  metaBox.classList.remove("hidden");
  distEl.textContent = `${(totalMeters / 1000).toFixed(1)} km`;
  timeEl.textContent = estimateTime(totalMeters);
}



// =========================
// 거리 계산(Haversine)
// =========================
function getDistance(lat1, lng1, lat2, lng2) {
  function toRad(v) { return v * Math.PI / 180; }
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 휴게소가 경로 근처인지(1km)
function isRestAreaNearRoute(restLat, restLng, routePoints, thresholdMeters = 1000) {
  for (let i = 0; i < routePoints.length - 1; i++) {
    const p1 = routePoints[i];
    const p2 = routePoints[i + 1];

    const d1 = getDistance(restLat, restLng, p1.getLat(), p1.getLng());
    const d2 = getDistance(restLat, restLng, p2.getLat(), p2.getLng());

    if (Math.min(d1, d2) <= thresholdMeters) return true;
  }
  return false;
}

// 전체 이동 방향 판단 (위도 기준)
function getTravelDirection(path) {
  const start = path[0];
  const end = path[path.length - 1];

  // 남쪽으로 내려가면 하행
  if (end.getLat() < start.getLat()) {
    return "하행";
  } else {
    return "상행";
  }
}

// =========================
// 휴게소 렌더링 (경로 주변 + 정렬 + 중복 제거 + 필터)
// =========================
function drawRestAreas(rests) {
  const list = document.getElementById("rest-list");
  list.innerHTML = "";

  // 기존 마커 제거
  markers.forEach(m => m.setMap(null));
  markers = [];

  if (!polyline) return;

  const path = polyline.getPath();
  const travelDirection = getTravelDirection(path);
  const startPoint = path[0];

  let filtered = [];

  rests.forEach(r => {
    // 1️⃣ 경로 근처
    if (!isRestAreaNearRoute(r.lat, r.lng, path)) return;

    // 2️⃣ 방향 필터
    if (r.direction === "상행" && travelDirection === "하행") return;
    if (r.direction === "하행" && travelDirection === "상행") return;

    filtered.push(r);
  });

  // 3️⃣ 출발지 기준 정렬
  filtered.sort((a, b) => {
    const da = getDistance(
      startPoint.getLat(),
      startPoint.getLng(),
      a.lat,
      a.lng
    );
    const db = getDistance(
      startPoint.getLat(),
      startPoint.getLng(),
      b.lat,
      b.lng
    );
    return da - db;
  });

  // 4️⃣ 카드 + ⭐ 마커 동시에 생성
  filtered.forEach(r => {
    const loc = new kakao.maps.LatLng(r.lat, r.lng);

    // ⭐ 마커를 먼저 생성해서 지도에 표시
    const marker = new kakao.maps.Marker({
      position: loc,
      map: map
    });
    markers.push(marker);

    // 카드 생성
    const card = document.createElement("div");
    card.className = "rest-card";

    const node = document.createElement("div");
    node.className = "node" + (r.food && r.food.includes("전기") ? " ev" : "");
    card.appendChild(node);

    card.innerHTML += `
      <span class="badge">${r.route_no} (${r.direction})</span>
      <div class="rest-name">${r.name}</div>
      <div class="rest-sub">${r.food || "대표 메뉴 정보 없음"}</div>
      <div class="best">
        <div>
          <span class="tag">BEST</span>
          <span style="font-weight:800">${r.food || "-"}</span>
        </div>
        <div style="color:#9ca3af;font-weight:900">→</div>
      </div>
    `;

    // 카드 클릭 → 해당 휴게소로 포커싱만
    //card.onclick = () => {
    //  map.setCenter(loc);
    //  map.setLevel(6);
    //};
    card.onclick = () => {
  console.log("휴게소 카드 클릭됨", r);
  openRestModal(r);
};

    list.appendChild(card);
  });
}

// 휴게소 카드 네이버 플레이스
function openRestModal(rest) {
  document.getElementById("modal-highway").textContent = rest.route_no;
  document.getElementById("modal-name").textContent = rest.name;
  document.getElementById("modal-rating").textContent = rest.rating || "-";

  document.getElementById("modal-menu-name").textContent = rest.food || "대표 메뉴 정보 없음";
  document.getElementById("modal-menu-price").textContent = rest.price || "";
  document.getElementById("modal-menu-desc").textContent = rest.desc || "";

  setFacility("fac-gas", rest.has_gas);
  setFacility("fac-ev", rest.has_ev);
  setFacility("fac-pharmacy", rest.has_pharmacy);
  setFacility("fac-baby", rest.has_baby);

  document.getElementById("modal-naver").onclick = () => {
    const q = encodeURIComponent(`${rest.name} (${rest.direction})`);
    window.open(`https://map.naver.com/p/search/${q}`, "_blank");
  };

  document.getElementById("rest-modal").classList.remove("hidden");
}

function closeRestModal() {
  document.getElementById("rest-modal").classList.add("hidden");
}

function setFacility(id, has) {
  const el = document.getElementById(id);
  el.classList.toggle("disabled", !has);
}
