import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {User} from '../models/user.model.js'
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser=asyncHandler(async (req,res)=>{
    //get user details from frontend
    //validation format of every feild, or anything isn't empty
    //check if user already exists:username,email
    //check for images , check for avtar
    //upload them to cloudinary
    //create user object-create entry in db
    //remove password and refresh token feild from response
    //check for user creation 
    //return response

//1
    const {fullName,email,username,password}=req.body
    console.log("email",email)
//2
    if(
        [fullName,email,username,password].some((feilds)=>feilds?.trim()==="")
    ){
        throw new ApiError(400,"all feilds are required")
    }

//3
    const existedUser=User.findOne({
        $or:[{username},{email}]
    })
    if(existedUser){
        throw ApiError(409,"user with email or username already existed")
    }

//4
    const avaterLocalpath=req.files?.avatar[0]?.path;
    const coverimagelocalpath=req.files?.coverimage[0]?.path
    if(!avaterLocalpath){
        throw new ApiError(400,"avatar file is required")
    }

//5

    const avatar=await uploadOnCloudinary(avaterLocalpath)
    const coverImage=await uploadOnCloudinary(coverimagelocalpath)
    
    if(!avatar){
        throw new ApiError(400,"avatar is required")
    }


//6
    const user=await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()

    })
//7
    const createduser=await User.findById(user._id).select(
        "-password -refrenceToken"
    )


    if(!createduser){
        throw new ApiError(500,"something went wrong while registering the user")
    }
//8

    return res.status(201).json(
        new ApiResponse(200,createduser,"user registered successfully")
    )

})

export {registerUser}