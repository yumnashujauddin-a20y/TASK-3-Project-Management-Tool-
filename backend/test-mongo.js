
const { MongoClient } = require("mongodb");

async function main() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error("MONGO_URI is missing from .env");
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Successfully connected to MongoDB!");
  } finally {
    await client.close();
  }
}

require("dotenv").config();

main().catch((err) => {
  console.error("MongoDB test failed:", err.message);
  process.exitCode = 1;
});
