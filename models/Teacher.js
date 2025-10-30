const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
  name: String,
  subject: String,
  grade: { type: Number , required:true } // ✅ added this line
});

module.exports = mongoose.model("Teacher", teacherSchema);
