const express = require("express");
const router = express.Router();
const auth = require('../middleware/auth');
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Rating = require("../models/Rating");
const User = require('../models/User');
const Otp = require('../models/Otp'); // Make sure Otp model exists
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../emailService');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');


// ================= STUDENTS ROUTES =================

// GET all students

// Backend example (Express + Mongoose)
router.get("/students", async (req, res) => {
  const { grade } = req.query;
  try {
    const students = await Student.find({ grade: grade }); // filter by grade
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching students" });
  }
});




// POST new student
router.post("/students", async (req, res) => {
  try {
    const { name, grade } = req.body;
    const newStudent = new Student({ name, grade });
    await newStudent.save();
    res.status(201).json(newStudent);
  } catch (err) {
    res.status(500).json({ message: "Error adding student" });
  }
});

// PUT update student
router.put("/students/:id", async (req, res) => {
  try {
    const { name, grade } = req.body;
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      { name, grade },
      { new: true }
    );
    res.json(updatedStudent);
  } catch (err) {
    res.status(500).json({ message: "Error updating student" });
  }
});


// ================= TEACHERS ROUTES =================
// GET all teachers
router.get("/teachers", async (req, res) => {
  try {
    const teachers = await Teacher.find();
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: "Error fetching teachers" });
  }
});

// POST new teacher
router.post("/teachers", async (req, res) => {
  try {
    const { name, subject } = req.body;
    const newTeacher = new Teacher({ name, subject });
    await newTeacher.save();
    res.status(201).json(newTeacher);
  } catch (err) {
    res.status(500).json({ message: "Error adding teacher" });
  }
});

// PUT update teacher
router.put("/teachers/:id", async (req, res) => {
  try {
    const { name, subject } = req.body;
    const updatedTeacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { name, subject },
      { new: true }
    );
    res.json(updatedTeacher);
  } catch (err) {
    res.status(500).json({ message: "Error updating teacher" });
  }
});


// ================= RATINGS ROUTES =================
router.get("/ratings", async (req, res) => {
  try {
    const ratings = await Rating.find();
    res.json(ratings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post("/ratings", async (req, res) => {
  const { studentId, teacherId, rating } = req.body;
  try {
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
// GET all teachers with average and today's ratings
router.get("/teachers-ratings", async (req, res) => {
  try {
    const teachers = await Teacher.find();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await Promise.all(
      teachers.map(async (t) => {
        const allRatings = await Rating.find({ teacherId: t._id });
        const todayRatings = await Rating.find({
          teacherId: t._id,
          date: { $gte: today },
        });

        const average =
          allRatings.length > 0
            ? allRatings.reduce((a, b) => a + b.rating, 0) / allRatings.length
            : 0;

        const todayAverage =
          todayRatings.length > 0
            ? todayRatings.reduce((a, b) => a + b.rating, 0) /
              todayRatings.length
            : 0;

        return {
          _id: t._id,
          name: t.name,
          subject: t.subject,
          average,
          todayAverage,
          ratings: allRatings,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error("Error fetching teacher ratings:", err);
    res.status(500).json({ message: "Error fetching teacher ratings" });
  }
});


// ================= AUTH & OTP ROUTES =================
router.get('/users-count', async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /send-otp -> generate and send OTP
router.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP before storing
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry

    // Remove any previous OTPs for this email
    await Otp.deleteMany({ email });

    // Save OTP in DB
    const otpDoc = new Otp({ email, code: hashedOtp, expiresAt });
    await otpDoc.save();

    // Send OTP email
    await sendOTPEmail(email, otp);

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("send-otp error:", err);
    res.status(500).json({ message: "Failed to send OTP. Check server logs." });
  }
});

// ✅ NEW: POST /verify-otp -> verify OTP
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

  try {
    const otpDoc = await Otp.findOne({ email });
    if (!otpDoc) return res.status(400).json({ message: "OTP not found. Request a new one." });

    // Check expiry
    if (otpDoc.expiresAt < new Date()) {
      await Otp.deleteOne({ email });
      return res.status(400).json({ message: "OTP expired. Request a new one." });
    }

    // Compare hashed OTP
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");
    if (hashedOtp !== otpDoc.code) return res.status(400).json({ message: "Invalid OTP" });

    // OTP verified, remove from DB
    await Otp.deleteOne({ email });

    res.json({ success: true, message: "OTP verified successfully" });
  } catch (err) {
    console.error("verify-otp error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});
// REGISTER
router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(200).json({ message: "User already registered" });
    }

    // ✅ Hash password properly
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username: email,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    await newUser.save();

    res.json({ message: "Registered successfully!" });
  } catch (err) {
    console.error("register error:", err);
    res.status(500).json({ message: "Error registering user" });
  }
});


// RESET PASSWORD
router.post("/reset-password", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and new password required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Assign new password directly (it will be hashed by pre-save)
    user.password = password;
    await user.save(); // ✅ pre('save') will hash it once

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error resetting password" });
  }
});

// LOGIN


router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "1d" }
    );

    res.status(200).json({ token, isAdmin: false }); // ✅ token must be sent
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});




// ================= ADMIN UTILITIES =================
// 🔹 Clear all data and download backup automatically
router.delete("/clearAll", async (req, res) => {
  try {
    // Backup data before deleting
    const [students, teachers, ratings] = await Promise.all([
      Student.find(),
      Teacher.find(),
      Rating.find(),
    ]);

    const backup = { students, teachers, ratings };

    // Delete all collections
    await Promise.all([
      Student.deleteMany({}),
      Teacher.deleteMany({}),
      Rating.deleteMany({}),
    ]);

    // Send backup as JSON file for automatic download
    res.setHeader("Content-Disposition", "attachment; filename=backup.json");
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error("clearAll error:", err);
    res.status(500).json({ message: "Failed to clear data" });
  }
});

// 🔹 Separate endpoint if user clicks "Download Backup" manually
router.get("/backup", async (req, res) => {
  try {
    const [students, teachers, ratings] = await Promise.all([
      Student.find(),
      Teacher.find(),
      Rating.find(),
    ]);

    const backup = { students, teachers, ratings };

    res.setHeader("Content-Disposition", "attachment; filename=backup.json");
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error("backup error:", err);
    res.status(500).json({ message: "Failed to create backup" });
  }
});
// ================= ADMIN UTILITIES =================
router.delete("/clearAll", async (req, res) => {
  try {
    // Fetch all collections before deleting
    const [students, teachers, ratings] = await Promise.all([
      Student.find(),
      Teacher.find(),
      Rating.find(),
    ]);

    // Create backup object
    const backup = { students, teachers, ratings };

    // Format file name with date (e.g., teacher_ratings_backup_2025-10-19.json)
    const today = new Date().toISOString().split("T")[0];
    const fileName = `teacher_ratings_backup_${today}.json`;

    // Delete everything
    await Promise.all([
      Student.deleteMany({}),
      Teacher.deleteMany({}),
      Rating.deleteMany({}),
    ]);

    // Send backup file for download
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error("clearAll error:", err);
    res.status(500).json({ message: "Failed to clear data" });
  }
});

router.get("/backup", async (req, res) => {
  try {
    const [students, teachers, ratings] = await Promise.all([
      Student.find(),
      Teacher.find(),
      Rating.find(),
    ]);

    const backup = { students, teachers, ratings };

    const today = new Date().toISOString().split("T")[0];
    const fileName = `teacher_ratings_backup_${today}.json`;

    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify(backup, null, 2));
  } catch (err) {
    console.error("backup error:", err);
    res.status(500).json({ message: "Failed to create backup" });
  }
});
// POST create teacher login
router.post("/create-teacher-user", async (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email)
    return res.status(400).json({ message: "Username, password and email required" });

  try {
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing)
      return res.status(400).json({ message: "Username or Email already exists" });

    const user = new User({ username, password, email }); // password will be hashed automatically
    await user.save();
    res.json({ message: "Teacher user created successfully!" });
  } catch (err) {
    console.error("Create Teacher User Error:", err);
    res.status(500).json({ message: "Failed to create teacher user" });
  }
});
// GET all teacher users
router.get("/teacher-users", async (req, res) => {
  try {
    const users = await User.find({ isAdmin: false });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch teacher users" });
  }
});

// DELETE a teacher user
router.delete("/delete-teacher-user/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete teacher user" });
  }
});
// ✅ GET today's ratings for a student
router.get("/ratings/today/:studentId", async (req, res) => {
  const { studentId } = req.params;
  const today = new Date();
  today.setHours(0, 0, 0, 0); // start of today

  try {
    const ratings = await Rating.find({
      studentId,
      date: { $gte: today }
    });

    res.json(ratings); // send array (could be empty)
  } catch (err) {
    console.error("Error fetching today's ratings for student:", err);
    res.status(500).json({ message: "Failed to fetch today's ratings" });
  }
});











module.exports = router;
