#!/usr/bin/env python3
"""
Script to find shadowed routes in a Flask application.
Shadowed routes occur when multiple route handlers are registered for the same URL pattern,
causing only the last registered handler to be active.
"""

import os
import re
import sys
from collections import defaultdict
import importlib.util
import inspect

def extract_blueprint_prefixes(app_init_file):
    """Extract blueprint prefixes from the Flask app initialization file."""
    blueprint_prefixes = {}
    
    with open(app_init_file, 'r') as f:
        content = f.read()
    
    # Find all blueprint registrations
    registration_pattern = r'app\.register_blueprint\((\w+)_blueprint\.(\w+)_bp(?:,\s*url_prefix=[\'"]([^\'"]*)[\'"])?\)'
    matches = re.findall(registration_pattern, content)
    
    for match in matches:
        module_name, blueprint_name, prefix = match
        blueprint_prefixes[blueprint_name] = prefix if prefix else ''
    
    return blueprint_prefixes

def extract_routes_from_file(file_path):
    """Extract route patterns from a Flask route file."""
    routes = []
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find all route decorators
    route_pattern = r'@(\w+)_bp\.route\([\'"](.+?)[\'"](,|\))'
    matches = re.findall(route_pattern, content)
    
    for match in matches:
        blueprint_name, route_path, _ = match
        
        # Extract HTTP methods if specified
        method_pattern = r'@' + re.escape(blueprint_name) + r'_bp\.route\([\'"]' + re.escape(route_path) + r'[\'"](.*?)methods=\[(.*?)\]'
        method_matches = re.findall(method_pattern, content, re.DOTALL)
        methods = []
        
        if method_matches:
            methods_str = method_matches[0][1]
            methods = [m.strip().strip("'\"") for m in methods_str.split(',')]
        else:
            methods = ["GET"]  # Default method is GET
        
        # Find the function name associated with this route
        func_pattern = r'@' + re.escape(blueprint_name) + r'_bp\.route\([\'"]' + re.escape(route_path) + r'[\'"](.*?)\)\s+def (\w+)\('
        func_matches = re.findall(func_pattern, content, re.DOTALL)
        func_name = func_matches[0][1] if func_matches else "unknown"
        
        routes.append({
            'blueprint': blueprint_name,
            'path': route_path,
            'methods': methods,
            'function': func_name,
            'file': file_path
        })
    
    return routes

def find_shadowed_routes(app_dir):
    """Find shadowed routes in the application, accounting for blueprint prefixes."""
    routes_dir = os.path.join(app_dir, 'routes')
    app_init_file = os.path.join(app_dir, '__init__.py')
    
    # Extract blueprint prefixes
    blueprint_prefixes = extract_blueprint_prefixes(app_init_file)
    
    all_routes = []
    
    # Process each route file
    for filename in os.listdir(routes_dir):
        if filename.endswith('.py'):
            file_path = os.path.join(routes_dir, filename)
            routes = extract_routes_from_file(file_path)
            all_routes.extend(routes)
    
    # Group routes by full path (including prefix) to find duplicates
    route_map = defaultdict(list)
    for route in all_routes:
        blueprint = route['blueprint']
        prefix = blueprint_prefixes.get(blueprint, '')
        full_path = os.path.join(prefix, route['path'].lstrip('/')).replace('\\', '/')
        if not full_path.startswith('/'):
            full_path = '/' + full_path
        
        key = (full_path, tuple(sorted(route['methods'])))
        route_map[key].append(route)
    
    # Find shadowed routes
    shadowed_routes = []
    for (path, methods), routes in route_map.items():
        if len(routes) > 1:
            shadowed_routes.append((path, methods, routes))
    
    return shadowed_routes, blueprint_prefixes

def main():
    """Main function to find and display shadowed routes."""
    app_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app')
    
    print("Scanning for shadowed routes...")
    shadowed_routes, blueprint_prefixes = find_shadowed_routes(app_dir)
    
    # Print blueprint prefixes for reference
    print("\nBlueprint Prefixes:")
    for blueprint, prefix in blueprint_prefixes.items():
        print(f"  - {blueprint}_bp: {prefix or '/'}")
    
    if shadowed_routes:
        print("\nFound shadowed routes:")
        for path, methods, routes in shadowed_routes:
            print(f"\nPath: {path}")
            print(f"Methods: {', '.join(methods)}")
            for route in routes:
                blueprint_prefix = blueprint_prefixes.get(route['blueprint'], '')
                print(f"  - Blueprint: {route['blueprint']}, Function: {route['function']}, File: {os.path.basename(route['file'])}")
                print(f"    Full URL: {blueprint_prefix + '/' + route['path'].lstrip('/')}")
        print(f"\nTotal shadowed routes: {len(shadowed_routes)}")
    else:
        print("\nNo shadowed routes found.")
    
    # Collect all routes for additional analysis
    routes_dir = os.path.join(app_dir, 'routes')
    all_routes = []
    for filename in os.listdir(routes_dir):
        if filename.endswith('.py'):
            file_path = os.path.join(routes_dir, filename)
            routes = extract_routes_from_file(file_path)
            all_routes.extend(routes)
    
    # Also find routes with the same path but different methods (not shadowed)
    route_by_path = defaultdict(list)
    for route in all_routes:
        blueprint = route['blueprint']
        prefix = blueprint_prefixes.get(blueprint, '')
        full_path = os.path.join(prefix, route['path'].lstrip('/')).replace('\\', '/')
        if not full_path.startswith('/'):
            full_path = '/' + full_path
        
        route_by_path[full_path].append(route)
    
    multi_method_routes = []
    for path, routes in route_by_path.items():
        if len(routes) > 1:
            # Check if these are different methods for the same path
            methods_by_function = defaultdict(list)
            for route in routes:
                methods_by_function[route['function']].extend(route['methods'])
            
            if len(methods_by_function) > 1:
                multi_method_routes.append((path, routes))
    
    if multi_method_routes:
        print("\nRoutes with the same path but different handlers (different methods):")
        for path, routes in multi_method_routes:
            print(f"\nPath: {path}")
            for route in routes:
                print(f"  - Blueprint: {route['blueprint']}, Function: {route['function']}, Methods: {', '.join(route['methods'])}, File: {os.path.basename(route['file'])}")
        print(f"\nTotal multi-method routes: {len(multi_method_routes)}")

if __name__ == "__main__":
    main()
