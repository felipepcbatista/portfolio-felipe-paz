/* ============================================================
   MAIN — i18n, campo de estrelas, nav, reveal, contadores
   e formulário de contato.
   ============================================================ */

(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ========================================================
     i18n — detecta o idioma do navegador e permite alternar
     ======================================================== */
  var STORAGE_KEY = 'portfolio-lang';
  var lang;

  function detectLang() {
    // 1. preferência salva pelo próprio visitante
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'pt' || saved === 'en') return saved;
    } catch (e) { /* storage bloqueado — segue para a detecção */ }

    // 2. idioma do navegador
    var nav = navigator.languages && navigator.languages.length
      ? navigator.languages[0]
      : (navigator.language || 'pt');

    return /^pt/i.test(nav) ? 'pt' : 'en';
  }

  function applyLang(next) {
    var dict = window.I18N[next];
    if (!dict) return;

    lang = next;
    document.documentElement.lang = (next === 'pt') ? 'pt-BR' : 'en';

    // texto (aceita HTML nas traduções — o conteúdo é nosso, não do usuário)
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n')];
      if (v !== undefined) el.innerHTML = v;
    });

    // placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n-placeholder')];
      if (v !== undefined) el.placeholder = v;
    });

    // alt de imagem
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n-alt')];
      if (v !== undefined) el.alt = v;
    });

    // aria-label
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var v = dict[el.getAttribute('data-i18n-aria')];
      if (v !== undefined) el.setAttribute('aria-label', v);
    });

    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { /* ok */ }
  }

  applyLang(detectLang());

  var langToggle = document.getElementById('langToggle');
  if (langToggle) {
    langToggle.addEventListener('click', function () {
      applyLang(lang === 'pt' ? 'en' : 'pt');
    });
  }

  function t(key) {
    var dict = window.I18N[lang] || window.I18N.pt;
    return dict[key] || key;
  }

  /* ========================================================
     campo de estrelas
     ======================================================== */
  var cv = document.getElementById('sky');
  var ctx = cv.getContext('2d');
  var stars = [];
  var w, h, dpr;

  function sizeSky() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var count = Math.round((w * h) / 11000);
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.25 + 0.25,
        a: Math.random() * 0.55 + 0.2,
        tw: Math.random() * 0.014 + 0.003,
        p: Math.random() * Math.PI * 2,
        d: Math.random() * 0.55 + 0.18
      });
    }
  }

  var scrollY = 0;

  function drawSky(ts) {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var alpha = s.a + Math.sin(ts * s.tw + s.p) * 0.22;
      if (alpha < 0.04) alpha = 0.04;
      var y = s.y - scrollY * s.d * 0.14;
      y = ((y % h) + h) % h;
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(215, 210, 255,' + alpha + ')';
      ctx.fill();
    }
    requestAnimationFrame(drawSky);
  }

  function drawStatic() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(215, 210, 255,' + s.a + ')';
      ctx.fill();
    }
  }

  sizeSky();
  window.addEventListener('resize', function () {
    sizeSky();
    if (reduce) drawStatic();
  });

  if (reduce) { drawStatic(); } else { requestAnimationFrame(drawSky); }

  /* ========================================================
     nav + parallax
     ======================================================== */
  var nav = document.getElementById('nav');

  function onScroll() {
    scrollY = window.scrollY || 0;
    if (scrollY > 40) { nav.classList.add('stuck'); }
    else { nav.classList.remove('stuck'); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ========================================================
     reveal em scroll
     ======================================================== */
  var revealables = document.querySelectorAll('.rv');

  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('in'); });
  }

  /* ========================================================
     contadores animados
     ======================================================== */
  function fmt(v, decimals) {
    var s = Math.abs(v).toFixed(decimals);
    if (lang === 'pt') s = s.replace('.', ',');
    return (v < 0 ? '−' : '') + s;
  }

  function runCount(el) {
    var raw = el.getAttribute('data-count');
    var target = parseFloat(raw);
    var suffix = el.getAttribute('data-suffix') || '';
    var decimals = (raw.split('.')[1] || '').length;
    var dur = 1400;
    var start = null;

    function tick(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased, decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  var counters = document.querySelectorAll('[data-count]');

  if ('IntersectionObserver' in window && !reduce) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { runCount(e.target); co.unobserve(e.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { co.observe(el); });
  } else {
    counters.forEach(function (el) {
      var raw = el.getAttribute('data-count');
      var d = (raw.split('.')[1] || '').length;
      el.textContent = fmt(parseFloat(raw), d) + (el.getAttribute('data-suffix') || '');
    });
  }

  /* ========================================================
     formulário de contato
     ======================================================== */
  var form = document.getElementById('contactForm');

  if (form) {
    var statusEl = document.getElementById('formStatus');
    var submitBtn = document.getElementById('submitBtn');
    var submitLabel = document.getElementById('submitLabel');

    function setStatus(msg, kind) {
      statusEl.textContent = msg;
      statusEl.className = 'form-status' + (kind ? ' ' + kind : '');
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();

      var payload = {
        nome: form.nome.value.trim(),
        email: form.email.value.trim(),
        mensagem: form.mensagem.value.trim(),
        website: form.website.value // honeypot
      };

      // validação no cliente (o servidor valida de novo)
      if (payload.nome.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) || payload.mensagem.length < 10) {
        setStatus(t('form.erro'), 'err');
        return;
      }

      submitBtn.disabled = true;
      submitLabel.textContent = t('form.enviando');
      setStatus('', '');

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (r) {
          if (r.ok) {
            setStatus(t('form.sucesso'), 'ok');
            form.reset();
          } else {
            setStatus(r.data.error || t('form.erro'), 'err');
          }
        })
        .catch(function () {
          setStatus(t('form.erro'), 'err');
        })
        .then(function () {
          submitBtn.disabled = false;
          submitLabel.textContent = t('form.enviar');
        });
    });
  }
})();
