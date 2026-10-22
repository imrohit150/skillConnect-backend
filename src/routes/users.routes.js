const express = require("express");
const { searchUsers } = require("../controllers/users.controller");
const authenticate = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/users", authenticate, searchUsers);

module.exports = router;