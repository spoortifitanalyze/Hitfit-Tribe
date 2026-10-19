# Gmail Setup for the Hitfit Tribe Contact Form

## Why not plain Gmail SMTP?

Render's free plan blocks outbound SMTP ports (25, 465 and 587), so the server cannot reach
`smtp.gmail.com`. Every enquiry fails with "Server error". Changing the port does not help.

Instead, the server sends each enquiry over HTTPS to a small Google Apps Script
([gmail-relay.gs](gmail-relay.gs)), and that script sends the email from the Gmail account.

## One-time setup (about 5 minutes)

1. Sign in to Google as **hitendra2309@gmail.com** (enquiries are sent from this account).
2. Open https://script.google.com and click **New project**.
3. Delete the sample code, paste in the contents of `gmail-relay.gs`, and save.
4. Choose a long random secret, for example a 32-character password from a password manager.
5. Click **Project Settings** (gear icon) > **Script properties** > **Add script property**:
   - Property: `RELAY_SECRET`
   - Value: your secret
6. Click **Deploy** > **New deployment** > the gear icon > **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy**, approve the Gmail permission prompt, and copy the **Web app URL**
   (it ends in `/exec`).
8. In Render, open the `hitfit-tribe-admin` service > **Environment** and set:

   ```text
   GMAIL_RELAY_URL=<the Web app URL>
   GMAIL_RELAY_SECRET=<the same secret as step 5>
   ```

9. Save. Render redeploys the service automatically.

After that, contact form enquiries arrive at `CONTACT_TO_EMAIL` (hitendra2309@gmail.com), and
Reply goes straight to the person who filled in the form.

## Notes

- If you edit `gmail-relay.gs` later, use **Deploy** > **Manage deployments** > edit > **New version**.
  That keeps the same URL.
- A free Gmail account can send about 100 emails a day this way, which is plenty for a contact form.
- If `GMAIL_RELAY_URL` is not set, the server falls back to SMTP (`SMTP_USER` / `SMTP_PASS` with a
  Gmail App Password). That works locally or on a paid Render plan, but not on the free plan.
