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
- `uploads/` – uploaded profile photos (not committed)

## Run locally
Requires Node.js 18 or newer. Set an admin password, then start the server:

```bash
# macOS / Linux
ADMIN_PASSWORD="choose-a-strong-password" npm start

# Windows PowerShell
$env:ADMIN_PASSWORD="choose-a-strong-password"; npm start
```

- Website: http://localhost:8000
- Admin page: http://localhost:8000/admin

## Admin page
Log in with an approved email and the `ADMIN_PASSWORD`. From there you can edit:

- **Profile photo** – uploaded image shown in the hero section
- **About** – heading and details (blank line between paragraphs)
- **Training plans** – each plan has a Title, Description, Intended audience, and Prerequisites
- **Testimonials** – up to 3, each with a Name and Comment

Click **Save changes** and the website shows the new content on the next page load.

## Configuration
| Variable | Default | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | _(none – login disabled)_ | Password for the admin page |
| `ADMIN_EMAILS` | `bheed.spoorti@gmail.com,hitendra2309@gmail.com` | Comma-separated list of emails allowed to log in |
| `PORT` | `8000` | Port the server listens on |

## Hosting
Because the admin page saves content on the server, the site needs a host that runs Node.js and keeps files between restarts (for example a VPS, or Render/Railway with a persistent disk mounted for `data/` and `uploads/`). Static-only hosts such as GitHub Pages can't run the admin backend.
