import mongoose from "mongoose";

const trackSchema = new mongoose.Schema(
  {
    isAutomatedSubmission: {
      type: Boolean,
      default: false,
    },
    playlist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "playlist",
    },
    declineReason: {
      type: String,
    },
    status: {
      type: String,
      default: "pending",
    },
    spotifyId: {
      type: String,
    },
    track: {
      artistName: {
        type: String,
      },
      artists: [
        {
          external_urls: {
            spotify: {
              type: String,
            },
          },
          href: {
            type: String,
          },
          id: {
            type: String,
          },
          name: {
            type: String,
          },
          type: {
            type: String,
          },
          uri: {
            type: String,
          },
        },
      ],
      artistsArr: [
        {
          artistName: {
            type: String,
          },
          artistId: {
            type: String,
          },
          artistUrl: {
            type: String,
          },
          totalFollowers: {
            type: String,
          },
        },
      ],
      trackImageUrl: {
        type: String,
      },
      trackName: {
        type: String,
      },
      preview_url: {
        type: String,
      },
      trackId: {
        type: String,
      },
      trackUrl: {
        type: String,
      },
      uri: {
        type: String,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("track", trackSchema);
