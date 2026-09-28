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
- `admin/` – the admin page (`/admin/`); `admin/config.js` holds the admin server's URL
- `server.js` – admin API server (no dependencies), hosted on Render
- `render.yaml` – Render setup for `server.js`
- `data/default-content.json` – starting content, used until the admin saves for the first time
- `data/content.json` – content saved from the admin page (committed by the server)
- `data/admins.json` – admin emails added by owners (committed by the server)
- `uploads/` – uploaded profile photos (committed by the server)

## How it works
```
Admin page (GitHub Pages) ──► server.js (Render) ──► commits to this repo ──► GitHub Pages redeploys (~1 min)
Website    (GitHub Pages) ──► reads data/content.json and uploads/ from the same site
```

- Website: https://spoortifitanalyze.github.io/Hitfit-Tribe/
- Admin page: https://spoortifitanalyze.github.io/Hitfit-Tribe/admin/

## Run locally
Requires Node.js 18 or newer.

```bash
npm start
```

- Website: http://localhost:8000
- Admin page: http://localhost:8000/admin/

Without `GITHUB_TOKEN`, changes are saved to `local-data/` (not committed) instead of GitHub.

## Admin page
Log in by entering an approved admin email. There is no password. From there you can edit:

- **Profile photo** – uploaded image shown in the hero section
- **About** – heading and details (blank line between paragraphs)
- **Training plans** – each plan has a Title, Description, Intended audience, and Prerequisites
- **Testimonials** – up to 3, each with a Name and Comment

Click **Save changes**. The server commits the change to `main`, and the website shows it after GitHub Pages redeploys (about a minute).

Because the server commits to `main`, run `git pull` before making code changes locally.

### Admin users
- **Owners** (`bheed.spoorti@gmail.com`, `hitendra2309@gmail.com` by default) can always log in, and they are the only ones who see the **Admin users** section.
- Owners can add or remove other admin emails there. Added admins can edit the site content but can't manage admin users.
- Removing an admin takes effect immediately, including anyone already logged in with that email.

> **Security note:** login checks only that the email is on the list; it doesn't verify that the person owns the address. Anyone who knows an admin email can log in, so keep the `/admin` link private.

## Configuration
| Variable | Default | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | _(none – local mode)_ | Token the server uses to commit content to GitHub |
| `GITHUB_REPO` | `spoortifitanalyze/Hitfit-Tribe` | Repo to commit to |
| `GITHUB_BRANCH` | `main` | Branch GitHub Pages deploys from |
| `ALLOWED_ORIGINS` | `https://spoortifitanalyze.github.io` | Sites allowed to call the admin API |
| `OWNER_EMAILS` | `bheed.spoorti@gmail.com,hitendra2309@gmail.com` | Comma-separated owner emails (can log in and manage admin users) |
| `PORT` | `8000` | Port the server listens on |

## Deploying the admin server (one-time setup)
1. **Create a GitHub token.** GitHub → Settings → Developer settings → Fine-grained personal access tokens → *Generate new token*.
   - Repository access: *Only select repositories* → `Hitfit-Tribe`
   - Permissions: *Contents* → **Read and write**
   - Copy the token.
2. **Deploy on Render.** Sign in at https://render.com with GitHub → *New* → *Blueprint* → pick this repo. Render reads `render.yaml`. When asked for `GITHUB_TOKEN`, paste the token.
3. **Check the URL.** Render shows the service URL (for example `https://hitfit-tribe-admin.onrender.com`). If it's different, update `apiBase` in `admin/config.js` and push.
4. Open https://spoortifitanalyze.github.io/Hitfit-Tribe/admin/ and log in.

The free Render plan sleeps after 15 minutes without use, so the first login after a break can take about 30 seconds.
