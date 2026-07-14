/* ==========================================================================
   Karthik R — Portfolio Script
   Vanilla JS: canvas signature graphic, typing animation, scroll reveals,
   counters, tilt, testimonials, contact form, nav, toasts.
   ========================================================================== */

(() => {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------------
     Footer year
  --------------------------------------------------------------------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------------------------------------------------------------------
     Signature background: connected node graph
     (visual metaphor for AI graphs + molecular structure)
  --------------------------------------------------------------------- */
  const canvas = document.getElementById('graph-canvas');
  if (canvas && !prefersReducedMotion) {
    const ctx = canvas.getContext('2d');
    let width, height, nodes;
    const NODE_COUNT_DENSITY = 14000; // px^2 per node
    const LINK_DIST = 140;
    const mouse = { x: -9999, y: -9999 };

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      const count = Math.min(90, Math.floor((width * height) / NODE_COUNT_DENSITY));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.8
      }));
    }

    function step() {
      ctx.clearRect(0, 0, width, height);
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      }
      // links
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const opacity = (1 - dist / LINK_DIST) * 0.16;
            ctx.strokeStyle = `rgba(91,140,255,${opacity})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // link to mouse for a "cursor glow" feel
        const dxm = a.x - mouse.x, dym = a.y - mouse.y;
        const dm = Math.sqrt(dxm * dxm + dym * dym);
        if (dm < 180) {
          ctx.strokeStyle = `rgba(0,229,255,${(1 - dm / 180) * 0.35})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
      // nodes
      for (const n of nodes) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0,229,255,0.55)';
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(step);
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

    resize();
    requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------------------
     Hero typing animation
  --------------------------------------------------------------------- */
  const typedRole = document.getElementById('typedRole');
  const roles = [
    'AI Engineer',
    'Founder, EcoEssence',
    'Founder, The Hidden Curriculum',
    'Product Builder',
    'Technology Speaker'
  ];

  if (typedRole) {
    if (prefersReducedMotion) {
      typedRole.textContent = roles[0];
    } else {
      let roleIndex = 0, charIndex = 0, deleting = false;

      function tick() {
        const current = roles[roleIndex];
        if (!deleting) {
          charIndex++;
          typedRole.textContent = current.slice(0, charIndex);
          if (charIndex === current.length) {
            deleting = true;
            setTimeout(tick, 1400);
            return;
          }
        } else {
          charIndex--;
          typedRole.textContent = current.slice(0, charIndex);
          if (charIndex === 0) {
            deleting = false;
            roleIndex = (roleIndex + 1) % roles.length;
          }
        }
        setTimeout(tick, deleting ? 35 : 65);
      }
      tick();
    }
  }

  /* ---------------------------------------------------------------------
     Mobile nav toggle
  --------------------------------------------------------------------- */
  const navToggle = document.getElementById('navToggle');
  const navMenu = document.getElementById('navMenu');
  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const open = navMenu.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------------------------------------------------------------------
     Scroll cue
  --------------------------------------------------------------------- */
  const scrollCue = document.getElementById('scrollCue');
  if (scrollCue) {
    scrollCue.addEventListener('click', () => {
      document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  /* ---------------------------------------------------------------------
     Intersection Observer: fade-ins, skill bars, counters
  --------------------------------------------------------------------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  revealEls.forEach(el => revealObserver.observe(el));

  // Skill bars
  const skillFills = document.querySelectorAll('.skill-bar__fill');
  const skillObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.width = entry.target.dataset.width + '%';
        skillObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.4 });
  skillFills.forEach(el => skillObserver.observe(el));

  // Counters
  const counterEls = document.querySelectorAll('.counter__number');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counterEls.forEach(el => counterObserver.observe(el));

  function animateCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const duration = 1400;
    const startTime = performance.now();

    function frame(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.floor(eased * target);
      el.textContent = prefix + value.toLocaleString('en-IN') + suffix;
      if (progress < 1) requestAnimationFrame(frame);
      else el.textContent = prefix + target.toLocaleString('en-IN') + suffix;
    }
    requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------------
     Card tilt (mouse tracking)
  --------------------------------------------------------------------- */
  if (!prefersReducedMotion && window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('[data-tilt]').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(600px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg) translateY(-4px)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  /* ---------------------------------------------------------------------
     Button ripple effect
  --------------------------------------------------------------------- */
  document.querySelectorAll('[data-ripple]').forEach(btn => {
    btn.addEventListener('click', function (e) {
      const rect = this.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  });

  /* ---------------------------------------------------------------------
     Project card expand/collapse
  --------------------------------------------------------------------- */
  document.querySelectorAll('.project-card__expand').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.expand;
      const details = document.getElementById(targetId);
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (details) details.hidden = isOpen;
    });
  });

  /* ---------------------------------------------------------------------
     Testimonial slider
  --------------------------------------------------------------------- */
  const testimonials = document.querySelectorAll('.testimonial');
  const dotsWrap = document.getElementById('testimonialDots');
  if (testimonials.length && dotsWrap) {
    let activeIndex = 0;
    testimonials.forEach((t, i) => {
      const dot = document.createElement('button');
      dot.setAttribute('aria-label', `Show testimonial ${i + 1}`);
      if (i === 0) dot.classList.add('is-active');
      dot.addEventListener('click', () => setActive(i));
      dotsWrap.appendChild(dot);
    });
    testimonials[0].classList.add('is-active');

    function setActive(i) {
      testimonials[activeIndex].classList.remove('is-active');
      dotsWrap.children[activeIndex].classList.remove('is-active');
      activeIndex = i;
      testimonials[activeIndex].classList.add('is-active');
      dotsWrap.children[activeIndex].classList.add('is-active');
    }

    if (!prefersReducedMotion) {
      setInterval(() => setActive((activeIndex + 1) % testimonials.length), 5500);
    }
  }

  /* ---------------------------------------------------------------------
     Toast helper
  --------------------------------------------------------------------- */
  const toast = document.getElementById('toast');
  let toastTimer;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  /* ---------------------------------------------------------------------
     Resume button (no file provided — honest fallback)
  --------------------------------------------------------------------- */
  const resumeBtn = document.getElementById('resumeBtn');
  if (resumeBtn) {
    resumeBtn.addEventListener('click', () => {
      showToast('Résumé available on request — email karthikr272006@gmail.com');
    });
  }

  /* ---------------------------------------------------------------------
     Contact form validation + fake submit
  --------------------------------------------------------------------- */
  const form = document.getElementById('contactForm');
  if (form) {
    const fields = {
      name: { input: document.getElementById('name'), error: document.getElementById('nameError') },
      email: { input: document.getElementById('email'), error: document.getElementById('emailError') },
      message: { input: document.getElementById('message'), error: document.getElementById('messageError') }
    };
    const statusEl = document.getElementById('formStatus');
    const submitLabel = document.getElementById('submitLabel');

    function validateField(key) {
      const { input, error } = fields[key];
      let message = '';
      const value = input.value.trim();

      if (!value) {
        message = 'This field is required.';
      } else if (key === 'email') {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value)) message = 'Enter a valid email address.';
      } else if (key === 'message' && value.length < 10) {
        message = 'Message should be at least 10 characters.';
      }

      error.textContent = message;
      input.closest('.form-row').classList.toggle('has-error', Boolean(message));
      return !message;
    }

    Object.keys(fields).forEach(key => {
      fields[key].input.addEventListener('blur', () => validateField(key));
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const validations = Object.keys(fields).map(validateField);
      const allValid = validations.every(Boolean);

      if (!allValid) {
        statusEl.textContent = 'Please fix the errors above.';
        return;
      }

      submitLabel.textContent = 'Sending…';
      statusEl.textContent = '';

      // No backend is connected — this simulates submission and
      // points the visitor to a working channel (mailto) instead
      // of silently pretending a message was delivered.
      setTimeout(() => {
        submitLabel.textContent = 'Send Message';
        statusEl.textContent = 'Thanks! For a guaranteed reply, please also email karthikr272006@gmail.com directly.';
        showToast('Message noted — reach out by email for the fastest response.');
        form.reset();
      }, 900);
    });
  }

})();
