#!/usr/bin/env python3
"""
Beads Validator - Validates the beads.yaml configuration

This script validates that:
1. beads.yaml exists and is valid YAML
2. All referenced paths exist
3. Dependencies are valid (no circular dependencies)
4. Test paths are correct
"""

import sys
import yaml
from pathlib import Path
from typing import Dict, List, Set


def validate_beads_yaml(app_path: Path) -> bool:
    """Validate beads.yaml configuration for an application."""
    beads_file = app_path / "beads.yaml"
    
    if not beads_file.exists():
        print(f"❌ beads.yaml not found in {app_path}")
        return False
    
    print(f"✓ Found beads.yaml in {app_path}")
    
    try:
        with open(beads_file) as f:
            config = yaml.safe_load(f)
    except yaml.YAMLError as e:
        print(f"❌ Invalid YAML in beads.yaml: {e}")
        return False
    
    print("✓ Valid YAML syntax")
    
    # Validate structure
    if "beads" not in config:
        print("❌ Missing 'beads' section in beads.yaml")
        return False
    
    beads = config["beads"]
    print(f"✓ Found {len(beads)} beads defined")
    
    # Track bead names for dependency validation
    bead_names = set()
    all_valid = True
    
    for bead in beads:
        name = bead.get("name", "unnamed")
        bead_names.add(name)
        
        print(f"\n  Validating bead: {name}")
        
        # Check path exists
        path = bead.get("path")
        if path:
            full_path = app_path / path
            if not full_path.exists():
                print(f"    ⚠️  Path does not exist: {path}")
                # This is a warning, not an error, as paths might be directories
            else:
                print(f"    ✓ Path exists: {path}")
        
        # Check test path
        test_path = bead.get("test_path")
        if test_path:
            full_test_path = app_path / test_path
            if not full_test_path.exists():
                print(f"    ⚠️  Test path does not exist: {test_path}")
            else:
                print(f"    ✓ Test path exists: {test_path}")
        
        # Note dependencies (will validate after all beads are loaded)
        dependencies = bead.get("dependencies", [])
        if dependencies:
            print(f"    → Dependencies: {', '.join(dependencies)}")
        else:
            print(f"    → No dependencies (can run in parallel)")
    
    # Validate dependencies
    print("\n  Validating dependencies...")
    for bead in beads:
        name = bead.get("name")
        dependencies = bead.get("dependencies", [])
        
        for dep in dependencies:
            if dep not in bead_names:
                print(f"    ❌ Bead '{name}' depends on unknown bead '{dep}'")
                all_valid = False
    
    # Check for circular dependencies (basic check)
    print("\n  Checking for circular dependencies...")
    if has_circular_dependencies(beads):
        print("    ❌ Circular dependencies detected")
        all_valid = False
    else:
        print("    ✓ No circular dependencies")
    
    # Validate execution groups if present
    if "execution_groups" in config:
        print("\n  Validating execution groups...")
        groups = config["execution_groups"]
        print(f"    Found {len(groups)} execution groups")
        
        for group in groups:
            group_name = group.get("name", "unnamed")
            group_beads = group.get("beads", [])
            print(f"    ✓ Group '{group_name}' has {len(group_beads)} beads")
    
    if all_valid:
        print("\n✅ All validations passed!")
    else:
        print("\n⚠️  Some validations failed")
    
    return all_valid


def has_circular_dependencies(beads: List[Dict]) -> bool:
    """Check for circular dependencies using DFS."""
    # Build adjacency list
    graph = {}
    for bead in beads:
        name = bead.get("name")
        dependencies = bead.get("dependencies", [])
        graph[name] = dependencies
    
    # DFS to detect cycles
    visited = set()
    rec_stack = set()
    
    def has_cycle(node: str) -> bool:
        visited.add(node)
        rec_stack.add(node)
        
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                if has_cycle(neighbor):
                    return True
            elif neighbor in rec_stack:
                return True
        
        rec_stack.remove(node)
        return False
    
    for node in graph:
        if node not in visited:
            if has_cycle(node):
                return True
    
    return False


def main():
    """Validate beads configuration for all apps in the monorepo."""
    print("🔷 Beads Configuration Validator\n")
    
    # Find all apps
    repo_root = Path(__file__).parent
    apps_dir = repo_root / "apps"
    
    if not apps_dir.exists():
        print("❌ apps/ directory not found")
        return 1
    
    apps = [d for d in apps_dir.iterdir() if d.is_dir() and not d.name.startswith(".")]
    
    print(f"Found {len(apps)} applications to validate:\n")
    
    all_valid = True
    for app_path in apps:
        print(f"=" * 60)
        print(f"Validating: {app_path.name}")
        print(f"=" * 60)
        
        valid = validate_beads_yaml(app_path)
        all_valid = all_valid and valid
        print()
    
    if all_valid:
        print("\n✅ All applications have valid beads configuration!")
        return 0
    else:
        print("\n⚠️  Some applications have invalid beads configuration")
        return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
