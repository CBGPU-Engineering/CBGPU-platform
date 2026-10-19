FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./

EXPOSE 8421
HEALTHCHECK --interval=30s --timeout=8s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8421/health', timeout=6).read()"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8421"]
