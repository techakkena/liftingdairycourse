#!/usr/bin/env python3
"""
Query workouts from the past 12 months and plot a monthly bar chart.

Usage:
    python plot_workouts.py --env /path/to/.env.local --output /path/to/workout_chart.png
"""

import argparse
import os
import sys
from datetime import datetime, timezone
from pathlib import Path


def load_env(env_path: str) -> str:
    """Load DATABASE_URL from a .env file without requiring python-dotenv."""
    path = Path(env_path)
    if not path.exists():
        sys.exit(f"ERROR: env file not found: {env_path}")

    db_url = None
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line.startswith("DATABASE_URL="):
                db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

    if not db_url:
        # Fall back to environment variable
        db_url = os.environ.get("DATABASE_URL")

    if not db_url:
        sys.exit("ERROR: DATABASE_URL not found in env file or environment.")

    return db_url


def query_workouts(db_url: str) -> list[tuple[str, int]]:
    """Return list of (month_label, count) for the past 12 months."""
    try:
        import psycopg2
    except ImportError:
        sys.exit("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month_label,
                    DATE_TRUNC('month', created_at) AS month_date,
                    COUNT(*) AS workout_count
                FROM workouts
                WHERE created_at >= NOW() - INTERVAL '12 months'
                GROUP BY month_label, month_date
                ORDER BY month_date ASC
            """)
            rows = cur.fetchall()
    finally:
        conn.close()

    return [(row[0], int(row[2])) for row in rows]


def fill_missing_months(data: list[tuple[str, int]]) -> list[tuple[str, int]]:
    """Ensure all 12 months are present, filling gaps with zero."""
    from datetime import date
    import calendar

    now = datetime.now(timezone.utc)
    months = []
    for i in range(11, -1, -1):
        # Step back i months from current
        month = now.month - i
        year = now.year
        while month <= 0:
            month += 12
            year -= 1
        label = date(year, month, 1).strftime("%b %Y")
        months.append(label)

    data_map = dict(data)
    return [(m, data_map.get(m, 0)) for m in months]


def plot_chart(data: list[tuple[str, int]], output_path: str) -> None:
    """Render and save the bar chart."""
    try:
        import matplotlib
        matplotlib.use("Agg")  # non-interactive backend, safe for headless/Windows
        import matplotlib.pyplot as plt
    except ImportError:
        sys.exit("ERROR: matplotlib not installed. Run: pip install matplotlib")

    labels = [d[0] for d in data]
    counts = [d[1] for d in data]
    total = sum(counts)

    fig, ax = plt.subplots(figsize=(12, 6))

    bars = ax.bar(labels, counts, color="#4f86c6", edgecolor="white", linewidth=0.8)

    # Annotate bars with count values
    for bar, count in zip(bars, counts):
        if count > 0:
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 0.15,
                str(count),
                ha="center",
                va="bottom",
                fontsize=9,
                color="#333333",
            )

    ax.set_xlabel("Month", fontsize=12, labelpad=10)
    ax.set_ylabel("Number of Workouts", fontsize=12, labelpad=10)
    ax.set_title("Workouts per Month (Past 12 Months)", fontsize=14, fontweight="bold", pad=15)
    ax.set_ylim(0, max(counts) * 1.2 + 1 if counts else 5)
    ax.tick_params(axis="x", rotation=45)
    ax.yaxis.set_major_locator(plt.MaxNLocator(integer=True))
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.3, linestyle="--")

    if total == 0:
        ax.text(
            0.5, 0.5,
            "No workouts recorded in the past 12 months",
            transform=ax.transAxes,
            ha="center", va="center",
            fontsize=13, color="#888888",
        )

    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()

    print(f"Chart saved to: {output_path}")
    print(f"Total workouts: {total}")
    if counts and total > 0:
        peak_idx = counts.index(max(counts))
        print(f"Busiest month: {labels[peak_idx]} ({counts[peak_idx]} workouts)")
    zero_months = [labels[i] for i, c in enumerate(counts) if c == 0]
    if zero_months:
        print(f"Months with no workouts: {', '.join(zero_months)}")


def main():
    parser = argparse.ArgumentParser(description="Plot monthly workout bar chart")
    parser.add_argument("--env", required=True, help="Path to .env.local file")
    parser.add_argument("--output", required=True, help="Output path for the PNG chart")
    args = parser.parse_args()

    db_url = load_env(args.env)
    print("Connecting to database...")
    raw_data = query_workouts(db_url)
    print(f"Found {len(raw_data)} months with workout data.")
    data = fill_missing_months(raw_data)
    plot_chart(data, args.output)


if __name__ == "__main__":
    main()
