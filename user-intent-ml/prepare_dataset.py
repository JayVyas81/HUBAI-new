# Save this file as user-intent-ml/prepare_dataset.py

import pandas as pd
import json
import os

print("Starting dataset preparation...")

# Define the paths for the input CSV and the output JSON file
input_csv_path = os.path.join('data', 'website_classification.csv')
output_json_path = os.path.join('data', 'labeled_data.json')

# --- 1. Read the CSV file ---
try:
    # Use pandas to read the CSV. It's great for handling large data files.
    df = pd.read_csv(input_csv_path)
    print(f"Successfully loaded {len(df)} rows from {input_csv_path}")
except FileNotFoundError:
    print(f"ERROR: The file was not found at {input_csv_path}")
    print("Please make sure you have downloaded the dataset and placed it in the 'data' directory.")
    exit()

# --- 2. Clean and Format the Data ---
# We assume the CSV has columns 'website_url' and 'Category'
# Let's rename them to match the format our trainer expects ('url', 'category')
df.rename(columns={'website_url': 'url', 'Category': 'category'}, inplace=True)

# Select only the columns we need
df = df[['url', 'category']]

# Drop any rows that are missing a URL or a category
df.dropna(subset=['url', 'category'], inplace=True)

# Add 'https://www.' to URLs that don't have a scheme, as the requests library needs it
def format_url(url):
    if not url.startswith('http'):
        return 'https://www.' + url
    return url

df['url'] = df['url'].apply(format_url)

print(f"Cleaned data has {len(df)} rows.")

# --- 3. Convert to JSON format and Save ---
# Convert the pandas DataFrame to a list of dictionaries, which is the JSON format we need
output_data = df.to_dict(orient='records')

with open(output_json_path, 'w') as f:
    json.dump(output_data, f, indent=2)

print(f"\n✅ Successfully converted the dataset and saved it to {output_json_path}")
print("You are now ready to train your powerful new AI model.")

