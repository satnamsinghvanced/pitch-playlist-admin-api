import mongoose from "mongoose";
import { Schema } from "mongoose";

const customerSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    name: {
      type: String,
    },
    email: {
      type: String,
    },
    customerId: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("customer", customerSchema);
