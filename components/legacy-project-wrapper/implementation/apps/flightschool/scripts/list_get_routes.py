from app import create_app
app = create_app()
with app.app_context():
    for rule in app.url_map.iter_rules():
        if "GET" in rule.methods and not rule.rule.startswith("/static"):
            print(rule.rule)
