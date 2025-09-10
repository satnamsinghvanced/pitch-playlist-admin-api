import mongoose from "mongoose";
import { Schema } from "mongoose";
const packageSchema = new Schema(
  {
    credits: {
      type: Number,
    },
    price: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("package", packageSchema);
