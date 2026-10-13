# Gmail App Password Setup for Hitfit Tribe

Use this when the app says:

> Email delivery is not configured yet. Set SMTP_USER and SMTP_PASS in the hosting environment before deploying.

## What to use for SMTP_PASS

Do not use your normal Gmail password.

Use a Gmail App Password instead.

## Steps

1. Open your Google Account security page:
   https://myaccount.google.com/security
2. Turn on 2-Step Verification if it is not already enabled.
3. Go to:
   https://myaccount.google.com/apppasswords
4. Choose:
   - App: Mail
   - Device: Windows Computer
5. Click Generate.
6. Copy the 16-character password that Google shows.
7. Paste that value into the Render environment variable named `SMTP_PASS`.

Example:

```text
SMTP_USER=hitendra2309@gmail.com
SMTP_PASS=abcd efgh ijkl mnop
```

Note: the password may appear with spaces in the UI. Copy the exact generated code and paste it as-is, without changing the characters.

## Render environment variables

Set these values in the Render service for the admin backend:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=hitendra2309@gmail.com
SMTP_PASS=<your generated Gmail app password>
EMAIL_FROM=hitendra2309@gmail.com
CONTACT_TO_EMAIL=hitendra2309@gmail.com
```

## Important

- This is not the same as your normal Gmail login password.
- This is a Google-generated app password for the app to send mail.
- The password is only used by the server to sign in to Gmail SMTP.
