import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { Schema } from "mongoose";

const adminSchema = new Schema(
  {
    email: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      default: null,
    },
    originalPassword: {
      type: String,
      default: null,
    },
    name: {
      type: String,
    },
    role: {
      type: Number,
    },
  },
  { timestamps: true }
);

adminSchema.pre("save", async function (next) {
  const user = this;

  if (!user.isModified("password")) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(user.password, salt);

    user.password = hashedPassword;

    next();
  } catch (error) {
    next(error);
  }
});

export default mongoose.model("admin", adminSchema);
