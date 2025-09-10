import mongoose from 'mongoose';

const emailTemplateSchema = new mongoose.Schema(
    {
        categoryId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category'
        },
        body: {
            type: String,
            required: true
        }
    },
    { timestamps: true }
);

export default mongoose.model("Template", emailTemplateSchema);
