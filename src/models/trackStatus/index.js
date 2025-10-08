import mongoose from "mongoose";
import { Schema } from "mongoose";

const trackStatusSchema = new Schema(
  {
    track: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "track",
    },
    playlist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "playlist",
    },
    trackId: {
      type: String,
    },
    playlistId: {
      type: String,
    },
    approvedOn: {
      type: Date,
    },
    removedFromPlaylist: {
      type: Date,
    },
    curatorNotified: {
      type: Boolean,
      default: false,
    },
    stillInPlaylist: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);
export default mongoose.model("trackStatus", trackStatusSchema);
