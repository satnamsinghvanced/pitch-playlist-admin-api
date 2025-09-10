import mongoose from "mongoose";
const toDecimal128 = (v) => mongoose.Types.Decimal128.fromString(v.toString());

const responseRateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    responseRate: {
      type: mongoose.Schema.Types.Decimal128,
      set: toDecimal128,
      get: (v) => parseFloat(v.toString()),
    },
    totalSongs: {
      type: Number,
    },
    totalPlaylist: {
      type: Number,
    },
    lastWeek: {
      type: Number,
      default: 0,
    },
    expiredTrack: {
      type: Number,
      default: 0,
    },
    peak: {
      type: Number,
      default: 0,
    },
    weekInTopChart: {
      type: Number,
      default: 0,
    },
    bouncePoint: {
      type: Number,
    },
    feedbackGiven: {
      type: Number,
    },
    engagementScore: {
      type: Number
    },
  },
  { timestamps: true }
);

export default mongoose.model("responseRate", responseRateSchema);
