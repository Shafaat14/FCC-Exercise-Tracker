const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose
  .connect(process.env.DB_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Database connection error:", err));

// Middleware
app.use(cors());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Models
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
});

const ExerciseSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now },
});

const User = mongoose.model("User", UserSchema);
const Exercise = mongoose.model("Exercise", ExerciseSchema);

// Routes
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find({}, "_id username");
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Unable to fetch users" });
  }
});

// Create a new user
app.post("/api/users", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ error: "Username is required" });
    }
    const newUser = new User({ username });
    const savedUser = await newUser.save();
    res.json({ _id: savedUser._id, username: savedUser.username });
  } catch (err) {
    res.status(500).json({ error: "Error creating user" });
  }
});

// Add an exercise to a user
app.post("/api/users/:_id/exercises", async (req, res) => {
  try {
    const { _id } = req.params;
    const { description, duration, date } = req.body;

    if (!description || !duration) {
      return res.status(400).json({ error: "Description and duration are required" });
    }

    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const newExercise = new Exercise({
      user_id: user._id,
      description,
      duration: parseInt(duration),
      date: date ? new Date(date) : new Date(),
    });

    const savedExercise = await newExercise.save();
    res.json({
      _id: user._id,
      username: user.username,
      description: savedExercise.description,
      duration: savedExercise.duration,
      date: savedExercise.date.toDateString(),
    });
  } catch (err) {
    res.status(500).json({ error: "Error saving exercise" });
  }
});

// Get exercise logs for a user
app.get("/api/users/:_id/logs", async (req, res) => {
  try {
    const { _id } = req.params;
    const { from, to, limit } = req.query;

    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const filter = { user_id: _id };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const exercises = await Exercise.find(filter)
      .limit(parseInt(limit) || 500)
      .select("description duration date");

    const log = exercises.map((e) => ({
      description: e.description,
      duration: e.duration,
      date: e.date.toDateString(),
    }));

    res.json({
      username: user.username,
      _id: user._id,
      count: exercises.length,
      log,
    });
  } catch (err) {
    res.status(500).json({ error: "Error fetching logs" });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
