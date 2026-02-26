# storage_adapter.py

class StorageAdapterInterface:
    def save(self, data):
        raise NotImplementedError('Save method not implemented')

    def load(self, identifier):
        raise NotImplementedError('Load method not implemented')

class CloudStorageStub(StorageAdapterInterface):
    def save(self, data):
        print(f"Stub: Saving {data} to cloud storage")

    def load(self, identifier):
        print(f"Stub: Loading data with identifier {identifier} from cloud storage")
        return None

# Feature flag for enabling cloud storage
ENABLE_CLOUD_STORAGE = False
