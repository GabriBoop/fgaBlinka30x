from sqlalchemy import inspect, text

from app.database import engine


def migrate_legacy_rule_actions() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("rule_action") or not inspector.has_table("policy_rule_action"):
        return

    with engine.begin() as connection:
        count = connection.execute(text("SELECT COUNT(*) FROM policy_rule_action")).scalar_one()
        if count:
            return
        legacy_actions = connection.execute(
            text("SELECT code, policy_id, action FROM rule_action")
        ).mappings().all()
        if legacy_actions:
            connection.execute(
                text(
                    "INSERT INTO policy_rule_action (code, policy_id, action) "
                    "VALUES (:code, :policy_id, :action)"
                ),
                list(legacy_actions),
            )
