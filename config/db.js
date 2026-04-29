// // config/db.js
// // Phase 1 refactor: extracted from server.js
// // Phase 3 refactor: reads MONGO_URI from appConfig
// // Atlas update: added mongoose options required for stable Atlas connections

// const mongoose  = require('mongoose');
// const appConfig = require('./appConfig');

// async function connectDB() {
//   try {
//     await mongoose.connect(appConfig.mongoUri, {
//       // Required for MongoDB Atlas — keeps the connection alive
//       serverSelectionTimeoutMS: 5000,   // fail fast if Atlas unreachable
//       socketTimeoutMS:          45000,  // close sockets after 45s of inactivity
//     });
//     console.log('MongoDB Atlas connected');
//   } catch (err) {
//     console.error('MongoDB connection error:', err.message);
//     process.exit(1);
//   }
// }

// module.exports = connectDB;
// config/db.js
const mongoose  = require('mongoose');
const dns       = require('dns');
const appConfig = require('./appConfig');

// Force Node.js to use Google DNS for SRV record resolution
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function connectDB() {
  try {
    await mongoose.connect(appConfig.mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS:          45000,
      family: 4,
    });
    console.log('MongoDB Atlas connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;