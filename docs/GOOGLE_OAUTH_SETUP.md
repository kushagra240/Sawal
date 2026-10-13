# Google OAuth setup

Sawal uses Google OAuth 2.0 authorization-code flow with PKCE. Do not paste a Google password into Sawal or into chat.

## Google Cloud configuration

1. Create or select a Google Cloud project.
2. Enable the Gmail API, Google Calendar API, and People API.
3. Configure the OAuth consent screen. During testing, add the Gmail account you intend to connect as an authorized test user.
4. Create an OAuth client of type **Web application**.
5. Add this authorized redirect URI exactly:

   `http://localhost:8000/v1/oauth/google/callback`

6. Copy `.env.example` to `.env` and set:

```env
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/v1/oauth/google/callback
FRONTEND_URL=http://localhost:3000
SAWAL_TOKEN_ENCRYPTION_KEY=a-long-random-secret-kept-stable
```

The requested scopes are limited to identity, Gmail read/compose, Contacts read, Calendar read, and Calendar event mutation. OAuth tokens are encrypted in `.data/sawal.db`; neither keys nor tokens are exposed to Next.js.

## Connect and verify

1. Restart the FastAPI backend after editing `.env`.
2. Open http://localhost:3000.
3. Select **Connect Google**, approve the requested permissions, and return to Sawal.
4. The connected account email appears in the accounts panel and Live mode becomes available.
5. Start with a draft request. For sending, Sawal displays the exact recipient, subject, and body and waits for **Confirm exact action**.

Do not use an instruction such as “email all my contacts.” Select explicit recipients and review the preview to avoid accidental bulk mail.

## Disconnect

Use **Disconnect** in the accounts panel. Sawal calls Google's revocation endpoint and deletes the encrypted local credentials.
