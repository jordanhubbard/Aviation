class Plugin:
    def __init__(self, plugin_id, name, version):
        self.plugin_id = plugin_id
        self.name = name
        self.version = version

class PluginLoadError(Exception):
    pass

class PluginContext:
    pass

class PluginMetadata:
    pass

class PluginState:
    pass

class PluginError(Exception):
    pass

class PluginInitError(Exception):
    pass
