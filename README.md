# Hitfit Tribe

Website for running coach Hitendra Choudhary, with an admin page for editing the site content.

## Included sections
- About
- Coaching Programs
- Testimonials
- Contact us
- Primary CTA buttons for Start Training and Fill in the form

## Files
- `index.html`, `styles.css`, `script.js` – the public website
- `admin/` – the admin page (`/admin`)
- `server.js` – Node server that hosts the site and the admin API (no dependencies)
- `data/default-content.json` – starting content, used until the admin saves for the first time
- `data/content.json` – content saved from the admin page (created automatically, not committed)
- `data/admins.json` – admin emails added by owners (created automatically, not committed)
- `uploads/` – uploaded profile photos (not committed)

## Run locally
Requires Node.js 18 or newer.

```bash
npm start
```

- Website: http://localhost:8000
- Admin page: http://localhost:8000/admin

## Admin page
Log in by entering an approved admin email. There is no password. From there you can edit:

- **Profile photo** – uploaded image shown in the hero section
- **About** – heading and details (blank line between paragraphs)
- **Training plans** – each plan has a Title, Description, Intended audience, and Prerequisites
- **Testimonials** – up to 3, each with a Name and Comment

Click **Save changes** and the website shows the new content on the next page load.

### Admin users
- **Owners** (`bheed.spoorti@gmail.com`, `hitendra2309@gmail.com` by default) can always log in, and they are the only ones who see the **Admin users** section.
- Owners can add or remove other admin emails there. Added admins can edit the site content but can't manage admin users.
- Removing an admin takes effect immediately, including anyone already logged in with that email.

> **Security note:** login checks only that the email is on the list; it doesn't verify that the person owns the address. Anyone who knows an admin email can log in, so keep the `/admin` link private.

## Configuration
| Variable | Default | Purpose |
| --- | --- | --- |
| `OWNER_EMAILS` | `bheed.spoorti@gmail.com,hitendra2309@gmail.com` | Comma-separated owner emails (can log in and manage admin users) |
| `PORT` | `8000` | Port the server listens on |

## Hosting
Because the admin page saves content on the server, the site needs a host that runs Node.js and keeps files between restarts (for example a VPS, or Render/Railway with a persistent disk mounted for `data/` and `uploads/`). Static-only hosts such as GitHub Pages can't run the admin backend.
