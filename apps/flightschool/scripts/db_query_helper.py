from app import create_app, db
from app.models import *

# Usage: python scripts/db_query_helper.py "Aircraft.query.all()"
import sys

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/db_query_helper.py '<query>'")
        sys.exit(1)
    query_str = sys.argv[1]
    app = create_app()  # Use the factory pattern
    with app.app_context():
        try:
            # Evaluate the query string in the context of the models
            result = eval(query_str, globals(), locals())
            # If it's a list of model objects, print them nicely
            if isinstance(result, list):
                for obj in result:
                    print(obj)
            else:
                print(result)
        except Exception as e:
            print(f"Error executing query: {e}")
