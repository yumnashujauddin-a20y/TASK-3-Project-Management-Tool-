# TeamFlow – Project Management Tool

A full-stack collaborative project management application inspired by Trello and Asana. TeamFlow helps users organize projects, assign tasks, track progress, and communicate with team members in one place.

## 🚀 Features

- **User Authentication** – Secure registration and login.
- **Project Management** – Create and manage group projects.
- **Task Boards** – Organize tasks into boards and workflow columns.
- **Task Assignment** – Assign tasks to team members.
- **Task Tracking** – Manage task status, priorities, and deadlines.
- **Comments and Discussions** – Communicate directly within tasks.
- **Team Collaboration** – Work together on shared projects.
- **Notifications** – Receive updates about task assignments and project activity.
- **Real-Time Updates** – Keep project boards synchronized using WebSockets.

## 🛠️ Tech Stack

### Frontend
- React.js
- Vite
- Tailwind CSS
- Socket.IO Client

### Backend
- Node.js
- Express.js
- Socket.IO

### Database
- PostgreSQL
- Prisma ORM

### Authentication and Security
- JSON Web Tokens (JWT)
- bcrypt password hashing
- Zod validation

## 📁 Project Structure

```text
teamflow-project-manager/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── App.jsx
│   └── package.json
│
├── server/                 # Express backend
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   └── app.js
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
│
├── .gitignore
└── README.md
```

*The structure may change as development progresses.*

## ⚙️ Installation and Setup

### Prerequisites

Install the following before starting:

- Node.js (LTS version recommended)
- npm
- PostgreSQL
- Git

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/teamflow-project-manager.git
cd teamflow-project-manager
```

Replace `YOUR_USERNAME` with your GitHub username.

### 2. Set up the backend

```bash
cd server
npm install
```

Create a `.env` file inside the `server` directory:

```env
PORT=5000
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/teamflow"
JWT_SECRET="replace_with_a_long_random_secret"
CLIENT_URL="http://localhost:5173"
```

Replace the database credentials and secret with your own values.

### 3. Set up the database

After configuring PostgreSQL and installing Prisma, run:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

These commands assume the Prisma schema and initial migration are configured.

### 4. Start the backend

```bash
npm run dev
```

### 5. Set up the frontend

Open a second terminal:

```bash
cd client
npm install
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:5173`.

*Note: These commands assume the corresponding package scripts and application files have been implemented.*

## 🔐 Environment Variables

Keep secrets in environment files and never commit them to GitHub.

| Variable | Description |
|---|---|
| `PORT` | Backend server port |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign JWTs |
| `CLIENT_URL` | Frontend URL for CORS configuration |

## 🗄️ Core Data Models

The application is designed around these entities:

- **User** – Account information and authentication.
- **Project** – Project name, description, and creator.
- **ProjectMember** – Users who belong to a project and their roles.
- **Task** – Title, description, status, priority, due date, and assignee.
- **Comment** – Messages linked to tasks and their authors.
- **Notification** – Updates about relevant project activity.

## 🔌 Planned API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Log in |
| GET | `/api/projects` | List accessible projects |
| POST | `/api/projects` | Create a project |
| GET | `/api/projects/:id` | Get project details |
| POST | `/api/projects/:id/members` | Add a project member |
| POST | `/api/projects/:id/tasks` | Create a task |
| PATCH | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |
| GET | `/api/tasks/:id/comments` | Get task comments |
| POST | `/api/tasks/:id/comments` | Add a comment |

*These endpoints describe the planned API; they are not necessarily implemented yet.*

## 🔔 Real-Time Collaboration

Socket.IO can be used to broadcast events such as:

- Task created, updated, or deleted
- Task assigned to a team member
- New comment added
- Project board updated
- Notification received

Access to project events should be restricted to authorized project members.

## 🧪 Testing

Add automated tests for authentication, project permissions, task operations, and comments as the application develops.

## 🚀 Deployment

Possible deployment options include:

- **Frontend:** Vercel
- **Backend:** Render
- **Database:** Hosted PostgreSQL provider

Configure environment variables on the hosting platforms before deployment.

## 🔒 Security

- Hash passwords before storing them.
- Validate incoming request data.
- Protect private routes with authentication middleware.
- Verify project membership before allowing access to project data.
- Keep `.env` files and credentials out of version control.

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Push the branch to your fork.
5. Open a pull request.

## 📄 License

This project is intended for educational and portfolio use. Add an appropriate license file if you plan to distribute it under a specific open-source license.

---

**TeamFlow – Plan together. Work smarter. Deliver faster.**

