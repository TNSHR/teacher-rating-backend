
const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Rating = require("../models/Rating");
const User = require("../models/User");
const Otp = require("../models/Otp");
const jwt = require("jsonwebtoken");
const { sendOTPEmail } = require("../emailService");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const upload = multer({ storage: multer.memoryStorage() });

/* ===============================
   🔹 RESTORE BACKUP ROUTE
================================= */
router.post("/restore", upload.single("backupFile"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    const backupData = JSON.parse(req.file.buffer.toString());

    await Promise.all([
      Student.deleteMany({}),
      Teacher.deleteMany({}),
      Rating.deleteMany({}),
    ]);

    await Promise.all([
      Student.insertMany(backupData.students || []),
      Teacher.insertMany(backupData.teachers || []),
      Rating.insertMany(backupData.ratings || []),
    ]);

    res.status(200).json({ message: "Data restored successfully" });
  } catch (err) {
    console.error("restore error:", err);
    res.status(500).json({ message: "Failed to restore backup" });
  }
});

/* ===============================
   🔹 STUDENT ROUTES
================================= */
router.get("/students", async (req, res) => {
  const { grade, uniqueCode } = req.query;
  try {
    let students;
    if (uniqueCode) {
      students = await Student.find({ uniqueCode: uniqueCode.toUpperCase() });
    } else if (grade) {
      students = await Student.find({ grade });
    } else {
      students = await Student.find();
    }
    res.json(students);
  } catch (err) {
    res.status(500).json({ message: "Error fetching students" });
  }
});

router.post("/students", async (req, res) => {
  try {
    const { name, grade, uniqueCode } = req.body;
    const code = uniqueCode || Math.random().toString(36).substring(2, 8).toUpperCase();
    const newStudent = new Student({ name, grade, uniqueCode: code });
    await newStudent.save();
    res.status(201).json(newStudent);
  } catch (err) {
    res.status(500).json({ message: "Error adding student" });
  }
});

router.put("/students/:id", async (req, res) => {
  try {
    const { name, grade, uniqueCode } = req.body;
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      { name, grade, uniqueCode },
      { new: true }
    );
    res.json(updatedStudent);
  } catch {
    res.status(500).json({ message: "Error updating student" });
  }
});

/* ===============================
   🔹 TEACHER ROUTES
================================= */
router.get("/teachers", async (req, res) => {
  try {
    const teachers = await Teacher.find();
    res.json(teachers);
  } catch {
    res.status(500).json({ message: "Error fetching teachers" });
  }
});

router.post("/teachers", async (req, res) => {
  try {
    const { name, subject } = req.body;
    const newTeacher = new Teacher({ name, subject });
    await newTeacher.save();
    res.status(201).json(newTeacher);
  } catch {
    res.status(500).json({ message: "Error adding teacher" });
  }
});

router.put("/teachers/:id", async (req, res) => {
  try {
    const { name, subject } = req.body;
    const updatedTeacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { name, subject },
      { new: true }
    );
    res.json(updatedTeacher);
  } catch {
    res.status(500).json({ message: "Error updating teacher" });
  }
});

/* ===============================
   🔹 RATING ROUTES
================================= */
router.get("/ratings", async (req, res) => {
  try {
    // ✅ populate studentId and teacherId to include actual names
    const ratings = await Rating.find().populate("studentId").populate("teacherId");
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/ratings", async (req, res) => {
  try {
    const { studentId, teacherId, rating, uniqueCode } = req.body;
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (student.uniqueCode !== uniqueCode)
      return res.status(403).json({ message: "Invalid student code. Rating denied." });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await Rating.findOne({ studentId, teacherId, date: { $gte: today } });
    if (existing) return res.status(400).json({ message: "Already rated today!" });

    const newRating = new Rating({ studentId, teacherId, rating });
    await newRating.save();
    res.json({ message: "Rating submitted!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ FIXED: populate student name in teachers-ratings
router.get("/teachers-ratings", async (req, res) => {
  try {
    const teachers = await Teacher.find();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await Promise.all(
      teachers.map(async (t) => {
        // ✅ populate studentId to include names
        const allRatings = await Rating.find({ teacherId: t._id }).populate("studentId");
        const todayRatings = await Rating.find({
          teacherId: t._id,
          date: { $gte: today },
        }).populate("studentId");

        const average =
          allRatings.length > 0
            ? allRatings.reduce((a, b) => a + b.rating, 0) / allRatings.length
            : 0;

        const todayAverage =
          todayRatings.length > 0
            ? todayRatings.reduce((a, b) => a + b.rating, 0) / todayRatings.length
            : 0;

        // ✅ Include actual student names instead of unknown
        const ratingsWithNames = allRatings.map((r) => ({
          studentName: r.studentId?.name || "Unknown Student",
          grade: r.studentId?.grade || "N/A",
          rating: r.rating,
        }));

        return {
          _id: t._id,
          name: t.name,
          subject: t.subject,
          average,
          todayAverage,
          ratings: ratingsWithNames,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error("Error fetching teacher ratings:", err);
    res.status(500).json({ message: "Error fetching teacher ratings" });
  }
});

/* ===============================
   🔹 AUTH & OTP ROUTES
================================= */
router.get("/users-count", async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.deleteMany({ email });
    const otpDoc = new Otp({ email, code: hashedOtp, expiresAt });
    await otpDoc.save();

    await sendOTPEmail(email, otp);
    res.json({ message: "OTP sent successfully" });
  } catch {
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

  try {
    const otpDoc = await Otp.findOne({ email });
    if (!otpDoc) return res.status(400).json({ message: "OTP not found" });
    if (otpDoc.expiresAt < new Date()) {
      await Otp.deleteOne({ email });
      return res.status(400).json({ message: "OTP expired" });
    }

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    if (hashedOtp !== otpDoc.code) return res.status(400).json({ message: "Invalid OTP" });

    await Otp.deleteOne({ email });
    res.json({ success: true, message: "OTP verified successfully" });
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(200).json({ message: "User already registered" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: email,
      email: email.toLowerCase(),
      password: hashedPassword,
      isAdmin: true,
    });

    await newUser.save();
    res.json({ message: "Registered successfully!" });
  } catch {
    res.status(500).json({ message: "Error registering user" });
  }
});

router.post("/reset-password", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and new password required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = password;
    await user.save();

    res.json({ message: "Password reset successfully" });
  } catch {
    res.status(500).json({ message: "Error resetting password" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email, isAdmin: user.isAdmin },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "1d" }
    );

    res.status(200).json({ token, isAdmin: user.isAdmin });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
});

/* ===============================
   🔹 ADMIN UTILITIES
================================= */
router.delete("/clearAll", async (req, res) => {
  try {
    // ✅ Get all ratings with teacher & student info
    const ratings = await Rating.find()
      .populate("teacherId", "name subject")
      .populate("studentId", "name grade");

    // ✅ Prepare Excel data (show real student names now)
    const backupData = ratings.map((rating) => ({
      "Teacher Name": rating.teacherId?.name || "Unknown Teacher",
      "Subject": rating.teacherId?.subject || "Unknown Subject",
      "Student Name": rating.studentId?.name || "Unknown Student", // ✅ original name restored
      "Grade": rating.studentId?.grade || "N/A",
      "Rating": rating.rating || "N/A",
      "Date": rating.date ? rating.date.toISOString().split("T")[0] : "N/A",
    }));

    // ✅ Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(backupData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ratings");

    // ✅ Generate Excel buffer
    const today = new Date().toISOString().split("T")[0];
    const fileName = `teacher_rating_${today}.xlsx`;
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    // ❌ DELETE ONLY RATINGS (keep students & teachers safe)
    await Rating.deleteMany({});

    // ✅ Send file as Excel attachment
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (err) {
    console.error("Error in /clearAll:", err);
    res.status(500).json({ message: "Failed to clear rating data" });
  }
});



router.get("/backup", async (req, res) => {
  try {
    const [students, teachers, ratings] = await Promise.all([
      Student.find(),
      Teacher.find(),
      Rating.find()
        .populate("teacherId", "name subject")
        .populate("studentId", "name grade"),
    ]);

    // ✅ Combine all data clearly in one sheet
    const backupData = ratings.map((rating) => ({
      "Teacher Name": rating.teacherId?.name || "Unknown Teacher",
      "Subject": rating.teacherId?.subject || "Unknown Subject",
      "Student Name": rating.studentId?.name || "Unknown Student",
      "Grade": rating.studentId?.grade || "N/A",
      "Rating": rating.rating || "N/A",
      "Date": rating.date ? rating.date.toISOString().split("T")[0] : "N/A",
    }));

    // ✅ Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(backupData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ratings");

    // ✅ Also add teacher and student data in separate sheets
    const teacherSheet = XLSX.utils.json_to_sheet(
      teachers.map((t) => ({
        "Teacher Name": t.name,
        "Subject": t.subject,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, teacherSheet, "Teachers");

    const studentSheet = XLSX.utils.json_to_sheet(
      students.map((s) => ({
        "Student Name": s.name,
        "Grade": s.grade,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, studentSheet, "Students");

    // ✅ Prepare Excel file
    const today = new Date().toISOString().split("T")[0];
    const fileName = `teacher_ratings_backup_${today}.xlsx`;
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

    // ✅ Send Excel for download
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (err) {
    console.error("Error in /backup:", err);
    res.status(500).json({ message: "Failed to create backup" });
  }
});


/* ===============================
   🔹 TEACHER USERS
================================= */
// ✅ Create Teacher User
router.post("/create-teacher-user", async (req, res) => {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Create linked user
    const newUser = new User({
      username,
      email,
      password,
      role: "teacher",
    });
    await newUser.save();

    res.json({ message: "Teacher user created successfully!", user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error creating teacher user" });
  }
});

// ✅ Fetch All Teacher Users
router.get("/teacher-users", async (req, res) => {
  try {
    const teachers = await User.find({ role: "teacher" }).select("-password");
    res.json(teachers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching teacher users" });
  }
});

// ✅ Delete Teacher User
router.delete("/delete-teacher-user/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting teacher user" });
  }
});


/* ===============================
   🔹 EXTRA UTILITIES
================================= */
router.get("/ratings/today/:studentId", async (req, res) => {
  const { studentId } = req.params;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  try {
    const ratings = await Rating.find({
      studentId,
      date: { $gte: today },
    });
    res.json(ratings);
  } catch {
    res.status(500).json({ message: "Failed to fetch today's ratings" });
  }
});

router.get("/all-users", auth, async (req, res) => {
  try {
    if (!req.user.isAdmin) return res.status(403).json({ message: "Access denied" });

    const users = await User.find({}, "_id name email grade subject");

    res.json(users);
  } catch {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

module.exports = router;

