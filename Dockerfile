FROM python:3.12-slim

WORKDIR /app

# Copy all frontend files
COPY . .

EXPOSE 8000

# Serve static files on port 8000
CMD ["python3", "-m", "http.server", "8000"]
