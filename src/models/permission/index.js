import mongoose from "mongoose";
import { Schema } from "mongoose";

const permissionSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
    },
    dashboardAccess: {
      type: Boolean,
      default: false,
    },
    pitchingToolAccess: {
      type: Boolean,
      default: false,
    },
    userManagementAccess: {
      type: Boolean,
      default: false,
    },
    genreCatalogAccess: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);
export default mongoose.model("permission", permissionSchema);
