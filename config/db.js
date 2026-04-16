const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✓ MongoDB connected successfully");
     console.log("✓ MongoDB connected to:", mongoose.connection.db.databaseName);
    return mongoose.connection;
  } catch (error) {
    console.error(" MongoDB connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;