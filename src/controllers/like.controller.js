import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // Check if the like already exists
    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: req.user._id
    });

    if (existingLike) {
        // Unlike (delete the like)
        await existingLike.deleteOne();
        return res.status(200).json(
            new ApiResponse(200, {}, "Video unliked successfully")
        );
    }

    // Otherwise, create a new like
    const newLike = await Like.create({
        video: videoId,
        likedBy: req.user._id
    });

    return res.status(200).json(
        new ApiResponse(200, newLike, "Video liked successfully")
    );
});


const getLikedVideos = asyncHandler(async (req, res) => {
    const likedVideos = await Like.find({
        likedBy: req.user._id,
        video: { $exists: true }   // Only likes on videos, not comments
    })
    .populate({
        path: "video",
        populate: {
            path: "owner",
            select: "username fullName avatar"
        }
    });

    return res.status(200).json(
        new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
    );
});



export {
   
  
    toggleVideoLike,
    getLikedVideos
}