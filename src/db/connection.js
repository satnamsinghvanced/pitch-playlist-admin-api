import mongoose from 'mongoose';
import config from "../../config.js"

let { DATABASE } = config;

const connectWithRetry = () => {
  mongoose
    .connect(DATABASE)
    .then(() => {
      console.log("Connected to MongoDB");
    })
    .catch((err) => {
      console.error("Failed to connect to MongoDB. Retrying...", err);
      setTimeout(connectWithRetry, 5000); // Retry after 5 seconds
    });
};

connectWithRetry();

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB");
});
