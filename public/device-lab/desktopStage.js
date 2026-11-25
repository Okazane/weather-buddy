/* WeatherBuddy Device Studio - Interactive 27" Desktop Screen Simulator Stage
 * Exposes window.WeatherBuddyDesktopStage = { mount(containerEl, initialState, callbacks), update(nextState) }
 */
(function () {
  'use strict';

  var VIRTUAL_WIDTH = 1440;
  var VIRTUAL_HEIGHT = 900;
  var WORKSPACE_HEIGHT = 852; // 900px screen minus 48px Windows 11 taskbar
  var SNAP_MARGIN = 22;

  var SVG_ICONS = {
    monitor:
      '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><rect x="32" y="48" width="192" height="144" rx="16" opacity="0.2"/><path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24h72v16H96a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16H136V200h72a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40ZM48,56H208a8,8,0,0,1,8,8V176a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64A8,8,0,0,1,48,56Z"/></svg>',
    winStart:
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="8.2" height="8.2" rx="1.6" fill="#3B91E6"/><rect x="12.8" y="3" width="8.2" height="8.2" rx="1.6" fill="#5AA8F5"/><rect x="3" y="12.8" width="8.2" height="8.2" rx="1.6" fill="#267FD4"/><rect x="12.8" y="12.8" width="8.2" height="8.2" rx="1.6" fill="#3B91E6"/></svg>',
    search:
      '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/></svg>',
    sunCloud:
      '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M160,72a76,76,0,0,0-74.7,62.13A52,52,0,1,0,84,236h76a76,76,0,0,0,0-152Z" opacity="0.22"/><path d="M160,64A84.08,84.08,0,0,0,81.29,119.3,60,60,0,1,0,84,236h76a84,84,0,0,0,0-172Zm0,156H84a44,44,0,1,1,4.88-87.73,8,8,0,0,0,8.52-6A68,68,0,1,1,160,220Z"/></svg>',
    rain:
      '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M160,48A76.08,76.08,0,0,0,87.46,101.4,52,52,0,1,0,84,200h76a76,76,0,0,0,0-152Zm-33.34,186.24-16,24a8,8,0,0,1-13.32-8.88l16-24a8,8,0,1,1,13.32,8.88Zm48,0-16,24a8,8,0,0,1-13.32-8.88l16-24a8,8,0,1,1,13.32,8.88Z"/></svg>',
    moon:
      '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M235.54,150.21a104.84,104.84,0,0,1-37,52.91A104,104,0,0,1,32,120,103.09,103.09,0,0,1,52.88,57.48a104.84,104.84,0,0,1,52.91-37,8,8,0,0,1,10,10,88.08,88.08,0,0,0,109.8,109.8,8,8,0,0,1,10,10Z"/></svg>',
    browser:
      '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><circle cx="128" cy="128" r="96" opacity="0.2"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm87.63,96H175.8a135.28,135.28,0,0,0-22.3-69.08A88.29,88.29,0,0,1,215.63,120ZM128,215.89c-14.32-15.93-27.71-42.68-31.59-79.89h63.18C155.71,173.21,142.32,200,128,215.89ZM96.41,120C100.29,82.79,113.68,56,128,40.11,142.32,56,155.71,82.79,159.59,120Zm6.09-69.08A135.28,135.28,0,0,0,80.2,120H40.37A88.29,88.29,0,0,1,102.5,50.92ZM40.37,136H80.2a135.28,135.28,0,0,0,22.3,69.08A88.29,88.29,0,0,1,40.37,136Zm113.13,69.08A135.28,135.28,0,0,0,175.8,136h39.83A88.29,88.29,0,0,1,153.5,205.08Z"/></svg>',
    widget:
      '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><rect x="40" y="40" width="72" height="72" rx="12" opacity="0.25"/><path d="M104,32H48A16,16,0,0,0,32,48v56a16,16,0,0,0,16,16h56a16,16,0,0,0,16-16V48A16,16,0,0,0,104,32Zm0,72H48V48h56Zm104-72H152a16,16,0,0,0-16,16v56a16,16,0,0,0,16,16h56a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32Zm0,72H152V48h56ZM104,136H48a16,16,0,0,0-16,16v56a16,16,0,0,0,16,16h56a16,16,0,0,0,16-16V152A16,16,0,0,0,104,136Zm0,72H48V152h56Zm104-72H152a16,16,0,0,0-16,16v56a16,16,0,0,0,16,16h56a16,16,0,0,0,16-16V152A16,16,0,0,0,208,136Zm0,72H152V152h56Z"/></svg>',
    shirt:
      '<svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M245.57,70.84l-42.73-32A15.92,15.92,0,0,0,192,36H160a8,8,0,0,0-8,8,24,24,0,0,1-48,0,8,8,0,0,0-8-8H64a15.92,15.92,0,0,0-10.84,2.84l-42.73,32a16,16,0,0,0-4.08,21.52l20,31.11a16,16,0,0,0,21.22,5.32L64,119.3V208a16,16,0,0,0,16,16h96a16,16,0,0,0,16-16V119.3l16.43,9.49a16,16,0,0,0,21.22-5.32l20-31.11A16,16,0,0,0,245.57,70.84Z"/></svg>',
    reload:
      '<svg width="13" height="13" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/></svg>',
    wifi:
      '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M140,204a12,12,0,1,1-12-12A12,12,0,0,1,140,204ZM237.08,87A172,172,0,0,0,18.92,87,8,8,0,0,0,29.08,99.37a156,156,0,0,1,197.84,0A8,8,0,0,0,237.08,87ZM205,122.77a124,124,0,0,0-153.94,0A8,8,0,0,0,61,135.31a108,108,0,0,1,134.06,0A8,8,0,0,0,205,122.77Zm-32.22,35.76a76.05,76.05,0,0,0-89.42,0,8,8,0,0,0,9.42,12.94,60,60,0,0,1,70.58,0,8,8,0,1,0,9.42-12.94Z"/></svg>',
    speaker:
      '<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM144,207.64,84.91,161.69A7.94,7.94,0,0,0,80,160H32V96H80a7.94,7.94,0,0,0,4.91-1.69L144,48.36ZM208,128a39.93,39.93,0,0,1-10,26.46,8,8,0,0,1-12-10.58,24,24,0,0,0,0-31.76,8,8,0,1,1,12-10.58A39.93,39.93,0,0,1,208,128Z"/></svg>',
    folder:
      '<svg width="20" height="20" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M216,72H131.31L104,44.69A15.86,15.86,0,0,0,92.69,40H40A16,16,0,0,0,24,56V200.62A15.4,15.4,0,0,0,39.38,216H216.89A15.13,15.13,0,0,0,232,200.89V88A16,16,0,0,0,216,72Z"/></svg>'
  };

  function sanitizeText(val) {
    if (val === null || val === undefined) return '';
    return String(val).replace(/\s*[\u2014\u2013]\s*/g, ' - ');
  }

  function escapeHtml(val) {
    return sanitizeText(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function computeDewPointC(tempC, humidityPct) {
    var t = Number.isFinite(tempC) ? tempC : 27;
    var rh = Number.isFinite(humidityPct) ? Math.max(5, Math.min(100, humidityPct)) : 70;
    var a = 17.625;
    var b = 243.04;
    var alpha = Math.log(rh / 100) + (a * t) / (b + t);
    return Math.round((b * alpha) / (a - alpha));
  }

  function getVietnamClockParts() {
    var now = new Date();
    var vnMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (7 * 3600000);
    var vn = new Date(vnMs);
    var hh = vn.getHours();
    var mm = vn.getMinutes();
    var dd = vn.getDate();
    var mo = vn.getMonth() + 1;
    var yyyy = vn.getFullYear();
    var dow = vn.getDay();
    var dowNames = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };

    var greeting = 'Chào buổi sáng';
    if (hh >= 5 && hh < 11) greeting = 'Chào buổi sáng';
    else if (hh >= 11 && hh < 14) greeting = 'Chào buổi trưa';
    else if (hh >= 14 && hh < 18) greeting = 'Chào buổi chiều';
    else if (hh >= 18 && hh < 22) greeting = 'Chào buổi tối';
    else greeting = 'Đêm khuya an lành';

    return {
      hour: hh,
      timeStr: pad(hh) + ':' + pad(mm),
      shortDateStr: pad(dd) + '/' + pad(mo) + '/' + yyyy,
      longDateStr: dowNames[dow] + ', ' + pad(dd) + ' tháng ' + pad(mo) + ', ' + yyyy,
      greeting: greeting
    };
  }

  function formatHourLabel(isoStr, fallbackIdx) {
    if (typeof isoStr === 'string') {
      var m = isoStr.match(/T(\d{2}):(\d{2})/);
      if (m) return m[1] + ':' + m[2];
    }
    var clk = getVietnamClockParts();
    var h = (clk.hour + fallbackIdx + 1) % 24;
    return (h < 10 ? '0' + h : String(h)) + ':00';
  }

  function formatDayNameVi(dateIso, idx) {
    if (idx === 0) return 'Hôm nay';
    if (idx === 1) return 'Ngày mai';
    if (typeof dateIso === 'string') {
      var parsed = Date.parse(dateIso + (dateIso.indexOf('T') === -1 ? 'T00:00:00Z' : ''));
      if (Number.isFinite(parsed)) {
        var d = new Date(parsed);
        var names = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
        var dd = d.getUTCDate();
        var mm = d.getUTCMonth() + 1;
        return names[d.getUTCDay()] + ' · ' + (dd < 10 ? '0' + dd : dd) + '/' + (mm < 10 ? '0' + mm : mm);
      }
    }
    return 'Ngày +' + idx;
  }

  function resolveSpriteSrc(rawSpriteUrl, fallbackBasename) {
    if (typeof rawSpriteUrl === 'string' && rawSpriteUrl.trim()) {
      return rawSpriteUrl.trim();
    }
    return '/api/character-sprite?file=' + encodeURIComponent(fallbackBasename);
  }

  function createFallbackState() {
    return {
      theme: 'dark',
      gender: 'female',
      city: { id: 'tp_hcm', nameVi: 'TP. Hồ Chí Minh', latitude: 10.8231, longitude: 106.6297 },
      scenarioId: 'live',
      snapshot: null,
      decision: null,
      sprites: null,
      appOrigin: window.location.port === '8788'
        ? '/app-embed'
        : window.location.origin
    };
  }

  // Module instance state
  var instance = {
    mounted: false,
    containerEl: null,
    callbacks: {},
    state: createFallbackState(),
    mode: 'desktop_widget', // 'desktop_widget' | 'webapp_fullscreen' | 'browser_newtab'
    widgetCorner: 'BottomRight', // 'BottomRight' | 'TopRight' | 'BottomLeft' | 'TopLeft' | 'Free'
    widgetSize: 'standard', // 'standard' | 'compact'
    companion: 'cat', // 'cat' | 'puppy' | 'solo'
    searchEngine: 'Google', // 'Google' | 'DuckDuckGo'
    scale: 0.55,
    widgetPos: { x: 1008, y: 248 },
    dragging: null,
    loadedIframeUrl: '',
    resizeObserver: null,
    clockTimer: null,
    els: {}
  };

  function getWidgetDimensions() {
    if (instance.els.floatingWidget && instance.els.floatingWidget.offsetHeight > 40) {
      return {
        w: instance.els.floatingWidget.offsetWidth || (instance.widgetSize === 'compact' ? 324 : 404),
        h: instance.els.floatingWidget.offsetHeight
      };
    }
    return instance.widgetSize === 'compact'
      ? { w: 324, h: 392 }
      : { w: 404, h: 486 };
  }

  function computeCornerCoords(corner) {
    var dim = getWidgetDimensions();
    var rightX = Math.max(SNAP_MARGIN, VIRTUAL_WIDTH - dim.w - SNAP_MARGIN);
    var bottomY = Math.max(SNAP_MARGIN, WORKSPACE_HEIGHT - dim.h - SNAP_MARGIN);
    switch (corner) {
      case 'TopLeft':
        return { x: SNAP_MARGIN, y: SNAP_MARGIN };
      case 'TopRight':
        return { x: rightX, y: SNAP_MARGIN };
      case 'BottomLeft':
        return { x: SNAP_MARGIN, y: bottomY };
      case 'BottomRight':
      default:
        return { x: rightX, y: bottomY };
    }
  }

  function clampWidgetCoords(x, y) {
    var dim = getWidgetDimensions();
    var maxX = Math.max(12, VIRTUAL_WIDTH - dim.w - 12);
    var maxY = Math.max(12, WORKSPACE_HEIGHT - dim.h - 12);
    return {
      x: Math.round(Math.max(12, Math.min(maxX, x))),
      y: Math.round(Math.max(12, Math.min(maxY, y)))
    };
  }

  function applyWidgetTransform() {
    if (!instance.els.floatingWidget) return;
    if (instance.widgetCorner !== 'Free' && !instance.dragging) {
      instance.widgetPos = computeCornerCoords(instance.widgetCorner);
    } else {
      instance.widgetPos = clampWidgetCoords(instance.widgetPos.x, instance.widgetPos.y);
    }
    instance.els.floatingWidget.style.transform =
      'translate3d(' + instance.widgetPos.x + 'px, ' + instance.widgetPos.y + 'px, 0)';
  }

  function recalcScale() {
    if (!instance.els.measureBox || !instance.els.screenViewport || !instance.els.virtualCanvas) {
      return;
    }
    var boxWidth = instance.els.measureBox.clientWidth || 340;
    var isCompactHost = (window.innerWidth || boxWidth) <= 760 || boxWidth <= 480;
    // Subtract bezel horizontal chrome (15px on compact mobile bezel, 22px on desktop bezel)
    var bezelAllowance = isCompactHost ? 16 : 22;
    var availW = Math.max(180, boxWidth - bezelAllowance);
    var scaleByW = availW / VIRTUAL_WIDTH;

    // Respect comfortable vertical viewport budget so the 27" display never forces awkward scrolling
    var vh = window.innerHeight || 900;
    var maxScreenH = Math.max(220, Math.min(760, vh * 0.68));
    var scaleByH = maxScreenH / VIRTUAL_HEIGHT;

    if (availW >= 980) {
      scaleByH = Math.max(340, Math.min(840, vh * 0.76)) / VIRTUAL_HEIGHT;
    }

    var nextScale = Math.max(0.12, Math.min(1, scaleByW, scaleByH));
    instance.scale = nextScale;

    var scaledW = Math.floor(VIRTUAL_WIDTH * nextScale);
    var scaledH = Math.floor(VIRTUAL_HEIGHT * nextScale);

    instance.els.screenViewport.style.width = scaledW + 'px';
    instance.els.screenViewport.style.height = scaledH + 'px';
    instance.els.virtualCanvas.style.setProperty('--wb-desk-scale', nextScale.toFixed(5));

    if (instance.els.scaleReadout) {
      instance.els.scaleReadout.textContent =
        '1440×900 · Tỷ lệ ' + Math.round(nextScale * 100) + '%';
    }
  }

  function setMode(nextMode) {
    if (
      nextMode !== 'desktop_widget' &&
      nextMode !== 'webapp_fullscreen' &&
      nextMode !== 'browser_newtab'
    ) {
      return;
    }
    instance.mode = nextMode;
    syncModeDom();
    if (instance.callbacks && typeof instance.callbacks.onModeChange === 'function') {
      instance.callbacks.onModeChange(nextMode);
    }
  }

  function syncModeDom() {
    var els = instance.els;
    if (!els.root) return;

    // Mode buttons
    var modeBtns = els.root.querySelectorAll('[data-desk-mode]');
    for (var i = 0; i < modeBtns.length; i++) {
      var btn = modeBtns[i];
      var m = btn.getAttribute('data-desk-mode');
      var active = m === instance.mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    // Contextual subbars
    if (els.subbarWidget) {
      els.subbarWidget.style.display = instance.mode === 'desktop_widget' ? 'flex' : 'none';
    }
    if (els.subbarWebapp) {
      els.subbarWebapp.style.display = instance.mode === 'webapp_fullscreen' ? 'flex' : 'none';
    }
    if (els.subbarNewtab) {
      els.subbarNewtab.style.display = instance.mode === 'browser_newtab' ? 'flex' : 'none';
    }

    // Workspace layers inside 1440×900 canvas (keep iframe mounted at 1440px width!)
    var toggleLayer = function (layerEl, isVisible) {
      if (!layerEl) return;
      layerEl.classList.toggle('is-active-layer', isVisible);
      layerEl.classList.toggle('is-hidden-layer', !isVisible);
    };

    toggleLayer(els.layerDesktop, instance.mode === 'desktop_widget');
    toggleLayer(els.layerWebapp, instance.mode === 'webapp_fullscreen');
    toggleLayer(els.layerNewtab, instance.mode === 'browser_newtab');

    // Taskbar active indicators
    if (els.tbBtnDesktop) {
      els.tbBtnDesktop.classList.toggle('is-active', instance.mode === 'desktop_widget');
    }
    if (els.tbBtnWebapp) {
      els.tbBtnWebapp.classList.toggle('is-active', instance.mode === 'webapp_fullscreen');
    }
    if (els.tbBtnBrowser) {
      els.tbBtnBrowser.classList.toggle('is-active', instance.mode === 'browser_newtab');
    }

    if (instance.mode === 'desktop_widget') {
      requestAnimationFrame(applyWidgetTransform);
    }
  }

  function syncWidgetControlPills() {
    var els = instance.els;
    if (!els.root) return;

    // Snap corner pills (both toolbar and widget header)
    var cornerBtns = els.root.querySelectorAll('[data-snap-corner]');
    for (var i = 0; i < cornerBtns.length; i++) {
      var cBtn = cornerBtns[i];
      var isAct = cBtn.getAttribute('data-snap-corner') === instance.widgetCorner;
      cBtn.classList.toggle('is-active', isAct);
    }

    // Size pills
    var sizeBtns = els.root.querySelectorAll('[data-widget-size]');
    for (var j = 0; j < sizeBtns.length; j++) {
      var sBtn = sizeBtns[j];
      sBtn.classList.toggle('is-active', sBtn.getAttribute('data-widget-size') === instance.widgetSize);
    }

    if (els.floatingWidget) {
      els.floatingWidget.classList.toggle('is-compact', instance.widgetSize === 'compact');
    }

    // Companion pills
    var compBtns = els.root.querySelectorAll('[data-companion-mode]');
    for (var k = 0; k < compBtns.length; k++) {
      var pBtn = compBtns[k];
      pBtn.classList.toggle('is-active', pBtn.getAttribute('data-companion-mode') === instance.companion);
    }

    updateCompanionSprites();
    requestAnimationFrame(applyWidgetTransform);
  }

  function updateCompanionSprites() {
    var els = instance.els;
    var sprites = (instance.state && instance.state.sprites) || {};
    var catSrc = resolveSpriteSrc(sprites.cat, 'companion_cat.png');
    var puppySrc = resolveSpriteSrc(sprites.puppy, 'companion_puppy.png');

    var showPet = instance.companion !== 'solo';
    var petSrc = instance.companion === 'puppy' ? puppySrc : catSrc;
    var petAlt = instance.companion === 'puppy' ? 'Cún con đồng hành' : 'Mèo con đồng hành';

    if (els.fwPetImg) {
      els.fwPetImg.classList.toggle('is-hidden', !showPet);
      if (showPet && els.fwPetImg.getAttribute('data-loaded-src') !== petSrc) {
        els.fwPetImg.src = petSrc;
        els.fwPetImg.setAttribute('data-loaded-src', petSrc);
      }
      els.fwPetImg.alt = petAlt;
    }

    if (els.ntPetImg) {
      els.ntPetImg.classList.toggle('is-hidden', !showPet);
      if (showPet && els.ntPetImg.getAttribute('data-loaded-src') !== petSrc) {
        els.ntPetImg.src = petSrc;
        els.ntPetImg.setAttribute('data-loaded-src', petSrc);
      }
      els.ntPetImg.alt = petAlt;
    }
  }

  function syncClockDom() {
    var els = instance.els;
    if (!els.root) return;
    var clk = getVietnamClockParts();
    var cityName =
      (instance.state.city && instance.state.city.nameVi) ||
      (instance.state.snapshot && instance.state.snapshot.locationName) ||
      'TP. Hồ Chí Minh';

    if (els.tbClockTime) els.tbClockTime.textContent = clk.timeStr;
    if (els.tbClockDate) els.tbClockDate.textContent = clk.shortDateStr;
    if (els.ntBigClock) els.ntBigClock.textContent = clk.timeStr;
    if (els.ntBigDate) els.ntBigDate.textContent = clk.longDateStr;
    if (els.ntGreetingTitle) els.ntGreetingTitle.textContent = clk.greeting;
    if (els.ntGreetingSub) {
      els.ntGreetingSub.textContent =
        sanitizeText(cityName) + ' · Trợ lý thời tiết Chibi đồng bộ trực tiếp';
    }
  }

  function syncIframeOrigin() {
    var els = instance.els;
    if (!els.liveIframe) return;

    var st = instance.state || {};
    var rawEmbed = st.embedUrl || st.appOrigin || (window.location.port === '8788' ? '/app-embed' : window.location.origin);
    var cleanOrigin = String(rawEmbed).trim().replace(/\/+$/, '');

    var targetUrl = '';
    var externalUrl = '/';
    if (
      cleanOrigin === '/app-embed' ||
      /\/app-embed$/i.test(cleanOrigin) ||
      cleanOrigin.indexOf('deviceSim=1') !== -1
    ) {
      targetUrl = cleanOrigin;
      externalUrl = window.location.port === '8788'
        ? window.location.protocol + '//' + window.location.hostname + ':8787/'
        : '/';
    } else {
      targetUrl = cleanOrigin + '/?deviceSim=1';
      externalUrl = cleanOrigin + '/';
    }

    if (els.originPill) {
      els.originPill.textContent = targetUrl;
    }
    if (els.openRealAppLink) {
      els.openRealAppLink.href = externalUrl;
    }

    // Never tear down or reload an already-loaded iframe when appOrigin has not changed
    if (instance.loadedIframeUrl !== targetUrl) {
      instance.loadedIframeUrl = targetUrl;
      els.liveIframe.src = targetUrl;
    }
  }

  function buildSevenDayRows(snapshot) {
    var baseTemp = snapshot && Number.isFinite(snapshot.temperatureC) ? snapshot.temperatureC : 28;
    var daily = snapshot && Array.isArray(snapshot.daily) && snapshot.daily.length > 0
      ? snapshot.daily.slice(0, 7)
      : null;

    var items = [];
    if (daily) {
      for (var i = 0; i < daily.length; i++) {
        var d = daily[i];
        items.push({
          label: formatDayNameVi(d.dateIso, i),
          minC: Math.round(Number.isFinite(d.tempMinC) ? d.tempMinC : baseTemp - 3),
          maxC: Math.round(Number.isFinite(d.tempMaxC) ? d.tempMaxC : baseTemp + 3),
          rainPct: Math.round(Number.isFinite(d.precipProbMaxPct) ? d.precipProbMaxPct : 15)
        });
      }
    } else {
      var offsets = [
        [-3, 2, 18],
        [-2, 3, 24],
        [-3, 3, 35],
        [-4, 1, 52],
        [-3, 2, 20],
        [-2, 4, 12],
        [-2, 3, 16]
      ];
      for (var j = 0; j < 7; j++) {
        items.push({
          label: formatDayNameVi('', j),
          minC: Math.round(baseTemp + offsets[j][0]),
          maxC: Math.round(baseTemp + offsets[j][1]),
          rainPct: offsets[j][2]
        });
      }
    }

    var weekMin = Infinity;
    var weekMax = -Infinity;
    for (var k = 0; k < items.length; k++) {
      if (items[k].minC < weekMin) weekMin = items[k].minC;
      if (items[k].maxC > weekMax) weekMax = items[k].maxC;
    }
    var span = Math.max(1, weekMax - weekMin);

    var html = '';
    for (var r = 0; r < items.length; r++) {
      var it = items[r];
      var leftPct = Math.max(0, Math.min(88, ((it.minC - weekMin) / span) * 100));
      var widthPct = Math.max(12, Math.min(100 - leftPct, ((it.maxC - it.minC) / span) * 100));
      html +=
        '<div class="wb-nt-day-row">' +
          '<span class="wb-nt-day-name">' + escapeHtml(it.label) + '</span>' +
          '<span class="wb-nt-day-rain wb-desk-tabular">Mưa ' + it.rainPct + '%</span>' +
          '<span class="wb-nt-day-min wb-desk-tabular">' + it.minC + '°</span>' +
          '<div class="wb-nt-bar-track"><div class="wb-nt-bar-fill" style="left:' +
            leftPct.toFixed(1) + '%;width:' + widthPct.toFixed(1) + '%"></div></div>' +
          '<span class="wb-nt-day-max wb-desk-tabular">' + it.maxC + '°</span>' +
        '</div>';
    }
    return html;
  }

  function syncWeatherDataDom() {
    var els = instance.els;
    if (!els.root) return;

    var st = instance.state || createFallbackState();
    var snap = st.snapshot || {};
    var dec = st.decision || {};
    var gender = st.gender === 'male' ? 'male' : 'female';
    var theme = st.theme === 'light' ? 'light' : 'dark';

    // Theme attribute synchronization
    els.root.setAttribute('data-desk-theme', theme);
    if (els.virtualCanvas) {
      els.virtualCanvas.setAttribute('data-win-theme', theme);
      var skyTheme = dec.skyTheme || (theme === 'dark' ? 'night' : 'day_sunny');
      els.virtualCanvas.setAttribute('data-sky', skyTheme);
      var isRaining =
        dec.sceneId === 'storm_raincoat' ||
        dec.sceneId === 'light_rain_umbrella' ||
        (Number(snap.precipMmPerHr) >= 0.2);
      els.virtualCanvas.setAttribute('data-raining', isRaining ? 'true' : 'false');
    }

    var cityName =
      (st.city && st.city.nameVi) ||
      snap.locationName ||
      'TP. Hồ Chí Minh';
    var tempC = Number.isFinite(snap.temperatureC) ? Math.round(snap.temperatureC) : 28;
    var feelsC = Number.isFinite(snap.feelsLikeC) ? Math.round(snap.feelsLikeC) : tempC + 1;
    var humidityPct = Number.isFinite(snap.humidityPct) ? Math.round(snap.humidityPct) : 72;
    var dewPointC = Number.isFinite(snap.dewPointC)
      ? Math.round(snap.dewPointC)
      : computeDewPointC(tempC, humidityPct);
    var pm25 = Number.isFinite(snap.pm25) ? Math.round(snap.pm25 * 10) / 10 : 18;
    var aqi = Number.isFinite(snap.aqi) ? Math.round(snap.aqi) : 46;
    var uvIndex = Number.isFinite(snap.uvIndex) ? Math.round(snap.uvIndex * 10) / 10 : 5;
    var windKmh = Number.isFinite(snap.windSpeedKmh) ? Math.round(snap.windSpeedKmh) : 12;
    var gustKmh = Number.isFinite(snap.windGustKmh) ? Math.round(snap.windGustKmh) : windKmh + 7;
    var precipProb = Number.isFinite(snap.precipProbPct) ? Math.round(snap.precipProbPct) : 10;
    var precipMm = Number.isFinite(snap.precipMmPerHr) ? Number(snap.precipMmPerHr) : 0;
    var pressureHpa = Number.isFinite(snap.surfacePressureHpa) ? Math.round(snap.surfacePressureHpa) : 1011;
    var sunriseVi = snap.sunriseTimeVi || '05:48';
    var sunsetVi = snap.sunsetTimeVi || '17:56';

    var condVi = sanitizeText(snap.conditionText || dec.headlineVi || 'Trời quang');
    var badgeVi = sanitizeText(dec.badgeVi || condVi);
    var headlineVi = sanitizeText(dec.headlineVi || condVi);
    var outfitVi = sanitizeText(
      dec.outfitAdviceVi || dec.outfitVi || 'Mặc trang phục gọn nhẹ thoải mái'
    );

    var sceneId = dec.sceneId || 'pleasant_sunny';
    var charSrc = resolveSpriteSrc(
      st.sprites && st.sprites.character,
      gender + '_' + sceneId + '.png'
    );

    // Character & companion sprites
    if (els.fwCharImg && els.fwCharImg.getAttribute('data-loaded-src') !== charSrc) {
      els.fwCharImg.src = charSrc;
      els.fwCharImg.setAttribute('data-loaded-src', charSrc);
    }
    if (els.ntCharImg && els.ntCharImg.getAttribute('data-loaded-src') !== charSrc) {
      els.ntCharImg.src = charSrc;
      els.ntCharImg.setAttribute('data-loaded-src', charSrc);
    }
    updateCompanionSprites();

    // Floating Widget DOM updates
    if (els.fwCity) els.fwCity.textContent = sanitizeText(cityName);
    if (els.fwBadge) els.fwBadge.textContent = badgeVi;
    if (els.fwTemp) els.fwTemp.textContent = tempC + '°';
    if (els.fwFeels) {
      els.fwFeels.textContent = 'Cảm nhận ' + feelsC + '°C · Độ ẩm ' + humidityPct + '%';
    }
    if (els.fwHeadline) els.fwHeadline.textContent = headlineVi;
    if (els.fwOutfitText) els.fwOutfitText.textContent = outfitVi;

    // 3-hour mini forecast + rain %/mm
    if (els.fwHourlyGrid) {
      var hourly = Array.isArray(snap.hourly) ? snap.hourly.slice(0, 3) : [];
      var slotsHtml = '';
      for (var i = 0; i < 3; i++) {
        var hPt = hourly[i];
        var hLabel = hPt ? formatHourLabel(hPt.timeIso, i) : formatHourLabel('', i);
        var hTemp = hPt && Number.isFinite(hPt.temperatureC) ? Math.round(hPt.temperatureC) : tempC;
        var hProb = hPt && Number.isFinite(hPt.precipProbPct) ? Math.round(hPt.precipProbPct) : precipProb;
        var hMm = hPt && Number.isFinite(hPt.precipMm) ? Number(hPt.precipMm) : 0;
        var mmStr = hMm >= 0.05 ? hMm.toFixed(1) + 'mm' : '0mm';
        slotsHtml +=
          '<div class="wb-fw-hour-slot wb-desk-tabular">' +
            '<span class="wb-fw-hour-time">' + escapeHtml(hLabel) + '</span>' +
            '<span class="wb-fw-hour-temp">' + hTemp + '°C</span>' +
            '<span class="wb-fw-hour-rain">' + hProb + '% · ' + mmStr + '</span>' +
          '</div>';
      }
      els.fwHourlyGrid.innerHTML = slotsHtml;
    }

    if (els.fwPm25Val) els.fwPm25Val.textContent = pm25 + ' µg/m³';
    if (els.fwDewVal) els.fwDewVal.textContent = dewPointC + '°C';

    // Windows 11 Taskbar Weather Tray Pill
    if (els.tbWeatherText) {
      els.tbWeatherText.textContent = tempC + '°C · ' + condVi;
    }
    if (els.tbWeatherIcon) {
      if (sceneId === 'storm_raincoat' || sceneId === 'light_rain_umbrella') {
        els.tbWeatherIcon.innerHTML = SVG_ICONS.rain;
      } else if (sceneId === 'clear_night' || snap.isDay === false) {
        els.tbWeatherIcon.innerHTML = SVG_ICONS.moon;
      } else {
        els.tbWeatherIcon.innerHTML = SVG_ICONS.sunCloud;
      }
    }

    // Mode 3 Browser Extension New-Tab updates
    if (els.ntExtBadge) {
      els.ntExtBadge.textContent = sanitizeText(cityName) + ' · ' + tempC + '°C';
    }
    if (els.ntCityTag) {
      els.ntCityTag.textContent = badgeVi;
    }
    if (els.ntTemp) els.ntTemp.textContent = tempC + '°';
    if (els.ntFeels) {
      els.ntFeels.textContent = 'Cảm nhận ' + feelsC + '°C · Độ ẩm ' + humidityPct + '%';
    }
    if (els.ntHeadline) els.ntHeadline.textContent = headlineVi;
    if (els.ntOutfitText) els.ntOutfitText.textContent = outfitVi;
    if (els.ntDailyList) els.ntDailyList.innerHTML = buildSevenDayRows(snap);

    if (els.ntTeleGrid) {
      var uvLabel = uvIndex >= 8 ? 'Rất cao · Che chắn kỹ' : uvIndex >= 6 ? 'Cao · Cần chống nắng' : uvIndex >= 3 ? 'Trung bình' : 'Thấp · Dịu nhẹ';
      var aqiLabel = aqi <= 50 ? 'Không khí Tốt' : aqi <= 100 ? 'Trung bình' : 'Kém · Đeo khẩu trang';
      els.ntTeleGrid.innerHTML =
        '<div class="wb-nt-tele-tile wb-desk-tabular">' +
          '<span class="wb-nt-tele-label">Bụi mịn PM2.5</span>' +
          '<span class="wb-nt-tele-val">' + pm25 + ' µg/m³</span>' +
          '<span class="wb-nt-tele-sub">AQI ' + aqi + ' · ' + escapeHtml(aqiLabel) + '</span>' +
        '</div>' +
        '<div class="wb-nt-tele-tile wb-desk-tabular">' +
          '<span class="wb-nt-tele-label">Điểm sương & Độ ẩm</span>' +
          '<span class="wb-nt-tele-val">' + dewPointC + '°C</span>' +
          '<span class="wb-nt-tele-sub">Độ ẩm ' + humidityPct + '%</span>' +
        '</div>' +
        '<div class="wb-nt-tele-tile wb-desk-tabular">' +
          '<span class="wb-nt-tele-label">Chỉ số tia UV</span>' +
          '<span class="wb-nt-tele-val">UV ' + uvIndex + '</span>' +
          '<span class="wb-nt-tele-sub">' + escapeHtml(uvLabel) + '</span>' +
        '</div>' +
        '<div class="wb-nt-tele-tile wb-desk-tabular">' +
          '<span class="wb-nt-tele-label">Sức gió & Gió giật</span>' +
          '<span class="wb-nt-tele-val">' + windKmh + ' km/h</span>' +
          '<span class="wb-nt-tele-sub">Giật ' + gustKmh + ' km/h</span>' +
        '</div>' +
        '<div class="wb-nt-tele-tile wb-desk-tabular">' +
          '<span class="wb-nt-tele-label">Mưa hiện tại</span>' +
          '<span class="wb-nt-tele-val">' + precipProb + '%</span>' +
          '<span class="wb-nt-tele-sub">Lượng mưa ' + precipMm.toFixed(1) + ' mm/h</span>' +
        '</div>' +
        '<div class="wb-nt-tele-tile wb-desk-tabular">' +
          '<span class="wb-nt-tele-label">Mặt trời & Áp suất</span>' +
          '<span class="wb-nt-tele-val">' + escapeHtml(sunriseVi) + '</span>' +
          '<span class="wb-nt-tele-sub">Lặn ' + escapeHtml(sunsetVi) + ' · ' + pressureHpa + ' hPa</span>' +
        '</div>';
    }

    syncClockDom();
    syncIframeOrigin();
    if (instance.mode === 'desktop_widget') {
      requestAnimationFrame(applyWidgetTransform);
    }
  }

  function bindWidgetDragEvents(widgetEl) {
    widgetEl.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (e.target && e.target.closest('button, a, input, select')) return;

      e.preventDefault();
      var currentPos = instance.widgetCorner !== 'Free'
        ? computeCornerCoords(instance.widgetCorner)
        : instance.widgetPos;

      instance.widgetPos = { x: currentPos.x, y: currentPos.y };
      instance.widgetCorner = 'Free';
      instance.dragging = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originX: currentPos.x,
        originY: currentPos.y
      };

      widgetEl.classList.add('is-dragging');
      syncWidgetControlPills();
      if (typeof widgetEl.setPointerCapture === 'function') {
        try {
          widgetEl.setPointerCapture(e.pointerId);
        } catch (_err) {
          // Ignore pointer capture errors on synthetic events
        }
      }
    });

    widgetEl.addEventListener('pointermove', function (e) {
      if (!instance.dragging || e.pointerId !== instance.dragging.pointerId) return;
      var scale = instance.scale || 1;
      var dx = (e.clientX - instance.dragging.startClientX) / scale;
      var dy = (e.clientY - instance.dragging.startClientY) / scale;
      instance.widgetPos = clampWidgetCoords(
        instance.dragging.originX + dx,
        instance.dragging.originY + dy
      );
      applyWidgetTransform();
    });

    var endDrag = function (e) {
      if (!instance.dragging || e.pointerId !== instance.dragging.pointerId) return;
      widgetEl.classList.remove('is-dragging');
      if (typeof widgetEl.releasePointerCapture === 'function') {
        try {
          widgetEl.releasePointerCapture(e.pointerId);
        } catch (_err) {
          // Ignore
        }
      }

      // Magnetic corner snap if dropped close to a screen corner
      var candidates = ['BottomRight', 'TopRight', 'BottomLeft', 'TopLeft'];
      var snapped = 'Free';
      for (var i = 0; i < candidates.length; i++) {
        var target = computeCornerCoords(candidates[i]);
        var dist = Math.hypot(instance.widgetPos.x - target.x, instance.widgetPos.y - target.y);
        if (dist <= 76) {
          snapped = candidates[i];
          break;
        }
      }
      instance.dragging = null;
      instance.widgetCorner = snapped;
      syncWidgetControlPills();
    };

    widgetEl.addEventListener('pointerup', endDrag);
    widgetEl.addEventListener('pointercancel', endDrag);
  }

  function renderMarkup(containerEl) {
    containerEl.innerHTML =
      '<div class="wb-desk-root" data-desk-theme="dark">' +
        '<!-- Top 3-Mode Segmented Toolbar & Contextual Subbar -->' +
        '<div class="wb-desk-toolbar-card">' +
          '<div class="wb-desk-toolbar-top">' +
            '<div class="wb-desk-stage-badge">' +
              '<span class="wb-desk-stage-icon">' + SVG_ICONS.monitor + '</span>' +
              '<div class="wb-desk-stage-titles">' +
                '<span class="wb-desk-stage-title">Màn hình Studio 27" · Windows 11</span>' +
                '<span class="wb-desk-stage-sub wb-desk-tabular" data-el="scaleReadout">1440×900 · Tự động co giãn mượt</span>' +
              '</div>' +
            '</div>' +
            '<div class="wb-desk-mode-seg" role="tablist" aria-label="Chế độ hiển thị màn hình Desktop">' +
              '<button type="button" class="wb-desk-mode-btn is-active" data-desk-mode="desktop_widget" aria-pressed="true">' +
                '<span>Màn hình Desktop &amp; Widget nổi</span>' +
              '</button>' +
              '<button type="button" class="wb-desk-mode-btn" data-desk-mode="webapp_fullscreen" aria-pressed="false">' +
                '<span>Web App Toàn màn hình (1440×900)</span>' +
              '</button>' +
              '<button type="button" class="wb-desk-mode-btn" data-desk-mode="browser_newtab" aria-pressed="false">' +
                '<span>Tiện ích Tab Mới Trình duyệt</span>' +
              '</button>' +
            '</div>' +
          '</div>' +

          '<!-- Subbar for Mode 1: Widget Corner Snap, Size, Companion -->' +
          '<div class="wb-desk-subbar" data-el="subbarWidget">' +
            '<div class="wb-desk-pill-cluster" role="group" aria-label="Neo góc Widget">' +
              '<span class="wb-desk-cluster-label">Neo góc:</span>' +
              '<button type="button" class="wb-desk-chip-btn is-active" data-snap-corner="BottomRight">Góc dưới phải</button>' +
              '<button type="button" class="wb-desk-chip-btn" data-snap-corner="TopRight">Góc trên phải</button>' +
              '<button type="button" class="wb-desk-chip-btn" data-snap-corner="BottomLeft">Góc dưới trái</button>' +
              '<button type="button" class="wb-desk-chip-btn" data-snap-corner="TopLeft">Góc trên trái</button>' +
            '</div>' +
            '<div class="wb-desk-pill-cluster" role="group" aria-label="Kích thước và Thú cưng">' +
              '<button type="button" class="wb-desk-chip-btn is-active" data-widget-size="standard">Tiêu chuẩn</button>' +
              '<button type="button" class="wb-desk-chip-btn" data-widget-size="compact">Nhỏ gọn</button>' +
              '<span class="wb-desk-cluster-label" style="margin-left:4px;">Bạn đồng hành:</span>' +
              '<button type="button" class="wb-desk-chip-btn is-active" data-companion-mode="cat">Mèo con</button>' +
              '<button type="button" class="wb-desk-chip-btn" data-companion-mode="puppy">Cún con</button>' +
              '<button type="button" class="wb-desk-chip-btn" data-companion-mode="solo">Đứng một mình</button>' +
            '</div>' +
          '</div>' +

          '<!-- Subbar for Mode 2: Full-Screen Desktop Web App -->' +
          '<div class="wb-desk-subbar" data-el="subbarWebapp" style="display:none;">' +
            '<div class="wb-desk-pill-cluster">' +
              '<span class="wb-desk-cluster-label">Khung chuẩn 1440×900 trực tiếp (3 biểu đồ 24h + Diorama 3D + Radar mưa)</span>' +
            '</div>' +
            '<div class="wb-desk-pill-cluster">' +
              '<button type="button" class="wb-desk-chip-btn" data-action="reload-iframe">' + SVG_ICONS.reload + '<span>Tải lại khung Desktop</span></button>' +
              '<button type="button" class="wb-desk-chip-btn" data-action="go-widget">Thu về Widget nổi</button>' +
              '<a class="wb-desk-chip-btn" data-el="openRealAppLink" href="/" target="_blank" rel="noopener" style="text-decoration:none;">Mở tab gốc ↗</a>' +
            '</div>' +
          '</div>' +

          '<!-- Subbar for Mode 3: Browser Extension New-Tab -->' +
          '<div class="wb-desk-subbar" data-el="subbarNewtab" style="display:none;">' +
            '<div class="wb-desk-pill-cluster">' +
              '<span class="wb-desk-cluster-label">Mô phỏng Tiện ích Mở rộng Trình duyệt (Chrome / Edge New Tab)</span>' +
            '</div>' +
            '<div class="wb-desk-pill-cluster">' +
              '<button type="button" class="wb-desk-chip-btn" data-action="toggle-engine">Đổi công cụ tìm kiếm</button>' +
              '<button type="button" class="wb-desk-chip-btn" data-action="go-webapp">Mở Web App Toàn màn hình</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- Studio 27" Hardware Monitor Frame -->' +
        '<div class="wb-desk-stage-measure" data-el="measureBox">' +
          '<div class="wb-desk-monitor-assembly">' +
            '<div class="wb-desk-monitor-bezel">' +
              '<div class="wb-desk-webcam-dot" aria-hidden="true"></div>' +
              '<div class="wb-desk-screen-viewport" data-el="screenViewport">' +
                '<div class="wb-desk-virtual-canvas" data-el="virtualCanvas" data-win-theme="dark" data-sky="night" data-raining="false">' +

                  '<!-- LAYER 1: Windows 11 Desktop + Interactive Floating Widget -->' +
                  '<section class="wb-desk-workspace-layer is-active-layer" data-el="layerDesktop" aria-label="Màn hình Windows 11 và Widget nổi">' +
                    '<div class="wb-win-wallpaper">' +
                      '<div class="wb-win-wallpaper-bloom"></div>' +
                      '<svg class="wb-win-wallpaper-svg" viewBox="0 0 1440 852" fill="none" preserveAspectRatio="none" aria-hidden="true">' +
                        '<path d="M-80 690 C 310 510, 690 790, 1140 560 C 1310 470, 1430 520, 1540 490 L 1540 900 L -80 900 Z" fill="currentColor" opacity="0.045"/>' +
                        '<path d="M-60 760 C 380 610, 820 840, 1260 640 C 1380 585, 1460 610, 1520 600 L 1520 900 L -60 900 Z" fill="currentColor" opacity="0.055"/>' +
                      '</svg>' +
                      '<div class="wb-win-rain-layer"></div>' +
                    '</div>' +

                    '<!-- Desktop Shortcut Icons -->' +
                    '<div class="wb-win-shortcuts">' +
                      '<button type="button" class="wb-win-shortcut" data-action="go-webapp" title="Mở Web App WeatherBuddy Toàn màn hình">' +
                        '<span class="wb-win-shortcut-icon">' + SVG_ICONS.sunCloud + '</span>' +
                        '<span class="wb-win-shortcut-label">WeatherBuddy Web</span>' +
                      '</button>' +
                      '<button type="button" class="wb-win-shortcut" data-action="go-newtab" title="Mở Tiện ích Tab Mới Trình duyệt">' +
                        '<span class="wb-win-shortcut-icon">' + SVG_ICONS.browser + '</span>' +
                        '<span class="wb-win-shortcut-label">Tab Mới Chibi</span>' +
                      '</button>' +
                      '<button type="button" class="wb-win-shortcut" data-action="snap-default" title="Căn lại Widget nổi về góc màn hình">' +
                        '<span class="wb-win-shortcut-icon">' + SVG_ICONS.widget + '</span>' +
                        '<span class="wb-win-shortcut-label">Widget Nổi PC</span>' +
                      '</button>' +
                      '<button type="button" class="wb-win-shortcut" data-action="go-webapp" title="Xem Biểu đồ 24h và Radar mưa">' +
                        '<span class="wb-win-shortcut-icon">' + SVG_ICONS.folder + '</span>' +
                        '<span class="wb-win-shortcut-label">Bản đồ Khí tượng</span>' +
                      '</button>' +
                    '</div>' +

                    '<!-- Bottom-Left Quick Switch CTA -->' +
                    '<div class="wb-win-desktop-cta">' +
                      '<div class="wb-win-cta-copy">' +
                        '<span class="wb-win-cta-title">Kéo thả tự do Widget nổi hoặc mở bản Web App 1440×900</span>' +
                        '<span class="wb-win-cta-sub">Nhấn biểu tượng WeatherBuddy dưới thanh Taskbar hoặc nút bên cạnh để mở toàn màn hình.</span>' +
                      '</div>' +
                      '<button type="button" class="wb-win-cta-btn" data-action="go-webapp">' +
                        '<span>Mở Web App 1440×900</span>' +
                      '</button>' +
                    '</div>' +

                    '<!-- Draggable & Snappable WeatherBuddy Floating Desktop Widget -->' +
                    '<article class="wb-floating-widget" data-el="floatingWidget" aria-label="WeatherBuddy Desktop Widget nổi">' +
                      '<header class="wb-fw-titlebar">' +
                        '<div class="wb-fw-brand">' +
                          '<span class="wb-fw-live-dot"></span>' +
                          '<span>WeatherBuddy PC · Kéo để di chuyển</span>' +
                        '</div>' +
                        '<div class="wb-fw-controls">' +
                          '<button type="button" class="wb-fw-icon-btn" data-snap-corner="TopLeft" title="Neo góc trên trái">↖</button>' +
                          '<button type="button" class="wb-fw-icon-btn" data-snap-corner="TopRight" title="Neo góc trên phải">↗</button>' +
                          '<button type="button" class="wb-fw-icon-btn" data-snap-corner="BottomLeft" title="Neo góc dưới trái">↙</button>' +
                          '<button type="button" class="wb-fw-icon-btn is-active" data-snap-corner="BottomRight" title="Neo góc dưới phải">↘</button>' +
                          '<button type="button" class="wb-fw-icon-btn" data-action="toggle-size" title="Đổi cỡ Tiêu chuẩn / Nhỏ gọn">Cỡ</button>' +
                        '</div>' +
                      '</header>' +
                      '<div class="wb-fw-body">' +
                        '<div class="wb-fw-header-row">' +
                          '<span class="wb-fw-city" data-el="fwCity">TP. Hồ Chí Minh</span>' +
                          '<span class="wb-fw-badge" data-el="fwBadge">Nắng đẹp</span>' +
                        '</div>' +
                        '<div class="wb-fw-stage">' +
                          '<div class="wb-fw-temp-col">' +
                            '<div>' +
                              '<div class="wb-fw-temp-main wb-desk-tabular" data-el="fwTemp">28°</div>' +
                              '<div class="wb-fw-feels wb-desk-tabular" data-el="fwFeels">Cảm nhận 30°C · Độ ẩm 70%</div>' +
                            '</div>' +
                            '<div class="wb-fw-headline" data-el="fwHeadline">Trời nắng dịu</div>' +
                          '</div>' +
                          '<div class="wb-fw-art-wrap">' +
                            '<div class="wb-fw-ground-shadow"></div>' +
                            '<img class="wb-fw-char-img" data-el="fwCharImg" alt="Nhân vật WeatherBuddy 3D" src="/api/character-sprite?file=female_pleasant_sunny.png" />' +
                            '<img class="wb-fw-pet-img" data-el="fwPetImg" alt="Mèo con đồng hành" src="/api/character-sprite?file=companion_cat.png" />' +
                          '</div>' +
                        '</div>' +
                        '<div class="wb-fw-outfit-chip">' +
                          '<span class="wb-fw-outfit-icon">' + SVG_ICONS.shirt + '</span>' +
                          '<span data-el="fwOutfitText">Mặc trang phục gọn nhẹ thoải mái</span>' +
                        '</div>' +
                        '<div class="wb-fw-hourly-grid" data-el="fwHourlyGrid"></div>' +
                        '<div class="wb-fw-telemetry-row wb-desk-tabular">' +
                          '<span class="wb-fw-tele-pill"><span>PM2.5</span><strong data-el="fwPm25Val">18 µg/m³</strong></span>' +
                          '<span class="wb-fw-tele-pill"><span>Điểm sương</span><strong data-el="fwDewVal">21°C</strong></span>' +
                        '</div>' +
                      '</div>' +
                    '</article>' +
                  '</section>' +

                  '<!-- LAYER 2: Live Full-Screen Desktop Web App (Persistent 1440px Iframe) -->' +
                  '<section class="wb-desk-workspace-layer is-hidden-layer" data-el="layerWebapp" aria-label="Web App WeatherBuddy Toàn màn hình">' +
                    '<div class="wb-desk-webapp-window">' +
                      '<header class="wb-win-app-titlebar">' +
                        '<div class="wb-win-app-title-left">' +
                          '<span>WeatherBuddy · Ứng dụng Khí tượng Trực tiếp (1440×900)</span>' +
                          '<span class="wb-win-origin-pill wb-desk-tabular" data-el="originPill">/?deviceSim=1</span>' +
                        '</div>' +
                        '<div class="wb-win-caption-btns">' +
                          '<button type="button" class="wb-win-cap-btn" data-action="reload-iframe" title="Tải lại ứng dụng">' + SVG_ICONS.reload + '</button>' +
                          '<button type="button" class="wb-win-cap-btn" data-action="go-widget" title="Thu nhỏ về Màn hình Desktop">_</button>' +
                          '<button type="button" class="wb-win-cap-btn is-close" data-action="go-widget" title="Đóng cửa sổ về Desktop">×</button>' +
                        '</div>' +
                      '</header>' +
                      '<div class="wb-desk-iframe-host">' +
                        '<iframe class="wb-desk-live-iframe" data-el="liveIframe" title="WeatherBuddy Desktop Web App 1440x900" allow="geolocation" loading="eager"></iframe>' +
                      '</div>' +
                    '</div>' +
                  '</section>' +

                  '<!-- LAYER 3: Browser Extension New-Tab Dashboard -->' +
                  '<section class="wb-desk-workspace-layer is-hidden-layer" data-el="layerNewtab" aria-label="Tiện ích Tab Mới Trình duyệt WeatherBuddy">' +
                    '<div class="wb-nt-browser">' +
                      '<div class="wb-nt-tabstrip">' +
                        '<div class="wb-nt-tabs-left">' +
                          '<div class="wb-nt-tab">' +
                            '<span>Tab Mới · WeatherBuddy Chibi NPC</span>' +
                          '</div>' +
                          '<button type="button" class="wb-nt-newtab-plus" data-action="focus-search" title="Tab mới">+</button>' +
                        '</div>' +
                        '<div class="wb-win-caption-btns">' +
                          '<button type="button" class="wb-win-cap-btn" data-action="go-widget" title="Thu nhỏ về Desktop">_</button>' +
                          '<button type="button" class="wb-win-cap-btn is-close" data-action="go-widget" title="Đóng trình duyệt về Desktop">×</button>' +
                        '</div>' +
                      '</div>' +
                      '<div class="wb-nt-omnibar">' +
                        '<div class="wb-nt-nav-icons">' +
                          '<button type="button" class="wb-nt-nav-btn" data-action="go-widget" title="Về Màn hình Desktop">←</button>' +
                          '<button type="button" class="wb-nt-nav-btn" data-action="go-webapp" title="Mở Web App đầy đủ">→</button>' +
                        '</div>' +
                        '<div class="wb-nt-url-pill">' +
                          '<span>extension://weatherbuddy-chibi-npc/newtab.html</span>' +
                          '<span>Đã đồng bộ thời tiết thực</span>' +
                        '</div>' +
                        '<span class="wb-nt-ext-badge wb-desk-tabular" data-el="ntExtBadge">TP. Hồ Chí Minh · 28°C</span>' +
                      '</div>' +

                      '<div class="wb-nt-content">' +
                        '<div class="wb-nt-hero-row">' +
                          '<div class="wb-nt-greeting-col">' +
                            '<div class="wb-nt-greeting-title" data-el="ntGreetingTitle">Chào buổi sáng</div>' +
                            '<div class="wb-nt-greeting-sub" data-el="ntGreetingSub">TP. Hồ Chí Minh · Trợ lý thời tiết Chibi đồng bộ trực tiếp</div>' +
                          '</div>' +
                          '<div class="wb-nt-search-wrap">' +
                            '<form class="wb-nt-search-form" data-el="ntSearchForm" autocomplete="off">' +
                              '<button type="button" class="wb-nt-engine-btn" data-action="toggle-engine" data-el="ntEngineBtn">Google</button>' +
                              '<input type="search" class="wb-nt-search-input" data-el="ntSearchInput" placeholder="Tìm kiếm nhanh trên Web hoặc tra cứu khí tượng..." aria-label="Tìm kiếm trên Tab Mới" />' +
                              '<button type="submit" class="wb-nt-search-submit">Tìm kiếm</button>' +
                            '</form>' +
                            '<div class="wb-nt-quick-links">' +
                              '<button type="button" class="wb-nt-qlink" data-action="go-webapp">Mở Web App Đầy đủ (1440×900)</button>' +
                              '<button type="button" class="wb-nt-qlink" data-action="go-widget">Xem Widget nổi trên Desktop</button>' +
                            '</div>' +
                          '</div>' +
                          '<div class="wb-nt-clock-col wb-desk-tabular">' +
                            '<div class="wb-nt-big-clock" data-el="ntBigClock">--:--</div>' +
                            '<div class="wb-nt-big-date" data-el="ntBigDate">--</div>' +
                          '</div>' +
                        '</div>' +

                        '<div class="wb-nt-bento">' +
                          '<!-- Col 1: 3D Character Card -->' +
                          '<article class="wb-nt-card">' +
                            '<div class="wb-nt-card-head">' +
                              '<span class="wb-nt-card-title">Nhân vật &amp; Trang phục hôm nay</span>' +
                              '<span class="wb-nt-card-tag" data-el="ntCityTag">Nắng đẹp</span>' +
                            '</div>' +
                            '<div class="wb-nt-char-stage">' +
                              '<div class="wb-nt-char-metrics">' +
                                '<div class="wb-nt-temp wb-desk-tabular" data-el="ntTemp">28°</div>' +
                                '<div class="wb-nt-feels wb-desk-tabular" data-el="ntFeels">Cảm nhận 30°C · Độ ẩm 70%</div>' +
                                '<div class="wb-nt-headline" data-el="ntHeadline">Trời nắng dịu</div>' +
                              '</div>' +
                              '<div class="wb-nt-art-box">' +
                                '<img class="wb-nt-char-img" data-el="ntCharImg" alt="Nhân vật 3D" src="/api/character-sprite?file=female_pleasant_sunny.png" />' +
                                '<img class="wb-nt-pet-img" data-el="ntPetImg" alt="Thú cưng đồng hành" src="/api/character-sprite?file=companion_cat.png" />' +
                              '</div>' +
                            '</div>' +
                            '<div class="wb-nt-outfit-bar">' +
                              '<span class="wb-fw-outfit-icon">' + SVG_ICONS.shirt + '</span>' +
                              '<span data-el="ntOutfitText">Mặc trang phục gọn nhẹ thoải mái</span>' +
                            '</div>' +
                          '</article>' +

                          '<!-- Col 2: 7-Day Thermal Range Bars -->' +
                          '<article class="wb-nt-card">' +
                            '<div class="wb-nt-card-head">' +
                              '<span class="wb-nt-card-title">Biên độ nhiệt 7 ngày tới</span>' +
                              '<span class="wb-nt-card-tag">Theo ngày</span>' +
                            '</div>' +
                            '<div class="wb-nt-daily-list" data-el="ntDailyList"></div>' +
                          '</article>' +

                          '<!-- Col 3: Quick Telemetry Cards -->' +
                          '<article class="wb-nt-card">' +
                            '<div class="wb-nt-card-head">' +
                              '<span class="wb-nt-card-title">Chỉ số Khí tượng &amp; Môi trường</span>' +
                              '<span class="wb-nt-card-tag">Trực tiếp</span>' +
                            '</div>' +
                            '<div class="wb-nt-tele-grid" data-el="ntTeleGrid"></div>' +
                          '</article>' +
                        '</div>' +
                      '</div>' +
                    '</div>' +
                  '</section>' +

                  '<!-- Shared Windows 11 Taskbar at Bottom (48px) -->' +
                  '<footer class="wb-win-taskbar" aria-label="Thanh tác vụ Windows 11">' +
                    '<div class="wb-tb-left">' +
                      '<span>Windows 11 · WeatherBuddy Desktop</span>' +
                    '</div>' +
                    '<div class="wb-tb-center">' +
                      '<button type="button" class="wb-tb-app-btn is-active" data-el="tbBtnDesktop" data-action="go-widget" title="Màn hình Desktop Windows 11">' +
                        SVG_ICONS.winStart +
                      '</button>' +
                      '<button type="button" class="wb-tb-search-pill" data-action="go-newtab" title="Mở tìm kiếm Tab Mới">' +
                        SVG_ICONS.search +
                        '<span>Tìm kiếm...</span>' +
                      '</button>' +
                      '<button type="button" class="wb-tb-app-btn" data-el="tbBtnBrowser" data-action="go-newtab" title="Tiện ích Tab Mới Trình duyệt">' +
                        SVG_ICONS.browser +
                        '<span>Trình duyệt</span>' +
                      '</button>' +
                      '<button type="button" class="wb-tb-app-btn" data-el="tbBtnWebapp" data-action="go-webapp" title="Mở ứng dụng WeatherBuddy Toàn màn hình (1440×900)">' +
                        '<span class="wb-tb-wb-badge">' + SVG_ICONS.sunCloud + '</span>' +
                        '<span>WeatherBuddy</span>' +
                      '</button>' +
                    '</div>' +
                    '<div class="wb-tb-right">' +
                      '<button type="button" class="wb-tb-weather-pill wb-desk-tabular" data-action="go-widget" title="Xem Widget thời tiết trên Màn hình Desktop">' +
                        '<span class="wb-tb-weather-icon" data-el="tbWeatherIcon">' + SVG_ICONS.sunCloud + '</span>' +
                        '<span data-el="tbWeatherText">28°C · Trời quang</span>' +
                      '</button>' +
                      '<div class="wb-tb-sys-cluster" aria-hidden="true">' +
                        '<span>VIE</span>' +
                        SVG_ICONS.wifi +
                        SVG_ICONS.speaker +
                      '</div>' +
                      '<div class="wb-tb-clock wb-desk-tabular">' +
                        '<span class="wb-tb-clock-time" data-el="tbClockTime">--:--</span>' +
                        '<span class="wb-tb-clock-date" data-el="tbClockDate">--/--/----</span>' +
                      '</div>' +
                    '</div>' +
                  '</footer>' +

                '</div>' +
              '</div>' +
              '<div class="wb-desk-monitor-chin">' +
                '<span class="wb-desk-chin-brand">WeatherBuddy Studio Display · 27" QHD</span>' +
                '<span class="wb-desk-chin-right"><span class="wb-desk-power-led"></span><span>IPS 1440×900</span></span>' +
              '</div>' +
            '</div>' +
            '<div class="wb-desk-stand-neck" aria-hidden="true"></div>' +
            '<div class="wb-desk-stand-foot" aria-hidden="true"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var root = containerEl.querySelector('.wb-desk-root');
    var els = { root: root };
    var named = root.querySelectorAll('[data-el]');
    for (var i = 0; i < named.length; i++) {
      els[named[i].getAttribute('data-el')] = named[i];
    }
    instance.els = els;

    // Event delegation for buttons & controls
    root.addEventListener('click', function (e) {
      var modeBtn = e.target.closest('[data-desk-mode]');
      if (modeBtn) {
        setMode(modeBtn.getAttribute('data-desk-mode'));
        return;
      }

      var snapBtn = e.target.closest('[data-snap-corner]');
      if (snapBtn) {
        instance.widgetCorner = snapBtn.getAttribute('data-snap-corner') || 'BottomRight';
        syncWidgetControlPills();
        return;
      }

      var sizeBtn = e.target.closest('[data-widget-size]');
      if (sizeBtn) {
        instance.widgetSize = sizeBtn.getAttribute('data-widget-size') === 'compact' ? 'compact' : 'standard';
        syncWidgetControlPills();
        return;
      }

      var compBtn = e.target.closest('[data-companion-mode]');
      if (compBtn) {
        instance.companion = compBtn.getAttribute('data-companion-mode') || 'cat';
        syncWidgetControlPills();
        return;
      }

      var actBtn = e.target.closest('[data-action]');
      if (actBtn) {
        var act = actBtn.getAttribute('data-action');
        if (act === 'go-webapp') {
          setMode('webapp_fullscreen');
        } else if (act === 'go-widget') {
          setMode('desktop_widget');
        } else if (act === 'go-newtab') {
          setMode('browser_newtab');
        } else if (act === 'snap-default') {
          instance.widgetCorner = 'BottomRight';
          syncWidgetControlPills();
        } else if (act === 'toggle-size') {
          instance.widgetSize = instance.widgetSize === 'compact' ? 'standard' : 'compact';
          syncWidgetControlPills();
        } else if (act === 'reload-iframe') {
          if (instance.els.liveIframe && instance.loadedIframeUrl) {
            instance.els.liveIframe.src = instance.loadedIframeUrl;
          }
        } else if (act === 'toggle-engine') {
          instance.searchEngine = instance.searchEngine === 'Google' ? 'DuckDuckGo' : 'Google';
          if (instance.els.ntEngineBtn) {
            instance.els.ntEngineBtn.textContent = instance.searchEngine;
          }
        } else if (act === 'focus-search') {
          if (instance.els.ntSearchInput) instance.els.ntSearchInput.focus();
        }
      }
    });

    if (els.ntSearchForm) {
      els.ntSearchForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var q = els.ntSearchInput ? els.ntSearchInput.value.trim() : '';
        if (!q) {
          if (els.ntSearchInput) els.ntSearchInput.focus();
          return;
        }
        var searchBase = instance.searchEngine === 'DuckDuckGo'
          ? 'https://duckduckgo.com/?q='
          : 'https://www.google.com/search?q=';
        window.open(searchBase + encodeURIComponent(q), '_blank', 'noopener,noreferrer');
      });
    }

    if (els.floatingWidget) {
      bindWidgetDragEvents(els.floatingWidget);
    }
  }

  function mount(containerEl, initialState, callbacks) {
    if (!containerEl) return;

    if (instance.resizeObserver) {
      instance.resizeObserver.disconnect();
      instance.resizeObserver = null;
    }
    if (instance.clockTimer) {
      clearInterval(instance.clockTimer);
      instance.clockTimer = null;
    }

    instance.containerEl = containerEl;
    instance.callbacks = callbacks || {};
    instance.loadedIframeUrl = '';
    instance.state = Object.assign(createFallbackState(), initialState || {});
    instance.mounted = true;

    renderMarkup(containerEl);
    syncModeDom();
    syncWidgetControlPills();
    syncWeatherDataDom();
    recalcScale();

    if (typeof ResizeObserver !== 'undefined' && instance.els.measureBox) {
      instance.resizeObserver = new ResizeObserver(function () {
        recalcScale();
      });
      instance.resizeObserver.observe(instance.els.measureBox);
    }
    window.addEventListener('resize', recalcScale);

    instance.clockTimer = setInterval(syncClockDom, 15000);
    requestAnimationFrame(function () {
      recalcScale();
      applyWidgetTransform();
    });
  }

  function update(nextState) {
    if (!instance.mounted || !instance.els.root) return;
    if (nextState && typeof nextState === 'object') {
      instance.state = Object.assign({}, instance.state, nextState);
    }
    syncWeatherDataDom();
    recalcScale();
  }

  window.WeatherBuddyDesktopStage = {
    mount: mount,
    update: update
  };
})();
