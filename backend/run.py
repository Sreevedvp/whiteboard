import os
import sys
import uvicorn

# Ensure the backend directory is in the Python search path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"🚀 Starting Whiteboard FastAPI Server on http://0.0.0.0:{port} ...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
