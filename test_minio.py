import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Load environment variables from backend/.env
env_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')
print(f"Loading env from {env_path}")
load_dotenv(env_path)

endpoint_url = 'http://localhost:9300'
access_key = os.getenv('MINIO_ROOT_USER')
secret_key = os.getenv('MINIO_ROOT_PASSWORD')
bucket_name = os.getenv('MINIO_STORAGE_BUCKET_NAME', 'hostinger-uploads')

print(f"Connecting to MinIO at {endpoint_url}")
print(f"User: {access_key}")
print(f"Bucket: {bucket_name}")

s3 = boto3.client(
    's3',
    endpoint_url=endpoint_url,
    aws_access_key_id=access_key,
    aws_secret_access_key=secret_key,
    region_name='us-east-1'
)

try:
    response = s3.list_buckets()
    print("Connection successful!")
    print("Buckets:")
    for bucket in response['Buckets']:
        print(f" - {bucket['Name']}")

    # Check if our bucket exists
    found = False
    for bucket in response['Buckets']:
        if bucket['Name'] == bucket_name:
            found = True
            break
    
    if found:
        print(f"Bucket '{bucket_name}' exists.")
        # Try to list objects
        print(f"Listing objects in '{bucket_name}':")
        objs = s3.list_objects_v2(Bucket=bucket_name)
        if 'Contents' in objs:
            for obj in objs['Contents'][:5]:
                print(f" - {obj['Key']}")
        else:
            print(" - Bucket is empty")
    else:
        print(f"Bucket '{bucket_name}' NOT found!")

except ClientError as e:
    print(f"Error connecting to MinIO: {e}")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
