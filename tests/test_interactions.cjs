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
}

class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
}

function bootPortfolio() {
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

  const queryResults = new Map([
    ['[data-reveal]', []],
    ['.skill-bar__fill', []],
    ['.counter__number', []],
    ['[data-tilt]', []],
    ['[data-ripple]', []],
    ['.project-card__expand', [projectButton]],
    ['.testimonial', []],
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
  const context = {
    clearInterval() {},
    clearTimeout() {},
    document,
    IntersectionObserver: FakeIntersectionObserver,
    performance: { now: () => 0 },
    requestAnimationFrame: () => 1,
    setInterval: () => 1,
    setTimeout: () => 1,
    window,
  };

  vm.runInNewContext(SCRIPT, context, { filename: SCRIPT_PATH });

  return {
    form,
    get: id => elements.get(id),
    navLink,
    navToggle,
    projectButton,
    projectDetails,
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

test('project details expand and collapse with accessible state', () => {
  const site = bootPortfolio();

  site.projectButton.dispatch('click');
  assert.equal(site.projectButton.getAttribute('aria-expanded'), 'true');
  assert.equal(site.projectDetails.hidden, false);

  site.projectButton.dispatch('click');
  assert.equal(site.projectButton.getAttribute('aria-expanded'), 'false');
  assert.equal(site.projectDetails.hidden, true);
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
