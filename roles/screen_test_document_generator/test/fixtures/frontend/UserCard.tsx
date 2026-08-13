export function UserCard({ userId }) {
  async function loadActivity() {
    return fetch(`/api/users/${userId}/activity`);
  }
  return <section>User activity</section>;
}
