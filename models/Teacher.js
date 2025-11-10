const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  grades: {
    type: [Number], // teacher can handle multiple grades
    required: true,
    validate: {
      validator: (arr) => arr.length > 0,
      message: "At least one grade is required."
    }
  }
});

module.exports = mongoose.model("Teacher", teacherSchema);
