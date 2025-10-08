import mongoose from "mongoose";

const genreMismatchReportSchema = new mongoose.Schema({
  trackId: { type: String, required: true },
  playlistId: { type:String, required: true },
  status: {
    type: String,
    default: "declined",
  },
  userId:{type: String},
  penalty:{type:Number,default:null}
}, { timestamps: true });

export default mongoose.model("GenreMismatchReport", genreMismatchReportSchema);
