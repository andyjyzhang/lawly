import os
from flask import Flask, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
import requests
from pdfminer.high_level import extract_text
from PIL import Image
import asyncio
import pytesseract
import updateDB
import queryDB

# Load environment variables
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Set Tesseract path (for Windows)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Flask setup
app = Flask(__name__)
CORS(app)
app.secret_key = 'your-secret-key'

# Upload folder
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/')
def index():
    print("Index route hit")
    return "API is running"


@app.route('/upload-file', methods=['POST'])
def upload_file():
    print("Upload route was called")
    if 'file' not in request.files:
        return jsonify({"error": "No file part in request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        file_path = os.path.join(UPLOAD_FOLDER, file.filename)
        file.save(file_path)

        # Determine file type and extract text
        ext = file.filename.lower()
        if ext.endswith('.pdf'):
            text = extract_text(file_path)
        elif ext.endswith(('.png', '.jpg', '.jpeg')):
            image = Image.open(file_path)
            text = pytesseract.image_to_string(image)
        else:
            # os.remove(file_path)
            return jsonify({"error": "Unsupported file type"}), 400

        asyncio.run(updateDB.update_db(text, file.filename, session.get('email')))

        # os.remove(file_path)
        # print(text)
        # Send text to OpenAI for summarization
        payload = {
            "model": "gpt-4o-mini",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a helpful assistant named Lawliet that summarizes legal documents."
                },
                {
                    "role": "user",
                    "content": f"Summarize this document:\n\n{text}"
                }
            ],
            "temperature": 0.5,
            "max_tokens": 300
        }

        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }

        response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        response.raise_for_status()
        summary = response.json()['choices'][0]['message']['content']

        return jsonify({"summary": summary})

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    

@app.route('/send-message', methods=['POST'])
def send_message():
    data = request.get_json()
    message = data.get('message')
    doc_name = data.get('doc_name')
    education_mode = data.get('educationMode')

    vector_db_results = queryDB.query_db(10, message, doc_name, session.get('email'))
   
    if not education_mode:
        try:
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant named Lawliet that summarizes legal documents."
                    },
                    {
                        "role": "user",
                        "content": f"USER PROMPT: \"{message}\", \n\n EXTRA CONTEXT FROM LEGAL DOCUMENT: \"{vector_db_results}\""
                    }
                ],
                "temperature": 0.5,
                "max_tokens": 300
            }

            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }

            response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            summary = response.json()['choices'][0]['message']['content']

            return jsonify({"summary": summary})

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500
    
    else:
        try:
            #response 1
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant named Lawliet that summarizes legal documents."
                    },
                    {
                        "role": "user",
                        "content": f"USER PROMPT: \"{message}\", \n\n EXTRA CONTEXT FROM LEGAL DOCUMENT: \"{vector_db_results}\""
                    }
                ],
                "temperature": 0.5,
                "max_tokens": 300
            }

            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }

            response1 = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            response1.raise_for_status()
            summary1 = response1.json()['choices'][0]['message']['content']
           

            #response 2
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful teacher named Lawliet that educates unknowlegeable immigrants about law."
                    },
                    {
                        "role": "user",
                        "content": f"Add along to the response to this question: \"{message}\", by explaining the legal concepts behind it. Response: \"{summary1}\"."
                    }
                ],
                "temperature": 0.5,
                "max_tokens": 300
            }

            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }

            response2 = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
            response2.raise_for_status()
            summary2 = response2.json()['choices'][0]['message']['content']

            return jsonify({"summary": summary2})

        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({"error": str(e)}), 500


@app.route('/save-user', methods=['POST'])
def save_user():
    data = request.get_json()
    email = data.get('email')
    session['email'] = email
    return jsonify({"message": "User saved successfully"})
    
@app.route('/file-list', methods=['GET'])
def file_list():
    try:
        files = queryDB.query_db_files(session.get('email'))
        return jsonify(files)   
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
