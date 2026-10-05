"""Pure fixture-testable definitions; all ratios use summed opportunities."""

from collections import defaultdict
from datetime import UTC, datetime

SCORING = "Half-PPR · standard scoring, no return TDs"
UNAVAILABLE = (
    "routeParticipation",
    "yardsPerRoute",
    "targetsPerRoute",
    "firstDownsPerRoute",
)


def number(value):
    return 0 if value is None else value


def ratio(num, den):
    return {"value": num / den if den else None, "num": num, "den": den}


def summed_ratio(pairs):
    pairs = list(pairs)
    return ratio(sum(n for n, _ in pairs), sum(d for _, d in pairs))


def half_ppr(row):
    return (
        number(row.get("total_fantasy_points")) - 0.5 * number(row.get("receptions")),
        number(row.get("total_fantasy_points_exp"))
        - 0.5 * number(row.get("receptions_exp")),
    )


def target(play):
    return (
        play.get("pass_attempt") == 1
        and bool(play.get("receiver_player_id"))
        and play.get("sack") != 1
        and play.get("two_point_attempt") != 1
        and play.get("play_type") != "no_play"
    )


def carry(play):
    return (
        play.get("rush_attempt") == 1
        and bool(play.get("rusher_player_id"))
        and play.get("qb_kneel") != 1
        and play.get("two_point_attempt") != 1
        and play.get("play_type") != "no_play"
    )


def completed_game_ids(games, pbp):
    # Score fields alone can contain live scores. The feed's terminal marker is required.
    terminal = {
        p["game_id"]
        for p in pbp
        if p.get("play_type_nfl") == "GAME_END" or p.get("desc") == "END GAME"
    }
    return {
        g["game_id"]
        for g in games
        if g.get("home_score") is not None
        and g.get("away_score") is not None
        and g["game_id"] in terminal
    }


def freshness(manifests, completed_week):
    required = [m["throughWeek"] for m in manifests if m.get("required", True)]
    through = min([completed_week, *required])
    latest = max([completed_week, *required], default=0)
    lagging = [m["name"] for m in manifests if m["throughWeek"] < latest]
    return through, bool(lagging), lagging


def aggregate(slots):
    games = len(slots)

    def total(key):
        return sum(number(s["values"].get(key)) for s in slots)

    metrics = {key: {"value": None} for key in UNAVAILABLE}
    for metric, key in [
        ("pointsPerGame", "actual"),
        ("xfpPerGame", "xfp"),
        ("targetsPerGame", "targets"),
        ("carriesPerGame", "carries"),
        ("inside5PerGame", "inside5"),
        ("endZoneTargetsPerGame", "endZoneTargets"),
    ]:
        metrics[metric] = ratio(total(key), games)
    for metric, num, den in [
        ("targetShare", "targets", "teamTargets"),
        ("rbCarryShare", "carries", "teamRbCarries"),
        ("inside5Share", "inside5", "teamInside5"),
        ("yardsAfterContactPerCarry", "yac", "chartedCarries"),
    ]:
        metrics[metric] = ratio(total(num), total(den))
    metrics["endZoneMissingAirYards"] = {
        "value": total("endZoneMissingAirYards"),
        "num": total("endZoneMissingAirYards"),
    }
    return {
        "rank": 0,
        "games": games,
        "coveredWeeks": [s["week"] for s in slots],
        "metrics": metrics,
        "coverage": {
            "yardsAfterContactPerCarry": {
                "covered": sum(s["values"].get("yacCovered", 0) for s in slots),
                "total": games,
            }
        },
    }


def build_documents(rows, manifests, season, built_at=None):
    games = [
        g
        for g in rows["games"]
        if int(g["season"]) == season and g["game_type"] == "REG"
    ]
    pbp = [p for p in rows["pbp"] if p.get("season_type", "REG") == "REG"]
    completed = completed_game_ids(games, pbp)
    # Only fully completed calendar weeks enter the common snapshot. A Thursday
    # game must not make Sunday games look like inactive appearances.
    source_games = {
        name: {r["game_id"] for r in rows[name] if r.get("game_id")}
        for name in ("pbp", "opportunity", "snaps")
    }
    roster_team_weeks = {(int(r["week"]), r["team"]) for r in rows["rosters"]}
    through_complete = 0
    for week in range(1, 19):
        weekly = [g for g in games if int(g["week"]) == week]
        if not weekly or not all(
            g["game_id"] in completed
            and all(g["game_id"] in ids for ids in source_games.values())
            and all(
                (week, t) in roster_team_weeks for t in (g["home_team"], g["away_team"])
            )
            for g in weekly
        ):
            break
        through_complete = week
    through, partial, lagging = freshness(manifests, through_complete)
    # A latest-week stamp cannot prove every game is covered. Name missing-game
    # feeds explicitly when the intersection forced an earlier cutoff.
    for name, ids in source_games.items():
        if (
            any(
                g["week"] > through
                and g["game_id"] in completed
                and g["game_id"] not in ids
                for g in games
            )
            and name not in lagging
        ):
            lagging.append(name)
    if (
        any(
            g["week"] > through
            and g["game_id"] in completed
            and any(
                (int(g["week"]), t) not in roster_team_weeks
                for t in (g["home_team"], g["away_team"])
            )
            for g in games
        )
        and "rosters" not in lagging
    ):
        lagging.append("rosters")
    partial = bool(lagging)
    built_at = built_at or datetime.now(UTC).isoformat()
    eligible = {
        g["game_id"]
        for g in games
        if g["game_id"] in completed and g["week"] <= through
    }
    team_games = {
        (int(g["week"]), team): g
        for g in games
        for team in (g["home_team"], g["away_team"])
    }
    rosters = [
        r
        for r in rows["rosters"]
        if r.get("game_type", "REG") == "REG"
        and r.get("gsis_id")
        and int(r["season"]) == season
    ]
    identities = {}
    roster_map = {}
    for r in sorted(rosters, key=lambda r: int(r["week"])):
        identities[r["gsis_id"]] = r
        roster_map[(r["gsis_id"], int(r["week"]))] = r
    rb_ids = {
        r["gsis_id"] for r in identities.values() if r["position"] in ("RB", "FB")
    }
    pfr_to_gsis = {r["pfr_id"]: r["gsis_id"] for r in rosters if r.get("pfr_id")}
    snaps = {}
    for s in rows["snaps"]:
        pid = pfr_to_gsis.get(s.get("pfr_player_id"))
        if pid and any(
            number(s.get(k)) > 0 for k in ("offense_snaps", "defense_snaps", "st_snaps")
        ):
            snaps[(pid, int(s["week"]))] = s
    opp = {(r["player_id"], r["game_id"]): r for r in rows["opportunity"]}
    injuries = {(r.get("gsis_id"), int(r["week"])): r for r in rows["injuries"]}
    rushing = {(r.get("pfr_player_id"), r["game_id"]): r for r in rows["rushing"]}
    stats = defaultdict(lambda: defaultdict(float))
    team_stats = defaultdict(lambda: defaultdict(float))
    for p in pbp:
        gid, team = p["game_id"], p.get("posteam")
        if gid not in eligible or not team:
            continue
        if target(p):
            stat = stats[(p["receiver_player_id"], gid)]
            stat["targets"] += 1
            team_stats[(team, gid)]["teamTargets"] += 1
            if p.get("air_yards") is None:
                stat["endZoneMissingAirYards"] += 1
            elif (
                p.get("yardline_100") is not None
                and p["air_yards"] >= p["yardline_100"]
            ):
                stat["endZoneTargets"] += 1
        if carry(p):
            pid = p["rusher_player_id"]
            stats[(pid, gid)]["carries"] += 1
            if pid in rb_ids:
                team_stats[(team, gid)]["teamRbCarries"] += 1
            if p.get("yardline_100") is not None and p["yardline_100"] <= 5:
                stats[(pid, gid)]["inside5"] += 1
                team_stats[(team, gid)]["teamInside5"] += 1
    documents = {}
    for position in ("WR", "RB"):
        players = []
        for pid, identity in identities.items():
            if (
                "RB" if identity["position"] == "FB" else identity["position"]
            ) != position:
                continue
            slots = []
            for week in range(1, 19):
                roster = roster_map.get((pid, week))
                snap = snaps.get((pid, week))
                team = snap["team"] if snap else roster["team"] if roster else None
                game = team_games.get((week, team))
                future = week > through
                status = (
                    "not_on_team"
                    if not team
                    else "bye"
                    if not game
                    else "played"
                    if not future
                    and game["game_id"] in eligible
                    and ((roster and roster["status"] == "ACT") or snap)
                    else "inactive"
                )
                values = {
                    k: None
                    for k in (
                        "actual",
                        "xfp",
                        "targetShare",
                        "rbCarryShare",
                        "routeParticipation",
                    )
                }
                slot = {
                    "week": week,
                    "team": team,
                    "status": status,
                    "upcoming": future,
                    "values": values,
                }
                if future and game and game["game_id"] in completed:
                    slot["pending"] = True
                if status == "played":
                    gid = game["game_id"]
                    actual, expected = half_ppr(opp.get((pid, gid), {}))
                    values.update(
                        {
                            k: 0
                            for k in (
                                "targets",
                                "carries",
                                "inside5",
                                "endZoneTargets",
                                "endZoneMissingAirYards",
                                "teamTargets",
                                "teamRbCarries",
                                "teamInside5",
                                "yac",
                                "chartedCarries",
                                "yacCovered",
                            )
                        }
                    )
                    values.update(stats[(pid, gid)])
                    values.update(team_stats[(team, gid)])
                    values.update(actual=actual, xfp=expected)
                    values["targetShare"] = ratio(
                        values["targets"], values["teamTargets"]
                    )["value"]
                    values["rbCarryShare"] = ratio(
                        values["carries"], values["teamRbCarries"]
                    )["value"]
                    advanced = rushing.get((identity.get("pfr_id"), gid))
                    if (
                        advanced
                        and advanced.get("rushing_yards_after_contact") is not None
                        and advanced.get("carries") is not None
                    ):
                        values.update(
                            yac=advanced["rushing_yards_after_contact"],
                            chartedCarries=advanced["carries"],
                            yacCovered=1,
                        )
                elif status == "inactive" and not future:
                    injury = injuries.get((pid, week), {})
                    if injury.get("report_status"):
                        slot["injuryStatus"] = injury["report_status"] + (
                            ": " + injury["report_primary_injury"]
                            if injury.get("report_primary_injury")
                            else ""
                        )
                slots.append(slot)
            played = [s for s in slots if s["status"] == "played"]
            if not played:
                continue
            players.append(
                {
                    "playerId": pid,
                    "name": identity["full_name"],
                    "team": identity["team"],
                    "periods": {
                        "season": aggregate(played),
                        "last4": aggregate(played[-4:]),
                    },
                    "weeks": slots,
                }
            )
        for period in ("season", "last4"):
            players.sort(
                key=lambda p: (
                    -p["periods"][period]["metrics"]["pointsPerGame"]["value"],
                    p["playerId"],
                )
            )
            for rank, player in enumerate(players, 1):
                player["periods"][period]["rank"] = rank
        players.sort(key=lambda p: p["periods"]["season"]["rank"])
        documents[position.lower()] = {
            "meta": {
                "season": season,
                "position": position,
                "scoring": SCORING,
                "dataThroughWeek": through,
                "builtAt": built_at,
                "sources": manifests,
                "partial": partial,
                "laggingSources": lagging,
            },
            "players": players,
        }
    return documents
