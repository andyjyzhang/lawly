# imports
import os
import json
import asyncio
from math import ceil

from pinecone.grpc import PineconeGRPC as Pinecone
from pinecone import ServerlessSpec

from dotenv import load_dotenv

from datetime import datetime

import csv


load_dotenv()  # Load environment variables



#vector db functions
def chunking_data(data):
    split_data = data.split()
    chunked_data = []

    for i in range(0, len(split_data), 20):
        chunked_data.append(split_data[i : min(i+30, len(split_data))])

    return chunked_data
        


async def update_db(data, name, user_namespace):
    chunked_data = chunking_data(data)

    batch_size = 100
    total_batches = ceil(len(chunked_data) / batch_size)

    try:
        PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
        pc = Pinecone(api_key=PINECONE_API_KEY)
    except Exception as e:
        return

    embeddings = []
    for i in range(total_batches):
        batch = chunked_data[i * batch_size : (i + 1) * batch_size]
        try:
            batch_data = [" ".join(d) for d in batch]
            batch_embeddings = pc.inference.embed(
                model="llama-text-embed-v2",
                inputs=batch_data,
                parameters={
                    "input_type": "passage",
                    "truncate": "END"
                }
            )
            embeddings.extend(batch_embeddings)
        except Exception as e:
            print(f"Embedding error in batch {i}: {e}")
            continue

    try:
        records = []
        count = 0
        for d, e in zip(chunked_data, embeddings):
            records.append({
                "id": f"{name}{count}",
                "values": e["values"],
                "metadata": {
                    "doc_name": name,
                    "text": " ".join(d)
                }
            })
            count = count + 1
    except Exception as e:
        return

    try:
        index = pc.Index(host=os.getenv('PINECONE_HOST'))
        index.upsert(
            vectors=records,
            namespace=user_namespace
        )
    except Exception as e:
        return