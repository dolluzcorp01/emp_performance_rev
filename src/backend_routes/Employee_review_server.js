require("dotenv").config();
const express = require("express");
const router = express.Router();
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const getDBConnection = require("../../config/db");

const db = getDBConnection("emp_performance_rev");

router.use(cookieParser());

// ─────────────────────────────────────────
// JWT Middleware — reuse same EPR_token cookie
// ─────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;

const verifyJWT = (req, res, next) => {
    const token = req.cookies.EPR_token;
    if (!token) return res.status(401).json({ message: "Access Denied. No Token Provided!" });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid Token" });
        req.emp_id = decoded.emp_id;
        next();
    });
};

const verifyClientJWT = (req, res, next) => {
    const token = req.cookies.EPR_client_token; // ← separate cookie
    if (!token) return res.status(401).json({ message: "Access Denied. No Token Provided!" });
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid Token" });
        req.client_id = decoded.client_id;
        next();
    });
};

// ─────────────────────────────────────────
// POST /verify_auth — Login with email+password, sets EPR_client_token
// ─────────────────────────────────────────
router.post("/verify_auth", (req, res) => {
    const { email, password } = req.body;

    const query = `
        SELECT client_id, client_pass 
        FROM client 
        WHERE poc_email = ? 
        AND client_status = "Active"
    `;

    db.query(query, [email], (err, results) => {
        if (err) {
            console.error("❌ Error during login:", err);
            return res.status(500).json({ message: "Error during login" });
        }

        if (results.length > 0) {
            const storedPassword = results[0].client_pass;

            if (!storedPassword || storedPassword.trim() === "") {
                return res.json({ success: false, message: "Access denied. Account password is missing." });
            }

            if (password === storedPassword) {
                const token = jwt.sign(
                    { client_id: results[0].client_id },
                    JWT_SECRET,
                    { expiresIn: "1d" }
                );

                const isProd = process.env.NODE_ENV === "production";

                // ← Uses EPR_client_token, NOT EPR_token
                res.cookie("EPR_client_token", token, {
                    httpOnly: true,
                    secure: isProd,
                    sameSite: isProd ? "None" : "Lax",
                    domain: isProd ? ".dforms.dolluzcorp.in" : undefined,
                });

                return res.json({ success: true });
            }
        }

        return res.json({ success: false, message: "Invalid credentials" });
    });
});

// ─────────────────────────────────────────
// GET /verify_auth — ReviewFormPage auth guard calls this to check cookie
// ─────────────────────────────────────────
router.get("/verify_auth", verifyClientJWT, (req, res) => {
    res.json({ ok: true, client_id: req.client_id });
});

// ─────────────────────────────────────────
// Quarter helpers
// ─────────────────────────────────────────

/**
 * Returns the quarter number (1–4) for a given date.
 *   Q1: Jan–Mar   Q2: Apr–Jun   Q3: Jul–Sep   Q4: Oct–Dec
 */
function getQuarter(date) {
    return Math.floor(date.getMonth() / 3) + 1;
}

/**
 * Returns the first day of the current quarter.
 */
function quarterStart(date) {
    const q = getQuarter(date);
    const month = (q - 1) * 3; // 0, 3, 6, 9
    return new Date(date.getFullYear(), month, 1);
}

/**
 * Returns the last day of the current quarter.
 */
function quarterEnd(date) {
    const q = getQuarter(date);
    const month = q * 3; // 3, 6, 9, 12 — first month of NEXT quarter
    return new Date(date.getFullYear(), month, 0); // day 0 = last day of previous month
}

// ─────────────────────────────────────────
// GET /check-eligibility/:clientId/:empId
// Check if this employee can be reviewed this quarter.
// Returns:
//   { eligible: true }
//   { eligible: false, reason: "...", next_eligible_date: "YYYY-MM-DD" }
// ─────────────────────────────────────────
router.get("/check-eligibility/:clientId/:empId", verifyJWT, (req, res) => {
    const { clientId, empId } = req.params;

    const now = new Date();
    const qStart = quarterStart(now);
    const qEnd = quarterEnd(now);

    // Format as MySQL DATE strings
    const qStartStr = qStart.toISOString().split("T")[0];
    const qEndStr = qEnd.toISOString().split("T")[0];

    const query = `
        SELECT review_id, review_date, review_status
        FROM   employee_review
        WHERE  client_id = ?
          AND  emp_id    = ?
          AND  review_date BETWEEN ? AND ?
          AND  deleted_by IS NULL
        ORDER  BY review_date DESC
        LIMIT  1;
    `;

    db.query(query, [clientId, empId, qStartStr, qEndStr], (err, rows) => {
        if (err) {
            console.error("❌ check-eligibility error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (rows.length > 0) {
            // Already reviewed this quarter — tell the frontend when next quarter starts
            const nextQuarterStart = new Date(qEnd);
            nextQuarterStart.setDate(nextQuarterStart.getDate() + 1);
            return res.json({
                eligible: false,
                reason: `This employee already has a review for Q${getQuarter(now)} ${now.getFullYear()}.`,
                reviewed_on: rows[0].review_date,
                next_eligible_date: nextQuarterStart.toISOString().split("T")[0],
            });
        }

        return res.json({ eligible: true });
    });
});

// ─────────────────────────────────────────
// GET /reviewed-emp-ids/:clientId
// Returns emp_ids that have already been reviewed THIS quarter.
// Used by the frontend to grey-out / exclude those employees
// from the dropdown so the reviewer can't even select them.
// ─────────────────────────────────────────
router.get("/reviewed-emp-ids/:clientId", verifyJWT, (req, res) => {
    const { clientId } = req.params;
    const now = new Date();
    const qStartStr = quarterStart(now).toISOString().split("T")[0];
    const qEndStr = quarterEnd(now).toISOString().split("T")[0];

    const query = `
        SELECT DISTINCT emp_id
        FROM   employee_review
        WHERE  client_id  = ?
          AND  review_date BETWEEN ? AND ?
          AND  deleted_by IS NULL;
    `;

    db.query(query, [clientId, qStartStr, qEndStr], (err, rows) => {
        if (err) {
            console.error("❌ reviewed-emp-ids error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ reviewed_ids: rows.map(r => String(r.emp_id)) });
    });
});

// ─────────────────────────────────────────
// POST /submit-review
// Saves a complete employee review + ratings.
// Enforces one review per employee per quarter.
// ─────────────────────────────────────────
router.post("/submit-review", verifyJWT, (req, res) => {
    const {
        clientId,
        empId,
        employeeName,
        positionHeld,
        department,
        lastReviewDate,
        reviewerName,
        reviewerTitle,
        achievedGoals,
        nextGoals,
        comments,
        hrSignature,
        reviewerSignature,
        ratings,         // { "0": "Good", "1": "Excellent", ... }  index → RATING
        customQualities, // ["", "Teamwork", ""]
        customRatings,   // { "0": "", "1": "Good", "2": "" }
    } = req.body;

    // ── Basic validation ──────────────────────────────────────
    if (!clientId || !empId) {
        return res.status(400).json({ error: "clientId and empId are required." });
    }

    const submittedBy = req.emp_id;
    const now = new Date();
    const qStartStr = quarterStart(now).toISOString().split("T")[0];
    const qEndStr = quarterEnd(now).toISOString().split("T")[0];

    // ── Quarter duplicate check ───────────────────────────────
    const dupCheck = `
        SELECT review_id FROM employee_review
        WHERE  client_id = ? AND emp_id = ?
          AND  review_date BETWEEN ? AND ?
          AND  deleted_by IS NULL
        LIMIT  1;
    `;

    db.query(dupCheck, [clientId, empId, qStartStr, qEndStr], (err, existing) => {
        if (err) {
            console.error("❌ duplicate-check error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (existing.length > 0) {
            const nextQuarterStart = new Date(quarterEnd(now));
            nextQuarterStart.setDate(nextQuarterStart.getDate() + 1);
            return res.status(409).json({
                error: "duplicate_review",
                message: `A review for this employee already exists for Q${getQuarter(now)} ${now.getFullYear()}.`,
                next_eligible_date: nextQuarterStart.toISOString().split("T")[0],
            });
        }

        // ── Insert employee_review ────────────────────────────
        const insertReview = `
            INSERT INTO employee_review (
                client_id, emp_id, employee_name, position_held, department,
                last_review_date, review_date,
                reviewer_name, reviewer_title,
                achieved_goals, next_goals, comments,
                hr_signature, reviewer_signature,
                review_status, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?);
        `;

        const reviewValues = [
            clientId, empId, employeeName, positionHeld, department,
            lastReviewDate || null,
            reviewerName, reviewerTitle,
            achievedGoals, nextGoals, comments,
            hrSignature, reviewerSignature,
            submittedBy,
        ];

        db.query(insertReview, reviewValues, (err2, result) => {
            if (err2) {
                console.error("❌ insert-review error:", err2);
                return res.status(500).json({ error: "Database error" });
            }

            const reviewId = result.insertId;

            // ── Build rating rows ─────────────────────────────
            // QUALITIES array (same order as frontend)
            const QUALITIES = [
                "Works to Full Potential", "Quality of Work", "Work Consistency",
                "Communication", "Independent Work", "Takes Initiative", "Group Work",
                "Productivity", "Creativity", "Honesty", "Integrity", "Coworker Relations",
                "Client Relations", "Technical Skills", "Dependability", "Punctuality", "Attendance",
            ];

            const ratingRows = [];

            // Standard qualities (index 0–16)
            QUALITIES.forEach((quality, idx) => {
                const rating = ratings?.[idx] || null;
                ratingRows.push([reviewId, quality, rating, 0, idx]);
            });

            // Custom qualities (up to 3)
            if (Array.isArray(customQualities)) {
                customQualities.forEach((quality, idx) => {
                    if (quality && quality.trim()) {
                        const rating = customRatings?.[idx] || null;
                        ratingRows.push([reviewId, quality.trim(), rating, 1, 100 + idx]);
                    }
                });
            }

            if (ratingRows.length === 0) {
                return res.json({ success: true, review_id: reviewId });
            }

            // ── Insert review_ratings ─────────────────────────
            const insertRatings = `
                INSERT INTO review_ratings (review_id, quality_name, rating, is_custom, sort_order)
                VALUES ?;
            `;

            db.query(insertRatings, [ratingRows], (err3) => {
                if (err3) {
                    console.error("❌ insert-ratings error:", err3);
                    // Review was saved but ratings failed — still return partial success
                    return res.status(207).json({
                        success: true,
                        review_id: reviewId,
                        warning: "Review saved but ratings could not be stored.",
                    });
                }

                res.json({ success: true, review_id: reviewId });
            });
        });
    });
});

// ─────────────────────────────────────────
// GET /reviews/:clientId
// List all reviews for a client (for future review history page)
// ─────────────────────────────────────────
router.get("/reviews/:clientId", verifyJWT, (req, res) => {
    const { clientId } = req.params;

    const query = `
        SELECT
            er.review_id, er.emp_id, er.employee_name, er.position_held,
            er.department, er.review_date, er.last_review_date,
            er.reviewer_name, er.reviewer_title, er.review_status,
            er.create_time,
            COUNT(rr.rating_id) AS ratings_count
        FROM   employee_review er
        LEFT JOIN review_ratings rr ON rr.review_id = er.review_id
        WHERE  er.client_id = ? AND er.deleted_by IS NULL
        GROUP  BY er.review_id
        ORDER  BY er.review_date DESC, er.create_time DESC;
    `;

    db.query(query, [clientId], (err, rows) => {
        if (err) {
            console.error("❌ reviews list error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(rows);
    });
});

// ─────────────────────────────────────────
// GET /review/:reviewId
// Full detail of a single review + its ratings
// ─────────────────────────────────────────
router.get("/review/:reviewId", verifyJWT, (req, res) => {
    const { reviewId } = req.params;

    const reviewQuery = `
        SELECT * FROM employee_review
        WHERE review_id = ? AND deleted_by IS NULL;
    `;
    const ratingsQuery = `
        SELECT quality_name, rating, is_custom, sort_order
        FROM   review_ratings
        WHERE  review_id = ?
        ORDER  BY sort_order ASC;
    `;

    db.query(reviewQuery, [reviewId], (err, reviewRows) => {
        if (err || !reviewRows.length) {
            return res.status(404).json({ error: "Review not found" });
        }

        db.query(ratingsQuery, [reviewId], (err2, ratingRows) => {
            if (err2) {
                console.error("❌ review detail ratings error:", err2);
                return res.status(500).json({ error: "Database error" });
            }

            res.json({ ...reviewRows[0], ratings: ratingRows });
        });
    });
});

module.exports = { router, verifyJWT };