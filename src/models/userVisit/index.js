import mongoose from "mongoose";
import { Schema } from "mongoose";

const userVisitSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
  },
  { timestamps: true }
);
export default mongoose.model("userVisit", userVisitSchema);
