# Performance Regression Checks Script

import pandas as pd
import matplotlib.pyplot as plt
import os
import json

# Load historical metrics
historical_data_path = 'performance_metrics/historical_metrics.json'
historical_data = {}

if os.path.exists(historical_data_path):
    with open(historical_data_path, 'r') as f:
        historical_data = json.load(f)

# Define performance metrics targets
performance_targets = {
    'response_time': 200,  # Target response time in milliseconds
    'cpu_usage': 50,         # Target CPU usage percentage
    'memory_usage': 200      # Target memory usage in MB
}

def compare_metrics(current_metrics, historical_metrics):
    regressions = {}
    for metric, value in current_metrics.items():
        if metric in historical_metrics:
            if value > historical_metrics[metric] * 1.05:  # 5% threshold for regression
                regressions[metric] = {
                    'current': value,
                    'historical': historical_metrics[metric]
                }
    return regressions

def store_metrics(metrics):
    if historical_data:
        for metric, value in metrics.items():
            if metric in historical_data:
                historical_data[metric].append(value)
            else:
                historical_data[metric] = [value]
    else:
        historical_data.update(metrics)

    with open(historical_data_path, 'w') as f:
        json.dump(historical_data, f)

def plot_metrics():
    if historical_data:
        for metric, values in historical_data.items():
            plt.figure()
            plt.plot(values, label=metric)
            plt.axhline(y=performance_targets[metric], color='r', linestyle='--', label=f'Target {metric}')
            plt.xlabel('Runs')
            plt.ylabel(metric)
            plt.title(f'{metric} Over Time')
            plt.legend()
            plt.savefig(f'performance_metrics/{metric}_trend.png')
            plt.close()

def main():
# Fetch actual performance metrics (example using a hypothetical function)
current_metrics = fetch_performance_metrics()

    # Compare current metrics with historical metrics
    regressions = compare_metrics(current_metrics, historical_data.get('current_run', {}))

    if regressions:
        print('Performance Regressions Detected:')
        for metric, details in regressions.items():
            print(f'- {metric}: Current={details["current"]}, Historical={details["historical"]}')
        exit(1)  # Fail CI on regression
    else:
        print('No performance regressions detected.')

    # Store current metrics
    store_metrics(current_metrics)

    # Plot metrics
    plot_metrics()

if __name__ == '__main__':
    main()
