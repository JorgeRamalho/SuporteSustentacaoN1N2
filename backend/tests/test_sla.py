from datetime import datetime, timedelta, timezone

from app.services.sla import TicketView, build_sla


def test_sla_separa_mttr_backlog_e_conformidade():
    now = datetime(2026, 11, 7, 12, 0, tzinfo=timezone.utc)
    tickets = [
        TicketView("jira", "fechado", "alta", now - timedelta(hours=10), now - timedelta(hours=9), now, 8),
        TicketView(
            "glpi",
            "fechado",
            "media",
            now - timedelta(hours=4),
            now - timedelta(hours=3),
            now - timedelta(hours=2),
            8,
        ),
        TicketView("zendesk", "aberto", "baixa", now - timedelta(hours=3), None, None, 40),
        TicketView(
            "jira",
            "fechado",
            "alta",
            now - timedelta(days=40),
            now - timedelta(days=40) + timedelta(hours=1),
            now - timedelta(days=39),
            8,
        ),
    ]
    metrics = build_sla(tickets, now, 7)
    assert metrics["opened"] == 3
    assert metrics["closed"] == 2
    assert metrics["backlog"] == 1
    assert metrics["breached"] == 1
    assert metrics["mttr_hours"] == 6.0
    assert metrics["avg_first_response_hours"] == 1.0
    assert metrics["compliance_percent"] == 66.7
    jira = next(row for row in metrics["by_provider"] if row["provider"] == "jira")
    assert jira["compliance_percent"] == 0.0
