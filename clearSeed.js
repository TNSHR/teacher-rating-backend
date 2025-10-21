const mongoose = require("mongoose");
const Student = require("./models/Student");
const Teacher = require("./models/Teacher");
const Rating = require("./models/Rating");

// Replace with your actual connection string
const mongoURI = "mongodb+srv://teacherAdmin:o5stziY12XPkJ6b4@teacherratingdb.kwk6t03.mongodb.net/TeacherRatingDB";

mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

async function clearData() {
  try {
    await Student.deleteMany({});
    await Teacher.deleteMany({});
    await Rating.deleteMany({});
    console.log("All previous seed data cleared!");
    mongoose.connection.close();
  } catch (err) {
    console.log(err);
  }
}

clearData();
