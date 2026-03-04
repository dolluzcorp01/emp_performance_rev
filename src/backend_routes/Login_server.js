
require("dotenv").config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const getDBConnection = require('../../config/db');
const db = getDBConnection('dadmin');

router.use(cookieParser());

// 🔹 Middleware to verify JWT
const JWT_SECRET = process.env.JWT_SECRET;
const verifyJWT = (req, res, next) => {
  const token = req.cookies.EPR_token;

  if (!token) {
    return res.status(403).json({ message: 'Access Denied. No Token Provided!' });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid Token' });
    }
    req.emp_id = decoded.emp_id;
    next();
  });
};

// 🔹 LOGOUT the JWT
router.post("/logout", (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("EPR_token", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    domain: isProd ? ".dforms.dolluzcorp.in" : undefined,
  });

  return res.json({ success: true, message: "Logged out successfully" });
});

// 🔹 Login API with JWT
router.post('/verifyLogin', (req, res) => {
  const { email, password } = req.body;
  const query = 'SELECT emp_id, account_pass, app_dForm FROM employee WHERE emp_mail_id = ?  AND deleted_by IS NULL ';

  db.query(query, [email], (err, results) => {
    if (err) {
      console.error('❌ Error during login:', err);
      return res.status(500).json({ message: 'Error during login' });
    }

    if (results.length > 0) {
      const storedHashedPassword = results[0].account_pass;

      if (results[0].app_dForm === 0)
        return res.status(401).json({ message: "Access denied. You don't have access for dForms." });

      // 🔹 Check if the password is empty (Google sign-in user)
      if (!storedHashedPassword || storedHashedPassword.trim() === "") {
        return res.json({
          success: false,
          message: "Access denied. Account password is missing."
        });
      }

      const isPasswordCorrect = bcrypt.compareSync(password, storedHashedPassword);
      if (isPasswordCorrect) {
        const token = jwt.sign({ emp_id: results[0].emp_id }, JWT_SECRET);
        const isProd = process.env.NODE_ENV === "production";

        res.cookie("EPR_token", token, {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "None" : "Lax",
          domain: isProd ? ".dforms.dolluzcorp.in" : undefined,
        });

        return res.json({ success: true, token });
      }

    }

    return res.json({ success: false, message: 'Invalid credentials' });
  });
});

// Generate a color based on user name
function generateColorFromText(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
}

// ✅ Get user profile details
router.get('/get-user-profile', verifyJWT, (req, res) => {
  if (!req.emp_id) {
    return res.status(401).json({ error: 'Unauthorized access' });
  }

  const query = `
        SELECT emp_id, emp_first_name, emp_last_name, emp_profile_img
        FROM dadmin.employee WHERE emp_id = ? AND deleted_by IS NULL AND app_dForm = '1';
    `;

  db.query(query, [req.emp_id], (err, results) => {
    if (err) {
      console.error('❌ Error fetching profile details:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.length > 0) {
      let user = results[0];

      // 🟢 Capitalize and limit to first two words
      let nameParts = user.emp_first_name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

      user.emp_first_name = nameParts.slice(0, 2).join(' '); // Only keep first two names

      // 🟡 First letter only for profile display
      user.profile_letters = user.emp_first_name.charAt(0).toUpperCase();

      // ✅ Generate profile color
      user.profile_color = generateColorFromText(user.emp_first_name);

      return res.json(user);
    } else {
      return res.status(404).json({ error: 'Profile not found' });
    }
  });
});

module.exports = { router, verifyJWT };