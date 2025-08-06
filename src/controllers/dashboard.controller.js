import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getChannelStats = asyncHandler(async (req, res) => {
    const userId = req.user?._id; // Logged-in user (channel owner)

    if (!userId) {
        throw new ApiError(401, "Unauthorized - Please log in");
    }

    // 1. Total videos and total views
    const videos = await Video.find({ owner: userId });
    const totalVideos = videos.length;
    const totalViews = videos.reduce((acc, video) => acc + (video.views || 0), 0);

    // 2. Total subscribers
    const totalSubscribers = await Subscription.countDocuments({ channel: userId });

    // 3. Total likes (across all videos)
    const videoIds = videos.map(video => video._id);
    const totalLikes = await Like.countDocuments({ video: { $in: videoIds } });

    return res.status(200).json(
        new ApiResponse(200, {
            totalVideos,
            totalViews,
            totalSubscribers,
            totalLikes
        }, "Channel stats fetched successfully")
    );
});


const getChannelVideos = asyncHandler(async (req, res) => {
    const userId = req.user?._id; // Current logged-in user
    if (!userId) {
        throw new ApiError(401, "Unauthorized - Please log in");
    }

    const videos = await Video.find({ owner: userId })
        .sort({ createdAt: -1 })   // Latest first
        .populate("owner", "username fullName avatar") // Populate owner details
        .exec();

    return res.status(200).json(
        new ApiResponse(200, videos, "Channel videos fetched successfully")
    );
});


export {
    getChannelStats, 
    getChannelVideos
    }