import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from app.main import app
from app.v1.dependencies.auth import get_current_user
from app.v1.schemas.user import UserRead

@pytest.mark.anyio
async def test_clear_cache_endpoint():
    # Mock admin user
    mock_user = UserRead(
        id="019eeba2-0d69-7f1b-a53e-84f8dec4db07",
        email="admin@example.com",
        is_active=True,
        is_superuser=True,
        first_name="Admin",
        last_name="User",
        role_id="019eeba2-0d69-7f1b-a53e-84f8dec4db07",
        role_name="admin",
        permissions=["system:manage"],
    )
    
    app.dependency_overrides[get_current_user] = lambda: mock_user
    client = TestClient(app)
    
    try:
        # Mock clear_cache service method
        with patch("app.v1.routes.admin_system.admin_service.clear_cache", new_callable=AsyncMock) as mock_clear:
            mock_clear.return_value = True
            
            # Test clearing cache with a single pattern
            response = client.delete("/api/v1/admin/cache?pattern=jobs")
            assert response.status_code == 200
            assert response.json()["data"] is True
            mock_clear.assert_called_with(pattern=["jobs"])
            
            # Test clearing cache with multiple patterns
            response = client.delete("/api/v1/admin/cache?pattern=jobs&pattern=analytics")
            assert response.status_code == 200
            assert response.json()["data"] is True
            mock_clear.assert_called_with(pattern=["jobs", "analytics"])
            
            # Test clearing cache with no pattern
            response = client.delete("/api/v1/admin/cache")
            assert response.status_code == 200
            assert response.json()["data"] is True
            mock_clear.assert_called_with(pattern=None)

    finally:
        app.dependency_overrides.clear()
