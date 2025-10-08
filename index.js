import express from "express";
import cors from "cors";
import routs from "./src/api/routes/index.js";
import config from "./config.js";
import cookieParser from "cookie-parser";
import "./src/db/connection.js";
// import "./src/middleware/cronJobs.js";
// import "./scripts/generate-sitemap.js";
const app = express();
let { PRODUCTION_PORT } = config;
const PORT = PRODUCTION_PORT || 9000;
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.get("/api/testing", async (req, res) => {
  res.send("Working 0.1");
});

app.use("/api", routs);

app.use("/public", express.static("./public"));
app.use("/uploads", express.static("./uploads"))

app.listen(PORT, () => {
  console.log("Server is running..." + PORT);
});