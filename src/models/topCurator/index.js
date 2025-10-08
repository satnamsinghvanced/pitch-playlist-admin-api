import mongoose from "mongoose";
const toDecimal128 = (v) => mongoose.Types.Decimal128.fromString(v.toString());
const topCuratorSchema = new mongoose.Schema(
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
    lastWeek: {
      type: Number,
    },
    countryName: {
      type: String,
    },
    totalSongs: {
      type: Number,
    },
    peak: {
      type: Number,
    },
    weekInTopChart: {
      type: Number,
    },
    position: {
      type: Number,
    },
    referral: {
      type: Number,
    },
    bouncePoint: {
      type: Number,
    },
    weightedScore: {
      type: mongoose.Schema.Types.Decimal128,
      set: toDecimal128,
      get: (v) => parseFloat(v.toString()),
    },
    feedbackGiven: {
      type: Number,
    },
    totalPlaylist: {
      type: Number,
    },
    allGenres: [
      {
        id: {
          type: Number,
        },
        name: {
          type: String,
        },
        category: {
          type: String,
        },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("topCurator", topCuratorSchema);
