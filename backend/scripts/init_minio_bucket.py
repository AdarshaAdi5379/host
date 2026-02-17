import boto3
import os
import json
from botocore.client import Config

from dotenv import load_dotenv

# Load env variables from backend/.env
# Assuming script is run from backend dir
load_dotenv('.env')

# Configuration
ENDPOINT = 'http://localhost:9300'
ACCESS_KEY = os.getenv('MINIO_ROOT_USER')
SECRET_KEY = os.getenv('MINIO_ROOT_PASSWORD')
BUCKET_NAME = 'hostinger-uploads'

def init_bucket():
    print(f"Connecting to MinIO at {ENDPOINT}...")
    s3 = boto3.client('s3',
                      endpoint_url=ENDPOINT,
                      aws_access_key_id=ACCESS_KEY,
                      aws_secret_access_key=SECRET_KEY,
                      config=Config(signature_version='s3v4'),
                      region_name='us-east-1')

    try:
        s3.head_bucket(Bucket=BUCKET_NAME)
        print(f"Bucket '{BUCKET_NAME}' already exists.")
    except Exception:
        print(f"Creating bucket '{BUCKET_NAME}'...")
        s3.create_bucket(Bucket=BUCKET_NAME)
        print("Bucket created successfully.")

    # Set Public Policy (Optional but good for static files)
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicRead",
                "Effect": "Allow",
                "Principal": "*",
                "Action": ["s3:GetObject"],
                "Resource": [f"arn:aws:s3:::{BUCKET_NAME}/*"]
            }
        ]
    }
    
    print("Setting public read policy...")
    s3.put_bucket_policy(Bucket=BUCKET_NAME, Policy=json.dumps(policy))
    print("Policy set.")

if __name__ == '__main__':
    init_bucket()
