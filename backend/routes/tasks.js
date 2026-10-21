const router = require("express").Router();
const mongoose = require("mongoose");
const Task = require("../models/Task");
const Project = require("../models/Project");
const auth = require("../middleware/auth");

router.use(auth);

async function getMemberProject(projectId, userId) {
  if (!mongoose.isValidObjectId(projectId)) return null;

  return Project.findOne({
    _id: projectId,
    members: userId
  });
}

async function getTaskForMember(taskId, userId) {
  if (!mongoose.isValidObjectId(taskId)) return null;

  const task = await Task.findById(taskId);
  if (!task) return null;

  const project = await getMemberProject(task.project, userId);
  return project ? { task, project } : null;
}

// List tasks in a project
router.get("/project/:projectId", async (req, res) => {
  const project = await getMemberProject(req.params.projectId, req.user.id);

  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }

  const tasks = await Task.find({ project: project._id })
    .populate("assignedTo", "name email")
    .populate("createdBy", "name")
    .populate("comments.user", "name")
    .sort({ createdAt: -1 });

  res.json(tasks);
});

// Create a task
router.post("/", async (req, res) => {
  try {
    const { title, description = "", projectId, assignedTo,
      priority = "medium", dueDate } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({ message: "Task title is required" });
    }

    const project = await getMemberProject(projectId, req.user.id);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    if (!["low", "medium", "high"].includes(priority)) {
      return res.status(400).json({ message: "Invalid priority" });
    }

    let assignee = null;
    if (assignedTo) {
      if (!mongoose.isValidObjectId(assignedTo)) {
        return res.status(400).json({ message: "Invalid assignee" });
      }

      const isProjectMember = project.members.some(
        id => id.equals(assignedTo)
      );

      if (!isProjectMember) {
        return res.status(400).json({
          message: "Assignee must be a project member"
        });
      }
      assignee = assignedTo;
    }

    const task = await Task.create({
      title: title.trim(),
      description,
      project: project._id,
      createdBy: req.user.id,
      assignedTo: assignee,
      priority,
      dueDate: dueDate || null
    });

    const result = await Task.findById(task._id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name")
      .populate("comments.user", "name");

    const io = req.app.get("io");
    io.to(`project:${project._id}`).emit("task:created", result);

    res.status(201).json(result);
  } catch {
    res.status(500).json({ message: "Could not create task" });
  }
});

// Update task fields
router.patch("/:id", async (req, res) => {
  try {
    const found = await getTaskForMember(req.params.id, req.user.id);

    if (!found) {
      return res.status(404).json({ message: "Task not found" });
    }

    const { title, description, status, priority, assignedTo, dueDate } =
      req.body;
    const updates = {};

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({ message: "Title cannot be empty" });
      }
      updates.title = title.trim();
    }

    if (description !== undefined) updates.description = description;

    if (status !== undefined) {
      if (!["todo", "inprogress", "done"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      updates.status = status;
    }

    if (priority !== undefined) {
      if (!["low", "medium", "high"].includes(priority)) {
        return res.status(400).json({ message: "Invalid priority" });
      }
      updates.priority = priority;
    }

    if (assignedTo !== undefined) {
      if (assignedTo === null || assignedTo === "") {
        updates.assignedTo = null;
      } else {
        if (!mongoose.isValidObjectId(assignedTo) ||
            !found.project.members.some(id => id.equals(assignedTo))) {
          return res.status(400).json({
            message: "Assignee must be a project member"
          });
        }
        updates.assignedTo = assignedTo;
      }
    }

    if (dueDate !== undefined) {
      const parsed = dueDate ? new Date(dueDate) : null;
      if (parsed && Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid due date" });
      }
      updates.dueDate = parsed;
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate("assignedTo", "name email")
      .populate("createdBy", "name")
      .populate("comments.user", "name");

    const io = req.app.get("io");
    io.to(`project:${found.project._id}`).emit("task:updated", task);

    res.json(task);
  } catch {
    res.status(500).json({ message: "Could not update task" });
  }
});

// Add a comment
router.post("/:id/comments", async (req, res) => {
  try {
    const found = await getTaskForMember(req.params.id, req.user.id);
    if (!found) {
      return res.status(404).json({ message: "Task not found" });
    }

    const text = req.body.text?.trim();
    if (!text || text.length > 3000) {
      return res.status(400).json({
        message: "Comment must contain 1–3000 characters"
      });
    }

    found.task.comments.push({ user: req.user.id, text });
    await found.task.save();

    const task = await Task.findById(found.task._id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name")
      .populate("comments.user", "name");

    const io = req.app.get("io");
    io.to(`project:${found.project._id}`).emit("task:updated", task);
    io.to(`project:${found.project._id}`).emit("comment:added", {
      taskId: task._id,
      comment: task.comments[task.comments.length - 1]
    });

    res.status(201).json(task);
  } catch {
    res.status(500).json({ message: "Could not add comment" });
  }
});

// Delete a task (creator or project owner)
router.delete("/:id", async (req, res) => {
  const found = await getTaskForMember(req.params.id, req.user.id);

  if (!found) {
    return res.status(404).json({ message: "Task not found" });
  }

  const isOwner = found.project.owner.equals(req.user.id);
  const isCreator = found.task.createdBy.equals(req.user.id);

  if (!isOwner && !isCreator) {
    return res.status(403).json({ message: "Not permitted to delete task" });
  }

  await found.task.deleteOne();

  req.app.get("io").to(`project:${found.project._id}`).emit("task:deleted", {
    taskId: req.params.id
  });

  res.json({ message: "Task deleted" });
});

module.exports = router;