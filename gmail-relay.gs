// Gmail relay for the Hitfit Tribe contact form.
// Render's free plan blocks outbound SMTP, so server.js posts enquiries here over HTTPS
// and this script sends them from the Gmail account it is deployed under.
// Setup steps: see GMAIL_APP_PASSWORD_SETUP.md.

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('RELAY_SECRET');
    if (!secret || data.secret !== secret) return reply({ ok: false, error: 'Unauthorized' });

    MailApp.sendEmail({
      to: data.to,
      replyTo: data.replyTo,
      subject: data.subject,
      body: data.text,
      htmlBody: data.html,
      name: 'Hitfit Tribe Website'
    });
    return reply({ ok: true });
  } catch (error) {
    return reply({ ok: false, error: String(error) });
  }
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
