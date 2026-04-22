const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { v4: uuidv4 } = require("uuid");

dotenv.config();

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI; 
const COLLECTION_NAME = "profiles"
// ─────────────────────────────────────────────────────────────────────────────

const rawSchema = new mongoose.Schema({}, { strict: false });
const Collection = mongoose.model(COLLECTION_NAME, rawSchema, COLLECTION_NAME);

async function addMissingFields() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  // Find all documents missing the 'id' field
  const docs = await Collection.find({
    $or: [{ id: { $exists: false } }, { id: null }],
  }).lean();

  console.log(`🔍 Found ${docs.length} documents missing 'id'`);

  if (docs.length === 0) {
    console.log("Nothing to update. Exiting.");
    await mongoose.disconnect();
    return;
  }

  const now = new Date();

  const bulkOps = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: {
        $set: {
          id: uuidv4(),
          timestamps: {
            createdAt: now,
            updatedAt: now,
          },
        },
      },
    },
  }));

  const result = await Collection.bulkWrite(bulkOps);
  console.log(`✅ Updated ${result.modifiedCount} documents`);

  await mongoose.disconnect();
  console.log("🔌 Disconnected from MongoDB");
}

addMissingFields().catch((err) => {
  console.error("❌ Error:", err);
  mongoose.disconnect();
  process.exit(1);
});