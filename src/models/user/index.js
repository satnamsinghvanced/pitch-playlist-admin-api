import mongoose from "mongoose";
const penaltySchema = new mongoose.Schema({
  points: { type: Number, required: true },
  startDate: { type: Date, default: Date.now },
  expireDate: { type: Date },
});
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      default: null,
    },
    name: {
      type: String,
    },
    spotifyId: {
      type: String,
    },
    profileUrl: {
      type: String,
    },
    followers: {
      type: String,
    },
    country: {
      type: String,
    },
    usedCredits: {
      type: Number,
      default: 0,
    },
    image: [
      {
        url: {
          type: String,
        },
        height: {
          type: Number,
        },
        width: {
          type: Number,
        },
      },
    ],
    userCredits: {
      type: Number,
      default: 20,
    },
    bouncePoint: {
      type: Number,
      default: 0,
    },
    penalties: [penaltySchema],
    // creditPenaltyStart: {
    //   type: Date,
    //   default: null,
    // },
    // creditEndDate: {
    //   type: Date,
    //   default: null,
    // },
    lastPenaltyUpdate: {
      type: Date,
      default: null,
    },
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    responseDate: {
      type: Date,
    },
    creditUpdateDate: {
      type: Date,
      default: Date.now,
    },
    currentStatus: {
      type: String,
      default: "Active",
    },
    isBan: {
      type: Boolean,
      default: false,
    },
    reminderSent: {
      type: Boolean,
      default: false,
    },
    emailReceiver: {
      type: Boolean,
      default: true,
    },
    songPosition: {
      type: Number,
      default: 0,
    },
    lastEmailSend: {
      type: Date,
      default: null,
    },
    lastRefillClicked: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("user", userSchema);
