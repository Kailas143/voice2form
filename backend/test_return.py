def test(text):
    return text.strip() if isinstance(text, str) else "", {"a": 1}, 100

t, u, l = test("  hello  ")
print("t type:", type(t))
print("t:", repr(t))
