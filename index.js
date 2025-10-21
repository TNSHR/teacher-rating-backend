const express = require("express");

const cors = require("cors");
const bodyParser = require("body-parser");
const routes = require("./routes/index.js"); // import routes
require('dotenv').config();
const mongoose = require("mongoose");




const app = express();
app.use(cors());
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})

  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// Use routes

app.use(express.json());
app.use('/', routes);
//app.use('/', authRoutes);

app.listen(5000, () => console.log("Server running on port 5000"));
