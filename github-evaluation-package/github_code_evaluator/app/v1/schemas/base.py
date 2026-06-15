from pydantic import BaseModel


class MessageResponse(BaseModel):
    """Common payload format to return message statuses."""

    message: str
