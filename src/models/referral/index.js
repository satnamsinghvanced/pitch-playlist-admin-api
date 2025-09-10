import mongoose from "mongoose";
import { Schema } from "mongoose";
const referralSchema = new Schema(
  {
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    referredTo: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  },
  { timestamps: true }
);
export default mongoose.model("referral", referralSchema);
