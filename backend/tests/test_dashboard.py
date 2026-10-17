def test_dashboard_summary_returns_zeroed_counts_when_empty(client, db_session):
    response = client.get("/api/v1/dashboard/summary")

    assert response.status_code == 200
    assert response.json() == {
        "total": 0,
        "ELIGIBLE_SIMULATED": 0,
        "BLOCKED": 0,
        "NEEDS_HUMAN_APPROVAL": 0,
        "PENDING": 0,
        "budget_consumed": 0.0,
        "budget_total": 0.0,
    }
