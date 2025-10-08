import mongoose from "mongoose";

const faqItemSchema = new mongoose.Schema(
  {
    heading: { type: String },
    title: { type: String, required: true },
    description: { type: String, required: true },
    orderIndex: { type: Number, required: true, default: 0 },
  },
  { _id: true }
);

const faqCategorySchema = new mongoose.Schema(
  {
    category: { type: String, required: true },
    items: [faqItemSchema],
  },
  { timestamps: true }
);

const FaqCategory = mongoose.model("FaqCategory", faqCategorySchema);

export default FaqCategory;