import requests

url = "http://localhost:8000/api/templates"
print(requests.get(url).json())
