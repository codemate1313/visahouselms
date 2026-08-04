import urllib.request
import json

# 1. Login to get token
req = urllib.request.Request(
    'http://127.0.0.1:8000/auth/login',
    data=json.dumps({"email": "superadmin@gmail.com", "password": "password"}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
try:
    resp = urllib.request.urlopen(req)
    token = json.loads(resp.read())['access_token']
except Exception as e:
    print("Login failed:", e)
    exit(1)

# 2. Try creating institute
payload = {
    "name": "Test Institute",
    "session_duration_hours": 24,
    "student_limit": 50,
    "staff_limit": 0,
    "access_duration_days": 365,
    "grace_days": 0,
    "module_ids": [],
    "agreement_reference": "REF123",
    "agreed_amount": 1000,
    "amount_received": 1000,
    "currency": "INR",
    "payment_method_id": 1,
    "admin_email": "admin2@test.com",
    "admin_first_name": "Admin",
    "admin_last_name": ""
}

req2 = urllib.request.Request(
    'http://127.0.0.1:8000/super-admin/institutes',
    data=json.dumps(payload).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'}
)
try:
    resp2 = urllib.request.urlopen(req2)
    print("Success:", resp2.read())
except urllib.error.HTTPError as e:
    print("Error:", e.code, e.read().decode('utf-8'))
