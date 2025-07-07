import dotenv from "dotenv"
import { app } from "./app.js";
import connectDB from "./db/index.js";

dotenv.config({
    path:'./.env'
})


connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`server is running at port : ${process.env.PORT}`)
    })
})
.catch((error)=>{
    console.log("mongo db connection failed!!!!!", error)
})




/* 1st approach in notes
import express from "express"

const app=express()

(async ()=>{
    try {
       await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
       app.on("error",(error)=>{
        console.log("error",error)
        throw error
       })

       app.listen(process.env.PORT,()=>{
        console.log(`app is listening on ${process.env.PORT}`);
       })

    } catch (error) {
        console.error(error)
        throw error
    }
})()*/