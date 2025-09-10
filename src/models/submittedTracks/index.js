import mongoose from "mongoose";
import { Schema } from "mongoose";

const submittedTrackSchema = new Schema(
  {
    trackId: {
      type: String,
    },
    totalSubmitted: {
      type: Number,
    },
    userId: {
      type: String,
    },
    spotifyId: {
      type: String,
    },
    submittedOn: {
      type: Date,
      default: new Date(),
    },
    removed: {
      type: Boolean,
      default: false,
    },
     playlistUrl: {
      type: Map,
      of: [String],
    },
    tracksIds: {
      type: Map,
      of: [String],
    },
    //   playlistUrl: [
    //   {
    //     type: String,
    //   },
    // ],
    // tracksIds: [
    //   {
    //     type: String,
    //   },
    // ],
  },
  { timestamps: true }
);

export default mongoose.model("submittedTracks", submittedTrackSchema);
