const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const port = 5005;

// ✅ Middleware for CORS - Allow specific origins
const allowedOrigins = [
    'http://localhost:3000',   // Allow React frontend 
    'http://127.0.0.1:3000',   // Allow localhost if accessing via 127.0.0.1
    'http://localhost:5005'     // Allow backend server origin (no trailing slash)
];

// Enable CORS with the allowed origins and credentials
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
            callback(null, origin); // <-- ✅ return origin instead of true
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// ✅ Middleware for parsing JSON and reading HTTP-only cookies
app.use(express.json());
app.use(cookieParser());

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// ✅ Import Routes Correctly
const loginRoutes = require('./src/backend_routes/Login_server');
const clientConfigRoutes = require('./src/backend_routes/Client_config_server');

// ✅ Use Routes
app.use('/api/login', loginRoutes.router);
app.use('/api/client-config', clientConfigRoutes.router);

const path = require('path');
app.use('/client_logo_uploads', express.static(path.join(__dirname, 'client_logo_uploads')));

console.log('✅ Routes have been set up');

// ✅ Start the server2
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});
