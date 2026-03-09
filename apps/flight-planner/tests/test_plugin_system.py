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
        self.loader = PluginLoader(self.plugin_directory)
        self.registry = PluginRegistry()

    def tearDown(self):
        for filename in os.listdir(self.plugin_directory):
            file_path = os.path.join(self.plugin_directory, filename)
            if os.path.isfile(file_path):
                os.unlink(file_path)
        os.rmdir(self.plugin_directory)

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
