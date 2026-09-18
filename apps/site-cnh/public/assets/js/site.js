(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var config = window.CNH_CONFIG || {};
  var whatsapp = String(config.whatsapp || '').replace(/\D/g, '');
  var mensagem = String(config.mensagem || '');
  var links = document.querySelectorAll('[data-whatsapp]');

  if (whatsapp && mensagem) {
    var url = 'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent(mensagem);

    links.forEach(function (link) {
      link.setAttribute('href', url);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    });
  }

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var revealItems = document.querySelectorAll('.reveal');
  if (revealItems.length) {
    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach(function (item) {
        item.classList.add('is-visible');
      });
    } else {
      var observer = new IntersectionObserver(
        function (entries, instance) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              instance.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.12,
          rootMargin: '0px 0px -8% 0px',
        },
      );

      revealItems.forEach(function (item) {
        observer.observe(item);
      });
    }
  }

  var tiltItems = document.querySelectorAll('[data-tilt]');
  if (!reducedMotion && tiltItems.length) {
    tiltItems.forEach(function (item) {
      item.addEventListener('pointermove', function (event) {
        var rect = item.getBoundingClientRect();
        var px = (event.clientX - rect.left) / rect.width;
        var py = (event.clientY - rect.top) / rect.height;
        var rx = (0.5 - py) * 8;
        var ry = (px - 0.5) * 10;
        item.style.transform =
          'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-4px)';
      });
      item.addEventListener('pointerleave', function () {
        item.style.transform = '';
      });
      item.addEventListener('pointercancel', function () {
        item.style.transform = '';
      });
    });
  }

  var detailsItems = document.querySelectorAll('.faq__item');
  detailsItems.forEach(function (detail) {
    detail.addEventListener('toggle', function () {
      if (!detail.open) return;
      detailsItems.forEach(function (other) {
        if (other !== detail) {
          other.open = false;
        }
      });
    });
  });

  var heroVideo = document.querySelector('.hero__video');
  if (heroVideo && !reducedMotion) {
    var promise = heroVideo.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(function () {
        heroVideo.setAttribute('controls', 'controls');
      });
    }
  }
})();
