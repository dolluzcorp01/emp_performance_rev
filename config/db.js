const mysql = require('mysql');

// Store active pools in an object
const pools = {};

// Function to get or create a pool for a given database
function getDBConnection(database) {
    if (!pools[database]) {
        pools[database] = mysql.createPool({
            connectionLimit: 100,  // Increase if needed
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: database,  // ✅ Use the actual database name
            waitForConnections: true,
            queueLimit: 1000, // Limit waiting queries
            multipleStatements: true,
        });

        console.log(`🔗 Created new connection pool for database: ${database}`);
    }
    return pools[database];
}

module.exports = getDBConnection;
