const mongoose = require("mongoose");

require("dotenv").config();

const DBconnection = () => {
    const mongoUrl = String(process.env.MONGO_URL || "").trim();
    if (!mongoUrl) {
        console.error("[DB] MONGO_URL is missing in .env");
        return;
    }

    mongoose
        .connect(mongoUrl, {
            serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000),
        })
        .then(() => {
            console.log("[DB] MongoDB connected");
        })
        .catch((err) => {
            console.error("[DB] MongoDB connection failed:", err.message);
        });
};

module.exports = DBconnection;
