import mongoose from "mongoose";

const termsSchema = new mongoose.Schema(
  {
    spotifyId: {
      type: String,
    },
    emailNotification: {
      type: Boolean,
      default: false,
    },
    marketingOptIn: {
      type: Boolean,
      default: true,
    },
    termsOptIn: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);
export default mongoose.model("terms", termsSchema);
