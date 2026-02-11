# Store Historical Metrics Script

import json
import os

def store_metrics(metrics):
    historical_data_path = 'performance_metrics/historical_metrics.json'
    historical_data = {}

    if os.path.exists(historical_data_path):
        with open(historical_data_path, 'r') as f:
            historical_data = json.load(f)

    for metric, value in metrics.items():
        if metric in historical_data:
            historical_data[metric].append(value)
        else:
            historical_data[metric] = [value]

    with open(historical_data_path, 'w') as f:
        json.dump(historical_data, f)

