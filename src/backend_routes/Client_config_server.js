require("dotenv").config();
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const getDBConnection = require("../../config/db");

const db = getDBConnection("emp_performance_rev");

router.use(cookieParser());

// ─────────────────────────────────────────
// JWT Middleware
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

function generateColorFromText(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash % 360)}, 70%, 60%)`;
}

// ✅ Get employee profile details
router.get('/get-employees', verifyJWT, (req, res) => {
    if (!req.emp_id) {
        return res.status(401).json({ error: 'Unauthorized access' });
    }

    const query = `
        SELECT e.emp_id, e.emp_first_name, e.emp_last_name, e.emp_profile_img,  j.job_name
        FROM dadmin.employee e
		LEFT JOIN dadmin.job_position_config j ON j.job_id = e. job_position
        WHERE e.deleted_by IS NULL;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('❌ Error fetching employees:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const formattedEmployees = results.map(emp => {
            const fullName = `${emp.emp_first_name} ${emp.emp_last_name}`;

            return {
                emp_id: emp.emp_id,
                full_name: fullName,
                profile_letters: fullName.charAt(0).toUpperCase(),
                profile_color: generateColorFromText(fullName),
                job_name: emp.job_name || "Employee",
                emp_profile_img: emp.emp_profile_img
            };
        });

        res.json(formattedEmployees);
    });
});

// ─────────────────────────────────────────
// Max size: 1 MB
// Filename: client_<clientId or "new">_<timestamp>.<ext>
// ─────────────────────────────────────────
const LOGO_DIR = "client_logo_uploads/";

// Ensure the upload folder exists
if (!fs.existsSync(LOGO_DIR)) fs.mkdirSync(LOGO_DIR, { recursive: true });

const logoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, LOGO_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const clientId = req.params.clientId || "new";
        const timestamp = Date.now();
        cb(null, `client_${clientId}_${timestamp}${ext}`);
    },
});

const logoUpload = multer({
    storage: logoStorage,
    limits: { fileSize: 1 * 1024 * 1024 }, // 1 MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files are allowed"), false);
        }
        cb(null, true);
    },
});

// Helper: delete old logo file from disk
const deleteLogoFile = (logoPath) => {
    if (!logoPath) return;
    // logoPath stored in DB is like "client_logo_uploads/client_3_1720000000000.png"
    if (fs.existsSync(logoPath)) {
        fs.unlink(logoPath, (err) => {
            if (err) console.error("⚠️  Could not delete old logo:", err.message);
        });
    }
};

// ─────────────────────────────────────────
// GET /get-clients  — all active clients
// ─────────────────────────────────────────
router.get("/get-clients", verifyJWT, (req, res) => {
    const query = `
        SELECT c.client_id, c.client_status, c.company_name, c.company_email,
               c.company_address, c.department, c.company_logo, c.poc_name, c.poc_role, c.poc_email,
               c.poc_number, c.create_time,
               COUNT(ce.emp_id) AS employee_count
        FROM   client c
        LEFT JOIN client_employees ce
               ON ce.client_id = c.client_id AND ce.deleted_by IS NULL
        WHERE  c.deleted_by IS NULL
        GROUP  BY c.client_id
        ORDER  BY c.create_time DESC;
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error("❌ get-clients error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json(results);
    });
});

// ─────────────────────────────────────────
// GET /get-client/:clientId  — single client + its employees
// ─────────────────────────────────────────
router.get("/get-client/:clientId", verifyJWT, (req, res) => {
    const { clientId } = req.params;

    const clientQuery = `
        SELECT client_id, client_status, company_name, company_email, company_address, department, company_logo, 
        poc_name, poc_role, poc_email, poc_number
        FROM   client
        WHERE  client_id = ? AND deleted_by IS NULL;
    `;

    const empQuery = `
        SELECT ce.emp_id, e.emp_first_name, e.emp_last_name, j.job_name
        FROM   client_employees ce
        JOIN   dadmin.employee e ON e.emp_id = ce.emp_id
        LEFT JOIN dadmin.job_position_config j ON j.job_id = e. job_position
        WHERE  ce.client_id = ? AND ce.deleted_by IS NULL;
    `;

    db.query(clientQuery, [clientId], (err, clientRows) => {
        if (err) {
            console.error("❌ get-client error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        if (!clientRows.length) return res.status(404).json({ error: "Client not found" });

        db.query(empQuery, [clientId], (err2, empRows) => {
            if (err2) {
                console.error("❌ get-client employees error:", err2);
                return res.status(500).json({ error: "Database error" });
            }

            const client = clientRows[0];

            // Build employee objects matching the frontend shape
            client.employees = empRows.map(emp => {
                const fullName = `${emp.emp_first_name} ${emp.emp_last_name}`;
                return {
                    emp_id: emp.emp_id,
                    full_name: fullName,
                    profile_letters: fullName.charAt(0).toUpperCase(),
                    profile_color: generateColorFromText(fullName),
                    job_name: emp.job_name || "Employee",
                };
            });

            res.json(client);
        });
    });
});

// ─────────────────────────────────────────
// POST /add-client  — insert new client
// ─────────────────────────────────────────
router.post("/add-client", verifyJWT, logoUpload.single("company_logo"), (req, res) => {
    const {
        company_name, company_email, company_address, department,
        poc_name, poc_role, poc_email, poc_number,
        client_status = "Active",
        employee_ids,          // JSON string: "[1,2,3]"
    } = req.body;

    // Basic validation
    if (!company_name || !company_email || !poc_name || !poc_email) {
        // Clean up uploaded file if validation fails
        if (req.file) deleteLogoFile(req.file.path);
        return res.status(400).json({ error: "Required fields missing" });
    }

    const logoPath = req.file ? req.file.path : null;
    const empIds = safeParseJSON(employee_ids, []);
    const createdBy = req.emp_id;

    const insertClient = `
        INSERT INTO client
            (client_status, company_name, company_email, company_address, department,
             company_logo, poc_name, poc_role, poc_email, poc_number, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;

    db.query(insertClient, [
        client_status, company_name, company_email, company_address, department,
        logoPath, poc_name, poc_role, poc_email, poc_number, createdBy,
    ], (err, result) => {
        if (err) {
            console.error("❌ add-client error:", err);
            if (req.file) deleteLogoFile(req.file.path);
            return res.status(500).json({ error: "Database error" });
        }

        const newClientId = result.insertId;

        // ── Rename logo file to include the real client_id ──
        if (req.file) {
            const oldPath = req.file.path;
            const ext = path.extname(oldPath);
            const newPath = `${LOGO_DIR}client_${newClientId}_${Date.now()}${ext}`;

            fs.rename(oldPath, newPath, (renameErr) => {
                if (renameErr) console.error("⚠️  Logo rename failed:", renameErr.message);
                else {
                    // Update DB with the correct filename
                    db.query(
                        "UPDATE client SET company_logo = ? WHERE client_id = ?",
                        [newPath, newClientId]
                    );
                }
            });
        }

        // ── Insert client_employees ──
        if (empIds.length === 0) {
            return res.json({ success: true, client_id: newClientId });
        }

        const empValues = empIds.map(id => [newClientId, id, createdBy]);
        db.query(
            "INSERT INTO client_employees (client_id, emp_id, created_by) VALUES ?",
            [empValues],
            (empErr) => {
                if (empErr) console.error("⚠️  Insert employees error:", empErr);
                res.json({ success: true, client_id: newClientId });
            }
        );
    });
});

// ─────────────────────────────────────────
// PUT /update-client/:clientId  — update existing client
// ─────────────────────────────────────────
router.put("/update-client/:clientId", verifyJWT, logoUpload.single("company_logo"), (req, res) => {
    const { clientId } = req.params;
    const {
        company_name, company_email, company_address,
        poc_name, poc_role, poc_email, poc_number,
        client_status,
        employee_ids,          // JSON string of CURRENT full list
    } = req.body;

    if (!company_name || !company_email || !poc_name || !poc_email) {
        if (req.file) deleteLogoFile(req.file.path);
        return res.status(400).json({ error: "Required fields missing" });
    }

    const updatedBy = req.emp_id;

    // ── Fetch old logo path first ──
    db.query(
        "SELECT company_logo FROM client WHERE client_id = ? AND deleted_by IS NULL",
        [clientId],
        (err, rows) => {
            if (err || !rows.length) {
                if (req.file) deleteLogoFile(req.file.path);
                return res.status(404).json({ error: "Client not found" });
            }

            const oldLogoPath = rows[0].company_logo;
            let newLogoPath = oldLogoPath; // keep existing unless a new one is uploaded

            if (req.file) {
                // Delete old logo file from disk
                deleteLogoFile(oldLogoPath);
                newLogoPath = req.file.path;
            }

            const updateQuery = `
                UPDATE client SET
                    client_status   = ?,
                    company_name    = ?,
                    company_email   = ?,
                    company_address = ?,
                    department      = ?,
                    company_logo    = ?,
                    poc_name        = ?,
                    poc_role        = ?,
                    poc_email       = ?,
                    poc_number      = ?,
                    updated_by      = ?,
                    updated_time    = NOW()
                WHERE client_id = ? AND deleted_by IS NULL;
            `;

            db.query(updateQuery, [
                client_status, company_name, company_email, company_address, department,
                newLogoPath, poc_name, poc_role, poc_email, poc_number,
                updatedBy, clientId,
            ], (updateErr) => {
                if (updateErr) {
                    console.error("❌ update-client error:", updateErr);
                    return res.status(500).json({ error: "Database error" });
                }

                // ── Sync employees: replace with the new list ──
                const empIds = safeParseJSON(employee_ids, []);
                syncClientEmployees(clientId, empIds, updatedBy, () => {
                    res.json({ success: true });
                });
            });
        }
    );
});

// ─────────────────────────────────────────
// DELETE /delete-client/:clientId  — soft delete
// ─────────────────────────────────────────
router.delete("/delete-client/:clientId", verifyJWT, (req, res) => {
    const { clientId } = req.params;
    const deletedBy = req.emp_id;

    db.query(
        `UPDATE client SET deleted_by = ?, deleted_time = NOW()
         WHERE client_id = ? AND deleted_by IS NULL`,
        [deletedBy, clientId],
        (err) => {
            if (err) {
                console.error("❌ delete-client error:", err);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ success: true });
        }
    );
});

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

// Sync client_employees: soft-delete removed, insert new ones
function syncClientEmployees(clientId, newEmpIds, updatedBy, callback) {
    // Get current active employee IDs for this client
    db.query(
        "SELECT emp_id FROM client_employees WHERE client_id = ? AND deleted_by IS NULL",
        [clientId],
        (err, rows) => {
            if (err) { console.error("sync employees fetch error:", err); return callback(); }

            const currentIds = rows.map(r => r.emp_id);
            const toRemove = currentIds.filter(id => !newEmpIds.includes(id));
            const toAdd = newEmpIds.filter(id => !currentIds.includes(id));

            const tasks = [];

            // Soft-delete removed employees
            if (toRemove.length) {
                tasks.push(new Promise((resolve) => {
                    db.query(
                        `UPDATE client_employees
                         SET deleted_by = ?, deleted_time = NOW()
                         WHERE client_id = ? AND emp_id IN (?)`,
                        [updatedBy, clientId, toRemove],
                        (e) => { if (e) console.error("remove emp error:", e); resolve(); }
                    );
                }));
            }

            // Insert newly added employees
            if (toAdd.length) {
                const values = toAdd.map(id => [clientId, id, updatedBy]);
                tasks.push(new Promise((resolve) => {
                    db.query(
                        "INSERT INTO client_employees (client_id, emp_id, created_by) VALUES ?",
                        [values],
                        (e) => { if (e) console.error("add emp error:", e); resolve(); }
                    );
                }));
            }

            Promise.all(tasks).then(callback);
        }
    );
}

function safeParseJSON(str, fallback) {
    try { return JSON.parse(str); }
    catch { return fallback; }
}

// Multer error handler (1 MB exceeded etc.)
router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError || err.message === "Only image files are allowed") {
        return res.status(400).json({ error: err.message });
    }
    next(err);
});

module.exports = { router, verifyJWT };