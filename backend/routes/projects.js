const router = require("express").Router();
const Project = require("../models/Project");
const User = require("../models/User");
const Task = require("../models/Task");
const auth = require("../middleware/auth");

router.use(auth);

async function isMember(projectId, userId) {
  return Project.exists({
    _id: projectId,
    members: userId
  });
}

// Create a project
router.post("/", async (req, res) => {
  try {
    const { name, description = "" } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Project name is required" });
    }

    const project = await Project.create({
      name: name.trim(),
      description,
      owner: req.user.id,
      members: [req.user.id]
    });

    res.status(201).json(project);
  } catch {
    res.status(500).json({ message: "Could not create project" });
  }
});

// List the current user's projects
router.get("/", async (req, res) => {
  const projects = await Project.find({ members: req.user.id })
    .populate("owner", "name email")
    .populate("members", "name email")
    .sort({ updatedAt: -1 });

  res.json(projects);
});

// Add a project member by email
router.post("/:id/members", async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.user.id
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found or you are not its owner"
      });
    }

    const email = req.body.email?.trim().toLowerCase();
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "Register the user before inviting them"
      });
    }

    if (!project.members.some(id => id.equals(user._id))) {
      project.members.push(user._id);
      await project.save();
    }

    const populated = await project.populate("members", "name email");
    res.json(populated);
  } catch {
    res.status(500).json({ message: "Could not add member" });
  }
});

// Delete a project and its tasks (owner only)
router.delete("/:id", async (req, res) => {
  const project = await Project.findOne({
    _id: req.params.id,
    owner: req.user.id
  });

  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  await Task.deleteMany({ project: project._id });
  await project.deleteOne();

  res.json({ message: "Project deleted" });
});

module.exports = router;