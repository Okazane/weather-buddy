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
