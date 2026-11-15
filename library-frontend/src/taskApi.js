// taskApi.js - tiny helper that talks to the library-backend /api/tasks routes.
// It sends the login token the library already gave the user, so there is no second login.
//
// If your backend does not run on port 5000, change the address below or create a
// file called .env in library-frontend with:   VITE_API_URL=http://localhost:4000
const BASE = (import.meta.env && import.meta.env.VITE_API_URL) || "http://localhost:5000";

export function createApi(token) {
  async function request(method, path, body) {
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new Error("Cannot reach the server. Is library-backend running?");
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* no JSON body */
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body ?? {}),
    del: (path) => request("DELETE", path),
  };
}
