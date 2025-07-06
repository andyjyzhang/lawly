#imports
from pinecone.grpc import PineconeGRPC as Pinecone

from dotenv import load_dotenv
import os



load_dotenv() #import environment variables 



def query_db(top_n, query, name, user_namespace):

    #initialize pinecone client
    PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
    pc = Pinecone(api_key=PINECONE_API_KEY)

    #target index
    index = pc.Index(host=os.getenv('PINECONE_HOST'))

    #convert query into embedding
    query_embedding = pc.inference.embed(
        model="llama-text-embed-v2",
        inputs=[query],
        parameters={
            "input_type": "query"
        }
    )
    
    
    #search index for top_n most similar vectors
    results = index.query(
        namespace=user_namespace,
        vector=query_embedding[0].values,
        top_k=top_n,
        include_values=False,
        include_metadata=True,
        filter=(
            {"doc_name": name}
        )
    )

    formatted_results = [r["metadata"]["text"] for r in results["matches"]]
    return formatted_results



def query_db_files(user_namespace):
    #initialize pinecone client
    PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
    pc = Pinecone(api_key=PINECONE_API_KEY)

    #target index
    index = pc.Index(host=os.getenv('PINECONE_HOST'))

    #convert query into embedding
    query_embedding = pc.inference.embed(
        model="llama-text-embed-v2",
        inputs=["FILLER_INPUT"],
        parameters={
            "input_type": "query"
        }
    )
    
    #search index for top_n most similar vectors
    results = index.query(
        namespace=user_namespace,
        vector=query_embedding[0].values,
        top_k=100,
        include_values=False,
        include_metadata=True,
    )


    unique_results = []
    seen_doc_names = set()

    for match in results['matches']:
        doc_name = match['metadata']['doc_name']
        if doc_name not in seen_doc_names:
            unique_results.append(doc_name)
            seen_doc_names.add(doc_name)

        # stop when you've collected enough unique results
        if len(unique_results) >= 20:
            break
    
    return unique_results