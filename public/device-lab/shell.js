/* WeatherBuddy Device Studio Host Orchestrator (shell.js) */
(function () {
  'use strict';

  var CITIES = [
    { id: 'tp_hcm', nameVi: 'TP. Hồ Chí Minh', latitude: 10.8231, longitude: 106.6297 },
    { id: 'ha_noi', nameVi: 'Hà Nội', latitude: 21.0285, longitude: 105.8542 },
    { id: 'da_nang', nameVi: 'Đà Nẵng', latitude: 16.0544, longitude: 108.2022 },
    { id: 'da_lat', nameVi: 'Đà Lạt', latitude: 11.9404, longitude: 108.4583 },
    { id: 'sa_pa', nameVi: 'Sa Pa', latitude: 22.3364, longitude: 103.8438 },
    { id: 'phu_quoc', nameVi: 'Phú Quốc', latitude: 10.2270, longitude: 103.9632 }
  ];

  var SCENARIO_LABELS = {
    live: 'Thời tiết thực tế (Live)',
    sunny: 'Nắng đẹp',
    hot_uv: 'Nắng gắt UV',
    light_rain: 'Mưa rào cầm ô',
    storm: 'Mưa bão áo mưa',
    chilly: 'Đà Lạt se lạnh',
    freezing: 'Sa Pa rét đậm',
    clear_night: 'Đêm quang mây'
  };

  var apiBase = '';
  var isShowcasePort = window.location.port === '8788';
  var webRootOrigin = isShowcasePort
    ? window.location.protocol + '//' + window.location.hostname + ':8787'
    : window.location.origin;

  // On port 8788 (PC or LAN Wi-Fi smartphone), showcaseServer proxies /app-embed + /_expo/* + /assets/* + /api/*
  var defaultAppOrigin = isShowcasePort
    ? window.location.origin + '/app-embed'
    : window.location.origin;

  var state = {
    viewMode: 'both',
    theme: 'dark',
    gender: 'female',
    city: CITIES[0],
    scenarioId: 'live',
    snapshot: null,
    decision: null,
    sprites: null,
    appOrigin: defaultAppOrigin
  };

  var mountedStages = {
    mobile: false,
    desktop: false
  };
  var activeFetchSeq = 0;
  var toastTimer = null;
  var activeLanUrl = '';

  function findCityById(cityId) {
    for (var i = 0; i < CITIES.length; i += 1) {
      if (CITIES[i].id === cityId) {
        return CITIES[i];
      }
    }
    return CITIES[0];
  }

  function resolveSpriteUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      return '';
    }
    if (/^(https?:|data:|blob:)/i.test(rawUrl)) {
      return rawUrl;
    }
    // Keep root-relative /api/... paths same-origin so LAN Wi-Fi :8788, :8787, and Vercel all serve directly
    if (rawUrl.charAt(0) === '/') {
      return apiBase + rawUrl;
    }
    return window.location.origin.replace(/\/+$/, '') + '/' + rawUrl.replace(/^\/+/, '');
  }

  function buildSpritesForScene(gender, sceneId, rawSprites) {
    var safeGender = gender === 'male' ? 'male' : 'female';
    var safeScene = sceneId || 'pleasant_sunny';
    var charPath =
      (rawSprites && rawSprites.character) ||
      '/api/character-sprite?file=' + safeGender + '_' + safeScene + '.png';
    var catPath =
      (rawSprites && rawSprites.cat) || '/api/character-sprite?file=companion_cat.png';
    var puppyPath =
      (rawSprites && rawSprites.puppy) || '/api/character-sprite?file=companion_puppy.png';

    return {
      character: resolveSpriteUrl(charPath),
      cat: resolveSpriteUrl(catPath),
      puppy: resolveSpriteUrl(puppyPath)
    };
  }

  function buildFallbackHourly(baseTempC, humidityPct, precipProbPct, precipMm, code) {
    var baseMs = Date.now();
    var list = [];
    var deltas = [0.4, 0.9, 1.2, 0.8, 0.1, -0.5, -1.0, -1.4, -1.7, -1.9, -1.6, -1.1];
    for (var i = 0; i < 12; i += 1) {
      var temp = Math.round((baseTempC + deltas[i]) * 10) / 10;
      var prob = Math.max(0, Math.min(100, Math.round(precipProbPct - i * 3)));
      var mm = prob >= 45 ? Math.max(0, Math.round((precipMm * (1 - i * 0.1)) * 10) / 10) : 0;
      list.push({
        timeIso: new Date(baseMs + (i + 1) * 3600 * 1000).toISOString(),
        temperatureC: temp,
        humidityPct: Math.max(30, Math.min(98, Math.round(humidityPct - deltas[i] * 2))),
        precipProbPct: prob,
        precipMm: mm,
        conditionCode: code
      });
    }
    return list;
  }

  function buildFallbackDaily(baseTempC, precipProbPct, precipMm, code, condVi) {
    var baseMs = Date.now();
    var days = [];
    for (var d = 0; d < 7; d += 1) {
      var shift = (d % 3) * 0.6 - 0.5;
      var dObj = new Date(baseMs + d * 86400 * 1000);
      days.push({
        dateIso: dObj.toISOString().slice(0, 10),
        tempMinC: Math.round((baseTempC - 3.2 + shift) * 10) / 10,
        tempMaxC: Math.round((baseTempC + 2.8 + shift) * 10) / 10,
        precipProbMaxPct: Math.max(10, Math.min(96, Math.round(precipProbPct - d * 4))),
        precipSumMm: Math.max(0, Math.round((precipMm * 3 - d * 0.4) * 10) / 10),
        uvIndexMax: code === 'THUNDERSTORM' ? 2 : 7,
        conditionCode: code,
        conditionTextVi: condVi,
        sunriseTimeVi: '05:42',
        sunsetTimeVi: '18:08'
      });
    }
    return days;
  }

  function synthesizeFallbackBundle(city, gender, scenarioId) {
    var presets = {
      sunny: {
        temp: 28,
        feels: 29,
        hum: 64,
        wind: 12,
        gust: 18,
        uv: 6,
        mm: 0,
        prob: 10,
        cond: 'Trời nắng đẹp dịu nhẹ',
        isDay: true,
        aqi: 42,
        pm25: 10.2,
        dew: 20.4,
        code: 'CLEAR',
        sceneId: 'pleasant_sunny',
        skyTheme: 'day_sunny',
        headlineVi: 'Trời nắng dịu',
        outfitAdviceVi: 'Mặc trang phục gọn nhẹ thoải mái',
        badgeVi: 'Nắng đẹp'
      },
      hot_uv: {
        temp: 35.5,
        feels: 38.5,
        hum: 58,
        wind: 9,
        gust: 15,
        uv: 10,
        mm: 0,
        prob: 12,
        cond: 'Nắng gắt, chỉ số tia UV rất cao',
        isDay: true,
        aqi: 68,
        pm25: 19.5,
        dew: 25.6,
        code: 'CLEAR',
        sceneId: 'hot_sunny',
        skyTheme: 'day_sunny',
        headlineVi: 'Oi nóng & UV cao',
        outfitAdviceVi: 'Mặc đồ thoáng mát, đeo kính chống nắng',
        badgeVi: 'Nắng gắt & UV cao'
      },
      light_rain: {
        temp: 23.5,
        feels: 24,
        hum: 88,
        wind: 11,
        gust: 19,
        uv: 2,
        mm: 1.4,
        prob: 78,
        cond: 'Mưa nhỏ rải rác',
        isDay: true,
        aqi: 38,
        pm25: 8.8,
        dew: 21.3,
        code: 'LIGHT_RAIN',
        sceneId: 'light_rain_umbrella',
        skyTheme: 'day_rain',
        headlineVi: 'Mưa nhỏ · Cầm ô',
        outfitAdviceVi: 'Mang ô gọn và áo khoác trượt nước',
        badgeVi: 'Mưa nhỏ rải rác'
      },
      storm: {
        temp: 23,
        feels: 22,
        hum: 95,
        wind: 30,
        gust: 48,
        uv: 1,
        mm: 9.2,
        prob: 96,
        cond: 'Mưa bão lớn kèm gió giật mạnh',
        isDay: true,
        aqi: 28,
        pm25: 6.4,
        dew: 22.1,
        code: 'THUNDERSTORM',
        sceneId: 'storm_raincoat',
        skyTheme: 'rain_storm',
        headlineVi: 'Mưa lớn gió mạnh',
        outfitAdviceVi: 'Mặc áo mưa kín, tránh cầm ô',
        badgeVi: 'Mưa lớn & gió mạnh'
      },
      chilly: {
        temp: 18.5,
        feels: 18,
        hum: 78,
        wind: 12,
        gust: 20,
        uv: 3,
        mm: 0,
        prob: 15,
        cond: 'Se lạnh dễ chịu, sương mù nhẹ',
        isDay: true,
        aqi: 26,
        pm25: 6.1,
        dew: 14.6,
        code: 'PARTLY_CLOUDY',
        sceneId: 'chilly_cozy',
        skyTheme: 'day_cloudy',
        headlineVi: 'Trời se lạnh',
        outfitAdviceVi: 'Khoác áo mỏng khi ra ngoài',
        badgeVi: 'Trời se lạnh'
      },
      freezing: {
        temp: 9.5,
        feels: 7.5,
        hum: 86,
        wind: 16,
        gust: 26,
        uv: 2,
        mm: 0,
        prob: 20,
        cond: 'Rét đậm vùng cao, mây mù bao phủ',
        isDay: true,
        aqi: 24,
        pm25: 5.5,
        dew: 7.2,
        code: 'FOG',
        sceneId: 'freezing_puffer',
        skyTheme: 'day_cloudy',
        headlineVi: 'Trời rét đậm',
        outfitAdviceVi: 'Mặc áo phao dày và quàng khăn giữ ấm',
        badgeVi: 'Rét đậm vùng cao'
      },
      clear_night: {
        temp: 24.5,
        feels: 25,
        hum: 74,
        wind: 10,
        gust: 15,
        uv: 0,
        mm: 0,
        prob: 8,
        cond: 'Đêm quang mây, gió mát dịu',
        isDay: false,
        aqi: 36,
        pm25: 8.4,
        dew: 19.6,
        code: 'CLEAR',
        sceneId: 'clear_night',
        skyTheme: 'night',
        headlineVi: 'Đêm thoáng mát',
        outfitAdviceVi: 'Mặc thoáng nhẹ, mang theo khoác mỏng',
        badgeVi: 'Đêm dịu mát'
      }
    };

    var p = presets[scenarioId] || presets.sunny;
    var snap = {
      provider: scenarioId === 'live' ? 'open_meteo' : 'demo',
      locationName: city.nameVi,
      latitude: city.latitude,
      longitude: city.longitude,
      updatedAtIso: new Date().toISOString(),
      utcOffsetSeconds: 7 * 3600,
      temperatureC: p.temp,
      feelsLikeC: p.feels,
      humidityPct: p.hum,
      windSpeedKmh: p.wind,
      windGustKmh: p.gust,
      uvIndex: p.uv,
      precipMmPerHr: p.mm,
      precipProbPct: p.prob,
      conditionText: p.cond,
      isDay: p.isDay,
      aqi: p.aqi,
      pm25: p.pm25,
      dewPointC: p.dew,
      sunriseTimeVi: '05:42',
      sunsetTimeVi: '18:08',
      hourly: buildFallbackHourly(p.temp, p.hum, p.prob, p.mm, p.code),
      daily: buildFallbackDaily(p.temp, p.prob, p.mm, p.code, p.cond)
    };

    var dec = normalizeDecision(
      {
        sceneId: p.sceneId,
        gender: gender,
        hasRainAheadProp: p.prob >= 60,
        rainAheadHours: p.prob >= 60 ? 1 : null,
        hasAqiMask: p.aqi >= 150,
        skyTheme: p.skyTheme,
        headlineVi: p.headlineVi,
        outfitAdviceVi: p.outfitAdviceVi,
        badgeVi: p.badgeVi
      },
      gender
    );

    return {
      snapshot: snap,
      decision: dec,
      sprites: buildSpritesForScene(gender, dec.sceneId, null)
    };
  }

  function normalizeDecision(rawDecision, gender) {
    if (!rawDecision || typeof rawDecision !== 'object') {
      return null;
    }
    var outfitText =
      rawDecision.outfitVi ||
      rawDecision.outfitAdviceVi ||
      rawDecision.badgeVi ||
      'Mặc trang phục gọn nhẹ thoải mái';
    var adviceText =
      rawDecision.adviceVi ||
      rawDecision.outfitAdviceVi ||
      rawDecision.headlineVi ||
      outfitText;
    var maskFlag = Boolean(
      rawDecision.shouldWearMask !== undefined
        ? rawDecision.shouldWearMask
        : rawDecision.hasAqiMask
    );

    return Object.assign({}, rawDecision, {
      gender: gender,
      outfitVi: outfitText,
      outfitAdviceVi: rawDecision.outfitAdviceVi || outfitText,
      adviceVi: adviceText,
      badgeVi: rawDecision.badgeVi || rawDecision.headlineVi || outfitText,
      shouldWearMask: maskFlag,
      hasAqiMask: maskFlag
    });
  }

  function normalizeSnapshot(rawSnapshot, city) {
    if (!rawSnapshot || typeof rawSnapshot !== 'object') {
      return null;
    }
    var copy = Object.assign({}, rawSnapshot);
    if (city && city.nameVi) {
      copy.locationName = city.nameVi;
      copy.latitude = city.latitude;
      copy.longitude = city.longitude;
    }
    if (!copy.sunriseTimeVi) {
      copy.sunriseTimeVi = '05:42';
    }
    if (!copy.sunsetTimeVi) {
      copy.sunsetTimeVi = '18:08';
    }
    if (!Array.isArray(copy.daily) || copy.daily.length === 0) {
      copy.daily = buildFallbackDaily(
        Number(copy.temperatureC) || 27,
        Number(copy.precipProbPct) || 15,
        Number(copy.precipMmPerHr) || 0,
        'PARTLY_CLOUDY',
        copy.conditionText || 'Thời tiết ổn định'
      );
    }
    return copy;
  }

  function buildStagePayload() {
    return {
      theme: state.theme,
      gender: state.gender,
      city: {
        id: state.city.id,
        nameVi: state.city.nameVi,
        latitude: state.city.latitude,
        longitude: state.city.longitude
      },
      scenarioId: state.scenarioId,
      snapshot: state.snapshot,
      decision: state.decision,
      sprites: state.sprites,
      appOrigin: state.appOrigin
    };
  }

  function buildStageCallbacks() {
    return {
      onRequestRefresh: function () {
        fetchAndBroadcastBundle(true);
      },
      onChangeGender: function (nextGender) {
        if (nextGender === 'male' || nextGender === 'female') {
          applyGenderChange(nextGender);
        }
      },
      onChangeTheme: function (nextTheme) {
        if (nextTheme === 'dark' || nextTheme === 'light') {
          applyThemeChange(nextTheme);
        }
      },
      onLaunchNativeWidget: function (opts) {
        launchNativeWindowsWidget(opts);
      }
    };
  }

  function ensureStagesMounted() {
    var payload = buildStagePayload();
    var callbacks = buildStageCallbacks();
    var mobileRoot = document.getElementById('mobile-stage-root');
    var desktopRoot = document.getElementById('desktop-stage-root');

    if (
      !mountedStages.mobile &&
      mobileRoot &&
      window.WeatherBuddyMobileStage &&
      typeof window.WeatherBuddyMobileStage.mount === 'function'
    ) {
      window.WeatherBuddyMobileStage.mount(mobileRoot, payload, callbacks);
      mountedStages.mobile = true;
    }

    if (
      !mountedStages.desktop &&
      desktopRoot &&
      window.WeatherBuddyDesktopStage &&
      typeof window.WeatherBuddyDesktopStage.mount === 'function'
    ) {
      window.WeatherBuddyDesktopStage.mount(desktopRoot, payload, callbacks);
      mountedStages.desktop = true;
    }
  }

  function broadcastStateToStages() {
    ensureStagesMounted();
    var payload = buildStagePayload();

    if (
      mountedStages.mobile &&
      window.WeatherBuddyMobileStage &&
      typeof window.WeatherBuddyMobileStage.update === 'function'
    ) {
      window.WeatherBuddyMobileStage.update(payload);
    }

    if (
      mountedStages.desktop &&
      window.WeatherBuddyDesktopStage &&
      typeof window.WeatherBuddyDesktopStage.update === 'function'
    ) {
      window.WeatherBuddyDesktopStage.update(payload);
    }

    updateHeaderTelemetry();
  }

  function updateHeaderTelemetry() {
    var tempEl = document.getElementById('studio-readout-temp');
    var outfitEl = document.getElementById('studio-readout-outfit');
    var subtitleEl = document.getElementById('studio-telemetry-summary');
    var syncPillEl = document.getElementById('studio-sync-pill');
    var syncLabelEl = document.getElementById('studio-sync-label');

    if (syncPillEl && syncLabelEl) {
      syncPillEl.classList.toggle('is-demo', state.scenarioId !== 'live');
      syncLabelEl.textContent =
        state.scenarioId === 'live'
          ? 'Đồng bộ trực tiếp · Port 8788 / 8787'
          : 'Kịch bản mô phỏng · Port 8788 / 8787';
    }

    if (!state.snapshot) {
      return;
    }

    var roundedTemp = Math.round(Number(state.snapshot.temperatureC) * 10) / 10;
    if (tempEl && Number.isFinite(roundedTemp)) {
      tempEl.textContent = roundedTemp + '°C';
    }

    var outfitSummary =
      (state.decision && (state.decision.outfitVi || state.decision.outfitAdviceVi)) ||
      state.snapshot.conditionText ||
      'Thời tiết ổn định';

    if (outfitEl) {
      outfitEl.textContent = state.city.nameVi + ' · ' + outfitSummary;
    }

    if (subtitleEl) {
      var cond = state.snapshot.conditionText || SCENARIO_LABELS[state.scenarioId] || '';
      var feels = Math.round(Number(state.snapshot.feelsLikeC) * 10) / 10;
      subtitleEl.textContent =
        state.city.nameVi +
        ' · ' +
        cond +
        (Number.isFinite(feels) ? ' · Cảm giác như ' + feels + '°C' : '');
    }
  }

  function setBusyState(isBusy) {
    var refreshBtn = document.getElementById('btn-refresh-studio');
    var syncPill = document.getElementById('studio-sync-pill');
    if (refreshBtn) {
      refreshBtn.classList.toggle('is-busy', Boolean(isBusy));
    }
    if (syncPill) {
      syncPill.classList.toggle('is-loading', Boolean(isBusy));
    }
  }

  function showToast(message, isError) {
    var banner = document.getElementById('studio-toast-banner');
    if (!banner) {
      return;
    }
    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }
    banner.textContent = message;
    banner.classList.toggle('is-error', Boolean(isError));
    banner.hidden = false;

    toastTimer = window.setTimeout(function () {
      banner.hidden = true;
    }, 4500);
  }

  async function discoverStudioAndEmbedOrigin() {
    if (isShowcasePort) {
      try {
        var embedProbe = await window.fetch('/app-embed/?deviceSim=1', { method: 'HEAD' });
        if (!embedProbe.ok) {
          state.appOrigin = webRootOrigin;
          broadcastStateToStages();
        }
      } catch (_probeErr) {
        state.appOrigin = webRootOrigin;
        broadcastStateToStages();
      }
    }

    try {
      var res = await window.fetch(apiBase + '/api/studio-info', {
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) {
        return;
      }
      var info = await res.json();
      var rawUrls =
        (info && Array.isArray(info.lanUrls) && info.lanUrls) ||
        (info && Array.isArray(info.showcaseLanUrls) && info.showcaseLanUrls) ||
        [];

      if (rawUrls.length > 0) {
        var chosen = String(rawUrls[0] || '');
        for (var i = 0; i < rawUrls.length; i += 1) {
          if (String(rawUrls[i]).indexOf(':8788') !== -1) {
            chosen = String(rawUrls[i]);
            break;
          }
        }
        if (chosen) {
          activeLanUrl = chosen;
          var lanBtn = document.getElementById('studio-lan-badge');
          var lanText = document.getElementById('studio-lan-badge-text');
          if (lanBtn && lanText) {
            var compactHost = chosen.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
            lanText.textContent = 'Mở trên ĐT: ' + compactHost;
            lanBtn.title = 'Mở trên điện thoại cùng Wi-Fi: ' + chosen + ' (Bấm để sao chép)';
            lanBtn.hidden = false;
          }
        }
      }
    } catch (_infoErr) {
      // Optional LAN discovery endpoint not active (e.g. static cloud deployment)
    }
  }

  async function requestPreviewBundle(city, gender, scenarioId, force) {
    var qs = new URLSearchParams({
      lat: String(city.latitude),
      lon: String(city.longitude),
      locationName: city.nameVi,
      gender: gender,
      scenario: scenarioId
    });
    if (force) {
      qs.set('force', '1');
    }

    try {
      var res = await window.fetch(apiBase + '/api/live-preview-bundle?' + qs.toString(), {
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        var data = await res.json();
        if (data && data.snapshot) {
          var normDec = normalizeDecision(data.decision, gender);
          var sceneId = (normDec && normDec.sceneId) || 'pleasant_sunny';
          return {
            snapshot: normalizeSnapshot(data.snapshot, city),
            decision: normDec,
            sprites: buildSpritesForScene(gender, sceneId, data.sprites)
          };
        }
      }
    } catch (_bundleErr) {
      // Fall through to /api/weather or local preset fallback
    }

    if (scenarioId === 'live') {
      try {
        var weatherQs = new URLSearchParams({
          lat: String(city.latitude),
          lon: String(city.longitude),
          locationName: city.nameVi,
          gender: gender
        });
        if (force) {
          weatherQs.set('force', '1');
        }
        var weatherRes = await window.fetch(apiBase + '/api/weather?' + weatherQs.toString(), {
          headers: { Accept: 'application/json' }
        });
        if (weatherRes.ok) {
          var wData = await weatherRes.json();
          if (wData && wData.snapshot) {
            var wDec = normalizeDecision(wData.decision, gender);
            var wScene = (wDec && wDec.sceneId) || 'pleasant_sunny';
            return {
              snapshot: normalizeSnapshot(wData.snapshot, city),
              decision: wDec,
              sprites: buildSpritesForScene(gender, wScene, null)
            };
          }
        }
      } catch (_weatherErr) {
        // Fall through to offline resilience bundle
      }
    }

    return synthesizeFallbackBundle(city, gender, scenarioId);
  }

  async function fetchAndBroadcastBundle(force) {
    var seq = ++activeFetchSeq;
    var targetCity = state.city;
    var targetGender = state.gender;
    var targetScenario = state.scenarioId;

    setBusyState(true);
    try {
      var bundle = await requestPreviewBundle(
        targetCity,
        targetGender,
        targetScenario,
        Boolean(force)
      );
      if (seq !== activeFetchSeq) {
        return;
      }
      state.snapshot = bundle.snapshot;
      state.decision = bundle.decision;
      state.sprites = bundle.sprites;
      broadcastStateToStages();
    } finally {
      if (seq === activeFetchSeq) {
        setBusyState(false);
      }
    }
  }

  function applyThemeChange(nextTheme) {
    state.theme = nextTheme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-sim-theme', state.theme);

    var themeMeta = document.getElementById('sim-theme-color-meta');
    if (themeMeta) {
      themeMeta.setAttribute('content', state.theme === 'light' ? '#F4F6F9' : '#0A0D13');
    }

    var buttons = document.querySelectorAll('#ctrl-theme-group [data-theme]');
    for (var i = 0; i < buttons.length; i += 1) {
      var isMatch = buttons[i].getAttribute('data-theme') === state.theme;
      buttons[i].classList.toggle('is-active', isMatch);
      buttons[i].setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    }

    broadcastStateToStages();
  }

  function applyGenderChange(nextGender) {
    state.gender = nextGender === 'male' ? 'male' : 'female';
    var buttons = document.querySelectorAll('#ctrl-gender-group [data-gender]');
    for (var i = 0; i < buttons.length; i += 1) {
      var isMatch = buttons[i].getAttribute('data-gender') === state.gender;
      buttons[i].classList.toggle('is-active', isMatch);
      buttons[i].setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    }

    if (state.decision) {
      state.decision = normalizeDecision(state.decision, state.gender);
      state.sprites = buildSpritesForScene(state.gender, state.decision.sceneId, null);
    }
    broadcastStateToStages();
    fetchAndBroadcastBundle(false);
  }

  function applyViewModeChange(nextMode) {
    var allowed = nextMode === 'mobile' || nextMode === 'desktop' ? nextMode : 'both';
    state.viewMode = allowed;

    var grid = document.getElementById('studio-stage-grid');
    if (grid) {
      grid.setAttribute('data-layout', allowed);
    }

    var tabs = document.querySelectorAll('#studio-view-switcher [data-view-mode]');
    for (var i = 0; i < tabs.length; i += 1) {
      var isSelected = tabs[i].getAttribute('data-view-mode') === allowed;
      tabs[i].classList.toggle('is-active', isSelected);
      tabs[i].setAttribute('aria-selected', isSelected ? 'true' : 'false');
    }

    window.requestAnimationFrame(function () {
      window.dispatchEvent(new Event('resize'));
      broadcastStateToStages();
    });
  }

  async function launchNativeWindowsWidget(customOpts) {
    var btn = document.getElementById('btn-launch-win-widget');
    if (btn) {
      btn.disabled = true;
    }

    var bodyPayload = {
      corner: (customOpts && customOpts.corner) || 'BottomRight',
      size: (customOpts && customOpts.size) || 'Standard',
      gender: state.gender
    };

    try {
      var res = await window.fetch(apiBase + '/api/pc-widget/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WeatherBuddy-Client': 'weatherbuddy-ui'
        },
        body: JSON.stringify(bodyPayload)
      });

      var data = null;
      try {
        data = await res.json();
      } catch (_parseErr) {
        data = null;
      }

      if (res.ok && data && data.launched) {
        showToast(
          'Đã khởi chạy Widget Windows thật ở góc màn hình (' +
            (state.gender === 'male' ? 'Nam · Cậu bé Mây' : 'Nữ · Cô bé Nắng') +
            ').',
          false
        );
      } else {
        var errMsg =
          (data && data.error) ||
          'Không thể khởi chạy Widget Windows (chỉ hỗ trợ trực tiếp trên máy chủ Windows nội bộ).';
        showToast(errMsg, true);
      }
    } catch (_err) {
      showToast(
        'Không kết nối được tới API /api/pc-widget/launch. Hãy kiểm tra máy chủ cổng 8787.',
        true
      );
    } finally {
      if (btn) {
        btn.disabled = false;
      }
    }
  }

  function wireStudioControls() {
    var originLink = document.getElementById('link-open-web-origin');
    if (originLink && webRootOrigin) {
      originLink.setAttribute('href', webRootOrigin.replace(/\/+$/, '') + '/');
    }

    var lanBadgeBtn = document.getElementById('studio-lan-badge');
    if (lanBadgeBtn) {
      lanBadgeBtn.addEventListener('click', function () {
        if (!activeLanUrl) {
          return;
        }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard
            .writeText(activeLanUrl)
            .then(function () {
              showToast('Đã sao chép địa chỉ mở trên điện thoại Wi-Fi: ' + activeLanUrl, false);
            })
            .catch(function () {
              showToast('Địa chỉ mở trên điện thoại cùng Wi-Fi: ' + activeLanUrl, false);
            });
        } else {
          showToast('Địa chỉ mở trên điện thoại cùng Wi-Fi: ' + activeLanUrl, false);
        }
      });
    }

    var viewButtons = document.querySelectorAll('#studio-view-switcher [data-view-mode]');
    for (var v = 0; v < viewButtons.length; v += 1) {
      viewButtons[v].addEventListener('click', function (ev) {
        var mode = ev.currentTarget.getAttribute('data-view-mode');
        applyViewModeChange(mode);
      });
    }

    var citySelect = document.getElementById('ctrl-city');
    if (citySelect) {
      citySelect.addEventListener('change', function (ev) {
        state.city = findCityById(ev.target.value);
        if (state.snapshot) {
          state.snapshot = normalizeSnapshot(state.snapshot, state.city);
          broadcastStateToStages();
        }
        fetchAndBroadcastBundle(false);
      });
    }

    var scenarioSelect = document.getElementById('ctrl-scenario');
    if (scenarioSelect) {
      scenarioSelect.addEventListener('change', function (ev) {
        state.scenarioId = ev.target.value || 'live';
        if (state.scenarioId !== 'live') {
          var instant = synthesizeFallbackBundle(state.city, state.gender, state.scenarioId);
          state.snapshot = instant.snapshot;
          state.decision = instant.decision;
          state.sprites = instant.sprites;
          broadcastStateToStages();
        }
        fetchAndBroadcastBundle(false);
      });
    }

    var genderButtons = document.querySelectorAll('#ctrl-gender-group [data-gender]');
    for (var g = 0; g < genderButtons.length; g += 1) {
      genderButtons[g].addEventListener('click', function (ev) {
        var nextGender = ev.currentTarget.getAttribute('data-gender');
        applyGenderChange(nextGender);
      });
    }

    var themeButtons = document.querySelectorAll('#ctrl-theme-group [data-theme]');
    for (var t = 0; t < themeButtons.length; t += 1) {
      themeButtons[t].addEventListener('click', function (ev) {
        var nextTheme = ev.currentTarget.getAttribute('data-theme');
        applyThemeChange(nextTheme);
      });
    }

    var refreshBtn = document.getElementById('btn-refresh-studio');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        fetchAndBroadcastBundle(true);
      });
    }

    var winWidgetBtn = document.getElementById('btn-launch-win-widget');
    if (winWidgetBtn) {
      winWidgetBtn.addEventListener('click', function () {
        launchNativeWindowsWidget();
      });
    }
  }

  function initStudio() {
    var seed = synthesizeFallbackBundle(state.city, state.gender, state.scenarioId);
    state.snapshot = seed.snapshot;
    state.decision = seed.decision;
    state.sprites = seed.sprites;

    wireStudioControls();
    ensureStagesMounted();
    updateHeaderTelemetry();
    discoverStudioAndEmbedOrigin();
    fetchAndBroadcastBundle(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStudio);
  } else {
    initStudio();
  }
})();
