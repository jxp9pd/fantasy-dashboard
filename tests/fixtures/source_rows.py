"""Deliberately fictional in-memory fixtures, never published by the build."""


def make_source_rows():
    rows = {
        name: []
        for name in (
            "games",
            "pbp",
            "rosters",
            "opportunity",
            "snaps",
            "rushing",
            "injuries",
        )
    }
    for week in range(1, 7):
        # A's week-three bye, C's game supplies a completed calendar week.
        teams = ("C", "B") if week == 3 else ("A", "B")
        gid = f"2026_{week:02}_" + "_".join(teams)
        rows["games"].append(
            {
                "season": 2026,
                "week": week,
                "game_type": "REG",
                "game_id": gid,
                "home_team": teams[0],
                "away_team": teams[1],
                "home_score": 14,
                "away_score": 7,
            }
        )
        rows["pbp"].append(
            {
                "game_id": gid,
                "week": week,
                "season_type": "REG",
                "play_type_nfl": "GAME_END",
            }
        )
        for pid, pos, pfr, team, status in [
            ("wr", "WR", "w", "A" if week < 5 else "B", "ACT"),
            ("rb", "RB", "r", "A", "ACT"),
            ("fb", "FB", "f", "A", "ACT"),
            ("qb", "QB", "q", "A", "ACT"),
            ("other", "WR", "o", "B", "ACT"),
        ]:
            rows["rosters"].append(
                {
                    "season": 2026,
                    "week": week,
                    "gsis_id": pid,
                    "pfr_id": pfr,
                    "position": pos,
                    "team": team,
                    "status": status,
                    "full_name": pid,
                    "game_type": "REG",
                }
            )
        # Ensure both game teams have roster coverage even on the bye week.
        if week == 3:
            rows["rosters"].append(
                {
                    "season": 2026,
                    "week": week,
                    "gsis_id": "c",
                    "pfr_id": "c",
                    "position": "QB",
                    "team": "C",
                    "status": "ACT",
                    "full_name": "c",
                    "game_type": "REG",
                }
            )
        rows["snaps"].append(
            {
                "game_id": gid,
                "week": week,
                "pfr_player_id": "o",
                "team": "B",
                "offense_snaps": 1,
            }
        )
        rows["opportunity"].append(
            {
                "player_id": "wr",
                "game_id": gid,
                "total_fantasy_points": week * 10,
                "receptions": 2,
                "total_fantasy_points_exp": week * 8,
                "receptions_exp": 3,
            }
        )
    return rows
