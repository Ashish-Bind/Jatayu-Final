# Use lightweight Python base image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Install OS dependencies for required Python packages
# RUN apt-get update && apt-get install -y --no-install-recommends \
#     build-essential \
#     libffi-dev \
#     libssl-dev \
#     libxml2-dev \
#     libxslt1-dev \
#     libjpeg-dev \
#     zlib1g-dev \
#     libgl1-mesa-glx \
#     git \
#     curl \
#     gcc \
#     && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Expose port (change if needed)
EXPOSE 5000

# Run the Flask app
CMD ["python", "run.py"]
