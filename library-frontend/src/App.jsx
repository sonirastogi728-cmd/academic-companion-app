import { useState, useEffect } from "react";
import "./App.css";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import { getMe, logOut } from "./data/api";
import TaskTracker from "./TaskTracker";

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTasks, setShowTasks] = useState(false);

  useEffect(() => {
    getMe().then((res) => {
      if (res.ok) setCurrentUser(res.user);
      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    await logOut();
    setCurrentUser(null);
    setShowTasks(false);
  }

  if (loading)
    return <div className="app"><p className="message">Loading...</p></div>;

  const token = localStorage.getItem("token");

  return (
    <div className="app">
      {currentUser ? (
        <>
          <button onClick={() => setShowTasks(!showTasks)}>
            {showTasks ? "Back to Library" : "Task Tracking"}
          </button>
          {showTasks ? (
            <TaskTracker user={currentUser} token={token} />
          ) : (
            <Dashboard user={currentUser} onLogout={handleLogout} />
          )}
        </>
      ) : (
        <AuthPage onLogin={setCurrentUser} />
      )}
    </div>
  );
}

export default App;