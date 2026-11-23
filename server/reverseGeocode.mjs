import { PRESET_CITIES } from './coreLoader.mjs';

const GEOCODE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_GEOCODE_CACHE_SIZE = 200;

function cleanVietnamesePlaceToken(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return '';
  }
  return raw
    .trim()
    .replace(/^Thành phố\s+/i, 'TP. ')
    .replace(/^Tỉnh\s+/i, '')
    .replace(/\s+/g, ' ');
}

function composeVietnameseLocationName(district, city) {
  if (
    district &&
    city &&
    district.toLowerCase() !== city.toLowerCase() &&
    !city.toLowerCase().includes(district.toLowerCase())
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

  return async function reverseGeocode(latitude, longitude) {
    const lat = Number(latitude.toFixed(5));
    const lon = Number(longitude.toFixed(5));
    const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;

    const now = Date.now();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAtMs > now) {
      return {
        ...cached.value,
        latitude: lat,
        longitude: lon,
        cacheHit: true,
      };
    }

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

    let locationName = composeVietnameseLocationName(district, city);

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

    const result = {
      locationName,
      district: district || '',
      city: city || locationName,
      country: country || 'Việt Nam',
      latitude: lat,
      longitude: lon,
    };

    pruneCache();
    cache.set(cacheKey, {
      value: result,
      expiresAtMs: Date.now() + GEOCODE_CACHE_TTL_MS,
    });

    return {
      ...result,
      cacheHit: false,
    };
  };
}
