# SkillConnect Backend Build Log

This file keeps a simple list of the steps we finish while building the backend.

## Completed

1. Created the `skillConnect-backend` project folder.
2. Ran `npm init` to create `package.json`.
3. Installed Express, Mongoose, dotenv, CORS, Helmet, and Morgan.
4. Installed Nodemon to restart the server when code changes.
5. Set the project to use CommonJS, so we write `require()` and `module.exports`.
6. Created the `src` folder for backend source code.
7. Added `.env` and `node_modules/` to `.gitignore` so private settings and installed packages are not pushed.
8. Created a Git repository for the backend only.
9. Connected it to the GitHub repository `imrohit150/skillConnect-backend`.
10. Pushed the initial setup to the `main` branch. The `.env` file was not pushed.
11. Created the first Express server in `src/server.js`.
12. Added Helmet security headers, Morgan request logging, and JSON body parsing.
13. Added a root `GET /` endpoint and verified it in Postman at `http://localhost:5000/`.
14. Created a separate health router and verified `GET /api/v1/health` in Postman.
15. Added the MongoDB Atlas connection string to the local `.env` file, which Git ignores.
16. Created `src/config/database.js` to connect to MongoDB using Mongoose.
17. Updated server startup to wait for the database connection before accepting requests.
18. Created the first Mongoose model in `src/models/user.model.js` with required fields, email normalization, and timestamps.
19. Added signup input validation, including an 18+ date-of-birth check.
20. Built and tested `POST /api/v1/auth/signup` with Postman; it hashes the password and saves the new user in MongoDB.
21. Added `jsonwebtoken` and `cookie-parser` for token-based authentication.
22. Added separate access-token and refresh-token secrets and expiry settings to the local `.env` file; the file remains ignored by Git.
23. Created a refresh-session model and session service that issues access and refresh JWTs and stores only a hash of each refresh token.
24. Added login validation and `POST /api/v1/auth/login`, which checks the password hash, creates a session, and sets HttpOnly token cookies.
25. Configured Express to parse cookies.
26. Tested login in Postman and confirmed the access-token and refresh-token cookies are set.
27. Reused the session service for signup so new accounts are logged in immediately with authentication cookies.
28. Tested signup with automatic session creation in Postman.
29. Added `POST /api/v1/auth/refresh` with refresh-token verification, session rotation, and replacement cookies.
30. Tested the refresh endpoint in Postman.

## Next

- Add logout to revoke the refresh session and clear authentication cookies, then protect routes with access-token authentication.
