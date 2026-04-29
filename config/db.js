// config/db.js
// Phase 1 refactor: extracted from server.js
// Phase 3 refactor: reads MONGO_URI from config/appConfig.js instead of process.env directly

const mongoose  = require('mongoose');
const appConfig = require('./appConfig');

async function connectDB() {
  try {
    await mongoose.connect(appConfig.mongoUri);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
}

module.exports = connectDB;
