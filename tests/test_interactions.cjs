'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SCRIPT_PATH = path.join(__dirname, '..', 'script.js');
const SCRIPT = fs.readFileSync(SCRIPT_PATH, 'utf8');

class FakeClassList {
  constructor(initial = []) {
    this.values = new Set(initial);
  }

  add(...tokens) {
    tokens.forEach(token => this.values.add(token));
  }

  remove(...tokens) {
    tokens.forEach(token => this.values.delete(token));
  }

  contains(token) {
    return this.values.has(token);
  }

  toggle(token, force) {
    if (force === true) {
      this.values.add(token);
      return true;
    }
    if (force === false) {
      this.values.delete(token);
      return false;
    }
    if (this.values.has(token)) {
      this.values.delete(token);
      return false;
    }
    this.values.add(token);
    return true;
  }
}

class FakeElement {
  constructor({ attributes = {}, classes = [] } = {}) {
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
    this.classList = new FakeClassList(classes);
    this.dataset = {};
    this.formRow = null;
    this.hidden = false;
    this.links = [];
    this.listeners = new Map();
    this.resetCalled = false;
    this.scrollIntoViewCalls = [];
    this.style = {};
    this._textContent = '';
    this.value = '';
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type, overrides = {}) {
    const event = {
      clientX: 0,
      clientY: 0,
      defaultPrevented: false,
      ...overrides,
    };
    event.preventDefault = () => {
      event.defaultPrevented = true;
    };
    for (const listener of this.listeners.get(type) || []) {
      listener.call(this, event);
    }
    return event;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  querySelectorAll(selector) {
    return selector === 'a' ? this.links : [];
  }

  closest(selector) {
    return selector === '.form-row' ? this.formRow : null;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  reset() {
    this.resetCalled = true;
  }

  scrollIntoView(options) {
    this.scrollIntoViewCalls.push(options);
  }
}

class FakeIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
    this.observed = [];
    FakeIntersectionObserver.instances.push(this);
  }

  observe(target) {
    this.observed.push(target);
  }

  unobserve(target) {
    this.observed = this.observed.filter(element => element !== target);
  }

  emit(entries) {
    this.callback(entries);
  }
}

FakeIntersectionObserver.instances = [];

function bootPortfolio({
  revealCount = 0,
  skillWidths = [],
  testimonialCount = 0,
} = {}) {
  FakeIntersectionObserver.instances = [];
  const elements = new Map();
  const add = (id, options) => {
    const element = new FakeElement(options);
    elements.set(id, element);
    return element;
  };

  add('year');
  add('graph-canvas');
  add('typedRole');

  const navToggle = add('navToggle', {
    attributes: { 'aria-expanded': 'false' },
  });
  const navMenu = add('navMenu');
  const navLink = new FakeElement();
  navMenu.links = [navLink];

  add('scrollCue');
  add('about');
  add('testimonialDots');
  add('toast');
  add('resumeBtn');

  const form = add('contactForm');
  const addField = id => {
    const input = add(id);
    input.formRow = new FakeElement({ classes: ['form-row'] });
    return input;
  };
  addField('name');
  add('nameError');
  addField('email');
  add('emailError');
  addField('message');
  add('messageError');
  add('formStatus');
  add('submitLabel');

  const projectButton = new FakeElement({
    attributes: { 'aria-expanded': 'false' },
    classes: ['project-card__expand'],
  });
  projectButton.dataset.expand = 'eco';
  const projectDetails = add('eco');
  projectDetails.hidden = true;

  const testimonials = Array.from(
    { length: testimonialCount },
    () => new FakeElement({ classes: ['testimonial'] }),
  );
  const revealElements = Array.from(
    { length: revealCount },
    () => new FakeElement(),
  );
  const skillFills = skillWidths.map(width => {
    const fill = new FakeElement();
    fill.dataset.width = String(width);
    return fill;
  });

  const queryResults = new Map([
    ['[data-reveal]', revealElements],
    ['.skill-bar__fill', skillFills],
    ['.counter__number', []],
    ['[data-tilt]', []],
    ['[data-ripple]', []],
    ['.project-card__expand', [projectButton]],
    ['.testimonial', testimonials],
  ]);

  const document = {
    createElement: () => new FakeElement(),
    getElementById: id => elements.get(id) || null,
    querySelectorAll: selector => queryResults.get(selector) || [],
  };
  const window = {
    addEventListener() {},
    matchMedia: query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
    }),
  };
  const timeouts = new Map();
  let nextTimeoutId = 0;
  const context = {
    clearInterval() {},
    clearTimeout: id => timeouts.delete(id),
    document,
    IntersectionObserver: FakeIntersectionObserver,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    setInterval: () => 1,
    setTimeout(callback) {
      const id = ++nextTimeoutId;
      timeouts.set(id, callback);
      return id;
    },
    window,
  };

  vm.runInNewContext(SCRIPT, context, { filename: SCRIPT_PATH });

  return {
    form,
    // Execute one pending batch without real delays. This exposes deferred
    // form side effects; it does not simulate browser timer ordering.
    flushTimeouts() {
      const pending = Array.from(timeouts.keys());
      for (const id of pending) {
        const callback = timeouts.get(id);
        timeouts.delete(id);
        if (callback) callback();
      }
    },
    get: id => elements.get(id),
    navLink,
    navToggle,
    projectButton,
    projectDetails,
    revealElements,
    revealObserver: FakeIntersectionObserver.instances[0],
    skillFills,
    skillObserver: FakeIntersectionObserver.instances.find(observer =>
      observer.observed.some(element => skillFills.includes(element))
    ),
    testimonials,
  };
}

test('reduced-motion startup sets stable role and current year', () => {
  const site = bootPortfolio();

  assert.equal(site.get('typedRole').textContent, 'AI Engineer');
  assert.equal(site.get('year').textContent, String(new Date().getFullYear()));
});

test('mobile navigation opens and closes with accessible state', () => {
  const site = bootPortfolio();

  site.navToggle.dispatch('click');
  assert.equal(site.navToggle.getAttribute('aria-expanded'), 'true');
  assert.equal(site.get('navMenu').classList.contains('is-open'), true);

  site.navLink.dispatch('click');
  assert.equal(site.navToggle.getAttribute('aria-expanded'), 'false');
  assert.equal(site.get('navMenu').classList.contains('is-open'), false);
});

test('scroll cue navigates to the About section', () => {
  const site = bootPortfolio();

  site.get('scrollCue').dispatch('click');
  assert.equal(site.get('about').scrollIntoViewCalls.length, 1);
});

test('revealed content becomes visible when it enters the viewport', () => {
  const site = bootPortfolio({ revealCount: 2 });
  const [outsideViewport, insideViewport] = site.revealElements;

  assert.equal(site.revealObserver.observed.length, 2);
  site.revealObserver.emit([
    { target: outsideViewport, isIntersecting: false },
    { target: insideViewport, isIntersecting: true },
  ]);

  assert.equal(outsideViewport.classList.contains('is-visible'), false);
  assert.equal(insideViewport.classList.contains('is-visible'), true);
  assert.equal(site.revealObserver.observed.includes(outsideViewport), true);
  assert.equal(site.revealObserver.observed.includes(insideViewport), false);
});

test('skill bars fill once when they enter the viewport', () => {
  const site = bootPortfolio({ skillWidths: [78, 92] });
  const [outsideViewport, insideViewport] = site.skillFills;

  assert.equal(site.skillObserver.observed.length, 2);
  site.skillObserver.emit([
    { target: outsideViewport, isIntersecting: false },
    { target: insideViewport, isIntersecting: true },
  ]);

  assert.equal(outsideViewport.style.width, undefined);
  assert.equal(insideViewport.style.width, '92%');
  assert.equal(site.skillObserver.observed.includes(outsideViewport), true);
  assert.equal(site.skillObserver.observed.includes(insideViewport), false);
});

test('project details expand and collapse with accessible state', () => {
  const site = bootPortfolio();

  site.projectButton.dispatch('click');
  assert.equal(site.projectButton.getAttribute('aria-expanded'), 'true');
  assert.equal(site.projectDetails.hidden, false);

  site.projectButton.dispatch('click');
  assert.equal(site.projectButton.getAttribute('aria-expanded'), 'false');
  assert.equal(site.projectDetails.hidden, true);
});

test('testimonial controls are labelled and switch active testimonial', () => {
  const site = bootPortfolio({ testimonialCount: 3 });
  const dots = site.get('testimonialDots').children;

  assert.equal(dots.length, site.testimonials.length);
  assert.deepEqual(
    dots.map(dot => dot.getAttribute('aria-label')),
    ['Show testimonial 1', 'Show testimonial 2', 'Show testimonial 3'],
  );
  assert.equal(site.testimonials[0].classList.contains('is-active'), true);
  assert.equal(dots[0].classList.contains('is-active'), true);

  dots[1].dispatch('click');
  assert.equal(site.testimonials[0].classList.contains('is-active'), false);
  assert.equal(site.testimonials[1].classList.contains('is-active'), true);
  assert.equal(dots[0].classList.contains('is-active'), false);
  assert.equal(dots[1].classList.contains('is-active'), true);
});

test('contact validation updates field feedback on blur', () => {
  const site = bootPortfolio();
  const email = site.get('email');

  email.value = 'not-an-email';
  email.dispatch('blur');
  assert.equal(site.get('emailError').textContent, 'Enter a valid email address.');
  assert.equal(email.formRow.classList.contains('has-error'), true);

  email.value = 'karthik@example.com';
  email.dispatch('blur');
  assert.equal(site.get('emailError').textContent, '');
  assert.equal(email.formRow.classList.contains('has-error'), false);
});

test('invalid contact fields are blocked and receive specific feedback', () => {
  const site = bootPortfolio();

  const firstSubmit = site.form.dispatch('submit');
  assert.equal(firstSubmit.defaultPrevented, true);
  assert.equal(site.get('nameError').textContent, 'This field is required.');
  assert.equal(site.get('emailError').textContent, 'This field is required.');
  assert.equal(site.get('messageError').textContent, 'This field is required.');
  assert.equal(site.get('formStatus').textContent, 'Please fix the errors above.');

  site.get('name').value = 'Karthik';
  site.get('email').value = 'not-an-email';
  site.get('message').value = 'short';
  site.form.dispatch('submit');

  assert.equal(site.get('nameError').textContent, '');
  assert.equal(site.get('name').formRow.classList.contains('has-error'), false);
  assert.equal(site.get('emailError').textContent, 'Enter a valid email address.');
  assert.equal(
    site.get('messageError').textContent,
    'Message should be at least 10 characters.',
  );
});

test('each invalid contact field blocks submission without losing entered text', async t => {
  const cases = [
    { field: 'name', value: '', error: 'This field is required.' },
    { field: 'name', value: ' \t ', error: 'This field is required.' },
    { field: 'email', value: '   ', error: 'This field is required.' },
    { field: 'email', value: 'not-an-email', error: 'Enter a valid email address.' },
    { field: 'message', value: ' \n ', error: 'This field is required.' },
    { field: 'message', value: ' 123456789 ', error: 'Message should be at least 10 characters.' },
  ];

  for (const { field, value, error } of cases) {
    await t.test(`${field}: ${JSON.stringify(value)}`, () => {
      const site = bootPortfolio();
      const values = {
        name: 'Karthik',
        email: 'karthik@example.com',
        message: 'Please contact me about a workshop.',
        [field]: value,
      };
      for (const [key, input] of Object.entries(values)) {
        site.get(key).value = input;
      }
      site.get('submitLabel').textContent = 'Send Message';

      const event = site.form.dispatch('submit');
      assert.equal(event.defaultPrevented, true);
      assert.equal(site.get('submitLabel').textContent, 'Send Message');
      // A mistaken transition to the submission callback must not reset an
      // invalid form or replace its error status with a success message.
      site.flushTimeouts();
      assert.equal(site.form.resetCalled, false);
      assert.equal(site.get('formStatus').textContent, 'Please fix the errors above.');
      assert.equal(site.get('toast').classList.contains('is-visible'), false);
      for (const [key, input] of Object.entries(values)) {
        assert.equal(site.get(key).value, input, `${key} input was changed`);
        assert.equal(site.get(`${key}Error`).textContent, key === field ? error : '');
        assert.equal(site.get(key).formRow.classList.contains('has-error'), key === field);
      }
    });
  }
});

test('message validation accepts the ten-character boundary after correction', () => {
  const site = bootPortfolio();
  const message = site.get('message');

  message.value = ' 123456789 ';
  message.dispatch('blur');
  assert.equal(site.get('messageError').textContent, 'Message should be at least 10 characters.');
  assert.equal(message.formRow.classList.contains('has-error'), true);

  message.value = ' 1234567890 ';
  message.dispatch('blur');
  assert.equal(site.get('messageError').textContent, '');
  assert.equal(message.formRow.classList.contains('has-error'), false);
  assert.equal(message.value, ' 1234567890 ');
});
