export type PlayerSummary = {
  player: { name: string; position: string };
  club: { name: string };
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  goalsPer90: number;
  recentPerformances: {
    id: number;
    matchDate: string;
    minutes: number;
    goals: number;
    assists: number;
  }[];
};
export default function PlayerProfile({
  summary,
  onClose,
}: {
  summary: PlayerSummary;
  onClose: () => void;
}) {
  return (
    <section className="panel" aria-label="Player profile">
      <div className="section-heading">
        <h2>{summary.player.name}</h2>
        <button className="secondary" onClick={onClose}>
          Close profile
        </button>
      </div>
      <p>
        {summary.player.position} · {summary.club.name}
      </p>
      <dl className="profile-stats">
        {[
          ["Appearances", summary.appearances],
          ["Minutes", summary.minutes],
          ["Goals", summary.goals],
          ["Assists", summary.assists],
          ["Goals per 90", summary.goalsPer90],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <h3>Recent performances</h3>
      {summary.recentPerformances.length === 0 ? (
        <p>No performance records yet.</p>
      ) : (
        <div className="table">
          <table>
            <thead>
              <tr>
                <th>Match date</th>
                <th>Minutes</th>
                <th>Goals</th>
                <th>Assists</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentPerformances.map((p) => (
                <tr key={p.id}>
                  <td>{p.matchDate}</td>
                  <td>{p.minutes}</td>
                  <td>{p.goals}</td>
                  <td>{p.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
