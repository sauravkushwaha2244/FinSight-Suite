import pytest
from fastapi.testclient import TestClient
from main import app
from app.db import init_db, get_db_connection

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ["ok", "healthy"]

def test_login_success():
    response = client.post(
        "/auth/login",
        json={"email": "admin@finsight.com", "password": "admin123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@finsight.com"

def test_login_invalid_password():
    response = client.post(
        "/auth/login",
        json={"email": "admin@finsight.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]

def test_register_and_authenticate():
    import uuid
    rand_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/auth/register",
        json={
            "email": rand_email,
            "password": "securepassword123",
            "full_name": "Test User",
            "role": "admin",
        },
    )
    assert response.status_code == 201
    token = response.json()["access_token"]
    assert token is not None

    # Test authenticated endpoint
    auth_header = {"Authorization": f"Bearer {token}"}
    me_resp = client.get("/auth/me", headers=auth_header)
    assert me_resp.status_code == 200
    assert me_resp.json()["user"]["email"] == rand_email

def test_unauthenticated_request_rejected():
    response = client.get("/budget/recommendations")
    assert response.status_code == 401
