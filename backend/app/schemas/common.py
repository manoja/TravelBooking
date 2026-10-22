from typing import Annotated, ClassVar, Generic, TypeVar

from pydantic import AfterValidator, BaseModel, Field, model_validator

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    page: int
    page_size: int
    total: int
    total_pages: int


class PageParams(BaseModel):
    page: Annotated[int, Field(ge=1, le=100_000)] = 1
    page_size: Annotated[int, Field(ge=1, le=100)] = 20


def build_page(items: list, total: int, page: int, page_size: int) -> dict:
    return {
        "items": items,
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (total + page_size - 1) // page_size,
    }


def _http_url(value: str) -> str:
    if not value.lower().startswith(("http://", "https://")):
        raise ValueError("must be an http(s) URL")
    return value


HttpUrlText = Annotated[str, Field(max_length=2000), AfterValidator(_http_url)]


class PatchModel(BaseModel):
    """PATCH body: omitted fields stay unchanged; listed fields cannot be set to null."""

    not_null: ClassVar[frozenset[str]] = frozenset()

    @model_validator(mode="after")
    def _reject_nulls(self):
        for field in self.model_fields_set & self.not_null:
            if getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null")
        return self
