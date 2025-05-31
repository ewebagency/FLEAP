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


# Base image officielle Python slim
FROM python:3.12-slim

# Installer les dépendances système essentielles
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Copier requirements (optionnel)
# COPY requirements.txt /app/requirements.txt
# RUN pip install --no-cache-dir -r /app/requirements.txt

# Installer pandas + paddleocr
RUN pip install --upgrade pip setuptools wheel
RUN pip install pandas paddleocr

# Copier le code (optionnel)
# COPY . /app
# WORKDIR /app

# Commande par défaut
CMD ["python3"]
