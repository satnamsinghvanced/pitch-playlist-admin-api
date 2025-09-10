import mongoose from "mongoose";

const emailLogSchema = new mongoose.Schema(
  {
    to: { type: String },
    subject: { type: String },
    templateName: { type: String },
    templateContent: { type: String },
    category: { type: String},
  },
  { timestamps: true }
);

const EmailLog = mongoose.model("EmailLog", emailLogSchema);
export default EmailLog;
