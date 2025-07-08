import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {User} from '../models/user.model.js'
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";


const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user= await User.findById(userId)
        const accessToken=user.generateAccessToken()
        const refreshToken=user.generateRefreshToken()

        user.refreshToken=refreshToken
        await user.save({validateBeforeSave:false})
        return {refreshToken,accessToken}

    } catch (error) {
        throw new ApiError(500, "something went wrong while generaqting refresh and access token")
    }
}


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
    //console.log("email",email)
//2
    if(
        [fullName,email,username,password].some((feilds)=>feilds?.trim()==="")
    ){
        throw new ApiError(400,"all feilds are required")
    }

//3
    const existedUser=await User.findOne({
        $or:[{username},{email}]
    })
    if(existedUser){
        throw ApiError(409,"user with email or username already existed")
    }

//4
//console.log (req.files)
    const avatarLocalpath=req.files?.avatar[0]?.path
    //const coverimagelocalpath=req.files?.coverimage[0]?.path

    let coverimagelocalpath;
    if(req.files && Array.isArray(req.files.coverimage) && req.files.coverimage.length>0){
        coverimagelocalpath=req.files.coverimage[0].path
    }

    if(!avatarLocalpath){
        throw new ApiError(400,"avatar file is required")
    }

//5

    const avatar1=await uploadOnCloudinary(avatarLocalpath)
    const coverImage=await uploadOnCloudinary(coverimagelocalpath)
    
    if(!avatar1){
        throw new ApiError(400,"avatar is required")
    }


//6
    const user=await User.create({
        fullName,
        avatar:avatar1.url,
        coverimage:coverImage?.url || "",
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

const loginUser=asyncHandler(async(req,res)=>{
    //req body data
    //username /email
    //find the user
    //password check
    //access and refresh token
    //send cookies

    const {email, username,password}=req.body

    if(!username && !email){
        throw new ApiError(400, " username or email is required")
    }

    const user=await User.findOne({$or :[{username},{email}]})

    if(!user){
        throw new ApiError(404,"user doesn't exist")
    }

    const isPasswordValid=await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401,"invalid user credentials")
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)

    const loggedInUser=await User.findById(user._id).select("-password -refreshToken")

    const options={
        httpOnly:true,
        secure:true
    }//by default any one can modify the cookie so after doing this step no one can modify them in frontendand
    //are only modifyable by server


    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,accessToken,refreshToken
            },//when user want to save the tokens by himself or want to store in localstorage
            "user logged in successfully"


        )
    )

})


const logoutUser=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )

    const options={
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"user logged out "))
})


const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorised request")
    }

    try {
        const decodedToken=jwt.verify(incomingRefreshToken,process.env.ACCESS_TOKEN_SECRET)
    
        const user=await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"invalid refresh token")
        }
    
        if(incomingRefreshToken !==user?.refreshToken){
            throw new ApiError(401, "refresh token is expired or used")
        }
    
        const options={
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newrefreshToken}=await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(
                200,
                {accessToken,refreshToken:newrefreshToken},
                "Access token refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "invalid refresh token")
    }
})


const changeCurrentPassword=asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword}=req.body
    
    const user=await User.findById(req.user?._id)
    const isPasswordCorrect=await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"invalid old password")
    }
    user.password=newPassword
    await user.save({validateBeforeSave:false})

    res.status(200)
    .json(new ApiResponse(200,{},"password changed successfully"))
})


const getCurrentUser=asyncHandler(async(req,res)=>{
    return res.status(200)
    .json(200,req.user,"current user fetched successfully")
})


const updateAccountDetails=asyncHandler(async(req,res)=>{
    const {fullName,email}=req.body

    if(!fullName || !email){
        throw new ApiError(400,"all feilds are required")
    }

    const user=User.findByIdAndUpdate(req.user?._id,{
        $set:{
            fullName:fullName,
            email:email
        }
    },{new:true}).select("-password")

    return res.status(200)
    .json(new ApiResponse(200,user,"account details updated successfully"))
})



const updateUserAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"avatar file missing")
    }

    const avatar=await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"error while uploading on avatar")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {$set:{
            avatar:avatar.url
        }},
        {new:true}
    ).select("-password")
    return res.status(200)
    .json(
        new ApiResponse(200,user,"avatar updated ")
    )
})


const updateUserCoverImage=asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"cover image file missing")
    }

    const coverImage=await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"error while uploading on coverImage")
    }

    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {$set:{
            avatar:coverImage.url
        }},
        {new:true}
    ).select("-password")
    return res.status(200)
    .json(
        new ApiResponse(200,user,"coverimage updated ")
    )
})


export {registerUser, loginUser,logoutUser,refreshAccessToken,changeCurrentPassword,getCurrentUser,updateAccountDetails,updateUserAvatar,updateUserCoverImage}