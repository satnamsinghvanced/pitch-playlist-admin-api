import mongoose from "mongoose";

const reviewTypeSchema =new mongoose.Schema({
  title :{type:String,required :true},
  description :{type:String,required :true},
  image :{type:String},
  alt :{type:String},
  rating :{type: Number, required: true, min: 1, max: 5},
  category :{ type: String,required: true, enum: ['Artist', 'Curator']},
  orderIndex: {
  type: Number,
  required: true,
  default: 0,
},  
},{timestamps:true})

const reviewType =mongoose.model("reviewType",reviewTypeSchema)

export default reviewType;