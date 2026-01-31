// netlify/functions/send-contact.js
// Sends contact form emails using Microsoft Graph (client credentials) + Zoho CRM.
// All awaits are inside exports.handler to avoid top-level await / ESM issues.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { name, jobFunction, company, phone, email, title, message } = JSON.parse(event.body || '{}');

    // ---- Validation ----
    if (!name || !company || !phone || !email || !title || !message) {
      return { statusCode: 400, body: JSON.stringify({ error: 'All required fields must be filled.' }) };
    }
    if (typeof message === 'string' && message.length > 5000) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Message too long.' }) };
    }

    // ---- Acquire Graph token ----
    const token = await getGraphToken({
      tenantId: process.env.AZ_TENANT_ID,
      clientId: process.env.AZ_CLIENT_ID,
      clientSecret: process.env.AZ_CLIENT_SECRET,
    });

    // ---- Email body ----
    const html = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      ${jobFunction ? `<p><strong>Job Function:</strong> ${escapeHtml(jobFunction)}</p>` : ''}
      <p><strong>Company:</strong> ${escapeHtml(company)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Title:</strong> ${escapeHtml(title)}</p>
      <p><strong>Message:</strong><br/>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
    `;

    const text = `New Contact Form Submission

Name: ${name}
${jobFunction ? `Job Function: ${jobFunction}\n` : ''}
Company: ${company}
Phone: ${phone}
Email: ${email}
Title: ${title}

Message:
${message}
`;

    // ---- Send email via Graph ----
    const sendRes = await sendMailViaGraph({
      accessToken: token,
      senderUpn: process.env.SENDER_UPN,
      to: process.env.TO_EMAIL || process.env.SENDER_UPN,
      subject: `New Contact: ${title}`,
      html,
      text,
      replyTo: email,
      bcc: process.env.ZOHO_BCC_ADDRESS, // optional Zoho BCC dropbox (you can remove)
    });

    // capture Graph response body for logging/tracing
    let graphResText = '';
    try { graphResText = await sendRes.text(); } catch (e) { graphResText = ''; }

    if (!sendRes.ok) {
      console.error('Graph sendMail failed', sendRes.status, graphResText);
      // include Graph response in error
      return { statusCode: 502, body: JSON.stringify({ error: 'Unable to send email via Graph', details: graphResText }) };
    }

    console.log('Graph sendMail accepted', 'status:', sendRes.status, 'body:', graphResText, 'headers:', JSON.stringify(Object.fromEntries(sendRes.headers.entries ? sendRes.headers.entries() : [])));

    // ---- Zoho CRM (non-blocking) ----
    try {
      const accessToken = await getZohoAccessToken();
      const zohoLead = buildZohoLead({ name, jobFunction, company, phone, email, title, message });

      // upsert and capture response
      const upsertRes = await upsertZohoLead(accessToken, zohoLead);
      console.log('Zoho upsert response:', JSON.stringify(upsertRes));

      // Safe path: try to extract the lead id from CRM v2 response
      let leadId = null;
      if (upsertRes && Array.isArray(upsertRes.data) && upsertRes.data[0] && upsertRes.data[0].details) {
        leadId = upsertRes.data[0].details.id || upsertRes.data[0].details.ID || null;
      }
      console.log('Zoho lead id:', leadId);

      // If we have an id, call send_mail action for that Lead
      if (leadId) {
        try {
          const sendMailRes = await sendMailViaZohoCRM(accessToken, leadId, {
            toEmail: email,
            subject: `New Contact: ${title}`,
            html,
            plainText: text
          });
          console.log('Zoho CRM send_mail: success', JSON.stringify(sendMailRes));
        } catch (smErr) {
          console.error('Zoho CRM send_mail error:', smErr?.message || smErr);
        }
      } else {
        console.warn('Zoho lead id missing; skipping send_mail');
      }
    } catch (ze) {
      console.error('Zoho CRM error:', ze?.message || ze);
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('Handler exception:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Unable to send message at this time.' }) };
  }
};

// ---- Helpers ----

async function getGraphToken({ tenantId, clientId, clientSecret }) {
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Azure AD credentials in environment variables.');
  }
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('Failed to acquire Graph token', res.status, txt);
    throw new Error('Failed to acquire Graph token');
  }

  const json = await res.json();
  if (!json.access_token) throw new Error('Graph token response missing access_token');
  return json.access_token;
}

async function sendMailViaGraph({ accessToken, senderUpn, to, subject, html, text, replyTo, bcc }) {
  const toRecipients = String(to || '').split(',').map(s => s.trim()).filter(Boolean).map(addr => ({
    emailAddress: { address: addr }
  }));
  const bccRecipients = bcc ? String(bcc).split(',').map(s => s.trim()).filter(Boolean).map(addr => ({
    emailAddress: { address: addr }
  })) : undefined;

  const payload = {
    message: {
      subject,
      body: { contentType: 'HTML', content: html || text },
      toRecipients,
      bccRecipients,
      replyTo: replyTo ? [{ emailAddress: { address: replyTo } }] : undefined,
    },
    saveToSentItems: 'true'
  };

  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderUpn)}/sendMail`;
  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function buildZohoLead({ name, jobFunction, company, phone, email, title, message }) {
  const lastName = (name && name.trim()) || 'Website Lead';
  return {
    Company: company || 'N/A',
    Last_Name: lastName,
    Email: email,
    Phone: phone,
    Lead_Source: 'Website',
    Description: `Name: ${name}\n${jobFunction ? `Job Function: ${jobFunction}\n` : ''}Title: ${title}\n\nMessage:\n${message}`
  };
}

async function getZohoAccessToken() {
  if (!process.env.ZOHO_ACCOUNTS_URL || !process.env.ZOHO_REFRESH_TOKEN || !process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    throw new Error('Missing Zoho OAuth environment variables.');
  }

  const res = await fetch(`${process.env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
    })
  });
  if (!res.ok) {
    const txt = await res.text().catch(()=>'');
    console.error('Zoho token fetch failed', res.status, txt);
    throw new Error(`Zoho token ${res.status}: ${txt}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error('Zoho token missing access_token');
  return json.access_token;
}

async function upsertZohoLead(accessToken, payload) {
  if (!process.env.ZOHO_API_BASE) throw new Error('Missing ZOHO_API_BASE env var');
  const url = `${process.env.ZOHO_API_BASE}/crm/v2/Leads/upsert`;
  const body = { duplicate_check_fields: ['Email'], data: [payload] };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(()=>'');
  if (!res.ok) {
    console.error('Zoho upsert failed', res.status, text);
    throw new Error(`Zoho upsert ${res.status}: ${text}`);
  }
  try { return JSON.parse(text || '{}'); } catch(e) { return text; }
}

async function sendMailViaZohoCRM(accessToken, leadRecordId, { toEmail, subject, plainText, html }) {
  if (!process.env.ZOHO_API_BASE) throw new Error('Missing ZOHO_API_BASE env var');
  if (!process.env.ZOHO_FROM_EMAIL) throw new Error('Missing ZOHO_FROM_EMAIL env var (sender email for Zoho send_mail)');
  const url = `${process.env.ZOHO_API_BASE}/crm/v6/Leads/${encodeURIComponent(leadRecordId)}/actions/send_mail`;

  const body = {
    data: [
      {
        from: {
          email: process.env.ZOHO_FROM_EMAIL,
          ...(process.env.ZOHO_FROM_NAME ? { name: process.env.ZOHO_FROM_NAME } : {})
        },
        to: [ { email: toEmail } ],
        subject,
        content: html || plainText || '',
        mime_type: html ? "text/html" : "text/plain",
      }
    ]
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(()=>'');
  if (!res.ok) {
    console.error('Zoho send_mail failed', res.status, text);
    throw new Error(`Zoho send_mail ${res.status}: ${text}`);
  }
  try { return JSON.parse(text || '{}'); } catch(e) { return text; }
}
