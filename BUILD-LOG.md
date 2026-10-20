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

## Next

- Organize the API into routes and add a health-check endpoint.
