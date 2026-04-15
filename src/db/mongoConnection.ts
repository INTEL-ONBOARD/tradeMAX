import mongoose from "mongoose";

let connected = false;

export async function connectMongo(uri: string): Promise<void> {
  if (connected) return;
  await mongoose.connect(uri, { dbName: "trademax" });
  connected = true;
  console.log("[DB] Connected to MongoDB Atlas");
}

export async function disconnectMongo(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  console.log("[DB] Disconnected from MongoDB");
}
