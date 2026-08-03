export function AdminPage() {
  async function loadStats() {
    return fetch("/api/admin/stats");
  }
  return <section>Admin stats</section>;
}
