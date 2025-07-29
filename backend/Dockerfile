# Use lightweight Python base image
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

RUN python -m nltk.downloader punkt stopwords

COPY . .

EXPOSE 5000

# Run with Gunicorn
CMD ["gunicorn", "run:app", "--bind", "0.0.0.0:5000", "--workers", "4"]