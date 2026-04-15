import mongoose from "mongoose";

let connected = false;

export async function connectMongo(uri: string): Promise<void> {
    if (connected) {
        return;
    }
    await mongoose.connect(uri, {
        dbName: process.env.MONGO_DB_NAME || "trademax"
    });
    connected = true;
}
