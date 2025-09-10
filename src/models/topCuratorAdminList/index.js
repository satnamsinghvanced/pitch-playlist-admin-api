import mongoose from "mongoose";
const toDecimal128 = (v) => mongoose.Types.Decimal128.fromString(v.toString());
const topCuratorAdminListSchema = new mongoose.Schema(
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
    countryName: {
      type: String,
    },
    totalSongs: {
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
    expiredTrack: {
      type: Number,
    },
    engagementScore: {
      type: Number,
      required: false
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
    feedbackGivenDays: {
      type: String,
    },
    warningReceived:{
      type:String
    }
  },
  { timestamps: true }
);

export default mongoose.model("topCuratorAdminList", topCuratorAdminListSchema);
