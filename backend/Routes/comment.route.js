import express from 'express';
import Comment from '../models/comment.model.js';
import { protect } from '../middleware/auth.js';
import mongoose from 'mongoose';

const router = express.Router();

// POST a comment to a post
router.post('/:postId', protect, async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ message: 'Comment text is required' });
  }

  try {
    // Validate postId as a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.postId)) {
      return res.status(400).json({ message: 'Invalid postId format' });
    }

    const comment = await Comment.create({
      postId: req.params.postId,
      userId: req.user._id,
      text,
    });

    res.status(201).json({ message: 'Comment added successfully', comment });
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({ message: 'Server error posting comment' });
  }
});

// POST a reply to a comment
router.post('/comments/reply', protect, async (req, res) => {
  const { text, parentCommentId, postId } = req.body;
  
  console.log("Received data for reply:", { text, parentCommentId, postId });

  if (!text || !parentCommentId || !postId) {
    return res.status(400).json({ message: 'Text, parent comment ID, and post ID are required' });
  }

  // Validate ObjectIds
  try {
    // Validate postId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: 'Invalid postId format' });
    }
    
    // Validate parentCommentId
    if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
      return res.status(400).json({ message: 'Invalid parentCommentId format' });
    }

    // Check if the parent comment exists
    const parentComment = await Comment.findById(parentCommentId);
    if (!parentComment) {
      console.log("Parent comment not found:", parentCommentId);
      return res.status(404).json({ message: 'Parent comment not found' });
    }

    console.log("Parent comment found:", parentComment);
    
    // Create the reply (which will reference the parent comment)
    const reply = await Comment.create({
      postId: postId,
      userId: req.user._id,
      text,
      parentCommentId,
    });

    res.status(201).json({ message: 'Reply added successfully', reply });
  } catch (error) {
    console.error('Error posting reply:', error);
    res.status(500).json({ message: 'Server error posting reply', error: error.message });
  }
});

// DELETE a comment and all its replies
router.delete('/:commentId', protect, async (req, res) => {
  try {
    const commentId = req.params.commentId;
    
    // Validate commentId as a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      return res.status(400).json({ message: 'Invalid commentId format' });
    }
    
    // Find the comment
    const comment = await Comment.findById(commentId);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if the user is authorized to delete this comment
    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    
    // If it's a parent comment, delete all replies first
    if (!comment.parentCommentId) {
      await Comment.deleteMany({ parentCommentId: commentId });
      console.log(`Deleted all replies to comment: ${commentId}`);
    }
    
    // Delete the comment itself
    await Comment.findByIdAndDelete(commentId);
    
    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Server error deleting comment', error: error.message });
  }
});

// GET all comments for a post with their replies
router.get('/:postId', async (req, res) => {
  try {
    // Validate postId as a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.postId)) {
      return res.status(400).json({ message: 'Invalid postId format' });
    }
    
    // Fetch top-level comments - include removed comments
    const comments = await Comment.find({ 
      postId: req.params.postId, 
      parentCommentId: null // Fetch top-level comments
    })
      .populate('userId', 'email profilePic') // Populate user's email and profile pic
      .sort({ createdAt: -1 }); // Latest comments first

    // For each main comment, fetch its replies - including removed ones
    for (let comment of comments) {
      // Create a replies array if it doesn't exist
      if (!comment._doc) {
        comment._doc = {...comment._doc};
      }
      
      comment._doc.replies = await Comment.find({ parentCommentId: comment._id })
        .populate('userId', 'email profilePic')
        .sort({ createdAt: 1 }); // Oldest replies first
    }

    res.json(comments); // Return comments and their replies
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Error fetching comments', error: error.message });
  }
});

// DELETE a comment
router.delete('/:commentId', protect, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this comment' });
    }

    await Comment.deleteById(req.params.commentId);
    
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Error deleting comment' });
  }
});

export default router;