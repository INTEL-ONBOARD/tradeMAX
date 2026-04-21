import mongoose from "mongoose";
import { safeProcessLog } from "../shared/processDiagnostics.js";

let connected = false;

export async function connectMongo(uri: string): Promise<void> {
  if (connected) return;
  await mongoose.connect(uri, { dbName: "trademax" });
  connected = true;
  safeProcessLog("DB", "Connected to MongoDB Atlas");
}

export async function disconnectMongo(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  safeProcessLog("DB", "Disconnected from MongoDB");
}
