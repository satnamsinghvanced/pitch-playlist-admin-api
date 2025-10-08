import mongoose from 'mongoose';

const featureTypeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
}, { timestamps: true });

const featureType = mongoose.model("feature", featureTypeSchema);

export default featureType;
