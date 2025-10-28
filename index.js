const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const routes = require("./routes/index.js");
require("dotenv").config();
const mongoose = require("mongoose");

const app = express();

// ✅ Allow only your Netlify frontend domain
app.use(
  cors({
    origin: ["https://studentsfeedbackportal.netlify.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    optionsSuccessStatus: 200, // ✅ fixes CORS preflight for some browsers
  })
);

app.options("*", cors());
app.use(bodyParser.json());

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() =>
    console.log("MongoDB connected", mongoose.connection.name)
  )
  .catch((err) => console.log(err));

// ✅ Ensure JSON parsing happens before routes
app.use(express.json());

// ✅ Use routes
app.use("/", routes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
