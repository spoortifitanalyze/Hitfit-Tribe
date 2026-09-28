const createElement = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
};

const renderAbout = (about) => {
  const heading = document.getElementById('about-heading');
  if (heading && about.heading) heading.textContent = about.heading;

  const container = document.getElementById('about-content');
  if (!container) return;
  container.replaceChildren(
    ...about.body
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => createElement('p', '', paragraph))
  );
};

const renderProfilePhoto = (photoUrl) => {
  const portrait = document.getElementById('coach-portrait');
  if (!portrait || !photoUrl) return;
  const image = createElement('img');
  image.src = photoUrl;
  image.alt = 'Coach Hitendra Choudhary';
  portrait.replaceChildren(image);
  portrait.classList.add('has-photo');
};

const renderPlans = (plans) => {
  const container = document.getElementById('plans-content');
  if (!container) return;
  container.replaceChildren(
    ...plans.map((plan, index) => {
      const card = createElement('article', 'program-card');
      card.append(
        createElement('div', 'program-icon', String(index + 1).padStart(2, '0')),
        createElement('h3', '', plan.title)
      );
      if (plan.description) card.append(createElement('p', '', plan.description));

      const details = createElement('dl', 'program-details');
      [['Who it’s for', plan.audience], ['Prerequisites', plan.prerequisites]]
        .filter(([, value]) => value)
        .forEach(([label, value]) => details.append(createElement('dt', '', label), createElement('dd', '', value)));
      if (details.children.length) card.append(details);

      return card;
    })
  );
};

const renderTestimonials = (testimonials) => {
  const section = document.getElementById('testimonials');
  const container = document.getElementById('testimonials-content');
  if (!container) return;
  if (section) section.hidden = testimonials.length === 0;
  container.replaceChildren(
    ...testimonials.map((item, index) => {
      const card = createElement('blockquote', index === 0 ? 'testimonial-card is-active' : 'testimonial-card');
      const footer = createElement('footer');
      footer.append(createElement('strong', '', item.name));
      card.append(createElement('p', '', `“${item.comment}”`), footer);
      return card;
    })
  );
  initCarousel();
};

const renderGoalOptions = (plans) => {
  const select = document.getElementById('goal-select');
  if (!select) return;
  const [placeholder] = select.options;
  const selected = select.value;
  select.replaceChildren(
    placeholder,
    ...plans.map((plan) => createElement('option', '', plan.title)),
    createElement('option', '', 'Not sure yet')
  );
  // Keep the visitor's choice if they picked one before the saved content loaded.
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
};

// ---------- testimonial carousel ----------

const CAROUSEL_INTERVAL_MS = 6000;
let carouselTimer = null;

const initCarousel = () => {
  const carousel = document.querySelector('.testimonial-carousel');
  const cards = [...document.querySelectorAll('#testimonials-content .testimonial-card')];
  const dots = document.getElementById('testimonial-dots');
  if (!carousel || !dots) return;

  clearInterval(carouselTimer);
  const controls = carousel.querySelector('.carousel-controls');
  controls.hidden = cards.length < 2;
  if (cards.length < 2) return;

  let current = Math.max(0, cards.findIndex((card) => card.classList.contains('is-active')));

  const show = (index) => {
    const next = (index + cards.length) % cards.length;
    if (next === current) return;
    cards[current].classList.replace('is-active', 'is-leaving');
    const leaving = cards[current];
    setTimeout(() => leaving.classList.remove('is-leaving'), 600);
    cards[next].classList.add('is-active');
    current = next;
    [...dots.children].forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)));
  };

  dots.replaceChildren(
    ...cards.map((_, i) => {
      const dot = createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Show testimonial ${i + 1}`);
      dot.setAttribute('aria-current', String(i === current));
      dot.addEventListener('click', () => show(i));
      return dot;
    })
  );

  controls.querySelector('[data-carousel="prev"]').onclick = () => show(current - 1);
  controls.querySelector('[data-carousel="next"]').onclick = () => show(current + 1);

  // Auto-rotate, pausing while the visitor hovers or tabs into it; skipped if they prefer reduced motion.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const start = () => {
    clearInterval(carouselTimer);
    carouselTimer = setInterval(() => show(current + 1), CAROUSEL_INTERVAL_MS);
  };
  const stop = () => clearInterval(carouselTimer);
  carousel.onmouseenter = stop;
  carousel.onmouseleave = start;
  carousel.onfocusin = stop;
  carousel.onfocusout = start;
  start();
};

// The page ships with default content in the HTML; this swaps in whatever the admin saved.
const renderHomepage = async () => {
  try {
    // Relative path so it works both on GitHub Pages (/Hitfit-Tribe/) and the local server.
    // The timestamp skips GitHub Pages' cache so new saves appear as soon as they're deployed.
    const response = await fetch(`data/content.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const content = await response.json();
    renderProfilePhoto(content.profilePhoto);
    renderAbout(content.about);
    renderPlans(content.plans);
    renderTestimonials(content.testimonials);
    renderGoalOptions(content.plans);
  } catch (error) {
    console.warn('Could not load saved content, showing defaults:', error);
  }
};

const saveContactFormResponse = async (payload) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `hitfit-tribe-response-${timestamp}.json`;

  try {
    if ('showDirectoryPicker' in window) {
      const directoryHandle = await window.showDirectoryPicker();
      const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(JSON.stringify(payload, null, 2));
      await writable.close();
      return 'saved';
    }
  } catch (error) {
    console.warn('Folder picker was cancelled or unsupported:', error);
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
};

document.addEventListener('DOMContentLoaded', () => {
  initCarousel();
  renderHomepage();

  const contactForm = document.getElementById('contact-form');
  const formStatus = document.getElementById('form-status');

  if (contactForm && formStatus) {
    contactForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(contactForm).entries());
      const payload = {
        submittedAt: new Date().toISOString(),
        ...formData
      };

      const result = await saveContactFormResponse(payload);
      formStatus.textContent = result === 'saved'
        ? 'Response saved to the selected folder.'
        : 'Response downloaded to your browser. You can save it into a Google Drive folder later.';
      contactForm.reset();
    });
  }
});
