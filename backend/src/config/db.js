import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/gymflow";

export async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`MongoDB connected: ${mongoose.connection.name}`);
  } catch (err) {
    // The API stays up without a database so the frontend can still be
    // developed against it; routes that touch the DB will fail on their own.
    console.error(`MongoDB connection failed: ${err.message}`);
  }
}

export default connectDB;
