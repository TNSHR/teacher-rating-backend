const mongoose = require("mongoose");
const Student = require("./models/Student");
const Teacher = require("./models/Teacher");

mongoose.connect("mongodb+srv://teacherAdmin:o5stziY12XPkJ6b4@teacherratingdb.kwk6t03.mongodb.net/TeacherRatingDB")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

async function seed() {
  await Student.deleteMany({});
  await Teacher.deleteMany({});

  const students = [];
  for (let grade = 1; grade <= 10; grade++) {
    for (let i = 1; i <= 10; i++) {
      students.push({ name: `Student${grade}${i}`, grade: grade });
    }
  }
  await Student.insertMany(students);

  const teachers = [];
  for (let i = 1; i <= 15; i++) {
    teachers.push({ name: `Teacher${i}`, subject: `Subject${i}` });
  }
  await Teacher.insertMany(teachers);

  console.log("Seed completed");
  mongoose.connection.close();
}

seed();
