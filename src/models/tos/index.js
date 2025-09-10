import mongoose from "mongoose";

const tosSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const TOS = mongoose.model("TOS", tosSchema);

export default TOS;
