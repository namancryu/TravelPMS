/**
 * External APIs Integration Layer
 * 하이브리드 모드: 완전 무료 API 우선 (OpenTripMap 메인)
 */

/**
 * OpenTripMap API - 메인 여행지 정보 (완전 무료!)
 * - 1000만+ 관광 명소 데이터
 * - 신용카드 불필요, 무제한 사용
 * - API 키: https://dev.opentripmap.org/product
 */

/**
 * 도시 이름으로 좌표 검색 (OpenTripMap Geocoding)
 */
async function getCityCoordinates(cityName, countryName) {
  if (!process.env.OPENTRIPMAP_API_KEY) {
    console.warn('⚠️ OPENTRIPMAP_API_KEY 미설정');
    return null;
  }

  try {
    const query = `${cityName}, ${countryName}`;
    const url = `https://api.opentripmap.com/0.1/en/places/geoname?name=${encodeURIComponent(query)}&apikey=${process.env.OPENTRIPMAP_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data && data.lat && data.lon) {
      return {
        latitude: data.lat,
        longitude: data.lon,
        name: data.name,
        country: data.country
      };
    }
  } catch (err) {
    console.warn('OpenTripMap Geocoding error:', err.message);
  }

  return null;
}

/**
 * 좌표 기반 주변 관광지 검색 (OpenTripMap)
 */
async function getPointsOfInterest(lat, lon, radius = 5000, limit = 20) {
  if (!process.env.OPENTRIPMAP_API_KEY) {
    console.warn('⚠️ OPENTRIPMAP_API_KEY 미설정');
    return null;
  }

  try {
    const url = `https://api.opentripmap.com/0.1/en/places/radius?radius=${radius}&lon=${lon}&lat=${lat}&limit=${limit}&apikey=${process.env.OPENTRIPMAP_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data && Array.isArray(data)) {
      // 상세 정보 포함
      const detailedPOIs = await Promise.all(
        data.slice(0, 10).map(async (poi) => {
          const details = await getPOIDetails(poi.xid);
          return {
            xid: poi.xid,
            name: poi.name,
            kinds: poi.kinds,
            distance: Math.round(poi.dist),
            ...details
          };
        })
      );

      return detailedPOIs.filter(poi => poi.name); // 이름 있는 것만
    }
  } catch (err) {
    console.warn('OpenTripMap POI error:', err.message);
  }

  return null;
}

/**
 * 관광지 상세 정보 (OpenTripMap)
 */
async function getPOIDetails(xid) {
  if (!process.env.OPENTRIPMAP_API_KEY || !xid) {
    return {};
  }

  try {
    const url = `https://api.opentripmap.com/0.1/en/places/xid/${xid}?apikey=${process.env.OPENTRIPMAP_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    return {
      description: data.wikipedia_extracts?.text || data.info?.descr || '',
      image: data.preview?.source || data.image || null,
      wikipedia: data.wikipedia || null,
      rating: data.rate || 0,
      kinds: data.kinds || ''
    };
  } catch (err) {
    console.warn('OpenTripMap Details error:', err.message);
    return {};
  }
}

/**
 * Google Places API - 보조 (선택사항, 유료)
 * 2025년 3월부터: 월 10,000건 무료, 초과 시 $17/만 건
 */
async function getPlaceDetails(placeName, country) {
  // 환경변수에 Google Places API 키가 있으면 호출
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return null; // API 키 없으면 스킵
  }

  try {
    const searchQuery = `${placeName}, ${country}`;
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id,name,rating,user_ratings_total,photos&key=${process.env.GOOGLE_PLACES_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
      const place = data.candidates[0];
      return {
        placeId: place.place_id,
        rating: place.rating,
        totalReviews: place.user_ratings_total,
        photos: place.photos?.map(p => ({
          reference: p.photo_reference,
          width: p.width,
          height: p.height
        }))
      };
    }
  } catch (err) {
    console.warn('Google Places API error:', err.message);
  }

  return null;
}

/**
 * 통합 조회 함수: 로컬 DB + 외부 API 보강
 * @param {Object} localDestination - 로컬 DB에서 가져온 목적지 데이터
 * @param {Object} options - { includePOI: true, includePlaces: false }
 */
async function enrichDestinationData(localDestination, options = {}) {
  const enriched = { ...localDestination, externalData: {} };

  // 1순위: OpenTripMap POI (완전 무료!)
  if (options.includePOI !== false) { // 기본값: true
    try {
      // 도시 좌표 가져오기 (DB에 없을 경우)
      let lat = localDestination.latitude;
      let lon = localDestination.longitude;

      if (!lat || !lon) {
        const coords = await getCityCoordinates(localDestination.name, localDestination.country);
        if (coords) {
          lat = coords.latitude;
          lon = coords.longitude;
          enriched.coordinates = coords;
        }
      }

      // 주변 관광지 가져오기
      if (lat && lon) {
        const poi = await getPointsOfInterest(lat, lon, 10000, 20);
        if (poi && poi.length > 0) {
          enriched.externalData.attractions = poi;
          enriched.attractionsCount = poi.length;
        }
      }
    } catch (err) {
      console.warn('OpenTripMap enrichment error:', err.message);
    }
  }

  // 2순위: Google Places 정보 추가 (선택사항)
  if (options.includePlaces) {
    const placesData = await getPlaceDetails(localDestination.name, localDestination.country);
    if (placesData) {
      enriched.externalData.googlePlaces = placesData;
      // 평점 업데이트 (외부 데이터 우선)
      enriched.liveRating = placesData.rating;
      enriched.liveTotalReviews = placesData.totalReviews;
    }
  }

  return enriched;
}

module.exports = {
  // OpenTripMap (메인)
  getCityCoordinates,
  getPointsOfInterest,
  getPOIDetails,

  // Google Places (보조)
  getPlaceDetails,

  // 통합 함수
  enrichDestinationData
};
