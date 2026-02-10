# Period Tracker Backend API

Node.js/Express backend for Period Tracker app with PostgreSQL database.

## Features

- Email/Password authentication with bcrypt
- Google Sign-In with OAuth2
- JWT token authentication
- PostgreSQL database (Neon)
- RESTful API for periods, symptoms, and settings
- Automatic database initialization

## Environment Variables

Create a `.env` file:

```env
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_jwt_secret_min_32_chars
GOOGLE_CLIENT_ID=your_google_client_id
PORT=3000
NODE_ENV=development
```

## Installation

```bash
npm install
```

## Running Locally

```bash
npm start
# or
npm run dev  # with nodemon
```

Server runs on http://localhost:3000

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - Google Sign-In
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password
- `DELETE /api/auth/account` - Delete account

### Data
- `GET /api/auth/sync` - Get all user data
- `GET /api/auth/periods` - Get all periods
- `POST /api/auth/periods` - Add period
- `GET /api/auth/symptoms` - Get all symptoms
- `POST /api/auth/symptoms` - Add/update symptom
- `GET /api/auth/settings` - Get settings
- `PUT /api/auth/settings` - Update settings

### Health Check
- `GET /health` - Check server status
- `GET /` - API info

## Deployment

See `../DEPLOY_TO_RENDER.md` for deployment instructions.

## Database Schema

Automatically creates tables on first run:
- `users` - User accounts
- `periods` - Period tracking data
- `symptoms` - Daily symptoms
- `user_settings` - App preferences
