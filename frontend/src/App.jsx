import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API = "http://localhost:5000/api";
const SOCKET = "http://localhost:5000";

async function request(path, token, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

const columns = [
  { id: "todo", label: "To Do" },
  { id: "inprogress", label: "In Progress" },
  { id: "done", label: "Done" }
];

export default function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("token") || ""
  );
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "", email: "", password: ""
  });
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [projectName, setProjectName] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [inviteEmail, setInviteEmail] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [openTask, setOpenTask] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const socketRef = useRef(null);

  const activeProject = projects.find(p => p._id === projectId);

  const logout = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    sessionStorage.removeItem("token");
    setToken("");
    setUser(null);
    setProjects([]);
    setProjectId("");
    setTasks([]);
    setMembers([]);
  }, []);

  const refreshProjects = useCallback(async () => {
    const data = await request("/projects", token);
    setProjects(data);
    setProjectId(current =>
      data.some(p => p._id === current) ? current : data[0]?._id || ""
    );
  }, [token]);

  const refreshTasks = useCallback(async () => {
    if (!projectId) {
      setTasks([]);
      return;
    }

    const data = await request(`/tasks/project/${projectId}`, token);
    setTasks(data);
  }, [token, projectId]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    Promise.all([
      request("/auth/me", token),
      request("/projects", token)
    ]).then(([me, data]) => {
      if (cancelled) return;
      setUser(me);
      setProjects(data);
      setProjectId(current =>
        data.some(p => p._id === current) ? current : data[0]?._id || ""
      );
    }).catch(() => {
      if (!cancelled) logout();
    });

    return () => { cancelled = true; };
  }, [token, logout]);

  useEffect(() => {
    if (!token || !projectId) {
      setTasks([]);
      setMembers([]);
      return;
    }

    let cancelled = false;

    request(`/projects`, token)
      .then(data => {
        if (cancelled) return;
        setProjects(data);
        const project = data.find(p => p._id === projectId);
        setMembers(project?.members || []);
      })
      .catch(err => !cancelled && setError(err.message));

    request(`/tasks/project/${projectId}`, token)
      .then(data => !cancelled && setTasks(data))
      .catch(err => !cancelled && setError(err.message));

    return () => { cancelled = true; };
  }, [token, projectId]);

  useEffect(() => {
    if (!token || !projectId) return;

    const socket = io(SOCKET, { auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("project:join", projectId);
    });

    socket.on("task:created", task => {
      if (String(task.project) === projectId) {
        setTasks(current =>
          current.some(t => t._id === task._id)
            ? current : [task, ...current]
        );
      }
    });

    socket.on("task:updated", task => {
      setTasks(current =>
        current.map(t => t._id === task._id ? task : t)
      );
    });

    socket.on("task:deleted", ({ taskId }) => {
      setTasks(current => current.filter(t => t._id !== taskId));
      setOpenTask(current => current === taskId ? "" : current);
    });

    socket.on("connect_error", err => setError(err.message));

    return () => {
      socket.emit("project:leave", projectId);
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [token, projectId]);

  async function run(action, successMessage) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitAuth(e) {
    e.preventDefault();

    await run(async () => {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
      const data = await request(endpoint, "", {
        method: "POST",
        body: JSON.stringify(authForm)
      });

      sessionStorage.setItem("token", data.token);
      setUser(data.user);
      setToken(data.token);
      setAuthForm({ name: "", email: "", password: "" });
    });
  }

  async function createProject(e) {
    e.preventDefault();
    if (!projectName.trim()) return;

    await run(async () => {
      const project = await request("/projects", token, {
        method: "POST",
        body: JSON.stringify({ name: projectName.trim() })
      });
      setProjectName("");
      await refreshProjects();
      setProjectId(project._id);
    }, "Project created");
  }

  async function inviteMember(e) {
    e.preventDefault();
    if (!activeProject || !inviteEmail.trim()) return;

    await run(async () => {
      const project = await request(
        `/projects/${projectId}/members`, token,
        { method: "POST", body: JSON.stringify({ email: inviteEmail.trim() }) }
      );
      setProjects(current =>
        current.map(p => p._id === project._id ? project : p)
      );
      setMembers(project.members || []);
      setInviteEmail("");
    }, "Member added");
  }

  async function createTask(e) {
    e.preventDefault();
    if (!taskTitle.trim() || !projectId) return;

    await run(async () => {
      const task = await request("/tasks", token, {
        method: "POST",
        body: JSON.stringify({
          title: taskTitle.trim(),
          projectId,
          assignedTo: taskAssignee || null,
          priority: taskPriority
        })
      });

      setTasks(current =>
        current.some(t => t._id === task._id) ? current : [task, ...current]
      );
      setTaskTitle("");
      setTaskAssignee("");
    }, "Task created");
  }

  async function updateTask(id, changes) {
    await run(async () => {
      const task = await request(`/tasks/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify(changes)
      });
      setTasks(current => current.map(t => t._id === id ? task : t));
    }, "Task updated");
  }

  async function addComment(e, taskId) {
    e.preventDefault();
    const text = commentDrafts[taskId]?.trim();
    if (!text) return;

    await run(async () => {
      const task = await request(`/tasks/${taskId}/comments`, token, {
        method: "POST",
        body: JSON.stringify({ text })
      });
      setTasks(current => current.map(t => t._id === taskId ? task : t));
      setCommentDrafts(current => ({ ...current, [taskId]: "" }));
    }, "Comment added");
  }

  async function deleteTask(taskId) {
    if (!window.confirm("Delete this task?")) return;

    await run(async () => {
      await request(`/tasks/${taskId}`, token, { method: "DELETE" });
      setTasks(current => current.filter(t => t._id !== taskId));
      setOpenTask("");
    }, "Task deleted");
  }

  function onDragStart(e, id) {
    e.dataTransfer.setData("text/task-id", id);
  }

  function onDrop(e, status) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/task-id");
    if (id && tasks.find(t => t._id === id)?.status !== status) {
      updateTask(id, { status });
    }
  }

  if (!token || !user) {
    return (
      <main className="auth-page">
        <form className="auth-card" onSubmit={submitAuth}>
          <div className="brand-mark">P</div>
          <h1>ProjectFlow</h1>
          <p>Bring your team and work together.</p>

          {authMode === "register" && (
            <input
              placeholder="Full name"
              autoComplete="name"
              required
              value={authForm.name}
              onChange={e => setAuthForm({
                ...authForm, name: e.target.value
              })}
            />
          )}

          <input
            type="email"
            placeholder="Email address"
            autoComplete="email"
            required
            value={authForm.email}
            onChange={e => setAuthForm({
              ...authForm, email: e.target.value
            })}
          />

          <input
            type="password"
            placeholder="Password (min. 8 characters)"
            autoComplete={authMode === "login" ? "current-password" : "new-password"}
            minLength={8}
            required
            value={authForm.password}
            onChange={e => setAuthForm({
              ...authForm, password: e.target.value
            })}
          />

          {error && <p className="error">{error}</p>}

          <button className="primary full" disabled={busy}>
            {busy ? "Please wait…" :
              authMode === "login" ? "Sign in" : "Create account"}
          </button>

          <p className="switch-auth">
            {authMode === "login" ? "New to ProjectFlow?" : "Already have an account?"}
            {" "}
            <button type="button" className="link" onClick={() => {
              setAuthMode(authMode === "login" ? "register" : "login");
              setError("");
            }}>
              {authMode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P</span> ProjectFlow
        </div>

        <div className="side-label">WORKSPACE</div>

        <form className="project-create" onSubmit={createProject}>
          <input
            placeholder="New project name"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            required
          />
          <button className="primary" disabled={busy}>+ Create</button>
        </form>

        <div className="side-label">YOUR PROJECTS</div>

        <nav className="project-list">
          {projects.map(project => (
            <button
              key={project._id}
              className={`project-link ${project._id === projectId ? "selected" : ""}`}
              onClick={() => setProjectId(project._id)}
            >
              <span className="project-dot" />
              <span>{project.name}</span>
            </button>
          ))}
          {projects.length === 0 && <p className="muted small">Create your first project.</p>}
        </nav>

        <div className="sidebar-bottom">
          <div className="avatar">{user.name?.[0]?.toUpperCase()}</div>
          <div className="user-details">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="icon-button" title="Sign out" onClick={logout}>↪</button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="breadcrumb">Workspace / Projects</div>
            <h1>{activeProject?.name || "My workspace"}</h1>
            <p className="muted">
              {activeProject?.description || "Plan, collaborate, and get things done."}
            </p>
          </div>
          <div className="live-indicator"><span /> Live workspace</div>
        </header>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}

        {activeProject ? (
          <>
            <section className="toolbar">
              <form className="task-create" onSubmit={createTask}>
                <input
                  placeholder="What needs to be done?"
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  required
                />
                <select
                  value={taskAssignee}
                  onChange={e => setTaskAssignee(e.target.value)}
                  aria-label="Assign task"
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
                <select
                  value={taskPriority}
                  onChange={e => setTaskPriority(e.target.value)}
                  aria-label="Task priority"
                >
                  <option value="low">Low priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="high">High priority</option>
                </select>
                <button className="primary" disabled={busy}>+ Add task</button>
              </form>

              <form className="invite-form" onSubmit={inviteMember}>
                <input
                  type="email"
                  placeholder="Teammate email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                />
                <button className="secondary" disabled={busy}>Invite member</button>
              </form>
            </section>

            <section className="stats-row">
              <div className="stat-card">
                <span>Total tasks</span><strong>{tasks.length}</strong>
              </div>
              <div className="stat-card">
                <span>In progress</span>
                <strong>{tasks.filter(t => t.status === "inprogress").length}</strong>
              </div>
              <div className="stat-card">
                <span>Completed</span>
                <strong>{tasks.filter(t => t.status === "done").length}</strong>
              </div>
              <div className="stat-card">
                <span>Team members</span><strong>{members.length}</strong>
              </div>
            </section>

            <section className="board">
              {columns.map(column => {
                const items = tasks.filter(t => t.status === column.id);

                return (
                  <div
                    key={column.id}
                    className="board-column"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => onDrop(e, column.id)}
                  >
                    <div className="column-heading">
                      <div className={`column-dot ${column.id}`} />
                      <h2>{column.label}</h2>
                      <span className="count">{items.length}</span>
                    </div>

                    <div className="task-stack">
                      {items.map(task => (
                        <article
                          key={task._id}
                          className="task-card"
                          draggable
                          onDragStart={e => onDragStart(e, task._id)}
                        >
                          <div className="task-card-top">
                            <span className={`priority ${task.priority}`}>
                              {task.priority}
                            </span>
                            <button
                              className="icon-button"
                              title="Delete task"
                              onClick={() => deleteTask(task._id)}
                            >×</button>
                          </div>

                          <h3>{task.title}</h3>
                          {task.description && <p>{task.description}</p>}

                          <div className="task-meta">
                            <span className="assignee">
                              <span className="mini-avatar">
                                {(task.assignedTo?.name || "?")[0].toUpperCase()}
                              </span>
                              {task.assignedTo?.name || "Unassigned"}
                            </span>
                            <button
                              className="comment-toggle"
                              onClick={() => setOpenTask(
                                openTask === task._id ? "" : task._id
                              )}
                            >
                              ◯ {task.comments?.length || 0}
                            </button>
                          </div>

                          <div className="task-actions">
                            <select
                              value={task.status}
                              onChange={e => updateTask(task._id, {
                                status: e.target.value
                              })}
                              aria-label="Change task status"
                            >
                              {columns.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                              ))}
                            </select>
                            <select
                              value={task.assignedTo?._id || ""}
                              onChange={e => updateTask(task._id, {
                                assignedTo: e.target.value || null
                              })}
                              aria-label="Change assignee"
                            >
                              <option value="">Unassigned</option>
                              {members.map(m => (
                                <option key={m._id} value={m._id}>{m.name}</option>
                              ))}
                            </select>
                          </div>

                          {openTask === task._id && (
                            <div className="comments">
                              <strong>Discussion</strong>
                              {(task.comments || []).map(comment => (
                                <div className="comment" key={comment._id}>
                                  <b>{comment.user?.name || "Member"}</b>
                                  <p>{comment.text}</p>
                                  <span>{new Date(comment.createdAt).toLocaleString()}</span>
                                </div>
                              ))}
                              {task.comments?.length === 0 && (
                                <p className="muted small">No comments yet.</p>
                              )}
                              <form onSubmit={e => addComment(e, task._id)}>
                                <textarea
                                  placeholder="Write a comment…"
                                  value={commentDrafts[task._id] || ""}
                                  onChange={e => setCommentDrafts(current => ({
                                    ...current, [task._id]: e.target.value
                                  }))}
                                  maxLength={3000}
                                  required
                                />
                                <button className="primary" disabled={busy}>
                                  Send comment
                                </button>
                              </form>
                            </div>
                          )}
                        </article>
                      ))}

                      {items.length === 0 && (
                        <div className="empty-column">
                          Drop a task here or create one above.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        ) : (
          <div className="welcome">
            <h2>Start your first project</h2>
            <p>Create a project to organize tasks and invite your teammates.</p>
          </div>
        )}
      </main>
    </div>
  );
}