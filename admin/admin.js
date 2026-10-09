const MAX_PLANS = 12;
const MAX_TESTIMONIALS = 3;
const MAX_GALLERY_PHOTOS = 4;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const TOKEN_KEY = 'hitfit-tribe-admin-token';

// When the admin page is served by the local Node server, the API is on the same origin.
// On GitHub Pages it lives on the separately hosted server set in config.js.
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE = IS_LOCAL ? '' : (window.HITFIT_CONFIG?.apiBase || '').replace(/\/+$/, '');
const SITE_ROOT = new URL('../', window.location.href);

const loginForm = document.getElementById('admin-login');
const loginStatus = document.getElementById('login-status');
const editorForm = document.getElementById('admin-editor');
const saveStatus = document.getElementById('save-status');
const photoPreview = document.getElementById('photo-preview');
const photoInput = document.getElementById('photo-input');
const galleryList = document.getElementById('gallery-list');
const galleryInput = document.getElementById('gallery-input');
const galleryAddButton = document.getElementById('gallery-add');
const plansList = document.getElementById('plans-list');
const testimonialsList = document.getElementById('testimonials-list');
const addPlanButton = document.getElementById('add-plan');
const addTestimonialButton = document.getElementById('add-testimonial');
const adminsForm = document.getElementById('admins-form');
const adminsList = document.getElementById('admins-list');
const adminsStatus = document.getElementById('admins-status');
const newAdminInput = document.getElementById('new-admin-email');

let profilePhoto = '';
// Newly uploaded photos aren't on GitHub Pages until the next deploy, so preview them from the file.
let photoPreviewSrc = '';
// Each gallery photo: { path, previewSrc } — previewSrc is set only for photos uploaded this session.
let galleryPhotos = [];

const getToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

const setToken = (token) => {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (e.g. private mode); the admin will just need to log in again on reload.
  }
};

const setStatus = (element, message, isError = false) => {
  element.textContent = message;
  element.classList.toggle('admin-error', isError);
};

const api = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
        ...options.headers
      }
    });
  } catch {
    // The free server sleeps when idle; the first request after a while can take ~30 seconds or fail.
    throw new Error('Could not reach the admin server. It may be waking up, so please try again in 30 seconds.');
  }
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== '/api/login') showLogin('Your session has expired. Please log in again.');
  if (!response.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
};

// ---------- repeatable items (plans, testimonials) ----------

const refreshList = (list, labelPrefix, addButton, max) => {
  [...list.children].forEach((item, index) => {
    item.querySelector('[data-role="label"]').textContent = `${labelPrefix} ${index + 1}`;
  });
  addButton.disabled = list.children.length >= max;
};

const addItem = (list, templateId, values, onChange) => {
  const item = document.getElementById(templateId).content.firstElementChild.cloneNode(true);
  item.querySelectorAll('[data-field]').forEach((field) => {
    field.value = values[field.dataset.field] || '';
  });
  item.querySelector('[data-action="remove"]').addEventListener('click', () => {
    item.remove();
    onChange();
  });
  list.append(item);
  onChange();
};

const readItems = (list) =>
  [...list.children].map((item) =>
    Object.fromEntries([...item.querySelectorAll('[data-field]')].map((field) => [field.dataset.field, field.value.trim()]))
  );

const refreshPlans = () => refreshList(plansList, 'Plan', addPlanButton, MAX_PLANS);
const refreshTestimonials = () => refreshList(testimonialsList, 'Testimonial', addTestimonialButton, MAX_TESTIMONIALS);
const addPlan = (plan = {}) => addItem(plansList, 'plan-template', plan, refreshPlans);
const addTestimonial = (item = {}) => addItem(testimonialsList, 'testimonial-template', item, refreshTestimonials);

// ---------- photo ----------

const renderPhotoPreview = () => {
  if (!profilePhoto) {
    photoPreview.replaceChildren('HC');
    return;
  }
  const image = document.createElement('img');
  image.src = photoPreviewSrc || new URL(profilePhoto, SITE_ROOT).href;
  image.alt = 'Profile photo preview';
  photoPreview.replaceChildren(image);
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });

// Uploads the file chosen in `input` and returns { path, dataUrl }, or null if nothing was uploaded.
const uploadPhoto = async (input, kind) => {
  const file = input.files[0];
  input.value = '';
  if (!file) return null;
  if (file.size > MAX_PHOTO_BYTES) {
    setStatus(saveStatus, 'Photo must be 5 MB or smaller.', true);
    return null;
  }

  try {
    setStatus(saveStatus, 'Uploading photo…');
    const dataUrl = await readFileAsDataUrl(file);
    const { path } = await api('/api/photo', { method: 'POST', body: JSON.stringify({ dataUrl, kind }) });
    setStatus(saveStatus, 'Photo uploaded. Click “Save changes” to publish it.');
    return { path, dataUrl };
  } catch (error) {
    setStatus(saveStatus, error.message, true);
    return null;
  }
};

photoInput.addEventListener('change', async () => {
  const uploaded = await uploadPhoto(photoInput, 'profile');
  if (!uploaded) return;
  profilePhoto = uploaded.path;
  photoPreviewSrc = uploaded.dataUrl;
  renderPhotoPreview();
});

document.getElementById('photo-remove').addEventListener('click', () => {
  profilePhoto = '';
  photoPreviewSrc = '';
  renderPhotoPreview();
  setStatus(saveStatus, 'Photo removed. Click “Save changes” to publish.');
});

// ---------- gallery ----------

const renderGallery = () => {
  galleryList.replaceChildren(
    ...galleryPhotos.map((photo, index) => {
      const item = document.createElement('li');
      const image = document.createElement('img');
      image.src = photo.previewSrc || new URL(photo.path, SITE_ROOT).href;
      image.alt = `Gallery photo ${index + 1}`;

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'button button-secondary button-small';
      removeButton.textContent = 'Remove';
      removeButton.addEventListener('click', () => {
        galleryPhotos.splice(index, 1);
        renderGallery();
        setStatus(saveStatus, 'Photo removed. Click “Save changes” to publish.');
      });

      item.append(image, removeButton);
      return item;
    })
  );
  const isFull = galleryPhotos.length >= MAX_GALLERY_PHOTOS;
  galleryAddButton.classList.toggle('is-disabled', isFull);
  galleryInput.disabled = isFull;
};

galleryInput.addEventListener('change', async () => {
  const uploaded = await uploadPhoto(galleryInput, 'gallery');
  if (!uploaded || galleryPhotos.length >= MAX_GALLERY_PHOTOS) return;
  galleryPhotos.push({ path: uploaded.path, previewSrc: uploaded.dataUrl });
  renderGallery();
});

// ---------- load / save ----------

const fillEditor = (content) => {
  profilePhoto = content.profilePhoto || '';
  photoPreviewSrc = '';
  renderPhotoPreview();
  galleryPhotos = (content.gallery || []).map((path) => ({ path, previewSrc: '' }));
  renderGallery();
  document.getElementById('about-heading').value = content.about?.heading || '';
  document.getElementById('about-body').value = content.about?.body || '';
  plansList.replaceChildren();
  testimonialsList.replaceChildren();
  (content.plans || []).forEach((plan) => addPlan(plan));
  (content.testimonials || []).forEach((item) => addTestimonial(item));
  refreshPlans();
  refreshTestimonials();
};

// ---------- admin users (owners only) ----------

const renderAdmins = (admins) => {
  adminsList.replaceChildren(
    ...admins.map(({ email, owner }) => {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = email;
      item.append(label);

      if (owner) {
        const tag = document.createElement('span');
        tag.className = 'admin-owner-tag';
        tag.textContent = 'Owner';
        item.append(tag);
      } else {
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'button button-secondary button-small';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', () => updateAdmins('DELETE', email));
        item.append(removeButton);
      }
      return item;
    })
  );
};

const updateAdmins = async (method, email) => {
  try {
    renderAdmins(await api('/api/admins', { method, body: JSON.stringify({ email }) }));
    setStatus(adminsStatus, method === 'POST' ? `${email} can now log in.` : `${email} was removed.`);
    return true;
  } catch (error) {
    setStatus(adminsStatus, error.message, true);
    return false;
  }
};

adminsForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = newAdminInput.value.trim().toLowerCase();
  if (await updateAdmins('POST', email)) newAdminInput.value = '';
});

const loadAdmins = async () => {
  try {
    renderAdmins(await api('/api/admins'));
    setStatus(adminsStatus, '');
  } catch (error) {
    setStatus(adminsStatus, error.message, true);
  }
};

// ---------- screens ----------

const showEditor = async () => {
  setStatus(saveStatus, 'Loading…');
  try {
    // Confirms the saved session is still valid before showing the editor.
    const me = await api('/api/me');
    loginForm.hidden = true;
    editorForm.hidden = false;
    adminsForm.hidden = !me.owner;
    if (me.owner) loadAdmins();
    fillEditor(await api('/api/content'));
    setStatus(saveStatus, '');
  } catch (error) {
    setStatus(saveStatus, error.message, true);
  }
};

function showLogin(message = '') {
  setToken('');
  editorForm.hidden = true;
  adminsForm.hidden = true;
  loginForm.hidden = false;
  setStatus(loginStatus, message, Boolean(message));
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(loginStatus, 'Logging in…');
  try {
    const { token } = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email: document.getElementById('admin-email').value })
    });
    setToken(token);
    setStatus(loginStatus, '');
    showEditor();
  } catch (error) {
    setStatus(loginStatus, error.message, true);
  }
});

editorForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(saveStatus, 'Saving…');
  try {
    await api('/api/content', {
      method: 'PUT',
      body: JSON.stringify({
        profilePhoto,
        gallery: galleryPhotos.map((photo) => photo.path),
        about: {
          heading: document.getElementById('about-heading').value,
          body: document.getElementById('about-body').value
        },
        plans: readItems(plansList),
        testimonials: readItems(testimonialsList)
      })
    });
    setStatus(saveStatus, IS_LOCAL
      ? 'Saved. The website now shows your changes.'
      : 'Saved. The website will show your changes in about a minute.');
  } catch (error) {
    setStatus(saveStatus, error.message, true);
  }
});

document.getElementById('logout-button').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  showLogin();
});

addPlanButton.addEventListener('click', () => addPlan());
addTestimonialButton.addEventListener('click', () => addTestimonial());

if (getToken()) showEditor();
