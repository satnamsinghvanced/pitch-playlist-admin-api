import mongoose from "mongoose";
import { Schema } from "mongoose";

const transactionSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    amount: {
      type: Number,
      required: true,
    },
    credits: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: ["card", "paypal"],
      required: true,
    },
    customerId: {
      type: String,
    },
    paymentIntentId: {
      type: String,
    },
    paymentStatus: {
      type: String,
    },
  },
  { timestamps: true }
);
export default mongoose.model("transaction", transactionSchema);
