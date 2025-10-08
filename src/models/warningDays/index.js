import mongoose from "mongoose";
import { Schema } from "mongoose";

const warningSchema = new Schema(
  {
    noOfDays: {
      type: Number,
    },
  },
  { timestamps: true }
);

export default mongoose.model("warningDays", warningSchema);
