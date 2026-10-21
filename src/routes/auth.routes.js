const express = require("express");
const { signup, login, refresh } = require("../controllers/auth.controller");

const router = express.Router();

router.post('/auth/signup', signup);
router.post('/auth/login', login);
router.post('/auth/refresh', refresh);

module.exports = router;