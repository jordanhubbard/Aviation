#!/usr/bin/env python3
"""
Script to identify potential dead code in the FlightSchool application.
This script looks for:
1. Unused imports
2. Unused functions and methods
3. Unused routes (routes that are defined but not referenced in templates)
4. Unused variables
"""

import os
import re
import ast
import sys
from collections import defaultdict, Counter

class DeadCodeFinder:
    def __init__(self, app_dir):
        self.app_dir = app_dir
        self.python_files = []
        self.template_files = []
        self.route_definitions = []
        self.route_usages = []
        self.unused_routes = []
        self.unused_functions = []
        self.unused_imports = []
        
    def find_files(self):
        """Find all Python and template files in the application."""
        for root, dirs, files in os.walk(self.app_dir):
            for file in files:
                if file.endswith('.py'):
                    self.python_files.append(os.path.join(root, file))
                elif file.endswith(('.html', '.jinja', '.jinja2')):
                    self.template_files.append(os.path.join(root, file))
        
        print(f"Found {len(self.python_files)} Python files and {len(self.template_files)} template files")
    
    def extract_route_definitions(self):
        """Extract all route definitions from Python files."""
        route_pattern = r'@(\w+)_bp\.route\([\'"](.+?)[\'"](,|\))'
        
        for file_path in self.python_files:
            with open(file_path, 'r') as f:
                content = f.read()
            
            matches = re.findall(route_pattern, content)
            for match in matches:
                blueprint_name, route_path, _ = match
                
                # Find the function name associated with this route
                func_pattern = r'@' + re.escape(blueprint_name) + r'_bp\.route\([\'"]' + re.escape(route_path) + r'[\'"](.*?)\)\s+def (\w+)\('
                func_matches = re.findall(func_pattern, content, re.DOTALL)
                func_name = func_matches[0][1] if func_matches else "unknown"
                
                self.route_definitions.append({
                    'blueprint': blueprint_name,
                    'path': route_path,
                    'function': func_name,
                    'file': file_path
                })
        
        print(f"Found {len(self.route_definitions)} route definitions")
    
    def extract_route_usages(self):
        """Extract all route usages from template files."""
        url_for_pattern = r'url_for\([\'"](\w+)\.(\w+)[\'"]'
        
        for file_path in self.template_files:
            with open(file_path, 'r') as f:
                content = f.read()
            
            matches = re.findall(url_for_pattern, content)
            for match in matches:
                blueprint_name, func_name = match
                self.route_usages.append({
                    'blueprint': blueprint_name,
                    'function': func_name,
                    'file': file_path
                })
        
        print(f"Found {len(self.route_usages)} route usages in templates")
    
    def find_unused_routes(self):
        """Find routes that are defined but not used in templates."""
        used_routes = set()
        for usage in self.route_usages:
            used_routes.add((usage['blueprint'], usage['function']))
        
        for route in self.route_definitions:
            if (route['blueprint'], route['function']) not in used_routes:
                # Skip certain common routes that might be called programmatically
                if route['function'] in ['login', 'logout', 'register', 'static']:
                    continue
                self.unused_routes.append(route)
        
        print(f"Found {len(self.unused_routes)} potentially unused routes")
    
    def find_unused_functions(self):
        """Find functions that are defined but not called."""
        # This is a simplified approach - a more thorough analysis would use AST
        function_definitions = []
        function_calls = []
        
        for file_path in self.python_files:
            with open(file_path, 'r') as f:
                content = f.read()
            
            # Find function definitions
            func_def_pattern = r'def (\w+)\('
            func_defs = re.findall(func_def_pattern, content)
            for func_name in func_defs:
                function_definitions.append({
                    'name': func_name,
                    'file': file_path
                })
            
            # Find function calls
            func_call_pattern = r'(\w+)\('
            func_calls = re.findall(func_call_pattern, content)
            for func_name in func_calls:
                function_calls.append(func_name)
        
        # Count function calls
        call_counts = Counter(function_calls)
        
        # Find functions that are never called
        for func in function_definitions:
            # Skip route handler functions and special methods
            if func['name'].startswith('__') or func['name'] in ['app_context', 'teardown_appcontext']:
                continue
                
            # Check if this is a route handler
            is_route_handler = False
            for route in self.route_definitions:
                if route['function'] == func['name']:
                    is_route_handler = True
                    break
            
            if is_route_handler:
                continue
                
            if call_counts[func['name']] <= 1:  # Only count as unused if called 0 or 1 times (definition counts as a "call")
                self.unused_functions.append(func)
        
        print(f"Found {len(self.unused_functions)} potentially unused functions")
    
    def find_unused_imports(self):
        """Find imports that are not used."""
        for file_path in self.python_files:
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                
                # Parse the file with AST
                tree = ast.parse(content)
                
                # Find all imports
                imports = []
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        for name in node.names:
                            imports.append(name.name)
                    elif isinstance(node, ast.ImportFrom):
                        module = node.module
                        for name in node.names:
                            if name.name == '*':
                                imports.append(f"{module}.*")
                            else:
                                imports.append(f"{module}.{name.name}")
                
                # Find all names used in the file
                names_used = set()
                for node in ast.walk(tree):
                    if isinstance(node, ast.Name):
                        names_used.add(node.id)
                
                # Check which imports are not used
                for imp in imports:
                    # Skip common modules that might be imported for side effects
                    if imp in ['flask', 'flask_login', 'app', 'app.models', 'app.forms']:
                        continue
                    
                    # Check if any part of the import is used
                    parts = imp.split('.')
                    used = False
                    for i in range(len(parts)):
                        if '.'.join(parts[:i+1]) in names_used or parts[i] in names_used:
                            used = True
                            break
                    
                    if not used:
                        self.unused_imports.append({
                            'import': imp,
                            'file': file_path
                        })
            except SyntaxError:
                print(f"Syntax error in {file_path}, skipping")
                continue
        
        print(f"Found {len(self.unused_imports)} potentially unused imports")
    
    def run_analysis(self):
        """Run the complete dead code analysis."""
        self.find_files()
        self.extract_route_definitions()
        self.extract_route_usages()
        self.find_unused_routes()
        self.find_unused_functions()
        self.find_unused_imports()
        
        # Print results
        if self.unused_routes:
            print("\nPotentially unused routes:")
            for route in self.unused_routes:
                print(f"  - {route['blueprint']}.{route['function']} ({os.path.basename(route['file'])}): {route['path']}")
        
        if self.unused_functions:
            print("\nPotentially unused functions:")
            for func in self.unused_functions:
                print(f"  - {func['name']} in {os.path.basename(func['file'])}")
        
        if self.unused_imports:
            print("\nPotentially unused imports:")
            for imp in self.unused_imports:
                print(f"  - {imp['import']} in {os.path.basename(imp['file'])}")

def main():
    app_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'app')
    
    print("Analyzing FlightSchool application for dead code...")
    finder = DeadCodeFinder(app_dir)
    finder.run_analysis()

if __name__ == "__main__":
    main()
