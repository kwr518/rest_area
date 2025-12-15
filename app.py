import sqlite3
import requests
from flask import Flask, render_template, request, jsonify
### 깃헙수정본
app = Flask(__name__)
##1231231
# -----------------------------------
# 🔑 카카오 REST API 키
# -----------------------------------
REST_API_KEY = "d0a9f936e8aedab41f9a85db96767447"

##12
# -----------------------------------
# 📌 주소 → 좌표 변환
# -----------------------------------
def geocode(address):
    headers = {"Authorization": f"KakaoAK {REST_API_KEY}"}

    # 1) 주소 검색 시도
    url_addr = "https://dapi.kakao.com/v2/local/search/address.json"
    res = requests.get(url_addr, headers=headers, params={"query": address})
    data = res.json()

    if "documents" in data and len(data["documents"]) > 0:
        doc = data["documents"][0]
        return float(doc["x"]), float(doc["y"])

    # 2) 주소 검색 실패 → 키워드 검색 시도
    url_keyword = "https://dapi.kakao.com/v2/local/search/keyword.json"
    res = requests.get(url_keyword, headers=headers, params={"query": address})
    data = res.json()

    if "documents" in data and len(data["documents"]) > 0:
        doc = data["documents"][0]
        return float(doc["x"]), float(doc["y"])

    # 3) 둘 다 실패 → 에러
    raise ValueError("주소 또는 장소 검색 실패: " + address)



# -----------------------------------
# 🚗 카카오 길찾기 API — vertex서 처리 오류 수정
# -----------------------------------
def get_route(origin, dest):
    url = "https://apis-navi.kakaomobility.com/v1/directions"
    headers = {"Authorization": f"KakaoAK {REST_API_KEY}"}

    params = {
        "origin": f"{origin[0]},{origin[1]}",
        "destination": f"{dest[0]},{dest[1]}",
        "priority": "RECOMMEND"
    }

    res = requests.get(url, headers=headers, params=params).json()

    roads = res["routes"][0]["sections"][0]["roads"]

    coords = []

    # vertexes = [x1, y1, x2, y2, ...]
    for road in roads:
        v = road["vertexes"]
        for i in range(0, len(v), 2):
            coords.append((v[i], v[i + 1]))

    return coords


# -----------------------------------
# 🛣 DB에서 전체 휴게소 로드
# -----------------------------------
def load_rest_areas():
    conn = sqlite3.connect("rest_areas.db")
    cur = conn.cursor()

    # DB 테이블 구조에 정확히 맞춰야 함
    cur.execute("""
        SELECT name, route_no, direction, latitude, longitude, signature_food
        FROM rest_areas
    """)

    rows = cur.fetchall()
    conn.close()

    rests = []
    for row in rows:
        rests.append({
            "name": row[0],
            "route_no": row[1],
            "direction": row[2],
            "lat": row[3],
            "lng": row[4],
            "food": row[5]
        })

    return rests


# -----------------------------------
# 🌐 메인 페이지
# -----------------------------------
@app.route("/")
def index():
    return render_template("index.html")


# -----------------------------------
# 📡 프론트 요청에 대한 경로 + 휴게소 응답
# -----------------------------------
@app.route("/route", methods=["POST"])
def route():
    data = request.json
    start = data["start"]
    end = data["end"]

    # 1) 주소 좌표 변환
    start_xy = geocode(start)
    end_xy = geocode(end)

    # 2) 경로 가져오기
    route_points = get_route(start_xy, end_xy)

    # 3) 전체 휴게소 가져오기 (⚠️ 방향 필터 제거 → 프론트에서 거리 기반 필터링)
    rests = load_rest_areas()

    return jsonify({
        "route": route_points,
        "rests": rests
    })


# -----------------------------------
# 🔥 Flask 서버 실행
# -----------------------------------
if __name__ == "__main__":
    app.run(debug=True)
