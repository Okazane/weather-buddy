import { PRESET_CITIES } from './coreLoader.mjs';

const GEOCODE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const AUTO_LOCATE_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_GEOCODE_CACHE_SIZE = 200;

const ASCII_VI_CITY_MAP = [
  [/^ho chi minh(?: city)?$/i, 'TP. Hồ Chí Minh'],
  [/^thanh pho ho chi minh$/i, 'TP. Hồ Chí Minh'],
  [/^saigon$/i, 'TP. Hồ Chí Minh'],
  [/^ha noi$|^hanoi$/i, 'Hà Nội'],
  [/^da nang$|^danang$/i, 'Đà Nẵng'],
  [/^da lat$|^dalat$/i, 'Đà Lạt'],
  [/^can tho$|^cantho$/i, 'Cần Thơ'],
  [/^hai phong$|^haiphong$/i, 'Hải Phòng'],
  [/^nha trang$/i, 'Nha Trang'],
  [/^binh duong$/i, 'Bình Dương'],
  [/^dong nai$/i, 'Đồng Nai'],
  [/^ba ria\s*-?\s*vung tau$|^vung tau$/i, 'Vũng Tàu'],
  [/^hue$|^thua thien hue$/i, 'Huế'],
];

export function cleanVietnamesePlaceToken(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return '';
  }
  const cleaned = raw
    .trim()
    .replace(/^Thành phố\s+/i, 'TP. ')
    .replace(/^Tỉnh\s+/i, '')
    .replace(/\s+/g, ' ');

  for (const [pattern, viName] of ASCII_VI_CITY_MAP) {
    if (pattern.test(cleaned)) {
      return viName;
    }
  }
  return cleaned;
}

function composeVietnameseLocationName(district, city) {
  if (
    district &&
    city &&
    district.toLowerCase() !== city.toLowerCase() &&
    !city.toLowerCase().includes(district.toLowerCase()) &&
    !district.toLowerCase().includes(city.toLowerCase())
  ) {
    return `${district}, ${city}`;
  }
  if (city) return city;
  if (district) return district;
  return '';
}

function findNearestPresetCity(lat, lon) {
  let best = null;
  let bestDistSq = Infinity;
  for (const city of PRESET_CITIES) {
    const dLat = lat - city.latitude;
    const dLon = lon - city.longitude;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = city;
    }
  }
  // Within ~0.25 degrees (~27 km)
  if (best && bestDistSq <= 0.25 * 0.25) {
    return best;
  }
  return null;
}

async function fetchJsonWithTimeout(url, options = {}, fetchImpl = fetch, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      ...options,
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function createReverseGeocoder({ fetchImpl = fetch } = {}) {
  const cache = new Map();
  const inFlight = new Map();

  function pruneCache() {
    const now = Date.now();
    for (const [k, entry] of cache.entries()) {
      if (entry.expiresAtMs <= now) {
        cache.delete(k);
      }
    }
    while (cache.size > MAX_GEOCODE_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
  }

  return async function reverseGeocode(latitude, longitude, { cityOnly = false } = {}) {
    const lat = Number(latitude.toFixed(5));
    const lon = Number(longitude.toFixed(5));
    const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}:${cityOnly ? 'city' : 'full'}`;

    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAtMs > now) {
      cache.delete(cacheKey);
      cache.set(cacheKey, cached);
      return {
        ...cached.value,
        latitude: lat,
        longitude: lon,
        cacheHit: true,
      };
    }

    let pending = inFlight.get(cacheKey);
    if (!pending) {
      pending = (async () => {
        // 1. Primary lookup: BigDataCloud Vietnamese reverse geocoding
        const bdcUrl =
          `https://api.bigdatacloud.net/data/reverse-geocode-client` +
          `?latitude=${encodeURIComponent(String(lat))}` +
          `&longitude=${encodeURIComponent(String(lon))}` +
          `&localityLanguage=vi`;

        const bdcData = await fetchJsonWithTimeout(
          bdcUrl,
          { headers: { Accept: 'application/json', 'User-Agent': 'WeatherBuddy/3.0' } },
          fetchImpl,
          3800
        );

        let district = '';
        let city = '';
        let country = '';

        if (bdcData && typeof bdcData === 'object') {
          district = cleanVietnamesePlaceToken(bdcData.locality);
          city = cleanVietnamesePlaceToken(bdcData.city || bdcData.principalSubdivision);
          country = String(bdcData.countryName || '').trim();
        }

        // 2. Fallback lookup: OpenStreetMap Nominatim with required User-Agent
        if (!district && !city) {
          const nominatimUrl =
            `https://nominatim.openstreetmap.org/reverse` +
            `?format=jsonv2&lat=${encodeURIComponent(String(lat))}` +
            `&lon=${encodeURIComponent(String(lon))}` +
            `&accept-language=vi`;

          const nomData = await fetchJsonWithTimeout(
            nominatimUrl,
            {
              headers: {
                Accept: 'application/json',
                'Accept-Language': 'vi',
                'User-Agent': 'WeatherBuddy/3.0',
              },
            },
            fetchImpl,
            4200
          );

          if (nomData && typeof nomData === 'object' && nomData.address) {
            const addr = nomData.address;
            district = cleanVietnamesePlaceToken(
              addr.city_district ||
                addr.district ||
                addr.county ||
                addr.suburb ||
                addr.town ||
                addr.village ||
                ''
            );
            city = cleanVietnamesePlaceToken(addr.city || addr.state || addr.province || '');
            country = String(addr.country || country || '').trim();
          }
        }

        let locationName = cityOnly
          ? city || district
          : composeVietnameseLocationName(district, city);

        // 3. Offline / fallback to nearest Vietnamese preset city or default label
        if (!locationName) {
          const nearest = findNearestPresetCity(lat, lon);
          if (nearest) {
            city = nearest.nameVi;
            locationName = nearest.nameVi;
            country = country || 'Việt Nam';
          } else {
            locationName = 'Vị trí hiện tại';
            country = country || 'Việt Nam';
          }
        }

        const resolved = {
          locationName,
          district: cityOnly ? '' : district || '',
          city: city || locationName,
          country: country || 'Việt Nam',
          latitude: lat,
          longitude: lon,
        };

        pruneCache();
        cache.delete(cacheKey);
        cache.set(cacheKey, {
          value: resolved,
          expiresAtMs: Date.now() + GEOCODE_CACHE_TTL_MS,
        });

        return resolved;
      })();
      inFlight.set(cacheKey, pending);
    }

    try {
      const result = await pending;
      return {
        ...result,
        latitude: lat,
        longitude: lon,
        cacheHit: false,
      };
    } finally {
      if (inFlight.get(cacheKey) === pending) {
        inFlight.delete(cacheKey);
      }
    }
  };
}

/**
 * Zero-key network IP auto-locator for desktop PCs & embedded WebViews where hardware/browser
 * `navigator.geolocation` is unavailable or denied.
 * Cascades through:
 *   1. ipwho.is (fast city-center coordinates + ISP region)
 *   2. BigDataCloud client-IP reverse geocode (`localityLanguage=vi`)
 *   3. GeoJS (`get.geojs.io/v1/ip/geo.json`)
 * Then normalizes the resolved Vietnamese city name cleanly.
 */
export function createAutoLocator({ fetchImpl = fetch, reverseGeocode } = {}) {
  let cachedEntry = null;
  let inFlightLocate = null;

  return async function autoLocate({ force = false } = {}) {
    const now = Date.now();
    if (!force && cachedEntry && cachedEntry.expiresAtMs > now) {
      return {
        ...cachedEntry.value,
        cacheHit: true,
      };
    }

    if (!force && inFlightLocate) {
      const shared = await inFlightLocate;
      return {
        ...shared,
        cacheHit: false,
      };
    }

    const locatePromise = (async () => {

    let lat = null;
    let lon = null;
    let rawCity = '';
    let rawCountry = '';
    let providerUsed = '';

    // 1. Primary IP geolocation: ipwho.is (returns accurate city center coords)
    const ipwho = await fetchJsonWithTimeout(
      'https://ipwho.is/?lang=vi',
      { headers: { Accept: 'application/json', 'User-Agent': 'WeatherBuddy/3.0' } },
      fetchImpl,
      3200
    );
    if (
      ipwho &&
      ipwho.success !== false &&
      typeof ipwho.latitude === 'number' &&
      typeof ipwho.longitude === 'number' &&
      Number.isFinite(ipwho.latitude) &&
      Number.isFinite(ipwho.longitude)
    ) {
      lat = Number(ipwho.latitude.toFixed(5));
      lon = Number(ipwho.longitude.toFixed(5));
      rawCity = cleanVietnamesePlaceToken(ipwho.city || ipwho.region || '');
      rawCountry = String(ipwho.country || 'Việt Nam').trim();
      providerUsed = 'ipwho.is';
    }

    // 2. Fallback IP geolocation: BigDataCloud client-IP mode (zero-key, Vietnamese)
    if (lat === null || lon === null) {
      const bdc = await fetchJsonWithTimeout(
        'https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=vi',
        { headers: { Accept: 'application/json', 'User-Agent': 'WeatherBuddy/3.0' } },
        fetchImpl,
        3500
      );
      if (
        bdc &&
        typeof bdc.latitude === 'number' &&
        typeof bdc.longitude === 'number' &&
        Number.isFinite(bdc.latitude) &&
        Number.isFinite(bdc.longitude)
      ) {
        lat = Number(bdc.latitude.toFixed(5));
        lon = Number(bdc.longitude.toFixed(5));
        rawCity = cleanVietnamesePlaceToken(
          bdc.city || bdc.principalSubdivision || bdc.locality || ''
        );
        rawCountry = String(bdc.countryName || 'Việt Nam').trim();
        providerUsed = 'bigdatacloud';
      }
    }

    // 3. Tertiary IP geolocation: GeoJS
    if (lat === null || lon === null) {
      const geojs = await fetchJsonWithTimeout(
        'https://get.geojs.io/v1/ip/geo.json',
        { headers: { Accept: 'application/json', 'User-Agent': 'WeatherBuddy/3.0' } },
        fetchImpl,
        3200
      );
      if (geojs) {
        const parsedLat = Number(geojs.latitude);
        const parsedLon = Number(geojs.longitude);
        if (Number.isFinite(parsedLat) && Number.isFinite(parsedLon)) {
          lat = Number(parsedLat.toFixed(5));
          lon = Number(parsedLon.toFixed(5));
          rawCity = cleanVietnamesePlaceToken(geojs.city || geojs.region || '');
          rawCountry = String(geojs.country || 'Việt Nam').trim();
          providerUsed = 'geojs';
        }
      }
    }

    if (lat === null || lon === null) {
      const err = new Error('Không thể tự động xác định vị trí qua mạng lúc này.');
      err.statusCode = 503;
      throw err;
    }

    // Enrich Vietnamese city label via reverseGeocode (cityOnly=true so IP router ward isn't over-specified)
    let locationName = rawCity;
    if ((!locationName || /^[A-Za-z\s.-]+$/.test(locationName)) && typeof reverseGeocode === 'function') {
      const rev = await reverseGeocode(lat, lon, { cityOnly: true });
      if (rev && rev.locationName) {
        locationName = rev.locationName;
      }
    }
    if (!locationName) {
      const nearest = findNearestPresetCity(lat, lon);
      locationName = nearest ? nearest.nameVi : 'Vị trí hiện tại';
    }

    const payload = {
      status: 'ok',
      source: 'ip',
      provider: providerUsed,
      latitude: lat,
      longitude: lon,
      locationName,
      city: locationName,
      country: rawCountry || 'Việt Nam',
    };

    cachedEntry = {
      value: payload,
      expiresAtMs: Date.now() + AUTO_LOCATE_CACHE_TTL_MS,
    };

    return payload;
    })();

    if (!force) {
      inFlightLocate = locatePromise;
    }

    try {
      const resolvedPayload = await locatePromise;
      return {
        ...resolvedPayload,
        cacheHit: false,
      };
    } finally {
      if (inFlightLocate === locatePromise) {
        inFlightLocate = null;
      }
    }
  };
}

function foldVietnameseSearch(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const VIETNAM_DIRECTORY = [
  ...PRESET_CITIES.map((c) => ({
    id: c.id,
    nameVi: c.nameVi,
    regionVi: c.regionVi,
    countryVi: 'Việt Nam',
    latitude: c.latitude,
    longitude: c.longitude,
  })),
  { id: 'hai_phong', nameVi: 'Hải Phòng', regionVi: 'Miền Bắc', countryVi: 'Việt Nam', latitude: 20.8449, longitude: 106.6881 },
  { id: 'ha_long', nameVi: 'Hạ Long, Quảng Ninh', regionVi: 'Miền Bắc', countryVi: 'Việt Nam', latitude: 20.9511, longitude: 107.0748 },
  { id: 'ninh_binh', nameVi: 'Ninh Bình', regionVi: 'Miền Bắc', countryVi: 'Việt Nam', latitude: 20.2506, longitude: 105.9745 },
  { id: 'ha_giang', nameVi: 'Hà Giang', regionVi: 'Miền Bắc', countryVi: 'Việt Nam', latitude: 22.8233, longitude: 104.9836 },
  { id: 'moc_chau', nameVi: 'Mộc Châu, Sơn La', regionVi: 'Miền Bắc', countryVi: 'Việt Nam', latitude: 20.8444, longitude: 104.6392 },
  { id: 'tam_dao', nameVi: 'Tam Đảo, Vĩnh Phúc', regionVi: 'Miền Bắc', countryVi: 'Việt Nam', latitude: 21.4567, longitude: 105.6442 },
  { id: 'bac_ninh', nameVi: 'Bắc Ninh', regionVi: 'Miền Bắc', countryVi: 'Việt Nam', latitude: 21.1861, longitude: 106.0763 },
  { id: 'hai_duong', nameVi: 'Hải Dương', regionVi: 'Miền Bắc', countryVi: 'Việt Nam', latitude: 20.9373, longitude: 106.3146 },
  { id: 'nam_dinh', nameVi: 'Nam Định', regionVi: 'Miền Bắc', countryVi: 'Việt Nam', latitude: 20.4388, longitude: 106.1621 },
  { id: 'thai_nguyen', nameVi: 'Thái Nguyên', regionVi: 'Miền Bắc', countryVi: 'Việt Nam', latitude: 21.5942, longitude: 105.8482 },
  { id: 'thanh_hoa', nameVi: 'Thanh Hóa', regionVi: 'Bắc Trung Bộ', countryVi: 'Việt Nam', latitude: 19.8067, longitude: 105.7852 },
  { id: 'vinh', nameVi: 'Vinh, Nghệ An', regionVi: 'Bắc Trung Bộ', countryVi: 'Việt Nam', latitude: 18.6796, longitude: 105.6813 },
  { id: 'dong_hoi', nameVi: 'Đồng Hới, Quảng Bình', regionVi: 'Bắc Trung Bộ', countryVi: 'Việt Nam', latitude: 17.4689, longitude: 106.6223 },
  { id: 'hue', nameVi: 'Huế', regionVi: 'Miền Trung', countryVi: 'Việt Nam', latitude: 16.4637, longitude: 107.5909 },
  { id: 'hoi_an', nameVi: 'Hội An, Quảng Nam', regionVi: 'Miền Trung', countryVi: 'Việt Nam', latitude: 15.8801, longitude: 108.338 },
  { id: 'quang_ngai', nameVi: 'Quảng Ngãi', regionVi: 'Miền Trung', countryVi: 'Việt Nam', latitude: 15.1214, longitude: 108.8044 },
  { id: 'quy_nhon', nameVi: 'Quy Nhơn, Bình Định', regionVi: 'Duyên hải Nam Trung Bộ', countryVi: 'Việt Nam', latitude: 13.783, longitude: 109.2197 },
  { id: 'tuy_hoa', nameVi: 'Tuy Hòa, Phú Yên', regionVi: 'Duyên hải Nam Trung Bộ', countryVi: 'Việt Nam', latitude: 13.0955, longitude: 109.3209 },
  { id: 'nha_trang', nameVi: 'Nha Trang, Khánh Hòa', regionVi: 'Duyên hải Nam Trung Bộ', countryVi: 'Việt Nam', latitude: 12.2388, longitude: 109.1967 },
  { id: 'phan_thiet', nameVi: 'Phan Thiết, Bình Thuận', regionVi: 'Duyên hải Nam Trung Bộ', countryVi: 'Việt Nam', latitude: 10.9289, longitude: 108.1021 },
  { id: 'pleiku', nameVi: 'Pleiku, Gia Lai', regionVi: 'Tây Nguyên', countryVi: 'Việt Nam', latitude: 13.9833, longitude: 108.0 },
  { id: 'buon_ma_thuot', nameVi: 'Buôn Ma Thuột, Đắk Lắk', regionVi: 'Tây Nguyên', countryVi: 'Việt Nam', latitude: 12.6667, longitude: 108.05 },
  { id: 'mang_den', nameVi: 'Măng Đen, Kon Tum', regionVi: 'Tây Nguyên', countryVi: 'Việt Nam', latitude: 14.5978, longitude: 108.2914 },
  { id: 'bien_hoa', nameVi: 'Biên Hòa, Đồng Nai', regionVi: 'Đông Nam Bộ', countryVi: 'Việt Nam', latitude: 10.9574, longitude: 106.8427 },
  { id: 'thu_dau_mot', nameVi: 'Thủ Dầu Một, Bình Dương', regionVi: 'Đông Nam Bộ', countryVi: 'Việt Nam', latitude: 10.9804, longitude: 106.6519 },
  { id: 'vung_tau', nameVi: 'Vũng Tàu', regionVi: 'Đông Nam Bộ', countryVi: 'Việt Nam', latitude: 10.346, longitude: 107.0843 },
  { id: 'tay_ninh', nameVi: 'Tây Ninh', regionVi: 'Đông Nam Bộ', countryVi: 'Việt Nam', latitude: 11.3100, longitude: 106.0983 },
  { id: 'my_tho', nameVi: 'Mỹ Tho, Tiền Giang', regionVi: 'Miền Tây', countryVi: 'Việt Nam', latitude: 10.3600, longitude: 106.3600 },
  { id: 'ben_tre', nameVi: 'Bến Tre', regionVi: 'Miền Tây', countryVi: 'Việt Nam', latitude: 10.2434, longitude: 106.3756 },
  { id: 'long_xuyen', nameVi: 'Long Xuyên, An Giang', regionVi: 'Miền Tây', countryVi: 'Việt Nam', latitude: 10.3864, longitude: 105.4352 },
  { id: 'rach_gia', nameVi: 'Rạch Giá, Kiên Giang', regionVi: 'Miền Tây', countryVi: 'Việt Nam', latitude: 10.0125, longitude: 105.0809 },
  { id: 'phu_quoc', nameVi: 'Phú Quốc', regionVi: 'Đảo Ngọc · Kiên Giang', countryVi: 'Việt Nam', latitude: 10.227, longitude: 103.9632 },
  { id: 'con_dao', nameVi: 'Côn Đảo', regionVi: 'Bà Rịa – Vũng Tàu', countryVi: 'Việt Nam', latitude: 8.6833, longitude: 106.6094 },
  { id: 'ca_mau', nameVi: 'Cà Mau', regionVi: 'Miền Tây', countryVi: 'Việt Nam', latitude: 9.1769, longitude: 105.1524 },
];

export function createPlaceSearcher({ fetchImpl = fetch } = {}) {
  const searchCache = new Map();

  function pruneSearchCache() {
    const now = Date.now();
    for (const [k, entry] of searchCache.entries()) {
      if (entry.expiresAtMs <= now) {
        searchCache.delete(k);
      }
    }
    while (searchCache.size > MAX_GEOCODE_CACHE_SIZE) {
      const oldestKey = searchCache.keys().next().value;
      if (oldestKey === undefined) break;
      searchCache.delete(oldestKey);
    }
  }

  return async function searchPlaces(rawQuery, rawLimit = 8) {
    const trimmed = String(rawQuery || '').trim().slice(0, 80);
    const limit = Math.max(1, Math.min(15, Number(rawLimit) || 8));
    if (!trimmed) {
      return VIETNAM_DIRECTORY.slice(0, limit);
    }

    const folded = foldVietnameseSearch(trimmed);
    const cacheKey = `${folded}:${limit}`;
    pruneSearchCache();

    const cached = searchCache.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached.results;
    }

    // 1. Instant local match across curated Vietnamese provinces, cities, and islands
    const localMatches = VIETNAM_DIRECTORY.filter((item) => {
      const fName = foldVietnameseSearch(item.nameVi);
      const fRegion = foldVietnameseSearch(item.regionVi);
      return fName.includes(folded) || fRegion.includes(folded);
    }).sort((a, b) => {
      const aStarts = foldVietnameseSearch(a.nameVi).startsWith(folded) ? 0 : 1;
      const bStarts = foldVietnameseSearch(b.nameVi).startsWith(folded) ? 0 : 1;
      return aStarts - bStarts;
    });

    const combined = [...localMatches];

    // 2. Augment with Open-Meteo Global Geocoding API for districts, wards, and international cities
    if (combined.length < limit && trimmed.length >= 2) {
      const url =
        `https://geocoding-api.open-meteo.com/v1/search` +
        `?name=${encodeURIComponent(trimmed)}` +
        `&count=12&language=vi&format=json`;
      const remoteData = await fetchJsonWithTimeout(
        url,
        { headers: { Accept: 'application/json' } },
        fetchImpl,
        3500
      );

      const items = Array.isArray(remoteData?.results) ? remoteData.results : [];
      for (const r of items) {
        if (typeof r?.latitude !== 'number' || typeof r?.longitude !== 'number') {
          continue;
        }
        const lat = Number(r.latitude.toFixed(4));
        const lon = Number(r.longitude.toFixed(4));
        const isDup = combined.some(
          (existing) =>
            Math.abs(existing.latitude - lat) < 0.06 &&
            Math.abs(existing.longitude - lon) < 0.06
        );
        if (isDup) continue;

        const nameVi = cleanVietnamesePlaceToken(r.name) || String(r.name || '').trim();
        const admin1 = cleanVietnamesePlaceToken(r.admin1);
        const countryVi = String(r.country || '').trim();
        if (!nameVi) continue;

        const regionParts = [admin1, countryVi].filter(
          (part) => part && part.toLowerCase() !== nameVi.toLowerCase()
        );

        combined.push({
          id: `geo_${lat}_${lon}`,
          nameVi,
          regionVi: regionParts.join(' · ') || countryVi || 'Quốc tế',
          countryVi: countryVi || 'Quốc tế',
          latitude: lat,
          longitude: lon,
        });

        if (combined.length >= limit) {
          break;
        }
      }
    }

    const finalResults = combined.slice(0, limit);
    searchCache.set(cacheKey, {
      results: finalResults,
      expiresAtMs: Date.now() + GEOCODE_CACHE_TTL_MS,
    });
    return finalResults;
  };
}
