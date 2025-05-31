#FROM python:3.12-slim

#RUN apt-get update && apt-get install -y \
#    tesseract-ocr \
#    libtesseract-dev \
#    && apt-get clean && rm -rf /var/lib/apt/lists/*

#WORKDIR /app
#COPY requirements.txt .
#RUN pip install --no-cache-dir -r requirements.txt
#COPY . .

#CMD ["python", "main.py"]


FROM python:3.12-slim

RUN apt-get update && apt-get install -y build-essential \
    libglib2.0-0 libsm6 libxext6 libxrender-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

RUN pip install --upgrade pip
RUN pip install paddleocr pandas uvicorn[standard] fastapi

CMD ["python", "main.py"]
