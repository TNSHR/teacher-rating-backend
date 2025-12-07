const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },

  subjects: [
    {
      subject: { type: String, required: true },
      grade: { type: Number, required: true }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model("Teacher", teacherSchema);
