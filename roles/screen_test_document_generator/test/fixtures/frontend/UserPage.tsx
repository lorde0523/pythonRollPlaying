import { UserCard } from "./UserCard";

export function UserPage({ userId }) {
  async function loadUser() {
    return fetch(`/api/users/${userId}`, { method: "GET" });
  }
  async function saveUser(payload) {
    return api.patch(`/api/users/${userId}`, payload);
  }
  return <form><UserCard userId={userId} /><input name="email" required /></form>;
}

export const route = { path: "/users/:userId" };
