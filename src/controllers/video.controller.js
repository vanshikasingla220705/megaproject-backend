import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy = "createdAt", sortType = "desc", userId } = req.query;

    // Build the aggregation pipeline
    const pipeline = [];

    // 1. Filter by userId (videos uploaded by a specific user)
    if (userId && isValidObjectId(userId)) {
        pipeline.push({
            $match: { owner: new mongoose.Types.ObjectId(userId) }
        });
    }

    // 2. Search filter for title/description
    if (query) {
        pipeline.push({
            $match: {
                $or: [
                    { title: { $regex: query, $options: "i" } },       // case-insensitive search
                    { description: { $regex: query, $options: "i" } }
                ]
            }
        });
    }

    // 3. Only include published videos (optional, if you only want public videos)
    pipeline.push({
        $match: { isPublished: true }
    });

    // 4. Lookup owner details
    pipeline.push({
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "owner",
            pipeline: [
                { $project: { fullName: 1, username: 1, avatar: 1 } }
            ]
        }
    });

    // 5. Flatten owner array
    pipeline.push({
        $addFields: {
            owner: { $first: "$owner" }
        }
    });

    // 6. Sorting
    const sortOrder = sortType === "asc" ? 1 : -1;
    pipeline.push({
        $sort: { [sortBy]: sortOrder }
    });

    // 7. Pagination using aggregatePaginate
    const options = {
        page: parseInt(page),
        limit: parseInt(limit)
    };

    const videos = await Video.aggregatePaginate(Video.aggregate(pipeline), options);

    return res.status(200).json(
        new ApiResponse(200, videos, "Videos fetched successfully")
    );
});



const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    // 1️⃣ Validate fields
    if ([title, description].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    // 2️⃣ Check and upload video
    const videoLocalPath = req.files?.videoFile?.[0]?.path;
    if (!videoLocalPath) {
        throw new ApiError(400, "Video file is missing");
    }

    const video = await uploadOnCloudinary(videoLocalPath);
    if (!video?.url) {
        throw new ApiError(400, "Error while uploading video");
    }

    // 3️⃣ Check and upload thumbnail
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file is missing");
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnail?.url) {
        throw new ApiError(400, "Error while uploading thumbnail");
    }

    // 4️⃣ Save video details to DB
    const newVideo = await Video.create({
        videoFile: video.url,
        thumbnail: thumbnail.url,
        title,
        description,
        duration: video.duration || 0,  // If Cloudinary returns duration
        owner: req.user._id,            // Logged-in user from verifyJWT middleware
    });

    // 5️⃣ Return response
    return res.status(201).json(
        new ApiResponse(201, newVideo, "Video published successfully")
    );
});



const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // 1️⃣ Validate ObjectId
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // 2️⃣ Find video and populate owner info
    const video = await Video.findById(videoId)
        .populate("owner", "fullName username avatar")
        .exec();

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // 3️⃣ Optional: Increment view count when a user watches
    video.views += 1;
    await video.save({ validateBeforeSave: false });

    // 4️⃣ Send response
    return res.status(200).json(
        new ApiResponse(200, video, "Video fetched successfully")
    );
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    // Prepare update object dynamically
    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;

    // If video file provided, upload and update
    const videoLocalPath = req.files?.videoFile?.[0]?.path;
    if (videoLocalPath) {
        const videoUpload = await uploadOnCloudinary(videoLocalPath);
        if (!videoUpload?.url) {
            throw new ApiError(400, "Error while uploading video");
        }
        updateData.videoFile = videoUpload.url;
    }

    // If thumbnail provided, upload and update
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;
    if (thumbnailLocalPath) {
        const thumbnailUpload = await uploadOnCloudinary(thumbnailLocalPath);
        if (!thumbnailUpload?.url) {
            throw new ApiError(400, "Error while uploading thumbnail");
        }
        updateData.thumbnail = thumbnailUpload.url;
    }

    const video = await Video.findByIdAndUpdate(videoId, { $set: updateData }, { new: true });

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    return res.status(200).json(new ApiResponse(200, video, "Video details updated successfully"));
});


const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // 1. Validate videoId
    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // 2. Find the video
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // 3. Optional: Check if the logged-in user is the owner
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video");
    }

    // 4. Delete video from DB
    await Video.findByIdAndDelete(videoId);

    // 5. Optional: Delete from Cloudinary if required
    // await deleteFromCloudinary(video.videoFile);
    // await deleteFromCloudinary(video.thumbnail);

    return res.status(200).json(
        new ApiResponse(200, {}, "Video deleted successfully")
    );
});


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // 1. Validate the videoId
    if (!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // 2. Find the video
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // 3. Optional: Ensure the logged-in user is the owner of the video
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to change this video's publish status");
    }

    // 4. Toggle the publish status
    video.isPublished = !video.isPublished;
    await video.save({ validateBeforeSave: false });

    // 5. Respond with updated status
    return res.status(200).json(
        new ApiResponse(200, video, `Video ${video.isPublished ? "published" : "unpublished"} successfully`)
    );
});


export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}