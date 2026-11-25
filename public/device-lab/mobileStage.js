/* WeatherBuddy Device Studio · Interactive Mobile Phone Simulator Stage
 * Exposes window.WeatherBuddyMobileStage = { mount(containerEl, initialState, callbacks), update(nextState) }
 * Modes: 1) Màn hình chính & Widget (Default)  2) Màn hình khóa
 */
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  var DEVICE_PROFILES = {
    ios: {
      id: 'ios',
      label: 'iPhone 16 Pro · 393×852',
      shortLabel: 'iPhone 16 Pro',
      screenW: 393,
      screenH: 852,
      outerW: 423,
      outerH: 882,
    },
    android: {
      id: 'android',
      label: 'Android Flagship · 412×915',
      shortLabel: 'Android · 412×915',
      screenW: 412,
      screenH: 915,
      outerW: 438,
      outerH: 941,
    },
  };

  var SUB_MODES = [
    { id: 'widgets', label: 'Màn hình chính & Widget' },
    { id: 'lock', label: 'Màn hình khóa' },
  ];

  function sanitizeVi(text) {
    if (text == null) return '';
    return String(text).replace(/\s*[—–]\s*/g, ' · ').trim();
  }

  function stripLeadingEmoji(text) {
    return sanitizeVi(text).replace(/^[\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF\uFE0F]+\s*/g, '').trim();
  }

  function roundInt(val, fallback) {
    var num = Number(val);
    return Number.isFinite(num) ? Math.round(num) : fallback;
  }

  function el(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      var keys = Object.keys(attrs);
      for (var i = 0; i < keys.length; i += 1) {
        var k = keys[i];
        var v = attrs[k];
        if (v !== undefined && v !== null) {
          node.setAttribute(k, String(v));
        }
      }
    }
    return node;
  }

  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    if (attrs) {
      var keys = Object.keys(attrs);
      for (var i = 0; i < keys.length; i += 1) {
        var k = keys[i];
        var v = attrs[k];
        if (v !== undefined && v !== null) {
          node.setAttribute(k, String(v));
        }
      }
    }
    return node;
  }

  function createStatusIconsSvg() {
    var wrap = el('span', 'wb-ms-status-icons');

    var sig = svgEl('svg', { width: '16', height: '12', viewBox: '0 0 16 12', fill: 'none', 'aria-hidden': 'true' });
    sig.appendChild(svgEl('rect', { x: '1', y: '8', width: '2.5', height: '3.5', rx: '1', fill: 'currentColor' }));
    sig.appendChild(svgEl('rect', { x: '4.8', y: '6', width: '2.5', height: '5.5', rx: '1', fill: 'currentColor' }));
    sig.appendChild(svgEl('rect', { x: '8.6', y: '3.5', width: '2.5', height: '8', rx: '1', fill: 'currentColor' }));
    sig.appendChild(svgEl('rect', { x: '12.4', y: '1', width: '2.5', height: '10.5', rx: '1', fill: 'currentColor' }));

    var wifi = svgEl('svg', { width: '15', height: '12', viewBox: '0 0 15 12', fill: 'none', 'aria-hidden': 'true' });
    wifi.appendChild(svgEl('path', {
      d: 'M1.4 4.2C4.8 1.3 10.2 1.3 13.6 4.2',
      stroke: 'currentColor',
      'stroke-width': '1.6',
      'stroke-linecap': 'round',
    }));
    wifi.appendChild(svgEl('path', {
      d: 'M3.8 6.8C5.9 5.0 9.1 5.0 11.2 6.8',
      stroke: 'currentColor',
      'stroke-width': '1.6',
      'stroke-linecap': 'round',
    }));
    wifi.appendChild(svgEl('circle', { cx: '7.5', cy: '9.6', r: '1.4', fill: 'currentColor' }));

    var bat = svgEl('svg', { width: '23', height: '12', viewBox: '0 0 23 12', fill: 'none', 'aria-hidden': 'true' });
    bat.appendChild(svgEl('rect', {
      x: '1',
      y: '1.5',
      width: '18.5',
      height: '9',
      rx: '2.6',
      stroke: 'currentColor',
      'stroke-opacity': '0.55',
      'stroke-width': '1.2',
    }));
    bat.appendChild(svgEl('rect', { x: '2.8', y: '3.1', width: '14.2', height: '5.8', rx: '1.4', fill: 'currentColor' }));
    bat.appendChild(svgEl('path', {
      d: 'M20.8 4.3V7.7',
      stroke: 'currentColor',
      'stroke-opacity': '0.6',
      'stroke-width': '1.4',
      'stroke-linecap': 'round',
    }));

    wrap.appendChild(sig);
    wrap.appendChild(wifi);
    wrap.appendChild(bat);
    return wrap;
  }

  function createMiniWeatherSvg(conditionCode, precipProbPct) {
    var code = String(conditionCode || '').toUpperCase();
    var prob = Number(precipProbPct) || 0;
    var svg = svgEl('svg', { width: '18', height: '18', viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': 'true' });

    if (prob >= 55 || code.indexOf('RAIN') !== -1 || code.indexOf('STORM') !== -1 || code.indexOf('DRIZZLE') !== -1) {
      svg.appendChild(svgEl('path', {
        d: 'M5.5 11.5H14.2C15.7 11.5 16.8 10.4 16.8 8.9C16.8 7.5 15.8 6.4 14.4 6.3C13.9 4.4 12.2 3.1 10.2 3.1C8.0 3.1 6.2 4.7 5.9 6.8C4.5 7.0 3.5 8.1 3.5 9.5C3.5 10.6 4.4 11.5 5.5 11.5Z',
        fill: '#93C5FD',
      }));
      svg.appendChild(svgEl('path', {
        d: 'M7.5 13.8L6.7 16.2M10.5 13.8L9.7 16.2M13.5 13.8L12.7 16.2',
        stroke: '#38BDF8',
        'stroke-width': '1.5',
        'stroke-linecap': 'round',
      }));
      return svg;
    }

    if (code.indexOf('NIGHT') !== -1) {
      svg.appendChild(svgEl('path', {
        d: 'M13.8 13.6C10.4 13.6 7.8 11.0 7.8 7.6C7.8 6.2 8.3 4.9 9.1 3.9C6.3 4.3 4.2 6.7 4.2 9.6C4.2 12.8 6.8 15.4 10.0 15.4C12.1 15.4 13.9 14.3 14.9 12.6C14.5 13.3 14.2 13.6 13.8 13.6Z',
        fill: '#F5CE84',
      }));
      return svg;
    }

    if (code.indexOf('CLOUD') !== -1 || code.indexOf('FOG') !== -1 || prob >= 25) {
      svg.appendChild(svgEl('circle', { cx: '7.2', cy: '7.2', r: '3.1', fill: '#F5B942' }));
      svg.appendChild(svgEl('path', {
        d: 'M6.5 14.2H14.5C15.9 14.2 17 13.1 17 11.7C17 10.4 16 9.3 14.7 9.2C14.2 7.5 12.7 6.3 10.8 6.3C8.8 6.3 7.2 7.8 6.9 9.7C5.6 9.9 4.7 10.9 4.7 12.2C4.7 13.3 5.5 14.2 6.5 14.2Z',
        fill: '#DCEBFC',
      }));
      return svg;
    }

    svg.appendChild(svgEl('circle', { cx: '10', cy: '10', r: '4.2', fill: '#F5B942' }));
    svg.appendChild(svgEl('path', {
      d: 'M10 2.5V4.3M10 15.7V17.5M2.5 10H4.3M15.7 10H17.5M4.7 4.7L6.0 6.0M14.0 14.0L15.3 15.3M15.3 4.7L14.0 6.0M6.0 14.0L4.7 15.3',
      stroke: '#F5B942',
      'stroke-width': '1.5',
      'stroke-linecap': 'round',
    }));
    return svg;
  }

  function createAppTile(label, bgStyle, iconPathD, onClick) {
    var btn = el(onClick ? 'button' : 'div', 'wb-ms-app-tile', onClick ? {
      type: 'button',
      'data-interactive': 'true',
      'aria-label': label || 'WeatherBuddy',
    } : null);
    var iconBox = el('span', 'wb-ms-app-icon');
    iconBox.style.background = bgStyle;

    var svg = svgEl('svg', { width: '26', height: '26', viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' });
    svg.appendChild(svgEl('path', {
      d: iconPathD,
      stroke: '#F8FAFC',
      'stroke-width': '1.9',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }));
    iconBox.appendChild(svg);
    btn.appendChild(iconBox);

    if (label) {
      var nameEl = el('span', 'wb-ms-app-name');
      nameEl.textContent = label;
      btn.appendChild(nameEl);
    }

    if (onClick) {
      btn.addEventListener('click', onClick);
    }
    return btn;
  }

  function createSpriteFallbackDataUri(label) {
    var safe = encodeURIComponent(label || 'WB');
    return 'data:image/svg+xml;utf8,' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
      '<circle cx="48" cy="48" r="40" fill="%2322344E" stroke="%2370B5FF" stroke-width="2"/>' +
      '<circle cx="48" cy="39" r="14" fill="%23F5CE84"/>' +
      '<path d="M27 72C30 58 66 58 69 72" fill="%235AA8F5"/>' +
      '<text x="48" y="88" font-size="10" text-anchor="middle" fill="%23F3F6FA" font-family="sans-serif">' + safe + '</text>' +
      '</svg>';
  }

  function formatVietnamNow() {
    var now = new Date();
    var hhmm = '09:30';
    var dateVi = 'Thứ Tư, 25 tháng 11';
    try {
      hhmm = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);

      var parts = new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).formatToParts(now);

      var weekday = '';
      var day = '';
      var month = '';
      for (var i = 0; i < parts.length; i += 1) {
        if (parts[i].type === 'weekday') weekday = parts[i].value;
        if (parts[i].type === 'day') day = parts[i].value;
        if (parts[i].type === 'month') month = parts[i].value;
      }
      if (weekday && day && month) {
        var capWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        dateVi = capWeekday + ', ' + day + ' ' + month.toLowerCase();
      }
    } catch (_err) {
      var vnMs = now.getTime() + 7 * 3600000;
      var vnDate = new Date(vnMs);
      var h = String(vnDate.getUTCHours()).padStart(2, '0');
      var m = String(vnDate.getUTCMinutes()).padStart(2, '0');
      hhmm = h + ':' + m;
    }
    return { hhmm: hhmm, dateVi: dateVi };
  }

  function formatHourSlotLabel(timeIso, fallbackOffsetHrs) {
    if (timeIso) {
      var ms = Date.parse(timeIso);
      if (Number.isFinite(ms)) {
        var vn = new Date(ms + 7 * 3600000);
        return String(vn.getUTCHours()).padStart(2, '0') + 'h';
      }
    }
    var base = new Date(Date.now() + (fallbackOffsetHrs + 7) * 3600000);
    return String(base.getUTCHours()).padStart(2, '0') + 'h';
  }

  function resolveSpriteUrls(state) {
    var gender = state && state.gender === 'male' ? 'male' : 'female';
    var sceneId = (state && state.decision && state.decision.sceneId) || 'pleasant_sunny';
    var sp = (state && state.sprites) || {};
    return {
      character: sp.character || ('/api/character-sprite?file=' + gender + '_' + sceneId + '.png'),
      cat: sp.cat || '/api/character-sprite?file=companion_cat.png',
      puppy: sp.puppy || '/api/character-sprite?file=companion_puppy.png',
    };
  }

  var instance = null;

  function mount(containerEl, initialState, callbacks) {
    if (!containerEl) return;

    if (instance && instance.cleanup) {
      instance.cleanup();
    }

    while (containerEl.firstChild) {
      containerEl.removeChild(containerEl.firstChild);
    }

    var state = Object.assign({
      theme: 'dark',
      gender: 'female',
      city: { id: 'tp_hcm', nameVi: 'TP. Hồ Chí Minh', latitude: 10.8231, longitude: 106.6297 },
      scenarioId: 'live',
      snapshot: null,
      decision: null,
      sprites: null,
      appOrigin: window.location.origin,
    }, initialState || {});

    var activeMode = 'widgets';
    var activeDevice = 'ios';
    var petOverride = null; // null | 'cat' | 'puppy'
    var pulseTimer = null;
    var cbs = callbacks || {};

    var rootEl = el('section', 'wb-ms-root', {
      'data-sim-theme': state.theme === 'light' ? 'light' : 'dark',
      'aria-label': 'Khung giả lập Điện thoại WeatherBuddy',
    });

    function pulseElement(targetNode) {
      if (!targetNode) return;
      targetNode.classList.add('wb-ms-widget-pulse');
      if (pulseTimer) window.clearTimeout(pulseTimer);
      pulseTimer = window.setTimeout(function () {
        targetNode.classList.remove('wb-ms-widget-pulse');
      }, 360);
    }

    // 1. Top Control Deck
    var controlsEl = el('div', 'wb-ms-controls');
    var topRowEl = el('div', 'wb-ms-top-row');

    var stageLabelEl = el('div', 'wb-ms-stage-label');
    stageLabelEl.appendChild(el('span', 'wb-ms-stage-dot'));
    var stageTitleText = el('span');
    stageTitleText.textContent = 'Khung Điện thoại Di động';
    stageLabelEl.appendChild(stageTitleText);

    var deviceSwitchEl = el('div', 'wb-ms-device-switch', {
      role: 'group',
      'aria-label': 'Chọn thiết bị điện thoại',
    });

    var deviceBtns = {};
    ['ios', 'android'].forEach(function (devKey) {
      var prof = DEVICE_PROFILES[devKey];
      var btn = el('button', 'wb-ms-device-btn', {
        type: 'button',
        'aria-pressed': devKey === activeDevice ? 'true' : 'false',
        title: prof.label,
      });
      btn.textContent = prof.label;
      btn.addEventListener('click', function () {
        if (activeDevice === devKey) return;
        activeDevice = devKey;
        syncDeviceProfile();
        recomputeScale();
        if (typeof cbs.onDeviceChange === 'function') {
          cbs.onDeviceChange(activeDevice);
        }
      });
      deviceBtns[devKey] = btn;
      deviceSwitchEl.appendChild(btn);
    });

    topRowEl.appendChild(stageLabelEl);
    topRowEl.appendChild(deviceSwitchEl);

    var modeBarEl = el('div', 'wb-ms-mode-bar', {
      role: 'tablist',
      'aria-label': 'Chế độ hiển thị điện thoại',
    });

    var modeBtns = {};
    SUB_MODES.forEach(function (m) {
      var btn = el('button', 'wb-ms-mode-btn', {
        type: 'button',
        role: 'tab',
        'aria-selected': m.id === activeMode ? 'true' : 'false',
      });
      btn.textContent = m.label;
      btn.addEventListener('click', function () {
        setSubMode(m.id);
      });
      modeBtns[m.id] = btn;
      modeBarEl.appendChild(btn);
    });

    controlsEl.appendChild(topRowEl);
    controlsEl.appendChild(modeBarEl);

    // 2. Phone Stage Slot + ResizeObserver Sizer + Hardware Chassis
    var stageSlotEl = el('div', 'wb-ms-stage-slot');
    var sizerEl = el('div', 'wb-ms-phone-sizer');
    var chassisEl = el('div', 'wb-ms-phone-chassis', { 'data-device': activeDevice });

    chassisEl.appendChild(el('span', 'wb-ms-hw-btn wb-ms-hw-action'));
    chassisEl.appendChild(el('span', 'wb-ms-hw-btn wb-ms-hw-vol-up'));
    chassisEl.appendChild(el('span', 'wb-ms-hw-btn wb-ms-hw-vol-down'));
    chassisEl.appendChild(el('span', 'wb-ms-hw-btn wb-ms-hw-power'));

    var bezelEl = el('div', 'wb-ms-phone-bezel');
    var screenEl = el('div', 'wb-ms-screen', { 'data-active-mode': activeMode });

    // Status Bar + Dynamic Island / Punch Hole
    var statusBarEl = el('div', 'wb-ms-statusbar', { 'data-mode': activeMode });
    var statusClockEl = el('span', 'wb-ms-status-clock');
    var statusIconsEl = createStatusIconsSvg();
    statusBarEl.appendChild(statusClockEl);
    statusBarEl.appendChild(statusIconsEl);

    var cameraCutoutEl = el('div', 'wb-ms-camera-cutout', { 'aria-hidden': 'true' });
    var islandDotEl = el('span', 'wb-ms-island-dot');
    var islandTempEl = el('span', 'wb-ms-island-temp');
    var islandLensEl = el('span', 'wb-ms-island-lens');
    cameraCutoutEl.appendChild(islandDotEl);
    cameraCutoutEl.appendChild(islandTempEl);
    cameraCutoutEl.appendChild(islandLensEl);

    // Pane 1 (Default): Interactive Home Screen & Live Chibi Widgets
    var paneWidgetsEl = el('div', 'wb-ms-pane wb-ms-pane-widgets wb-ms-wallpaper', {
      'data-sky': 'day_sunny',
    });

    var homeTopEl = el('div', 'wb-ms-home-top');

    // Medium 4x2 WeatherBuddy Widget (toggles to Lock Screen preview on tap)
    var widget4x2El = el('button', 'wb-ms-widget-4x2', {
      type: 'button',
      title: 'Chạm để xem thông báo trên Màn hình khóa',
      'aria-label': 'Widget WeatherBuddy 4x2 · Chạm để chuyển sang Màn hình khóa',
    });
    widget4x2El.addEventListener('click', function () {
      pulseElement(widget4x2El);
      setSubMode('lock');
    });

    var w4MainEl = el('div', 'wb-ms-w4-main');
    var w4InfoEl = el('div', 'wb-ms-w4-info');

    var w4CityRow = el('div', 'wb-ms-w4-city-row');
    var pinSvg = svgEl('svg', { width: '12', height: '12', viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' });
    pinSvg.appendChild(svgEl('path', {
      d: 'M8 14C8 14 13 9.8 13 6.2C13 3.4 10.8 1.2 8 1.2C5.2 1.2 3 3.4 3 6.2C3 9.8 8 14 8 14Z',
      stroke: 'currentColor',
      'stroke-width': '1.5',
    }));
    pinSvg.appendChild(svgEl('circle', { cx: '8', cy: '6.2', r: '1.8', fill: 'currentColor' }));
    var w4CityText = el('span');
    w4CityRow.appendChild(pinSvg);
    w4CityRow.appendChild(w4CityText);

    var w4TempRow = el('div', 'wb-ms-w4-temp-row');
    var w4TempEl = el('span', 'wb-ms-w4-temp');
    var w4FeelsEl = el('span', 'wb-ms-w4-feels');
    w4TempRow.appendChild(w4TempEl);
    w4TempRow.appendChild(w4FeelsEl);

    var w4CondEl = el('div', 'wb-ms-w4-cond');

    var w4OutfitEl = el('div', 'wb-ms-w4-outfit');
    var w4OutfitText = el('span');
    w4OutfitEl.appendChild(w4OutfitText);

    w4InfoEl.appendChild(w4CityRow);
    w4InfoEl.appendChild(w4TempRow);
    w4InfoEl.appendChild(w4CondEl);
    w4InfoEl.appendChild(w4OutfitEl);

    var w4ArtEl = el('div', 'wb-ms-w4-art');
    var w4CharImg = el('img', 'wb-ms-sprite-char', {
      alt: 'Nhân vật WeatherBuddy',
      decoding: 'async',
    });
    w4CharImg.addEventListener('error', function () {
      var fb = createSpriteFallbackDataUri('Buddy');
      if (w4CharImg.src !== fb) w4CharImg.src = fb;
    });
    w4ArtEl.appendChild(w4CharImg);

    w4MainEl.appendChild(w4InfoEl);
    w4MainEl.appendChild(w4ArtEl);

    var w4HourlyEl = el('div', 'wb-ms-w4-hourly');
    var hourlyCells = [];
    for (var hi = 0; hi < 4; hi += 1) {
      var cell = el('div', 'wb-ms-hour-cell');
      var hTime = el('span', 'wb-ms-hour-time');
      var hIcon = el('span', 'wb-ms-hour-icon');
      var hTemp = el('span', 'wb-ms-hour-temp');
      var hRain = el('span', 'wb-ms-hour-rain');
      cell.appendChild(hTime);
      cell.appendChild(hIcon);
      cell.appendChild(hTemp);
      cell.appendChild(hRain);
      w4HourlyEl.appendChild(cell);
      hourlyCells.push({ timeEl: hTime, iconEl: hIcon, tempEl: hTemp, rainEl: hRain });
    }

    widget4x2El.appendChild(w4MainEl);
    widget4x2El.appendChild(w4HourlyEl);

    // Home Mid Row: Small 2x2 Companion Widget + 2x2 OS App Cluster
    var homeMidEl = el('div', 'wb-ms-home-mid');

    var widget2x2El = el('button', 'wb-ms-widget-2x2', {
      type: 'button',
      title: 'Chạm để đổi thú cưng đồng hành Mèo Mây / Cún Nắng',
      'aria-label': 'Widget Thú cưng WeatherBuddy 2x2 · Chạm để đổi thú cưng',
    });
    widget2x2El.addEventListener('click', function () {
      var currentIsCat = widget2x2El.getAttribute('data-pet') === 'cat';
      petOverride = currentIsCat ? 'puppy' : 'cat';
      pulseElement(widget2x2El);
      renderStateDom();
    });

    var w2Header = el('div', 'wb-ms-w2-header');
    var w2TempEl = el('span', 'wb-ms-w2-temp');
    var w2PetTagEl = el('span', 'wb-ms-w2-pet-tag');
    w2Header.appendChild(w2TempEl);
    w2Header.appendChild(w2PetTagEl);

    var w2PetWrap = el('div', 'wb-ms-w2-pet-wrap');
    var w2PetImg = el('img', 'wb-ms-sprite-pet', {
      alt: 'Thú cưng đồng hành',
      decoding: 'async',
    });
    w2PetImg.addEventListener('error', function () {
      var fb = createSpriteFallbackDataUri('Pet');
      if (w2PetImg.src !== fb) w2PetImg.src = fb;
    });
    w2PetWrap.appendChild(w2PetImg);

    var w2Badges = el('div', 'wb-ms-w2-badges');
    var w2MetricEl = el('div', 'wb-ms-w2-metric');
    var w2SubEl = el('div', 'wb-ms-w2-sub');
    w2Badges.appendChild(w2MetricEl);
    w2Badges.appendChild(w2SubEl);

    widget2x2El.appendChild(w2Header);
    widget2x2El.appendChild(w2PetWrap);
    widget2x2El.appendChild(w2Badges);

    var appClusterEl = el('div', 'wb-ms-app-cluster-2x2');
    appClusterEl.appendChild(createAppTile('Bản đồ', 'linear-gradient(145deg, #24785A, #17523D)', 'M9 18L3 20V6L9 4M9 18L15 20M9 18V4M15 20L21 18V4L15 6M15 20V6M9 4L15 6'));
    appClusterEl.appendChild(createAppTile('Lịch trình', 'linear-gradient(145deg, #C84B39, #8F2F22)', 'M8 3V6M16 3V6M4 9H20M6 5H18C19.1 5 20 5.9 20 7V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V7C4 5.9 4.9 5 6 5Z'));
    appClusterEl.appendChild(createAppTile('Máy ảnh', 'linear-gradient(145deg, #435066, #273142)', 'M4 8H6.5L8.2 5.5H15.8L17.5 8H20C20.8 8 21.5 8.7 21.5 9.5V18.5C21.5 19.3 20.8 20 20 20H4C3.2 20 2.5 19.3 2.5 18.5V9.5C2.5 8.7 3.2 8 4 8ZM12 16.5C13.9 16.5 15.5 14.9 15.5 13C15.5 11.1 13.9 9.5 12 9.5C10.1 9.5 8.5 11.1 8.5 13C8.5 14.9 10.1 16.5 12 16.5Z'));
    appClusterEl.appendChild(createAppTile('Đồng hồ', 'linear-gradient(145deg, #273449, #131B28)', 'M12 6V12L15.5 14M21 12C21 16.97 16.97 21 12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C16.97 3 21 7.03 21 12Z'));

    homeMidEl.appendChild(widget2x2El);
    homeMidEl.appendChild(appClusterEl);

    var appRow4El = el('div', 'wb-ms-app-row-4');
    appRow4El.appendChild(createAppTile('Tin nhắn', 'linear-gradient(145deg, #258A52, #18633A)', 'M20 12C20 16 16.4 19.2 12 19.2C10.7 19.2 9.5 18.9 8.4 18.5L4 19.8L5.3 16.1C4.5 14.9 4 13.5 4 12C4 8 7.6 4.8 12 4.8C16.4 4.8 20 8 20 12Z'));
    appRow4El.appendChild(createAppTile('Ghi chú', 'linear-gradient(145deg, #D99B26, #A87014)', 'M6 4H18C19.1 4 20 4.9 20 6V18C20 19.1 19.1 20 18 20H6C4.9 20 4 19.1 4 18V6C4 4.9 4.9 4 6 4ZM8 9H16M8 13H16M8 17H12'));
    appRow4El.appendChild(createAppTile('Sức khỏe', 'linear-gradient(145deg, #C74350, #8F2833)', 'M12 20.2C12 20.2 4.5 15.2 4.5 9.3C4.5 6.8 6.5 4.8 9 4.8C10.5 4.8 11.8 5.6 12 6.8C12.2 5.6 13.5 4.8 15 4.8C17.5 4.8 19.5 6.8 19.5 9.3C19.5 15.2 12 20.2 12 20.2Z'));
    appRow4El.appendChild(createAppTile('Cài đặt', 'linear-gradient(145deg, #526178, #333E50)', 'M12 15C13.66 15 15 13.66 15 12C15 10.34 13.66 9 12 9C10.34 9 9 10.34 9 12C9 13.66 10.34 15 12 15ZM19.4 15L20.8 17.4L18.4 19.8L16 18.4C15.1 18.9 14.1 19.2 13 19.4L12.4 22H9.6L9 19.4C7.9 19.2 6.9 18.9 6 18.4L3.6 19.8L1.2 17.4L2.6 15C2.1 14.1 1.8 13.1 1.6 12L4.2 11.4'));

    homeTopEl.appendChild(widget4x2El);
    homeTopEl.appendChild(homeMidEl);
    homeTopEl.appendChild(appRow4El);

    var homeBottomEl = el('div', 'wb-ms-home-bottom');
    var tapHintEl = el('div', 'wb-ms-tap-hint');
    tapHintEl.textContent = 'Chạm Widget 2×2 đổi thú cưng · Chạm 4×2 xem Màn hình khóa';

    var dockEl = el('div', 'wb-ms-dock');
    dockEl.appendChild(createAppTile('', 'linear-gradient(145deg, #278C56, #176139)', 'M6.6 10.8C8.1 13.6 10.4 15.9 13.2 17.4L15.4 15.2C15.7 14.9 16.1 14.8 16.5 14.9C17.6 15.3 18.8 15.5 20 15.5C20.6 15.5 21 15.9 21 16.5V20C21 20.6 20.6 21 20 21C10.6 21 3 13.4 3 4C3 3.4 3.4 3 4 3H7.5C8.1 3 8.5 3.4 8.5 4C8.5 5.2 8.7 6.4 9.1 7.5C9.2 7.9 9.1 8.3 8.8 8.6L6.6 10.8Z'));
    dockEl.appendChild(createAppTile('', 'linear-gradient(145deg, #2874C7, #1A4E8C)', 'M12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21ZM14.8 9.2L13.2 13.2L9.2 14.8L10.8 10.8L14.8 9.2Z'));
    dockEl.appendChild(createAppTile('WeatherBuddy', 'linear-gradient(145deg, #2E7AD1, #194C8A)', 'M7 16.5H16.2C18 16.5 19.5 15 19.5 13.2C19.5 11.5 18.2 10.1 16.5 10C15.9 7.7 13.8 6 11.3 6C8.6 6 6.4 8 6 10.6C4.4 10.9 3.2 12.2 3.2 13.9C3.2 15.4 4.5 16.5 6.2 16.5H7Z', function () {
      pulseElement(widget4x2El);
    }));
    dockEl.appendChild(createAppTile('', 'linear-gradient(145deg, #BA463C, #852A23)', 'M9 18V6L20 4V16M9 18C9 19.66 7.66 21 6 21C4.34 21 3 19.66 3 18C3 16.34 4.34 15 6 15C7.66 15 9 16.34 9 18ZM20 16C20 17.66 18.66 19 17 19C15.34 19 14 17.66 14 16C14 14.34 15.34 13 17 13C18.66 13 20 14.34 20 16Z'));

    // Keep dock icons clean without text labels
    var wbDockLabel = dockEl.children[2] && dockEl.children[2].querySelector('.wb-ms-app-name');
    if (wbDockLabel) {
      dockEl.children[2].removeChild(wbDockLabel);
    }

    homeBottomEl.appendChild(tapHintEl);
    homeBottomEl.appendChild(dockEl);

    paneWidgetsEl.appendChild(homeTopEl);
    paneWidgetsEl.appendChild(homeBottomEl);

    // Pane 2: Lock Screen + Complications + Proactive Notification Banner
    var paneLockEl = el('div', 'wb-ms-pane wb-ms-pane-lock wb-ms-wallpaper', {
      'data-sky': 'day_sunny',
    });

    var lockTopEl = el('div', 'wb-ms-lock-top');
    var lockPillEl = el('div', 'wb-ms-lock-pill');
    var lockSvg = svgEl('svg', { width: '12', height: '13', viewBox: '0 0 14 15', fill: 'none', 'aria-hidden': 'true' });
    lockSvg.appendChild(svgEl('rect', { x: '2', y: '6.5', width: '10', height: '7.5', rx: '2', stroke: 'currentColor', 'stroke-width': '1.5' }));
    lockSvg.appendChild(svgEl('path', { d: 'M4.5 6.5V4.5C4.5 3.1 5.6 2 7 2C8.4 2 9.5 3.1 9.5 4.5V6.5', stroke: 'currentColor', 'stroke-width': '1.5' }));
    var lockCityTextEl = el('span');
    lockPillEl.appendChild(lockSvg);
    lockPillEl.appendChild(lockCityTextEl);

    var lockDateEl = el('div', 'wb-ms-lock-date');
    var lockClockEl = el('div', 'wb-ms-lock-clock');

    var lockCompsEl = el('div', 'wb-ms-lock-complications');

    // Rectangular Range Complication
    var compRangeEl = el('div', 'wb-ms-comp-card');
    var compRangeLabel = el('span', 'wb-ms-comp-label');
    compRangeLabel.textContent = 'Biên độ nhiệt';
    var compRangeValEl = el('span', 'wb-ms-comp-val');
    var compRangeBar = el('div', 'wb-ms-comp-range-bar');
    compRangeBar.appendChild(el('div', 'wb-ms-comp-range-fill'));
    compRangeEl.appendChild(compRangeLabel);
    compRangeEl.appendChild(compRangeValEl);
    compRangeEl.appendChild(compRangeBar);

    // UV Circular Complication
    var compUvEl = el('div', 'wb-ms-comp-card wb-ms-comp-circle');
    var compUvLabel = el('span', 'wb-ms-comp-label');
    compUvLabel.textContent = 'Tia UV';
    var compUvValEl = el('span', 'wb-ms-comp-val');
    var compUvSubEl = el('span', 'wb-ms-comp-sub');
    compUvEl.appendChild(compUvLabel);
    compUvEl.appendChild(compUvValEl);
    compUvEl.appendChild(compUvSubEl);

    // Rain Circular Complication
    var compRainEl = el('div', 'wb-ms-comp-card wb-ms-comp-circle');
    var compRainLabel = el('span', 'wb-ms-comp-label');
    compRainLabel.textContent = 'Mưa';
    var compRainValEl = el('span', 'wb-ms-comp-val');
    var compRainSubEl = el('span', 'wb-ms-comp-sub');
    compRainEl.appendChild(compRainLabel);
    compRainEl.appendChild(compRainValEl);
    compRainEl.appendChild(compRainSubEl);

    lockCompsEl.appendChild(compRangeEl);
    lockCompsEl.appendChild(compUvEl);
    lockCompsEl.appendChild(compRainEl);

    // Sunrise / Sunset Strip
    var lockSunStripEl = el('div', 'wb-ms-lock-sun-strip');
    var sunRiseSpan = el('span');
    var sunSetSpan = el('span');
    var sunHumSpan = el('span');
    lockSunStripEl.appendChild(sunRiseSpan);
    lockSunStripEl.appendChild(sunSetSpan);
    lockSunStripEl.appendChild(sunHumSpan);

    lockTopEl.appendChild(lockPillEl);
    lockTopEl.appendChild(lockDateEl);
    lockTopEl.appendChild(lockClockEl);
    lockTopEl.appendChild(lockCompsEl);
    lockTopEl.appendChild(lockSunStripEl);

    // Proactive Notification Banner (unlocks to Home & Widgets on tap)
    var lockMiddleEl = el('div', 'wb-ms-lock-middle');
    var notifBannerEl = el('button', 'wb-ms-notif-banner', {
      type: 'button',
      title: 'Chạm thông báo để mở Màn hình chính & Widget',
      'aria-label': 'Thông báo thời tiết WeatherBuddy · Chạm để mở Màn hình chính và Widget',
    });
    notifBannerEl.addEventListener('click', function () {
      setSubMode('widgets');
      pulseElement(widget4x2El);
    });

    var notifTopEl = el('div', 'wb-ms-notif-top');
    var notifAppWrap = el('span', 'wb-ms-notif-app');
    var notifAppBadge = el('span', 'wb-ms-notif-app-badge');
    var miniSun = svgEl('svg', { width: '11', height: '11', viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' });
    miniSun.appendChild(svgEl('circle', { cx: '8', cy: '8', r: '4', fill: '#F5CE84' }));
    notifAppBadge.appendChild(miniSun);
    var notifAppTitle = el('span');
    notifAppTitle.textContent = 'WEATHERBUDDY · TRỢ LÝ TRANG PHỤC';
    notifAppWrap.appendChild(notifAppBadge);
    notifAppWrap.appendChild(notifAppTitle);

    var notifTimeEl = el('span');
    notifTimeEl.textContent = 'Bây giờ';
    notifTopEl.appendChild(notifAppWrap);
    notifTopEl.appendChild(notifTimeEl);

    var notifBodyEl = el('div', 'wb-ms-notif-body');
    var notifAvatarWrap = el('div', 'wb-ms-notif-avatar-wrap');
    var notifAvatarImg = el('img', 'wb-ms-notif-avatar', {
      alt: 'Ảnh đại diện nhân vật WeatherBuddy',
      decoding: 'async',
    });
    notifAvatarImg.addEventListener('error', function () {
      var fb = createSpriteFallbackDataUri('Buddy');
      if (notifAvatarImg.src !== fb) notifAvatarImg.src = fb;
    });
    notifAvatarWrap.appendChild(notifAvatarImg);

    var notifCopyEl = el('div', 'wb-ms-notif-copy');
    var notifHeadlineEl = el('div', 'wb-ms-notif-headline');
    var notifOutfitEl = el('div', 'wb-ms-notif-outfit');
    var notifAlertTagEl = el('div', 'wb-ms-notif-alert-tag');

    notifCopyEl.appendChild(notifHeadlineEl);
    notifCopyEl.appendChild(notifOutfitEl);
    notifCopyEl.appendChild(notifAlertTagEl);

    notifBodyEl.appendChild(notifAvatarWrap);
    notifBodyEl.appendChild(notifCopyEl);

    notifBannerEl.appendChild(notifTopEl);
    notifBannerEl.appendChild(notifBodyEl);
    lockMiddleEl.appendChild(notifBannerEl);

    // Lock Screen Bottom Shortcuts
    var lockBottomEl = el('div', 'wb-ms-lock-bottom');
    var torchIconWrap = el('span', 'wb-ms-lock-shortcut', { 'aria-hidden': 'true' });
    var torchSvg = svgEl('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none' });
    torchSvg.appendChild(svgEl('path', {
      d: 'M8 3H16L14.5 9V20C14.5 20.6 14.1 21 13.5 21H10.5C9.9 21 9.5 20.6 9.5 20V9L8 3ZM8.5 6H15.5',
      stroke: 'currentColor',
      'stroke-width': '1.8',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }));
    torchIconWrap.appendChild(torchSvg);

    var lockSwipeTextEl = el('span', 'wb-ms-lock-swipe-text');
    lockSwipeTextEl.textContent = 'Chạm thông báo để mở Màn hình chính';

    var camIconWrap = el('span', 'wb-ms-lock-shortcut', { 'aria-hidden': 'true' });
    var camSvg = svgEl('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none' });
    camSvg.appendChild(svgEl('path', {
      d: 'M4 8H6.5L8.2 5.5H15.8L17.5 8H20C20.8 8 21.5 8.7 21.5 9.5V18.5C21.5 19.3 20.8 20 20 20H4C3.2 20 2.5 19.3 2.5 18.5V9.5C2.5 8.7 3.2 8 4 8Z',
      stroke: 'currentColor',
      'stroke-width': '1.8',
    }));
    camSvg.appendChild(svgEl('circle', { cx: '12', cy: '13.5', r: '3', stroke: 'currentColor', 'stroke-width': '1.8' }));
    camIconWrap.appendChild(camSvg);

    lockBottomEl.appendChild(torchIconWrap);
    lockBottomEl.appendChild(lockSwipeTextEl);
    lockBottomEl.appendChild(camIconWrap);

    paneLockEl.appendChild(lockTopEl);
    paneLockEl.appendChild(lockMiddleEl);
    paneLockEl.appendChild(lockBottomEl);

    var homeBarEl = el('div', 'wb-ms-home-bar', { 'aria-hidden': 'true' });

    screenEl.appendChild(statusBarEl);
    screenEl.appendChild(cameraCutoutEl);
    screenEl.appendChild(paneWidgetsEl);
    screenEl.appendChild(paneLockEl);
    screenEl.appendChild(homeBarEl);

    bezelEl.appendChild(screenEl);
    chassisEl.appendChild(bezelEl);
    sizerEl.appendChild(chassisEl);
    stageSlotEl.appendChild(sizerEl);

    // 3. Telemetry Footer below Phone
    var footerEl = el('div', 'wb-ms-footer-actions');
    var viewportMetaEl = el('span', 'wb-ms-viewport-meta');
    footerEl.appendChild(viewportMetaEl);

    rootEl.appendChild(controlsEl);
    rootEl.appendChild(stageSlotEl);
    rootEl.appendChild(footerEl);
    containerEl.appendChild(rootEl);

    function setSubMode(nextMode) {
      if (!modeBtns[nextMode]) return;
      activeMode = nextMode;
      screenEl.setAttribute('data-active-mode', activeMode);
      statusBarEl.setAttribute('data-mode', activeMode);
      SUB_MODES.forEach(function (m) {
        modeBtns[m.id].setAttribute('aria-selected', m.id === activeMode ? 'true' : 'false');
      });
      if (typeof cbs.onModeChange === 'function') {
        cbs.onModeChange(activeMode);
      }
    }

    function syncDeviceProfile() {
      chassisEl.setAttribute('data-device', activeDevice);
      Object.keys(deviceBtns).forEach(function (k) {
        deviceBtns[k].setAttribute('aria-pressed', k === activeDevice ? 'true' : 'false');
      });
    }

    function recomputeScale() {
      var prof = DEVICE_PROFILES[activeDevice] || DEVICE_PROFILES.ios;
      var slotRect = stageSlotEl.getBoundingClientRect();
      var rootRect = containerEl.getBoundingClientRect();
      var measuredW = (slotRect && slotRect.width) || (rootRect && rootRect.width) || 360;
      var availW = Math.max(220, measuredW - 12);
      var winH = window.innerHeight || 844;
      var vhBudget = Math.max(420, Math.min(winH * 0.72, 760));

      var scaleW = availW / prof.outerW;
      var scaleH = vhBudget / prof.outerH;
      var scale = Math.min(1, scaleW, scaleH);
      scale = Math.max(0.32, Math.round(scale * 1000) / 1000);

      chassisEl.style.transform = 'scale(' + scale + ')';
      sizerEl.style.width = Math.round(prof.outerW * scale) + 'px';
      sizerEl.style.height = Math.round(prof.outerH * scale) + 'px';

      viewportMetaEl.textContent =
        prof.screenW + ' × ' + prof.screenH + ' px · Tỷ lệ ' + Math.round(scale * 100) + '%';
    }

    function syncClockDom() {
      var vn = formatVietnamNow();
      statusClockEl.textContent = vn.hhmm;
      lockClockEl.textContent = vn.hhmm;
      lockDateEl.textContent = vn.dateVi;
    }

    function renderStateDom() {
      var theme = state.theme === 'light' ? 'light' : 'dark';
      rootEl.setAttribute('data-sim-theme', theme);

      var snap = state.snapshot || {};
      var dec = state.decision || {};
      var cityName = sanitizeVi(
        (state.city && state.city.nameVi) || snap.locationName || 'TP. Hồ Chí Minh'
      );

      var tempC = roundInt(snap.temperatureC, 28);
      var feelsC = roundInt(snap.feelsLikeC, tempC + 1);
      var humidityPct = roundInt(snap.humidityPct, 68);
      var uvIndex = roundInt(snap.uvIndex, 5);
      var precipProb = roundInt(snap.precipProbPct, 15);
      var dewPointC = Number.isFinite(Number(snap.dewPointC))
        ? Math.round(Number(snap.dewPointC))
        : Math.round(tempC - (100 - humidityPct) / 5);
      var aqi = Number.isFinite(Number(snap.aqi)) ? Math.round(Number(snap.aqi)) : null;

      var skyTheme = dec.skyTheme || (snap.isDay === false ? 'night' : 'day_sunny');
      paneWidgetsEl.setAttribute('data-sky', skyTheme);
      paneLockEl.setAttribute('data-sky', skyTheme);

      islandTempEl.textContent = tempC + '°';

      var headlineVi = sanitizeVi(dec.headlineVi || snap.conditionText || 'Thời tiết dễ chịu');
      var outfitVi = sanitizeVi(
        dec.outfitAdviceVi || dec.outfitVi || dec.adviceVi || 'Mặc trang phục thoáng nhẹ thoải mái'
      );
      var condVi = sanitizeVi(snap.conditionText || stripLeadingEmoji(dec.badgeVi) || headlineVi);
      var hasRainProp = Boolean(dec.hasRainAheadProp);
      var hasMask = Boolean(dec.hasAqiMask || dec.shouldWearMask);

      // Sprites
      var sprites = resolveSpriteUrls(state);
      if (w4CharImg.getAttribute('data-src-key') !== sprites.character) {
        w4CharImg.setAttribute('data-src-key', sprites.character);
        w4CharImg.src = sprites.character;
      }
      if (notifAvatarImg.getAttribute('data-src-key') !== sprites.character) {
        notifAvatarImg.setAttribute('data-src-key', sprites.character);
        notifAvatarImg.src = sprites.character;
      }

      var defaultCat =
        dec.sceneId === 'clear_night' ||
        dec.sceneId === 'chilly_cozy' ||
        dec.sceneId === 'freezing_puffer' ||
        dec.sceneId === 'light_rain_umbrella' ||
        dec.sceneId === 'storm_raincoat';
      var useCat = petOverride ? (petOverride === 'cat') : defaultCat;
      widget2x2El.setAttribute('data-pet', useCat ? 'cat' : 'puppy');

      var petSpriteUrl = useCat ? sprites.cat : sprites.puppy;
      if (w2PetImg.getAttribute('data-src-key') !== petSpriteUrl) {
        w2PetImg.setAttribute('data-src-key', petSpriteUrl);
        w2PetImg.src = petSpriteUrl;
      }

      // Update Medium 4x2 Widget
      w4CityText.textContent = cityName;
      w4TempEl.textContent = tempC + '°';
      w4FeelsEl.textContent = 'Cảm giác ' + feelsC + '°';
      w4CondEl.textContent = condVi;
      w4OutfitText.textContent = outfitVi;

      var hourlyList = Array.isArray(snap.hourly) ? snap.hourly : [];
      for (var i = 0; i < 4; i += 1) {
        var slot = hourlyList[i] || null;
        var cellObj = hourlyCells[i];
        cellObj.timeEl.textContent = slot
          ? formatHourSlotLabel(slot.timeIso, i + 1)
          : formatHourSlotLabel(null, i + 1);
        var hTempVal = slot ? roundInt(slot.temperatureC, tempC) : (tempC + (i === 1 ? 1 : 0));
        var hRainProb = slot ? roundInt(slot.precipProbPct, precipProb) : precipProb;
        cellObj.tempEl.textContent = hTempVal + '°';
        cellObj.rainEl.textContent = hRainProb >= 15 ? (hRainProb + '%') : ' ';

        while (cellObj.iconEl.firstChild) {
          cellObj.iconEl.removeChild(cellObj.iconEl.firstChild);
        }
        cellObj.iconEl.appendChild(
          createMiniWeatherSvg(slot ? slot.conditionCode : dec.sceneId, hRainProb)
        );
      }

      // Update Small 2x2 Companion Widget
      w2TempEl.textContent = tempC + '°';
      w2PetTagEl.textContent = useCat ? 'Mèo Mây' : 'Cún Nắng';
      if (aqi !== null && aqi > 0) {
        w2MetricEl.textContent = 'AQI ' + aqi + ' · UV ' + uvIndex;
      } else {
        w2MetricEl.textContent = 'UV ' + uvIndex + ' · Ẩm ' + humidityPct + '%';
      }
      w2SubEl.textContent = 'Điểm sương ' + dewPointC + '°C · ' + cityName;

      // Update Lock Screen Complications & Notification
      lockCityTextEl.textContent = cityName;

      var minTemp = tempC - 3;
      var maxTemp = tempC + 3;
      if (Array.isArray(snap.daily) && snap.daily[0]) {
        minTemp = roundInt(snap.daily[0].tempMinC, minTemp);
        maxTemp = roundInt(snap.daily[0].tempMaxC, maxTemp);
      } else if (hourlyList.length >= 4) {
        var temps = hourlyList.slice(0, 12).map(function (p) { return Number(p.temperatureC); }).filter(Number.isFinite);
        if (temps.length > 0) {
          minTemp = Math.round(Math.min.apply(null, temps));
          maxTemp = Math.round(Math.max.apply(null, temps));
        }
      }
      compRangeValEl.textContent = 'Thấp ' + minTemp + '° · Cao ' + maxTemp + '°';

      compUvValEl.textContent = String(uvIndex);
      compUvSubEl.textContent = uvIndex >= 8 ? 'Rất cao' : uvIndex >= 6 ? 'Cao' : uvIndex >= 3 ? 'Vừa' : 'Thấp';

      compRainValEl.textContent = precipProb + '%';
      var mmHr = Number(snap.precipMmPerHr) || 0;
      compRainSubEl.textContent = mmHr > 0 ? (mmHr.toFixed(1) + ' mm/h') : (precipProb >= 50 ? 'Dễ mưa' : 'Khô ráo');

      var sunriseVi = sanitizeVi(
        snap.sunriseTimeVi || (snap.daily && snap.daily[0] && snap.daily[0].sunriseTimeVi) || '05:45'
      );
      var sunsetVi = sanitizeVi(
        snap.sunsetTimeVi || (snap.daily && snap.daily[0] && snap.daily[0].sunsetTimeVi) || '18:05'
      );
      sunRiseSpan.textContent = 'Bình minh ' + sunriseVi;
      sunSetSpan.textContent = 'Hoàng hôn ' + sunsetVi;
      sunHumSpan.textContent = 'Độ ẩm ' + humidityPct + '%';

      notifHeadlineEl.textContent = headlineVi + ' · ' + tempC + '°C tại ' + cityName;
      notifOutfitEl.textContent = outfitVi;

      if (hasRainProp && hasMask) {
        notifAlertTagEl.style.display = 'inline-flex';
        notifAlertTagEl.textContent = 'Sắp có mưa trong vài giờ tới · Khuyến nghị đeo khẩu trang';
      } else if (hasRainProp) {
        notifAlertTagEl.style.display = 'inline-flex';
        var hrs = Number(dec.rainAheadHours);
        notifAlertTagEl.textContent = Number.isFinite(hrs) && hrs > 0
          ? ('Dự báo có mưa sau khoảng ' + hrs + ' giờ nữa · Nhớ mang ô')
          : 'Cảnh báo sắp có mưa · Nhớ mang theo ô gọn';
      } else if (hasMask) {
        notifAlertTagEl.style.display = 'inline-flex';
        notifAlertTagEl.textContent = 'Chất lượng không khí kém · Nên đeo khẩu trang khi ra ngoài';
      } else if (uvIndex >= 7) {
        notifAlertTagEl.style.display = 'inline-flex';
        notifAlertTagEl.textContent = 'Chỉ số UV ' + uvIndex + ' cao · Ưu tiên áo chống nắng và kính râm';
      } else {
        notifAlertTagEl.style.display = 'none';
        notifAlertTagEl.textContent = '';
      }
    }

    var ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(function () {
        recomputeScale();
      });
      ro.observe(containerEl);
    }

    var onWinResize = function () {
      recomputeScale();
    };
    window.addEventListener('resize', onWinResize);

    var clockTimer = window.setInterval(syncClockDom, 15000);

    syncClockDom();
    renderStateDom();
    recomputeScale();

    instance = {
      update: function (nextState) {
        if (!nextState || typeof nextState !== 'object') return;
        if (nextState.scenarioId && nextState.scenarioId !== state.scenarioId) {
          petOverride = null;
        }
        state = Object.assign({}, state, nextState);
        renderStateDom();
      },
      cleanup: function () {
        if (ro) ro.disconnect();
        if (pulseTimer) window.clearTimeout(pulseTimer);
        window.removeEventListener('resize', onWinResize);
        window.clearInterval(clockTimer);
      },
    };
  }

  function update(nextState) {
    if (instance && typeof instance.update === 'function') {
      instance.update(nextState);
    }
  }

  window.WeatherBuddyMobileStage = {
    mount: mount,
    update: update,
  };
})();
