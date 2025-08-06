import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!channelId || !isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel id");
    }

    // Check if subscription exists
    const existing = await Subscription.findOne({
        channel: channelId,
        subscriber: req.user._id
    });

    if (existing) {
        await existing.deleteOne();
        return res.status(200).json(
            new ApiResponse(200, {}, "Subscription removed successfully")
        );
    }

    // If not subscribed, create a new subscription
    const newSubscription = await Subscription.create({
        channel: channelId,
        subscriber: req.user._id
    });

    return res.status(200).json(
        new ApiResponse(200, newSubscription, "Subscription added successfully")
    );
});


// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    if (!channelId || !isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel id");
    }

    // Find subscriptions for this channel
    const subscribers = await Subscription.find({
        channel: channelId
    });

    // ✅ Map correct subscriber IDs (users, not subscription docs)
    const subscriberIds = subscribers.map(sub => sub.subscriber);

    // ✅ Aggregate to populate subscriber details
    const populated = await Subscription.aggregate([
        {
            $match: { subscriber: { $in: subscriberIds } } // ✅ Correct field for match
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: 1,
                            fullName: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: { subscriber: { $first: "$subscriber" } } // ✅ Flatten the array
        },
        {
            $project: { _id: 0, subscriber: 1 } // ✅ Return only subscriber info
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, populated, "subscribers fetched")
    );

});


// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    if (!subscriberId || !isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber id");
    }

    // ✅ Directly aggregate without an unnecessary initial find
    const populated = await Subscription.aggregate([
        {
            $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) } // Match subscriptions for the user
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",        // Channel user ID in subscription
                foreignField: "_id",          // Match with _id in User collection
                as: "channels",               // Array of matched channel documents
                pipeline: [
                    {
                        $project: {           // Only include needed fields
                            username: 1,
                            avatar: 1,
                            fullName: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields: { channels: { $first: "$channels" } } // Flatten channels array
        },
        {
            $project: { _id: 0, channels: 1 } // Only return the populated channels
        }
    ]);

    return res.status(200).json(
        new ApiResponse(200, populated, "Channels fetched successfully")
    );
});


export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}