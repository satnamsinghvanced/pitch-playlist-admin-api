import jwt from "jsonwebtoken";
import config from "../../config.js";
import BlackList from "../models/blackList/index.js";
const { JWT_SECRET } = config;

const auth = async (req, res, next) => {
  // Get token from header
  let token = req.header("x-auth-token");

  if (!token) {
    // If x-auth-token header is not present, check for Authorization header
    const authHeader = req.header("Authorization");
    if (authHeader) {
      // Get the token from the Authorization header
      const parts = authHeader.split(" ");
      if (parts.length === 2 && parts[0] === "Bearer") {
        token = parts[1];
      }
    }
  }

  // Check if no token
  if (!token) {
    return res.status(401).json({ msg: "No token, authorization denied" });
  }
  const checkIfBlacklisted = await BlackList.findOne({ token });
  if (checkIfBlacklisted)
    return res
      .status(401)
      .json({ message: "This session has expired. Please login" });
  // Verify token
  try {
    jwt.verify(token, JWT_SECRET, (error, decoded) => {
      if (error) {
        return res.status(401).json({ msg: "Token is not valid" });
      } else {
        res.locals.decode = decoded;
        next();
      }
    });
  } catch (err) {
    console.error("Something went wrong with auth middleware");
    res.status(500).json({ msg: "Server Error" });
  }
};

export default auth;
