# Instagram Auth HTTPS Server

A secure HTTPS server running on port 6001 to handle Instagram OAuth callbacks and store user authentication details.

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Generate SSL certificates:**

   ```bash
   npm run generate-certs
   ```

   This will create `server.key` and `server.cert` files for HTTPS.

3. **Set environment variables:**
   Create a `.env` file or set environment variables:

   ```bash
   export INSTAGRAM_APP_ID=your_instagram_app_id
   export INSTAGRAM_APP_SECRET=your_instagram_app_secret
   ```

4. **Run the server:**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

## Endpoints

- `GET /auth/callback/instagram-standalone` - Instagram OAuth callback handler
- `GET /health` - Health check endpoint
- `GET /users` - List all authenticated users
- `GET /users/:userId` - Get specific user details

## Instagram App Configuration

Make sure your Instagram app is configured with:

- **Redirect URI**: `https://localhost:6001/auth/callback/instagram-standalone`
- **Required permissions**:
  - `instagram_business_basic`
  - `instagram_business_content_publish`
  - `instagram_business_manage_comments`
  - `instagram_business_manage_insights`

## Usage Flow

1. Start this HTTPS server
2. Use the Instagram auth tool to generate an OAuth URL
3. User visits the OAuth URL and authorizes your app
4. Instagram redirects to this server's callback endpoint
5. Server exchanges the code for access tokens and fetches user details
6. User details are stored in memory (use a database in production)

## Security Notes

- Uses self-signed certificates for local development
- Stores user data in memory (implement proper database storage for production)
- Access tokens are stored securely and not exposed in API responses
- For production, use certificates from a trusted CA like Let's Encrypt
