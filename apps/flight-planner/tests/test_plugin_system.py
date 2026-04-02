import json
import unittest
from app.plugins.loader import PluginLoader
from app.plugins.registry import PluginRegistry
from app.plugins.base import PluginMetadata
import os

class TestPluginSystem(unittest.TestCase):

    def setUp(self):
        self.plugin_directory = 'test_plugins'
        os.makedirs(self.plugin_directory, exist_ok=True)
        # Create a minimal plugin module so the entry_point can be imported
        init_path = os.path.join(self.plugin_directory, '__init__.py')
        plugin_path = os.path.join(self.plugin_directory, 'test_plugin.py')
        open(init_path, 'w').close()
        with open(plugin_path, 'w') as f:
            f.write(
                "from app.plugins.base import Plugin, PluginMetadata\n"
                "class TestPlugin(Plugin):\n"
                "    def __init__(self, metadata):\n"
                "        super().__init__(metadata)\n"
                "    def initialize(self, context): pass\n"
                "    def start(self): pass\n"
                "    def stop(self): pass\n"
                "    def destroy(self): pass\n"
            )
        # Ensure test_plugins is importable from the current working directory
        import sys
        if os.getcwd() not in sys.path:
            sys.path.insert(0, os.getcwd())
        self.loader = PluginLoader(self.plugin_directory)
        self.registry = PluginRegistry()

    def tearDown(self):
        import shutil
        import sys
        shutil.rmtree(self.plugin_directory, ignore_errors=True)
        # Clean up cached module so other tests start fresh
        for key in list(sys.modules.keys()):
            if key.startswith('test_plugins'):
                del sys.modules[key]

    def test_load_and_register_plugin(self):
        manifest_content = {
            "id": "test-plugin",
            "name": "Test Plugin",
            "version": "1.0",
            "entry_point": "test_plugins.test_plugin.TestPlugin"
        }
        manifest_path = os.path.join(self.plugin_directory, 'test_plugin.json')
        with open(manifest_path, 'w') as f:
            json.dump(manifest_content, f)

        plugins = self.loader.load_plugins()
        self.assertEqual(len(plugins), 1)

        plugin_metadata = plugins[0].metadata
        self.registry.register(plugin_metadata)
        self.assertIn(plugin_metadata.id, self.registry.plugins)

if __name__ == '__main__':
    unittest.main()
