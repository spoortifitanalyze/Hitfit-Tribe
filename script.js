const STORAGE_KEY = 'hitfit-tribe-content';
const ADMIN_EMAILS = ['bheed.spoorti@gmail.com', 'hitendra2309@gmail.com'];

const defaultContent = {
  about: `
    <p>
      Hitendra Choudhary, an avid marathoner including a Boston Marathon finisher, brings real race experience and practical endurance coaching to every athlete. At Hitfit Tribe, the goal is simple: help runners become stronger, more resilient, and more confident in their training.
    </p>
    <p>
      Whether you are just starting your running journey or preparing for your next race, the coaching approach blends endurance training, strength work, mobility, and mindset support so you can stay consistent and keep improving without burning out.
    </p>
  `,
  training: `
    <h3>Personalized Training Plans</h3>
    <p>Every athlete receives a structured plan built around their fitness level, race goals, and recovery capacity.</p>
    <ul>
      <li>Progressive weekly structure with clear mileage targets</li>
      <li>Strength, mobility, and technique sessions for long-term performance</li>
      <li>Weekly check-ins and adjustments based on recovery and progress</li>
      <li>Full Marathon Training Programs for race-day readiness and endurance build-up</li>
      <li>Triathlon Training Programs for swim, bike, and run progression</li>
    </ul>
  `,
  testimonials: `
    <blockquote class="testimonial-card">
      <p>“I used to dread every run. With Hitendra’s structure and support, I built consistency and finally finished my first 10K feeling strong.”</p>
      <footer>
        <strong>Priya S.</strong>
        <span>Beginner Runner</span>
      </footer>
    </blockquote>
    <blockquote class="testimonial-card">
      <p>“The plans were realistic, the guidance was clear, and the mindset coaching helped me stay calm under pressure during race week.”</p>
      <footer>
        <strong>Rohit M.</strong>
        <span>5K to 10K Athlete</span>
      </footer>
    </blockquote>
    <blockquote class="testimonial-card">
      <p>“Hitendra brings a rare mix of discipline and encouragement. His coaching didn’t just improve my pace—it made me more confident.”</p>
      <footer>
        <strong>Ananya K.</strong>
        <span>Half Marathon Runner</span>
      </footer>
    </blockquote>
  `
};

const getStoredContent = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return { ...defaultContent, ...(saved || {}) };
  } catch {
    return { ...defaultContent };
  }
};

const setStoredContent = (content) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
};

const renderHomepage = () => {
  const content = getStoredContent();

  const aboutContainer = document.getElementById('about-content');
  if (aboutContainer) {
    aboutContainer.innerHTML = content.about;
  }

  const trainingContainer = document.getElementById('training-content');
  if (trainingContainer) {
    trainingContainer.innerHTML = content.training;
  }

  const testimonialsContainer = document.getElementById('testimonials-content');
  if (testimonialsContainer) {
    testimonialsContainer.innerHTML = content.testimonials;
  }
};

const isAdminEmail = (email) => ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());

const getAdminRoute = () => {
  const path = window.location.pathname.replace(/\/+$/, '');
  const adminPath = '/admin';
  return path === adminPath || path.endsWith('/admin') || path.includes('/admin');
};

const renderAdminPage = () => {
  if (!getAdminRoute()) return;

  const currentContent = getStoredContent();

  document.body.innerHTML = `
    <div class="container admin-shell">
      <div class="admin-card">
        <h2>Hitfit Tribe Admin</h2>
        <div id="admin-login" class="admin-login">
          <label>
            Admin Email
            <input id="admin-email" type="email" placeholder="Enter your email" />
          </label>
          <button id="login-button" class="button button-primary" type="button">Access Dashboard</button>
          <div id="login-status" class="admin-status"></div>
        </div>

        <div id="admin-editor" class="admin-editor" style="display:none;">
          <label>
            About Hitendra Choudhary
            <textarea id="about-input">${currentContent.about.trim()}</textarea>
          </label>

          <label>
            Training plan details
            <textarea id="training-input">${currentContent.training.trim()}</textarea>
          </label>

          <label>
            Testimonials
            <textarea id="testimonials-input">${currentContent.testimonials.trim()}</textarea>
          </label>

          <div class="admin-actions">
            <button id="save-button" class="button button-primary" type="button">Save Changes</button>
            <button id="logout-button" class="button button-secondary" type="button">Log out</button>
          </div>
          <div id="save-status" class="admin-status"></div>
        </div>
      </div>
    </div>
  `;

  const loginButton = document.getElementById('login-button');
  const logoutButton = document.getElementById('logout-button');
  const saveButton = document.getElementById('save-button');
  const loginStatus = document.getElementById('login-status');
  const saveStatus = document.getElementById('save-status');
  const adminLogin = document.getElementById('admin-login');
  const adminEditor = document.getElementById('admin-editor');

  loginButton.addEventListener('click', () => {
    const email = document.getElementById('admin-email').value || '';
    if (!isAdminEmail(email)) {
      loginStatus.textContent = 'Access denied. This page is restricted to approved email addresses.';
      loginStatus.classList.add('admin-error');
      return;
    }

    localStorage.setItem('hitfit-tribe-admin-email', email.trim().toLowerCase());
    loginStatus.textContent = '';
    adminLogin.style.display = 'none';
    adminEditor.style.display = 'grid';
  });

  logoutButton.addEventListener('click', () => {
    localStorage.removeItem('hitfit-tribe-admin-email');
    adminLogin.style.display = 'grid';
    adminEditor.style.display = 'none';
    document.getElementById('admin-email').value = '';
    saveStatus.textContent = '';
  });

  saveButton.addEventListener('click', () => {
    const nextContent = {
      about: document.getElementById('about-input').value,
      training: document.getElementById('training-input').value,
      testimonials: document.getElementById('testimonials-input').value
    };

    setStoredContent(nextContent);
    saveStatus.textContent = 'Content updated successfully.';
    renderHomepage();
  });

  const authorizedEmail = (localStorage.getItem('hitfit-tribe-admin-email') || '').trim().toLowerCase();
  if (isAdminEmail(authorizedEmail)) {
    adminLogin.style.display = 'none';
    adminEditor.style.display = 'grid';
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
  if (getAdminRoute()) {
    renderAdminPage();
    return;
  }

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
