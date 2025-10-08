import mongoose from "mongoose";

const itemSchema =  new mongoose.Schema({
    title:{
        type:String,
        required:true,
        trim:true,
    },
    route:{
        type:String,
        required:true,
        trim:true,
    },
    label:{
        type:String,
        required:true,
        trim:true
    },
    description:{
        type:String,
        required:true,
        trim:true,
    },
});

const sitemapSchema = new mongoose.Schema({
    title:{
        type:String,
        required:true,
        trim:true
    },
    description:{
        type:String,
        required:true,
        trim:true
    },
    items:{
        type:[itemSchema],
        required:true
    },
});

const Sitemap = mongoose.model("Sitemap",sitemapSchema);

export default Sitemap;