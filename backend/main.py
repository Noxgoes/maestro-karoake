import os
import tempfile
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Try to automatically load environment variables from the shared .env file in the root directory
try:
    from dotenv import load_dotenv
    dotenv_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(dotenv_path):
        print(f"[FASTAPI] Loading environment variables from {dotenv_path}")
        load_dotenv(dotenv_path)
except ImportError:
    pass

app = FastAPI()

# Enable CORS for frontend and server communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

RAPIDAPI_KEY = os.environ.get("RAPIDAPI_KEY", "")

# Mock or standard Whisper/Basic Pitch model placeholder
class ModelPlaceholder:
    def transcribe(self, path, word_timestamps=True):
        return {"text": "Whisper transcription placeholder", "segments": []}

try:
    # Try importing Whisper or real model if installed
    import whisper
    model = whisper.load_model("base")
except ImportError:
    model = ModelPlaceholder()

@app.post("/api/transcribe")
async def transcribe(body: dict):
    url = body.get("url")
    tmp_path = None
    
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")
        
    try:
        if "youtube" in url or "youtu.be" in url:
            # Extract video ID
            video_id = ""
            if "v=" in url:
                video_id = url.split("v=")[-1].split("&")[0]
            elif "youtu.be/" in url:
                video_id = url.split("youtu.be/")[-1].split("?")[0]
                
            if not video_id:
                raise HTTPException(status_code=400, detail="Invalid YouTube URL")
                
            print(f"[FASTAPI] Fetching YouTube audio stream via RapidAPI for video ID: {video_id}")
            
            # Get MP3 from RapidAPI
            r = requests.get(
                "https://youtube-mp36.p.rapidapi.com/dl",
                params={"id": video_id},
                headers={
                    "X-RapidAPI-Key": RAPIDAPI_KEY,
                    "X-RapidAPI-Host": "youtube-mp36.p.rapidapi.com"
                },
                timeout=15
            )
            
            res_data = r.json()
            if r.status_code != 200 or not res_data.get("link"):
                raise HTTPException(status_code=502, detail="Failed to fetch direct MP3 link from RapidAPI converter")
                
            audio_url = res_data["link"]
            print(f"[FASTAPI] Downloading audio from RapidAPI proxy: {audio_url}")
            
            # Download it
            audio_data = requests.get(audio_url, timeout=30).content
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
                f.write(audio_data)
                tmp_path = f.name
        else:
            # Direct media download
            print(f"[FASTAPI] Downloading direct media URL: {url}")
            audio_data = requests.get(url, timeout=30).content
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as f:
                f.write(audio_data)
                tmp_path = f.name
        
        # Run Whisper on tmp_path
        print(f"[FASTAPI] Transcribing media file: {tmp_path}")
        result = model.transcribe(tmp_path, word_timestamps=True)
        
        # Clean up temporary file
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except Exception as e:
            print(f"[WARN] Failed to delete temp file: {e}")
            
        return result
        
    except Exception as err:
        # Clean up temporary file in case of error
        try:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)
        except _:
            pass
        raise HTTPException(status_code=500, detail=str(err))
