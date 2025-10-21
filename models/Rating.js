const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
  rating: { type: Number, required: true,}  , // 1–5
  date: { type: Date, default: Date.now , }
});

module.exports = mongoose.model("Rating", ratingSchema);
