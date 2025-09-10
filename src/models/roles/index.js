import mongoose from "mongoose";
import { Schema } from "mongoose";
const roleSchema = new Schema(
  {
    id: {
      type: Number,
    },
    roleName: {
      type: String,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);
export default mongoose.model("Role", roleSchema);
