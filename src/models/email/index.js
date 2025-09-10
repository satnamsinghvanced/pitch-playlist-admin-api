import mongoose from 'mongoose';

const emailSchema = new mongoose.Schema(
    {
        to: { 
            type: [String],  
            required: true,
            validate: {
                validator: (arr) => arr.length > 0,
                message: "At least one recipient (to) is required."
            }
        },
        subject:{
            type: String,
            required:true
        },
        body: { 
            type: String,
            required: true 
        }
    },
    { timestamps: true }
);

export default mongoose.model("EmailTemplate", emailSchema);
