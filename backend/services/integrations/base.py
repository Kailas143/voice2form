from abc import ABC, abstractmethod

class BaseIntegration(ABC):
    @abstractmethod
    async def handle_event(self, event_name: str, payload: dict, config: dict, credentials: dict) -> None:
        """
        Handle an integration event (e.g. 'submission.created').
        """
        pass

    @abstractmethod
    async def test_connection(self, config: dict, credentials: dict) -> bool:
        """
        Test if the provided config/credentials are valid.
        """
        pass
