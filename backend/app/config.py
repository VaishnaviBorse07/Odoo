from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    # If tables live in a named schema (e.g. DBeaver: Database "postgres" → Schema "reimbursement_db"),
    # set this so the API sees the same tables. Example: reimbursement_db,public
    DB_SEARCH_PATH: str = ""

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    EXCHANGE_RATE_BASE_URL: str = "https://api.exchangerate-api.com/v4/latest"
    COUNTRIES_API_URL: str = "https://restcountries.com/v3.1/all?fields=name,currencies"

    UPLOAD_DIR: str = "uploads"
    TESSERACT_CMD: str = "tesseract"

    FRONTEND_ORIGIN: str = "http://localhost:5173"


@lru_cache
def get_settings() -> Settings:
    return Settings()
