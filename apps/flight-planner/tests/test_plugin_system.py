import json
import sys
import unittest
from app.plugins.loader import PluginLoader
from app.plugins.registry import PluginRegistry
from app.plugins.base import Plugin, PluginContext, PluginMetadata
import os


class TestPluginSystem(unittest.TestCase):

    def setUp(self):
        self.plugin_directory = 'test_plugins'
        os.makedirs(self.plugin_directory, exist_ok=True)
        # Create __init__.py so the directory is a package
        init_path = os.path.join(self.plugin_directory, '__init__.py')
        with open(init_path, 'w') as f:
            f.write('')
        # Create a minimal concrete Plugin class for the loader to instantiate
        plugin_py = os.path.join(self.plugin_directory, 'test_plugin.py')
        with open(plugin_py, 'w') as f:
            f.write(
                "from app.plugins.base import Plugin, PluginContext, PluginMetadata\n\n"
                "class TestPlugin(Plugin):\n"
                "    async def initialize(self, context: PluginContext) -> None:\n"
                "        pass\n"
                "    async def destroy(self) -> None:\n"
                "        pass\n"
            )
        self.loader = PluginLoader(self.plugin_directory)
        self.registry = PluginRegistry()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.plugin_directory, ignore_errors=True)
        # Remove the package from sys.modules so teardown is clean
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
