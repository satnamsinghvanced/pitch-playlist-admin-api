import mongoose from "mongoose";
import { Schema } from "mongoose";
const genresSchema = new Schema({
  id: {
    type: Number,
  },
  name: {
    type: String,
  },
  category: {
    type: String,
  },
  categoryIndex: {
    type: Number,
  },
  nameIndex: {
    type: Number,
  },
});
export default mongoose.model("genres", genresSchema);
