import express from "express";
import cors from "cors";
import config from "./config.js";
import cookieParser from "cookie-parser";
import "./src/db/connection.js";

const app = express();
let { PRODUCTION_PORT } = config;
const PORT = PRODUCTION_PORT || 9000;
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.get("/cron/testing", async (req, res) => {
  res.send("Working 0.1");
});



app.listen(PORT, () => {
	console.log("ee");
  console.log("Server is running..." + PORT);
});
