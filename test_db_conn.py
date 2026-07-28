import psycopg2
import boto3
import getpass
import os

password = os.environ.get("DB_PASSWORD")
if not password:
    password = getpass.getpass("Enter DB Password: ")

conn = None
try:
    print("Connecting to the database...")
    conn = psycopg2.connect(
        host='voice2form.chao2mq0kbqr.eu-north-1.rds.amazonaws.com',
        port=5432,
        database='postgres',
        user='kailasvs_v2f',
        password=password,
        sslmode='verify-full',
        sslrootcert='./global-bundle.pem'
    )
    cur = conn.cursor()
    cur.execute('SELECT version();')
    print("Connection successful!")
    print("PostgreSQL Version:")
    print(cur.fetchone()[0])
    cur.close()
except Exception as e:
    print(f"Database error: {e}")
    raise
finally:
    if conn:
        conn.close()
